"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Alt+H volta para a visão "Hoje" sem depender do mouse.
export function BackToTodayShortcut() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        router.push("/terapeuta");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
