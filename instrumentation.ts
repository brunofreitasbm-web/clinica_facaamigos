import { type Instrumentation } from "next";

export async function register() {
  // Ambientes de desenvolvimento em sandbox (ex.: Claude Code Remote) exigem
  // saída HTTP via proxy explícito — o fetch nativo do Node não lê
  // HTTPS_PROXY sozinho. Produção (Vercel) tem saída direta e não passa
  // por aqui (a env var não existe lá).
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.HTTPS_PROXY) {
    const { ProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
  }
}

/**
 * Sem isso, um erro de Server Component em produção chega ao navegador só
 * como "Minified React error #441" (mensagem genérica de erro de servidor,
 * ver lib/format.ts) e um `digest` numérico — sem esse hook, o digest não
 * tem como ser ligado à exceção real, e a causa só é descoberta no código
 * (ver histórico de app/recepcao/pacientes/[id]/page.tsx). Aqui ele vai pros
 * runtime logs da Vercel, correlacionável pelo `digest` que app/error.tsx já
 * exibe no console do navegador.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String((err as { digest?: unknown }).digest) : undefined;
  const stack = err instanceof Error ? err.stack : undefined;

  console.error("[onRequestError]", {
    message,
    digest,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    stack,
  });
};
