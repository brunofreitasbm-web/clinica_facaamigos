/**
 * Transição ondulada entre duas seções (referência de estilo: landing
 * "Pallikoodam" pedida pelo usuário — fundo curvo entre o hero e a seção
 * seguinte, em vez de uma linha reta).
 *
 * Técnica: o `<div>` externo pinta a cor da seção DE CIMA (`from`); o path
 * do SVG cobre, por dentro dele, tudo da curva até o fundo do viewBox com a
 * cor da seção DE BAIXO (`to`). Onde a curva sobe, `from` aparece por trás;
 * onde desce, `to` toma o espaço — as duas cores nunca dependem de acertar
 * o tom exato da seção vizinha, só das duas props.
 */
export function WaveDivider({
  from,
  to,
  height = 56,
  flip = false,
}: {
  from: string;
  to: string;
  height?: number;
  flip?: boolean;
}) {
  return (
    <div aria-hidden style={{ background: from, lineHeight: 0 }}>
      <svg
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        style={{
          width: "100%",
          height,
          display: "block",
          transform: flip ? "scaleX(-1)" : undefined,
        }}
      >
        <path
          d="M0,32 C220,86 460,4 738,30 C1016,56 1224,10 1440,44 L1440,100 L0,100 Z"
          fill={to}
        />
      </svg>
    </div>
  );
}
