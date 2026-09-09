import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { AnamneseForm } from "./anamnese-form";

export const metadata = {
  title: "Formulário de Anamnese | Faça Amigos",
};

export default async function AnamnesePage({ params }: { params: { patientId: string } }) {
  const admin = createAdminClient();
  const { data: patient, error } = await admin
    .from("patients")
    .select("*, guardians(*)")
    .eq("id", params.patientId)
    .maybeSingle();

  if (error || !patient) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Formulário de Pré-Anamnese</h2>
          <p className="mt-2 text-sm text-gray-500">
            Olá, família do(a) <strong>{patient.name}</strong>! Preencha este formulário para nos ajudar a conhecer melhor a criança antes do primeiro atendimento.
          </p>
        </div>
        
        <AnamneseForm patient={patient} />
      </div>
    </div>
  );
}
