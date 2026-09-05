"use client";

import { useState } from "react";
import { PatientHeaderPanel } from "./patient-header-panel";
import { ConveniosPanel, type ConvenioRow, type InsurerOption } from "./convenios-panel";
import { ChargesPanel, type ChargeRow } from "./charges-panel";
import type { PatientTagRow } from "./patient-tags";

export type ProfessionalRow = { id: string; name: string; disciplineLabel: string };
export type AppointmentRow = { id: string; dateLabel: string; statusLabel: string; statusTagClass: string };

const TABS = [
  { key: "visao", label: "Visão Geral" },
  { key: "cobrancas", label: "Cobranças" },
  { key: "atendimentos", label: "Atendimentos" },
  { key: "documentos", label: "Documentos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function PatientManagementPanel({
  patientId,
  fullName,
  birthDate,
  birthDateLabel,
  phone,
  guardianId,
  isArchived,
  whatsappHref,
  tags,
  convenios,
  insurers,
  professionals,
  charges,
  appointments,
  documentsContent,
}: {
  patientId: string;
  fullName: string;
  birthDate: string;
  birthDateLabel: string;
  phone: string | null;
  guardianId: string | null;
  isArchived: boolean;
  whatsappHref: string | null;
  tags: PatientTagRow[];
  convenios: ConvenioRow[];
  insurers: InsurerOption[];
  professionals: ProfessionalRow[];
  charges: ChargeRow[];
  appointments: AppointmentRow[];
  documentsContent: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("visao");
  const [chargeFormOpen, setChargeFormOpen] = useState(false);

  return (
    <>
      <PatientHeaderPanel
        patientId={patientId}
        fullName={fullName}
        birthDate={birthDate}
        phone={phone}
        guardianId={guardianId}
        isArchived={isArchived}
        whatsappHref={whatsappHref}
        tags={tags}
        onCobrar={() => {
          setTab("cobrancas");
          setChargeFormOpen(true);
        }}
      />

      <div className="px-10 pt-6">
        <div className="seg w-fit">
          {TABS.map((t) => (
            <label key={t.key} className="seg-opt">
              <input type="radio" name="patient-tab" checked={tab === t.key} onChange={() => setTab(t.key)} />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-8 px-10 pb-16 pt-6">
        {tab === "visao" && (
          <div className="flex flex-wrap gap-8">
            <div className="card max-w-[420px]">
              <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
                Dados Gerais
              </h6>
              <div className="text-sm">
                <div className="font-semibold">Telefone</div>
                <div className="text-ink-soft">{phone ?? "—"}</div>
              </div>
              <div className="text-sm">
                <div className="font-semibold">Data de Nascimento</div>
                <div className="text-ink-soft">{birthDateLabel}</div>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              <ConveniosPanel patientId={patientId} convenios={convenios} insurers={insurers} />

              <div className="card max-w-[520px]">
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
                  Profissionais
                </h6>
                <div className="flex flex-wrap gap-5">
                  {professionals.map((p) => {
                    const initials = p.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("");
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
                          style={{
                            background: "var(--color-accent-2-100)",
                            color: "var(--color-accent-2-700)",
                            fontFamily: "var(--font-heading)",
                          }}
                        >
                          {initials || "?"}
                        </span>
                        <div className="text-sm">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-ink-faint">{p.disciplineLabel}</div>
                        </div>
                      </div>
                    );
                  })}
                  {professionals.length === 0 && (
                    <p className="text-sm text-ink-faint">Nenhum profissional vinculado ainda.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "cobrancas" && (
          <ChargesPanel
            patientId={patientId}
            charges={charges}
            open={chargeFormOpen}
            onOpenChange={setChargeFormOpen}
          />
        )}

        {tab === "atendimentos" && (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td>{a.dateLabel}</td>
                  <td>
                    <span className={`tag-status ${a.statusTagClass}`}>{a.statusLabel}</span>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-ink-faint">
                    Nenhum atendimento registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "documentos" && documentsContent}
      </div>
    </>
  );
}
