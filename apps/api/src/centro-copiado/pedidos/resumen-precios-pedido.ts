import { calcularComercialHojas } from '../comercial/calculo-hojas';
import { calcularComercialCad } from '../comercial/calculo-cad';
import { DecimalComercial as D } from '../comercial/validaciones';
import type { ContenidoTarifario } from '../tarifarios/contenido-tarifario';
import {
  repartir,
  type LineaPedidoCopiado,
  type ResultadoPedidoCopiado,
} from './calculo-pedido';

export type ResumenPrecioCopiado = {
  papel: string;
  detalle: string;
  unidadPrecio: 'HOJA' | 'ML';
  unidadRango: 'HOJA' | 'CARILLA' | 'ML';
  desde: string;
  hasta: string | null;
  hastaExclusivo: boolean;
  cantidad: string;
  totalImpresion: string | null;
  precioFinal: string | null;
};

/** Sólo presenta el cálculo guardado: nunca consulta costos ni recotiza con el motor.
 * Reconstruye los grupos con la versión original y reparte el importe final ya
 * guardado, incluidos IVA, acuerdos, descuentos y adicionales de impresión.
 * Las terminaciones quedan fuera del valor por hoja/metro.
 */
export function resumirPreciosCopiado(input: {
  tenantId: string;
  contenido: ContenidoTarifario;
  lineas: LineaPedidoCopiado[];
  precios: ResultadoPedidoCopiado['precios'];
  nombresPapeles: Record<string, string>;
  sinComprobante: boolean;
  decimales: number;
}): ResumenPrecioCopiado[] {
  const ref = {
    tenantId: input.tenantId,
    tarifarioId: 'resumen',
    versionId: 'guardada',
  };
  const pedido = { tenantId: input.tenantId, pedidoId: 'guardado' };
  const grupos: {
    fila: ResumenPrecioCopiado;
    partes: { cargaId: string; importe: string; cantidad: string }[];
    total: InstanceType<typeof D>;
    pendiente: boolean;
  }[] = [];
  const papel = (id: string, gramaje: number | null) =>
    `${input.nombresPapeles[id] ?? 'Papel'}${gramaje ? ` · ${gramaje} g` : ''}`;
  const cargasHojas = input.lineas
    .map((l) => ({
      id: l.id,
      documentos: l.documentos.filter((d) => d.modo !== 'CAD'),
    }))
    .filter((l) => l.documentos.length);
  if (input.contenido.hojas && cargasHojas.length) {
    const calculo = calcularComercialHojas(
      { ...pedido, cargas: cargasHojas },
      { ...ref, ...input.contenido.hojas },
    );
    for (const g of calculo.grupos) {
      const c = g.combinacion;
      grupos.push({
        fila: {
          papel: papel(c.papelMateriaPrimaId, c.gramaje),
          detalle: `${c.tamano} · ${c.color === 'COLOR' ? 'Color' : 'B/N'} · ${c.faz === 2 ? 'Doble faz' : 'Simple faz'}${c.cobertura ? ` · ${c.cobertura}` : ''}`,
          unidadPrecio: 'HOJA',
          unidadRango: g.unidad,
          desde: String(g.tramo.desdeCantidad),
          hasta:
            g.tramo.hastaCantidad == null
              ? null
              : String(g.tramo.hastaCantidad),
          hastaExclusivo: false,
          cantidad: String(g.hojasFisicas),
          totalImpresion: null,
          precioFinal: null,
        },
        partes: g.partes.map((p) => ({
          cargaId: p.referencia.cargaId,
          importe: p.importeMatriz ?? '0',
          cantidad: String(p.hojasFisicas),
        })),
        total: new D(0),
        pendiente: g.estado === 'PRECIO_PENDIENTE',
      });
    }
  }
  const cargasCad = input.lineas
    .map((l) => ({
      id: l.id,
      documentos: l.documentos.filter((d) => d.modo === 'CAD'),
    }))
    .filter((l) => l.documentos.length);
  if (input.contenido.cad && cargasCad.length) {
    const calculo = calcularComercialCad(
      { ...pedido, cargas: cargasCad },
      { ...ref, ...input.contenido.cad },
    );
    for (const g of calculo.grupos) {
      const c = g.combinacion;
      grupos.push({
        fila: {
          papel: papel(c.papelMateriaPrimaId, c.gramaje),
          detalle: `Rollo ${c.anchoRolloMm} mm · ${c.color === 'COLOR' ? 'Color' : 'B/N'}${c.cobertura ? ` · ${c.cobertura}` : ''}`,
          unidadPrecio: 'ML',
          unidadRango: 'ML',
          desde: g.tramo.desdeCantidad,
          hasta: g.tramo.hastaCantidadExclusiva,
          hastaExclusivo: true,
          cantidad: g.cantidadFacturable,
          totalImpresion: null,
          precioFinal: null,
        },
        partes: g.partes.map((p) => ({
          cargaId: p.referencia.cargaId,
          importe:
            g.importeMatriz === null
              ? '0'
              : new D(g.importeMatriz)
                  .times(p.consumoMl)
                  .div(g.cantidadParaTramo)
                  .toString(),
          cantidad: p.consumoMl,
        })),
        total: new D(0),
        pendiente: g.estado === 'PRECIO_PENDIENTE',
      });
    }
  }
  for (const linea of input.lineas) {
    const afectados = grupos.filter((g) =>
      g.partes.some((p) => p.cargaId === linea.id),
    );
    const precio = input.precios.find((p) => p.id === linea.id)?.precio;
    if (!precio) {
      afectados.forEach((g) => {
        g.pendiente = true;
      });
      continue;
    }
    let pesos = afectados.map((g) =>
      g.partes
        .filter((p) => p.cargaId === linea.id)
        .reduce((s, p) => s.plus(p.importe), new D(0))
        .toString(),
    );
    if (pesos.every((p) => new D(p).isZero()))
      pesos = afectados.map((g) =>
        g.partes
          .filter((p) => p.cargaId === linea.id)
          .reduce((s, p) => s.plus(p.cantidad), new D(0))
          .toString(),
      );
    const importes = repartir(
      input.sinComprobante ? precio.impresionNeto : precio.impresionTotal,
      pesos,
      input.decimales,
    );
    afectados.forEach((g, i) => {
      g.total = g.total.plus(importes[i]);
    });
  }
  return grupos.map((g) => ({
    ...g.fila,
    totalImpresion: g.pendiente ? null : g.total.toFixed(input.decimales),
    precioFinal:
      g.pendiente || !new D(g.fila.cantidad).gt(0)
        ? null
        : g.total.div(g.fila.cantidad).toFixed(8),
  }));
}
