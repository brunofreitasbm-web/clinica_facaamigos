"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { zonedDateTimeToUtc, nextCalendarDay } from "@/lib/timezone";

type ActionResult =
  | { success: true; collisions?: { count: number; sample: string[] } }
  | { success: false; error: string };

const MANAGER_ROLES = ["supervisor", "gestor"];
const KINDS = ["feriado_municipal", "feriado_estadual", "recesso", "fechamento"];

// `clinic_closures` ainda não está em lib/database.types.ts (a migration
// 20261029120000 precisa ser aplicada e os tipos regenerados) — acesso sem
// tipagem forte até lá.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = SupabaseClient<any>;

/** Mesma checagem de papel de app/supervisao/disponibilidade/actions.ts (o RLS é a barreira real). */
async function assertManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role && !MANAGER_ROLES.includes(profile.role)) {
    return "Somente supervisão ou gestão pode cadastrar feriados e fechamentos.";
  }
  return null;
}

/**
 * Fechamento novo não cancela nada sozinho: avisa quantos agendamentos já
 * marcados caem na janela, pra supervisão remarcar com as famílias.
 */
async function findCollisions(supabase: LooseClient, date: string, start: string | null, end: string | null) {
  const from = zonedDateTimeToUtc(date, start ?? "00:00", CLINIC_TIMEZONE).toISOString();
  const to = end
    ? zonedDateTimeToUtc(date, end, CLINIC_TIMEZONE).toISOString()
    : zonedDateTimeToUtc(nextCalendarDay(date), "00:00", CLINIC_TIMEZONE).toISOString();
  const { data } = await supabase
    .from("appointments")
    .select("starts_at, patients(full_name)")
    .lt("starts_at", to)
    .gt("ends_at", from)
    .not("status", "in", "(cancelada_familia,cancelada_terapeuta,cancelada_clinica,remarcada)")
    .order("starts_at")
    .limit(200);
  const rows = (data ?? []) as unknown as { starts_at: string; patients: { full_name: string } | null }[];
  return {
    count: rows.length,
    sample: rows.slice(0, 5).map((r) => {
      const hhmm = new Date(r.starts_at).toLocaleTimeString("pt-BR", { timeZone: CLINIC_TIMEZONE, hour: "2-digit", minute: "2-digit" });
      return `${hhmm} ${r.patients?.full_name ?? "—"}`;
    }),
  };
}

export async function addClosure(formData: FormData): Promise<ActionResult> {
  const date = String(formData.get("closure_date") ?? "");
  const kind = String(formData.get("kind") ?? "fechamento");
  const reason = String(formData.get("reason") ?? "").trim();
  const start = String(formData.get("start_time") ?? "") || null;
  const end = String(formData.get("end_time") ?? "") || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: "Informe a data." };
  if (!reason) return { success: false, error: "Informe o motivo (ex.: Aniversário da cidade)." };
  if (!KINDS.includes(kind)) return { success: false, error: "Tipo inválido." };
  if ((start === null) !== (end === null)) return { success: false, error: "Informe início e fim, ou deixe os dois vazios para o dia inteiro." };
  if (start && end && start >= end) return { success: false, error: "O fim precisa ser depois do início." };

  const supabase = await createClient();
  const denied = await assertManager(supabase);
  if (denied) return { success: false, error: denied };

  const loose = supabase as unknown as LooseClient;
  const { error } = await loose.from("clinic_closures").insert({
    clinic_id: DEV_CLINIC_ID,
    closure_date: date,
    start_time: start,
    end_time: end,
    reason,
    kind,
  });
  if (error) return { success: false, error: "Não foi possível salvar este fechamento." };

  const collisions = await findCollisions(loose, date, start, end);
  revalidatePath("/supervisao/feriados");
  return { success: true, collisions };
}

export async function removeClosure(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const denied = await assertManager(supabase);
  if (denied) return { success: false, error: denied };

  const { error } = await (supabase as unknown as LooseClient).from("clinic_closures").delete().eq("id", id);
  if (error) return { success: false, error: "Não foi possível remover este fechamento." };

  revalidatePath("/supervisao/feriados");
  return { success: true };
}
