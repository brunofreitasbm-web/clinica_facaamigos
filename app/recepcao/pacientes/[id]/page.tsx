import { notFound } from "next/navigation";
import { PatientHeader } from "@/components/prontuario/patient-header";
import { PatientTabs, type FrequencyDay, type GoalRow, type EvolutionNote, type BillingRow } from "@/components/prontuario/patient-tabs";
import { StageChecklist } from "@/components/stage-checklist";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { computeStage, CANCELLED_APPOINTMENT_STATUSES } from "@/lib/patient-stage";
import { getPatientIdentitySummary } from "@/lib/patient-identity";
import { DOCUMENT_CATEGORY_LABEL, getValidityBadge } from "@/lib/document-categories";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { getFeedPosts } from "@/lib/feed-posts";
import { StageActionForm } from "./stage-action-form";
import { DocumentViewButton } from "./document-view-button";
import { DocumentUploadForm } from "./document-upload-form";
import { FeedPostForm } from "./feed-post-form";
import { AbsenceReportsList, type PendingAbsenceReport } from "./absence-reports-list";
import {
  scheduleEvaluation,
  markEvaluationDone,
  registerAuthorization,
  activatePatient,
  setEmergencyContact,
} from "./stage-actions";

// Papéis que a RLS de `documents` permite escrever (clínica inteira, ou
// terapeuta vinculado ao paciente). Mostrar o formulário pra esses papéis é
// só conveniência de UI — a RLS já é o portão real do INSERT, então um
// terapeuta sem vínculo com este paciente veria o formulário mas o envio
// falharia com a mensagem de permissão da Server Action.
const CAN_UPLOAD_ROLES = ["gestor", "supervisor", "recepcao", "terapeuta"];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE });

export const dynamic = "force-dynamic";

export default async function PacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, full_name, status, birth_date, evaluated_at, first_session_at, entry_source, complaint")
    .eq("id", id)
    .maybeSingle();

  if (!patient || patientError) notFound();

  const { data: guardians } = await supabase
    .from("guardians")
    .select("id, full_name, phone, is_emergency_contact")
    .eq("patient_id", id);

  const { data: evalAppointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", id)
    .eq("is_evaluation", true)
    .not("status", "in", `(${CANCELLED_APPOINTMENT_STATUSES.join(",")})`)
    .limit(1)
    .maybeSingle();

  const { data: activeAuth } = await supabase
    .from("authorizations")
    .select("id, patient_insurance_id, patient_insurance!inner(patient_id)")
    .eq("patient_insurance.patient_id", id)
    .eq("status", "ativa")
    .limit(1)
    .maybeSingle();

  const stage = computeStage(patient, !!evalAppointment, !!activeAuth);

  // Header de identificação (PRD §1) — lógica compartilhada com a tela de
  // evolução do terapeuta via lib/patient-identity.ts.
  const { insurance: activeInsurance, activeAuthorization } =
    await getPatientIdentitySummary(supabase, id);

  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("role", "terapeuta")
    .order("full_name");

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const { data: insurers } = await supabase
    .from("insurers")
    .select("id, name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  // RLS de `documents` decide sozinha o que aparece aqui por papel — nunca
  // filtramos manualmente por role na aplicação (gestor/supervisor/recepção/
  // faturamento veem tudo da clínica; terapeuta só do paciente vinculado;
  // responsável só o que tiver shared_with_family=true).
  const { data: documents } = await supabase
    .from("documents")
    .select("id, category, uploaded_at, valid_until, shared_with_family")
    .eq("patient_id", id)
    .order("uploaded_at", { ascending: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canUploadDocuments = false;
  if (user) {
    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    canUploadDocuments = !!viewerProfile && CAN_UPLOAD_ROLES.includes(viewerProfile.role);
  }

  // Mural da família (PRD §4) — mural independente das evoluções, mesma
  // regra de RLS (feed_posts_read) decide o que aparece; ver lib/feed-posts.ts.
  const feedPosts = await getFeedPosts(supabase, id);

  // Faltas informadas pela família ainda aguardando decisão da recepção
  // (PRD §5) — as que já foram auto-aprovadas pelo trigger
  // absence_report_apply (anexo ou categoria 'doenca') não aparecem aqui.
  const { data: pendingAbsenceRaw } = await supabase
    .from("absence_reports")
    .select(
      "id, reason_category, reason_text, attachment_storage_path, appointments!inner(patient_id, starts_at), profiles!reported_by(full_name)",
    )
    .eq("appointments.patient_id", id)
    .eq("status", "em_analise")
    .order("created_at", { ascending: false });

  const pendingAbsenceReports: PendingAbsenceReport[] = (pendingAbsenceRaw ?? []).map((r) => ({
    id: r.id,
    appointmentStartsAt: r.appointments!.starts_at,
    reasonCategory: r.reason_category,
    reasonText: r.reason_text,
    hasAttachment: r.attachment_storage_path !== null,
    reportedByName:
      (Array.isArray(r.profiles) ? r.profiles[0]?.full_name : r.profiles?.full_name) ?? "Responsável",
  }));

  // ── Conteúdo das abas do prontuário (Paciente.dc.html) — só vale a pena
  // buscar quando o paciente já tem histórico de operação (estágio 5); um
  // lead/avaliação ainda não tem sessão, plano ou lançamento algum.
  const [
    { data: recentAppointments },
    { data: treatmentPlan },
    { data: teamAccess },
    { data: billingItems },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, status")
      .eq("patient_id", id)
      .order("starts_at", { ascending: false })
      .limit(20),
    supabase
      .from("treatment_plans")
      .select("id, status, approved_at, version")
      .eq("patient_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("patient_access")
      .select("id, profile_id, profiles!profile_id(full_name, council_type)")
      .eq("patient_id", id)
      .eq("access_type", "terapeuta")
      .is("revoked_at", null),
    supabase
      .from("billing_items")
      .select("id, amount, status, appointment_id, appointments!inner(patient_id, starts_at, discipline)")
      .eq("appointments.patient_id", id)
      .order("starts_at", { foreignTable: "appointments", ascending: false })
      .limit(20),
  ]);

  const { data: goals } = treatmentPlan
    ? await supabase
        .from("plan_goals")
        .select("id, description, domain, criterion, status")
        .eq("treatment_plan_id", treatmentPlan.id)
    : { data: [] as { id: string; description: string; domain: string; criterion: string | null; status: string }[] };

  const { data: notesRaw } = await supabase
    .from("session_notes")
    .select(
      "id, version, free_text, created_at_server, appointment_id, appointments!inner(patient_id, starts_at), profiles!session_notes_therapist_id_fkey(full_name)",
    )
    .eq("appointments.patient_id", id)
    .order("created_at_server", { ascending: false })
    .limit(10);

  const frequency: FrequencyDay[] = (recentAppointments ?? [])
    .slice()
    .reverse()
    .map((a) => ({
      id: a.id,
      colorVar: (APPOINTMENT_STATUS_STYLE[a.status] ?? APPOINTMENT_STATUS_STYLE.agendada).colorVar,
      title: `${fmtDate(a.starts_at)} · ${(APPOINTMENT_STATUS_STYLE[a.status] ?? {}).label ?? a.status}`,
    }));

  const goalRows: GoalRow[] = (goals ?? []).map((g) => ({
    id: g.id,
    title: g.description,
    domain: g.domain,
    criterion: g.criterion,
    status: g.status,
  }));

  const planStatusLabel = treatmentPlan
    ? treatmentPlan.status === "aprovado" && treatmentPlan.approved_at
      ? `aprovado ${fmtDate(treatmentPlan.approved_at)}`
      : treatmentPlan.status
    : null;

  const notes: EvolutionNote[] = (notesRaw ?? []).map((n) => ({
    id: n.id,
    date: fmtDate(n.appointments!.starts_at),
    version: n.version,
    therapistName:
      (Array.isArray(n.profiles) ? n.profiles[0]?.full_name : n.profiles?.full_name) ?? "—",
    freeText: n.free_text,
  }));

  const billing: BillingRow[] = (billingItems ?? []).map((b) => ({
    id: b.id,
    date: fmtDate(b.appointments!.starts_at),
    discipline: b.appointments!.discipline,
    amount: b.amount,
    status: b.status,
  }));

  const teamText =
    (teamAccess ?? []).length > 0 ? (
      <div className="flex flex-col gap-0.5">
        {(teamAccess ?? []).map((t) => {
          const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
          return (
            <span key={t.id}>
              {profile?.full_name ?? "—"}
              {profile?.council_type ? ` · ${profile.council_type}` : ""}
            </span>
          );
        })}
      </div>
    ) : (
      <span className="text-ink-faint">Sem terapeuta vinculado ainda.</span>
    );

  const guardianText =
    (guardians ?? []).length > 0 ? (
      <div className="flex flex-col gap-0.5">
        {(guardians ?? []).map((g) => (
          <span key={g.id}>
            {g.full_name}
            <br />
            <span className="text-ink-faint">{g.phone}</span>
          </span>
        ))}
      </div>
    ) : (
      <span className="text-ink-faint">Nenhum responsável cadastrado.</span>
    );

  const authorizationText = activeAuthorization ? (
    <span>
      {activeInsurance?.insurerName ?? "Convênio"} · {activeAuthorization.guideNumber ?? "sem nº de guia"}
      <br />
      <span className="text-ink-faint">
        {activeAuthorization.sessionsUsed} de {activeAuthorization.sessionsAuthorized} sessões usadas · válida
        até {fmtDate(activeAuthorization.validTo)}
      </span>
    </span>
  ) : (
    <span className="text-ink-faint">Sem autorização vigente.</span>
  );

  const documentsContent = (
    <>
      <table className="table">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Categoria</th>
            <th>Data</th>
            <th>Visível à família</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(documents ?? []).map((doc) => {
            const validityBadge = getValidityBadge(doc.valid_until);
            return (
              <tr key={doc.id}>
                <td className="font-semibold">
                  {DOCUMENT_CATEGORY_LABEL[doc.category] ?? doc.category}
                  {validityBadge && (
                    <span
                      className={`tag-status ml-2 ${validityBadge.label === "Vencido" ? "st-falta" : "st-agendada"}`}
                    >
                      {validityBadge.label}
                    </span>
                  )}
                </td>
                <td>{doc.category}</td>
                <td>
                  {fmtDate(doc.uploaded_at)}
                  {doc.valid_until && ` · válido até ${fmtDate(`${doc.valid_until}T00:00:00`)}`}
                </td>
                <td>{doc.shared_with_family ? "Sim" : "Não"}</td>
                <td className="text-right">
                  <DocumentViewButton documentId={doc.id} />
                </td>
              </tr>
            );
          })}
          {(documents ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="text-ink-faint">
                Nenhum documento anexado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {canUploadDocuments && (
        <div className="mt-4">
          <DocumentUploadForm patientId={patient.id} />
        </div>
      )}
    </>
  );

  const initials = patient.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <main className="flex flex-1 flex-col">
      <PatientHeader />

      <div className="flex flex-wrap items-end justify-between gap-6 px-10 pt-9">
        <div className="flex items-center gap-5">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold"
            style={{
              background: "var(--color-accent-100)",
              color: "var(--color-accent-700)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {initials || "?"}
          </span>
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              {patient.birth_date ? `Nasc. ${fmtDate(patient.birth_date)} · ` : ""}
              {activeInsurance?.insurerName ?? "Particular"}
              {activeAuthorization?.guideNumber ? ` · guia ${activeAuthorization.guideNumber}` : ""}
            </h6>
            <h1 className="m-0">{patient.full_name}</h1>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="btn btn-secondary" disabled>
            Editar cadastro
          </button>
          <a href="/recepcao/agenda" className="btn btn-primary">
            Nova sessão
          </a>
        </div>
      </div>

      {stage < 5 && (
        <div className="px-10 pt-8">
          <div className="card max-w-[720px]">
            <div className="card-kicker">Próximo passo</div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <StageChecklist stage={stage} />
              <div>
                {stage === 1 && (
                  <StageActionForm action={scheduleEvaluation.bind(null, patient.id)} submitLabel="Agendar avaliação">
                    <select name="therapist_id" required className="input">
                      <option value="">Terapeuta</option>
                      {(therapists ?? []).map((t) => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                    <select name="room_id" required className="input">
                      <option value="">Sala</option>
                      {(rooms ?? []).map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <input type="date" name="date" required className="input" />
                    <input type="time" name="time" required className="input" />
                  </StageActionForm>
                )}
                {stage === 2 && (
                  <StageActionForm action={markEvaluationDone.bind(null, patient.id)} submitLabel="Marcar avaliação como realizada">
                    <p className="text-sm text-ink-soft">Confirma que a avaliação já aconteceu?</p>
                  </StageActionForm>
                )}
                {stage === 3 && (
                  <StageActionForm action={registerAuthorization.bind(null, patient.id)} submitLabel="Registrar autorização">
                    <select name="insurer_id" required className="input">
                      <option value="">Convênio</option>
                      {(insurers ?? []).map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                    <input type="text" name="guide_number" placeholder="Número da guia" className="input" />
                    <input type="text" name="procedure_code" required placeholder="Código do procedimento" className="input" />
                    <input type="number" name="sessions_authorized" required placeholder="Sessões autorizadas" className="input" />
                    <input type="date" name="valid_from" required className="input" />
                    <input type="date" name="valid_to" required className="input" />
                  </StageActionForm>
                )}
                {stage === 4 && (
                  <StageActionForm action={activatePatient.bind(null, patient.id)} submitLabel="Montar grade (1ª sessão)">
                    <select name="therapist_id" required className="input">
                      <option value="">Terapeuta</option>
                      {(therapists ?? []).map((t) => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                    <select name="room_id" required className="input">
                      <option value="">Sala</option>
                      {(rooms ?? []).map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <input type="date" name="date" required className="input" />
                    <input type="time" name="time" required className="input" />
                    <input type="text" name="discipline" required placeholder="Disciplina" className="input" />
                  </StageActionForm>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-10 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          {(guardians ?? []).length > 1 &&
            (guardians ?? [])
              .filter((g) => !g.is_emergency_contact)
              .map((g) => (
                <form
                  key={g.id}
                  action={async () => {
                    "use server";
                    await setEmergencyContact(patient.id, g.id);
                  }}
                >
                  <button type="submit" className="btn btn-ghost text-xs">
                    Definir {g.full_name} como contato de emergência
                  </button>
                </form>
              ))}
        </div>
      </div>

      <PatientTabs
        frequency={frequency}
        goals={goalRows}
        planStatusLabel={planStatusLabel}
        guardianText={guardianText}
        authorizationText={authorizationText}
        teamText={teamText}
        notes={notes}
        documentsContent={documentsContent}
        billing={billing}
      />

      {pendingAbsenceReports.length > 0 && (
        <div className="px-10 pt-6">
          <div className="card max-w-[720px]">
            <div className="card-kicker">Faltas informadas pela família</div>
            <AbsenceReportsList patientId={patient.id} reports={pendingAbsenceReports} />
          </div>
        </div>
      )}

      <div className="px-10 py-6">
        <div className="card max-w-[720px]">
          <div className="card-kicker">Mural da família</div>
          <ul className="flex flex-col gap-3">
            {feedPosts.map((post) => (
              <li key={post.id} className="rounded-md border border-paper-line-strong bg-paper px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">{post.authorName}</span>
                  <span className="text-xs text-ink-faint">
                    {new Date(post.createdAt).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                  </span>
                </div>
                {post.body && <p className="mt-1 text-ink-soft">{post.body}</p>}
                {post.media.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {post.media.map((m) =>
                      m.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={m.id}
                          src={m.url}
                          alt=""
                          className="h-24 w-24 rounded-md object-cover"
                        />
                      ) : (
                        <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs">
                          Abrir anexo
                        </a>
                      ),
                    )}
                  </div>
                )}
              </li>
            ))}
            {feedPosts.length === 0 && <li className="text-sm text-ink-faint">Nenhum recado publicado ainda.</li>}
          </ul>
          {canUploadDocuments && (
            <div className="mt-4">
              <FeedPostForm patientId={patient.id} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
