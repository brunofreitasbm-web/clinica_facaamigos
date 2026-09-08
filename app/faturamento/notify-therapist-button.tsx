"use client";

import { useState } from "react";
import { BellRing, Loader2, Check } from "lucide-react";
import { notifyTherapistAction } from "./actions";
import { useToast } from "@/components/toast-provider";

export function NotifyTherapistButton({
  therapistPhone,
  therapistName,
  patientName,
  startsAt,
}: {
  therapistPhone: string | null;
  therapistName: string;
  patientName: string;
  startsAt: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const { toast } = useToast();

  const handleClick = async () => {
    setStatus("loading");
    const result = await notifyTherapistAction({ therapistPhone, therapistName, patientName, startsAt });
    if (result.success) {
      setStatus("success");
      toast(`${therapistName} foi notificado.`, "success");
    } else {
      setStatus("idle");
      toast(result.error, "error");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status !== "idle"}
      className="btn btn-ghost text-xs"
      style={status === "success" ? { color: "var(--color-status-realizada-text)" } : undefined}
    >
      {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {status === "success" && <Check className="h-3.5 w-3.5" />}
      {status === "idle" && <BellRing className="h-3.5 w-3.5" />}
      {status === "success" ? "Notificado" : "Notificar terapeuta"}
    </button>
  );
}
