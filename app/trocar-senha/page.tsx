import { ChangePasswordForm } from "./change-password-form";
import { Logo } from "@/components/brand/logo";

export default function TrocarSenhaPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <Logo variant="horizontal" height={40} />
        <h1 className="mt-4 text-2xl font-semibold text-ink">Troque sua senha</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Este é seu primeiro acesso. Por segurança, defina uma nova senha antes de continuar.
        </p>
      </div>
      <ChangePasswordForm />
    </main>
  );
}
