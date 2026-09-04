import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { EvolutionForm } from "./evolution-form";

export default async function EvolucaoPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const supabase = createAdminClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, status, therapist_id, patients(full_name), profiles!therapist_id(full_name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) notFound();

  const { data: existingNote } = await supabase
    .from("session_notes")
    .select("id, signed_at")
    .eq("appointment_id", appointmentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const patientName = (appointment.patients as { full_name: string } | null)?.full_name ?? "";
  const therapistName =
    (appointment.profiles as { full_name: string } | null)?.full_name ?? "";

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Evolução — ${patientName}`}
        description={`${therapistName} · ${new Date(appointment.starts_at).toLocaleString("pt-BR")}`}
      />
      <div className="p-6 sm:p-10">
        {appointment.status !== "realizada" ? (
          <p className="text-sm text-status-negative-text">
            Esta sessão ainda não foi realizada — não é possível registrar evolução.
          </p>
        ) : existingNote ? (
          <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5 text-sm">
            <p className="font-medium text-status-positive-text">Evolução já registrada.</p>
            <p className="mt-2 text-ink-soft">
              Assinada em{" "}
              {existingNote.signed_at
                ? new Date(existingNote.signed_at).toLocaleString("pt-BR")
                : "—"}
              .
            </p>
          </div>
        ) : (
          <EvolutionForm appointmentId={appointment.id} therapistId={appointment.therapist_id} />
        )}
      </div>
    </main>
  );
}
