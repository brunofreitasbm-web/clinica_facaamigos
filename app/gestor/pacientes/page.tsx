import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { QuickActionsBar } from "@/components/quick-actions-bar";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getPatientRows } from "../cadastros/data";
import { PageContainer } from "@/components/page-container";
import { PATIENT_STATUS_LABEL } from "@/lib/patient-status";
import { SearchAsYouTypeInput } from "@/components/search-as-you-type-input";

export const dynamic = "force-dynamic";

const PATIENT_STATUS_TAG: Record<string, string> = {
  interessado: "st-agendada",
  avaliacao: "st-agendada",
  ativo: "st-realizada",
  pausado: "st-em-atendimento",
  alta: "st-confirmada",
  evadido: "st-falta",
};

export default async function PacientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const all = await getPatientRows(supabase, DEV_CLINIC_ID);
  const needle = (q ?? "").trim().toLowerCase();
  const patients = needle ? all.filter((p) => p.name.toLowerCase().includes(needle)) : all;

  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader axisLabel="Pacientes" title="Pacientes" description="Abra um paciente para ver cadastro, anamnese, terapêutica e documentos num só lugar." />

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-10">
          <div className="w-full max-w-sm">
            <SearchAsYouTypeInput initialValue={q ?? ""} placeholder="Buscar paciente..." className="input pl-9 text-xs" />
          </div>
          <Link href="/recepcao/pacientes/novo" className="btn btn-primary">
            Novo paciente
          </Link>
        </div>

        <PageContainer>
          <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Responsável</th>
                <th>Nascimento</th>
                <th>Plano de Saúde</th>
                <th>Terapeuta principal</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">
                    <Link href={`/gestor/pacientes/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>{p.guardianName}</td>
                  <td>{p.birthDateLabel}</td>
                  <td>{p.insurerName}</td>
                  <td>{p.primaryTherapistName}</td>
                  <td>
                    <span className={`tag-status ${PATIENT_STATUS_TAG[p.status] ?? "st-cancelada"}`}>{PATIENT_STATUS_LABEL[p.status] ?? p.status}</span>
                  </td>
                  <td className="text-right">
                    <QuickActionsBar
                      profile={{ href: `/gestor/pacientes/${p.id}`, title: `Ficha completa de ${p.name}` }}
                      edit={{ href: `/gestor/pacientes/${p.id}`, title: `Editar paciente ${p.name}` }}
                      schedule={{ href: `/gestor/pacientes/${p.id}`, title: `Agenda de ${p.name}` }}
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
          </div>
        </PageContainer>
      </div>
    </>
  );
}
