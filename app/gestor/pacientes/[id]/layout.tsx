import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PatientHubNav } from "./patient-hub-nav";

/**
 * Hub do paciente: um paciente, todas as informações, organizadas em
 * submenus (Cadastro, Anamnese, Terapêutica & Documentos). A identidade e o
 * submenu vivem aqui, no layout, para persistir entre as abas.
 */
export default async function PacienteHubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", id).maybeSingle();
  if (!patient) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="px-6 pt-3 sm:px-10">
        <Link href="/gestor/pacientes" className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← Pacientes
        </Link>
        <h1 className="m-0 mt-1">{patient.full_name}</h1>
      </div>
      <PatientHubNav patientId={id} />
      {children}
    </div>
  );
}
