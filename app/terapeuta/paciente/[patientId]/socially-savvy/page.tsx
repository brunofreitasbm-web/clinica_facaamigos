import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PatientIdentityBar } from "@/components/patient-identity-bar";
import { createClient } from "@/lib/supabase/server";
import { getPatientIdentitySummary } from "@/lib/patient-identity";
import { logRecordAccess } from "@/lib/record-access-log";
import { listPatientSociallySavvyAssessments } from "@/lib/socially-savvy-assessments";
import { isInstrumentEnabled } from "@/lib/clinic-instruments";
import {
  SOCIALLY_SAVVY_CATALOG,
  SOCIALLY_SAVVY_LABEL,
  SOCIALLY_SAVVY_MAX_ROUNDS,
  computeSociallySavvyResults,
} from "@/lib/socially-savvy";

export const dynamic = "force-dynamic";

function percentLabel(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

export default async function PatientSociallySavvyHubPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (!profile || !["terapeuta", "supervisor", "gestor"].includes(profile.role)) redirect("/");

  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, clinic_id")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) notFound();

  // Instrumento desativado pelo gestor (/gestor/cadastros/instrumentos):
  // esconder o atalho no prontuário não basta, a URL continua digitável.
  if (!(await isInstrumentEnabled(supabase, patient.clinic_id, "socially_savvy"))) notFound();

  await logRecordAccess(supabase, patientId, "avaliacao_socially_savvy");

  const [{ insurance, emergencyContact }, assessments] = await Promise.all([
    getPatientIdentitySummary(supabase, patientId),
    listPatientSociallySavvyAssessments(supabase, patientId),
  ]);

  const byRound = new Map(assessments.map((a) => [a.round, a]));
  const rounds = Array.from({ length: SOCIALLY_SAVVY_MAX_ROUNDS }, (_, i) => i + 1);
  // Consolidado: só aplicações concluídas entram, um rascunho pela metade
  // sugeriria uma regressão que não aconteceu.
  const concluded = assessments.filter((a) => a.status === "concluida");
  const consolidated = concluded.map((a) => ({
    round: a.round,
    results: computeSociallySavvyResults(SOCIALLY_SAVVY_CATALOG, a.responses),
  }));

  return (
    <main className="flex flex-1 flex-col pb-10">
      <PageHeader
        axisLabel="Terapeuta"
        title={`${SOCIALLY_SAVVY_LABEL} — ${patient.full_name}`}
        description="110 habilidades em 7 áreas, pontuadas de 0 a 3 em até quatro aplicações. Áreas e PEI são calculados automaticamente."
      />
      <PatientIdentityBar patientName={patient.full_name} insurance={insurance} emergencyContact={emergencyContact} />

      <div className="flex flex-col gap-6 px-5 pt-6 sm:px-10">
        <section className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Aplicações
          </h6>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rounds.map((round) => {
              const assessment = byRound.get(round);
              if (!assessment) {
                return (
                  <div key={round} className="flex flex-col gap-2 border p-3" style={{ borderColor: "var(--color-divider)" }}>
                    <span className="text-base font-medium">Aplicação {round}</span>
                    <p className="m-0 text-sm text-ink-faint">Ainda não registrada.</p>
                    <Link
                      href={`/terapeuta/paciente/${patientId}/socially-savvy/nova?aplicacao=${round}`}
                      className="btn btn-secondary w-fit"
                    >
                      Iniciar
                    </Link>
                  </div>
                );
              }
              return (
                <Link
                  key={round}
                  href={`/terapeuta/paciente/${patientId}/socially-savvy/${assessment.id}`}
                  className="flex flex-col gap-2 border p-3 no-underline"
                  style={{ borderColor: "var(--color-divider)" }}
                >
                  <span className="text-base font-medium text-ink">Aplicação {round}</span>
                  <span className="tag-status st-agendada w-fit">
                    {assessment.status === "concluida" ? "Concluída" : "Rascunho"}
                  </span>
                  <p className="m-0 text-sm text-ink-faint">
                    {new Date(`${assessment.assessmentDate}T00:00:00`).toLocaleDateString("pt-BR")} ·{" "}
                    {assessment.assessedByName}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {consolidated.length > 0 && (
          <section className="card">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
              Consolidado — % de acertos por área
            </h6>
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr>
                    <th className="text-left">Área</th>
                    {consolidated.map((c) => (
                      <th key={c.round} className="text-right">
                        Aplicação {c.round}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SOCIALLY_SAVVY_CATALOG.map((area) => (
                    <tr key={area.key}>
                      <td>{area.label}</td>
                      {consolidated.map((c) => {
                        const areaResult = c.results.areas.find((a) => a.key === area.key);
                        return (
                          <td key={c.round} className="text-right">
                            {percentLabel(areaResult?.percent ?? 0)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="font-semibold">Total</td>
                    {consolidated.map((c) => (
                      <td key={c.round} className="text-right font-semibold">
                        {percentLabel(c.results.totalPercent)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
