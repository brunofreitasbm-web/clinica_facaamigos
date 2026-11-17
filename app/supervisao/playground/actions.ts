"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { PLAYGROUND_MAX_VISITS } from "@/lib/playground/constants";
import { findPlaygroundUnit, PLAYGROUND_UNIT_HELP } from "@/lib/playground/units";

type ActionResult = { success: true } | { success: false; error: string };

const PATH = "/supervisao/playground";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type VisitInput = { date: string; time: string; durationMin: number };

/** Só gestor e supervisor mexem no playground (a RLS também barra). */
async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sessão expirada. Entre de novo." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "gestor" && profile.role !== "supervisor")) {
    return { ok: false as const, error: "Só a Supervisão pode gerenciar o playground." };
  }
  return { ok: true as const, supabase, userId: user.id };
}

function validateVisit(v: VisitInput, today: string): string | null {
  if (!DATE_RE.test(v.date) || !TIME_RE.test(v.time)) return "Informe data e horário de cada visita.";
  if (v.date < today) return "A data da visita não pode estar no passado.";
  if (!Number.isInteger(v.durationMin) || v.durationMin < 15 || v.durationMin > 240) return "Duração inválida.";
  return null;
}

const toIso = (v: { date: string; time: string }) => zonedDateTimeToUtc(v.date, v.time, CLINIC_TIMEZONE).toISOString();

export async function saveLocation(posUnitId: string): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { success: false, error: auth.error };
  const unit = findPlaygroundUnit(posUnitId);
  if (!unit) return { success: false, error: PLAYGROUND_UNIT_HELP };

  const { error } = await auth.supabase
    .from("playground_locations")
    .insert({ clinic_id: DEV_CLINIC_ID, name: unit.name, pos_unit_id: unit.posUnitId });
  if (error) {
    return {
      success: false,
      error: error.code === "23505" ? "Este playground já está cadastrado." : "Não foi possível salvar o local.",
    };
  }
  revalidatePath(PATH);
  return { success: true };
}

/** Corrige a unidade de um local já cadastrado (o nome acompanha a unidade escolhida). */
export async function updateLocation(id: string, posUnitId: string): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { success: false, error: auth.error };
  const unit = findPlaygroundUnit(posUnitId);
  if (!unit) return { success: false, error: PLAYGROUND_UNIT_HELP };

  const { data, error } = await auth.supabase
    .from("playground_locations")
    .update({ name: unit.name, pos_unit_id: unit.posUnitId })
    .eq("id", id)
    .select("id");
  if (error) {
    return {
      success: false,
      error: error.code === "23505" ? "Este playground já está cadastrado." : "Não foi possível salvar o local.",
    };
  }
  if (!data || data.length === 0) return { success: false, error: "Local não encontrado. Atualize a página." };
  revalidatePath(PATH);
  return { success: true };
}

export async function createSeries(input: {
  patientId: string;
  locationId: string;
  level: number;
  visits: VisitInput[];
  release: boolean;
}): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase, userId } = auth;

  if (!input.patientId) return { success: false, error: "Escolha a criança." };
  if (!input.locationId) return { success: false, error: "Escolha o local do playground." };
  if (![1, 2, 3].includes(input.level)) return { success: false, error: "Escolha o nível do VB-MAPP." };
  if (input.visits.length < 1 || input.visits.length > PLAYGROUND_MAX_VISITS) {
    return { success: false, error: `Informe de 1 a ${PLAYGROUND_MAX_VISITS} visitas.` };
  }
  const today = todayInTimeZone(CLINIC_TIMEZONE);
  for (const v of input.visits) {
    const problem = validateVisit(v, today);
    if (problem) return { success: false, error: problem };
  }

  const { data: protocol } = await supabase
    .from("protocols")
    .select("id")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("name", "vbmapp")
    .maybeSingle();
  if (!protocol) {
    return { success: false, error: "O VB-MAPP ainda não está cadastrado na clínica. Cadastre-o em Cadastros, Terapias." };
  }

  // Uma série em andamento por criança.
  const { data: open } = await supabase
    .from("playground_series")
    .select("id")
    .eq("patient_id", input.patientId)
    .in("status", ["rascunho", "liberada"])
    .limit(1);
  if (open && open.length > 0) {
    return { success: false, error: "Esta criança já tem uma avaliação do playground em andamento. Conclua ou cancele a atual." };
  }

  const ordered = [...input.visits].sort((a, b) => toIso(a).localeCompare(toIso(b)));
  const { data: series, error } = await supabase
    .from("playground_series")
    .insert({
      clinic_id: DEV_CLINIC_ID,
      patient_id: input.patientId,
      location_id: input.locationId,
      protocol_id: protocol.id,
      level: input.level,
      total_visits: ordered.length,
      status: input.release ? "liberada" : "rascunho",
      released_at: input.release ? new Date().toISOString() : null,
      released_by: input.release ? userId : null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !series) return { success: false, error: "Não foi possível criar a avaliação. Tente de novo." };

  const { error: visitsError } = await supabase.from("playground_visits").insert(
    ordered.map((v, i) => ({
      series_id: series.id,
      visit_no: i + 1,
      scheduled_start: toIso(v),
      duration_min: v.durationMin,
    })),
  );
  if (visitsError) {
    await supabase.from("playground_series").delete().eq("id", series.id);
    return { success: false, error: "Não foi possível salvar as visitas. Tente de novo." };
  }

  revalidatePath(PATH);
  return { success: true };
}

/** O OK da Supervisão: a série passa a aparecer no PDV do local. */
export async function releaseSeries(seriesId: string): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { success: false, error: auth.error };
  const { error, data } = await auth.supabase
    .from("playground_series")
    .update({ status: "liberada", released_at: new Date().toISOString(), released_by: auth.userId })
    .eq("id", seriesId)
    .eq("status", "rascunho")
    .select("id");
  if (error || !data || data.length === 0) return { success: false, error: "Não foi possível liberar. Atualize a página." };
  revalidatePath(PATH);
  return { success: true };
}

export async function cancelSeries(seriesId: string): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { success: false, error: auth.error };
  const { data, error } = await auth.supabase
    .from("playground_series")
    .update({ status: "cancelada" })
    .eq("id", seriesId)
    .in("status", ["rascunho", "liberada"])
    .select("id");
  if (error || !data || data.length === 0) return { success: false, error: "Não foi possível cancelar." };
  await auth.supabase
    .from("playground_visits")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("series_id", seriesId)
    .is("cancelled_at", null);
  revalidatePath(PATH);
  return { success: true };
}

/** Remarca uma visita que ainda não teve nenhuma entrada (nova data e horário). */
export async function rescheduleVisit(visitId: string, date: string, time: string): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { success: false, error: auth.error };
  const problem = validateVisit({ date, time, durationMin: 60 }, todayInTimeZone(CLINIC_TIMEZONE));
  if (problem) return { success: false, error: problem };

  const { count } = await auth.supabase
    .from("playground_entries")
    .select("id", { count: "exact", head: true })
    .eq("visit_id", visitId);
  if ((count ?? 0) > 0) return { success: false, error: "Esta visita já tem avaliação registrada e não pode ser remarcada." };

  const { data, error } = await auth.supabase
    .from("playground_visits")
    .update({ scheduled_start: toIso({ date, time }), arrived_at: null, left_at: null, cancelled_at: null })
    .eq("id", visitId)
    .select("id");
  if (error || !data || data.length === 0) return { success: false, error: "Não foi possível remarcar." };
  revalidatePath(PATH);
  return { success: true };
}

/** Prorroga a série com mais uma visita (até o máximo de 5). */
export async function extendSeries(seriesId: string, date: string, time: string): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { success: false, error: auth.error };
  const problem = validateVisit({ date, time, durationMin: 60 }, todayInTimeZone(CLINIC_TIMEZONE));
  if (problem) return { success: false, error: problem };

  const { data: series } = await auth.supabase
    .from("playground_series")
    .select("id, total_visits, status")
    .eq("id", seriesId)
    .maybeSingle();
  if (!series || series.status !== "liberada") return { success: false, error: "Só dá para prorrogar uma avaliação liberada." };
  if (series.total_visits >= PLAYGROUND_MAX_VISITS) {
    return { success: false, error: `A avaliação já tem ${PLAYGROUND_MAX_VISITS} visitas, o máximo permitido.` };
  }

  const { data: last } = await auth.supabase
    .from("playground_visits")
    .select("visit_no")
    .eq("series_id", seriesId)
    .order("visit_no", { ascending: false })
    .limit(1);
  const nextNo = (last?.[0]?.visit_no ?? series.total_visits) + 1;
  if (nextNo > PLAYGROUND_MAX_VISITS) return { success: false, error: `Limite de ${PLAYGROUND_MAX_VISITS} visitas atingido.` };

  const { error } = await auth.supabase
    .from("playground_visits")
    .insert({ series_id: seriesId, visit_no: nextNo, scheduled_start: toIso({ date, time }) });
  if (error) return { success: false, error: "Não foi possível adicionar a visita." };
  await auth.supabase
    .from("playground_series")
    .update({ total_visits: Math.min(series.total_visits + 1, PLAYGROUND_MAX_VISITS) })
    .eq("id", seriesId);
  revalidatePath(PATH);
  return { success: true };
}
