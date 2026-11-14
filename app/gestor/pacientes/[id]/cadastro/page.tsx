import GestaoPacientePage from "@/app/recepcao/pacientes/[id]/gestao/page";

export const dynamic = "force-dynamic";

// Cadastro e gestão (dados, responsáveis, convênios, cobranças, equipe):
// mesma tela da Recepção, aqui como uma aba do hub do paciente.
export default function CadastroTab({ params }: { params: Promise<{ id: string }> }) {
  return <GestaoPacientePage params={params} />;
}
