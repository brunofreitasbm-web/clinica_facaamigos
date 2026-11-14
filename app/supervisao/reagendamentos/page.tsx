import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { HelpHint } from "@/components/ui/help-hint";
import { DecisionButtons } from "./decision-buttons";

// Sem date-fns: o projeto formata data/hora com Intl de propósito, para não
// depender do fuso do processo Node (ver lib/timezone.ts e lib/age.ts).
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDataHora(isoInstant: string): string {
  const partes = DATA_HORA.formatToParts(new Date(isoInstant));
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} às ${p("hour")}:${p("minute")}`;
}

export default async function ReagendamentosPendentesPage() {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect("/login");

  const { data: pendentes, error } = await supabase
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status,
      patient:patients ( id, full_name ),
      therapist:profiles!appointments_therapist_id_fkey ( id, full_name )
    `)
    .eq("status", "aguardando_aprovacao_supervisao")
    .order("starts_at", { ascending: true });

  if (error) {
    return <div className="p-8 text-red-500">Erro ao carregar fila: {error.message}</div>;
  }

  return (
    <PageContainer>
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        Fila de Reagendamentos Pendentes
        <HelpHint text="Reagendamentos e horários escolhidos pelas famílias via WhatsApp." />
      </h1>
      <p className="text-muted-foreground text-sm">
        Aprove o agendamento para liberar a confirmação final.
      </p>

      {(!pendentes || pendentes.length === 0) ? (
        <div className="text-sm text-gray-500 p-8 border rounded flex items-center justify-center">
          Nenhum reagendamento pendente.
        </div>
      ) : (
        <div className="grid gap-4">
          {pendentes.map((apt: any) => (
            <div key={apt.id} className="border p-4 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-medium text-lg">Paciente: {apt.patient?.full_name}</div>
                <div className="text-sm text-gray-600">
                  Data: {formatDataHora(apt.starts_at)} <br/>
                  Terapeuta: {apt.therapist?.full_name}
                </div>
              </div>
              <DecisionButtons appointmentId={apt.id} />
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
