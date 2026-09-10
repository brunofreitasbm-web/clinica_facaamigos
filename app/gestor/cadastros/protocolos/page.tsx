import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { QuickActionsBar } from "@/components/quick-actions-bar";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getProtocolRows } from "../data";
import { listClinicInstruments } from "@/lib/clinic-instruments";
import { DISCIPLINES } from "@/app/supervisao/planos/novo/disciplines";
import { InstrumentosManager, type InstrumentRow } from "../instrumentos/instrumentos-manager";
import { ProtocolosTabs } from "./protocolos-tabs";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

const DISCIPLINE_LABEL: Record<string, string> = Object.fromEntries(DISCIPLINES.map((d) => [d.value, d.label]));

export default async function ProtocolosPage() {
  const supabase = await createClient();
  const [protocols, instruments] = await Promise.all([
    getProtocolRows(supabase, DEV_CLINIC_ID),
    listClinicInstruments(supabase, DEV_CLINIC_ID),
  ]);

  const instrumentRows: InstrumentRow[] = instruments.map((i) => ({
    key: i.key,
    shortLabel: i.shortLabel,
    label: i.label,
    description: i.description,
    disciplineLabel: DISCIPLINE_LABEL[i.discipline] ?? i.discipline,
    enabled: i.enabled,
  }));

  const protocolsPanel = (
    <>
      <div className="flex justify-end px-6 sm:px-10">
        <Link href="/gestor/cadastros/terapias/nova" className="btn btn-primary text-sm no-underline">
          + Novo protocolo
        </Link>
      </div>

      <PageContainer>
        <table className="table">
          <thead>
            <tr>
              <th>Protocolo</th>
              <th>Área</th>
              <th>Origem</th>
              <th>Versão</th>
              <th>Licença comprada em</th>
              <th>Risco de digitização aceito por</th>
              <th>Itens cadastrados</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {protocols.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.name}</td>
                <td>{p.area ?? "—"}</td>
                <td>{p.isGeneric ? "Genérico" : "Licenciado"}</td>
                <td>{p.version ?? "—"}</td>
                <td>{p.licensePurchasedAtLabel}</td>
                <td>{p.riskAcceptedLabel}</td>
                <td className="tabular-figure">{p.itemCount}</td>
                <td className="text-right">
                  <QuickActionsBar
                    profile={{ href: `/gestor/cadastros/terapias/${p.id}`, title: `Ver ${p.name}` }}
                    edit={{ href: `/gestor/cadastros/terapias/${p.id}`, title: `Gerenciar ${p.name}` }}
                    schedule={{ href: `/gestor/cadastros/terapias/${p.id}`, title: `Histórico de ${p.name}` }}
                  />
                </td>
              </tr>
            ))}
            {protocols.length === 0 && (
              <tr>
                <td colSpan={8} className="text-ink-faint">
                  Nenhum protocolo cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PageContainer>
    </>
  );

  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Cadastros"
          title="Protocolos"
          description="Protocolos de avaliação completos — licenciados ou de estrutura genérica — e instrumentos rápidos usados como atalho no prontuário."
        />

        <ProtocolosTabs
          protocolsPanel={protocolsPanel}
          instrumentsPanel={<InstrumentosManager instruments={instrumentRows} />}
        />
      </div>
    </>
  );
}
