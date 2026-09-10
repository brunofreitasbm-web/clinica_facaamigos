import { EquipeSubnav } from "@/components/equipe-subnav";
import { getBonusConfigData } from "./actions";
import { BonusConfigClient } from "./bonus-config-client";
import { PageContainer } from "@/components/page-container";

export default async function BonusConfigPage() {
  const { roles, modules, catalog, active, history } = await getBonusConfigData();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <EquipeSubnav activeTab="bonificacao-config" />

      <PageContainer>
        <div>
          <h1 className="text-2xl font-bold text-ink">Configurar & Simular PLR/Bonificação</h1>
          <p className="text-sm text-ink-soft">
            Monte, por cargo e módulo, quais métricas do catálogo (§10 do PRD) entram na apuração, com peso, meta e
            cláusula eliminatória — e simule o resultado num período antes de publicar. Cada publicação abre uma nova
            vigência (com data de início) e encerra a anterior automaticamente; nada é sobrescrito, então o extrato de
            um mês já apurado sempre aponta pra config que valia naquele período.
          </p>
        </div>

        <BonusConfigClient roles={roles} modules={modules} catalog={catalog} active={active} history={history} />
      </PageContainer>
    </div>
  );
}
