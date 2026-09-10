import Link from "next/link";
import { CadastrosSidebar } from "../cadastros-sidebar";
import { PageHeader } from "@/components/page-header";
import { QuickActionsBar } from "@/components/quick-actions-bar";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getPatientRows } from "../data";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

const PATIENT_STATUS_TAG: Record<string, string> = {
  interessado: "st-agendada",
  avaliacao: "st-agendada",
  ativo: "st-realizada",
  pausado: "st-em-atendimento",
  alta: "st-confirmada",
  evadido: "st-falta",
};

export default async function PacientesPage() {
  const supabase = await createClient();
  const patients = await getPatientRows(supabase, DEV_CLINIC_ID);

  return (
    <>
      <CadastrosSidebar active="pacientes" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader axisLabel="Cadastros" title="Pacientes" description="Todos os pacientes cadastrados nesta clínica." />

        <div className="flex justify-end px-6 sm:px-10">
          <Link href="/recepcao/pacientes/novo" className="btn btn-primary">
            Novo paciente
          </Link>
        </div>

        <PageContainer>
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Responsável</th>
                <th>Nascimento</th>
                <th>Convênio</th>
                <th>Terapeuta principal</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">
                    <Link href={`/recepcao/pacientes/${p.id}/gestao`}>{p.name}</Link>
                  </td>
                  <td>{p.guardianName}</td>
                  <td>{p.birthDateLabel}</td>
                  <td>{p.insurerName}</td>
                  <td>{p.primaryTherapistName}</td>
                  <td>
                    <span className={`tag-status ${PATIENT_STATUS_TAG[p.status] ?? "st-cancelada"}`}>{p.status}</span>
                  </td>
                  <td className="text-right">
                    <QuickActionsBar
                      profile={{ href: `/recepcao/pacientes/${p.id}/gestao`, title: `Ficha completa de ${p.name}` }}
                      edit={{ href: `/recepcao/pacientes/${p.id}/gestao`, title: `Editar paciente ${p.name}` }}
                      schedule={{ href: `/recepcao/pacientes/${p.id}/gestao`, title: `Agenda de ${p.name}` }}
                    />
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-ink-faint">
                    Nenhum paciente cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </PageContainer>
      </div>
    </>
  );
}
