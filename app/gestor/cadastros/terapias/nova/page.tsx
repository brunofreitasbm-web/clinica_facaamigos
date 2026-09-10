import Link from "next/link";
import { ProtocolForm } from "./protocol-form";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

export default function NovoProtocoloPage() {
  return (
    <PageContainer>
      <div>
        <Link href="/gestor/cadastros/protocolos" className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← Protocolos
        </Link>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mt-3 mb-1">
          Avaliação inicial
        </h6>
        <h1 className="m-0">Cadastrar protocolo licenciado</h1>
      </div>
      <ProtocolForm />
    </PageContainer>
  );
}
