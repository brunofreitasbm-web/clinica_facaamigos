import { PageHeader } from "@/components/page-header";
import { ConfigSidebar } from "../config-sidebar";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { DadosClinicaForm, type ClinicRow } from "./dados-clinica-form";

export const dynamic = "force-dynamic";

/**
 * Tela onde o gestor cadastra nome fantasia, razão social, CNPJ, endereço,
 * contato e responsável técnico da clínica. É a fonte que alimenta o timbre
 * de todo PDF exportado (lib/letterhead-pdf.tsx, via getClinicIdentity) e os
 * documentos impressos da recepção (app/recepcao/documentos) — antes dessa
 * tela, esses dados só existiam como texto fixo espalhado pelo código.
 */
export default async function DadosDaClinicaPage() {
  const supabase = await createClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select(
      "name, razao_social, cnpj, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, telefone, whatsapp, email, site, responsavel_tecnico, responsavel_tecnico_conselho",
    )
    .eq("id", DEV_CLINIC_ID)
    .maybeSingle();

  const initial: ClinicRow = {
    name: clinic?.name ?? "",
    razao_social: clinic?.razao_social ?? "",
    cnpj: clinic?.cnpj ?? "",
    endereco_logradouro: clinic?.endereco_logradouro ?? "",
    endereco_numero: clinic?.endereco_numero ?? "",
    endereco_complemento: clinic?.endereco_complemento ?? "",
    endereco_bairro: clinic?.endereco_bairro ?? "",
    endereco_cidade: clinic?.endereco_cidade ?? "",
    endereco_uf: clinic?.endereco_uf ?? "",
    endereco_cep: clinic?.endereco_cep ?? "",
    telefone: clinic?.telefone ?? "",
    whatsapp: clinic?.whatsapp ?? "",
    email: clinic?.email ?? "",
    site: clinic?.site ?? "",
    responsavel_tecnico: clinic?.responsavel_tecnico ?? "",
    responsavel_tecnico_conselho: clinic?.responsavel_tecnico_conselho ?? "",
  };

  return (
    <>
      <ConfigSidebar active="dados-da-clinica" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Dados da Clínica"
          description="Nome, CNPJ, endereço e contato oficiais — usados no timbre dos PDFs exportados e nos documentos impressos da recepção."
        />
        <div className="max-w-4xl p-6 sm:p-10">
          <DadosClinicaForm initial={initial} />
        </div>
      </div>
    </>
  );
}
