# Auditoria UX: Gestão, parte B (Cadastros, Financeiro, Relatórios, Auditoria, Configurações)

Escopo lido por inteiro: `components/gestor-nav.tsx`, `app/gestor/layout.tsx`, `components/module-header.tsx`, `components/section-sidebar.tsx`, `components/financeiro-subnav.tsx`, `financeiro-hub-subnav.tsx`, `finance-hub-month-picker.tsx`, `auditoria-subnav.tsx`, `FINANCEIRO-HUB.md`, todas as telas, diálogos e actions de `app/gestor/{cadastros,financeiro,financeiro-hub,contratos,convenios,relatorios,auditoria,ouvidoria,facilidade-de-uso,configuracoes}`. Para checar duplicidade li também `app/faturamento/repasses/actions.ts`, `repasses-actions.tsx` e o cabeçalho do Faturamento. Nada foi executado (sem servidor, sem testes): onde o achado depende de comportamento em runtime, está marcado como "por leitura de código".

Convenção de cliques: contados a partir de qualquer tela da Gestão (a barra superior é fixa, então o item de menu custa 1 clique).

---

## 1. Mapa de menus

### 1.1 Barra superior da Gestão (parte B)

| Item | Rota (aterrissagem) | Tela(s) | Tarefa do operador | Cliques da tarefa principal |
|---|---|---|---|---|
| Cadastros | `/gestor/cadastros` redireciona para `/colaboradores` | sidebar "Clínica" com 11 itens (tabela 1.2) | manter as entidades da clínica (quem, o quê, onde) | 1 para chegar, 2 para qualquer outro item da sidebar, 3 para criar registro |
| Financeiro | `/gestor/financeiro` (Repasses & Glosas) | subnav com 4 abas (tabela 1.3) | fechar repasses, pagar contas, cobrar contratos particulares, ver resultado | Fechar repasses: 1. Pagar conta: 2 + 1 por linha. Faturar contrato: 2 + 1 por paciente |
| Relatórios | `/gestor/relatorios` | exportador CSV de 4 passos numerados | baixar dados em planilha | 1 + 4 passos (categoria, filtros, colunas, exportar) |
| Auditoria (LGPD) | `/gestor/auditoria` | subnav com 4 abas (tabela 1.4) | ver acessos a prontuário, pendências escaladas, ouvidoria, telemetria de uso | 1 a 2 |
| Configurações | `/gestor/configuracoes` redireciona para `/dados-da-clinica` | sidebar "Sistema" com 5 itens (tabela 1.5) | parâmetros do sistema | 1 para chegar, 2 para os demais |

### 1.2 Cadastros (sidebar "Clínica", `cadastros-sidebar.tsx:6-21`)

| Item | Rota | Tela | Tarefa | Cliques |
|---|---|---|---|---|
| Colaboradores & Contas | `/gestor/cadastros/colaboradores` | `colaboradores/page.tsx`, `staff-table.tsx`, `staff-dialog.tsx` | criar conta, trocar papel, resetar senha/PIN, inativar | criar: 3 |
| Planos de Saúde | `/gestor/cadastros/convenios` (+ `[insurerId]/precos`) | `convenios/page.tsx`, `insurer-form.tsx`, `insurer-list-item.tsx`, `precos/page.tsx` | cadastrar plano, cor do selo, tabela de preços | plano: 2. Preço: 3 |
| Tipos de Atendimento | `/gestor/cadastros/tipos-atendimento` | `atendimentos-manager.tsx`, `appointment-type-dialog.tsx` | procedimento por plano, duração, regra de estagiário | 3 |
| Protocolos | `/gestor/cadastros/protocolos` (abas Protocolos / Instrumentos rápidos) | `protocolos/page.tsx`, `protocolos-tabs.tsx`, `instrumentos-manager.tsx`; filhas em `/terapias/nova` e `/terapias/[protocolId]` | cadastrar protocolo e itens, ativar instrumentos | 3 a 4 |
| Especialidades | `/gestor/cadastros/especialidades` | `especialidades-manager.tsx` | lista de especialidades | 2 |
| Comportamentos-alvo | `/gestor/cadastros/comportamentos` | `comportamentos-manager.tsx` | catálogo da evolução | 2 |
| Modalidades de AT | `/gestor/cadastros/modalidades-at` | `modalidades-at-manager.tsx` | catálogo do AT | 2 |
| Intervenções | `/gestor/cadastros/intervencoes` | `intervencoes-manager.tsx` | catálogo da evolução | 2 |
| Templates do PTS | `/gestor/cadastros/pts-templates` | `pts-templates-manager.tsx` | banco de metas do PTS | 3 |
| Salas & Recursos | `/gestor/cadastros/salas` (4 abas) | `salas/atendimentos-manager.tsx`, `room-row.tsx`, `turmas-aba-panel.tsx` | salas, turmas de Treino ABA, recursos, motivos | 3 a 4 |
| Estoque & Almoxarifado | `/gestor/cadastros/estoque` | `estoque/page.tsx`, `new-item-dialog.tsx`, `movement-dialog.tsx` | dar entrada/saída de material | 3 |

### 1.3 Financeiro (`financeiro-subnav.tsx:7-12`)

| Aba | Rota | Tela | Tarefa | Cliques |
|---|---|---|---|---|
| Repasses & Glosas | `/gestor/financeiro` | `financeiro/page.tsx`, `financeiro-tabs.tsx` (radio Repasses/Glosas) | fechar repasses do mês, marcar pago, ver glosas | 1 + 1 (fechar) |
| Contratos Particulares | `/gestor/contratos` | `contratos/page.tsx`, `invoice-actions.tsx`, `new-contract-dialog.tsx` | contrato, fatura mensal, baixa | 2 + 1 por paciente |
| Contas a Pagar | `/gestor/financeiro/contas-a-pagar` | `contas-a-pagar/page.tsx`, `expense-row-actions.tsx`, `new-expense-dialog.tsx` | lançar e pagar despesa | 2 + 1 |
| DRE & Fluxo de Caixa | `/gestor/financeiro/dre` | `dre/page.tsx` + `remittance-panel.tsx` + `contas-a-pagar-panel.tsx` | ver resultado, subir nota do plano, lançar contas usuais | 2 |
| (sem item de menu) Financeiro HUB: DRE Consolidado, Balanço, Fluxo de Caixa, Lançamentos Manuais | `/gestor/financeiro-hub/*` | `financeiro-hub/**` | consolidar 3 unidades do grupo | só por URL digitada |
| (legado) `/gestor/convenios` | redireciona para Cadastros > Planos de Saúde | `convenios/page.tsx:3-6` | n/a | n/a |

### 1.4 Auditoria (`auditoria-subnav.tsx:7-12`)

| Aba | Rota | Tela | Tarefa | Cliques |
|---|---|---|---|---|
| Acesso a Prontuários (LGPD) | `/gestor/auditoria` | `auditoria/page.tsx` (abre com "Pendências escaladas", depois o log LGPD) | cobrar pendências travadas, responder "quem viu o prontuário" | 1 |
| Sessões canceladas | `/gestor/auditoria/sessoes` | `sessoes/page.tsx` | rastrear sessões que não ocorreram | 2 |
| Ouvidoria & Incidentes | `/gestor/ouvidoria` | `ouvidoria/page.tsx`, `new-incident-dialog.tsx`, `incident-status-form.tsx` | registrar e tratar reclamação/evento adverso | 2 + 1 |
| Facilidade de uso | `/gestor/facilidade-de-uso` | `facilidade-de-uso/page.tsx`, `data.ts` | ver onde a equipe tropeça no sistema | 2 |

### 1.5 Configurações (sidebar "Sistema", `config-sidebar.tsx:16-22`)

| Item | Rota | Tela | Tarefa | Cliques |
|---|---|---|---|---|
| Dados da Clínica | `/gestor/configuracoes/dados-da-clinica` | `dados-clinica-form.tsx` | nome, CNPJ, endereço, RT que saem no timbre dos PDFs | 1 |
| Regras de Agendamento | `/gestor/configuracoes/prioridades-avaliacao` | `prioridades-manager.tsx` | níveis de prioridade da 1ª avaliação por plano | 2 |
| Usuários & Permissões (seta de saída) | leva a `/gestor/cadastros/colaboradores` | mesma tela de Cadastros | gerir contas | 2 |
| Cupom de Check-in | `/gestor/configuracoes/cupom-checkin` | `cupom-manager.tsx` | layout do cupom da recepção | 2 |
| Robô do portal | `/gestor/configuracoes/robo-portal` | `robo-portal-manager.tsx` | cadastrar computador do robô | 2 |

### 1.6 Rotas sem item de menu próprio (órfãs ou só alcançáveis por link interno)

- `/gestor/financeiro-hub/**` (4 telas): intencionalmente sem menu (`financeiro-hub-subnav.tsx:3-10`, `FINANCEIRO-HUB.md:13-14`). Ver HUB-01.
- `/gestor/configuracoes/profissionais` (Contratos & Valor por módulo): vive na pasta de Configurações, mas só é linkada pela subnav de Pessoas & Desempenho (`components/equipe-subnav.tsx:11`). Ver CFG-01.
- `/gestor/cadastros/terapias/nova` e `/terapias/[protocolId]`: só por botões da tela Protocolos, e a sidebar perde o item ativo. Ver CAD-02.
- 14 rotas só de redirect (legado): `/gestor/convenios`, `/gestor/convenios/[id]/precos`, `/gestor/protocolos`, `/gestor/atendimentos`, `/gestor/equipe`, `/gestor/cadastros/{pacientes,instrumentos,terapias}`, `/gestor/configuracoes/{instrumentos,usuarios,atendimentos,especialidades,comportamentos,intervencoes}`. Ver TRV-10.

---

## 2. Achados por item de menu (na ordem do menu)

### (5) Cadastros

Resumo: 11 itens planos numa sidebar, quatro deles clones do mesmo mini-CRUD, e as telas mais usadas (Colaboradores, Planos, Tipos) têm ações destrutivas coladas e sem desfazer. Há dois recursos que prometem algo que o sistema não faz (Novo Instrumento e a chave "recorrente" já está em Financeiro).

**CAD-01 · P2 · Lei de Miller, Lei de Hick, Pareto**
- Evidência: `cadastros-sidebar.tsx:6-18` (11 itens sem grupos). Quatro telas têm estrutura idêntica (nome, chave, ativar/desativar, formulário de 1 a 2 campos): `especialidades-manager.tsx:95-161`, `comportamentos-manager.tsx:93-159`, `intervencoes-manager.tsx` (mesmo padrão, h1 na linha 101), `modalidades-at-manager.tsx:41-102`.
- Problema: 11 itens passam de 7±2 e misturam o que se usa toda semana (Colaboradores, Planos, Tipos, Salas) com catálogos que se tocam uma vez por ano. O operador lê 11 rótulos para achar um.
- Correção: agrupar a sidebar em 4 blocos com cabeçalho (Pessoas: Colaboradores; Faturamento: Planos de Saúde, Tipos de Atendimento; Clínico: Protocolos, Templates do PTS, Catálogos; Espaço: Salas, Estoque) e fundir Especialidades + Comportamentos-alvo + Intervenções + Modalidades de AT em uma tela "Catálogos clínicos" com 4 abas e um único componente genérico. 11 itens viram 7.
- Esforço: M. Risco: baixo (rotas antigas redirecionam, já é padrão do repo).

**CAD-02 · P2 · Lei de Jakob, Lei de Tesler**
- Evidência: `section-sidebar.tsx:41-49` calcula o ativo por prefixo do `href`; o item Protocolos tem `href=/gestor/cadastros/protocolos` (`cadastros-sidebar.tsx:10`) mas os botões levam a `/gestor/cadastros/terapias/nova` e `/terapias/[id]` (`protocolos/page.tsx:36,67-69`). Texto desatualizado: `cadastros/page.tsx:3-5` diz que "Pacientes é o primeiro item"; `cadastros/loading.tsx:4` ainda diz "Carregando lista de pacientes, equipe e planos de saúde". O título da sidebar é "Clínica" (`cadastros-sidebar.tsx:21`) enquanto o menu superior diz "Cadastros".
- Problema: ao abrir um protocolo, a sidebar fica sem nenhum item marcado e o operador perde "onde estou". Nomes inconsistentes (Cadastros, Clínica, terapias, protocolos).
- Correção: mover as rotas para `/gestor/cadastros/protocolos/nova` e `/protocolos/[id]` (mantendo redirect), ou passar `match` extra ao item. Alinhar título da sidebar ("Cadastros") e o texto do loading.
- Esforço: S. Risco: baixo.

**CAD-03 · P1 · Lei de Fitts, Lei de Tesler, risco de erro**
- Evidência: `staff-table.tsx:267-324`: cinco ações em texto de 12px lado a lado (Editar, Senha, PIN, Inativar, Excluir). "Inativar" (linha 304-313) e "Excluir" (314-323) ficam a poucos pixels. `deleteStaff` apaga o perfil e o usuário de login (`actions.ts:258-295`) e, em falha de FK, devolve `profileError.message` cru (linha 283).
- Problema: a ação rotineira (Editar) e a irreversível (Excluir) têm o mesmo peso e alvo pequeno; excluir quem já tem histórico clínico provavelmente falha com mensagem técnica, e o sistema não ensina "inative em vez de excluir".
- Correção: manter só "Editar" visível e mover Senha, PIN, Inativar e Excluir para um menu de 3 pontos; mostrar Excluir apenas para quem está inativo e sem histórico; no erro de FK, dizer "Este colaborador tem registros no sistema. Inative em vez de excluir." Alvos de 44px.
- Esforço: S. Risco: baixo.
- Já está bom: confirmações em modal para inativar/senha/PIN/excluir (`staff-table.tsx:387-537`), senha temporária mostrada uma vez com botão copiar (449-482), bloqueio de autoexclusão (`actions.ts:221,263`).

**CAD-04 · P2 · Lei de Tesler, Lei de Jakob, risco de erro**
- Evidência: `staff-dialog.tsx:152-164` obriga o gestor a inventar a "Senha inicial" (campo `type="text"`, visível) com checklist de força; o sistema já sabe gerar senha temporária segura e forçar troca (`actions.ts:320-380`, `buildTempPassword`) mas `createStaff` não usa isso (`actions.ts:47-155`, sem `must_change_password`). Rótulos técnicos: "RBAC" (`colaboradores/page.tsx:72`), "abre o módulo /at" (`staff-dialog.tsx:232`), "Conselho / especialidade" com placeholder CRP (187-194). Troca de papel (171-183) salva sem confirmação ou aviso do que muda de acesso.
- Problema: a complexidade é empurrada ao gestor (criar senha, anotar, repassar) e a senha fica conhecida por quem a digitou, sem troca obrigatória. Trocar o papel de alguém para gestor é uma mudança de permissão de um clique.
- Correção: criar conta gerando a senha temporária (mesmo modal "Senha temporária gerada") com `must_change_password=true`; remover o campo de senha. Trocar "RBAC" por "perfil de acesso" e "/at" por "Acompanhamento Terapêutico". Ao mudar o papel, mostrar uma linha "Passa a ter acesso a: ..." e pedir confirmação quando o novo papel for gestor.
- Esforço: M. Risco: médio (fluxo de login do primeiro acesso precisa estar pronto, já existe para reset).

**CAD-05 · P2 · Lei de Jakob, dados**
- Evidência: o cadastro usa cores em hex (`insurer-form.tsx:7-15`, valor padrão `#16a34a` linha 21) e a edição usa chaves nomeadas (`insurer-list-item.tsx:19-28`, `useState(insurer.badge_color ?? "emerald")` linha 38) com o `<select>` de 8 opções (146-158). Um plano criado com hex não tem opção correspondente no select. Por leitura de código, salvar a edição (mesmo só do nome) tende a regravar a cor com outro valor.
- Problema: duas paletas incompatíveis; a cor do selo, que aparece ao lado do nome do paciente, pode mudar sem o gestor ter tocado nela. Erros de `deleteInsurer` e outros trazem `error.message` cru (`convenios/actions.ts:59,92,142,167`).
- Correção: uma única lista de cores (hex) compartilhada pelo formulário e pela edição, e no modal de edição escolher o valor atual por correspondência; no erro de exclusão, "Este plano tem pacientes ou guias vinculados. Desative-o em vez de excluir" (hoje a mensagem sugere só "verifique").
- Esforço: S. Risco: baixo.

**CAD-06 · P1 · risco de erro com dinheiro, Lei de Tesler, Lei de Miller**
- Evidência: `precos/page.tsx:83-126` lista os preços sem botão de editar ou excluir; `price-table-form.tsx:171-366` é um único formulário com 13 campos em linha (código, nome, preço, 2 vigências, duração, sessões/guia, validade do pedido, validade da guia, autorização, 2 alertas) e `createPriceTableEntry` (`precos/actions.ts:6-71`) insere sem checar repetição de código e vigência.
- Problema: um preço digitado errado vira base do fechamento de competência e não há como corrigi-lo nem removê-lo na tela. O formulário gigante despeja campos raros (escada de exigências, regra de frequência) junto com os obrigatórios.
- Correção: linha editável/excluível (com confirmação) e ao inserir novo preço para o mesmo código encerrar a vigência anterior automaticamente (mostrar "o preço anterior passa a valer até DD/MM"); dividir o formulário em "Essencial" (código, nome, preço, vigência) e "Regras do plano" recolhido; alerta de duplicidade.
- Esforço: M. Risco: médio (precisa respeitar o histórico usado no faturamento).

**CAD-07 · P3 · conteúdo hardcoded e efeito colateral em leitura**
- Evidência: `precos/page.tsx:37-42` chama `ensureProasaCatalog` a cada visualização da tela (escrita num GET); `precos/page.tsx:77` e `load-proasa-button.tsx:395` com "Contrato nº 12473" e "21 Procedimentos" fixos no código.
- Problema: ver a tela pode gravar dados; texto específico de um plano no componente genérico.
- Correção: mover a semeadura para um botão explícito (já existe) e tirar do render; texto vindo de dados.
- Esforço: S. Risco: baixo.

**CAD-08 · P2 · Lei de Hick, Lei de Fitts, Doherty**
- Evidência: `tipos-atendimento/atendimentos-manager.tsx:46-86` (uma aba por plano mais "Todos" e "Geral", cresce com o número de planos), tabela de 7 colunas (100-110) com "Recorrência / Exibição" e "Regra Estagiários"; exclusão por `window.confirm` (`delete-appointment-type-button.tsx:17`) enquanto o diálogo já tem o interruptor "ativo" (`appointment-type-dialog.tsx:152-164`); erro de exclusão genérico (`tipos-atendimento/actions.ts:133`); a tela usa `DEV_CLINIC_ID` (`page.tsx:12-22`) enquanto Colaboradores/Planos usam a clínica do perfil.
- Problema: filtro por plano em chips vira uma fileira longa; "Excluir" é permanente e a mensagem de falha não diz que o caminho é desativar.
- Correção: trocar chips por um `<select>` de plano (padrão da maioria dos filtros do sistema), tirar "Exibição" do rótulo, esconder Excluir quando o tipo já foi usado e sugerir "Desativar". Padronizar para o modal de confirmação.
- Esforço: S. Risco: baixo.

**CAD-09 · P1 · feedback de sucesso falso, risco de erro de dados**
- Evidência: `instrumentos-manager.tsx:56-83` (`handleAddInstrument` só chama `setInstruments` local com `custom_${Date.now()}`, nunca grava), botão "+ Novo Instrumento" (118-124). O servidor declara que não existe criação: `instrumentos/actions.ts:10-15` ("Não há create nem delete: o catálogo é código") e rejeita chaves desconhecidas (linha 21-23).
- Problema: o gestor "cadastra" um instrumento, vê na lista, e ele some ao atualizar; se tentar Desativar a linha fantasma, recebe "Instrumento desconhecido."
- Correção: remover o botão e o modal, ou implementar persistência de verdade. Se o catálogo é código, dizer isso numa linha ("novos instrumentos exigem atualização do sistema") em vez de oferecer um formulário.
- Esforço: S. Risco: baixo.

**CAD-10 · P2 · Lei de Jakob, Lei de Hick, Von Restorff**
- Evidência: `protocolos/page.tsx:42-52` (8 colunas, inclusive "Licença comprada em" e "Risco de digitização aceito por"), `:66-70` três botões de `QuickActionsBar` (Perfil, Editar, Agenda) apontando para a mesma URL `/terapias/${p.id}`; `components/quick-actions-bar.tsx:44-48` rotula o terceiro como "Agenda". `terapias/nova/page.tsx:17` intitula "Cadastrar protocolo licenciado" mas `protocol-form.tsx:13` abre em modo "genérico"; `protocol-form.tsx:68` cita o caminho de arquivo `docs/protocolos-genericos-fontes.md` na tela. `terapias/[protocolId]/page.tsx:91-100`: "Remover" item de protocolo sem confirmação. `protocolos-tabs.tsx:25-34`: botões como abas sem `role="tab"`/`aria-selected`. O `instrumentos-manager.tsx:101` traz outro `<h1>` dentro da aba.
- Problema: três botões que fazem a mesma coisa (um deles chamado Agenda, num protocolo) poluem cada linha; jargão jurídico e de arquivo na tela; remover item de avaliação é um clique sem volta.
- Correção: um único link "Abrir" (ou a linha inteira clicável); colunas de licença/risco viram detalhe da página do protocolo; título coerente com o modo; confirmar "Remover" (ou desfazer por 5 s); remover referência a arquivo.
- Esforço: S. Risco: baixo.

**CAD-11 · P2 · Doherty, Lei de Jakob, consistência**
- Evidência: `void toggleSpecialtyActive(...)` em `especialidades-manager.tsx:79-81`, `void toggleBehaviorActive` em `comportamentos-manager.tsx:77-79`, `void toggleInterventionActive` em `intervencoes-manager.tsx:78`, `void toggleAtModalityActive` em `modalidades-at-manager.tsx:29-31`: o resultado é descartado e a `startTransition` com callback síncrono termina na hora, então não há estado de carregamento nem erro se a ação falhar. Coluna "Chave" com `<code>` (`especialidades-manager.tsx:37`, `comportamentos-manager.tsx:36`). Disciplina em texto livre (`comportamentos-manager.tsx:147-151`) enquanto Instrumentos e Templates usam lista fixa (`DISCIPLINES`). Modalidades de AT não permite renomear nem editar a descrição (`modalidades-at-manager.tsx:14-39`), ao contrário dos outros três. Parágrafo longo visível com jargão ("Alerta de Necessidade de Estagiário em Inteligência (BI)", "sistema de gestão de pessoas do Grupo IB") em `especialidades-manager.tsx:104-111`.
- Problema: falha silenciosa ao desativar, nome de tabela ("Chave") exposto, e quatro telas parecidas que se comportam diferente.
- Correção: um componente genérico (ver CAD-01) com `useTransition` correto, toast de erro, sem coluna Chave, disciplina como select e renomear em todos; texto de ajuda atrás do "?" do `PageHeader`.
- Esforço: M. Risco: baixo.

**CAD-12 · P3 · Doherty, acessibilidade**
- Evidência: `pts-templates-manager.tsx:62` (`window.location.reload()` após salvar, perde filtro e rolagem); abreviações "LB:" e "Est:" (171-177) e "Critério de Mastery" (~311); emoji no título (87); rótulos em 10px (`text-[10px]`, linhas 122, 135); modal sem `role="dialog"` e botão ✕ sem rótulo (232-243).
- Problema: recarga completa para atualizar uma linha; leitura difícil e jargão em inglês.
- Correção: `router.refresh()` ou atualizar o estado local com a resposta; escrever "Linha de base" e "Estratégia"; 12px mínimo.
- Esforço: S. Risco: baixo.

**CAD-13 · P2 · Lei de Hick, Lei de Tesler**
- Evidência: `salas/atendimentos-manager.tsx:25,38-79` (4 abas dentro de um item de sidebar: Salas, Turmas ABA, Recursos, Motivos). A aba Motivos (166-187) é uma lista fixa só de leitura, com a explicação "mudar aqui exigiria mudar o código" (169-171). A aba Recursos (133-157) não tem editar nem excluir, ao contrário das salas (`room-row.tsx:105-134`). Excluir sala e turma usa `confirm()` nativo (`room-row.tsx:122`, `turmas-aba-panel.tsx:129`). Selects sem `<label>` no formulário de turma (`turmas-aba-panel.tsx:53-82`). Parágrafos explicativos longos acima de cada tabela (85-91, `turmas-aba-panel.tsx:24-30`).
- Problema: terceiro nível de navegação (barra, sidebar, abas) e uma aba que não permite nenhuma ação; um recurso cadastrado com erro de digitação não tem correção.
- Correção: retirar a aba Motivos daqui (documentação ou apenas no ponto onde se registra falta); editar/excluir recursos; sala e turma juntas numa única aba "Espaços" (turma é filha de sala).
- Esforço: M. Risco: baixo.

**CAD-14 · P1 · REGRA 1 do AGENTS.md (KPI sem comparativo)**
- Evidência: `estoque/page.tsx:51-84`: "Total de Itens Cadastrados" (N tipos de materiais), "Itens em Nível Crítico" (N), "Patrimônio em Material Clínico" (R$). Nenhum compara com mês anterior ou meta. O de "Nível Crítico" tem referência implícita (mínimo cadastrado), mas o total e o patrimônio são números soltos.
- Problema: "Total de itens" é métrica de vaidade; "Patrimônio" muda sem contexto. Fere a regra 1.
- Correção: trocar o tile "Total" por "Itens abaixo do mínimo: X de Y (Z%)" com variação vs 30 dias; patrimônio com "vs mês anterior" (exige gravar snapshot mensal ou somar `inventory_movements`).
- Esforço: M. Risco: baixo.

**CAD-15 · P2 · Zeigarnik, Pareto, integridade**
- Evidência: `estoque/page.tsx:29` ordena por nome (itens críticos misturados, 105-122); `MovementDialog` é global com select de item (`movement-dialog.tsx:45-54`) em vez de ação na linha; sem editar/excluir item nem ver o histórico de movimentos (a tela não consulta `inventory_movements`). `registerMovement` lê o saldo, atualiza e só depois grava o histórico (`estoque/actions.ts:93-104`); se o histórico falhar, devolve "O saldo foi atualizado, mas não foi possível registrar..." (linha 108) sem dizer o que fazer. Sem desfazer para uma entrada digitada com zero a mais.
- Problema: o dado que pede ação (item crítico) não vem primeiro nem tem botão ao lado; saldo e histórico podem divergir; erro de digitação não tem volta.
- Correção: ordenar com "Reposição urgente" primeiro; botões "+ Entrada" e "- Saída" na linha (abre o diálogo com o item preenchido); histórico recolhido por item; gravar saldo e movimento numa única RPC transacional; "Estornar movimento".
- Esforço: M. Risco: médio (RPC nova).

---

### (6) Financeiro

Resumo: quatro abas e um módulo oculto (HUB) com três dos mesmos conceitos (DRE, fluxo de caixa, contas a pagar) em lugares diferentes e com números diferentes; ações de dinheiro (fechar repasses, marcar pago, baixar fatura, excluir nota do plano) executam em um clique, sem confirmar nem desfazer; quase todo KPI está sem comparativo.

#### 6.1 Repasses & Glosas (`/gestor/financeiro`)

**FIN-01 · P1 · REGRA 1 (KPI sem comparativo), Von Restorff**
- Evidência: `financeiro/page.tsx:43-68`: Receita bruta ("faturado no mês"), Repasses a pagar ("competência aberta"), Glosas em aberto ("não recuperadas"), Prazo médio de recebimento. Nenhum tem vs mês anterior, meta ou % do faturado. Os gráficos (75-137) são séries sem valor nos pontos.
- Problema: números soltos; o gestor não sabe se R$ X de glosa é normal.
- Correção: linha compacta por KPI: "vs mês anterior ±%" para receita e repasses; "glosa em aberto = N% da receita (meta: abaixo de X%)"; prazo médio com a meta contratual do plano. As séries de 6 meses já existem em `getRevenueByMonth` (`data.ts:270-310`).
- Esforço: M. Risco: baixo.

**FIN-02 · P0 · risco de erro em operação financeira, Lei de Tesler**
- Evidência: `financeiro-tabs.tsx:163-194` o botão "Fechar repasses do mês" executa `closePayouts` no primeiro clique, sem diálogo, sem prévia do total e sem mostrar qual mês. A tela calcula a competência (`financeiro/page.tsx:17`) mas nunca a exibe. O fechamento reprocessa repasses "abertos": apaga e recria os itens (`app/faturamento/repasses/actions.ts:30-34`). A mensagem de sucesso lista nomes "não incluídos" sem motivo nem próximo passo (`financeiro-tabs.tsx:176`); o erro mostra `rpcError.message` cru (`faturamento/repasses/actions.ts:62`). A mesma ação existe duplicada em `app/faturamento/repasses/repasses-actions.tsx:6-40`.
- Problema: uma ação que recalcula pagamento a terapeutas roda sem confirmação, sem saber qual competência e sem desfazer; um duplo clique ou um clique no mês errado muda valores que o terapeuta já pode ter visto.
- Correção: diálogo de confirmação "Fechar repasses de OUTUBRO/2026: 14 terapeutas, R$ 38.420 a pagar, 2 já aprovados serão mantidos" com botão que cita o mês; mostrar a competência no título e nos KPIs; mensagem de "não incluídos" com o motivo ("já aprovado/pago"); erro em português com o que fazer. Reaproveitar um único componente no Faturamento e na Gestão.
- Esforço: S. Risco: baixo.

**FIN-03 · P1 · risco de erro, irreversibilidade**
- Evidência: `financeiro-tabs.tsx:196-225` "Marcar como pago" por linha, sem confirmar; `markPayoutPaid` não registra data de pagamento nem comprovante e a regra diz "nunca de volta de pago" (`faturamento/repasses/actions.ts:85-102`).
- Problema: um clique errado numa tabela de dinheiro marca um repasse como pago de forma permanente; a data real do pagamento (que pode ser outro dia) se perde.
- Correção: diálogo curto com data (padrão hoje) e forma de pagamento, e "Desfazer" por 10 s via toast; permitir reabrir com justificativa e registro em `audit_log`.
- Esforço: S. Risco: baixo.

**FIN-04 · P1 · Gradiente de meta, Doherty, fuso**
- Evidência: `financeiro/data.ts:36` e `../data.ts:14-19`: tudo é "mês corrente em UTC"; não há seletor de mês na tela (`financeiro/page.tsx`, `financeiro-tabs.tsx`). Repasses e glosas só existem para o mês atual, e a virada para o mês seguinte acontece às 21h de Brasília no último dia.
- Problema: fechamento acontece depois do fim do mês, quando a tela já mostra o mês novo vazio; o gestor não consegue rever o repasse de outubro em novembro. Às 21h do último dia a tela já mostra o mês seguinte.
- Correção: seletor de competência (setas "<" ">" no título, como o `FinanceHubMonthPicker` já faz no HUB), usando `CLINIC_TIMEZONE` de `lib/constants`.
- Esforço: M. Risco: médio.

**FIN-05 · P2 · Lei de Jakob, Lei de Tesler**
- Evidência: a tabela de repasses (`financeiro-tabs.tsx:260-265`) mostra "Valor bruto" e "Honorário", mas `repasseAmount` soma bruto + indenização + ajustes (`data.ts:110,117`). A indenização por falta com aviso inferior a 24h é calculada (`data.ts:14,109,117`) e nunca exibida.
- Problema: o Honorário aparece maior que o bruto sem explicação; o gestor não consegue conferir a conta.
- Correção: colunas "Bruto", "Indenização por falta tardia", "Ajustes", "A pagar" (ou tooltip com a composição) e total no rodapé.
- Esforço: S. Risco: baixo.

**FIN-06 · P1 · profundidade de menu, duplicidade, Lei de Tesler**
- Evidência: três níveis de navegação para a mesma pergunta: barra Gestão, subnav `FinanceiroSubnav` (4 abas), e radio "Repasses | Glosas" com visual de abas (`financeiro-tabs.tsx:243-252`). A visão Glosas é só leitura (304-337): registrar glosa/recurso vive em `/faturamento/glosas`, sem link. O Faturamento tem Repasses e Glosas próprios (`app/faturamento/faturamento-header.tsx:7-8`) com a mesma ação de fechar (`repasses-actions.tsx`).
- Problema: o gestor encontra "Repasses" em dois módulos com comportamentos diferentes e não sabe qual é o oficial; ação de glosa exige trocar de módulo.
- Correção: decidir um dono: Gestão mostra o resumo (KPIs e totais) e leva ao Faturamento para agir ("Abrir Repasses no Faturamento"), ou o contrário. Transformar o radio em duas abas reais de URL (`/gestor/financeiro?aba=glosas`) para poder linkar.
- Esforço: M. Risco: médio (papel faturamento versus gestor).

**FIN-07 · P2 · Lei de Jakob, Von Restorff, acessibilidade (cor como única codificação)**
- Evidência: `financeiro/page.tsx:78` título "Receita por plano de saúde · 6 meses", mas `getRevenueByMonth` (`data.ts:270-310`) agrupa por mês, não por plano. As barras (80-107) não têm eixo, valor, legenda nem tooltip; verde e vermelho distinguem "ok" de "glosa" só por cor.
- Problema: título que não corresponde ao dado; gráfico que não diz nada sem valores.
- Correção: renomear "Receita faturada por mês (com glosa)" ou implementar por plano; valores no topo de cada barra e legenda "Faturado / Glosado".
- Esforço: S. Risco: baixo.

**FIN-08 · P3 · integridade do indicador**
- Evidência: `data.ts:251-259`: o "Prazo médio de recebimento" só considera itens já pagos.
- Problema: subestima o prazo quando há muito em aberto (viés de sobrevivência).
- Correção: rotular "dos itens já pagos" ou incluir aging dos em aberto.
- Esforço: S. Risco: baixo.

#### 6.2 Contratos Particulares (`/gestor/contratos`)

**CTR-01 · P0 · dinheiro invisível**
- Evidência: `contratos/page.tsx:154-156` mostra por contrato só as faturas do mês corrente; `:74-76` conta pendentes só deste mês. Uma fatura vencida de mês anterior não aparece em lugar nenhum desta tela, nem tem botão de baixa.
- Problema: cobrança atrasada some da vista no dia 1 do mês seguinte. O dado mais urgente é o que desaparece.
- Correção: coluna "Em atraso" com valor acumulado de meses anteriores e fila "Faturas vencidas" no topo, ordenada por dias de atraso, com botão de baixa na linha.
- Esforço: M. Risco: baixo.

**CTR-02 · P1 · Lei de Tesler, Pareto**
- Evidência: gerar fatura é manual e por contrato (`page.tsx:174`, `invoice-actions.tsx:204-229`); baixa individual (`invoice-actions.tsx:231-256`, `actions.ts:164-170` grava `paid_at=now`, sem escolher data).
- Problema: com 30 contratos são 30 cliques por mês só para gerar, e a baixa não aceita a data real do pagamento.
- Correção: botão "Gerar faturas do mês (N contratos)" com prévia; geração automática no dia 1; baixa com data e forma de pagamento e "Desfazer".
- Esforço: M. Risco: médio.

**CTR-03 · P1 · tarefa impossível pela UI**
- Evidência: `updateContractStatus` (`contratos/actions.ts:90-103`, suspender, cancelar, encerrar) não é usada por nenhuma tela (busca no repositório só encontra a definição). O status aparece cru para valores diferentes de "ativo" (`page.tsx:169`).
- Problema: não é possível suspender nem encerrar um contrato pela interface.
- Correção: menu da linha "Suspender / Encerrar" com confirmação e data de fim.
- Esforço: S. Risco: baixo.

**CTR-04 · P1 · REGRA 1**
- Evidência: `contratos/page.tsx:103-131`: Contratos ativos, "MRR" (soma das mensalidades) e Cobranças pendentes no mês, sem comparativo.
- Problema: MRR sem "vs mês anterior" não diz se a base cresce ou encolhe.
- Correção: MRR com variação mensal e churn do mês; pendentes com "% do total faturado" e "N vencidas".
- Esforço: M. Risco: baixo.

**CTR-05 · P2 · Lei de Jakob**
- Evidência: o menu diz "Financeiro", a aba "Contratos Particulares" (`financeiro-subnav.tsx:9`), o kicker "Faturamento Particular" (`contratos/page.tsx:95`) e o título "Gestão de Contratos e Cobrança Particular" (97). O módulo "Faturamento" é outro. O nome "MRR" é jargão de SaaS.
- Problema: o item "Financeiro" esconde Contratos e a tela usa quatro nomes.
- Correção: título "Contratos particulares", kicker "Financeiro", "Receita mensal fixa" no lugar de MRR; considerar rótulo da aba "Particulares".
- Esforço: S. Risco: baixo.

**CTR-06 · P2 · Lei de Postel, fuso**
- Evidência: `new-contract-dialog.tsx:316-325` select com todos os pacientes (inclui "interessado", `page.tsx:79-83`) sem busca; data de início padrão em UTC (`new-contract-dialog.tsx:375`).
- Problema: lista longa; após 21h a data padrão sai um dia adiantada.
- Correção: combobox com busca por nome ou CPF; data local com `CLINIC_TIMEZONE`.
- Esforço: S. Risco: baixo.

#### 6.3 Contas a Pagar (`/gestor/financeiro/contas-a-pagar`)

**FIN-09 · P1 · risco de erro, irreversibilidade**
- Evidência: `expense-row-actions.tsx:195-200` "Marcar como Paga" e "Cancelar" lado a lado, sem confirmação; `markExpensePaid` grava `paid_at` com o instante atual (`contas-a-pagar/actions.ts:360`) e `cancelExpense` não revalida o DRE (380-381, só a própria tela).
- Problema: um clique equivocado cancela uma despesa; data do pagamento não pode ser a real; o DRE continua exibindo a despesa cancelada até outra revalidação.
- Correção: "Pagar" abre popover com data; "Cancelar" pede motivo; ambos com "Desfazer"; revalidar `/gestor/financeiro/dre`.
- Esforço: S. Risco: baixo.

**FIN-10 · P1 · Zeigarnik, Lei de Parkinson, fuso**
- Evidência: `contas-a-pagar/page.tsx:46` ordena por vencimento crescente incluindo pagas e canceladas; `:134-148` não há filtro. `:49` calcula "atrasada" com `new Date().toISOString().slice(0,10)` (UTC). Vencimento mostrado em ISO cru (`:142`).
- Problema: com histórico acumulado, as contas pendentes do mês ficam enterradas atrás das antigas pagas; conta que vence hoje aparece "atrasada" a partir das 21h; data em formato `2026-09-30`.
- Correção: ordem padrão "atrasadas, depois pendentes por vencimento, depois pagas" com filtro Pendentes/Pagas/Todas; data `dd/mm/aaaa`; usar fuso da clínica.
- Esforço: S. Risco: baixo.

**FIN-11 · P1 · REGRA 1**
- Evidência: `contas-a-pagar/page.tsx:80-113`: "Pendentes no Mês", "Atrasadas", "Total Cadastrado" (contagem de todas as competências, métrica de vaidade).
- Problema: números soltos; "Total cadastrado: N contas" não leva a decisão.
- Correção: "Pendentes do mês: R$ X (vs R$ Y no mês passado)"; "Atrasadas: R$ X (N contas, mais antiga há D dias)"; trocar o terceiro por "Pago no mês vs orçado" ou removê-lo.
- Esforço: S. Risco: baixo.

**FIN-12 · P1 · promessa que o sistema não cumpre (dinheiro)**
- Evidência: `new-expense-dialog.tsx:283-286` "Despesa recorrente (repete todo mês)". A coluna `recurring` é só um marcador (`supabase/migrations/20260908070000_accounts_payable.sql:17`); a busca no repositório não encontra nenhum job ou função que crie a próxima ocorrência (só o catálogo `lib/usual-payables.ts`, que também só marca `recurring`).
- Problema: o gestor marca "aluguel recorrente" e confia que o do mês seguinte aparece; não aparece, e o DRE e o fluxo de caixa ficam subestimados.
- Correção: implementar a geração automática no dia 1 (ou "Copiar contas do mês anterior" com um clique), ou trocar o rótulo para "Marcar como recorrente (lembrete)" e exibir o aviso "crie novamente no mês seguinte".
- Esforço: M. Risco: médio.

#### 6.4 DRE & Fluxo de Caixa (`/gestor/financeiro/dre`)

**FIN-13 · P1 · duplicidade e risco de lançamento duplo**
- Evidência: `dre/page.tsx:137-139` embute um segundo "Contas a Pagar" (`contas-a-pagar-panel.tsx:350-418`) com status cru em minúsculas via `capitalize` (411) e data ISO (410, 467), sem ações; a aba Contas a Pagar tem os mesmos dados com ações. No lançamento rápido (`contas-a-pagar-panel.tsx:422-504`), depois de "lançada" o campo continua habilitado (478-497, `done` só muda o estilo), e o reconhecimento de "já lançada" é por prefixo de descrição (337-346). `createUsualExpense` não checa duplicidade no servidor (`dre/actions.ts:159-199`).
- Problema: duas telas de contas a pagar com informação divergente; digitar o valor de novo e dar Enter cria despesa duplicada que infla o resultado.
- Correção: manter uma só lista de contas (na aba própria) e mostrar na DRE apenas o total com link; o catálogo "Preencher contas usuais" vira botão na aba Contas a Pagar; desabilitar a linha após lançar e checar duplicidade (descrição + competência) no servidor.
- Esforço: M. Risco: médio.

**FIN-14 · P1 · Lei de Miller, Carga cognitiva, risco de decisão errada**
- Evidência: `dre/page.tsx:58` o título "DRE Simplificado & Fluxo de Caixa Projetado" difere do nome da aba "DRE & Fluxo de Caixa"; a página empilha 4 blocos (tabela DRE de 9 colunas `70-129`, notas dos planos, contas a pagar, fluxo de caixa) e dois parágrafos longos (59-63, 131-134). Cabeçalhos "Recebível Conciliado" e "Ajuste de Conciliação" (75-76). O fluxo de caixa projetado só soma faturas de contrato particular e contas a pagar com vencimento a partir do mês atual (`dre/data.ts:324-347`, `.gte("due_date", rangeStart)`), ignorando atrasadas de meses anteriores e todo o recebível de convênio.
- Problema: a projeção mostra saldo negativo estrutural (entradas de convênio ausentes, atrasadas fora) e o gestor pode tomar decisão com ela; a DRE tem 9 colunas sem variação mensal.
- Correção: separar em abas "Resultado", "Fluxo de caixa" e "Notas dos planos"; incluir contas atrasadas e convênio previsto na projeção, ou rotular o quadro "Projeção parcial: só particular e contas" com destaque; coluna "Δ vs mês anterior" no Resultado Líquido; renomear colunas para "Receita faturada", "Receita conferida com a nota do plano", "Diferença".
- Esforço: L. Risco: médio.

**FIN-15 · P1 · risco de erro, duplicidade de receita**
- Evidência: `remittance-panel.tsx:210-218` "Excluir" nota do plano sem confirmação (remove linhas consolidadas que alteram a receita do DRE); `uploadRemittanceNote` não detecta o mesmo arquivo ou lote (plano + competência + nome) enviado duas vezes (`dre/actions.ts:21-96`); `Consolidado na DRE` (`remittance-panel.tsx:69-72`) é um número solto.
- Problema: subir a nota duas vezes e marcar "consolidar tudo" (padrão ligado, 106-109) soma a mesma receita duas vezes; excluir um lote muda o DRE sem aviso.
- Correção: avisar "Já existe uma nota deste plano em OUTUBRO com o mesmo nome. Substituir?"; confirmar exclusão mostrando o impacto ("o consolidado de outubro cai R$ X"); comparar o consolidado com o faturado do mês.
- Esforço: M. Risco: médio.
- Já está bom: linhas de baixa confiança nunca entram consolidadas por padrão e levam a etiqueta "conferir" (`dre/actions.ts:86-89`, `remittance-panel.tsx:263-267`); aviso do porquê do ajuste na DRE (`dre/page.tsx:59-63`).

#### 6.5 Financeiro HUB (sem menu, `/gestor/financeiro-hub`)

**HUB-01 · P1 · Lei de Jakob, descoberta, duplicidade de números**
- Evidência: o módulo inteiro (DRE consolidado, Balanço, Fluxo de Caixa, Lançamentos Manuais) não tem item de menu (`financeiro-hub-subnav.tsx:3-10`, `FINANCEIRO-HUB.md:13-14`). Existe DRE e Fluxo de Caixa também em Financeiro (`dre/page.tsx`), com números diferentes por desenho: caixa versus competência (`FINANCEIRO-HUB.md:65-68`). Nenhuma das telas tem "voltar" ao Financeiro; no cabeçalho a barra da Gestão fica sem item ativo (`module-header.tsx:66,85-91`: `/gestor/financeiro-hub` não casa com `/gestor/financeiro`).
- Problema: duas "DRE" e dois "Fluxo de caixa" com valores distintos para a mesma clínica, uma delas só acessível por quem sabe a URL; confiança no número cai.
- Correção: expor como "Financeiro > Grupo (visão consolidada)" apenas para quem tem acesso (a regra de papel já existe), com chip "Regime de caixa" vs "Competência" nos dois DREs e uma nota "por que os números diferem". Registrar na subnav o caminho de volta.
- Esforço: M. Risco: médio (decisão de produto e permissão: ver nota de Isabella em `FINANCEIRO-HUB.md:18-22`).

**HUB-02 · P0 · dado financeiro que falha em silêncio**
- Evidência: `lancamentos/balance-cell.tsx:258-269`: `saveBalanceEntry` retorna erro e o componente só trata `res.success`; em falha não mostra nada. O "Salvo" é apenas `title` do input (280, tooltip), invisível no toque.
- Problema: o gestor digita saldos do balanço, tira o foco e acredita que gravou; se a ação falhar (permissão, sessão expirada, rede) o valor se perde sem aviso, e o balanço "não fecha" sem razão aparente.
- Correção: ícone de estado ao lado do campo (salvando, salvo, erro vermelho com a mensagem) e tentar de novo; bloquear a saída da página com pendências.
- Esforço: S. Risco: baixo.

**HUB-03 · P1 · promessa não cumprida**
- Evidência: `monthly-entry-form.tsx:223-226` "Fechar o mês (trava novos ajustes acidentais)"; `lancamentos/page.tsx:63-65` passa o `entry` mas o formulário nunca lê `entry.status` para travar campos ou mostrar "mês fechado"; a migration diz que só trava para quem não é gestor e que o gestor "sempre pode reabrir" (`supabase/migrations/20260927140000_fa_finance_hub.sql:58`).
- Problema: o checkbox sugere proteção que a tela não oferece; o gestor segue editando um mês "fechado" sem aviso.
- Correção: quando `status=fechado`, campos desabilitados com banner "Mês fechado em DD/MM. Reabrir" e confirmação ao reabrir.
- Esforço: S. Risco: baixo.

**HUB-04 · P1 · REGRA 1**
- Evidência: `financeiro-hub/page.tsx:41-57` (Receita operacional total, Resultado líquido total) e `fluxo-caixa/page.tsx:173-196` (Caixa operacional, Financiamento, Variação de caixa), todos sem comparativo, embora exista seletor de mês.
- Problema: números absolutos sem referência, no módulo mais estratégico.
- Correção: "vs mês anterior" e "vs mesmo mês do ano anterior" nos cinco cartões (a consulta já é por mês, basta chamar duas vezes).
- Esforço: S. Risco: baixo.

**HUB-05 · P2 · Lei de Miller, Lei de Tesler, Pareto**
- Evidência: `monthly-entry-form.tsx:127-136` 8 campos numéricos + ajuste + nota + observações + checkbox, repetidos para 3 unidades (`lancamentos/page.tsx:62-66`) e logo abaixo a matriz do balanço (69-115, 5 grupos x contas x 3 unidades). Valores iniciais "0" (linha 183). Sem "copiar do mês anterior". O aviso "Balanço não fecha" só aparece na tela Balanço (`balanco/page.tsx:46-58`), não onde se digita.
- Problema: lançamento mensal pesado; quem digita saldos não vê a conferência até trocar de aba.
- Correção: dividir em abas "DRE do mês" e "Balanço"; botão "Copiar valores do mês anterior" (aluguel e folha repetem); linha de totais com "Diferença" ao vivo ao digitar.
- Esforço: M. Risco: baixo.

**HUB-06 · P2 · mensagens de erro técnicas**
- Evidência: `lancamentos/actions.ts:49,82` devolvem `err.message` das funções de repositório ("fa_fin_monthly_entries upsert: ..." em `lib/finance-hub/repo.ts:78,126`).
- Problema: nome de tabela na tela de gestor.
- Correção: mensagem humana mais próximo passo ("Não foi possível salvar. Atualize a página e tente de novo; se persistir, avise o suporte") e log do detalhe no servidor.
- Esforço: S. Risco: baixo.

**HUB-07 · P3 · Doherty, Lei de Postel**
- Evidência: links internos com `<a href>` provocam recarga total (`dre/page.tsx:100`, `balanco/page.tsx:56,75`); `finance-hub-month-picker.tsx:9-18` usa `<input type="month">` sem setas "mês anterior/próximo" nem estado de carregamento.
- Correção: `Link`, botões "‹ ›" e indicador de troca de mês.
- Esforço: S. Risco: baixo.

---

### (7) Relatórios

Resumo: é um exportador de CSV de 4 passos, bem protegido do ponto de vista LGPD (colunas sensíveis desmarcadas, confirmação e log), mas o nome promete "relatórios", o fluxo não oferece atalhos para as exportações mais comuns e o tamanho do resultado pode ser truncado.

**REL-01 · P2 · Lei de Jakob**
- Evidência: menu "Relatórios" (`gestor-nav.tsx:28`), título "Central de Relatórios & Exportação CSV" (`relatorios/page.tsx:78`), kicker "Gestão & Controladoria" (77), e a análise gerencial está em "Inteligência BI".
- Problema: quem abre "Relatórios" espera ver relatórios prontos e encontra um construtor de planilhas.
- Correção: renomear o item para "Exportar dados" (ou "Planilhas") e deixar "Relatórios" para quando existir relatório pronto.
- Esforço: S. Risco: baixo.

**REL-02 · P1 · integridade de dados (por leitura de código, depende do limite da API)**
- Evidência: `relatorios/actions.ts` não tem `.limit()` nem `.range()` nas consultas (busca por `.limit|.range` não retorna ocorrência); a contagem exibida é `rows.length` (`:627-631`) e a prévia refaz a consulta completa a cada mudança de filtro ou coluna (`report-export-client.tsx:149-190`, debounce de 250 ms) para só mostrar 6 linhas (`actions.ts:629`).
- Problema: se o limite padrão de linhas da API do Supabase (1000) estiver ativo, "Todo o Histórico" de sessões ou faturamento sai truncado e o botão ainda diz "Exportar 1000 Registros"; além disso cada tecla na busca dispara uma consulta completa (Doherty).
- Correção: paginar a exportação em blocos até esgotar; usar `count: "exact"` com `head: true` para o contador da prévia e buscar apenas 6 linhas; avisar "mais de N registros" quando passar de um teto.
- Esforço: M. Risco: médio.

**REL-03 · P2 · Lei de Pareto, Lei de Tesler**
- Evidência: `report-export-client.tsx:299-355` 7 cartões de categoria, em seguida filtros (`440-486`, `~520-620`), 14 a 17 colunas (`types.ts:137-276`) e a prévia; passos numerados 1 a 4 numa só página rolável. Não há "modelos" salvos.
- Problema: a exportação mais comum (por exemplo "Faturamento do mês anterior por plano") exige escolher categoria, período e checar colunas todas as vezes.
- Correção: faixa "Mais usados" no topo (3 a 4 atalhos que pré-preenchem categoria, período e colunas) e "Salvar como modelo".
- Esforço: M. Risco: baixo.

**REL-04 · P2 · LGPD, Von Restorff**
- Evidência: a grade de colunas (`report-export-client.tsx:~632-690`) não distingue visualmente as sensíveis, que só aparecem pelo nome na confirmação (`:200-211`); "Marcar Todas" (632) as inclui; a confirmação é `window.confirm`.
- Problema: um clique em "Marcar Todas" marca CPF, CID, carteirinha e telefone sem nenhum realce; o aviso vem depois, em diálogo nativo.
- Correção: ícone de cadeado e legenda "dado sensível" nas colunas, "Marcar Todas" exclui as sensíveis (opção separada "Incluir sensíveis"), confirmação em modal da aplicação.
- Esforço: S. Risco: baixo.
- Já está bom: sensíveis desmarcadas por padrão (`types.ts:145-158`), registro da exportação em `audit_log` (`actions.ts:648-670`), estado vazio claro (`report-export-client.tsx:~739-748`).

**REL-05 · P3 · controles mortos ou poluídos**
- Evidência: o filtro "Status" para Planos e Faturamento tem só "Todos os status" (`report-export-client.tsx:440-486`); a lista de terapeutas inclui todo `profiles` sem filtro de papel nem ativo (`relatorios/page.tsx:19-23`) e a lista de disciplinas é fixa no código (33-42).
- Problema: um filtro que não filtra nada; o menu de "Profissional" inclui recepção e gestores.
- Correção: ocultar o select quando não há opções; filtrar `role=terapeuta` e `active`.
- Esforço: S. Risco: baixo.

---

### (8) Auditoria (LGPD)

Resumo: o nome do item promete LGPD e esconde três coisas que não são LGPD (pendências escaladas da recepção, ouvidoria de qualidade, telemetria de uso do sistema), e o log LGPD de verdade não tem busca.

**AUD-01 · P1 · Lei de Jakob, Lei de Hick (item que esconde outros)**
- Evidência: `gestor-nav.tsx:29` "Auditoria (LGPD)" com `match` que cobre `/gestor/ouvidoria` e `/gestor/facilidade-de-uso`; `auditoria-subnav.tsx:7-12` 4 abas: Acesso a Prontuários, Sessões canceladas, Ouvidoria & Incidentes, Facilidade de uso.
- Problema: quem procura "Ouvidoria" (reclamação de família, evento adverso) não olha em Auditoria LGPD; "Facilidade de uso" é telemetria do produto, sem relação com auditoria. Dois dos quatro conteúdos têm donos diferentes.
- Correção: renomear o item para "Qualidade e Auditoria" e reagrupar: Auditoria (Acessos LGPD, Sessões canceladas), Ouvidoria como item próprio ou aba de Qualidade, Facilidade de uso movida para Configurações > Sistema (ou para a Inteligência BI, junto com os demais indicadores).
- Esforço: M. Risco: baixo (rotas continuam, só mudam menu e nome).

**AUD-02 · P1 · Lei de Jakob, Ação onde o dado está, Efeito Zeigarnik**
- Evidência: `auditoria/page.tsx:117-130` abre com "Pendências escaladas" (fila da recepção que estourou prazo), e só em `:169-176` vem o log LGPD; há dois `<h1>` na mesma página (118, 170); a aba se chama "Acesso a Prontuários (LGPD)" (`auditoria-subnav.tsx:8`). A tela instrui "Cobre quem está com o item" (121) mas não oferece link para o item, botão de reatribuir nem contagem no menu.
- Problema: a única lista de trabalho urgente do gestor (o que a equipe deixou travar) está escondida numa aba de auditoria, sem badge, e termina em "cobre" fora do sistema.
- Correção: levar "Pendências escaladas" para a home do gestor com contador no menu (como o NPS em `gestor-nav.tsx:36`) e ação "Reatribuir" / "Abrir item"; a aba LGPD fica só com o log. Um único `<h1>` por página.
- Esforço: M. Risco: baixo.

**AUD-03 · P1 · tarefa LGPD sem ferramenta**
- Evidência: `auditoria/page.tsx:85-89` lista os últimos 200 acessos (a deduplicação é feita depois do corte, 91-110), sem busca por paciente, usuário ou período, sem paginação e sem exportar.
- Problema: a pergunta típica "quem acessou o prontuário do paciente X no último mês?" (pedido do titular) só se responde se o acesso estiver entre os 200 mais recentes.
- Correção: filtros de paciente, usuário, tela e período com paginação por URL; botão "Exportar CSV" do resultado filtrado; deduplicar no banco.
- Esforço: M. Risco: baixo.

**AUD-04 · P2 · erro com próxima ação, rótulos**
- Evidência: `auditoria/sessoes/page.tsx:265` exibe `error.message` cru; limite fixo de 300 sem filtro (249); a aba se chama "Sessões canceladas" (`auditoria-subnav.tsx:9`) e o título "Sessões canceladas e remarcadas" (`sessoes/page.tsx:258`); a página não tem `loading.tsx` próprio (herda o do segmento Auditoria).
- Problema: mensagem técnica; sem filtro por terapeuta, motivo ou período para quem investiga um padrão de cancelamento.
- Correção: mensagem humana, filtros e paginação, e nome único para aba e título.
- Esforço: S. Risco: baixo.

#### Ouvidoria & Incidentes

**OUV-01 · P1 · REGRA 1**
- Evidência: `ouvidoria/page.tsx:79-112`: "Registros Abertos", "Gravidade Crítica em Aberto", "Eventos Adversos (total)", sem comparativo; o terceiro é um acumulado de todo o histórico.
- Problema: contagem sem tendência nem prazo; "total" histórico não ajuda a decidir.
- Correção: "Abertos: N (vs M há 30 dias; mais antigo há D dias)"; "Críticos abertos: N (meta: 0)"; "Eventos adversos nos últimos 90 dias: N vs 90 dias anteriores".
- Esforço: S. Risco: baixo.

**OUV-02 · P1 · Zeigarnik, Von Restorff, Ação onde o dado está**
- Evidência: `ouvidoria/page.tsx:55` ordena por data da ocorrência decrescente, misturando resolvidos e arquivados com abertos e críticos; descrição truncada em uma linha (141-143); o plano de ação é selecionado (53) mas nunca exibido, só aparece dentro do formulário "Atualizar" (`incident-status-form.tsx:211-219`).
- Problema: incidente crítico aberto pode estar na página 3 da rolagem; para ler a descrição completa ou o que foi decidido é preciso passar o mouse ou abrir o formulário de edição.
- Correção: ordenar por abertos primeiro, por gravidade e idade; abas Abertos/Resolvidos; linha expansível com descrição completa e plano de ação; "dias em aberto".
- Esforço: M. Risco: baixo.

**OUV-03 · P1 · dado errado por fuso**
- Evidência: `new-incident-dialog.tsx:314` `defaultValue={new Date().toISOString().slice(0, 16)}`, que está em UTC, no campo `datetime-local`.
- Problema: no horário de Brasília o padrão sai 3 horas no futuro; quem só confirma grava um horário de ocorrência futuro.
- Correção: formatar a data local com `CLINIC_TIMEZONE`; validar que não é futura.
- Esforço: S. Risco: baixo.

**OUV-04 · P2 · risco de erro, Lei de Tesler**
- Evidência: `incident-status-form.tsx:212-219`: marcar "Resolvido" ou "Arquivado" não exige descrição do desfecho nem plano de ação para "Plano de Ação", sem data de resolução; lista de pacientes completa e sem busca (`new-incident-dialog.tsx:302-309`, `ouvidoria/page.tsx:56`); a página não tem `loading.tsx`.
- Problema: incidentes encerrados sem registro do que foi feito, que é o objetivo da ouvidoria; select longo de pacientes.
- Correção: exigir "o que foi feito" ao resolver, registrar `resolved_at` e quem resolveu; combobox de paciente.
- Esforço: S. Risco: baixo.

#### Facilidade de uso

**UXU-01 · P2 · Lei de Jakob, jargão técnico**
- Evidência: o estado vazio cita o nome da migration `20260929000000_ux_friction_events` (`facilidade-de-uso/page.tsx:138`); rota crua em fonte monoespaçada e nomes de elemento/tipo (241, 281-282); a lista "O que consertar primeiro" não tem link para a tela nem ação (222-262). A tela é telemetria do produto, em Auditoria.
- Problema: o gestor da clínica vê nome de migration e path de rota; a quem se destina?
- Correção: mensagem "Ainda sem dados: a coleta começa quando a equipe usa o sistema" (o texto técnico vai para a documentação); esconder o path atrás de "detalhes"; botão "Abrir esta tela". Mover (ver AUD-01).
- Esforço: S. Risco: baixo.
- Já está bom: é o único painel da parte B que cumpre a regra 1: cada KPI traz "semana passada" e "meta" e uma leitura em frase (`page.tsx:41-90`); mostra aviso de poucos dados (149).

---

### (9) Configurações

Resumo: a sidebar já está enxuta (5 itens, 4 reais mais uma saída), o que contraria a hipótese de "depósito de tudo"; os problemas agora são um bug na criação de prioridades, nomes divergentes e telas que salvam sem dizer.

**CFG-01 · P2 · Lei de Jakob, Lei de Tesler**
- Evidência: "Usuários & Permissões ↗" (`config-sidebar.tsx:19`) leva à mesma tela de "Colaboradores & Contas" (`cadastros-sidebar.tsx:7`): duas entradas, dois nomes, um destino. A tela `/gestor/configuracoes/profissionais` (Contratos & Valor por módulo) não está na sidebar de Configurações e só é linkada da subnav de Pessoas & Desempenho (`components/equipe-subnav.tsx:11`); ao abri-la, a barra superior destaca "Configurações" pelo prefixo mais longo (`module-header.tsx:85-91`) e a sidebar "Sistema" aparece sem item ativo (`configuracoes/layout.tsx:9-15`).
- Problema: o operador que veio de "Pessoas & Desempenho" é jogado, visualmente, para "Configurações"; "Usuários" e "Colaboradores" parecem coisas diferentes.
- Correção: mover a rota para `/gestor/equipe/contratos` (ou `bonificacao/contratos`) e deixar um redirect; unificar o nome (ou manter só um dos dois atalhos).
- Esforço: S. Risco: baixo.

**CFG-02 · P0 · bug de bloqueio (por leitura de código, não executado)**
- Evidência: `prioridades-manager.tsx:187-189`: `Math.max(...(lista.map(...) || [0])) + 1`. Para um plano sem nenhuma prioridade a lista é `[]`, que é verdadeira, então o `|| [0]` nunca vale e `Math.max()` devolve `-Infinity`; o campo oculto `priority_level` vai como "-Infinity" (278), `parseInt` dá `NaN` e a validação `priority_level < 1 || > 10` não rejeita `NaN` (`prioridades-avaliacao/actions.ts:13,26-31`); o insert falha e a mensagem exibida é "Você não tem permissão para criar prioridades." (64-67).
- Problema: o primeiro nível de prioridade de qualquer plano (e o estado inicial da tela, sem prioridades) parece impossível de criar, com uma mensagem de permissão falsa. Isso bloqueia a configuração do agendamento de 1ª avaliação (regra 3 do AGENTS.md).
- Correção: `Math.max(0, ...níveis) + 1`; validar `Number.isInteger` no servidor; mapear o erro do banco para a causa real.
- Esforço: S. Risco: baixo.

**CFG-03 · P2 · Lei de Jakob, acessibilidade**
- Evidência: o item de menu chama "Regras de Agendamento" (`config-sidebar.tsx:18`), o título da tela "Prioridades de Agendamento de 1ª Avaliação" (`prioridades-manager.tsx:197`), a pasta `prioridades-avaliacao`. Edição não permite trocar a cor (a cor aparece como amostra, `49-52`, e o estado `color` nunca é alterado, 38); desativar ignora o erro (`void togglePriorityActive`, 155); as amostras de cor são botões sem rótulo (284-300) e o nível é distinguido por cor.
- Problema: "Regras" promete mais do que a tela faz; cor sem texto não é acessível.
- Correção: nome único "Prioridades da 1ª avaliação"; permitir editar a cor; `aria-label` com o nome da cor; tratar o erro do toggle.
- Esforço: S. Risco: baixo.

**CFG-04 · P2 · Lei de Postel, Lei de Tesler**
- Evidência: `dados-clinica-form.tsx:156,191,198-199` campos de CNPJ, CEP, telefone e WhatsApp sem máscara; `dados-da-clinica/actions.ts:30-40` valida só UF e que o e-mail contém "@"; os dados saem em todo PDF com timbre e nos documentos da recepção (`page.tsx:9-15`); a mensagem "Dados salvos." permanece depois de novas edições (`dados-clinica-form.tsx:234`); sem preenchimento por CEP.
- Problema: erro de digitação em CNPJ ou telefone é impresso em todos os documentos; o aviso de "salvo" fica obsoleto.
- Correção: máscaras e validação de dígitos do CNPJ, consulta de CEP, limpar o "salvo" ao editar, e um preview do timbre.
- Esforço: M. Risco: baixo.
- Já está bom: 4 blocos com título (Identificação, Endereço, Contato, Responsável Técnico), campos opcionais claros, regra de "não inventar dado" no timbre.

**CFG-05 · P2 · Doherty (feedback)**
- Evidência: `cupom-manager.tsx:91-103`: após salvar só chama `router.refresh()`, sem mensagem de sucesso. Instruções de impressão sem diálogo mencionam "o botão Imprimir teste abaixo" (213) mas ele fica na coluna da direita; o passo 4 pede para criar atalho do Chrome com `--kiosk-printing` (216-220), técnico.
- Problema: o gestor não sabe se salvou; instrução que exige conhecimento de TI no meio da tela.
- Correção: toast "Cupom salvo"; mover o passo a passo técnico para uma página de ajuda ou um link "Falar com o suporte".
- Esforço: S. Risco: baixo.
- Já está bom: prévia ao vivo ao lado do formulário (`cupom-manager.tsx:84-85,225-236`) e "Imprimir teste" sem salvar.

**CFG-06 · P3 · jargão e Lei de Tesler**
- Evidência: `robo-portal-manager.tsx:161-168` pede que o gestor cole `AGENT_TOKEN` no `.env` da pasta `agente-robo`; confirmação nativa para desativar (109); a chave só aparece uma vez e some se a tela for trocada.
- Problema: tarefa de TI exposta ao gestor; sem teste de conexão.
- Correção: botão "Enviar instruções ao suporte" com a chave num link de uso único, ou "Testar agora"; a barra "Ligado agora" já indica o resultado.
- Esforço: M. Risco: baixo.
- Já está bom: aviso em destaque de que a chave só aparece agora (`robo-portal-manager.tsx:160-166`), estado "Ligado agora / Desligado" legível (197-207).

**CFG-07 · P3 · consistência**
- Evidência: a aterrissagem de Configurações é Dados da Clínica (`configuracoes/page.tsx:4`), a tela menos mexida; `prioridades-avaliacao/loading.tsx:1-15` é um skeleton próprio enquanto o resto usa `ModuleSkeleton`.
- Correção: abrir em Regras de Agendamento ou no primeiro item com pendência; padronizar o skeleton.
- Esforço: S. Risco: baixo.

---

## 3. Achados transversais do módulo

**TRV-01 · P2 · Lei de Jakob, Lei de Hick: Cadastros versus Configurações**
- Evidência: `gestor-nav.tsx:26-30` tem Cadastros e Configurações lado a lado; as sidebars se chamam "Clínica" e "Sistema" (`cadastros-sidebar.tsx:21`, `config-sidebar.tsx:25`); a regra de divisão está só em comentário de código (`cadastros-sidebar.tsx:3-5`, `config-sidebar.tsx:3-7`). "Tipos de Atendimento" e "Templates do PTS" (Cadastros) e "Regras de Agendamento" e "Cupom de Check-in" (Configurações) são parâmetros do mesmo tipo.
- Problema: o operador não tem como prever em qual dos dois está o que procura.
- Correção: manter a divisão (entidade versus regra), mas escrever os títulos como os itens do menu e mostrar um resumo de uma linha em cada ("Cadastros: pessoas, planos, salas e catálogos"; "Configurações: identidade da clínica, regras de agenda e integrações").
- Esforço: S. Risco: baixo.

**TRV-02 · P2 · profundidade de navegação e abas sem semântica**
- Evidência: três padrões de abas diferentes na parte B: `FinanceiroSubnav` / `AuditoriaSubnav` (links com `role="navigation"`), `SectionSidebar` (`section-sidebar.tsx:51-76`), e abas feitas à mão com `<button>` sem `role="tab"` nem `aria-selected` (`protocolos-tabs.tsx:25-34`, `salas/atendimentos-manager.tsx:39-78`, radio `financeiro-tabs.tsx:243-252`). Financeiro tem barra, subnav e radio (3 níveis); Cadastros tem barra, sidebar e abas (3 níveis) em Protocolos e Salas.
- Problema: subnav dentro de subnav e comportamento inconsistente para teclado e leitor de tela.
- Correção: no máximo 2 níveis (barra + um nível); componente único de abas com `role="tablist"`, estado na URL e setas do teclado.
- Esforço: M. Risco: baixo.

**TRV-03 · P1 · confirmação e desfazer em operações de dinheiro e dados**

| Ação | Arquivo | Hoje |
|---|---|---|
| Fechar repasses do mês | `financeiro-tabs.tsx:184` | sem confirmação |
| Marcar repasse pago | `financeiro-tabs.tsx:215` | sem confirmação, sem desfazer |
| Marcar conta paga / cancelar | `expense-row-actions.tsx:195-200` | sem confirmação |
| Baixa de fatura de contrato | `invoice-actions.tsx:250` | sem confirmação, data = agora |
| Excluir nota do plano (altera DRE) | `remittance-panel.tsx:210-218` | sem confirmação |
| Remover item de protocolo | `terapias/[protocolId]/page.tsx:97` | sem confirmação |
| Excluir tipo de atendimento | `delete-appointment-type-button.tsx:17` | `window.confirm` |
| Excluir sala e turma | `room-row.tsx:122`, `turmas-aba-panel.tsx:129` | `confirm` nativo |
| Desativar robô | `robo-portal-manager.tsx:109` | `confirm` nativo |
| Exportar dados sensíveis | `report-export-client.tsx:203` | `confirm` nativo |
| Excluir colaborador e plano | `staff-table.tsx:510-537`, `insurer-list-item.tsx:180-207` | modal da aplicação |

- Problema: três níveis de proteção para classes de risco parecidas, e as mais perigosas (financeiras) são as sem proteção.
- Correção: componente `ConfirmDialog` com o resumo do que vai acontecer; `UndoToast` de 10 s para ações reversíveis (pagar, cancelar); regra: toda ação de dinheiro confirma, toda exclusão permanente confirma digitando ou com texto específico.
- Esforço: M. Risco: baixo.

**TRV-04 · P1 · mensagens de erro técnicas e que escondem a causa**
- Evidência: texto de banco cru: `convenios/actions.ts:59,92,142,167`, `colaboradores/actions.ts:148-149,283`, `auditoria/sessoes/page.tsx:265`, `lancamentos/actions.ts:49,82`, `faturamento/repasses/actions.ts:62`. Mensagem de permissão usada como resposta para qualquer falha: `prioridades-avaliacao/actions.ts:64-67`, `contas-a-pagar/actions.ts:348`, `dre/actions.ts:79,198`, `contratos/actions.ts:84`, `ouvidoria/actions.ts:41,68`, `estoque` etc.
- Problema: "verifique se você tem permissão de gestor" aparece para um gestor logado quando a causa real é validação, duplicidade ou rede; o operador não sabe o que fazer.
- Correção: mapear códigos de erro conhecidos (23505, 23503, 42501, rede) para frases com próxima ação; log do detalhe só no servidor.
- Esforço: M. Risco: baixo.

**TRV-05 · P2 · modais artesanais, acessibilidade, Fitts**
- Evidência: só `components/not-patient-button.tsx:131-132` usa `role="dialog"` e `aria-modal`; os da parte B (`staff-dialog.tsx:66-75`, `insurer-list-item.tsx:108,181`, `new-expense-dialog.tsx:252`, `new-contract-dialog.tsx:305`, `new-incident-dialog.tsx:274`, `new-item-dialog.tsx:45`, `movement-dialog.tsx:39`, `pts-templates-manager.tsx:~232`, `instrumentos-manager.tsx:100-110`) são `div fixed inset-0` de três estilos diferentes (também `dialog-backdrop` em `appointment-type-dialog.tsx:43`); fecham com ✕ sem rótulo, sem Esc nem armadilha de foco; vários usam `bg-white` fixo.
- Problema: leitor de tela não anuncia o modal, teclado escapa do modal, e o visual muda de tela para tela.
- Correção: `Dialog` e `ConfirmDialog` compartilhados (usar `<dialog>` nativo) e migrar.
- Esforço: M. Risco: baixo.

**TRV-06 · P1 · fuso horário (UTC no cálculo de "hoje" e "mês")**
- Evidência: `new Date().toISOString().slice(...)` usado para padrões e cálculos: `new-incident-dialog.tsx:314`, `new-expense-dialog.tsx:279`, `new-contract-dialog.tsx:375`, `contas-a-pagar/page.tsx:49`, `configuracoes/profissionais/page.tsx:45`, `app/gestor/data.ts:14-19` (mês corrente em UTC, usado por Repasses e KPIs).
- Problema: das 21h às 24h (Brasília) a data padrão é de amanhã e, no último dia do mês, a competência já virou; conta que vence hoje aparece "atrasada".
- Correção: helper único `todayInClinicTz()` e `currentMonthRange(tz)` usando `CLINIC_TIMEZONE` (já existe em `lib/constants`).
- Esforço: S. Risco: baixo.

**TRV-07 · P1 · REGRA 1 do AGENTS.md: KPIs sem comparativo (lista completa da parte B)**

| Arquivo:linha | Indicador | Falta |
|---|---|---|
| `financeiro/page.tsx:43-68` | Receita bruta, Repasses a pagar, Glosas em aberto, Prazo médio de recebimento | vs mês anterior, % da receita, meta |
| `financeiro/page.tsx:75-137` | séries 6 meses e composição por faixa | valores e referência (tendência existe só nas barras) |
| `financeiro/contas-a-pagar/page.tsx:80-113` | Pendentes no mês, Atrasadas, Total cadastrado | vs mês anterior, orçado |
| `contratos/page.tsx:103-131` | Contratos ativos, MRR, Cobranças pendentes | variação mensal, churn, % do faturado |
| `financeiro/dre/remittance-panel.tsx:69-72` | Consolidado na DRE | vs faturado do mês |
| `financeiro/dre/contas-a-pagar-panel.tsx:362-367` | Total do mês | vs mês anterior |
| `financeiro/dre/page.tsx:70-129` | tabela de 6 meses | coluna Δ vs mês anterior no Resultado Líquido |
| `financeiro-hub/page.tsx:41-57` | Receita operacional total, Resultado líquido total | vs mês anterior e mesmo mês do ano anterior |
| `financeiro-hub/fluxo-caixa/page.tsx:173-196` | Caixa operacional, Financiamento, Variação de caixa | idem |
| `cadastros/estoque/page.tsx:51-84` | Itens, Nível crítico, Patrimônio | vs 30 dias, % abaixo do mínimo |
| `ouvidoria/page.tsx:79-112` | Abertos, Críticos, Eventos adversos (total) | vs período anterior, idade do mais antigo |

Em conformidade: `facilidade-de-uso/page.tsx:41-90` (atual, semana passada, meta e leitura). Relatórios e Configurações não têm KPI de BI (a contagem "N registros" da prévia não é KPI).
- Correção: componente `KpiLine` único (valor, delta vs período anterior, referência/meta, estado) em linha compacta, com o padrão já escrito em `facilidade-de-uso/page.tsx`, usado nas 11 telas.
- Esforço: M. Risco: baixo.

**TRV-08 · P3 · Lei da Similaridade, consistência de cabeçalho**
- Evidência: parte das telas usa `PageHeader` com descrição atrás do "?" (colaboradores, convênios, tipos, protocolos, salas, dados da clínica, cupom, robô); o resto repete `h6` + `h1` à mão com parágrafos visíveis (especialidades, comportamentos, modalidades, intervenções, PTS, estoque, financeiro, contratos, ouvidoria, auditoria). Duplo `<h1>` em `auditoria/page.tsx:118,170` e dentro da aba em `instrumentos-manager.tsx:101`. Rótulos de eixo divergentes: "Cadastros", "Financeiro", "Faturamento Particular" (`contratos/page.tsx:95`), "Qualidade & Compliance" (`ouvidoria/page.tsx:72`), "Gestão & Controladoria" (`relatorios/page.tsx:77`), "Gestão de Recursos & Logística" (`estoque/page.tsx:41`).
- Correção: `PageHeader` em todas, com o rótulo do eixo igual ao item de menu.
- Esforço: M. Risco: baixo.

**TRV-09 · P2 · Doherty, falha silenciosa**
- Evidência: `void toggle...` em `especialidades-manager.tsx:80`, `comportamentos-manager.tsx:78`, `intervencoes-manager.tsx:78`, `modalidades-at-manager.tsx:30`, `prioridades-manager.tsx:155`; `HUB-02` (campo de balanço).
- Problema: `startTransition` com callback síncrono encerra o estado "pendente" na hora, o resultado é descartado; falha e duplo clique ficam invisíveis.
- Correção: `await` dentro de `startTransition(async () => ...)` com toast de erro (padrão já usado em `staff-table.tsx:95-99`).
- Esforço: S. Risco: baixo.

**TRV-10 · P3 · rotas legadas, órfãs e texto desatualizado**
- Evidência: 14 rotas só de redirect (lista em 1.6); `cadastros/page.tsx:3-5` e `cadastros/loading.tsx:4` desatualizados; uso fixo de `DEV_CLINIC_ID` em cerca de 25 telas, enquanto `colaboradores/page.tsx:18-31` e `convenios/page.tsx:20-28` usam a clínica do perfil (`tipos-atendimento/page.tsx:12-22`, `estoque/page.tsx:25-29`, `salas/page.tsx:11-30` etc.).
- Problema: manutenção e risco multi-clínica; os redirects ajudam links salvos, mas somam ruído.
- Correção: manter os redirects, listar no `README` de rotas; padronizar a leitura da clínica num helper.
- Esforço: M. Risco: baixo.

**TRV-11 · P3 · Lei de Jakob: vocabulário**
- Evidência: "Plano de Saúde" (Cadastros, DRE), "Convênio / Plano" e "Todos os convênios" (`report-export-client.tsx:~497-510`), "Operadora / Convênio" (`relatorios/types.ts:195`), "Plano de Saúde (Convênio)" (`appointment-type-dialog.tsx:70`); "DRE", "glosa", "conciliação", "recebível", "MRR", "PTS", "RBAC", "Chave" em telas do gestor sem explicação.
- Correção: escolher "Plano de saúde" como termo único (o repo já o adotou em Cadastros) e criar glossário em tooltip para glosa, conciliação e DRE.
- Esforço: S. Risco: baixo.

**TRV-12 · P2 · duplicidade com outros módulos**
- Evidência: Repasses e Glosas (Financeiro versus Faturamento, FIN-06); Contas a Pagar (aba própria versus painel dentro da DRE, FIN-13); DRE e Fluxo de Caixa (Financeiro versus HUB, HUB-01); Colaboradores & Contas versus Usuários & Permissões (CFG-01); "Pendências" (fila da recepção) refletida em Auditoria (AUD-02).
- Correção: cada conceito com um dono e um link das outras entradas para ele.
- Esforço: L. Risco: médio.

---

## 4. O que já está bom (curto)

- Facilidade de uso é o modelo de KPI correto (valor, semana passada, meta, leitura): `facilidade-de-uso/page.tsx:41-90`.
- LGPD em Relatórios: sensíveis desmarcadas, confirmação, log (`types.ts:101`, `actions.ts:648-670`).
- Senha temporária e PIN: confirmação em modal, valor mostrado uma vez e bloqueio de autoexclusão (`staff-table.tsx:387-537`, `colaboradores/actions.ts:221,263`).
- Linhas de baixa confiança do PDF do plano não entram consolidadas por padrão e levam "conferir" (`dre/actions.ts:86-89`).
- Cupom de check-in com prévia ao vivo; Dados da Clínica em blocos curtos; painel de "Balanço não fecha" (`balanco/page.tsx:46-58`); lançamento rápido de contas usuais com Enter (`contas-a-pagar-panel.tsx:422-504`, ideia boa, ver FIN-13 para o risco).
- A barra superior de Configurações já foi enxugada para 5 itens e `SectionSidebar` mantém o item ativo pelo caminho (`section-sidebar.tsx:41-49`).

---

## 5. Lacunas: o que NÃO foi auditado e por quê

- Nada foi executado: os achados CFG-02 (`-Infinity`), CAD-05 (cor do selo ao editar) e REL-02 (limite de 1000 linhas da API) são por leitura de código e dependem de confirmação em runtime e da configuração do Supabase.
- Não li os componentes compartilhados `PageContainer`, `ToastProvider`, `HelpHint`, `ModuleSkeleton` nem o CSS (`.input`, `.btn`, `.dialog`), logo contraste AA e foco visível não foram medidos.
- Não li `lib/finance-hub/*` além de `month.ts` e do trecho de `repo.ts`, nem as views SQL (`v_contribution_margin`, `metabase_ux_*`), logo não validei se os números exibidos estão certos.
- Não li o CSS de breakpoints; a verificação de uso em celular ficou só pela estrutura (tabelas com `overflow-x-auto`). Para o gestor o uso é principalmente desktop.
- Não auditei Inteligência BI, NPS, Pessoas & Desempenho e Pacientes (parte A).
- Não verifiquei RLS e permissões: as mensagens "verifique sua permissão" podem ser parcialmente corretas em cenários que não testei.
- Não li `app/faturamento/glosas`, só confirmei que existe e que o cabeçalho do Faturamento duplica Repasses e Glosas.

---

## 6. Top 10 por impacto/esforço

1. **CFG-02** (P0, S): corrigir o `Math.max` que impede criar a primeira prioridade de 1ª avaliação (bloqueia a regra 3 do agendamento).
2. **HUB-02** (P0, S): mostrar erro e estado de salvamento nas células de balanço (dado financeiro perdido em silêncio).
3. **FIN-02** (P0, S): confirmação com mês e resumo antes de "Fechar repasses do mês".
4. **CTR-01** (P0, M): mostrar faturas vencidas de meses anteriores e fila de cobrança.
5. **TRV-06** (P1, S): helper de data no fuso da clínica (padrões de data, "atrasada" e competência).
6. **FIN-09 + FIN-03** (P1, S): confirmar e permitir desfazer ao pagar/cancelar conta e repasse, com data real.
7. **FIN-12** (P1, M): despesa "recorrente" que de fato se repete (ou rótulo honesto).
8. **CAD-09** (P1, S): remover o "Novo Instrumento" que não grava.
9. **TRV-07** (P1, M): `KpiLine` único e aplicar nas 11 telas sem comparativo.
10. **AUD-01 + AUD-02** (P1, M): renomear Auditoria, tirar Ouvidoria e Facilidade de uso de baixo de "LGPD" e levar "Pendências escaladas" para a home com contador.
