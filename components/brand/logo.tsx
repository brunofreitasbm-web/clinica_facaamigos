/**
 * Marca FaçaAmigos. Os SVGs vivem em public/brand/ (vetorizados a partir da
 * arte original — ver brand/README.md, que também traz área de respiro,
 * tamanhos mínimos e as regras de uso).
 *
 * Sempre passe `height`: a largura sai da proporção intrínseca de cada
 * variante, então o elemento já reserva o espaço certo e não há salto de
 * layout enquanto o SVG carrega.
 */

export type LogoVariant =
  | "horizontal"
  | "horizontal-compacto"
  | "vertical"
  | "vertical-compacto"
  | "simbolo"
  | "wordmark";

/** `cor` = versão policromática; `branco` = para fundo escuro/colorido. */
export type LogoTone = "cor" | "branco";

const VARIANTS: Record<LogoVariant, { file: string; ratio: number; label: string }> = {
  horizontal: { file: "facaamigos-horizontal", ratio: 6363 / 1093, label: "FaçaAmigos — Centro de Terapia Comportamental" },
  "horizontal-compacto": { file: "facaamigos-horizontal-sem-assinatura", ratio: 5949 / 849, label: "FaçaAmigos" },
  vertical: { file: "facaamigos-vertical", ratio: 4388 / 2562, label: "FaçaAmigos — Centro de Terapia Comportamental" },
  "vertical-compacto": { file: "facaamigos-vertical-sem-assinatura", ratio: 4388 / 2280, label: "FaçaAmigos" },
  simbolo: { file: "facaamigos-simbolo", ratio: 2386 / 1407, label: "FaçaAmigos" },
  wordmark: { file: "facaamigos-wordmark", ratio: 4388 / 773, label: "FaçaAmigos" },
};

/**
 * Abaixo destes tamanhos a assinatura "Centro de Terapia Comportamental"
 * fecha e vira borrão — ver brand/README.md. Usado só para avisar em dev.
 */
const MIN_HEIGHT: Partial<Record<LogoVariant, number>> = {
  horizontal: 28,
  vertical: 94,
};

export function Logo({
  variant = "horizontal",
  tone = "cor",
  height,
  className,
  /** `true` quando a logo é puramente decorativa (já há texto com o nome ao lado). */
  decorative = false,
}: {
  variant?: LogoVariant;
  tone?: LogoTone;
  height: number;
  className?: string;
  decorative?: boolean;
}) {
  const { file, ratio, label } = VARIANTS[variant];
  const src = `/brand/${file}${tone === "branco" ? "-mono-branco" : ""}.svg`;
  const width = Math.round(height * ratio);

  if (process.env.NODE_ENV !== "production") {
    const min = MIN_HEIGHT[variant];
    if (min && height < min) {
      console.warn(
        `[Logo] variante "${variant}" com height=${height}px fica abaixo do mínimo legível (${min}px). ` +
          `Use "${variant === "horizontal" ? "horizontal-compacto" : "vertical-compacto"}".`,
      );
    }
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático: next/image não otimiza e só adicionaria um hop.
    <img
      src={src}
      width={width}
      height={height}
      alt={decorative ? "" : label}
      aria-hidden={decorative || undefined}
      className={className}
      draggable={false}
    />
  );
}
