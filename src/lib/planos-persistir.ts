/**
 * Persistir los PDF de medición como Archivos del ítem de la orden.
 *
 * Fase 2 de la herramienta de medidas por PDF: los planos que se adjuntan para
 * medir (client-side, pdf-lib) se suben a los Archivos del ítem al guardar la
 * orden — donde el operario ya los ve desde el tablero. Calcado del patrón de
 * sellos (sello-arte/publicar.ts), pero acá el archivo es del usuario (no se
 * regenera), así que se cargan los bytes reales retenidos en memoria.
 *
 * Ver docs/planos-persistir-diseno.md.
 */

import { subirArchivo } from "@/lib/archivos-api";

/** Marca de automatismo en el Archivo: lo subió el lector de planos. */
export const AUTOGENERADO_MEDIDA = "medida_pdf";

export type PlanosDeItem = {
  ordenItemId: string;
  planos: File[];
};

export type ResultadoPlanos = {
  subidos: number;
  errores: string[];
};

/**
 * Sube los PDF de cada ítem a sus Archivos (scope ORDEN_ITEM). Nunca tira: si
 * un archivo falla, se acumula el error y sigue — igual que sellos, el guardado
 * de la orden no se bloquea por esto.
 */
export async function publicarPlanos(
  items: PlanosDeItem[],
): Promise<ResultadoPlanos> {
  let subidos = 0;
  const errores: string[] = [];
  for (const { ordenItemId, planos } of items) {
    for (const file of planos) {
      try {
        await subirArchivo(file, {
          scope: "ORDEN_ITEM",
          entidadId: ordenItemId,
          autogeneradoPor: AUTOGENERADO_MEDIDA,
        });
        subidos += 1;
      } catch (error) {
        errores.push(
          error instanceof Error
            ? `${file.name}: ${error.message}`
            : `${file.name}: no se pudo subir`,
        );
      }
    }
  }
  return { subidos, errores };
}
