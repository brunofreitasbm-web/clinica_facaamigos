import { redirect } from "next/navigation";

/**
 * A listagem "Cadastro assistido por IA" foi desativada em 20/09/2026: os
 * rascunhos do WhatsApp/portal passaram a entrar direto na fila de
 * Pendências, já com arquivos, dados recebidos e conversa (ver
 * app/recepcao/pacientes/pendencias/draft-intake-card.tsx). A rota continua
 * existindo só pra não quebrar link antigo/favorito — a tela de validação de
 * um rascunho específico (/recepcao/pre-cadastros/[draftId]) segue ativa.
 */
export default function PreCadastrosPage() {
  redirect("/recepcao/pacientes/pendencias");
}
