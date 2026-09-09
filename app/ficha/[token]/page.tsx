import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { resolveIntakeToken, INTAKE_TOKEN_MESSAGES } from "@/lib/patient-intake-form";
import { FichaForm } from "./ficha-form";

export const metadata: Metadata = {
  // Só o nome da tela: o template do layout raiz já anexa "· FaçaAmigos".
  title: "Ficha do paciente",
  // Link de dado clínico não entra em buscador.
  robots: { index: false, follow: false },
};

// Cada visita revalida o token (pode ter expirado ou sido revogado desde o
// último acesso) — nada aqui pode ser servido de cache.
export const dynamic = "force-dynamic";

export default async function FichaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveIntakeToken(token);

  if (!resolved.ok) {
    const { title, body } = INTAKE_TOKEN_MESSAGES[resolved.reason];
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <Logo variant="vertical" height={104} />
        <div className="card items-center gap-2 p-8">
          <p className="card-title">{title}</p>
          <p className="card-body">{body}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col items-center gap-4 text-center">
        <Logo variant="vertical" height={112} />
        <div>
          <h1 className="m-0 text-2xl font-semibold text-ink">Ficha do paciente</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Olá, família de <strong>{resolved.target.patientName}</strong>! Estas informações nos
            ajudam a preparar o primeiro atendimento com carinho e cuidado.
          </p>
        </div>
      </header>

      <FichaForm token={token} patientName={resolved.target.patientName} />
    </main>
  );
}
