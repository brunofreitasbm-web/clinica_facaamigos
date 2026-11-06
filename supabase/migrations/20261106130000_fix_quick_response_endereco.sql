-- Corrige a resposta rápida /endereco, que ainda tinha o texto de exemplo do seed.
-- Idempotente: só atualiza linhas que ainda contêm o texto de exemplo.
update quick_responses
set content_text = 'Estamos na Rua Boaventura da Silva, 1573, Umarizal, Belém/PA, entre a Alcindo Cacela e a 9 de Janeiro.'
where shortcut = '/endereco'
  and content_text ilike '%Rua Exemplo%';
