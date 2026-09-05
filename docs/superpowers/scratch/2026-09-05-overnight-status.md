# Status da madrugada — sessão autônoma até 8h de 05/09/2026

Trabalho feito enquanto o Bruno dormia, a pedido dele ("implemente tudo que o PRD
especifica... de forma autônoma até as 8h... o que não puder decidir, pule").
Nota: percebi que há outro processo/agente rodando em paralelo no mesmo repo
(auto-commit com mensagens tipo "feat: expand clinic management system with new
ABA modules, automated WhatsApp integration..." — commits `03ca874`, `035b05a`)
adicionando `lib/aba-actions.ts`, `components/aba/*`, `app/api/aba/`,
`app/api/webhooks/whatsapp`, `app/gestor/integracoes/whatsapp`,
`app/faturamento/guias`, `app/faturamento/repasses`. Não toquei nesses arquivos
além de instalar `lucide-react` (dependência que faltava e quebrava o build de
`evolution-form.tsx`/`abc-logger.tsx`/`aba-progress-chart.tsx` — instalada e
confirmada).

## O que foi implementado e validado nesta sessão

1. **Fila de pendências completa da recepção** (§9.1) — `lib/reception-queue.ts`,
   `/recepcao/pacientes/pendencias`, widget na home. Bug real corrigido:
   `first_contact_at` era gravado na criação do lead (zerava a métrica
   `first_response_min` e o alerta "sem retorno" nunca disparava) —
   `app/recepcao/pacientes/actions.ts`. **Validado contra o banco real** via
   MCP Supabase (insert/rollback) — inclusive achei um lead real de produção
   parado há mais de 15min sem retorno.

2. **Guia vencendo** — ajustado de 7 pra 15 dias + critério de poucas sessões,
   em `app/recepcao/page.tsx` (isso já existia real, só a regra estava
   incompleta).

3. **LGPD — log de acesso a prontuário** (`record_access_log`, nunca era
   escrito) — `lib/record-access-log.ts`, chamado nas 4 telas que abrem dado
   clínico, e `/gestor/auditoria` pra consulta.

4. **`metric_snapshots` — fechamento mensal automático** (§10.6) — migration
   `20260904000027` + `20260904000028` (revoke RPC pública) + `20260904000029`
   (fix de bug real: variável PL/pgSQL `period_start` colidia com coluna no
   `ON CONFLICT`). **Aplicado e validado no projeto Supabase real**
   (`vththexblpxwocbowhsv`) com dataset de teste em transação revertida.
   Também corrigi bonificação (`app/gestor/bonificacao/*`) que antes
   devolvia PLR/faixa 100% fabricados — agora usa `getBonusRows`/
   `getTierProgression` reais.

5. **CRUD de metas por cargo** (`targets`, §10.6) — `lib/metric-catalog.ts`,
   `/gestor/metas`. **Validado** insert/delete contra o banco real.
   Atingimento só é calculado pras 3 métricas que já têm pipeline real
   (no_show_rate, occupancy_rate, glosa_rate) — as outras ~18 do §10 aparecem
   no cadastro mas mostram "sem cálculo ainda" (honesto, não inventado).

6. **Painel de glosa por motivo/convênio/pessoa** (§9.8/§10.4) —
   `lib/glosa-analytics.ts`, integrado em `/faturamento/glosas`.
   **Validado** a cadeia de joins (insurers→billing_periods→billing_items→
   glosas) contra o banco real com dataset controlado.

7. **Relatório de evolução em PDF pro convênio** (§8 Fase 2) — biblioteca
   `@react-pdf/renderer` instalada; `lib/insurer-report-pdf.tsx`,
   `/terapeuta/paciente/[id]/relatorio-convenio`. Salvaguarda §9.4-A
   respeitada: só usa `plan_goals` (texto da própria clínica), nunca toca
   `protocol_items`/`protocol_assessments`. **Geração do PDF validada de
   verdade** (rodei a função real no servidor Next.js local, gerou PDF válido,
   3171 bytes, header `%PDF-`). **Upload pro Storage NÃO pôde ser validado
   localmente** — motivo abaixo.

8b. **"Confirmar presença" no portal da família** (§9.7, era stub "Em breve")
   — migration `20260904000030`: função `confirm_attendance(uuid)` security
   definer (RLS comum não restringe QUAIS colunas um UPDATE altera, então
   uma policy aberta deixaria a família mexer em terapeuta/sala/horário da
   sessão — a função só permite official 'agendada'→'confirmada'). **Validado
   contra o banco real**: responsável sem vínculo bloqueado, responsável
   certo confirma, confirmar 2x bloqueado, `anon` sem permissão de chamar.

8c. **Pesquisa NPS trimestral no portal da família** (§9.7, nunca teve UI) —
   `lib/survey-period.ts`, `app/familia/survey-prompt.tsx`,
   `submitSurvey()`. Achei e corrigi mais um bug real de RLS na mesma
   descoberta: `survey_responses_write` (migration original 000011) só
   conferia que o `guardian_id` pertencia a quem estava logado, **nunca que
   esse guardian era responsável pelo `patient_id` enviado** — um
   responsável logado podia gravar NPS pra QUALQUER paciente da clínica,
   poluindo a métrica `family_nps` de outro terapeuta. Corrigido na migration
   `20260904000031`, junto com uma constraint única (patient_id, guardian_id,
   period) pra impedir resposta duplicada no mesmo trimestre. **Validado**:
   guardian sem vínculo ao paciente bloqueado, guardian certo grava, segunda
   resposta no mesmo trimestre bloqueada pela constraint.
   Nota: a métrica `family_nps` (§10.3) continua "sem cálculo" no catálogo —
   só constrói a coleta de dados, não a agregação por terapeuta em
   `metric_snapshots` (a pergunta sobre "terapeuta" hoje é uma nota
   categórica genérica, não teria como escopar por profile_id sem redesenhar
   o formulário; deixei assim de propósito em vez de inventar o vínculo).

9. **Fix de navegação real**: o item "👥 Pacientes" da navegação do terapeuta
   era um `<span>` morto — não existia NENHUMA lista de pacientes pro
   terapeuta, então `/terapeuta/paciente/[id]/{metricas,avaliacao,relatorio,
   relatorio-convenio}` eram todas rotas órfãs (inalcançáveis dentro do app).
   Criei `/terapeuta/pacientes` e liguei o link.

8d. **Múltiplos filhos no portal da família** (limitação documentada antes —
   "mostra só o primeiro filho") — `?patient=<id>` na query string, validado
   contra a lista já filtrada pela RLS (nunca aceita um id de fora dela).
   Chips "Ver {nome}" pros outros filhos.

## ⚠️ Achado importante — ambiente local sem credenciais reais do Supabase

`.env.local` tem `SUPABASE_SERVICE_ROLE_KEY=placeholder-for-build` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` também placeholder. Ou seja: **o dev server
local nunca teve uma chave real do Supabase configurada** — isso não é algo
que eu quebrei, já estava assim. Consequência prática:
- Toda validação de dado real que fiz nesta sessão foi via MCP Supabase
  (`execute_sql`/`apply_migration`) direto no projeto hospedado, **não**
  através do app rodando localmente.
- `uploadDocument`/`getDocumentUrl` (upload de anexo, já existente) e o novo
  `generateInsurerReport` (upload do PDF) usam `createAdminClient()` — isso
  **nunca funcionou localmente** com essas credenciais placeholder, e
  continua não funcionando agora (não é regressão minha).
- Em produção (Vercel), presumo que as env vars reais estejam configuradas
  separadamente — mas não tenho como confirmar isso daqui. **Isso é uma
  decisão/verificação seu**: confirmar que o Vercel tem
  `SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` reais (não os
  placeholders do `.env.local`), senão upload de documento/PDF nunca
  funcionou em produção também.
- Confirmei via SQL que o bucket `clinic-documents` existe, é privado, aceita
  qualquer mime type, limite 25MB — então o código deve funcionar assim que
  as credenciais reais estiverem presentes; só não pude provar o upload
  ponta-a-ponta.

## O que fica pra você decidir às 8h

1. **Confirmar as env vars reais no Vercel** (item acima) — sem isso não dá
   pra saber se upload de documento (recurso já existente, não só o meu)
   funciona em produção.
2. **Escopo do relatório PDF pro convênio**: fiz a versão mínima (metas do
   plano aprovado + frequência). Não incluí gráfico de aquisição por
   protocolo (VB-MAPP/ABLLS-R/ESDM) porque isso exigiria decidir com cuidado
   o que exportar sem vazar texto de item licenciado (§9.4-A) — preferi não
   arriscar isso sozinho de madrugada. Se quiser esse gráfico no PDF, me diga
   e eu desenho a salvaguarda com calma.
3. **`targets` sem UI de exclusão em massa nem edição** — só criar/remover.
   Se quiser editar peso/meta sem recriar, é rápido de adicionar.
4. Não mexi nos jobs de cron restantes do PRD (evolução pendente D-1
   proativa por WhatsApp, já que você decidiu manual; alertas adicionais)
   nem em Fase 4 (grupo/escola, telessessão, TISS nativo) — fora do escopo
   desta madrugada.

## Verificações de qualidade rodadas

- `npm run build` limpo (compilação + typecheck) depois de cada mudança.
- `npx eslint` limpo em todos os arquivos tocados.
- Migrations SQL validadas contra o projeto Supabase real
  (`vththexblpxwocbowhsv`) com dataset de teste dentro de transação
  revertida (`begin; ... rollback;`) — nunca deixei dado de teste no banco.
- Achei e corrigi 2 bugs reais que só apareceram testando de verdade (não no
  build): coluna ambígua em PL/pgSQL, e RPC de cron exposta publicamente via
  PostgREST (corrigido com `REVOKE EXECUTE`).
