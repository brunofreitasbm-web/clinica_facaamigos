import Link from "next/link";
import { notFound } from "next/navigation";
import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { DOCUMENT_CATEGORY_LABEL, getValidityBadge } from "@/lib/document-categories";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { buildWhatsappLink } from "@/lib/whatsapp-message";
import { logRecordAccess } from "@/lib/record-access-log";
import { DocumentViewButton } from "@/app/recepcao/pacientes/[id]/document-view-button";
import {
  PatientManagementPanel,
  type AppointmentRow,
  type ProfessionalRow,
} from "./patient-management-panel";
import type { ConvenioRow, InsurerOption } from "./convenios-panel";
import type { ChargeRow } from "./charges-panel";
import type { PatientTagRow } from "./patient-tags";

export const dynamic = "force-dynamic";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE });

export default async function GestaoPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, full_name, birth_date, status")
    .eq("id", id)
    .maybeSingle();

  if (!patient || patientError) notFound();

  await logRecordAccess(supabase, id, "gestao");

  const [
    { data: guardians },
    { data: tagsRaw },
    { data: insuranceRaw },
    { data: insurersRaw },
    { data: teamRaw },
    { data: chargesRaw },
    { data: appointmentsRaw },
    { data: documents },
  ] = await Promise.all([
    supabase.from("guardians").select("id, full_name, phone, is_financial").eq("patient_id", id),
    supabase.from("patient_tags").select("id, label").eq("patient_id", id).order("created_at"),
    supabase
      .from("patient_insurance")
      .select("id, insurer_id, plan_name, card_number, insurers(name)")
      .eq("patient_id", id),
    supabase.from("insurers").select("id, name").eq("clinic_id", DEV_CLINIC_ID).order("name"),
    supabase
      .from("patient_access")
      .select("id, profile_id, profiles!profile_id(full_name, discipline, council_type)")
      .eq("patient_id", id)
      .eq("access_type", "terapeuta")
      .is("revoked_at", null),
    supabase
      .from("patient_charges")
      .select("id, description, amount, status, due_date, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id, starts_at, status")
      .eq("patient_id", id)
      .order("starts_at", { ascending: false })
      .limit(30),
    supabase
      .from("documents")
      .select("id, category, uploaded_at, valid_until, shared_with_family")
      .eq("patient_id", id)
      .order("uploaded_at", { ascending: false }),
  ]);

  const primaryGuardian =
    (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0] ?? null;

  const tags: PatientTagRow[] = (tagsRaw ?? []).map((t) => ({ id: t.id, label: t.label }));

  const convenios: ConvenioRow[] = (insuranceRaw ?? []).map((pi) => ({
    id: pi.id,
    insurerId: pi.insurer_id ?? "",
    insurerName:
      (Array.isArray(pi.insurers) ? pi.insurers[0]?.name : pi.insurers?.name) ?? "Convênio sem nome",
    planName: pi.plan_name,
    cardNumber: pi.card_number,
  }));

  const insurers: InsurerOption[] = insurersRaw ?? [];

  const professionals: ProfessionalRow[] = (teamRaw ?? []).map((t) => {
    const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
    return {
      id: t.id,
      name: profile?.full_name ?? "—",
      disciplineLabel: profile?.discipline ?? profile?.council_type ?? "Terapeuta",
    };
  });

  const charges: ChargeRow[] = (chargesRaw ?? []).map((c) => ({
    id: c.id,
    description: c.description,
    amount: Number(c.amount),
    status: c.status as ChargeRow["status"],
    dueDateLabel: c.due_date ? fmtDate(`${c.due_date}T00:00:00`) : null,
    createdAtLabel: fmtDate(c.created_at),
  }));

  const appointments: AppointmentRow[] = (appointmentsRaw ?? []).map((a) => {
    const style = APPOINTMENT_STATUS_STYLE[a.status] ?? APPOINTMENT_STATUS_STYLE.agendada;
    return {
      id: a.id,
      dateLabel: fmtDate(a.starts_at),
      statusLabel: style.label,
      statusTagClass: style.tagClass,
    };
  });

  const documentsContent = (
    <table className="table">
      <thead>
        <tr>
          <th>Documento</th>
          <th>Categoria</th>
          <th>Data</th>
          <th>Visível à família</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {(documents ?? []).map((doc) => {
          const validityBadge = getValidityBadge(doc.valid_until);
          return (
            <tr key={doc.id}>
              <td className="font-semibold">
                {DOCUMENT_CATEGORY_LABEL[doc.category] ?? doc.category}
                {validityBadge && (
                  <span
                    className={`tag-status ml-2 ${validityBadge.label === "Vencido" ? "st-falta" : "st-agendada"}`}
                  >
                    {validityBadge.label}
                  </span>
                )}
              </td>
              <td>{doc.category}</td>
              <td>
                {fmtDate(doc.uploaded_at)}
                {doc.valid_until && ` · válido até ${fmtDate(`${doc.valid_until}T00:00:00`)}`}
              </td>
              <td>{doc.shared_with_family ? "Sim" : "Não"}</td>
              <td className="text-right">
                <DocumentViewButton documentId={doc.id} />
              </td>
            </tr>
          );
        })}
        {(documents ?? []).length === 0 && (
          <tr>
            <td colSpan={5} className="text-ink-faint">
              Nenhum documento anexado.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const whatsappHref = primaryGuardian?.phone
    ? buildWhatsappLink(primaryGuardian.phone, `Olá ${primaryGuardian.full_name}! `)
    : null;

  return (
    <main className="flex flex-1 flex-col">
      <GestorNav active="cadastros" />

      <div className="px-10 pt-9">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
          <Link href="/gestor/cadastros">Pacientes</Link>
        </h6>
      </div>

      <PatientManagementPanel
        patientId={patient.id}
        fullName={patient.full_name}
        birthDate={patient.birth_date}
        birthDateLabel={fmtDate(`${patient.birth_date}T00:00:00`)}
        phone={primaryGuardian?.phone ?? null}
        guardianId={primaryGuardian?.id ?? null}
        isArchived={patient.status === "arquivado"}
        whatsappHref={whatsappHref}
        tags={tags}
        convenios={convenios}
        insurers={insurers}
        professionals={professionals}
        charges={charges}
        appointments={appointments}
        documentsContent={documentsContent}
      />
    </main>
  );
}
