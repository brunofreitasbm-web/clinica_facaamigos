// lib/resource-categories.ts
/**
 * Categorias fixas de `resources.category` (CHECK constraint, PRD §10) —
 * compartilhada entre o formulário de cadastro e a listagem. Salas ficam de
 * fora (já têm seu próprio cadastro/reserva via `rooms`/`appointments`).
 */
export const RESOURCE_CATEGORIES = [
  { value: "brinquedo_sensorial", label: "Brinquedo sensorial" },
  { value: "teste_padronizado", label: "Teste padronizado" },
  { value: "prancha_comunicacao", label: "Prancha de comunicação" },
  { value: "outro", label: "Outro" },
] as const;

export const RESOURCE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  RESOURCE_CATEGORIES.map((c) => [c.value, c.label]),
);
