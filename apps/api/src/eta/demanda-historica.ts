import { Prisma } from '@prisma/client';
import { demandaDesdeTiempo, type DemandaHumana } from './motor/demanda-humana';
import { primitivasDeFamilia } from '../productos-servicios/pasos/familias';

type Registro = Record<string, unknown>;
const registro = (v: unknown): Registro =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Registro) : {};
export type PasoHistorico = {
  rutaPasoId: string | null;
  maquinaId: string | null;
  familiaCodigo: string;
  duracionEstimadaMin: number;
  nestingLoteRol?: string | null;
};

/** Recorre sólo pasos y componentes, nunca geometrías ni layouts comprimidos. */
function tiemposDeRuta(traza: unknown, ruta: string): Registro[] {
  const pendientes = [registro(traza)],
    tiempos: Registro[] = [];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    if (Array.isArray(actual.pasos))
      for (const valor of actual.pasos) {
        const paso = registro(valor);
        if (paso.rutaPasoId === ruta && paso.tiempo)
          tiempos.push(registro(paso.tiempo));
      }
    for (const clave of ['componentesFabricados', 'componentes'])
      if (Array.isArray(actual[clave]))
        pendientes.push(...actual[clave].map(registro));
  }
  return tiempos;
}

/** Usa únicamente la cotización congelada del ámbito ejecutable. No consulta
 * velocidades actuales ni cambia totales. Las maniobras agregadas se conservan
 * atendidas si el histórico no permite separar sus recargas. */
export function demandaHistorica(
  paso: PasoHistorico,
  traza: unknown,
): DemandaHumana | null {
  if (!paso.rutaPasoId || paso.nestingLoteRol) return null;
  const encontrados = tiemposDeRuta(traza, paso.rutaPasoId).filter(
    (t) =>
      (t.maquinaId ?? null) === paso.maquinaId &&
      typeof t.totalMin === 'number' &&
      Math.abs(t.totalMin - paso.duracionEstimadaMin) <= 0.01,
  );
  const tiempos = [
    ...new Map(encontrados.map((t) => [JSON.stringify(t), t])).values(),
  ];
  if (tiempos.length !== 1) return null;
  const t = tiempos[0];
  const dotacion =
    Number.isInteger(t.dotacionOperarios) &&
    Number(t.dotacionOperarios) >= 1 &&
    Number(t.dotacionOperarios) <= 99
      ? Number(t.dotacionOperarios)
      : undefined;
  if (
    paso.maquinaId &&
    primitivasDeFamilia(paso.familiaCodigo)?.tiempoRun &&
    !Array.isArray(t.fasesRun)
  ) {
    // Una guillotina histórica puede tener corte y recargas dentro de RUN.
    const d = demandaDesdeTiempo({
      ...t,
      fasesRun: [{ minutos: t.runMin, operario: true }],
    });
    return (
      d && {
        ...d,
        verificada: false,
        ...(dotacion != null ? { dotacionOperarios: dotacion } : {}),
      }
    );
  }
  return demandaDesdeTiempo(t);
}

/** Backfill acotado e idempotente: fases ausentes y recuperaciones antiguas
 * sin verificar de pasos internos vivos. Las revisiones ya tratadas se omiten.
 * Se guarda el resultado una vez; las siguientes lecturas no cargan snapshots.
 * El compare-and-set evita pisar una recotización o una corrección concurrente. */
export async function recuperarDemandasHistoricas(
  db: Prisma.TransactionClient,
  tenantId: string,
  candidatos: Array<{
    id: string;
    demandaHumanaJson?: unknown;
    tipoEjecucion?: string;
    estado?: string;
  }>,
  persistir = true,
): Promise<Map<string, DemandaHumana>> {
  const necesitaRecuperar = (value: unknown) =>
    value == null ||
    (registro(value).verificada === false &&
      registro(value).revisionOperacion !== 1);
  const ids = candidatos
    .filter(
      (p) =>
        necesitaRecuperar(p.demandaHumanaJson) &&
        p.tipoEjecucion !== 'tercerizado' &&
        p.estado !== 'hecho',
    )
    .map((p) => p.id);
  const resultado = new Map<string, DemandaHumana>();
  for (let inicio = 0; inicio < ids.length; inicio += 80) {
    const pasos = await db.ordenTrabajoItemPaso.findMany({
      where: {
        tenantId,
        id: { in: ids.slice(inicio, inicio + 80) },
        duracionEstimadaMin: { not: null },
        item: { orden: { estado: { in: ['pendiente', 'produccion'] } } },
      },
      select: {
        id: true,
        itemId: true,
        rutaPasoId: true,
        maquinaId: true,
        familiaCodigo: true,
        duracionEstimadaMin: true,
        nestingLoteRol: true,
        demandaHumanaJson: true,
      },
    });
    if (!pasos.length) continue;
    const fuentes = await db.ordenTrabajoItem.findMany({
      where: { tenantId, id: { in: [...new Set(pasos.map((p) => p.itemId))] } },
      select: {
        id: true,
        parentItemId: true,
        trazabilidadSnapshotJson: true,
        cotizacionItem: { select: { trazabilidadJson: true } },
      },
    });
    const padreIds = fuentes
      .filter(
        (i) =>
          !i.trazabilidadSnapshotJson &&
          !i.cotizacionItem?.trazabilidadJson &&
          i.parentItemId,
      )
      .map((i) => i.parentItemId!);
    const padres = padreIds.length
      ? await db.ordenTrabajoItem.findMany({
          where: { tenantId, id: { in: [...new Set(padreIds)] } },
          select: {
            id: true,
            trazabilidadSnapshotJson: true,
            cotizacionItem: { select: { trazabilidadJson: true } },
          },
        })
      : [];
    const porPadre = new Map(
      padres.map((i) => [
        i.id,
        i.trazabilidadSnapshotJson ?? i.cotizacionItem?.trazabilidadJson,
      ]),
    );
    const porItem = new Map(
      fuentes.map((i) => [
        i.id,
        i.trazabilidadSnapshotJson ??
          i.cotizacionItem?.trazabilidadJson ??
          porPadre.get(i.parentItemId ?? ''),
      ]),
    );
    for (const paso of pasos) {
      if (!necesitaRecuperar(paso.demandaHumanaJson)) continue;
      const total = Number(paso.duracionEstimadaMin);
      if (!Number.isFinite(total) || total < 0) continue;
      const demanda = demandaHistorica(
        { ...paso, duracionEstimadaMin: total },
        porItem.get(paso.itemId),
      ) ?? {
        version: 1 as const,
        verificada: false,
        fases: total > 0 ? [{ minutos: total, personas: 1 }] : [],
      };
      demanda.revisionOperacion = 1;
      // Las consultas de ETA deben recuperar la misma información sin
      // modificar pasos ni realizar un backfill fuera de una escritura admitida.
      if (!persistir) {
        resultado.set(paso.id, demanda);
        continue;
      }
      const actualizado = await db.ordenTrabajoItemPaso.updateMany({
        where: {
          tenantId,
          id: paso.id,
          demandaHumanaJson: {
            equals: paso.demandaHumanaJson ?? Prisma.AnyNull,
          },
          duracionEstimadaMin: paso.duracionEstimadaMin,
          maquinaId: paso.maquinaId,
          rutaPasoId: paso.rutaPasoId,
          estado: { not: 'hecho' },
        },
        data: {
          demandaHumanaJson: demanda as unknown as Prisma.InputJsonValue,
        },
      });
      if (actualizado.count) resultado.set(paso.id, demanda);
    }
  }
  return resultado;
}
