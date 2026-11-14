# Auditoria UX: módulo Supervisão / Coordenação clínica

Escopo lido: `components/supervisao-header.tsx`, `components/nav-group-dropdown.tsx`, `components/module-header.tsx`, `app/supervisao/layout.tsx`, `supervisao-tab-context.tsx`, `supervisao-shell.tsx`, `page.tsx` (raiz), `agenda-avaliacoes-panel.tsx`, `acolhimentos-panel.tsx`, `evaluation-calendar.tsx` (parte da renderização e dos diálogos), `planos-panel.tsx`, `plan-actions.ts`, `relatorio-dialog.tsx` (cabeçalho e campos), `inbox-panel.tsx`, `nps-alerts-panel.tsx`, `inbox-actions.ts`, `grade-panel.tsx`, e as páginas de disponibilidade, feriados, recursos (+ qr-checkin), lista-espera, reagendamentos, reunioes (+ nova), metricas, prontuario-unificado, planos/novo (page.tsx). Também `lib/roles.ts` (guard de rotas) e `app/recepcao/emergencias`. Não rodei nada nem abri o sistema no navegador: tudo abaixo é leitura de código (ver seção 5 para o que ficou de fora).

## 1. Mapa de menus

Barra do módulo (`ModuleHeader`, montada em `app/supervisao/layout.tsx:32`). Os três primeiros são abas em memória, não rotas (`supervisao-header.tsx:10-14`, `:77-86`): só têm conteúdo em `/supervisao`; clicar fora da raiz faz `router.push("/supervisao")` antes de trocar a aba.

| Item de menu | Rota | Tela(s) | Tarefa do operador | Cliques da tarefa principal (a partir de /supervisao) |
|---|---|---|---|---|
| Agenda 1ª Avaliação (aba, badge = prontos + acolhimentos) | `/supervisao` (aba `agenda1a`, padrão) | `AgendaAvaliacoesPanel` com sub-abas "Calendário" (`EvaluationCalendar`) e "Planilha de Pacientes" (`AcolhimentosPanel`), botão "Devolutiva do paciente" | Agendar 1ª avaliação, confirmar horário escolhido pela família, validar documentos de convênio | Agendar: 3 a 4 (clicar no horário vazio, escolher paciente no select, Agendar). Validar guia: 2 a 3 (sub-aba Planilha, Validar documentos, ação no drawer) |
| PTS (aba, badge = rascunhos) | `/supervisao` (aba `planos`) | `PlanosPanel` (fila à esquerda, revisão à direita), botão "+ Novo PTS" leva a `/supervisao/planos/novo` | Aprovar PTS | 1 (aba) + 1 por meta (Validar Meta) + 1 (Aprovar e Publicar). Com 6 metas, 8 cliques |
| Caixa de entrada (aba, badge = chamados + ausências + NPS) | `/supervisao` (aba `inbox`) | `InboxPanel`: Ausências, Documentos da família, NPS, Chamados, Reavaliações, Relatórios devolutivos | Triagem de tudo que vem da família e da equipe | 1 + rolagem longa; cada item 1 a 2 cliques |
| Prontuário Unificado (link) | `/supervisao/prontuario-unificado` | lista de 30 pacientes + ficha (`PatientTabs`) | Consultar prontuário | 2 (link, paciente) |
| Gestão e Escala (dropdown, 3 itens) > Disponibilidade | `/supervisao/disponibilidade` | `AvailabilityManager` | Cadastrar janela de atendimento do terapeuta | 2 a 3 |
| Gestão e Escala > Recursos e reservas | `/supervisao/recursos` (+ `/recursos/qr-checkin` por link no corpo) | recursos, form de reserva, próximas reservas 14 dias | Reservar recurso | 3 |
| Gestão e Escala > Aviso Falta Terapeuta | `/recepcao/emergencias` (OUTRO MÓDULO) | `EmergencyForm` | Avisar famílias que o terapeuta faltou | 2 + formulário + confirmação |
| Botão "Agenda" (canto direito) | overlay em `/supervisao` (não é rota) | `GradePanel` em tela cheia | Ver grade semanal, permutar pacientes, ver pendências de evolução e PTS atrasado | 1 (+ rolagem para pendências) |
| Menu pessoal: Minha Bonificação | `/supervisao/metricas` | `BonusProgressCard` | Acompanhar bonificação própria | 2 |
| (sem menu) Widget flutuante de bonificação | todas as telas do módulo | `BonusFloatingWidget` (`layout.tsx:34`) | Placar | 0 |

Rotas do módulo que existem e NÃO têm item de menu:

| Rota | Como se chega hoje | Observação |
|---|---|---|
| `/supervisao/reagendamentos` | por ninguém (grep não acha link em app/components/lib) | Fila de reagendamentos aguardando aprovação. Quebrada (ver REA-01) |
| `/supervisao/lista-espera` | por ninguém (só comentário em `supervisao-tab-context.tsx:22`) | Fila de espera por especialidade |
| `/supervisao/reunioes` e `/supervisao/reunioes/nova` | por ninguém (só no drawer de base de conhecimento, que não está montado) | Lista e cadastro de reuniões (devolutiva, revisão de PTS, visita escolar) |
| `/supervisao/feriados` | link de texto pequeno dentro de `/supervisao/disponibilidade` (`disponibilidade/page.tsx:56-60`) | Feriados e fechamentos |
| `/supervisao/recursos/qr-checkin` | link de texto dentro de Recursos (`recursos/page.tsx:176`) | Cartaz de QR da recepção |
| `/supervisao/planos/novo` | botão "+ Novo PTS" dentro da aba PTS | Ok como rota filha |
| `/supervisao/pacientes/[id]/anamnese` e `/tcle` | links vindos de `/gestor/pacientes/[id]` e do terapeuta | Não li o conteúdo; fora do menu do módulo |

## 2. Achados por item de menu (na ordem do menu)

### 2.1 Agenda 1ª Avaliação (aba) e sub-abas

Resumo: a tela tem boas ideias (banner de confirmações pendentes, "Sugerir data mais próxima", aviso de telefone ausente), mas esconde quem precisa ser agendado e abre na sub-aba errada quando há urgência.

**AGE-01 (P1) A fila de pacientes prontos para agendar não aparece em lugar nenhum.**
- Leis: Lei de Hick, Efeito Zeigarnik, Lei de Fitts, "a tela traz o trabalho".
- Evidência: a sub-aba mostra só um número (`agenda-avaliacoes-panel.tsx:72`, `readyCount`). A grade em `evaluation-calendar.tsx:1037` não renderiza lista de pool; o único `draggable` do arquivo é o dos agendamentos já existentes (`:1175`). O pool só aparece como `<select>` dentro do diálogo que abre ao clicar num horário vazio (`:813-832`, `:211-216`).
- Problema: o coordenador vê "(5)" mas não vê QUEM são os 5, nem há de onde arrastar (o tipo de payload `kind: "pool"` em `:138` e a dica "arraste um paciente" em `:989-993` apontam para um recurso que não existe na tela). Para saber quem espera, é preciso clicar num horário aleatório e abrir o select.
- Correção: coluna lateral "Prontos para agendar" (nome, convênio, há quantos dias espera, origem), cada card arrastável e com botão "Agendar" (abre o diálogo já com o paciente preenchido). Ordenar por tempo de espera.
- Esforço: M. Risco: baixo (dados já estão em `pool`).

**AGE-02 (P1) Aba pisca em vermelho, mas a sub-aba aberta é a errada.**
- Leis: Efeito Von Restorff, Lei de Hick, Doherty.
- Evidência: o urgente (laudo/guia para validar) vem de `AcolhimentosPanel` (`page.tsx:480-489`), mas `useState<SubTabKey>("calendario")` (`agenda-avaliacoes-panel.tsx:50`). O badge urgente da sub-aba "Planilha de Pacientes" só aparece depois que o usuário já está na aba (`:73`).
- Problema: o operador vê o pill piscando na barra, clica, cai no Calendário e precisa descobrir que o urgente está na outra sub-aba.
- Correção: abrir por padrão a sub-aba que tem urgência (`acolhimentosUrgent ? "acolhimentos" : "calendario"`), ou fundir os dois em uma única fila "O que precisa de ação" no topo.
- Esforço: S. Risco: baixo.

**AGE-03 (P2) Nome "Planilha de Pacientes" não bate com o conteúdo, e o conteúdo mistura administração com trabalho.**
- Leis: Jakob, vocabulário do operador, Carga cognitiva.
- Evidência: sub-aba "Planilha de Pacientes" (`agenda-avaliacoes-panel.tsx:10`) abre blocos "Nova remessa" (`acolhimentos-panel.tsx:240`), "Importar JSON" com texto "rode scripts/extract_convenio_patients.py localmente" (`:277` e o HelpHint), "Lotes recebidos" (`:294`), "{n} lead(s)" (`:316`).
- Problema: jargão (remessa, lote, lead, JSON, script Python) numa tela de coordenação clínica; o formulário de upload (ação rara) vem ANTES da lista de trabalho (ação diária), invertendo o Princípio de Pareto.
- Correção: renomear a sub-aba para "Convênios a validar" (ou "Encaminhados do plano de saúde"); lista de trabalho primeiro, "Enviar nova relação (PDF)" num botão no canto; "Importar JSON" movido para área técnica (gestor) ou removido da tela do coordenador; "lead" vira "paciente".
- Esforço: S a M. Risco: baixo.

**AGE-04 (P2) Ações com efeito externo sem confirmação, ações destrutivas só com `window.confirm`.**
- Leis: prevenção de erro, Lei de Postel (feedback), Doherty.
- Evidência: "Iniciar contato (n)" em lote dispara WhatsApp sem confirmar (`acolhimentos-panel.tsx:142-150`, `:455`); excluir usa `window.confirm` nativo (`:111`, `:128`, `:150`); mensagem de resultado aparece solta no fim da página (`bulkResult` renderizado depois da tabela, ~`:464`), longe do botão fixo no rodapé.
- Problema: o operador clica no botão flutuante de baixo e o resultado aparece numa linha de texto fora da viewport.
- Correção: diálogo de confirmação com resumo ("Enviar WhatsApp para 4 famílias") e toast com o resultado junto ao botão; "Excluir" vira "Arquivar com motivo" (alinhado à regra 3 do AGENTS.md, que pede motivo explícito de duplicidade).
- Esforço: S. Risco: baixo.

**AGE-05 (P2) Mensagens inconsistentes sobre aviso à família.**
- Leis: Lei de Postel, confiança, erro diz o que fazer.
- Evidência: ao confirmar o agendamento "Notificação enviada por WhatsApp" (`evaluation-calendar.tsx:~935-945`), mas ao reagendar por arraste "avise o responsável pelo WhatsApp, isso não é enviado automaticamente" (`:775`).
- Problema: duas regras diferentes para o mesmo evento, sem indicação visual do que é automático. O operador não sabe quando precisa avisar à mão.
- Correção: no reagendamento, oferecer checkbox "Avisar a família agora (WhatsApp)" já marcado, igual ao agendamento.
- Esforço: M. Risco: médio (mexe em envio de mensagem).

**AGE-06 (P3) Sub-abas sem semântica de aba.** `<nav>` com botões sem `role="tablist"`/`aria-selected` (`agenda-avaliacoes-panel.tsx:59-76`); o botão "Devolutiva do paciente" (reunião com os pais, nada a ver com 1ª avaliação) fica no mesmo cabeçalho (`:58`). Lei de Proximidade. Correção: aria de abas; mover a devolutiva para o Prontuário ou para a Caixa de entrada. Esforço: S.

Já está bom: banner "agendamentos escolhidos pela família aguardando confirmação" com botão Confirmar direto (ação onde o dado está); feedback de "Carregando semana…" sem desmontar a grade; Escape fecha os diálogos; aviso explícito quando falta telefone do responsável.

### 2.2 PTS (aba)

Resumo: fluxo de aprovação bem montado (rascunhos primeiro, botão Aprovar desabilitado com contagem), mas tem DOIS defeitos de dados que podem aparecer em documento clínico.

**PTS-01 (P0) "Relatório de Reavaliação (PDF)" imprime dados inventados.**
- Leis: confiança, erro de dados clínicos (regra de ouro do brief: P0 = erro de dado).
- Evidência: `planos-panel.tsx:109-145` monta `reportData` com valores fixos: nascimento "14/05/2019 (7 anos)", CID "F84.0", convênio "Bradesco Saúde Concierge / Guia SP/SADT", carteirinha "876.543.210-01", 36 sessões previstas e 34 realizadas, supervisora "Dra. Carolina Mendonça CRP 06/123456". Só nome do paciente, versão e metas vêm do plano. `achievedGoalsCount` cai em `Math.min(selected.goals.length, 2)` (`:138`). `relatorio-dialog.tsx:163-196,284-285` imprime esses campos. O título do modal diz "Relatório para Plano de Saúde".
- Problema: qualquer paciente sai com a mesma data de nascimento, CID, convênio, carteirinha, frequência e assinatura de uma pessoa que talvez nem seja a supervisora atual. É um documento que vai ao convênio.
- Correção: imediata, esconder o botão até ligar aos dados reais (patients, authorizations, appointments, profile do usuário logado); depois montar o relatório com consulta real e campos vazios sinalizados ("preencher") em vez de valores falsos.
- Esforço: S (esconder) / M (ligar). Risco: baixo.

**PTS-02 (P0) "Validar Meta" grava a meta como "atingida"; contadores da tela olham um status que não existe.**
- Leis: consistência, erro de dado clínico.
- Evidência: `plan-actions.ts:28` (`VALIDATED_GOAL_STATUS = "atingida"`) e `:31-47`; mas `planos-panel.tsx:106` conta `g.status === "validada"` e `:137` também, e `relatorio-dialog.tsx:240` idem. O cartão "Metas Validadas" (`planos-panel.tsx:419`) fica sempre em 0. Depois de aprovado, a meta aparece como "Atingida" (`lib/appointment-status-style.ts:21`), e no Prontuário Unificado `statusLabel` vira "Atingida" (`prontuario-unificado/page.tsx:238`), indo também no PDF compartilhado com a família.
- Problema: aprovar o plano marca todas as metas como já alcançadas. Terapeuta, família e BI leem "meta atingida" para meta que acabou de ser aprovada. O próprio código admite a "simplificação" (comentário `plan-actions.ts:20-28`).
- Correção: criar estado próprio (`validada_supervisao` ou coluna `validated_at` mantendo `status='ativa'`) em vez de reaproveitar `atingida`; corrigir os contadores. Migração de dados: metas `atingida` com `achieved_at` igual a `validated_at` e sem evolução associada devem voltar a `ativa`.
- Esforço: M. Risco: alto (migration de dados, outras telas leem `atingida`); aguardar decisão do dono.

**PTS-03 (P1) A fila mistura "a aprovar" com todos os PTS vigentes, e o badge conta rascunhos que não são do coordenador.**
- Leis: Lei de Hick, Zeigarnik, Pareto.
- Evidência: query traz `rascunho` e `aprovado` de todos (`page.tsx:94-101`) sem limite; lista com busca apenas (`planos-panel.tsx:~232-310`, sem filtro "A aprovar / Vigentes"); badge = `plans.filter(rascunho)` (`page.tsx:304`) inclui os "Devolvido" (aguardando o terapeuta, `planQueueLabel`, `planos-panel.tsx:~66-72`).
- Problema: com 150 pacientes, os poucos rascunhos ficam no topo mas a lista rola por vigentes; o número do badge inclui planos que o coordenador já devolveu (não é ação dele). Sem separação, "Devolvido" e "Pendente" têm o mesmo peso visual (tags de cor semelhante).
- Correção: filtro segmentado "A aprovar (n) | Devolvidos (n) | Vigentes" com padrão em "A aprovar"; badge só conta o que depende do coordenador; vigentes paginados.
- Esforço: S a M. Risco: baixo.

**PTS-04 (P1) Aprovar exige uma ação por meta; não há "validar todas".**
- Leis: Lei de Parkinson, Lei de Tesler, Pareto.
- Evidência: botão por meta `planos-panel.tsx:654-662`; "Aprovar" fica desabilitado enquanto `pendingCount > 0` (`:341-345`); só existe "Devolver Pendentes" em lote (`:328-337`).
- Problema: o caso mais comum (PTS está bom) custa N cliques mais o final; o caso raro (devolver) tem atalho. Atalho inverso ao uso real.
- Correção: botão primário "Validar tudo e aprovar" (confirma uma vez, valida pendentes e aprova); manter "Devolver" por meta para exceção.
- Esforço: S. Risco: baixo (reusar `validateGoal` em lote na action).

**PTS-05 (P2) Devolver meta usa `window.prompt`.** `planos-panel.tsx:647`. Bloqueia a thread, não permite estilo, quebra no celular e perde o texto se clicar em Cancelar (vira devolução sem nota). Correção: campo de observação inline no card da meta (expande ao clicar em Devolver), reaproveitando `bulkNotes`. Esforço: S.

**PTS-06 (P2) Cabeçalho do plano com 6 a 7 botões do mesmo peso.**
- Leis: Von Restorff, Lei de Hick, Efeito da posição serial.
- Evidência: "Gerar Relatório de Reavaliação (PDF)" com `btn-primary` (`relatorio-dialog.tsx:~70`), Ver, Imprimir, Editar PTS, Devolver Pendentes, Aprovar e Publicar (`planos-panel.tsx:271-351`).
- Problema: dois botões `btn-primary` lado a lado; a ação primária da tela (aprovar) disputa com um relatório que nem funciona direito (PTS-01).
- Correção: "Aprovar e Publicar" como único primário à direita; Ver/Imprimir/Relatório num menu "Mais"; Editar permanece visível.
- Esforço: S.

**PTS-07 (P3) Ruído.** Linha "Visão da família: “{descrição}”" repete literalmente a descrição da meta (`planos-panel.tsx:636-638`), em todas as metas. Remover ou trazer a tradução em linguagem leiga de verdade. Esforço: S.

**PTS-08 (P2) Editar PTS vigente sem nova versão visível.** O cabeçalho do componente diz que "Editar PTS" vale para rascunho e vigente (`planos-panel.tsx:~82-85`, `updatePlanContent` em `plan-actions.ts:168`). Não li se a action versiona ou registra auditoria. Se não, editar plano aprovado altera documento clínico sem trilha. Verificar. Esforço: M.

Já está bom: rascunhos ordenados antes dos vigentes (`page.tsx:299-303`), primeiro plano selecionado por padrão, estado vazio com texto, erro inline, botão Aprovar mostra quantas metas faltam (Gradiente de meta).

### 2.3 Caixa de entrada (aba)

Resumo: concentra tudo que vem da família, mas como uma página única de rolagem sem ordem de urgência, com histórico ilimitado e sem ação em parte dos blocos.

**INB-01 (P1) "Revisar & Aprovar" aprova o relatório com um clique, sem abrir o texto completo.**
- Leis: prevenção de erro, rótulo honesto.
- Evidência: `inbox-panel.tsx:69` chama `approveReportFromSupervisao(report.patientId, report.id, report.text)`; o texto aparece cortado em 3 linhas (`line-clamp-3`, logo abaixo do botão).
- Problema: o rótulo diz "Revisar" mas a ação é aprovar o texto que o terapeuta (ou a IA) escreveu; o coordenador não lê o documento inteiro antes. O relatório aprovado vai para o mural da família (HelpHint do bloco). Se `approveDevolutionReport` publica na hora (não li esse arquivo), sobe para P0.
- Correção: botão "Abrir para revisar" que abre o texto completo editável, com "Aprovar e enviar à família" dentro; ou no mínimo confirmação com o texto completo.
- Esforço: S a M. Risco: baixo.

**INB-02 (P1) Seis blocos numa rolagem única, fora de ordem de urgência, sem navegação interna.**
- Leis: Lei de Hick, Efeito da posição serial, Miller, Zeigarnik.
- Evidência, na ordem da tela: Ausências notificadas (`inbox-panel.tsx:261-285`), Documentos da família (`:289`), Alertas NPS (`:326-328`), Chamados (`:331`), Alertas de Reavaliação (`:429-440`), Relatórios devolutivos (rodapé, `:~460`).
- Problema: relatório devolutivo aguardando aprovação (bloqueia entrega à família) e detrator de NPS (risco de perda de paciente) ficam no meio ou no fim; ausências (informativas, "dar ciência") ocupam o topo e ainda aparecem todas, resolvidas ou não (INB-03). O badge da aba (um número) mistura tudo.
- Correção: topo com faixa de contadores clicáveis por tipo (Relatórios 2, NPS 1, Chamados 3, Ausências 5, Docs 1, Reavaliações 4) que filtra/rola; ordem fixa por urgência: NPS detrator, relatórios, chamados, documentos, ausências, reavaliações; blocos vazios recolhidos em uma linha ("Sem pendências").
- Esforço: M. Risco: baixo.

**INB-03 (P1) Histórico ilimitado misturado com pendências.**
- Leis: Carga cognitiva, Doherty.
- Evidência: `page.tsx:121-126` (absence_reports sem filtro nem limit, ordem por criação), `:102-107` (todas as mensagens inbound do portal, sem limit); `inbox-panel.tsx:227` seleciona `messages[0]` mesmo se já resolvida.
- Problema: a lista de ausências cresce para sempre; a lista de chamados mostra "Respondido" ao lado de "Novo" no mesmo fio; o primeiro item aberto automaticamente pode ser um chamado velho já resolvido. Custo de carregar na raiz a cada visita.
- Correção: por padrão só pendentes; "Ver resolvidos" recolhido; limite de 30 dias nos resolvidos; selecionar o primeiro chamado NÃO resolvido.
- Esforço: S. Risco: baixo.

**INB-04 (P1) Alertas de reavaliação são informação sem ação.**
- Leis: "ação onde o dado está", Zeigarnik.
- Evidência: `inbox-panel.tsx:445-455`: lista nome e vencimento; o chip "Pendente" é um `<span>` estático (`:452`). Não há link para o paciente, nem botão para agendar reavaliação.
- Problema: o coordenador vê que vence, mas não pode agir ali; precisa lembrar o nome e procurar o paciente em outro menu.
- Correção: botão "Agendar reavaliação" (abre o diálogo de agenda já com o paciente) e link para o prontuário; ordenar por dias restantes e destacar vencidos (hoje o texto diz "(3 dia(s) atrasado)" sem cor distinta).
- Esforço: M. Risco: baixo.

**INB-05 (P2) NPS: ação sem feedback e sem a ação óbvia.**
- Leis: Doherty, Lei de Tesler.
- Evidência: `nps-alerts-panel.tsx:56-60` descarta o resultado de `updateAlertStatus` (sem erro, sem estado de sucesso); botão com rótulo "Marcar como Em Atendimento" / "Marcar como Resolvido"; não há botão de contato (ligar/WhatsApp) nem campo de anotação; estado vazio com emoji (`:79`).
- Problema: se a gravação falha, nada acontece; o operador não registra o que falou com a família.
- Correção: tratar erro, mostrar o resultado; botão "Chamar no WhatsApp" que abre a conversa; campo "o que combinamos" ao resolver; rótulos "Iniciar contato" e "Concluir".
- Esforço: S a M. Risco: baixo.

**INB-06 (P2) Resposta ao chamado só grava no portal.**
- Evidência: `inbox-actions.ts:33-39` (comentário: "Não há WhatsApp/e-mail de fato integrado"); `sendReply` apenas insere `messages` (`:51-59`). Quando não há cadastro, o texto manda ir à "Central de Atendimento" em `/recepcao/atendimento` (`inbox-panel.tsx:420-423`), link `<a>` para outro módulo.
- Problema: a família só vê a resposta se abrir o portal; o coordenador acredita que respondeu. Para chamado sem cadastro, a saída é trocar de módulo.
- Correção: avisar na tela ("a família verá no portal; enviar também por WhatsApp?" com botão), e abrir a Central de Atendimento direto na conversa certa.
- Esforço: M. Risco: médio.

**INB-07 (P3) Pequenos atritos.** Link "Abrir prontuário" é `<a>` (recarrega a página, `inbox-panel.tsx:314`) em vez de `Link`; emojis como ícones (📢, 🩺, ✈️, 📄, 🎉) em lugar do conjunto de ícones do sistema; "Dar Ciência" e "Ciente" (jargão burocrático); `ReportReviewCard` usa cores azul/âmbar/esmeralda cruas fora dos tokens. Esforço: S.

Já está bom: estados vazios com texto em cada bloco; HelpHint explicando cada seção; "Marcar como revisado" pelo próprio card do documento; erro do upload/link de comprovante tratado no card.

### 2.4 Prontuário Unificado (link)

Resumo: boa consolidação (ficha completa embutida), mas o link de evolução do dossiê é barrado pelo guard de rotas e a página faz trabalho que não exibe.

**PRO-01 (P1) Links de evolução levam a rota que o papel supervisor não pode abrir.**
- Leis: erro diz o que fazer, Jakob.
- Evidência: `prontuario-unificado/page.tsx:438-439` cria `href=/terapeuta/evolucao/{id}` e `/historico`; `lib/roles.ts:50-62` libera para o supervisor apenas `/supervisao`, `/recepcao`, `/terapeuta/paciente`, `/gestor/cadastros/salas`, `/gestor/cadastros/comportamentos`, `/at`, `/m/atendimento`; `isPathAllowedForRole` (`lib/roles.ts:81-85`) é o que o middleware usa (`lib/supabase/middleware.ts:136`).
- Problema: clicar numa evolução como supervisor provavelmente redireciona para a home sem explicação (não testei no navegador). É o clique mais natural da tela.
- Correção: incluir `/terapeuta/evolucao` em `ROLE_ALLOWED_PREFIXES.supervisor` (somente leitura) ou abrir a evolução num drawer dentro do prontuário.
- Esforço: S. Risco: médio (confirmar que a tela de evolução tem modo leitura para supervisor).

**PRO-02 (P2) Seletor de paciente: 30 em ordem alfabética, sem indicação de que há mais.**
- Leis: Pareto, Lei de Hick.
- Evidência: `.limit(30)` (`page.tsx:84`); sem contador "mostrando 30 de N"; o select por busca existe (`SearchAsYouTypeInput`), mas sem "recentes" ou "meus em acompanhamento".
- Problema: quem não digita vê só os 30 primeiros do alfabeto e pode concluir que o paciente não existe.
- Correção: texto "30 de N, digite para filtrar", e ordenar por "acessados recentemente" pelo usuário.
- Esforço: S.

**PRO-03 (P2) Três cartões de resumo que não levam a decisão e violam a regra 1.**
- Leis: Carga cognitiva, regra 1 do AGENTS.md.
- Evidência: `page.tsx:~330-362`: "Evoluções Assinadas {x} de {y}" (sem comparativo/meta), "Versionamento: Imutável por versão" (texto fixo, sem dado), "Acessos ao Prontuário (30 dias)" (sem comparativo com o período anterior).
- Problema: ocupam o topo da ficha e empurram a identidade do paciente e o conteúdo para baixo; "Versionamento" não é indicador.
- Correção: remover o cartão fixo; fundir assinatura e acessos numa linha compacta com comparativo (por exemplo "Evoluções assinadas 18/20 · mês anterior 19/22").
- Esforço: S.

**PRO-04 (P2) A linha do tempo é calculada e descartada; registro de acesso grava a cada renderização.**
- Evidência: `timeline` montada com 4 consultas e ordenação (`page.tsx:118-216`) é usada só em `hasRecords` (`:302`); `logProntuarioAccess` roda dentro da renderização (`:116`), então F5, voltar e foco também geram acessos.
- Problema: desperdício de tempo de resposta (Doherty) e trilha LGPD inflada, o que enfraquece o cartão "Acessos (30 dias)".
- Correção: remover as consultas não usadas ou exibir a linha do tempo; registrar acesso em ação do cliente por abertura de paciente (com deduplicação por sessão).
- Esforço: S a M. Risco: baixo a médio (log de auditoria).

**PRO-05 (P3) Título longo e instrução ambígua.** Título "Prontuário Eletrônico Unificado & Trilha de Auditoria" (`:~292`) vs menu "Prontuário Unificado"; estado vazio "Selecione um paciente à esquerda" (`:~330`) está errado no celular, onde a lista vem acima. Esforço: S.

Já está bom: link direto `?p=` funciona mesmo com paciente fora dos 30 (`:96-105`); botão de compartilhar com a família só para supervisor/gestor (`:75`).

### 2.5 Gestão e Escala > Disponibilidade

Resumo: tarefa clara, restrita a gestor/supervisor; feriados ficam escondidos.

**DIS-01 (P2) "Feriados e fechamentos" é uma rota sem menu.** `disponibilidade/page.tsx:56-60`: link `text-xs` sublinhado. Leis: Lei de Jakob, Fitts, "o operador não deve caçar". Correção: item no dropdown (ao lado de Disponibilidade) ou aba dentro da mesma tela "Agenda da clínica". Esforço: S.

**DIS-02 (P2) Papel errado é redirecionado em silêncio.** `disponibilidade/page.tsx:25-27` e `feriados/page.tsx:89` fazem `redirect("/supervisao")` sem mensagem; e o guard só roda `if (user)`. Correção: mensagem "Somente supervisão e gestão" e guard igual à `metricas`. Esforço: S.

**DIS-03 (P3) Cabeçalho de página diferente das outras.** Usa `PageHeader` com descrição de duas linhas (`disponibilidade/page.tsx:50-54`), enquanto Recursos, Reuniões e Lista de espera usam kicker + `h1`. Ver TRV-05.

Não li `availability-manager.tsx` por inteiro (348 linhas): só vi `window.confirm` em remoções (`:203`, `:313`) e a busca "Buscar terapeuta…" (`:132`).

### 2.6 Gestão e Escala > Recursos e reservas

**REC-01 (P2) Ordem da página inverte a ação primária.** `recursos/page.tsx`: primeiro "Recursos cadastrados" (referência), depois "Reservar" (`:202-205`), depois próximas reservas (`:207-210`). Leis: Zeigarnik, Fitts. Correção: reservar primeiro (ou em coluna lateral fixa), reservas próximas em seguida, catálogo recolhido.
Esforço: S.

**REC-02 (P2) Cancelar reserva é um clique sem confirmação nem desfazer.** `resource-bookings-list.tsx:28-40,58-64` (rótulo "Cancelar" com `btn-ghost`). Correção: confirmação inline ou toast "Reserva cancelada, Desfazer". Esforço: S.

**REC-03 (P3) QR de check-in escondido, e `/recursos` sem guard de papel.** Link "Cartaz de check-in por QR da entrada →" em texto pequeno (`recursos/page.tsx:176`); a página (diferente de disponibilidade e feriados) não verifica o papel. Link "Cadastrar novo recurso" leva a `/gestor/cadastros/salas` (`:184`), outro módulo (liberado para supervisor em `lib/roles.ts:54-55`). Correção: avisar visualmente que sai do módulo (`external`), ou permitir cadastro rápido no próprio modal. Esforço: S.

**REC-04 (P3)** Rótulo "Recursos e reservas" (menu e `h1`) é coerente; kicker "Coordenação" aqui, "Supervisão" nas outras (TRV-05).

### 2.7 Gestão e Escala > Aviso Falta Terapeuta

**EME-01 (P1) Item do menu da Coordenação leva a outro módulo sem aviso, e a barra de Coordenação desaparece.**
- Leis: Lei de Jakob, orientação (onde estou), Lei de Fitts.
- Evidência: `supervisao-header.tsx:28` (`href: "/recepcao/emergencias"`); `app/recepcao/layout.tsx` monta `RecepcaoNav`, não o `SupervisaoHeader`; a página mostra kicker "Recepção" e título "Aviso em Massa, Ausência de Terapeuta" (`recepcao/emergencias/page.tsx:25-28`), diferente do rótulo do menu. `NavGroupDropdown` não tem como marcar item `external` (só `ModuleNavLink` tem, `module-header.tsx:37-38`).
- Problema: o coordenador clica no dropdown e cai numa tela com outra cor de faixa, outro menu e outro nome; para voltar, usa o logo ou o botão do navegador.
- Correção: expor a página também sob `/supervisao/emergencias` (re-exportando o componente), ou manter a rota mas mostrar o ícone de saída e o nome idêntico. Nome único: "Avisar falta de terapeuta".
- Esforço: S. Risco: baixo.

**EME-02 (P2) Ação urgente enterrada.** É uma situação de crise (terapeuta faltou, famílias a caminho) e custa 2 cliques e um dropdown. Leis: Pareto, Lei de Fitts. Correção: mover para um botão visível na barra (ícone de alerta) ou para o topo do dropdown com destaque; considerar atalho na tela do dia. Esforço: S.

Não li `EmergencyForm` por inteiro; vi `showConfirm` e botão "Enviar Avisos em Massa aos Responsáveis" (`emergency-form.tsx:~288`), e datas calculadas com `new Date()` do navegador (`:11-24`), não com o fuso da clínica (risco de dia errado perto da meia-noite). Esforço de correção: S.

### 2.8 Botão "Agenda" (grade semanal em tela cheia)

Resumo: o único lugar onde aparecem pendências da equipe e a carteira; o acesso é por um botão com nome ambíguo e os botões de ação são simulados.

**AGD-01 (P0) Botões "Lembrar" e "Ver PTS do Paciente" fingem ação.**
- Leis: confiança, erro de dados/ação.
- Evidência: `grade-panel.tsx:620-626` (`Lembrar` só chama `setNotification("Lembrete de evolução pendente enviado para ...")`), `:707-713` (idem PTS atrasado), `:582-590` ("Ver PTS do Paciente" só mostra "Visualização de PTS acionada para ..."). Nenhuma chamada a server action.
- Problema: a tela afirma que um lembrete foi enviado ao terapeuta e nada é enviado; o coordenador acredita ter cobrado a evolução atrasada. O botão "Ver PTS" não abre PTS nenhum.
- Correção: ligar "Lembrar" a uma action real (notificação ao terapeuta) ou remover; "Ver PTS do Paciente" abrir `PtsViewDialog`/prontuário. Enquanto não houver ação, retirar os botões.
- Esforço: M. Risco: baixo.

**AGD-02 (P1) Pendências de evolução e PTS atrasado só existem no fim da grade, dentro do overlay.**
- Leis: "a tela traz o trabalho", Zeigarnik, Hick.
- Evidência: `grade-panel.tsx:594-720` (blocos "Pendências da equipe" depois da grade e da legenda); o overlay só abre pelo botão "Agenda" (`supervisao-header.tsx:98-108`, `supervisao-shell.tsx:63-93`), sem badge. Os dados são buscados na raiz (`page.tsx:92-93,189-200`) mas não alimentam nenhuma aba nem contador (`supervisao-shell.tsx:50-52` só envia agenda1a, planos, inbox).
- Problema: evolução atrasada de terapeuta (controle de qualidade e faturamento) e PTS vencido (prazo de 50 dias) são trabalho diário do coordenador e estão em tela cheia atrás de um botão com nome de calendário, depois de rolar a grade.
- Correção: aba "Pendências da equipe" (ou bloco no topo da Caixa de entrada) com contador próprio; linha do botão "Agenda" sem essas listas.
- Esforço: M. Risco: baixo.

**AGD-03 (P1) A grade só mostra a semana atual.**
- Evidência: `page.tsx:42` (`currentWeek`), `grade-panel.tsx:140-163` sem estado de semana; compare com o calendário de 1ª avaliação, que tem ‹ Hoje › (`evaluation-calendar.tsx:~885-897`).
- Problema: o coordenador não consegue ver a semana seguinte para planejar permutas ou cobrir falta; o modo "Editar" só vale para a semana corrente.
- Correção: navegação de semana carregando por server action (como o calendário de avaliação).
- Esforço: M. Risco: baixo.

**AGD-04 (P2) Rótulos de nome inconsistentes para o mesmo lugar.** Botão "Agenda" (`supervisao-header.tsx:107`), cabeçalho do overlay "Agenda · visão total da clínica" (`supervisao-shell.tsx:79`), título interno "Grade semanal de supervisão" (`grade-panel.tsx:~322`), e a aba "Agenda 1ª Avaliação" é outra coisa. Leis: Jakob, Similaridade. Correção: "Grade da semana" para o botão e para o título, e "1ª Avaliação" para a aba.
Esforço: S.

**AGD-05 (P2) Cartões da "Carteira" sem comparativo (regra 1) e "Guia Vigente OK" inferido.**
- Evidência: `grade-panel.tsx:637-680`: "Sessões na grade", "Provisórias, sem guia" sem referência; só "Evolução em 24h" traz "Meta: 100%" (`:678`). `grade-panel.tsx:564` mostra "✓ Guia Vigente OK" para toda sessão que não seja `provisoria`, sem checar a autorização.
- Problema: números soltos violam a regra 1; um "OK" afirmativo gerado por exclusão induz erro.
- Correção: "Sessões na grade 214 · semana passada 208"; "Sem guia 6 · semana passada 9"; trocar o texto para "Guia: não verificado" quando só houver exclusão, ou ler `authorization_id`.
- Esforço: S.

**AGD-06 (P2) Sobreposição sem foco e sem fechar com Escape.** `supervisao-shell.tsx:70-92`: `role="dialog" aria-modal="true"`, mas sem Escape, sem foco inicial/retorno, `z-[100]` cobre a barra do módulo; `manualScheduleOpen` fica no contexto do layout (`supervisao-tab-context.tsx:75`), então Voltar do navegador sai da rota mas deixa o flag ligado, e a grade reabre sozinha ao voltar à raiz. Leis: teclado, foco visível. Correção: Escape, foco, reset do flag ao mudar de rota. Esforço: S.

**AGD-07 (P3) Cartões da grade sem teclado.** `AppointmentChip` é `div` com `onClick` (`grade-panel.tsx:~76-85`), sem `tabIndex`/`role="button"`. Esforço: S.

Já está bom: `sanitizePatientName` evita exibir chaves de banco (`Child_123`); detecção de conflito de terapeuta/sala; modo Edição explicita "2 ou 3 sessões", aviso de e-mail aos responsáveis e botão "Limpar seleção".

### 2.9 Menu pessoal: Minha Bonificação

**BON-01 (P3) Não consegui auditar a informação em si.** `metricas/page.tsx:1-49` só delega a `BonusProgressCard` (não lido). Para a regra 1, o cartão deve trazer comparativo (meta, mês anterior); confirmar. Além disso, o widget flutuante (`bonus-floating-widget.tsx`, polling de 180 s) fica fixo no canto de TODAS as telas e pode sobrepor a barra de ações em lote e os rodapés de formulário; considerar recolher por padrão. Esforço: S.

### 2.10 Rotas sem menu (leitura completa)

**REA-01 (P0) `/supervisao/reagendamentos`: tela sem menu, com consulta que provavelmente falha, e recusa que apaga o agendamento.**
- Leis: erro diz o que fazer, prevenção de erro, "o operador não deve caçar".
- Evidência: nenhum link para a rota (busca em app, components, lib). `reagendamentos/page.tsx:33` seleciona `patient:patients ( id, name )`, mas a tabela `patients` tem `full_name` (migration `20260904000002_patients.sql:1-5`; todas as outras telas usam `full_name`). Se a coluna não existe o PostgREST devolve erro e a tela mostra `Erro ao carregar fila: {error.message}` (`:195-197`). O status consultado, `aguardando_aprovacao_supervisao`, é o que `book_intake_lead_slot_atomic` grava ao agendar horário escolhido pela família (migration `20260909000001_update_intake_slot_booking.sql:52`). "Rejeitar" executa `.delete()` direto no appointment (`:82`), sem confirmação, sem motivo, sem aviso à família (`// TODO`), sem `revalidatePath` nas duas ações, sem checagem de papel (`createClient` no handler inline).
- Problema: agendamentos escolhidos pela família por WhatsApp aguardam aprovação do coordenador numa tela que ninguém acha e que (pelo schema) não carrega; se carregasse, um clique apaga o agendamento sem rastro e sem avisar a família, e a lista não atualizaria depois de aprovar.
- Correção: (1) corrigir a consulta para `full_name`; (2) incluir a fila na Agenda 1ª Avaliação (o banner de "confirmações pendentes" já faz algo parecido com `isProvisional`; unificar os dois conceitos de "aguardando aprovação") e dar badge; (3) rejeição como cancelamento com motivo e mensagem ao responsável; (4) `revalidatePath`.
- Esforço: M. Risco: médio (envolve envio de mensagem e unificação de status).

**LES-01 (P1) `/supervisao/lista-espera` não tem menu e a ação "Oferecer Vaga" registra oferta mesmo sem enviar nada.**
- Leis: Lei de Jakob, "o sistema decide o óbvio", prevenção de erro, regra 1.
- Evidência: sem links de entrada (busca). `lista-espera/actions.ts:60-96`: marca `oferecido` (`:72-75`) e só depois tenta WhatsApp; se o responsável não tem telefone (`:89`) ou o envio falha, retorna `success: true`; a mensagem não diz qual horário (`message: "Temos uma vaga ... Entre em contato com a recepção"`); a ação "Marcar Agendado" é manual (`entry-row-actions.tsx:44-46`). Cartões `lista-espera/page.tsx:82-111` (Aguardando, Tempo médio, Vagas oferecidas) sem comparativo (regra 1), e `specialty_value` cru na tabela (`:136`, valor de enum em vez de rótulo).
- Problema: o coordenador não acha a fila de espera; quando acha, a oferta pode ser registrada sem ter chegado à família, e o paciente sai da lista de "Aguardando" sem contato.
- Correção: item "Lista de espera" no dropdown (com badge de aguardando); só marcar `oferecido` quando o envio tiver sucesso; escolher o horário da vaga no momento da oferta (casar vaga liberada x fila automaticamente); mostrar rótulo da especialidade (a tabela `specialties` já é lida em `:55`); comparativos nos cartões.
- Esforço: M. Risco: médio (envio de mensagens).

**REU-01 (P1) `/supervisao/reunioes` e `/reunioes/nova` são telas sem nenhuma porta de entrada.**
- Evidência: `grep "reunioes"` fora da pasta só acha o drawer de base de conhecimento (`components/supervisao-knowledge-base-drawer.tsx`, nunca montado) e `lib/supervisao-knowledge-base-data.ts:275`. `reunioes/nova/page.tsx:12` exige `?paciente=` (senão `notFound()`), `reunioes/page.tsx:308` linka cada paciente para `/recepcao/pacientes/{id}` (outro módulo), e a tela nova volta para `/recepcao/pacientes/{id}` (`reunioes/nova/page.tsx:26`).
- Problema: nem a lista nem o registro de reunião (devolutiva, revisão de PTS, visita escolar) são alcançáveis; a regra de negócio depende deles (trigger fecha etapa do checklist, ver `reunioes/actions.ts` comentário inicial). Quem registra reunião hoje, se registra, chegou por URL colada.
- Correção: "Reuniões" na barra (lista com botão "Registrar reunião" que abre seletor de paciente) e link "Registrar reunião" dentro do Prontuário Unificado; trocar o `Link` do paciente por `/supervisao/prontuario-unificado?p=`.
- Esforço: M. Risco: baixo.

**ANA-01 (P3) Rotas de anamnese (`/supervisao/pacientes/[id]/anamnese` e `/tcle`)** não têm item de menu; chegam por `/gestor/pacientes/[id]` e pelo terapeuta (`app/gestor/pacientes/[id]/anamnese/page.tsx:14`). Não li o corpo. Aceitável se o coordenador as acessa pelo prontuário; confirmar que há link no Prontuário Unificado. Esforço: S.

## 3. Achados transversais do módulo

**TRV-01 (P1) A tela inicial é sempre a "Agenda 1ª Avaliação", não a fila do que precisa de ação.**
- Leis: regra 5 do brief ("a tela traz o trabalho"), Lei de Hick, Efeito Zeigarnik.
- Evidência: `supervisao-tab-context.tsx:74` (`useState("agenda1a")`); a raiz `page.tsx` calcula todos os contadores (`:304-306`, `:476-480`) mas nenhum decide a aba ou a ordem das abas.
- Problema: o coordenador com 4 PTS a aprovar, 2 relatórios e 1 detrator de NPS cai na grade de agenda; precisa olhar três pills e escolher. A ordem fixa das abas (Agenda, PTS, Caixa) também é arbitrária (Efeito da posição serial).
- Correção: uma aba/home "Hoje" (ou "Pendências") como primeira, listando por urgência: NPS detratores, relatórios para aprovar, PTS a aprovar, confirmações de agenda, reagendamentos, ausências, lista de espera, evolução atrasada, reavaliações vencendo, cada linha com ação inline e contagem. Ou, no mínimo, abrir na primeira aba com urgência.
- Esforço: M a L. Risco: médio.

**TRV-02 (P1) Contadores só valem na raiz e só depois de a raiz carregar.**
- Evidência: `supervisao-header.tsx:88-89` (`badge: onRoot ? counts[...]`); `counts` só é preenchido por `SupervisaoShell` (`supervisao-shell.tsx:50-52`), montado apenas pela `page.tsx` raiz.
- Problema: ao entrar em Disponibilidade, Recursos ou Prontuário, os badges somem; abrir diretamente uma rota filha (favorito, link do e-mail) nunca mostra contadores. Pendências que o módulo conhece (reagendamentos, lista de espera, evolução atrasada, reavaliações, relatórios, documentos) nem têm contador.
- Correção: calcular os contadores no `layout.tsx` (consulta leve só de `count`), exibi-los em todas as rotas; adicionar os que faltam.
- Esforço: M. Risco: baixo.

**TRV-03 (P1) Badge da Caixa de entrada subconta a própria caixa.**
- Evidência: `page.tsx:406`: `inboxMessages não resolvidas + ausências pendentes + NPS`. Ficam fora: documentos da família (`:380`), relatórios devolutivos pendentes (`:341`), reavaliações (`:326`) — todos renderizados dentro da mesma aba (`inbox-panel.tsx`).
- Problema: a aba mostra "0" ou "2" enquanto há relatório aguardando aprovação; o pill também não piscará (urgente só vem de acolhimentos, `supervisao-shell.tsx:53-55`).
- Correção: somar tudo o que a aba exibe; marcar urgente para NPS detrator e relatório pendente.
- Esforço: S. Risco: baixo.

**TRV-04 (P1) A raiz carrega todo o módulo em cada visita.**
- Leis: Limiar de Doherty.
- Evidência: `page.tsx:51-151` roda 16 consultas em paralelo mais cinco sequenciais (`:154`, `:207`, `:241`, `:380`); mensagens e ausências sem limite (INB-03); todos os PTS com todas as metas (`:94-101`); leads de convênio com ~40 colunas e arquivos (`:142-149`). Clicar em qualquer aba de fora da raiz repete tudo.
- Problema: abas diferentes pagam o custo de todas, e o conteúdo da aba ativa só aparece quando o servidor termina o conjunto inteiro. Não medi o tempo real.
- Correção: carregar por aba (rotas `/supervisao/pts`, `/supervisao/caixa`, `/supervisao/agenda-1a`) ou `Suspense` por bloco; contadores em consulta separada (TRV-02).
- Esforço: L. Risco: médio (muda o modelo de abas em memória).

**TRV-05 (P2) Nomes do módulo e das telas são inconsistentes.**
- Leis: Jakob, Similaridade.
- Evidência: faixa "Coordenação" (`supervisao-header.tsx:82`); URL e kicker "Supervisão" (`disponibilidade/page.tsx:51`, `feriados/page.tsx:108`, `reunioes/page.tsx:285`, `reunioes/nova/page.tsx:329`); kicker "Coordenação" em Recursos (`recursos/page.tsx:170`), "Gestão de Capacidade" em Lista de espera (`lista-espera/page.tsx:71`), "Recepção" no Aviso de falta; dropdown "Gestão e Escala" usa a palavra que nomeia o módulo do gestor; "Aviso Falta Terapeuta" (menu) vs "Aviso em Massa, Ausência de Terapeuta" (tela); "Prontuário Unificado" vs "Prontuário Eletrônico Unificado & Trilha de Auditoria"; "Agenda" vs "Agenda 1ª Avaliação" vs "Grade semanal de supervisão".
- Correção: uma convenção só (sugestão: "Coordenação" em tela e `supervisao` só na URL), rótulo de menu = título da tela.
- Esforço: S.

**TRV-06 (P1) Na tela estreita, os atalhos da barra não têm fallback.**
- Evidência: `module-header.tsx:210` renderiza `{actions}` dentro do `<header className="flex h-14 ... gap-6 px-6">` sem classes de ocultação; o fallback para tela estreita (`:233-262`) só lista os `items` (as 3 abas). Em `supervisao-header.tsx:92-109`, Prontuário, "Gestão e Escala" e "Agenda" ficam sempre na faixa de 56 px junto do logo e do menu do usuário. Não verifiquei visualmente.
- Problema: em celular/tablet estreito é provável estourar a largura (rolagem horizontal ou botões cortados). O coordenador também usa o celular para aprovar e conferir.
- Correção: abaixo de `lg`, mover Prontuário, dropdown e Agenda para a segunda linha de navegação (ou para um menu "Mais"), com alvos de 44 px.
- Esforço: S a M. Risco: baixo.

**TRV-07 (P2) Dropdown "Gestão e Escala" com acessibilidade incompleta.**
- Evidência: `nav-group-dropdown.tsx:59-89`: `role="menu"`/`role="menuitem"` sem navegação por setas, sem retorno do foco ao botão ao fechar com Escape, sem foco inicial no primeiro item; o item de outro módulo não indica saída (sem prop `external`).
- Problema: quem navega por teclado cai numa semântica ARIA que promete setas e não as entrega; quem usa leitor de tela perde o contexto.
- Correção: seguir o padrão de menu de ações (setas, Home/End, Escape devolvendo foco) ou usar `<details>`/lista de links sem `role="menu"`; usar `external` no item de Recepção.
- Esforço: S. Risco: baixo.

**TRV-08 (P2) Base de conhecimento e telas mortas com rotas que não existem.**
- Evidência: `components/supervisao-knowledge-base-drawer.tsx` não é montado em nenhum lugar (busca por `SupervisaoKnowledgeBaseDrawer`); `lib/supervisao-knowledge-base-data.ts:81,130,179,180,227,276,318` aponta para `/supervisao?tab=acolhimento|grade|planos|avaliacoes|nps|prontuario`, `?filter=...` e `/supervisao/planos?view=templates`, nenhum desses lidos por `page.tsx` (não usa `searchParams`) nem existentes como rota; `evaluation-quick-view.tsx` (585 linhas) não é importado por ninguém; comentário de `lib/roles.ts:46-48` fala de uma "aba Fluxos" (`fluxos-panel.tsx`) que não existe mais.
- Problema: se o drawer for ligado, 8 atalhos quebram; código morto dificulta manutenção e esconde onde está a ajuda do coordenador.
- Correção: decidir entre ligar a ajuda (com rotas reais) ou remover; suportar `?tab=` na raiz abre porta para links de e-mail e notificações.
- Esforço: S (remover) / M (ligar). Risco: baixo.

**TRV-09 (P2) Cabeçalhos e larguras de página heterogêneos.**
- Evidência: `PageHeader` (disponibilidade, feriados, novo PTS), `h6` + `h1` (recursos, reuniões, lista de espera), `h1` com `text-2xl` Tailwind (reagendamentos, `reagendamentos/page.tsx:201`, `metricas/page.tsx:370`), `<main>` aninhado dentro do `<div>` do layout em várias (`recursos/page.tsx:166`, `reunioes/page.tsx:281`, `lista-espera/page.tsx:66`) e `max-w-[900px]` nos cartões de Recursos; uso de `text-red-500`, `bg-green-600`, `text-gray-500` crus em `reagendamentos/page.tsx:196,210,231` e `#fff` em vez dos tokens.
- Problema: cada tela parece de um produto diferente, e a aba "Prontuário" com `<main>` repetido gera landmarks duplicados.
- Correção: um componente de cabeçalho de página (título, ajuda, ação primária) e tokens de cor.
- Esforço: M. Risco: baixo.

**TRV-10 (P2) Estados de erro e carregamento inconsistentes nas telas do módulo.**
- Evidência: `reagendamentos/page.tsx:195-197` imprime `error.message` bruto; `nps-alerts-panel.tsx:56-60` descarta erro; `lista-espera/page.tsx` ignora `error` das quatro consultas; `reunioes/page.tsx:273` idem; `feriados/page.tsx:113-117` trata erro (bom exemplo).
- Problema: falha de banco vira lista vazia ("Nenhuma reunião registrada") ou texto técnico.
- Correção: padrão único "Não foi possível carregar X. Tentar de novo" com botão; `loading.tsx` na pasta `app/supervisao`.
- Esforço: M. Risco: baixo.

**TRV-11 (P2) KPIs sem comparativo em várias telas (regra 1).** Lista de espera (3 cartões, `lista-espera/page.tsx:82-111`), Carteira da grade (AGD-05), cartões do prontuário (PRO-03), badge numérico da barra (contagem, não KPI). Correção: linha compacta "valor · período anterior · variação" ou remover o cartão. Esforço: S a M.

**TRV-12 (P3) Dois conceitos de "aguardando confirmação do supervisor" para a mesma coisa.** `aguardaConfirmacao` (appointment provisório e `agendada`, `lib/evaluation-pending-pure.ts:7-14`) alimenta o banner da Agenda 1ª Avaliação; `aguardando_aprovacao_supervisao` alimenta Reagendamentos (REA-01). Duas filas com nomes e telas diferentes para o mesmo gesto do coordenador. Unificar na aba Agenda 1ª Avaliação. Esforço: M.

## 4. O que já está bom

- Cabeçalho único em `layout.tsx` (não remonta entre rotas); os itens e o dropdown já foram consolidados (de 11 links para 3 abas + 1 link + 1 dropdown + 1 botão); alvos de 44 px (`min-h-[44px]`).
- Aprovação de PTS com bloqueio visível e contagem de pendentes; fila ordenada com rascunhos primeiro; busca na lista.
- Calendário de 1ª avaliação: arrastar e soltar, "Sugerir data mais próxima", validação de disponibilidade/feriado/fechamento, banner de confirmações pendentes, erros em linguagem do operador.
- Feriados: avisa quantos agendamentos já marcados caem no período e que NÃO foram alterados (`closures-manager.tsx:~38-44`).
- Prontuário com identidade, convênio e contato de emergência no topo; compartilhamento com a família restrito a supervisor/gestor.
- `sanitizePatientName` na grade e estados vazios com texto na maioria das listas.

## 5. Lacunas: o que NÃO consegui auditar e por quê

- Nada foi executado nem visto no navegador (instrução do brief): afirmações sobre largura em telas estreitas (TRV-06), bloqueio do guard em `/terapeuta/evolucao` (PRO-01) e falha da consulta de reagendamentos (REA-01) vêm de leitura de código e schema, não de teste.
- Não li por inteiro: `acolhimento-lead-drawer.tsx` (540 linhas, drawer de validação de documentos e agendamento, onde está a ação principal do item urgente), `evaluation-calendar.tsx` linhas 1 a 860 (hooks, arrasto, validação), `family-meeting-modal.tsx` e `patient-feedback-modal.tsx` (corpo do formulário), `planos/novo/plan-form.tsx`, `pts-calendar-view.tsx`, `pts-template-modal.tsx` (fluxo de criar PTS), `pts-view-dialog.tsx`, `availability-manager.tsx`, `closures-manager.tsx` (resto), `book-resource-form.tsx`, `new-entry-dialog.tsx`, `intake-profile-dialog.tsx`, `anamnese` e `tcle`, `UserMenu`, `BonusProgressCard`, `BrandLockup`.
- Não li `approveDevolutionReport` (`app/terapeuta/paciente/[patientId]/relatorio/actions.ts`): a gravidade de INB-01 depende de ela publicar na hora ou não.
- Não li as server actions de agendamento/permuta (`grade-actions.ts`, `evaluation-calendar-actions.ts`, `acolhimento-actions.ts`) nem as políticas RLS; guardas de papel das actions de lista de espera, recursos e reagendamentos não foram confirmados (as de disponibilidade e feriados têm `MANAGER_ROLES`).
- Não verifiquei se existe outro ponto de entrada para `/supervisao/lista-espera`, `/reunioes`, `/reagendamentos` fora dos diretórios `app`, `components` e `lib` (por exemplo, notificações, e-mails, atalhos externos).
- Os cartões de métrica e a lógica de `lib/evaluation-agenda.ts` (o que entra em `pool` e em "prontos") não foram lidos; o cálculo do badge de Agenda 1ª Avaliação (`page.tsx:154-155`) depende dele.

## 6. Top 10 por impacto/esforço

1. PTS-01 (P0, S): esconder/corrigir o Relatório de Reavaliação, que imprime dados inventados de paciente, convênio e supervisora.
2. AGD-01 (P0, S/M): remover ou ligar os botões "Lembrar" e "Ver PTS", que dizem ter enviado algo e não enviam.
3. REA-01 (P0, M): corrigir `name` para `full_name`, dar menu e badge à fila de reagendamentos e trocar o DELETE da recusa por cancelamento com motivo e aviso.
4. TRV-01 + TRV-03 + TRV-02 (P1, M): home "Hoje" por urgência, contador da Caixa de entrada completo e contadores em todas as rotas do módulo.
5. AGE-01 + AGE-02 (P1, S/M): listar os pacientes prontos para agendar e abrir a sub-aba que tem a urgência.
6. PTS-04 + PTS-03 (P1, S/M): "Validar tudo e aprovar" e filtro "A aprovar / Devolvidos / Vigentes" com badge só do que é do coordenador.
7. INB-01 + INB-02 (P1, S/M): revisão de relatório com texto completo antes de aprovar e ordenação da caixa por urgência com contadores clicáveis.
8. EME-01 + EME-02 (P1/P2, S): tornar "Aviso Falta Terapeuta" parte do módulo (rota sob `/supervisao`) e dar visibilidade à ação de crise.
9. LES-01 + REU-01 (P1, M): colocar Lista de espera e Reuniões no menu; só marcar vaga como "oferecida" quando o envio ocorrer.
10. PTS-02 (P0, M, risco alto): parar de gravar meta aprovada como "atingida" e corrigir os contadores (depende de decisão do dono por causa da migração de dados).
