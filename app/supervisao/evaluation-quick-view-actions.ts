// app/supervisao/evaluation-quick-view-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EvaluationBookInput } from "@/lib/evaluation-agenda";
import type { LaudoExtraction } from "@/lib/laudo-extraction";
import { DOCUMENT_CATEGORY_LABEL } from "@/lib/document-categories";

/** Um documento abrível a partir da janela de consulta rápida (laudo, guia, carteirinha…). */
export type QuickViewFile = {
  key: string;
  label: string;
  /** Rota GET que resolve o arquivo (302 pra URL assinada) — abre em aba nova. */
  href: string;
  kind: "laudo" | "guia" | "carteirinha" | "outro";
  /** Linha secundária: nome original, status de revisão, validade… */
  meta: string | null;
};

export type QuickViewField = { label: string; value: string };

/**
 * Tudo o que a Supervisão costuma precisar olhar ANTES de arrastar um
 * paciente pro calendário de 1ª avaliação — sem abrir o prontuário nem a
 * tela de acolhimento. Normalizado: as três origens de um paciente novo
 * (WhatsApp/anamnese, PDF de convênio, cadastro presencial) guardam os
 * mesmos dados em tabelas diferentes.
 */
export type EvaluationQuickView = {
  patientName: string;
  originLabel: string;
  /** Contato do responsável — quem a recepção liga se precisar confirmar algo. */
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  /** Convênio/particular. */
  insuranceLabel: string | null;
  fields: QuickViewField[];
  /** Resumo do laudo lido pela IA (lib/laudo-extraction.ts), quando houver. */
  laudoSummary: string | null;
  files: QuickViewFile[];
  warnings: string[];
  /** Link pro prontuário completo, se o paciente já existe em `patients`. */
  patientHref: string | null;
};

type QuickViewResult = { success: true; view: EvaluationQuickView } | { success: false; error: string };

const GENERIC_ERROR = "Não foi possível carregar os dados deste paciente.";

function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return null;
  return `${day}/${month}/${year}`;
}

function pushField(fields: QuickViewField[], label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return;
  fields.push({ label, value: String(value) });
}

/**
 * Portão de papel — a RLS de `anamnesis_scheduling_requests` é permissiva
 * (`using (true)`, 20260906000009) e o resumo abaixo junta laudo, guia e
 * telefone da família; só equipe da clínica pode ver, nunca o responsável.
 * Mesma checagem de app/api/arquivos/anamnese/[requestId]/[slot]/route.ts.
 */
async function requireStaff(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Faça login de novo." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile?.role || profile.role === "responsavel") return { ok: false, error: GENERIC_ERROR };
  return { ok: true };
}

async function anamnesisQuickView(requestId: string): Promise<QuickViewResult> {
  // Mesma razão de getAnamnesisPoolItems em lib/evaluation-agenda.ts: as
  // leituras dessa tabela no fluxo do bot passam por service_role.
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("anamnesis_scheduling_requests")
    .select(
      "id, child_name, child_birth_date, guardian_name, guardian_phone, guardian_cpf, card_number, is_private, status, rejection_reason, patient_id, laudo_pdf_url, guia_pdf_url, carteirinha_frente_url, carteirinha_verso_url",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { success: false, error: "Solicitação não encontrada." };

  const files: QuickViewFile[] = [];
  const base = `/api/arquivos/anamnese/${request.id}`;
  if (request.laudo_pdf_url) files.push({ key: "laudo", label: "Laudo médico", href: `${base}/laudo`, kind: "laudo", meta: null });
  if (request.guia_pdf_url) files.push({ key: "guia", label: "Guia do plano", href: `${base}/guia`, kind: "guia", meta: null });
  if (request.carteirinha_frente_url)
    files.push({ key: "cart-frente", label: "Carteirinha (frente)", href: `${base}/carteirinha_frente`, kind: "carteirinha", meta: null });
  if (request.carteirinha_verso_url && request.carteirinha_verso_url !== request.carteirinha_frente_url)
    files.push({ key: "cart-verso", label: "Carteirinha (verso)", href: `${base}/carteirinha_verso`, kind: "carteirinha", meta: null });

  const fields: QuickViewField[] = [];
  pushField(fields, "Nascimento", fmtDate(request.child_birth_date));
  pushField(fields, "CPF do responsável", request.guardian_cpf);
  pushField(fields, "Nº da carteirinha", request.card_number);

  const warnings: string[] = [];
  if (request.rejection_reason) warnings.push(`Documentação já rejeitada uma vez: ${request.rejection_reason}`);
  if (!request.is_private && !request.guia_pdf_url) warnings.push("Sem guia anexada — a autorização vai precisar ser feita pela clínica.");

  return {
    success: true,
    view: {
      patientName: request.child_name,
      originLabel: "WhatsApp · Anamnese",
      guardianName: request.guardian_name,
      guardianPhone: request.guardian_phone,
      guardianEmail: null,
      insuranceLabel: request.is_private ? "Particular" : "Convênio",
      fields,
      laudoSummary: null,
      files,
      warnings,
      patientHref: request.patient_id ? `/recepcao/pacientes/${request.patient_id}` : null,
    },
  };
}

const FILE_KIND_LABEL: Record<string, string> = {
  laudo: "Laudo médico",
  guia: "Guia do plano",
  carteirinha: "Carteirinha",
  outro: "Documento",
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: "aguardando conferência",
  approved: "aprovado",
  rejected: "rejeitado",
};

async function intakeLeadQuickView(leadId: string): Promise<QuickViewResult> {
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("insurance_intake_leads")
    .select(
      "id, patient_full_name, patient_birth_date, patient_cid, patient_id, guardian_full_name, guardian_email, phone_e164, guardian_phone_raw, plan_name, card_number, card_valid_until, guide_number, procedure_code, sessions_authorized, valid_from, valid_to, authorization_password, warnings, extra, insurers(name)",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { success: false, error: "Acolhimento não encontrado." };

  const { data: leadFiles } = await supabase
    .from("insurance_intake_lead_files")
    .select("id, original_name, kind, review_status, extraction, extraction_status")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });

  const files: QuickViewFile[] = (leadFiles ?? []).map((f) => ({
    key: f.id,
    label: FILE_KIND_LABEL[f.kind ?? "outro"] ?? "Documento",
    href: `/api/arquivos/acolhimento/${f.id}`,
    kind: (f.kind ?? "outro") as QuickViewFile["kind"],
    meta: [f.original_name, REVIEW_STATUS_LABEL[f.review_status]].filter(Boolean).join(" · ") || null,
  }));

  // Primeiro resumo de laudo disponível — é o que poupa abrir o PDF.
  const laudoSummary =
    (leadFiles ?? [])
      .map((f) => (f.extraction_status === "done" ? (f.extraction as LaudoExtraction | null) : null))
      .find((ex) => ex?.summary)?.summary ?? null;

  const insurer = Array.isArray(lead.insurers) ? lead.insurers[0] : lead.insurers;
  const isPresencial = (lead.extra as Record<string, unknown> | null)?.is_presencial === true;

  const fields: QuickViewField[] = [];
  pushField(fields, "Nascimento", fmtDate(lead.patient_birth_date));
  pushField(fields, "CID", lead.patient_cid);
  pushField(fields, "Nº da carteirinha", lead.card_number);
  pushField(fields, "Carteirinha válida até", fmtDate(lead.card_valid_until));
  pushField(fields, "Nº da guia", lead.guide_number);
  pushField(fields, "Procedimento", lead.procedure_code);
  pushField(fields, "Sessões autorizadas", lead.sessions_authorized);
  const validFrom = fmtDate(lead.valid_from);
  const validTo = fmtDate(lead.valid_to);
  if (validFrom || validTo) pushField(fields, "Guia válida", `${validFrom ?? "—"} a ${validTo ?? "—"}`);
  pushField(fields, "Senha de autorização", lead.authorization_password);

  return {
    success: true,
    view: {
      patientName: lead.patient_full_name ?? "—",
      originLabel: isPresencial ? "Presencial · docs conferidos na recepção" : "PDF de plano de saúde",
      guardianName: lead.guardian_full_name,
      guardianPhone: lead.phone_e164 ?? lead.guardian_phone_raw,
      guardianEmail: lead.guardian_email,
      insuranceLabel: insurer?.name ?? lead.plan_name ?? null,
      fields,
      laudoSummary,
      files,
      warnings: lead.warnings ?? [],
      patientHref: lead.patient_id ? `/recepcao/pacientes/${lead.patient_id}` : null,
    },
  };
}

/** Categorias de `documents` que interessam antes da 1ª avaliação — o resto é ruído nesta janela. */
const RELEVANT_DOCUMENT_CATEGORIES = ["laudo", "autorizacao", "carteirinha", "pedido_medico", "reavaliacao"];

function documentKind(category: string): QuickViewFile["kind"] {
  if (category === "laudo" || category === "reavaliacao" || category === "pedido_medico") return "laudo";
  if (category === "autorizacao") return "guia";
  if (category === "carteirinha") return "carteirinha";
  return "outro";
}

async function patientQuickView(patientId: string): Promise<QuickViewResult> {
  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, full_name, birth_date, cid, complaint, guardians(full_name, phone, email, is_financial), patient_insurance(id, is_private, plan_name, card_number, card_valid_until, insurers(name))",
    )
    .eq("id", patientId)
    .maybeSingle();

  if (!patient) return { success: false, error: "Paciente não encontrado." };

  const { data: documents } = await supabase
    .from("documents")
    .select("id, category, note, valid_until, uploaded_at")
    .eq("patient_id", patientId)
    .in("category", RELEVANT_DOCUMENT_CATEGORIES)
    .order("uploaded_at", { ascending: false });

  const files: QuickViewFile[] = (documents ?? []).map((d) => ({
    key: d.id,
    label: DOCUMENT_CATEGORY_LABEL[d.category] ?? "Documento",
    href: `/api/arquivos/documento/${d.id}`,
    kind: documentKind(d.category),
    meta: [d.note, d.valid_until ? `válido até ${fmtDate(d.valid_until)}` : null].filter(Boolean).join(" · ") || null,
  }));

  const guardiansList = Array.isArray(patient.guardians) ? patient.guardians : patient.guardians ? [patient.guardians] : [];
  const guardian = guardiansList.find((g) => g.is_financial) ?? guardiansList[0] ?? null;

  const insuranceList = Array.isArray(patient.patient_insurance)
    ? patient.patient_insurance
    : patient.patient_insurance
      ? [patient.patient_insurance]
      : [];
  const insurance = insuranceList[0] ?? null;
  const insurer = insurance ? (Array.isArray(insurance.insurers) ? insurance.insurers[0] : insurance.insurers) : null;

  // Autorização vigente, se a recepção já tiver dado entrada na guia antes
  // mesmo da 1ª avaliação (acontece em convênio que autoriza por pacote).
  const { data: authorization } = insurance
    ? await supabase
        .from("authorizations")
        .select("guide_number, procedure_code, sessions_authorized, sessions_used, valid_from, valid_to, authorization_password, status")
        .eq("patient_insurance_id", insurance.id)
        .eq("status", "ativa")
        .order("valid_to", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const fields: QuickViewField[] = [];
  pushField(fields, "Nascimento", fmtDate(patient.birth_date));
  pushField(fields, "CID", patient.cid);
  pushField(fields, "Queixa", patient.complaint);
  pushField(fields, "Nº da carteirinha", insurance?.card_number);
  pushField(fields, "Carteirinha válida até", fmtDate(insurance?.card_valid_until));
  if (authorization) {
    pushField(fields, "Nº da guia", authorization.guide_number);
    pushField(fields, "Procedimento", authorization.procedure_code);
    pushField(fields, "Sessões autorizadas", `${authorization.sessions_used ?? 0}/${authorization.sessions_authorized} usadas`);
    const from = fmtDate(authorization.valid_from);
    const to = fmtDate(authorization.valid_to);
    if (from || to) pushField(fields, "Guia válida", `${from ?? "—"} a ${to ?? "—"}`);
    pushField(fields, "Senha de autorização", authorization.authorization_password);
  }

  const warnings: string[] = [];
  if (!insurance) warnings.push("Paciente sem convênio nem particular cadastrado.");
  if (insurance && !insurance.is_private && !authorization) warnings.push("Convênio sem autorização ativa — guia ainda a solicitar.");
  if (files.length === 0) warnings.push("Nenhum laudo ou guia anexado ao prontuário ainda.");

  return {
    success: true,
    view: {
      patientName: patient.full_name,
      originLabel: "Presencial · cadastro da recepção",
      guardianName: guardian?.full_name ?? null,
      guardianPhone: guardian?.phone ?? null,
      guardianEmail: guardian?.email ?? null,
      insuranceLabel: insurance?.is_private ? "Particular" : (insurer?.name ?? insurance?.plan_name ?? null),
      fields,
      laudoSummary: null,
      files,
      warnings,
      patientHref: `/recepcao/pacientes/${patient.id}`,
    },
  };
}

/**
 * Consulta rápida de um paciente da fila "Aguardando agendamento" do
 * calendário de 1ª avaliação — laudo, guia, contato do responsável e dados
 * do convênio, sem trocar de tela. Só leitura; agendar continua sendo
 * arrastar o card pro calendário.
 */
export async function getEvaluationQuickViewAction(bookInput: EvaluationBookInput): Promise<QuickViewResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { success: false, error: staff.error };

  try {
    if (bookInput.origin === "whatsapp_anamnese") return await anamnesisQuickView(bookInput.requestId);
    if (bookInput.origin === "convenio_pdf") return await intakeLeadQuickView(bookInput.leadId);
    return await patientQuickView(bookInput.patientId);
  } catch {
    return { success: false, error: GENERIC_ERROR };
  }
}
