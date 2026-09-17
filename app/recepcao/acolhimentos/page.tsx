import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { listAcolhimentoRequests, ACOLHIMENTO_STATUS_LABEL, type AcolhimentoStatus } from "@/lib/acolhimento-requests";
import { AcolhimentoRequestRow } from "./acolhimento-request-row";

export const dynamic = "force-dynamic";

const STATUS_TAG: Record<AcolhimentoStatus, string> = {
  solicitado: "st-agendada",
  aguardando_agendamento: "st-agendada",
  agendado: "st-confirmada",
  aguardando_pagamento: "st-falta",
  realizado: "st-realizada",
  contrato_pendente: "st-em-atendimento",
  grade_pendente: "st-em-atendimento",
  concluido: "st-realizada",
  cancelado: "st-cancelada",
};

/**
 * Tela da Recepção pra tocar o fluxo de acolhimento (FASE 4) do agendamento
 * até a conclusão — ações por linha variam conforme status/funding (ver
 * AcolhimentoRequestRow). Não lista concluído/cancelado por padrão pra não
 * poluir a fila do dia a dia.
 */
export default async function RecepcaoAcolhimentosPage() {
  const supabase = await createClient();

  const [requests, { data: therapists }, { data: supervisors }, { data: rooms }, { data: appointmentTypes }] = await Promise.all([
    listAcolhimentoRequests(supabase, { clinicId: DEV_CLINIC_ID }),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", DEV_CLINIC_ID).eq("role", "terapeuta").eq("active", true).order("full_name"),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", DEV_CLINIC_ID).eq("role", "supervisor").eq("active", true).order("full_name"),
    supabase.from("rooms").select("id, name, is_evaluation_room").eq("clinic_id", DEV_CLINIC_ID).order("name"),
    supabase.from("appointment_types").select("id, name").eq("clinic_id", DEV_CLINIC_ID).eq("active", true).order("name"),
  ]);

  const visibleRequests = requests.filter((r) => r.status !== "concluido" && r.status !== "cancelado");

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Acolhimentos"
        description="Agende a 1ª avaliação, confirme a chegada, entregue o contrato e informe a família — do pedido do Gestor até a conclusão do acolhimento."
      />

      <div className="flex flex-col gap-4 p-6 sm:p-10">
        <table className="table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th>Atualizado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.patientName}</td>
                <td>{r.funding === "particular" ? "Particular" : `Convênio${r.insurerName ? ` — ${r.insurerName}` : ""}`}</td>
                <td>
                  <span className={`tag-status ${STATUS_TAG[r.status]}`}>{ACOLHIMENTO_STATUS_LABEL[r.status]}</span>
                </td>
                <td>{new Date(r.updatedAt).toLocaleDateString("pt-BR")}</td>
                <td className="text-right">
                  <AcolhimentoRequestRow
                    request={r}
                    therapists={(therapists ?? []).map((t) => ({ id: t.id, full_name: t.full_name }))}
                    supervisors={(supervisors ?? []).map((s) => ({ id: s.id, full_name: s.full_name }))}
                    rooms={(rooms ?? []).map((room) => ({ id: room.id, name: room.name, is_evaluation_room: room.is_evaluation_room }))}
                    appointmentTypes={(appointmentTypes ?? []).map((t) => ({ id: t.id, name: t.name }))}
                  />
                </td>
              </tr>
            ))}
            {visibleRequests.length === 0 && (
              <tr>
                <td colSpan={5} className="text-ink-faint">
                  Nenhum acolhimento em andamento no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
