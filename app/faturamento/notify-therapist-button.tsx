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
      className="btn btn-ghost min-h-[44px] px-3 py-2 text-xs font-semibold inline-flex items-center gap-2 transition-all duration-150 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent cursor-pointer"
      style={status === "success" ? { color: "var(--color-status-realizada-text)" } : undefined}
    >
      {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
      {status === "success" && <Check className="h-4 w-4" />}
      {status === "idle" && <BellRing className="h-4 w-4" />}
      <span>{status === "success" ? "Notificado" : "Notificar terapeuta"}</span>
    </button>
  );
}
