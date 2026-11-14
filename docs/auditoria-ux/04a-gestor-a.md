# Auditoria UX: módulo Gestão, parte A (Inteligência BI, NPS, Pessoas & Desempenho, Pacientes)

Escopo lido integralmente: components/gestor-nav.tsx, components/module-header.tsx, app/gestor/layout.tsx, app/gestor/page.tsx, app/gestor/inteligencia/** (page, _components/inteligencia-client.tsx, data.ts nas partes de métricas, operacional/page.tsx e data.ts), app/gestor/executive-leaks.tsx, components/gestor/* (cockpit, drilldown, plr-section-client, plr-statement-modal), components/Dashboard/DataTable.tsx (início), app/gestor/nps/*, components/nps-alerts-badge.tsx, app/gestor/bonificacao/* (page, actions, tier-approval-form, config/*), app/gestor/metas/*, app/gestor/equipe/page.tsx, components/equipe-subnav.tsx, app/gestor/tier-progression-table.tsx (início), app/gestor/pacientes/* (lista, layout, hub nav, três abas), app/gestor/atendimentos, app/gestor/protocolos/*, app/gestor/maturidade, app/gestor/data.ts (linhas 1 a 30 e 400 a 722). Regras 1, 2 e 5 do AGENTS.md aplicadas.

## 1. Mapa de menus

Barra do módulo (components/gestor-nav.tsx:21-31). Itens da parte A são os quatro primeiros. Os demais (Cadastros, Financeiro, Relatórios, Auditoria, Configurações) são da parte B.

| Item | Rota | Tela(s) | Tarefa do operador (gestor/dono) | Cliques da tarefa principal a partir da home |
|---|---|---|---|---|
| Marca "Gestão" (lockup) | /gestor, que redireciona para /gestor/inteligencia (app/gestor/page.tsx:6-8) | Inteligência BI | voltar à home | 1 |
| Inteligência BI | /gestor/inteligencia | inteligencia-client.tsx com 5 abas internas (Visão Geral, Funil, Equipe, Salas, Aniversariantes), seletor de período, botão "Métricas operacionais" | saber como está a clínica e o que exige decisão | 0 (é a home); ver funil/equipe/salas = 1 clique de aba; ver "operacional" = 1 clique no botão (inteligencia/page.tsx:22-26) |
| NPS (com badge de alertas) | /gestor/nps | nps-tabbed-view.tsx com 2 abas (Externo, Interno) | ver satisfação e tratar insatisfeitos | 1 para ver; tratar alerta = 2+ e sai do módulo (link para /supervisao, nps-tabbed-view.tsx:131) |
| Pessoas & Desempenho | /gestor/bonificacao (match inclui /gestor/metas, gestor-nav.tsx:26) | subnav com 4 abas (components/equipe-subnav.tsx:7-12): PLR & Desempenho, Configurar & Simular, Metas por Cargo, Contratos & Valor por módulo | acompanhar PLR, aprovar progressão de faixa, definir metas | ver PLR = 1; aprovar faixa = 1 + 3 (Aprovar, preencher faixa e valor, Confirmar) |
| Pacientes | /gestor/pacientes | lista; hub /gestor/pacientes/[id] com 3 abas (Cadastro & Dados, Anamnese / 1ª Avaliação, Terapêutica & Documentos) | localizar um paciente e abrir a ficha | 2 a 3 (menu, buscar, abrir) |

Rotas do gestor sem item no menu (parte A) ou que só redirecionam:

| Rota | Situação | Evidência |
|---|---|---|
| /gestor/maturidade | tela real, sem nenhum link em lugar algum do código; o menu só desliga o destaque (noActiveOn) | components/gestor-nav.tsx:48; busca por "gestor/maturidade" só retorna esse arquivo e o module-header.tsx:137 |
| /gestor/inteligencia/operacional | tela real, alcançável só por um botão no canto superior direito da BI | app/gestor/inteligencia/page.tsx:22-26 |
| /gestor/equipe | redireciona para /gestor/cadastros/colaboradores | app/gestor/equipe/page.tsx:12 (nome engana: "equipe" não é a aba de Pessoas & Desempenho) |
| /gestor/atendimentos | redireciona para cadastros/tipos-atendimento | app/gestor/atendimentos/page.tsx |
| /gestor/protocolos, /nova, /[protocolId] | só redirecionam para cadastros | app/gestor/protocolos/** |
| /gestor/convenios | só redireciona | app/gestor/convenios/page.tsx |
| /gestor/cadastros/pacientes | redireciona para /gestor/pacientes | app/gestor/cadastros/pacientes/page.tsx |
| Código morto (sem rota, sem import): ExecutiveLeaks, GestorCockpit, GestorDrilldownDrawer, DataTable, TierProgressionTable, getLeakCards, buildFaltaLeak etc. | | app/gestor/executive-leaks.tsx, components/gestor/gestor-cockpit.tsx, components/gestor/gestor-drilldown-drawer.tsx, components/Dashboard/DataTable.tsx, app/gestor/tier-progression-table.tsx, app/gestor/data.ts:75-300 |

## 2. Achados por item de menu

### 2.1 Inteligência BI

Resumo: tela técnica bem construída em termos de dados (check-in como regra de paciente, comparativo no card de atendimentos, estados vazios nas tabelas), mas é um painel de 15 blocos sem fila de decisão, sem drilldown, sem versão para celular e com um comparativo que mente no meio do mês.

**BI-01 | P1 | Lei de Hick, Carga cognitiva, Efeito Von Restorff, Efeito da posição serial, Regra 5 (a tela traz o trabalho)**
Evidência: app/gestor/inteligencia/_components/inteligencia-client.tsx:219-727 (Visão Geral são 15 blocos: 4 KPIs, tempo real, fluxo por hora, mapa de calor, planos, faturamento por plano, status, semana, mais 4 KPIs; todos com o mesmo peso visual); alerta de "travados ≥ 3 dias" só aparece como um bolinho na aba Funil (:165-169); alerta de capacidade só dentro da aba Salas (:1004-1032); fila de vazamentos de receita (faltas, sem autorização, notas atrasadas, evasão silenciosa) existe em app/gestor/data.ts:75-300 mas não é renderizada em lugar nenhum (executive-leaks.tsx e gestor-cockpit.tsx não são importados).
Problema: o gestor abre a BI e, em 5 segundos, não vê o que precisa de decisão. Vê 15 blocos de igual importância; o que é decisão (paciente travado, sala no limite, evasão acima da meta, glosa) está escondido em abas ou nem é exibido.
Correção: acima das abas, uma faixa "Precisa de decisão hoje" com no máximo 5 itens ordenados por urgência, cada um com número, referência (vs meta ou vs período anterior) e ação direta (abrir lista no painel lateral): pacientes travados ≥ 3 dias, salas ≥ 80%, evasão acima da meta, evolução 24h abaixo de 98% por terapeuta, glosa. Reaproveitar getLeakCards e o conteúdo do GestorCockpit que já estão prontos. Rebaixar para "ver mais" os blocos de apoio (mapa de calor, fluxo por hora, donut). Manter 4 KPIs de topo.
Esforço: M. Risco: baixo (só composição de tela; dados já existem).

**BI-02 | P1 | Regra 1 (comparativo), Carga cognitiva, confiança no dado**
Evidência: app/gestor/inteligencia/data.ts:296-304 (período anterior = mesma duração antes do início) combinado com app/gestor/data.ts:14-19 (currentMonthRange termina no dia 1 do mês seguinte) e data.ts:499-508 (growthPct); exibição em inteligencia-client.tsx:253-268. No período "Mês Atual" o numerador só conta check-ins que já aconteceram (mês parcial) e o denominador é o mês anterior inteiro.
Problema: a seta vermelha "↓ X% vs. período anterior" aparece quase todo mês até perto do dia 30, por ser mês parcial contra mês cheio. O comparativo obrigatório da regra 1 vira alarme falso. Ainda: quando o anterior é 0 o código devolve +100% (data.ts:505-508), só mascarado na UI pela guarda `< 5` (client :253).
Correção: comparar mês parcial com o mesmo intervalo de dias do mês anterior (ex.: 1 a 14 vs 1 a 14), ou mostrar ritmo ("projeção do mês: N") e rotular "até o dia 14". Rotular o comparativo com datas reais.
Esforço: S. Risco: baixo.

**BI-03 | P1 | Regra 1 (KPI com comparativo obrigatório)**
Evidência (arquivo:linha) dos KPIs de BI SEM comparativo nem referência:
- Pacientes Ativos: inteligencia-client.tsx:676-686
- Número de Terapeutas: :703-713
- Tempo economizado com automações: :715-725
- Pacientes por Plano de Saúde (total): :514-536
- Plano de Saúde por Faturamento, valores em R$ e "Top 3 = X%": :542-591 (chip de concentração em :545-555 não diz o que é alto)
- Capacidade Operacional da Clínica (o 5xl): :985-998
- Sala mais utilizada, Horas totais em atendimento, Ocupação média: :1036-1068
- Produtividade por Terapeuta, colunas Realizadas, Faltas, Cancel. <24h: :823-830 (as faixas de cor de utilização em :837-841 e evolução em :857 usam limiares 85/60/98 que ninguém vê, sem legenda)
- Funil de Onboarding, contagens por etapa: :738-757 (sem período anterior) e Pipeline agora: :769-787
- Pacientes Evadidos: o número (:331-333) é acumulado histórico e só tem meta fixa "<5%" (:326), sem variação no período
- Agenda por Status (donut) e Atendimento por Semana: :597-671 (sem período anterior; a comparação entre semanas é visual apenas)
- Fluxo de check-ins por horário: :408-431
- Métricas operacionais (5 cards): app/gestor/inteligencia/operacional/page.tsx:49-77 (Pacientes, Equipe, Volume, Salas, NPS, nenhum com comparativo) e barras :85-156
- Histórico de meses fechados (PLR): app/gestor/bonificacao/page.tsx:104-116 (valor fechado sem o mês anterior ao lado nem a meta)
- NPS inteiro: ver NPS-02
- Maturidade: ver PAC-06
KPIs que cumprem a regra: Total de Atendimentos (:253-268), Novos Pacientes via WhatsApp (meta ≥ 70%, :278), Novos por semana (meta ≥ 3/sem, :315), Leads (anterior, :699), Metas PLR vs Realizado (:887-938).
Problema: a regra 1 do dono diz que métrica isolada não é KPI válido. Pelo menos 14 blocos da área violam.
Correção: padrão único de "linha compacta de comparativo" em todo KPI: "▲ 12% vs. mês anterior" ou "meta ≥ 85%, está em 79%". Para contagens de estoque (ativos, terapeutas) usar "vs. mês passado (+3)". Para a Capacidade, mostrar a referência de 80% (limite) e a semana anterior. Para tabelas, coluna "vs. anterior" ou setinha pequena.
Esforço: M. Risco: baixo; exige guardar o período anterior para mais métricas na query.

**BI-04 | P1 | Regra 5 (ação onde o dado está), Informação progressiva, Lei de Fitts**
Evidência: nenhum KPI ou linha é clicável em inteligencia-client.tsx (cards :224-343 e :676-726 são `div`); a única lista de pacientes evadidos é calculada em data.ts:837 (`list: evadedList.slice(0, 10)`) e nunca exibida; o drilldown existente (components/gestor/gestor-drilldown-drawer.tsx) só é usado pelo ExecutiveLeaks, que está sem uso.
Problema: o gestor vê "18 evadidos" ou "4 pacientes travados" e não consegue abrir quem são sem sair da tela e procurar. É o oposto da regra 5.
Correção: transformar cada KPI em gatilho de painel lateral com a lista que o compõe (evadidos, leads sem agendamento, pacientes travados por etapa, faltas por terapeuta, salas no limite) e o botão de ação do item (abrir ficha, contatar). Reaproveitar o drawer, corrigindo os problemas dele (BI-10).
Esforço: M. Risco: baixo a médio (RLS das listas).

**BI-05 | P1 | Lei de Fitts (zona do polegar), Regra 5 (informação progressiva), legibilidade**
Evidência: não existe resumo mobile para o dono. Grades colapsam em uma coluna (inteligencia-client.tsx:222, :346, :436, :540, :595, :675) e o usuário rola 15 blocos; a barra de abas é `flex` sem rolagem nem quebra (:145) com 5 abas com badge, estoura em 375 px; o mapa de calor usa fonte de 8,5 a 9 px (:475, :481, :490, :508) com células de 18 px; tabelas só têm `overflow-x-auto` (:810, :1079). O cabeçalho sticky também consome tela (TRA-01).
Problema: o dono que consulta pelo celular não tem uma tela de "3 números e 3 alertas". Texto de 8,5 px reprova legibilidade.
Correção: em largura < 640 px, renderizar um resumo: 3 KPIs (atendimentos vs anterior, evasão vs meta, ocupação vs limite), a faixa "Precisa de decisão hoje" (BI-01) e acordeões fechados para o resto. Abas com rolagem horizontal. Mapa de calor só em `md:` ou com fonte mínima 11 px.
Esforço: M. Risco: baixo.

**BI-06 | P1 | Limiar de Doherty, Regra 2 do AGENTS.md (BI sobre Views read-only com RLS)**
Evidência: app/gestor/inteligencia/page.tsx:7 (`force-dynamic`) e :18 (`await getInteligenciaMetrics` bloqueia a página inteira); inteligencia/data.ts:327-490 dispara 19 consultas a tabelas-base (appointments 6 vezes, patients 2 vezes em :374-377 e :455-458, billing_items com 3 níveis de join); data.ts:248-262 `fetchAppointmentHistory` pagina o histórico inteiro de agendamentos (até 100 mil linhas) em série a cada carregamento; depois uma segunda onda em :1157 (funil, produtividade, tendência de PLR); toda a agregação roda em JavaScript no servidor. Trocar período (inteligencia-client.tsx:47-50) é `router.push` sem indicador de carregamento no seletor.
Problema: custo cresce com o histórico da clínica; a tela vai passar de 400 ms (limiar de Doherty) e, pela regra 2, deveria ler Views/Materialized Views protegidas por RLS, não varrer tabelas-base. Mesmo padrão em app/gestor/data.ts:469-555 (PLR) com `await` dentro de laço (:549).
Correção: criar views `metabase_*` (ou equivalentes) de agregados diários/mensais e ler delas; guardar o índice de check-ins como view (primeiro check-in por paciente); manter `loading.tsx` (já existe e é bom) e adicionar estado de "atualizando" no seletor de período via `useTransition`; cache curto (revalidate 60 s) para a visão do dono.
Esforço: L. Risco: médio (migração SQL em produção é ação separada, regra 4).

**BI-07 | P2 | Regra 1 e Regra 5 (sem número escondido no JSX), Efeito Von Restorff**
Evidência: metas cravadas no JSX: "Meta ≥ 70%" (inteligencia-client.tsx:278 e :292), "Meta: ≥ 3/sem" (:315), "Meta < 5%" (:326 e :338). O chip de meta do card 2 é sempre verde (:277) e o do card 4 sempre vermelho (:325), mesmo contradizendo o texto de status ao lado (:292-294, :338-340).
Problema: meta que não vem do cadastro de metas (/gestor/metas) não pode ser ajustada pelo gestor e dá sinal contraditório (chip verde com "⚠️ Requer Ajuste").
Correção: ler meta da tabela de metas/ configuração; a cor do chip seguir o status calculado.
Esforço: S. Risco: baixo.

**BI-08 | P2 | Lei de Jakob, Lei de Hick, Postel**
Evidência: seletor de período inteligencia-client.tsx:108-117: o "✕" é decorativo (o botão inteiro abre o menu, não limpa); só 3 opções (:122-126; sem trimestre, sem intervalo livre, sem comparar com mesmo mês do ano anterior); "Mês Atual" não diz que é parcial (:31-38); a aba ativa vive em `useState` (:24), então atualizar a página, trocar o período (que recarrega) ou compartilhar link volta para "Visão Geral".
Problema: controle com aparência de "remover filtro" que não remove; perda de contexto ao mudar período.
Correção: trocar por segmented control "Mês | 30 dias | Mês anterior" (1 clique, sem menu); guardar aba na URL (`?tab=`).
Esforço: S. Risco: baixo.

**BI-09 | P2 | Efeito Von Restorff, Lei da Similaridade, Efeito estética-usabilidade, DESIGN.md:212 e :226**
Evidência: inteligencia-client.tsx usa paleta crua slate/indigo/emerald/rose/amber/violet em todo o arquivo (ex.: :224, :272, :320, :946) em vez de tokens (DESIGN.md manda token); 12 ou mais emojis como ícones (:229, :275, :301, :323, :401, :403, :442, :516, :544, :644, :717, :1007, :1037, :1051, :1061, :1092); o ping animado de "tempo real" (:351-353), gradientes rosa/índigo nos cards 2 e 4 (:272, :320), chips âmbar/verde/vermelho/violeta em quase todos os blocos; a linha de faturamento por plano ocupa `grid-cols-2` com um único filho, deixando metade da linha vazia (:540-592); "Agenda por Status" e "Atendimento por Semana" repetem o que a página Operacional mostra (operacional/page.tsx:79-118).
Problema: tudo se destaca, então nada se destaca. Emojis variam por sistema operacional e não são lidos de forma consistente por leitor de tela.
Correção: um estilo de KPI (número, rótulo, linha de comparativo) e uma cor de alerta única; emojis por ícones lucide; completar a grade ou ocupar a linha inteira com o quadro de faturamento.
Esforço: M. Risco: baixo.

**BI-10 | P2 | Carga cognitiva, manutenção (dívida que engana o próximo desenvolvedor)**
Evidência: sem import em nenhum lugar: app/gestor/executive-leaks.tsx, components/gestor/gestor-cockpit.tsx, components/gestor/gestor-drilldown-drawer.tsx, components/Dashboard/DataTable.tsx (exportação simulada com `setTimeout` de 1500 ms, DataTable.tsx por volta da linha 50-60), app/gestor/tier-progression-table.tsx, e as funções getLeakCards/buildFaltaLeak (app/gestor/data.ts:93-300). Defeitos latentes se forem reativados: executive-leaks.tsx:24-31 (tag "Normal" com tipo "warning" e "Atenção" com "danger", e `detailUrl` fixo para /gestor/cadastros/tipos-atendimento em todo item); gestor-cockpit.tsx:29-32 e :251-266 (spinner "Processando…" nunca sai se o usuário voltar), e "Ignorar" (:34-50) não persiste, o alerta volta no próximo carregamento; gestor-drilldown-drawer.tsx:64-82 sem Escape nem foco preso nem role="dialog".
Problema: o recurso que responderia à pergunta do dono existe, mas desligado; e o código parado tem erro.
Correção: decidir: religar como "Precisa de decisão hoje" (BI-01) após corrigir os defeitos, ou apagar.
Esforço: S (apagar) a M (religar). Risco: baixo.

**BI-11 | P2 | Lei de Jakob, Lei de Tesler**
Evidência: página app/gestor/inteligencia/operacional/page.tsx é uma segunda "home de números" com definições diferentes da BI: "Pacientes ativos" por status (operacional/data.ts:31 `ACTIVE_PATIENT_STATUSES`) vs "Pacientes Ativos" = quem já fez check-in (inteligencia-client.tsx:684); "Salas: ocupação" com 8 h úteis por sala por dia (operacional/data.ts, bloco de ocupação) vs capacidade da BI (inteligencia/data.ts clinicCapacity); "Volume diário" dos últimos 7 dias móveis com comentário "domingo a sábado" no código. Acesso só por botão solto (inteligencia/page.tsx:22-26, `btn-secondary` alinhado à direita, acima do título).
Problema: dois números diferentes para "pacientes ativos" e "ocupação" na mesma área; o gestor não sabe qual vale.
Correção: absorver o que falta como aba "Operação" da BI com as mesmas definições, ou remover. Se ficar, linkar da própria BI com o mesmo vocabulário.
Esforço: M. Risco: baixo.

**BI-12 | P2 | Regra 5 (informação que não leva a decisão, e decisão que falta)**
Evidência: o servidor calcula e devolve `totalCobrancas`, `valorTotalCobrancas`, `valorRecebido`, `valorPendente` (inteligencia/data.ts:1168-1171), `internShortageAlerts`, `internCoverage`, `internCoverageOverallPct` e `roomsTotalRevenue` (:1190-1194 aproximadamente), e o cliente não usa nenhum (busca no inteligencia-client.tsx não encontra). O loading promete "receita, glosas e desempenho" (inteligencia/loading.tsx:4), mas a tela não tem receita total recebida/pendente nem glosa total, só distribuição por plano.
Problema: processamento caro para dado invisível; e a pergunta "quanto entrou e quanto está parado" do dono não é respondida.
Correção: um KPI "Recebido vs pendente no mês, vs mês anterior" e "Glosa em R$ e %" no topo; remover o que não usa da query.
Esforço: S a M. Risco: baixo.

**BI-13 | P2 | Lei da Similaridade (mesma cor, mesmo significado), Regra 1**
Evidência: ocupação alta é vermelha na Capacidade (inteligencia-client.tsx:977-982: ≥ 80% rose) e é verde no Ranking de Salas (:1093-1098: ≥ 70% emerald); a mesma grandeza com semântica oposta na mesma aba. A Capacidade (o "Indicador em Destaque", :946-1001) mostra 5xl% sem meta nem período anterior.
Problema: o gestor lê "62% verde" aqui e "62% âmbar" ali; ocupação é ao mesmo tempo meta (queremos alta) e risco (lotação).
Correção: definir faixas: abaixo de 60% ocioso (âmbar), 60-85% saudável (verde), acima de 85% saturado (vermelho), iguais nas duas telas, e escrever a faixa na legenda.
Esforço: S. Risco: baixo.

**BI-14 | P2 | Regra 1, Regra 5 (vocabulário), Lei de Fitts**
Evidência: aba Equipe: tabela sem ordenação e sem link para o terapeuta (inteligencia-client.tsx:810-870); rodapé técnico "Utilização = horas realizadas ÷ disponibilidade cadastrada (Supervisão → Disponibilidade)…" (:881-883) e "mesma regra da métrica de PLR" (jargão); o estado vazio de metas manda "Cadastre metas em /gestor/metas" como texto cru, não como link (:935); "Metas PLR vs. Realizado" (:886-938) repete o assunto da área Pessoas & Desempenho.
Problema: texto explicativo e rota escrita em vez de ação.
Correção: botão "Cadastrar metas" no estado vazio; ordenar por pior desempenho por padrão; mover rodapé para um "?" (HelpHint já existe no PageHeader); apontar para Pessoas & Desempenho em vez de repetir.
Esforço: S. Risco: baixo.

**BI-15 | P2 | Acessibilidade (WCAG), foco visível, teclado**
Evidência: abas sem role/aria-selected (inteligencia-client.tsx:146-215); botões "•••" sem nome acessível (:227-232) e um deles não faz nada (:600); seletor de período sem aria-expanded (:108); estado só por cor (barras de utilização :836-842; chips de capacidade); texto de 8,5-10 px (:475, :490, :508, :445, :457-464); tooltips por `title` (:423, :489) inacessíveis ao teclado.
Problema: o painel não é operável nem legível por teclado/leitor de tela; contraste e tamanho fracos no mapa de calor.
Correção: `role="tablist"`/`tab`, aria-label nos botões, texto mínimo 11 px, valor em texto junto da cor.
Esforço: S. Risco: baixo.

**BI-16 | P3 | Pareto, Regra 5**
Evidência: aba Aniversariantes inteira dentro da BI (inteligencia-client.tsx:1148-1192); o link "Enviar Parabéns 💬" leva para /recepcao/atendimento (:1175-1181) sem pré-preencher e aparece também para a equipe (`aniv.type === "equipe"`), mas o texto do atalho diz que é contato com a família.
Problema: tarefa de relacionamento, baixa relevância para decisão do gestor, com ação enganosa para colaboradores.
Correção: mover para widget pequeno na Visão Geral ou para a Recepção; esconder o atalho para equipe.
Esforço: S. Risco: baixo.

**BI-17 | P3 | Regra 5 (vocabulário do operador), Lei de Jakob**
Evidência: eyebrow em inglês "INTELIGÊNCIA BI & CLINICAL DASHBOARD" (inteligencia-client.tsx:102); menu diz "Inteligência BI", título diz "Visão Geral Operacional" (:103) e a página irmã se chama "Métricas operacionais" (operacional/page.tsx:42); "Exportar Dados (JSON)" (inteligencia-client.tsx:241) só no card 1, formato que o dono não usa.
Correção: um nome só ("Indicadores"), sem inglês; exportar em planilha/PDF no cabeçalho da tela (a regra 2 pede relatórios dentro do sistema), não por card.
Esforço: S. Risco: baixo.

O que está bom aqui: regra "paciente = fez check-in" explícita e consistente (lib/bi-checkin), comparativo no card de atendimentos com guarda de base pequena (:253-258), `loading.tsx` próprio, estados vazios com ação nas tabelas (:874-879, :1134-1139), seletor de período no servidor (URL).

### 2.2 NPS

Resumo: tela de satisfação com uma aba inteira de números inventados, nenhum comparativo e o item de decisão (alertas de insatisfeitos) abaixo de dois blocos informativos.

**NPS-01 | P0 | Regra 5 (informação que leva a decisão), confiança no dado, Regra 1**
Evidência: app/gestor/nps/nps-tabbed-view.tsx:220-241: na aba "NPS Interno" os cards mostram valores fixos no código: "8.9" e "78% de participação da equipe" (:223 e :225), "4.7 ★" (:231) e "4.5 ★" (:239), sem consulta ao banco. A própria página de Metas diz "nunca com número inventado" (app/gestor/metas/page.tsx:43-45).
Problema: o dono lê clima organizacional e participação da equipe que não existem. Decisão de gestão de pessoas com dado falso.
Correção: remover os cards ou ligá-los à fonte (nps_surveys com público interno); enquanto não houver dado, estado vazio "Primeiro disparo em dd/mm". Nunca exibir exemplo como real.
Esforço: S (esconder), M (ligar). Risco: baixo.

**NPS-02 | P1 | Regra 1, Carga cognitiva, Lei de Miller**
Evidência: nenhum card traz comparativo (app/gestor/nps/nps-metrics-cards.tsx:27-35 combinada, :38-43 WhatsApp, :45-50 respostas, :53-60 mensal, :62-100 distribuição); a página só consulta o mês corrente (nps/page.tsx:15 e :23-24 pela data de disparo). Três escalas misturadas (0-10, 1-5, 1-4) são normalizadas e promediadas (nps/page.tsx:63-69, lib/family-feedback.ts:34-47) em "Satisfação geral (combinada, 0-10)". O que a tela chama de "NPS" é uma média, não o NPS clássico (% promotores menos % detratores).
Problema: violação da regra 1 e, pior, quatro números de satisfação lado a lado (combinada, WhatsApp 1-5, mensal 0-10, distribuição) sem dizer qual é o principal ou como evoluiu.
Correção: um KPI principal "Satisfação do mês: 8,2 (▲ 0,4 vs mês anterior, 31 respostas)"; os detalhes (por canal, distribuição) em área expansível. Se for NPS, calcular promotores/detratores. No início do mês, mostrar o mês anterior fechado em vez de ":".
Esforço: M. Risco: baixo.

**NPS-03 | P1 | Regra 5 (a tela traz o trabalho, ação onde o dado está), Efeito Zeigarnik, Efeito da posição serial, Lei de Fitts**
Evidência: ordem em nps-tabbed-view.tsx: card de "Critérios Informativos" (:72-112), cards de métricas (:116-124), só depois o alerta de insatisfação (:130-139); o alerta é um link para /supervisao (:131) com texto "Triagem e resolução ficam na Supervisão →" (:137); o badge do menu aponta para esta tela, que apenas redireciona para outro módulo.
Problema: o que exige decisão (famílias insatisfeitas aguardando contato) é o 3º bloco e a ação está em outro módulo (cliques extras, troca de cabeçalho/cor). O comentário do alerta do menu promete "tratar".
Correção: alerta no topo, com os 3 casos mais antigos listados (paciente, nota, há quantos dias) e botão "Contatar" no próprio item; link "ver todos" abre a fila filtrada, não a home da Supervisão.
Esforço: M. Risco: baixo a médio (permissões de quem pode tratar).

**NPS-04 | P2 | Efeito Von Restorff, Carga cognitiva, Regra 5 (sem blocos explicativos/cards decorativos)**
Evidência: nps-tabbed-view.tsx:72-112 (4 cards de "Critérios Informativos... Referência informativa", `select-none`, sem ação) e :148-165 (banner com 3 etiquetas coloridas e parágrafo longo sobre anonimato e disparo) e :172-211 (4 cards de critérios internos); subtítulo longo em nps/page.tsx:92-94.
Problema: a primeira dobra da tela é texto de referência que o gestor não consulta todo dia; o que importa fica abaixo.
Correção: mover critérios e regras para um "?" ou expansor "Como a pesquisa funciona"; manter a tela abrindo nos números e alertas.
Esforço: S. Risco: baixo.

**NPS-05 | P1 | Regra 5 (erro e bloqueio dizem o que fazer), confiança no feedback do sistema, disparo em massa**
Evidência: app/gestor/nps/family-feedback-panel.tsx:28-44: se a resposta do servidor não for ok, a tela mostra "Disparo agendado para o próximo ciclo de execução." (:36) e, se der exceção, "Pesquisas agendadas no sistema." (:39); nenhuma das duas é verdade verificada. O botão "Disparar pesquisa via WhatsApp" (:83-91) dispara sem confirmar o alcance (para quantas famílias?) e só existe no estado vazio (a barra com itens mostra apenas "Copiar link", :53-64); `navigator.clipboard.writeText` sem tratar falha (:23).
Problema: mensagem de sucesso falsa em erro (o gestor acredita que as famílias foram acionadas); envio em massa sem confirmação; quando já há respostas, o gestor perde o disparo.
Correção: erro real: "Não foi possível disparar. Tente de novo ou fale com o suporte"; confirmação com alcance ("Enviar para 42 famílias atendidas nos últimos 30 dias?"); botão disponível sempre como secundário.
Esforço: S. Risco: baixo.

**NPS-06 | P2 | Regra 5 (ação onde o dado está), Lei de Proximidade, Carga cognitiva**
Evidência: nps/page.tsx:42-46 busca 20 mais recentes sem filtro de clínica nem de nota; family-feedback-panel.tsx:104-146 lista todos na mesma ordem cronológica; avaliações negativas ficam só com borda vermelha (:112-113); não há ação "contatar" nem busca.
Problema: o comentário de uma família que avaliou "ruim" pode estar no 15º item.
Correção: negativos primeiro, com botão de contato pré-preenchido (telefone do responsável, nome do paciente); contador "3 negativas este mês, vs 1 no mês anterior".
Esforço: M. Risco: baixo.

**NPS-07 | P3 | Lei da Similaridade, acessibilidade**
Evidência: components/nps-alerts-badge.tsx:26-33: bolinha de 16 px (`h-4 min-w-4`, fonte 10 px) estática, sem nome acessível, estilo diferente do Badge padrão do cabeçalho que é 20 px e pisca quando urgente (components/module-header.tsx:110-118); a consulta não filtra por clínica (depende só da RLS, :17-21).
Correção: usar o mesmo Badge urgente do ModuleHeader (`badgeUrgent`), com `aria-label="N alertas de insatisfação"`.
Esforço: S. Risco: baixo.

**NPS-08 | P3 | Lei de Jakob, acessibilidade**
Evidência: abas com `role="tab"` e `aria-selected` mas sem `role="tablist"` no contêiner, sem setas de teclado (nps-tabbed-view.tsx:33-61); "NPS Interno" (pesquisa de clima da equipe) misturado ao NPS de pacientes na mesma tela do menu "NPS".
Correção: completar o padrão ARIA de abas ou usar links; avaliar mover clima interno para Pessoas & Desempenho (onde o gestor pensa em equipe).
Esforço: S. Risco: baixo.

O que está bom: badge de alertas carregado em `Suspense` sem atrasar a barra (app/gestor/layout.tsx), estado vazio da avaliação da família com duas saídas claras (family-feedback-panel.tsx:73-102).

### 2.3 Pessoas & Desempenho (Bonificação, Metas, Equipe)

Resumo: tela com alto valor (dinheiro e pessoas) e maior risco: aprovar faixa mexe no pagamento e não é atômico; metas e pesos moram em três lugares; nomes, textos e jargão inconsistentes.

**PES-01 | P0 | Regra 5 (erro e bloqueio), integridade de dados/dinheiro**
Evidência: app/gestor/bonificacao/actions.ts:51-55 encerra o contrato vigente (`update valid_to = today`) e só depois, em :61-70, insere o novo; se o insert falhar, a função devolve erro (:73-74) mas o contrato antigo já foi fechado e o terapeuta fica sem contrato vigente (a mesma tela passa a mostrar "Sem contrato", bonificacao/page.tsx:166, e o repasse em /terapeuta/repasse deixa de ter base). `today` vem de `toISOString()` em UTC (:50) e pode ser o dia seguinte à noite no horário da clínica. Nenhuma confirmação mostra o impacto financeiro antes de gravar (tier-approval-form.tsx:130-136).
Problema: operação em duas etapas, sem transação, que altera honorário. Falha parcial deixa o repasse sem contrato.
Correção: função SQL única (RPC) que fecha e cria em transação; data no fuso da clínica; confirmação "De Pleno R$ 80 para Sênior R$ 95 por módulo, vale a partir de dd/mm".
Esforço: M. Risco: médio (migration em produção é ação separada, regra 4).

**PES-02 | P1 | Regra 5 (o sistema decide o óbvio), Lei de Tesler, Lei de Postel**
Evidência: app/gestor/bonificacao/tier-approval-form.tsx:107-112: o campo "Nova faixa" é texto livre, vazio quando o terapeuta não tem contrato e, com contrato, vem preenchido com a faixa atual (:8); o valor é inicializado com o preço atual (:9, :117); o botão Confirmar só exige faixa não vazia e valor > 0 (:132). Os valores possíveis de faixa existem no cadastro (contratos) mas não são oferecidos.
Problema: "Aprovar Faixa" aprova por padrão a mesma faixa e o mesmo preço; a progressão é digitação livre ("Sênior", "senior", "Sr"); o sistema sabe a próxima faixa e o valor da tabela e não pré-preenche.
Correção: select com as faixas cadastradas, preselecionando a seguinte; valor vindo da tabela da faixa e mostrado como "R$ 80,00 → R$ 95,00 (+18,8%)"; só permitir confirmar se mudou.
Esforço: M. Risco: baixo.

**PES-03 | P1 | Gradiente de meta, Regra 1 (referência), Regra 5 (informação progressiva)**
Evidência: a tabela de progressão mostra só "Evoluções 24h" (app/gestor/bonificacao/page.tsx:143, :160) e a faixa; a regra de elegibilidade é "≥ 98% em 24h e ≥ 10 sessões realizadas nos últimos 90 dias" (app/gestor/data.ts:704, janela de 90 dias em :663-665) e o número de sessões (`row.sessions`) calculado em data.ts:714 nunca é exibido; quem não é elegível vê "Mantém faixa atual" (data.ts:718), sem dizer quanto falta; só tem texto de critérios no cabeçalho (page.tsx:133).
Problema: o gestor não sabe por que o terapeuta A é elegível e o B não, nem quão perto está. O critério de 98% não aparece como referência ao lado do número (regra 1).
Correção: colunas "Evolução 24h (meta 98%)" e "Sessões (mín. 10)", com barra de progresso; para não elegíveis, "faltam 3 sessões" ou "evolução 94% vs meta 98%".
Esforço: S. Risco: baixo.

**PES-04 | P1 | Regra 1, Princípio de confiança no documento, acessibilidade**
Evidência: components/gestor/plr-section-client.tsx:75-79 a tabela não tem coluna de Meta (só Realizado, Atingimento %, Status), nem comparativo com o mês anterior; :43 passa `targetLabel: "Meta do cargo"` literal para o modal; :84 usa `key={row.role}` mas `getBonusRows` devolve uma linha por métrica configurada com o mesmo rótulo de cargo (app/gestor/data.ts:543-556), logo há chaves duplicadas (React) quando o cargo tem 2+ métricas; o extrato (plr-statement-modal.tsx:51 e :70) rotula "Competência: mês atual" com números ao vivo do mês parcial (o componente aceita `competenceMonth`, mas plr-section-client.tsx:102-106 não passa), sob o título "Extrato Oficial de Apuração" e "Memória de Cálculo Auditável" (:47, :49), e o rodapé afirma "Documento auditável via Hash SHA-256" (:156) sem que nenhum hash seja calculado (busca por sha256/createHash em components/gestor e app/gestor não encontra nada ali); o modal não tem role="dialog", Escape nem foco preso (:40-60).
Problema: um documento que o dono pode imprimir e assinar (campo de assinatura em :142-151) declara garantias que não existem e usa dado parcial como se fosse apuração final. Tabela de PLR sem a meta ao lado do realizado.
Correção: tabela com Meta, Realizado, vs mês anterior; extrato gerado apenas de mês fechado (metric_snapshots) ou marcado "PARCIAL, não vale para pagamento"; remover a frase de hash ou implementá-la; chave composta (cargo + métrica).
Esforço: M. Risco: médio (documento com implicação legal; revisar com o jurídico, como o texto da própria tela já pede).

**PES-05 | P1 | Regra 1, integridade do indicador**
Evidência: app/gestor/data.ts:485-488: a taxa de glosa do PLR de Faturamento soma todos os `billing_items` de todos os períodos de cobrança, sem filtro de mês, mas a linha é apresentada como "Realizado no Mês" (plr-section-client.tsx:77) e eliminatória (data.ts: `isEliminatory: true` na linha de faturamento). O cálculo de métricas configuradas é feito com `await` dentro de laço (data.ts:549).
Problema: um número eliminatório (que zera o PLR) pode estar calculado sobre o histórico inteiro, não sobre o mês; e a tela fica lenta quando há vários cargos com várias métricas.
Correção: filtrar pela competência do mês e reutilizar `computeMetricActual` também no caso padrão; paralelizar com `Promise.all`.
Esforço: S. Risco: médio (muda o número que dá bônus; comunicar).

**PES-06 | P1 | Lei de Tesler, Lei de Jakob, Regra 5 (uma ação primária por tela)**
Evidência: meta por cargo e métrica é cadastrada em dois lugares: /gestor/metas ("Cadastre meta e peso por métrica e cargo", app/gestor/metas/page.tsx:41-46, TargetForm com Meta e Peso) e /gestor/bonificacao/config ("Monte, por cargo e módulo, quais métricas entram na apuração, com peso, meta e cláusula eliminatória", config/page.tsx:211-216, bonus-config-client.tsx:137-212); e uma terceira leitura em Inteligência BI > Equipe (inteligencia-client.tsx:886-938).
Problema: o gestor não sabe onde alterar uma meta, nem qual vence se forem diferentes (a tabela `targets` das Metas vs `bonus_rule_sets` da configuração).
Correção: uma só fonte: Metas por Cargo passa a ser a visão de atingimento (somente leitura) das regras publicadas em Configurar & Simular, ou o formulário de Metas é a única entrada e a configuração só define peso/eliminatória.
Esforço: M a L. Risco: médio (migração de dados e de leitura do PLR).

**PES-07 | P1 | Lei da Região Comum, Lei de Jakob, Regra 5 (não caçar telas)**
Evidência: components/equipe-subnav.tsx:11 a quarta aba "Contratos & Valor por módulo" aponta para /gestor/configuracoes/profissionais; essa rota usa o layout de Configurações (app/gestor/configuracoes/layout.tsx:10-13, ConfigSidebar) e não renderiza o EquipeSubnav (o componente só é montado em bonificacao/page.tsx:64, bonificacao/config/page.tsx:206 e metas/page.tsx:36); no menu principal, o destaque cai em "Configurações" porque o `match` de Pessoas & Desempenho só inclui bonificacao e metas (components/gestor-nav.tsx:26).
Problema: clicar numa aba de Pessoas & Desempenho joga o usuário para outra seção, o subnav some e a barra marca outro item. Quebra o modelo mental de "estou em Pessoas".
Correção: ou trazer a tela de contratos para dentro de Pessoas (rota /gestor/bonificacao/contratos) mantendo o subnav, ou remover a aba e linkar de dentro da tabela de progressão.
Esforço: S (remover/linkar) a M. Risco: baixo.

**PES-08 | P2 | Lei de Jakob (consistência de nome)**
Evidência: o mesmo lugar tem cinco nomes: menu "Pessoas & Desempenho" (components/gestor-nav.tsx:26, chave `equipe`), nav aria "Subseções de Equipe & Desempenho" (equipe-subnav.tsx:18), primeira aba "PLR & Desempenho" (:8), H1 "Pessoas & Desempenho: PLR e progressão de faixas (PJ)" (bonificacao/page.tsx:68-70), loading "PLR & Faixas de Premiação" (bonificacao/loading.tsx:4); a rota /gestor/equipe é redirect para Colaboradores (equipe/page.tsx:12).
Correção: um nome ("Pessoas & Desempenho"); a primeira aba "Resultados e faixas"; loading com o mesmo nome.
Esforço: S. Risco: baixo.

**PES-09 | P2 | Regra 5 (vocabulário do operador, sem nome técnico)**
Evidência: "audit_log" na tela (bonificacao/page.tsx:134) e na mensagem de sucesso (tier-approval-form.tsx:52 "registrada no audit log") e de erro (actions.ts:107 "Falha ao gravar justificativa no audit log"); "Override {metricKey} (%)" mostra a chave interna da métrica (bonus-config-client.tsx:378); "⚠ sem pipeline" (:204), "vigência" e "cláusula eliminatória" sem explicação; "Lei 10.101/2000" como kicker (plr-section-client.tsx:58).
Correção: "Decisão registrada no histórico" e rótulo humano da métrica em Override; "sem cálculo automático ainda" (a página de Metas já usa essa frase, metas/page.tsx:44).
Esforço: S. Risco: baixo.

**PES-10 | P1 | Regra 5 (erro e bloqueio dizem o que fazer), integridade de dinheiro**
Evidência: bonus-config-client.tsx:237 desabilita "Publicar nova vigência" só se `totalWeight > 100`; peso total 60% publica sem aviso (a soma só é exibida em :140-142); publicar encerra a vigência anterior e vale para o PLR sem confirmação (:240); a unidade do cabeçalho "Meta (%)" vem só da primeira métrica da lista (:152); simulação independente do botão de publicar (nada obriga rodar antes).
Problema: dá para publicar regra de PLR que não soma 100% ou sem conferir o efeito, e é irreversível no sentido de abrir nova vigência.
Correção: exigir soma = 100% (ou avisar claramente "falta 40%"); confirmação com resumo ("2 métricas, 100%, vigência a partir de 01/12, encerra a de 01/09"); mostrar meta com unidade por linha.
Esforço: S. Risco: baixo.

**PES-11 | P2 | Regra 5 (informação progressiva, sem blocos de texto), Regra 1**
Evidência: bonificacao/page.tsx:71-76 (parágrafo de 4 linhas), :89-93 (explica o fechamento mensal), :132-135 (critérios e audit_log); três seções empilhadas, a segunda (histórico) é uma lista plana de até 6 meses x 15 métricas (data.ts getClosedMetricHistory, limite `months * 15`), em ordem de mês, sem agrupar por indicador nem mostrar o mês anterior ao lado (page.tsx:104-116); a ação mais frequente do gestor, aprovar progressão, está na última seção.
Correção: abrir pela seção que exige ação ("2 terapeutas elegíveis"), com o histórico recolhido e em matriz indicador x mês; texto em "?".
Esforço: M. Risco: baixo.

**PES-12 | P2 | Regra 5, Lei de Postel, Efeito Zeigarnik, acessibilidade**
Evidência: app/gestor/metas/delete-target-button.tsx:11-18: "Remover" sem confirmação nem desfazer; app/gestor/metas/target-form.tsx:142, :158, :173, :186, :199 rótulos `<label>` sem `htmlFor`/aninhamento e sem `id` nos campos; o formulário "Nova meta" vem antes dos dados (metas/page.tsx:49-52); sem soma de pesos por cargo nem alerta se ≠ 100%; `reset` pelo DOM (target-form.tsx:136) não limpa a escolha de métrica dependente do cargo; sem confirmação visual de sucesso; estado vazio "Nenhuma meta cadastrada ainda." sem ação (metas/page.tsx:107-109).
Correção: confirmar remoção (ou toast com desfazer, padrão do GestorCockpit); mostrar soma de pesos por cargo; mover o formulário para um botão "Nova meta" abrindo painel; rótulos associados.
Esforço: S. Risco: baixo.

**PES-13 | P3 | Manutenção**
Evidência: app/gestor/tier-progression-table.tsx (filtro Todos/Ativos/Sem contrato e paginação de 10) não é importado; a página renderiza a tabela inteira sem filtro (bonificacao/page.tsx:138-185).
Correção: usar o componente (a lista de terapeutas cresce) ou apagar.
Esforço: S. Risco: baixo.

O que está bom: justificativa obrigatória ao manter faixa (tier-approval-form.tsx:59-65, actions.ts:89-91), simulador "e se" com fonte do dado (ao vivo, fechado, manual) e histórico de vigências auditável (bonus-config-client.tsx:296-441, :252-284), "sem cálculo ainda" em vez de número inventado (metas/page.tsx:42-45, target-form.tsx:166), alvo mínimo de 44 px no subnav (equipe-subnav.tsx:28).

### 2.4 Pacientes (lista, hub, Atendimentos, Protocolos, Maturidade)

Resumo: lista funcional mas com três ícones de ação iguais, busca limitada, e um hub que cola telas de Recepção e Supervisão (com seus próprios títulos e links de saída). Maturidade é tela órfã com dado parcialmente cravado.

**PAC-01 | P1 | Lei de Hick, Lei de Fitts, Lei de Jakob**
Evidência: app/gestor/pacientes/page.tsx:71-75: `QuickActionsBar` com perfil, editar e agenda apontando todos para o mesmo `href` (`/gestor/pacientes/${p.id}`); o nome também é link para a mesma URL (:61). Quatro alvos, um destino.
Problema: três botões que parecem ações diferentes e fazem a mesma coisa; a coluna "Ações" é ruído.
Correção: linha inteira clicável + um botão primário "Abrir"; ou ações reais (abrir agenda do paciente na aba certa).
Esforço: S. Risco: baixo.

**PAC-02 | P1 | Lei de Postel, Pareto, Doherty, Regra 5 (a tela traz o trabalho)**
Evidência: pacientes/page.tsx:25-27 carrega todos os pacientes e filtra em memória; busca só por nome (:27); sem paginação, sem filtro por status (interessado, avaliação, ativo, pausado, alta, evadido, que existem em :13-20), sem contagem de resultados, sem ordenação; o gestor procurando "quem está evadido?" precisa ler a lista inteira.
Problema: não escala (centenas de pacientes) e não encontra por responsável, telefone ou CPF (Postel).
Correção: filtro no servidor, chips de status com contagem, busca por nome, responsável, telefone, CPF (normalizando pontuação); paginação ou rolagem incremental.
Esforço: M. Risco: baixo.

**PAC-03 | P2 | Regra 5 (erro e estado vazio dizem o que fazer)**
Evidência: pacientes/page.tsx:79-85: se a busca não achar ninguém, a tela diz "Nenhum paciente cadastrado ainda."
Problema: informação errada (há pacientes; a busca é que não encontrou) e sem saída.
Correção: "Nenhum paciente encontrado para 'maria'. Limpar busca" e, se não houver nenhum cadastro, botão "Novo paciente".
Esforço: S. Risco: baixo.

**PAC-04 | P1 | Lei da Região Comum, Lei de Jakob, Regra 5 (não trocar de tela)**
Evidência: "Novo paciente" leva a /recepcao/pacientes/novo (pacientes/page.tsx:38), trocando o módulo (cor e menu do cabeçalho mudam). O hub reutiliza telas de outros módulos: aba Cadastro importa a página de Recepção (pacientes/[id]/cadastro/page.tsx:1-8), que traz o próprio H1 "Cadastro e gestão · nome" e o link "← Ficha do paciente" para /recepcao (app/recepcao/pacientes/[id]/gestao/page.tsx:199-201), duplicando o H1 do hub (pacientes/[id]/layout.tsx:29); a aba Anamnese linka o TCLE em /supervisao (anamnese/page.tsx:12-14); a aba Terapêutica importa a visão de Supervisão (terapeutica/page.tsx:1-9).
Problema: dentro de "Gestão" o gestor vê títulos duplicados e links que o jogam para Recepção ou Supervisão.
Correção: abrir o cadastro novo dentro de /gestor ou em painel lateral; nas abas embutidas, ocultar H1 e links de saída (padrão `embedded` já usado na Terapêutica, prontuario-unificado/page.tsx:290).
Esforço: M. Risco: baixo.

**PAC-05 | P2 | Efeito Zeigarnik, Regra 5 (informação progressiva), Lei de Proximidade**
Evidência: o hub tem só nome do paciente e 3 abas (pacientes/[id]/layout.tsx:25-31); a aba Terapêutica & Documentos reúne "visão geral, evolução, ABA, plano, documentos, agenda, financeiro" numa tela (comentário em terapeutica/page.tsx:5-6); nenhuma faixa de resumo com status, plano de saúde, terapeuta principal, próxima sessão e pendências (guia vencendo, evolução atrasada). O link "← Pacientes" perde a busca (:26).
Problema: quem abre o paciente não vê de relance a situação nem o que está pendente; precisa abrir abas para descobrir.
Correção: cabeçalho fixo do paciente com status, convênio, terapeuta, próxima sessão e 1 linha de pendências; voltar preservando `?q=`.
Esforço: M. Risco: baixo.

**PAC-06 | P2 | Lei de Hick, Regra 1, Regra 5 (a tela traz o trabalho), tela órfã**
Evidência: /gestor/maturidade não tem link em lugar algum (busca de rotas), o menu só a "desmarca" (components/gestor-nav.tsx:48); app/gestor/maturidade/page.tsx:9 usa "✓" e ":" como único sinal; coluna "Tem" é sempre ✓ (:58-69, `tem: true` em todas as 10 linhas), logo ruído; nenhuma linha leva à tela onde corrigir; sem percentual geral nem comparação com o período anterior; texto "A clínica possui..." sem dono nem prazo.
Problema: checklist de maturidade que o gestor não acha e, se achar, não sabe o que fazer com o ":".
Correção: se for útil ao gestor, colocá-lo como aba da BI ou como bloco "Maturidade 7/10 (era 6/10 há 90 dias)" com cada ":" levando à tela que resolve; se não, remover a rota. Eliminar a coluna "Tem".
Esforço: S a M. Risco: baixo.

**PAC-07 | P2 | confiança no dado, Regra 1**
Evidência: maturidade/page.tsx:79-82 diz que "Funciona" exige registro nos últimos 90 dias, mas `intake_steps` (:41), `treatment_plans` (:46-47) e `patient_access` (:44) contam sem janela de 90 dias; "Entrevista inicial" tem `monitorado: true` fixo (:60); "Carta ao Terapeuta" tem `funciona: false` fixo (:65) e "Registro de vínculo", "Supervisão por área" e "Reunião interdisciplinar" têm `monitorado: false` fixo (:62-64); o comentário da primeira linha cita "Módulo 3 MAAIS, slide 40" (:12-13).
Problema: o checklist mistura calculado e cravado e contradiz o texto de regra mostrado na própria tela.
Correção: aplicar a janela em todas, mostrar "N registros em 90 dias" em vez de só ✓, e marcar "sem medição ainda" quando for cravado.
Esforço: S. Risco: baixo.

**PAC-08 | P3 | Manutenção, Lei de Jakob**
Evidência: redirects /gestor/atendimentos, /gestor/protocolos (3 arquivos), /gestor/convenios, /gestor/equipe, /gestor/cadastros/pacientes; o loading de Cadastros ainda anuncia "lista de pacientes, equipe e planos de saúde" (app/gestor/cadastros/loading.tsx:4).
Correção: manter os redirects (links salvos) mas documentar a expiração; ajustar o texto do loading.
Esforço: S. Risco: baixo.

**PAC-09 | P3 | Lei da Similaridade**
Evidência: pacientes/page.tsx:13-20 reaproveita as classes de status de agenda (`st-agendada`, `st-confirmada`, `st-falta`) para status de cadastro: "alta" fica com a cor de "confirmada" e "evadido" com a de "falta".
Correção: classes próprias para status de paciente.
Esforço: S. Risco: baixo.

O que está bom: busca com digitação instantânea (SearchAsYouTypeInput), rótulos de status traduzidos (PATIENT_STATUS_LABEL), hub com abas e persistência do nome no layout, `notFound()` para id inválido (layout.tsx:21).

## 3. Achados transversais do módulo (parte A)

**TRA-01 | P1 | Lei de Fitts (polegar), mobile**
Evidência: components/module-header.tsx:162 (`sticky top-0` envolve também a faixa mobile) e :215-244: abaixo de 1024 px os 9 itens do Gestor viram "pílulas" com `min-h-[44px]` em `flex-wrap`, ocupando 3 a 4 linhas (cerca de 150 a 200 px) que ficam presas no topo da tela.
Problema: no celular o dono perde 1/4 da tela fixa de navegação e rola o conteúdo por uma janela estreita.
Correção: linha única com rolagem horizontal, ou menu "Seções" em folha inferior; só a barra da marca fica sticky.
Esforço: S. Risco: baixo (afeta todos os módulos que usam o ModuleHeader).

**TRA-02 | P1 | Regra 5 (a home traz a fila do que precisa de ação), Efeito Zeigarnik**
Evidência: a única pendência do gestor com sinal no menu é o NPS (components/gestor-nav.tsx:37-40, `badgeSlot` só no NPS); progressões de faixa elegíveis (bonificacao/page.tsx:173-174), alertas de NPS (tratados em /supervisao), pacientes travados (BI Funil :165-169, tratados em /recepcao/pacientes/pendencias) e vazamentos (código morto) estão em quatro lugares e três módulos.
Problema: o gestor precisa lembrar de passar em cada seção. A home de Gestão é um painel de números, não uma caixa de entrada.
Correção: caixa "Precisa de você" na home (BI-01) com todas as pendências do papel, e badges numéricos nos itens do menu (Pessoas, Pacientes).
Esforço: M. Risco: baixo.

**TRA-03 | P1 | Regra 5 (erro e bloqueio dizem o que fazer), confiança no dado**
Evidência: o BI descarta o erro de todas as consultas: `{ data: currentAppointments }` etc. (inteligencia/data.ts:327-350 em diante) e `fetchAppointmentHistory` sai em silêncio no primeiro erro (`if (error || !data) break;`, :258); app/gestor/nps/page.tsx:17-47 também só lê `data`; app/gestor/data.ts:469-489 idem. Existe apenas app/error.tsx raiz e não há `error.tsx` em app/gestor.
Problema: se o banco falhar ou a RLS negar, a tela mostra zeros e "sem dados" como se fossem fato (pacientes ativos 0, evasão 0%). Em BI isso é pior do que erro visível.
Correção: propagar o erro (throw) para um `error.tsx` do módulo com botão "Tentar de novo", ou mostrar faixa "Dados parciais: não foi possível carregar X".
Esforço: S. Risco: baixo.

**TRA-04 | P3 | Efeito estética-usabilidade, DESIGN.md:212 e :226**
Evidência: o Gestor mistura sistemas visuais: BI e NPS com paleta Tailwind crua (slate/indigo/rose/blue), PLR/Metas com tokens (`bg-paper`, `text-ink`), Operacional com classes `card` e tokens, Maturidade com `table`.
Correção: migrar BI e NPS para tokens.
Esforço: M. Risco: baixo.

**TRA-05 | P3 | Regra 5 (vocabulário do operador), Lei de Jakob**
Evidência: itens do menu "Inteligência BI" e "NPS" (components/gestor-nav.tsx:22-23) são jargão de analista; para o dono, "Indicadores" e "Satisfação" dizem o mesmo.
Correção: renomear, mantendo as rotas.
Esforço: S. Risco: baixo.

**TRA-06 | P2 | Lei de Jakob, telas órfãs**
Evidência: /gestor/maturidade sem link; /gestor/inteligencia/operacional com um botão sem destaque (inteligencia/page.tsx:22-26); `fullBleed`/dois padrões de cabeçalho (`PageHeader` em Pacientes, H1 solto em BI/NPS/Metas).
Correção: ver BI-11 e PAC-06; padronizar cabeçalho de página.
Esforço: S. Risco: baixo.

## 4. O que já está bom (curto)

- Cabeçalho único no layout, ativo por pathname e badge de NPS em Suspense (app/gestor/layout.tsx, module-header.tsx:77-93).
- `loading.tsx` existe para BI, Bonificação e Metas, e o do Gestor cobre o resto.
- Regra de paciente por check-in aplicada de forma consistente na BI.
- Comparativo e meta já aplicados em 5 KPIs da BI; PLR e Metas usam status com texto (não só cor).
- Redirects de rotas antigas evitam link quebrado.
- Simulador e histórico de vigências em Configurar & Simular.

## 5. Lacunas: o que NÃO foi auditado e por quê

- Execução real da aplicação (proibido rodar servidor): não medi tempos de resposta (Doherty), contraste real, nem o layout em 375 px; as conclusões de mobile e performance vêm do código.
- Conteúdo de app/gestor/inteligencia/data-quadros.ts (564 linhas) e das linhas 640 a 1140 de inteligencia/data.ts (cálculo de WhatsApp, planos, salas, capacidade): li só os trechos que definem comparativos, período e retorno. Não auditei a correção dessas fórmulas.
- app/gestor/data.ts linhas 30 a 400 (custo médio de sessão, alertas, vazamentos): vi apenas o cabeçalho dos tipos; é código morto nesta parte.
- bonificacao/config/actions.ts, metas/actions.ts, lib/metric-catalog.ts, lib/bonus-simulation.ts: não li; não verifiquei se há checagem de papel/permissão no servidor nas ações de aprovar faixa, publicar vigência ou remover meta (depende da RLS).
- Telas embutidas no hub do paciente (app/recepcao/pacientes/[id]/gestao/page.tsx, app/supervisao/prontuario-unificado/page.tsx, AnamnesePanel, PatientManagementPanel): li só o que afeta o hub (títulos, links, `embedded`); o conteúdo é de Recepção/Supervisão.
- Cadastros, Financeiro, Relatórios, Auditoria, Configurações: parte B.
- RLS e views reais no banco: não consultei o Supabase; a avaliação da regra 2 é pelo código (que lê tabelas-base).

## 6. Top 10 por impacto/esforço

1. NPS-01 (P0, S): esconder/ligar os números inventados do NPS Interno (8.9, 78%, 4.7, 4.5).
2. PES-01 (P0, M): tornar atômica a aprovação de faixa (fechar e abrir contrato numa transação), com confirmação do impacto em R$.
3. BI-02 (P1, S): comparar mês parcial com o mesmo intervalo do mês anterior para acabar com a seta vermelha falsa.
4. TRA-03 (P1, S): não engolir erro de consulta; `error.tsx` do Gestor e faixa de "dados parciais".
5. BI-01 (P1, M): faixa "Precisa de decisão hoje" no topo da BI, religando os vazamentos e alertas que já existem.
6. BI-03 (P1, M): comparativo/referência nos 14 KPIs que violam a regra 1 (lista em BI-03).
7. NPS-05 (P1, S): mensagens de disparo honestas e confirmação do alcance do envio em massa.
8. PES-03 e PES-02 (P1, S a M): mostrar sessões e meta 98% na elegibilidade e pré-preencher faixa e valor da próxima faixa.
9. PES-05 (P1, S): corrigir a glosa do PLR para o mês e paralelizar o cálculo.
10. PAC-01 e PAC-02 (P1, S a M): um alvo por linha no lugar de três ícones iguais, busca e filtro por status no servidor.

Contagem de achados: P0 = 2 (NPS-01, PES-01); P1 = 22; P2 = 20; P3 = 9; total 53.
