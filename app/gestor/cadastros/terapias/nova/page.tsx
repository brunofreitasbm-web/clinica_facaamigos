import Link from "next/link";
import { ProtocolForm } from "./protocol-form";

export const dynamic = "force-dynamic";

export default function NovoProtocoloPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <div>
        <Link href="/gestor/cadastros/terapias" className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← Terapias
        </Link>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mt-3 mb-1">
          Módulo 3 MAAIS · Avaliação inicial
        </h6>
        <h1 className="m-0">Cadastrar protocolo licenciado</h1>
      </div>
      <ProtocolForm />
    </main>
  );
}
