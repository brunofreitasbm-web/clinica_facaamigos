"use server";

import { randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { InsurerReportDocument } from "@/lib/insurer-report-pdf";

type GenerateResult = { success: true; documentId: string } | { success: false; error: string };

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");

/**
 * Gera o relatório de evolução em PDF para o convênio (§8 Fase 2) a partir
 * de metas do plano aprovado + frequência no período — e anexa como
 * `documents` (category='relatorio_evolucao'), mesmo bucket/fluxo já usado
 * pelo upload manual de anexos (ver documents-actions.ts), pra recepção
 * poder abrir e protocolar junto ao convênio.
 */
export async function generateInsurerReport(
  patientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<GenerateResult> {
  if (!periodStart || !periodEnd || periodEnd < periodStart) {
    return { success: false, error: "Selecione um período válido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, birth_date, cid, clinic_id")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) return { success: false, error: "Paciente não encontrado." };

  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", patient.clinic_id).maybeSingle();

  const { data: generator } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("status")
    .eq("patient_id", patientId)
    .gte("starts_at", `${periodStart}T00:00:00`)
    .lte("starts_at", `${periodEnd}T23:59:59`);

  const sessionsRealized = (appointments ?? []).filter((a) => a.status === "realizada").length;
  const sessionsAbsent = (appointments ?? []).filter((a) =>
    ["falta_familia", "cancelada_familia", "cancelada_terapeuta", "cancelada_clinica"].includes(a.status),
  ).length;

  const { data: treatmentPlan } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", patientId)
    .eq("status", "aprovado")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Só `plan_goals` — nunca `protocol_items`/`protocol_assessments` (§9.4-A:
  // texto de item licenciado não pode sair em nenhum relatório exportável).
  const { data: goalsRaw } = treatmentPlan
    ? await supabase
        .from("plan_goals")
        .select("description, domain, criterion, status")
        .eq("treatment_plan_id", treatmentPlan.id)
        .eq("status", "ativa")
    : { data: [] as { description: string; domain: string; criterion: string | null; status: string }[] };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      InsurerReportDocument({
        clinicName: clinic?.name ?? "Clínica",
        patientName: patient.full_name,
        birthDate: fmtDate(patient.birth_date),
        cid: patient.cid,
        periodStart: fmtDate(periodStart),
        periodEnd: fmtDate(periodEnd),
        sessionsRealized,
        sessionsAbsent,
        goals: goalsRaw ?? [],
        generatedByName: generator?.full_name ?? "—",
        generatedAt: new Date().toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
      }),
    );
  } catch {
    return { success: false, error: "Não foi possível gerar o PDF. Tente de novo." };
  }

  const documentId = randomUUID();
  const storagePath = `${patientId}/${documentId}/relatorio-evolucao-${periodStart}-a-${periodEnd}.pdf`;

  const { error: insertError } = await supabase.from("documents").insert({
    id: documentId,
    patient_id: patientId,
    category: "relatorio_evolucao",
    storage_path: storagePath,
    uploaded_by: user.id,
    shared_with_family: false,
  });

  if (insertError) {
    return { success: false, error: "Você não tem permissão para anexar relatório a este paciente." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    await rollbackInsertedDocument(documentId);
    return { success: false, error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico." };
  }

  const { error: uploadError } = await admin.storage
    .from("clinic-documents")
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    await rollbackInsertedDocument(documentId);
    return { success: false, error: "Não foi possível salvar o PDF gerado. Tente de novo." };
  }

  revalidatePath(`/terapeuta/paciente/${patientId}/relatorio-convenio`);
  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true, documentId };
}

/** Mesma compensação de documents-actions.ts — linha órfã se o upload falhar depois do insert. */
async function rollbackInsertedDocument(documentId: string) {
  try {
    const admin = createAdminClient();
    await admin.from("documents").delete().eq("id", documentId);
  } catch {
    // Sem admin client não há como reverter; erro principal já é retornado.
  }
}

export type InsurerReportHistoryItem = {
  id: string;
  uploadedAt: string;
  uploadedByName: string;
};

export async function listInsurerReports(patientId: string): Promise<InsurerReportHistoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, uploaded_at, profiles!uploaded_by(full_name)")
    .eq("patient_id", patientId)
    .eq("category", "relatorio_evolucao")
    .order("uploaded_at", { ascending: false });

  return (data ?? []).map((d) => {
    const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    return {
      id: d.id,
      uploadedAt: new Date(d.uploaded_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
      uploadedByName: profile?.full_name ?? "—",
    };
  });
}
