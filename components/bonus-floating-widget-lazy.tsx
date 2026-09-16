"use client";

import dynamic from "next/dynamic";

// `ssr: false` só é permitido em Client Component — por isso este wrapper
// existe separado de bonus-floating-widget.tsx: os layouts que montam o
// widget (app/recepcao/layout.tsx, app/supervisao/layout.tsx) são Server
// Components. Sem SSR real pra ganhar aqui mesmo (o widget nasce sem dado
// até a Server Action resolver) — só tira o componente do JS inicial da tela.
export const BonusFloatingWidget = dynamic(
  () => import("./bonus-floating-widget").then((m) => m.BonusFloatingWidget),
  { ssr: false },
);
