import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AnamnesePanel } from "@/components/anamnese-panel";

export const dynamic = "force-dynamic";

export default async function AnamnesePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", id).maybeSingle();
  if (!patient) notFound();

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

      <AnamnesePanel patientId={id} returnHref={`/recepcao/pacientes/${id}#checklist-entrada`} />
    </main>
  );
}
