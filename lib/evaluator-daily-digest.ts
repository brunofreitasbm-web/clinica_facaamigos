import { CLINIC_TIMEZONE } from "@/lib/constants";
import { GRID_EXCLUDED_STATUSES } from "@/lib/appointment-status-style";
import { renderBrandEmailHtml, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

type DigestItem = { time: string; patientName: string };

export type EvaluatorDigestResult = {
  date: string;
  sent: number;
  failed: { evaluator: string; error: string }[];
  skippedNoEmail: string[];
  skippedNoEvaluations: string[];
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "YYYY-MM-DD" do dia civil de `now` no fuso da clínica. */
function civilDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TIMEZONE }).format(now);
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function renderDigest(name: string, dateBr: string, items: DigestItem[]) {
  const first = name.split(" ")[0];
  const body = `<p>Bom dia, ${escapeHtml(first)}! Suas avaliações de hoje (${dateBr}):</p>
       <table style="width:100%;border-collapse:collapse;font-size:15px;">
         ${items
           .map(
             (i) =>
               `<tr><td style="padding:8px 12px;border-bottom:1px solid #e8eaec;font-weight:800;white-space:nowrap;">${i.time}</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaec;">${escapeHtml(i.patientName)}</td></tr>`,
           )
           .join("")}
       </table>`;

  const text = items.length
    ? `Bom dia, ${first}! Suas avaliações de hoje (${dateBr}):\n` + items.map((i) => `${i.time} - ${i.patientName}`).join("\n")
    : `Bom dia, ${first}! Você não tem avaliações agendadas para hoje (${dateBr}).`;

  return {
    subject: `Avaliações de hoje (${dateBr}): ${items.length}`,
    html: renderBrandEmailHtml({ title: "Diário de avaliações", preheader: `Avaliações de ${dateBr}`, contentHtml: body }),
    text,
  };
}

/**
 * Envia a cada terapeuta avaliador (profiles.is_evaluator) a lista das 1ª
 * avaliações do dia (appointments.is_evaluation), em ordem de horário. Sem
 * avaliações no dia, não envia nada (skippedNoEvaluations). Chamado às 7h59 (10:59 UTC) pelo
 * pg_cron em /api/twilio/evaluator-digest.
 */
export async function sendEvaluatorDailyDigest(now: Date = new Date()): Promise<EvaluatorDigestResult> {
  const admin = createAdminClient();
  const date = civilDate(now);
  const dateBr = date.split("-").reverse().join("/");
  // Brasil sem horário de verão desde 2019: o fuso da clínica é UTC-3 fixo.
  const dayStart = `${date}T00:00:00-03:00`;
  const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { data: evaluators, error: evErr } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_evaluator", true)
    .eq("active", true);
  if (evErr) throw new Error(`profiles: ${evErr.message}`);

  const result: EvaluatorDigestResult = { date, sent: 0, failed: [], skippedNoEmail: [], skippedNoEvaluations: [] };
  const ids = (evaluators ?? []).map((e) => e.id);
  if (ids.length === 0) return result;

  const { data: appts, error: apErr } = await admin
    .from("appointments")
    .select("therapist_id, starts_at, patients(full_name)")
    .eq("is_evaluation", true)
    .in("therapist_id", ids)
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd)
    .not("status", "in", `(${GRID_EXCLUDED_STATUSES.join(",")})`)
    .order("starts_at", { ascending: true });
  if (apErr) throw new Error(`appointments: ${apErr.message}`);

  for (const ev of evaluators ?? []) {
    if (!ev.email) {
      result.skippedNoEmail.push(ev.full_name);
      continue;
    }
    const items: DigestItem[] = (appts ?? [])
      .filter((a) => a.therapist_id === ev.id)
      .map((a) => {
        const p = Array.isArray(a.patients) ? a.patients[0] : a.patients;
        return { time: timeLabel(a.starts_at), patientName: p?.full_name ?? "—" };
      });
    if (items.length === 0) {
      result.skippedNoEvaluations.push(ev.full_name);
      continue;
    }
    const mail = renderDigest(ev.full_name, dateBr, items);
    const res = await sendEmail({ to: ev.email, ...mail });
    if (res.success) result.sent += 1;
    else result.failed.push({ evaluator: ev.full_name, error: res.error });
  }
  return result;
}
