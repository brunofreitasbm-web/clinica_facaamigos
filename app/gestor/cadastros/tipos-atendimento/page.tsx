import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { AtendimentosManager } from "./atendimentos-manager";
import type { AppointmentType, InsurerOption } from "./types";

export const dynamic = "force-dynamic";

export default async function AtendimentosPage() {
  const supabase = await createClient();

  const [{ data: typesData }, { data: insurersData }, { data: pricesData }] = await Promise.all([
    supabase
      .from("appointment_types")
      .select("id, name, modality, duration_minutes, display_interval_minutes, recurrence, requires_intern_ratio, active, insurer_id, procedure_code, insurers(name)")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("name"),
    supabase
      .from("insurers")
      .select("id, name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("name"),
    supabase
      .from("insurer_price_tables")
      .select("insurer_id, procedure_code, procedure_name")
      .order("procedure_code"),
  ]);

  const appointmentTypes: AppointmentType[] = (typesData ?? []).map((t) => {
    const insurerObj = Array.isArray(t.insurers) ? t.insurers[0] : t.insurers;
    return {
      id: t.id,
      name: t.name,
      modality: t.modality,
      durationMinutes: t.duration_minutes,
      displayIntervalMinutes: t.display_interval_minutes,
      recurrence: t.recurrence,
      requiresInternRatio: t.requires_intern_ratio,
      active: t.active,
      insurerId: t.insurer_id ?? null,
      insurerName: insurerObj?.name ?? null,
      procedureCode: t.procedure_code ?? null,
    };
  });

  const insurerProceduresMap = new Map<string, { code: string; name: string }[]>();
  for (const price of pricesData ?? []) {
    if (!price.insurer_id) continue;
    const existing = insurerProceduresMap.get(price.insurer_id) ?? [];
    if (!existing.some((p) => p.code === price.procedure_code)) {
      existing.push({ code: price.procedure_code, name: price.procedure_name });
    }
    insurerProceduresMap.set(price.insurer_id, existing);
  }

  const insurers: InsurerOption[] = (insurersData ?? []).map((ins) => ({
    id: ins.id,
    name: ins.name,
    procedures: insurerProceduresMap.get(ins.id) ?? [],
  }));

  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Cadastros"
          title="Tipos de Atendimento"
          description="Gerencie os procedimentos por Plano de Saúde, configurando a duração, recorrência/exibição e a regra de estagiários por criança."
        />
        <AtendimentosManager appointmentTypes={appointmentTypes} insurers={insurers} />
      </div>
    </>
  );
}
