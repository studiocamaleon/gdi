/**
 * Convierte a PNG el logo que los PDF no saben dibujar.
 *
 * jsPDF sólo rasteriza PNG y JPEG. La subida aceptaba además SVG y WEBP, así
 * que quien cargaba un SVG —el formato natural de un logo— lo veía bien en la
 * web y NUNCA en los documentos: los cuatro PDF caían al dibujo de iniciales
 * sin decir nada.
 *
 * Se convierte en el NAVEGADOR y no en el servidor a propósito: rasterizar SVG
 * en Node pide un binario nativo, y este proyecto ya se fue de Puppeteer por el
 * peso del deploy. El navegador ya tiene todo lo que hace falta.
 *
 * Ver docs/pdf-sin-puppeteer-diseno.md
 */

/** Lo que jsPDF dibuja tal cual: no se toca, re-encodear sólo degradaría. */
const YA_SIRVEN = /^image\/(png|jpe?g)$/i;

/**
 * Lado máximo del PNG resultante. 1024 alcanza de sobra: el logo se usa a ~14 mm
 * en el encabezado del PDF y a ~40 px en pantalla. Más grande sólo gasta cuota.
 */
export const LADO_MAX = 1024;

/** `viewBox="minX minY ancho alto"`, con separadores flexibles. */
const VIEW_BOX =
  /viewBox\s*=\s*["']\s*[-\d.eE]+[\s,]+[-\d.eE]+[\s,]+([\d.eE]+)[\s,]+([\d.eE]+)/i;

/**
 * Le pone medidas explícitas al SVG.
 *
 * Un SVG que sólo declara `viewBox` no tiene tamaño intrínseco, y un `<img>`
 * con esa fuente se dibuja en el tamaño por defecto del navegador (300×150) o
 * directamente en cero. El resultado sería un logo aplastado o vacío, sin error
 * a la vista. Se calculan las medidas desde el viewBox y se escriben.
 *
 * Exportada para poder testearla: es la parte que se puede romper en silencio.
 */
export function svgConMedidas(texto: string, ladoMax = LADO_MAX): string {
  const vb = VIEW_BOX.exec(texto);
  const anchoVb = vb ? Number(vb[1]) : 0;
  const altoVb = vb ? Number(vb[2]) : 0;

  // Sin viewBox usable no hay proporción que respetar: cuadrado y a otra cosa.
  const proporcion =
    anchoVb > 0 && altoVb > 0 ? anchoVb / altoVb : 1;
  const ancho = proporcion >= 1 ? ladoMax : Math.round(ladoMax * proporcion);
  const alto = proporcion >= 1 ? Math.round(ladoMax / proporcion) : ladoMax;

  return texto.replace(
    /<svg\b([^>]*)>/i,
    (_todo, attrs: string) =>
      `<svg${attrs
        .replace(/\swidth\s*=\s*["'][^"']*["']/gi, "")
        .replace(/\sheight\s*=\s*["'][^"']*["']/gi, "")} width="${ancho}" height="${alto}">`,
  );
}

/** Medidas de destino que entran en `ladoMax` sin deformar. */
export function medidasDestino(
  ancho: number,
  alto: number,
  ladoMax = LADO_MAX,
): { ancho: number; alto: number } {
  if (ancho <= 0 || alto <= 0) return { ancho: ladoMax, alto: ladoMax };
  const escala = Math.min(1, ladoMax / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen."));
    img.src = url;
  });
}

/**
 * Devuelve el archivo listo para subir. Si ya es PNG o JPEG lo devuelve tal
 * cual; si no, lo pasa a PNG conservando la transparencia.
 *
 * Si la conversión falla —un SVG que referencia fuentes o imágenes externas
 * ensucia el canvas y `toBlob` tira SecurityError— devuelve el original: es
 * preferible un logo que se ve en la web y no en el PDF, al estado anterior, a
 * un logo que no se puede subir.
 */
export async function rasterizarLogo(
  file: File,
  ladoMax = LADO_MAX,
): Promise<{ archivo: File; convertido: boolean }> {
  if (YA_SIRVEN.test(file.type)) return { archivo: file, convertido: false };

  let url: string | null = null;
  try {
    const esSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
    const fuente = esSvg
      ? new Blob([svgConMedidas(await file.text(), ladoMax)], {
          type: "image/svg+xml",
        })
      : file;
    url = URL.createObjectURL(fuente);

    const img = await cargarImagen(url);
    const { ancho, alto } = medidasDestino(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      ladoMax,
    );

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sin canvas.");
    // Sin fillRect: el fondo queda transparente, que es lo que el PDF necesita.
    ctx.drawImage(img, 0, 0, ancho, alto);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/png"),
    );
    if (!blob) throw new Error("No se pudo convertir a PNG.");

    const nombre = file.name.replace(/\.[^.]+$/, "") + ".png";
    return {
      archivo: new File([blob], nombre, { type: "image/png" }),
      convertido: true,
    };
  } catch {
    return { archivo: file, convertido: false };
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
