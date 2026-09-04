import { LoginForm } from "./login-form";

export default function LoginPage() {
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
    </main>
  );
}
