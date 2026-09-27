import { createPosAdminClient } from "./pos-client";

/**
 * Leitura ao vivo do projeto Supabase do PDV (fa_kiosk_*) pra alimentar o
 * DRE/Fluxo de Caixa do Playground e do Circuito. Nada aqui grava nada —
 * é só leitura, agregada por mês.
 *
 * Playground e Circuito são a MESMA unidade no PDV (fa_kiosk_units, id
 * '11111111-…', seed em ../APP PLAYFaça Amigos/supabase/migrations/
 * 20260811000003_fa_seed_unit_plan.sql) — o que separa as duas é o campo
 * `activity` da sessão (fa_kiosk_sessions.activity: 'PLAYGROUND' |
 * 'CARRINHO'). Venda de produto no balcão (item_nature='PRODUTO', sem
 * session_id) não tem como saber qual fila vendeu — por decisão de
 * simplicidade, entra toda no bucket do Playground (é o balcão físico
 * do playground; risco de distorção é baixo).
 */
const PLAYGROUND_UNIT_ID = "11111111-1111-1111-1111-111111111111";

export type PosUnitMonthlyFigures = {
  /** Receita reconhecida no mês (pedidos PAGA no business_date do mês), em reais. */
  receitaBruta: number;
  /** Entrada de caixa no mês (pagamentos recebidos, cash basis), em reais — pode diferir da receita por sessões pré-pagas. */
  entradaCaixa: number;
  porMetodo: Record<"DINHEIRO" | "PIX" | "CREDITO" | "DEBITO" | "VOUCHER", number>;
  disponivel: true;
};

export type PosMonthlyUnavailable = { disponivel: false; motivo: string };

function monthRange(competenceMonth: string): { start: string; end: string } {
  const [y, m] = competenceMonth.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(y, m, 1)); // primeiro dia do mês seguinte
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

/**
 * @param unit "playground" | "circuito"
 * @param competenceMonth "YYYY-MM"
 */
export async function getPosUnitMonthlyFigures(
  unit: "playground" | "circuito",
  competenceMonth: string
): Promise<PosUnitMonthlyFigures | PosMonthlyUnavailable> {
  const supabase = createPosAdminClient();
  if (!supabase) {
    return { disponivel: false, motivo: "POS_SUPABASE_URL/POS_SUPABASE_SERVICE_ROLE_KEY não configuradas" };
  }

  const { start, end } = monthRange(competenceMonth);

  const { data: orders, error: ordersError } = await supabase
    .from("fa_kiosk_orders")
    .select("id")
    .eq("unit_id", PLAYGROUND_UNIT_ID)
    .eq("status", "PAGA")
    .gte("business_date", start)
    .lt("business_date", end);

  if (ordersError) {
    return { disponivel: false, motivo: `erro ao ler fa_kiosk_orders: ${ordersError.message}` };
  }
  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) {
    return {
      disponivel: true,
      receitaBruta: 0,
      entradaCaixa: 0,
      porMetodo: { DINHEIRO: 0, PIX: 0, CREDITO: 0, DEBITO: 0, VOUCHER: 0 },
    };
  }

  const { data: items, error: itemsError } = await supabase
    .from("fa_kiosk_order_items")
    .select("order_id, total_cents, session_id, item_nature")
    .in("order_id", orderIds);
  if (itemsError) {
    return { disponivel: false, motivo: `erro ao ler fa_kiosk_order_items: ${itemsError.message}` };
  }

  const sessionIds = Array.from(
    new Set((items ?? []).map((i) => i.session_id as string | null).filter((v): v is string => !!v))
  );
  const activityBySession = new Map<string, string>();
  if (sessionIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from("fa_kiosk_sessions")
      .select("id, activity")
      .in("id", sessionIds);
    if (sessionsError) {
      return { disponivel: false, motivo: `erro ao ler fa_kiosk_sessions: ${sessionsError.message}` };
    }
    for (const s of sessions ?? []) activityBySession.set(s.id as string, s.activity as string);
  }

  let receitaCentsPlayground = 0;
  let receitaCentsCircuito = 0;
  for (const item of items ?? []) {
    const cents = Number(item.total_cents ?? 0);
    const sessionId = item.session_id as string | null;
    const activity = sessionId ? activityBySession.get(sessionId) : undefined;
    if (activity === "CARRINHO") receitaCentsCircuito += cents;
    else receitaCentsPlayground += cents; // PLAYGROUND, sem sessão (PDV) ou sessão sem activity mapeado
  }
  const receitaBrutaCents = unit === "circuito" ? receitaCentsCircuito : receitaCentsPlayground;
  const relevantOrderIds =
    unit === "circuito"
      ? Array.from(
          new Set(
            (items ?? [])
              .filter((i) => (i.session_id ? activityBySession.get(i.session_id as string) === "CARRINHO" : false))
              .map((i) => i.order_id as string)
          )
        )
      : orderIds;

  const { data: payments, error: paymentsError } = await supabase
    .from("fa_kiosk_payments")
    .select("order_id, method, amount_cents")
    .in("order_id", relevantOrderIds.length > 0 ? relevantOrderIds : ["00000000-0000-0000-0000-000000000000"]);
  if (paymentsError) {
    return { disponivel: false, motivo: `erro ao ler fa_kiosk_payments: ${paymentsError.message}` };
  }

  const porMetodoCents: Record<string, number> = { DINHEIRO: 0, PIX: 0, CREDITO: 0, DEBITO: 0, VOUCHER: 0 };
  let entradaCaixaCents = 0;
  for (const p of payments ?? []) {
    const cents = Number(p.amount_cents ?? 0);
    const method = p.method as string;
    porMetodoCents[method] = (porMetodoCents[method] ?? 0) + cents;
    entradaCaixaCents += cents;
  }

  return {
    disponivel: true,
    receitaBruta: receitaBrutaCents / 100,
    entradaCaixa: entradaCaixaCents / 100,
    porMetodo: {
      DINHEIRO: (porMetodoCents.DINHEIRO ?? 0) / 100,
      PIX: (porMetodoCents.PIX ?? 0) / 100,
      CREDITO: (porMetodoCents.CREDITO ?? 0) / 100,
      DEBITO: (porMetodoCents.DEBITO ?? 0) / 100,
      VOUCHER: (porMetodoCents.VOUCHER ?? 0) / 100,
    },
  };
}
