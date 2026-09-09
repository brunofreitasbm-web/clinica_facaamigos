import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getPatientProtocolTabs } from "@/lib/protocol-assessments";
import { ProtocolAssessmentPanel } from "@/components/protocol-assessment-panel";
import { logRecordAccess } from "@/lib/record-access-log";
import { findProtocolCatalogEntry, PROTOCOL_LABEL } from "@/lib/protocol-catalog";
import { hasProtocolTemplate } from "@/lib/protocol-templates";

export const dynamic = "force-dynamic";

export default async function PatientAssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ protocolo?: string }>;
}) {
  const { patientId } = await params;
  const { protocolo } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS de patients (patients_read) já garante que só quem tem acesso ao
  // paciente (terapeuta vinculado, supervisor, gestor) chega aqui.
  const { data: patient } = await supabase.from("patients").select("id, clinic_id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  await logRecordAccess(supabase, patientId, "avaliacao_protocolo");

  const protocols = await getPatientProtocolTabs(supabase, patient.clinic_id, patientId);

  // Botões de protocolo aparecem sempre (como os instrumentos nativos),
  // mesmo antes do gestor cadastrar os itens do checklist em Cadastros →
  // Terapias — ver `native-instruments.ts`. `protocolo` pode chegar como o
  // id real (protocolo já configurado) ou a chave do catálogo (botão
  // "genérico" que ainda não tem itens nesta clínica).
  const requestedEntry = protocolo ? findProtocolCatalogEntry(protocolo) : undefined;
  const requestedConfigured = protocols.some((p) => p.id === protocolo || p.name === protocolo);
  const showNotConfigured = !!protocolo && !!requestedEntry && !requestedConfigured;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Avaliação de protocolo — ${patient.full_name}`}
        description="Checklist de marcos do protocolo cadastrado (licenciado ou de estrutura genérica), pontuado a cada aplicação, com evolução por domínio."
      />
      <div className="px-6 sm:px-10">
        <Link href={`/terapeuta/paciente/${patient.id}/fono`} className="btn btn-secondary w-fit">
          Avaliação fono (ADL/ADL-2/PROC)
        </Link>
      </div>
      <div className="p-6 sm:p-10">
        {showNotConfigured ? (
          <div className="card">
            <p className="text-base text-ink-soft">
              {PROTOCOL_LABEL[requestedEntry!.name] ?? requestedEntry!.name} ainda não tem os itens do checklist
              cadastrados nesta clínica.
            </p>
            <p className="text-base text-ink-faint">
              Peça ao gestor para cadastrar os marcos em{" "}
              <Link href="/gestor/cadastros/protocolos" className="underline">
                Cadastros → Protocolos
              </Link>
              .
            </p>
            {requestedEntry && hasProtocolTemplate(requestedEntry.name) && (
              <p className="text-base text-ink-faint">
                Este protocolo tem uma estrutura genérica configurável disponível — o gestor pode cadastrá-la em poucos cliques, sem precisar digitar os itens um a um.
              </p>
            )}
          </div>
        ) : (
          <ProtocolAssessmentPanel patientId={patient.id} protocols={protocols} initialProtocolId={protocolo} />
        )}
      </div>
    </main>
  );
}
