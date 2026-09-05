import { renderToBuffer } from "@react-pdf/renderer";
import { InsurerReportDocument } from "@/lib/insurer-report-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const TEST_PATIENT_ID = "f67ef3a7-0c95-42ce-a86c-624b76fc7abf";

export async function GET() {
  const admin = createAdminClient();

  const { data: patient } = await admin
    .from("patients")
    .select("id, full_name, birth_date, cid")
    .eq("id", TEST_PATIENT_ID)
    .maybeSingle();
  if (!patient) return Response.json({ step: "fetch patient", error: "not found" }, { status: 500 });

  const buf = await renderToBuffer(
    InsurerReportDocument({
      clinicName: "Clínica Teste",
      patientName: patient.full_name,
      birthDate: patient.birth_date,
      cid: patient.cid,
      periodStart: "01/06/2026",
      periodEnd: "31/08/2026",
      sessionsRealized: 5,
      sessionsAbsent: 1,
      goals: [{ description: "Meta de teste smoke", domain: "social", criterion: null, status: "ativa" }],
      generatedByName: "Smoke Test",
      generatedAt: new Date().toLocaleString("pt-BR"),
    }),
  );

  const documentId = randomUUID();
  const storagePath = `${TEST_PATIENT_ID}/${documentId}/smoke-test.pdf`;

  const { error: insertError } = await admin.from("documents").insert({
    id: documentId,
    patient_id: TEST_PATIENT_ID,
    category: "relatorio_evolucao",
    storage_path: storagePath,
    uploaded_by: (await admin.from("profiles").select("id").limit(1).single()).data?.id,
    shared_with_family: false,
  });
  if (insertError) return Response.json({ step: "insert document", error: insertError.message }, { status: 500 });

  const { error: uploadError } = await admin.storage
    .from("clinic-documents")
    .upload(storagePath, buf, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    await admin.from("documents").delete().eq("id", documentId);
    return Response.json({ step: "storage upload", error: uploadError.message }, { status: 500 });
  }

  const { data: signed, error: signError } = await admin.storage
    .from("clinic-documents")
    .createSignedUrl(storagePath, 60);

  // cleanup: remove o documento e o arquivo de teste, não deixar lixo na clínica real
  await admin.storage.from("clinic-documents").remove([storagePath]);
  await admin.from("documents").delete().eq("id", documentId);

  return Response.json({
    success: true,
    bytes: buf.length,
    signedUrlOk: !signError && !!signed?.signedUrl,
  });
}
