import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTcleContext } from "@/lib/tcle";
import { TcleDocument } from "@/components/tcle-document";
import { logRecordAccess } from "@/lib/record-access-log";

export const dynamic = "force-dynamic";

/**
 * TCLE impresso — último passo da 1ª avaliação/acolhimento, pela porta da
 * supervisão. A mesma folha existe em `/terapeuta/paciente/[patientId]/anamnese/tcle`
 * porque o guard de papel não deixa terapeuta entrar em `/supervisao`.
 */
export default async function TclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getTcleContext(supabase, id, user.id);
  if (!ctx) notFound();

  await logRecordAccess(supabase, id, "tcle");

  return <TcleDocument ctx={ctx} backHref={`/supervisao/pacientes/${id}/anamnese`} />;
}
