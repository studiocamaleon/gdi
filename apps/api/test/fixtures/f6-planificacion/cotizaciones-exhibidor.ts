import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { restaurarJson } from '../../../src/common/json-compartido';
import type { CotizarOutput } from '../../../src/motor-universal/tipos';
import type { FuenteCotizacionF6 } from '../../../src/eta/planificacion/adaptador-cotizacion';

/** Capturas reales del catálogo local, misma revisión y geometría efectiva.
 * 50/100/150 reutilizan la evidencia F4; 200 se calculó el 09/09 para F6.
 * No son mediciones cronometradas de Visual Ilusión.
 */
export function cotizacionesExhibidor(): FuenteCotizacionF6[] {
  return [50, 100, 150, 200].map((cantidad) => {
    const carpeta =
      cantidad === 200 ? __dirname : join(__dirname, '../f4-persistencia');
    const captura = restaurarJson<{
      result: CotizarOutput;
      data: { input: { tenantId: string } };
    }>(
      JSON.parse(
        gunzipSync(
          readFileSync(
            join(carpeta, `exhibidor-${cantidad}-cotizacion.json.gz`),
          ),
        ).toString(),
      ),
    );
    if (!captura.result.exitoso || !captura.result.cotizacion)
      throw new Error('La captura no es una cotización exitosa.');
    return {
      tenantId: captura.data.input.tenantId,
      configuracionId: 'exhibidor-revision-6-capturas-2026-09-09',
      id: `captura-exhibidor-${cantidad}`,
      cotizacion: captura.result.cotizacion,
    };
  });
}
