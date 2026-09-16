import type { ReactNode } from "react";
import {
  resolverIlustracionCatalogo,
  type ClasificacionIlustracion,
  type IlustracionCatalogo,
} from "@/lib/producto-catalogo-ilustracion";

// Tinta, papel y volumen comunes a toda la biblioteca. Cada símbolo representa
// una familia comercial; la clasificación y la forma de cobro viven en el resolver.
const tinta = "var(--brand-graphite)";
const naranja = "var(--accent)";
const canto = "var(--accent-soft-foreground)";
const papel = "var(--surface)";
const linea = "var(--border-strong)";
const gris = "var(--muted-text)";

const dibujos: Record<IlustracionCatalogo, ReactNode> = {
  compuesto: <>
    <path d="m12 40 20-10 20 10-20 11Z" fill={tinta} />
    <path d="M12 40v6l20 11 20-11v-6L32 51Z" fill={gris} />
    <path d="m12 27 20-10 20 10-20 11Z" fill={naranja} />
    <path d="M12 27v5l20 11 20-11v-5L32 38Z" fill={canto} />
    <path d="m18 16 14-7 14 7-14 8Z" fill={papel} stroke={linea} />
    <path d="M32 7V3M7 32H3m58 0h-4" stroke={gris} />
  </>,
  rollo: <>
    <path d="M15 17h27c8 0 12 5 12 12v21H27V29c0-7-4-12-12-12Z" fill={naranja} />
    <ellipse cx="15" cy="29" rx="9" ry="12" fill={papel} stroke={tinta} />
    <ellipse cx="15" cy="29" rx="3" ry="5" fill={tinta} />
    <path d="m34 34 6-7 6 7m-6-7v16" stroke={tinta} />
    <path d="M29 55h25m-25-3v6m25-6v6" stroke={gris} />
  </>,
  superficie: <>
    <path d="m9 29 31-15 16 27-31 15Z" fill={tinta} />
    <path d="m8 22 31-15 16 27-31 15Z" fill={papel} stroke={linea} />
    <path d="m15 24 21-10 10 17-21 10Z" fill={naranja} />
    <path d="m23 32 5-12 12 4m-12-4 7 13" stroke={tinta} />
    <path d="M5 12V5h7m41 47h7v-7" stroke={gris} />
  </>,
  piezas: <>
    <rect x="10" y="18" width="33" height="37" rx="2" transform="rotate(-9 10 18)" fill={tinta} />
    <rect x="20" y="8" width="32" height="42" rx="2" fill={papel} stroke={linea} />
    <path d="M26 14h20v18H26Z" fill={naranja} />
    <circle cx="36" cy="23" r="5" stroke={tinta} />
    <path d="M26 38h20m-20 5h12" stroke={gris} />
  </>,
  tarjetas: <>
    <rect x="8" y="25" width="44" height="27" rx="2" transform="rotate(-10 8 25)" fill={tinta} />
    <rect x="10" y="13" width="45" height="29" rx="2" fill={papel} stroke={linea} />
    <path d="M10 15a2 2 0 0 1 2-2h15v29H12a2 2 0 0 1-2-2Z" fill={naranja} />
    <path d="m14 29 5-9 5 9m-8-3h6M33 23h15m-15 5h10m-10 6h13" stroke={tinta} />
  </>,
  folleto: <>
    <path d="m6 17 18-6 17 6 17-6v38l-17 6-17-6-18 6Z" fill={tinta} />
    <path d="m6 13 18-6 17 6 17-6v38l-17 6-17-6-18 6Z" fill={papel} stroke={linea} />
    <path d="m24 7 17 6v38l-17-6Z" fill={naranja} />
    <path d="m11 23 8-3m-8 8 8-3m9-6 9 3m-9 4 9 3m9-6 7-2m-7 7 7-2" stroke={tinta} />
    <circle cx="32" cy="37" r="4" stroke={tinta} />
  </>,
  papeleria: <>
    <path d="M11 13h35v43H11Z" fill={tinta} />
    <path d="M17 7h35v43H17Z" fill={papel} stroke={linea} />
    <path d="M23 13h9v9h-9Z" fill={naranja} />
    <path d="M36 15h10m-10 5h7M23 28h23m-23 5h23m-23 5h17" stroke={gris} />
    <path d="m32 42 24-2 2 17-24 2Z" fill={naranja} />
    <path d="m33 43 13 6 10-8" stroke={tinta} />
  </>,
  stickers: <>
    <path d="M12 12h38v43H12Z" fill={tinta} />
    <path d="M16 6h37v35L41 51H16Z" fill={papel} stroke={linea} />
    <circle cx="26" cy="18" r="6" fill={naranja} />
    <rect x="37" y="12" width="10" height="12" rx="3" fill={tinta} />
    <rect x="20" y="29" width="12" height="12" rx="3" fill={naranja} />
    <circle cx="42" cy="34" r="5" fill={naranja} />
    <path d="M41 51V41h12" fill={naranja} stroke={canto} />
  </>,
  invitacion: <>
    <path d="M7 29 31 10l26 19v26H7Z" fill={tinta} />
    <path d="M15 8h34v37H15Z" fill={papel} stroke={linea} />
    <circle cx="32" cy="19" r="5" stroke={canto} />
    <path d="M23 29h18m-15 5h12" stroke={gris} />
    <path d="m7 29 25 16 25-16v26H7Z" fill={naranja} />
    <path d="m7 55 18-14m32 14L39 41" stroke={canto} />
  </>,
  talonario: <>
    <path d="M12 15h37v42H12Z" fill={tinta} />
    <path d="M15 8h37v44H15Z" fill={papel} stroke={linea} />
    <path d="M15 8h37v10H15Z" fill={naranja} />
    <path d="M20 26h25m-25 6h25m-25 6h15" stroke={gris} />
    <path d="M15 21h37" stroke={canto} strokeDasharray="2 3" />
    <path d="M15 48h37m-37 4h32" stroke={linea} />
  </>,
  revista: <>
    <path d="m5 18 12-5 16 5 19-7 7 5v34l-22 8-18-6-14 4Z" fill={tinta} />
    <path d="m7 11 11-4 15 7 21-7v38l-21 8-16-7-10 4Z" fill={papel} stroke={linea} />
    <path d="m33 14 21-7v38l-21 8Z" fill={naranja} />
    <path d="m13 21 13 5m-13 1 13 5m-13 1 13 5m12-16 10-4m-10 10 10-4" stroke={tinta} />
    <path d="M33 14v39" stroke={canto} />
  </>,
  anillado: <>
    <path d="M15 13h36v44H15Z" fill={tinta} />
    <rect x="16" y="7" width="35" height="45" rx="2" fill={naranja} />
    <path d="M22 7h29v45H22Z" fill={papel} />
    <path d="M29 18h15v14H29Z" fill={naranja} />
    <path d="M29 38h15m-15 5h10" stroke={gris} />
    {[14, 23, 32, 41].map(y => <path key={y} d={`M20 ${y}h-6c-4 0-4 5 0 5h3`} stroke={tinta} strokeWidth="2" />)}
  </>,
  vinilo_corte: <>
    <path d="M12 11h40v40L40 57H12Z" fill={tinta} />
    <path d="M10 7h40v32L36 51H10Z" fill={papel} stroke={linea} />
    <path d="m19 36 9-21h6l9 21h-7l-1-4h-8l-2 4Zm10-10h4l-2-6Z" fill={naranja} fillRule="evenodd" />
    <path d="m36 51 1-13 13 1Z" fill={naranja} stroke={canto} />
    <path d="M5 16V4h10m38 48h7V41" stroke={linea} strokeDasharray="2 3" />
  </>,
  lona: <>
    <path d="M7 17h49v34H7Z" fill={tinta} />
    <path d="m7 10 49 6v30L7 40Z" fill={naranja} />
    <path d="m12 17 39 5v17l-39-4Z" fill={papel} />
    <path d="m27 30 5-7 5 8m-5-8v12" stroke={tinta} />
    <circle cx="10" cy="14" r="1.5" fill={tinta} /><circle cx="53" cy="20" r="1.5" fill={tinta} />
    <circle cx="10" cy="37" r="1.5" fill={tinta} /><circle cx="53" cy="43" r="1.5" fill={tinta} />
  </>,
  mesh: <>
    <path d="M12 13h42v42H12Z" fill={tinta} />
    <path d="M9 9h42v40H9Z" fill={naranja} />
    {[18, 27, 36].flatMap(y => [18, 29, 40].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill={papel} />))}
    <path d="M6 57h49m-49-3v6m49-6v6" stroke={gris} />
  </>,
  rollup: <>
    <path d="M20 8h29v46H20Z" fill={tinta} />
    <path d="M17 6h29v44H17Z" fill={papel} stroke={linea} />
    <path d="M17 6h29v25H17Z" fill={naranja} />
    <path d="m26 22 6-8 6 8m-6-8v13M23 37h17m-17 5h10" stroke={tinta} />
    <path d="M12 50h39v6H12Z" fill={tinta} />
    <path d="m21 56-4 4m26-4 4 4" stroke={tinta} strokeWidth="2" />
  </>,
  senal: <>
    <path d="M29 7h6v52h-6Z" fill={tinta} />
    <path d="M8 13h39l10 10-10 10H8Z" fill={naranja} />
    <path d="M16 23h29m-7-6 7 6-7 6" stroke={tinta} strokeWidth="2" />
    <path d="M12 39h34v12H12Z" fill={papel} stroke={linea} />
    <path d="M18 45h20" stroke={gris} />
  </>,
  letra: <>
    <path d="m17 53 14-39h11l16 39H44l-2-8H31l-2 8Zm17-17h6l-3-11Z" fill={tinta} fillRule="evenodd" />
    <path d="m10 47 14-39h11l16 39H37l-2-8H24l-2 8Zm17-17h6l-3-11Z" fill={naranja} fillRule="evenodd" />
    <path d="m35 8 7 6m9 33 7 6M37 47l7 6" stroke={canto} />
    <path d="M7 57h50" stroke={linea} />
  </>,
  cuadro: <>
    <path d="m8 18 43-8 6 41-43 8Z" fill={tinta} />
    <path d="M8 7h43v44H8Z" fill={naranja} />
    <path d="M13 12h33v34H13Z" fill={papel} />
    <path d="m16 41 11-17 8 10 5-7 3 14Z" fill={tinta} />
    <circle cx="37" cy="21" r="5" fill={naranja} />
  </>,
  troquel: <>
    <path d="M14 13h36v43H14Z" fill={tinta} />
    <path d="M10 8h38v44H10Z" fill={papel} stroke={linea} />
    <path d="m28 15 5 6 8 1-2 8 2 8-8 1-5 6-5-6-8-1 2-8-2-8 8-1Z" fill={naranja} />
    <circle cx="28" cy="30" r="7" stroke={canto} strokeDasharray="2 3" />
    <path d="M6 4h47v54H6Z" stroke={linea} strokeDasharray="2 4" />
  </>,
  caja: <>
    <path d="m12 27 20-10 20 10v23L32 60 12 50Z" fill={tinta} />
    <path d="m12 27 20 11 20-11-20-10Z" fill={canto} />
    <path d="M12 27v23l20 10V38Z" fill={naranja} />
    <path d="m12 27-8-9L24 8l8 9m0 0L42 8l18 10-8 9-20-10" fill={naranja} />
    <path d="m21 14 11 6 11-6" stroke={canto} />
    <path d="m18 43 8 4v5l-8-4Z" fill={papel} />
  </>,
  exhibidor: <>
    <path d="m18 9 28 5v42l-28-5Z" fill={tinta} />
    <path d="M14 7h29v13H14Z" fill={naranja} />
    <path d="M14 20h29v32H14Z" fill={papel} stroke={linea} />
    <path d="m14 30 29 1 10 7H24Zm0 14 29 1 10 7H24Z" fill={naranja} />
    <path d="m24 38 29 0v5H24Zm0 14h29v5H24Z" fill={canto} />
    <path d="M20 13h16M18 24v3m9-3v3m9-3v3" stroke={tinta} />
  </>,
  etiqueta: <>
    <path d="m13 32 20-22 20 3 3 20-20 24Z" fill={tinta} />
    <path d="m7 28 20-22 20 3 3 20-20 24Z" fill={naranja} />
    <circle cx="38" cy="18" r="4" fill={papel} stroke={canto} />
    <path d="m40 15 8-8c5-5 13 1 8 6l-6 7" stroke={gris} />
    <path d="m17 32 10 9m-6-15 9 8" stroke={tinta} strokeWidth="2" />
  </>,
  remera: <>
    <path d="m12 17 14-5h17l14 5 6 15-12 6v21H19V38L7 32Z" fill={tinta} />
    <path d="m8 11 14-5h17l14 5 6 15-12 6v21H15V32L3 26Z" fill={naranja} />
    <path d="M22 6c0 12 17 12 17 0" fill={papel} stroke={canto} />
    <path d="m25 36 6-12 6 12m-10-4h8M15 21v11m32-11v11" stroke={tinta} />
    <path d="M21 47h20" stroke={canto} />
  </>,
  transfer: <>
    <path d="M12 18h30c8 0 13 5 13 12v24H24V30c0-7-5-12-12-12Z" fill={papel} stroke={linea} />
    <ellipse cx="12" cy="30" rx="8" ry="12" fill={naranja} stroke={canto} />
    <ellipse cx="12" cy="30" rx="3" ry="5" fill={tinta} />
    <path d="m30 29 6-3h6l6 3 3 7-6 2v10H33V38l-6-2Z" fill={naranja} />
    <path d="M37 26c0 5 5 5 5 0" stroke={tinta} />
  </>,
  objeto: <>
    <path d="M44 23h7c11 0 11 21 0 21h-7v-7h5c5 0 5-7 0-7h-5Z" fill={tinta} />
    <path d="M12 17h33v31c0 13-33 13-33 0Z" fill={tinta} />
    <path d="M9 13h33v31c0 13-33 13-33 0Z" fill={naranja} />
    <ellipse cx="25.5" cy="13" rx="16.5" ry="6" fill={papel} stroke={canto} />
    <path d="m20 37 6-12 6 12m-10-4h8" stroke={tinta} />
  </>,
  regalo: <>
    <path d="M13 27h42v31H13Z" fill={tinta} />
    <path d="M9 24h42v29H9Z" fill={naranja} />
    <path d="M6 19h48v10H6Z" fill={papel} stroke={linea} />
    <path d="M26 19h8v34h-8Z" fill={tinta} />
    <path d="M30 19c-23 0-15-21-5-9Zm0 0c23 0 15-21 5-9Z" fill={naranja} stroke={canto} />
  </>,
  laser: <>
    <path d="m7 42 30-9 21 11-30 13Z" fill={tinta} />
    <path d="m7 37 30-9 21 11-30 13Z" fill={papel} stroke={linea} />
    <path d="M26 5h13v13l-6 8-7-8Z" fill={tinta} />
    <path d="M26 5h13v8H26Z" fill={naranja} />
    <path d="M33 25v13m-6 0h12m-10-4 8 8m0-8-8 8" stroke={canto} />
    <path d="m18 42 11-4 10 4-11 5Z" stroke={canto} strokeDasharray="2 2" />
  </>,
  acabado: <>
    <path d="m9 25 29-13 18 30-29 14Z" fill={tinta} />
    <path d="m8 18 29-13 18 30-29 14Z" fill={naranja} />
    <path d="m26 18 3 6 7-1-4 6 4 6-7-1-3 6-2-7-7-1 6-4Z" fill={papel} />
    <path d="M49 6v10m-5-5h10M9 46v8m-4-4h8" stroke={canto} />
  </>,
  laminado: <>
    <path d="m8 35 28-11 21 24-28 12Z" fill={tinta} />
    <path d="m8 29 28-11 21 24-28 12Z" fill={naranja} />
    <path d="M12 11h28c7 0 11 5 11 12v13L25 48V24c0-7-5-13-13-13Z" fill={papel} fillOpacity="0.8" stroke={linea} />
    <ellipse cx="12" cy="24" rx="8" ry="13" fill={papel} stroke={tinta} />
    <ellipse cx="12" cy="24" rx="2.5" ry="5" fill={tinta} />
    <path d="M38 17v10m-5-5h10" stroke={canto} />
  </>,
  estructura: <>
    <path d="M9 11h42v41H9Zm6 6v29h30V17Z" fill={naranja} fillRule="evenodd" />
    <path d="M51 11l6 5v42H15l-6-6h42Z" fill={tinta} />
    <path d="m15 17 30 29m0-29L15 46" stroke={gris} strokeWidth="2" />
    <path d="M18 52v8m25-8v8" stroke={tinta} strokeWidth="3" />
  </>,
  luminoso: <>
    <path d="M11 20h45v33H11Z" fill={tinta} />
    <rect x="7" y="16" width="45" height="32" rx="2" fill={naranja} />
    <rect x="12" y="21" width="35" height="22" rx="1" fill={papel} />
    <path d="m20 36 5-10 5 10m-8-3h6m7 3V26h5m-5 5h4" stroke={tinta} />
    <path d="M29 4v6M8 6l5 6m37-6-5 6M7 56h46" stroke={canto} />
  </>,
  instalacion: <>
    <path d="M7 10h35v27H7Z" fill={tinta} />
    <path d="M7 10h30v23H7Z" fill={naranja} />
    <path d="M12 15h20v13H12Z" fill={papel} />
    <path d="M18 33v22m10-22v22M18 43h10m-10 8h10" stroke={tinta} strokeWidth="3" />
    <path d="m41 34 5-5c-4-8 4-14 9-12l-5 7 5 4 5-7c4 7-1 14-8 13L41 49l-6-5Z" fill={naranja} stroke={canto} />
  </>,
  diseno: <>
    <path d="M9 12h43v41H9Z" fill={tinta} />
    <path d="M6 7h43v41H6Z" fill={papel} stroke={linea} />
    <path d="M14 37c3-25 24-25 28-3" stroke={canto} />
    <path d="M9 20h36" stroke={gris} />
    <rect x="9" y="17" width="6" height="6" fill={naranja} /><rect x="39" y="17" width="6" height="6" fill={naranja} />
    <path d="m36 51 5-14L53 9l7 4-12 28Z" fill={naranja} stroke={canto} />
    <path d="m36 51 8-4-5-3Z" fill={tinta} />
  </>,
  muestras: <>
    <path d="m13 40 31-24 12 14-30 24Z" fill={tinta} />
    <path d="m12 36 22-31 16 11-23 31Z" fill={naranja} stroke={canto} />
    <path d="M10 6h18v43H10Z" fill={papel} stroke={linea} />
    <path d="M13 10h12v9H13Z" fill={naranja} />
    <path d="M13 22h12v9H13Z" fill={canto} />
    <path d="M13 34h12v8H13Z" fill={tinta} /><circle cx="19" cy="46" r="2" fill={gris} />
  </>,
  medicion: <>
    <path d="M10 11h15v31h30v15H10Z" fill={tinta} />
    <path d="M6 7h15v31h30v15H6Z" fill={naranja} />
    <path d="M6 15h7m-7 8h5m-5 8h7m-7 8h5m18-1v7m8-7v5m8-5v7" stroke={tinta} />
    <path d="M30 28V11h22m-25 0h6m19-3v6" stroke={gris} />
  </>,
  envio: <>
    <path d="M7 20h29v30H7Z" fill={tinta} />
    <path d="M7 15h29v30H7Z" fill={naranja} />
    <path d="M36 25h13l10 13v12H36Z" fill={tinta} />
    <path d="M40 29h7l7 9H40Z" fill={papel} />
    <circle cx="17" cy="49" r="6" fill={tinta} /><circle cx="48" cy="49" r="6" fill={tinta} />
    <circle cx="17" cy="49" r="2.5" fill={papel} /><circle cx="48" cy="49" r="2.5" fill={papel} />
    <path d="M12 24h15m-15 6h10M3 36h10" stroke={papel} />
  </>,
  sello: <>
    <path d="M16 13h31v32h7v12H9V45h7Z" fill={tinta} />
    <rect x="13" y="7" width="31" height="31" rx="7" fill={naranja} />
    <rect x="18" y="13" width="21" height="13" rx="3" fill={papel} stroke={canto} />
    <path d="M13 31h31v13H13Z" fill={canto} />
    <path d="M8 42h42v10H8Z" fill={naranja} />
    <path d="M15 57h29M23 19h11" stroke={tinta} />
  </>,
  sello_manual: <>
    <path d="M12 46h43v12H12Z" fill={tinta} />
    <path d="M9 41h43v12H9Z" fill={naranja} />
    <path d="M19 37c7-3 8-7 8-12-11-12-3-21 5-21s16 9 5 21c0 5 1 9 8 12v5H19Z" fill={tinta} />
    <ellipse cx="32" cy="12" rx="10" ry="7" fill={naranja} />
    <path d="M15 47h31" stroke={canto} />
  </>,
};

export function ProductoCatalogoGlyph(props: ClasificacionIlustracion) {
  const ilustracion = resolverIlustracionCatalogo(props);
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-illustration={ilustracion}
    >
      {dibujos[ilustracion]}
    </svg>
  );
}
