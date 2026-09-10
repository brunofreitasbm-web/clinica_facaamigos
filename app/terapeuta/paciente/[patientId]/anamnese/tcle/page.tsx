import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canConductFirstAssessment } from "@/lib/anamnese-access";
import { getTcleContext } from "@/lib/tcle";
import { TcleDocument } from "@/components/tcle-document";
import { logRecordAccess } from "@/lib/record-access-log";

export const dynamic = "force-dynamic";

/**
 * TCLE impresso pela porta do terapeuta avaliador — mesmo guard da 1ª
 * avaliação (lib/anamnese-access.ts): quem conduz o acolhimento é quem colhe
 * a assinatura do responsável no fim dele.
 */
export default async function TerapeutaTclePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await canConductFirstAssessment(supabase, user.id, patientId))) notFound();

  const ctx = await getTcleContext(supabase, patientId, user.id);
  if (!ctx) notFound();

  await logRecordAccess(supabase, patientId, "tcle");

  return <TcleDocument ctx={ctx} backHref={`/terapeuta/paciente/${patientId}/anamnese`} />;
}
