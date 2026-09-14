import { ArchivoEstado, type Prisma } from '@prisma/client';
import {
  loteTableroSelect,
  dependenciaTableroSelect,
} from './tablero-contexto-lote';

/** Proyección compartida de filas activas y páginas del historial. */
export const itemTableroInclude = {
  // El tablero necesita conservar la jerarquía del BOM: sin el
  // padre cargado los componentes se proyectaban como productos
  // independientes y se perdía el contexto de la OT compuesta.
  parentItem: { select: { id: true, nombre: true } },
  loteEntrega: { select: loteTableroSelect },
  // Producto vivo (vía cotización): su nombre ACTUAL para el card, así
  // renombrar el producto se refleja en el tablero. Null en OT manuales.
  cotizacionItem: {
    select: {
      jobContextJson: true,
      producto: { select: { nombre: true } },
    },
  },
  // Sólo el conteo de archivos LISTO: el tablero muestra un clip
  // con el número, no la lista. Traer las filas para contarlas
  // sería N+1 disfrazado.
  _count: {
    select: { archivos: { where: { estado: ArchivoEstado.LISTO } } },
  },
  pasos: {
    orderBy: { indice: 'asc' as const },
    include: {
      mesaUsuario: { select: { nombreCompleto: true, email: true } },
      dependenciasEntrantes: {
        where: { obligatoria: true },
        select: dependenciaTableroSelect,
      },
      dependenciasSalientes: {
        where: { obligatoria: true },
        select: { sucesorPasoId: true },
      },
      gatesOperativos: {
        orderBy: { tipo: 'asc' as const },
        select: {
          id: true,
          tipo: true,
          estado: true,
          detalle: true,
          resueltoEl: true,
          resueltoPorNombre: true,
        },
      },
      tramos: {
        // Todos los tramos del paso (son pocos): la proyección
        // deriva el abierto, el último cierre y el acumulado.
        orderBy: {
          finEl: { sort: 'desc' as const, nulls: 'first' as const },
        },
        select: {
          usuarioId: true,
          usuarioNombre: true,
          inicioEl: true,
          finEl: true,
          motivoFin: true,
          motivoDetalle: true,
        },
      },
    },
  },
} as const satisfies Prisma.OrdenTrabajoItemInclude;

/** Replica la proyección del tablero: los participantes de nesting no son pasos visibles. */
const pasoVisible: Prisma.OrdenTrabajoItemPasoWhereInput = {
  OR: [{ nestingLoteRol: null }, { nestingLoteRol: { not: 'PARTICIPANTE' } }],
};
export const itemActivoTablero: Prisma.OrdenTrabajoItemWhereInput = {
  contieneLotesEntrega: false,
  OR: [
    { pasos: { none: pasoVisible } },
    { pasos: { some: { ...pasoVisible, estado: { not: 'hecho' } } } },
  ],
};
export const itemTerminadoTablero: Prisma.OrdenTrabajoItemWhereInput = {
  contieneLotesEntrega: false,
  AND: [
    { pasos: { some: pasoVisible } },
    { pasos: { none: { ...pasoVisible, estado: { not: 'hecho' } } } },
  ],
};
