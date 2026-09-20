---
name: playwright-e2e
description: "Use when authoring, updating, or running Playwright end-to-end tests for the Clinica Faca Amigos web application."
---

# Playwright E2E Testing

## Diretrizes Principais

1. **Localização dos Testes:**
   - Todos os testes E2E ficam localizados em `tests/*.spec.ts` ou `tests/*.test.ts`.

2. **Fluxos Críticos da Clínica a Testar:**
   - Login por papel e redirecionamento para a Home do Perfil.
   - Check-in de paciente na recepção e emissão de comprovante.
   - Agendamento de sessão com verificação de bloqueio por falta de guia ativa.
   - Evolução de sessão pelo terapeuta em menos de 2 minutos (campos estruturados ABA + PIN de assinatura).

3. **Execução:**
   - Para rodar os testes: `npx playwright test` ou `npm run test`.
   - Utilize seletores acessíveis baseados em rótulos, `data-testid` ou papéis ARIA (`getByRole`, `getByText`, `getByTestId`).
