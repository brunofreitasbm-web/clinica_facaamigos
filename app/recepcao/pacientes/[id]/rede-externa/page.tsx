import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { logRecordAccess } from "@/lib/record-access-log";
import { NewContactDialog } from "./new-contact-dialog";
import { LogContactDialog } from "./log-contact-dialog";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  escola: "Escola",
  medico: "Médico",
  outro_profissional: "Outro Profissional",
};

const CHANNEL_LABEL: Record<string, string> = {
  telefone: "Telefone",
  email: "E-mail",
  reuniao: "Reunião",
  relatorio_compartilhado: "Relatório Compartilhado",
  outro: "Outro",
};

export default async function RedeExternaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("id", id)
    .maybeSingle();

  if (!patient || patientError) notFound();

  await logRecordAccess(supabase, patient.id, "rede_externa");

  const { data: contacts } = await supabase
    .from("external_contacts")
    .select("id, kind, name, role_title, phone, email, notes, external_contact_logs(id, channel, summary, contacted_at, profiles!contacted_by(full_name))")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false });

  const contactList = contacts ?? [];

  return (
    <main className="flex flex-1 flex-col" style={{ background: "var(--color-bg)" }}>
      <PageContainer className="gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              {patient.full_name}
            </h6>
            <h1 className="m-0">Rede Externa</h1>
          </div>
          <div className="flex gap-3">
            <Link href={`/recepcao/pacientes/${patient.id}`} className="btn btn-secondary">
              Voltar ao prontuário
            </Link>
            <NewContactDialog patientId={patient.id} />
          </div>
        </div>

        {contactList.length === 0 ? (
          <div className="rounded-xl border p-8 text-center text-sm text-ink-faint" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            Nenhum contato externo cadastrado para este paciente ainda.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {contactList.map((c) => {
              const logs = (c.external_contact_logs ?? []).slice().sort(
                (a: any, b: any) => new Date(b.contacted_at).getTime() - new Date(a.contacted_at).getTime()
              );
              return (
                <section key={c.id} className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="tag-status st-agendada">{KIND_LABEL[c.kind] ?? c.kind}</span>
                        <h3 className="m-0">{c.name}</h3>
                      </div>
                      {c.role_title && <p className="text-xs text-ink-faint mt-1">{c.role_title}</p>}
                      <p className="text-xs text-ink-faint mt-1">
                        {c.phone && <span>{c.phone}</span>}
                        {c.phone && c.email && <span> · </span>}
                        {c.email && <span>{c.email}</span>}
                      </p>
                      {c.notes && <p className="text-xs text-ink-soft mt-2">{c.notes}</p>}
                    </div>
                    <LogContactDialog patientId={patient.id} externalContactId={c.id} contactName={c.name} />
                  </div>

                  {logs.length > 0 && (
                    <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--color-neutral-200)" }}>
                      {logs.map((log: any) => {
                        const author = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
                        return (
                          <div key={log.id} className="text-xs">
                            <span className="font-semibold">{CHANNEL_LABEL[log.channel] ?? log.channel}</span>{" "}
                            <span className="text-ink-faint">
                              — {new Date(log.contacted_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })} por {author?.full_name ?? "—"}
                            </span>
                            <p className="text-ink-soft mt-0.5">{log.summary}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </PageContainer>
    </main>
  );
}
