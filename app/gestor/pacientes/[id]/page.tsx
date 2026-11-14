import { redirect } from "next/navigation";

export default async function PacienteHubIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/gestor/pacientes/${id}/cadastro`);
}
