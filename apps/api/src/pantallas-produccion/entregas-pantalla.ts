import { Prisma } from '@prisma/client';

// Lista explícita: la TV nunca recibe precios, márgenes, archivos ni contactos.
export const seleccionOrdenPantalla =
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
          select: { nombre: true, estado: true, indice: true },
          orderBy: { indice: 'asc' },
        },
      },
    },
  });
type OrdenPantalla = Prisma.OrdenTrabajoGetPayload<{
  select: typeof seleccionOrdenPantalla;
}>;

export function diaEnZona(fecha: Date, zona: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

export function entregasParaPantalla(ordenes: OrdenPantalla[], hoy: string) {
  const filas = ordenes
    .flatMap((orden) => {
      const hijos = new Map<string, OrdenPantalla['items']>();
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
          (item.parentItemId && !item.loteEntregaId)
        )
          return [];
        // @db.Date representa una fecha civil: no convertirla a la zona local.
        const fecha = (item.fechaEntrega ?? orden.fechaEntrega)
          ?.toISOString()
          .slice(0, 10);
        if (!fecha || fecha > hoy) return [];
        const pendientes = [item];
        const vistos = new Set<string>();
        const pasos: OrdenPantalla['items'][number]['pasos'] = [];
        while (pendientes.length) {
          const actual = pendientes.pop()!;
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
        const bloqueado = pasos.find((p) => p.estado === 'bloqueado');
        const enCurso = pasos.filter((p) => p.estado === 'en_curso');
        const pausado = pasos.find((p) => p.estado === 'pausado');
        const siguiente = pasos.find((p) => p.estado !== 'hecho');
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
          ? 'Lista para entregar'
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
            orden: orden.numero,
            cliente: orden.cliente?.nombre ?? 'Cliente de mostrador',
            producto: item.nombre,
            cantidad: Number(item.cantidad),
            unidad: item.cantidadUnidad,
            fecha,
            atrasada: fecha < hoy,
            estado,
            etapa,
            pasosHechos: hechos,
            pasosTotal: pasos.length,
          },
        ];
      });
    })
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.orden.localeCompare(b.orden, 'es', { numeric: true }) ||
        a.id.localeCompare(b.id),
    );
  return {
    filas,
    resumen: {
      atrasadas: filas.filter((f) => f.atrasada).length,
      hoy: filas.filter((f) => !f.atrasada).length,
      listas: filas.filter((f) => f.estado === 'lista').length,
    },
  };
}
