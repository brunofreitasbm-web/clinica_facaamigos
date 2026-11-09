// lib/atendimento/chat-deep-link-pure.ts
// Link direto para uma conversa do Chat. PURO, sem I/O.
//
// Por que existe: Autorizações e a Fila de pendências sabem o TELEFONE do contato mas não tinham como
// abrir a conversa dele; o operador buscava o nome à mão na outra tela. `?tel=` resolve isso sem exigir
// que essas telas conheçam o id interno da conversa.

const BASE = "/recepcao/atendimento";

type Param = string | string[] | undefined;

const first = (value: Param): string | null => {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim() ? v.trim() : null;
};

/** Só dígitos, sem o 55 do Brasil quando sobra número com DDD (10 ou 11 dígitos). */
function nationalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}

/** Conversa a abrir ao carregar a tela: `?c=<id>` primeiro, depois `?tel=<telefone>`; `null` se nenhuma casar. */
export function resolveInitialConversationId(
  rows: { id: string; phoneNumber: string }[],
  params: { c?: Param; tel?: Param },
): string | null {
  const id = first(params.c);
  if (id && rows.some((r) => r.id === id)) return id;

  const tel = first(params.tel);
  if (tel) {
    const wanted = nationalDigits(tel);
    // Menos de 8 dígitos casaria conversas erradas por coincidência.
    if (wanted.length >= 8) {
      const match = rows.find((r) => nationalDigits(r.phoneNumber) === wanted);
      if (match) return match.id;
    }
  }
  return null;
}

/** Link para a tela de Chat já na conversa certa; por id quando se conhece, senão por telefone. */
export function chatHref(target: { conversationId?: string | null; phone?: string | null }): string {
  if (target.conversationId) return `${BASE}?c=${encodeURIComponent(target.conversationId)}`;
  if (target.phone) return `${BASE}?tel=${encodeURIComponent(target.phone)}`;
  return BASE;
}
