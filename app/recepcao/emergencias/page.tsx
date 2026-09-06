import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { EmergencyForm } from "./emergency-form";

export const dynamic = "force-dynamic";

export default async function EmergenciasPage() {
  const supabase = await createClient();

  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("role", "terapeuta")
    .order("full_name");

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
          Recepção
        </h6>
        <h1 className="m-0">Central de Chamadas de Emergência por Voz</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Falta de última hora de terapeuta: dispare ligações automáticas avisando os responsáveis dos pacientes
          afetados.
        </p>
      </div>

      <EmergencyForm therapists={(therapists ?? []).map((t) => ({ id: t.id, name: t.full_name }))} />
    </main>
  );
}
