"use server";

import { randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { DOCUMENT_CATEGORY_LABEL } from "@/lib/document-categories";
import { sendTwilioWhatsApp } from "@/lib/twilio";
import { FamilyShareDocument } from "@/lib/family-share-pdf";
import { getClinicIdentity } from "@/lib/clinic-identity";

/** Registra no LGPD access log (record_access_log) que este prontuário unificado foi aberto para o paciente — mesma trilha que alimenta /gestor/auditoria. */
export async function logProntuarioAccess(patientId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("log_patient_access", { p_patient_id: patientId, p_reason: "prontuario" });
}

const MEETING_KIND_LABEL: Record<string, string> = {
  interdisciplinar: "Reunião técnica multidisciplinar",
  devolutiva: "Devolutiva à família",
  revisao_pts: "Revisão do PTS",
  visita_escolar: "Visita escolar",
};

export type FamilyShareSelection = {
  documentIds: string[];
  goalIds: string[];
  meetingIds: string[];
};

type GenerateResult = { success: true; documentId: string; whatsappWarning?: string } | { success: false; error: string };

/**
 * Gera o PDF de compartilhamento com a família (botão "Compartilhar com a
 * família" no Prontuário Unificado) a partir dos itens selecionados pela
 * Supervisão — nunca `session_notes`/`protocol_assessments` (§9.4-A, mesma
 * salvaguarda de generateInsurerReport). Salva como `documents`
 * (category='compartilhamento_familia', shared_with_family=true), que já é
 * o mecanismo existente pra aparecer em "Documentos liberados" no portal da
 * família (app/familia/page.tsx). Depois avisa por WhatsApp — best-effort,
 * não desfaz o compartilhamento se o envio falhar.
 */
export async function generateFamilyShare(patientId: string, selection: FamilyShareSelection): Promise<GenerateResult> {
  if (selection.documentIds.length === 0 && selection.goalIds.length === 0 && selection.meetingIds.length === 0) {
    return { success: false, error: "Selecione ao menos um item para compartilhar com a família." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (profile?.role && profile.role !== "supervisor" && profile.role !== "gestor") {
    return {
      success: false,
      error: "Apenas usuários com perfil de Supervisão têm permissão para compartilhar o prontuário com a família.",
    };
  }

  const { data: patient } = await supabase.from("patients").select("id, full_name, clinic_id").eq("id", patientId).maybeSingle();
  if (!patient) return { success: false, error: "Paciente não encontrado." };

  const clinic = await getClinicIdentity(supabase, patient.clinic_id);

  const [documentsRes, goalsRes, meetingsRes] = await Promise.all([
    selection.documentIds.length > 0
      ? supabase
          .from("documents")
          .select("id, category, uploaded_at, note")
          .eq("patient_id", patientId)
          .in("id", selection.documentIds)
      : Promise.resolve({ data: [] as { id: string; category: string; uploaded_at: string; note: string | null }[] }),
    selection.goalIds.length > 0
      ? supabase
          .from("plan_goals")
          .select("id, description, domain, status, treatment_plans!inner(patient_id)")
          .eq("treatment_plans.patient_id", patientId)
          .in("id", selection.goalIds)
          .in("status", ["ativa", "atingida"])
      : Promise.resolve({ data: [] as { id: string; description: string; domain: string; status: string }[] }),
    selection.meetingIds.length > 0
      ? supabase
          .from("meetings")
          .select("id, kind, held_at, decisions")
          .eq("patient_id", patientId)
          .in("id", selection.meetingIds)
      : Promise.resolve({ data: [] as { id: string; kind: string; held_at: string; decisions: string | null }[] }),
  ]);

  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE, dateStyle: "short", timeStyle: "short" });

  let pdfBuffer: Buffer;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_EXCEEDED")), 25000));

    const pdfRenderPromise = renderToBuffer(
      FamilyShareDocument({
        clinic,
        patientName: patient.full_name,
        generatedByName: profile?.full_name ?? "—",
        generatedAt: new Date().toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
        documents: (documentsRes.data ?? []).map((d) => ({
          category: d.category,
          categoryLabel: DOCUMENT_CATEGORY_LABEL[d.category] ?? d.category,
          uploadedAt: fmtDateTime(d.uploaded_at),
          note: d.note,
        })),
        goals: (goalsRes.data ?? []).map((g) => ({ description: g.description, domain: g.domain, status: g.status })),
        meetings: (meetingsRes.data ?? []).map((m) => ({
          kindLabel: MEETING_KIND_LABEL[m.kind] ?? m.kind,
          heldAt: fmtDateTime(m.held_at),
          decisions: m.decisions,
        })),
      })
    );

    pdfBuffer = await Promise.race([pdfRenderPromise, timeoutPromise]);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "";
    if (errorMsg === "TIMEOUT_EXCEEDED") {
      return { success: false, error: "O servidor está demorando mais que o esperado para gerar o PDF. Tente de novo com menos itens." };
    }
    return { success: false, error: "Não foi possível gerar o PDF. Tente de novo." };
  }

  const documentId = randomUUID();
  const storagePath = `${patientId}/${documentId}/compartilhamento-familia-${new Date().toISOString().slice(0, 10)}.pdf`;

  const { error: insertError } = await supabase.from("documents").insert({
    id: documentId,
    patient_id: patientId,
    category: "compartilhamento_familia",
    storage_path: storagePath,
    uploaded_by: user.id,
    shared_with_family: true,
  });

  if (insertError) {
    return { success: false, error: "Você não tem permissão para compartilhar documentos com a família deste paciente." };
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

  revalidatePath("/supervisao/prontuario-unificado");
  revalidatePath("/familia");

  let whatsappWarning: string | undefined;
  try {
    const { data: guardian } = await admin
      .from("guardians")
      .select("phone")
      .eq("patient_id", patientId)
      .order("is_financial", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (guardian?.phone) {
      const result = await sendTwilioWhatsApp({
        to: guardian.phone,
        message: `Olá! Um novo documento sobre o acompanhamento de ${patient.full_name} foi compartilhado no portal da família. Acesse o portal para visualizar. 💙`,
      });
      if (!result.success) whatsappWarning = "O PDF foi compartilhado no portal, mas não foi possível enviar o aviso por WhatsApp.";
    } else {
      whatsappWarning = "O PDF foi compartilhado no portal, mas nenhum telefone de responsável foi encontrado para avisar por WhatsApp.";
    }
  } catch {
    whatsappWarning = "O PDF foi compartilhado no portal, mas não foi possível enviar o aviso por WhatsApp.";
  }

  return { success: true, documentId, whatsappWarning };
}

/** Mesma compensação de relatorio-convenio/actions.ts — linha órfã se o upload falhar depois do insert. */
async function rollbackInsertedDocument(documentId: string) {
  try {
    const admin = createAdminClient();
    await admin.from("documents").delete().eq("id", documentId);
  } catch {
    // Sem admin client não há como reverter; erro principal já é retornado.
  }
}
