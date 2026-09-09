"use client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function submitAnamnese(patientId: string, formData: FormData) {
  // Usamos admin client para garantir que o envio público tenha permissão de gravação
  const supabase = createAdminClient();
  
  const nomePaciente = formData.get("nome_paciente")?.toString() || "";
  const dataNascimento = formData.get("data_nascimento")?.toString() || "";
  
  const nomeMae = formData.get("nome_mae")?.toString() || "";
  const whatsappMae = formData.get("whatsapp_mae")?.toString() || "";
  
  const nomePai = formData.get("nome_pai")?.toString() || "";
  const whatsappPai = formData.get("whatsapp_pai")?.toString() || "";
  
  const email = formData.get("email")?.toString() || "";
  const endereco = formData.get("endereco")?.toString() || "";
  
  const queixa = formData.get("queixa_principal")?.toString() || "";

  // 1. Atualizar dados do Paciente
  const patientUpdate: any = {};
  if (nomePaciente) patientUpdate.name = nomePaciente;
  if (dataNascimento) patientUpdate.birth_date = dataNascimento;
  
  if (Object.keys(patientUpdate).length > 0) {
    await supabase.from("patients").update(patientUpdate).eq("id", patientId);
  }

  // 2. Atualizar ou Criar Responsáveis (Mãe e Pai)
  // Busca os responsáveis atuais do paciente
  const { data: guardians } = await supabase.from("guardians").select("*").eq("patient_id", patientId);
  
  // Tenta achar a mãe ou cria uma nova
  if (nomeMae || whatsappMae) {
    const mae = guardians?.find(g => g.name?.toLowerCase().includes("mãe") || g.name === nomeMae);
    if (mae) {
      await supabase.from("guardians").update({
        name: nomeMae || mae.name,
        phone: whatsappMae || mae.phone,
        email: email || mae.email, // Atribui o email à mãe por padrão
        address: endereco || mae.address,
      }).eq("id", mae.id);
    } else {
      await supabase.from("guardians").insert({
        patient_id: patientId,
        name: nomeMae || "Mãe",
        phone: whatsappMae,
        email: email,
        address: endereco,
        is_financial: true // mãe como financeira por padrão se criar agora
      });
    }
  }

  // Tenta achar o pai ou cria um novo
  if (nomePai || whatsappPai) {
    const pai = guardians?.find(g => g.name?.toLowerCase().includes("pai") || g.name === nomePai);
    if (pai) {
      await supabase.from("guardians").update({
        name: nomePai || pai.name,
        phone: whatsappPai || pai.phone,
      }).eq("id", pai.id);
    } else {
      await supabase.from("guardians").insert({
        patient_id: patientId,
        name: nomePai || "Pai",
        phone: whatsappPai,
      });
    }
  }

  // 3. Registrar a Queixa Principal no Prontuário (session_notes)
  const noteContent = `
    <h1>Pré-Anamnese (Preenchida via Portal da Família)</h1>
    <p><strong>Dados de Contato Atualizados:</strong> Email: ${email || 'Não informado'} | Endereço: ${endereco || 'Não informado'}</p>
    <hr/>
    <h2>Queixa Principal / Motivo da Busca</h2>
    <p>${queixa}</p>
  `;

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
