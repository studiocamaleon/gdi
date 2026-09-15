import { createHash } from 'node:crypto';
import {
  fijarPlanReferencia,
  leerPlanReferencia,
} from '../produccion/plan-referencia-paso';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  leerAsignacionPersonal,
  type AsignacionPersonal,
} from '../produccion/asignacion-personal';
import { simularFlujo, type PasoProgramado } from './motor/flujo-produccion';
import { resolverEstacionDePaso } from './motor/tablero-tipos';
import { leerAsignacionManual } from '../produccion/asignacion-manual';

type Entrada = Parameters<typeof simularFlujo>[0];
type Persona = { id: string; nombreCompleto: string; userId: string | null };
type Paso = {
  estado: string;
  iniciadoEl: Date | null;
  mesaUsuarioId: string | null;
  asignacionPersonalJson: unknown;
  asignacionManualJson?: unknown;
};

export function construirAsignacion(
  paso: Paso,
  plan: PasoProgramado | undefined,
  empleados: Persona[],
  motivo?: string,
): AsignacionPersonal {
  const anterior = leerAsignacionPersonal(paso.asignacionPersonalJson);
  const eleccion = leerAsignacionManual(paso.asignacionManualJson);
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
    ...(eleccion?.empleadoIds ?? []),
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
  const planIds = new Set(franjas.flatMap((f) => f.empleadoIds));
  const manualSinCobertura =
    eleccion &&
    !fijo &&
    (eleccion.empleadoIds.length !== planIds.size ||
      eleccion.empleadoIds.some((id) => !planIds.has(id)));
  return {
    version: 1,
    origen: eleccion || paso.mesaUsuarioId ? 'manual' : 'automatica',
    personas,
    franjas,
    conflicto: !plan
      ? (motivo ??
        'No se pudo planificar este paso. Revisá sus dependencias y la disponibilidad de recursos.')
      : manualSinCobertura
        ? 'La dotación elegida ya no tiene cobertura en la estación. Revisá su configuración y la asignación.'
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
                orden: { estado: { in: ['pendiente', 'produccion'] } },
                item: { contieneLotesEntrega: false },
              },
              select: {
                id: true,
                estado: true,
                iniciadoEl: true,
                mesaUsuarioId: true,
                asignacionPersonalJson: true,
                asignacionManualJson: true,
                planReferenciaJson: true,
                planificadoDesde: true,
                planificadoHasta: true,
                tipoEjecucion: true,
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
                pasos: pasos.map(
                  ({
                    asignacionPersonalJson: _,
                    planReferenciaJson: _referencia,
                    ...p
                  }) => p,
                ),
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
            const plan = planes.get(paso.id);
            const referenciaAnterior = leerPlanReferencia(
              paso.planReferenciaJson,
            );
            // Guardar el fin de la operación, no el fin de su separación/atención.
            const aceptado =
              paso.planificadoDesde && paso.planificadoHasta
                ? { inicio: paso.planificadoDesde, fin: paso.planificadoHasta }
                : null;
            const referencia =
              referenciaAnterior ??
              (aceptado || plan
                ? fijarPlanReferencia(
                    null,
                    aceptado ?? plan!,
                    aceptado ? 'plan_aceptado' : 'automatico',
                    entrada.ahora,
                  )
                : null);
            const data: Prisma.OrdenTrabajoItemPasoUpdateInput = {};
            if (referencia && !referenciaAnterior)
              data.planReferenciaJson =
                referencia as unknown as Prisma.InputJsonValue;
            // La referencia también cubre pasos tercerizados o estaciones del modo anterior.
            if (
              paso.tipoEjecucion === 'interno' &&
              (estacion?.planificacionPorEmpleados || anterior)
            ) {
              const asignacion = construirAsignacion(
                paso,
                plan,
                empleados,
                !estacion?.activo
                  ? 'La estación asignada ya no está disponible.'
                  : sim.porItem.get(ref.item.id)?.motivoSinEstimar,
              );
              if (JSON.stringify(anterior) !== JSON.stringify(asignacion))
                data.asignacionPersonalJson =
                  asignacion as unknown as Prisma.InputJsonValue;
            }
            if (!Object.keys(data).length) continue;
            await tx.ordenTrabajoItemPaso.update({
              where: { id: paso.id, tenantId },
              data,
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
