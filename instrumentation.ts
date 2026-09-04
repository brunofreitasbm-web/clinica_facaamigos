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
