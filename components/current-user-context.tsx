"use client";

import { createContext, useContext } from "react";
import type { CurrentUserMenu } from "@/lib/current-user-menu";

const CurrentUserContext = createContext<CurrentUserMenu | null>(null);

/** Entrega o operador logado (carregado no root layout) às barras dos módulos. */
export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUserMenu | null;
  children: React.ReactNode;
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
