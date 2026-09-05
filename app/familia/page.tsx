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
import { ConfirmAttendance } from "./confirm-attendance";
import { SurveyPrompt } from "./survey-prompt";

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
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });
}

function fmtWhen(iso: string) {
  const weekday = new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short",
    timeZone: CLINIC_TIMEZONE,
  });
  const dm = new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });
  return `${weekday.replace(".", "")} ${dm} · ${fmtTime(iso)}`;
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
    // Ponte responsável → guardian_id, usada só pra anexar guardian_id na
    // mensagem de "Fale com a Coordenação" (guardians.profile_id, PRD §7.1).
    // guardians_read (20260904000002_patients.sql) já restringe a linha ao
    // próprio profile_id, então isso nunca vaza guardian de outro paciente.
    supabase
      .from("guardians")
      .select("id")
      .eq("patient_id", patientId)
      .eq("profile_id", user.id)
      .maybeSingle(),
    // Só o plano já aprovado — família não vê metas de um rascunho ainda em
    // elaboração pela equipe.
    supabase
      .from("treatment_plans")
      .select("id")
      .eq("patient_id", patientId)
      .eq("status", "aprovado")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // documents_read (20260904000008_documents.sql) só devolve pro
    // responsável as linhas com shared_with_family=true — o filtro abaixo é
    // redundante com a RLS, mantido só como documentação da regra.
    supabase
      .from("documents")
      .select("id, category, uploaded_at, valid_until")
      .eq("patient_id", patientId)
      .eq("shared_with_family", true)
      .order("uploaded_at", { ascending: false }),
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

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col" style={{ background: "var(--color-bg)" }}>
      <header
        style={{
          background: "var(--color-dark)",
          color: "var(--color-paper)",
          padding: "28px 20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {LOGO}
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>
            Faça Amigos <span style={{ color: "var(--color-accent-2)", fontStyle: "italic" }}>· Família</span>
          </span>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Criança</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 28 }}>
            {patient.full_name}
          </div>
          {otherChildren.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {otherChildren.map((c) => (
                <a
                  key={c.id}
                  href={`/familia?patient=${c.id}`}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(246,244,239,0.35)",
                    color: "var(--color-paper)",
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
            background: "rgba(246,244,239,0.08)",
            borderRadius: 2,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent-2)" }}>
            Próxima sessão
          </span>
          {nextAppt ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 20 }}>
                  {fmtWhen(nextAppt.starts_at)}
                </span>
                <span style={{ fontSize: 13, opacity: 0.8 }}>
                  {nextAppt.discipline}
                  {therapistName ? ` · ${therapistName}` : ""}
                </span>
              </div>
              {confirmed && <div style={{ color: "var(--color-teal-300)", fontSize: 13 }}>✓ Presença confirmada pela recepção.</div>}
              {notConfirmed && <ConfirmAttendance appointmentId={nextAppt.id} />}
              {(notConfirmed || confirmed) && <ReportAbsence appointmentId={nextAppt.id} />}
            </>
          ) : (
            <span style={{ fontSize: 14, opacity: 0.85 }}>Nenhuma sessão agendada no momento.</span>
          )}
        </div>

        <ContactCoordination patientId={patientId} guardianId={guardianRow?.id ?? null} />
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: "26px 20px 40px", display: "flex", flexDirection: "column", gap: 30 }}>
        {showSurveyPrompt && guardianRow && (
          <SurveyPrompt patientId={patientId} guardianId={guardianRow.id} />
        )}

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
          <h6>Frequência · {monthLabel}</h6>
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

        <section>
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
                Nenhuma meta em andamento no plano aprovado ainda.
              </p>
            )}
          </div>
        </section>

        <section>
          <h6>Mural</h6>
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
                Nenhum recado da equipe ainda.
              </p>
            )}
          </div>
        </section>

        <section>
          <h6>Documentos liberados</h6>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 10 }}>
            {(documents ?? []).length > 0 ? (
              (documents ?? []).map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--color-divider)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
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
                Nenhum documento liberado ainda.
              </p>
            )}
          </div>
        </section>
      </div>

      <nav
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--color-surface)",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          padding: "10px 0 16px",
          fontSize: 11,
          borderTop: "1px solid var(--color-divider)",
        }}
      >
        <span style={{ textAlign: "center", color: "var(--color-accent)", fontWeight: 600 }}>Início</span>
        <span style={{ textAlign: "center", color: "var(--color-neutral-600)" }}>Agenda</span>
        <span style={{ textAlign: "center", color: "var(--color-neutral-600)" }}>Progresso</span>
        <span style={{ textAlign: "center", color: "var(--color-neutral-600)" }}>Documentos</span>
      </nav>
    </main>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h4>{title}</h4>
      <p style={{ color: "var(--color-neutral-600)", fontSize: 14 }}>{message}</p>
    </main>
  );
}
