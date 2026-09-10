import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { AnamnesePanel } from "@/components/anamnese-panel";
import { canConductFirstAssessment } from "@/lib/anamnese-access";
import { logRecordAccess } from "@/lib/record-access-log";

export const dynamic = "force-dynamic";

/**
 * 1ª avaliação (anamnese ampliada) pela porta do terapeuta.
 *
 * A tela já existia em `/supervisao/pacientes/[id]/anamnese`, mas o guard de
 * papel (ROLE_ALLOWED_PREFIXES) devolve qualquer terapeuta para `/terapeuta`
 * antes de a página abrir — na prática só supervisão conseguia registrar a
 * 1ª avaliação, mesmo sendo o terapeuta avaliador quem conduz o atendimento
 * agendado no calendário de 1ª avaliação. Mesma tela, mesma action; o que
 * muda é a rota (dentro de `/terapeuta`) e o link de volta.
 */
export default async function TerapeutaAnamnesePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  // Não é avaliador nem foi escalado para a avaliação deste paciente: 404,
  // sem revelar nada sobre o paciente.
  if (!(await canConductFirstAssessment(supabase, user.id, patientId))) notFound();

  await logRecordAccess(supabase, patientId, "anamnese");

  return (
    <main className="flex flex-1 flex-col gap-6 pb-10">
      <PageHeader axisLabel="Terapeuta" title="1ª Avaliação (Anamnese ampliada)" description={patient.full_name} />
      <div className="px-6 sm:px-10">
        <Link href={`/terapeuta/paciente/${patientId}`} className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← Ficha de {patient.full_name}
        </Link>
      </div>
      <div className="px-6 sm:px-10">
        <AnamnesePanel
          patientId={patientId}
          returnHref={`/terapeuta/paciente/${patientId}`}
          tcleHref={`/terapeuta/paciente/${patientId}/anamnese/tcle`}
        />
      </div>
    </main>
  );
}
