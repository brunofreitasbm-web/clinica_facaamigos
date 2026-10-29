import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { brazilHolidays } from "@/lib/clinic-calendar-pure";
import { ClosuresManager, type ClosureRow } from "./closures-manager";

export const dynamic = "force-dynamic";

export default async function FeriadosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role && profile.role !== "supervisor" && profile.role !== "gestor") redirect("/supervisao");
  }

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const year = Number(today.slice(0, 4));
  const holidays = [...brazilHolidays(year), ...brazilHolidays(year + 1)].filter((h) => h.date >= today);

  // Tabela criada em 20261029120000_clinic_closures.sql — fora dos tipos gerados até regenerar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: closures, error } = await (supabase as unknown as SupabaseClient<any>)
    .from("clinic_closures")
    .select("id, closure_date, start_time, end_time, reason, kind")
    .eq("clinic_id", DEV_CLINIC_ID)
    .gte("closure_date", today)
    .order("closure_date");

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Supervisão"
        title="Feriados e fechamentos"
        description="Dias e horários em que a clínica não atende. Feriados nacionais são automáticos; cadastre aqui feriado municipal ou estadual, recesso e fechamentos pontuais. Esses períodos ficam bloqueados na Agenda 1ª Avaliação, no calendário do PTS e nos horários oferecidos às famílias."
      />
      <PageContainer>
        {error && (
          <p className="mb-4 rounded-md border border-status-negative bg-white px-3 py-2 text-xs font-semibold text-status-negative-text">
            Não foi possível carregar os fechamentos cadastrados. Feriados nacionais continuam valendo.
          </p>
        )}
        <ClosuresManager holidays={holidays} closures={(closures ?? []) as ClosureRow[]} />
      </PageContainer>
    </main>
  );
}
