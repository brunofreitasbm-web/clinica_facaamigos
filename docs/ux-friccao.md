# Monitor de fricção de uso

Mede, sem perguntar nada ao operador, **onde o sistema atrapalha**: quem hesita,
erra, clica sem resposta ou se perde procurando uma ferramenta. Serve para
decidir o que melhorar primeiro.

Os relatórios ficam na tela **Gestão › Auditoria (LGPD) › Facilidade de uso**
(`/gestor/facilidade-de-uso`, só para o gestor). Metabase não é usado (custo).
Toda tabela tem a semana atual, a semana anterior e uma meta, e um texto de
**leitura** que já explica em português o que o número sugere.

## O que é coletado (e o que nunca é)

| Coleta | Nunca coleta |
|---|---|
| Qual tela (ids trocados por `:id`) | O que foi digitado em qualquer campo |
| Tipo de sinal (ver abaixo) | Nome de paciente, CPF, telefone, e-mail |
| Rótulo curto de botão (ex.: "Salvar guia") | Rótulo de botões dentro de listas/tabelas (viram "botão dentro de lista") |
| Tempo na tela, nº de cliques | Telas públicas, login e portal da família |

Só o **gestor** lê. Dados com mais de 180 dias devem ser apagados
(`select purge_ux_events(180);`, agendável em Supabase → Database → Cron).
Como é monitoramento de equipe, avise os operadores de que o sistema mede
*telas e tropeços*, não pessoas — o objetivo é melhorar o sistema, não avaliar gente.

## Os sinais, em português

| Sinal | O que significa | Quando preocupa |
|---|---|---|
| **Cliques repetidos** | 3+ cliques no mesmo ponto em 1 segundo | O botão parece não responder (falta um "salvando…", ou está lento) |
| **Clique sem resposta** | Clicou em algo que parece botão e a tela não mudou em 1 s | Botão quebrado, ou área que parece clicável mas não é |
| **Erro de formulário** | O navegador barrou o envio (campo obrigatório/inválido) | Campo obrigatório pouco visível ou instrução confusa |
| **Erro do sistema** | Apareceu aviso vermelho ou tela de erro | Pode ser defeito do sistema, não dificuldade do operador |
| **Saída rápida** | Ficou menos de 5 s na tela | Chegou na tela errada — caminho confuso |
| **Vai-e-volta** | Tela A → tela B (< 15 s) → volta para A | B não era o que procurava: o nome/lugar do atalho engana |
| **Tempo até a 1ª ação** | Segundos entre abrir a tela e o primeiro clique/tecla | Alto = hesitação; a tela pode estar carregada de informação |

## De onde vêm os números

A tela lê 4 views do banco (`supabase/migrations/20260929000000_ux_friction_events.sql`),
protegidas para só o gestor da clínica enxergar. Os nomes começam com `metabase_`
por herança; hoje quem lê é a própria tela.

| View | Pergunta que responde | Seção da tela |
|---|---|---|
| `metabase_ux_friction_kpis` | "Estamos melhorando ou piorando? Em qual área?" | Três cartões, "Por área" e "Evolução semana a semana" |
| `metabase_ux_friction_by_page` | "Qual tela devo consertar primeiro?" | "O que consertar primeiro" |
| `metabase_ux_friction_by_element` | "Que botão não funciona?" | "Botões que não respondem" |
| `metabase_ux_navigation_loops` | "O que as pessoas não estão achando?" | "Onde não estão achando o que procuram" |

Cuidados de leitura:

- **`semana_em_andamento = true`**: a semana ainda não fechou; as taxas valem, os totais não.
- **Poucos dados** (`leitura` avisa): abaixo de ~30 telas vistas na semana, não tire conclusão.
- **Uma pessoa só** (`usuarios_distintos = 1`) costuma ser dúvida individual, não defeito do sistema. Vários usuários no mesmo ponto é sinal de problema real.
- **Metas (15% de sessões com tropeço, 5 sinais/100 telas, 10 s até a 1ª ação, 25% de saídas rápidas, 3 vai-e-voltas)** são **premissas iniciais**. Ajuste depois de 3–4 semanas de dados, quando você souber o que é normal na clínica.

## Para o desenvolvedor

- Tela: `app/gestor/facilidade-de-uso/` (leitura em `data.ts`); regras de comparativo e textos em `lib/ux-friction-report.ts` + `tests/ux-friction-report.test.ts`.
- Coletor: `components/friction-tracker.tsx` (montado em `app/layout.tsx`).
- Regras puras e testes: `lib/ux-friction.ts`, `tests/ux-friction-pure.test.ts`.
- Gravação: `app/api/ux-events/route.ts` (service role; papel e clínica vêm do perfil no servidor, nunca do navegador; papel `responsavel` não é gravado).
- Dar nome estável a um botão no relatório: `data-ux="Salvar guia"`. Excluir uma área sensível: `data-ux-ignore`. Marcar contêiner que mostra dado de paciente: `data-ux-private`.
- Erro de negócio que o operador vê como aviso vermelho já é capturado pelo `toast(..., "error")`. Evite colocar dado de paciente no texto do erro: o texto entra no relatório (com e-mails e números longos removidos).
- Falsos positivos de "clique sem resposta": ações que só afetam o servidor sem mexer na tela. Se um botão legítimo aparecer no relatório, faça-o dar retorno visual (spinner/toast) — isso também é uma melhoria de uso.
