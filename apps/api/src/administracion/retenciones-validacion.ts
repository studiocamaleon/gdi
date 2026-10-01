import { BadRequestException } from '@nestjs/common';
import {
  claveRetencion,
  estimarAcreditacion,
  type ReglaRetencion,
  type RetencionCalculada,
} from '../common/medios-pago';

export function validarReglasRetencion(
  reglas: ReglaRetencion[],
  feriados: string[] = [],
  tipo?: string,
) {
  const ids = new Set<string>();
  for (const fecha of feriados) validarFechaLiquidacion(fecha);
  for (const r of reglas) {
    if (tipo === 'cheque_echeq' && r.agente !== 'cliente')
      throw new BadRequestException(
        'En cheques sólo se configuran retenciones del cliente; los descuentos bancarios corresponden a la gestión del valor.',
      );
    if (ids.has(r.id))
      throw new BadRequestException(
        'Hay identificadores de retención repetidos.',
      );
    ids.add(r.id);
    if (r.vigenteDesde) validarFechaLiquidacion(r.vigenteDesde);
    if (r.vigenteHasta) validarFechaLiquidacion(r.vigenteHasta);
    if (r.vigenteDesde && r.vigenteHasta && r.vigenteDesde > r.vigenteHasta)
      throw new BadRequestException(
        'La vigencia de una retención termina antes de comenzar.',
      );
    if (
      [
        'SIRCREB',
        'SIRTAC',
        'SIRCUPA',
        'IIBB_CONVENIO',
        'PERCEPCION_IIBB',
      ].includes(r.regimen) &&
      !r.jurisdiccion.trim()
    )
      throw new BadRequestException(
        'Indicá la jurisdicción de la retención de IIBB.',
      );
  }
  for (let i = 0; i < reglas.length; i++)
    for (const b of reglas.slice(i + 1)) {
      const a = reglas[i];
      if (
        claveRetencion(a) === claveRetencion(b) &&
        (a.vigenteDesde ?? '') <= (b.vigenteHasta ?? '9999-12-31') &&
        (b.vigenteDesde ?? '') <= (a.vigenteHasta ?? '9999-12-31')
      ) {
        throw new BadRequestException(
          'Hay dos reglas de la misma retención con vigencias superpuestas.',
        );
      }
    }
}

export function validarFechaLiquidacion(fecha: string) {
  try {
    estimarAcreditacion(fecha, 0);
  } catch {
    throw new BadRequestException('Ingresá una fecha válida.');
  }
}

export function validarRetenciones(lineas: RetencionCalculada[]) {
  const claves = new Set<string>();
  for (const r of lineas) {
    if (
      [r.base, r.alicuota, r.monto].some((n) => !Number.isFinite(n) || n < 0) ||
      r.alicuota > 100 ||
      r.monto > r.base ||
      r.base > 999999999999.99
    )
      throw new BadRequestException(
        'Revisá la base, alícuota e importe de la retención.',
      );
    const clave = claveRetencion(r);
    if (claves.has(clave))
      throw new BadRequestException(
        'La misma retención está cargada dos veces. Unificá su importe.',
      );
    claves.add(clave);
  }
}
