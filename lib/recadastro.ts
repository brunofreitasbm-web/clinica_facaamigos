// Recadastro de identidade (CPF + e-mail real) integrado ao Hub de Gestão (ação recadastro_status e
// recadastro_ticket da função gestao-hub).
//
// A Clínica NÃO é a autoridade: o Hub decide quem está pendente ou bloqueado. O cookie `fa_recad` é só
// otimização de UX (evita chamar o Hub a cada página) e nunca controle de acesso. Qualquer falha do Hub
// (rede, timeout, status != 200, JSON inválido) vira `null`, e `null` nunca bloqueia nem redireciona.
import { PUBLIC_PREFIXES } from "./public-paths.ts";

export type StatusRecadastro = { pendente: boolean; bloquear: boolean; dias_restantes: number };
export type CookieRecadastro = "ok" | "pendente" | "bloquear";

export const COOKIE_RECADASTRO = "fa_recad";
export const COOKIE_RECADASTRO_MAX_AGE = 12 * 60 * 60; // 12 h, em segundos
export const RECADASTRO_PATH = "/recadastro";
export const HUB_GESTAO_FUNCTION_URL = "https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/gestao-hub";
export const HUB_GESTAO_HOST = "gestao.institutofacaamigos.com.br";
const TIMEOUT_MS = 3000;

// Lida a cada chamada (não em tempo de build): ligar e desligar só exige mudar a configuração.
export function recadastroLigado(): boolean {
  return process.env.GESTAO_RECADASTRO === "1";
}

async function chamarHub(
  accessToken: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown> | null> {
  if (!recadastroLigado() || !accessToken) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const chamada = (async () => {
      const res = await fetchImpl(HUB_GESTAO_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...body, sistema: "clinica" }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status !== 200) return null;
      const json: unknown = await res.json();
      return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
    })();
    const limite = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, TIMEOUT_MS);
    });
    return await Promise.race([chamada, limite]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function consultarStatusRecadastro(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<StatusRecadastro | null> {
  const r = await chamarHub(accessToken, { action: "recadastro_status" }, fetchImpl);
  if (!r) return null;
  if (typeof r.pendente !== "boolean" || typeof r.bloquear !== "boolean") return null;
  const dias = typeof r.dias_restantes === "number" && Number.isFinite(r.dias_restantes) ? r.dias_restantes : 0;
  return { pendente: r.pendente, bloquear: r.bloquear, dias_restantes: dias };
}

export async function pedirTicketRecadastro(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const r = await chamarHub(accessToken, { action: "recadastro_ticket" }, fetchImpl);
  if (!r || typeof r.url !== "string" || !r.url) return null;
  return urlDoHubValida(r.url, process.env.GESTAO_RECADASTRO_HOST) ? r.url : null;
}

// Evita open redirect se o Hub devolver algo estranho: só https e só o host do Hub (ou o configurado).
export function urlDoHubValida(url: string, hostExtra?: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const permitidos = [HUB_GESTAO_HOST, (hostExtra ?? "").trim().toLowerCase()].filter(Boolean);
    return permitidos.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function cookieDoStatus(s: StatusRecadastro | null): CookieRecadastro {
  if (!s || !s.pendente) return "ok";
  return s.bloquear ? "bloquear" : "pendente";
}

export function opcoesCookieRecadastro() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_RECADASTRO_MAX_AGE,
  };
}

const ROTAS_ISENTAS = [RECADASTRO_PATH, "/login", "/trocar-senha", "/familia", ...PUBLIC_PREFIXES];

function rotaIsenta(pathname: string): boolean {
  return ROTAS_ISENTAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Só o valor literal "bloquear" redireciona; qualquer outro valor de cookie é ignorado.
export function decidirRedirecionamentoRecadastro(
  cookie: string | undefined,
  pathname: string,
): "recadastro" | null {
  if (cookie !== "bloquear") return null;
  return rotaIsenta(pathname) ? null : "recadastro";
}

// Responsáveis (portal da família) e contas de quiosque/estagiário do RH ficam fora do recadastro.
export function contaIsentaDeRecadastro(
  perfilRole: string | null | undefined,
  appRole: string | null | undefined,
): boolean {
  const app = appRole ?? "";
  return perfilRole === "responsavel" || app.endsWith("_unit") || app === "intern";
}
