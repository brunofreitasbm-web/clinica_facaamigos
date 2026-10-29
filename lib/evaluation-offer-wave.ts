// lib/evaluation-offer-wave.ts
// "1ª onda": o primeiro disparo automático da oferta de horários (lib/evaluation-offer.ts)
// a todos os pacientes que já esperam a 1ª avaliação com o plano autorizado.
//
// Como funciona:
//   - `evaluation_offer_settings` guarda a chave (`wave_enabled`), o tamanho do lote e a data
//     piso (`wave_earliest_date`, 06/11/2026): na onda, nenhum horário é sugerido antes dela.
//   - Um cron de 5 em 5 minutos chama /api/twilio/evaluation-offers/wave. Cada chamada só age
//     com a chave ligada, em dia útil, das 08h às 18h e com a clínica aberta; envia um lote
//     (padrão 10) e, quando não sobra ninguém, desliga a chave e avisa a supervisão.
//   - Quem já teve oferta (qualquer status) nunca é reenviado pela onda.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { loadClinicCalendar } from "@/lib/clinic-calendar";
import { weekdayOf } from "@/lib/clinic-calendar-pure";
import { getTwilioContentSidForCategory } from "@/lib/twilio";
import { startEvaluationOffer } from "@/lib/evaluation-offer";
import { canDispatchNow, selectWaveCandidates, type WaveCandidate } from "@/lib/evaluation-offer-wave-pure";
import { renderBrandEmailHtml, sendEmail } from "@/lib/email";
import { notifyRolesPush } from "@/lib/web-push";

// `evaluation_offers` e `evaluation_offer_settings` ainda não estão em lib/database.types.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = SupabaseClient<any>;

const CANCELLED = ["cancelada_familia", "cancelada_terapeuta", "cancelada_clinica", "remarcada"];
const ACTIVE_INTAKE_LEAD = ["approved", "awaiting_documents", "pending_supervisor", "awaiting_slot", "pending_confirmation"];

type WaveSettings = {
  wave_enabled: boolean;
  wave_batch_size: number;
  wave_earliest_date: string | null;
  wave_started_at: string | null;
};

export type WaveRunResult =
  | { status: "disabled" }
  | { status: "template_missing" }
  | { status: "outside_window"; reason: string }
  | { status: "dry_run"; candidates: WaveCandidate[] }
  | { status: "batch"; sent: number; failed: number; remaining: number }
  | { status: "finished"; summary: Record<string, number> };

function minuteOfDayInClinic(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(instant);
  return (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
}

async function loadSettings(db: Loose, clinicId: string): Promise<WaveSettings | null> {
  const { data, error } = await db
    .from("evaluation_offer_settings")
    .select("wave_enabled, wave_batch_size, wave_earliest_date, wave_started_at")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) {
    console.error("[Evaluation Wave] evaluation_offer_settings:", error.message);
    return null;
  }
  return (data as WaveSettings | null) ?? null;
}

/** Pacientes aptos para a onda (ver selectWaveCandidates), em ordem de nome. */
export async function findWaveCandidates(db: Loose): Promise<WaveCandidate[]> {
  const [draftsRes, activeAuthRes] = await Promise.all([
    db.from("registration_drafts").select("patient_id").not("plan_authorized_at", "is", null).not("patient_id", "is", null),
    db.from("authorizations").select("patient_insurance!inner(patient_id)").eq("status", "ativa"),
  ]);
  if (draftsRes.error) throw new Error(`registration_drafts: ${draftsRes.error.message}`);
  if (activeAuthRes.error) throw new Error(`authorizations: ${activeAuthRes.error.message}`);

  const ids = new Set<string>();
  for (const d of (draftsRes.data ?? []) as { patient_id: string }[]) ids.add(d.patient_id);
  for (const a of (activeAuthRes.data ?? []) as { patient_insurance: { patient_id: string } | { patient_id: string }[] | null }[]) {
    const pi = Array.isArray(a.patient_insurance) ? a.patient_insurance[0] : a.patient_insurance;
    if (pi?.patient_id) ids.add(pi.patient_id);
  }
  if (ids.size === 0) return [];
  const idList = [...ids];

  const [patientsRes, evalRes, offerRes, leadRes] = await Promise.all([
    db.from("patients").select("id, full_name").in("id", idList),
    db.from("appointments").select("patient_id").in("patient_id", idList).eq("is_evaluation", true).not("status", "in", `(${CANCELLED.join(",")})`),
    db.from("evaluation_offers").select("patient_id").in("patient_id", idList),
    db.from("insurance_intake_leads").select("patient_id").in("patient_id", idList).in("status", ACTIVE_INTAKE_LEAD),
  ]);
  for (const [name, res] of [["patients", patientsRes], ["appointments", evalRes], ["evaluation_offers", offerRes], ["insurance_intake_leads", leadRes]] as const) {
    if (res.error) throw new Error(`${name}: ${res.error.message}`);
  }

  const toSet = (rows: unknown) => new Set(((rows ?? []) as { patient_id: string }[]).map((r) => r.patient_id));
  return selectWaveCandidates({
    authorized: ((patientsRes.data ?? []) as { id: string; full_name: string }[]).map((p) => ({ patientId: p.id, patientName: p.full_name })),
    withEvaluation: toSet(evalRes.data),
    withOffer: toSet(offerRes.data),
    withActiveIntakeLead: toSet(leadRes.data),
  });
}

async function supervisorEmails(db: Loose): Promise<string[]> {
  const { data } = await db.from("profiles").select("email").in("role", ["supervisor", "gestor"]).eq("active", true);
  return [...new Set(((data ?? []) as { email: string | null }[]).map((p) => p.email).filter((e): e is string => Boolean(e)))];
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function finishWave(db: Loose, settings: WaveSettings, clinicId: string): Promise<Record<string, number>> {
  const since = settings.wave_started_at ?? new Date().toISOString();
  const { data } = await db.from("evaluation_offers").select("status").gte("created_at", since);
  const summary: Record<string, number> = {};
  for (const row of (data ?? []) as { status: string }[]) summary[row.status] = (summary[row.status] ?? 0) + 1;

  await db
    .from("evaluation_offer_settings")
    .update({ wave_enabled: false, wave_finished_at: new Date().toISOString(), wave_summary: summary, updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId);

  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  const falhas = (summary.falhou ?? 0) + (summary.sem_horario ?? 0);
  const lines = Object.entries(summary).map(([status, n]) => `${status.replace(/_/g, " ")}: ${n}`);
  const emails = await supervisorEmails(db);
  if (emails.length > 0) {
    const html = renderBrandEmailHtml({
      title: "1ª onda de disparos concluída",
      preheader: `${total} oferta(s) enviada(s)`,
      contentHtml:
        `<p>A oferta de horários da 1ª avaliação foi enviada a ${total} responsável(is).` +
        (falhas > 0 ? ` <strong>${falhas}</strong> precisam de atenção (falha no envio ou sem horário) e aparecem em "Aguardando responsável" na agenda.` : "") +
        `</p><p>${lines.map(escapeHtml).join("<br>")}</p><p>Os horários só podem cair a partir de ${(settings.wave_earliest_date ?? "").split("-").reverse().join("/")}.</p>`,
    });
    await sendEmail({ to: emails, subject: "1ª onda de disparos concluída", html, text: `Oferta enviada a ${total} responsável(is). ${lines.join("; ")}` });
  }
  await notifyRolesPush({
    roles: ["supervisor", "gestor"],
    title: "1ª onda concluída",
    body: `${total} oferta(s) enviada(s)${falhas > 0 ? `, ${falhas} precisam de atenção` : ""}.`,
    url: "/supervisao",
  });
  return summary;
}

/**
 * Um passo da onda. `dryRun` só lista quem receberia (não envia nada, não liga nem
 * desliga a chave e ignora janela e chave) — serve para conferir a lista antes.
 */
export async function runEvaluationOfferWave(opts: { dryRun?: boolean; nowMs?: number; clinicId?: string } = {}): Promise<WaveRunResult> {
  const clinicId = opts.clinicId ?? DEV_CLINIC_ID;
  const db = createAdminClient() as unknown as Loose;

  if (opts.dryRun) return { status: "dry_run", candidates: await findWaveCandidates(db) };

  const settings = await loadSettings(db, clinicId);
  if (!settings || !settings.wave_enabled) return { status: "disabled" };

  // Sem o template da oferta configurado, todo envio falharia e gastaria a lista inteira.
  if (!getTwilioContentSidForCategory("agendamento_avaliacao")) return { status: "template_missing" };

  const now = new Date(opts.nowMs ?? Date.now());
  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const calendar = await loadClinicCalendar(db, today, today, clinicId);
  const window = canDispatchNow({
    date: today,
    minutes: minuteOfDayInClinic(now),
    weekday: weekdayOf(today),
    businessHours: calendar.businessHours,
    closures: calendar.closures,
  });
  if (!window.ok) return { status: "outside_window", reason: window.reason };

  if (!settings.wave_started_at) {
    await db.from("evaluation_offer_settings").update({ wave_started_at: now.toISOString(), updated_at: now.toISOString() }).eq("clinic_id", clinicId);
    settings.wave_started_at = now.toISOString();
  }

  const candidates = await findWaveCandidates(db);
  if (candidates.length === 0) return { status: "finished", summary: await finishWave(db, settings, clinicId) };

  const batch = candidates.slice(0, Math.max(1, settings.wave_batch_size));
  let sent = 0;
  let failed = 0;
  for (const candidate of batch) {
    try {
      const res = await startEvaluationOffer({ patientId: candidate.patientId, clinicId });
      if (res.status === "sent" || res.status === "duplicate") sent += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error("[Evaluation Wave] falha ao iniciar oferta:", err);
    }
  }
  return { status: "batch", sent, failed, remaining: candidates.length - batch.length };
}
