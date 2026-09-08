-- supabase/migrations/20260908180000_pts_templates.sql
-- Banco de templates pré-cadastrados para o Plano Terapêutico Singular (PTS).
-- Permite agilizar e padronizar o preenchimento de Domínio, Meta (descrição),
-- Linha de Base, Estratégia, Critério de Mastery, Horizonte, Metodologia e Programas ABA.

create table pts_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  discipline text not null,                       -- ex: 'aba', 'fonoaudiologia', 'psicologia', 'terapia_ocupacional', 'fisioterapia'
  domain text not null,                           -- ex: 'Comunicação', 'Comportamento', 'Autonomia'
  title text not null,                            -- Rótulo curto amigável do template
  description text not null,                      -- Texto completo da Meta SMART
  baseline text,                                  -- Linha de base padrão sugerida
  strategy text,                                  -- Estratégia / procedimento padrão
  criterion text,                                 -- Critério de mastery padrão
  horizon text check (horizon in ('curto', 'medio', 'longo')),
  methodology text check (methodology in ('dtt', 'naturalistico', 'misto', 'outra')),
  programs_default jsonb not null default '[]'::jsonb, -- Array de programas ABA padrão [{name, targetType, masteryCriterion}]
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pts_templates enable row level security;

-- Leitura: Qualquer membro da equipe com acesso à clínica pode ler os templates ativos
create policy pts_templates_read on pts_templates for select
  using (clinic_id = (select current_clinic_id()));

-- Inserção: Supervisores e gestores (ou terapeutas via "Salvar como Template")
create policy pts_templates_insert on pts_templates for insert
  with check (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) = any (array['terapeuta', 'supervisor', 'gestor'])
  );

-- Atualização e Exclusão: Supervisores e gestores
create policy pts_templates_update on pts_templates for update
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) = any (array['supervisor', 'gestor'])
  )
  with check (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) = any (array['supervisor', 'gestor'])
  );

create policy pts_templates_delete on pts_templates for delete
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) = any (array['supervisor', 'gestor'])
  );

create index idx_pts_templates_clinic_disc_active
  on pts_templates (clinic_id, discipline, active, sort_order);

-- Semeia (seed) templates iniciais universais para todas as clínicas existentes
insert into pts_templates (
  clinic_id,
  discipline,
  domain,
  title,
  description,
  baseline,
  strategy,
  criterion,
  horizon,
  methodology,
  programs_default,
  sort_order
)
select
  c.id,
  t.discipline,
  t.domain,
  t.title,
  t.description,
  t.baseline,
  t.strategy,
  t.criterion,
  t.horizon,
  t.methodology,
  t.programs_default::jsonb,
  t.sort_order
from clinics c
cross join (values
  (
    'aba',
    'Comunicação Verbal (Mando)',
    'Mando de itens desejados com frase de 2 palavras',
    'Emitir pedido (mando) utilizando frase com pelo menos 2 palavras (ex: "quero água", "dá bola") diante de item desejado ou contexto motivacional.',
    'Emite apenas vocalizações isoladas ou gestos ao apontar o item desejado.',
    'Treino em blocos de tentativas discretas (DTT) com dicas graduadas (total -> parcial -> esvanecimento) e reforço positivo imediato.',
    '80% de acertos independentes em 3 sessões consecutivas com pelo menos 2 aplicadores diferentes.',
    'curto',
    'dtt',
    '[{"name": "Solicitar brinquedo motivador", "targetType": "tentativa", "masteryCriterion": "80% em 3 sessões"}, {"name": "Solicitar alimento/bebida", "targetType": "tentativa", "masteryCriterion": "80% em 3 sessões"}]',
    1
  ),
  (
    'aba',
    'Habilidades Sociais (Contato Visual)',
    'Contato visual espontâneo ao ser chamado pelo nome',
    'Olhar para o rosto do interlocutor em até 3 segundos após ser chamado pelo nome, em 4 de 5 oportunidades.',
    'Responde ao nome em menos de 20% das oportunidades sem orientação física/gestual.',
    'Ensino naturalístico no ambiente de jogo com bloqueio suave do estímulo concorrente e reforço diferenciado.',
    '80% de acertos em 4 sessões consecutivas.',
    'curto',
    'naturalistico',
    '[{"name": "Contato visual ao chamar pelo nome", "targetType": "tentativa", "masteryCriterion": "80% em 4 sessões"}]',
    2
  ),
  (
    'aba',
    'Comportamento Adaptativo / Autonomia',
    'Higienização das mãos de forma independente',
    'Completar a sequência de lavagem das mãos (abrir torneira, ensaboar, enxaguar, fechar torneira, secar) com no máximo 1 dica gestual.',
    'Depende de ajuda física total em 4 das 5 etapas da lavagem das mãos.',
    'Análise de tarefas (Task Analysis) com encadeamento para frente (Forward Chaining) e dica visual com pictograma.',
    '100% dos passos executados de forma independente por 5 dias consecutivos.',
    'medio',
    'misto',
    '[{"name": "Sequência de lavar mãos", "targetType": "tarefa", "masteryCriterion": "100% de independência em 5 dias"}]',
    3
  ),
  (
    'fonoaudiologia',
    'Linguagem Receptiva / Compreensão',
    'Compreensão de ordens simples de 2 comandos',
    'Compreender e executar instruções verbais simples de duas etapas relacionando objetos familiares (ex: "pegue o copo e coloque na mesa").',
    'Executa apenas ordens de uma etapa com dica gestual associada.',
    'Atividades lúdicas estruturadas com pistas visuais e redução gradativa do suporte gestual.',
    '85% de acerto nas oportunidades apresentadas em ambiente terapêutico.',
    'curto',
    'misto',
    '[]',
    4
  ),
  (
    'fonoaudiologia',
    'Motricidade Orofacial & Mastigação',
    'Mastigação bilateral alternada de alimentos sólidos',
    'Realizar mastigação bilateral eficiente e alternada com fechamento labial durante a refeição de sólidos.',
    'Apresenta mastigação amassadora anteriorizada com escape de alimento e escape de saliva.',
    'Exercícios mioterapêuticos orofaciais com estimulação tátil-proprioceptiva prévia às refeições.',
    'Manutenção do padrão mastigatório adequado durante 80% do tempo de refeição.',
    'medio',
    'outra',
    '[]',
    5
  ),
  (
    'terapia_ocupacional',
    'Integração Sensorial & Auto-regulação',
    'Auto-regulação frente a estímulos táteis e auditivos',
    'Permanecer engajado em atividade estruturada por 15 minutos sem comportamentos de esquiva ou desorganização sensorial.',
    'Desorganização comportamental e recusa em até 2 minutos de exposição a texturas ou ruídos moderados.',
    'Abordagem de Integração Sensorial de Ayres (ASI) com dieta sensorial individualizada e uso de acomodações ambientais.',
    'Conclusão da tarefa sem crises ou busca disfuncional em 4 de 5 sessões.',
    'curto',
    'naturalistico',
    '[]',
    6
  ),
  (
    'terapia_ocupacional',
    'Praxia & Coordenação Motora Fina',
    'Preensão em pinça tripé para escrita e desenho',
    'Adotar e manter a pegada em pinça tripé funcional durante atividades de grafomotricidade por pelo menos 10 minutos.',
    'Preensão palmar imatura com fadiga motora rápida após 2 minutos de uso do lápis.',
    'Atividades de fortalecimento da musculatura intrínseca da mão (massa terapêutica, pinças, rasgadura) com adaptadores de escrita.',
    'Uso espontâneo do padrão funcional em 80% das tarefas gráficas.',
    'medio',
    'misto',
    '[]',
    7
  ),
  (
    'psicologia',
    'Reconhecimento & Expressão Emocional',
    'Identificação e nomeação de emoções básicas',
    'Identificar e nomear corretamente as 4 emoções básicas (alegria, tristeza, raiva, medo) em si e em figuras/situações sociais.',
    'Não nomeia emoções e expressa frustração exclusivamente por meio de choro ou agressividade.',
    'Uso de cartões de emoções, termômetro dos sentimentos, role-playing e histórias sociais.',
    '90% de acertos na identificação e relato verbal de emoções em sessão.',
    'curto',
    'misto',
    '[]',
    8
  ),
  (
    'fisioterapia',
    'Controle Postural & Equilíbrio',
    'Equilíbrio unipodal dinâmico',
    'Manter o equilíbrio em apoio unipodal por 5 segundos com alternância dos membros inferiores.',
    'Equilíbrio instável mantido por menos de 1 segundo com apoio bipedal amplo.',
    'Treino em circuito funcional com superfícies instáveis (disco de equilíbrio, cama elástica) e estímulo visual.',
    'Conseguir manter 5 segundos de sustentação em 4 de 5 tentativas.',
    'curto',
    'misto',
    '[]',
    9
  )
) as t(discipline, domain, title, description, baseline, strategy, criterion, horizon, methodology, programs_default, sort_order)
on conflict do nothing;
