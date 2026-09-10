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
import { canConductFirstAssessment } from "@/lib/anamnese-access";
import { getEnabledInstrumentKeys } from "@/lib/clinic-instruments";
import type { NativeInstrumentKey } from "@/lib/native-instruments";
import { PROTOCOL_LABEL, getEnabledProtocolsForClinic } from "@/lib/protocol-catalog";

import { checkHasPendingPtsNotice } from "@/components/prontuario/notify-pts-actions";

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
    .select("id, full_name, birth_date, clinic_id")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) notFound();

  await logRecordAccess(supabase, patientId, "prontuario_terapeuta");

  const [dossier, { insurance, emergencyContact }, behaviorCatalog, contacts, enabledInstruments, enabledProtocols, hasPendingPtsNotice] = await Promise.all([
    getPatientDossier(supabase, patientId, { includeBilling: false }),
    getPatientIdentitySummary(supabase, patientId),
    getBehaviorCatalog(supabase, { activeOnly: false }),
    supabase.rpc("patient_contact_summary", { p_patient_id: patientId }),
    getEnabledInstrumentKeys(supabase, patient.clinic_id),
    getEnabledProtocolsForClinic(supabase, patient.clinic_id),
    checkHasPendingPtsNotice(patientId),
  ]);

  // Atalhos de instrumento só aparecem se a clínica os mantém ativos
  // (/gestor/cadastros/instrumentos). O hub de fono cobre ADL, ADL-2 e
  // PROC, então basta um deles estar ativo para o botão fazer sentido.
  // Atalho para a 1ª avaliação (anamnese ampliada) só para quem pode
  // conduzi-la — avaliador ou terapeuta escalado na avaliação deste
  // paciente (lib/anamnese-access.ts).
  const canDoFirstAssessment = await canConductFirstAssessment(supabase, user.id, patientId);

  const showFono = ["adl", "adl2", "proc"].some((key) => enabledInstruments.has(key as NativeInstrumentKey));
  const showSociallySavvy = enabledInstruments.has("socially_savvy");

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

  // Ponto de entrada pra evolução (incl. gravação por voz de ~30s, ver
  // voice-evolution-recorder.tsx) direto da ficha, sem depender de estar na
  // agenda do dia — só sessões já realizadas do próprio terapeuta e ainda
  // sem nota, pois session_notes exige um appointment_id real (é a sessão
  // que ancora a evolução, não um registro solto).
  let pendingEvolutions: { id: string; date: string; discipline: string }[] = [];
  if (profile.role === "terapeuta") {
    const { data: pendingAppts } = await supabase
      .from("appointments")
      .select("id, starts_at, discipline")
      .eq("patient_id", patientId)
      .eq("therapist_id", user.id)
      .eq("status", "realizada")
      .order("starts_at", { ascending: false })
      .limit(20);

    const pendingApptIds = (pendingAppts ?? []).map((a) => a.id);
    const { data: notesForPending } = pendingApptIds.length
      ? await supabase.from("session_notes").select("appointment_id").in("appointment_id", pendingApptIds)
      : { data: null };
    const notedSet = new Set((notesForPending ?? []).map((n) => n.appointment_id));

    pendingEvolutions = (pendingAppts ?? [])
      .filter((a) => !notedSet.has(a.id))
      .map((a) => ({ id: a.id, date: fmtDateTime(a.starts_at, CLINIC_TIMEZONE), discipline: a.discipline }));
  }

  const clinicalDocuments = dossier.documents.filter((d) => THERAPIST_DOCUMENT_CATEGORIES.includes(d.category));

  const documentsContent = (
    <>
      <div className="overflow-x-auto">
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
      </div>
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
          className="flex items-center justify-between border-b py-3 text-base"
          style={{ borderColor: "color-mix(in srgb, var(--color-text) 8%, transparent)" }}
        >
          <span>{fmtDateTime(a.startsAt, CLINIC_TIMEZONE)}</span>
          <span className="text-ink-soft">
            {a.discipline} · {a.therapistName}
          </span>
        </li>
      ))}
      {dossier.upcoming.length === 0 && <p className="text-base text-ink-faint">Nenhuma sessão futura agendada.</p>}
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
    <main className="flex flex-1 flex-col pb-24 md:pb-10">
      <PageHeader axisLabel="Terapeuta" title={patient.full_name} description="Ficha do paciente" />

      <div className="mx-auto w-full max-w-[1720px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Coluna Lateral Sticky: Identidade + Atalhos Rápidos */}
          <aside className="md:col-span-4 xl:col-span-3">
            <div className="space-y-4 md:sticky md:top-4">
              <PatientIdentityBar
                patientName={patient.full_name}
                insurance={insurance}
                emergencyContact={emergencyContact}
                variant="sidebar"
              />

              <div className="rounded-xl border border-paper-line-strong bg-paper p-4 shadow-2xs">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
                  Instrumentos de Avaliação
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {canDoFirstAssessment && (
                    <Link
                      href={`/terapeuta/paciente/${patient.id}/anamnese`}
                      className="flex items-center gap-2 rounded-lg border border-paper-line p-2 text-left no-underline transition hover:border-accent-1 hover:bg-paper-surface"
                    >
                      <span className="text-2xl">🧾</span>
                      <span className="text-sm font-semibold leading-tight text-ink">1ª Avaliação</span>
                    </Link>
                  )}
                  {enabledProtocols.map((protocol) => (
                    <Link
                      key={protocol.name}
                      href={`/terapeuta/paciente/${patient.id}/avaliacao?protocolo=${protocol.name}`}
                      className="flex items-center gap-2 rounded-lg border border-paper-line p-2 text-left no-underline transition hover:border-accent-1 hover:bg-paper-surface"
                    >
                      <span className="text-2xl">📋</span>
                      <span className="text-sm font-semibold leading-tight text-ink">
                        {PROTOCOL_LABEL[protocol.name] ?? protocol.displayName}
                      </span>
                    </Link>
                  ))}
                  {showFono && (
                    <Link
                      href={`/terapeuta/paciente/${patient.id}/fono`}
                      className="flex items-center gap-2 rounded-lg border border-paper-line p-2 text-left no-underline transition hover:border-accent-1 hover:bg-paper-surface"
                    >
                      <span className="text-2xl">🗣️</span>
                      <span className="text-sm font-semibold leading-tight text-ink">Fono</span>
                    </Link>
                  )}
                  {showSociallySavvy && (
                    <Link
                      href={`/terapeuta/paciente/${patient.id}/socially-savvy`}
                      className="flex items-center gap-2 rounded-lg border border-paper-line p-2 text-left no-underline transition hover:border-accent-1 hover:bg-paper-surface"
                    >
                      <span className="text-2xl">🤝</span>
                      <span className="text-sm font-semibold leading-tight text-ink">Socially Savvy</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Painel Conteúdo Principal */}
          <div className="md:col-span-8 xl:col-span-9">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-paper-line pb-4">
              <h2 className="text-lg font-bold text-ink">Prontuário & Atividades</h2>
              <div className="flex flex-wrap gap-2">
                <Link href={`/terapeuta/paciente/${patient.id}/metricas`} className="btn btn-secondary text-sm">
                  📈 Evolução/ABA
                </Link>
                <Link href={`/terapeuta/paciente/${patient.id}/relatorio`} className="btn btn-secondary text-sm">
                  👨‍👩‍👧 Relatório família
                </Link>
                <Link href={`/terapeuta/paciente/${patient.id}/relatorio-convenio`} className="btn btn-secondary text-sm">
                  🏥 Relatório convênio
                </Link>
                <Link href={`/terapeuta/paciente/${patient.id}/vinculo`} className="btn btn-secondary text-sm">
                  🔗 Vínculo
                </Link>
                <Link href={`/terapeuta/prontuario?p=${patient.id}`} className="btn btn-secondary text-sm">
                  📋 Prontuário & Auditoria
                </Link>
              </div>
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
              pendingEvolutions={pendingEvolutions}
              documentsContent={documentsContent}
              abaPrograms={dossier.abaPrograms}
              agendaContent={agendaContent}
              behaviorCatalog={behaviorCatalog}
              goalDescriptionById={goalDescriptionById}
              paddingClassName="px-0"
              patientId={patientId}
              initialHasPendingPtsNotice={hasPendingPtsNotice}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
