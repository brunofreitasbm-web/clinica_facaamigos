# Segurança: pendências da auditoria de 2026-11-10

Lista do que **não** foi resolvido pela Onda 1 neste repositório. Nenhum valor de
segredo aparece aqui, só onde está e o que fazer. Apague cada item ao concluir.

## Ações do dono (não dependem de código)

- [ ] Revogar as sessões e trocar a senha do gestor cuja sessão ficou em `perf/.auth/gestor.json` (segue no histórico do git, commit `b5dd2ee`).
- [ ] Rotacionar a service_role do projeto BD_CLINICA_RH: ela é enviada ao Hub em `app/login/staff-recovery-actions.ts:237`.
- [ ] Supabase Auth do BD_CLINICA_RH: ativar "Leaked password protection" e confirmar signup público desligado.
- [ ] Decidir sobre os PDFs de `Modelos de PDF PLanos/` (colunas CLIENTE, GUIA e SENHA preenchidas): se os dados são reais, tirar do repo.

## Onda 2 (muda comportamento, aprovar item a item)

- [ ] **Atualizar o Next** (hoje 16.3.4): `npm audit` acusa um aviso crítico na faixa 16.0.0 a 16.4.0 (GHSA-vcvr-r3jv-pc5j e outros). Exige subir a versão do framework e retestar o app; depois, tirar o `continue-on-error` do passo de audit no CI.
- [ ] Senha determinística das contas da família (`app/login/otp-actions.ts:253`): quem sabe o telefone do responsável entra sem OTP. Migrar para sessão emitida no servidor após o OTP, OTP com `crypto.randomInt`, limite por telefone, e resetar as senhas existentes.
- [ ] Bucket `patient-documents` público (11 objetos, sem limite de tamanho nem de tipo): tornar privado e servir por URL assinada (`lib/file-access.ts`).
- [ ] `lib/roles.ts:82`: usuário sem perfil passa pelo guard de rota. Passar a negar.
- [ ] Parar de enviar service_role e senha em claro ao Hub (`staff-recovery-actions.ts:237`, `login/actions.ts:63`). Depende de mudança no `gestao-hub` (repo da landing).
- [ ] `confirmDocumentSignature`: amarrar o telefone validado por OTP ao responsável do documento.
- [ ] `profiles_read_same_clinic`: família lê CPF, e-mail e `signature_pin_hash` de toda a equipe. Restringir.
- [ ] `profiles_self_update` ainda deixa o usuário alterar `is_evaluator`, `cpf`, `signature_pin_locked_until`. `setSignaturePin` troca o PIN sem pedir o atual.
- [ ] Revogar EXECUTE de anon nas funções SECURITY DEFINER internas (o advisor lista 31) e nas criadas depois de 20261001012158.
- [ ] Limite de tentativas no OTP da família e no login por CPF; mensagens que não revelem se o CPF existe.
- [ ] CSP em `next.config.ts` (começar em Report-Only).
- [ ] Demais Server Actions que usam o client de sessão sem checar papel (~30 arquivos em `app/gestor/**`, `app/faturamento/**`): hoje só a RLS protege.
- [ ] Rodar `supabase/tests/*.sql` no CI.
