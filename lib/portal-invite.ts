// lib/portal-invite.ts
// Convite ao Portal da Família por WhatsApp para quem JÁ fez a 1ª Avaliação (anamnese). O Portal entrega o
// cupom de boas-vindas (BEMVINDO-) e a tela do Método FaçaAmigos.
//
// Como funciona:
//   - `portal_invite_settings` guarda a chave (`enabled`, nasce DESLIGADA), o teto diário, o intervalo
//     aleatório (min_gap_s a max_gap_s) e o `next_send_at`.
//   - O cron de 1 em 1 minuto chama /api/twilio/portal-invites/tick. Cada chamada envia NO MÁXIMO UMA
//     mensagem, e só quando `next_send_at` venceu; depois sorteia o próximo horário. Nada de sleep dentro
//     da função serverless: o intervalo aleatório mora no `next_send_at`.
//   - Janela: dia útil, 09h às 18h, com a clínica aberta (canDispatchNow). Teto diário por dia civil de Belém.
//   - Anti-banimento: o que derruba o número é a nota de qualidade do template (bloqueios e denúncias). Por isso
//     só recebe quem já é da clínica, 1 convite por telefone, PARAR é respeitado (whatsapp_opt_outs) e o
//     disparo pausa sozinho com 3 falhas seguidas ou código de qualidade/limite da Twilio.
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { loadClinicCalendar } from "@/lib/clinic-calendar";
import { weekdayOf } from "@/lib/clinic-calendar-pure";
import { canDispatchNow } from "@/lib/evaluation-offer-wave-pure";
import { buildMessagePreview, findOrCreateConversation, getTwilioContentSidForCategory } from "@/lib/twilio";
import { sendWhatsApp } from "@/lib/whatsapp";
import { APP_ORIGIN } from "@/lib/clinic-identity";
import {
  generateInviteToken,
  nextGapSeconds,
  pickInviteCandidates,
  shouldPause,
  underDailyCap,
  type InvitePatient,
} from "@/lib/portal-invite-pure";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = SupabaseClient<any>;

/** Convites só a partir das 09h (a janela geral de disparo começa às 08h). */
const INVITE_FROM_MIN = 9 * 60;

export type InviteRunResult =
  | { status: "disabled" }
  | { status: "paused"; reason: string }
  | { status: "template_missing" }
  | { status: "outside_window"; reason: string }
  | { status: "waiting"; nextSendAt: string }
  | { status: "daily_cap"; sentToday: number }
  | { status: "no_candidates" }
  | { status: "dry_run"; total: number; firstNames: string[] }
  | { status: "sent"; remaining: number }
  | { status: "failed"; error: string; paused: string | null };

function minuteOfDayInClinic(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(instant);
  return (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
}

const cryptoRng = () => randomBytes(4).readUInt32BE(0) / 2 ** 32;

/** Texto do convite (igual ao template aprovado na Meta; usado também no registro da conversa). */
export function buildInviteText(v: { guardianFirstName: string; childName: string; link: string }): string {
  return (
    `Olá, ${v.guardianFirstName}. Aqui é a Isabella, do FaçaAmigos. A próxima etapa do Método FaçaAmigos para ${v.childName} ` +
    `está no Portal da Família, e lá tem um cupom de boas-vindas para o Playground e o Circuito (segunda a quinta). ` +
    `Acesse: ${v.link}\nSe não quiser receber mensagens, responda PARAR.`
  );
}

async function loadPatients(db: Loose, clinicId: string): Promise<InvitePatient[]> {
  const [doneRes, evalRes] = await Promise.all([
    db.from("patients").select("id").eq("clinic_id", clinicId).not("evaluated_at", "is", null),
    db.from("appointments").select("patient_id").eq("is_evaluation", true).eq("status", "realizada"),
  ]);
  if (doneRes.error) throw new Error(`patients: ${doneRes.error.message}`);
  if (evalRes.error) throw new Error(`appointments: ${evalRes.error.message}`);
  const ids = new Set<string>();
  for (const r of (doneRes.data ?? []) as { id: string }[]) ids.add(r.id);
  for (const r of (evalRes.data ?? []) as { patient_id: string }[]) ids.add(r.patient_id);
  if (ids.size === 0) return [];
  const idList = [...ids];

  const [patientsRes, guardiansRes, statusRes] = await Promise.all([
    db.from("patients").select("id, full_name, evaluated_at, status").eq("clinic_id", clinicId).in("id", idList),
    db.from("guardians").select("id, patient_id, full_name, phone, is_financial, portal_first_login_at").in("patient_id", idList),
    db.from("appointments").select("patient_id, status").eq("is_evaluation", true).in("patient_id", idList),
  ]);
  for (const [name, res] of [["patients", patientsRes], ["guardians", guardiansRes], ["appointments", statusRes]] as const) {
    if (res.error) throw new Error(`${name}: ${res.error.message}`);
  }
  const guardiansBy = new Map<string, InvitePatient["guardians"]>();
  for (const g of (guardiansRes.data ?? []) as { id: string; patient_id: string; full_name: string | null; phone: string | null; is_financial: boolean | null; portal_first_login_at: string | null }[]) {
    const list = guardiansBy.get(g.patient_id) ?? [];
    list.push({ id: g.id, full_name: g.full_name, phone: g.phone, is_financial: g.is_financial, portal_first_login_at: g.portal_first_login_at });
    guardiansBy.set(g.patient_id, list);
  }
  const statusesBy = new Map<string, string[]>();
  for (const a of (statusRes.data ?? []) as { patient_id: string; status: string }[]) {
    statusesBy.set(a.patient_id, [...(statusesBy.get(a.patient_id) ?? []), a.status]);
  }
  return ((patientsRes.data ?? []) as { id: string; full_name: string | null; evaluated_at: string | null; status: string | null }[])
    .filter((p) => p.status !== "arquivado" && p.status !== "evadido")
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      evaluated_at: p.evaluated_at,
      evaluationStatuses: statusesBy.get(p.id) ?? [],
      guardians: guardiansBy.get(p.id) ?? [],
    }));
}

async function findCandidates(db: Loose, clinicId: string) {
  const [patients, invitedRes, optRes] = await Promise.all([
    loadPatients(db, clinicId),
    db.from("portal_invites").select("phone_e164"),
    db.from("whatsapp_opt_outs").select("phone_e164"),
  ]);
  if (invitedRes.error) throw new Error(`portal_invites: ${invitedRes.error.message}`);
  if (optRes.error) throw new Error(`whatsapp_opt_outs: ${optRes.error.message}`);
  const set = (rows: unknown) => new Set(((rows ?? []) as { phone_e164: string }[]).map((r) => r.phone_e164));
  return pickInviteCandidates({ patients, invitedPhones: set(invitedRes.data), optedOutPhones: set(optRes.data), rng: cryptoRng });
}

/** Um passo do convite: no máximo 1 mensagem. `dryRun` só conta quem receberia (ignora chave, janela e horário). */
export async function runPortalInviteTick(opts: { dryRun?: boolean; nowMs?: number; clinicId?: string } = {}): Promise<InviteRunResult> {
  const clinicId = opts.clinicId ?? DEV_CLINIC_ID;
  const db = createAdminClient() as unknown as Loose;

  if (opts.dryRun) {
    const c = await findCandidates(db, clinicId);
    return { status: "dry_run", total: c.length, firstNames: c.slice(0, 20).map((x) => x.childName) };
  }

  const { data: settings, error: settingsErr } = await db
    .from("portal_invite_settings")
    .select("enabled, daily_cap, min_gap_s, max_gap_s, next_send_at, paused_reason")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (settingsErr) throw new Error(`portal_invite_settings: ${settingsErr.message}`);
  if (!settings || !settings.enabled) return { status: "disabled" };
  if (settings.paused_reason) return { status: "paused", reason: settings.paused_reason as string };

  const contentSid = getTwilioContentSidForCategory("convite_portal");
  if (!contentSid) return { status: "template_missing" };

  const now = new Date(opts.nowMs ?? Date.now());
  if (settings.next_send_at && Date.parse(settings.next_send_at as string) > now.getTime()) {
    return { status: "waiting", nextSendAt: settings.next_send_at as string };
  }

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const calendar = await loadClinicCalendar(db, today, today, clinicId);
  const minutes = minuteOfDayInClinic(now);
  const window = canDispatchNow({ date: today, minutes, weekday: weekdayOf(today), businessHours: calendar.businessHours, closures: calendar.closures });
  if (!window.ok) return { status: "outside_window", reason: window.reason };
  if (minutes < INVITE_FROM_MIN) return { status: "outside_window", reason: "antes das 09h" };

  const dayStartIso = zonedDateTimeToUtc(today, "00:00", CLINIC_TIMEZONE).toISOString();
  const { count: sentToday } = await db.from("portal_invites").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).gte("sent_at", dayStartIso);
  if (!underDailyCap(sentToday ?? 0, settings.daily_cap as number)) return { status: "daily_cap", sentToday: sentToday ?? 0 };

  const candidates = await findCandidates(db, clinicId);
  const next = candidates[0];
  if (!next) return { status: "no_candidates" };

  // Reserva o telefone ANTES de enviar: a unicidade de portal_invites.phone_e164 impede envio duplicado
  // se dois ticks se sobrepuserem. Falhou ou não, o telefone não é tentado de novo (protege o número).
  const token = generateInviteToken(cryptoRng);
  const { data: invite, error: reserveErr } = await db
    .from("portal_invites")
    .insert({ clinic_id: clinicId, guardian_id: next.guardianId, patient_id: next.patientId, phone_e164: next.phone, token, status: "enviado" })
    .select("id")
    .single();
  if (reserveErr || !invite) return { status: "waiting", nextSendAt: now.toISOString() }; // outro tick levou; tenta no próximo minuto

  const link = `${APP_ORIGIN}/login?perfil=familia&convite=${token}`;
  const text = buildInviteText({ guardianFirstName: next.guardianFirstName, childName: next.childName, link });
  const send = await sendWhatsApp({
    to: next.phone,
    message: text,
    contentSid,
    contentVariables: { "1": next.guardianFirstName, "2": next.childName, "3": link },
  });

  await db
    .from("portal_invites")
    .update(send.success ? { twilio_sid: send.messageId ?? null } : { status: "falhou", error: send.error ?? "erro desconhecido", error_code: send.errorCode ?? null })
    .eq("id", invite.id);

  try {
    const conversation = await findOrCreateConversation({ phoneNumber: next.phone, patientId: next.patientId, guardianId: next.guardianId });
    await db.from("messages").insert({
      patient_id: next.patientId,
      conversation_id: conversation.id,
      sender_type: "bot",
      channel: "whatsapp",
      direction: "outbound",
      template_key: "convite_portal",
      body: text,
      sent_at: new Date().toISOString(),
      twilio_sid: send.messageId ?? null,
      delivery_status: send.success ? "sent" : "failed",
    });
    await db.from("twilio_conversations").update({ last_message_preview: buildMessagePreview(text) }).eq("id", conversation.id);
  } catch (err) {
    console.error("[Portal Invite] Falha ao registrar mensagem:", err);
  }

  // Próximo envio: intervalo aleatório (o que espaça os disparos; ver cabeçalho).
  const gap = nextGapSeconds(settings.min_gap_s as number, settings.max_gap_s as number, cryptoRng);
  const { data: recent } = await db.from("portal_invites").select("status, error_code").eq("clinic_id", clinicId).order("sent_at", { ascending: false }).limit(3);
  const pause = shouldPause(((recent ?? []) as { status: string; error_code: number | null }[]).map((r) => ({ ok: r.status === "enviado", errorCode: r.error_code })));
  await db
    .from("portal_invite_settings")
    .update({ next_send_at: new Date(now.getTime() + gap * 1000).toISOString(), paused_reason: pause, updated_at: now.toISOString() })
    .eq("clinic_id", clinicId);

  if (!send.success) return { status: "failed", error: send.error ?? "erro desconhecido", paused: pause };
  return { status: "sent", remaining: candidates.length - 1 };
}
