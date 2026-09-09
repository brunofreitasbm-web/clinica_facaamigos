import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { BondingForm } from "./bonding-form";

export const dynamic = "force-dynamic";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE });

export default async function VinculoPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  const { data: reports } = await supabase
    .from("bonding_reports")
    .select("id, period_start, period_end, engagement_score, observations, ready_to_increase_demands")
    .eq("patient_id", patientId)
    .order("period_start", { ascending: false });

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <div>
        <Link href={`/terapeuta/paciente/${patientId}`} className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← {patient.full_name}
        </Link>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mt-3 mb-1">
          Registro de vínculo
        </h6>
        <h1 className="m-0">Acompanhamento inicial e vínculo</h1>
      </div>

      <BondingForm patientId={patientId} />

      {(reports ?? []).length > 0 && (
        <div className="card max-w-xl md:max-w-2xl">
          <div className="card-kicker">Histórico</div>
          <ul className="flex flex-col gap-2 text-base">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="border-b border-paper-line pb-2">
                {fmtDate(`${r.period_start}T00:00:00`)} – {fmtDate(`${r.period_end}T00:00:00`)} · engajamento {r.engagement_score}/5
                {r.ready_to_increase_demands && " · pronto para aumentar demandas"}
                {r.observations && <p className="mt-1 text-ink-soft">{r.observations}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
