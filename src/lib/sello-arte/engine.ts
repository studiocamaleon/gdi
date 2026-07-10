/**
 * Motor de arte del sello — capa PURA (sin DOM, sin fetch).
 *
 * Un único `layoutSello` calcula posiciones y tamaños en mm (fit-to-box), y de
 * ese layout se derivan TANTO el preview SVG como el EPS vectorial — así "lo que
 * ve el cliente es lo que graba el láser". El texto se convierte a contornos
 * (opentype paths), no va como texto con referencia a fuente: el EPS no depende
 * de que el RIP del láser tenga la tipografía.
 *
 * Las fuentes (opentype.Font ya parseadas) se inyectan; la carga vive en
 * `fonts.ts` (browser) o en el test (node). Ver
 * docs/sellos-configurador-diseno-viabilidad.md.
 */

// Tipo mínimo de opentype.Font que usamos (evita acoplar el import de tipos).
export type OpenTypeGlyph = {
  advanceWidth?: number;
  getPath: (x: number, y: number, fontSize: number) => OpenTypePath;
};
export type OpenTypePath = {
  commands: PathCommand[];
  extend: (other: OpenTypePath) => void;
};
export type OpenTypeFont = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  charToGlyph: (ch: string) => OpenTypeGlyph;
};

type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "Q"; x1: number; y1: number; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Z" };

export type Alineacion = "left" | "center" | "right";

export type SelloModel = {
  /** Ancho de la matriz de polímero en mm. */
  widthMm: number;
  /** Alto de la matriz en mm. */
  heightMm: number;
  /** Líneas máximas del modelo (define cuántas filas se reparten). */
  lineasMax: number;
};

export type LineaArte = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Clave de la tipografía; el resolver la mapea a una OpenTypeFont. */
  fontKey: string;
};

export type ArteOpts = {
  align?: Alineacion;
};

/** Resuelve (fontKey, bold, italic) → fuente parseada. */
export type FontResolver = (fontKey: string, bold: boolean, italic: boolean) => OpenTypeFont;

type LineaLayout = {
  text: string;
  font: OpenTypeFont;
  /** Tamaño de fuente en mm (unidades de la matriz). */
  fontSizeMm: number;
  /** x del inicio del texto en mm (según alineación). */
  xMm: number;
  /** y del baseline en mm, medido desde arriba (y-down). */
  baselineYMm: number;
};

export type SelloLayout = {
  model: SelloModel;
  align: Alineacion;
  paddingMm: number;
  lineas: LineaLayout[];
};

const PAD_RATIO = 0.1; // margen de seguridad del cliché: 10% del lado menor
const LINE_FILL = 0.74; // el texto ocupa ~74% del alto de fila

function textWidthMm(font: OpenTypeFont, text: string, fontSizeMm: number): number {
  const scale = fontSizeMm / font.unitsPerEm;
  let w = 0;
  for (const ch of text) {
    w += (font.charToGlyph(ch).advanceWidth || 0) * scale;
  }
  return w;
}

/**
 * Calcula el layout de las líneas con texto dentro de la matriz. Reparte las
 * filas por igual, dimensiona la fuente al alto de fila y la achica si una línea
 * excede el ancho útil (fit-to-box). Coordenadas en mm, y-down desde arriba.
 */
export function layoutSello(
  model: SelloModel,
  lineas: LineaArte[],
  resolver: FontResolver,
  opts: ArteOpts = {},
): SelloLayout {
  const align: Alineacion = opts.align ?? "center";
  const activas = lineas.filter((l) => l.text.trim() !== "");
  const paddingMm = Math.min(model.widthMm, model.heightMm) * PAD_RATIO;
  const nFilas = Math.max(1, activas.length);
  const filaAltoMm = (model.heightMm - 2 * paddingMm) / nFilas;
  const anchoUtilMm = model.widthMm - 2 * paddingMm;

  const lineasLayout: LineaLayout[] = activas.map((l, i) => {
    const font = resolver(l.fontKey, l.bold === true, l.italic === true);
    let fontSizeMm = filaAltoMm * LINE_FILL * (l.bold ? 1.0 : 0.94);
    let anchoTextoMm = textWidthMm(font, l.text, fontSizeMm);
    if (anchoTextoMm > anchoUtilMm && anchoTextoMm > 0) {
      fontSizeMm = (fontSizeMm * anchoUtilMm) / anchoTextoMm;
      anchoTextoMm = anchoUtilMm;
    }
    // baseline: centro vertical de la fila + ~34% del tamaño (bajar a baseline).
    const filaCentroYMm = paddingMm + filaAltoMm * (i + 0.5);
    const baselineYMm = filaCentroYMm + fontSizeMm * 0.34;
    let xMm: number;
    if (align === "left") xMm = paddingMm;
    else if (align === "right") xMm = model.widthMm - paddingMm - anchoTextoMm;
    else xMm = (model.widthMm - anchoTextoMm) / 2;
    return { text: l.text, font, fontSizeMm, xMm, baselineYMm };
  });

  return { model, align, paddingMm, lineas: lineasLayout };
}

/** Contornos de una línea como comandos de path, en mm y-down (para SVG). */
function lineaPathCommands(l: LineaLayout): PathCommand[] {
  const scale = l.fontSizeMm / l.font.unitsPerEm;
  let x = l.xMm;
  const cmds: PathCommand[] = [];
  for (const ch of l.text) {
    const g = l.font.charToGlyph(ch);
    // getPath da coords en px (y-down) con baseline en `y`; usamos mm directo.
    const gp = g.getPath(x, l.baselineYMm, l.fontSizeMm);
    for (const c of gp.commands) cmds.push(c as PathCommand);
    x += (g.advanceWidth || 0) * scale;
  }
  return cmds;
}

function cmdsToSvgD(cmds: PathCommand[], digits = 3): string {
  const n = (v: number) => Number(v.toFixed(digits)).toString();
  const out: string[] = [];
  for (const c of cmds) {
    if (c.type === "M") out.push(`M${n(c.x)} ${n(c.y)}`);
    else if (c.type === "L") out.push(`L${n(c.x)} ${n(c.y)}`);
    else if (c.type === "Q") out.push(`Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`);
    else if (c.type === "C") out.push(`C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`);
    else out.push("Z");
  }
  return out.join(" ");
}

/** SVG del sello a tamaño real (viewBox en mm). Preview y arte comparten paths. */
export function svgSello(layout: SelloLayout, opts: { negative?: boolean } = {}): string {
  const { widthMm: w, heightMm: h } = layout.model;
  const negative = opts.negative === true;
  const bg = negative ? "#000" : "#fff";
  const fg = negative ? "#fff" : "#111";
  const paths = layout.lineas
    .map((l) => `<path d="${cmdsToSvgD(lineaPathCommands(l))}" fill="${fg}"/>`)
    .join("");
  // Sin width/height: el contenedor define el tamaño (viewBox en mm mantiene la
  // proporción real de la matriz). Para exportar un SVG a archivo, añadir dims.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"><rect width="${w}" height="${h}" fill="${bg}"/>${paths}</svg>`;
}

const MM_TO_PT = 72 / 25.4;

/** Convierte los comandos (mm, y-down) a PostScript (pt, y-up) para el EPS. */
function cmdsToPostScript(cmds: PathCommand[], heightMm: number): string {
  const toX = (mm: number) => (mm * MM_TO_PT).toFixed(3);
  const toY = (mm: number) => ((heightMm - mm) * MM_TO_PT).toFixed(3);
  const out: string[] = [];
  for (const c of cmds) {
    if (c.type === "M") out.push(`${toX(c.x)} ${toY(c.y)} moveto`);
    else if (c.type === "L") out.push(`${toX(c.x)} ${toY(c.y)} lineto`);
    else if (c.type === "Q") {
      // Q (cuadrática) → C (cúbica) para PostScript, que solo tiene curveto.
      out.push(
        `${toX(c.x1)} ${toY(c.y1)} ${toX(c.x)} ${toY(c.y)} qcurveto`,
      );
    } else if (c.type === "C") {
      out.push(
        `${toX(c.x1)} ${toY(c.y1)} ${toX(c.x2)} ${toY(c.y2)} ${toX(c.x)} ${toY(c.y)} curveto`,
      );
    } else out.push("closepath");
  }
  return out.join("\n");
}

export type EpsMeta = {
  /** Nombre del modelo del sello (para el título). */
  modeloNombre?: string;
  /** ISO date; se pasa desde afuera (el motor no usa Date.now para ser puro). */
  fechaIso?: string;
};

/**
 * Genera el EPS del sello con el texto como contornos vectoriales.
 * `negative=true` → fondo negro, letras blancas (para polímero líquido).
 */
export function epsSello(
  layout: SelloLayout,
  opts: { negative?: boolean; meta?: EpsMeta } = {},
): string {
  const negative = opts.negative === true;
  const wPt = layout.model.widthMm * MM_TO_PT;
  const hPt = layout.model.heightMm * MM_TO_PT;
  const h = layout.model.heightMm;

  let body = "";
  // Procedimiento qcurveto: convierte control cuadrático → cúbico en PostScript.
  // (x1 y1 x2 y2 → los control cúbicos se derivan del punto actual)
  body += `/qcurveto { % qx qy x y  (cuadrática desde currentpoint)\n`;
  body += `  /qy2 exch def /qx2 exch def /qy1 exch def /qx1 exch def\n`;
  body += `  currentpoint /cy exch def /cx exch def\n`;
  body += `  cx qx1 cx sub 2 3 div mul add  cy qy1 cy sub 2 3 div mul add\n`;
  body += `  qx2 qx1 qx2 sub 2 3 div mul add  qy2 qy1 qy2 sub 2 3 div mul add\n`;
  body += `  qx2 qy2 curveto\n`;
  body += `} def\n`;

  if (negative) {
    body += `0 setgray\n0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)} rectfill\n`;
  }
  body += `${negative ? "1" : "0"} setgray\n`;

  for (const l of layout.lineas) {
    body += "newpath\n";
    body += cmdsToPostScript(lineaPathCommands(l), h);
    body += "\nfill\n";
  }

  const titulo = opts.meta?.modeloNombre ?? "sello";
  const fecha = opts.meta?.fechaIso ?? "";
  return `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${Math.ceil(wPt)} ${Math.ceil(hPt)}
%%HiResBoundingBox: 0 0 ${wPt.toFixed(3)} ${hPt.toFixed(3)}
%%Title: Sello ${titulo} ${negative ? "(negativo)" : "(positivo)"}
%%Creator: GDI · Configurador de sello
%%CreationDate: ${fecha}
%%DocumentData: Clean7Bit
%%LanguageLevel: 2
%%Pages: 1
%%EndComments
%%BeginProlog
%%EndProlog
%%Page: 1 1
gsave
${body}grestore
showpage
%%EOF
`;
}
