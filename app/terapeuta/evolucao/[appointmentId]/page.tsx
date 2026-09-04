import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PatientIdentityBar } from "@/components/patient-identity-bar";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { getPatientIdentitySummary } from "@/lib/patient-identity";
import { EvolutionForm } from "./evolution-form";

export default async function EvolucaoPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/");

  // A RLS de `appointments` (appointments_read) já garante que um terapeuta
  // só enxerga sessões onde therapist_id = auth.uid() — se a sessão for de
  // outro terapeuta, a query abaixo simplesmente não retorna linha (não é
  // preciso filtrar manualmente por therapist_id aqui).
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, starts_at, status, therapist_id, patients(full_name), profiles!therapist_id(full_name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) notFound();

  const { insurance, emergencyContact } = await getPatientIdentitySummary(
    supabase,
    appointment.patient_id,
  );

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

  // Só o terapeuta dono da sessão assina a evolução. Gestor/supervisor
  // enxergam a sessão (RLS permite leitura ampla), mas não veem o
  // formulário de assinatura — só quem está com a sessão vinculada.
  const canSign = profile.role === "terapeuta" && appointment.therapist_id === user.id;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Evolução — ${patientName}`}
        description={`${therapistName} · ${new Date(appointment.starts_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}`}
      />
      <PatientIdentityBar patientName={patientName} insurance={insurance} emergencyContact={emergencyContact} />
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
                ? new Date(existingNote.signed_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })
                : "—"}
              .
            </p>
          </div>
        ) : canSign ? (
          <EvolutionForm appointmentId={appointment.id} />
        ) : (
          <p className="text-sm text-ink-faint">
            Evolução pendente — só {therapistName || "o terapeuta responsável"} pode assiná-la.
          </p>
        )}
      </div>
    </main>
  );
}
