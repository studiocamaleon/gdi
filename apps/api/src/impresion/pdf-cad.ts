import {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFDict,
  degrees,
  type PDFPage,
} from 'pdf-lib';
import { planPaginaCad, type ConfiguracionCad } from './cad.domain';
import type { MedidaPagina } from '../common/medidas-documento';
const PT = 72 / 25.4;

export function geometriaCad(page: PDFPage) {
  const media = page.getMediaBox(),
    crop = page.getCropBox();
  const x = Math.max(media.x, crop.x),
    y = Math.max(media.y, crop.y);
  const w = Math.min(media.x + media.width, crop.x + crop.width) - x;
  const h = Math.min(media.y + media.height, crop.y + crop.height) - y;
  const u =
    page.node.lookupMaybe(PDFName.of('UserUnit'), PDFNumber)?.asNumber() ?? 1;
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  if (
    ![w, h, u].every((n) => Number.isFinite(n) && n > 0) ||
    ![0, 90, 180, 270].includes(r)
  )
    throw new Error('El PDF tiene una geometría inválida.');
  const matriz: [number, number, number, number, number, number] =
    r === 90
      ? [0, -u, u, 0, -u * y, u * (x + w)]
      : r === 180
        ? [-u, 0, 0, -u, u * (x + w), u * (y + h)]
        : r === 270
          ? [0, u, -u, 0, u * (y + h), -u * x]
          : [u, 0, 0, u, -u * x, -u * y];
  return {
    caja: { left: x, bottom: y, right: x + w, top: y + h },
    matriz,
    medida: {
      anchoMm: ((r % 180 ? h : w) * u) / PT,
      altoMm: ((r % 180 ? w : h) * u) / PT,
    },
  };
}

/** Preserva la escala física de CropBox ∩ MediaBox, UserUnit y Rotate.
 * No rasteriza ni ajusta el plano al rollo. Se rechazan anotaciones imprimibles
 * que pdf-lib no integra en el contenido, para no perder marcas silenciosamente. */
export async function prepararPaginaCad(
  pdf: PDFDocument,
  pagina: number,
  cotizada: MedidaPagina,
  config: ConfiguracionCad,
) {
  const page = pdf.getPage(pagina - 1);
  const g = geometriaCad(page);
  if (
    Math.abs(g.medida.anchoMm - cotizada.anchoMm) > 0.1 ||
    Math.abs(g.medida.altoMm - cotizada.altoMm) > 0.1
  )
    throw new Error(
      `Las medidas de la página ${pagina} no coinciden con las cotizadas. Volvé a cotizar.`,
    );
  const anotaciones = page.node.Annots();
  for (let i = 0; i < (anotaciones?.size() ?? 0); i++) {
    const a = anotaciones!.lookup(i, PDFDict);
    if (a.lookupMaybe(PDFName.of('Subtype'), PDFName)?.asString() !== '/Link')
      throw new Error(
        `La página ${pagina} contiene anotaciones. Exportá una copia con las anotaciones integradas antes de imprimir.`,
      );
  }
  const plan = planPaginaCad(config, g.medida);
  const salida = await PDFDocument.create();
  const hoja = salida.addPage([
    plan.anchoSalidaMm * PT,
    plan.largoSalidaMm * PT,
  ]);
  if (page.node.Contents()) {
    const original = await salida.embedPage(page, g.caja, g.matriz);
    hoja.drawPage(original, {
      x:
        (plan.desplazamientoXMm + (plan.giro === 90 ? g.medida.altoMm : 0)) *
        PT,
      y: plan.desplazamientoYMm * PT,
      rotate: degrees(plan.giro),
    });
  }
  return { pdf: Buffer.from(await salida.save()), plan };
}
