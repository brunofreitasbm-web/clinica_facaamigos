"use client";

import { useState } from "react";
import { EditBasicsForm } from "./gestao/edit-basics-form";

export function EditRegistrationButton({
  patientId,
  fullName,
  birthDate,
  phone,
  guardianId,
  complaint,
  cid,
  supportLevel,
  entrySource,
}: {
  patientId: string;
  fullName: string;
  birthDate: string;
  phone: string | null;
  guardianId: string | null;
  complaint: string | null;
  cid: string | null;
  supportLevel: string | null;
  entrySource: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="w-full basis-full">
        <EditBasicsForm
          patientId={patientId}
          fullName={fullName}
          birthDate={birthDate}
          phone={phone}
          guardianId={guardianId}
          complaint={complaint}
          cid={cid}
          supportLevel={supportLevel}
          entrySource={entrySource}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
      Editar cadastro
    </button>
  );
}
