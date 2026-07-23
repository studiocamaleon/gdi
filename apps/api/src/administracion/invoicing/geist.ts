import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { jsPDF } from 'jspdf';

/**
 * Geist para los PDF del sistema, cargada una sola vez por proceso.
 *
 * Los TTF viven acá (ver fonts/README): next/font sólo expone woff2 y jsPDF
 * necesita TTF. nest-cli los copia a dist manteniendo la estructura, así que
 * `__dirname` sirve tanto con ts-node como compilado.
 *
 * Si no se pueden leer, el PDF sale en la Helvetica de jsPDF y se avisa: un
 * documento feo es mejor que ninguno.
 */

let cache: { regular: string; bold: string } | null | undefined;

function cargar(log: Logger, queDocumento: string) {
  if (cache !== undefined) return cache;
  try {
    const dir = join(__dirname, 'fonts');
    cache = {
      regular: readFileSync(join(dir, 'Geist-Regular.ttf')).toString('base64'),
      bold: readFileSync(join(dir, 'Geist-Bold.ttf')).toString('base64'),
    };
  } catch (e) {
    log.warn(
      `No pude cargar Geist para ${queDocumento} (${e instanceof Error ? e.message : e}). Sale en Helvetica.`,
    );
    cache = null;
  }
  return cache;
}

/**
 * Incrusta Geist en el documento y devuelve la familia a usar: 'Geist' si se
 * pudo, 'helvetica' si no. El llamador guarda el valor y lo pasa a setFont.
 */
export function registrarGeist(
  pdf: jsPDF,
  log: Logger,
  queDocumento: string,
): string {
  const geist = cargar(log, queDocumento);
  if (!geist) return 'helvetica';
  pdf.addFileToVFS('Geist-Regular.ttf', geist.regular);
  pdf.addFont('Geist-Regular.ttf', 'Geist', 'normal');
  pdf.addFileToVFS('Geist-Bold.ttf', geist.bold);
  pdf.addFont('Geist-Bold.ttf', 'Geist', 'bold');
  return 'Geist';
}
