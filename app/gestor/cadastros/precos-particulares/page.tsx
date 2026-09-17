import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { PrecosTable, type SpecialtyPriceViewRow } from "./precos-table";

export const dynamic = "force-dynamic";

export default async function PrecosParticularesPage() {
  const supabase = await createClient();

  const [{ data: specialties }, { data: prices }, { data: clinic }] = await Promise.all([
    supabase
      .from("specialties")
      .select("value, label")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("specialty_prices").select("*").eq("clinic_id", DEV_CLINIC_ID),
    supabase.from("clinics").select("default_sessions_per_month").eq("id", DEV_CLINIC_ID).maybeSingle(),
  ]);

  const priceBySpecialty = new Map((prices ?? []).map((p) => [p.specialty_value, p]));

  const rows: SpecialtyPriceViewRow[] = (specialties ?? []).map((s) => {
    const existing = priceBySpecialty.get(s.value);
    return {
      id: existing?.id ?? null,
      specialtyValue: s.value,
      specialtyLabel: s.label,
      price: existing?.price ?? null,
      durationMinutes: existing?.duration_minutes ?? 50,
      active: existing?.active ?? true,
    };
  });

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Cadastros"
        title="Preços Particulares"
        description="Tabela de preços particulares por especialidade — usada no fechamento financeiro e citada automaticamente pelo chatbot de WhatsApp."
      />
      <PageContainer>
        <PrecosTable rows={rows} defaultSessionsPerMonth={clinic?.default_sessions_per_month ?? 10} />
      </PageContainer>
    </main>
  );
}
