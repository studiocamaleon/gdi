import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  leerAsignacionPersonal,
  type AsignacionPersonal,
} from '../produccion/asignacion-personal';
import { simularFlujo, type PasoProgramado } from './motor/flujo-produccion';
import { resolverEstacionDePaso } from './motor/tablero-tipos';

type Entrada = Parameters<typeof simularFlujo>[0];
type Persona = { id: string; nombreCompleto: string; userId: string | null };
type Paso = {
  estado: string;
  iniciadoEl: Date | null;
  mesaUsuarioId: string | null;
  asignacionPersonalJson: unknown;
};

export function construirAsignacion(
  paso: Paso,
  plan: PasoProgramado | undefined,
  empleados: Persona[],
  motivo?: string,
): AsignacionPersonal {
  const anterior = leerAsignacionPersonal(paso.asignacionPersonalJson);
  const fijo =
    !!paso.iniciadoEl || ['en_curso', 'pausado'].includes(paso.estado);
  const manual = paso.mesaUsuarioId
    ? empleados.find((e) => e.userId === paso.mesaUsuarioId)
    : undefined;
  const franjas = (plan?.reservasHumanas ?? [])
    .filter((r) => r.empleadoIds?.length)
    .map((r) => ({
      inicio: new Date(r.inicio).toISOString(),
      fin: new Date(r.fin).toISOString(),
      empleadoIds: [...r.empleadoIds!].sort(),
    }));
  const ids = new Set([
    ...franjas.flatMap((f) => f.empleadoIds),
    ...(fijo ? (anterior?.personas.map((p) => p.empleadoId) ?? []) : []),
    ...(manual ? [manual.id] : []),
  ]);
  const personas = [...ids].sort().flatMap((id) => {
    const e = empleados.find((e) => e.id === id);
    const previa = anterior?.personas.find((p) => p.empleadoId === id);
    return e
      ? [{ empleadoId: id, nombre: e.nombreCompleto, usuarioId: e.userId }]
      : previa
        ? [previa]
        : [];
  });
  return {
    version: 1,
    origen: paso.mesaUsuarioId ? 'manual' : 'automatica',
    personas,
    franjas,
    conflicto: !plan
      ? (motivo ??
        'No se pudo planificar este paso. Revisá sus dependencias y la disponibilidad de recursos.')
      : null,
  };
}

/** Caché de contexto, nunca de permisos. Sólo evita repetir una simulación
 * idéntica dentro del minuto. Cada instancia vuelve a leer datos de su tenant. */
const contextos = new Map<string, string>();

export async function sincronizarAsignaciones(
  prisma: PrismaService,
  tenantId: string,
  leerEntrada: (db: Prisma.TransactionClient) => Promise<Entrada>,
) {
  for (let intento = 0; ; intento++) {
    try {
      const resultado = await prisma.$transaction(
        async (tx) => {
          // La transacción serializable impide publicar un reparto calculado con
          // personal, estaciones o pasos que hayan cambiado durante la corrida.
          const entrada = await leerEntrada(tx);
          const [pasos, empleados] = await Promise.all([
            tx.ordenTrabajoItemPaso.findMany({
              where: {
                tenantId,
                estado: { not: 'hecho' },
                tipoEjecucion: 'interno',
                orden: { estado: { in: ['pendiente', 'produccion'] } },
                item: { contieneLotesEntrega: false },
              },
              select: {
                id: true,
                estado: true,
                iniciadoEl: true,
                mesaUsuarioId: true,
                asignacionPersonalJson: true,
              },
              orderBy: { id: 'asc' },
            }),
            tx.empleado.findMany({
              where: { tenantId },
              select: { id: true, nombreCompleto: true, userId: true },
              orderBy: { id: 'asc' },
            }),
          ]);
          // La hora se redondea sólo para invalidar la caché; el motor usa ahora real.
          const firma = createHash('sha256')
            .update(
              JSON.stringify({
                ...entrada,
                ahora: Math.floor(
                  (entrada.ahora ?? new Date()).getTime() / 60_000,
                ),
                medianas: [...entrada.medianas],
                noLaborables: [...(entrada.noLaborables ?? [])],
                pasos: pasos.map(({ asignacionPersonalJson: _, ...p }) => p),
                empleados,
              }),
            )
            .digest('hex');
          if (contextos.get(tenantId) === firma) return { firma, cambios: 0 };
          const sim = simularFlujo(entrada);
          const planes = new Map(sim.traza.map((p) => [p.pasoId, p]));
          const referencias = new Map(
            entrada.items.flatMap((i) =>
              i.pasos.map((p) => [p.id, { paso: p, item: i }] as const),
            ),
          );
          let cambios = 0;
          for (const paso of pasos) {
            const ref = referencias.get(paso.id);
            if (!ref) continue;
            const estacion = resolverEstacionDePaso(
              entrada.estaciones,
              ref.paso,
            );
            const anterior = leerAsignacionPersonal(
              paso.asignacionPersonalJson,
            );
            // Estaciones anteriores sin personas identificadas conservan su operación.
            if (!estacion?.planificacionPorEmpleados && !anterior) continue;
            const asignacion = construirAsignacion(
              paso,
              planes.get(paso.id),
              empleados,
              !estacion?.activo
                ? 'La estación asignada ya no está disponible.'
                : sim.porItem.get(ref.item.id)?.motivoSinEstimar,
            );
            if (JSON.stringify(anterior) === JSON.stringify(asignacion))
              continue;
            await tx.ordenTrabajoItemPaso.update({
              where: { id: paso.id },
              data: {
                asignacionPersonalJson:
                  asignacion as unknown as Prisma.InputJsonValue,
              },
            });
            cambios++;
          }
          return { firma, cambios };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
        },
      );
      if (contextos.size > 1000) contextos.clear();
      contextos.set(tenantId, resultado.firma);
      return resultado.cambios;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        intento < 2
      )
        continue;
      throw error;
    }
  }
}
