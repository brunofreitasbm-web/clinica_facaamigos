import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

export default async function NovoPlanoPage() {
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .in("status", ["ativo", "avaliacao"])
    .order("full_name");

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Supervisão"
        title="Novo plano terapêutico"
        description="Disciplinas, metas SMART por domínio e data de revisão. O plano entra em rascunho e segue para a fila de aprovação."
      />
      <PlanForm patients={patients ?? []} />
    </main>
  );
}
