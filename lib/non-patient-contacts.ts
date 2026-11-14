// lib/non-patient-contacts.ts
//
// Leitura/escrita de `non_patient_contacts` pelo lado do robô (client admin).
// Marcação e desmarcação pela tela ficam em app/recepcao/non-patient-actions.ts.
// Nada aqui lança: falha de leitura nunca pode derrubar a resposta do robô
// (na dúvida, o contato segue tratado como lead, que é o comportamento antigo).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";

// Tabela nova ainda fora de lib/database.types.ts.
const loose = (admin: ReturnType<typeof createAdminClient>): SupabaseClient => admin as unknown as SupabaseClient;

export type NonPatientMark = { id: string; reason: string; markedAt: string };

/** Marcação "não é paciente" do telefone, ou null. */
export async function getNonPatientMark(phone: string | null | undefined, clinicId: string = DEV_CLINIC_ID): Promise<NonPatientMark | null> {
  if (!phone) return null;
  try {
    const { data } = await loose(createAdminClient())
      .from("non_patient_contacts")
      .select("id, reason, marked_at")
      .eq("clinic_id", clinicId)
      .eq("phone", phone)
      .maybeSingle();
    if (!data) return null;
    const row = data as { id: string; reason: string; marked_at: string };
    return { id: row.id, reason: row.reason, markedAt: row.marked_at };
  } catch (err) {
    console.error("[Não é paciente] Falha ao ler marcação:", err);
    return null;
  }
}

/** Telefones marcados dentre os informados (para filtrar listas). */
export async function nonPatientPhones(
  client: SupabaseClient,
  phones: string[],
  clinicId: string = DEV_CLINIC_ID,
): Promise<Set<string>> {
  const unique = [...new Set(phones.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const { data, error } = await client.from("non_patient_contacts").select("phone").eq("clinic_id", clinicId).in("phone", unique);
  if (error) {
    console.error("[Não é paciente] Falha ao listar marcações:", error.message);
    return new Set();
  }
  return new Set(((data ?? []) as { phone: string }[]).map((r) => r.phone));
}

/**
 * Chamado pelo espelhamento do robô de agendamento antes de abrir rascunho.
 * Devolve true quando o telefone segue marcado e o rascunho NÃO deve ser
 * criado. Com `therapyIntent` (robô colheu dado da criança ou documento no
 * fluxo de agendamento: ver botDataShowsTherapyIntent), a marcação cai sozinha, com registro no audit_log, e o fluxo normal segue.
 */
export async function shouldSkipDraftForNonPatient(phone: string, therapyIntent: boolean): Promise<boolean> {
  const mark = await getNonPatientMark(phone);
  if (!mark) return false;
  if (!therapyIntent) return true;

  try {
    const admin = createAdminClient();
    await loose(admin).from("non_patient_contacts").delete().eq("id", mark.id);
    await admin.from("audit_log").insert({
      table_name: "non_patient_contacts",
      row_id: mark.id,
      action: "non_patient_auto_cleared",
      actor_id: null,
      clinic_id: DEV_CLINIC_ID,
      before: { phone, reason: mark.reason },
      after: { cause: "robô colheu dado da criança ou documento" },
    });
  } catch (err) {
    console.error("[Não é paciente] Falha ao desfazer marcação automática:", err);
  }
  return false;
}
