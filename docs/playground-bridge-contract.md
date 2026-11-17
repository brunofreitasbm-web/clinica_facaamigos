# Contrato da ponte PDV ⇄ clínica (avaliação no playground)

Fonte da verdade: a clínica. O PDV (edge function `playground-eval-bridge`) é o único cliente.
Plano completo: `/root/.claude/plans/implementar-uma-funcionalidade-em-curried-biscuit.md`.

## Transporte e autenticação
- Todas as chamadas são `POST` em `${CLINIC_URL}/api/playground/<acao>`, corpo JSON, `Content-Type: application/json`.
- Headers obrigatórios:
  - `x-fa-bridge-timestamp`: segundos Unix (inteiro).
  - `x-fa-bridge-signature`: hex de `HMAC-SHA256(secret, "<timestamp>.<corpoBrutoExato>")`.
- `secret` = `PLAYGROUND_BRIDGE_SECRET` na clínica e `CLINIC_BRIDGE_SECRET` no PDV (mesmo valor).
- Janela de 300 s. Referência: `lib/playground/bridge-auth.ts` (`signBridgeBody`, `verifyBridgeSignature`).
- Erros: `{ "ok": false, "code": "<codigo>", "error": "<mensagem em português>" }`.
  - **4xx = definitivo** (não reenviar). Códigos: `bad_request`, `unauthorized`, `not_found`, `day_closed`, `not_arrived`, `series_closed`, `conflict`.
  - **5xx ou timeout = transitório** (reenviar da fila).
- Todas as escritas são idempotentes pela `idempotencyKey`.

## POST /api/playground/today
Corpo: `{ "posUnitId": "<id da unidade no PDV>" }`

Resposta 200:
```json
{
  "ok": true,
  "serverNow": "2026-11-17T18:00:00.000Z",
  "protocolConfigured": true,
  "scale": { "min": 0, "max": 2, "labels": { "0": "Não", "1": "Parcial", "2": "Sim" } },
  "visits": [
    {
      "visitId": "uuid",
      "seriesId": "uuid",
      "visitNo": 2,
      "totalVisits": 5,
      "scheduledStart": "2026-11-17T17:30:00.000Z",
      "durationMin": 60,
      "displayName": "Ana S.",
      "ageLabel": "6 anos",
      "level": 2,
      "status": "avaliar_agora",
      "arrivedAt": "...|null",
      "leftAt": "...|null",
      "entryCount": 7,
      "authorCount": 2,
      "conclusionPending": false
    }
  ],
  "catalogs": {
    "1": [ { "domain": "MAN", "label": "Mando", "items": [ { "id": "uuid", "code": "N1-MAN-01", "description": "..." } ] } ],
    "2": [ ... ],
    "3": [ ... ]
  },
  "pendingConclusions": [
    { "seriesId": "uuid", "displayName": "Ana S.", "ageLabel": "6 anos", "lastVisitStart": "<ISO>" }
  ],
  "state": {
    "<seriesId>": {
      "items": [ { "itemId": "uuid", "score": 1, "authorName": "Fulano", "authorSpecialty": "Psicologia", "visitNo": 1, "savedAt": "..." } ],
      "evolutions": [ { "visitId": "uuid", "text": "...", "authorName": "Fulano", "savedAt": "..." } ]
    }
  }
}
```
- `status` ∈ `futura | aguardando_chegada | no_playground | confirmar_saida | avaliar_agora | atrasada | registrada_no_prazo | registrada_com_atraso | nao_feita | faltou | cancelada`.
- Só vêm visitas de **hoje** (fuso `America/Sao_Paulo`), de séries `liberada`, do local cujo `pos_unit_id = posUnitId`.
- `protocolConfigured = false` quando o VB-MAPP ainda não está cadastrado: `visits` vem vazio e o tablet mostra "Avaliação ainda não configurada".
- `catalogs` só contém os níveis usados pelas visitas de hoje.
- `pendingConclusions`: séries liberadas cuja última visita agendada já passou sem conclusão ("Conclusão pendente"). O PDV mostra no selo e numa faixa de alerta, sem ação de concluir (só o terapeuta conclui, numa visita do dia).
- Todas as ações de escrita (`visit`, `entries`, `conclude`) levam `posUnitId`; a clínica recusa (`not_found`) visita de outra unidade.
- O PDV **nunca** recebe nome completo, CID, laudo ou convênio.

## POST /api/playground/visit
Corpo: `{ "posUnitId": "<unidade>", "visitId": "uuid", "action": "arrive" | "leave", "employeeId": "<id colaborador PDV>", "employeeName": "texto", "at": "<ISO, momento do toque>", "idempotencyKey": "texto" }`
- `arrive` e `leave` são idempotentes: repetir mantém o primeiro carimbo.
- `leave` sem `arrive` é aceito (carimba chegada = saída).
- Resposta: `{ "ok": true, "status": "<status recalculado>", "arrivedAt": "...", "leftAt": "..." }`.

## POST /api/playground/entries
Corpo:
```json
{
  "posUnitId": "<unidade>",
  "visitId": "uuid",
  "deviceId": "texto",
  "author": { "employeeId": "texto", "name": "Fulano", "specialty": "Psicologia" },
  "entries": [
    { "idempotencyKey": "texto único", "kind": "item", "itemId": "uuid", "score": 1, "savedAt": "<ISO>" },
    { "idempotencyKey": "texto único", "kind": "item", "itemId": "uuid", "score": null, "savedAt": "<ISO>" },
    { "idempotencyKey": "texto único", "kind": "evolution", "text": "texto", "savedAt": "<ISO>" }
  ]
}
```
- `score: null` limpa o item (volta a "não observado").
- `savedAt` é o momento em que o terapeuta tocou (carimbado no PDV). Só vale se for do **mesmo dia da visita** (`day_closed` caso contrário).
- Lote de até 50 entradas.
- Resposta: `{ "ok": true, "accepted": 3, "duplicates": 0, "rejected": [ { "idempotencyKey": "...", "code": "...", "error": "..." } ] }`.
- Exige a criança já marcada como chegada (`not_arrived` caso contrário).

## POST /api/playground/conclude
Corpo: `{ "posUnitId": "<unidade>", "visitId": "uuid", "deviceId": "texto", "author": { ... }, "savedAt": "<ISO>", "idempotencyKey": "texto" }`
- Conclui a série da visita: gera o registro oficial, cancela as visitas futuras. Só no dia da visita.
- Resposta: `{ "ok": true, "seriesStatus": "concluida" }`. Repetir devolve o mesmo resultado.

## POST /api/playground/transcribe
Corpo: `{ "audioBase64": "...", "mimeType": "audio/webm" }` (máx. ~60 s, 1,5 MB em base64).
Resposta: `{ "ok": true, "text": "evolução em texto" }` ou erro `bad_request` / `unavailable` (503).
O áudio não é guardado.

## Autor
`author.specialty` é o rótulo do setor do colaborador no PDV (ex.: "Psicologia", "Educação Física", "Fisioterapia"). A clínica só guarda o texto.

## POST /api/playground/replay (fila cifrada do PDV)
Quando a clínica está fora do ar na hora de salvar, o PDV guarda o corpo da ação **cifrado** e reenvia depois. O PDV não consegue ler o conteúdo: só repassa o envelope.

Corpo: `{ "sealed": "<envelope>" }` (assinado com HMAC como as demais).

Envelope (híbrido, WebCrypto no PDV, sem dependência nova):
`"v1." + b64url(RSA-OAEP-SHA256(chave AES)) + "." + b64url(iv 12 bytes) + "." + b64url(AES-256-GCM ciphertext || tag 16 bytes)`
- Chave pública RSA-2048 (SPKI) no PDV: `PLAYGROUND_BRIDGE_PUBLIC_KEY`. Chave privada (PKCS8, PEM ou DER base64) só na clínica: `PLAYGROUND_BRIDGE_PRIVATE_KEY`.
- Texto claro: `{ "action": "visit" | "entries" | "conclude", "body": { ...corpo do contrato dessa ação, com posUnitId e os savedAt/at originais } }`.
- A clínica executa como a ação original e devolve o mesmo formato de resposta. Envelope inválido: `400 bad_request` (definitivo).
- Seguro para repetir: as ações são idempotentes (`idempotencyKey`, primeiro carimbo de chegada/saída, conclusão repetida devolve o mesmo resultado). A regra do dia usa o `savedAt` original: uma entrada salva às 18h que chega no dia seguinte ainda vale.
- Referência: `lib/playground/sealed.ts`.

## Segredos
- Clínica (Vercel): `PLAYGROUND_BRIDGE_SECRET`, `PLAYGROUND_BRIDGE_PRIVATE_KEY`, `GEMINI_API_KEY` (já existe).
- PDV (secrets das Edge Functions): `CLINIC_URL`, `CLINIC_BRIDGE_SECRET` (mesmo valor de `PLAYGROUND_BRIDGE_SECRET`), `PLAYGROUND_BRIDGE_PUBLIC_KEY`.
- Gerar o par de chaves: `openssl genrsa -out priv.pem 2048 && openssl rsa -in priv.pem -pubout -out pub.pem` e fazer backup da chave privada no cofre de senhas (se for perdida, itens que estão na fila não podem mais ser lidos).
