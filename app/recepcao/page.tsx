import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MeasurementCard } from "@/components/measurement-card";
import { TrendStrip } from "@/components/trend-strip";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc, todayInTimeZone, nextCalendarDay } from "@/lib/timezone";
import { getPendingPatients } from "@/lib/patient-stage";

export const dynamic = "force-dynamic";

export default async function RecepcaoPage() {
  const supabase = await createClient();

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const dayStart = zonedDateTimeToUtc(today, "00:00", CLINIC_TIMEZONE).toISOString();
  const dayEnd = zonedDateTimeToUtc(nextCalendarDay(today), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: todayAppointments } = await supabase
    .from("appointments")
    .select("id, status")
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd);

  const sessionsToday = todayAppointments?.length ?? 0;
  const toConfirm = (todayAppointments ?? []).filter((a) => a.status === "agendada").length;

  const pending = await getPendingPatients(supabase);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Agenda do dia"
        description="Coluna esquerda: agenda por sala. Coluna direita: fila de pendências por urgência."
      />
      <nav className="flex flex-col gap-2 px-6 sm:px-10">
        <Link
          href="/recepcao/agenda"
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Ver agenda do dia
        </Link>
        <Link
          href="/recepcao/pacientes"
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Ver todos os pacientes
        </Link>
        <Link
          href="/recepcao/pacientes/pendencias"
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Fila de pendências
        </Link>
        <Link
          href="/recepcao/pacientes/novo"
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Novo paciente (lead)
        </Link>
      </nav>
      <div className="grid grid-cols-1 content-start items-start gap-6 p-6 sm:grid-cols-3 sm:p-10">
        <MeasurementCard label="Sessões hoje" value={String(sessionsToday)} placeholder={false} />
        <MeasurementCard
          label="A confirmar"
          value={String(toConfirm)}
          placeholder={false}
          status={toConfirm > 0 ? "pending" : "neutral"}
        />
        <MeasurementCard
          label="Pendências"
          value={String(pending.length)}
          placeholder={false}
          status={pending.length > 0 ? "pending" : "neutral"}
        />
        <div className="sm:col-span-3">
          <TrendStrip label="No-show — últimas 4 semanas" />
        </div>
      </div>
    </main>
  );
}
