# Credenciais de Teste e Desenvolvimento - Clínica FaçaAmigos

Este documento lista as contas de teste padrão pré-configuradas para o ambiente de desenvolvimento e testes da aplicação **FaçaAmigos**.

> **Senha Padrão para Todos os Usuários:** `facaamigos123`

---

## Contas de Teste por Perfil

| Perfil | E-mail | Senha Padrão | Descrição / Permissões |
| :--- | :--- | :--- | :--- |
| **Gestor** | `gestor@facaamigos.com.br` | `facaamigos123` | Acesso total, gerenciamento de equipe, relatórios e métricas. |
| **Supervisor** | `supervisor@facaamigos.com.br` | `facaamigos123` | Validação de notas de sessão, planos de tratamento e supervisão. |
| **Terapeuta** | `terapeuta@facaamigos.com.br` | `facaamigos123` | Registro de presença, notas de sessão e evolução de pacientes. |
| **Recepção** | `recepcao@facaamigos.com.br` | `facaamigos123` | Agendamentos, checagem de presença e cadastro de pacientes. |
| **Faturamento** | `faturamento@facaamigos.com.br` | `facaamigos123` | Faturamento, guias de convênio e controle de repasses. |

---

## Como Criar/Restaurar os Usuários no Supabase Auth

### Opção 1: Via Dashboard do Supabase
1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. Na barra lateral, navegue até **Authentication > Users**.
3. Clique em **Add User > Create User**.
4. Insira um dos e-mails acima e defina a senha como `facaamigos123`.
5. Marque a opção **Auto Confirm User?** para ativar a conta imediatamente sem precisar de e-mail de confirmação.
6. Associe o perfil na tabela `public.profiles` informando o `role` desejado.

---

## Observações de Segurança
- **Ambiente de Produção:** Estas credenciais devem ser utilizadas **exclusivamente em ambiente local ou de staging/testes**.
- **Troca de Senhas:** Em ambiente de produção, todos os usuários deverão alterar a senha temporária no primeiro acesso.
