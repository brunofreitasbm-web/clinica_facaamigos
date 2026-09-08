-- supabase/migrations/20260908040002_pending_queue_assignments_category_sync.sql
--
-- Achado ao integrar a categoria nova 'chegada_nao_confirmada' (check-in por
-- QR) em getReceptionQueue: a CHECK de pending_queue_assignments.category
-- (20260906000017) nunca foi atualizada quando lib/reception-queue.ts ganhou
-- categorias novas depois — ela ainda lista 'lead_sem_retorno' (renomeado
-- para 'interessado_sem_retorno' em 20260906000023, que só tocou
-- patients.status e metric_snapshots, não esta tabela) e nunca incluiu
-- 'remarcacao_solicitada', 'documento_familia_novo', 'renovacao_solicitada'
-- nem 'cadastro_assistido_ia'.
--
-- Efeito prático: attachQueueAssignments (lib/reception-queue.ts) faz um
-- upsert best-effort sem checar o erro — hoje isso já falha silenciosamente
-- pra 5 categorias (item aparece na fila, mas nunca ganha dono/prazo). Não é
-- crítico (a fila em si funciona), mas a categoria nova desta entrega
-- (chegada_nao_confirmada) depende do prazo de 15min pra escalar
-- corretamente — corrigido aqui alinhando a constraint à lista real do código.
alter table pending_queue_assignments drop constraint pending_queue_assignments_category_check;

alter table pending_queue_assignments add constraint pending_queue_assignments_category_check
  check (category in (
    'guia_vencendo', 'guia_poucas_sessoes', 'cadastro_incompleto',
    'evolucao_atrasada', 'documento_vencido', 'interessado_sem_retorno', 'falta_sem_motivo',
    'remarcacao_solicitada', 'documento_familia_novo', 'renovacao_solicitada',
    'cadastro_assistido_ia', 'chegada_nao_confirmada'
  ));
