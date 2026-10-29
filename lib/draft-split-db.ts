// lib/draft-split-db.ts
//
// Grava a divisão calculada em lib/draft-split.ts: um rascunho novo por irmão,
// com seus arquivos, e cada um promovido a paciente-lead próprio. Chamado pela
// extração (lib/registration-drafts-process.ts) logo depois de gravar o extraído.
import { createAdminClient } from "@/lib/supabase/admin";
import { promoteDraftToLead } from "@/lib/whatsapp-lead";
import { planSiblings, siblingsToCreate, stripSiblings, type SplitFile } from "@/lib/draft-split";
import type { Json } from "@/lib/database.types";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Se o extraído do rascunho traz irmãos, cria um rascunho por irmão e devolve os
 * ids novos. Idempotente: reprocessar o mesmo contato não duplica quem já existe
 * (compara pelo nome com os rascunhos vivos do mesmo telefone). Falha aqui não
 * derruba a extração — o rascunho segue na fila e a recepção ainda pode usar
 * "Ajustar cadastro → Separar irmão".
 */
export async function splitSiblingsFromDraft(
  admin: Admin,
  draft: { id: string; clinic_id: string; extracted: unknown },
  filesInAiOrder: SplitFile[],
): Promise<string[]> {
  try {
    const { data: row } = await admin
      .from("registration_drafts")
      .select("source, source_phone, guardian_message")
      .eq("id", draft.id)
      .maybeSingle();
    if (!row) return [];

    const ext = (draft.extracted ?? {}) as { patient?: { full_name?: string | null } };
    const known: (string | null | undefined)[] = [ext.patient?.full_name];
    if (row.source_phone) {
      const { data: alive } = await admin
        .from("registration_drafts")
        .select("extracted, patient_id")
        .eq("source_phone", row.source_phone)
        .neq("id", draft.id)
        .neq("status", "rejected");
      for (const d of alive ?? []) {
        known.push((d.extracted as { patient?: { full_name?: string | null } } | null)?.patient?.full_name);
      }
    }

    const siblings = siblingsToCreate(draft.extracted, known);
    if (siblings.length === 0) return [];

    const plans = planSiblings(draft.extracted, siblings, filesInAiOrder);
    const createdIds: string[] = [];

    for (const plan of plans) {
      const { data: created, error } = await admin
        .from("registration_drafts")
        .insert({
          clinic_id: draft.clinic_id,
          source: row.source,
          source_phone: row.source_phone,
          guardian_message: row.guardian_message,
          status: "extracted",
          extracted: plan.extracted as Json,
          processed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !created) {
        console.error("[Draft Split] Falha ao criar rascunho do irmão:", error?.message);
        continue;
      }
      createdIds.push(created.id);

      if (plan.moveFileIds.length > 0) {
        await admin.from("registration_draft_files").update({ draft_id: created.id }).in("id", plan.moveFileIds);
      }
      if (plan.copyFileIds.length > 0) {
        const { data: originals } = await admin
          .from("registration_draft_files")
          .select("storage_path, mime_type, size_bytes, original_name, detected_type")
          .in("id", plan.copyFileIds);
        if (originals && originals.length > 0) {
          await admin.from("registration_draft_files").insert(originals.map((f) => ({ ...f, draft_id: created.id })));
        }
      }
    }

    if (createdIds.length > 0) {
      await admin
        .from("registration_drafts")
        .update({ extracted: stripSiblings(draft.extracted, createdIds.length) as Json })
        .eq("id", draft.id);
      await admin.from("audit_log").insert({
        table_name: "registration_drafts",
        row_id: draft.id,
        action: "draft_split_siblings",
        clinic_id: draft.clinic_id,
        after: { siblingDraftIds: createdIds },
      });
      for (const id of createdIds) {
        try {
          await promoteDraftToLead(id);
        } catch (err) {
          console.error("[Draft Split] Falha ao promover irmão a lead:", err);
        }
      }
    }
    return createdIds;
  } catch (err) {
    console.error("[Draft Split] Exceção ao separar irmãos:", err);
    return [];
  }
}
