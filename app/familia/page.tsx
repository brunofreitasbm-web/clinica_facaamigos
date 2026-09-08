import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { CANCELLED_APPOINTMENT_STATUSES } from "@/lib/patient-stage";
import { APPOINTMENT_STATUS_STYLE, PLAN_GOAL_STATUS_STYLE } from "@/lib/appointment-status-style";
import { todayInTimeZone, civilDateInTimeZone, zonedDateTimeToUtc, nextCalendarDay } from "@/lib/timezone";
import { currentSurveyPeriod } from "@/lib/survey-period";
import { DOCUMENT_CATEGORY_LABEL } from "@/lib/document-categories";
import { getFeedPosts } from "@/lib/feed-posts";
import { ContactCoordination } from "./contact-coordination";
import { DocumentOpenButton } from "./document-open-button";
import { ReportAbsence } from "./report-absence";
import { SurveyPrompt } from "./survey-prompt";
import { NpsSurveyPrompt } from "./nps-survey-prompt";
import { RequestReschedule } from "./request-reschedule";
import { UploadDocument } from "./upload-document";
import { LgpdConsentGate } from "./lgpd-consent-gate";
import { ImageConsentToggle } from "./image-consent-toggle";
import { FAMILY_GUIDANCE_LABEL } from "@/lib/session-note-fields";

export const dynamic = "force-dynamic";

const WEEKDAY_ABBR = ["Seg", "Ter", "Qua", "Qui", "Sex"];

const LOGO = (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden>
    <path d="M22 18h34v10H33v18h20v10H33v26H22z" fill="var(--color-paper)" />
    <path
      d="M46 82 L64 26 h6 L88 82 h-9 l-4-13 H59 L55 82Z M61.5 61h11L67 42z"
      fill="var(--color-accent-2)"
    />
    <circle cx="33" cy="52.5" r="4.2" fill="var(--color-accent-2)" />
  </svg>
);

function fmtTime(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: CLINIC_TIMEZONE,
    });
  } catch {
    return "—";
  }
}

function fmtWhen(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const weekday = d.toLocaleDateString("pt-BR", {
      weekday: "short",
      timeZone: CLINIC_TIMEZONE,
    });
    const dm = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: CLINIC_TIMEZONE,
    });
    return `${weekday.replace(".", "")} ${dm} · ${fmtTime(iso)}`;
  } catch {
    return "—";
  }
}

export default async function FamiliaPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <EmptyState
        title="Sessão não encontrada"
        message="Faça login novamente para ver a página da família."
      />
    );
  }

  // A RLS de `patients` (patients_read, 20260904000002_patients.sql) só
  // devolve linhas onde has_patient_access(id, array['terapeuta',
  // 'responsavel']) é verdadeiro pro usuário logado — nunca listamos todos
  // os pacientes da clínica aqui, o filtro de escopo é o banco, não a
  // aplicação (mesmo padrão do prontuário em
  // app/recepcao/pacientes/[id]/page.tsx). Quando a família tem mais de um
  // filho vinculado, ?patient=<id> escolhe qual ver — o valor só é aceito
  // se estiver na lista já filtrada pela RLS, então nunca dá pra "adivinhar"
  // o id de um paciente de outra família.
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name")
    .order("full_name");

  const { patient: requestedPatientId } = await searchParams;
  const patient =
    (requestedPatientId && patients?.find((p) => p.id === requestedPatientId)) || patients?.[0] || null;

  if (!patient) {
    return (
      <EmptyState
        title="Nenhuma criança vinculada"
        message="Este responsável ainda não tem nenhum paciente vinculado (patient_access). Fale com a recepção da clínica."
      />
    );
  }

  const patientId = patient.id;
  const otherChildren = (patients ?? []).filter((p) => p.id !== patientId);

  const nowIso = new Date().toISOString();
  const today = todayInTimeZone(CLINIC_TIMEZONE);

  // Segunda a sexta da semana corrente (datas civis, sem depender de fuso
  // do processo) — mesma técnica de aritmética de calendário pura de
  // lib/timezone.ts (nextCalendarDay).
  const [ty, tm, td] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay(); // 0=dom..6=sáb
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const dt = new Date(Date.UTC(ty, tm - 1, td + mondayOffset + i));
    return dt.toISOString().slice(0, 10);
  });
  const weekStartIso = zonedDateTimeToUtc(weekDates[0], "00:00", CLINIC_TIMEZONE).toISOString();
  const weekEndIso = zonedDateTimeToUtc(
    nextCalendarDay(weekDates[4]),
    "00:00",
    CLINIC_TIMEZONE,
  ).toISOString();

  // Mês corrente (datas civis).
  const monthStart = `${today.slice(0, 7)}-01`;
  const [my, mm] = monthStart.split("-").map(Number);
  const nextMonthStart = new Date(Date.UTC(my, mm, 1)).toISOString().slice(0, 10);
  const monthStartIso = zonedDateTimeToUtc(monthStart, "00:00", CLINIC_TIMEZONE).toISOString();
  const monthEndIso = zonedDateTimeToUtc(nextMonthStart, "00:00", CLINIC_TIMEZONE).toISOString();

  const [
    { data: nextAppt },
    { data: weekAppts },
    { data: monthAppts },
    { data: guardianRow },
    { data: treatmentPlan },
    { data: documents },
    { data: familyUploads },
    { data: familyMessages },
    { data: upcomingAppts },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, status, discipline, therapist:profiles!therapist_id(full_name)")
      .eq("patient_id", patientId)
      .gte("starts_at", nowIso)
      .not("status", "in", `(${CANCELLED_APPOINTMENT_STATUSES.join(",")})`)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("id, starts_at, status")
      .eq("patient_id", patientId)
      .gte("starts_at", weekStartIso)
      .lt("starts_at", weekEndIso)
      .order("starts_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, starts_at, status")
      .eq("patient_id", patientId)
      .gte("starts_at", monthStartIso)
      .lt("starts_at", monthEndIso)
      .order("starts_at", { ascending: true }),
    // Ponte responsável → guardian_id (+ consentimento LGPD/imagem, §3.9)
    supabase
      .from("guardians")
      .select("id, lgpd_consent_at, image_consent")
      .eq("patient_id", patientId)
      .eq("profile_id", user.id)
      .maybeSingle(),
    // Plano aprovado
    supabase
      .from("treatment_plans")
      .select("id")
      .eq("patient_id", patientId)
      .eq("status", "aprovado")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Documentos liberados
    supabase
      .from("documents")
      .select("id, category, uploaded_at, valid_until")
      .eq("patient_id", patientId)
      .eq("shared_with_family", true)
      .order("uploaded_at", { ascending: false }),
    // Documentos enviados pela própria família (documents_read_own_family_
    // upload, 20260906000020) — mostra status de revisão, nunca aparece na
    // lista de "Documentos liberados" acima (shared_with_family é sempre
    // false pra esta categoria).
    supabase
      .from("documents")
      .select("id, note, uploaded_at, reviewed_at")
      .eq("patient_id", patientId)
      .eq("category", "familia_envio")
      .order("uploaded_at", { ascending: false }),
    // Mensagens trocadas — portal E WhatsApp juntos num histórico só (PRD
    // §9.7/§3.8: "histórico das últimas mensagens trocadas com a clínica via
    // WhatsApp/Portal"). messages_read (20260904000012) já libera os dois
    // canais pro responsável via has_patient_access — o filtro por
    // channel='portal' que existia aqui era só da aplicação, não da RLS, e
    // escondia todo o histórico de WhatsApp (bot + atendimento humano,
    // 20260906000010_twilio_conversations.sql) que o app/api/webhooks/twilio
    // já grava normalmente.
    supabase
      .from("messages")
      .select("id, channel, direction, sender_type, body, media_url, sent_at, read_at")
      .eq("patient_id", patientId)
      .order("sent_at", { ascending: false })
      .limit(30),
    // Próximas sessões com justificativa de ausência (se houver)
    supabase
      .from("appointments")
      .select("id, starts_at, status, discipline, therapist:profiles!therapist_id(full_name)")
      .eq("patient_id", patientId)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(6),
  ]);

  const { data: goalsRaw } = treatmentPlan
    ? await supabase
        .from("plan_goals")
        .select("id, description, status")
        .eq("treatment_plan_id", treatmentPlan.id)
        // "suspensa" fica de fora da tela da família — não é uma meta em
        // andamento nem atingida, e o PRD §9.7 só fala em "em andamento /
        // atingida" pro portal.
        .in("status", ["ativa", "atingida"])
    : { data: [] as { id: string; description: string; status: string }[] };

  // Mural (PRD §4) — mural independente das evoluções clínicas, só leitura
  // pro responsável (feed_posts_read/feed_media_read decidem o que aparece).
  const feedPosts = await getFeedPosts(supabase, patientId);

  // "Orientação dada à família" (PRD §3.5/§9.7) — único dado clínico
  // visível, exposto via RPC security definer (family_guidance_feed,
  // 20260906000021) que devolve só os chips de orientação já traduzidos,
  // nunca free_text/presença/comportamentos da evolução.
  const { data: guidanceFeed } = await supabase.rpc("family_guidance_feed", {
    p_patient_id: patientId,
  });

  // Pesquisa trimestral (§9.7) — só mostra se o responsável tem guardian_id
  // (survey_responses.guardian_id é NOT NULL) e ainda não respondeu este
  // trimestre (survey_responses_unique_period, 20260904000031).
  const surveyPeriod = currentSurveyPeriod();
  const { data: existingSurvey } = guardianRow
    ? await supabase
        .from("survey_responses")
        .select("id")
        .eq("patient_id", patientId)
        .eq("guardian_id", guardianRow.id)
        .eq("period", surveyPeriod)
        .maybeSingle()
    : { data: null };
  const showSurveyPrompt = !!guardianRow && !existingSurvey;

  // NPS Externo (evento/mensal) — disparado por /api/twilio/nps/trigger e
  // /api/twilio/nps-mensal/trigger, mas respondido só aqui no portal (nunca
  // mais via WhatsApp, ver 20260908030000_nps_externo_portal_only.sql).
  // Mostra no máximo a pesquisa pendente mais recente pra não empilhar
  // formulário em cima de formulário.
  const { data: pendingNpsSurvey } = guardianRow
    ? await (supabase as any)
        .from("nps_surveys")
        .select("id, trigger_type")
        .eq("patient_id", patientId)
        .eq("guardian_id", guardianRow.id)
        .is("responded_at", null)
        .order("dispatched_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Aviso de faltas (MAAIS §13 / "risco de evasão") — refresh_absence_alerts
  // (20260906000015) abre a linha quando o paciente cruza 3 faltas
  // consecutivas ou >=50% em 3 meses; aqui só mostramos o alerta ainda não
  // resolvido pela recepção, em linguagem simples (nunca o número bruto de
  // "3 faltas consecutivas" — isso fica só na tela de gestão).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: absenceAlert } = await (supabase as any)
    .from("absence_alerts")
    .select("id")
    .eq("patient_id", patientId)
    .in("status", ["pendente", "notificado"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const therapistName =
    (nextAppt &&
      (Array.isArray(nextAppt.therapist) ? nextAppt.therapist[0]?.full_name : nextAppt.therapist?.full_name)) ||
    null;

  const weekByDate = new Map<string, { starts_at: string; status: string }>();
  for (const a of weekAppts ?? []) {
    const d = civilDateInTimeZone(new Date(a.starts_at), CLINIC_TIMEZONE);
    // Se houver mais de uma sessão no dia, mantém a primeira (semana
    // ordenada ascendente na query).
    if (!weekByDate.has(d)) weekByDate.set(d, a);
  }

  const weekDays = weekDates.map((date, i) => {
    const appt = weekByDate.get(date);
    const isToday = date === today;
    const isPast = date < today;

    let dotColor: string | null = null;
    let caption = "—";

    if (appt) {
      if (appt.status === "realizada") {
        dotColor = "var(--status-realizada)";
        caption = "feita";
      } else if (appt.status === "falta_familia") {
        dotColor = "var(--status-falta)";
        caption = "falta";
      } else if ((CANCELLED_APPOINTMENT_STATUSES as readonly string[]).includes(appt.status)) {
        dotColor = "var(--status-cancelada)";
        caption = "cancelada";
      } else if (isToday) {
        dotColor = "var(--color-accent-2)";
        caption = fmtTime(appt.starts_at);
      } else if (isPast) {
        // agendada/confirmada num dia que já passou sem virar realizada nem
        // falta — estado raro (ex.: check-in pendente), mostrado sem cor.
        caption = "sem registro";
      } else {
        dotColor = "var(--color-accent-300)";
        caption = fmtTime(appt.starts_at);
      }
    } else {
      caption = "sem sessão";
    }

    return {
      key: date,
      label: WEEKDAY_ABBR[i],
      dayNumber: Number(date.slice(8, 10)),
      isToday,
      dotColor,
      caption,
    };
  });

  const monthDone = (monthAppts ?? []).filter((a) => a.status === "realizada").length;
  const monthFaltas = (monthAppts ?? []).filter((a) => a.status === "falta_familia").length;
  const monthTotal = (monthAppts ?? []).filter(
    (a) => !(CANCELLED_APPOINTMENT_STATUSES as readonly string[]).includes(a.status),
  ).length;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(my, mm - 1, 1)));

  const notConfirmed = nextAppt?.status === "agendada";
  const confirmed = nextAppt?.status === "confirmada";

  // PRD §3.9: termo de consentimento LGPD antes de qualquer interação, se
  // ainda não assinado — guardianRow só existe se este usuário for de fato
  // um responsável vinculado (a query acima já filtra por profile_id), então
  // é seguro usar a ausência de lgpd_consent_at como gatilho do bloqueio.
  const showLgpdGate = !!guardianRow && !guardianRow.lgpd_consent_at;

  const firstName = patient.full_name.split(" ")[0];
  const hour = Number(
    new Date().toLocaleString("en-US", { hour: "2-digit", hour12: false, timeZone: CLINIC_TIMEZONE }),
  );
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <main id="top" className="mx-auto flex w-full max-w-[480px] flex-1 flex-col" style={{ background: "var(--color-bg)" }}>
      {showLgpdGate && <LgpdConsentGate />}
      <header
        style={{
          background: "linear-gradient(155deg, var(--color-pink) 0%, var(--color-accent-700) 65%, var(--color-dark) 100%)",
          color: "var(--color-on-accent)",
          padding: "28px 20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
          boxShadow: "var(--shadow-pink)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {LOGO}
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>
            Faça Amigos <span style={{ color: "var(--color-yellow)", fontStyle: "italic" }}>· Família</span>
          </span>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "var(--color-on-accent-soft)" }}>
            {greeting}! Como vai a semana de
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 32, lineHeight: 1.15 }}>
            {firstName}? 💛
          </div>
          {otherChildren.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {otherChildren.map((c) => (
                <a
                  key={c.id}
                  href={`/familia?patient=${c.id}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.16)",
                    color: "var(--color-on-accent)",
                    textDecoration: "none",
                  }}
                >
                  Ver {c.full_name}
                </a>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: "var(--color-surface)",
            color: "var(--color-text)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            boxShadow: "var(--shadow-md)",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent)" }}>
            🗓️ Próxima sessão
          </span>
          {nextAppt ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 20 }}>
                  {fmtWhen(nextAppt.starts_at)}
                </span>
                <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
                  {nextAppt.discipline}
                  {therapistName ? ` · ${therapistName}` : ""}
                </span>
              </div>
              {nextAppt.status === "confirmada" ? (
                <div style={{ color: "var(--color-teal-700)", fontSize: 13, fontWeight: 600 }}>✓ Presença confirmada pela recepção.</div>
              ) : (
                <div style={{ color: "var(--color-neutral-600)", fontSize: 13 }}>✓ Presença confirmada por padrão. Precisa faltar? Avise abaixo.</div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <ReportAbsence
                  appointmentId={nextAppt.id}
                  sessionLabel={`${fmtWhen(nextAppt.starts_at)} · ${nextAppt.discipline}${therapistName ? ` (${therapistName})` : ""}`}
                />
                <RequestReschedule
                  appointmentId={nextAppt.id}
                  sessionLabel={`${fmtWhen(nextAppt.starts_at)} · ${nextAppt.discipline}${therapistName ? ` (${therapistName})` : ""}`}
                />
              </div>
            </>
          ) : (
            <span style={{ fontSize: 14, color: "var(--color-neutral-600)" }}>
              Nada marcado por enquanto — combine o próximo horário com a recepção. 🙂
            </span>
          )}
        </div>

        <ContactCoordination patientId={patientId} guardianId={guardianRow?.id ?? null} />
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: "26px 20px 40px", display: "flex", flexDirection: "column", gap: 30 }}>
        {absenceAlert && (
          <div
            style={{
              borderRadius: "var(--radius-lg)",
              background: "color-mix(in srgb, var(--status-falta) 10%, var(--color-surface))",
              padding: "14px 16px",
              fontSize: 13,
              lineHeight: 1.5,
              display: "flex",
              gap: 10,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <span aria-hidden style={{ fontSize: 18 }}>🤗</span>
            <span>
              Notamos algumas faltas recentes — sem problema, acontece! Se está difícil manter os
              horários, chama a recepção, a gente ajuda a reorganizar a agenda do jeitinho que
              funciona pra vocês.
            </span>
          </div>
        )}

        {pendingNpsSurvey && (
          <NpsSurveyPrompt surveyId={pendingNpsSurvey.id} triggerType={pendingNpsSurvey.trigger_type ?? "evaluation"} />
        )}

        {showSurveyPrompt && guardianRow && (
          <SurveyPrompt patientId={patientId} guardianId={guardianRow.id} />
        )}

        <section id="agenda">
          <div className="flex items-center justify-between mb-2">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">Agenda & Próximas Sessões</h6>
            {(upcomingAppts ?? []).length > 0 && (
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {(upcomingAppts ?? []).length} agendadas
              </span>
            )}
          </div>
          {(upcomingAppts ?? []).length > 0 ? (
            <div className="flex flex-col gap-2.5 mt-2">
              {(upcomingAppts ?? []).map((appt) => {
                const apptTherapist = Array.isArray(appt.therapist) ? appt.therapist[0] : appt.therapist;
                const isAbsenceReported = appt.status === "falta_familia";
                const isCancelled = appt.status === "cancelada" || appt.status === "falta_sem_justificativa";
                const label = `${fmtWhen(appt.starts_at)} · ${appt.discipline}${apptTherapist?.full_name ? ` (${apptTherapist.full_name})` : ""}`;
                
                return (
                  <div
                    key={appt.id}
                    className="p-3 rounded-lg border flex flex-col gap-2 bg-white shadow-xs"
                    style={{ borderColor: isAbsenceReported ? "var(--color-accent-2-300)" : "var(--color-divider)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-sm block text-ink-strong">{fmtWhen(appt.starts_at)}</span>
                        <span className="text-xs text-ink-soft">
                          {appt.discipline} {apptTherapist?.full_name ? `· ${apptTherapist.full_name}` : ""}
                        </span>
                      </div>
                      {isAbsenceReported ? (
                        <span className="tag-status st-falta font-semibold text-xs px-2 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          ⚠️ Ausência Informada
                        </span>
                      ) : isCancelled ? (
                        <span className="tag-status st-cancelada text-xs">Cancelada</span>
                      ) : (
                        <span className="tag-status st-agendada text-xs">Agendada</span>
                      )}
                    </div>

                    {!isAbsenceReported && !isCancelled && (
                      <div className="pt-1.5 border-t border-gray-100 flex justify-end">
                        <ReportAbsence appointmentId={appt.id} sessionLabel={label} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
              Nada agendado por aqui ainda — assim que a recepção marcar, aparece nesta lista. 🌤️
            </p>
          )}
        </section>

        <section>
          <h6 style={{ color: "var(--color-accent-2-600)" }}>Esta semana</h6>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 10 }}>
            {weekDays.map((d) => (
              <div
                key={d.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 4px",
                  borderRadius: "var(--radius-md)",
                  background: d.isToday ? "var(--color-accent-2-100)" : "transparent",
                }}
              >
                <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{d.label}</span>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>
                  {d.dayNumber}
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: d.dotColor ?? "var(--color-divider)",
                  }}
                />
                <span style={{ fontSize: 10, color: "var(--color-neutral-600)", textAlign: "center" }}>
                  {d.caption}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h6>💪 Frequência · {monthLabel}</h6>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 10 }}>
            <span style={{ fontSize: 44, fontWeight: 600, fontFamily: "var(--font-heading)" }}>
              {monthDone}
              <span style={{ fontSize: 20, color: "var(--color-neutral-500)" }}>/{monthTotal}</span>
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.4 }}>
              sessões realizadas
              <br />
              {monthFaltas} {monthFaltas === 1 ? "falta" : "faltas"} este mês
            </span>
          </div>
          {(monthAppts ?? []).length > 0 && (
            <div style={{ display: "flex", gap: 3, marginTop: 12 }}>
              {(monthAppts ?? []).map((a) => {
                const style = APPOINTMENT_STATUS_STYLE[a.status] ?? APPOINTMENT_STATUS_STYLE.agendada;
                return (
                  <span
                    key={a.id}
                    title={`${new Date(a.starts_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })} · ${style.label}`}
                    style={{ flex: 1, height: 20, borderRadius: 2, background: style.colorVar }}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section id="progresso">
          <div className="flex items-center justify-between">
            <h6>O que estamos trabalhando (Progresso ABA)</h6>
            {(goalsRaw ?? []).length > 0 && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {(goalsRaw ?? []).filter((g) => g.status === "atingida").length}/{(goalsRaw ?? []).length} metas conquistadas
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {(goalsRaw ?? []).length > 0 ? (
              (goalsRaw ?? []).map((g) => {
                const style = PLAN_GOAL_STATUS_STYLE[g.status] ?? { label: g.status, tagClass: "st-cancelada" };
                const achieved = g.status === "atingida";
                return (
                  <div key={g.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 14 }}>
                        {achieved ? "🌟 " : "🎯 "}
                        {g.description}
                      </span>
                      <span className={`tag-status ${style.tagClass}`}>{style.label}</span>
                    </div>
                    <div
                      aria-hidden
                      style={{
                        height: 6,
                        borderRadius: 3,
                        overflow: "hidden",
                        background: "var(--color-neutral-200)",
                        marginTop: 8,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: achieved ? "100%" : "65%",
                          background: achieved
                            ? "var(--color-accent-2)"
                            : "repeating-linear-gradient(135deg, var(--color-accent-2) 0 6px, var(--color-accent-2-300) 6px 12px)",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
                Assim que o plano terapêutico for aprovado, as metas de {firstName} aparecem aqui. ✨
              </p>
            )}
          </div>
        </section>

        {(guidanceFeed ?? []).length > 0 && (
          <section>
            <h6>Orientações da equipe</h6>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {(guidanceFeed ?? []).map((g) => (
                <div key={g.appointment_id} className="card">
                  <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginBottom: 4 }}>
                    {new Date(g.starts_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(g.orientacoes ?? [])
                      .filter((o: string) => o !== "nenhuma")
                      .map((o: string) => (
                        <span key={o} className="tag-status st-agendada text-xs">
                          {FAMILY_GUIDANCE_LABEL[o] ?? o}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h6>📣 Mural</h6>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
            {feedPosts.length > 0 ? (
              feedPosts.map((post) => (
                <div key={post.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{post.authorName}</span>
                    <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                      {new Date(post.createdAt).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                    </span>
                  </div>
                  {post.body && <p style={{ fontSize: 13, margin: 0 }}>{post.body}</p>}
                  {post.media.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {post.media.map((m) =>
                        m.mimeType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={m.id}
                            src={m.url}
                            alt=""
                            style={{ width: 96, height: 96, borderRadius: "var(--radius-md)", objectFit: "cover" }}
                          />
                        ) : (
                          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs">
                            Abrir anexo
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
                Nenhum recado da equipe ainda — as novidades e fotinhos de {firstName} aparecem aqui. 📸
              </p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h6>💬 Mensagens & Respostas da Coordenação</h6>
            {(familyMessages ?? []).some((m) => m.direction === "outbound") && (
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                ✓ Resposta Recebida
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {(familyMessages ?? []).length > 0 ? (
              (familyMessages ?? []).map((msg) => {
                const isFromCoordination = msg.direction === "outbound";
                // Mensagem automática do bot de WhatsApp (lib/twilio.ts,
                // handleTwilioIncomingMessage) — rotulada à parte pra família
                // não confundir uma resposta automática com um retorno humano.
                const isBot = msg.sender_type === "bot";
                const label = !isFromCoordination
                  ? "👤 Sua mensagem enviada"
                  : isBot
                    ? "🤖 Assistente virtual Faça Amigos"
                    : "💬 Resposta da Coordenação Faça Amigos";
                return (
                  <div
                    key={msg.id}
                    className="card"
                    style={{
                      borderLeft: isFromCoordination ? "4px solid var(--color-accent)" : "1px solid var(--color-divider)",
                      background: isFromCoordination ? "var(--color-surface)" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isFromCoordination ? "var(--color-accent)" : "var(--color-neutral-700)" }}>
                        {label}
                        {msg.channel === "whatsapp" && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 500, color: "var(--color-neutral-500)" }}>
                            · via WhatsApp
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>
                        {msg.sent_at ? fmtWhen(msg.sent_at) : "—"}
                      </span>
                    </div>
                    {msg.body && <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{msg.body}</p>}
                    {msg.media_url &&
                      (/\.(jpe?g|png|gif|webp)$/i.test(msg.media_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.media_url}
                          alt=""
                          style={{ marginTop: 6, maxWidth: 160, borderRadius: "var(--radius-md)" }}
                        />
                      ) : (
                        <a
                          href={msg.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost text-xs"
                          style={{ marginTop: 6 }}
                        >
                          Abrir anexo
                        </a>
                      ))}
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
                Nenhuma mensagem trocada com a coordenação ainda. Use &ldquo;Fale com a Coordenação&rdquo; acima se precisar de suporte.
              </p>
            )}
          </div>
        </section>

        <section id="documentos">
          <h6>📄 Documentos liberados</h6>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {(documents ?? []).length > 0 ? (
              (documents ?? []).map((doc) => (
                <div
                  key={doc.id}
                  className="card"
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {DOCUMENT_CATEGORY_LABEL[doc.category] ?? doc.category}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                      {new Date(doc.uploaded_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                      {doc.valid_until &&
                        ` · válido até ${new Date(`${doc.valid_until}T00:00:00`).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })}`}
                    </div>
                  </div>
                  <DocumentOpenButton documentId={doc.id} />
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
                Nenhum documento liberado ainda — quando a equipe compartilhar algo, ele aparece por aqui.
              </p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h6>📤 Meus envios</h6>
            <UploadDocument patientId={patientId} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {(familyUploads ?? []).length > 0 ? (
              (familyUploads ?? []).map((doc) => (
                <div
                  key={doc.id}
                  className="card"
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{doc.note || "Documento enviado"}</div>
                    <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                      {new Date(doc.uploaded_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                    </div>
                  </div>
                  <span
                    className="tag-status"
                    style={{
                      background: doc.reviewed_at ? "var(--status-realizada)" : "var(--color-neutral-200)",
                      color: doc.reviewed_at ? "var(--color-paper)" : "var(--color-neutral-700)",
                    }}
                  >
                    {doc.reviewed_at ? "Conferido" : "Aguardando revisão"}
                  </span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
                Nenhum documento enviado ainda. Use o botão acima pra mandar carteirinha, pedido médico
                ou qualquer outro papel — a gente confere rapidinho.
              </p>
            )}
          </div>
        </section>

        {guardianRow && (
          <section>
            <h6>Privacidade</h6>
            <ImageConsentToggle initialConsent={guardianRow.image_consent} />
          </section>
        )}
      </div>

      <nav
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--color-surface)",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 4,
          padding: "10px 8px 16px",
          fontSize: 11,
          fontWeight: 600,
          boxShadow: "0 -4px 16px color-mix(in srgb, var(--color-text) 8%, transparent)",
        }}
      >
        <a
          href="#top"
          style={{
            textAlign: "center",
            color: "var(--color-on-accent)",
            background: "var(--color-accent)",
            borderRadius: "var(--radius-full)",
            padding: "6px 4px",
            textDecoration: "none",
          }}
        >
          Início
        </a>
        <a href="#agenda" style={{ textAlign: "center", color: "var(--color-neutral-600)", padding: "6px 4px", textDecoration: "none" }}>Agenda</a>
        <a href="#progresso" style={{ textAlign: "center", color: "var(--color-neutral-600)", padding: "6px 4px", textDecoration: "none" }}>Progresso</a>
        <a href="#documentos" style={{ textAlign: "center", color: "var(--color-neutral-600)", padding: "6px 4px", textDecoration: "none" }}>Documentos</a>
        <Link
          href={`/familia/avalie?patient=${patientId}`}
          style={{ textAlign: "center", color: "var(--color-neutral-600)", padding: "6px 4px", textDecoration: "none" }}
        >
          Avalie
        </Link>
      </nav>
    </main>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span aria-hidden style={{ fontSize: 40 }}>💛</span>
      <h4>{title}</h4>
      <p style={{ color: "var(--color-neutral-600)", fontSize: 14 }}>{message}</p>
    </main>
  );
}
