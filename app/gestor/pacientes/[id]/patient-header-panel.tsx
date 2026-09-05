"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, MessageCircle, Pencil, Stethoscope } from "lucide-react";
import { PatientTags, type PatientTagRow } from "./patient-tags";
import { EditBasicsForm } from "./edit-basics-form";
import { setPatientArchived } from "./actions";

export function PatientHeaderPanel({
  patientId,
  fullName,
  birthDate,
  phone,
  guardianId,
  isArchived,
  whatsappHref,
  tags,
  onCobrar,
}: {
  patientId: string;
  fullName: string;
  birthDate: string;
  phone: string | null;
  guardianId: string | null;
  isArchived: boolean;
  whatsappHref: string | null;
  tags: PatientTagRow[];
  onCobrar: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex flex-col gap-5 px-10 pt-9">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold"
            style={{
              background: "var(--color-accent-100)",
              color: "var(--color-accent-700)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {initials || "?"}
          </span>
          <h1 className="m-0">
            {fullName}
            {isArchived && <span className="tag-status st-cancelada ml-3 align-middle text-xs">Arquivado</span>}
          </h1>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            aria-label="Editar cadastro"
            className="btn btn-secondary btn-icon"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            aria-label={isArchived ? "Reativar paciente" : "Arquivar paciente"}
            disabled={isPending}
            className="btn btn-secondary btn-icon"
            onClick={() => {
              const message = isArchived
                ? "Reativar este paciente?"
                : "Arquivar este paciente? Ele deixa de aparecer nas listas ativas.";
              if (confirm(message)) {
                startTransition(() => { setPatientArchived(patientId, !isArchived); });
              }
            }}
          >
            {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Conversar no WhatsApp"
              className="btn btn-secondary btn-icon"
            >
              <MessageCircle size={16} />
            </a>
          )}
          <button type="button" className="btn btn-secondary" onClick={onCobrar}>
            Cobrar
          </button>
          <Link href={`/recepcao/pacientes/${patientId}`} className="btn btn-primary">
            <Stethoscope size={16} />
            Prontuário
          </Link>
        </div>
      </div>

      {editing && (
        <EditBasicsForm
          patientId={patientId}
          fullName={fullName}
          birthDate={birthDate}
          phone={phone}
          guardianId={guardianId}
          onDone={() => setEditing(false)}
        />
      )}

      <PatientTags patientId={patientId} tags={tags} />
    </div>
  );
}
