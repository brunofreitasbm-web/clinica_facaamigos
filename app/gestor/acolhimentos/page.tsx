import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { listAcolhimentoRequests, ACOLHIMENTO_STATUS_LABEL, type AcolhimentoStatus } from "@/lib/acolhimento-requests";
import { NewAcolhimentoRequestDialog } from "./new-acolhimento-request-dialog";
import { CancelRequestButton } from "./cancel-request-button";

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
 * Tela do Gestor pra iniciar um acolhimento (Módulo entrada de novos
 * pacientes, FASE 4 — ver lib/acolhimento-requests.ts). O gestor só escolhe
 * um paciente já cadastrado + forma de pagamento e "entrega" o pedido pronto
 * pra Recepção agendar (requestAcolhimento já avança pra
 * aguardando_agendamento). Cadastro de paciente novo continua em
 * /recepcao/pacientes/novo — este formulário só linka pra lá.
 */
export default async function GestorAcolhimentosPage() {
  const supabase = await createClient();

  const [requests, { data: patients }, { data: insurers }, { data: specialties }] = await Promise.all([
    listAcolhimentoRequests(supabase, { clinicId: DEV_CLINIC_ID }),
    supabase.from("patients").select("id, full_name").eq("clinic_id", DEV_CLINIC_ID).order("full_name"),
    supabase.from("insurers").select("id, name").order("name"),
    supabase.from("specialties").select("value, label").eq("clinic_id", DEV_CLINIC_ID).eq("active", true).order("sort_order"),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Gestão"
        title="Acolhimentos"
        description="Solicite uma vaga de acolhimento para um paciente já cadastrado — a Recepção recebe o pedido pronto para agendar a 1ª avaliação."
      />

      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-soft">
            Paciente ainda não cadastrado? Cadastre primeiro em{" "}
            <Link href="/recepcao/pacientes/novo" className="font-semibold text-chart hover:underline">
              Novo paciente
            </Link>{" "}
            e volte aqui para solicitar a vaga.
          </p>
          <NewAcolhimentoRequestDialog
            patients={(patients ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))}
            insurers={(insurers ?? []).map((i) => ({ id: i.id, name: i.name }))}
            specialties={(specialties ?? []).map((s) => ({ value: s.value, label: s.label }))}
          />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Pagamento</th>
              <th>Especialidade</th>
              <th>Status</th>
              <th>Solicitado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.patientName}</td>
                <td>{r.funding === "particular" ? "Particular" : `Convênio${r.insurerName ? ` — ${r.insurerName}` : ""}`}</td>
                <td>{r.specialtyValue ?? "—"}</td>
                <td>
                  <span className={`tag-status ${STATUS_TAG[r.status]}`}>{ACOLHIMENTO_STATUS_LABEL[r.status]}</span>
                </td>
                <td>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="text-right">
                  {r.status !== "concluido" && r.status !== "cancelado" && <CancelRequestButton requestId={r.id} />}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="text-ink-faint">
                  Nenhum acolhimento solicitado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
