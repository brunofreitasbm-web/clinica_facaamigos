# Anexos e documentação (§9.5) Implementation Plan

**Goal:** Dar à ficha do paciente (`/recepcao/pacientes/[id]`) uma seção "Documentos" — lista com categoria/validade/compartilhamento, upload por formulário (câmera ou arquivo) e visualização via signed URL — usando o bucket privado `clinic-documents` já provisionado e a tabela `documents` já com RLS completa.

**Architecture:** O portão de acesso real é a linha em `documents` (RLS via client de sessão), nunca o Storage isolado. Toda Server Action confirma a permissão com `await createClient()` (session) **antes** de qualquer chamada ao Storage com `createAdminClient()` (service-role, único jeito de tocar o bucket sem policy). Upload: INSERT em `documents` primeiro (id gerado na aplicação com `randomUUID()`, o que permite montar `storage_path` e inserir tudo numa única chamada, sem UPDATE posterior); só depois do insert confirmado o admin client sobe o arquivo; falha no upload dispara rollback (delete via admin client — `documents` não tem policy de DELETE pra nenhum papel). Download: SELECT da linha via session client primeiro (vazio = sem permissão OU inexistente, nunca diferenciado na mensagem); só então o admin client gera a signed URL (TTL 900s, teto do PRD §11) e grava a linha manual em `audit_log` (o trigger genérico só cobre INSERT/UPDATE/DELETE de tabela, não leitura).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, `@supabase/supabase-js` (session client via `lib/supabase/server.ts` + admin client via `lib/supabase/admin.ts`), Supabase Storage (bucket `clinic-documents`, já existente).

## Global Constraints

- Client admin nunca chamado sem uma checagem de RLS bem-sucedida (session client) logo antes, na mesma Server Action.
- Toda Server Action retorna `{ success: true } | { success: false; error: string }` (upload) ou `{ success: true; url: string } | { success: false; error: string }` (download) — erros de Postgres/Storage sempre mapeados pra português.
- Signed URL sempre com TTL de 900s (15 min) — teto do PRD §11, nunca aumentar.
- Categoria fixa por CHECK constraint no banco — a lista `DOCUMENT_CATEGORIES` (`lib/document-categories.ts`) é a única fonte pro select do formulário e pro rótulo da listagem.
- Sem compressão client-side, sem visualizador inline (abre a signed URL em nova aba), sem fluxo de exclusão/substituição, sem job de alerta de validade — só o destaque visual (vencido/vence em ≤15 dias) na lista, que é UI pura sobre `valid_until`.
- Mostrar o formulário de upload pra qualquer papel que a query de `profiles` indicar como potencialmente autorizado (`gestor`, `supervisor`, `recepcao`, `terapeuta`) — não checa "terapeuta vinculado a ESTE paciente" na UI; a RLS do INSERT rejeita sozinha quem não tiver vínculo.

## Arquivos

- `lib/document-categories.ts` (novo): `DOCUMENT_CATEGORIES`, `DOCUMENT_CATEGORY_LABEL`, `getValidityBadge(valid_until)`.
- `app/recepcao/pacientes/[id]/documents-actions.ts` (novo): `uploadDocument(patientId, formData)`, `getDocumentUrl(documentId)`.
- `app/recepcao/pacientes/[id]/document-view-button.tsx` (novo, client): botão "Ver documento" com `useTransition`, abre a signed URL em nova aba.
- `app/recepcao/pacientes/[id]/document-upload-form.tsx` (novo, client): formulário de upload (`file`, `category`, `valid_until`, `shared_with_family`).
- `app/recepcao/pacientes/[id]/page.tsx` (modificado): query de `documents` via session client (RLS decide o que aparece, sem filtro manual por role), lookup de `profiles.role` do usuário logado pra decidir se mostra o formulário, seção "Documentos" nova no JSX.

## Verificação

- `npm run build` (após `npm install`, pois o worktree não tinha `node_modules`) — compilou e tipou limpo, 16 rotas geradas, nenhum erro.
- Sem chave real de service-role no worktree — upload/download não testados fim a fim contra o Storage; validado lendo a API do `@supabase/supabase-js` (`.storage.from().upload()`/`.createSignedUrl()`) e conferindo RLS real de `documents` via `execute_sql` (leitura): `documents_read`/`documents_write`/`documents_update`, sem policy de DELETE — confirma a necessidade do rollback via admin client.

## Self-Review

**Spec coverage:** categorias fixas com validade (`DOCUMENT_CATEGORIES`), upload por câmera ou arquivo (`accept="image/*,application/pdf" capture="environment"`), download registrado no audit log (insert manual em `getDocumentUrl`), `shared_with_family` exibido na lista — todos os itens do PRD §9.5 no escopo desta fatia têm implementação correspondente. Alertas automáticos de validade e exclusão/substituição ficaram fora de escopo por instrução explícita do briefing (Fase 1/2).

**Desvios do briefing:** nenhum. O único ponto que exigiu decisão de engenharia não detalhada no briefing foi como preencher `storage_path` (NOT NULL) sem um UPDATE posterior — resolvido gerando o `id` do documento na aplicação (`randomUUID()`) e montando `storage_path` antes do INSERT único, exatamente no formato sugerido (`${patient_id}/${document_id}/${nome_sanitizado}`).
