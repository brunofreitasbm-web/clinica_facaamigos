import Link from "next/link";
import { DoorOpen } from "lucide-react";

/**
 * Faixa no topo da agenda do dia avisando de chegadas pelo QR ainda não
 * confirmadas — não dá para assumir que a recepção está com
 * /recepcao/chegadas aberta (ver F2 do plano de check-in por QR), então o
 * aviso também precisa aparecer aqui, na tela que já fica aberta o dia todo.
 */
export function ChegadasBanner({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Link
      href="/recepcao/chegadas"
      className="mb-8 flex items-center gap-3 rounded-md border px-4 py-3 text-sm no-underline"
      style={{ borderColor: "var(--color-accent)", background: "var(--color-accent-100)" }}
    >
      <DoorOpen size={16} style={{ color: "var(--color-accent)" }} />
      <span className="text-ink">
        <strong>{count}</strong> {count === 1 ? "pessoa chegou" : "pessoas chegaram"} pelo check-in da entrada e aguarda
        confirmação
      </span>
    </Link>
  );
}
