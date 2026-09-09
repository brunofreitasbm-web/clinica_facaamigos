import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function ReagendamentosPendentesPage() {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect("/login");

  const { data: pendentes, error } = await supabase
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status,
      patient:patients ( id, name ),
      therapist:profiles!appointments_therapist_id_fkey ( id, full_name )
    `)
    .eq("status", "aguardando_aprovacao_supervisao")
    .order("starts_at", { ascending: true });

  if (error) {
    return <div className="p-8 text-red-500">Erro ao carregar fila: {error.message}</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Fila de Reagendamentos Pendentes</h1>
      <p className="text-muted-foreground text-sm">
        Esta fila exibe reagendamentos e horários escolhidos pelas famílias via WhatsApp.
        Você precisa aprovar o agendamento para liberar a confirmação final.
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
                <div className="font-medium text-lg">Paciente: {apt.patient?.name}</div>
                <div className="text-sm text-gray-600">
                  Data: {format(new Date(apt.starts_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} <br/>
                  Terapeuta: {apt.therapist?.full_name}
                </div>
              </div>
              <div className="flex gap-2">
                <form action={async () => {
                  "use server";
                  const s = await createClient();
                  await s.from("appointments").update({ status: "agendada" }).eq("id", apt.id);
                  // TODO: Send confirmation WhatsApp message here
                }}>
                  <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium text-sm transition">
                    Aprovar Data
                  </button>
                </form>
                <form action={async () => {
                  "use server";
                  const s = await createClient();
                  await s.from("appointments").delete().eq("id", apt.id);
                  // TODO: Enviar aviso de rejeição
                }}>
                  <button type="submit" className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded font-medium text-sm transition">
                    Rejeitar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
