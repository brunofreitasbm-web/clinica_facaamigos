// lib/patient-merge.ts
// Detecta e mescla cadastros duplicados da MESMA criança (regras em
// lib/patient-duplicates-pure.ts; a mesclagem em si é a RPC
// `merge_duplicate_patients`, migration 20261030150000). Chamado nos pontos em que
// um paciente nasce (bot de WhatsApp, validação de rascunho, cadastro presencial,
// acolhimento) e pelo varredor do cron, para a criança ficar num cadastro só — no
// ponto mais avançado do fluxo. Nunca lança: duplicidade não pode derrubar o
// webhook nem a Server Action que a detectou.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { CANCELLED_APPOINTMENT_STATUSES, computeStage } from "@/lib/patient-stage";
import { planMerges, type PatientIdentity } from "@/lib/patient-duplicates-pure";

type Admin = ReturnType<typeof createAdminClient>;
// A RPC ainda não consta em lib/database.types.ts (migration precisa ser aplicada e os tipos regenerados).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = (admin: Admin) => admin as unknown as SupabaseClient<any>;

export type MergeOutcome = { kept: string; dropped: string; ok: boolean; error?: string };

async function loadIdentities(admin: Admin, birthDates: string[]): Promise<PatientIdentity[]> {
  if (birthDates.length === 0) return [];
  const { data: patients } = await admin
    .from("patients")
    .select("id, full_name, birth_date, status, created_at, evaluated_at, first_session_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .in("birth_date", birthDates);
  const rows = patients ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);

  const [{ data: guardians }, { data: evals }, { data: auths }] = await Promise.all([
    admin.from("guardians").select("patient_id, full_name, phone").in("patient_id", ids),
    admin
      .from("appointments")
      .select("patient_id")
      .in("patient_id", ids)
      .eq("is_evaluation", true)
      .not("status", "in", `(${CANCELLED_APPOINTMENT_STATUSES.join(",")})`),
    admin.from("authorizations").select("patient_insurance!inner(patient_id)").in("patient_insurance.patient_id", ids).eq("status", "ativa"),
  ]);

  const evalIds = new Set((evals ?? []).map((a) => a.patient_id));
  const authIds = new Set(
    (auths ?? []).flatMap((a) => {
      const pi = a.patient_insurance as { patient_id: string } | { patient_id: string }[] | null;
      return pi ? (Array.isArray(pi) ? pi.map((x) => x.patient_id) : [pi.patient_id]) : [];
    }),
  );

  return rows.map((p) => {
    const gs = (guardians ?? []).filter((g) => g.patient_id === p.id);
    return {
      id: p.id,
      fullName: p.full_name,
      birthDate: p.birth_date,
      status: p.status,
      createdAt: p.created_at,
      stage: computeStage(p, evalIds.has(p.id), authIds.has(p.id)),
      evaluated: Boolean(p.evaluated_at),
      hasActiveEvaluation: evalIds.has(p.id),
      guardianNames: gs.map((g) => g.full_name).filter(Boolean),
      guardianPhones: gs.map((g) => g.phone ?? "").filter(Boolean),
    };
  });
}

async function runPlans(admin: Admin, plans: ReturnType<typeof planMerges<PatientIdentity>>): Promise<MergeOutcome[]> {
  const outcomes: MergeOutcome[] = [];
  for (const { keep, drop } of plans) {
    for (const d of drop) {
      const { data, error } = await loose(admin).rpc("merge_duplicate_patients", { p_keep: keep.id, p_drop: d.id });
      const result = data as { success?: boolean; error?: string } | null;
      const ok = !error && result?.success === true;
      if (!ok) console.error(`[Patient Merge] ${d.id} -> ${keep.id} falhou:`, error?.message ?? result?.error);
      outcomes.push({ kept: keep.id, dropped: d.id, ok, error: ok ? undefined : (error?.message ?? result?.error) });
    }
  }
  return outcomes;
}

/**
 * Mescla os duplicados do paciente informado (mesmo nascimento/telefone/responsável
 * e primeiro nome). Devolve o id que ficou — pode ser OUTRO cadastro, se o
 * existente estiver mais adiantado no fluxo; quem chama deve passar a usar esse id.
 */
export async function mergeDuplicatesOf(patientId: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data: me } = await admin.from("patients").select("birth_date").eq("id", patientId).maybeSingle();
    if (!me?.birth_date) return patientId;

    const identities = await loadIdentities(admin, [me.birth_date]);
    const plan = planMerges(identities).filter((g) => g.keep.id === patientId || g.drop.some((d) => d.id === patientId));
    if (plan.length === 0) return patientId;

    const outcomes = await runPlans(admin, plan);
    // Só considera o sobrevivente se a mesclagem em que `patientId` saiu deu certo.
    const movedOut = plan.find((g) => g.drop.some((d) => d.id === patientId));
    if (movedOut && outcomes.some((o) => o.dropped === patientId && o.ok)) return movedOut.keep.id;
    return patientId;
  } catch (err) {
    console.error("[Patient Merge] Exceção em mergeDuplicatesOf:", err);
    return patientId;
  }
}

/** Varre a clínica inteira (cron/manual). Devolve o que foi mesclado. */
export async function sweepDuplicatePatients(): Promise<MergeOutcome[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("patients").select("birth_date").eq("clinic_id", DEV_CLINIC_ID).not("birth_date", "is", null);
    const dates = [...new Set((data ?? []).map((p) => p.birth_date as string))];
    const identities = await loadIdentities(admin, dates);
    return await runPlans(admin, planMerges(identities));
  } catch (err) {
    console.error("[Patient Merge] Exceção em sweepDuplicatePatients:", err);
    return [];
  }
}
