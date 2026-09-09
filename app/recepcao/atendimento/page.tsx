import { createClient } from "@/lib/supabase/server";
import { AtendimentoShell, type ConversationRow } from "./atendimento-shell";
import { formatConversationPhone } from "./format-phone";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage() {
  const supabase = await createClient();

  const { data: conversationsRaw } = await supabase
    .from("twilio_conversations")
    .select(
      "id, patient_id, guardian_id, phone_number, is_bot_active, status, unread_count, last_message_at, kind, contact_name, escalation_reason, patients(full_name), guardians(full_name)",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const conversations: ConversationRow[] = (conversationsRaw ?? []).map((c) => {
    const patient = Array.isArray(c.patients) ? c.patients[0] : c.patients;
    const guardian = Array.isArray(c.guardians) ? c.guardians[0] : c.guardians;
    return {
      id: c.id,
      patientId: c.patient_id,
      guardianId: c.guardian_id,
      phoneNumber: c.phone_number,
      isBotActive: c.is_bot_active,
      status: c.status,
      unreadCount: c.unread_count,
      lastMessageAt: c.last_message_at,
      kind: c.kind === "lead" ? "lead" : "patient",
      escalationReason: c.escalation_reason,
      // Conversa de lead não tem paciente: o nome vem do que a pessoa disse no
      // WhatsApp e, na falta disso, do próprio telefone.
      displayName: patient?.full_name ?? c.contact_name ?? formatConversationPhone(c.phone_number),
      guardianName: guardian?.full_name ?? null,
    };
  });

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <AtendimentoShell initialConversations={conversations} />
    </main>
  );
}
