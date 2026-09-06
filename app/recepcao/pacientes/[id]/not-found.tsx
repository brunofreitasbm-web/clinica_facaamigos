import Link from "next/link";

export default function PatientNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-10 text-center">
      <div className="card max-w-[540px] w-full p-8 flex flex-col items-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold mb-4"
          style={{
            background: "var(--color-accent-100)",
            color: "var(--color-accent-700)",
          }}
        >
          ?
        </div>
        <h2 className="text-xl font-bold mb-2 text-ink">Ficha de paciente não encontrada</h2>
        <p className="text-sm text-ink-soft mb-6 max-w-[420px]">
          Não foi possível localizar o cadastro deste paciente. O registro pode não existir, ter sido removido ou o link acessado pode estar incorreto.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/recepcao/pacientes" className="btn btn-primary">
            ← Ver todos os pacientes
          </Link>
          <Link href="/recepcao/pacientes/novo" className="btn btn-secondary">
            + Cadastrar paciente
          </Link>
          <Link href="/recepcao" className="btn btn-ghost">
            Ir para Recepção
          </Link>
        </div>
      </div>
    </main>
  );
}
