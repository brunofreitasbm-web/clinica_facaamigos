import { redirect } from "next/navigation";

/**
 * Cadastro e gestão de contas foi consolidado em /gestor/equipe (Colaboradores
 * & Contas) — evita duas telas de "criar usuário" com regras de segurança
 * diferentes (uma criava conta de auth de verdade e checava papel, a outra
 * inseria direto em `profiles` sem checagem).
 */
export default function UsuariosConfigPage() {
  redirect("/gestor/equipe");
}
