# Fila de entrada: medição de carga e acessibilidade (fase 5)

Escopo: tarefa 6 do plano `2026-11-10-fila-de-entrada.md`. Esta sessão não tinha banco, preview nem Playwright, então só o que é verificável por código está registrado como medido. O resto está em "Pendente de medir no preview".

## O que mudou

- A página manda ao navegador só a lista leve (`toIntakeListItem`, em `app/recepcao/a-autorizar/intake-list-item-pure.ts`): id, nome, responsável, texto de busca, etapa, grupo, espera, telefone, data de criação e a contagem de conversas unificadas.
- Arquivos, dados lidos, mensagens, avisos, cobranças e pendências detalhadas saem da lista. O caso aberto busca o rascunho completo em `GET /api/recepcao/fila-de-entrada/[draftId]`, que devolve o mesmo rascunho consolidado da lista (`getConsolidatedRegistrationDraft`), para lista e detalhe nunca divergirem.
- Route Handler e não Server Action de propósito: a documentação do Next desta versão diz que Server Functions rodam uma por vez no cliente, então trocar de caso rápido enfileiraria as buscas atrás umas das outras e atrás das ações de gravação. O `fetch` do detalhe é cancelado (AbortController) ao trocar de caso.
- `?item=` continua funcionando: o caso do link abre selecionado e o detalhe carrega na montagem, com um esqueleto leve (nome já visível) enquanto chega.
- Depois de uma ação, `router.refresh()` troca a lista e o detalhe é buscado de novo. O detalhe antigo fica na tela até o novo chegar, sem piscar o esqueleto.

## Payload serializado, antes e depois (estimativa estática)

Método: `node --experimental-strip-types perf/intake-payload-estimate.mjs`. Monta um caso sintético típico de lead de WhatsApp (4 arquivos, 14 dados lidos, 20 mensagens, 9 pílulas de pendência, 2 cobranças, 1 aviso) e mede o JSON. Não é medida de produção: o tamanho real depende do conteúdo das mensagens e dos dados.

| Forma | Commit | Bytes por caso | Observação |
| --- | --- | --- | --- |
| A | `5dc43a2` | 8574 ou mais | `items` (com o painel `detail` montado no servidor) mais a fila completa. O `detail` é RSC e depende do render real, por isso o valor é um piso. |
| B | `59eeec9` (início da tarefa 6) | 8574 | `items` sem `detail` (831 bytes) mais a fila completa (7743 bytes). |
| C | agora | 854 | Lista leve. O caso aberto soma 7109 bytes sob demanda. |

Total estimado da página (lista mais um caso aberto), por número de casos na fila:

| Casos | B (bytes) | C (bytes) | Economia |
| --- | --- | --- | --- |
| 1 | 8574 | 7963 | 7% |
| 50 | 428700 | 49809 | 88% |
| 100 | 857400 | 92509 | 89% |

Leitura: a lista deixa de crescer com o peso de cada rascunho (de cerca de 8,6 KB por caso para cerca de 0,9 KB). O ganho real no tempo depende de rede e servidor e ainda não foi medido. O custo de servidor de `getReceptionQueue` (consultas ao Supabase) não muda nesta tarefa: a página ainda carrega a fila toda para montar a lista, porque grupo, etapa e busca vêm do rascunho. Só o que viaja ao navegador encolheu.

## Acessibilidade (verificação estática)

`tests/intake-a11y-static.test.ts` lê o código-fonte da tela e falha em: `text-xs`, `text-[Npx]` com N menor que 14, `uppercase` e elemento interativo sem `min-h-10`, `h-10` ou maior. Exceções fechadas e justificadas no próprio teste (link em linha dentro de frase, checkbox nativo cujo alvo é o rótulo).

Corrigido nesta tarefa: os dois links do estado vazio em `page.tsx` (texto de 12 px, sem altura mínima) e o link "leads ocultos" no rodapé da lista (sem altura mínima). Os demais componentes já cumpriam as regras.

Limite: o teste não mede pixels renderizados nem componentes compartilhados com Chat e Pendências usados dentro do detalhe (por exemplo o ajuste de cadastro e a dica de ajuda).

## Pendente de medir no preview

Nada abaixo foi medido; precisa de preview com banco real e uma sessão logada.

1. Linha de base e depois com `perf/intake-load.mjs`: `BASE_URL=<preview> SESSION_COOKIE='<cookie>' node perf/intake-load.mjs 10`, uma vez no commit `59eeec9` e uma vez neste commit. Registrar TTFB mediano, tempo total mediano e bytes (HTML e RSC).
2. Tempo até a lista visível e até o detalhe visível com Playwright (a lista aparece sem esperar o detalhe; o esqueleto some quando `GET /api/recepcao/fila-de-entrada/[draftId]` responde).
3. Tempo de resposta do próprio `GET /api/recepcao/fila-de-entrada/[draftId]` (p50 e p95) com a fila real; ele agora refaz a consulta e a consolidação da fila inteira no servidor (para devolver o mesmo caso consolidado da lista), então o p95 pesa mais do que o de um rascunho avulso.
4. Tamanho real do payload RSC da forma A (`5dc43a2`), com o `detail` montado no servidor, para fechar a comparação A, B e C.
5. Checagem automática no Playwright em tela renderizada: nenhum texto com tamanho computado abaixo de 14 px e nenhum botão ou link com altura computada abaixo de 40 px, em desktop e em celular.
6. Conferir com casos unificados (mais de uma conversa do mesmo responsável) que arquivos e dados do detalhe batem com o que a lista mostrava antes: o detalhe passa pela mesma consolidação da lista.
7. Tempo de `router.refresh()` após uma ação (lista nova mais nova busca do detalhe) para confirmar que não há piscar perceptível.
