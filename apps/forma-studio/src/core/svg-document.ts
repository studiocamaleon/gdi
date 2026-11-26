import DOMPurify from "dompurify";

let hooksReady = false;
const rejectedTags = new Set([
  "script",
  "foreignobject",
  "image",
  "text",
  "iframe",
  "object",
  "embed",
  "animate",
  "animatemotion",
  "animatetransform",
  "set",
]);

function hasExternalCss(value: string): boolean {
  const local = value.replace(/url\(\s*(['"]?)#[\w:.-]+\1\s*\)/gi, "");
  return /url\s*\(|expression\s*\(|[\\@]/i.test(local);
}

/** Sólo el SVG saneado llega al parser que consume la geometría. */
export function svgDocument(svg: string): Document {
  if (svg.length > 4_000_000)
    throw new Error(
      "El SVG supera los 4 MB. Simplificá los contornos antes de cargarlo.",
    );
  if (/<!DOCTYPE|<!ENTITY/i.test(svg))
    throw new Error(
      "El SVG contiene declaraciones de documento o entidades no admitidas.",
    );
  if (!hooksReady) {
    DOMPurify.addHook("uponSanitizeElement", (node, data) => {
      const tag = data.tagName.toLowerCase();
      if (tag === "use")
        throw new Error(
          "Expandí las referencias SVG a curvas antes de importar el dibujo.",
        );
      if (tag === "style" && hasExternalCss(node.textContent || ""))
        throw new Error(
          "El SVG contiene estilos con referencias externas o código activo.",
        );
      if (rejectedTags.has(tag))
        throw new Error(
          "Convertí textos e imágenes a curvas. Se admiten sólo vectores SVG sin código activo.",
        );
    });
    DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
      const name = data.attrName.toLowerCase();
      // Se permiten referencias internas de degradados y recortes, nunca una red.
      const withoutLocalUrls = data.attrValue.replace(
        /url\(\s*(['"]?)#[\w:.-]+\1\s*\)/gi,
        "",
      );
      if (
        name.startsWith("on") ||
        ((name === "href" || name === "xlink:href" || name === "src") &&
          !data.attrValue.startsWith("#")) ||
        /url\s*\(|expression\s*\(/i.test(withoutLocalUrls) ||
        ((name === "style" ||
          name === "fill" ||
          name === "stroke" ||
          name === "filter") &&
          /[\\@]/.test(data.attrValue))
      )
        throw new Error(
          "El SVG contiene referencias externas o código activo.",
        );
    });
    hooksReady = true;
  }
  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    FORBID_TAGS: [...rejectedTags],
  });
  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "svg"
  )
    throw new Error("El archivo no es un SVG válido.");
  return doc;
}
