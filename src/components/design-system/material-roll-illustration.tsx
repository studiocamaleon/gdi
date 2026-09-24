/** Rollo desplegado con cota de ancho. Ilustración orientativa, no a escala. */
export function MaterialRollIllustration({ anchoMm }: { anchoMm: number | null }) {
  const ancho = anchoMm === null ? 31 : Math.max(20, Math.min(36, 18 + anchoMm / 90));
  const x = (47 - ancho) / 2;
  return (
    <svg width="47" height="29" viewBox="0 0 47 29" fill="none" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
        <path d={`M${x} 7h${ancho}v5l-4 9H${x - 4}l4-9Z`} fill="var(--surface)" />
        <path d={`M${x} 3h${ancho}v9H${x}Z`} fill="var(--surface-secondary)" />
        <ellipse cx={x} cy="7.5" rx="3" ry="4.5" fill="var(--surface)" />
        <ellipse cx={x} cy="7.5" rx="1" ry="1.7" />
        <path d={`M${x + ancho} 3c4 0 4 9 0 9M${x} 26h${ancho - 4}m-${ancho - 7}-2-3 2 3 2m${ancho - 10}-4 3 2-3 2`} />
      </g>
    </svg>
  );
}
