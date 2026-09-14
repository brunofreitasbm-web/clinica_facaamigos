import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("GOOGLE_CALENDAR_WEBHOOK_SECRET") ?? "";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const GOOGLE_ORGANIZER_CALENDAR_ID = Deno.env.get("GOOGLE_ORGANIZER_CALENDAR_ID") ?? "primary";

const CLINIC_TIMEZONE = "America/Sao_Paulo";
// Conta a conta criada com esse domínio (sync-grupoib-professional /
// app/gestor/equipe/actions.ts) não tem inbox de verdade — nunca vira
// convidado, mesmo que o opt-in esteja marcado por engano.
const SYNTHETIC_EMAIL_DOMAIN = "@staff.facaamigos.local";

const CANCELLED_STATUSES = new Set([
  "cancelada_familia",
  "cancelada_terapeuta",
  "cancelada_clinica",
]);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) {
    let dummy = 0;
    const len = Math.max(bufA.length, bufB.length);
    for (let i = 0; i < len; i++) dummy |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

type AppointmentRecord = {
  id: string;
  patient_id: string;
  therapist_id: string;
  room_id: string;
  discipline: string;
  starts_at: string;
  ends_at: string;
  modality: string;
  status: string;
  google_event_id: string | null;
};

type Attendee = { email: string; displayName?: string };

function isRealEmail(email: string | null | undefined): email is string {
  return !!email && !email.toLowerCase().endsWith(SYNTHETIC_EMAIL_DOMAIN);
}

async function loadAttendees(record: AppointmentRecord): Promise<Attendee[]> {
  const attendees: Attendee[] = [];

  const { data: therapist } = await admin
    .from("profiles")
    .select("email, full_name, google_calendar_opt_in")
    .eq("id", record.therapist_id)
    .maybeSingle();

  if (therapist?.google_calendar_opt_in && isRealEmail(therapist.email)) {
    attendees.push({ email: therapist.email, displayName: therapist.full_name ?? undefined });
  }

  const { data: guardians } = await admin
    .from("guardians")
    .select("email, full_name, google_calendar_opt_in")
    .eq("patient_id", record.patient_id)
    .eq("google_calendar_opt_in", true);

  for (const g of guardians ?? []) {
    if (isRealEmail(g.email)) {
      attendees.push({ email: g.email, displayName: g.full_name ?? undefined });
    }
  }

  return attendees;
}

async function exchangeRefreshToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Credenciais do Google (client id/secret/refresh token) não configuradas");
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok || !body?.access_token) {
    throw new Error(`Falha ao trocar refresh token: HTTP ${resp.status} ${JSON.stringify(body)}`);
  }
  return body.access_token as string;
}

type GoogleCallResult =
  | { ok: true; eventId?: string }
  | { ok: false; reason: string };

/** Uma retentativa em erro 5xx (rede/instabilidade do lado do Google); 4xx não se repete. */
async function callGoogleCalendar(
  accessToken: string,
  method: "POST" | "PATCH" | "DELETE",
  eventId: string | null,
  body: Record<string, unknown> | null,
): Promise<GoogleCallResult> {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${
    encodeURIComponent(GOOGLE_ORGANIZER_CALENDAR_ID)
  }/events`;
  const url = eventId ? `${base}/${eventId}?sendUpdates=all` : `${base}?sendUpdates=all`;

  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (resp.status === 204 || resp.status === 410) {
        // 410 Gone: o evento já não existe do lado do Google (ex.: apagado
        // manualmente) — trata como sucesso, não há o que desfazer.
        return { ok: true };
      }

      const responseBody = await resp.json().catch(() => ({}));
      if (resp.ok) return { ok: true, eventId: responseBody?.id };

      lastError = `HTTP ${resp.status}: ${responseBody?.error?.message ?? "erro desconhecido"}`;
      if (resp.status < 500) break;
    } catch (err) {
      lastError = String(err);
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 500));
  }

  return { ok: false, reason: lastError };
}

async function logSync(params: {
  appointmentId: string;
  action:
    | "google_calendar_event_created"
    | "google_calendar_event_updated"
    | "google_calendar_event_cancelled"
    | "google_calendar_sync_failed"
    | "google_calendar_token_refresh_failed";
  after: Record<string, unknown>;
}) {
  await admin.from("audit_log").insert({
    table_name: "appointments",
    row_id: params.appointmentId,
    action: params.action,
    actor_id: null,
    after: params.after,
  });
}

async function updateAppointmentSyncState(
  appointmentId: string,
  fields: {
    google_event_id?: string | null;
    google_calendar_sync_status: "pending" | "synced" | "failed" | "skipped";
    google_calendar_synced_at?: string | null;
  },
) {
  await admin.from("appointments").update(fields).eq("id", appointmentId);
}

Deno.serve(async (req: Request) => {
  if (!WEBHOOK_SECRET || !timingSafeEqual(req.headers.get("X-Webhook-Secret") ?? "", WEBHOOK_SECRET)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let record: AppointmentRecord;
  try {
    const payload = await req.json();
    const { table, record: rawRecord } = payload as { table: string; record: AppointmentRecord };
    if (table !== "appointments" || !rawRecord) {
      return new Response(JSON.stringify({ skipped: true, reason: "tabela fora do escopo" }), { status: 200 });
    }
    record = rawRecord;
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 400 });
  }

  try {
    const isCancelled = CANCELLED_STATUSES.has(record.status);

    if (isCancelled && !record.google_event_id) {
      await updateAppointmentSyncState(record.id, { google_calendar_sync_status: "skipped" });
      return new Response(JSON.stringify({ skipped: true, reason: "cancelado sem evento" }), { status: 200 });
    }

    if (!isCancelled && new Date(record.ends_at).getTime() < Date.now()) {
      await updateAppointmentSyncState(record.id, { google_calendar_sync_status: "skipped" });
      return new Response(JSON.stringify({ skipped: true, reason: "atendimento no passado" }), { status: 200 });
    }

    const attendees = await loadAttendees(record);

    if (!isCancelled && attendees.length === 0) {
      await updateAppointmentSyncState(record.id, { google_calendar_sync_status: "skipped" });
      return new Response(JSON.stringify({ skipped: true, reason: "ninguém optou por receber convite" }), {
        status: 200,
      });
    }

    let accessToken: string;
    try {
      accessToken = await exchangeRefreshToken();
    } catch (err) {
      console.error("[Google Calendar Sync] Falha ao obter access token:", err);
      await updateAppointmentSyncState(record.id, { google_calendar_sync_status: "failed" });
      await logSync({
        appointmentId: record.id,
        action: "google_calendar_token_refresh_failed",
        after: { reason: String(err) },
      });
      return new Response(JSON.stringify({ error: "token_refresh_failed" }), { status: 200 });
    }

    if (isCancelled) {
      const result = await callGoogleCalendar(accessToken, "DELETE", record.google_event_id, null);
      if (!result.ok) {
        await updateAppointmentSyncState(record.id, { google_calendar_sync_status: "failed" });
        await logSync({
          appointmentId: record.id,
          action: "google_calendar_sync_failed",
          after: { operation: "delete", reason: result.reason },
        });
        return new Response(JSON.stringify({ error: result.reason }), { status: 200 });
      }
      await updateAppointmentSyncState(record.id, {
        google_event_id: null,
        google_calendar_sync_status: "skipped",
        google_calendar_synced_at: new Date().toISOString(),
      });
      await logSync({
        appointmentId: record.id,
        action: "google_calendar_event_cancelled",
        after: { google_event_id: record.google_event_id },
      });
      return new Response(JSON.stringify({ cancelled: true }), { status: 200 });
    }

    const [{ data: patient }, { data: room }] = await Promise.all([
      admin.from("patients").select("full_name").eq("id", record.patient_id).maybeSingle(),
      admin.from("rooms").select("name").eq("id", record.room_id).maybeSingle(),
    ]);

    const eventBody = {
      summary: `Atendimento — ${patient?.full_name ?? "Paciente"} (${record.discipline})`,
      description: `Sala: ${room?.name ?? "—"} · Modalidade: ${record.modality}`,
      start: { dateTime: record.starts_at, timeZone: CLINIC_TIMEZONE },
      end: { dateTime: record.ends_at, timeZone: CLINIC_TIMEZONE },
      attendees,
    };

    const method = record.google_event_id ? "PATCH" : "POST";
    const result = await callGoogleCalendar(accessToken, method, record.google_event_id, eventBody);

    if (!result.ok) {
      await updateAppointmentSyncState(record.id, { google_calendar_sync_status: "failed" });
      await logSync({
        appointmentId: record.id,
        action: "google_calendar_sync_failed",
        after: { operation: method, reason: result.reason },
      });
      return new Response(JSON.stringify({ error: result.reason }), { status: 200 });
    }

    const eventId = result.eventId ?? record.google_event_id ?? null;
    await updateAppointmentSyncState(record.id, {
      google_event_id: eventId,
      google_calendar_sync_status: "synced",
      google_calendar_synced_at: new Date().toISOString(),
    });
    await logSync({
      appointmentId: record.id,
      action: method === "POST" ? "google_calendar_event_created" : "google_calendar_event_updated",
      after: { google_event_id: eventId, attendees: attendees.map((a) => a.email) },
    });

    return new Response(JSON.stringify({ synced: true, google_event_id: eventId }), { status: 200 });
  } catch (err) {
    console.error("[Google Calendar Sync] Erro inesperado:", err);
    await updateAppointmentSyncState(record.id, { google_calendar_sync_status: "failed" }).catch(() => {});
    return new Response(JSON.stringify({ error: String(err) }), { status: 200 });
  }
});
