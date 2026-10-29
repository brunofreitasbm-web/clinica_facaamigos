// lib/evaluation-offer-pending-digest.ts
// Resumo das 8h para supervisão e gestão: horários que os responsáveis já escolheram e
// esperam o OK de confirmação, mais o que ainda depende da família ou do envio. Não envia
// nada quando não há OK pendente (sem e-mail vazio). Chamado por
// /api/twilio/evaluation-offers/digest (pg_cron, seg–sex 08h).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { renderBrandEmailHtml, sendEmail } from "@/lib/email";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = SupabaseClient<any>;

export type PendingDigestResult = {
  pendingOks: number;
  waitingFamily: number;
  needsAttention: number;
  recipients: number;
  sent: boolean;
  error?: string;
};

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TIMEZONE, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export async function sendPendingOkDigest(): Promise<PendingDigestResult> {
  const db = createAdminClient() as unknown as Loose;

  const [okRes, waitRes, attentionRes, peopleRes] = await Promise.all([
    db
      .from("evaluation_offers")
      .select("chosen_at, patients(full_name), appointments:appointment_id(starts_at)")
      .eq("status", "aguardando_supervisor")
      .order("chosen_at", { ascending: true }),
    db.from("evaluation_offers").select("id", { count: "exact", head: true }).in("status", ["aguardando_interesse", "aguardando_escolha"]),
    db.from("evaluation_offers").select("id", { count: "exact", head: true }).in("status", ["falhou", "sem_horario"]),
    db.from("profiles").select("email").in("role", ["supervisor", "gestor"]).eq("active", true),
  ]);
  if (okRes.error) throw new Error(`evaluation_offers: ${okRes.error.message}`);

  type OkRow = { patients: { full_name: string } | { full_name: string }[] | null; appointments: { starts_at: string } | { starts_at: string }[] | null };
  const oks = ((okRes.data ?? []) as OkRow[]).map((r) => {
    const p = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const a = Array.isArray(r.appointments) ? r.appointments[0] : r.appointments;
    return { name: p?.full_name ?? "—", when: a?.starts_at ? whenLabel(a.starts_at) : "—" };
  });
  const emails = [...new Set(((peopleRes.data ?? []) as { email: string | null }[]).map((p) => p.email).filter((e): e is string => Boolean(e)))];
  const base = { pendingOks: oks.length, waitingFamily: waitRes.count ?? 0, needsAttention: attentionRes.count ?? 0, recipients: emails.length };

  if (oks.length === 0 || emails.length === 0) return { ...base, sent: false };

  const rows = oks
    .map((o) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e8eaec;">${escapeHtml(o.name)}</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaec;white-space:nowrap;font-weight:800;">${escapeHtml(o.when)}</td></tr>`)
    .join("");
  const html = renderBrandEmailHtml({
    title: "OKs pendentes de confirmação",
    preheader: `${oks.length} horário(s) escolhido(s) pelos responsáveis`,
    contentHtml:
      `<p>Bom dia! ${oks.length} responsável(is) já escolheram o horário da 1ª avaliação e esperam a sua confirmação na Agenda 1ª Avaliação:</p>` +
      `<table style="width:100%;border-collapse:collapse;font-size:15px;">${rows}</table>` +
      `<p>Ainda sem escolha: ${base.waitingFamily}. Precisam de atenção (falha de envio ou sem horário): ${base.needsAttention}.</p>`,
  });
  const text =
    `Bom dia! ${oks.length} horário(s) escolhido(s) aguardam confirmação:\n` +
    oks.map((o) => `- ${o.name}: ${o.when}`).join("\n") +
    `\nSem escolha: ${base.waitingFamily}. Precisam de atenção: ${base.needsAttention}.`;

  const res = await sendEmail({ to: emails, subject: `OKs pendentes de confirmação: ${oks.length}`, html, text });
  return res.success ? { ...base, sent: true } : { ...base, sent: false, error: res.error };
}
