import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PatientIdentityBar } from "@/components/patient-identity-bar";
import { createClient } from "@/lib/supabase/server";
import { getPatientIdentitySummary } from "@/lib/patient-identity";
import { logRecordAccess } from "@/lib/record-access-log";
import { listPatientFonoAssessments } from "@/lib/fono-assessments";
import { FONO_INSTRUMENT_LABEL, FONO_INSTRUMENTS, type FonoInstrument } from "@/lib/fono-instruments";
import { getEnabledInstrumentKeys } from "@/lib/clinic-instruments";

export const dynamic = "force-dynamic";

function statusLabel(status: "rascunho" | "concluida"): string {
  return status === "concluida" ? "Concluída" : "Rascunho";
}

export default async function PatientFonoHubPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (!profile || !["terapeuta", "supervisor", "gestor"].includes(profile.role)) {
    redirect("/");
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, clinic_id")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) notFound();

  await logRecordAccess(supabase, patientId, "avaliacao_fono");

  const [{ insurance, emergencyContact }, assessments, enabledInstruments] = await Promise.all([
    getPatientIdentitySummary(supabase, patientId),
    listPatientFonoAssessments(supabase, patientId),
    getEnabledInstrumentKeys(supabase, patient.clinic_id),
  ]);

  // Instrumento desativado (/gestor/cadastros/instrumentos): some do hub,
  // mas o histórico já registrado não é apagado — só a porta de aplicação
  // fecha (bloqueada de novo nas próprias telas de nova/[assessmentId]).
  const visibleInstruments = FONO_INSTRUMENTS.filter((instrument) => enabledInstruments.has(instrument));

  const byInstrument = new Map<FonoInstrument, typeof assessments>();
  for (const instrument of visibleInstruments) byInstrument.set(instrument, []);
  for (const a of assessments) byInstrument.get(a.instrument)?.push(a);

  return (
    <main className="flex flex-1 flex-col pb-10">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Avaliações de fonoaudiologia — ${patient.full_name}`}
        description="ADL, ADL-2 e PROC — pontuação item a item, escores calculados automaticamente e histórico por instrumento."
      />
      <PatientIdentityBar patientName={patient.full_name} insurance={insurance} emergencyContact={emergencyContact} />

      <div className="grid grid-cols-1 gap-6 px-5 pt-6 sm:px-10 lg:grid-cols-3">
        {visibleInstruments.map((instrument) => {
          const history = byInstrument.get(instrument) ?? [];
          return (
            <section key={instrument} className="card flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
                  {FONO_INSTRUMENT_LABEL[instrument]}
                </h6>
              </div>
              <Link href={`/terapeuta/paciente/${patientId}/fono/${instrument}/nova`} className="btn btn-secondary w-fit">
                Nova aplicação
              </Link>
              {history.length === 0 ? (
                <p className="text-base text-ink-faint">Nenhuma aplicação registrada ainda.</p>
              ) : (
                <ul className="m-0 flex flex-col gap-2 pl-0 text-base" style={{ listStyle: "none" }}>
                  {history.map((a) => (
                    <li key={a.id} className="border-b py-2" style={{ borderColor: "var(--color-divider)" }}>
                      <Link href={`/terapeuta/paciente/${patientId}/fono/${instrument}/${a.id}`} className="no-underline">
                        <span className="font-medium text-ink">{new Date(`${a.testDate}T00:00:00`).toLocaleDateString("pt-BR")}</span>
                        <span className="ml-2 tag-status st-agendada">{statusLabel(a.status)}</span>
                        <p className="m-0 text-sm text-ink-faint">{a.assessedByName}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
