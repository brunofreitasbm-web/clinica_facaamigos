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
          Módulo 3 MAAIS · Etapa 3
        </h6>
        <h1 className="m-0">Anamnese ampliada</h1>
      </div>

      {existing ? (
        <div className="card max-w-2xl">
          <div className="card-kicker">Já registrada</div>
          <p className="text-sm text-ink-soft">
            Conduzida por {conductedByName ?? "—"} em {fmtDateTime(existing.conducted_at)}.
          </p>
          {existing.free_text && <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{existing.free_text}</p>}
          {(existing.structured as Record<string, string | null>)?.family_priorities && (
            <p className="mt-2 text-sm text-ink">
              <span className="font-semibold">Prioridades da família: </span>
              {(existing.structured as Record<string, string | null>).family_priorities}
            </p>
          )}
        </div>
      ) : (
        <AnamneseForm patientId={id} />
      )}
    </main>
  );
}
