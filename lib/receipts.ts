import crypto from "crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Geração e envio de recibos de pagamento (FASE 2 — Contratos pacote/avulsa +
 * recibos). Acionado sempre que uma fatura de contrato (`contract_invoices`)
 * ou uma cobrança avulsa (`patient_charges`) é marcada como paga — ver
 * `app/gestor/contratos/actions.ts::markInvoicePaid` e
 * `app/recepcao/pacientes/[id]/gestao/actions.ts::markChargePaid`.
 *
 * Tudo aqui é best-effort: a confirmação do pagamento já foi persistida
 * antes de chamar estas funções, então uma falha de PDF/WhatsApp nunca pode
 * "desfazer" ou travar o pagamento — só fica registrada em
 * `receipts.send_error` / no retorno de erro.
 *
 * Módulos internos (lib/twilio, lib/clinic-identity, lib/receipt-pdf,
 * lib/constants) são importados sob demanda via `await import(...)` dentro
 * de cada função, em vez de import estático no topo — mesmo padrão já usado
 * em lib/twilio.ts. Isso mantém `formatReceiptNumber` (a única função pura
 * daqui, coberta por tests/receipt-number.test.ts) importável pelo runner de
 * testes puro (`node --experimental-strip-types`, sem bundler/alias "@/*")
 * sem arrastar TSX nem os demais imports com alias no grafo do módulo.
 */

const RECEIPTS_STORAGE_BUCKET = "clinic-documents";
/** Validade do link assinado do PDF anexado ao WhatsApp — 7 dias é folga
 * suficiente para o Twilio buscar a mídia e para o responsável reabrir o
 * link manualmente, sem deixar o storage com links "eternos". */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

type AdminClient = ReturnType<typeof createAdminClient>;

/** "2026/0012" — número de recibo formatado (ano + sequencial de 4 dígitos, zero-padded). */
export function formatReceiptNumber(year: number, number: number): string {
  return `${year}/${String(number).padStart(4, "0")}`;
}

export type ReceiptSourceType = "contract_invoice" | "patient_charge";

export type CreateReceiptParams = {
  sourceType: ReceiptSourceType;
  sourceId: string;
  patientId: string;
  payerName: string;
  payerDocument?: string | null;
  description: string;
  amount: number;
  /** ISO datetime do pagamento. */
  paidAt: string;
  method?: string | null;
  createdBy?: string | null;
};

export type CreateReceiptResult =
  | { success: true; receiptId: string; created: boolean }
  | { success: false; error: string };

/**
 * Cria (ou retorna, se já existir) o recibo de uma fatura/cobrança já paga:
 * insere em `receipts` (o número sequencial é atribuído pelo trigger
 * `assign_receipt_number`), renderiza o PDF e anexa como `documents`
 * (categoria `recibo`, sempre compartilhado com a família), e grava a
 * auditoria. `unique(source_type, source_id)` garante que a mesma
 * fatura/cobrança nunca gera dois recibos — se o insert colidir (corrida
 * entre duas confirmações simultâneas), devolve o recibo já existente em vez
 * de propagar o erro.
 */
export async function createReceiptRecord(
  admin: AdminClient,
  params: CreateReceiptParams,
): Promise<CreateReceiptResult> {
  const existingBefore = await admin
    .from("receipts")
    .select("id")
    .eq("source_type", params.sourceType)
    .eq("source_id", params.sourceId)
    .maybeSingle();

  if (existingBefore.data) {
    return { success: true, receiptId: existingBefore.data.id, created: false };
  }

  const { data: patient } = await admin
    .from("patients")
    .select("full_name, clinic_id")
    .eq("id", params.patientId)
    .maybeSingle();

  if (!patient) {
    return { success: false, error: "Paciente não encontrado para gerar o recibo." };
  }

  const { data: inserted, error: insertError } = await admin
    .from("receipts")
    .insert({
      clinic_id: patient.clinic_id,
      patient_id: params.patientId,
      payer_name: params.payerName,
      payer_document: params.payerDocument ?? null,
      source_type: params.sourceType,
      source_id: params.sourceId,
      description: params.description,
      amount: params.amount,
      paid_at: params.paidAt,
      created_by: params.createdBy ?? null,
    })
    .select("id, number, year")
    .single();

  if (insertError || !inserted) {
    // Corrida com outra confirmação para a mesma fatura/cobrança — a
    // violação do unique(source_type, source_id) é esperada aqui, não um
    // bug: quem "perdeu" a corrida só reaproveita o recibo já criado.
    const { data: raced } = await admin
      .from("receipts")
      .select("id")
      .eq("source_type", params.sourceType)
      .eq("source_id", params.sourceId)
      .maybeSingle();
    if (raced) return { success: true, receiptId: raced.id, created: false };
    return { success: false, error: "Não foi possível registrar o recibo." };
  }

  try {
    const { getClinicIdentity } = await import("@/lib/clinic-identity");
    const { ReceiptDocument } = await import("@/lib/receipt-pdf");
    const { CLINIC_TIMEZONE } = await import("@/lib/constants");

    const clinic = await getClinicIdentity(admin, patient.clinic_id);
    const paidAtFormatted = new Date(params.paidAt).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE });

    const pdfBuffer = await renderToBuffer(
      ReceiptDocument({
        clinicName: clinic.nomeFantasia,
        clinicCnpj: clinic.cnpj,
        number: inserted.number,
        year: inserted.year,
        payerName: params.payerName,
        payerDocument: params.payerDocument ?? null,
        patientName: patient.full_name,
        description: params.description,
        amount: params.amount,
        paidAtFormatted,
        method: params.method ?? null,
      }),
    );

    const documentId = crypto.randomUUID();
    const receiptLabel = formatReceiptNumber(inserted.year, inserted.number).replace("/", "-");
    const storagePath = `${params.patientId}/${documentId}/recibo-${receiptLabel}.pdf`;

    if (params.createdBy) {
      const { error: docInsertError } = await admin.from("documents").insert({
        id: documentId,
        patient_id: params.patientId,
        category: "recibo",
        storage_path: storagePath,
        uploaded_by: params.createdBy,
        shared_with_family: true,
      });

      if (!docInsertError) {
        const { error: uploadError } = await admin.storage
          .from(RECEIPTS_STORAGE_BUCKET)
          .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });

        if (uploadError) {
          await admin.from("documents").delete().eq("id", documentId);
        } else {
          await admin.from("receipts").update({ document_id: documentId }).eq("id", inserted.id);
        }
      }
    }

    await admin.from("audit_log").insert({
      table_name: "receipts",
      row_id: inserted.id,
      action: "receipt_generated",
      actor_id: params.createdBy ?? null,
      clinic_id: patient.clinic_id,
      after: {
        source_type: params.sourceType,
        source_id: params.sourceId,
        number: inserted.number,
        year: inserted.year,
        amount: params.amount,
      },
    });
  } catch (err: unknown) {
    // PDF/upload falhou, mas o recibo (linha em `receipts`, com número já
    // atribuído) já existe — mesma postura defensiva de attachSignatureReceipt
    // em app/assinar/[documentId]/signature-actions.ts: não desfaz o que já
    // foi gravado, só registra o erro.
    console.error("[receipts] Falha ao gerar/anexar PDF do recibo:", err);
  }

  return { success: true, receiptId: inserted.id, created: true };
}

async function findFinancialGuardian(
  admin: AdminClient,
  patientId: string,
): Promise<{ fullName: string; phone: string | null; cpf: string | null } | null> {
  const { data: guardians } = await admin
    .from("guardians")
    .select("full_name, phone, cpf, is_financial")
    .eq("patient_id", patientId);

  if (!guardians || guardians.length === 0) return null;

  const financial = guardians.find((g) => g.is_financial);
  const withPhone = guardians.find((g) => g.phone);
  const chosen = financial ?? withPhone ?? guardians[0];

  return { fullName: chosen.full_name, phone: chosen.phone || null, cpf: chosen.cpf ?? null };
}

/**
 * Envia o recibo já gerado por WhatsApp ao responsável financeiro (ou, na
 * ausência de um marcado, o primeiro responsável com telefone cadastrado —
 * ver `guardians.is_financial`). Sempre tenta anexar o PDF via `mediaUrl`
 * (link assinado do Storage, que o Twilio consegue buscar por HTTPS — não
 * há suporte a Content API/template aprovado para recibo, então isto roda
 * como mensagem livre dentro da janela de serviço, igual aos demais bots).
 * Nunca lança: falha de envio só fica registrada em `receipts.send_error`.
 */
export async function sendReceiptWhatsApp(admin: AdminClient, receiptId: string): Promise<void> {
  try {
    const { data: receipt } = await admin
      .from("receipts")
      .select("id, patient_id, clinic_id, description, amount, document_id, number, year")
      .eq("id", receiptId)
      .maybeSingle();

    if (!receipt) return;

    const guardian = await findFinancialGuardian(admin, receipt.patient_id);
    if (!guardian?.phone) {
      await admin
        .from("receipts")
        .update({ send_error: "Nenhum responsável financeiro com telefone cadastrado." })
        .eq("id", receiptId);
      return;
    }

    let mediaUrl: string[] | undefined;
    if (receipt.document_id) {
      const { data: doc } = await admin
        .from("documents")
        .select("storage_path")
        .eq("id", receipt.document_id)
        .maybeSingle();

      if (doc?.storage_path) {
        const { data: signed } = await admin.storage
          .from(RECEIPTS_STORAGE_BUCKET)
          .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
        if (signed?.signedUrl) mediaUrl = [signed.signedUrl];
      }
    }

    const receiptLabel = formatReceiptNumber(receipt.year, receipt.number);
    const valorFormatado = Number(receipt.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const message =
      `Olá! 💙 Segue o recibo nº ${receiptLabel} do pagamento de ${receipt.description}, no valor de ${valorFormatado}.\n\n` +
      "Guarde este comprovante para eventual reembolso junto ao seu plano de saúde. ✨" +
      (mediaUrl ? "" : "\n\n(Se o PDF não abrir automaticamente, fale com a recepção que reenviamos o link.)");

    const { sendTwilioWhatsApp, formatE164Phone } = await import("@/lib/twilio");
    const result = await sendTwilioWhatsApp({
      to: formatE164Phone(guardian.phone),
      message,
      mediaUrl,
    });

    if (result.success) {
      await admin
        .from("receipts")
        .update({ sent_whatsapp_at: new Date().toISOString(), send_error: null })
        .eq("id", receiptId);
    } else {
      await admin.from("receipts").update({ send_error: result.error ?? "Falha no envio." }).eq("id", receiptId);
    }

    await admin.from("audit_log").insert({
      table_name: "receipts",
      row_id: receiptId,
      action: "receipt_sent",
      clinic_id: receipt.clinic_id,
      after: { success: result.success, error: result.success ? null : result.error ?? null },
    });
  } catch (err: unknown) {
    console.error("[receipts] Falha ao enviar recibo por WhatsApp:", err);
    try {
      await admin
        .from("receipts")
        .update({ send_error: err instanceof Error ? err.message : "Erro desconhecido ao enviar." })
        .eq("id", receiptId);
    } catch {
      // Melhor esforço — se nem isto funcionar, apenas segue sem travar o chamador.
    }
  }
}

export type ReceiptGenerationResult =
  | { success: true; receiptId: string }
  | { success: false; error: string };

/**
 * Gera (e envia) o recibo de uma fatura de contrato paga. `createdBy` é o
 * `profiles.id` de quem confirmou o pagamento — sem ele o PDF não é anexado
 * a `documents` (uploaded_by é obrigatório), mas o recibo em si ainda é
 * numerado e registrado.
 */
export async function generateReceiptForInvoice(
  admin: AdminClient,
  invoiceId: string,
  createdBy: string | null,
): Promise<ReceiptGenerationResult> {
  const { data: invoice } = await admin
    .from("contract_invoices")
    .select("id, contract_id, amount, description, paid_at, paid_method, paid_by_name")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return { success: false, error: "Fatura não encontrada." };

  const { data: contract } = await admin
    .from("patient_contracts")
    .select("patient_id")
    .eq("id", invoice.contract_id)
    .maybeSingle();

  if (!contract) return { success: false, error: "Contrato não encontrado." };

  const { data: patient } = await admin
    .from("patients")
    .select("full_name")
    .eq("id", contract.patient_id)
    .maybeSingle();

  const guardian = await findFinancialGuardian(admin, contract.patient_id);
  const payerName = invoice.paid_by_name || guardian?.fullName || patient?.full_name || "Responsável";

  const result = await createReceiptRecord(admin, {
    sourceType: "contract_invoice",
    sourceId: invoice.id,
    patientId: contract.patient_id,
    payerName,
    payerDocument: guardian?.cpf ?? null,
    description: invoice.description || "Mensalidade — contrato particular",
    amount: Number(invoice.amount),
    paidAt: invoice.paid_at || new Date().toISOString(),
    method: invoice.paid_method ?? null,
    createdBy,
  });

  if (!result.success) return result;

  await sendReceiptWhatsApp(admin, result.receiptId);
  return { success: true, receiptId: result.receiptId };
}

/**
 * Gera (e envia) o recibo de uma cobrança avulsa paga.
 */
export async function generateReceiptForCharge(
  admin: AdminClient,
  chargeId: string,
  createdBy: string | null,
): Promise<ReceiptGenerationResult> {
  const { data: charge } = await admin
    .from("patient_charges")
    .select("id, patient_id, amount, description, paid_at, paid_method")
    .eq("id", chargeId)
    .maybeSingle();

  if (!charge) return { success: false, error: "Cobrança não encontrada." };

  const { data: patient } = await admin
    .from("patients")
    .select("full_name")
    .eq("id", charge.patient_id)
    .maybeSingle();

  const guardian = await findFinancialGuardian(admin, charge.patient_id);
  const payerName = guardian?.fullName || patient?.full_name || "Responsável";

  const result = await createReceiptRecord(admin, {
    sourceType: "patient_charge",
    sourceId: charge.id,
    patientId: charge.patient_id,
    payerName,
    payerDocument: guardian?.cpf ?? null,
    description: charge.description,
    amount: Number(charge.amount),
    paidAt: charge.paid_at || new Date().toISOString(),
    method: charge.paid_method ?? null,
    createdBy,
  });

  if (!result.success) return result;

  await sendReceiptWhatsApp(admin, result.receiptId);
  return { success: true, receiptId: result.receiptId };
}
