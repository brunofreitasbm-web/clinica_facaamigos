import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { AnamneseForm } from "./anamnese-form";

export const dynamic = "force-dynamic";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AnamnesePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", id).maybeSingle();
  if (!patient) notFound();

  const { data: existing } = await supabase
    .from("anamneses")
    .select("id, conducted_at, free_text, structured, profiles!conducted_by(full_name)")
    .eq("patient_id", id)
    .order("conducted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const conductedByName = existing
    ? Array.isArray(existing.profiles)
      ? existing.profiles[0]?.full_name
      : existing.profiles?.full_name
    : null;

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <div>
        <Link href={`/recepcao/pacientes/${id}`} className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← {patient.full_name}
        </Link>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mt-3 mb-1">
          Etapa 3
        </h6>
        <h1 className="m-0">1ª Avaliação (Anamnese ampliada)</h1>
      </div>

      {existing ? (
        <div className="max-w-4xl space-y-6">
          <div className="card">
            <div className="card-kicker">Já registrada</div>
            <p className="text-sm text-ink-soft">
              Conduzida por {conductedByName ?? "—"} em {fmtDateTime(existing.conducted_at)}.
            </p>
          </div>

          {(() => {
            const s = (existing.structured as Record<string, string | null>) || {};

            return (
              <>
                {/* Queixa e História Atual */}
                {(s.chief_complaint || s.complaint_history) && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-ink">Queixa e História Atual</h3>
                    {s.chief_complaint && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Queixa Principal</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.chief_complaint}</p>
                      </div>
                    )}
                    {s.complaint_history && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">História da Queixa</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.complaint_history}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Histórico do Desenvolvimento */}
                {(s.gestational_history || s.motor_development || s.language_development || s.cognitive_development) && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-ink">Histórico do Desenvolvimento</h3>
                    {s.gestational_history && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Gestação e Parto</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.gestational_history}</p>
                      </div>
                    )}
                    {s.motor_development && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Desenvolvimento Motor</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.motor_development}</p>
                      </div>
                    )}
                    {s.language_development && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Desenvolvimento da Linguagem</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.language_development}</p>
                      </div>
                    )}
                    {s.cognitive_development && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Desenvolvimento Cognitivo</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.cognitive_development}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Histórico Médico e Saúde */}
                {(s.allergies || s.medications || s.medical_history) && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-ink">Histórico Médico e Saúde</h3>
                    {s.allergies && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Alergias e Intolerâncias</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.allergies}</p>
                      </div>
                    )}
                    {s.medications && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Medicações em Uso</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.medications}</p>
                      </div>
                    )}
                    {s.medical_history && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Cirurgias e Hospitalizações</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.medical_history}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Histórico de Tratamentos Anteriores */}
                {(s.previous_treatments || s.treatment_outcomes) && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-ink">Histórico de Tratamentos Anteriores</h3>
                    {s.previous_treatments && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Terapias e Acompanhamentos Prévios</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.previous_treatments}</p>
                      </div>
                    )}
                    {s.treatment_outcomes && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Resultados de Tratamentos Anteriores</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.treatment_outcomes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Contexto Familiar e Escolar */}
                {(s.family_composition || s.routine || s.school) && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-ink">Contexto Familiar e Escolar</h3>
                    {s.family_composition && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Composição Familiar</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.family_composition}</p>
                      </div>
                    )}
                    {s.routine && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Rotina Diária</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.routine}</p>
                      </div>
                    )}
                    {s.school && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Situação Escolar</p>
                        <p className="mt-1 text-sm text-ink">{s.school}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Prioridades da Família */}
                {s.family_priorities && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-ink">Prioridades da Família</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{s.family_priorities}</p>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <AnamneseForm patientId={id} />
      )}
    </main>
  );
}
