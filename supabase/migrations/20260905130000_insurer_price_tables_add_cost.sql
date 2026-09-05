-- Custo interno do serviço/procedimento, independente do preço cobrado por convênio.
-- Usado na tela Configurações > Serviços para comparar custo x preço por linha de preço.

alter table insurer_price_tables add column cost numeric(10,2);
