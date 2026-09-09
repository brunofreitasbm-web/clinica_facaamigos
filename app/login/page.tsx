import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand/logo";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex flex-col items-center w-full mb-4">
        <Logo variant="vertical" height={132} className="mb-6" />
        <h1 className="mt-2 text-2xl font-semibold text-ink">Entrar</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Use o e-mail e senha cadastrados pelo gestor da clínica.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
