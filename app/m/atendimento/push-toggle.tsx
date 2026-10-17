"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { removePushSubscription, savePushSubscription } from "./push-actions";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Botão "Ativar avisos de mensagem nova" — iOS exige gesto do usuário e PWA instalado. */
export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/m/" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setSupported(true);
        setActive(Boolean(sub) && Notification.permission === "granted");
      })
      .catch(() => {});
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (active && existing) {
        await removePushSubscription(existing.endpoint);
        await existing.unsubscribe();
        setActive(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Permissão negada. Libere as notificações nas configurações do aparelho.");
        return;
      }
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        }));
      const json = sub.toJSON();
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (res.error) setMessage(res.error);
      else setActive(true);
    } catch {
      setMessage("No iPhone, instale o app na Tela de Início antes de ativar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-3 py-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-[#065264] disabled:opacity-50"
      >
        {active ? <BellOff size={14} /> : <Bell size={14} />}
        {active ? "Desativar avisos neste aparelho" : "Ativar avisos de mensagem nova"}
      </button>
      {message && <p className="mt-1 text-[11px] text-red-600">{message}</p>}
    </div>
  );
}
