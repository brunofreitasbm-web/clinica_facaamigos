-- Fase 0 / item 4 — limpeza de linhas órfãs da fila de pendências. NÃO foi executado.
-- Verificado em 09/11/2026: nenhum rascunho 'extracted' com paciente já agendado/avaliado
-- está sem guia enviada/autorizada, então não há rascunho redundante a arquivar (AGENTS.md, diretriz 3).
-- Restam só linhas de fila cujo rascunho já foi validado, rejeitado ou falhou.
-- Teste num branch do Supabase; produção só com aprovação do dono.

-- PASSO 1: prévia (esperado: 10 linhas em 09/11/2026).
select pqa.id, pqa.item_id, rd.status as draft_status
from pending_queue_assignments pqa
join registration_drafts rd on pqa.item_id = 'cadastro-ia-' || rd.id::text
where pqa.resolved_at is null and pqa.category = 'cadastro_assistido_ia'
  and rd.status in ('validated', 'rejected', 'failed');

-- PASSO 2: fechar as linhas órfãs (desfazível: resolved_at = null).
-- update pending_queue_assignments pqa
-- set resolved_at = now()
-- from registration_drafts rd
-- where pqa.item_id = 'cadastro-ia-' || rd.id::text
--   and pqa.resolved_at is null and pqa.category = 'cadastro_assistido_ia'
--   and rd.status in ('validated', 'rejected', 'failed');
