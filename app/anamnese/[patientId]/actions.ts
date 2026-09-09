"use client";
import { createClient } from "@/lib/supabase/client";

export async function submitAnamnese(patientId: string, formData: FormData) {
  const supabase = createClient();
  
  const queixa = formData.get("queixa_principal")?.toString() || "";
  const complicacoes = formData.get("complicacoes_gravidez")?.toString() || "";
  const parto = formData.get("tipo_parto")?.toString() || "";
  const andou = formData.get("idade_andou")?.toString() || "";
  const falou = formData.get("idade_falou")?.toString() || "";
  const sentou = formData.get("idade_sentou")?.toString() || "";
  const rotina = formData.get("rotina_sono_alimentacao")?.toString() || "";
  const dinamica = formData.get("dinamica_familiar")?.toString() || "";

  const noteContent = `
    <h1>Pré-Anamnese Preenchida via Portal</h1>
    <h2>1. Queixa Principal</h2>
    <p>${queixa}</p>
    <h2>2. Histórico Gestacional e Neonatal</h2>
    <p>Complicações: ${complicacoes}</p>
    <p>Parto: ${parto}</p>
    <h2>3. Desenvolvimento Motor e Fala</h2>
    <p>Sentou: ${sentou} | Andou: ${andou} | Falou: ${falou}</p>
    <h2>4. Rotina e Dinâmica Familiar</h2>
    <p>Rotina: ${rotina}</p>
    <p>Dinâmica: ${dinamica}</p>
  `;

  // Salva no sistema como uma evolução/nota
  const { error } = await supabase.from("session_notes").insert({
    patient_id: patientId,
    content: noteContent,
    status: "finalizada",
    signed_at: new Date().toISOString()
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
