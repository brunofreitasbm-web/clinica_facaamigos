import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StageChecklist } from "@/components/stage-checklist";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { computeStage, CANCELLED_APPOINTMENT_STATUSES } from "@/lib/patient-stage";
import { DOCUMENT_CATEGORY_LABEL, getValidityBadge } from "@/lib/document-categories";
import { StageActionForm } from "./stage-action-form";
import { DocumentViewButton } from "./document-view-button";
import { DocumentUploadForm } from "./document-upload-form";
import {
  scheduleEvaluation,
  markEvaluationDone,
  registerAuthorization,
  activatePatient,
} from "./stage-actions";

// Papéis que a RLS de `documents` permite escrever (clínica inteira, ou
// terapeuta vinculado ao paciente). Mostrar o formulário pra esses papéis é
// só conveniência de UI — a RLS já é o portão real do INSERT, então um
// terapeuta sem vínculo com este paciente veria o formulário mas o envio
// falharia com a mensagem de permissão da Server Action.
const CAN_UPLOAD_ROLES = ["gestor", "supervisor", "recepcao", "terapeuta"];

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
    .select("id, full_name, status, evaluated_at, first_session_at, entry_source, complaint")
    .eq("id", id)
    .maybeSingle();

  if (!patient || patientError) notFound();

  const { data: guardians } = await supabase
    .from("guardians")
    .select("id, full_name, phone")
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
    .select("id, patient_insurance!inner(patient_id)")
    .eq("patient_insurance.patient_id", id)
    .eq("status", "ativa")
    .limit(1)
    .maybeSingle();

  const stage = computeStage(patient, !!evalAppointment, !!activeAuth);

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

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title={patient.full_name}
        description={`Origem: ${patient.entry_source ?? "não informada"}`}
      />
      <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 sm:p-10">
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Estágio</h2>
          <div className="mt-3">
            <StageChecklist stage={stage} />
          </div>
        </div>
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Responsáveis</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {(guardians ?? []).map((g) => (
              <li key={g.id}>
                {g.full_name} — {g.phone}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="px-6 pb-10 sm:px-10">
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Próximo passo</h2>
          <div className="mt-3">
            {stage === 1 && (
              <StageActionForm action={scheduleEvaluation.bind(null, patient.id)} submitLabel="Agendar avaliação">
                <select name="therapist_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
                  <option value="">Terapeuta</option>
                  {(therapists ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
                <select name="room_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
                  <option value="">Sala</option>
                  {(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input type="date" name="date" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
                <input type="time" name="time" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
              </StageActionForm>
            )}
            {stage === 2 && (
              <StageActionForm action={markEvaluationDone.bind(null, patient.id)} submitLabel="Marcar avaliação como realizada">
                <p className="text-sm text-ink-soft">Confirma que a avaliação já aconteceu?</p>
              </StageActionForm>
            )}
            {stage === 3 && (
              <StageActionForm action={registerAuthorization.bind(null, patient.id)} submitLabel="Registrar autorização">
                <select name="insurer_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
                  <option value="">Convênio</option>
                  {(insurers ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input type="text" name="guide_number" placeholder="Número da guia" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
                <input type="text" name="procedure_code" required placeholder="Código do procedimento" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
                <input type="number" name="sessions_authorized" required placeholder="Sessões autorizadas" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
                <input type="date" name="valid_from" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
                <input type="date" name="valid_to" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
              </StageActionForm>
            )}
            {stage === 4 && (
              <StageActionForm action={activatePatient.bind(null, patient.id)} submitLabel="Montar grade (1ª sessão)">
                <select name="therapist_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
                  <option value="">Terapeuta</option>
                  {(therapists ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
                <select name="room_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
                  <option value="">Sala</option>
                  {(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input type="date" name="date" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
                <input type="time" name="time" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
                <input type="text" name="discipline" required placeholder="Disciplina" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
              </StageActionForm>
            )}
            {stage === 5 && <p className="text-sm text-status-positive-text">Paciente ativo — grade montada.</p>}
          </div>
        </div>
      </div>
      <div className="px-6 pb-10 sm:px-10">
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Documentos</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {(documents ?? []).map((doc) => {
              const validityBadge = getValidityBadge(doc.valid_until);
              return (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {DOCUMENT_CATEGORY_LABEL[doc.category] ?? doc.category}
                    </p>
                    <p className="text-ink-faint">
                      Enviado em{" "}
                      {new Date(doc.uploaded_at).toLocaleDateString("pt-BR", {
                        timeZone: CLINIC_TIMEZONE,
                      })}
                      {doc.valid_until &&
                        ` · válido até ${new Date(`${doc.valid_until}T00:00:00`).toLocaleDateString("pt-BR")}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {validityBadge && (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${validityBadge.soft} ${validityBadge.text}`}
                        >
                          {validityBadge.label}
                        </span>
                      )}
                      {doc.shared_with_family && (
                        <span className="inline-block rounded-full bg-chart-soft px-2 py-0.5 text-xs font-medium text-chart-strong">
                          Compartilhado com a família
                        </span>
                      )}
                    </div>
                  </div>
                  <DocumentViewButton documentId={doc.id} />
                </li>
              );
            })}
            {(documents ?? []).length === 0 && (
              <li className="text-sm text-ink-faint">Nenhum documento anexado.</li>
            )}
          </ul>
          {canUploadDocuments && (
            <div className="mt-4">
              <DocumentUploadForm patientId={patient.id} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
