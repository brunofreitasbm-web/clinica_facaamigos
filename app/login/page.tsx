import { LoginForm } from "./login-form";
import { devLogin } from "./actions";

export default function LoginPage() {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-chart">
          FaçaAmigos
        </span>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Entrar</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Use o e-mail e senha cadastrados pelo gestor da clínica.
        </p>
      </div>
      <LoginForm />
      {isDev && (
        <div className="rounded-md border border-dashed border-amber-500/60 bg-amber-500/10 p-3">
          <p className="text-xs text-ink-soft">
            Ambiente de desenvolvimento: entre com acesso total (gestor) sem senha e troque de visão
            depois pela barra superior.
          </p>
          <form action={devLogin}>
            <button
              type="submit"
              className="mt-2 w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
            >
              🛠️ Dev: acesso total (gestor)
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
