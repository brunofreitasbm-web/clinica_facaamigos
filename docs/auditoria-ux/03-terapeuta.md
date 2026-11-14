# Auditoria UX: módulo Terapeuta (celular entre sessões)

Escopo lido por inteiro: `components/terapeuta-bottom-nav.tsx`, `app/terapeuta/layout.tsx`, `app/terapeuta/page.tsx`, `today-sessions-list.tsx`, `session-actions.ts`, agenda (page, toolbar, day/week/month, disponibilidade), pacientes, prontuário (+auditoria), ficha do paciente (page + `components/prontuario/patient-tabs.tsx`), evolução (page, `evolution-form.tsx`, `actions.ts`, trial-data, voice recorder, histórico), repasse (page + data), métricas (pessoal e do paciente), vínculo, avaliação, fono (hub, nova, detalhe + `adl-assessment-form`), socially-savvy (hub), relatório devolutivo, relatório convênio, anamnese (page + form), pts/novo (só o wrapper), `intervention-logger`, `abc-logger`, `realtime-appointment-toast`, `offline-banner`, `lib/aba-actions.ts` (generateAIEvolutionText), `lib/trial-data.ts`, `lib/session-note-goals.ts`, `lib/therapist-patients.ts`. Nada foi executado (sem servidor, sem navegador): tudo abaixo vem de leitura de código. Onde o comportamento depende de runtime, está marcado "a confirmar".

Convenção de linhas: `arquivo:linha` reais do arquivo.

---

## 0. Resposta direta às perguntas do brief

### Contagem de toques (a partir da abertura do app, `start_url` = `/terapeuta`)

| Tarefa | Toques hoje (mínimo) | Caminho real | Observação |
|---|---|---|---|
| Abrir a sessão do dia | 0 a 1 | O app abre em Hoje e o cartão "Agora" já mostra o paciente. Se o paciente já passou pela recepção: 1 toque em "Iniciar atendimento" | Bom. Mas o nome do paciente não é link, então ver ficha/metas antes de entrar é outro caminho (ver HOJ-10) |
| Registrar a evolução (sessão realizada, 3 metas, 1 intervenção) | **cerca de 16 a 18 toques** + rolagem, em 4 telas | Check-out (1) → rolar até "Evoluções pendentes" ou tocar no banner (1) → tocar na linha (1) → Registrar intervenção (1) + escolher chip (1) + Salvar (1) → Continuar (1) → presença (1) + resultado de cada meta (3) → Continuar (1) → PIN (1 foco + 4 dígitos) → Assinar (1) | O botão "Registrar evolução" do cartão "Agora" **não funciona antes do check-out** (HOJ-01). Com a voz: 1 toque no microfone + 1 para parar + revisar, mas o ditado só aparece no passo 2, depois da intervenção obrigatória |
| Coletar dado ABA | 1 toque por tentativa certa, 2 por errada, **mas só depois do check-out** | Mesmo caminho da evolução até a tela, rolar até "Coleta de tentativas (ABA)" | Impossível durante a sessão (HOJ-01, EVO-04). O terapeuta teria de anotar no papel e digitar depois |
| Ver as metas do paciente | 2 toques (Pacientes → paciente) e a aba "Visão geral" já mostra o plano | A partir de Hoje não há atalho no cartão da sessão. Critério da meta: 3 toques (aba "Plano terapêutico") | Só mostra título e status, sem último resultado nem tendência (FIC-02) |
| Ver o repasse | 1 toque, mas escondido | Hoje → link "📄 Meu Extrato de Repasse" (4º de 4 links de texto de ~20 px de altura) | Fora do menu. Página mostra o mês corrente sem comparativo (REP-01) |

Meta do produto (evolução em até 2 minutos): com o desenho atual não é atingível de forma confiável. Os gargalos medidos no código são: passo 1 obrigatório (intervenção), 3 telas, PIN de 4 a 6 dígitos a cada assinatura, resultado por meta, e a dependência do check-out.

### session_notes é append-only e a UI reflete isso?
**Sim, confirmado.** Não existe policy de UPDATE nem chamada `.update/.delete` em `session_notes` no app (grep). A correção gera nova versão encadeada: `evolucao/actions.ts:187-208` (exige justificativa) e `:269-287` (insert com `version+1`, `supersedes_id`); conflito de versão tratado em `:293-297`. A UI reflete: etiqueta "Evolução assinada · versão N" (`evolucao/[appointmentId]/page.tsx:282-284`), botão "Editar evolução (nova versão)" (`:303`), tela de histórico com todas as versões e carimbo dispositivo/servidor (`historico/page.tsx:99-121`), motivo da edição obrigatório (`evolution-form.tsx:543-547`). Ressalvas: (a) a tela da evolução assinada **não mostra o conteúdo** da nota, só o status (EVO-07); (b) o histórico lista versões mas não mostra o que mudou entre elas (EVO-12); (c) `signed_at` vem do relógio do aparelho (`actions.ts:286`), decisão consciente para offline, mas um relógio errado vira data de assinatura.

---

## 1. Mapa de menus

Barra inferior (abaixo de `md`) e barra superior (a partir de `md`) são a mesma lista (`terapeuta-bottom-nav.tsx:31-45`, `:83-136`). PTS só aparece com `can_create_pts` (`layout.tsx:16-18`).

| Item | Rota | Tela(s) | Tarefa do operador | Cliques da tarefa principal |
|---|---|---|---|---|
| 📅 Hoje | `/terapeuta` | `page.tsx` + `today-sessions-list.tsx` | Ver a fila do dia, iniciar atendimento, encerrar, achar evolução pendente | 0 a 1 para iniciar; ~16 para registrar evolução |
| 🗓 Agenda | `/terapeuta/agenda` (`?view=dia/semana/mes`) | `agenda/page.tsx`, `day-agenda-list`, `week-agenda`, `month-agenda`, `my-availability` | Ver outros dias, semana, mês; ações do dia | 1 |
| 👥 Pacientes | `/terapeuta/pacientes` | `pacientes/page.tsx` → ficha `/terapeuta/paciente/[id]` | Achar um paciente e abrir a ficha | 2 |
| 📋 Prontuário | `/terapeuta/prontuario` (`?p=`, `?q=`) | `prontuario/page.tsx`, `auditoria-panel.tsx` | Ler histórico unificado e trilha de acesso de um paciente | 2 |
| 🎯 PTS (condicional) | `/terapeuta/pts/novo` | reaproveita `app/supervisao/planos/novo/page.tsx` (form de 1387 linhas, **não lido por inteiro**) | Criar plano terapêutico | 1 + preenchimento longo |
| Fora do menu: Minhas métricas | `/terapeuta/metricas` | `metricas/page.tsx` | Ver indicadores e bonificação | 1 (link em Hoje) |
| Fora do menu: Extrato de repasse | `/terapeuta/repasse` | `repasse/page.tsx`, `data.ts` | Ver honorário do mês e histórico | 1 (link em Hoje) |
| Fora do menu: Evolução | `/terapeuta/evolucao/[appointmentId]` (+ `/historico`) | `page.tsx`, `evolution-form.tsx`, `trial-data-panel.tsx`, `voice-evolution-recorder.tsx` | Registrar/editar evolução, coletar ABA | ver tabela acima |
| Fora do menu: Ficha e subtelas | `/terapeuta/paciente/[id]` + `metricas`, `relatorio`, `relatorio-convenio`, `vinculo`, `avaliacao`, `fono/...`, `socially-savvy/...`, `anamnese` (+`/tcle`) | ver Seções 2.5 a 2.7 | Instrumentos, relatórios, vínculo, 1ª avaliação | 2 a 4 |

Telas órfãs (rota existe, sem menu): métricas, repasse, evolução, todas as subtelas da ficha. Não existe rota órfã sem nenhum link de entrada, mas várias dependem de um único link de texto pequeno.

---

## 2. Achados por item de menu

### 2.1 Hoje

Resumo: boa ideia de "Agora/Próximas" e ações no cartão (alvo de 48 px), mas o fluxo central (sessão → evolução) está quebrado no meio, depende de recarregamentos completos e de dados que o sistema já sabe.

Já está bom: cartão "Agora" com ação primária única por estado (`today-sessions-list.tsx:119-170`); botões de 48 px (Fitts); estado vazio "Nenhuma sessão hoje" (`:74`); toast de chegada na recepção (`realtime-appointment-toast.tsx`).

**HOJ-01 | P0 | Lei de Fitts, Efeito Zeigarnik, Tesler, Doherty**
Evidência: `today-sessions-list.tsx:139-147` (botão "Registrar evolução" em `em_atendimento`); `agenda/day-agenda-list.tsx:132-140` (idem); `evolucao/[appointmentId]/page.tsx:104` (formulário só renderiza se `status === "realizada"`) e `:273-279` (senão: "Esta sessão ainda não foi realizada, não é possível registrar evolução"); `evolucao/actions.ts:134-136` e `trial-data-actions.ts:67-69` (servidor também recusa); `session-actions.ts:115-122` (`status: "realizada"` só é gravado no check-out).
Problema: o botão dourado primário do cartão em atendimento leva a uma tela de beco sem saída. Consequência pior: a coleta ABA e o log de intervenções, que o próprio código descreve como "durante a sessão" (`evolution-form.tsx:26-31`, cronômetro em `:301-308`), só podem existir depois do check-out. O terapeuta que usa o celular entre sessões não consegue registrar nada enquanto atende.
Correção proposta: (1) permitir criar rascunho de evolução, intervenções e tentativas ABA quando `attendance_started_at` existe e `checkout_at` é nulo (relaxar a checagem de status nessas três actions; só a assinatura exige `realizada`); (2) enquanto isso não sai, trocar o rótulo do botão em `em_atendimento` para "Encerrar e registrar evolução" fazendo check-out e `router.push` para a evolução, e esconder "Registrar evolução" antes do check-out.
Esforço: M. Risco: médio (a assinatura continua atrelada ao check-out; revisar a regra de que a sessão só conta como realizada no check-out).

**HOJ-02 | P1 | Tesler, Lei de Postel**
Evidência: `session-actions.ts:9-29` (erros de guia: "Sessão sem autorização vinculada", "sem sessões restantes", "saldo ABA insuficiente") e `:125` (falha do check-out devolve esses erros).
Problema: a documentação clínica fica refém da validação de faturamento: se a guia falhar, o check-out falha, a sessão não vira `realizada` e a evolução não pode ser escrita. O terapeuta não tem como resolver sozinho.
Correção: separar "encerrar atendimento" (clínico, sempre permitido) de "fechar para cobrança" (a validação de guia vira pendência para a recepção/faturamento, não bloqueio ao terapeuta); a mensagem de erro deve dizer a quem pedir ajuda.
Esforço: M a L. Risco: alto (mexe na regra de cobrança; decisão do dono do produto).

**HOJ-03 | P1 | Efeito Zeigarnik, Lei de Fitts**
Evidência: `today-sessions-list.tsx:83-85` (`upcoming` exclui `realizada`), `:159-167` e `:219-223` (CTAs "Registrar evolução/Evoluir" para `realizada`, mas `current` nunca é `realizada` e `upcoming` a exclui: código morto); `page.tsx:288-312` (única entrada, mais abaixo na página).
Problema: no instante do check-out a sessão some do cartão e nenhum CTA aparece no lugar. O terapeuta precisa rolar para "Evoluções pendentes" ou tocar no banner âncora. É exatamente o momento de maior intenção de registrar.
Correção: após o check-out bem-sucedido, navegar direto para a evolução (ou manter a sessão no topo como "Encerrada, falta a evolução" com botão primário). Remover o código morto.
Esforço: S. Risco: baixo.

**HOJ-04 | P1 | Lei de Fitts, Doherty, offline-first**
Evidência: `page.tsx:191-195` (banner), `:243-266` (4 atalhos), `:294-299` (linhas de pendências) são `<a href>`, não `<Link>`. O comentário do próprio componente de navegação diz que `<a href>` causava reload completo (`terapeuta-bottom-nav.tsx:24-29`). Os atalhos são `text-sm` sem padding (altura ~20 px, `page.tsx:245`) em linha com `gap-3`.
Problema: o caminho mais importante do dia (pendência → evolução) faz reload completo da página; sem rede, o doc do Next é explícito: navegação por reload não é retida (`node_modules/next/dist/docs/01-app/02-guides/offline-support.md`: "A full page reload while offline still fails"). Alvos de ~20 px violam 44 px.
Correção: trocar por `Link` (prefetch), dar `min-h-[44px]` e padding aos atalhos; linha de pendência inteira com altura mínima de 48 px.
Esforço: S. Risco: baixo.

**HOJ-05 | P1 | Limiar de Doherty, Efeito Zeigarnik**
Evidência: `realtime-appointment-toast.tsx:26-34` (só `setMessage`, nenhum `router.refresh()`), `:45` (some em 8 s), posição `fixed right-4 top-4` (`:57`); `today-sessions-list.tsx:168-170`.
Problema: quando a recepção faz o check-in, o toast diz "Um paciente chegou na recepção" (sem dizer quem) e o cartão continua mostrando "Aguardando check-in na recepção" sem botão "Iniciar atendimento" até o terapeuta recarregar à mão. O toast está no canto superior, fora da zona do polegar, e some sozinho.
Correção: `router.refresh()` no evento; toast com nome do paciente e botão "Iniciar atendimento" (zona do polegar, parte inferior acima da barra); manter até ação.
Esforço: S. Risco: baixo.

**HOJ-06 | P1 | Princípio de Pareto, carga cognitiva (dado errado)**
Evidência: `page.tsx:93-100` (todas as sessões `realizada` do terapeuta, ordem crescente, sem `.limit`/janela) e `:104-109`.
Problema: se o projeto usa o `max_rows` padrão (1000) do PostgREST (não há `max_rows` em `supabase/config.toml`; a confirmar no painel), um terapeuta com mais de 1000 sessões realizadas deixa de ver as mais recentes como pendentes, pois a consulta devolve as 1000 mais antigas. A contagem do banner também fica errada. Mesmo abaixo do teto, a lista cresce sem limite.
Correção: calcular pendências no servidor (view/RPC `realizada` sem nota), ordenadas por urgência, com janela e contagem exata; paginar "ver mais".
Esforço: M. Risco: baixo.

**HOJ-07 | P2 | Lei de Jakob, Efeito Zeigarnik**
Evidência: `today-sessions-list.tsx:78-79` (se ninguém está na recepção, `current` vira a primeira `aguardando`), `:91-93` (rótulo "Agora").
Problema: "Agora" pode ser uma sessão daqui a horas; o cartão grande mostra "Aguardando check-in" sem hora de início em destaque.
Correção: rotular "Próxima" com contagem regressiva quando não há atendimento/recepção; reservar "Agora" a `em_atendimento`/`na_recepcao`.
Esforço: S. Risco: baixo.

**HOJ-08 | P2 | Lei de Fitts (erro de toque), ações destrutivas, offline**
Evidência: `today-sessions-list.tsx:139-157` (Check-out secundário colado ao primário na mesma linha), `:61-71` (`runAction` sem `try/catch`; se o `await action` lançar, `setPendingId(null)` nunca roda), `session-actions.ts:81-149` (check-out consome guia e, em 1ª avaliação, marca `evaluated_at` e dispara NPS; sem desfazer).
Problema: ação irreversível, com efeitos financeiros, ao lado do botão mais usado, sem confirmação nem desfazer. Sem rede o botão fica em "Fechando…" sem indicar fila.
Correção: check-out como etapa do fluxo "Encerrar sessão" com folha de confirmação que diz o que acontece (consome 1 sessão da guia); ou toast "Sessão encerrada, desfazer" por 10 s; `try/catch` com mensagem de rede.
Esforço: S a M. Risco: baixo.

**HOJ-09 | P2 | Efeito estética-usabilidade, honestidade do estado**
Evidência: `page.tsx:146-161` (nuvem verde com o texto "sincronizado" fixo, sem lógica); `offline-banner.tsx:14-17` (o estado real existe, mas o selo não o lê).
Problema: o selo afirma "sincronizado" mesmo offline ou com ação pendente. Perda de confiança exatamente onde o terapeuta mais precisa dela.
Correção: ligar ao `useOffline` e a uma contagem real de itens pendentes ("2 itens aguardando envio") ou remover.
Esforço: S. Risco: baixo.

**HOJ-10 | P2 | Tesler, Pareto**
Evidência: `today-sessions-list.tsx:97-104` e `:195` (nome do paciente é texto puro); `page.tsx` não oferece caminho para ficha/metas a partir da sessão.
Problema: antes de entrar na sala, o terapeuta quer ver metas ativas e a última evolução (a ação mais comum depois de "iniciar"). Hoje: Pacientes → ficha, 2 toques e perde o contexto da sessão.
Correção: no cartão "Agora", linha recolhível "Metas e última evolução" (dados já carregados em `getActiveGoalsForPatient`/dossiê) e nome do paciente como link para a ficha.
Esforço: M. Risco: baixo.

**HOJ-11 | P2 | Lei de Hick, Von Restorff, Lei da Região Comum**
Evidência: `page.tsx:190-235` (banner de pendências), `:288-312` (mesma lista de pendências), `:314-337` (reavaliações a vencer: linhas sem link nem ação, todas com a mesma tag `st-agendada`, sem destaque de atrasadas), `:175-188` (seletor "Ver como" ocupando o topo para gestor).
Problema: três blocos de mesmo peso, banner duplicando a seção logo abaixo, e um bloco informativo sem ação (reavaliações). Empurram "Agora" para baixo (zona do polegar).
Correção: ordem Agora → "Precisa de você" (pendências + reavaliações como itens acionáveis, com link) → Próximas; banner some quando a lista já está visível; reavaliação atrasada em destaque único.
Esforço: M. Risco: baixo.

**HOJ-12 | P2 | Efeito Zeigarnik, Von Restorff, Gradiente de meta**
Evidência: `page.tsx:293-306` (linha mostra nome e data apenas; sem disciplina, hora nem idade), `:94` (select sem `is_evaluation`, então sessões de 1ª avaliação entram como "evolução pendente"; a confirmar), `repasse/data.ts:19` (`docDeadlineDays` existe no contrato do terapeuta, mas não aparece onde a pendência é cobrada).
Problema: não dá para priorizar (qual está mais velha, qual está perto de vencer o prazo do contrato). Evolução de 1ª avaliação pode aparecer como pendente de evolução quando o instrumento é a anamnese.
Correção: linha com "há N dias · disciplina · hora", realce acima do prazo (`doc_deadline_days`), excluir `is_evaluation`.
Esforço: S a M. Risco: baixo.

**HOJ-13 | P2 | Lei de Jakob, vocabulário do operador**
Evidência: `page.tsx:243-266` (4 links de texto: "Minha agenda", "Prontuário & Auditoria", "Minhas Métricas", "Meu Extrato de Repasse"). Menu: "Agenda", "Prontuário". Títulos das telas: "Minha agenda", "Prontuário & Auditoria", "Minhas métricas", "Extrato de Honorários Mensal (PJ)" (`repasse/page.tsx:63`).
Problema: dois deles duplicam itens do menu; os outros dois (métricas, repasse) só existem aqui, com nomes diferentes em cada lugar.
Correção: remover os duplicados; criar um cartão "Meu mês" (repasse + bônus, com comparativo) na Hoje, abaixo da fila; padronizar o nome: "Repasse".
Esforço: S. Risco: baixo.

**HOJ-14 | P3 | Limiar de Doherty**
Evidência: `page.tsx:30-120` (6 consultas em cascata) e `layout.tsx:16-18` (outra consulta a `profiles`).
Correção: `Promise.all` onde não há dependência; reaproveitar o perfil.
Esforço: S. Risco: baixo.

**HOJ-15 | P3 | Lei de Jakob, hierarquia de títulos**
Evidência: `page.tsx:239,289,315` e `today-sessions-list.tsx:91,181` (títulos de seção em `<h6>` logo depois de `<h1>`); `today-sessions-list.tsx:130-138` mostra "Registrar 1ª avaliação" mesmo para sessão `aguardando` (antes do check-in), enquanto a agenda exige `na_recepcao/em_atendimento` (`day-agenda-list.tsx:123`).
Correção: usar `h2`; alinhar condição entre Hoje e Agenda.
Esforço: S. Risco: baixo.

### 2.2 Agenda

Resumo: navegação por `Link`s servidos pelo servidor, três visões, alvos de 48 px no dia; mas reimplementa a lógica de Hoje (e herda o botão quebrado) e a navegação mensal pula meses.

Já está bom: visão Dia como padrão (`agenda/page.tsx:19`), controles `btn-icon` de 48 px, semana empilhada no celular e grade em `sm+` (`week-agenda.tsx:62,112`), célula do mês inteira clicável (`month-agenda.tsx:60-61`), esqueleto de carregamento (`agenda/loading.tsx`).

**AGE-01 | P2 | Princípio de Pareto, Lei de Tesler (manutenção)**
Evidência: `day-agenda-list.tsx:1-80` repete o `runAction`/mapa de estados de `today-sessions-list.tsx:56-71`; o comentário diz que a Hoje "fica intocada" (`:328`). O botão quebrado do HOJ-01 existe nos dois (`day-agenda-list.tsx:132-140`).
Problema: duas implementações divergentes do mesmo cartão; correções chegam a uma só (já divergem: condição de 1ª avaliação).
Correção: extrair um componente `SessionActions` único.
Esforço: M. Risco: baixo.

**AGE-02 | P2 | Lei de Postel (erro de dado)**
Evidência: `agenda/page.tsx:159-160` (mês avança/retrocede `±30` dias).
Problema: de 31/jan "próximo" cai em 02/mar, pulando fevereiro; de 29/mar "anterior" cai em 27/fev e depois pode repetir mês.
Correção: usar soma de meses calendário.
Esforço: S. Risco: baixo.

**AGE-03 | P2 | Lei de Jakob, consistência**
Evidência: hoje, a linha da sessão não é tocável e não tem "Ver ficha" (`day-agenda-list.tsx:100`, `:110-161`); nos outros dias há "Ver ficha" (`:172`); na semana, o toque abre a evolução se `realizada`, senão a ficha, sem sinalizar (`week-agenda.tsx:35-39`).
Problema: a mesma linha leva a destinos diferentes conforme o estado, sem pista visual.
Correção: toque na linha = ficha sempre; ação de estado como botão explícito; rótulo "Evolução" quando for o destino.
Esforço: S. Risco: baixo.

**AGE-04 | P2 | Efeito Zeigarnik, contraste/legibilidade**
Evidência: semana mostra "tipo da sessão" (Terapia recorrente), não o estado (`week-agenda.tsx:82-100`, texto `text-[10px]` em `:96`); mês usa `text-[10px]` (`month-agenda.tsx:77`) e só o primeiro nome.
Problema: nenhuma visão além do dia mostra evolução pendente nem estado de atendimento; 10 px é ilegível no celular.
Correção: ponto/ícone de "evolução pendente" por sessão e por dia; mínimo 12 px.
Esforço: M. Risco: baixo.

**AGE-05 | P3 | Lei de Jakob, acessibilidade**
Evidência: botão "Hoje" da barra da agenda (`agenda-toolbar.tsx:38-40`) tem o mesmo nome do item de menu "Hoje" (outra tela); `role="tablist"` com `Link`s e sem `tabpanel` (`:51-69`).
Correção: "Ir para hoje"; usar `nav` + `aria-current`.
Esforço: S. Risco: baixo.

**AGE-06 | P3 | Efeito Zeigarnik, carga cognitiva**
Evidência: `day-agenda-list.tsx:152-160,163-175` (sessão assinada não tem estado positivo, só "Realizada"); `agenda/page.tsx:164` (`description=""`), `:202` (bloco "Minha disponibilidade" somente leitura, no fim de toda visão).
Correção: tag "Evolução assinada" para fechar o laço; mover "Minha disponibilidade" para dentro do menu de ajuda ou ficha pessoal.
Esforço: S. Risco: baixo.

### 2.3 Pacientes

Resumo: lista alfabética simples com alvo grande, sem busca, sem estado, duplicando o Prontuário.

Já está bom: uma ação por linha, alvo de ~46 px, estado vazio dito em linguagem do operador (`pacientes/page.tsx:48-50`).

**PAC-01 | P1 | Princípio de Pareto, dado incompleto**
Evidência: `lib/therapist-patients.ts:24-41` (três consultas sem `limit`: todos os agendamentos e todas as notas do terapeuta; mesmo teto de 1000 linhas do HOJ-06), `:78-80` (ordenação só alfabética), sem filtro por `status`.
Problema: terapeuta com muita história pode ter pacientes ativos faltando; pacientes em alta/inativos misturados aos ativos.
Correção: consulta distinta (`distinct patient_id`) por RPC, com status; ativos primeiro, inativos recolhidos.
Esforço: M. Risco: baixo.

**PAC-02 | P2 | Lei de Hick, Efeito Zeigarnik, "a tela traz o trabalho"**
Evidência: `pacientes/page.tsx:47-63` (sem busca; a busca existe só em `prontuario/page.tsx:89`), linha mostra só o nome e "Ver ficha →".
Problema: com 30+ pacientes é rolar e procurar. Nenhuma informação decide a próxima ação (próxima sessão, evolução pendente, PTS vencendo).
Correção: campo de busca (reuso de `SearchAsYouTypeInput`), badge de pendência e "próxima sessão" por linha, ordenar por "tenho sessão hoje" primeiro.
Esforço: M. Risco: baixo.

**PAC-03 | P2 | Lei de Jakob, Lei da Similaridade**
Evidência: duas listas do mesmo conjunto (`pacientes/page.tsx` e `prontuario/page.tsx:84-114`); a ficha aberta por Pacientes acende "Prontuário" no menu (`terapeuta-bottom-nav.tsx:59-61`), então o usuário "muda de aba" sem ter tocado nela.
Correção: fundir Pacientes e Prontuário (ver TRV-02/PRO-01).
Esforço: M. Risco: médio (muda menu).

**PAC-04 | P3 | Consistência**
Evidência: `pacientes/page.tsx:36-40` (gestor pode passar qualquer `?therapist=` sem validar contra a lista; a Hoje e a Agenda validam) e `prontuario/page.tsx:45` (ignora o parâmetro).
Correção: usar o mesmo componente "Ver como" validado.
Esforço: S. Risco: baixo.

### 2.4 Prontuário

Resumo: pensado como "linha do tempo + auditoria"; a auditoria é jargão de conformidade, não decisão do terapeuta, e atrapalha o uso rotineiro (ler o que aconteceu antes da sessão).

Já está bom: lista que colapsa para "Trocar paciente" no celular (`prontuario/page.tsx:84,125-127`), registro de acesso LGPD (`logRecordAccess`, `:61`), busca ao digitar.

**PRO-01 | P2 | Vocabulário do operador, Lei de Hick**
Evidência: `auditoria-panel.tsx:29-56` (cartões "Assinatura", "Versionamento", "Trilha LGPD (30 dias)", "edição gera nova versão, nunca sobrescreve"), `:82` (link "Ver ficha completa"), título "Prontuário & Auditoria" (`prontuario/page.tsx:75`).
Problema: três cartões de conformidade acima do histórico que o terapeuta veio ler. "Versionamento", "Trilha LGPD" são termos de sistema.
Correção: histórico primeiro; auditoria atrás de "Quem acessou" recolhido; nomear "Histórico do paciente".
Esforço: S. Risco: baixo.

**PRO-02 | P3 | Efeito da posição serial, Lei de Postel**
Evidência: `lib/patient-timeline.ts:54,148` (limite 30 itens) sem "ver mais" na tela (`prontuario/page.tsx:148-168`); "Trocar paciente" perde a busca (`:126`).
Correção: botão "Ver mais antigos"; preservar `q`.
Esforço: S. Risco: baixo.

### 2.5 Ficha do paciente (destino de Pacientes e Prontuário)

Resumo: tela mais densa do módulo (cabeçalho com 5 botões, painel lateral de instrumentos, 6 abas), com duplicações e metas pobres.

Já está bom: identificação do paciente e convênio sempre visíveis (`PatientIdentityBar`), abas de 48 px, voltar do celular volta para a aba inicial (`patient-tabs.tsx:108`), evolução de dados entre abas sem recarregar.

**FIC-01 | P1 | Lei de Miller, Lei de Hick**
Evidência: `paciente/[patientId]/page.tsx:209-254` (painel "Instrumentos de Avaliação"), `:260-278` (5 botões: Evolução/ABA, Relatório família, Relatório plano de saúde, Vínculo, Prontuário & Auditoria), `patient-tabs.tsx:15-24` (5 abas + Agenda). Duplicações: "Evolução/ABA" (`page.tsx:263`) e aba "Coleta ABA & Tentativas" (`patient-tabs.tsx:390-397`); "Prontuário & Auditoria" (`page.tsx:275`) leva para outra tela com o mesmo paciente; metas aparecem em "Visão geral" e "Plano terapêutico" (`patient-tabs.tsx:164-186` e `:357-385`); instrumentos aparecem na ficha, na aba ABA (`ProtocolAssessmentDialog`) e dentro da evolução (`evolucao/page.tsx:143-171`).
Problema: ao menos 15 pontos de entrada, vários para o mesmo destino.
Correção: agrupar em 3 blocos (Hoje/Sessões, Plano e metas, Relatórios e instrumentos); eliminar a aba "Plano" (fundir na "Visão geral") e o botão de Prontuário.
Esforço: M. Risco: médio.

**FIC-02 | P1 | Gradiente de meta, Efeito Zeigarnik, "ação onde o dado está"**
Evidência: `patient-tabs.tsx:164-180` (aba padrão: título da meta e status apenas), `:373-376` (critério só na aba "Plano").
Problema: a pergunta rotineira antes da sessão é "como está cada meta?". A tela mostra só "ativa/atingida". Os resultados por meta já estão nas evoluções (`getMetasTrabalhadas`, calculado em `page.tsx:95-102`), mas não são resumidos por meta.
Correção: por meta, chip do último resultado ("Em aquisição, 12/11"), tendência dos últimos 3, critério curto; ordenar as ativas primeiro.
Esforço: M. Risco: baixo.

**FIC-03 | P2 | Efeito Zeigarnik**
Evidência: banner de sessões aguardando evolução só na aba "Evolução" (`patient-tabs.tsx:215-245`), limitado a 20 (`page.tsx:124`); aba padrão é "Visão geral" (`:103`).
Correção: levar o aviso para fora das abas, no topo da ficha.
Esforço: S. Risco: baixo.

**FIC-04 | P2 | Lei de Fitts, Lei de Jakob (mestre-detalhe no celular)**
Evidência: `patient-tabs.tsx:248-343` (lista com `max-h-[650px]` e detalhe em coluna separada que no celular fica **abaixo** da lista; `lg:` a 1024 px), `:260-268` (campo de filtro com `text-xs`, ~30 px, sem a classe `.input`, filtro digitado por data).
Problema: no celular, tocar uma evolução não muda nada visível; o conteúdo aparece 650 px abaixo.
Correção: no celular, acordeão inline ou tela de detalhe; filtro por mês em chips.
Esforço: M. Risco: baixo.

**FIC-05 | P2 | Vocabulário do operador**
Evidência: `patient-tabs.tsx:256` ("Append-only · assinado"), `evolution-form.tsx:515-516` ("O registro é append-only"), aba "Coleta ABA & Tentativas" (`patient-tabs.tsx:18`) mostra apenas gráficos (a coleta acontece em outra tela).
Correção: "Não pode ser alterada, só corrigida em nova versão"; renomear a aba "Curvas ABA".
Esforço: S. Risco: baixo.

**FIC-06 | P2 | Lei de Tesler, "ação onde o dado está"**
Evidência: `patient-tabs.tsx:181-186` e `:381-385` (sem plano: só "Notificar supervisor"); `evolution-form.tsx:650-656` (link só leva à ficha); `supervisao/planos/novo/page.tsx:15-21,98` aceita `?paciente=`, mas nenhum link do terapeuta passa esse parâmetro. O próprio menu PTS lista todos os pacientes da clínica (`planos/novo/page.tsx:48-54`).
Problema: terapeuta com `can_create_pts` vê o paciente sem plano e precisa ir ao menu, achar de novo o paciente numa lista da clínica inteira.
Correção: botão "Criar plano para este paciente" (com `?paciente=`) quando `can_create_pts`, mantendo "Notificar supervisor" para os demais; lista do menu PTS limitada aos pacientes do terapeuta.
Esforço: S. Risco: baixo.

**FIC-07 | P3 | Acessibilidade**
Evidência: `<main>` aninhado (`page.tsx:194` e `patient-tabs.tsx:137`); aba ativa só em estado local (`patient-tabs.tsx:103`), perde ao recarregar.
Correção: `section` no interior; guardar aba em `?aba=`.
Esforço: S. Risco: baixo.

### 2.6 Evolução (fluxo central do módulo)

Resumo: o desenho em 3 passos com rascunho local, PIN e versionamento é sólido do ponto de vista clínico; mas tem um texto "IA" que escreve conteúdo clínico falso, estado que se perde ao recarregar, passo 1 obrigatório e latência por tentativa ABA.

Já está bom: rascunho em IndexedDB a cada 300 ms (`evolution-form.tsx:273-299`) e indicador "Salvo apenas no dispositivo" offline (`:449-451`); ação do formulário com envio retido pelo Next (`:558-572`, `next.config.ts:12-18`); aviso de assinatura pendente ao reabrir (`:172-182`); metas pré-marcadas com as da sessão anterior (`lib/session-note-goals.ts:46-90`); botões de presença e resultado de 44 a 48 px (`:608-631`, `:~690`); teclado numérico e `autoComplete="off"` no PIN (`:912-915`); barra de ação fixa com `safe-area` (`:1020-1026`); ditado por voz; botão voltar do celular volta um passo (`:145`).

**EVO-01 | P0 | Dados do prontuário (erro de dado clínico), ações destrutivas, honestidade**
Evidência: `lib/aba-actions.ts:326` (sem ABC: "Não foram registrados comportamentos disruptivos significativos durante o atendimento"), `:362` (sempre: "Conclusão: O paciente apresentou boa receptividade às atividades propostas, mantendo engajamento e progresso na esteira terapêutica"); a função só lê tentativas/ABC/intervenções do banco e **ignora** presença, comportamentos e metas do formulário (`:242-368`); `evolution-form.tsx:207-210` (`setFreeText(res.generatedText)` **substitui** o que o terapeuta já digitou, sem confirmar); `:854` ("Gerar Texto com IA (1-Clique)") e `:859-872` (barra de progresso fingida: `Math.min(aiElapsedSeconds * 10, 95)`).
Problema: não é IA, é um modelo de frase. Gera afirmação clínica fixa e positiva, independente do que ocorreu (por exemplo presença 1 com autolesão marcada gera "boa receptividade"). O terapeuta assina com PIN um registro que pode contradizer os campos estruturados que ele mesmo preencheu. E apaga o texto digitado. Em prontuário isso é risco de dado, não de usabilidade.
Correção: remover a frase de conclusão e o "sem comportamentos" automático; montar o texto só com dados registrados, incluindo os campos do passo 2; renomear "Montar texto com os dados da sessão"; se já há texto, perguntar "Acrescentar ou substituir?"; remover a barra de progresso fingida.
Esforço: S. Risco: baixo (reduz texto gerado).

**EVO-02 | P1 | Efeito Zeigarnik, perda de dados**
Evidência: `evolution-form.tsx:595` (`<InterventionLogger ... />` sem `initialLogs`), `:793` (`<ABCLogger appointmentId=... />` sem `initialLogs`); `intervention-logger.tsx:21,34-36` (contagem sai da lista local); `evolution-form.tsx:1047` (`Continuar` desabilitado se `interventionsCount === 0`); `lib/aba-actions.ts:209` (`getAppointmentABCLogs` existe e não é usada aqui).
Problema: recarregar a página, perder a aba do navegador no celular ou voltar depois de sair faz a lista parecer vazia e bloqueia "Continuar" até registrar outra intervenção, gravando duplicata na linha do tempo que alimenta o texto gerado. O mesmo vale no modo de edição (`evolucao/page.tsx:217-232` renderiza o mesmo formulário): para criar nova versão é preciso inventar uma intervenção.
Correção: carregar `initialLogs` do servidor (intervenções e ABC), e não exigir contagem em edição.
Esforço: S. Risco: baixo.

**EVO-03 | P1 | Lei de Hick, Lei de Fitts, Pareto (meta de 2 minutos)**
Evidência: `evolution-form.tsx:1037-1052` (passo 1 exige ao menos uma intervenção; o servidor não exige: `evolucao/actions.ts` não menciona); `intervention-logger.tsx:90` (chips `px-2.5 py-1 text-xs`, cerca de 26 px de altura), `:71` (botão "Registrar intervenção" `py-1.5 text-xs`), `:132` (resposta do paciente `py-1.5 text-xs`), `:150` (salvar `py-2 text-xs`), `:103-119` (campo `text-sm`, dispara zoom no iOS).
Problema: o primeiro contato com o formulário é um catálogo de intervenções em chips de ~26 px, obrigatório, antes dos campos que o terapeuta realmente tem (presença, metas). Mínimo de 3 toques só para passar do passo 1. Abaixo de 44 px (Lei de Fitts) e fora da regra "campos estruturados primeiro".
Correção: abrir no passo "Presença + metas" (já pré-marcadas); intervenção opcional, em chips de 44 px com último uso no topo; remover a obrigatoriedade.
Esforço: M. Risco: baixo (UI), médio se o dono considera a linha do tempo obrigatória.

**EVO-04 | P1 | Limiar de Doherty, Lei de Fitts, Lei de Postel, perda de dados**
Evidência: `trial-data-panel.tsx:57-87` (cada toque espera o servidor para atualizar a contagem; sem otimismo), `trial-data-actions.ts:42-128` (getUser, appointment, profile, program, count e insert em sequência por tentativa), `trial-data-panel.tsx:26` (resultado padrão "correto"), `:162-169` (um programa trava no "Salvando…" enquanto aguarda); sem desfazer nem correção (a tentativa é gravada e só é somada); `:137-144` (nível de ajuda é texto livre, `text-sm`, `py-1`), `:151-159` (duração, `type="number"`, `py-1`); todos os programas empilhados em cartões completos (`:98-174`).
Problema: coletar tentativa deveria ser um toque, na hora, sem esperar rede. Aqui: resultado pré-selecionado "Acerto" (um toque errado grava dado falso e não há como corrigir), ~6 consultas por toque, sem fila local, sem desfazer, entrada de texto no celular para dado estruturado, campos de 30 px que dão zoom no iOS. Com 8 programas, rolagem longa.
Correção: modo de coleta com um programa em foco, botões grandes Acerto/Erro/Ajuda (1 toque = grava), contagem otimista com desfazer de 5 s e fila local (IndexedDB) que sincroniza; nível de ajuda em chips (verbal, gestual, física, independente); sem resultado pré-selecionado; resumo "7/10, 70%" fixo no topo.
Esforço: L. Risco: médio.

**EVO-05 | P1 | Tolerância a rede ruim (offline-first)**
Evidência: `offline-banner.tsx:27` ("o que você preencher fica salvo neste aparelho e é enviado assim que a internet voltar"); `next.config.ts:12-18` (reenvio é do Next, em memória da aba); `public/sw.js:1` (service worker só trata push do escopo `/m/`: não há cache do app, então abrir o app sem rede falha); `voice-evolution-recorder.tsx:164,191-193` (o áudio é descartado ao tentar enviar; se a rede falha, "Tentar novamente" grava de novo, o relato falado se perde); `evolution-form.tsx:376-401` (foto/vídeo sem retry; erro só vira texto `:824`); intervenções e tentativas ABA são Server Actions sem fila persistente (EVO-04); `evolution-form.tsx:224-299` (o rascunho guarda só os campos do formulário, não intervenções, tentativas, ABC nem mídia).
Problema: o rascunho local cobre parte do formulário, e a mensagem global promete mais do que entrega. Fechar a aba, o celular bloquear ou o navegador matar a aba descarta ações em voo. Entre uma sessão e outra, o terapeuta anda pelo prédio com sinal ruim.
Correção: persistir cada ação (tentativa, intervenção, ABC, áudio, foto) em fila IndexedDB com estado "aguardando envio" visível por item; guardar o áudio local até transcrever; contador "N itens aguardando" no selo da Hoje (HOJ-09); texto do banner fiel ao que é salvo; service worker com cache do shell de `/terapeuta/*`.
Esforço: L. Risco: médio.

**EVO-06 | P1 | Lei de Tesler, "erro e bloqueio dizem o que fazer"**
Evidência: PIN criado no último passo: `evolution-form.tsx:939-979` (cartão "Configure seu PIN" só aparece no passo 3) e `:1069` (botão desabilitado sem PIN); bloqueio: `evolucao/actions.ts:225-230` ("PIN bloqueado... Tente novamente mais tarde", sem tempo restante nem a quem pedir), `:240-251` (5 erros = 15 min); não existe trocar PIN nem "esqueci meu PIN" no módulo (única redefinição: `app/gestor/cadastros/colaboradores/actions.ts:386`).
Problema: o primeiro terapeuta a assinar descobre que precisa criar PIN depois de preencher tudo; quem esquece o PIN fica sem assinar até o gestor limpar, sem ser avisado de quem procurar.
Correção: pedir o PIN no primeiro acesso (onboarding) ou logo no passo 1; mensagem de bloqueio com hora de liberação e "fale com a coordenação"; tela "Alterar PIN" acessível no perfil.
Esforço: M. Risco: baixo.

**EVO-07 | P2 | Efeito Zeigarnik, "ação onde o dado está"**
Evidência: `evolucao/[appointmentId]/page.tsx:69` (carrega `structured` e `free_text`) e `:280-312` (a tela da evolução assinada mostra só "Evolução assinada · Assinada em..." e botões; o conteúdo não aparece); `evolution-form.tsx:172-192` (depois de assinar: ✓ e "Voltar para a sessão").
Problema: depois de assinar, o terapeuta não vê o que assinou nem a confirmação do que foi gravado; precisa abrir "Ver histórico".
Correção: renderizar `SessionNoteStructuredView` na própria tela e na confirmação.
Esforço: S. Risco: baixo.

**EVO-08 | P2 | Efeito estética-usabilidade, carga cognitiva, Lei de Fitts**
Evidência: escala de presença sem âncoras (`evolution-form.tsx:608-631`: só 1 a 5); progresso de 3 barrinhas sem nome nem "passo 2 de 3" (`:489-497`); chip "Nenhuma" de orientação convive com outros (`:767-789`, sem exclusão mútua); rótulos de comportamento com altura ~40 px (`:724-731`, `py-2` + `text-base`); metas pré-marcadas sem resultado bloqueiam "Continuar" (`:403-417`) e, se o plano mudou, um rascunho restaurado pode manter ids de metas que não aparecem mais e travam o avanço (`:260` restaura `metas` sem cruzar com `activeGoals`; a confirmar).
Correção: legenda "1 = muito disperso, 5 = muito engajado"; "Passo 2 de 3: Sessão"; "Nenhuma" exclusivo; alvo mínimo de 44 px; filtrar metas do rascunho pelas ativas.
Esforço: S. Risco: baixo.

**EVO-09 | P2 | Lei de Hick, Lei de Miller**
Evidência: `evolucao/page.tsx:141-174` (`topContent`: cartão "Instrumentos de Avaliação" com até 5 botões de saída + painel ABA) é renderizado dentro do formulário e visível em **todos os passos** (`evolution-form.tsx:246`).
Problema: o formulário de 3 passos tem acima de cada passo um painel de instrumentos que leva a outras telas e um painel ABA longo; no passo 3 o PIN fica depois de dois blocos de rolagem. Sair para um instrumento no meio da evolução não é sinalizado.
Correção: instrumentos fora da evolução (ficam na ficha); o painel ABA no passo próprio ("Sessão").
Esforço: M. Risco: baixo.

**EVO-10 | P2 | Lei de Postel, vocabulário do operador**
Evidência: `evolution-form.tsx:602` (ditado só no passo 2, depois do obrigatório do passo 1); `voice-evolution-recorder.tsx:296` ("O Gemini está estruturando sua evolução..."), `:210-212` ("Evolução em 2 minutos"); `evolution-form.tsx:314-348` (a sugestão sobrescreve presença e acrescenta no texto sem destacar o que foi alterado); duas ferramentas "IA" com nomes e efeitos diferentes (ditado e "Gerar texto").
Problema: o caminho mais rápido (voz) está escondido atrás do passo mais lento; nome de fornecedor no texto ao usuário; mudanças silenciosas em presença.
Correção: ditado como primeira ação do formulário; marcar os campos preenchidos pela voz ("sugerido") até o terapeuta confirmar; uma só ferramenta "Ditar" e uma só "Montar texto".
Esforço: M. Risco: baixo.

**EVO-11 | P2 | Perda de sessão (rede e tempo)**
Evidência: `components/auth-session-manager.tsx:34-36` (logout diário às 19h derruba a aba aberta); `evolucao/actions.ts:72-74` ("Sessão expirada. Faça login de novo.").
Problema: evoluções pendentes tendem a ser escritas no fim do dia. Quem está no formulário às 19h é deslogado e, se o envio estava retido, falha com "Sessão expirada". O rascunho sobrevive em IndexedDB, mas a volta ao ponto exato não foi verificada (a confirmar).
Correção: aviso 10 min antes do corte, e retorno automático à mesma evolução após novo login.
Esforço: M. Risco: baixo.

**EVO-12 | P3 | Vocabulário do operador, estética**
Evidência: `historico/page.tsx:99-121` (mostra "Dispositivo/Servidor", sem diferença entre versões); `evolution-form.tsx:812` (`capture="environment"` força abrir a câmera em vez da galeria), `:923-931` (botão mostrar/ocultar PIN com 👁️/🙈, `p-2.5 text-sm`, ~36 px); `intervention-logger.tsx:61` e `abc-logger.tsx:60` (classes `dark:` e visual diferente do resto, sem uso de `.btn`/`.input`).
Correção: destacar o que mudou entre versões; permitir galeria; ícone "olho" e alvo de 44 px; alinhar ao sistema visual.
Esforço: S a M. Risco: baixo.

### 2.7 Subtelas da ficha (instrumentos e relatórios)

Resumo: funcionam, mas são formulários longos sem rascunho local e com alvo/rodapé inadequados para celular.

Já está bom: ADL/PROC com opções de 48 px e totais em barra fixa (`adl-assessment-form.tsx:192-208,400-431`), rascunho no servidor ("Salvar rascunho"), atalhos por faixa etária.

**TRV-05 (ver Seção 3)** cobre a falta de rascunho local. Achados específicos:

**SUB-01 | P1 | Ações destrutivas/irreversíveis, Lei de Fitts**
Evidência: `relatorio/report-editor.tsx:186-193` ("Enviar ao mural da família", sem confirmação, publica ao responsável) e `:178-185` ("Aprovar" separado, 2 etapas para uma só decisão); `:151-159` (mesmo texto aparece duas vezes: rascunho da IA e versão final, ocupa o dobro no celular).
Problema: envio externo irreversível a um toque; duas telas de texto idênticas.
Correção: uma ação "Aprovar e enviar" com folha de confirmação ("A família verá isto no mural"); mostrar a versão final por padrão e o rascunho original em "ver rascunho".
Esforço: S. Risco: baixo.

**SUB-02 | P2 | Lei de Doherty, interação móvel**
Evidência: `relatorio-convenio/report-generator.tsx:92-108` (Ver PDF), `:102` (`window.open` chamado depois de `await` dentro de `startTransition`: perde o gesto do usuário e é bloqueado como pop-up no iOS Safari; a confirmar); datas padrão por `toISOString()` (`report-editor.tsx:34-36`, `report-generator.tsx:7-14`) em UTC, viram "amanhã" depois das 21h em Brasília.
Correção: abrir a janela antes do `await` ou navegar na mesma aba; datas na timezone da clínica.
Esforço: S. Risco: baixo.

**SUB-03 | P2 | Lei de Postel, Lei de Tesler**
Evidência: `vinculo/bonding-form.tsx:30-35` (datas sem valor padrão), `:42` (engajamento 1 a 5 por `type="number"`, enquanto a evolução usa 5 botões), `:30,36,40` (rótulos sem `htmlFor`: tocar no texto não foca o campo), `:27` (`<form action>` com função síncrona: React 19 limpa campos não controlados após o envio, o que apagaria o texto também quando o servidor responde erro; a confirmar), sem aviso de sucesso (`:20-22`).
Correção: padrão "últimos 30 dias" (como o relatório), botões 1 a 5, rótulos associados, estado controlado, toast "Registro salvo".
Esforço: S. Risco: baixo.

**SUB-04 | P2 | Lei de Fitts**
Evidência: rodapé insuficiente para a barra inferior: `vinculo/page.tsx:25` (`p-6`), `avaliacao/page.tsx:59` (`p-6`), `paciente/[patientId]/metricas/page.tsx:99`, `relatorio/page.tsx:55`, `relatorio-convenio/page.tsx` (`p-6`), `fono/page.tsx:57` e `socially-savvy/page.tsx:68` (`pb-10`), `anamnese/page.tsx:40` (`pb-10`); a barra tem ~60 px (`terapeuta-bottom-nav.tsx:108,120`).
Problema: o último botão ou o último item de cada uma dessas telas fica sob a barra fixa.
Correção: `pb-24 md:pb-10` no layout do módulo (uma vez só, em `layout.tsx`).
Esforço: S. Risco: baixo.

**SUB-05 | P2 | Efeito Von Restorff (duplicação)**
Evidência: `adl-assessment-form.tsx:294-303` e `:400-431` (dois conjuntos de "Salvar rascunho/Concluir avaliação" na mesma tela); a barra fixa (`sticky bottom-4 z-20`) sobrepõe a barra de navegação (`z-10`) no celular.
Correção: manter só a barra fixa; elevá-la acima da navegação ou escondê-la.
Esforço: S. Risco: baixo.

**SUB-06 | P2 | Ações destrutivas**
Evidência: `components/anamnese-form.tsx:221-227` ("Cancelar" é `<a href>`, `text-xs`, ao lado do botão primário, sem confirmação e sem rascunho de ~18 campos de texto); `:40-52` (mesmo padrão de form action que o SUB-03).
Correção: confirmar saída se houver campo preenchido; salvar rascunho; alvo de 44 px.
Esforço: S. Risco: baixo.

**SUB-07 | P3 | Tamanho de fonte**
Evidência: `intervention-logger.tsx:103-119` e `abc-logger.tsx:97,124,139` (campos de texto `text-sm`, 14 px), `trial-data-panel.tsx:143,158` (`text-sm`).
Problema: iOS dá zoom em campos com menos de 16 px, desloca o layout e esconde a barra fixa.
Correção: `text-base` nos campos móveis.
Esforço: S. Risco: baixo.

### 2.8 Métricas (fora do menu)

Resumo: indicadores sem comparativo, com vocabulário de sistema.

**MET-01 | P1 | Regra 1 do AGENTS.md (KPI com comparativo), Efeito Gradiente de meta**
Evidência: `metricas/page.tsx:82-116` (cada cartão: nome, "Referente a MM/AAAA" e o valor); `lib/therapist-metrics.ts:62-120` (só o último snapshot por métrica, sem mês anterior e sem meta; `direction` existe no tipo `TherapistMetricRow` e não é usado na tela).
Problema: nenhum dos indicadores traz "vs mês anterior" ou "vs meta". Pela regra do projeto, métrica isolada não é KPI válido.
Correção: linha compacta "▲ 4 pts vs mês anterior · meta 85%" usando os dois últimos snapshots e `direction` para colorir; o bônus já tem barra de progresso (`BonusProgressCard`, mantém).
Esforço: M. Risco: baixo.

**MET-02 | P2 | Vocabulário do operador, carga cognitiva**
Evidência: `metricas/page.tsx:15-18` ("Ainda não calculado nesta versão do sistema"), `:20-23` ("cálculo sai no dia 1"), cartões com "—" para métricas sem dado (`:104-113`); `metricas/back-shortcut.tsx:6` (atalho Alt+H, inútil no celular), `page.tsx:58-64` (voltar "← Hoje" no topo, longe do polegar).
Correção: não renderizar métricas ainda não calculadas (ou agrupar em "Em breve"); remover Alt+H.
Esforço: S. Risco: baixo.

**MET-03 | P2 | Lei de Jakob (alcance), tooltips só com hover**
Evidência: acesso apenas pelo link de texto da Hoje (`page.tsx:255-260`); `paciente/[patientId]/metricas/page.tsx:56-58,137,172-180` (valores por semana e contagens só em `<title>`/`title`, inacessíveis no toque); título da tela "Evolução, nome" (`:96`), botão "📈 Evolução/ABA" (`ficha page.tsx:264`) e aba "Coleta ABA" (`patient-tabs.tsx:18`) para o mesmo destino; sem comparativo "últimos 60 dias vs 60 anteriores" (`:128`).
Correção: mostrar o valor ao tocar (ou como rótulo); nome único "Curvas e metas"; incluir variação.
Esforço: M. Risco: baixo.

### 2.9 Repasse (fora do menu)

Resumo: tela fora do padrão visual do módulo, vocabulário contratual e sem comparativo.

**REP-01 | P1 | Regra 1 do AGENTS.md**
Evidência: `repasse/page.tsx:90-113` (três cartões: módulos entregues, status, honorário), sem "vs mês anterior"; `past[0]` (mês anterior) já está carregado em `:40`.
Problema: "Módulos Entregues" e "Honorário a Receber" isolados, sem referência; o histórico por baixo só lista linhas.
Correção: sob cada número, "vs mês anterior: +3 módulos (+R$ 450)"; mês aberto como "parcial, ritmo de 18 módulos".
Esforço: S. Risco: baixo.

**REP-02 | P2 | Vocabulário do operador**
Evidência: `repasse/page.tsx:63` ("Extrato de Honorários Mensal (PJ)"), `:79,93,111,132` ("Faixa Atual Contratada", "Módulos Entregues", "Honorário Total a Receber", "Histórico de Competências Fechadas"); `data.ts:167` ("esvaziado por falta (aviso <24h)"); `data.ts:91,118` ("A pagar" também para mês aberto); três nomes para a mesma tela (link "Meu Extrato de Repasse", título, breadcrumb).
Correção: "Meu repasse", "Atendimentos (módulos) do mês", "Previsto" enquanto o mês está aberto, "Faltas com aviso curto".
Esforço: S. Risco: baixo.

**REP-03 | P2 | Lei de Jakob, consistência, Lei de Fitts**
Evidência: `repasse/page.tsx:52-74` (usa `div`, sem `PageHeader`, `p-6`, `h1` de 30 px, breadcrumb + botão "Voltar" + barra de navegação, três navegações para uma saída); `:17-19` (badges com variantes `dark:`).
Correção: usar o cabeçalho do módulo (`PageHeader` ou o cabeçalho petróleo das outras telas) e remover breadcrumb e botão "Voltar".
Esforço: S. Risco: baixo.

**REP-04 | P2 | Limiar de Doherty**
Evidência: `repasse/page.tsx:47-49` (um `getMyPayoutStatement` por competência passada, todas executadas no carregamento, mesmo que o terapeuta só abra uma), `data.ts:143-147` (a consulta de itens e das sessões roda para cada mês).
Correção: carregar o extrato de uma competência só quando o modal abre.
Esforço: M. Risco: baixo.

### 2.10 PTS (condicional)

Resumo: o menu reutiliza a tela da supervisão; não li o formulário inteiro (1387 linhas).

**PTS-01 | P2 | Lei de Jakob, carga cognitiva**
Evidência: `pts/novo/page.tsx:1-7` (reexporta a página da supervisão); `supervisao/planos/novo/page.tsx:48-54` (lista todos os pacientes avaliados da clínica, não só os do terapeuta), `:134` (depois de salvar volta para `/terapeuta`, não para a ficha do paciente); rótulo "PTS" na barra (sigla); `plan-form.tsx` (1387 linhas) sem rascunho local (grep: nenhuma ocorrência de `draft/localStorage`).
Problema: formulário de planejamento denso para um menu primário do celular; paciente a escolher numa lista que não é a dele; "PTS" não é termo do operador em outros pontos (ele vê "Plano terapêutico" na ficha).
Correção: escolher paciente pela ficha (FIC-06), rótulo "Plano" na barra; rascunho local; redirecionar para a ficha.
Esforço: M. Risco: baixo.

---

## 3. Achados transversais do módulo

**TRV-01 | P2 | Efeito Zeigarnik, Lei de Similaridade**
Evidência: `terapeuta-bottom-nav.tsx:14-18` (o item "Pendências" foi removido; hoje nenhum item tem contador), `:37-40` (ícones emoji 📅 e 🗓 quase idênticos), `:132` (rótulos de 11 px).
Problema: evolução pendente não aparece na navegação; o terapeuta só descobre abrindo Hoje.
Correção: contador no item Hoje (ou Prontuário); ícones de um só conjunto; rótulo ≥ 12 px.
Esforço: S. Risco: baixo.

**TRV-02 | P2 | Lei de Jakob (orientação)**
Evidência: `terapeuta-bottom-nav.tsx:55` (qualquer `/terapeuta/evolucao` acende "Hoje", mesmo entrando por Agenda ou Prontuário), `:59-61` (`/terapeuta/paciente/*` acende "Prontuário", mesmo entrando por Pacientes), métricas e repasse sem item ativo.
Correção: lembrar a origem (`?voltar=`) ou fundir Pacientes e Prontuário; item "Mais" para métricas e repasse.
Esforço: S a M. Risco: baixo.

**TRV-03 | P2 | Lei de Jakob, vocabulário**
Evidência: títulos e rótulos diferentes para o mesmo lugar: "Prontuário" (menu), "Prontuário & Auditoria" (`prontuario/page.tsx:75`, `page.tsx:253`, `ficha:276`), "Agenda" × "Minha agenda" × "Hoje" (barra da agenda); "Minhas Métricas" × "Evolução/ABA" × "Coleta ABA & Tentativas"; "Voltar", "← Hoje", "← Prontuário de X", "Voltar para a sessão".
Correção: um nome por lugar; um padrão de voltar.
Esforço: S. Risco: baixo.

**TRV-04 | P2 | Lei de Jakob, controle do usuário**
Evidência: o módulo não usa `ModuleHeader`/`UserMenu` (grep em `app/terapeuta`: nenhum); `components/auth-status.tsx:35` (barra com "Sair" e troca de papel só para gestor).
Problema: o terapeuta não tem "Sair", "Meu perfil" nem "Alterar PIN" em nenhuma tela; o único logout é o corte diário das 19h. Em aparelho compartilhado ou celular pessoal é risco de dado de saúde.
Correção: menu de usuário no cabeçalho de Hoje com Sair e Alterar PIN.
Esforço: S. Risco: baixo.

**TRV-05 | P1 | Perda de dados, tolerância a rede**
Evidência: sem rascunho local em `adl-assessment-form.tsx` (ver `:100-111`, só salva no servidor ao tocar), `proc-assessment-form.tsx`, `socially-savvy/assessment-form.tsx` (110 itens), `anamnese-form.tsx` (~18 campos longos), `protocol-assessment-panel.tsx`, `report-editor.tsx`, `bonding-form.tsx`, `plan-form.tsx` (grep em todos: sem `saveDraft`/`localStorage`); só a evolução usa `lib/offline-draft.ts`.
Problema: o princípio "tolerante a rede ruim" vale para um formulário entre dez. Trocar de app, perder o sinal ou o corte das 19h perde dezenas de respostas.
Correção: generalizar `lib/offline-draft.ts` num hook `useDraft(key)` e aplicar nesses formulários.
Esforço: M. Risco: baixo.

**TRV-06 | P2 | Lei de Fitts**
Evidência: alvos menores que 44 px fora de `.btn`/`.input` (a regra `@media (pointer: coarse)` de `globals.css:305-316` só cobre `button, .btn, .input, .seg-*`; não cobre links nem `label`): chips de intervenção (~26 px, `intervention-logger.tsx:90`), chips do ABC (`abc-logger.tsx:105`, `text-[10px]`), rótulos de comportamento (~40 px, `evolution-form.tsx:724`), filtro de notas (`patient-tabs.tsx:260-268`), campos do painel ABA (~30 px, `trial-data-panel.tsx:143,158`), atalhos de texto da Hoje (~20 px, `page.tsx:245`), tag de status de 10 px (`week-agenda.tsx:96`), `md:min-h-11` só a partir de 768 px (`report-editor.tsx:184,200`; `report-generator.tsx:342,371`; `bonding-form.tsx:7`).
Correção: criar `.touch-target-min` e aplicar nos itens listados; trocar `md:min-h-11` por mínimo sempre.
Esforço: M. Risco: baixo.

**TRV-07 | P2 | Efeito Zeigarnik, Lei de Jakob**
Evidência: o estado "sessão sem evolução" aparece em sete lugares (banner Hoje, lista Hoje, Agenda dia, ficha aba Evolução, etc.), com rótulos distintos ("Evoluções pendentes", "Registrar evolução", "Evoluir", "🎤 Registrar", "sessões aguardando evolução").
Correção: um único componente `PendingEvolutionRow` com rótulo "Escrever evolução", reutilizado.
Esforço: M. Risco: baixo.

**TRV-08 | P3 | Acessibilidade**
Evidência: títulos `h6` como visuais (`page.tsx:239`, `patient-tabs.tsx:142`), `role="tab"` em links (`agenda-toolbar.tsx:51-69`), `main` aninhado (`ficha`), foco: os botões de segmento `.seg-opt` com `input.sr-only` dependem de `:has()` (`globals.css:500-508`).
Esforço: S. Risco: baixo.

**TRV-09 | P3 | Vocabulário do operador**
Evidência: "Append-only" (`patient-tabs.tsx:256`, `evolution-form.tsx:515-516`), "Trilha LGPD", "Versionamento" (`auditoria-panel.tsx:41-49`), "Módulos Assistenciais/Competência" (`repasse`), "Gemini" (`voice-evolution-recorder.tsx:296`), "Ainda não calculado nesta versão do sistema" (`metricas/page.tsx:17`), "PTS" na barra.
Esforço: S. Risco: baixo.

---

## 4. O que já está bom (curto)

- Evolução append-only de ponta a ponta (policy, action, histórico, justificativa obrigatória).
- Rascunho local automático da evolução, indicador "Salvo apenas no dispositivo" e aviso de assinatura pendente.
- Metas pré-marcadas com as da sessão anterior e resultado em 4 níveis (Tesler: o sistema sabe o óbvio).
- Barra inferior com 4 a 5 itens (Lei de Miller), alvo de 48 px, estado ativo por `pathname` e `Link` com prefetch.
- Cartão "Agora" com uma ação primária por estado e botões de 48 px.
- Ações do formulário de evolução na barra fixa inferior, dentro da zona do polegar, com `safe-area`.
- Fono ADL/PROC: opções grandes, totais em tempo real, atalhos por faixa etária.
- Estados vazios em linguagem do operador na maioria das listas.

---

## 5. Lacunas (o que NÃO foi auditado e por quê)

- Nenhuma execução real: sem navegador, sem rede simulada, sem iOS/Android. Tudo que depende de comportamento do Next/React em runtime está marcado "a confirmar": reset do `<form action>` (SUB-03, SUB-06), bloqueio de pop-up (SUB-02), retorno pós-login (EVO-11), limite de 1000 linhas (HOJ-06, PAC-01), duplicação de 1ª avaliação em pendências (HOJ-12).
- `app/supervisao/planos/novo/plan-form.tsx` (1387 linhas) e `pts-calendar-view`: só li o wrapper e a página; a usabilidade do formulário de PTS no celular não foi avaliada.
- `components/protocol-assessment-panel.tsx` (324 linhas), `proc-assessment-form.tsx`, `socially-savvy/assessment-form.tsx`, `anamnese-panel.tsx`: apenas varredura por rascunho/ação; não li item a item.
- `lib/patient-timeline.ts`, `lib/patient-dossier.ts`, `lib/bonus-progress.ts`, `BonusProgressCard` (li só o início), `components/prontuario/protocol-assessment-dialog.tsx`, `document-upload-form.tsx`, `documents-table.tsx`: não lidos por inteiro.
- Rota `app/api/aba/session-note-voice/route.ts` (backend do ditado): não lida; a avaliação do ditado é só da interface.
- Políticas RLS e migrations: lidas apenas por grep para confirmar append-only; não validei o comportamento do trigger de `appointments` na transição para `realizada`.
- Contraste AA: não medi as cores renderizadas, apenas observei usos de opacidade e tamanhos de fonte; o tema do Tailwind/`globals.css` não foi auditado.
- Telas fora de `app/terapeuta` que o terapeuta alcança: `/recepcao/pacientes/[id]/documents-actions` (usada no PDF do convênio) e o chat do módulo de recepção.

---

## 6. Top 10 por impacto/esforço

1. **HOJ-01** (P0, M): botão "Registrar evolução" em atendimento cai em "ainda não foi realizada"; ABA e intervenções impossíveis durante a sessão. Corrigir o fluxo ou o rótulo.
2. **EVO-01** (P0, S): "IA" é um modelo de frase que insere conclusão positiva fixa no prontuário e apaga o texto digitado; remover a conclusão e confirmar a substituição.
3. **HOJ-03** (P1, S): depois do check-out, levar direto à evolução (hoje some do cartão, sem CTA).
4. **EVO-02** (P1, S): carregar `initialLogs` de intervenções e ABC; hoje recarregar bloqueia "Continuar" e duplica registros.
5. **HOJ-04** (P1, S): `<a href>` para `Link` e alvos de 44 px nos atalhos e pendências (reload completo e falha offline no caminho mais usado).
6. **HOJ-05** (P1, S): o toast de chegada deve atualizar a lista e mostrar nome e botão "Iniciar".
7. **EVO-03** (P1, M): tornar a intervenção opcional, abrir em "presença + metas" e levar os chips a 44 px (meta dos 2 minutos).
8. **REP-01 / MET-01** (P1, S a M): comparativo (vs mês anterior, vs meta) em repasse e métricas, conforme regra 1 do AGENTS.md.
9. **SUB-04** (P2, S): `pb-24 md:pb-10` no layout do módulo corrige o rodapé de nove telas cobertas pela barra.
10. **TRV-05** (P1, M): rascunho local reutilizável (`useDraft`) em fono, Socially Savvy, anamnese, vínculo, relatório, PTS; mais **EVO-05** (L) para fila offline real de tentativas ABA, áudio e mídia.

---

## Contagem de achados

- P0: 2 (HOJ-01, EVO-01)
- P1: 17 (HOJ-02 a HOJ-06, PAC-01, FIC-01, FIC-02, EVO-02 a EVO-06, SUB-01, MET-01, REP-01, TRV-05)
- P2: 40 (HOJ-07 a HOJ-13, AGE-01 a AGE-04, PAC-02, PAC-03, PRO-01, FIC-03 a FIC-06, EVO-07 a EVO-11, SUB-02 a SUB-06, MET-02, MET-03, REP-02 a REP-04, PTS-01, TRV-01 a TRV-04, TRV-06, TRV-07)
- P3: 11 (HOJ-14, HOJ-15, AGE-05, AGE-06, PAC-04, PRO-02, FIC-07, EVO-12, SUB-07, TRV-08, TRV-09)
- Total: 70
