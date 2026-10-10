import { DecimalComercial as D } from './validaciones';

export type PoliticaMargen = {
  minimoPorcentaje: string;
  anteInsuficiente: 'AUTORIZACION' | 'BLOQUEO';
};
export type CargaMargen = {
  clave: string;
  nombre: string;
  tipo: 'IMPUESTO_INTERNO' | 'COMISION';
  base: 'NETO' | 'BRUTO_COBRADO';
  porcentaje: string;
};
export type EstadoMargen =
  | 'CUMPLE'
  | 'REQUIERE_AUTORIZACION'
  | 'BLOQUEADO'
  | 'NO_VERIFICABLE';

/** Ventas ya ajustadas por acuerdos, descuentos, precio manual y mínimo.
 * El caller separa terminaciones. El costo incluye preparación y cargos directos
 * una sola vez; aquí se agregan únicamente cargas porcentuales sobre la venta.
 * No confundir este diagnóstico con una autorización de emisión.
 */
export function evaluarMargen(input: {
  ventas: { neto: string; total: string; cargas: CargaMargen[] | null }[];
  costoProduccion: string | null;
  politica?: PoliticaMargen;
  decimales: number;
}) {
  const vacio = (motivo: string) => ({
    estado: 'NO_VERIFICABLE' as EstadoMargen,
    motivo,
    utilidad: null as string | null,
    porcentaje: null as string | null,
    negativo: null as boolean | null,
    cargasTotal: null as string | null,
    cargas: [] as (CargaMargen & { importe: string })[],
  });
  if (
    !Number.isInteger(input.decimales) ||
    input.decimales < 0 ||
    input.decimales > 6
  )
    return vacio('La precisión monetaria no es válida.');
  if (!input.ventas.length)
    return vacio('Falta precio para completar la venta de referencia.');
  if (
    input.costoProduccion == null ||
    input.ventas.some((v) => v.cargas == null)
  )
    return vacio('Faltan costos o cargas comerciales verificables.');
  const importe = (valor: string) => {
    if (!/^\d+(\.\d+)?$/.test(valor)) throw new Error('Importe inválido.');
    return new D(valor);
  };
  try {
    const costo = importe(input.costoProduccion);
    let neto = new D(0);
    const cargos = new Map<
      string,
      { carga: CargaMargen; valor: InstanceType<typeof D> }
    >();
    for (const venta of input.ventas) {
      const n = importe(venta.neto),
        total = importe(venta.total);
      if (total.lt(n))
        return vacio('El total fiscal es menor que la venta neta.');
      neto = neto.plus(n);
      const vistos = new Set<string>();
      for (const carga of venta.cargas!) {
        if (vistos.has(carga.clave))
          return vacio('Hay cargas duplicadas en una misma venta.');
        vistos.add(carga.clave);
        const tasa = importe(carga.porcentaje);
        if (
          tasa.gt(100) ||
          !['NETO', 'BRUTO_COBRADO'].includes(carga.base) ||
          !['COMISION', 'IMPUESTO_INTERNO'].includes(carga.tipo)
        )
          return vacio('Hay una carga comercial inválida.');
        const clave = JSON.stringify(carga);
        const anterior = cargos.get(clave)?.valor ?? new D(0);
        cargos.set(clave, {
          carga,
          valor: anterior.plus(
            (carga.base === 'NETO' ? n : total).times(tasa).div(100),
          ),
        });
      }
    }
    // Acumular antes de redondear: dividir una venta en archivos no cambia la carga.
    const cargas = [...cargos.values()].map(({ carga, valor }) => ({
      ...carga,
      importe: valor.toFixed(input.decimales),
    }));
    const cargosTotal = cargas.reduce((s, c) => s.plus(c.importe), new D(0));
    const utilidad = neto.minus(costo).minus(cargosTotal);
    const porcentaje = neto.gt(0) ? utilidad.div(neto).times(100) : null;
    const p = input.politica;
    let estado: EstadoMargen = 'NO_VERIFICABLE';
    let motivo = 'Configurá el margen mínimo del tarifario.';
    if (p) {
      const minimo = importe(p.minimoPorcentaje);
      if (
        minimo.gte(100) ||
        !['AUTORIZACION', 'BLOQUEO'].includes(p.anteInsuficiente)
      )
        return vacio('La política de margen no es válida.');
      const cumple = porcentaje != null && porcentaje.gte(minimo);
      estado = cumple
        ? 'CUMPLE'
        : p.anteInsuficiente === 'BLOQUEO'
          ? 'BLOQUEADO'
          : 'REQUIERE_AUTORIZACION';
      motivo = cumple
        ? 'Alcanza el margen mínimo.'
        : porcentaje == null
          ? 'Sin venta neta positiva no hay porcentaje de margen verificable.'
          : utilidad.lt(0)
            ? 'La venta deja pérdida.'
            : 'El margen queda por debajo del mínimo.';
    }
    return {
      estado,
      motivo,
      utilidad: utilidad.toFixed(input.decimales),
      porcentaje: porcentaje?.toFixed(2) ?? null,
      negativo: utilidad.lt(0),
      cargasTotal: cargosTotal.toFixed(input.decimales),
      cargas,
    };
  } catch {
    return vacio('Revisá los importes del cálculo de margen.');
  }
}
