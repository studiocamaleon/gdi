import { leerAsignacionPersonal, proyectarAsignacionPersonal } from '../asignacion-personal';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import { sumaTramosMin } from '../../ordenes-trabajo/tiempos-ejecucion';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { leerAprobacionesPendientes } from '../aprobaciones-pendientes';
import { fronterasEjecutablesDAG } from '../../ordenes-trabajo/fronteras-ejecutables';
import {
  contextoLoteTablero,
  loteTableroSelect,
} from '../../ordenes-trabajo/tablero-contexto-lote';
import {
  leerConfiguracionesCola,
  configurarFilaCola,
} from './configuracion-cola';
import type { ConsultaColaDto } from './consulta-cola.dto';

const activos = (tenantId: string): Prisma.OrdenTrabajoItemPasoWhereInput => ({
  tenantId,
  tipoEjecucion: 'interno',
  estado: { not: 'hecho' },
  OR: [{ nestingLoteRol: null }, { nestingLoteRol: { not: 'PARTICIPANTE' } }],
  orden: { tenantId, estado: { in: ['pendiente', 'produccion'] } },
  item: { tenantId, contieneLotesEntrega: false },
});

const maquinaSelect = {
  id: true,
  nombre: true,
  codigo: true,
  activo: true,
  estacion: { select: { id: true, nombre: true, activo: true } },
} satisfies Prisma.MaquinaSelect;

export const pasoColaSelect = {
  id: true,
  familiaCodigo: true,
  itemId: true,
  ordenId: true,
  maquinaId: true,
  nombre: true,
  indice: true,
  nodoClave: true,
  modoRegistro: true,
  tipoEjecucion: true,
  mesaUsuarioId: true,
  asignacionPersonalJson: true,
  tramos: {
    select: {
      inicioEl: true,
      finEl: true,
      usuarioId: true,
      usuarioNombre: true,
    },
  },
  estado: true,
  motivoBloqueo: true,
  duracionEstimadaMin: true,
  iniciadoPorNombre: true,
  mesaUsuario: { select: { nombreCompleto: true, email: true } },
  gatesOperativos: { select: { tipo: true, estado: true, detalle: true } },
  dependenciasEntrantes: {
    where: { obligatoria: true },
    select: {
      predecesorPasoId: true,
      predecesor: {
        select: {
          id: true,
          estado: true,
          nombre: true,
          indice: true,
          nodoClave: true,
        },
      },
    },
  },
  item: {
    select: {
      id: true,
      nombre: true,
      parentItemId: true,
      cantidad: true,
      cantidadUnidad: true,
      fechaEntrega: true,
      loteEntregaId: true,
      parentItem: { select: { nombre: true } },
      loteEntrega: { select: loteTableroSelect },
      pasos: {
        select: {
          id: true,
          indice: true,
          nodoClave: true,
          estado: true,
          nombre: true,
        },
      },
      _count: { select: { archivos: { where: { estado: 'LISTO' } } } },
    },
  },
  orden: {
    select: {
      numero: true,
      fechaEntrega: true,
      cliente: { select: { nombre: true } },
    },
  },
} satisfies Prisma.OrdenTrabajoItemPasoSelect;
const pasoSelect = pasoColaSelect;
type Paso = Prisma.OrdenTrabajoItemPasoGetPayload<{
  select: typeof pasoSelect;
}>;

export function disponibilidadCola(
  paso: Paso,
  documentos: string[],
  recursoDisponible: boolean,
) {
  const motivos: string[] = [];
  if (!recursoDisponible)
    motivos.push('La máquina necesita una estación activa y estar habilitada.');
  if (paso.motivoBloqueo) motivos.push(paso.motivoBloqueo);
  const usaGrafo = paso.item.pasos.every((p) => p.nodoClave);
  const anteriores = usaGrafo
    ? paso.dependenciasEntrantes.map((d) => d.predecesor)
    : paso.item.pasos.filter((p) => p.indice < paso.indice);
  const pendientes = anteriores.filter((p) => p.estado !== 'hecho');
  if (pendientes.length)
    motivos.push(`Espera: ${pendientes.map((p) => p.nombre).join(', ')}.`);
  for (const g of paso.gatesOperativos)
    if (g.estado !== 'CUMPLIDO') {
      motivos.push(
        g.detalle ||
          (g.tipo === 'MATERIAL'
            ? 'Falta material disponible/asignado.'
            : 'Falta verificar calidad.'),
      );
    }
  for (const nombre of documentos) motivos.push(`Falta aprobación: ${nombre}.`);
  const itemConGates = paso.item.pasos.map((p) =>
    p.id === paso.id ? paso : p,
  );
  const frontera = fronterasEjecutablesDAG(
    [
      ...paso.item.pasos,
      ...paso.dependenciasEntrantes.map((d) => d.predecesor),
    ],
    itemConGates,
  ).some((p) => p.id === paso.id);
  if (paso.estado === 'en_curso')
    return { estadoCola: 'en_curso' as const, motivos };
  if (paso.estado === 'pausado')
    return { estadoCola: 'pausados' as const, motivos };
  if (paso.estado === 'bloqueado') {
    if (!paso.motivoBloqueo) motivos.unshift('Trabajo bloqueado. Revisá su detalle.');
    return { estadoCola: 'bloqueados' as const, motivos };
  }
  return {
    estadoCola:
      paso.estado === 'pendiente' && frontera && !motivos.length
        ? ('listos' as const)
        : ('en_espera' as const),
    motivos,
  };
}

@Injectable()
export class ColasProduccionService {
  constructor(private readonly prisma: PrismaService) {}

  async maquinas(tenantId: string) {
    const [maquinas, cantidades] = await Promise.all([
      this.prisma.maquina.findMany({
        where: { tenantId },
        select: maquinaSelect,
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.ordenTrabajoItemPaso.groupBy({
        by: ['maquinaId', 'estado'],
        where: activos(tenantId),
        _count: { _all: true },
      }),
    ]);
    const porMaquina = new Map<
      string,
      { pendientes: number; enCurso: number }
    >();
    let sinMaquina = 0;
    const conocidas = new Set(maquinas.map((m) => m.id));
    for (const fila of cantidades) {
      if (!fila.maquinaId || !conocidas.has(fila.maquinaId)) {
        sinMaquina += fila._count._all;
        continue;
      }
      const total = porMaquina.get(fila.maquinaId) ?? {
        pendientes: 0,
        enCurso: 0,
      };
      total.pendientes += fila._count._all;
      if (fila.estado === 'en_curso') total.enCurso += fila._count._all;
      porMaquina.set(fila.maquinaId, total);
    }
    return {
      maquinas: maquinas
        .filter((m) => porMaquina.has(m.id))
        .map((m) => ({
          ...m,
          ...(porMaquina.get(m.id) ?? { pendientes: 0, enCurso: 0 }),
        }))
        .sort(
          (a, b) =>
            b.pendientes - a.pendientes ||
            a.nombre.localeCompare(b.nombre, 'es') ||
            a.id.localeCompare(b.id),
        ),
      sinMaquina,
    };
  }

  async leerFilas(
    tenantId: string,
    maquinaId: string,
    db: Prisma.TransactionClient = this.prisma,
    ids?: string[],
    auth?: CurrentAuth,
  ) {
    const maquina = await db.maquina.findFirst({
      where: { id: maquinaId, tenantId },
      select: maquinaSelect,
    });
    if (!maquina) throw new NotFoundException('No se encontró la máquina.');
    // Primero estados y relaciones pequeñas; los snapshots se consultan sólo para la página visible.
    const pasos = await db.ordenTrabajoItemPaso.findMany({
      where: {
        ...activos(tenantId),
        maquinaId,
        ...(ids ? { id: { in: ids } } : {}),
      },
      select: pasoSelect,
      orderBy: [
        { orden: { createdAt: 'asc' } },
        { item: { ordenIndice: 'asc' } },
        { indice: 'asc' },
        { id: 'asc' },
      ],
    });
    const aprobaciones = await leerAprobacionesPendientes(db, tenantId, pasos);
    const supervisa = auth?.permisos?.has('produccion.supervisar') ?? false;
    const empleado =
      auth?.permisos?.has('produccion.ejecutar') && !supervisa
        ? await db.empleado.findFirst({
            where: { tenantId, userId: auth.userId, activo: true },
            select: { id: true, estaciones: { select: { estacionId: true } } },
          })
        : null;
    const gestiona =
      supervisa ||
      Boolean(
        maquina.activo &&
        maquina.estacion?.activo &&
        empleado?.estaciones.some((e) => e.estacionId === maquina.estacion?.id),
      );
    const recursoDisponible =
      maquina.activo && maquina.estacion?.activo === true;
    const filas = pasos
      .map((p) => {
        const lote = contextoLoteTablero(p.item);
        const disponibilidad = disponibilidadCola(
          p,
          aprobaciones.get(p.id) ?? [],
          recursoDisponible,
        );
        const abierto = p.tramos.find((t) => !t.finEl);
        const asignacion = leerAsignacionPersonal(p.asignacionPersonalJson);
        const asignado = !!empleado && !asignacion?.conflicto && asignacion?.personas.some(p => p.empleadoId === empleado.id);
        const tieneMesa = Boolean(
          auth &&
          (asignado || p.mesaUsuarioId === auth.userId ||
            abierto?.usuarioId === auth.userId),
        );
        const requiereMesa = !supervisa && !tieneMesa;
        return {
          id: p.id,
          itemId: p.itemId,
          ordenId: p.ordenId,
          ordenNumero: p.orden.numero,
          nombre: p.nombre,
          producto: lote?.esProductoDelLote
            ? lote.productoNombre
            : p.item.nombre,
          componenteDe: lote
            ? lote.productoNombre
            : (p.item.parentItem?.nombre ?? null),
          lote,
          cliente: p.orden.cliente?.nombre ?? 'Sin cliente',
          cantidad: Number(p.item.cantidad),
          unidad: p.item.cantidadUnidad,
          fechaEntrega:
            (p.item.fechaEntrega ?? p.orden.fechaEntrega)
              ?.toISOString()
              .slice(0, 10) ?? null,
          duracionEstimadaMin:
            p.duracionEstimadaMin === null
              ? null
              : Number(p.duracionEstimadaMin),
          asignacionPersonal: proyectarAsignacionPersonal(p.asignacionPersonalJson, auth?.userId ?? ""),
          responsable:
            p.iniciadoPorNombre ??
            p.mesaUsuario?.nombreCompleto ??
            p.mesaUsuario?.email ??
            (asignacion?.personas.map(p => p.nombre).join(" · ") || null),
          archivosCount: p.item._count.archivos,
          ...disponibilidad,
          control: {
            paso: {
              id: p.id,
              nombre: p.nombre,
              estado: p.estado,
              tipoEjecucion: p.tipoEjecucion,
              modoRegistro: p.modoRegistro,
              duracionEstimadaMin:
                p.duracionEstimadaMin == null
                  ? null
                  : Number(p.duracionEstimadaMin),
              tiempoAcumuladoMin:
                Math.round(sumaTramosMin(p.tramos) * 100) / 100,
              tramoAbierto: abierto
                ? {
                    inicioEl: abierto.inicioEl.toISOString(),
                    usuarioNombre: abierto.usuarioNombre,
                    esMio: abierto.usuarioId === auth?.userId,
                  }
                : null,
              gatesOperativos: p.gatesOperativos.map((g) => ({
                estado: g.estado,
              })),
            },
            esActual: disponibilidad.estadoCola === 'listos',
            canManage: gestiona && !requiereMesa,
            canSupervise: supervisa,
            puedeTomarMesa:
              gestiona && requiereMesa && !p.mesaUsuarioId && !abierto && !asignacion?.personas.length,
          },
        };
      })
      .sort(
        (a, b) =>
          (a.fechaEntrega ?? '9999').localeCompare(b.fechaEntrega ?? '9999') ||
          a.ordenNumero.localeCompare(b.ordenNumero) ||
          a.id.localeCompare(b.id),
      );
    return { maquina, filas };
  }

  async listar(
    tenantId: string,
    maquinaId: string,
    consulta: ConsultaColaDto,
    auth?: CurrentAuth,
  ) {
    const { maquina, filas } = await this.leerFilas(
      tenantId,
      maquinaId,
      this.prisma,
      undefined,
      auth,
    );
    const totales = {
      todos: filas.length,
      listos: 0,
      en_curso: 0,
      pausados: 0,
      en_espera: 0,
      bloqueados: 0,
    };
    for (const f of filas) totales[f.estadoCola]++;
    const q = (consulta.q ?? '').trim().toLocaleLowerCase('es');
    const filtradas = filas.filter(
      (f) =>
        (consulta.estado === 'todos' || consulta.estado === f.estadoCola) &&
        (!q ||
          [
            f.ordenNumero,
            f.nombre,
            f.producto,
            f.componenteDe,
            f.cliente,
            f.lote?.nombre,
          ].some((v) => v?.toLocaleLowerCase('es').includes(q))),
    );
    const pages = Math.max(1, Math.ceil(filtradas.length / consulta.limit));
    const page = Math.min(consulta.page, pages);
    const pagina = filtradas.slice(
      (page - 1) * consulta.limit,
      page * consulta.limit,
    );
    const configuraciones = await leerConfiguracionesCola(
      this.prisma,
      tenantId,
      pagina.map((f) => f.id),
    );
    return {
      maquina,
      totales,
      total: filtradas.length,
      page,
      pages,
      limit: consulta.limit,
      items: pagina.map((f) => {
        const configuracion =
          configuraciones.get(f.id) ??
          configurarFilaCola({
            pasoId: f.id,
            original: null,
            compartido: null,
            contexto: null,
            impresionesEnContexto: 0,
          });
        return { ...f, configuracion };
      }),
      consultadoEl: new Date().toISOString(),
    };
  }
}
