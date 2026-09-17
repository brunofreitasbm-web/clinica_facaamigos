import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/page-container";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ProcedureCodesForm, type ProcedureCodeRow } from "./procedure-codes-form";

export const dynamic = "force-dynamic";

export default async function ProcedimentosPorConvenioPage({
  params,
}: {
  params: Promise<{ insurerId: string }>;
}) {
  const { insurerId } = await params;
  const supabase = await createClient();

  const { data: insurer, error: insurerError } = await supabase
    .from("insurers")
    .select("id, name")
    .eq("id", insurerId)
    .maybeSingle();

  if (!insurer || insurerError) notFound();

  const [{ data: specialties }, { data: codes }] = await Promise.all([
    supabase
      .from("specialties")
      .select("value, label")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("insurer_procedure_codes").select("*").eq("insurer_id", insurerId),
  ]);

  const codeBySpecialty = new Map((codes ?? []).map((c) => [c.specialty_value, c]));

  const rows: ProcedureCodeRow[] = (specialties ?? []).map((s) => {
    const existing = codeBySpecialty.get(s.value);
    return {
      id: existing?.id ?? null,
      specialtyValue: s.value,
      specialtyLabel: s.label,
      procedureCode: existing?.procedure_code ?? "",
      procedureName: existing?.procedure_name ?? "",
      requiresPriorAuth: existing?.requires_prior_auth ?? false,
      groupAllowed: existing?.group_allowed ?? false,
      maxGroupSize: existing?.max_group_size ?? 3,
      sessionMinutes: existing?.session_minutes ?? null,
    };
  });

  return (
    <main className="flex flex-1 flex-col">
      <div className="px-6 pt-6 sm:px-10 sm:pt-9">
        <Link href="/gestor/cadastros/convenios" className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← Planos de Saúde
        </Link>
      </div>
      <PageHeader
        axisLabel="Cadastros"
        title={`Códigos de Procedimento — ${insurer.name}`}
        description="Código de procedimento por especialidade usado no faturamento deste convênio e na função resolve_procedure_code."
      />
      <PageContainer>
        <ProcedureCodesForm insurerId={insurer.id} rows={rows} />
      </PageContainer>
    </main>
  );
}
