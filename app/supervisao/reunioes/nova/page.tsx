import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MeetingForm } from "./meeting-form";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

export default async function NovaReuniaoPage({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string; tipo?: string }>;
}) {
  const { paciente, tipo } = await searchParams;
  if (!paciente) notFound();

  const supabase = await createClient();
  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", paciente).maybeSingle();
  if (!patient) notFound();

  const { data: plans } = await supabase
    .from("treatment_plans")
    .select("id, version, status")
    .eq("patient_id", paciente)
    .is("delivered_at", null)
    .order("version", { ascending: false });

  const planOptions = (plans ?? []).map((p) => ({ id: p.id, label: `v${p.version} · ${p.status}` }));

  return (
    <main className="flex flex-1 flex-col">
      <PageContainer>
        <div>
          <Link href={`/recepcao/pacientes/${paciente}`} className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
            ← {patient.full_name}
          </Link>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mt-3 mb-1">
            Supervisão
          </h6>
          <h1 className="m-0">Nova reunião</h1>
        </div>
        <MeetingForm patientId={paciente} initialKind={tipo ?? "interdisciplinar"} planOptions={planOptions} />
      </PageContainer>
    </main>
  );
}
