/**
 * Verificação de erros internos de controle de fluxo do Next.js.
 * Erros como redirect(), notFound() e DYNAMIC_SERVER_USAGE (decorrente de cookies/headers em prerender)
 * utilizam exceções internas que NÃO devem ser capturadas ou engolidas em blocos try/catch.
 */
export function isNextError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === "string") {
    return digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_");
  }
  return false;
}
