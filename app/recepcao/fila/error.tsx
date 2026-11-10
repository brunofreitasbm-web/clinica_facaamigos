"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { EmptyState } from "@/components/ui/empty-state";

/** Erro local da Fila: o cabeçalho e o menu da Recepção continuam na tela e há uma saída (Autorizações). */
export default function FilaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[fila] falha ao carregar:", error);
  }, [error]);

  return (
    <PageContainer className="py-10">
      <EmptyState
        icon={AlertCircle}
        title="Não foi possível carregar a fila"
        description="Nada foi alterado. Tente de novo; se continuar, a tela de Autorizações segue funcionando."
        action={{ label: "Tentar de novo", onClick: reset }}
        secondaryAction={{ label: "Abrir Autorizações", href: "/recepcao/a-autorizar" }}
      />
    </PageContainer>
  );
}
