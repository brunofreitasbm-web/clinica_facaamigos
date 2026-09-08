import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone, zonedDateTimeToUtc, nextCalendarDay } from "@/lib/timezone";
import { matchCheckinRequest, type CheckinCandidateAppointment } from "@/lib/checkin-match";
import {
  extractClientIp,
  hashIp,
  verifyFormToken,
  memoryThrottleExceeded,
  isValidDeclaredName,
  isValidBirthDate,
  isWithinOperatingHours,
  FORM_COOKIE,
} from "@/lib/checkin-security";

// Route handler puro (não Server Action): precisamos de controle limpo sobre
// status HTTP e headers (IP, cookie) para um endpoint que é anônimo por
// natureza — ver "Acesso público" no plano de implementação.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resposta uniforme: acerto e erro de identificação devolvem exatamente o
// mesmo formato, nunca o nome do paciente. Isso é o que impede o endpoint de
// servir como oráculo para descobrir se alguém é paciente da clínica.
function successResponse(ticketLabel: string) {
  return NextResponse.json({
    ticketLabel,
    message: "Pronto! Em instantes você será chamado pela recepção.",
  });
}

function rejectResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  let body: { token?: string; firstName?: string; birthDate?: string };
  try {
    body = await req.json();
  } catch {
    return rejectResponse(400, "Requisição inválida.");
  }

  const qrToken = String(body.token ?? "").trim();
  const firstName = String(body.firstName ?? "").trim();
  const birthDate = String(body.birthDate ?? "").trim();

  if (!qrToken) return rejectResponse(400, "Cartaz inválido.");

  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = todayInTimeZone(CLINIC_TIMEZONE);
  const hourNow = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: CLINIC_TIMEZONE, hour: "2-digit", hour12: false }).format(now),
  );

  if (!isWithinOperatingHours(hourNow)) {
    return rejectResponse(403, "Fora do horário de funcionamento. Fale com a recepção.");
  }

  if (!isValidDeclaredName(firstName)) {
    return rejectResponse(400, "Digite seu primeiro nome.");
  }
  if (!isValidBirthDate(birthDate, todayStr)) {
    return rejectResponse(400, "Data de nascimento inválida.");
  }

  const ip = extractClientIp(req.headers);
  const ipHash = hashIp(ip);

  // Throttle em memória (best-effort, por instância) — primeira camada, mais
  // barata. A camada que realmente segura é a consulta ao banco logo abaixo.
  if (memoryThrottleExceeded(ipHash)) {
    return rejectResponse(429, "Muitas tentativas. Fale com a recepção.");
  }

  const admin = createAdminClient();

  // Token do cartaz precisa existir e estar ativo. Resposta neutra (não
  // revela se o token já existiu e foi revogado ou nunca existiu).
  const { data: tokenRow } = await admin
    .from("clinic_checkin_tokens")
    .select("clinic_id, active")
    .eq("token", qrToken)
    .maybeSingle();

  if (!tokenRow || !tokenRow.active) {
    return rejectResponse(404, "Cartaz inválido ou desativado. Fale com a recepção.");
  }

  const clinicId = tokenRow.clinic_id;

  // Cookie de sessão de formulário: emitido quando a página GET carregou.
  // Barra POST direto sem ter passado pela tela.
  const formCookie = req.cookies.get(FORM_COOKIE.name)?.value;
  if (!formCookie || !verifyFormToken(formCookie, qrToken, todayStr)) {
    return rejectResponse(403, "Sessão expirada. Recarregue a página.");
  }

  // Throttle durável por IP — compartilhado entre instâncias, ao contrário
  // do throttle em memória acima.
  const oneHourAgoIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { count: ipCountLastHour } = await admin
    .from("checkin_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgoIso);
  if ((ipCountLastHour ?? 0) >= 10) {
    return rejectResponse(429, "Muitas tentativas. Fale com a recepção.");
  }

  // Teto por clínica/hora — não deixa um flood inutilizar o painel da recepção.
  const { count: clinicCountLastHour } = await admin
    .from("checkin_requests")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("created_at", oneHourAgoIso);
  if ((clinicCountLastHour ?? 0) >= 80) {
    return rejectResponse(429, "Muitas chegadas neste momento. Fale com a recepção.");
  }

  // Sessões de hoje da clínica, incluindo canceladas/faltas (a família pode
  // não ter sido avisada de um cancelamento — ver F6 no plano).
  const dayStart = zonedDateTimeToUtc(todayStr, "00:00", CLINIC_TIMEZONE).toISOString();
  const dayEnd = zonedDateTimeToUtc(nextCalendarDay(todayStr), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: appointmentsRaw } = await admin
    .from("appointments")
    .select("id, patient_id, starts_at, status, patients!inner(id, full_name, birth_date, clinic_id)")
    .eq("patients.clinic_id", clinicId)
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd);

  const todaysAppointments: CheckinCandidateAppointment[] = (appointmentsRaw ?? []).map((a) => {
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    return {
      appointmentId: a.id,
      patientId: patient?.id ?? a.patient_id,
      patientFullName: patient?.full_name ?? "",
      birthDate: patient?.birth_date ?? "",
      startsAt: a.starts_at,
      status: a.status,
    };
  });

  const match = matchCheckinRequest(todaysAppointments, { firstName, birthDate }, nowIso);

  const insertPayload = {
    clinic_id: clinicId,
    service_date: todayStr,
    kind: match.kind,
    patient_id: match.patientId,
    appointment_id: match.appointmentId,
    candidate_appointment_ids: match.candidateAppointmentIds,
    match_quality: match.quality,
    declared_first_name: firstName,
    declared_birth_date: birthDate,
    source: "qr" as const,
    ip_hash: ipHash,
  };

  const { data: inserted, error: insertError } = await admin
    .from("checkin_requests")
    .insert(insertPayload)
    .select("ticket_label, public_token")
    .single();

  if (insertError) {
    // 23505 no índice de sessão em aberto: duplo check-in (mãe e pai
    // escaneando, ou toque duplo). Não é erro — devolve a senha que já
    // existe, que é o comportamento correto (a segunda pessoa vê a mesma
    // senha). Ver checkin_requests_open_appointment_uk.
    if (insertError.code === "23505" && match.appointmentId) {
      const { data: existing } = await admin
        .from("checkin_requests")
        .select("ticket_label, public_token")
        .eq("appointment_id", match.appointmentId)
        .eq("status", "aguardando")
        .maybeSingle();
      if (existing) {
        const response = successResponse(existing.ticket_label);
        response.cookies.set("ck_pt", existing.public_token, { httpOnly: true, sameSite: "lax", path: "/checkin" });
        return response;
      }
    }
    console.error("[api/checkin] falha ao registrar chegada:", insertError);
    return rejectResponse(500, "Não foi possível registrar sua chegada. Fale com a recepção.");
  }

  const response = successResponse(inserted.ticket_label);
  response.cookies.set("ck_pt", inserted.public_token, { httpOnly: true, sameSite: "lax", path: "/checkin" });
  return response;
}
