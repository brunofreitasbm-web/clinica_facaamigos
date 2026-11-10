// lib/portal-robot-pure.ts
// Regras do robô de autorização no portal do plano (etapa 2 de Autorizações) que
// não dependem de banco: formato do pedido, validação do que a recepção digita,
// transições de status e "o agente está ligado?". Puro e sem import com alias
// `@/` para rodar em `node --test --experimental-strip-types`
// (tests/portal-robot-pure.test.ts). Ver docs/portal-robot.md.

export type PortalRobotMode = "simular" | "autorizar";

export type PortalRobotStatus =
  | "na_fila"
  | "em_andamento"
  | "aguardando_confirmacao"
  | "confirmado"
  | "enviado"
  | "simulado"
  | "erro"
  | "verificar"
  | "cancelado";

/** Pedido ainda em curso: bloqueia um segundo pedido para o mesmo contato. */
export const OPEN_STATUSES: readonly PortalRobotStatus[] = ["na_fila", "em_andamento", "aguardando_confirmacao", "confirmado"];

export const STATUS_LABEL: Record<PortalRobotStatus, string> = {
  na_fila: "Na fila do robô",
  em_andamento: "Robô preenchendo o portal",
  aguardando_confirmacao: "Aguardando sua confirmação",
  confirmado: "Confirmado — robô enviando",
  enviado: "Enviado ao plano",
  simulado: "Simulação concluída (nada enviado)",
  erro: "Não enviado",
  verificar: "Conferir no portal",
  cancelado: "Cancelado",
};

export type PortalRobotProfessional = { name: string; council: string; register: string; uf: string; cbo: string };
export type PortalRobotProcedure = { code: string; description: string; quantity: number };

export type PortalRobotPayload = {
  patient_name: string | null;
  card_number: string;
  cid: string;
  reference_month: string; // YYYY-MM
  observation: string;
  professional: PortalRobotProfessional;
  procedures: PortalRobotProcedure[];
  laudo: { file_id: string; storage_path: string; name: string; mime_type: string };
};

/** O que a recepção preenche no formulário "Enviar pelo robô". */
export type PortalRobotRequestInput = {
  mode: PortalRobotMode;
  cardNumber: string;
  cid: string;
  referenceMonth: string;
  observation?: string;
  professional: { name: string; council: string; register: string; uf: string; cbo: string };
  procedures: { code: string; description: string; quantity: number | string }[];
  laudoFileId: string;
};

const MONTH = /^20\d{2}-(0[1-9]|1[0-2])$/;
// CID-10: letra + 2 dígitos, decimal opcional (F84, F84.0, F840). O portal da IASEP usa CID-10.
const CID10 = /^[A-Z]\d{2}(\.?\d{1,2})?$/;

export type NormalizedRequest = Omit<PortalRobotPayload, "patient_name" | "laudo"> & { mode: PortalRobotMode; laudoFileId: string };

/** Limpa e valida o formulário. Devolve a mensagem para a recepção quando algo falta. */
export function normalizeRequest(input: PortalRobotRequestInput): { ok: true; value: NormalizedRequest } | { ok: false; error: string } {
  const mode: PortalRobotMode = input.mode === "simular" ? "simular" : "autorizar";
  const card = String(input.cardNumber ?? "").replace(/\D/g, "");
  if (card.length < 5) return { ok: false, error: "Informe o número da carteirinha." };

  const cid = String(input.cid ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!cid) return { ok: false, error: "Informe o CID." };
  if (!CID10.test(cid)) return { ok: false, error: `CID "${cid}" fora do padrão CID-10 (ex.: F84 ou F84.0). O portal não aceita CID-11.` };

  const month = String(input.referenceMonth ?? "").trim();
  if (!MONTH.test(month)) return { ok: false, error: "Informe o mês de referência da autorização." };

  const p = input.professional ?? ({} as PortalRobotRequestInput["professional"]);
  const professional: PortalRobotProfessional = {
    name: String(p.name ?? "").trim().replace(/\s+/g, " ").toUpperCase(),
    council: String(p.council ?? "").trim().toUpperCase() || "CRM",
    register: String(p.register ?? "").replace(/\D/g, ""),
    uf: String(p.uf ?? "").trim().toUpperCase().slice(0, 2),
    cbo: String(p.cbo ?? "").replace(/\D/g, ""),
  };
  if (!professional.name || !professional.register) return { ok: false, error: "Informe o médico solicitante (nome e nº do conselho)." };
  if (professional.cbo.length !== 6) return { ok: false, error: "Informe o CBO do médico solicitante (6 dígitos, ex.: 225112)." };

  const procedures: PortalRobotProcedure[] = [];
  for (const item of input.procedures ?? []) {
    const code = String(item.code ?? "").replace(/\D/g, "");
    const description = String(item.description ?? "").trim();
    if (!code && !description) continue;
    const quantity = Math.trunc(Number(item.quantity));
    if (!code) return { ok: false, error: "Toda terapia precisa do código do convênio." };
    if (!Number.isFinite(quantity) || quantity < 1) return { ok: false, error: `Quantidade inválida na terapia ${code}.` };
    procedures.push({ code, description, quantity });
  }
  if (procedures.length === 0) return { ok: false, error: "Adicione pelo menos uma terapia com código e quantidade." };

  if (!input.laudoFileId) return { ok: false, error: "Escolha qual arquivo é o laudo/pedido médico a anexar." };

  return {
    ok: true,
    value: {
      mode,
      card_number: card,
      cid,
      reference_month: month,
      observation: String(input.observation ?? "").trim().slice(0, 500),
      professional,
      procedures,
      laudoFileId: input.laudoFileId,
    },
  };
}

/** Pedido feito a partir do dia 15 vale para o mês seguinte (a clínica pede no fim do mês anterior). */
export function suggestedReferenceMonth(now: Date, timeZone = "America/Sao_Paulo", turnDay = 15): string {
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone }).split("-").map(Number);
  let year = y;
  let month = m;
  if (d >= turnDay) {
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** O agente consulta o CRM a cada poucos segundos; sem sinal há 2 min, consideramos desligado. */
export function isAgentOnline(lastSeenAt: string | null | undefined, now: Date, maxSilenceMs = 120_000): boolean {
  if (!lastSeenAt) return false;
  const seen = Date.parse(lastSeenAt);
  return Number.isFinite(seen) && now.getTime() - seen <= maxSilenceMs;
}

export type AgentOutcome = "enviado" | "simulado" | "erro" | "verificar";

/**
 * Transições que o agente pode pedir. "verificar" e "enviado" só depois de
 * confirmado (foi aí que o robô clicou em Autorizar); "simulado" e "erro" antes.
 */
export function canAgentFinish(current: PortalRobotStatus, outcome: AgentOutcome, mode: PortalRobotMode): boolean {
  if (outcome === "enviado" || outcome === "verificar") return current === "confirmado" && mode === "autorizar";
  if (outcome === "simulado") return mode === "simular" && (current === "em_andamento" || current === "aguardando_confirmacao");
  return current === "em_andamento" || current === "aguardando_confirmacao" || current === "cancelado";
}

/** A recepção só cancela antes da confirmação — depois disso o robô pode estar clicando em Autorizar. */
export function canCancel(current: PortalRobotStatus): boolean {
  return current === "na_fila" || current === "em_andamento" || current === "aguardando_confirmacao";
}

export function formatReferenceMonth(month: string | null | undefined): string {
  if (!month || !MONTH.test(month)) return "—";
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(month.slice(5, 7)) - 1]}/${month.slice(0, 4)}`;
}

/** Nome do computador do robô, como aparece em Configurações → Robô do portal. */
export const AGENT_NAME_MAX = 60;

export function normalizeAgentName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2) return { ok: false, error: "Dê um nome ao computador (ex.: Computador da recepção)." };
  if (name.length > AGENT_NAME_MAX) return { ok: false, error: `O nome pode ter no máximo ${AGENT_NAME_MAX} caracteres.` };
  return { ok: true, value: name };
}
