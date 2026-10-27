import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ReportExportClient } from "./report-export-client";
import type { FilterMetadata } from "./types";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const supabase = await createClient();

  const [{ data: insurers }, { data: therapists }] = await Promise.all([
    supabase
      .from("insurers")
      .select("id, name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, discipline")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("full_name"),
  ]);

  const metadata: FilterMetadata = {
    insurers: (insurers ?? []).map((i) => ({ id: i.id, name: i.name })),
    therapists: (therapists ?? []).map((t) => ({
      id: t.id,
      full_name: t.full_name,
      discipline: t.discipline,
    })),
    disciplines: [
      "Psicologia",
      "Fonoaudiologia",
      "Terapia Ocupacional",
      "Fisioterapia",
      "Musicoterapia",
      "Psicomotricidade",
      "Psicopedagogia",
      "ABA",
    ],
    patientStatuses: [
      { value: "ativo", label: "Ativo" },
      { value: "avaliacao", label: "Em Avaliação" },
      { value: "interessado", label: "Interessado" },
      { value: "pausado", label: "Pausado" },
      { value: "alta", label: "Alta" },
      { value: "evadido", label: "Evadido" },
    ],
    appointmentStatuses: [
      { value: "realizada", label: "Realizada" },
      { value: "agendada", label: "Agendada" },
      { value: "confirmada", label: "Confirmada" },
      { value: "falta", label: "Falta do Paciente" },
      { value: "falta_justificada", label: "Falta Justificada" },
      { value: "cancelada", label: "Cancelada" },
      { value: "em_atendimento", label: "Em Atendimento" },
    ],
    contractStatuses: [
      { value: "ativo", label: "Ativo" },
      { value: "suspenso", label: "Suspenso" },
      { value: "cancelado", label: "Cancelado" },
      { value: "encerrado", label: "Encerrado" },
    ],
    ptsStatuses: [
      { value: "em_elaboracao", label: "Em Elaboração" },
      { value: "aprovado", label: "Aprovado" },
      { value: "entregue", label: "Entregue" },
      { value: "revisao_pendente", label: "Revisão Pendente" },
    ],
  };

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <PageHeader
        axisLabel="Gestão & Controladoria"
        title="Central de Relatórios & Exportação CSV"
        description="Emissão e exportação de dados em planilhas CSV com filtros customizáveis por clientes, terapias, planos, contratos e faturamento."
      />

      <PageContainer fullBleed>
        <ReportExportClient metadata={metadata} />
      </PageContainer>
    </main>
  );
}
