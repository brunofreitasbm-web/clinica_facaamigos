# Especificação: Fila de entrada (Autorizações)

Nov 10, 2026 · @Bruno Pinto Freitas

## Objetivo e decisões

A tela de Autorizações passa a se chamar "Fila de entrada", com um único modelo de 4 etapas e uma ação principal por caso, para a recepção operar com menos leitura e menos cliques.

| Tema | Decisão |
| --- | --- |
| Escopo | Mudança estrutural, implementada no código do sistema (repositório do GitHub), só em branch e preview, com a produção intocada |
| Sequência de etapas | 1 Documentos recebidos, 2 Guia enviada ao plano, 3 Plano autorizou, 4 Habilitado para agendamento |
| Bloqueio por documento faltando | Nenhuma etapa bloqueia. A tela só avisa o que falta |
| Ação principal com documento faltando | "Enviar guia ao plano" é o botão principal. Cobrar a família é ação secundária |
| Agrupamento da fila | Agir agora, Aguardando família, Aguardando plano, Concluídos, ordenados por quem espera há mais tempo |
| Desfazer | Toda ação tem aviso com "Desfazer" por 8 segundos. Só o envio de WhatsApp pede confirmação, porque não se desfaz |

Risco aceito: sem bloqueio e com "Enviar guia" como principal, a tela empurra a recepção a mandar guia incompleta, e o plano pode negar por falta de laudo. Por isso o aviso de pendência fica colado ao botão, e o caso negado volta para "Agir agora".

## Diagnóstico da tela atual

O maior problema não é visual: o mesmo paciente aparece em três numerações de etapa diferentes e com um botão ativo que não funciona. Observado em 10/11/2026 no caso de um paciente com 6 documentos faltando.

| Problema observado | Lei de UX | Prioridade | Correção |
| --- | --- | --- | --- |
| "Etapa 2/4", "Missão 1/4" e colunas numeradas 3, 4 e 5 para o mesmo caso | Carga cognitiva | Crítica | Uma numeração única de 1 a 4 |
| "Enviar pelo robô" ativo com o robô desligado | Von Restorff, Fitts | Crítica | Sem robô ligado, o principal vira "Marcar guia como enviada" |
| 8 chips, 2 seletores e o alternador Quadros/Lista, com 4 chips mostrando o mesmo número (27) | Hick | Alta | 4 abas que são os grupos da fila e somam o total |
| Data, telefone e carteirinha quebrados em colunas estreitas, com rolagem dentro da rolagem | Proximidade, Região Comum | Alta | Detalhe em coluna única, dados em linha inteira com botão Copiar |
| "Faltam 6" repetido 4 vezes e 4 botões de cobrança por documento | Tesler, Occam | Alta | "O que falta" uma vez, um botão "Cobrar o que falta" |
| Texto pequeno e alvos de clique baixos | Fitts | Alta | Texto mínimo de 14 px, alvos de 40 px |
| Cabeçalho com régua, rótulo, aviso de leads e 2 linhas de chips antes do primeiro paciente | Occam | Média | Uma linha: título, busca e "Só os meus" |
| "No fim da fila" no primeiro item de um grupo chamado "atenção imediata" | Carga cognitiva | Média | Ordenar por tempo de espera e tirar o rótulo |
| Carregamento lento da tela | Limiar de Doherty | Média | Medir antes de mexer: lista leve primeiro, detalhe sob demanda |

## Estrutura da nova tela

Lista à esquerda e detalhe em coluna única à direita, de cima para baixo, sem colunas horizontais e sem rolagem dentro de rolagem.

| Região | Conteúdo | O que sai |
| --- | --- | --- |
| Cabeçalho | Título "Fila de entrada", busca e "Só os meus" na mesma linha. "79 leads ocultos" vira link discreto no fim da lista | Régua decorativa, rótulo "Recepção", aviso de leads no topo |
| Abas | Agir agora, Aguardando família, Aguardando plano, Concluídos, cada uma com sua contagem | 8 chips, 2 seletores, alternador Quadros/Lista |
| Linha da fila | Nome, etapa (ex.: "2 de 4 · Enviar guia") e tempo de espera. Só o atraso ganha cor | Selos Atendido/Não atendido, prévia da mensagem de WhatsApp, "Recepção" repetido em toda linha |
| Cabeçalho do paciente | Nome, telefone, plano e carteirinha em linha inteira, com botão Copiar. Menu "Mais" com Reatribuir e Ajustar cadastro | Telefone e carteirinha quebrados em várias linhas |
| Trilha de etapas | "Etapa 2 de 4", com a etapa atual aberta, as concluídas recolhidas em uma linha e as futuras só com o título, sem botão | Numerações 2/4, 1/4 e colunas 3, 4, 5 |
| O que falta | Lista marcável uma única vez, dentro da etapa 1 | As 4 repetições de "Faltam 6" |
| Dados recebidos | Recolhidos por padrão, abertos só sob demanda | Bloco longo sempre aberto |

## Regras de comportamento

Cada caso tem um único botão principal, sempre ligado à etapa 2, 3 ou 4. A etapa 1 nunca tem botão principal, porque documento faltando não bloqueia.

| Etapa | Botão principal | Ações secundárias |
| --- | --- | --- |
| 1 Documentos recebidos | Nenhum | "Cobrar o que falta" (uma mensagem de WhatsApp com todos os itens pendentes), marcar documento como recebido, "Abrir conversa" |
| 2 Guia enviada ao plano | "Enviar guia ao plano". Robô ligado: envia pelo robô. Robô desligado: "Marcar guia como enviada" | "Cobrar o que falta" |
| 3 Plano autorizou | "Subir guia autorizada (PDF)". O sistema habilita o agendamento e abre o WhatsApp com o aviso à família | "Plano negou", "Plano pediu mais documentos" |
| 4 Habilitado para agendamento | Nenhum, caso concluído | Ver histórico |

Regras que valem para todas as etapas:

- Com documento faltando, o aviso fica logo acima do botão da etapa 2, com os itens pendentes: "Faltam laudo e pedido médico. O plano pode negar."
- Cada ação mostra um aviso com "Desfazer" por 8 segundos, e o caso volta ao estado anterior se desfeito.
- Só o envio de mensagem de WhatsApp pede confirmação, com a mensagem pronta para conferir. É o único ponto que não se desfaz.
- "Plano negou" devolve o caso para a etapa 2 e para o grupo "Agir agora".
- Etapas futuras ficam sem botão. Etapas concluídas ficam recolhidas em uma linha.
- Texto mínimo de 14 px, alvos de clique com 40 px de altura e nenhuma frase em caixa alta.

**Em qual grupo cada caso cai** (um caso está em um grupo só, e a soma dos grupos fecha com o total):

| Grupo | Entra quando |
| --- | --- |
| Agir agora | A guia ainda não foi enviada ao plano e a família não foi cobrada, ou o plano autorizou e falta subir o PDF, ou o plano negou |
| Aguardando família | Faltam documentos e a cobrança já foi enviada |
| Aguardando plano | A guia foi enviada e o plano ainda não respondeu |
| Concluídos | Etapa 4 concluída |

## Pontos em aberto

Cada ponto abaixo muda o comportamento da tela e tem uma suposição minha, ainda não confirmada por você. Confirmar ou corrigir antes da fase 1.

| Ponto | Por que importa | Suposição atual |
| --- | --- | --- |
| Quais documentos o plano realmente exige para aceitar a guia | Define o texto do aviso "o plano pode negar" sem bloquear | Laudo e pedido médico, a confirmar |
| Caso em "Aguardando família" com a guia ainda não enviada | Fica fora de "Agir agora", embora a guia possa ser enviada | Aceito: o botão principal continua disponível no detalhe |
| O que a recepção faz depois da etapa 4 | A tela termina sem próxima ação | Caso concluído, sem botão |
| Prazo para marcar um caso como atrasado | Controla a cor na linha da fila | 5 dias de espera |
| Destino dos 79 leads ocultos | Hoje são um aviso no topo | Link discreto no fim da lista |
| Caminho de "Plano pediu mais documentos" | Não existe hoje na tela | Volta para a etapa 1, grupo "Aguardando família" |
| Quem liga o robô do portal e quando | Muda o rótulo do botão da etapa 2 | Tela lê o estado do robô e troca o rótulo sozinha |
| Números divergentes entre telas (autorizações no menu, no Painel e na Recepção) | A nova contagem precisa bater com o menu | Menu passa a mostrar apenas "Agir agora", a conferir |

## Plano de implementação

A implementação ainda não começou: a sessão em que esta especificação foi escrita não tem acesso ao código. Ela precisa rodar numa sessão vinculada ao computador com a pasta da Clínica, em branch e preview, com a produção intocada.

| Fase | Entrega | Critério de aceite |
| --- | --- | --- |
| 1 | Uma função única que calcula etapa (1 a 4) e grupo de cada caso, com testes. Sem mudar o visual | Nenhum caso mostra duas numerações. A soma dos 4 grupos é igual ao total |
| 2 | Cabeçalho de uma linha, 4 abas e nova linha da fila | Os chips e seletores antigos não existem mais. O primeiro paciente aparece sem rolar |
| 3 | Detalhe em coluna única, trilha de etapas e um botão principal por caso | Telefone, data e carteirinha em uma linha. Botão do robô só ativo com o robô ligado |
| 4 | "Cobrar o que falta" unificado, aviso de pendência, desfazer de 8 segundos | Toda ação, menos o envio de WhatsApp, pode ser desfeita |
| 5 | Texto mínimo de 14 px, alvos de 40 px e medição de carregamento | Lista abre antes do detalhe. Tempo medido antes e depois |
| 6 | Validação no preview pelas 3 atendentes, com casos reais, antes do merge | Cada atendente conclui 5 casos sem ajuda. Problemas anotados viram ajuste |

A fase 6 é o ponto fraco de ir direto ao código: sem ela, a primeira vez que a recepção vê o desenho é em produção.
