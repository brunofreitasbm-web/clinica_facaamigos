/**
 * Marca FaçaAmigos. Os SVGs vivem em public/brand/ (vetorizados a partir da
 * arte original — ver brand/README.md, que também traz área de respiro,
 * tamanhos mínimos e as regras de uso).
 *
 * A marca é sempre o vetor, nunca uma reprodução em texto: o wordmark
 * ("FaçaAmigos") e a assinatura ("Centro de Terapia Comportamental") já
 * vivem dentro dos SVGs `horizontal` e `vertical`. Não redesenhe nenhum dos
 * dois com <span>/<h1> — use a variante certa. `subBrand` existe só para
 * linhas que NÃO fazem parte da marca (unidade, módulo do sistema).
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

export type LogoTone = "cor" | "branco";

export type LogoSubBrand =
  | "playground-parque"
  | "playground-bosque"
  | "circuito-parque"
  | "selecao-modulo";

const VARIANTS: Record<LogoVariant, { file: string; ratio: number; label: string }> = {
  horizontal: { file: "facaamigos-horizontal", ratio: 6363 / 1093, label: "FaçaAmigos — Centro de Terapia Comportamental" },
  "horizontal-compacto": { file: "facaamigos-horizontal-sem-assinatura", ratio: 5949 / 849, label: "FaçaAmigos" },
  vertical: { file: "facaamigos-vertical", ratio: 4388 / 2562, label: "FaçaAmigos — Centro de Terapia Comportamental" },
  "vertical-compacto": { file: "facaamigos-vertical-sem-assinatura", ratio: 4388 / 2280, label: "FaçaAmigos" },
  simbolo: { file: "facaamigos-simbolo", ratio: 2386 / 1407, label: "FaçaAmigos" },
  wordmark: { file: "facaamigos-wordmark", ratio: 4388 / 773, label: "FaçaAmigos" },
};

const SUB_BRANDS: Record<LogoSubBrand, { text: string; color: string; letterSpacing: string; isTitleCase?: boolean; fontSizeRatio: number }> = {
  "playground-parque": { text: "PLAYGROUND · PARQUE SHOPPING", color: "#ED2162", letterSpacing: "0.18em", fontSizeRatio: 0.20 },
  "playground-bosque": { text: "PLAYGROUND · BOSQUE GRÃO-PARÁ", color: "#C58B24", letterSpacing: "0.12em", fontSizeRatio: 0.18 },
  "circuito-parque": { text: "CIRCUITO · PARQUE SHOPPING", color: "#23B5A6", letterSpacing: "0.22em", fontSizeRatio: 0.20 },
  "selecao-modulo": { text: "Sistema Operacional — Seleção de Módulo", color: "#065264", letterSpacing: "normal", isTitleCase: true, fontSizeRatio: 0.25 },
};

const MIN_HEIGHT: Partial<Record<LogoVariant, number>> = {
  horizontal: 28,
  vertical: 94,
};

export function Logo({
  variant = "horizontal",
  tone = "cor",
  subBrand,
  height,
  className,
  decorative = false,
}: {
  variant?: LogoVariant;
  tone?: LogoTone;
  subBrand?: LogoSubBrand;
  height: number;
  className?: string;
  decorative?: boolean;
}) {
  // Se tiver um subBrand, forçamos a versão sem a assinatura padrão embutida no SVG
  let activeVariant = variant;
  if (subBrand) {
    if (variant === "horizontal") activeVariant = "horizontal-compacto";
    if (variant === "vertical") activeVariant = "vertical-compacto";
  }

  const { file, ratio, label } = VARIANTS[activeVariant];
  const src = `/brand/${file}${tone === "branco" ? "-mono-branco" : ""}.svg`;
  const width = Math.round(height * ratio);

  if (process.env.NODE_ENV !== "production") {
    const min = MIN_HEIGHT[activeVariant];
    if (min && height < min && !subBrand) {
      console.warn(
        `[Logo] variante "${activeVariant}" com height=${height}px fica abaixo do mínimo legível (${min}px). ` +
          `Use "${activeVariant === "horizontal" ? "horizontal-compacto" : "vertical-compacto"}".`,
      );
    }
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático: next/image não otimiza e só adicionaria um hop.
    <img
      src={src}
      width={width}
      height={height}
      alt={decorative && !subBrand ? "" : label}
      aria-hidden={(decorative && !subBrand) || undefined}
      className={subBrand ? undefined : className}
      draggable={false}
    />
  );

  if (!subBrand) {
    return img;
  }

  const sub = SUB_BRANDS[subBrand];
  const fontSize = Math.max(Math.round(height * sub.fontSizeRatio), 10);
  
  // O offset da esquerda alinha o texto junto à letra "F" do Wordmark. No logo horizontal-compacto, 
  // o símbolo "M" amarelo tem uma proporção da largura total.
  // Proporção aproximada do símbolo + margem em relação à largura total do horizontal-compacto: ~40%
  // Vamos usar flexbox colunas para alinhar, ou um div com padding left.
  const isHorizontal = activeVariant.includes("horizontal");

  return (
    <div className={`flex flex-col ${isHorizontal ? "items-end" : "items-center"} gap-1.5 ${className || ""}`}>
      {img}
      <span
        style={{
          color: tone === "branco" ? "#FFFFFF" : sub.color,
          fontSize: `${fontSize}px`,
          letterSpacing: sub.letterSpacing,
          fontWeight: 600,
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
          textTransform: sub.isTitleCase ? "none" : "uppercase",
          // Se for horizontal, tenta alinhar embaixo do "FaçaAmigos" visualmente.
          // O símbolo representa cerca de 38% da largura no SVG "horizontal-compacto".
          paddingLeft: isHorizontal ? `${width * 0.38}px` : "0",
          textAlign: isHorizontal ? "left" : "center",
          width: isHorizontal ? `${width}px` : "auto",
          whiteSpace: "nowrap"
        }}
      >
        {sub.text}
      </span>
    </div>
  );
}
