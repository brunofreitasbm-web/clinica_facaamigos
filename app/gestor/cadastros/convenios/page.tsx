import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { InsurerForm } from "./insurer-form";
import { PageContainer } from "@/components/page-container";
import { HealthPlanBadge } from "@/components/health-plan-badge";

import { InsurerListItem } from "./insurer-list-item";

export const dynamic = "force-dynamic";

export default async function ConveniosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let clinicId = DEV_CLINIC_ID;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.clinic_id) clinicId = profile.clinic_id;
  }

  let { data: insurers, error: fetchError } = await supabase
    .from("insurers")
    .select("id, name, ans_code, badge_color")
    .eq("clinic_id", clinicId)
    .order("name");

  if (fetchError && fetchError.message.includes("badge_color")) {
    const fallback = await supabase
      .from("insurers")
      .select("id, name, ans_code")
      .eq("clinic_id", clinicId)
      .order("name");
    insurers = (fallback.data ?? []).map((i) => ({ ...i, badge_color: null }));
  }

  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Cadastros"
          title="Planos de Saúde"
          description="Só o gestor cadastra plano de saúde novo — recepção e faturamento usam a lista pra vincular ao paciente."
        />
        <PageContainer>
          <InsurerForm />
          <ul className="flex flex-col gap-2">
            {(insurers ?? []).map((insurer) => (
              <InsurerListItem key={insurer.id} insurer={insurer} />
            ))}
            {(insurers ?? []).length === 0 && (
              <li className="text-sm text-ink-faint">Nenhum plano de saúde cadastrado ainda.</li>
            )}
          </ul>
        </PageContainer>
      </div>
    </>
  );
}
