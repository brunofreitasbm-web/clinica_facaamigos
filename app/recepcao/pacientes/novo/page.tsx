"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { InteressadoRapidoDialog } from "../../interessado-rapido-dialog";

/**
 * Rota mantida para os links externos (supervisão, gestor). O cadastro de
 * paciente é um só: o mesmo formulário do botão "Novo paciente" da recepção,
 * aberto direto. Ao fechar sem salvar, volta para a lista.
 */
export default function NovoPacientePage() {
  const router = useRouter();

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Novo paciente"
        description="Cadastro mínimo; o resto vem depois, na ficha."
      />
      <InteressadoRapidoDialog
        isOpen
        hideTriggerButton
        onOpenChange={(open) => {
          if (!open) router.push("/recepcao/pacientes");
        }}
      />
    </main>
  );
}
