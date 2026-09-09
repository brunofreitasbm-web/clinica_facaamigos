import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/**
 * Assinatura de marca dos cabeçalhos de módulo (barra petróleo).
 *
 * Símbolo + wordmark são SEMPRE os vetores de public/brand/ — o nome
 * "FaçaAmigos" nunca é redigitado como texto, senão a fonte do sistema
 * concorre com o desenho oficial do wordmark (ver brand/README.md).
 * O único texto aqui é o sufixo do módulo ("· Gestão"), que não faz
 * parte da marca.
 */
const SIZES = {
  // `simbolo` respeita o mínimo de 24px do brand/README.md nos dois tamanhos.
  md: { simbolo: 30, wordmark: 15, sufixo: "text-[17px]" },
  sm: { simbolo: 24, wordmark: 12, sufixo: "text-[15px]" },
} as const;

export function BrandLockup({
  module,
  href,
  size = "md",
  suffixColor,
  className,
}: {
  module: string;
  href?: string;
  size?: keyof typeof SIZES;
  /** Só para fundos onde `--color-on-accent-soft` não tem contraste. */
  suffixColor?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const content = (
    <>
      <Logo variant="simbolo" tone="branco" height={s.simbolo} decorative />
      <Logo variant="wordmark" tone="branco" height={s.wordmark} />
      <span
        style={{
          fontFamily: "var(--font-heading)",
          color: suffixColor || "var(--color-on-accent-soft)",
        }}
        className={`${s.sufixo} font-normal italic`}
      >
        · {module}
      </span>
    </>
  );

  const classes = `flex items-center gap-2.5 no-underline ${className || ""}`;

  if (!href) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <Link
      href={href}
      className={`${classes} rounded transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
    >
      {content}
    </Link>
  );
}
