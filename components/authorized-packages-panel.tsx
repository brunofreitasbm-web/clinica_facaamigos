import { ChevronRight, PackageCheck } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getAuthorizationWizardItems } from "@/lib/reception-queue";
import { AutorizacaoWizard } from "@/app/recepcao/pacientes/pendencias/autorizacao-wizard";

/**
 * "Pacotes de horas autorizadas": saldo de cada guia ativa e renovação. Painel único,
 * usado no TOPO de Recepção > Pacientes e no topo do módulo de Supervisão, para os dois
 * lugares mostrarem exatamente os mesmos pacotes. Recolhido, com a contagem sempre
 * visível no cabeçalho, para não empurrar a lista abaixo; some se não há pacote ativo.
 */
export async function AuthorizedPackagesPanel() {
  const supabase = await createClient();
  const authorizations = await getAuthorizationWizardItems(supabase, DEV_CLINIC_ID);
  if (authorizations.length === 0) return null;

  return (
    <PageContainer>
      <details id="pacotes" className="group rounded-lg border border-teal-200 bg-paper-surface shadow-sm">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-teal-50/70 px-5 py-4 text-base [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-5 w-5 text-ink-soft transition-transform group-open:rotate-90" aria-hidden="true" />
          <PackageCheck className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <span className="font-bold text-ink">Pacotes de horas autorizadas</span>
          <span className="ml-auto rounded-full bg-teal-600 px-3 py-0.5 text-sm font-semibold text-white">
            {authorizations.length} {authorizations.length === 1 ? "pacote ativo" : "pacotes ativos"}
          </span>
        </summary>
        <div className="border-t border-paper-line px-5 py-5">
          <AutorizacaoWizard initialItems={authorizations} />
        </div>
      </details>
    </PageContainer>
  );
}
