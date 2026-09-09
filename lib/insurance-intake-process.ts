// lib/insurance-intake-process.ts
// Executa a extração de verdade (chamada ao Gemini) sobre um lote de
// "acolhimento oriundo de plano de saúde": baixa o PDF do Storage, chama
// extractIntakeRowsFromPdf, normaliza cada linha e cria um
// insurance_intake_lead por beneficiário encontrado. Reivindicação atômica
// via a função SQL `claim_insurance_intake_batches` (migration
// 20260907170006) evita que duas execuções do cron processem o mesmo lote
// ao mesmo tempo. Mesmo desenho de lib/registration-drafts-process.ts.
import { createAdminClient } from "@/lib/supabase/admin";
import { extractIntakeRowsFromPdf, normalizeIntakeRow, type IntakeExtraction, type IntakeRow } from "@/lib/insurance-intake-extraction";
import { parseIntakeProfile } from "@/lib/insurance-intake-profile";
import { formatE164Phone } from "@/lib/twilio";

const DOCUMENTS_BUCKET = "clinic-documents";

export type ProcessBatchOutcome = { batchId: string; status: "extracted" | "failed"; error?: string; leadsCount?: number };

async function findDuplicatePatient(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string,
  row: { patient_cpf: string | null; phone_e164: string | null; patient_full_name: string | null; patient_birth_date: string | null },
): Promise<{ id: string; reason: string } | null> {
  if (row.patient_cpf) {
    const { data } = await admin.from("patients").select("id").eq("clinic_id", clinicId).eq("cpf", row.patient_cpf).maybeSingle();
    if (data) return { id: data.id, reason: "cpf" };
  }

  if (row.phone_e164) {
    const last8 = row.phone_e164.replace(/\D/g, "").slice(-8);
    if (last8.length === 8) {
      const { data: guardians } = await admin
        .from("guardians")
        .select("patient_id, phone, patients!inner(clinic_id)")
        .ilike("phone", `%${last8}`)
        .eq("patients.clinic_id", clinicId);
      const match = (guardians ?? []).find((g) => formatE164Phone(g.phone) === row.phone_e164);
      if (match) return { id: match.patient_id, reason: "phone" };
    }
  }

  if (row.patient_full_name && row.patient_birth_date) {
    const { data } = await admin
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("birth_date", row.patient_birth_date)
      .ilike("full_name", row.patient_full_name)
      .maybeSingle();
    if (data) return { id: data.id, reason: "name_birth" };
  }

  return null;
}

async function downloadFileAsBase64(
  admin: ReturnType<typeof createAdminClient>,
  storagePath: string,
): Promise<{ base64: string } | null> {
  const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(storagePath);
  if (error || !data) {
    console.error(`[Insurance Intake] Falha ao baixar ${storagePath}:`, error?.message);
    return null;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  return { base64: buffer.toString("base64") };
}

/**
 * Passo comum a qualquer origem de extração (Gemini/regex nativo sobre o PDF,
 * ou linhas já estruturadas vindas de `ingestPreExtractedIntakeBatch`):
 * normaliza cada linha, detecta duplicidade de paciente e grava os leads.
 * Extraído de `runExtractionForBatch` para ser reaproveitado sem duplicar a
 * lógica de normalização/duplicidade/gravação.
 */
async function persistIntakeExtractionResult(
  admin: ReturnType<typeof createAdminClient>,
  batch: { id: string; clinic_id: string; insurer_id: string | null },
  outcome: { result: IntakeExtraction; model: string },
): Promise<ProcessBatchOutcome> {
  const { data: insurers } = await admin.from("insurers").select("id, name, intake_extraction_profile").eq("clinic_id", batch.clinic_id);
  const allInsurers = (insurers ?? []) as { id: string; name: string; intake_extraction_profile: unknown }[];

  const chosenInsurer = batch.insurer_id ? allInsurers.find((i) => i.id === batch.insurer_id) ?? null : null;
  const profile = chosenInsurer ? parseIntakeProfile(chosenInsurer.intake_extraction_profile) : undefined;

  const warnings = [...outcome.result.warnings];
  if (outcome.result.truncated) {
    warnings.push("A extração pode não ter processado todas as linhas do PDF (documento muito longo) — confira manualmente se algum paciente ficou de fora.");
  }
  if (outcome.result.rows.length === 0) {
    warnings.push("Nenhum beneficiário foi identificado no PDF — confira se o arquivo está legível.");
  }

  // Convênio detectado (se o supervisor não escolheu um na hora do upload):
  // tenta casar o nome detectado com os já cadastrados via matchInsurer,
  // mesmo critério usado por linha (mais barato que rodar de novo aqui —
  // reaproveita o resultado já calculado por linha abaixo).
  const rowsNormalized = outcome.result.rows.map((row: IntakeRow) => normalizeIntakeRow(row, allInsurers, profile));
  const detectedInsurerId = batch.insurer_id ?? rowsNormalized.find((r) => r.insurer_id)?.insurer_id ?? null;

  // Substitui só os leads ainda não confirmados (extracted/failed) — nunca
  // apaga leads já aprovados/em fluxo de um reprocessamento anterior.
  await admin.from("insurance_intake_leads").delete().eq("batch_id", batch.id).in("status", ["extracted", "failed"]);

  const leadsToInsert = await Promise.all(
    rowsNormalized.map(async (row, index) => {
      const duplicate = await findDuplicatePatient(admin, batch.clinic_id, {
        patient_cpf: row.patient_cpf,
        phone_e164: row.phone_e164,
        patient_full_name: row.patient_full_name,
        patient_birth_date: row.patient_birth_date,
      });

      return {
        clinic_id: batch.clinic_id,
        batch_id: batch.id,
        insurer_id: detectedInsurerId,
        row_index: index,
        patient_full_name: row.patient_full_name,
        patient_birth_date: row.patient_birth_date,
        patient_cpf: row.patient_cpf,
        patient_sexo: row.patient_sexo,
        patient_cid: row.patient_cid,
        guardian_full_name: row.guardian_full_name,
        guardian_cpf: row.guardian_cpf,
        guardian_relationship: row.guardian_relationship,
        guardian_email: row.guardian_email,
        guardian_phone_raw: row.guardian_phones.join(", ") || null,
        phone_e164: row.phone_e164,
        card_number: row.card_number,
        plan_name: row.plan_name,
        card_valid_until: row.card_valid_until,
        guide_number: row.guide_number,
        procedure_code: row.procedure_code,
        sessions_authorized: row.sessions_authorized,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        authorization_password: row.authorization_password,
        extra: row.extra,
        confidence: row.confidence,
        warnings: row.warnings,
        duplicate_patient_id: duplicate?.id ?? null,
        duplicate_reason: duplicate?.reason ?? null,
        status: "extracted" as const,
      };
    }),
  );

  if (leadsToInsert.length > 0) {
    await admin.from("insurance_intake_leads").insert(leadsToInsert);
  }

  await admin
    .from("insurance_intake_batches")
    .update({
      status: "extracted",
      insurer_id: batch.insurer_id ?? detectedInsurerId,
      detected_insurer_name: outcome.result.detected_insurer_name,
      extracted: outcome.result,
      warnings,
      model: outcome.model,
      error: null,
      leads_count: leadsToInsert.length,
      processed_at: new Date().toISOString(),
    })
    .eq("id", batch.id);

  await admin.from("audit_log").insert({
    table_name: "insurance_intake_batches",
    row_id: batch.id,
    action: "intake_batch_extracted",
    clinic_id: batch.clinic_id,
    after: { warnings: warnings.length, leads: leadsToInsert.length, truncated: outcome.result.truncated, model: outcome.model },
  });

  return { batchId: batch.id, status: "extracted", leadsCount: leadsToInsert.length };
}

async function runExtractionForBatch(
  admin: ReturnType<typeof createAdminClient>,
  batch: { id: string; clinic_id: string; insurer_id: string | null; storage_path: string; mime_type: string },
): Promise<ProcessBatchOutcome> {
  const downloaded = await downloadFileAsBase64(admin, batch.storage_path);
  if (!downloaded) {
    const error = "Não foi possível baixar o PDF do lote.";
    await admin.from("insurance_intake_batches").update({ status: "failed", error }).eq("id", batch.id);
    return { batchId: batch.id, status: "failed", error };
  }

  const { data: insurers } = await admin.from("insurers").select("id, name, intake_extraction_profile").eq("clinic_id", batch.clinic_id);
  const allInsurers = (insurers ?? []) as { id: string; name: string; intake_extraction_profile: unknown }[];

  const chosenInsurer = batch.insurer_id ? allInsurers.find((i) => i.id === batch.insurer_id) ?? null : null;
  const profile = chosenInsurer ? parseIntakeProfile(chosenInsurer.intake_extraction_profile) : undefined;

  const outcome = await extractIntakeRowsFromPdf(
    { base64: downloaded.base64, mimeType: batch.mime_type },
    allInsurers.map((i) => i.name),
    { profile },
  );

  if (!outcome.success) {
    await admin.from("insurance_intake_batches").update({ status: "failed", error: outcome.error }).eq("id", batch.id);
    return { batchId: batch.id, status: "failed", error: outcome.error };
  }

  return persistIntakeExtractionResult(admin, batch, outcome);
}

/**
 * Caminho complementar ao de cima: quando um lote já chega com linhas
 * estruturadas (ex.: JSON gerado offline por `scripts/extract_convenio_patients.py`
 * a partir de tabelas de PDF que o parser em produção — Gemini/regex nativo —
 * não precisa refazer), pula a extração e vai direto para a persistência
 * comum (normalização, duplicidade, gravação dos leads).
 */
export async function ingestPreExtractedIntakeBatch(
  batch: { id: string; clinic_id: string; insurer_id: string | null },
  extraction: IntakeExtraction,
  model: string,
): Promise<ProcessBatchOutcome> {
  const admin = createAdminClient();
  return persistIntakeExtractionResult(admin, batch, { result: extraction, model });
}

/**
 * Reivindica (via `claim_insurance_intake_batches`) e processa até `limit`
 * lotes elegíveis, ou um `batchId` específico (reprocessamento manual —
 * ignora tentativas/janela do cron).
 */
export async function claimAndProcessIntakeBatches(opts: { limit?: number; batchId?: string } = {}): Promise<ProcessBatchOutcome[]> {
  const admin = createAdminClient();

  const { data: claimed, error } = await admin.rpc("claim_insurance_intake_batches", {
    p_limit: opts.batchId ? 1 : (opts.limit ?? 2),
    p_batch_id: opts.batchId,
  });

  if (error) {
    console.error("[Insurance Intake] Falha ao reivindicar lotes:", error.message);
    return [];
  }
  if (!claimed || claimed.length === 0) return [];

  const results: ProcessBatchOutcome[] = [];
  for (const batch of claimed) {
    results.push(
      await runExtractionForBatch(admin, {
        id: batch.id,
        clinic_id: batch.clinic_id,
        insurer_id: batch.insurer_id,
        storage_path: batch.storage_path,
        mime_type: batch.mime_type,
      }),
    );
  }
  return results;
}

/**
 * Leads que já receberam algum arquivo do responsável mas ficaram parados
 * (nenhum arquivo novo há 30min, sem o responsável ter respondido "PRONTO")
 * — avança pra fila do supervisor de qualquer forma, em vez de deixar o
 * lead esperando indefinidamente por um "PRONTO" que talvez nunca venha.
 */
export async function sweepIntakeLeadsAwaitingDocuments(): Promise<number> {
  const admin = createAdminClient();
  const cutoffIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: stalled } = await admin
    .from("insurance_intake_leads")
    .select("id, phone_e164, insurance_intake_lead_files(count)")
    .eq("status", "awaiting_documents")
    .lt("last_file_at", cutoffIso)
    .not("last_file_at", "is", null);

  const eligible = (stalled ?? []).filter((l) => {
    const count = Array.isArray(l.insurance_intake_lead_files) ? (l.insurance_intake_lead_files[0] as { count: number } | undefined)?.count ?? 0 : 0;
    return count > 0;
  });

  for (const lead of eligible) {
    await admin
      .from("insurance_intake_leads")
      .update({ status: "pending_supervisor", updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (lead.phone_e164) {
      const { sendTwilioWhatsApp } = await import("@/lib/twilio");
      await sendTwilioWhatsApp({
        to: lead.phone_e164,
        message: "Recebemos os documentos enviados até agora e já colocamos na fila de conferência da nossa equipe. Se quiser enviar mais algum, pode mandar por aqui a qualquer momento. 🙏",
      }).catch(() => null);
    }
  }

  return eligible.length;
}
