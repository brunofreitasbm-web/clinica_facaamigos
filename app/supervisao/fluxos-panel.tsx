"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  FileText,
  Inbox,
  LayoutGrid,
  MessageCircle,
  Search,
  Stethoscope,
  Target,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useSupervisaoTab } from "./supervisao-shell";

/**
 * Aba "Fluxos" do painel de coordenação.
 *
 * Passo a passo dos cinco fluxos consolidados da clínica (agendamento,
 * acolhimento, avaliação, plano terapêutico e chamados da família), cada
 * passo com a ferramenta que o executa a um clique — sem descer em
 * submenus de recepção/terapeuta/supervisão. As etapas seguem o PRD §9.1
 * (cadastro em fluxo contínuo) e a estrutura das linhas de cuidado TEA
 * (acolhimento → avaliação/anamnese ampliada → PTS construído com a família
 * → reavaliação com os mesmos instrumentos).
 *
 * O seletor de paciente no topo reescreve os atalhos que dependem de um
 * paciente (ficha, avaliação de protocolo, PEI, relatórios) — sem paciente
 * escolhido eles ficam desabilitados em vez de levar a uma tela genérica.
 */

export type FlowPatient = {
  id: string;
  name: string;
  status: string;
  /** 1 Lead · 2 Avaliação agendada · 3 Avaliação realizada · 4 Autorização · 5 Grade montada */
  stage: 1 | 2 | 3 | 4 | 5;
};

export type FlowCounters = {
  leads: number;
  stuckOnboarding: number;
  awaitingEvaluation: number;
  evaluatedNoGuide: number;
  sessionsInGrid: number;
  provisionalNoGuide: number;
  pendingNotes: number;
  pendingPlans: number;
  plansToApprove: number;
  reassessmentsDue: number;
  openFamilyMessages: number;
  pendingReports: number;
};

type Tool =
  | { label: string; href: string; icon: ReactNode; primary?: boolean; needsPatient?: false }
  | { label: string; hrefFor: (patientId: string) => string; icon: ReactNode; primary?: boolean; needsPatient: true }
  | { label: string; tab: "grade" | "planos" | "inbox"; icon: ReactNode; primary?: boolean; needsPatient?: false };

type Step = { title: string; detail: string; tools?: Tool[] };

type Flow = {
  key: string;
  title: string;
  kicker: string;
  icon: ReactNode;
  summary: string;
  badges: (c: FlowCounters) => { label: string; tone: "pending" | "negative" | "neutral" | "positive" }[];
  tools: Tool[];
  steps: Step[];
};

const STAGE_LABEL: Record<FlowPatient["stage"], string> = {
  1: "Lead",
  2: "Avaliação agendada",
  3: "Avaliação realizada",
  4: "Autorização",
  5: "Grade montada",
};

const icon = (node: ReactNode) => <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{node}</span>;

const FLOWS: Flow[] = [
  {
    key: "agendamento",
    title: "Agendamento",
    kicker: "Fluxo 1",
    icon: <CalendarDays className="h-5 w-5" />,
    summary:
      "Do pedido de horário à sessão confirmada. Regra do PRD §9.2: conflito de sala/terapeuta bloqueia; guia inválida vira sessão provisória, não bloqueio.",
    badges: (c) => [
      { label: `${c.sessionsInGrid} sessões na semana`, tone: "neutral" },
      { label: `${c.provisionalNoGuide} provisórias sem guia`, tone: c.provisionalNoGuide ? "negative" : "positive" },
      { label: `${c.pendingNotes} evoluções atrasadas`, tone: c.pendingNotes ? "pending" : "positive" },
    ],
    tools: [
      { label: "Agenda do dia", href: "/recepcao", icon: icon(<CalendarDays />), primary: true },
      { label: "Nova sessão", href: "/recepcao#nova-sessao", icon: icon(<CalendarPlus />) },
      { label: "Agenda semanal", href: "/recepcao/agenda", icon: icon(<CalendarDays />) },
      { label: "Grade da semana", tab: "grade", icon: icon(<LayoutGrid />) },
      { label: "Salas e recursos", href: "/recepcao/recursos", icon: icon(<LayoutGrid />) },
      { label: "Ficha do paciente", hrefFor: (id) => `/recepcao/pacientes/${id}`, icon: icon(<Users />), needsPatient: true },
    ],
    steps: [
      {
        title: "Checar a guia vigente do paciente",
        detail: "Abra a ficha e confira sessões restantes e validade antes de oferecer horário. Sem guia ativa, agende como provisória.",
        tools: [{ label: "Ficha · Guias", hrefFor: (id) => `/recepcao/pacientes/${id}#guias`, icon: icon(<FileText />), needsPatient: true }],
      },
      {
        title: "Encontrar vaga na grade",
        detail: "Use a grade semanal para ver terapeuta e sala livres no mesmo horário. Prefira manter o mesmo terapeuta de referência.",
        tools: [{ label: "Grade da semana", tab: "grade", icon: icon(<LayoutGrid />) }],
      },
      {
        title: "Criar a sessão (ou a recorrência semanal)",
        detail: "Escolha paciente, terapeuta, sala, tipo de atendimento e horário. O sistema recusa conflito de sala/terapeuta na hora.",
        tools: [{ label: "Nova sessão", href: "/recepcao#nova-sessao", icon: icon(<CalendarPlus />), primary: true }],
      },
      {
        title: "Confirmar com a família (D-1)",
        detail: "Envie a confirmação pela fila de WhatsApp. Faltas e cancelamentos exigem motivo padronizado e autor.",
        tools: [{ label: "Fila WhatsApp", href: "/recepcao/whatsapp", icon: icon(<MessageCircle />) }],
      },
      {
        title: "Acompanhar realização e evolução em 24h",
        detail: "Sessão realizada sem evolução em 24h entra na fila da supervisão. Cobre o terapeuta a partir da grade.",
        tools: [{ label: "Evoluções pendentes", tab: "grade", icon: icon(<ClipboardList />) }],
      },
    ],
  },
  {
    key: "acolhimento",
    title: "Acolhimento",
    kicker: "Fluxo 2",
    icon: <UserPlus className="h-5 w-5" />,
    summary:
      "Primeiro contato até a avaliação agendada. Princípio do PRD §9.1: cadastro nunca bloqueia, pendência sim. Cadastro mínimo em 30 segundos.",
    badges: (c) => [
      { label: `${c.leads} leads em aberto`, tone: c.leads ? "pending" : "positive" },
      { label: `${c.stuckOnboarding} travados há 3+ dias`, tone: c.stuckOnboarding ? "negative" : "positive" },
    ],
    tools: [
      { label: "Novo lead", href: "/recepcao/pacientes/novo", icon: icon(<UserPlus />), primary: true },
      { label: "Pendências", href: "/recepcao/pacientes/pendencias", icon: icon(<ClipboardList />) },
      { label: "Pacientes", href: "/recepcao/pacientes", icon: icon(<Users />) },
      { label: "Fila WhatsApp", href: "/recepcao/whatsapp", icon: icon(<MessageCircle />) },
      { label: "Próximo passo do paciente", hrefFor: (id) => `/recepcao/pacientes/${id}#proximo-passo`, icon: icon(<Target />), needsPatient: true },
    ],
    steps: [
      {
        title: "Registrar o lead",
        detail: "Nome da criança, idade, responsável, telefone, origem e queixa em uma linha. Status vira lead com hora do primeiro contato.",
        tools: [{ label: "Novo lead", href: "/recepcao/pacientes/novo", icon: icon(<UserPlus />), primary: true }],
      },
      {
        title: "Retornar em até 15 minutos",
        detail: "Escuta inicial da família: expectativas, rotina, encaminhamento médico. Registre o contato para a métrica de primeira resposta.",
        tools: [{ label: "Registrar contato", href: "/recepcao/pacientes/pendencias", icon: icon(<MessageCircle />) }],
      },
      {
        title: "Orientar documentos de entrada",
        detail: "Pedido médico com CID, carteirinha, documento do responsável, termo LGPD, termo de imagem e contrato (particular).",
        tools: [{ label: "Documentos", href: "/recepcao/documentos", icon: icon(<FileText />) }],
      },
      {
        title: "Agendar a avaliação com a coordenação",
        detail: "Na ficha, passo 1 do checklist: terapeuta avaliador, sala, data e hora. O paciente passa a avaliação.",
        tools: [{ label: "Agendar avaliação", hrefFor: (id) => `/recepcao/pacientes/${id}#proximo-passo`, icon: icon(<CalendarPlus />), needsPatient: true, primary: true }],
      },
      {
        title: "Confirmar D-1 e preparar a anamnese",
        detail: "Confirme por WhatsApp e peça que a família traga relatórios escolares e exames anteriores.",
        tools: [{ label: "Fila WhatsApp", href: "/recepcao/whatsapp", icon: icon(<MessageCircle />) }],
      },
    ],
  },
  {
    key: "avaliacao",
    title: "Avaliação",
    kicker: "Fluxo 3",
    icon: <Stethoscope className="h-5 w-5" />,
    summary:
      "Anamnese ampliada com a família, aplicação de protocolo (VB-MAPP, ABLLS-R ou ESDM), reunião técnica e devolutiva. Termina com a guia registrada.",
    badges: (c) => [
      { label: `${c.awaitingEvaluation} aguardando avaliação`, tone: c.awaitingEvaluation ? "pending" : "positive" },
      { label: `${c.evaluatedNoGuide} avaliados sem guia`, tone: c.evaluatedNoGuide ? "negative" : "positive" },
      { label: `${c.reassessmentsDue} reavaliações vencendo`, tone: c.reassessmentsDue ? "pending" : "positive" },
    ],
    tools: [
      { label: "Aplicar protocolo", hrefFor: (id) => `/terapeuta/paciente/${id}/avaliacao`, icon: icon(<ClipboardList />), needsPatient: true, primary: true },
      { label: "Marcar avaliação realizada", hrefFor: (id) => `/recepcao/pacientes/${id}#proximo-passo`, icon: icon(<Target />), needsPatient: true },
      { label: "Métricas do paciente", hrefFor: (id) => `/terapeuta/paciente/${id}/metricas`, icon: icon(<Target />), needsPatient: true },
      { label: "Reavaliações", tab: "inbox", icon: icon(<Inbox />) },
    ],
    steps: [
      {
        title: "Anamnese ampliada com a família",
        detail: "História, rotina, pontos fortes e prioridades da família. Registre no mural da ficha para a equipe.",
        tools: [{ label: "Ficha do paciente", hrefFor: (id) => `/recepcao/pacientes/${id}`, icon: icon(<Users />), needsPatient: true }],
      },
      {
        title: "Observação direta e protocolo",
        detail: "Pontue os marcos do protocolo licenciado por domínio. A curva de aprendizagem já nasce desta aplicação.",
        tools: [{ label: "Aplicar protocolo", hrefFor: (id) => `/terapeuta/paciente/${id}/avaliacao`, icon: icon(<ClipboardList />), needsPatient: true, primary: true }],
      },
      {
        title: "Reunião técnica multidisciplinar",
        detail: "Defina disciplinas, frequência semanal e terapeuta de referência. Esse desenho vira o esqueleto do plano.",
      },
      {
        title: "Registrar avaliação realizada e pedir documentos",
        detail: "Passo 2 do checklist da ficha. O sistema abre o checklist de documentos de entrada para a recepção.",
        tools: [{ label: "Marcar realizada", hrefFor: (id) => `/recepcao/pacientes/${id}#proximo-passo`, icon: icon(<Target />), needsPatient: true }],
      },
      {
        title: "Registrar guia e autorização",
        detail: "Convênio, procedimento, sessões autorizadas, vigência e senha. Enquanto pendente, só sessão provisória.",
        tools: [{ label: "Registrar guia", hrefFor: (id) => `/recepcao/pacientes/${id}#proximo-passo`, icon: icon(<FileText />), needsPatient: true }],
      },
      {
        title: "Reavaliar com os mesmos instrumentos",
        detail: "A cada 3, 6 ou 12 meses conforme o plano. O alerta de reavaliação aparece na caixa de entrada.",
        tools: [{ label: "Reavaliações vencendo", tab: "inbox", icon: icon(<Inbox />) }],
      },
    ],
  },
  {
    key: "plano",
    title: "Plano terapêutico",
    kicker: "Fluxo 4",
    icon: <Target className="h-5 w-5" />,
    summary:
      "PTS/PEI construído com a família: metas SMART por disciplina e domínio, aprovação da coordenação, revisão datada e devolutiva.",
    badges: (c) => [
      { label: `${c.plansToApprove} planos na fila`, tone: c.plansToApprove ? "pending" : "positive" },
      { label: `${c.pendingPlans} PDIs atrasados (§2.3)`, tone: c.pendingPlans ? "negative" : "positive" },
      { label: `${c.pendingReports} relatórios para validar`, tone: c.pendingReports ? "pending" : "positive" },
    ],
    tools: [
      { label: "Montar PEI", hrefFor: (id) => `/supervisao/planos/novo?paciente=${id}`, icon: icon(<Target />), needsPatient: true, primary: true },
      { label: "Montar PEI (escolher paciente)", href: "/supervisao/planos/novo", icon: icon(<Target />) },
      { label: "Fila de aprovação", tab: "planos", icon: icon(<ClipboardList />) },
      { label: "Relatório devolutivo", hrefFor: (id) => `/terapeuta/paciente/${id}/relatorio`, icon: icon(<FileText />), needsPatient: true },
      { label: "Relatório para convênio", hrefFor: (id) => `/terapeuta/paciente/${id}/relatorio-convenio`, icon: icon(<FileText />), needsPatient: true },
    ],
    steps: [
      {
        title: "Traduzir a avaliação em metas",
        detail: "Item de protocolo para ABA/Denver; meta SMART por domínio próprio para as demais disciplinas. Data de revisão obrigatória.",
        tools: [{ label: "Montar PEI", hrefFor: (id) => `/supervisao/planos/novo?paciente=${id}`, icon: icon(<Target />), needsPatient: true, primary: true }],
      },
      {
        title: "Validar ou devolver metas",
        detail: "Na fila, valide meta a meta. Metas devolvidas voltam ao terapeuta antes da aprovação do plano.",
        tools: [{ label: "Fila de aprovação", tab: "planos", icon: icon(<ClipboardList />) }],
      },
      {
        title: "Aprovar o plano e montar a grade",
        detail: "Com o plano aprovado, aloque terapeutas e salas. O paciente vira ativo na primeira sessão realizada.",
        tools: [
          { label: "Aprovar plano", tab: "planos", icon: icon(<Target />) },
          { label: "Ativar na grade", hrefFor: (id) => `/recepcao/pacientes/${id}#proximo-passo`, icon: icon(<CalendarPlus />), needsPatient: true },
        ],
      },
      {
        title: "Apresentar à família e registrar o aceite",
        detail: "Devolutiva presencial: metas, frequência e papel da família. Guarde o registro no mural da ficha.",
        tools: [{ label: "Mural da ficha", hrefFor: (id) => `/recepcao/pacientes/${id}`, icon: icon(<Users />), needsPatient: true }],
      },
      {
        title: "Acompanhar e validar metas atingidas",
        detail: "Curva de aprendizagem e coleta de tentativas por sessão. Meta atingida é validada pela coordenação.",
        tools: [{ label: "Métricas", hrefFor: (id) => `/terapeuta/paciente/${id}/metricas`, icon: icon(<Target />), needsPatient: true }],
      },
      {
        title: "Relatório de evolução e revisão do plano",
        detail: "Devolutivo para a família e relatório para renovação de guia. A revisão gera uma nova versão do plano.",
        tools: [
          { label: "Relatório devolutivo", hrefFor: (id) => `/terapeuta/paciente/${id}/relatorio`, icon: icon(<FileText />), needsPatient: true },
          { label: "Relatório convênio", hrefFor: (id) => `/terapeuta/paciente/${id}/relatorio-convenio`, icon: icon(<FileText />), needsPatient: true },
        ],
      },
    ],
  },
  {
    key: "familia",
    title: "Chamados junto à família",
    kicker: "Fluxo 5",
    icon: <MessageCircle className="h-5 w-5" />,
    summary:
      "Mensagens do portal, faltas relatadas e pedidos de contato. Todo chamado termina com resposta registrada ou resolução com autor.",
    badges: (c) => [{ label: `${c.openFamilyMessages} chamados abertos`, tone: c.openFamilyMessages ? "negative" : "positive" }],
    tools: [
      { label: "Caixa de entrada", tab: "inbox", icon: icon(<Inbox />), primary: true },
      { label: "Fila WhatsApp", href: "/recepcao/whatsapp", icon: icon(<MessageCircle />) },
      { label: "Registrar contato", href: "/recepcao/pacientes/pendencias", icon: icon(<ClipboardList />) },
      { label: "Ficha e faltas", hrefFor: (id) => `/recepcao/pacientes/${id}`, icon: icon(<Users />), needsPatient: true },
    ],
    steps: [
      {
        title: "Ler o chamado",
        detail: "Mensagens do portal chegam à caixa de entrada com paciente e responsável identificados.",
        tools: [{ label: "Caixa de entrada", tab: "inbox", icon: icon(<Inbox />), primary: true }],
      },
      {
        title: "Consultar o contexto do paciente",
        detail: "Faltas relatadas, guia, mural e próximas sessões ficam na ficha. Não responda sem olhar o histórico.",
        tools: [{ label: "Ficha do paciente", hrefFor: (id) => `/recepcao/pacientes/${id}`, icon: icon(<Users />), needsPatient: true }],
      },
      {
        title: "Responder pelo canal certo",
        detail: "Resposta escrita pelo portal ou mensagem pela fila de WhatsApp. Casos delicados vão para ligação ou reunião presencial.",
        tools: [
          { label: "Responder no portal", tab: "inbox", icon: icon(<MessageCircle />) },
          { label: "Fila WhatsApp", href: "/recepcao/whatsapp", icon: icon(<MessageCircle />) },
        ],
      },
      {
        title: "Encaminhar internamente se precisar",
        detail: "Reagendamento vai à recepção; dúvida clínica ao terapeuta de referência via mural da ficha.",
        tools: [
          { label: "Reagendar", href: "/recepcao/agenda", icon: icon(<CalendarDays />) },
          { label: "Mural da ficha", hrefFor: (id) => `/recepcao/pacientes/${id}`, icon: icon(<Users />), needsPatient: true },
        ],
      },
      {
        title: "Fechar o chamado com registro",
        detail: "Marque resolvido na caixa de entrada. Fica gravado quem tratou e quando.",
        tools: [{ label: "Marcar resolvido", tab: "inbox", icon: icon(<Inbox />) }],
      },
    ],
  },
];

const TONE_CLASS: Record<"pending" | "negative" | "neutral" | "positive", string> = {
  pending: "st-agendada",
  negative: "st-falta",
  neutral: "tag-neutral",
  positive: "st-confirmada",
};

function ToolButton({ tool, patientId, compact }: { tool: Tool; patientId: string | null; compact?: boolean }) {
  const { setTab } = useSupervisaoTab();
  const cls = `btn ${tool.primary ? "btn-primary" : "btn-secondary"} ${compact ? "text-xs" : "text-sm"}`;
  const style = compact ? { padding: "3px 10px" } : { padding: "6px 14px" };

  if ("tab" in tool) {
    return (
      <button type="button" className={cls} style={style} onClick={() => setTab(tool.tab)}>
        {tool.icon}
        {tool.label}
      </button>
    );
  }

  if (tool.needsPatient) {
    if (!patientId) {
      return (
        <span
          className={`${cls} cursor-not-allowed opacity-45`}
          style={style}
          title="Escolha um paciente no topo para habilitar este atalho"
        >
          {tool.icon}
          {tool.label}
        </span>
      );
    }
    return (
      <Link href={tool.hrefFor(patientId)} className={`${cls} no-underline`} style={style}>
        {tool.icon}
        {tool.label}
      </Link>
    );
  }

  return (
    <Link href={tool.href} className={`${cls} no-underline`} style={style}>
      {tool.icon}
      {tool.label}
    </Link>
  );
}

function PatientPicker({
  patients,
  selected,
  onSelect,
}: {
  patients: FlowPatient[];
  selected: FlowPatient | null;
  onSelect: (p: FlowPatient | null) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return patients.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [patients, query]);

  if (selected) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">Paciente em foco</span>
        <span className="tag tag-accent text-sm">{selected.name}</span>
        <span className="tag tag-neutral text-xs">
          Etapa {selected.stage} · {STAGE_LABEL[selected.stage]}
        </span>
        <Link href={`/recepcao/pacientes/${selected.id}`} className="text-sm font-semibold">
          Abrir ficha
        </Link>
        <button type="button" className="btn btn-ghost text-xs" style={{ padding: "2px 8px" }} onClick={() => onSelect(null)}>
          <X className="h-3.5 w-3.5" /> Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="flex items-center gap-2">
        <Search className="h-4 w-4 text-ink-faint" />
        <input
          className="input flex-1"
          placeholder="Buscar paciente para apontar os atalhos (ficha, protocolo, PEI, relatórios)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {matches.length > 0 && (
        <ul
          className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded-[var(--radius-md)]"
          style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-md)", border: "1px solid var(--color-divider)" }}
        >
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-chart-soft"
                onClick={() => {
                  onSelect(p);
                  setQuery("");
                }}
              >
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="text-xs text-ink-soft">
                  {p.status} · {STAGE_LABEL[p.stage]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && matches.length === 0 && (
        <p className="mt-1 text-xs text-ink-faint">Nenhum paciente com esse nome.</p>
      )}
    </div>
  );
}

export function FluxosPanel({ patients, counters }: { patients: FlowPatient[]; counters: FlowCounters }) {
  const [selected, setSelected] = useState<FlowPatient | null>(null);
  const [openFlow, setOpenFlow] = useState<string>(FLOWS[0].key);
  const patientId = selected?.id ?? null;

  const current = FLOWS.find((f) => f.key === openFlow) ?? FLOWS[0];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }}>Passo a passo com atalhos</h6>
          <h1 className="m-0">Fluxos da coordenação</h1>
        </div>
        <p className="max-w-[520px] text-sm text-ink-soft">
          Cinco fluxos consolidados, cada passo com a ferramenta que o executa. Escolha um paciente para os atalhos
          apontarem direto para a ficha, o protocolo, o PEI e os relatórios dele.
        </p>
      </div>

      <div className="card">
        <PatientPicker patients={patients} selected={selected} onSelect={setSelected} />
      </div>

      {/* seletor de fluxo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FLOWS.map((f) => {
          const active = f.key === current.key;
          const badges = f.badges(counters);
          const attention = badges.some((b) => b.tone === "negative" || b.tone === "pending");
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setOpenFlow(f.key)}
              className="card text-left transition-all hover:-translate-y-0.5"
              style={{
                boxShadow: active ? "var(--shadow-pink)" : "var(--shadow-sm)",
                border: active ? "2px solid var(--color-accent)" : "2px solid transparent",
                padding: 16,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="card-kicker">{f.kicker}</span>
                <span style={{ color: attention ? "var(--color-accent)" : "var(--color-teal-700)" }}>{f.icon}</span>
              </div>
              <div className="card-title mt-1" style={{ fontSize: 17 }}>
                {f.title}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {badges.map((b) => (
                  <span key={b.label} className={`tag-status ${TONE_CLASS[b.tone]} text-[11px]`}>
                    {b.label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* fluxo aberto */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="card">
          <div className="card-kicker">{current.kicker}</div>
          <h2 className="m-0 flex items-center gap-3">
            {current.icon}
            {current.title}
          </h2>
          <p className="card-body mt-2 mb-6">{current.summary}</p>

          <ol className="flex flex-col gap-5">
            {current.steps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[32px_1fr] gap-4">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  {i + 1}
                </span>
                <div>
                  <div className="font-bold text-ink">{s.title}</div>
                  <p className="m-0 mt-0.5 text-sm text-ink-soft">{s.detail}</p>
                  {s.tools && s.tools.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.tools.map((t) => (
                        <ToolButton key={t.label} tool={t} patientId={patientId} compact />
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="card">
            <div className="card-kicker">Acesso rápido</div>
            <div className="card-title" style={{ fontSize: 16 }}>
              Ferramentas do fluxo
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {current.tools.map((t) => (
                <ToolButton key={t.label} tool={t} patientId={patientId} />
              ))}
            </div>
            {!patientId && current.tools.some((t) => "needsPatient" in t && t.needsPatient) && (
              <p className="mt-3 text-xs text-ink-faint">
                Atalhos apagados dependem de um paciente. Busque o nome no topo.
              </p>
            )}
          </div>

          {selected && (
            <div className="card">
              <div className="card-kicker">Onde este paciente está</div>
              <ol className="mt-2 flex flex-col gap-1.5 text-sm">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <li key={n} className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{
                        background:
                          n < selected.stage
                            ? "var(--color-status-positive)"
                            : n === selected.stage
                              ? "var(--color-accent)"
                              : "var(--color-neutral-200)",
                        color: n <= selected.stage ? "#fff" : "var(--color-neutral-700)",
                      }}
                    >
                      {n < selected.stage ? "✓" : n}
                    </span>
                    <span className={n === selected.stage ? "font-bold text-ink" : "text-ink-soft"}>{STAGE_LABEL[n]}</span>
                  </li>
                ))}
              </ol>
              {selected.stage < 5 && (
                <Link href={`/recepcao/pacientes/${selected.id}#proximo-passo`} className="btn btn-primary mt-4 text-sm no-underline">
                  Executar próximo passo
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
