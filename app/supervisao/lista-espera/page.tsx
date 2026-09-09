import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { Users, Clock, Send } from "lucide-react";
import Link from "next/link";
import { NewEntryDialog } from "./new-entry-dialog";
import { EntryRowActions } from "./entry-row-actions";
import { BrandLockup } from "@/components/brand/brand-lockup";

export const dynamic = "force-dynamic";

const SHIFT_LABEL: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  qualquer: "Qualquer turno",
};

const STATUS_LABEL: Record<string, string> = {
  aguardando: "Aguardando",
  oferecido: "Vaga Oferecida",
  agendado: "Agendado",
  desistiu: "Desistiu",
  cancelado: "Cancelado",
};

const STATUS_TAG: Record<string, string> = {
  aguardando: "st-agendada",
  oferecido: "st-em-atendimento",
  agendado: "st-realizada",
  desistiu: "st-cancelada",
  cancelado: "st-cancelada",
};

function daysWaiting(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
}

export default async function ListaEsperaPage() {
  const supabase = await createClient();

  const [{ data: entryRows }, { data: patientRows }, { data: specialtyRows }, { data: insurerRows }] = await Promise.all([
    supabase
      .from("waitlist_entries")
      .select("id, specialty_value, preferred_shift, priority, status, notes, created_at, offered_at, patients(full_name), insurers(name)")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("patients")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .in("status", ["avaliacao", "ativo"])
      .order("full_name", { ascending: true }),
    supabase.from("specialties").select("value, label").eq("clinic_id", DEV_CLINIC_ID).eq("active", true).order("sort_order"),
    supabase.from("insurers").select("id, name").eq("clinic_id", DEV_CLINIC_ID).order("name"),
  ]);

  const entries = entryRows ?? [];
  const waiting = entries.filter((e) => e.status === "aguardando");
  const offered = entries.filter((e) => e.status === "oferecido");
  const avgWaitDays =
    waiting.length > 0 ? Math.round(waiting.reduce((sum, e) => sum + daysWaiting(e.created_at), 0) / waiting.length) : null;

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <header style={{ background: "var(--color-accent)", color: "var(--color-bg)" }} className="flex h-16 items-center justify-between px-10">
        <BrandLockup module="Lista de Espera" href="/supervisao" />
        <Link href="/supervisao" className="btn btn-secondary text-xs">
          Voltar para Supervisão
        </Link>
      </header>

      <div className="flex flex-col gap-8 px-10 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Gestão de Capacidade
            </h6>
            <h1 className="m-0">Lista de Espera por Especialidade</h1>
          </div>
          <NewEntryDialog
            patients={patientRows ?? []}
            specialties={specialtyRows ?? []}
            insurers={insurerRows ?? []}
          />
        </div>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Users size={18} className="text-blue-600" /> Aguardando Vaga
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {waiting.length} paciente{waiting.length === 1 ? "" : "s"}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Na fila ordenada por prioridade</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Clock size={18} className="text-amber-500" /> Tempo Médio de Espera
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {avgWaitDays === null ? "—" : `${avgWaitDays} dias`}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Entre entrada na fila e hoje, para quem ainda aguarda</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Send size={18} className="text-emerald-500" /> Vagas Oferecidas
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent-2-600)" }}>
              {offered.length}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Aguardando confirmação da família</span>
          </div>
        </section>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Fila Completa</h3>

          {entries.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhum paciente na lista de espera no momento.</p>
          ) : (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Especialidade</th>
                  <th>Convênio</th>
                  <th>Turno</th>
                  <th>Prioridade</th>
                  <th>Espera</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="font-semibold">{(e.patients as any)?.full_name ?? "—"}</td>
                    <td className="text-xs">{e.specialty_value}</td>
                    <td className="text-xs text-ink-faint">{(e.insurers as any)?.name ?? "Particular"}</td>
                    <td className="text-xs">{SHIFT_LABEL[e.preferred_shift] ?? e.preferred_shift}</td>
                    <td className="tabular-figure text-xs font-bold">{e.priority}</td>
                    <td className="tabular-figure text-xs text-ink-faint">{daysWaiting(e.created_at)} dias</td>
                    <td>
                      <span className={`tag-status ${STATUS_TAG[e.status] ?? "st-agendada"}`}>{STATUS_LABEL[e.status] ?? e.status}</span>
                    </td>
                    <td>
                      <EntryRowActions entryId={e.id} status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
