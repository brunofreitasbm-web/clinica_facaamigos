# Comparativo de performance — antes vs. depois

Gerado em 2026-09-16T22:43:33.117Z

- **Antes** (`baseline2`): 2026-09-16T22:39:23.696Z, 8 iterações/rota
- **Depois** (`after2`): 2026-09-16T22:40:47.519Z, 8 iterações/rota

Todas as medições contra `next build && next start` (produção), nunca `next dev`. Mediana de todas as iterações (1ª iteração inclusa — sem warm-up separado nesta rodada).

## Navegação por rota (cold nav)

| Rota | TTFB antes | TTFB depois | DOMContentLoaded antes | DOMContentLoaded depois | Δ DCL |
|---|---|---|---|---|---|
| Gestor (painel) (`/gestor`) | 260 ms | 244 ms | 1160 ms | 1176 ms | +16 ms (+1%) ↑ |
| Gestor > Inteligência (`/gestor/inteligencia`) | 248 ms | 228 ms | 596 ms | 617 ms | +22 ms (+4%) ↑ |
| Gestor > Financeiro (`/gestor/financeiro`) | 244 ms | 232 ms | 987 ms | 958 ms | -29 ms (-3%) ↓ |
| Recepção (agenda do dia) (`/recepcao`) | 229 ms | 227 ms | 961 ms | 815 ms | -146 ms (-15%) ↓ |
| Recepção > Pacientes (`/recepcao/pacientes`) | 238 ms | 256 ms | 454 ms | 485 ms | +31 ms (+7%) ↑ |
| Supervisão (Coordenação) (`/supervisao`) | 249 ms | 239 ms | 632 ms | 568 ms | -65 ms (-10%) ↓ |
| Terapeuta (agenda) (`/terapeuta`) | 224 ms | 223 ms | 878 ms | 838 ms | -40 ms (-5%) ↓ |
| Faturamento (`/faturamento`) | 236 ms | 217 ms | 881 ms | 845 ms | -36 ms (-4%) ↓ |

## Transição de menu (clique, sem reload completo)

| De → Para | Antes (mediana) | Depois (mediana) | Δ |
|---|---|---|---|
| /gestor → /gestor/inteligencia | 377 ms | 848 ms | +471 ms (+125%) ↑ |

## Dados brutos

Ver `perf/results/baseline2.json` e `perf/results/after2.json`.

## Ruído de medição (rodada A/B/A)

Antes de confiar nos números acima, rodei o MESMO build de baseline duas vezes seguidas
(`baseline2` vs `baseline3`, código idêntico, mesmo servidor, mesma máquina) para medir o
piso de ruído do método:

| Rota | Δ DCL (baseline2 → baseline3, código idêntico) |
|---|---|
| /gestor | +1% |
| /gestor/inteligencia | -1% |
| /gestor/financeiro | -7% |
| /recepcao | -3% |
| /recepcao/pacientes | -1% |
| /supervisao | -3% |
| /terapeuta | -3% |
| Transição de menu (clique) | **+66%** (377ms → 627ms, sem nenhuma linha de código diferente) |

**Conclusão honesta:** nas condições desta rodada — clínica de teste quase sem dado
(paciente=1, a maioria dos cards mostrando "Total: 0"), máquina compartilhada com outros
processos rodando (inclusive o `next dev` do próprio projeto, aberto em paralelo), e um
único worker do Playwright — os deltas de navegação fria (TTFB/DOMContentLoaded) ficam
**dentro da faixa de ruído puro** (±1% a ±15%), e a métrica de transição de menu por
clique é ainda mais instável (chegou a variar +66% entre duas rodadas do MESMO código).

Isso não significa que as otimizações não funcionam — a redução de query count por
rota (documentada em texto na conversa, não neste arquivo) é determinística e vem
direto da leitura do código, não de medição de relógio. Mas com pouquíssimo dado no
banco, uma query a mais ou a menos custa poucos ms de qualquer forma — é exatamente
com volume de dado real (centenas de pacientes, milhares de appointments) que o
paralelismo e a deduplicação de queries viram diferença perceptível. Uma medição
confiável exigiria: (1) um projeto Supabase de teste com volume de dado realista
(idealmente uma branch do Supabase, ver Supabase MCP `create_branch`), (2) a máquina
sem outros processos concorrentes (fechar o `next dev` aberto), e (3) mais iterações
por rodada. Nenhuma dessas três condições esteve garantida aqui.
