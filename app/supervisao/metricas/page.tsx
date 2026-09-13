import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { BonusProgressCard } from "@/components/bonus-progress-card";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getMyBonusProgress } from "@/lib/bonus-progress";

export const dynamic = "force-dynamic";

/**
 * Auto-acompanhamento de bonificação da Coordenação clínica — mesmo motor de
 * app/terapeuta/metricas (lib/bonus-progress.ts), amarrado ao cargo
 * "supervisor".
 */
export default async function SupervisaoMetricasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "supervisor" && profile.role !== "gestor")) {
    redirect("/");
  }

  const progress = await getMyBonusProgress(supabase, DEV_CLINIC_ID, "supervisor");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <PageContainer className="max-w-[720px]">
        <div>
          <h1 className="text-2xl font-bold text-ink">Minha bonificação</h1>
          <p className="text-sm text-ink-soft">
            Progresso do mês corrente nas métricas de bonificação parametrizadas pelo gestor para a
            Coordenação clínica. Atualiza a cada carregamento — o valor oficial é fechado no dia 1.
          </p>
        </div>
        <BonusProgressCard progress={progress} />
      </PageContainer>
    </div>
  );
}
