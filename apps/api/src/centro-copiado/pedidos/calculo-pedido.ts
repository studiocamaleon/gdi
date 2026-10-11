import { calcularComercialHojas } from '../comercial/calculo-hojas';
import { calcularComercialCad } from '../comercial/calculo-cad';
import { componerPedidoComercial } from '../comercial/composicion-pedido';
import { evaluarMargen, type CargaMargen } from '../comercial/control-margen';
import { DecimalComercial as D } from '../comercial/validaciones';
import type { DocumentoCalculoHojas } from '../comercial/tipos';
import type { DocumentoCalculoCad } from '../comercial/tipos-cad';
import type { ContenidoTarifario } from '../tarifarios/contenido-tarifario';
import type { ReferenciaPoliticaPrecios } from '../tarifarios/politica-precios';

export interface LineaPedidoCopiado {
  id: string;
  documentos: (DocumentoCalculoHojas | DocumentoCalculoCad)[];
  ivaPorcentaje: string;
  costoImpresion: string | null;
  costoTerminaciones: string | null;
  terminacionesNeto: string;
  acuerdoImpresionNeto: string | null;
  cargas: CargaMargen[] | null;
  descuento: { tipo: 'PORCENTAJE' | 'MONTO'; valor: string } | null;
}

/** Reparte dinero redondeado conservando exactamente el total; orden estable. */
export function repartir(total: string, pesos: string[], decimales: number) {
  const suma = pesos.reduce((s, p) => s.plus(p), new D(0));
  let acumulado = new D(0),
    asignado = new D(0);
  return pesos.map((p, i) => {
    acumulado = acumulado.plus(suma.gt(0) ? p : 1);
    const hasta = new D(total)
      .times(acumulado)
      .div(suma.gt(0) ? suma : pesos.length)
      .toDecimalPlaces(decimales);
    const valor =
      i === pesos.length - 1
        ? new D(total).minus(asignado)
        : hasta.minus(asignado);
    asignado = asignado.plus(valor);
    return valor.toFixed(decimales);
  });
}

export function calcularPedidoCopiado(input: {
  referencia: ReferenciaPoliticaPrecios & { modalidad: 'TARIFARIO' };
  contenido: ContenidoTarifario;
  lineas: LineaPedidoCopiado[];
  decimales: number;
  tratamientoFiscal: 'FISCAL' | 'SIN_COMPROBANTE';
}) {
  const {
    referencia: ref,
    contenido: c,
    decimales: dec,
    tratamientoFiscal,
  } = input;
  const lineas = [...input.lineas].sort((a, b) => a.id.localeCompare(b.id));
  const importes = new Map(
    lineas.map((l) => [l.id, new D(0) as InstanceType<typeof D> | null]),
  );
  const grupos: {
    unidad: string;
    cantidad: string;
    desde: string;
    precio: string | null;
  }[] = [];
  const hojas = lineas.flatMap((l) =>
    l.documentos
      .filter((d) => d.modo !== 'CAD')
      .map((d) => ({ id: l.id, doc: d })),
  );
  const cad = lineas.flatMap((l) =>
    l.documentos
      .filter((d) => d.modo === 'CAD')
      .map((d) => ({ id: l.id, doc: d })),
  );
  for (const [docs, matriz] of [
    [hojas, c.hojas],
    [cad, c.cad],
  ] as const) {
    if (!matriz) for (const d of docs) importes.set(d.id, null);
  }
  if (hojas.length && c.hojas) {
    const calculo = calcularComercialHojas(
      {
        tenantId: ref.tenantId,
        pedidoId: 'pedido',
        cargas: lineas
          .map((l) => ({
            id: l.id,
            documentos: l.documentos.filter((d) => d.modo !== 'CAD'),
          }))
          .filter((l) => l.documentos.length),
      },
      { ...ref, ...c.hojas },
    );
    for (const grupo of calculo.grupos) {
      grupos.push({
        unidad: grupo.unidad,
        cantidad: String(grupo.cantidadFacturable),
        desde: String(grupo.tramo.desdeCantidad),
        precio: grupo.precioUnitario,
      });
      for (const p of grupo.partes) {
        const anterior = importes.get(p.referencia.cargaId)!;
        importes.set(
          p.referencia.cargaId,
          anterior === null || p.importeMatriz === null
            ? null
            : anterior.plus(p.importeMatriz),
        );
      }
    }
  }
  if (cad.length && c.cad) {
    const calculo = calcularComercialCad(
      {
        tenantId: ref.tenantId,
        pedidoId: 'pedido',
        cargas: lineas
          .map((l) => ({
            id: l.id,
            documentos: l.documentos.filter((d) => d.modo === 'CAD'),
          }))
          .filter((l) => l.documentos.length),
      },
      { ...ref, ...c.cad },
    );
    for (const grupo of calculo.grupos) {
      grupos.push({
        unidad: 'ML',
        cantidad: grupo.cantidadFacturable,
        desde: grupo.tramo.desdeCantidad,
        precio: grupo.precioUnitario,
      });
      // El redondeo comercial de ML se cobra una sola vez, repartido por consumo.
      for (const p of grupo.partes) {
        const anterior = importes.get(p.referencia.cargaId)!;
        const valor =
          grupo.importeMatriz === null
            ? null
            : new D(grupo.importeMatriz)
                .times(p.consumoMl)
                .div(grupo.cantidadParaTramo);
        importes.set(
          p.referencia.cargaId,
          anterior === null || valor === null ? null : anterior.plus(valor),
        );
      }
    }
  }
  const ajustadas = lineas.map((l) => {
    const factorIva = new D(l.ivaPorcentaje).div(100).plus(1);
    const matriz = importes.get(l.id)!;
    const neto =
      l.acuerdoImpresionNeto !== null
        ? new D(l.acuerdoImpresionNeto)
        : matriz === null
          ? null
          : c.composicion.iva === 'INCLUIDO'
            ? matriz.div(factorIva)
            : matriz;
    const terminacion = new D(l.terminacionesNeto);
    const lista = neto?.plus(terminacion) ?? null;
    const descuento =
      lista === null || !l.descuento
        ? new D(0)
        : D.min(
            lista,
            l.descuento.tipo === 'PORCENTAJE'
              ? lista.times(l.descuento.valor).div(100)
              : new D(l.descuento.valor),
          );
    const factor = lista?.gt(0) ? lista.minus(descuento).div(lista) : new D(1);
    const impresion = neto?.times(factor) ?? null;
    const terminaciones = terminacion.times(factor).toDecimalPlaces(dec);
    return {
      ...l,
      descuentoMonto: descuento.toFixed(dec),
      impresion:
        impresion === null
          ? null
          : (c.composicion.iva === 'INCLUIDO'
              ? impresion.times(factorIva)
              : impresion
            ).toFixed(20),
      terminaciones: {
        neto: terminaciones.toFixed(dec),
        iva: terminaciones.times(factorIva.minus(1)).toFixed(dec),
        total: terminaciones
          .plus(terminaciones.times(factorIva.minus(1)).toDecimalPlaces(dec))
          .toFixed(dec),
      },
    };
  });
  // Preparación y mínimo son servicios de impresión. Una mezcla de alícuotas
  // requiere una política fiscal explícita; nunca se toma arbitrariamente la primera.
  const alicuotas = [...new Set(lineas.map((l) => l.ivaPorcentaje))];
  if (alicuotas.length !== 1)
    throw new Error(
      'La impresión y la preparación necesitan una alícuota fiscal común para este tarifario.',
    );
  const composicion = componerPedidoComercial(
    {
      ...ref,
      pedidoId: 'pedido',
      decimalesPrecio: dec,
      impresion: ajustadas.map((l) => ({
        clave: l.id,
        importeResuelto: l.impresion,
        ivaPorcentaje: l.ivaPorcentaje,
      })),
      preparacion: { ivaPorcentaje: alicuotas[0] },
      ivaAjusteMinimoPorcentaje: alicuotas[0],
      terminaciones: ajustadas.map((l) => ({
        clave: l.id,
        fiscal: l.terminaciones,
      })),
    },
    { ...ref, reglas: c.composicion },
  );
  const pesos = composicion.impresion.map((l) => l.fiscal?.neto ?? '0');
  const adicionalNeto = new D(composicion.preparacion.fiscal?.neto ?? 0)
    .plus(composicion.minimo.fiscal?.neto ?? 0)
    .toFixed(dec);
  const adicionalIva = new D(composicion.preparacion.fiscal?.iva ?? 0)
    .plus(composicion.minimo.fiscal?.iva ?? 0)
    .toFixed(dec);
  const extras = repartir(adicionalNeto, pesos, dec),
    extrasIva = repartir(adicionalIva, pesos, dec);
  const precios = ajustadas.map((l, i) => {
    const fiscal = composicion.impresion[i].fiscal;
    if (!fiscal) return { id: l.id, precio: null };
    const impresionNeto = new D(fiscal.neto).plus(extras[i]);
    const impresionIva = new D(fiscal.iva).plus(extrasIva[i]);
    const neto = impresionNeto.plus(l.terminaciones.neto);
    const iva = impresionIva.plus(l.terminaciones.iva);
    return {
      id: l.id,
      precio: {
        neto: neto.toFixed(dec),
        iva: iva.toFixed(dec),
        total: neto.plus(iva).toFixed(dec),
        impresionNeto: impresionNeto.toFixed(dec),
        impresionTotal: impresionNeto.plus(impresionIva).toFixed(dec),
        terminaciones: l.terminaciones,
        descuentoMonto: l.descuentoMonto,
      },
    };
  });
  const costo = lineas.some((l) => l.costoImpresion === null)
    ? null
    : lineas.reduce((s, l) => s.plus(l.costoImpresion!), new D(0)).toFixed(dec);
  const control = evaluarMargen({
    ventas: precios.flatMap((p, i) =>
      p.precio
        ? [
            {
              neto: p.precio.impresionNeto,
              total:
                tratamientoFiscal === 'SIN_COMPROBANTE'
                  ? p.precio.impresionNeto
                  : p.precio.impresionTotal,
              cargas: lineas[i].cargas,
            },
          ]
        : [],
    ),
    costoProduccion: composicion.estado === 'PRECIO_PENDIENTE' ? null : costo,
    politica: c.margen,
    decimales: dec,
  });
  const terminaciones = lineas.flatMap((l, i) =>
    new D(l.terminacionesNeto).gt(0) || new D(l.costoTerminaciones ?? 0).gt(0)
      ? [
          {
            id: l.id,
            control: evaluarMargen({
              ventas: [
                {
                  ...ajustadas[i].terminaciones,
                  total:
                    tratamientoFiscal === 'SIN_COMPROBANTE'
                      ? ajustadas[i].terminaciones.neto
                      : ajustadas[i].terminaciones.total,
                  cargas: l.cargas,
                },
              ],
              costoProduccion: l.costoTerminaciones,
              politica: {
                minimoPorcentaje: '0',
                anteInsuficiente: c.margen?.anteInsuficiente ?? 'AUTORIZACION',
              },
              decimales: dec,
            }),
          },
        ]
      : [],
  );
  return {
    estado: composicion.estado,
    grupos,
    composicion,
    precios,
    control,
    terminaciones,
    costoImpresion: costo,
  };
}
export type ResultadoPedidoCopiado = ReturnType<typeof calcularPedidoCopiado>;
