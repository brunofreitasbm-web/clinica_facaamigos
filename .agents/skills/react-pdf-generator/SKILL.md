---
name: react-pdf-generator
description: "Use when creating, editing, or styling PDF documents using @react-pdf/renderer for medical reports, family feedback, school reports, or check-in vouchers."
---

# React-PDF Document Generation

## Diretrizes Principais

1. **Biblioteca Base:**
   - Utilize `@react-pdf/renderer` para construir componentes PDF em React (`Document`, `Page`, `View`, `Text`, `StyleSheet`, `Image`, `Font`).

2. **Estilização e Layout:**
   - Estilos devem ser definidos utilizando `StyleSheet.create()`.
   - Evite CSS tradicional de web; use propriedades flexbox suportadas pelo `@react-pdf/renderer` (`flexDirection`, `justifyContent`, `alignItems`, `padding`, `margin`, `fontSize`).

3. **Padronização Visual da Clínica Faça Amigos:**
   - Mantenha cabeçalhos institucionais com a identidade visual da clínica (`lib/letterhead-pdf.tsx`).
   - Garanta a inclusión dos dados do paciente, responsável e assinatura do profissional nos relatórios formais.
