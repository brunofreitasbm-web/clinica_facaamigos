# Auditoria UX: Recepção

Escopo: `app/recepcao/**`, `components/recepcao-nav.tsx`, `components/module-header.tsx`, o que `app/recepcao/layout.tsx` monta (widget de bonificação, impressão automática da lista da porta) e componentes compartilhados usados pelas telas (`src/components/Reception/Chat/*`, `components/patient-formatted-display.tsx`, `components/prontuario/patient-tabs.tsx`, `components/anamnesis-pending-badge.tsx`).

Método: leitura integral das telas citadas (código, sem executar o sistema). Tudo que está abaixo tem arquivo:linha. Onde a conclusão depende de comportamento de navegador ou de banco que não pude observar, está marcado como "confiança média". Contexto já conhecido e NÃO recontado como achado novo: faixa "Precisa de você agora" e falta em 2 cliques (`precisa-de-voce.tsx`, `falta-quick-panel.tsx`); `docs/auditoria-fila-vs-autorizacoes.md` (14/11/2026), que já cobre paridade Fila x Autorizações (robô do portal, desfazer autorização, migration do "plano negou").

Resumo numérico: 56 achados. P0: 1 · P1: 14 · P2: 30 · P3: 11.

---

## 1. Mapa de menus

Barra do módulo (`components/recepcao-nav.tsx:13-23`), no desktop (`lg+`) é uma linha de 7 itens; abaixo de `lg` vira uma segunda faixa de "pílulas" que quebra em várias linhas (`components/module-header.tsx:215-244`).

| Item | Rota | Tela(s) | Tarefa do operador | Cliques da tarefa principal (a partir da home) |
|---|---|---|---|---|
| Logo "Recepção" | `/recepcao` | `app/recepcao/page.tsx` | Voltar à agenda | 1 |
| Agenda do dia | `/recepcao` (+ `/recepcao/agenda` redireciona) | `page.tsx` + `today-agenda-list.tsx` + `precisa-de-voce.tsx` + 4 cards laterais | Ver o dia, registrar chegada, falta, vincular guia | Chegada: 1 (2 se for 1ª avaliação, via modal). Falta: 2. Vincular guia existente: 3. Cadastrar guia: 2 + formulário |
| Chegadas | `/recepcao/chegadas` | `chegadas/page.tsx`, `chegadas-list.tsx` | Confirmar quem chegou pelo QR da entrada | 2 (menu ou botão da faixa + Confirmar); ou 0 cliques, pois há auto-confirmação em 18 s |
| Pacientes | `/recepcao/pacientes` | `pacientes/page.tsx`, `patient-list-client.tsx`, ficha `pacientes/[id]/page.tsx`, `gestao/`, `rede-externa/` | Achar um paciente, abrir ficha, editar cadastro | Abrir ficha: 3 (menu, digitar na busca, clicar na linha). Editar: 4 |
| Fila de entrada | `/recepcao/fila` (+ `/recepcao/pre-cadastros/*` marcam este item) | `fila/page.tsx`, `fila-workspace.tsx`, `fila-detail.tsx`, `fila-next-step.tsx`, modal `@modal/(.)pre-cadastros/[draftId]` | Dar o próximo passo de cada família nova do WhatsApp | 3 (faixa/menu, escolher família, botão do próximo passo) + 1 de conferência quando manda WhatsApp |
| Autorizações | `/recepcao/a-autorizar` | `a-autorizar/page.tsx`, `authorizations-workspace.tsx` (1152 linhas), `draft-intake-card.tsx`, `draft-pipeline.tsx` | Mesma tarefa da Fila (mesma população, mesmas ações) | 3 a 4 |
| Chat | `/recepcao/atendimento` | `atendimento/page.tsx`, `atendimento-shell.tsx`, `ConversationList`, `ChatWindow`, `ChatActions`, painéis `lead-context-panel.tsx` / `patient-context-panel.tsx`, aba Chatbot (só gestor/supervisor) | Responder famílias no WhatsApp, assumir, encerrar | Responder: 2 (menu + conversa já vem selecionada + digitar). Encerrar: 3 (Encerrar, desfecho, confirmar) |
| Documentos | `/recepcao/documentos` | `documentos/page.tsx`, `documentos-manager.tsx` (971 linhas), `patient-search.tsx` | Emitir declaração/atestado com timbre | 4+ (menu, modelo, buscar e escolher paciente, conferir ~8 campos, imprimir) |
| Menu pessoal (nome do operador) > Minha bonificação | `/recepcao/metricas` | `metricas/page.tsx`, `BonusProgressCard` | Acompanhar bonificação | 2 (menu pessoal + link) ou 1 (widget flutuante) |

Botões e atalhos globais:

| Elemento | Onde monta | O que faz |
|---|---|---|
| "+ Nova sessão" (Ctrl+N) | só na home, `page.tsx:496`, `nova-sessao-dialog.tsx:152-166` | Agendar sessão. Também abre por `/recepcao#nova-sessao[:id]` |
| "+ Novo paciente" (chamado no brief de "Interessado rápido") | home `page.tsx:506`, lista de Pacientes `patient-list-client.tsx:433`, cartão "sem agendamento" em Chegadas `chegadas-list.tsx:414`, Chat via Alt+C `ChatLayout.tsx:329-369` | Cria paciente com status "interessado" |
| Widget "Bonificação" (canto inferior direito) | `layout.tsx:98`, `components/bonus-floating-widget.tsx:95-113` | Placar com tendência, polling de 3 min, link para `/recepcao/metricas` |
| Impressão automática da lista da porta | `layout.tsx:99`, `components/door-list-auto-print.tsx:19-56` | Iframe oculto imprime `/recepcao/lista-porta?auto=1` na 1ª abertura do dia |
| Atalhos de Chat | `ChatLayout.tsx:328-357`, `ConversationList.tsx:39-41,246-256` | Alt+A assumir, Alt+↑/↓ navegar, Alt+C cadastrar, Ctrl+K busca, `/` respostas rápidas |
| Atalhos de Pacientes e Autorizações | `patient-list-client.tsx:287`, `authorizations-workspace.tsx:462` | Ctrl+K e `/` focam a busca |

Telas do módulo sem item de menu:

| Rota | Situação |
|---|---|
| `/recepcao/pacientes/[id]` (ficha), `/gestao`, `/rede-externa` | Ficha acessada pela lista. `/gestao` por "Editar" e "Planos de Saúde & Cobranças". `/rede-externa` não tem nenhum link no código (órfã) |
| `/recepcao/pre-cadastros/[draftId]` | Conferência de cadastro; abre como modal sobre a Fila (rota interceptada) ou página cheia |
| `/recepcao/pre-cadastros`, `/recepcao/pacientes/pendencias`, `/recepcao/agenda` | Só redirects (`pre-cadastros/page.tsx:24`, `pendencias/page.tsx:312-328`, `agenda/page.tsx:6-13`) |
| `/recepcao/pacientes/novo` | Wrapper do mesmo diálogo, mantido para links externos de Gestão (`pacientes/novo/page.tsx`) |
| `/recepcao/whatsapp` | Órfã: nenhum link no código (grep) |
| `/recepcao/emergencias` | Só tem link no menu da Supervisão (`components/supervisao-header.tsx:28`), mas renderiza dentro do layout da Recepção |
| `/recepcao/lista-porta` | Rota de impressão; só é chamada pelo iframe automático |
| `/recepcao/metricas` | Menu pessoal e widget |

---

## 2. Achados por item de menu (na ordem do menu)

### 2.1 Agenda do dia (home)

Resumo: a home já traz trabalho (faixa "Precisa de você agora"), mas não é ao vivo, perdeu ações importantes na simplificação da linha (reagendar, contato do responsável), e a barra lateral e a faixa contam a mesma coisa de formas diferentes.

**REC-01 · P1 · A home e o menu não são ao vivo: a chegada por QR só soa e aparece na tela Chegadas**
- Leis: Limiar de Doherty, Efeito Zeigarnik, Princípio de Pareto.
- Evidência: o som e o realtime existem só dentro de `chegadas/chegadas-list.tsx:218-238` (chime) e `:317-370` (canal realtime + poll de 60 s). O layout calcula o selo de Chegadas uma vez por navegação (`layout.tsx:78-91`). A home não tem polling nem realtime (grep de `setInterval`/`channel(` em `page.tsx` e `today-agenda-list.tsx`: nada). `RealtimeAppointmentToast` só está montado em `app/terapeuta/page.tsx` e na própria tela Chegadas (grep).
- Problema: uma criança que escaneia o QR enquanto a recepcionista está na agenda ou no Chat não gera som, toast nem atualização do selo ou da faixa até ela navegar. O comentário do próprio código diz que o som "é requisito" (`chegadas-list.tsx:219-221`). Além disso o `AudioContext` é criado sem gesto do usuário (`:223-225`), o que em navegadores com política de autoplay costuma ficar mudo (confiança média). O mesmo vale para os "Em atendimento" e "Salas agora" da home, que só mudam com F5 ou navegação.
- Correção: mover o canal realtime de `checkin_requests` (e `appointments` do dia) para um componente do `layout.tsx` (ex.: `RecepcaoLive`), que faz `router.refresh()` com debounce, toca o chime e mostra toast "Fulano chegou, confirmar" com botão de ação, em qualquer tela. Primeiro clique do operador na página libera o áudio. Poll de 60 s só com aba visível.
- Esforço: M. Risco: baixo a médio (refresh do layout re-executa muitas queries; ver REC-14 e REC-T05, resolver juntos).

**REC-02 · P1 · "Reagendar" sumiu da linha da agenda e "Remarcada" no painel de falta só muda o status**
- Leis: Lei de Tesler, Ação onde o dado está, Efeito Zeigarnik.
- Evidência: `today-agenda-list.tsx:28` importa `ReagendamentoDialog` e nunca o renderiza (grep: só o import e a definição em `agenda/reagendamento-dialog.tsx:11`). `canReschedule` é calculado e não usado (`today-agenda-list.tsx:692`). O painel de falta oferece "Remarcada" como status (`lib/appointment-cancel-reasons.ts:46-59`, `falta-quick-panel.tsx:92-105`) e `markMissedOrCancelled` só grava status e motivo (`agenda/session-actions.ts:246-262`); a sessão sai da lista do dia (`DAY_LIST_HIDDEN_STATUSES`, `appointment-cancel-reasons.ts:60`).
- Problema: o primeiro vazamento de receita do produto é "falta sem recuperação" (PRODUCT.md). Hoje, marcar "Remarcada" faz a sessão desaparecer sem novo horário, e não existe botão de reagendar em lugar nenhum da recepção. O operador precisa criar outra sessão do zero em "+ Nova sessão".
- Correção: após registrar falta/cancelamento/remarcada, mostrar na própria linha "Remarcar agora" com os horários livres já calculados por `getAvailableSlots`; renderizar `ReagendamentoDialog` no menu "⋯" da linha enquanto a sessão está ativa; "Remarcada" só confirma depois que há novo horário.
- Esforço: M. Risco: baixo (componente e ação já existem).

**REC-03 · P1 · "Chegou" na agenda não fecha a chegada do QR, e depois "Confirmar check-in" dá erro**
- Leis: Região comum, Lei de Tesler, Erro e bloqueio dizem o que fazer.
- Evidência: `checkIn()` só grava `checkin_at` (`agenda/session-actions.ts:104-141`). `confirmCheckinRequest()` chama `checkIn()` e, se ele falha, devolve o erro sem marcar a chegada como confirmada (`chegadas/actions.ts:58-81`); com check-in já feito o retorno é "Check-in já registrado." (`session-actions.ts:119-121`). A linha da agenda não mostra que existe chegada pelo QR para aquela sessão.
- Problema: confirma (b) com consequência. Se a recepção vê a criança e clica "Chegou" na linha, a chegada pelo QR continua "aguardando": o selo do menu, a faixa "Precisa de você" e "Outras pendências" seguem contando, e "Confirmar check-in" na tela Chegadas falha. A saída é "Descartar" com motivo "Já foi atendido de outra forma", que gera dado ruim.
- Correção: `checkIn()` resolve qualquer `checkin_requests` aberto da mesma sessão (status "confirmado", mesma resolução); `confirmCheckinRequest` trata "já registrado" como sucesso; a linha ganha selo "Chegou pelo QR · confirmar" para confirmar ali mesmo.
- Esforço: S a M. Risco: médio (toca a regra de check-in e cupom; cobrir com teste).

**REC-04 · P2 · A linha da agenda concentra controles demais e duplica o fluxo de guia** (confirma o achado aberto (c))
- Leis: Lei de Hick, Lei de Miller, Efeito Von Restorff, Lei de Fitts.
- Evidência: em `today-agenda-list.tsx:753-962` uma linha pode ter: selo de status (`:778`), selo de guia em 3 variantes ("Guia Vinculada", "Provisória (+ Guia)", "+ Guia", `:785-811`), "Falta automática · desfazer" (`:814-823`), "Vincular guia" com select inline (`:848-903`), "Chegou" (`:913-926`), "Faltou / cancelou" (`:927-936`), reimprimir cupom (`:939-950`) e painéis inline (falta, guia). "+ Guia" abre `GuiaQuickActionModal` (lista, vincula e cadastra, `guia-quick-action-modal.tsx`) e "Vincular guia" faz só uma parte do mesmo trabalho (vincular guia existente) por outro caminho.
- Problema: dois caminhos para vincular guia; "+ Guia" aparece em toda sessão sem guia, mesmo quando há exatamente uma guia ativa que o sistema poderia vincular sozinho; "Chegou" (primária) e "Faltou / cancelou" (texto pontilhado de 11 px) estão em colunas diferentes do selo de estado. O selo de status e o de guia competem em cor.
- Correção: um único chip de guia ("Guia 3/10 até 12/12", "Sem guia: vincular", "Provisória: anexar guia") que abre um só painel; com guia ativa única e compatível, vincular automático na criação da sessão (o backend já conhece o procedimento); agrupar "Faltou / cancelou", reimprimir e "Falta automática" num "⋯"; deixar visível só "Chegou". Alvo mínimo de 38 px já existe no botão primário, estender ao "Faltou".
- Esforço: M. Risco: médio.

**REC-05 · P2 · O nome do paciente na linha parece link e não é; o contato do responsável foi removido**
- Leis: Lei de Jakob, Lei de Fitts, Ação onde o dado está.
- Evidência: `components/patient-formatted-display.tsx:331` aplica `hover:text-chart` ao nome, sem `Link`. Em `today-agenda-list.tsx:681` o estado `showGuardians` é declarado e nunca usado; `guardians` só serve para a busca (`:195-197`), embora `page.tsx:178-179` ainda fale em "ícone de contato".
- Problema: para ver guia, documentos ou telefone do responsável de quem está atrasado, a recepção sai da agenda, vai a Pacientes, busca de novo e abre a ficha (3 cliques mais digitação).
- Correção: nome vira `Link` para a ficha; ao lado do selo "Aguardando" de sessão atrasada, ícone de telefone/WhatsApp do responsável principal.
- Esforço: S. Risco: baixo.

**REC-06 · P2 · Onze controles antes da lista e nenhum filtro para quem está atrasado**
- Leis: Lei de Hick, Princípio de Pareto, Efeito da posição serial.
- Evidência: 4 chips (`today-agenda-list.tsx:231-236`), busca, 3 modos de agrupamento (`:315-333`), "Filtros avançados" com 4 sub-blocos (Terapeutas, Especialidades, Status da guia, Turno, `:338-457`). Nenhum filtro mostra "horário passou e o paciente não chegou" (estado `aguardando` com `startsAt` vencido); "Faltas" só conta `falta_familia` (`:176`). O filtro de turno usa `new Date(s.startsAt).getHours()` do navegador, não o fuso da clínica (`:210`). A grade "Por sala" é fixa de 08h a 19h (`:75`), então sessão fora disso não aparece nessa visão.
- Problema: o filtro mais útil para a recepção ("quem deveria estar aqui e não chegou") não existe, e a linha de sessão atrasada é idêntica à de sessão futura (sem marcador de "agora", sem rolagem para o horário corrente).
- Correção: chips "A chegar (n, atrasados em vermelho) · Na clínica · Concluídas · Faltas"; rolar para o horário atual ao abrir; marca "agora" na lista; derivar turno e grade por sala dos horários reais com o fuso da clínica; manter avançados recolhidos.
- Esforço: M. Risco: baixo.

**REC-07 · P2 · A coluna lateral tem 4 cards e só 1 leva a uma decisão** (confirma o achado aberto (d))
- Leis: Carga cognitiva, Efeito Von Restorff, Lei da Proximidade.
- Evidência: `page.tsx:529-621`. "Guias vencendo" é acionável (`expiring-guides-card.tsx`, botão de WhatsApp com registro de contato). "Outras pendências" (`:534-570`) repete a 4ª linha da faixa (`:515`) com cinco itens sem ação. "Salas agora" (`:573-604`) duplica "Por sala" e "Em atendimento" da própria lista. "Rastro do dia" (`:607-620`, `lib/agenda-trail.ts:26-37`) é derivado dos timestamps das mesmas sessões e ecoa o estado já visível em cada linha. Dois deles ainda têm `max-h`/scroll próprios.
- Problema: três cards sem decisão competem em peso visual com o único que exige ação; "Guias vencendo" aparece também como linha da faixa ("Renovar", `lib/recepcao-attention-pure.ts:42-48`), ou seja, duas entradas para o mesmo trabalho.
- Correção: manter só "Guias vencendo"; "Salas agora" vira um chip no cabeçalho da lista (ou o modo "Por sala"); mover "Rastro do dia" para um "Ver atividade do dia" no "⋯"; remover "Outras pendências" e fazer a 4ª linha da faixa levar à lista real (ver REC-08 e REC-09).
- Esforço: S. Risco: baixo.

**REC-08 · P1 · A 4ª linha da faixa mente no rótulo e o botão "Resolver" cai numa lista genérica**
- Leis: Erro e bloqueio dizem o que fazer, Lei de Tesler, Efeito Zeigarnik.
- Evidência: `page.tsx:381-383` e `:515` contam como "pendências" tudo da fila exceto guias e fila de autorização. Isso inclui chegada não confirmada (`lib/reception-queue.ts:1642-1651`, já contada na 1ª linha da faixa), evolução atrasada (`:1545-1551`, trabalho do terapeuta, com `href` para a própria `/recepcao`), falta sem motivo, remarcação e renovação solicitadas. O rótulo é "pendência de cadastro" (`lib/recepcao-attention-pure.ts:50-52`). "Resolver" aponta para `/recepcao/pacientes/pendencias` (`:54`), que só redireciona para a lista de Pacientes (`pendencias/page.tsx:327`). O mesmo link morto está em `a-autorizar/page.tsx:89-95` ("Ver fila geral de pendências").
- Problema: o número está inflado e mal nomeado, e quem clica no botão primário da faixa não encontra nenhuma pendência (ver REC-09).
- Correção: separar por categoria com verbo próprio ("3 faltas sem motivo: Registrar", "1 renovação pedida: Autorizar"), excluir chegadas e evolução atrasada (essa pertence ao terapeuta), e apontar cada uma ao painel que resolve (REC-09).
- Esforço: M. Risco: baixo.

**REC-09 · P0 · As pendências operacionais perderam a tela: o painel de resolução só abre por um parâmetro que nada gera**
- Leis: Lei de Tesler, Efeito Zeigarnik, Ação onde o dado está.
- Evidência: a navegação diz que "as pendências viraram pílulas na lista de Pacientes" (`recepcao-nav.tsx:26-28`, `pendencias/page.tsx:304-306`). Na lista, porém, a linha nunca renderiza as pílulas: `PatientRow.pills` existe (`patient-list-client.tsx:41`) e `PillChip` é exportado (`patient-pendencies-dialog.tsx:24`), mas só `PatientPendenciesDialog` o usa (grep: nenhum uso em linhas). O diálogo só abre com `?abrir=<id>` (`patient-list-client.tsx:264`), e esse parâmetro só é gerado por `pendencias/page.tsx:28`, que só roda via `?lead=` vindo do Chat. Os botões que resolvem (`ResolveAutoFaltaButton`, `AuthorizeRenewalButton`, `ResolveRenewalRequestButton`) só são renderizados em `pacientes/pendencias/queue-items.tsx:236-250`, montados como painéis desse diálogo (`pacientes/page.tsx:63-92`). O `href` dos itens da home vai para a ficha (`reception-queue.ts:1564,1590,1604,1618`), onde esses painéis não existem. A página ainda faz 4 consultas pesadas por carga para montar pílulas e painéis que ninguém vê.
- Problema: "falta sem motivo" (dado de BI e bonificação), "renovação solicitada" (guia, dinheiro), "remarcação solicitada" e "documento vencido" não têm caminho de resolução acessível a partir do menu ou da home. Sem executar o sistema, o risco é que na prática essas filas fiquem sem dono; este é o achado mais grave do módulo.
- Correção: (1) renderizar `PillChip` na linha da lista de Pacientes e um filtro "Com pendência" (e ordenar por urgência); (2) trocar os `href` da home e da faixa por `/recepcao/pacientes?abrir=<patientId>`; (3) para "falta sem motivo", resolver na própria linha da agenda (já mostra "Falta automática · desfazer", falta o motivo).
- Esforço: S para (1) e (2), M para (3). Risco: baixo.

**REC-10 · P1 · "+ Novo paciente" cria um interessado que depois não aparece em lugar nenhum e pode engolir um erro**
- Leis: Feedback do sistema (Doherty), Vocabulário do operador, Efeito Zeigarnik.
- Evidência: o botão da home e da lista diz "Novo paciente" (`interessado-rapido-dialog.tsx:146,159`) mas grava `status: "interessado"` (`actions.ts:49-60`). Ao salvar, o diálogo faz `router.push("/recepcao/pacientes/pendencias")` (`interessado-rapido-dialog.tsx:127-129`), que redireciona para `/recepcao/pacientes`, cuja consulta exclui interessados (`pacientes/page.tsx:41`). Fila e Autorizações só listam rascunhos do WhatsApp (`lib/reception-queue.ts:1457-1461`). O interessado criado à mão só sobrevive como item "interessado sem retorno" em "Outras pendências", cujo link é o mesmo redirect (`reception-queue.ts:1571-1577`). Se o responsável falha ao gravar, `createInteressadoAction` devolve `success: true` com `error` (`actions.ts:78-89`) e o diálogo só trata `!res.success` (`interessado-rapido-dialog.tsx:100-103`), ou seja, descarta o aviso. Sem toast de confirmação no caminho comum.
- Problema: a recepcionista cadastra, o modal fecha, aterrissa numa lista sem o cadastro e sem mensagem. Também o nome na tela ("Novo paciente") difere do conceito do sistema ("interessado") e do da tela de Pacientes ("Interessados ficam em Autorizações", `pacientes/page.tsx:172`), que é uma tela que está saindo do menu.
- Correção: após salvar, toast "Fulano cadastrado como interessado" com botão "Abrir"; incluir interessados na lista de Pacientes (selo "Interessado") ou gerar item na Fila; tratar o `error` do retorno; renomear o botão para "+ Cadastro rápido" ou "+ Interessado"; Esc fecha; máscara de telefone (Postel).
- Esforço: M. Risco: baixo a médio.

**REC-11 · P2 · "Nova sessão": atalho que o navegador reserva, formulário que não usa o que o sistema sabe**
- Leis: Lei de Tesler, Lei de Postel, Lei de Jakob.
- Evidência: o atalho é Ctrl+N (`nova-sessao-dialog.tsx:125-137`, selo `kbd` em `:163`); Ctrl+N é reservado pelo Chrome/Edge para "nova janela" e normalmente não chega à página (confiança média; conferir no navegador da recepção). O diálogo lista todos os pacientes (`:84-88`, a home carrega todos, `page.tsx:69`), inclusive inativos, não pré-seleciona terapeuta, sala ou modalidade a partir da equipe do paciente (`patient_access`), e mostra a caixa "Marcar como provisória" sempre (`:399-408`) mesmo com guia vigente, enquanto o aviso já diz "sem guia". Rótulos sem `htmlFor` (`:192` e seguintes) e sem Esc ou foco preso (`:169-170`, backdrop só com clique). O estado vazio do dia aciona o botão com `document.querySelector('button[title="Agendar nova sessão (Ctrl+N)"]')` (`today-agenda-list.tsx:493`), frágil.
- Correção: trocar o atalho por uma tecla livre (ex.: `N` fora de campo, ou Alt+N); ordenar pacientes por uso recente e esconder inativos; pré-preencher terapeuta e sala pela equipe; "provisória" só aparece se `guide` for nulo; Esc e foco; expor o diálogo por contexto (evento ou estado elevado) em vez de `querySelector`.
- Esforço: M. Risco: baixo.

**REC-12 · P2 · Banner âmbar de anamnese: decisão que a recepção não pode tomar e link que ela não pode abrir**
- Leis: Carga cognitiva, Efeito Von Restorff, Erro e bloqueio dizem o que fazer.
- Evidência: `components/anamnesis-pending-badge.tsx:8-12` diz que a recepção só vê a contagem, "sem poder decidir"; o link é `/supervisao` (`:28`). `lib/roles.ts:71` permite à recepção apenas `/recepcao` e `/m/atendimento`; o comentário da ficha confirma "recepção não pode, o middleware manda de volta" (`pacientes/[id]/page.tsx`, bloco `canNavigateToSupervisao`). O banner usa `role="alert"` e fica acima da lista (`page.tsx:518`).
- Problema: é o elemento mais chamativo (âmbar, `role="alert"`) e não leva a nenhuma ação possível ao papel.
- Correção: remover da home da recepção (fica na Supervisão); se for necessário sinalizar, uma linha neutra sem link.
- Esforço: S. Risco: baixo.

**REC-13 · P2 · O painel de falta aceita combinações sem sentido e abre dentro de uma coluna de 130 px**
- Leis: Prevenção de erro, Lei de Hick, Lei da Proximidade.
- Evidência: motivos (`CANCEL_REASONS`, `appointment-cancel-reasons.ts:9-18`) independem do status (`NEGATIVE_STATUSES`, `:46-52`): é possível registrar "Falta da família" com "Terapeuta indisponível" ou "Cancelada pela clínica" com "Esquecimento". O servidor só valida que cada um está na sua lista (`session-actions.ts:213-218`). O painel é renderizado dentro da coluna de estado da linha (`today-agenda-list.tsx:753-755,825-840`, grade `72px 1fr 130px auto`), que tem 130 px.
- Problema: dado de motivo inconsistente (alimenta BI e bonificação) e painel apertado.
- Correção: filtrar os motivos pelo status escolhido (falta da família: doença, transporte, esquecimento, viagem, sem justificativa; cancelada pela clínica: terapeuta/sala/clínica fechada); abrir o painel como linha expandida sob a linha da sessão, na largura toda.
- Esforço: S. Risco: baixo.

**REC-14 · P2 · A home carrega e recalcula mais do que usa**
- Leis: Limiar de Doherty.
- Evidência: `getReceptionQueue` roda no layout (`layout.tsx:78`) e de novo na home (`page.tsx:380`); a home lê todos os pacientes (`:69`), todos os convênios dos pacientes e todas as autorizações ativas (`:263-281`) para o diálogo e o card de guias; `patient_tags` é consultado e passado como `tagsByPatient` (`:198-208`) a um componente que nunca o usa (`today-agenda-list.tsx:121,127`). Cada `router.refresh()` da tela Chegadas (poll de 60 s e realtime) reexecuta tudo isso (`chegadas-list.tsx:321-325` reconhece "dezenas de queries").
- Correção: contar badges por view/RPC leve ou `unstable_cache` com tag; buscar pacientes sob demanda no diálogo (autocompletar no servidor); remover o fetch de tags.
- Esforço: M. Risco: médio.

### 2.2 Chegadas

Resumo: é a única tela com realtime, som e auto-confirmação de 18 s, bem pensada para o caso feliz; os casos difíceis (sem agendamento, nome divergente) não têm saída, e a tela convive com a linha da agenda sem se falarem (REC-03).

**REC-20 · P1 · O cartão "sem agendamento" é um beco sem saída: as ações de vincular e lançar manualmente existem no servidor e não na tela**
- Leis: Lei de Tesler, Erro e bloqueio dizem o que fazer, Lei de Postel.
- Evidência: `chegadas/actions.ts:123-136` (`linkVisitorToPatient`) e `:144-170` (`createManualCheckinRequest`) não têm nenhum chamador (grep: só a definição). O cartão sem agendamento oferece "Novo paciente" (`chegadas-list.tsx:414`, formulário vazio, sem pré-preencher o nome e o nascimento já declarados em `:317-320`) ou "Descartar" (`:415-423`). O botão "Confirmar check-in" fica oculto para `isNoMatch` (`:403-413`). Nome divergente ou criança que veio em dia errado não pode ser ligada à sessão certa.
- Problema: a família está na porta com a criança e a recepção só consegue descartar ou cadastrar de novo (risco de duplicidade, regra 3 do AGENTS.md).
- Correção: no cartão, "Procurar paciente" (busca por nome e responsável) que chama `linkVisitorToPatient` e mostra as sessões de hoje do paciente; "Novo paciente" abre pré-preenchido com os dados declarados; botão "Lançar chegada" pelo `createManualCheckinRequest` na linha da agenda para quem não tem celular.
- Esforço: M. Risco: baixo a médio.

**REC-21 · P2 · Dica e ordenação se contradizem, e "chegou há N min" não anda**
- Leis: Lei de Jakob, Doherty.
- Evidência: o `HelpHint` diz "A chamada segue o horário agendado, não a ordem de chegada" (`chegadas/page.tsx:135`), mas a lista é ordenada por `created_at` ascendente (`:31`). `WaitMinutes` calcula uma vez na montagem (`chegadas-list.tsx:208-216`, `useEffect` com dependência só em `iso`) e a instância é mantida entre refreshes, então o minuto nunca avança.
- Correção: ordenar por horário da sessão (e destacar quem espera há mais de X minutos), ou corrigir a dica; reavaliar o minuto a cada 30 s com um único `setInterval` no pai.
- Esforço: S. Risco: baixo.

### 2.3 Pacientes (lista, ficha, gestão)

Resumo: lista rápida (busca com tokens e sem acento, CPF mascarado com "revelar" auditado), mas com ações destrutivas ao lado do "Editar", pendências invisíveis (REC-09) e uma ficha que mostra mais do que a recepção precisa.

**REC-30 · P1 · "Editar", "Inativar" e "Excluir" lado a lado em todas as linhas, e "Excluir" não é permitido ao papel**
- Leis: Lei de Fitts, Prevenção de erro, Lei de Hick.
- Evidência: `patient-list-client.tsx:190-229` (três ações de texto pequeno, adjacentes). `deletePatient` recusa quem não é gestor ("Apenas gestores podem excluir", `pacientes/actions.ts:151-153`); o modal chama "Excluir Paciente (Gestor)" (`patient-list-client.tsx:400`). Erros viram `alert()` do navegador (`:340-356`).
- Problema: a recepcionista vê um botão vermelho que sabe que não pode usar (ou tenta), e "Inativar" é um clique com uma confirmação simples, sem motivo (que o relatório de evasão precisaria).
- Correção: mostrar "Excluir" só ao gestor; mover "Inativar" e "Excluir" para "⋯" ou para a ficha; "Inativar" com motivo (lista curta: mudou, alta, evasão); trocar `alert()` por toast.
- Esforço: S. Risco: baixo.

**REC-31 · P2 · Três caminhos para editar o cadastro e duas telas que repetem a ficha**
- Leis: Lei de Hick, Região comum, Lei de Jakob.
- Evidência: edição rápida na ficha (`EditRegistrationButton`, `pacientes/[id]/page.tsx:~520-548`); "Editar" na lista leva a `/gestao` (`patient-list-client.tsx:196-203`); "Planos de Saúde & Cobranças" na ficha leva à mesma `/gestao` (`page.tsx:566-568`). `/gestao` repete "Visão geral", "Atendimentos" e "Documentos" (`gestao/patient-management-panel.tsx:20,102,175,203`) que a ficha já tem. O cabeçalho da lista manda "use Gestão > Cadastros" (`pacientes/page.tsx:172`), que é outro módulo.
- Correção: um só destino de edição (a ficha, com seções), `/gestao` vira seção "Planos e cobranças" da ficha ou aba; remover a frase sobre o módulo Gestão.
- Esforço: M. Risco: médio.

**REC-32 · P1 · A ficha entrega à recepção evolução clínica, coleta ABA, plano terapêutico e valores financeiros**
- Leis: Carga cognitiva, Princípio da informação progressiva; requisito de produto (papel define tela, privacidade).
- Evidência: `pacientes/[id]/page.tsx:658-661` passa `notes`, `billing` e `abaPrograms` a `PatientTabs`, sem filtrar por papel. `components/prontuario/patient-tabs.tsx:15-19,101` define as abas "Evolução", "Coleta ABA & Tentativas", "Plano terapêutico" e "Financeiro"; o comentário de `billing` diz "Ausente para papéis que não veem valores de convênio (PRD §4)" (`:88`) e a recepção o recebe. PRODUCT.md: "Protocolos clínicos licenciados nunca podem aparecer em tela de recepção" e "Dado clínico nunca vaza entre papéis". Se a RLS bloqueia no banco, as abas aparecem vazias; se não bloqueia, é exposição. Não pude verificar a RLS.
- Correção: para `role = recepcao`, não carregar nem renderizar notas, curvas ABA e plano; abas "Visão geral · Agenda · Documentos · Guias"; financeiro só com valores ocultos.
- Esforço: M. Risco: médio (é regra de papel; testar com os dois papéis).

**REC-33 · P2 · Ações primárias da ficha recarregam a página inteira e não usam o que o sistema sabe**
- Leis: Limiar de Doherty, Lei de Tesler.
- Evidência: "+ Nova sessão" e "Planos de Saúde & Cobranças" são `<a href>` simples (`page.tsx:566-570`), logo recarregam a home (com todas as consultas de REC-14) e depois abrem o diálogo via hash (`nova-sessao-dialog.tsx:103-122`); só o paciente é pré-selecionado. O passo "Montar grade" pede terapeuta, sala, data, hora e "Disciplina" como texto livre (`page.tsx:642`).
- Correção: usar `Link` e abrir o diálogo de nova sessão sobre a própria ficha (mesmo componente, estado elevado); pré-preencher terapeuta e sala pela equipe; "Disciplina" como lista do catálogo de tipos.
- Esforço: M. Risco: baixo.

**REC-34 · P2 · Hierarquia da ficha: o que a recepção mais consulta está espalhado**
- Leis: Efeito da posição serial, Lei da Proximidade.
- Evidência: o arquivo tem 779 linhas; coluna lateral com 4 blocos (identidade, dados clínicos, endereço, outros responsáveis), depois "Próximo passo", abas, faltas informadas, tabela "Guias" (`:~690`) e "Mural da família". A situação da guia (vigência, saldo) e a próxima sessão ficam abaixo das abas.
- Correção: faixa de situação no topo (guia vigente e saldo, próxima sessão, pendências abertas, telefone do responsável) e uma só ação primária contextual ("Vincular guia", "Agendar avaliação" etc.).
- Esforço: M. Risco: baixo.

**REC-35 · P2 · Interessado que abre a ficha cai em duas redirecionamentos e termina numa lista sem explicação**
- Evidência: `pacientes/[id]/page.tsx:71`, `gestao/page.tsx:48`, `rede-externa/page.tsx:39` redirecionam interessado para `/recepcao/pacientes/pendencias`, que redireciona para `/recepcao/pacientes` (`pendencias/page.tsx:327`). Item "cadastro incompleto" de interessado também aponta para lá (`reception-queue.ts:1538`).
- Correção: destino real (Fila ou diálogo de pendências com `?abrir`) e uma mensagem "Fulano ainda é interessado; resolva na Fila".
- Esforço: S. Risco: baixo.

**REC-36 · P3 · Lista de pacientes: virtualização e paginação sobrepostas e filtro de status incompleto**
- Evidência: `FixedSizeList` com altura fixa 600 px sobre uma página de 10/20/50 itens (`patient-list-client.tsx:520-528`); o filtro só tem "Todos, Ativo, Avaliação, Inativo" (`:~380-395`), mas a página trata também arquivado, alta, evadido (`pacientes/page.tsx:27`).
- Correção: paginar OU virtualizar (virtualizar com a lista completa), e incluir status reais ou um filtro "Com pendência" (ver REC-09).
- Esforço: S. Risco: baixo.

**REC-37 · P3 · "Rede externa" não tem entrada**
- Evidência: nenhum link para `/recepcao/pacientes/[id]/rede-externa` no código (grep); a página existe completa (`rede-externa/page.tsx`).
- Correção: link na ficha ("Rede externa: escola, médicos") ou remover a rota.
- Esforço: S. Risco: baixo.

### 2.4 Fila de entrada

Resumo: a melhor tela do módulo: abas por situação, um próximo passo por vez, conferência antes de WhatsApp, Desfazer de 8 s nas ações reversíveis, estados de carregamento e erro dedicados. Os achados são sobre o que cerca a tela.

**REC-40 · P2 · A lista não atualiza sozinha e o selo do menu só muda ao navegar**
- Leis: Efeito Zeigarnik, Limiar de Doherty.
- Evidência: `fila/page.tsx` é `force-dynamic` sem realtime nem poll; `fila-workspace.tsx` só chama `router.refresh()` depois de uma ação (`:43`). A família nova entra pelo WhatsApp a qualquer hora, e o contador do menu vem do layout (`layout.tsx:91`).
- Correção: o mesmo componente `RecepcaoLive` de REC-01 escuta `registration_drafts` e `twilio_conversations` e atualiza a fila e o selo.
- Esforço: M (junto com REC-01). Risco: baixo.

**REC-41 · P1 · Terminar um cadastro ou rejeitar tira o operador da Fila; rejeitar apaga arquivos sem motivo obrigatório**
- Leis: Efeito Zeigarnik, Prevenção de erro; AGENTS.md regra 3 (rejeição com motivo explícito de duplicidade).
- Evidência: "Confirmar cadastro" vai para a ficha (`pre-cadastros/[draftId]/draft-review-form.tsx:125-128`) e "Rejeitar" para `/recepcao/pacientes/pendencias` (`:329`, que vira a lista de Pacientes). "Rejeitar" abre um campo de texto livre e opcional (`:319-321`; `reject_reason: reason || null` em `pre-cadastros/actions.ts:434`) e remove do armazenamento os arquivos ainda não anexados (`actions.ts:421-430`), sem desfazer. A tela de conferência ainda tem o link "Voltar para a Fila de entrada" como texto pequeno (`[draftId]/page.tsx:46`).
- Problema: perde o contexto da fila (próxima família), e o descarte irreversível de documentos da família não pede o motivo estruturado que a regra 3 exige.
- Correção: motivos como chips ("Duplicidade (já há cadastro)", "Teste", "Não é paciente", "Outro"), obrigatório; para duplicidade, oferecer "Unificar" em vez de apagar; ao concluir ou rejeitar, `router.push("/recepcao/fila")` com a seleção na próxima família.
- Esforço: M. Risco: médio.

**REC-42 · P3 · Detalhes que quebram a fluidez da Fila**
- Evidência: sem atalhos de teclado nem foco na lista (Autorizações tem j/k, `/` e Ctrl+K, `authorizations-workspace.tsx:462-486`); "Dados para o portal" é jargão (`fila-detail.tsx:299`), assim como "Habilitar para agendamento" e "Conferir e cadastrar"; "sem dono" aparece em cada item (`fila-workspace.tsx:207`) sem atribuição automática a quem agiu primeiro.
- Correção: j/k e Enter; "Dados para o portal do plano" ou "Dados para a guia"; atribuir ao operador quando ele executa o primeiro passo.
- Esforço: S. Risco: baixo.

### 2.5 Autorizações

Resumo: confirma o achado aberto (a): mesma população e mesmas ações da Fila, mais pesada e com menos segurança.

**REC-50 · P1 · Duas telas para o mesmo trabalho, e na antiga o envio de WhatsApp irreversível sai sem conferência** (confirma (a))
- Leis: Lei de Jakob, Prevenção de erro, Lei de Hick, Efeito Von Restorff.
- Evidência: mesma fonte (`lib/fila/load-fila.ts:1-3,23-24` vs `a-autorizar/page.tsx:38`), mesmas ações (`fila-next-step.tsx:16-27` vs `draft-pipeline.tsx`). Na Fila, "Habilitar e enviar horários" pede conferência porque "não pode ser desfeito" (`fila-next-step.tsx:289-291`); em Autorizações, "Habilitar para agendamento" executa direto e dispara a oferta de horários da mesma forma (`draft-pipeline.tsx:716-722`). Autorizações ainda usa `window.confirm` (`:444`), emojis e gamificação ("🎯 Missão", "🏆 Missão cumprida", `:168,731`) que o `docs/auditoria-fila-vs-autorizacoes.md` já apontou. O arquivo `authorizations-workspace.tsx` tem 1152 linhas, três eixos de filtro (8 status, 7 pendências, encaminhamentos mais um por dono), 2 modos de visão e 4 quadros.
- Problema: o operador que cai em Autorizações (item ainda no menu, `recepcao-nav.tsx:20-21`) tem o comportamento menos seguro; a fila da mesma família aparece em dois menus.
- Correção: seguir o plano da auditoria de 14/11 (paridade mínima na Fila: robô do portal, "Pedir este", "Plano autorizou" em `send_guide`), depois remover o item do menu e redirecionar `/recepcao/a-autorizar` para `/recepcao/fila`. Enquanto isso, aplicar a mesma conferência ao botão de habilitar.
- Esforço: M a L. Risco: médio (decisão do dono sobre desfazer autorização, ver docs).

**REC-51 · P2 · A leitura por IA dispara só por parar em um item**
- Leis: Princípio da menor surpresa, custo.
- Evidência: `authorizations-workspace.tsx:131,445` (`READ_DELAY_MS = 700`): 700 ms de seleção chama `extractDraftOnDemand`, que usa IA e grava no rascunho. Navegar com j/k ou setas pela lista dispara uma chamada por item.
- Correção: disparar só com intenção (botão "Ler documentos") ou em lote no servidor (já roda pelo pg_cron a cada minuto, conforme `docs/auditoria-fila-vs-autorizacoes.md`).
- Esforço: S. Risco: baixo.

**REC-52 · P3 · Estado vazio de Autorizações leva a uma "fila geral de pendências" que não existe**
- Evidência: `a-autorizar/page.tsx:89-95` (mesmo redirect de REC-08).
- Correção: apontar para a Fila de entrada ou para a Agenda.
- Esforço: S. Risco: baixo.

### 2.6 Chat (Atendimento)

Resumo: tela madura: lista virtualizada, seções "Precisa de você / Em atendimento / Com o bot", Desfazer ao encerrar, ir para a próxima conversa, rascunho preservado, janela de 24 h do WhatsApp explicada, respostas rápidas por `/`, paginação do histórico. Os problemas estão fora da tela (sinal global) e na quantidade de controles de "quem responde".

**REC-60 · P1 · O trabalho mais sensível a tempo não aparece no menu nem na faixa da home**
- Leis: Efeito Zeigarnik, A tela traz o trabalho, Princípio de Pareto.
- Evidência: os selos do menu são só de Chegadas e Fila (`recepcao-nav.tsx:46`); a faixa de atenção só tem `chegadas`, `familias`, `guias`, `pendencias` (`lib/recepcao-attention-pure.ts:9`). A prioridade e o SLA das conversas (`pending_sla_minutes`, seção "Precisa de você", `lib/atendimento/sections-pure.ts`) só existem dentro da tela Chat, e o realtime de conversas só roda com o Chat aberto (`atendimento-shell.tsx:106-170`).
- Problema: família esperando resposta humana há 20 minutos é invisível para quem está na agenda; a faixa diz "Tudo em dia" (`precisa-de-voce.tsx:13-19`) mesmo com conversas aguardando.
- Correção: selo vermelho em "Chat" com o número de conversas em "Precisa de você" (usando a mesma função de seções) e nova linha na faixa "3 famílias esperam resposta: Abrir Chat"; alerta sonoro opcional por `RecepcaoLive` (REC-01).
- Esforço: M. Risco: baixo.

**REC-61 · P2 · Quatro controles para "quem está respondendo" e pausa do bot antes de saber se a mensagem saiu**
- Leis: Lei de Hick, Lei da Similaridade.
- Evidência: Assumir/Liberar, switch "Bot ativo / Humano no controle", "Enviar menu" (duas etapas) e Encerrar na mesma barra (`src/components/Reception/Chat/ChatActions.tsx:131-241`), mais o pause automático ao enviar (`chat-window.tsx:228` chama `onPatch({ isBotActive: false })` antes do `await` e não reverte se o envio falha, `:232-238`). Assumir também desliga o bot (`chat-header.tsx:376`).
- Correção: um só controle de 3 estados ("Com o bot · Comigo · Com Fulana") e pausa implícita ao digitar; reverter a pausa se o envio falha; "Enviar menu" dentro de "⋯".
- Esforço: M. Risco: médio.

**REC-62 · P2 · Encerrar é 3 passos e ainda tem Desfazer: confirmação redundante**
- Leis: Princípio de Pareto, Lei de Fitts.
- Evidência: Encerrar abre um modal (`ChatActions.tsx:174-188,245-322`) com 4 desfechos e observação, exige escolher um e confirmar; depois aparece o toast "Conversa encerrada · Desfazer" por 8 s (`atendimento-shell.tsx:268-275,441-454`).
- Correção: o botão abre um menu pequeno com os 4 desfechos (1 clique grava e encerra); Desfazer já protege do erro, então o modal de confirmação sai. O desfecho continua obrigatório (alimenta BI).
- Esforço: S. Risco: baixo.

**REC-63 · P2 · Cadastrar interessado a partir da conversa só existe como atalho Alt+C**
- Leis: Lei de Jakob, Efeito Von Restorff, Descoberta.
- Evidência: `ChatLayout.tsx:329-341,364-369` monta o diálogo com `hideTriggerButton`. A dica do atalho está só no `HelpHint` (`ConversationList.tsx:39-41`). O painel do lead oferece apenas "Resolver pendências", "Abrir na Fila" ou "Abrir ficha" (`lib/atendimento/case-summary-pure.ts:106,170-191`); para lead sem rascunho não há "Cadastrar".
- Correção: botão "Cadastrar interessado" no painel do lead quando não há caso aberto; manter Alt+C como atalho.
- Esforço: S. Risco: baixo.

**REC-64 · P2 · Abrir cada conversa de lead roda IA sem pedir**
- Evidência: `lead-context-panel.tsx:139-146`: extração automática por conversa ao montar o painel (custo e latência); navegar com Alt+↓ dispara uma chamada por conversa.
- Correção: executar ao parar 1,5 s ou sob demanda; reaproveitar o resultado gravado em `registration_drafts`.
- Esforço: S. Risco: baixo.

**REC-65 · P3 · Redundâncias de sinal**
- Evidência: "Janela fechada" aparece no cabeçalho (`atendimento/chat-header.tsx:470-477`), no aviso do campo (`MessageInput.tsx:193-201`) e no botão "Enviar menu" desabilitado (`ChatActions.tsx:194`); o filtro "Aguardando" (`SubNavBadges.tsx:12-19`) e a seção "Precisa de você" medem quase a mesma coisa; seis filtros mais busca mais seções.
- Correção: um só indicador por conceito (aviso no campo), filtros "Minhas / Precisam de mim / Todas / Encerradas".
- Esforço: S. Risco: baixo.

**REC-66 · P3 · Administração do chatbot dentro do Chat operacional**
- Evidência: aba "Chatbot" (FAQ, modelos, configurações, KPIs) no mesmo shell para supervisor e gestor (`atendimento-shell.tsx:299-318`); a página lê todas as conversas e mensagens do dia para as estatísticas (`atendimento/page.tsx:29-30`).
- Correção: levar a aba para Gestão; no Chat, só atalho "Treinar o bot" a partir de uma resposta.
- Esforço: M. Risco: baixo.

**REC-67 · P3 · Painel do paciente mostra dados crus e não oferece ação**
- Evidência: `patient-context-panel.tsx:277-281,346-355` mostra "Próximos atendimentos" com `statusText` do código do banco ("nao compareceu") e sem botão de confirmar ou reagendar.
- Correção: usar `UI_STATE_LABEL`/`APPOINTMENT_STATUS_STYLE` e ações "Confirmar", "Reagendar".
- Esforço: S. Risco: baixo.

### 2.7 Documentos

Resumo: ferramenta útil (visualização A4 ao vivo, bloqueio de impressão sem nome e CPF obrigatórios), mas emite documento oficial com valores inventados por padrão, com o nome de quem emite vindo de um perfil fixo e sem registro de emissão.

**REC-70 · P1 · "Emitente" vem de um perfil de desenvolvimento fixo, não do usuário logado**
- Leis: Erro e bloqueio, integridade de dado oficial.
- Evidência: `documentos/page.tsx:2,53-57` busca `DEV_RECEPTION_PROFILE_ID` (`lib/constants.ts:10`, "c1000000-...-0004") e usa o nome como emitente padrão (`documentos-manager.tsx:~178`). Em produção, qualquer recepcionista emite documento com o nome de outra pessoa a menos que lembre de trocar o campo.
- Correção: usar `auth.getUser()` + `profiles` do usuário atual.
- Esforço: S. Risco: baixo.

**REC-71 · P1 · Horários, mês e total de sessões vêm preenchidos com valores fixos em documento oficial**
- Leis: Lei de Tesler, Efeito de padrões, Prevenção de erro.
- Evidência: `documentos-manager.tsx:172-173` (14:00 a 15:00), `:184` (disciplinas fixas), `:188` ("12 sessões"), `:189` ("Setembro / 2026", hoje é novembro), `:169` (data por `toISOString`, em UTC: após 21h no horário de Brasília vira o dia seguinte). Ao escolher o paciente só nome, nascimento, responsável e CPF são preenchidos (`:196-201`). O texto do documento imprime esses valores (`:~783-870`, ex.: `startTime` e `endTime` em negrito).
- Problema: uma declaração de comparecimento pode sair com "das 14:00 às 15:00" que nunca aconteceu, sem aviso. O sistema sabe as sessões realizadas.
- Correção: ao escolher o paciente, listar as últimas sessões realizadas ("Quinta 13/11, 14:00 às 14:40, Fono") para escolher uma; "Frequência mensal" calcula mês e total da agenda; sem padrão inventado: campo vazio e obrigatório; data com o fuso da clínica.
- Esforço: M. Risco: baixo a médio.

**REC-72 · P2 · Todos os pacientes e CPFs de responsáveis vão para o navegador, e a emissão não deixa rastro**
- Leis: LGPD (minimização), Lei de Tesler.
- Evidência: `documentos/page.tsx:12-50` carrega todos os pacientes e todos os responsáveis com CPF completo; `PatientOption.guardianCpf` vai ao cliente (`documentos-manager.tsx:31`). A lista de Pacientes mascara o CPF e audita "revelar" (`pacientes/page.tsx` com `maskCpf`, `pacientes/actions.ts:179-209`). Nenhum `logRecordAccess` nem gravação em `documents` na emissão (grep em `documentos/`).
- Correção: buscar paciente por demanda no servidor; CPF só ao gerar, com `logRecordAccess`; guardar o PDF/HTML emitido no prontuário (categoria "declaração") para reimpressão.
- Esforço: M. Risco: médio.

**REC-73 · P2 · Sete modelos e cerca de 15 campos numa tela só, incluindo atestado**
- Leis: Lei de Hick, Carga cognitiva, governança.
- Evidência: `DOCUMENT_TEMPLATES` (`documentos-manager.tsx:~85-140`); campos condicionais por modelo (`:480-660`). O "Atestado de Atendimento Terapêutico" descreve "necessidade de repouso/afastamento temporário" (`:~125`), conteúdo que normalmente exige assinatura de profissional de saúde; a recepção o emite sem campo de profissional. Não pude confirmar a regra clínica da clínica.
- Correção: os 2 ou 3 modelos de uso diário primeiro (Comparecimento, Acompanhamento, Vínculo) e os demais em "Outros modelos"; atestado só com profissional responsável escolhido ou fora da recepção.
- Esforço: M. Risco: médio.

**REC-74 · P2 · Validação e entrada de dados**
- Leis: Lei de Postel, Erro e bloqueio dizem o que fazer.
- Evidência: CPF do responsável é texto livre sem máscara nem validação (`documentos-manager.tsx:~528-545`); o botão "Imprimir" desabilitado só é explicado num banner no topo (`:364-373`), longe do campo; `isMinor` vale `true` quando não há data (`:222`), o que obriga CPF do responsável também para adulto sem data informada.
- Correção: máscara e dígito verificador; erro junto do campo e botão com texto "Falta o CPF do responsável".
- Esforço: S. Risco: baixo.

**REC-75 · P2 · A emissão acontece longe de onde a necessidade nasce**
- Leis: Princípio de Pareto, Ação onde o dado está.
- Evidência: a declaração de comparecimento é o modelo marcado "Mais Utilizado" (`documentos-manager.tsx:~87-93`), mas só se chega a ela pelo menu, e a busca de paciente recomeça do zero; a linha da agenda e a ficha não têm "Gerar declaração".
- Correção: ação "Declaração de comparecimento" no "⋯" da linha realizada (e na ficha), abrindo a tela com paciente e sessão já escolhidos.
- Esforço: M. Risco: baixo.

### 2.8 Minha bonificação (menu pessoal) e widget

**REC-80 · P3 · Duas portas para a mesma tela, e um elemento fixo em todas as telas**
- Leis: Efeito Von Restorff, Lei de Fitts.
- Evidência: o link está no menu pessoal (`recepcao-nav.tsx:33`) e no widget fixo `bottom-5 right-5 z-30` (`components/bonus-floating-widget.tsx:95-103`), montado no layout (`layout.tsx:98`), inclusive sobre a própria página `/recepcao/metricas`. Em largura menor que `lg`, a coluna única da home pode pôr o widget sobre os botões da última linha (confiança média). O polling é de 3 min (`:8`). A página usa degraus qualitativos em vez de número (decisão do dono), o que serve de referência comparativa para a regra 1, mas sem "vs. mês anterior" (`components/bonus-progress-card.tsx:84-90`).
- Correção: manter só um dos dois; se for o widget, esconder em `/recepcao/metricas`, em mobile e sobre áreas de ação; incluir "vs. mês passado" no cartão.
- Esforço: S. Risco: baixo.

### 2.9 Telas sem item de menu

**REC-90 · P2 · `/recepcao/whatsapp` é órfã, descreve algo que não existe e mede outra coisa**
- Leis: Lei de Jakob, regra 1 do AGENTS.md (KPI com comparativo).
- Evidência: nenhum link para a rota (grep). O `HelpHint` diz "cada card abre o WhatsApp... com a mensagem pronta" (`whatsapp/page.tsx:70`), mas a página tem só uma tabela de histórico. A consulta pega todas as mensagens do canal WhatsApp do dia (`whatsapp/actions.ts:21-31`), não só lembretes D-1, e rotula "Confirmados hoje" e "Cancelaram/reagendaram hoje" sem comparativo (`:75-88`). Na agenda, o filtro "A confirmar" (`today-agenda-list.tsx:174,232-236`) não tem ação de confirmar nem de lembrar na linha. Não consegui verificar se o envio de D-1 é automático em outro lugar.
- Correção: decidir o dono do D-1: se for automático, remover a página e mostrar na linha "Confirmou por WhatsApp 14:02"; se for manual, botão "Enviar lembrete" na linha e na faixa ("8 sessões de amanhã sem confirmação: Enviar").
- Esforço: M. Risco: baixo.

**REC-91 · P2 · "Aviso Falta Terapeuta" mora no módulo errado visualmente**
- Evidência: o item está no menu da Supervisão (`components/supervisao-header.tsx:28`) mas a rota é `/recepcao/emergencias`, e `app/recepcao/layout.tsx:94-95` desenha o cabeçalho "Recepção" (cor petróleo) sem item ativo. A tela só oferece "Manhã" e "Tarde" (`emergencias/emergency-form.tsx`, select de turno), sem "Dia todo"; o disparo de ligações tem etapa de confirmação (bom).
- Correção: mover a página para `/supervisao` ou aceitar um prop de cabeçalho por contexto; incluir "Dia todo"; a recepção precisa de um atalho se for ela quem avisa as famílias.
- Esforço: S a M. Risco: baixo.

**REC-92 · P2 · A impressão automática da lista da porta pode atrapalhar e não tem botão de reimpressão**
- Evidência: `components/door-list-auto-print.tsx:19-56`: na 1ª abertura do dia, um iframe oculto chama `print()` (sem `--kiosk-printing` abre o diálogo de impressão sobre o trabalho) e grava "impresso" em `localStorage` ao receber a mensagem `ready`, mesmo se o operador cancelar (`:32-41`). Nenhum link visível leva a `/recepcao/lista-porta` (grep) para reimprimir.
- Correção: botão "Imprimir lista da porta" na home (ou no "⋯" da data); marcar o dia como impresso só após `afterprint`.
- Esforço: S. Risco: baixo.

**REC-93 · P3 · Carregamento e erro com título errado e sem tela de erro local**
- Evidência: `app/recepcao/loading.tsx:4` ("Recepção & Agenda, Carregando agendamentos e check-ins...") serve a Chegadas, Pacientes (lista), Documentos, Chat e Métricas, que não têm `loading.tsx` próprio; só Fila, Autorizações, ficha e Pendências têm. Há `error.tsx` local apenas em `fila/` e `pacientes/[id]/` (`app/error.tsx` global cobre o resto).
- Correção: `loading.tsx` e `error.tsx` por segmento, com esqueleto no formato da tela.
- Esforço: S. Risco: baixo.

**REC-94 · P3 · Redirects em cadeia e textos que ainda falam de telas removidas**
- Evidência: `lib/knowledge-base-data.ts:302` (ação do chatbot "Ver Fila de Pré-Cadastros" aponta para `/recepcao/pre-cadastros`, que redireciona a `/pendencias`, que redireciona a `/pacientes`); `app/gestor/inteligencia/_components/inteligencia-client.tsx:791` usa a mesma rota que só redireciona; `/recepcao/pacientes/novo` mantém só o diálogo, deixando a página vazia atrás dele (`novo/page.tsx:26-35`).
- Correção: trocar os links por destinos reais; `novo` redireciona para a lista com `?novo=1`.
- Esforço: S. Risco: baixo.

---

## 3. Achados transversais do módulo

### 3.0 Veredito sobre os achados anteriores ainda abertos

| Achado | Veredito | Evidência resumida |
|---|---|---|
| (a) Fila e Autorizações duplicam o trabalho | **Confirmado**, com agravante de segurança (REC-50) | Mesma fonte (`load-fila.ts:23`, `a-autorizar/page.tsx:38`), mesmas ações; só a tela antiga habilita agendamento sem conferência (`draft-pipeline.tsx:716-722`). `authorizations-workspace.tsx` tem 1152 linhas |
| (b) A chegada existe em 3 lugares | **Confirmado e piorado** (REC-03, REC-20) | Botão "Chegou" na linha (`today-agenda-list.tsx:913`), tela Chegadas (`chegadas-list.tsx`), faixa "Precisa de você" (1ª linha) e item na lista "Outras pendências" (`reception-queue.ts:1642-1651`). Os caminhos não se falam: o check-in da linha não fecha o pedido do QR |
| (c) Muitos controles na linha | **Confirmado** (REC-04, REC-05, REC-13) | 8 a 10 controles por linha, dois fluxos de guia, painel de falta numa coluna de 130 px. Há também ações que faltam (reagendar, contato) |
| (d) Lateral com 4 cards; Rastro sem decisão | **Confirmado** (REC-07) | `page.tsx:529-621`; Rastro derivado de timestamps (`lib/agenda-trail.ts`); "Outras pendências" duplica a faixa |
| (e) Menu com 7 itens, 2 redundantes | **Confirmado**, e há um 3º candidato (REC-T01) | Autorizações é redundante com Fila; Chegadas é fila de tempo real que cabe na agenda; Documentos é de uso raro |

### REC-T01 · P1 · Estrutura de menu: 7 itens, ordem que não segue a urgência e destinos que se sobrepõem
- Leis: Lei de Miller, Efeito da posição serial, Lei de Hick, Princípio de Pareto.
- Evidência: `components/recepcao-nav.tsx:13-23`. Ordem: Agenda, Chegadas, Pacientes, Fila, Autorizações, Chat, Documentos. O Chat (maior urgência por SLA) é o 6º; Autorizações e Fila são o mesmo trabalho; Chegadas é a fila de quem está na porta, que já é a 1ª linha da faixa da home; Documentos é emissão eventual.
- Problema: 7 itens ficam no limite de Miller, mas dois deles duplicam outros e o conjunto não reflete a frequência de uso.
- Correção proposta (5 itens): Agenda (com Chegadas como bloco no topo quando há itens, via REC-01 e REC-03) · Chat · Fila de entrada · Pacientes · Documentos dentro do "⋯" ou do menu pessoal (junto com Minha bonificação). Remover Autorizações (REC-50). Selo em Chat (REC-60).
- Esforço: M. Risco: médio (mudar hábito; avisar a equipe e manter redirects).

### REC-T02 · P2 · Nomes diferentes para a mesma coisa, e telas mortas ainda citadas na interface
- Leis: Vocabulário do operador, Lei de Jakob.
- Evidência: Chat = "Atendimento" no código, na rota (`/recepcao/atendimento`) e no `ChatLayout`; "Fila de entrada" = "Autorizações" = "Cadastro IA" = "Cadastro assistido" (`lead-context-panel.tsx:72` "Abrir no cadastro assistido") = "Conferir e cadastrar" = "pré-cadastro" (`draft-review-form`); "Novo paciente" = "Interessado" (REC-10); "Pendências" saiu do menu mas ainda é verbo e destino: "Resolver pendências" (`case-summary-pure.ts:176`), "Ver fila geral de pendências" (`a-autorizar/page.tsx:93`), "pendência de cadastro" (`recepcao-attention-pure.ts:52`); jargão: "Dados para o portal" (`fila-detail.tsx:299`), "Habilitar para agendamento", "Leitura automática falhou".
- Correção: um glossário de 6 termos aplicado a menu, título, botão e rota: Agenda, Chat, Fila de entrada, Cadastrar, Pacientes, Pendências (se for usar, com tela).
- Esforço: S. Risco: baixo.

### REC-T03 · P2 · Diálogos: pelo menos seis implementações, a maioria sem Esc, foco preso ou rótulos
- Leis: Lei de Jakob, acessibilidade (foco visível, operável por teclado, PRODUCT.md).
- Evidência: sem tratamento de Esc (grep de `Escape`/`onKeyDown` nos arquivos): `nova-sessao-dialog.tsx`, `interessado-rapido-dialog.tsx`, `guia-quick-action-modal.tsx`, `chegada-avaliacao-modal.tsx`, `ChatActions.tsx` (modal com `role="dialog"` mas sem Esc e sem foco inicial, `:246-252`) e o modal de inativação (`patient-list-client.tsx:60-105`). Só `patient-pendencies-dialog.tsx:56-62` e `draft-modal-shell.tsx:9-20` tratam Esc. Rótulos sem `htmlFor` em Nova sessão (`:192,234`).
- Correção: um `<Dialog>` compartilhado (role, `aria-modal`, Esc, foco inicial e retorno, clique fora) e migrar os seis.
- Esforço: M. Risco: baixo.

### REC-T04 · P2 · Cabeçalhos de página e cor da ação primária variam de tela em tela
- Leis: Estética-usabilidade, Efeito Von Restorff, Lei de Jakob.
- Evidência: `PageHeader` em Fila, Autorizações, Pacientes e pré-cadastro; `h1` solto com `HelpHint` em Chegadas (`chegadas/page.tsx:132`) e Documentos (`documentos-manager.tsx:337`, título "Emissão de Documentos Rápidos" para o item "Documentos"); `h6` + `h1` na Agenda, Emergências e Whatsapp; Chat sem cabeçalho. Ação primária: teal (`nova-sessao-dialog.tsx:156`), índigo (`interessado-rapido-dialog.tsx:317`), vinho `#841B4D` (`patient-list-client.tsx:146,435`), rosa (`documentos-manager.tsx:360`), petróleo na faixa (`precisa-de-voce.tsx:36`). DESIGN.md define o rosa `#F0196B` como único accent.
- Correção: tokens de cor para ação primária; `PageHeader` em todas as telas; título igual ao do menu.
- Esforço: M. Risco: baixo.

### REC-T05 · P2 · O layout executa a fila inteira da recepção em cada navegação
- Leis: Limiar de Doherty.
- Evidência: `layout.tsx:78-91` chama `getReceptionQueue` (dezenas de consultas, `chegadas-list.tsx:321-325`) e `dropLeadsWithClosedChat` só para dois selos; a Fila, a home e Autorizações repetem a chamada.
- Correção: contagem barata (RPC/view) para os selos; guardar a fila em cache por requisição (`cache()` do React) para as telas que reaproveitam.
- Esforço: M. Risco: médio.

### REC-T06 · P3 · Código morto que esconde o estado real das telas
- Evidência: `QueueWorkspace` (703 linhas, `pacientes/pendencias/queue-workspace.tsx:89`) sem uso (só tipos são importados por `queue-items.tsx:16` e `authorizations-workspace.tsx:30`); `ReagendamentoDialog` (REC-02); `linkVisitorToPatient` e `createManualCheckinRequest` (REC-20); `tagsByPatient` (REC-14); `showGuardians`, `canCheckout` e `canReschedule` em `today-agenda-list.tsx:681,691,692`; ícones importados e não usados (`User`, `PenLine`, `MessageCircle`, `AlertCircle`, `X`, `:4`).
- Correção: remover ou religar (cada item acima tem um destino sugerido).
- Esforço: S. Risco: baixo.

---

## 4. O que já está bom

- Fila de entrada: um próximo passo por vez, conferência antes de WhatsApp, Desfazer de 8 s, estado vazio, loading e erro dedicados (`fila/*`). Modelo a copiar nas demais telas.
- Faixa "Precisa de você agora": uma linha por assunto, verbo no botão, "Tudo em dia" discreto (`precisa-de-voce.tsx`); falta em 2 cliques (`falta-quick-panel.tsx`).
- Chat: seções por urgência, próxima conversa ao encerrar com Desfazer, rascunho preservado, aviso da janela de 24 h, respostas rápidas acessíveis por teclado, histórico paginado, lista virtualizada (`atendimento-shell.tsx`, `ConversationList.tsx`, `MessageInput.tsx`).
- Chegadas: som, realtime, poll de segurança com aba oculta, auto-confirmação com barra e "Segurar", avisos de guia e cadastro incompleto sem bloquear a entrada (`chegadas-list.tsx`).
- Pacientes: busca tolerante (sem acento, tokens), CPF mascarado com "revelar" auditado (`reveal-cpf.tsx`, `pacientes/actions.ts:179-209`).
- Documentos: bloqueio de impressão sem dados obrigatórios e pré-visualização A4 ao vivo.
- `ModuleHeader` único com item ativo por prefixo mais longo, `sticky` e fallback para tela estreita (`module-header.tsx:70-93,162,215-244`).

---

## 5. Lacunas: o que NÃO consegui auditar e por quê

- Não executei o sistema (regra do brief). Tudo vem de leitura de código; comportamentos de navegador (Ctrl+N reservado, autoplay do `AudioContext`, impressão automática com ou sem `--kiosk-printing`) estão marcados como "confiança média".
- RLS e permissões no banco: não verifiquei se o papel recepção realmente recebe linhas de `session_notes`, `plan_goals`, `billing_items` (REC-32). A exposição depende disso.
- Origem dos lembretes D-1 (REC-90): não achei o emissor; pode ser cron/Twilio fora do módulo.
- Lidas só parcialmente: `lib/reception-queue.ts` (apenas montagem de itens e filtros de fila), `lib/fila/*` (apenas modelo e carga), `lib/atendimento/*` (apenas seções e resumo), `app/recepcao/atendimento/chatbot/*` (6 arquivos de administração, não lidos: fora do papel recepção), `app/recepcao/pacientes/pendencias/portal-robot-*`, `autorizacao-wizard.tsx`, `draft-adjust-*`, `document-request-*`, `move-to-last-button`, `reassign-owner-button`, `intake-actions.ts`, `draft-pipeline-actions.ts` (só vistos pelos nomes e pelos pontos de chamada), `mini-calendar-picker.tsx`, `expiring-guides-card.tsx` (lido), `renew-guide-link.tsx`.
- Telas de mobile da recepção (`app/m/atendimento/*`): fora do escopo; o módulo foi avaliado em desktop como o PRODUCT.md define. A segunda faixa de navegação abaixo de `lg` quebra em várias linhas, não medi a altura.
- Contraste AA: avaliei só o que o código mostra (tamanhos de 10 a 11 px em vários rótulos, ex.: `today-agenda-list.tsx:786-809`, `text-[11px]`); não medi razões de contraste.
- Executei uma consulta de histórico do git (`git log`, somente leitura) contra a regra do brief de não rodar git; não alterou nada. Usei-a apenas para confirmar que a simplificação recente da linha da agenda é a mesma do PR em andamento.

---

## 6. Top 10 por impacto/esforço

1. **REC-09** (P0, S): ligar as pílulas e o `?abrir=` na lista de Pacientes e corrigir os links da home e da faixa; devolve o caminho de resolução de falta sem motivo, renovação e remarcação.
2. **REC-70** (P1, S): emitente do documento vem do usuário logado, não de um perfil fixo de desenvolvimento.
3. **REC-71** (P1, M): documentos sem horário, mês e total inventados; pré-preencher a partir das sessões realizadas.
4. **REC-03** (P1, S a M): "Chegou" da agenda fecha o pedido do QR, "Confirmar" trata "já registrado" como sucesso.
5. **REC-02** (P1, M): religar `ReagendamentoDialog` e propor novo horário ao marcar "Remarcada".
6. **REC-01 + REC-40 + REC-60** (P1, M): um `RecepcaoLive` no layout (chegada por QR com som, fila nova, conversas esperando) e selo no Chat.
7. **REC-10** (P1, M): "Novo paciente" confirma, mostra onde o cadastro foi parar, trata o erro do responsável.
8. **REC-50 + REC-T01** (P1, M a L): fechar a transição Fila x Autorizações (conferência no botão de habilitar já; remover o item do menu depois) e enxugar o menu para 5 itens.
9. **REC-30** (P1, S): esconder "Excluir" para quem não é gestor e mover "Inativar" para "⋯" com motivo.
10. **REC-41** (P1, M): rejeitar com motivo estruturado (duplicidade, teste, não é paciente) e voltar para a Fila na próxima família; evita perda irreversível de documentos.

Menções de impacto médio e esforço pequeno para fazer na mesma onda: REC-05 (nome como link), REC-08 (rótulo e destino da 4ª linha), REC-12 (remover banner de anamnese), REC-13 (motivos por status), REC-20 (vincular visitante a sessão), REC-62 (encerrar em 1 clique), REC-63 (botão "Cadastrar interessado" no Chat), REC-92 (botão de reimprimir a lista da porta).
