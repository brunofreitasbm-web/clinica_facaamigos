// lib/patient-context.ts
// Carrega o contexto do paciente vinculado (ver lib/patient-context-pure.ts) e devolve o
// bloco do prompt. Nunca lança: sem contexto o bot responde como antes.

import { createAdminClient } from "@/lib/supabase/admin";
import { buildPatientContextBlock, type PatientContext } from "@/lib/patient-context-pure";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

const CLINIC_TZ = "America/Sao_Paulo";

function formatSessionLabel(startsAt: string): string {
  const d = new Date(startsAt);
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TZ, weekday: "short", day: "2-digit", month: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  return `${day} às ${time}`;
}

export async function loadPatientContext(patientId: string): Promise<PatientContext | null> {
  try {
    const admin = createAdminClient() as Loose;
    const nowIso = new Date().toISOString();

    const [patientRes, insuranceRes, nextRes] = await Promise.all([
      admin.from("patients").select("full_name").eq("id", patientId).maybeSingle(),
      admin.from("patient_insurance").select("id").eq("patient_id", patientId),
      admin
        .from("appointments")
        .select("starts_at, is_evaluation")
        .eq("patient_id", patientId)
        .in("status", ["agendada", "confirmada"])
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(1),
    ]);

    const insuranceIds = ((insuranceRes.data ?? []) as { id: string }[]).map((r) => r.id);
    let guide: { valid_to: string; sessions_authorized: number; sessions_used: number } | null = null;
    if (insuranceIds.length > 0) {
      const { data } = await admin
        .from("authorizations")
        .select("valid_to, sessions_authorized, sessions_used")
        .in("patient_insurance_id", insuranceIds)
        .eq("status", "ativa")
        .order("valid_to", { ascending: true })
        .limit(1);
      guide = data?.[0] ?? null;
    }

    const fullName = (patientRes.data?.full_name as string | undefined) ?? "";
    const next = nextRes.data?.[0] as { starts_at: string; is_evaluation: boolean } | undefined;
    return {
      childFirstName: fullName.trim().split(/\s+/)[0] || null,
      guideValidTo: guide?.valid_to ?? null,
      guideSessionsLeft: guide ? guide.sessions_authorized - guide.sessions_used : null,
      nextSessionLabel: next ? formatSessionLabel(next.starts_at) : null,
      nextSessionIsEvaluation: Boolean(next?.is_evaluation),
    };
  } catch (err) {
    console.error("[Patient Context] falha ao carregar:", err);
    return null;
  }
}

/** Bloco pronto para o prompt (vazio se não houver paciente ou dados). */
export async function loadPatientContextBlock(patientId: string | null): Promise<string> {
  if (!patientId) return "";
  const ctx = await loadPatientContext(patientId);
  return buildPatientContextBlock(ctx, new Date().toISOString().slice(0, 10));
}
