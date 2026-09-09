import type { ProcesamientoCorteCosteado } from '../maquinaria/procesamiento-corte';
import type { MaterialEjecutado, PasoEjecutado } from './tipos';

const r = (n: number) => Math.round(n * 1e8) / 1e8;
function distribuir(total: number, pesos: number[]) {
  const suma = pesos.reduce((a, b) => a + b, 0);
  let asignado = 0;
  return pesos.map((p, i) => {
    const valor =
      i === pesos.length - 1 ? r(total - asignado) : r((total * p) / suma);
    asignado += valor;
    return valor;
  });
}
export function lineasDesgasteCorte(
  snapshot: ProcesamientoCorteCosteado,
  proporcion = 1,
): MaterialEjecutado[] {
  return snapshot.operaciones
    .filter((o) => o.desgasteCosto > 0)
    .map((o) => ({
      slotCodigo: `desgaste_herramienta_${o.herramienta.id}_${o.operacion}`,
      slotNombre: `Desgaste · ${o.herramienta.nombre}`,
      slotRol: 'DESGASTE',
      materialVarianteId: '',
      materialNombre: o.herramienta.nombre,
      materialSku: '',
      materialDisplayName: o.herramienta.nombre,
      tipoLineaCosto: 'DESGASTE_MAQUINA',
      estrategiaCosto: 'uso_herramienta',
      modoSeleccion: 'MAQUINA_DESGASTE',
      cantidad:
        (o.herramienta.desgaste.modo === 'POR_METRO'
          ? o.metrosProcesados
          : o.recorridoMin / 60) * proporcion,
      unidad: o.herramienta.desgaste.modo === 'POR_METRO' ? 'm' : 'h',
      precioUnitario:
        o.herramienta.desgaste.costoReposicion! /
        o.herramienta.desgaste.vidaUtil!,
      costoTotal: o.desgasteCosto * proporcion,
    }));
}
/** Cotiza la tanda una vez y distribuye con el mismo criterio físico del lote.
 * El redondeo se aplica al trabajo completo, nunca a cada capa o participante. */
export function planificarRepartoCorte(
  snapshot: ProcesamientoCorteCosteado,
  pasos: PasoEjecutado[],
  pesos: number[],
  loteId?: string,
) {
  const setup = Math.max(...pasos.map((p) => p.tiempo!.setupMin));
  const cleanup = Math.max(...pasos.map((p) => p.tiempo!.cleanupMin));
  const fijo = pasos.reduce((s, p) => s + p.tiempo!.tiempoFijoMin, 0);
  const crudo = setup + cleanup + snapshot.runMin + fijo;
  const trabajo = snapshot.redondeo === 'EXACTO' ? crudo : Math.ceil(r(crudo));
  const tarifa = pasos[0].tiempo!.tarifaHora ?? 0;
  const totalPesos = pesos.reduce((a, b) => a + b, 0);
  if (
    !(totalPesos > 0) ||
    pasos.length !== pesos.length ||
    pasos.some(
      (p) =>
        !p.tiempo ||
        p.tiempo.tarifaHora !== tarifa ||
        p.cargosDirectosPaso?.length,
    )
  )
    throw new Error(
      'No se puede distribuir esta tanda con tarifas o cargos diferentes.',
    );
  const setups = distribuir(setup, pesos),
    cleanups = distribuir(cleanup, pesos),
    runs = distribuir(snapshot.runMin, pesos);
  const fijos = distribuir(fijo, pesos),
    trabajos = distribuir(trabajo, pesos),
    costos = distribuir((trabajo / 60) * tarifa, pesos);
  return pasos.map((p, i) => {
    const proporcion = pesos[i] / totalPesos;
    const materiales = lineasDesgasteCorte(snapshot, proporcion);
    const tiempo: NonNullable<PasoEjecutado['tiempo']> = {
      ...p.tiempo!,
      setupMin: setups[i],
      cleanupMin: cleanups[i],
      runMin: runs[i],
      tiempoFijoMin: fijos[i],
      totalMin: trabajos[i] + (p.tiempo!.extraMin ?? 0),
      costo: costos[i],
      procesamientoCorte: {
        ...snapshot,
        ...(loteId
          ? {
              participacion: {
                loteId,
                porcentaje: proporcion * 100,
                runAsignadoMin: runs[i],
                desgasteAsignadoCosto: snapshot.desgasteCosto * proporcion,
              },
            }
          : {}),
      },
    };
    return { tiempo, materiales };
  });
}
export function aplicarRepartoCorte(
  paso: PasoEjecutado,
  reparto: ReturnType<typeof planificarRepartoCorte>[number],
) {
  const desgasteAnterior = (paso.materiales ?? [])
    .filter((m) => m.estrategiaCosto === 'uso_herramienta')
    .reduce((s, m) => s + m.costoTotal, 0);
  const diferencia =
    reparto.tiempo.costo -
    paso.tiempo!.costo +
    reparto.materiales.reduce((s, m) => s + m.costoTotal, 0) -
    desgasteAnterior;
  paso.tiempo = reparto.tiempo;
  paso.materiales = [
    ...(paso.materiales ?? []).filter(
      (m) => m.estrategiaCosto !== 'uso_herramienta',
    ),
    ...reparto.materiales,
  ];
  return diferencia;
}
