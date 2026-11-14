import { ProntuarioUnificadoView } from "@/app/supervisao/prontuario-unificado/page";

export const dynamic = "force-dynamic";

// Prontuário unificado (visão geral, evolução, ABA, plano, documentos, agenda,
// financeiro) do paciente da rota, sem o seletor de paciente.
export default async function TerapeuticaTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProntuarioUnificadoView patientId={id} embedded />;
}
