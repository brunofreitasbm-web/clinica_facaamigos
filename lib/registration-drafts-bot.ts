// lib/registration-drafts-bot.ts
//
// Faz todo lead do WhatsApp que deu algum dado ao bot de agendamento (ou mandou
// documento pelo bot) aparecer na fila de Pendências da recepção
// (`registration_drafts`, categoria cadastro_assistido_ia) — com o que ele
// digitou em `bot_collected` e os arquivos como `registration_draft_files`
// apontando para `documents` (sem duplicar bytes).
//
// Existe UM rascunho aberto por telefone (índice único parcial
// registration_drafts_one_open_whatsapp, migration 20260921060000): o bot e o
// caminho de mídia solta (lib/registration-drafts-ingest.ts) o reaproveitam,
// sem a janela de 2h que a mídia solta usava. Nada aqui lança: falha de
// espelhamento nunca pode derrubar a resposta do bot.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { isBotDatumPresent, mergeBotCollectedIntoExtraction, pickBotCollected } from "@/lib/lead-pendencies";

// `bot_collected` e as colunas novas de `documents` ainda não estão em
// lib/database.types.ts (defasado) — mesmo contorno de lib/whatsapp-lead.ts.
type LooseClient = SupabaseClient;
const loose = (admin: ReturnType<typeof createAdminClient>): LooseClient => admin as unknown as LooseClient;

/** Estados em que o rascunho do WhatsApp ainda é "o" rascunho aberto do telefone (mesmo predicado do índice único). */
const OPEN_STATUSES = ["pending", "processing", "extracted", "failed"];

type OpenDraft = { id: string; created: boolean };

/**
 * Devolve o rascunho aberto do WhatsApp deste telefone ou cria um. Corrida com
 * outra entrega (bot x mídia solta) cai no índice único (23505) e relê o
 * vencedor — mesmo padrão de upsertWhatsappLead.
 */
export async function findOrCreateOpenWhatsappDraft(
  admin: ReturnType<typeof createAdminClient>,
  phone: string,
  init: { patientId?: string | null; guardianId?: string | null; status: "pending" | "extracted" },
): Promise<OpenDraft | null> {
  const db = loose(admin);
  const find = async () => {
    const { data } = await db
      .from("registration_drafts")
      .select("id")
      .eq("source", "whatsapp")
      .eq("source_phone", phone)
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };

  const existing = await find();
  if (existing) return { id: existing, created: false };

  const { data: created, error } = await db
    .from("registration_drafts")
    .insert({
      clinic_id: DEV_CLINIC_ID,
      patient_id: init.patientId ?? null,
      guardian_id: init.guardianId ?? null,
      source: "whatsapp",
      source_phone: phone,
      status: init.status,
    })
    .select("id")
    .single();

  if (created) return { id: (created as { id: string }).id, created: true };

  if (error?.code === "23505") {
    const winner = await find();
    if (winner) return { id: winner, created: false };
  }
  console.error("[Bot Draft] Falha ao criar rascunho:", error?.message);
  return null;
}

/**
 * Espelha `chatbot_sessions.collected_data` no rascunho do telefone — chamado a
 * cada passo do bot que guarda dado. Só age quando há algum dado (dizer
 * "agendar" e sumir não gera pendência). O que o responsável digitou vira
 * `bot_collected` (acumulando: "não tenho laudo" sobrevive ao reset da sessão)
 * e é mesclado em `extracted`, com a resposta digitada vencendo a leitura da IA.
 */
export async function syncBotDraft(params: {
  phone: string;
  data: Record<string, unknown>;
  step: string;
}): Promise<void> {
  try {
    if (!isBotDatumPresent(params.data)) return;

    const admin = createAdminClient();
    const db = loose(admin);
    const picked = pickBotCollected(params.data, params.step);
    const leadPatientId = typeof picked.lead_patient_id === "string" ? picked.lead_patient_id : null;

    const draft = await findOrCreateOpenWhatsappDraft(admin, params.phone, { patientId: leadPatientId, status: "extracted" });
    if (!draft) return;

    const { data: row } = await db
      .from("registration_drafts")
      .select("id, extracted, bot_collected, patient_id, authorization_waived")
      .eq("id", draft.id)
      .maybeSingle();
    const current = row as {
      extracted: unknown;
      bot_collected: Record<string, unknown> | null;
      patient_id: string | null;
      authorization_waived: boolean;
    } | null;
    if (!current) return;

    const bot: Record<string, unknown> = { ...(current.bot_collected ?? {}), ...picked, updated_at: new Date().toISOString() };
    const update: Record<string, unknown> = {
      bot_collected: bot,
      extracted: mergeBotCollectedIntoExtraction(current.extracted, bot),
    };
    // Particular = convênio sem guia: a etapa 2 (autorização do plano) já nasce dispensada.
    if (bot.is_private === true && !current.authorization_waived) update.authorization_waived = true;
    if (leadPatientId && !current.patient_id) update.patient_id = leadPatientId;

    const { error } = await db.from("registration_drafts").update(update).eq("id", draft.id);
    if (error) console.error("[Bot Draft] Falha ao atualizar rascunho:", error.message);
  } catch (err) {
    console.error("[Bot Draft] Exceção em syncBotDraft:", err);
  }
}

/**
 * Registra no rascunho os documentos que o bot acabou de guardar em
 * `documents` (laudo, guia, carteirinha) — sem copiar o arquivo: a linha
 * aponta para o documento (`document_id`) e leva a categoria já conhecida
 * como `detected_type`, então o cartão da fila mostra os anexos e a pílula
 * acende sem esperar leitura por IA. Reentrega do mesmo documento não duplica.
 */
export async function registerBotDraftFiles(params: { phone: string; documentIds: string[] }): Promise<void> {
  try {
    const ids = [...new Set(params.documentIds)];
    if (ids.length === 0) return;

    const admin = createAdminClient();
    const db = loose(admin);

    const draft = await findOrCreateOpenWhatsappDraft(admin, params.phone, { status: "extracted" });
    if (!draft) return;

    const { data: docs } = await db
      .from("documents")
      .select("id, storage_path, mime_type, original_name, category")
      .in("id", ids);
    const { data: known } = await db.from("registration_draft_files").select("document_id").eq("draft_id", draft.id).in("document_id", ids);
    const already = new Set(((known ?? []) as { document_id: string }[]).map((k) => k.document_id));

    const rows = ((docs ?? []) as {
      id: string;
      storage_path: string;
      mime_type: string | null;
      original_name: string | null;
      category: string | null;
    }[])
      .filter((d) => !already.has(d.id))
      .map((d) => ({
        draft_id: draft.id,
        document_id: d.id,
        storage_path: d.storage_path,
        mime_type: d.mime_type ?? "application/octet-stream",
        original_name: d.original_name,
        detected_type: d.category,
      }));
    if (rows.length === 0) return;

    const { error } = await db.from("registration_draft_files").insert(rows);
    if (error) console.error("[Bot Draft] Falha ao registrar arquivos do bot:", error.message);
  } catch (err) {
    console.error("[Bot Draft] Exceção em registerBotDraftFiles:", err);
  }
}
