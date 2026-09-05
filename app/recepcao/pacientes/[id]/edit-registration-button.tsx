"use client";

import { useState } from "react";
import { EditBasicsForm } from "@/app/gestor/pacientes/[id]/edit-basics-form";

export function EditRegistrationButton({
  patientId,
  fullName,
  birthDate,
  phone,
  guardianId,
}: {
  patientId: string;
  fullName: string;
  birthDate: string;
  phone: string | null;
  guardianId: string | null;
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
