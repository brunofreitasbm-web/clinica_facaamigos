import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { WhatsappSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function GestorWhatsappPage() {
  const supabase = await createClient();

  const [{ data: settings }, { data: supervisors }, { data: conversations }] = await Promise.all([
    supabase.from("clinic_settings").select("*").eq("clinic_id", DEV_CLINIC_ID).maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", DEV_CLINIC_ID).eq("role", "supervisor").order("full_name"),
    supabase
      .from("whatsapp_conversations")
      .select("id, wa_id, profile_name, state, updated_at, patients(full_name)")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const conversationIds = (conversations ?? []).map((c) => c.id);
  const { data: recentMessages } =
    conversationIds.length > 0
      ? await supabase
          .from("whatsapp_messages")
          .select("conversation_id, direction, body, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const lastMessageByConversation = new Map<string, { direction: string; body: string | null; createdAt: string }>();
  for (const m of recentMessages ?? []) {
    if (!lastMessageByConversation.has(m.conversation_id)) {
      lastMessageByConversation.set(m.conversation_id, { direction: m.direction, body: m.body, createdAt: m.created_at });
    }
  }

  const totalMessages = recentMessages?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#1c2530] p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-[#e4dfd2] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#57606b] mb-1">
            <Link href="/gestor" className="hover:underline text-[#0f5c7d]">
              Gestão
            </Link>
            <span>/</span>
            <span>Integrações</span>
            <span>/</span>
            <span className="font-semibold text-[#1c2530]">WhatsApp & Agente IA</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1c2530]" style={{ fontFamily: "var(--font-heading)" }}>
            Agente Virtual de IA (WhatsApp)
          </h1>
          <p className="text-sm text-[#57606b]">
            Coleta de dados, laudo/guia em PDF, aprovação do supervisor e agendamento autônomo da avaliação.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold ${
              settings?.bot_enabled ? "bg-[#dcefe8] text-[#0e5c44]" : "bg-[#f5ded8] text-[#93301c]"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${settings?.bot_enabled ? "bg-[#1b8a6b]" : "bg-[#c4432b]"}`} />
            {settings?.bot_enabled ? "IA Operacional" : "IA Pausada"}
          </span>
          <Link href="/gestor/integracoes/whatsapp/simulador" className="btn btn-secondary text-xs">
            Abrir simulador
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <WhatsappSettingsForm
          botEnabled={settings?.bot_enabled ?? true}
          address={settings?.address ?? ""}
          openingHours={settings?.opening_hours ?? ""}
          humanContactPhone={settings?.human_contact_phone ?? ""}
          evaluationSupervisorProfileId={settings?.evaluation_supervisor_profile_id ?? ""}
          evaluationDurationMinutes={settings?.evaluation_duration_minutes ?? 60}
          supervisors={(supervisors ?? []).map((s) => ({ id: s.id, name: s.full_name }))}
        />

        <div className="rounded-lg border border-[#cfc8b4] bg-white p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#1c2530] flex items-center gap-2">📊 Atividade recente</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#57606b]">Conversas ativas:</span>
              <span className="font-mono font-bold text-[#1c2530]">{conversations?.length ?? 0}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#57606b]">Mensagens nas conversas recentes:</span>
              <span className="font-mono font-bold text-[#0f5c7d]">{totalMessages}</span>
            </div>
          </div>
          <p className="text-[11px] text-[#57606b]">
            Transporte atual: {process.env.WHATSAPP_TRANSPORT === "twilio" ? "Twilio (real)" : "Simulador local"}.
          </p>
        </div>

        <div className="rounded-lg border border-[#cfc8b4] bg-[#faf8f3] p-5 space-y-3 shadow-sm">
          <h3 className="text-sm font-bold text-[#1c2530]">💬 Menu do bot</h3>
          <p className="text-xs text-[#57606b] leading-relaxed italic bg-white p-3 rounded border border-[#e4dfd2] whitespace-pre-wrap">
            {`1 Agendar avaliação · 2 Convênios · 3 Documentos · 4 Como funciona · 5 Endereço/horário · 6 Confirmar/reagendar · 9 Falar com humano`}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[#cfc8b4] bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#e4dfd2] bg-[#faf8f3]">
          <h3 className="text-sm font-bold text-[#1c2530]">Conversas recentes</h3>
        </div>

        <table className="w-full text-left text-xs text-[#1c2530]">
          <thead className="bg-[#faf8f3] border-b border-[#e4dfd2] text-[#5f656f] font-medium uppercase">
            <tr>
              <th className="p-3.5">Contato</th>
              <th className="p-3.5">Estado</th>
              <th className="p-3.5">Última mensagem</th>
              <th className="p-3.5">Quando</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e4dfd2]">
            {(conversations ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-[#57606b]">
                  Nenhuma conversa ainda. Use o simulador para testar o fluxo.
                </td>
              </tr>
            )}
            {(conversations ?? []).map((c) => {
              const patient = Array.isArray(c.patients) ? c.patients[0] : c.patients;
              const last = lastMessageByConversation.get(c.id);
              return (
                <tr key={c.id} className="hover:bg-[#faf8f3]/60 transition-colors">
                  <td className="p-3.5">
                    <div className="font-semibold text-[#1c2530]">{patient?.full_name ?? c.profile_name ?? "—"}</div>
                    <div className="text-[11px] text-[#57606b] font-mono">{c.wa_id}</div>
                  </td>
                  <td className="p-3.5">
                    <span className="rounded bg-[#faf8f3] px-2 py-1 border border-[#e4dfd2]">{c.state}</span>
                  </td>
                  <td className="p-3.5 text-[#57606b] max-w-xs truncate">{last?.body ?? "—"}</td>
                  <td className="p-3.5 font-mono text-[#57606b]">
                    {new Date(c.updated_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
