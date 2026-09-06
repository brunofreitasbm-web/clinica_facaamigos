# Credenciais de Teste e Desenvolvimento - Clínica FaçaAmigos

Este documento descreve como criar contas de teste para os ambientes de desenvolvimento e staging da aplicação **FaçaAmigos**. Não há mais senha padrão nem lista de e-mails fixos versionada neste arquivo — o login é feito exclusivamente via Supabase Auth (`app/login/actions.ts`), sem modo demo.

---

## Perfis do sistema

| Perfil | Permissões |
| :--- | :--- |
| **Gestor** | Acesso total, gerenciamento de equipe, relatórios e métricas. |
| **Supervisor** | Validação de notas de sessão, planos de tratamento e supervisão. |
| **Terapeuta** | Registro de presença, notas de sessão e evolução de pacientes. |
| **Recepção** | Agendamentos, checagem de presença e cadastro de pacientes. |
| **Faturamento** | Faturamento, guias de convênio e controle de repasses. |

## Como criar uma conta de teste

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. Na barra lateral, navegue até **Authentication > Users**.
3. Clique em **Add User > Create User**.
4. Use um e-mail de teste próprio e gere uma senha forte e exclusiva para esse ambiente — nunca reutilize a mesma senha entre contas ou ambientes.
5. Marque **Auto Confirm User?** para ativar a conta sem precisar de e-mail de confirmação.
6. Associe o perfil na tabela `public.profiles`, informando o `role` desejado.

---

## Observações de Segurança

- Nunca versionar e-mails e senhas de contas reais ou de teste neste repositório, mesmo marcadas como "só para dev/staging" — arquivos de texto no controle de versão não são um cofre de credenciais.
- Guarde senhas de teste em um gerenciador de senhas ou variável de ambiente local, fora do git.
- Em produção, todo usuário deve trocar a senha temporária no primeiro acesso.
