-- supabase/migrations/20261006120000_clinic_faq_audit_fixes.sql
-- Auditoria do chatbot de leads (out/2026): respostas da base de conhecimento
-- que iam erradas para as famílias.

-- 1. A resposta sobre telefone de contato era o marcador "⚠️ TODO: preencher
-- telefone…" e entrava no prompt do agente de FAQ. Desativada até o gestor
-- preencher o texto em /gestor/cadastros/faq (sem ela, o agente escala a
-- pergunta para a equipe em vez de inventar).
update clinic_faq
set active = false,
    updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question = 'Qual o telefone para contato?'
  and answer like '%TODO%';

-- 2. "Meu filho tem laudo de TEA" dizia que o laudo não é obrigatório, mas o
-- fluxo AGENDAR e a própria FAQ "Preciso de encaminhamento médico?" pedem
-- laudo/pedido médico com CID para o convênio. Alinha: obrigatório só pelo plano.
update clinic_faq
set answer = 'Atendemos sim, com muito carinho. Nossa equipe é especializada em desenvolvimento infantil e atende crianças com TEA, atraso de fala, dificuldades de aprendizagem e questões sensoriais. Pelo *particular*, o laudo não é obrigatório para começar. Pelo *convênio*, o plano pede o laudo ou pedido médico (com CID) para autorizar. 💛',
    updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question = 'Meu filho tem laudo de TEA (autismo). Vocês atendem?';

-- Pendente de decisão do dono (não alterado aqui): "Quanto tempo dura cada
-- sessão?" diz que TODAS duram 40 min, e "Psicoterapia infantil pelo convênio
-- é individual ou em grupo?" diz 30 min para o grupo.
