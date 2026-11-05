import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { computeJourney, type JourneyEvaluation } from "@/lib/patient-journey-pure";
import { PatientListClient } from "./patient-list-client";
import { AuthorizedPackagesPanel } from "@/components/authorized-packages-panel";
import {
  getReceptionQueue,
  isPendingQueueItem,
} from "@/lib/reception-queue";
import {
  mergePills,
  PANEL_CATEGORIES,
  pillForQueueCategory,
  pillsFromLeadPendencies,
  registrationPills,
  type PatientPill,
} from "@/lib/patient-pills-pure";
import { buildWorkspaceItems } from "./pendencias/queue-items";
import type { PatientPanel } from "./patient-pendencies-dialog";

export const dynamic = "force-dynamic";

/** Pacientes que saíram da rotina: não cobramos documento deles. */
const NO_PILLS_STATUSES = ["arquivado", "alta", "evadido", "inativo"];

export default async function PacientesPage({ searchParams }: { searchParams: Promise<{ abrir?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select(
      "id, full_name, status, birth_date, cpf, created_at, evaluated_at, first_session_at, guardians(full_name, is_financial, email), patient_insurance(is_private, insurers(name, badge_color))",
    )
    .eq("clinic_id", DEV_CLINIC_ID)
    // Interessado ainda não é paciente (sem prontuário): vive em Autorizações até a
    // guia ser autorizada (promoteToPatient → "avaliacao").
    .neq("status", "interessado")
    .order("full_name");

  const patientIds = (patients ?? []).map((p) => p.id);

  const [{ data: evalAppointments }, { data: activeAuths }, { data: drafts }, { data: patientDocs }] = patientIds.length
    ? await Promise.all([
        supabase.from("appointments").select("patient_id, starts_at, status").in("patient_id", patientIds).eq("is_evaluation", true),
        supabase
          .from("authorizations")
          .select("id, patient_insurance!inner(patient_id)")
          .in("patient_insurance.patient_id", patientIds)
          .eq("status", "ativa"),
        supabase
          .from("registration_drafts")
          .select("patient_id, guide_sent_at, plan_authorized_at, authorization_waived, scheduling_enabled_at")
          .in("patient_id", patientIds)
          .neq("status", "rejected"),
        supabase.from("documents").select("patient_id, category").in("patient_id", patientIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  // Fila da recepção (a mesma que alimentava o menu Pendências): vira pílulas e
  // painéis de ação do paciente.
  const fullQueue = await getReceptionQueue(supabase);
  const queue = fullQueue.filter(isPendingQueueItem);
  const { data: reassignCandidates } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("active", true)
    .in("role", ["recepcao", "supervisor", "gestor"])
    .order("full_name", { ascending: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspaceItems = buildWorkspaceItems(queue, { reassignCandidates, userId: user?.id ?? null, patientMode: true });

  const queuePills = new Map<string, PatientPill[]>();
  const leadPills = new Map<string, PatientPill[]>();
  const panelsByPatient: Record<string, PatientPanel[]> = {};
  queue.forEach((item, index) => {
    if (!item.patientId) return;
    const pill = pillForQueueCategory(item.category);
    if (pill) queuePills.set(item.patientId, [...(queuePills.get(item.patientId) ?? []), pill]);
    if (item.category === "cadastro_assistido_ia" && item.draft) {
      leadPills.set(item.patientId, [...(leadPills.get(item.patientId) ?? []), ...pillsFromLeadPendencies(item.draft.pendencies.pills)]);
    }
    if (PANEL_CATEGORIES.includes(item.category)) {
      (panelsByPatient[item.patientId] ??= []).push({ id: item.id, label: item.categoryLabel, node: workspaceItems[index].detail });
    }
  });
  const docCategoriesByPatient = new Map<string, string[]>();
  for (const d of patientDocs ?? []) {
    docCategoriesByPatient.set(d.patient_id, [...(docCategoriesByPatient.get(d.patient_id) ?? []), d.category]);
  }


  const evaluationsByPatient = new Map<string, JourneyEvaluation[]>();
  for (const a of evalAppointments ?? []) {
    const list = evaluationsByPatient.get(a.patient_id) ?? [];
    list.push({ starts_at: a.starts_at, status: a.status });
    evaluationsByPatient.set(a.patient_id, list);
  }
  const draftsByPatient = new Map<string, NonNullable<typeof drafts>>();
  for (const d of drafts ?? []) {
    if (!d.patient_id) continue;
    draftsByPatient.set(d.patient_id, [...(draftsByPatient.get(d.patient_id) ?? []), d]);
  }
  const activeAuthPatientIds = new Set(
    (activeAuths ?? []).flatMap((a) => {
      const pi = a.patient_insurance as { patient_id: string } | { patient_id: string }[] | null;
      if (!pi) return [];
      return Array.isArray(pi) ? pi.map((x) => x.patient_id) : [pi.patient_id];
    }),
  );

  const rows = (patients ?? []).map((p) => {
    const guardiansList = Array.isArray(p.guardians) ? p.guardians : p.guardians ? [p.guardians] : [];
    const mainGuardian = guardiansList.find((g: any) => g.is_financial) || guardiansList[0];
    const insuranceList = Array.isArray(p.patient_insurance) ? p.patient_insurance : p.patient_insurance ? [p.patient_insurance] : [];
    const mainInsurance = insuranceList[0] as any;
    const insurerObj = Array.isArray(mainInsurance?.insurers) ? mainInsurance?.insurers[0] : mainInsurance?.insurers;
    const insurerName = mainInsurance?.is_private ? "Particular" : (insurerObj?.name ?? null);
    const insurerColor = mainInsurance?.is_private ? "#64748b" : (insurerObj?.badge_color ?? null);

    // Contato do WhatsApp ainda pendente: vale a leitura dele (arquivos ainda não
    // anexados ao paciente). Sem contato pendente: cadastro e documentos do paciente.
    const cadastroPills = leadPills.has(p.id)
      ? (leadPills.get(p.id) ?? [])
      : NO_PILLS_STATUSES.includes(p.status ?? "")
        ? []
        : registrationPills({
            docCategories: docCategoriesByPatient.get(p.id) ?? [],
            guardianEmails: guardiansList.map((g: any) => g.email),
            insurancePrivateFlags: insuranceList.map((i: any) => Boolean(i.is_private)),
          });
    const pills = mergePills(queuePills.get(p.id) ?? [], cadastroPills);

    return {
      id: p.id,
      full_name: p.full_name,
      pills,
      status: p.status,
      birth_date: p.birth_date,
      cpf: p.cpf,
      created_at: p.created_at,
      evaluated_at: p.evaluated_at,
      first_session_at: p.first_session_at,
      guardian_name: mainGuardian?.full_name ?? null,
      insurer_name: insurerName,
      insurer_color: insurerColor,
      journey_label: computeJourney({
        patient: p,
        planAuthorizedByDraft: (draftsByPatient.get(p.id) ?? []).some(
          (d) => d.plan_authorized_at || d.authorization_waived || d.scheduling_enabled_at,
        ),
        guideSent: (draftsByPatient.get(p.id) ?? []).some((d) => d.guide_sent_at),
        authorizationWaived: (draftsByPatient.get(p.id) ?? []).some((d) => d.authorization_waived),
        hasActiveAuthorization: activeAuthPatientIds.has(p.id),
        evaluations: evaluationsByPatient.get(p.id) ?? [],
        formatDateTime: (iso) => fmtDateTime(iso, CLINIC_TIMEZONE),
      }).label,
    };
  });

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Pacientes"
        description="Pacientes da clínica (plano autorizado). Interessados ficam em Autorizações."
      />
      <AuthorizedPackagesPanel />
      <PatientListClient rows={rows} panelsByPatient={panelsByPatient} initialOpenId={params.abrir ?? null} />
    </main>
  );
}
