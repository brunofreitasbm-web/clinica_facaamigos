// lib/appointment-swap-notify.ts
//
// Depois de uma permuta bem-sucedida (swap_appointment_patients, ver
// supabase/migrations/20260914000000_swap_appointment_patients.sql), avisa
// os responsáveis de cada paciente afetado — mural da família (tabela
// `messages`, canal 'portal', lido em app/familia/page.tsx) e e-mail
// (lib/email.ts) — sobre a mudança de horário.
//
// Chamado por app/supervisao/grade-actions.ts com um snapshot "antes" e
// "depois" da mesma consulta (appointments + paciente/terapeuta/sala), pra
// descrever a mudança do ponto de vista de cada família: "sua sessão que
// era X passa a ser Y" — nunca "seu filho trocou de lugar com outro
// paciente", porque a identidade da outra criança não é assunto da família.
//
// Best-effort: a permuta já foi commitada no banco antes desta função
// rodar, então uma falha de notificação (e-mail fora do ar, etc.) nunca
// deve virar erro pro supervisor nem sugerir que a permuta não aconteceu —
// cada paciente é tratado isoladamente e um erro aqui só é logado.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { sendEmail, renderBrandEmailHtml } from "@/lib/email";

export type AppointmentSwapSnapshot = {
  id: string;
  starts_at: string;
  patient_id: string;
  patients: { full_name: string } | { full_name: string }[] | null;
  therapist: { full_name: string } | { full_name: string }[] | null;
  rooms: { name: string } | { name: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatSlot(row: AppointmentSwapSnapshot): string {
  const therapist = one(row.therapist);
  const room = one(row.rooms);
  const when = new Date(row.starts_at).toLocaleString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${when} com ${therapist?.full_name ?? "—"} (sala ${room?.name ?? "—"})`;
}

export async function notifyAppointmentSwap(
  supabase: SupabaseClient<Database>,
  before: AppointmentSwapSnapshot[],
  after: AppointmentSwapSnapshot[],
): Promise<void> {
  for (const oldRow of before) {
    // O paciente que estava aqui agora ocupa qual vaga? (permutação — sempre
    // deve aparecer em exatamente uma linha de `after`.)
    const newRow = after.find((a) => a.patient_id === oldRow.patient_id);
    if (!newRow || newRow.id === oldRow.id) continue;

    try {
      const patientName = one(oldRow.patients)?.full_name ?? "Paciente";
      const oldLabel = formatSlot(oldRow);
      const newLabel = formatSlot(newRow);
      const bodyText =
        `O horário de ${patientName} foi ajustado pela coordenação: a sessão que era ${oldLabel} ` +
        `passa a ser ${newLabel}. Qualquer dúvida, fale com a recepção.`;

      await supabase.from("messages").insert({
        patient_id: oldRow.patient_id,
        channel: "portal",
        direction: "outbound",
        template_key: "troca_paciente_sessao",
        body: bodyText,
        sent_at: new Date().toISOString(),
        related_appointment_id: newRow.id,
      });

      const { data: guardians } = await supabase.from("guardians").select("email").eq("patient_id", oldRow.patient_id);
      const emails = (guardians ?? []).map((g) => g.email).filter((e): e is string => !!e);

      if (emails.length > 0) {
        const html = renderBrandEmailHtml({
          title: "Alteração no horário da sessão",
          contentHtml:
            `<p>Olá,</p><p>O horário de <strong>${patientName}</strong> foi ajustado pela coordenação:</p>` +
            `<p>Antes: ${oldLabel}<br/>Agora: <strong>${newLabel}</strong></p>` +
            `<p>Qualquer dúvida, fale com a recepção.</p>`,
        });
        await sendEmail({ to: emails, subject: `Alteração no horário de ${patientName}`, html });
      }
    } catch (err) {
      console.error("[appointment-swap-notify] Falha ao notificar responsável do paciente", oldRow.patient_id, err);
    }
  }
}
