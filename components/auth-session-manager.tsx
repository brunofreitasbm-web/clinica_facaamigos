"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { proximoCorte, sessaoVencidaPeloCorte } from "@/lib/session-cutoff";

export function AuthSessionManager() {
  useEffect(() => {
    const supabase = createClient();

    // 1. Ouvir mudanças no estado de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login?expired=true";
        }
      }
    });

    // 2. Verificar e renovar a sessão proativamente
    const checkAndRefreshSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session) {
          return;
        }

        // Logout diário das 19h (Brasília): derruba também a aba aberta. O signOut dispara SIGNED_OUT acima.
        if (sessaoVencidaPeloCorte(session.user?.last_sign_in_at)) {
          await supabase.auth.signOut();
          return;
        }

        const expiresAt = session.expires_at; // Timestamp em segundos
        if (expiresAt) {
          const nowInSec = Math.floor(Date.now() / 1000);
          // Se falta menos de 5 minutos (300s) para o token expirar, renova proativamente
          if (expiresAt - nowInSec < 300) {
            const { error: refreshErr } = await supabase.auth.refreshSession();
            if (refreshErr) {
              console.warn("[AuthSessionManager] Falha ao renovar sessão automaticamente:", refreshErr.message);
            }
          }
        }
      } catch (err) {
        console.error("[AuthSessionManager] Erro ao checar sessão:", err);
      }
    };

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === "visible") {
        checkAndRefreshSession();
      }
    };

    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    // Verificação periódica a cada 3 minutos (180.000 ms)
    const intervalId = setInterval(checkAndRefreshSession, 3 * 60 * 1000);

    // Dispara a checagem no instante do próximo corte (+1s de folga) e reagenda para o dia seguinte.
    let corteTimer: ReturnType<typeof setTimeout>;
    const agendarCorte = () => {
      const espera = proximoCorte().getTime() - Date.now() + 1000;
      corteTimer = setTimeout(async () => {
        await checkAndRefreshSession();
        agendarCorte();
      }, espera);
    };
    agendarCorte();

    // Executa verificação inicial ao montar
    checkAndRefreshSession();

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
      clearInterval(intervalId);
      clearTimeout(corteTimer);
    };
  }, []);

  return null;
}
