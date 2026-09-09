import { createHash } from 'node:crypto';
import type { CotizarInput, CotizarOutput } from '../../motor-universal/tipos';
import type { CompromisoPiloto } from './prototipo-entregas';
import type { FuenteCotizacionF6 } from './adaptador-cotizacion';

/** Cantidades que consumen los seis candidatos del piloto. Primero el total
 * de referencia, después cantidades repetidas una sola vez. */
export function cantidadesParaPlanificar(
  cantidad: number,
  entregas: CompromisoPiloto[],
) {
  if (
    !Number.isSafeInteger(cantidad) ||
    cantidad <= 0 ||
    !entregas.length ||
    entregas.length > 50 ||
    entregas.some(
      (e) => !Number.isSafeInteger(e.cantidad) || e.cantidad <= 0,
    ) ||
    entregas.reduce((s, e) => s + e.cantidad, 0) !== cantidad
  )
    throw new Error(
      'Las entregas deben sumar la cantidad entera del producto.',
    );
  const pares: number[] = [];
  entregas.forEach((e, i) => {
    pares[Math.floor(i / 2)] = (pares[Math.floor(i / 2)] ?? 0) + e.cantidad;
  });
  return [
    ...new Set(
      [
        cantidad,
        ...entregas.map((e) => e.cantidad),
        ...pares,
        cantidad - entregas[0].cantidad,
      ].filter((q) => q > 0),
    ),
  ];
}

/** Orquestador interno para servidor/worker externo al trabajo de cotización.
 * El proveedor debe usar cotizar (o su cola), nunca cotizarYGuardar.
 * No presupone linealidad, no ejecuta seis cotizaciones por cada alternativa,
 * no mantiene una caché de tarifas. Cancelación entre solicitudes; el proveedor
 * puede usar la misma señal para cancelar su espera de un cálculo en curso.
 */
export async function obtenerCotizacionesF6(options: {
  input: CotizarInput;
  entregas: CompromisoPiloto[];
  cotizar: (
    input: CotizarInput,
    signal?: AbortSignal,
  ) => Promise<CotizarOutput>;
  signal?: AbortSignal;
  maxCotizaciones?: number;
}): Promise<FuenteCotizacionF6[]> {
  const { input, signal } = options;
  const cantidades = cantidadesParaPlanificar(
    Number(input.jobContext.cantidad),
    options.entregas,
  );
  const limite = options.maxCotizaciones ?? 12;
  if (
    !Number.isSafeInteger(limite) ||
    limite < 1 ||
    limite > 102 ||
    cantidades.length > limite
  )
    throw new Error(
      'La distribución excede el presupuesto de cálculos de esta simulación.',
    );
  const configuracionId = createHash('sha256')
    .update(
      JSON.stringify(input, (k, v: unknown) =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? Object.fromEntries(
              Object.entries(v)
                .filter(([key]) => !(k === 'jobContext' && key === 'cantidad'))
                .sort(([a], [b]) => a.localeCompare(b)),
            )
          : v,
      ),
    )
    .digest('hex');
  const fuentes: FuenteCotizacionF6[] = [];
  for (const cantidad of cantidades) {
    signal?.throwIfAborted();
    const solicitud = {
      ...input,
      jobContext: { ...input.jobContext, cantidad },
    };
    const resultado = await options.cotizar(solicitud, signal);
    signal?.throwIfAborted();
    if (!resultado.exitoso || !resultado.cotizacion)
      throw new Error(
        `No se pudo calcular la tanda de ${cantidad}: ${resultado.errores.map((e) => e.mensaje).join(' · ')}`,
      );
    if (
      resultado.cotizacion.productoId !== input.productoId ||
      (input.rutaAlternativaId &&
        resultado.cotizacion.rutaAlternativaId !== input.rutaAlternativaId) ||
      resultado.cotizacion.cantidadPedida !== cantidad
    )
      throw new Error(
        'La cotización recibida no corresponde a la cantidad, producto o flujo solicitado.',
      );
    fuentes.push({
      tenantId: input.tenantId,
      configuracionId,
      id: resultado.metadata?.quoteRunId ?? `${configuracionId}:${cantidad}`,
      cotizacion: resultado.cotizacion,
    });
  }
  return fuentes;
}
