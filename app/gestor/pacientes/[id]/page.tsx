import { redirect } from "next/navigation";

/**
 * Cadastro/gestão do paciente (tags, convênio, cobranças, equipe) foi
 * consolidado dentro do prontuário único da Recepção — evita duas fichas
 * de paciente mantidas em paralelo.
 */
export default async function GestaoPacienteRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/recepcao/pacientes/${id}/gestao`);
}
