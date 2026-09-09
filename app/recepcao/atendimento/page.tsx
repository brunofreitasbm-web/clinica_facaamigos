import { createClient } from "@/lib/supabase/server";
import { AtendimentoShell, type ConversationRow, type ChatbotAdminData } from "./atendimento-shell";
import { formatConversationPhone } from "./format-phone";
import { DEV_CLINIC_ID } from "@/lib/constants";
import type { ChatbotDashboardStats } from "./chatbot/dashboard-panel";
import type { DeliveryHistoryRow } from "./chatbot/chatbot-panel";

export const dynamic = "force-dynamic";

async function loadChatbotAdminData(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ChatbotAdminData> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    conversationsRes,
    messagesTodayRes,
    faqRes,
    quickResponsesRes,
    templatesRes,
    deliveryRes,
    settingsRes,
  ] = await Promise.all([
    supabase.from("twilio_conversations").select("status, kind, escalation_reason"),
    supabase.from("messages").select("sender_type").gte("sent_at", todayStart.toISOString()),
    supabase
      .from("clinic_faq")
      .select("id, question, answer, keywords, category, active")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("sort_order", { ascending: true }),
    supabase
      .from("quick_responses")
      .select("id, shortcut, title, content_text")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("shortcut"),
    supabase
      .from("message_templates")
      .select("id, category, name, channel, body, meta_approved, active")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id, body, channel, direction, delivery_status, sent_at, patients!inner(full_name, clinic_id)")
      .eq("patients.clinic_id", DEV_CLINIC_ID)
      .eq("direction", "outbound")
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from("chatbot_settings")
      .select("bot_enabled, daily_reply_limit, greeting_fallback")
      .eq("clinic_id", DEV_CLINIC_ID)
      .maybeSingle(),
  ]);

  const conversations = conversationsRes.data ?? [];
  const conversationsByStatus = { open: 0, pending: 0, closed: 0 };
  const conversationsByKind = { patient: 0, lead: 0 };
  const escalationsByReason: Record<string, number> = {};
  for (const c of conversations) {
    if (c.status === "open" || c.status === "pending" || c.status === "closed") {
      conversationsByStatus[c.status] += 1;
    }
    if (c.kind === "lead") conversationsByKind.lead += 1;
    else conversationsByKind.patient += 1;
    if (c.escalation_reason) {
      escalationsByReason[c.escalation_reason] = (escalationsByReason[c.escalation_reason] ?? 0) + 1;
    }
  }

  const messagesTodayByType = { user: 0, bot: 0, agent: 0 };
  for (const m of messagesTodayRes.data ?? []) {
    if (m.sender_type === "user" || m.sender_type === "bot" || m.sender_type === "agent") {
      messagesTodayByType[m.sender_type] += 1;
    }
  }

  const stats: ChatbotDashboardStats = { conversationsByStatus, conversationsByKind, messagesTodayByType, escalationsByReason };

  const deliveryHistory: DeliveryHistoryRow[] = (deliveryRes.data ?? []).map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = m as any;
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
    return {
      id: row.id,
      patientName: patient?.full_name ?? null,
      channel: row.channel,
      body: row.body,
      deliveryStatus: row.delivery_status,
      sentAt: row.sent_at,
    };
  });

  return {
    clinicId: DEV_CLINIC_ID,
    stats,
    faqs: (faqRes.data ?? []).map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      keywords: r.keywords ?? [],
      category: r.category,
      active: r.active,
    })),
    quickResponses: (quickResponsesRes.data ?? []).map((r) => ({
      id: r.id,
      shortcut: r.shortcut,
      title: r.title,
      contentText: r.content_text,
    })),
    templates: templatesRes.data ?? [],
    deliveryHistory,
    settings: {
      botEnabled: settingsRes.data?.bot_enabled ?? true,
      dailyReplyLimit: settingsRes.data?.daily_reply_limit ?? 20,
      greetingFallback: settingsRes.data?.greeting_fallback ?? null,
    },
  };
}

export default async function AtendimentoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canManageChatbot = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    canManageChatbot = profile?.role === "supervisor" || profile?.role === "gestor";
  }

  const [{ data: conversationsRaw }, chatbotAdmin] = await Promise.all([
    supabase
      .from("twilio_conversations")
      .select(
        "id, patient_id, guardian_id, phone_number, is_bot_active, status, unread_count, last_message_at, kind, contact_name, escalation_reason, patients(full_name), guardians(full_name)",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    canManageChatbot ? loadChatbotAdminData(supabase) : Promise.resolve(null),
  ]);

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
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AtendimentoShell initialConversations={conversations} chatbotAdmin={chatbotAdmin} />
    </main>
  );
}
