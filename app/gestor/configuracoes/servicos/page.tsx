import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ConfigSidebar } from "../config-sidebar";
import { ServicosManager } from "./servicos-manager";
import type { InsurerOption, ServicePriceRow } from "./types";

export const dynamic = "force-dynamic";

export default async function ServicosPage() {
  const supabase = await createClient();

  const [{ data: priceRows }, { data: insurerRows }] = await Promise.all([
    supabase
      .from("insurer_price_tables")
      .select("id, procedure_code, procedure_name, price, cost, valid_from, valid_to, insurers!inner(id, name, clinic_id)")
      .eq("insurers.clinic_id", DEV_CLINIC_ID)
      .order("procedure_name"),
    supabase.from("insurers").select("id, name").eq("clinic_id", DEV_CLINIC_ID).order("name"),
  ]);

  const services: ServicePriceRow[] = (priceRows ?? []).map((row) => {
    const insurer = Array.isArray(row.insurers) ? row.insurers[0] : row.insurers;
    return {
      id: row.id,
      procedureCode: row.procedure_code,
      procedureName: row.procedure_name,
      insurerId: insurer?.id ?? "",
      insurerName: insurer?.name ?? "—",
      cost: row.cost,
      price: row.price,
      validFrom: row.valid_from,
      validTo: row.valid_to,
    };
  });

  const insurers: InsurerOption[] = (insurerRows ?? []).map((i) => ({ id: i.id, name: i.name }));

  return (
    <>
      <ConfigSidebar active="servicos" />
      <div className="flex flex-1 flex-col">
        <PageHeader
          axisLabel="Configurações"
          title="Serviços"
          description="Catálogo de serviços da clínica, com custo interno e preço por convênio."
        />
        <ServicosManager services={services} insurers={insurers} />
      </div>
    </>
  );
}
