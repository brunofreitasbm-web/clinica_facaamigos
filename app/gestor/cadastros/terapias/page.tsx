import Link from "next/link";
import { CadastrosSidebar } from "../cadastros-sidebar";
import { PageHeader } from "@/components/page-header";
import { QuickActionsBar } from "@/components/quick-actions-bar";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getProtocolRows } from "../data";

export const dynamic = "force-dynamic";

export default async function TerapiasPage() {
  const supabase = await createClient();
  const protocols = await getProtocolRows(supabase, DEV_CLINIC_ID);

  return (
    <>
      <CadastrosSidebar active="terapias" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Cadastros"
          title="Terapias"
          description="Protocolos de avaliação — licenciados (você digita os itens da licença) ou de estrutura genérica (semeados de um template configurável, sem licença)."
        />

        <div className="flex justify-end px-6 sm:px-10">
          <Link href="/gestor/cadastros/terapias/nova" className="btn btn-primary text-sm no-underline">
            + Novo protocolo
          </Link>
        </div>

        <main className="p-6 sm:p-10">
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
        </main>
      </div>
    </>
  );
}
