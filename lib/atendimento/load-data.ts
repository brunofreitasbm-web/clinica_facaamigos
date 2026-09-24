import type { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { formatConversationPhone } from "@/app/recepcao/atendimento/format-phone";
import type { ConversationRow, InsurerPill } from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Carregamento inicial da fila de Atendimento: extraído de
 * app/recepcao/atendimento/page.tsx (mesma query, mesma modelagem de linha)
 * pra ser reaproveitado sem mudança de comportamento pelo desktop
 * (/recepcao/atendimento) e pelo PWA mobile (/m/atendimento). O painel de
 * administração do chatbot (loadChatbotAdminData) é exclusivo do desktop e
 * continua vivendo lá.
 */
export async function loadAtendimentoData(supabase: SupabaseServerClient): Promise<{
  conversations: ConversationRow[];
  staffNames: Record<string, string>;
  insurerById: Record<string, InsurerPill>;
}> {
  const [{ data: conversationsRaw }, { data: staffRaw }, { data: insurersRaw }] = await Promise.all([
    supabase
      .from("twilio_conversations")
      .select(
        "id, patient_id, guardian_id, phone_number, is_bot_active, status, unread_count, last_message_at, last_inbound_at, last_message_preview, kind, contact_name, escalation_reason, assigned_to, insurer_id, patients(full_name), guardians(full_name)",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    // Nomes de quem pode assumir conversa — para mostrar "com Fulana" na fila.
    supabase.from("profiles").select("id, full_name").in("role", ["recepcao", "supervisor", "gestor"]),
    // Convênios cadastrados: resolvem o plano que o chatbot identificou na conversa.
    supabase.from("insurers").select("id, name, badge_color").eq("clinic_id", DEV_CLINIC_ID),
  ]);

  const staffNames: Record<string, string> = {};
  for (const p of staffRaw ?? []) staffNames[p.id] = p.full_name;

  // Convênio (pílula) exibido na lista de conversas — busca à parte pois
  // `twilio_conversations` não guarda o vínculo de plano, só o `patient_id`.
  const patientIds = Array.from(
    new Set((conversationsRaw ?? []).map((c) => c.patient_id).filter((id): id is string => Boolean(id))),
  );
  const planByPatientId = new Map<string, { name: string; color: string | null }>();
  if (patientIds.length > 0) {
    const { data: insuranceRows } = await supabase
      .from("patient_insurance")
      .select("patient_id, plan_name, insurers(name, badge_color)")
      .in("patient_id", patientIds);
    for (const row of insuranceRows ?? []) {
      if (planByPatientId.has(row.patient_id)) continue;
      const insurer = Array.isArray(row.insurers) ? row.insurers[0] : row.insurers;
      const name = insurer?.name ?? row.plan_name;
      if (!name) continue;
      planByPatientId.set(row.patient_id, { name, color: insurer?.badge_color ?? null });
    }
  }

  const insurerById: Record<string, InsurerPill> = {};
  for (const i of insurersRaw ?? []) insurerById[i.id] = { name: i.name, color: i.badge_color };

  const conversations: ConversationRow[] = (conversationsRaw ?? []).map((c) => {
    const patient = Array.isArray(c.patients) ? c.patients[0] : c.patients;
    const guardian = Array.isArray(c.guardians) ? c.guardians[0] : c.guardians;
    // Plano do cadastro tem prioridade; sem paciente (lead), vale o convênio que o bot identificou.
    const plan =
      (c.patient_id ? planByPatientId.get(c.patient_id) : undefined) ??
      (c.insurer_id ? insurerById[c.insurer_id] : undefined);
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
      assignedTo: c.assigned_to,
      contactName: c.contact_name,
      // Conversa de lead não tem paciente: o nome vem do que a pessoa disse no
      // WhatsApp e, na falta disso, do próprio telefone.
      displayName: patient?.full_name ?? c.contact_name ?? formatConversationPhone(c.phone_number),
      guardianName: guardian?.full_name ?? null,
      planName: plan?.name ?? null,
      planColor: plan?.color ?? null,
      insurerId: c.insurer_id,
      lastInboundAt: c.last_inbound_at,
      lastMessagePreview: c.last_message_preview,
    };
  });

  return { conversations, staffNames, insurerById };
}

const ATENDIMENTO_ROLES = new Set(["recepcao", "supervisor", "gestor"]);

/**
 * Confere se o usuário logado pode ver a fila de Atendimento. Mesma regra
 * usada pelo desktop pra liberar o painel de chatbot (supervisor/gestor),
 * estendida à recepção — quem realmente atende as conversas.
 */
export async function getAtendimentoAccess(
  supabase: SupabaseServerClient,
): Promise<{ userId: string | null; role: string | null; allowed: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, role: null, allowed: false };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role ?? null;
  return { userId: user.id, role, allowed: Boolean(role && ATENDIMENTO_ROLES.has(role)) };
}
