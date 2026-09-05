import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getInteligenciaMetrics } from "./data";
import { InteligenciaClient } from "./_components/inteligencia-client";

export const dynamic = "force-dynamic";

interface InteligenciaPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function InteligenciaPage({ searchParams }: InteligenciaPageProps) {
  const params = await searchParams;
  const periodKey = params.period || "month";

  const supabase = await createClient();
  const metrics = await getInteligenciaMetrics(supabase, DEV_CLINIC_ID, periodKey);

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-[#f8fafc]">
      <GestorNav active="inteligencia" />
      <InteligenciaClient initialMetrics={metrics} clinicId={DEV_CLINIC_ID} currentPeriodKey={periodKey} />
    </main>
  );
}
