# Robô de autorização no portal do plano

Automatiza a etapa 2 da linha do tempo de **Autorizações** ("Guia enviada ao
plano"). Em vez de sair do sistema para preencher o portal do convênio, a
recepção clica em **Enviar pelo robô** no cartão da etapa 2. Um agente instalado
num computador da clínica preenche o portal, anexa o laudo, para no resumo e
espera a recepção **confirmar na própria tela do CRM**. Só então clica em
Autorizar e devolve o resultado (status do portal, nº da guia do prestador e o
print da tela). A etapa 2 é marcada sozinha.

Primeiro portal suportado: **Conecta Saúde (Benner) — IASEP**, guia SP/SADT eletiva.

## Por que um agente local

O CRM roda na Vercel, que não abre navegador. O preenchimento do portal precisa
de um navegador de verdade (Playwright/Chromium). Por isso o robô roda num
computador da clínica e **é ele quem chama o CRM** (nenhuma porta aberta na
rede da clínica). A senha do portal fica só no `.env` desse computador.

```
Recepção (CRM, navegador)          CRM (Vercel + Supabase)                Agente (PC da clínica)
 "Enviar pelo robô"  ───────────▶  portal_robot_jobs: na_fila
                                   ◀── POST /api/portal-robot/claim ────  reserva o pedido, baixa o laudo
                                   ◀── POST /api/portal-robot/progress ─  passos 1..5 no portal
 vê o resumo, "Confirmar envio" ─▶  status: confirmado  ── progress ──▶  clica em Autorizar
                                   ◀── POST /api/portal-robot/result ───  enviado + print
 etapa 2 marcada                   registration_drafts.guide_sent_at
```

## O que entrou no código

| Arquivo | O quê |
|---|---|
| `supabase/migrations/20261106120000_portal_robot.sql` | Tabelas `portal_robot_jobs`, `portal_robot_agents`, `portal_robot_professionals`, RLS e a função `claim_portal_robot_job` (reserva atômica + recuperação de agente que parou). |
| `lib/portal-robot-pure.ts` + `tests/portal-robot-pure.test.ts` | Validação do pedido (CID-10, CBO, terapias), mês de referência, transições de status. |
| `lib/portal-robot.ts` | Autenticação do agente por token, link temporário do laudo, upload do print, marcação da etapa 2. |
| `app/api/portal-robot/{claim,progress,result}/route.ts` | Rotas que o agente chama. |
| `lib/supabase/middleware.ts` | `/api/portal-robot` entra nas rotas públicas (o agente não tem cookie; autentica por token e recebe 401 sem ele). |
| `app/recepcao/pacientes/pendencias/portal-robot-actions.ts` | Server actions da tela (pedir, confirmar, cancelar, estado). |
| `app/recepcao/pacientes/pendencias/portal-robot-panel.tsx` | Painel e formulário no cartão da etapa 2. |
| `app/recepcao/pacientes/pendencias/draft-pipeline.tsx` | Encaixe do painel na etapa 2 (o botão manual continua). |
| `agente-robo/` | O agente (Python + Playwright) e os passos do portal Conecta. |
| `app/gestor/configuracoes/robo-portal/` | Tela do gestor para cadastrar, desativar e reativar os computadores do robô (gera o token sem passar pelo SQL Editor). |

## Regras de segurança do fluxo

- **Nada é enviado sem confirmação humana** no modo "Enviar ao plano". O modo
  "Só simular" preenche tudo e para no resumo, sem enviar.
- **Um pedido em aberto por contato** (índice único). Contato com guia já
  enviada/autorizada/dispensada não aceita pedido novo (AGENTS.md §3).
- **Depois de confirmado, nunca repete sozinho.** Se o robô clicou em Autorizar
  e não leu a resposta, o pedido fica em **"Conferir no portal"**. Se o agente
  parar depois da confirmação, a próxima reserva marca o pedido assim também.
- **Cancelar** só antes da confirmação.
- O agente só enxerga pedidos da clínica dele. O token fica só no agente; o
  banco guarda o SHA-256.
- CID no padrão CID-10 (o portal não aceita CID-11, como 6A02).

## Instalação

### 1. Banco
Aplicar a migration `20261106120000_portal_robot.sql` (Supabase CLI ou SQL Editor).
Atualizar `lib/database.types.ts` quando for conveniente (o código usa cast
para as tabelas novas, como já é feito em `lib/reception-queue.ts`).

### 2. Token do agente
No CRM, como gestor: **Configurações → Robô do portal → Cadastrar robô**. O
sistema gera o token, guarda só o SHA-256 e mostra a linha `AGENT_TOKEN=...`
uma única vez, para colar no `.env` do agente. Na mesma tela dá para
**desativar** (corta o acesso na hora) e reativar cada computador, e ver se ele
está ligado.

Alternativa pelo terminal, no computador do agente:

```bash
python3 gerar_token.py "Computador da recepção"
```

e rodar o `insert` mostrado no SQL Editor do Supabase.

### 3. Agente
Na pasta `agente-robo/`: copiar `env.exemplo` para `.env`, preencher
`CRM_URL`, `AGENT_TOKEN`, login do portal e dados do atendente. Rodar
`iniciar.bat` (Windows) ou `./iniciar.sh` (Linux). Na primeira vez ele instala
o Playwright e o Chromium. A janela fica aberta enquanto a clínica usa o robô;
a tela do CRM mostra "Robô do portal ligado/desligado".

### 4. Primeiro uso
Num contato real, usar **"Só simular"** e conferir o resumo no portal (o
navegador do agente fica visível com `HEADLESS=0`). Com a simulação certa,
usar "Enviar ao plano".

## Próximos passos possíveis

- Etapa 3 automática: o agente consulta no portal as guias "Em análise",
  baixa o PDF quando autorizada e chama a mesma lógica de `registerAuthorizedGuide`
  (o leitor `parseAuthorizedGuidePdf` já existe).
- Outros portais (Unimed, GEAP…) como novos módulos do agente, escolhidos por
  `portal_robot_jobs.portal`.
