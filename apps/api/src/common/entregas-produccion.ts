import { Prisma } from '@prisma/client';
import { calcularProgreso } from './progreso-produccion';

// Proyección compartida de Panel y TV, sin importes, archivos ni contactos.
export const seleccionEntregasProduccion =
  Prisma.validator<Prisma.OrdenTrabajoSelect>()({
    id: true,
    numero: true,
    estado: true,
    fechaEntrega: true,
    cliente: { select: { nombre: true } },
    items: {
      select: {
        id: true,
        parentItemId: true,
        contieneLotesEntrega: true,
        loteEntregaId: true,
        nombre: true,
        cantidad: true,
        cantidadUnidad: true,
        fechaEntrega: true,
        entregadoEl: true,
        listoEnMostrador: true,
        pasos: {
          select: {
            nombre: true,
            estado: true,
            indice: true,
            centroCostoNombre: true,
            duracionEstimadaMin: true,
            nestingLoteRol: true,
          },
          orderBy: { indice: 'asc' },
        },
      },
    },
  });
export type OrdenEntregas = Prisma.OrdenTrabajoGetPayload<{
  select: typeof seleccionEntregasProduccion;
}>;

export type RiesgoEntrega =
  | 'atrasada'
  | 'hoy'
  | 'proxima'
  | 'lista'
  | 'sin_fecha';
const ESTADOS_ACTIVOS = ['pendiente', 'produccion', 'finalizada'];

export function filtroOrdenesEntregas(
  tenantId: string,
  alcance: Prisma.OrdenTrabajoWhereInput = {},
  hasta?: string,
): Prisma.OrdenTrabajoWhereInput {
  // Un producto puede tener una fecha distinta a la OT. Lo terminado espera
  // retiro incluso sin fecha o fuera de la ventana de próximas entregas.
  const fecha = hasta ? new Date(`${hasta}T00:00:00.000Z`) : null;
  return {
    ...alcance,
    tenantId,
    estado: { in: ESTADOS_ACTIVOS },
    ...(fecha
      ? {
          AND: [
            alcance,
            {
              OR: [
                { fechaEntrega: { lte: fecha } },
                { items: { some: { tenantId, fechaEntrega: { lte: fecha } } } },
              ],
            },
          ],
        }
      : {}),
  };
}

/** Una fila por producto o lote entregable, nunca por componente interno.
 * Clasificación de sólo lectura compartida por los contadores y las listas. */
export function clasificarEntregasProduccion(
  ordenes: OrdenEntregas[],
  hoy: string,
) {
  return ordenes
    .flatMap((orden) => {
      if (!ESTADOS_ACTIVOS.includes(orden.estado)) return [];
      const porId = new Map(orden.items.map((item) => [item.id, item]));
      const hijos = new Map<string, OrdenEntregas['items']>();
      for (const item of orden.items) {
        if (item.parentItemId)
          hijos.set(item.parentItemId, [
            ...(hijos.get(item.parentItemId) ?? []),
            item,
          ]);
      }
      return orden.items.flatMap((item) => {
        if (
          item.entregadoEl ||
          item.contieneLotesEntrega ||
          // Los componentes heredan loteEntregaId. Sólo la raíz del lote,
          // hija del agrupador comercial, constituye otra entrega.
          (item.parentItemId &&
            (!item.loteEntregaId ||
              !porId.get(item.parentItemId)?.contieneLotesEntrega))
        )
          return [];
        // @db.Date representa una fecha civil: no convertirla a la zona local.
        const fecha =
          (item.fechaEntrega ?? orden.fechaEntrega)
            ?.toISOString()
            .slice(0, 10) ?? null;
        const pendientes = [item];
        const vistos = new Set<string>();
        const pasos: OrdenEntregas['items'][number]['pasos'] = [];
        while (pendientes.length) {
          const actual = pendientes.shift()!;
          if (vistos.has(actual.id)) continue;
          vistos.add(actual.id);
          pasos.push(...actual.pasos);
          pendientes.push(...(hijos.get(actual.id) ?? []));
        }
        const hechos = pasos.filter((p) => p.estado === 'hecho').length;
        const lista =
          item.listoEnMostrador ||
          orden.estado === 'finalizada' ||
          (pasos.length > 0 && hechos === pasos.length);
        // Las participaciones no suman avance, pero sí deben recibir el cierre
        // del lote antes de considerar terminado el producto.
        const riesgo: RiesgoEntrega = lista
          ? 'lista'
          : !fecha
            ? 'sin_fecha'
            : fecha < hoy
              ? 'atrasada'
              : fecha === hoy
                ? 'hoy'
                : 'proxima';
        const bloqueado = pasos.find((p) => p.estado === 'bloqueado');
        const enCurso = pasos.filter((p) => p.estado === 'en_curso');
        const pausado = pasos.find((p) => p.estado === 'pausado');
        const siguiente = pasos.find((p) => p.estado !== 'hecho');
        const actual = bloqueado ?? enCurso[0] ?? pausado ?? siguiente;
        const estado = lista
          ? 'lista'
          : bloqueado
            ? 'bloqueada'
            : enCurso.length
              ? 'en_curso'
              : pausado
                ? 'pausada'
                : 'pendiente';
        const etapa = lista
          ? 'Lista para retirar'
          : bloqueado
            ? `Bloqueada · ${bloqueado.nombre}`
            : enCurso.length
              ? enCurso.map((p) => p.nombre).join(' · ')
              : pausado
                ? `En pausa · ${pausado.nombre}`
                : siguiente
                  ? `Pendiente · ${siguiente.nombre}`
                  : 'Sin pasos de producción';
        return [
          {
            id: item.id,
            ordenId: orden.id,
            orden: orden.numero,
            cliente: orden.cliente?.nombre ?? 'Cliente de mostrador',
            producto: item.nombre,
            cantidad: Number(item.cantidad),
            unidad: item.cantidadUnidad,
            fecha,
            riesgo,
            estado,
            etapa,
            pasoActual: actual?.nombre ?? null,
            estacionActual: actual?.centroCostoNombre ?? null,
            pasos,
            progreso: calcularProgreso(pasos),
          },
        ];
      });
    })
    .sort(
      (a, b) =>
        (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') ||
        a.orden.localeCompare(b.orden, 'es', { numeric: true }) ||
        a.id.localeCompare(b.id),
    );
}
