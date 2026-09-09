import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { ShieldCheck, FileCheck, Search, History, Lock } from "lucide-react";
import Link from "next/link";
import { DOCUMENT_CATEGORY_LABEL } from "@/lib/document-categories";
import { logProntuarioAccess } from "./actions";
import { PrintButton } from "./print-button";
import { ShareFamilyButton } from "./share-family-button";

export const dynamic = "force-dynamic";

type TimelineItem = {
  id: string;
  date: string;
  type: string;
  author: string;
  summary: string;
  detail: string;
};

function fmt(dateIso: string) {
  return new Date(dateIso).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE, dateStyle: "short", timeStyle: "short" });
}

function truncate(text: string | null | undefined, max = 220) {
  if (!text) return "Sem resumo registrado.";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default async function ProntuarioUnificadoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const { q, p: selectedPatientId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let canShareWithFamily = false;
  if (user) {
    const { data: viewerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    canShareWithFamily = viewerProfile?.role === "supervisor" || viewerProfile?.role === "gestor";
  }

  let patientQuery = supabase
    .from("patients")
    .select("id, full_name, cpf, birth_date, status")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("full_name", { ascending: true })
    .limit(30);

  if (q && q.trim()) {
    patientQuery = patientQuery.ilike("full_name", `%${q.trim()}%`);
  }

  const { data: patientRows } = await patientQuery;
  const patientList = patientRows ?? [];
  const selectedPatient = selectedPatientId ? patientList.find((p) => p.id === selectedPatientId) ?? null : null;

  let timeline: TimelineItem[] = [];
  let signedNotesCount = 0;
  let totalNotesCount = 0;
  let accessCount30d = 0;
  let shareableDocuments: { id: string; categoryLabel: string; uploadedAt: string }[] = [];
  let shareableGoals: { id: string; description: string; statusLabel: string }[] = [];
  let shareableMeetings: { id: string; kindLabel: string; heldAt: string }[] = [];

  if (selectedPatient) {
    await logProntuarioAccess(selectedPatient.id);

    const [notesRes, assessmentsRes, meetingsRes, documentsRes, accessRes, treatmentPlanRes] = await Promise.all([
      supabase
        .from("session_notes")
        .select("id, version, free_text, signed_at, created_at_server, appointments!inner(patient_id, starts_at), profiles!session_notes_therapist_id_fkey(full_name)")
        .eq("appointments.patient_id", selectedPatient.id)
        .order("created_at_server", { ascending: false })
        .limit(20),
      supabase
        .from("protocol_assessments")
        .select("id, assessed_at, scores, protocols(name), profiles!assessed_by(full_name)")
        .eq("patient_id", selectedPatient.id)
        .order("assessed_at", { ascending: false })
        .limit(10),
      supabase
        .from("meetings")
        .select("id, held_at, kind, decisions, minutes, profiles!conducted_by(full_name)")
        .eq("patient_id", selectedPatient.id)
        .order("held_at", { ascending: false })
        .limit(10),
      supabase
        .from("documents")
        .select("id, uploaded_at, category, note, profiles!uploaded_by(full_name)")
        .eq("patient_id", selectedPatient.id)
        .order("uploaded_at", { ascending: false })
        .limit(10),
      supabase
        .from("record_access_log")
        .select("id, accessed_at")
        .eq("patient_id", selectedPatient.id)
        .gte("accessed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from("treatment_plans")
        .select("id")
        .eq("patient_id", selectedPatient.id)
        .eq("status", "aprovado")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const notes = notesRes.data ?? [];
    totalNotesCount = notes.length;
    signedNotesCount = notes.filter((n) => n.signed_at).length;

    const noteItems: TimelineItem[] = notes.map((n) => {
      const therapist = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles;
      return {
        id: `note-${n.id}`,
        date: n.created_at_server,
        type: `Evolução Clínica (v${n.version})`,
        author: therapist?.full_name ?? "Terapeuta",
        summary: truncate(n.free_text),
        detail: n.signed_at ? `Assinada em ${fmt(n.signed_at)}` : "Ainda não assinada",
      };
    });

    const assessmentItems: TimelineItem[] = (assessmentsRes.data ?? []).map((a: any) => {
      const protocol = Array.isArray(a.protocols) ? a.protocols[0] : a.protocols;
      const evaluator = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      return {
        id: `assessment-${a.id}`,
        date: a.assessed_at,
        type: `Avaliação de Protocolo — ${protocol?.name ?? "Protocolo"}`,
        author: evaluator?.full_name ?? "Avaliador",
        summary: "Aplicação registrada com pontuações no protocolo.",
        detail: "Ver detalhes na ficha de avaliação do paciente",
      };
    });

    const meetingItems: TimelineItem[] = (meetingsRes.data ?? []).map((m: any) => {
      const conductor = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        id: `meeting-${m.id}`,
        date: m.held_at,
        type: m.kind === "revisao_pts" ? "Reunião — Revisão de PTS" : m.kind === "devolutiva" ? "Reunião — Devolutiva" : `Reunião — ${m.kind}`,
        author: conductor?.full_name ?? "Coordenação Clínica",
        summary: truncate(m.decisions ?? m.minutes),
        detail: "Registro de reunião",
      };
    });

    const documentItems: TimelineItem[] = (documentsRes.data ?? []).map((d: any) => {
      const uploader = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
      return {
        id: `doc-${d.id}`,
        date: d.uploaded_at,
        type: `Documento — ${d.category}`,
        author: uploader?.full_name ?? "—",
        summary: truncate(d.note, 160) === "Sem resumo registrado." ? "Documento anexado ao prontuário." : truncate(d.note, 160),
        detail: "Documento",
      };
    });

    timeline = [...noteItems, ...assessmentItems, ...meetingItems, ...documentItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 30);

    accessCount30d = accessRes.data?.length ?? 0;

    // Itens elegíveis para o PDF de compartilhamento com a família (botão
    // ShareFamilyButton) — só documentos, metas ativas/atingidas do plano
    // aprovado e reuniões; nunca evoluções clínicas nem avaliações de
    // protocolo (§9.4-A, ver generateFamilyShare em ./actions.ts).
    shareableDocuments = (documentsRes.data ?? []).map((d: any) => ({
      id: d.id,
      categoryLabel: DOCUMENT_CATEGORY_LABEL[d.category] ?? d.category,
      uploadedAt: fmt(d.uploaded_at),
    }));

    const treatmentPlanId = treatmentPlanRes.data?.id;
    if (treatmentPlanId) {
      const { data: goalsData } = await supabase
        .from("plan_goals")
        .select("id, description, status")
        .eq("treatment_plan_id", treatmentPlanId)
        .in("status", ["ativa", "atingida"]);

      shareableGoals = (goalsData ?? []).map((g) => ({
        id: g.id,
        description: g.description,
        statusLabel: g.status === "atingida" ? "Atingida" : "Em andamento",
      }));
    }

    shareableMeetings = (meetingsRes.data ?? []).map((m: any) => ({
      id: m.id,
      kindLabel: m.kind === "revisao_pts" ? "Revisão de PTS" : m.kind === "devolutiva" ? "Devolutiva" : m.kind,
      heldAt: fmt(m.held_at),
    }));
  }

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <header style={{ background: "var(--color-accent)", color: "var(--color-bg)" }} className="flex h-16 items-center justify-between px-10">
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
            FaçaAmigos <span style={{ color: "var(--color-on-accent-soft)" }} className="font-normal italic">· Prontuário Unificado & Auditoria</span>
          </span>
        </div>
        <Link href="/supervisao" className="btn btn-secondary text-xs">
          Voltar para Supervisão
        </Link>
      </header>

      <div className="flex flex-col gap-8 px-10 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Conformidade Regulatória CFP / ANS / LGPD
            </h6>
            <h1 className="m-0">Prontuário Eletrônico Unificado & Trilha de Auditoria</h1>
          </div>
          {selectedPatient && (
            <div className="flex items-center gap-2">
              {canShareWithFamily && (
                <ShareFamilyButton
                  patientId={selectedPatient.id}
                  documents={shareableDocuments}
                  goals={shareableGoals}
                  meetings={shareableMeetings}
                />
              )}
              <PrintButton hasRecords={timeline.length > 0} />
            </div>
          )}
        </div>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <h4 className="mb-3">Selecionar Paciente</h4>
            <form method="get" className="relative mb-4">
              <Search className="absolute left-3 top-2.5 text-ink-faint" size={16} />
              <input type="text" name="q" defaultValue={q ?? ""} placeholder="Nome do paciente..." className="input pl-9 text-xs" />
            </form>

            <div className="flex flex-col gap-2">
              {patientList.length === 0 && <p className="text-xs text-ink-faint">Nenhum paciente encontrado.</p>}
              {patientList.map((pt) => {
                const isActive = selectedPatient?.id === pt.id;
                return (
                  <Link
                    key={pt.id}
                    href={`/supervisao/prontuario-unificado?p=${pt.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    aria-selected={isActive}
                    className={`block p-3 text-left rounded-lg border text-xs no-underline transition-all ${
                      isActive ? "font-semibold" : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                    style={
                      isActive
                        ? { borderColor: "var(--color-neutral-200)", borderLeft: "4px solid var(--color-accent)", background: "var(--color-accent-100)" }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{pt.full_name}</span>
                      {!pt.cpf && (
                        <span title="Cadastro incompleto: CPF não informado" className="text-amber-600">
                          ⚠
                        </span>
                      )}
                    </div>
                    {pt.cpf && <div className="text-[11px] text-ink-faint">CPF: {pt.cpf}</div>}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {!selectedPatient ? (
              <div className="rounded-xl border p-8 text-center text-sm text-ink-faint" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
                Selecione um paciente à esquerda para ver o histórico unificado.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border p-5 bg-white shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold text-ink-faint mb-1">
                      <ShieldCheck size={16} className="text-emerald-600" /> Evoluções Assinadas
                    </div>
                    <div className="text-lg font-bold text-emerald-700">
                      {signedNotesCount} de {totalNotesCount}
                    </div>
                    <span className="text-[11px] text-ink-faint">Últimas evoluções clínicas registradas</span>
                  </div>

                  <div className="rounded-xl border p-5 bg-white shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold text-ink-faint mb-1">
                      <FileCheck size={16} className="text-blue-600" /> Versionamento
                    </div>
                    <div className="text-lg font-bold text-blue-700">Imutável por versão</div>
                    <span className="text-[11px] text-ink-faint">Toda edição gera nova versão encadeada</span>
                  </div>

                  <div className="rounded-xl border p-5 bg-white shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold text-ink-faint mb-1">
                      <Lock size={16} className="text-purple-600" /> Acessos ao Prontuário (30 dias)
                    </div>
                    <div className="text-lg font-bold text-purple-700">{accessCount30d} acesso{accessCount30d === 1 ? "" : "s"}</div>
                    <span className="text-[11px] text-ink-faint">Trilha LGPD — registrado em record_access_log</span>
                  </div>
                </div>

                <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
                  <h3 className="mb-6 flex items-center gap-2">
                    <History size={18} className="text-amber-600" /> Histórico Unificado do Paciente
                  </h3>

                  {timeline.length === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-6 text-center">
                      <p className="text-sm text-ink-faint">Nenhum registro clínico encontrado para este paciente ainda.</p>
                      <Link href={`/terapeuta/paciente/${selectedPatient.id}`} className="btn btn-primary text-xs">
                        Ir para a ficha do paciente
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
                      {timeline.map((item) => (
                        <div key={item.id} className="flex gap-4 relative">
                          <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 z-10">
                            ✓
                          </div>
                          <div className="flex-1 rounded-lg border p-4 bg-neutral-50/50">
                            <div className="flex flex-wrap justify-between items-baseline mb-1">
                              <span className="font-bold text-sm">{item.type}</span>
                              <span className="tabular-figure text-xs text-ink-faint">{fmt(item.date)}</span>
                            </div>
                            <div className="text-xs font-medium text-amber-800 mb-2">{item.author}</div>
                            <p className="text-xs text-ink-soft mb-3">{item.summary}</p>
                            <div className="flex items-center justify-between text-[11px] text-ink-faint pt-2 border-t border-neutral-200">
                              <span>{item.detail}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
