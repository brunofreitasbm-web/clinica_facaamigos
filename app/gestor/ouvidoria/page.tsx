import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { GestorNav } from "@/components/gestor-nav";
import { AuditoriaSubnav } from "@/components/auditoria-subnav";
import { AlertTriangle, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { NewIncidentDialog } from "./new-incident-dialog";
import { IncidentStatusForm } from "./incident-status-form";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  reclamacao: "Reclamação",
  evento_adverso: "Evento Adverso",
  nao_conformidade: "Não Conformidade",
};

const SEVERITY_TAG: Record<string, string> = {
  baixa: "st-agendada",
  media: "st-agendada",
  alta: "st-falta",
  critica: "st-falta",
};

const SEVERITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_analise: "Em Análise",
  plano_de_acao: "Plano de Ação",
  resolvido: "Resolvido",
  arquivado: "Arquivado",
};

const STATUS_TAG: Record<string, string> = {
  aberto: "st-falta",
  em_analise: "st-agendada",
  plano_de_acao: "st-agendada",
  resolvido: "st-realizada",
  arquivado: "st-cancelada",
};

export default async function OuvidoriaPage() {
  const supabase = await createClient();

  const [{ data: incidentRows }, { data: patientRows }] = await Promise.all([
    supabase
      .from("incident_reports")
      .select("id, kind, severity, description, occurred_at, status, action_plan, patients(full_name), profiles!reported_by(full_name)")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("occurred_at", { ascending: false }),
    supabase.from("patients").select("id, full_name").eq("clinic_id", DEV_CLINIC_ID).order("full_name"),
  ]);

  const incidents = incidentRows ?? [];
  const open = incidents.filter((i) => i.status === "aberto" || i.status === "em_analise" || i.status === "plano_de_acao");
  const critical = incidents.filter((i) => i.severity === "critica" && i.status !== "resolvido" && i.status !== "arquivado");
  const adverseEvents = incidents.filter((i) => i.kind === "evento_adverso");

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <GestorNav active="auditoria" />
      <AuditoriaSubnav activeTab="ouvidoria" />

      <PageContainer>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Qualidade & Compliance
            </h6>
            <h1 className="m-0">Ouvidoria, Incidentes e Não Conformidades</h1>
          </div>
          <NewIncidentDialog patients={patientRows ?? []} />
        </div>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <MessageSquareWarning size={18} className="text-amber-500" /> Registros Abertos
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {open.length}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Aberto, em análise ou com plano de ação</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <ShieldAlert size={18} className="text-red-500" /> Gravidade Crítica em Aberto
            </div>
            <div
              className="tabular-figure text-3xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: critical.length > 0 ? "var(--status-falta)" : "var(--status-realizada)" }}
            >
              {critical.length}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Priorizar tratamento imediato</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <AlertTriangle size={18} className="text-blue-600" /> Eventos Adversos (total)
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {adverseEvents.length}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Quedas, crises comportamentais, acidentes</span>
          </div>
        </section>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Todos os Registros</h3>

          {incidents.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhum registro de ouvidoria até o momento.</p>
          ) : (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Gravidade</th>
                  <th>Paciente</th>
                  <th>Descrição</th>
                  <th>Reportado por</th>
                  <th>Ocorrido em</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td className="text-xs font-semibold">{KIND_LABEL[i.kind] ?? i.kind}</td>
                    <td>
                      <span className={`tag-status ${SEVERITY_TAG[i.severity] ?? "st-agendada"}`}>{SEVERITY_LABEL[i.severity] ?? i.severity}</span>
                    </td>
                    <td className="text-xs">{(i.patients as any)?.full_name ?? "—"}</td>
                    <td className="max-w-xs truncate text-xs text-ink-soft" title={i.description}>
                      {i.description}
                    </td>
                    <td className="text-xs text-ink-faint">{(i.profiles as any)?.full_name ?? "—"}</td>
                    <td className="tabular-figure text-xs text-ink-faint">
                      {new Date(i.occurred_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                    </td>
                    <td>
                      <span className={`tag-status ${STATUS_TAG[i.status] ?? "st-agendada"}`}>{STATUS_LABEL[i.status] ?? i.status}</span>
                    </td>
                    <td>
                      <IncidentStatusForm incidentId={i.id} status={i.status} actionPlan={i.action_plan} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </PageContainer>
    </main>
  );
}
