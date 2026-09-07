import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PatientIdentityBar } from "@/components/patient-identity-bar";
import { PatientTabs } from "@/components/prontuario/patient-tabs";
import { DocumentViewButton } from "@/components/prontuario/document-view-button";
import { DocumentUploadForm } from "@/components/prontuario/document-upload-form";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { fmtDate as fmtDateShared, fmtDateTime } from "@/lib/format";
import { getPatientIdentitySummary } from "@/lib/patient-identity";
import { getPatientDossier } from "@/lib/patient-dossier";
import { getBehaviorCatalog } from "@/lib/behavior-catalog";
import { getMetasTrabalhadas, type SessionNoteStructured } from "@/lib/session-note-fields";
import { DOCUMENT_CATEGORY_LABEL, getValidityBadge } from "@/lib/document-categories";
import { logRecordAccess } from "@/lib/record-access-log";

const fmtDate = (iso: string | null | undefined) => fmtDateShared(iso, CLINIC_TIMEZONE);

// Ficha do terapeuta expõe upload/visualização só destas categorias
// clínicas — PRD §9.5 dá ao terapeuta anexo de relatório/laudo/reavaliação,
// mas mantém `contrato` (comercial) e `carteirinha`/`termo_lgpd`/
// `autorizacao` (operação de recepção/faturamento) fora da tela dele.
//
// Isto é uma regra de PRODUTO, não um controle de segurança: a policy
// `documents_read` (20260904000008_documents.sql) já entrega ao terapeuta
// vinculado TODAS as categorias do paciente — este filtro só decide o que
// esta tela específica mostra/permite enviar, as linhas continuam
// alcançáveis por quem tiver outro caminho de acesso (ex.: /recepcao).
const THERAPIST_DOCUMENT_CATEGORIES = ["pedido_medico", "laudo", "relatorio_evolucao", "reavaliacao", "termo_imagem", "outro"];

export const dynamic = "force-dynamic";

export default async function TerapeutaFichaPacientePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["terapeuta", "supervisor", "gestor"].includes(profile.role)) {
    redirect("/");
  }

  // RLS (patients_read) é o portão real: um terapeuta sem patient_access
  // pra este paciente recebe null aqui, e tratamos como 404 — nunca
  // revelamos se o paciente existe pra quem não tem acesso a ele.
  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, birth_date")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) notFound();

  await logRecordAccess(supabase, patientId, "prontuario_terapeuta");

  const [dossier, { insurance, emergencyContact }, behaviorCatalog, contacts] = await Promise.all([
    getPatientDossier(supabase, patientId, { includeBilling: false }),
    getPatientIdentitySummary(supabase, patientId),
    getBehaviorCatalog(supabase, { activeOnly: false }),
    supabase.rpc("patient_contact_summary", { p_patient_id: patientId }),
  ]);

  const allMetaGoalIds = Array.from(
    new Set(dossier.notes.flatMap((n) => getMetasTrabalhadas(n.structured as SessionNoteStructured | null).map((m) => m.plan_goal_id))),
  );
  const goalDescriptionById = new Map<string, string>();
  if (allMetaGoalIds.length > 0) {
    const { data: metaGoals } = await supabase.from("plan_goals").select("id, description").in("id", allMetaGoalIds);
    for (const g of metaGoals ?? []) goalDescriptionById.set(g.id, g.description);
  }

  const notesWithLinks = dossier.notes.map((n) => ({
    ...n,
    href: n.appointmentId ? `/terapeuta/evolucao/${n.appointmentId}` : undefined,
    historyHref: n.appointmentId ? `/terapeuta/evolucao/${n.appointmentId}/historico` : undefined,
  }));

  const clinicalDocuments = dossier.documents.filter((d) => THERAPIST_DOCUMENT_CATEGORIES.includes(d.category));

  const documentsContent = (
    <>
      <table className="table">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Data</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clinicalDocuments.map((doc) => {
            const validityBadge = getValidityBadge(doc.validUntil);
            return (
              <tr key={doc.id}>
                <td className="font-semibold">
                  {DOCUMENT_CATEGORY_LABEL[doc.category] ?? doc.category}
                  {validityBadge && (
                    <span className={`tag-status ml-2 ${validityBadge.label === "Vencido" ? "st-falta" : "st-agendada"}`}>
                      {validityBadge.label}
                    </span>
                  )}
                </td>
                <td>
                  {fmtDate(doc.uploadedAt)}
                  {doc.validUntil && ` · válido até ${fmtDate(`${doc.validUntil}T00:00:00`)}`}
                </td>
                <td className="text-right">
                  <DocumentViewButton documentId={doc.id} />
                </td>
              </tr>
            );
          })}
          {clinicalDocuments.length === 0 && (
            <tr>
              <td colSpan={3} className="text-ink-faint">
                Nenhum documento clínico anexado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-4">
        <DocumentUploadForm patientId={patient.id} allowedCategories={THERAPIST_DOCUMENT_CATEGORIES} />
      </div>
    </>
  );

  const agendaContent = (
    <ul className="flex flex-col gap-2">
      {dossier.upcoming.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between border-b py-3 text-sm"
          style={{ borderColor: "color-mix(in srgb, var(--color-text) 8%, transparent)" }}
        >
          <span>{fmtDateTime(a.startsAt, CLINIC_TIMEZONE)}</span>
          <span className="text-ink-soft">
            {a.discipline} · {a.therapistName}
          </span>
        </li>
      ))}
      {dossier.upcoming.length === 0 && <p className="text-sm text-ink-faint">Nenhuma sessão futura agendada.</p>}
    </ul>
  );

  const guardianText =
    (contacts.data ?? []).length > 0 ? (
      <div className="flex flex-col gap-2">
        {(contacts.data ?? []).map((g) => (
          <span key={g.guardian_id}>
            {g.guardian_name}
            {g.is_emergency_contact && <span className="tag-status st-agendada ml-2">Emergência</span>}
            <br />
            <span className="text-ink-faint">{g.phone}</span>
          </span>
        ))}
      </div>
    ) : (
      <span className="text-ink-faint">Nenhum responsável cadastrado.</span>
    );

  const authorizationText = insurance ? (
    <span>
      {insurance.insurerName}
      {insurance.cardNumber && <span className="text-ink-faint"> · carteirinha {insurance.cardNumber}</span>}
    </span>
  ) : (
    <span className="text-ink-faint">Particular · sem convênio cadastrado.</span>
  );

  return (
    <main className="flex flex-1 flex-col pb-10">
      <PageHeader axisLabel="Terapeuta" title={patient.full_name} description="Ficha do paciente" />
      <PatientIdentityBar patientName={patient.full_name} insurance={insurance} emergencyContact={emergencyContact} />

      <div className="flex flex-wrap gap-2 px-10 pt-6">
        <Link href={`/terapeuta/paciente/${patient.id}/metricas`} className="btn btn-secondary">
          Evolução/ABA
        </Link>
        <Link href={`/terapeuta/paciente/${patient.id}/avaliacao`} className="btn btn-secondary">
          Avaliação de protocolo
        </Link>
        <Link href={`/terapeuta/paciente/${patient.id}/fono`} className="btn btn-secondary">
          Fono (ADL/ADL-2/PROC)
        </Link>
        <Link href={`/terapeuta/paciente/${patient.id}/relatorio`} className="btn btn-secondary">
          Relatório família
        </Link>
        <Link href={`/terapeuta/paciente/${patient.id}/relatorio-convenio`} className="btn btn-secondary">
          Relatório convênio
        </Link>
        <Link href={`/terapeuta/paciente/${patient.id}/vinculo`} className="btn btn-secondary">
          Vínculo
        </Link>
      </div>

      <PatientTabs
        frequency={dossier.frequency}
        goals={dossier.goals}
        planStatusLabel={dossier.planStatusLabel}
        guardianText={guardianText}
        authorizationText={authorizationText}
        teamText={
          dossier.teamText.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {dossier.teamText.map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
          ) : (
            <span className="text-ink-faint">Sem terapeuta vinculado ainda.</span>
          )
        }
        notes={notesWithLinks}
        documentsContent={documentsContent}
        abaPrograms={dossier.abaPrograms}
        agendaContent={agendaContent}
        behaviorCatalog={behaviorCatalog}
        goalDescriptionById={goalDescriptionById}
        paddingClassName="px-5 sm:px-10"
      />
    </main>
  );
}
