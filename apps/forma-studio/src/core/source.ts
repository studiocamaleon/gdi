import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import opentype from "opentype.js";
import type { Contours, Source } from "./types";
const fonts = new Map<string, Promise<opentype.Font>>();
function textPath(
  font: opentype.Font,
  text: string,
  spacing = 0,
): opentype.Path {
  try {
    return font.getPath(text, 0, 0, 1000, {
      kerning: true,
      letterSpacing: spacing,
    });
  } catch (error) {
    // Algunas tablas GSUB recientes aún no están soportadas por OpenType.js.
    // Los contornos individuales y el kerning siguen disponibles para texto latino.
    if (
      !(error instanceof Error) ||
      !error.message.includes("not yet supported")
    )
      throw error;
    const result = new opentype.Path(),
      glyphs = Array.from(text).map((char) => font.charToGlyph(char));
    let x = 0;
    glyphs.forEach((glyph, i) => {
      result.extend(glyph.getPath(x, 0, 1000));
      x +=
        ((glyph.advanceWidth || 0) * 1000) / font.unitsPerEm + spacing * 1000;
      if (glyphs[i + 1])
        x +=
          (font.getKerningValue(glyph, glyphs[i + 1]) * 1000) / font.unitsPerEm;
    });
    return result;
  }
}
export const FONT_NAMES = [
  "BebasNeue",
  "Montserrat",
  "Oswald",
  "Anton",
  "Pacifico",
  "Bungee",
  "RussoOne",
  "Poppins",
  "Raleway",
  "Righteous",
  "ArchivoBlack",
  "PermanentMarker",
  "Orbitron",
  "PlayfairDisplay",
  "Lobster",
  "Syne",
];
export function parseSvg(svg: string): Contours[] {
  if (svg.length > 4_000_000)
    throw new Error(
      "El SVG supera los 4 MB. Simplificá los contornos antes de cargarlo.",
    );
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "svg"
  )
    throw new Error("El archivo no es un SVG válido.");
  if (
    doc.querySelector("script,foreignObject,image,text,iframe") ||
    /<!DOCTYPE|<!ENTITY/i.test(svg)
  )
    throw new Error(
      "Convertí textos e imágenes a curvas. Se admiten sólo vectores SVG.",
    );
  for (const el of doc.querySelectorAll("*"))
    for (const attr of [...el.attributes])
      if (
        attr.name.startsWith("on") ||
        ((attr.localName === "href" || attr.name === "src") &&
          !attr.value.startsWith("#"))
      )
        throw new Error(
          "El SVG contiene referencias externas o código activo.",
        );
  const loader=new SVGLoader();
  // Usamos el mismo píxel CSS (96/in) para las longitudes del SVG y su escala física.
  loader.defaultDPI = 96;
  const data = loader.parse(
    new XMLSerializer().serializeToString(doc),
  );
  const shapes: Contours[] = [];
  for (const path of data.paths) {
    if (
      (path.userData?.style as { fill?: string } | undefined)?.fill === "none"
    )
      continue;
    for (const shape of path.toShapes()) {
      const contour = shape.extractPoints(40);
      shapes.push([
        contour.shape.map((v) => [v.x, -v.y]),
        ...contour.holes.map((h) =>
          h.map((v) => [v.x, -v.y] as [number, number]),
        ),
      ]);
    }
  }
  if (!shapes.length)
    throw new Error(
      "No hay áreas rellenas. Expandí los trazos y cerrá los contornos del SVG.",
    );
  if (shapes.flat(2).length > 180000)
    throw new Error("El SVG es demasiado complejo. Simplificá sus curvas.");
  return shapes;
}
export function physicalHeight(svg: string, shapes = parseSvg(svg)): number {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const value = doc.documentElement.getAttribute("height") || "";
  const match = /^([\d.]+)\s*(mm|cm|in|pt|px)?$/.exec(value);
  if (!match) return 100;
  const heightMm =
    Number(match[1]) *
    ({ mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 }[
      match[2] || "px"
    ] || 1);
  const viewBox = doc.documentElement
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const viewportHeight =
    viewBox?.length === 4 ? viewBox[3] : (heightMm * 96) / 25.4;
  const points = shapes.flat(2);
  const [minY, maxY] = points.reduce(
    ([min, max], [, y]) => [Math.min(min, y), Math.max(max, y)],
    [Infinity, -Infinity],
  );
  const drawingHeight = maxY - minY;
  return Math.min(
    3000,
    Math.max(
      5,
      viewportHeight > 0 ? (drawingHeight * heightMm) / viewportHeight : 100,
    ),
  );
}
export async function contoursFromSource(source: Source): Promise<Contours[]> {
  let shapes: Contours[];
  if (source.mode === "svg") shapes = parseSvg(source.svg);
  else {
    if (!source.text.trim())
      throw new Error("Escribí un texto para generar las letras.");
    if (source.text.length > 100)
      throw new Error("Usá hasta 100 caracteres por proyecto.");
    if (!FONT_NAMES.includes(source.font))
      throw new Error("Elegí una tipografía disponible.");
    if (!fonts.has(source.font))
      fonts.set(
        source.font,
        fetch(`/fonts/${source.font}.ttf`, {
          signal: AbortSignal.timeout(15000),
        })
          .then((r) => {
            if (!r.ok) throw new Error("No se pudo cargar la fuente.");
            return r.arrayBuffer();
          })
          .then(opentype.parse)
          .catch((error) => {
            fonts.delete(source.font);
            throw error;
          }),
      );
    const font = await fonts.get(source.font)!;
    const text = source.text.normalize("NFC");
    if (
      Array.from(text).some((char) => !/\s/.test(char) && !font.hasChar(char))
    )
      throw new Error(
        "Esta tipografía no incluye alguno de los caracteres. Elegí otra fuente o cargá el texto como SVG.",
      );
    const bounds = textPath(font, text).getBoundingBox();
    const path = textPath(
      font,
      text,
      ((source.spacing / Math.max(1, source.height)) *
        (bounds.y2 - bounds.y1)) /
        1000,
    );
    shapes = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><path d="${path.toPathData(4)}"/></svg>`,
    );
  }
  const points = shapes.flat(2);
  const [minX, minY, maxY] = points.reduce(
    ([mx, my, My], [x, y]) => [
      Math.min(mx, x),
      Math.min(my, y),
      Math.max(My, y),
    ],
    [Infinity, Infinity, -Infinity],
  );
  const height = maxY - minY;
  if (!Number.isFinite(height) || height < 0.0001)
    throw new Error("El diseño no tiene altura válida.");
  const factor = source.height / height;
  return shapes.map((s) =>
    s.map((c) => c.map(([x, y]) => [(x - minX) * factor, (y - minY) * factor])),
  );
}
