import type { ContenidoTarifario } from '../tarifarios/contenido-tarifario';
import type { EscenarioSimulado } from '../tarifarios/simulacion-tarifario.types';
import { DecimalComercial } from './validaciones';
import { evaluarMargen } from './control-margen';
import { componerPedidoComercial } from './composicion-pedido';

/** Comparación orientativa, compartida con el editor. Nunca autoriza una venta.
 * Reutiliza la composición de pedidos: preparación/mínimo una vez, IVA separado.
 */
export function compararSimulacion(
  contenido: ContenidoTarifario,
  seccion: 'hojas' | 'cad',
  escenario: EscenarioSimulado,
  precioReferencia?: string,
) {
  if (precioReferencia !== undefined && escenario.grupos.length !== 1)
    throw new Error(
      'Una propuesta de precio necesita una referencia de una sola celda.',
    );
  const referencia = {
    tenantId: 'simulacion',
    tarifarioId: 'simulacion',
    versionId: 'referencia',
    monedaCodigo: contenido.monedaCodigo,
  };
  const impresion = escenario.grupos.map((grupo, i) => {
    const fila = contenido[seccion]?.filas[grupo.fila];
    const precio =
      precioReferencia ??
      fila?.precios.find((p) =>
        new DecimalComercial(p.desdeCantidad).eq(grupo.desdeCantidad),
      )?.precioUnitario;
    if (precio != null && !/^\d{1,18}(\.\d{1,8})?$/.test(precio))
      throw new Error('Revisá el precio antes de comparar.');
    return {
      clave: String(i),
      importeResuelto:
        precio == null
          ? null
          : new DecimalComercial(precio)
              .times(grupo.cantidadFacturable)
              .toFixed(),
      ivaPorcentaje: escenario.ivaPorcentaje,
    };
  });
  const composicion = componerPedidoComercial(
    {
      ...referencia,
      pedidoId: 'referencia',
      decimalesPrecio: escenario.decimalesPrecio,
      impresion,
      preparacion: { ivaPorcentaje: escenario.ivaPorcentaje },
      ivaAjusteMinimoPorcentaje: escenario.ivaPorcentaje,
      terminaciones: [],
    },
    { ...referencia, reglas: contenido.composicion },
  );
  const control = evaluarMargen({
    ventas: composicion.total
      ? [
          {
            neto: composicion.total.neto,
            total: composicion.total.total,
            cargas: escenario.comercial?.cargas ?? null,
          },
        ]
      : [],
    costoProduccion: escenario.costoVariableTotal ?? escenario.costoTotal,
    metrica: 'CONTRIBUCION',
    politica: contenido.margen,
    decimales: escenario.decimalesPrecio,
  });
  return {
    composicion,
    control,
    utilidad: control.utilidad,
    margenPorcentaje: control.porcentaje,
    costoSuperaVenta: control.negativo,
  };
}
