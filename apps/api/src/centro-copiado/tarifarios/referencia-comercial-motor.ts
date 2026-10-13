import type { CotizarOutput } from '../../motor-universal/tipos';
import type { CargaMargen } from '../comercial/control-margen';
import { DecimalComercial as D } from '../comercial/validaciones';

/** Snapshot de ESTA corrida del motor. Nunca deducir tasas a partir de importes
 * redondeados ni asumir cero si faltó el desglose. No vuelve a consultar catálogos.
 */
export function referenciaComercialMotor(
  cotizaciones: NonNullable<CotizarOutput['cotizacion']>[],
  ivaPorcentaje: string,
) {
  try {
    const referencias = cotizaciones.map((c) => {
      const d = c.desglosePrecio;
      if (!d || !Number.isFinite(d.precioNetoTotal) || d.precioNetoTotal < 0)
        throw new Error('El motor no devolvió el desglose comercial completo.');
      let iva = new D(0);
      const cargas: CargaMargen[] = [];
      const vistos = new Set<string>();
      for (const impuesto of d.impuestos) {
        if (
          !Number.isFinite(impuesto.porcentaje) ||
          impuesto.porcentaje < 0 ||
          impuesto.porcentaje > 100 ||
          !impuesto.traslado ||
          !impuesto.baseCalculo
        )
          throw new Error(
            'Falta la base o el tratamiento de un impuesto del motor.',
          );
        if (impuesto.traslado === 'POR_FUERA') {
          if (impuesto.baseCalculo !== 'NETO')
            throw new Error('La base del IVA no es compatible.');
          iva = iva.plus(impuesto.porcentaje);
        } else
          cargas.push({
            clave: `impuesto:${impuesto.catalogoId}`,
            nombre: impuesto.nombre,
            tipo: 'IMPUESTO_INTERNO',
            base: impuesto.baseCalculo,
            porcentaje: String(impuesto.porcentaje),
          });
      }
      if (!iva.eq(ivaPorcentaje))
        throw new Error('El IVA del motor y el de la referencia no coinciden.');
      for (const comision of d.comisiones) {
        if (
          !comision.baseCalculo ||
          !Number.isFinite(comision.porcentaje) ||
          comision.porcentaje < 0 ||
          comision.porcentaje > 100
        )
          throw new Error('Falta una base o tasa de comisión del motor.');
        cargas.push({
          clave: `comision:${comision.catalogoId}`,
          nombre: comision.nombre,
          tipo: 'COMISION',
          base: comision.baseCalculo,
          porcentaje: String(comision.porcentaje),
        });
      }
      for (const carga of cargas) {
        if (vistos.has(carga.clave))
          throw new Error('El motor devolvió cargas duplicadas.');
        vistos.add(carga.clave);
      }
      cargas.sort((a, b) => a.clave.localeCompare(b.clave));
      return {
        cargas,
        neto: d.precioNetoTotal,
        metodo: d.precioConfig.metodoCalculo,
      };
    });
    if (
      !referencias.length ||
      referencias.some(
        (r) =>
          JSON.stringify(r.cargas) !== JSON.stringify(referencias[0].cargas),
      )
    )
      throw new Error(
        'Los segmentos de la referencia usan cargas comerciales distintas.',
      );
    return {
      cargas: referencias[0].cargas,
      ventaMotorNeta: referencias
        .reduce((s, r) => s.plus(r.neto), new D(0))
        .toFixed(),
      metodosMotor: [...new Set(referencias.map((r) => r.metodo))],
      motivo: null,
    };
  } catch (e) {
    return {
      cargas: null,
      ventaMotorNeta: null,
      metodosMotor: [],
      motivo:
        e instanceof Error
          ? e.message
          : 'No se pudo verificar el desglose comercial.',
    };
  }
}
