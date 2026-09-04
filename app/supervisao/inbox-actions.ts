"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * `messages` (PRD §7) não tem uma coluna "resolvido" própria — só
 * `read_at`. Para o "chamado" da família (mensagem `inbound`), tratamos
 * `read_at` preenchido como "a coordenação já tratou isso": ou respondeu
 * (ver `sendReply` abaixo, que marca a original como lida ao responder), ou
 * marcou como resolvido sem precisar responder por escrito (ex.: resolveu
 * por telefone). Essa reinterpretação de `read_at` — pensada originalmente
 * pra "a família leu a mensagem enviada" — é a simplificação deliberada
 * desta tela.
 */
export async function resolveMessage(messageId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("direction", "inbound");

  if (error) return { success: false, error: "Não foi possível marcar como resolvido." };

  revalidatePath("/supervisao");
  return { success: true };
}

/**
 * Responde um chamado do portal: insere uma nova linha `outbound` em
 * `messages` (mesmo paciente/responsável do chamado original) e marca o
 * chamado original como resolvido (`read_at`). Não há WhatsApp/e-mail de
 * fato integrado (PRD §9.10 é Fase 1) — a mensagem fica só registrada no
 * banco, visível no portal da família na próxima carga.
 */
export async function sendReply(
  originalMessageId: string,
  patientId: string,
  guardianId: string | null,
  body: string,
): Promise<ActionResult> {
  const text = body.trim();
  if (!text) return { success: false, error: "Escreva uma resposta antes de enviar." };

  const supabase = await createClient();

  const { error: insertError } = await supabase.from("messages").insert({
    patient_id: patientId,
    guardian_id: guardianId,
    channel: "portal",
    direction: "outbound",
    body: text,
    sent_at: new Date().toISOString(),
  });

  if (insertError) return { success: false, error: "Não foi possível enviar a resposta." };

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", originalMessageId)
    .eq("direction", "inbound");

  revalidatePath("/supervisao");
  return { success: true };
}
