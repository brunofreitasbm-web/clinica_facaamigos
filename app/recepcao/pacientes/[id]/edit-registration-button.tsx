"use client";

import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { EditBasicsForm } from "./gestao/edit-basics-form";

export function EditRegistrationButton({
  kicker,
  patientId,
  fullName,
  birthDate,
  phone,
  guardianId,
  complaint,
  cid,
  supportLevel,
  medication,
  allergies,
  comorbidities,
  entrySource,
}: {
  /** Linha acima do nome (nascimento · plano · guia). */
  kicker?: ReactNode;
  patientId: string;
  fullName: string;
  birthDate: string;
  phone: string | null;
  guardianId: string | null;
  complaint: string | null;
  cid: string | null;
  supportLevel: string | null;
  medication: string | null;
  allergies: string | null;
  comorbidities: string | null;
  entrySource: string | null;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div>
        {kicker}
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-ink">{fullName}</h1>
          <button
            type="button"
            aria-label="Editar cadastro"
            title="Editar cadastro"
            aria-pressed={editing}
            onClick={() => setEditing((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-paper-line hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 cursor-pointer"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {editing && (
        <div className="order-last w-full basis-full">
          <EditBasicsForm
          patientId={patientId}
          fullName={fullName}
          birthDate={birthDate}
          phone={phone}
          guardianId={guardianId}
          complaint={complaint}
          cid={cid}
          supportLevel={supportLevel}
          medication={medication}
          allergies={allergies}
          comorbidities={comorbidities}
          entrySource={entrySource}
          onDone={() => setEditing(false)}
          />
        </div>
      )}
    </>
  );
}
