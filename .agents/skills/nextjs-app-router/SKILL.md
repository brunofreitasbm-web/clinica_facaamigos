---
name: nextjs-app-router
description: "Use when creating, editing, or refactoring Next.js App Router routes, Server Components, Client Components, Server Actions, middleware, dynamic routes, and @supabase/ssr integration in Next.js 16+."
---

# Next.js App Router & Server Actions

## Diretrizes Principais

1. **Next.js 16+ & React 19:**
   - Utilize a convenção `app/` (App Router).
   - Componentes em `app/` são **Server Components** por padrão. Utilize `'use client'` explicitamente apenas quando houver interatividade no navegador (ex.: `useState`, `useEffect`, `onClick`).
   - Server Actions devem ser declaradas com `'use server'` no topo do arquivo ou da função.

2. **Integração com Supabase (@supabase/ssr):**
   - Sempre utilize `@supabase/ssr` para criar o cliente Supabase em Server Components e Server Actions.
   - Em Server Actions, garanta a revalidação de rotas afetadas via `revalidatePath` ou `revalidateTag`.

3. **Papéis e Permissões:**
   - No projeto Clínica Faça Amigos, lembre-se da regra "Papel define a tela". As rotas são separadas por perfil (`app/recepcao`, `app/terapeuta`, `app/supervisao`, `app/faturamento`, `app/gestor`, `app/familia`).

4. **Verificação de Tipos:**
   - Execute `npm run typecheck` para garantir que novas propriedades e Server Actions cumpram os contratos TypeScript.
