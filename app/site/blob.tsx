/**
 * Mancha orgânica decorativa (referência de estilo: landing "Pallikoodam"
 * pedida pelo usuário — forma solta atrás da foto do hero, em vez de um
 * quadrado ou círculo perfeito). Puramente decorativo: `aria-hidden` e sem
 * papel de layout, só posicionada pelo `className` de quem chama.
 */
export function Blob({ color, className }: { color: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 200" className={className}>
      {/* `scale(1.35)` de propósito: o path original deixa ~15% de margem
          uniforme dentro do viewBox — sem esticar, essa margem come o
          "vazamento" da mancha para fora do cartão (o efeito todo depende
          da forma chegar quase na borda do próprio SVG). */}
      <g transform="translate(100,100) scale(1.35)">
        <path
          d="M43.7,-58.5C56.7,-50.6,66.7,-35.9,69.6,-19.5C72.6,-3.1,68.5,15.1,58.7,29.7C48.9,44.3,33.4,55.4,16.2,60.6C-1,65.8,-19.9,65.2,-36.1,57.7C-52.3,50.3,-65.8,36.1,-70.6,19.1C-75.5,2,-71.8,-17.9,-61.6,-32.8C-51.4,-47.7,-34.7,-57.6,-17.4,-63.5C-0.1,-69.5,17.8,-71.6,33.4,-66C49,-60.4,62.3,-47.2,43.7,-58.5Z"
          fill={color}
        />
      </g>
    </svg>
  );
}
