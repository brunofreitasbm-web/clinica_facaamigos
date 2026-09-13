"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { getDocumentUrl } from "@/app/recepcao/pacientes/[id]/documents-actions";
import {
  upsertSchoolContact,
  createSchoolMeeting,
  createAtSession,
  createTeacherOrientation,
  generateSchoolReport,
} from "./at-actions";

export type AtPatientData = {
  patientId: string;
  patientName: string;
  school: {
    id: string;
    name: string;
    roleTitle: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    gradeLevel: string | null;
    notes: string | null;
  } | null;
  meetings: { id: string; heldAtLabel: string; minutes: string | null; decisions: string | null }[];
  sessions: {
    id: string;
    dateLabel: string;
    startTime: string;
    endTime: string;
    locationKind: string;
    modalityName: string;
    evolution: string;
  }[];
  modalities: { id: string; name: string }[];
  orientations: { id: string; contactedAt: string; summary: string }[];
  reports: { id: string; uploadedAtLabel: string }[];
};

const LOCATION_LABEL: Record<string, string> = {
  escola: "Escola",
  domicilio: "Domicílio",
  comunidade: "Comunidade",
  outro: "Outro",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
      <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function AtPatientPanel({ data }: { data: AtPatientData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const schoolFormRef = useRef<HTMLFormElement>(null);
  const meetingFormRef = useRef<HTMLFormElement>(null);
  const sessionFormRef = useRef<HTMLFormElement>(null);
  const orientationFormRef = useRef<HTMLFormElement>(null);

  const [locationKind, setLocationKind] = useState<string>("escola");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const run = (action: () => Promise<{ success: boolean; error?: string }>, onSuccess?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Não foi possível concluir a ação.");
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  };

  const handleOpenReport = async (documentId: string) => {
    const result = await getDocumentUrl(documentId);
    if (result.success) window.open(result.url, "_blank");
  };

  return (
    <div className="flex flex-1">
      <PageContainer className="gap-5">
        <div>
          <h1 className="mb-1">{data.patientName}</h1>
          <p className="text-sm text-ink-soft">Acompanhamento Terapêutico (AT) em campo — escola, domicílio ou comunidade.</p>
        </div>

        {error && <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}

        <Section title="Escola">
          {data.school && (
            <div className="mb-4 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              <div><span className="font-medium">Nome:</span> {data.school.name}</div>
              <div><span className="font-medium">Cargo/contato:</span> {data.school.roleTitle ?? "—"}</div>
              <div><span className="font-medium">Telefone:</span> {data.school.phone ?? "—"}</div>
              <div><span className="font-medium">E-mail:</span> {data.school.email ?? "—"}</div>
              <div><span className="font-medium">Endereço:</span> {data.school.address ?? "—"}</div>
              <div><span className="font-medium">Série/turma:</span> {data.school.gradeLevel ?? "—"}</div>
            </div>
          )}
          <form
            ref={schoolFormRef}
            className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2"
            action={(formData) =>
              run(() => upsertSchoolContact(data.patientId, data.school?.id ?? null, formData))
            }
          >
            <input name="name" required placeholder="Nome da escola *" className="input sm:col-span-2" defaultValue={data.school?.name ?? ""} />
            <input name="role_title" placeholder="Cargo do contato (ex: Coordenador Pedagógico)" className="input" defaultValue={data.school?.roleTitle ?? ""} />
            <input name="phone" placeholder="Telefone" className="input" defaultValue={data.school?.phone ?? ""} />
            <input name="email" type="email" placeholder="E-mail" className="input" defaultValue={data.school?.email ?? ""} />
            <input name="address" placeholder="Endereço" className="input" defaultValue={data.school?.address ?? ""} />
            <input name="grade_level" placeholder="Série/turma do aluno" className="input" defaultValue={data.school?.gradeLevel ?? ""} />
            <textarea name="notes" placeholder="Observações" className="input sm:col-span-2" defaultValue={data.school?.notes ?? ""} />
            <button type="submit" disabled={isPending} className="btn btn-primary w-fit sm:col-span-2">
              {data.school ? "Salvar cadastro da escola" : "Cadastrar escola"}
            </button>
          </form>
        </Section>

        <Section title="Reuniões com a escola">
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            {data.meetings.map((m) => (
              <li key={m.id} className="rounded border border-paper-line p-2">
                <div className="font-medium">{m.heldAtLabel}</div>
                <div className="text-ink-soft">{m.minutes}</div>
                {m.decisions && <div className="text-ink-faint">Decisões: {m.decisions}</div>}
              </li>
            ))}
            {data.meetings.length === 0 && <li className="text-ink-faint">Nenhuma reunião registrada ainda.</li>}
          </ul>
          {data.school && (
            <form
              ref={meetingFormRef}
              className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2"
              action={(formData) =>
                run(() => createSchoolMeeting(data.patientId, data.school!.id, formData), () => meetingFormRef.current?.reset())
              }
            >
              <input name="held_at_date" type="date" required className="input" />
              <input name="held_at_time" type="time" className="input" />
              <textarea name="minutes" required placeholder="Ata/resumo da reunião *" className="input sm:col-span-2" />
              <textarea name="decisions" placeholder="Decisões (opcional)" className="input sm:col-span-2" />
              <button type="submit" disabled={isPending} className="btn btn-primary w-fit sm:col-span-2">
                Registrar reunião
              </button>
            </form>
          )}
          {!data.school && <p className="text-xs text-ink-faint">Cadastre a escola primeiro para registrar reuniões.</p>}
        </Section>

        <Section title="Sessões em campo">
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            {data.sessions.map((s) => (
              <li key={s.id} className="rounded border border-paper-line p-2">
                <div className="font-medium">
                  {s.dateLabel} · {s.startTime}–{s.endTime} · {LOCATION_LABEL[s.locationKind] ?? s.locationKind} · {s.modalityName}
                </div>
                <div className="text-ink-soft">{s.evolution}</div>
              </li>
            ))}
            {data.sessions.length === 0 && <li className="text-ink-faint">Nenhuma sessão de AT registrada ainda.</li>}
          </ul>
          {data.modalities.length === 0 ? (
            <p className="text-xs text-ink-faint">
              Nenhuma modalidade de AT cadastrada — peça ao gestor para cadastrar em Cadastros &gt; Modalidades de AT.
            </p>
          ) : (
            <form
              ref={sessionFormRef}
              className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2"
              action={(formData) =>
                run(() => createAtSession(data.patientId, formData), () => sessionFormRef.current?.reset())
              }
            >
              <select name="modality_id" required className="input cursor-pointer">
                {data.modalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <select
                name="location_kind"
                required
                className="input cursor-pointer"
                value={locationKind}
                onChange={(e) => setLocationKind(e.target.value)}
              >
                {Object.entries(LOCATION_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input name="session_date" type="date" required className="input" />
              <div className="flex gap-2">
                <input name="start_time" type="time" required className="input" />
                <input name="end_time" type="time" required className="input" />
              </div>
              {locationKind === "escola" ? (
                data.school ? (
                  <input type="hidden" name="school_contact_id" value={data.school.id} />
                ) : (
                  <p className="col-span-2 text-xs text-status-negative-text">
                    Cadastre a escola acima antes de registrar uma sessão nela.
                  </p>
                )
              ) : (
                <input name="location_detail" placeholder="Endereço/observação do local" className="input sm:col-span-2" />
              )}
              <textarea name="evolution" required placeholder="Evolução do AT *" className="input sm:col-span-2" />
              <button
                type="submit"
                disabled={isPending || (locationKind === "escola" && !data.school)}
                className="btn btn-primary w-fit sm:col-span-2"
              >
                Registrar sessão
              </button>
            </form>
          )}
        </Section>

        <Section title="Orientação de professores">
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            {data.orientations.map((o) => (
              <li key={o.id} className="rounded border border-paper-line p-2">
                <div className="font-medium">{new Date(o.contactedAt).toLocaleString("pt-BR")}</div>
                <div className="text-ink-soft">{o.summary}</div>
              </li>
            ))}
            {data.orientations.length === 0 && <li className="text-ink-faint">Nenhuma orientação registrada ainda.</li>}
          </ul>
          {data.school ? (
            <form
              ref={orientationFormRef}
              className="grid max-w-xl grid-cols-1 gap-2"
              action={(formData) =>
                run(() => createTeacherOrientation(data.patientId, data.school!.id, formData), () => orientationFormRef.current?.reset())
              }
            >
              <textarea name="summary" required placeholder="Orientação dada aos professores *" className="input" />
              <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
                Registrar orientação
              </button>
            </form>
          ) : (
            <p className="text-xs text-ink-faint">Cadastre a escola primeiro para registrar orientações.</p>
          )}
        </Section>

        <Section title="Relatório para a escola">
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            {data.reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-paper-line p-2">
                <span>Emitido em {r.uploadedAtLabel}</span>
                <button type="button" className="btn btn-ghost text-xs" onClick={() => handleOpenReport(r.id)}>
                  Abrir PDF
                </button>
              </li>
            ))}
            {data.reports.length === 0 && <li className="text-ink-faint">Nenhum relatório emitido ainda.</li>}
          </ul>
          {data.school ? (
            <div className="flex max-w-md flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Período — de</label>
                <input type="date" className="input" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">até</label>
                <input type="date" className="input" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
              <button
                type="button"
                disabled={reportBusy || !periodStart || !periodEnd}
                className="btn btn-primary"
                onClick={async () => {
                  setReportBusy(true);
                  setError(null);
                  const result = await generateSchoolReport(data.patientId, data.school!.id, periodStart, periodEnd);
                  setReportBusy(false);
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  router.refresh();
                }}
              >
                {reportBusy ? "Gerando…" : "Gerar relatório (PDF timbrado)"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-ink-faint">Cadastre a escola primeiro para emitir o relatório.</p>
          )}
        </Section>
      </PageContainer>
    </div>
  );
}
