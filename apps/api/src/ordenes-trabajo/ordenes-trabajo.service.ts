import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  ArchivoEstado,
  Prisma,
  RolSistema,
  SeveridadNotificacionInterna,
  TipoEnlacePublico,
} from '@prisma/client';
import QRCode from 'qrcode';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ArchivosService } from '../archivos/archivos.service';
import {
  EnlacesPublicosService,
  generarTokenPublico,
} from '../enlaces-publicos/enlaces-publicos.service';
import { EtaService } from '../eta/eta.service';
import type { CurrentAuth } from '../auth/auth.types';
import { firmaActor } from '../common/firma-actor';
import { resolverTecnologiaMaquina } from '../common/tecnologia-maquina';
import { paginatedResponse } from '../common/dto/pagination.dto';
import {
  esCancelable,
  etiquetaMotivoFin,
  ESTADO_CANCELADA,
  MOTIVOS_PAUSA,
  MOTIVO_PAUSA_LABELS,
  ORDEN_TRABAJO_ESTADO_LABELS,
  ORDEN_TRABAJO_FLUJO,
  progresoEfectivo,
  tiempoMedidoValido,
  type MotivoPausa,
  type OrdenTrabajoEstado,
  type OrdenTrabajoPasoAccion,
  type OrdenTrabajoPasoEstado,
  type TiempoFuente,
} from './ordenes-trabajo.types';
import type {
  CambiarEstadoOrdenTrabajoDto,
  CancelarOrdenTrabajoDto,
  CrearOrdenTrabajoCargoDto,
  CrearOrdenTrabajoDto,
  CrearOrdenTrabajoItemDto,
  EditarOrdenTrabajoDto,
  EditarOrdenTrabajoLoteDto,
} from './dto/crear-orden-trabajo.dto';
import type { AccionPasoOrdenTrabajoDto } from './dto/accion-paso.dto';
import type { AhorroConsolidacionDto } from './dto/completar-pasos-lote.dto';
import type { ResolverGatePasoDto } from './dto/resolver-gate-paso.dto';
import {
  colaConsolidacionDeFamilia,
  modoRegistroDeFamilia,
  resolverFamilia,
} from '../productos-servicios/pasos/familias';
import { evaluarCupon, planDescuentoCupon } from '../cupones/cupon-reglas';
import { FacturacionOrdenesService } from '../administracion/facturacion-ordenes.service';
import {
  acomodarTanda,
  claveCompatibilidadVariante,
} from '../produccion/produccion.service';
import {
  compilarRutaLineal,
  nodoEjecutable,
  nodoReabrible,
  reducirGrafoAClaves,
  type GrafoProduccion,
} from './grafo-produccion';
import { resolverJobContextComponente } from '../productos-servicios/componentes-configuracion';
import {
  aplicarFallbackConfigLaser,
  claveCompatibilidadLoteLaser,
  extraerCompatibilidadLaser,
  faltantesCompatibilidadLaser,
} from '../produccion/simulador-laser-compatibilidad';
import { resolverEstacionDePaso } from '../eta/motor/tablero-tipos';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import type { LoteNestingCompuestoSnapshot } from '../motor-universal/tipos';

/**
 * Qué archivos de una orden puede ver el cliente en el link de seguimiento:
 * los que alguien marcó explícitamente como públicos, y nada más. El default
 * de `publico` es false, así que el arte de producción, la orden de compra y
 * los remitos internos quedan afuera salvo decisión expresa.
 */
const ARCHIVOS_VISIBLES_AL_CLIENTE = {
  publico: true,
  estado: ArchivoEstado.LISTO,
} as const;

const ARCHIVO_PUBLICO = {
  id: true,
  nombreOriginal: true,
  bytes: true,
  mimeType: true,
} as const;

type CargoOrdenSnapshot = {
  montoNeto?: unknown;
  impuestoMonto?: unknown;
  total?: unknown;
};

type CotizacionItemFinanciero = {
  id: string;
  cotizacionId: string;
  cantidad: unknown;
  snapshotJson: unknown;
  precioNetoTotal: unknown;
  impuestosPorFueraTotal: unknown;
  precioTotal: unknown;
  impuestosSnapshotJson: unknown;
  descuentoTipo: string | null;
  descuentoValor: unknown;
  descuentoMonto: unknown;
  recetaRevisionId?: string | null;
  recetaVersion?: number | null;
  recetaHuella?: string | null;
  costoTotal?: unknown;
  comisionesSnapshotJson?: unknown;
};

type ItemAutorizado = CrearOrdenTrabajoItemDto & {
  recetaRevisionId?: string | null;
  recetaVersion?: number | null;
  recetaHuella?: string | null;
  recetaSnapshotJson?: Prisma.InputJsonValue | null;
};

function margenFidelizacion(
  items: CotizacionItemFinanciero[],
  cargosNeto: number,
) {
  return (
    items.reduce((acc, item) => {
      const neto = Number(item.precioNetoTotal ?? 0);
      const bruto = Number(item.precioTotal ?? neto);
      const costo = Number(item.costoTotal ?? 0);
      const internos = Array.isArray(item.impuestosSnapshotJson)
        ? item.impuestosSnapshotJson.reduce((s, raw) => {
            const i = raw as { traslado?: string; porcentaje?: number };
            return i.traslado === 'POR_FUERA'
              ? s
              : s + (neto * Number(i.porcentaje ?? 0)) / 100;
          }, 0)
        : 0;
      const comisiones = Array.isArray(item.comisionesSnapshotJson)
        ? item.comisionesSnapshotJson.reduce((s, raw) => {
            const c = raw as {
              base?: string;
              baseCalculo?: string;
              porcentaje?: number;
            };
            const base =
              (c.base ?? c.baseCalculo) === 'BRUTO_COBRADO' ? bruto : neto;
            return s + (base * Number(c.porcentaje ?? 0)) / 100;
          }, 0)
        : 0;
      return acc + neto - internos - comisiones - costo;
    }, 0) - cargosNeto
  );
}

type PasoAhorroConsolidacion = {
  id: string;
  rutaPasoId: string | null;
  item: {
    cotizacionItem: {
      jobContextJson: Prisma.JsonValue;
      trazabilidadJson: Prisma.JsonValue;
    } | null;
  };
};

function snapshotAhorroPaso(paso: PasoAhorroConsolidacion) {
  const jobContext =
    (paso.item.cotizacionItem?.jobContextJson as Record<
      string,
      unknown
    > | null) ?? null;
  const trazabilidad = paso.item.cotizacionItem?.trazabilidadJson as {
    pasos?: Array<{
      rutaPasoId?: string | null;
      materiales?: Array<{
        tipoLineaCosto?: string;
        materialVarianteId?: string;
        materiaPrimaNombre?: string;
        precioUnitario?: number;
      }>;
      nestingResult?: { consumedLengthMm?: number } | null;
    }>;
  } | null;
  const traza = Array.isArray(trazabilidad?.pasos)
    ? trazabilidad.pasos.find(
        (item) => item.rutaPasoId && item.rutaPasoId === paso.rutaPasoId,
      )
    : null;
  const material = traza?.materiales?.find(
    (item) => item.tipoLineaCosto === 'MATERIAL',
  );
  const tecnologiaPaso = paso.rutaPasoId
    ? jobContext?.[`tecnologia_${paso.rutaPasoId}`]
    : null;
  return {
    varianteId:
      typeof material?.materialVarianteId === 'string'
        ? material.materialVarianteId
        : null,
    consumoCotizadoMl:
      typeof traza?.nestingResult?.consumedLengthMm === 'number'
        ? traza.nestingResult.consumedLengthMm / 1000
        : null,
    precioMl:
      typeof material?.precioUnitario === 'number'
        ? material.precioUnitario
        : null,
    tecnologia:
      (typeof tecnologiaPaso === 'string' && tecnologiaPaso) ||
      (typeof jobContext?.tecnologia === 'string' && jobContext.tecnologia) ||
      null,
  };
}

function redondearDinero(valor: number, decimales: number) {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

/** Importes congelados por el cotizador; reconstruye snapshots históricos. */
export function montosCotizacionItem(
  snapshot: Pick<
    CotizacionItemFinanciero,
    | 'precioNetoTotal'
    | 'impuestosPorFueraTotal'
    | 'precioTotal'
    | 'impuestosSnapshotJson'
  >,
  decimales = 2,
) {
  const total = Number(snapshot.precioTotal);
  if (!Number.isFinite(total) || total < 0) return null;
  const netoExacto = Number(snapshot.precioNetoTotal);
  const impuestoExacto = Number(snapshot.impuestosPorFueraTotal);
  if (
    snapshot.precioNetoTotal != null &&
    Number.isFinite(netoExacto) &&
    netoExacto >= 0
  ) {
    const subtotal = redondearDinero(netoExacto, decimales);
    const impuestos =
      snapshot.impuestosPorFueraTotal != null && Number.isFinite(impuestoExacto)
        ? redondearDinero(Math.max(0, impuestoExacto), decimales)
        : redondearDinero(Math.max(0, total - subtotal), decimales);
    return { subtotal, impuestos, total: redondearDinero(total, decimales) };
  }
  const impuestos = Array.isArray(snapshot.impuestosSnapshotJson)
    ? snapshot.impuestosSnapshotJson
    : [];
  const porcentajePorFuera = impuestos.reduce((suma, raw) => {
    if (!raw || typeof raw !== 'object') return suma;
    const impuesto = raw as { porcentaje?: unknown; traslado?: unknown };
    if (impuesto.traslado !== 'POR_FUERA') return suma;
    const porcentaje = Number(impuesto.porcentaje ?? 0);
    return suma + (Number.isFinite(porcentaje) ? porcentaje : 0);
  }, 0);
  const subtotal = redondearDinero(
    porcentajePorFuera > 0 ? total / (1 + porcentajePorFuera / 100) : total,
    decimales,
  );
  return {
    subtotal,
    impuestos: redondearDinero(Math.max(0, total - subtotal), decimales),
    total: redondearDinero(total, decimales),
  };
}

/** Monto efectivo de los cargos según el tratamiento de la orden. */
export function montoCargosPorTratamiento(
  cargos: unknown,
  tratamientoFiscal: 'FISCAL' | 'SIN_COMPROBANTE',
  fallback = 0,
) {
  if (!Array.isArray(cargos) || cargos.length === 0) return fallback;
  return cargos.reduce((total, raw) => {
    const cargo = raw as CargoOrdenSnapshot;
    const monto =
      tratamientoFiscal === 'SIN_COMPROBANTE'
        ? Number(cargo.montoNeto ?? 0)
        : Number(cargo.total ?? 0);
    return total + (Number.isFinite(monto) ? monto : 0);
  }, 0);
}

/** Recalcula los cargos cuya base depende del subtotal de productos. */
export function recalcularCargosPorSubtotal(
  cargos: unknown,
  subtotalProductos: number,
  decimales = 2,
) {
  if (!Array.isArray(cargos)) return [];
  return cargos.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const cargo = raw as Record<string, unknown>;
    if (cargo.modoCalculoSnapshot !== 'PORCENTAJE_SOBRE_BASE') return cargo;
    const config =
      cargo.configSnapshot &&
      typeof cargo.configSnapshot === 'object' &&
      !Array.isArray(cargo.configSnapshot)
        ? (cargo.configSnapshot as Record<string, unknown>)
        : {};
    const porcentaje = Number(config.porcentajeAplicado ?? 0);
    const impuestoPorcentaje = Number(cargo.impuestoPorcentaje ?? 0);
    if (
      !Number.isFinite(porcentaje) ||
      porcentaje < 0 ||
      !Number.isFinite(impuestoPorcentaje) ||
      impuestoPorcentaje < 0
    )
      return cargo;
    const montoNeto = redondearDinero(
      subtotalProductos * (porcentaje / 100),
      decimales,
    );
    const impuestoMonto = redondearDinero(
      montoNeto * (impuestoPorcentaje / 100),
      decimales,
    );
    return {
      ...cargo,
      baseCalculo: subtotalProductos,
      montoNeto,
      impuestoMonto,
      total: redondearDinero(montoNeto + impuestoMonto, decimales),
    };
  });
}

/** `bytes` es BigInt en la base y JSON.stringify no lo sabe serializar. */
function archivoPublico(a: {
  id: string;
  nombreOriginal: string;
  bytes: bigint;
  mimeType: string;
}) {
  return {
    id: a.id,
    nombre: a.nombreOriginal,
    bytes: Number(a.bytes),
    esImagen: a.mimeType.startsWith('image/'),
  };
}

/** Hasta 2 iniciales ("Gráfica Corporearte" → "GC"). */
function inicialesDe(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

/** "2026-07-22" → "22/07/2026" (para descripciones humanas de eventos). */
function formatFechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.split('-');
  if (!anio || !mes || !dia) return iso;
  return `${dia}/${mes}/${anio}`;
}
import type { OrdenesTrabajoQueryDto } from './dto/ordenes-trabajo-query.dto';
import { filtrarSpecsPublicas } from './tracking-publico-specs';
import { DatosEmpresaService } from '../tenants/datos-empresa.service';
import { PreparacionesRecorridoService } from '../recorridos-vectoriales/preparaciones-recorrido.service';
import { ComprobantesService } from '../administracion/comprobantes.service';
import { NotificacionesOrdenesService } from '../integraciones/notificaciones/notificaciones-ordenes.service';
import { formatearMoneda, type Moneda } from '../common/moneda';
import { regionalDelTenant } from '../common/regional';
import { FidelizacionService } from '../fidelizacion/fidelizacion.service';
import { DesarrolloDocumentalService } from '../desarrollo-documental/desarrollo-documental.service';
import {
  claveFechaEnZona,
  instanteDe,
  sumarDiasAClave,
  ZONA_DEFAULT,
} from '../common/zona';

type OrdenConRelaciones = Prisma.OrdenTrabajoGetPayload<{
  include: {
    cliente: { select: { nombre: true } };
    vendedor: { select: { nombreCompleto: true } };
    proyectoCampana: { select: { id: true; codigo: true; nombre: true } };
    _count: { select: { items: true } };
    items: true;
  };
}>;

const LIST_INCLUDE = {
  cliente: { select: { nombre: true } },
  vendedor: { select: { nombreCompleto: true } },
  proyectoCampana: { select: { id: true, codigo: true, nombre: true } },
  _count: {
    select: { items: { where: { parentItemId: null } } },
  },
  items: {
    where: { parentItemId: null },
    select: { nombre: true, ordenIndice: true },
    orderBy: { ordenIndice: 'asc' as const },
  },
};

/** Órdenes que viven en el Tablero: emitidas y todavía no terminadas. */
const ESTADOS_TABLERO: OrdenTrabajoEstado[] = ['pendiente', 'produccion'];

export type AlcanceTableroProduccion = 'completo' | 'vendedor' | 'operario';

/**
 * El tablero se personaliza por capacidades efectivas, no por el nombre del
 * rol. Esto mantiene seguros también los roles personalizados y permite que
 * el Panel General previsualice perfiles reemplazando sólo sus permisos.
 */
export function alcanceTableroProduccionDe(
  auth: Pick<CurrentAuth, 'permisos'>,
): AlcanceTableroProduccion {
  void auth;
  // El Tablero es la verdad compartida del taller: todos sus lectores ven
  // todas las órdenes, sus pasos y el cliente. Los permisos finos gobiernan
  // las acciones, no recortan la lectura.
  return 'completo';
}

type PasoVisibleParaOperario = {
  id?: string;
  indice: number;
  nodoClave?: string | null;
  predecesorPasoIds?: string[];
  predecesoresSatisfechos?: boolean;
  estado: string;
  mesaEsMia: boolean;
  mesaUsuarioNombre: string | null;
  tramoAbierto: { esMio: boolean } | null;
};

/** Su mesa + la frontera activa libre que puede reclamar; nunca pasos futuros. */
export function pasosVisiblesParaOperario<T extends PasoVisibleParaOperario>(
  pasos: T[],
): T[] {
  const porId = new Map(
    pasos.flatMap((paso) => (paso.id ? [[paso.id, paso] as const] : [])),
  );
  return pasos.filter((paso) => {
    if (paso.mesaEsMia || paso.tramoAbierto?.esMio) return true;
    if (
      paso.estado === 'hecho' ||
      paso.estado === 'bloqueado' ||
      paso.mesaUsuarioNombre
    ) {
      return false;
    }
    if (paso.nodoClave) {
      if (paso.predecesoresSatisfechos != null) {
        return paso.predecesoresSatisfechos;
      }
      return (paso.predecesorPasoIds ?? []).every(
        (id) => porId.get(id)?.estado === 'hecho',
      );
    }
    return pasos
      .filter((anterior) => anterior.indice < paso.indice)
      .every((anterior) => anterior.estado === 'hecho');
  });
}

/**
 * Proyección mínima del PasoEjecutado del snapshot del cotizador
 * (`CotizacionItem.trazabilidadJson.pasos`) que necesita la materialización.
 * El JSON viene del motor universal (apps/api/src/motor-universal/tipos.ts).
 */
type PasoTrazabilidad = {
  rutaPasoId?: string;
  rutaPasoOrden?: number;
  familiaCodigo?: string;
  nombreVisible?: string | null;
  activado?: boolean;
  tiempo?: {
    totalMin?: number;
    centroCostoId?: string | null;
    centroCostoNombre?: string | null;
    maquinaId?: string | null;
  };
  operacionesIncorporacion?: Array<Record<string, unknown>>;
  operacionesInternas?: Array<Record<string, unknown>>;
  /// Paso tercerizado (compra a proveedor) — ver F2 en el diseño.
  tercerizado?: boolean;
  proveedorId?: string | null;
  plazoProveedorDias?: number | null;
};

function lotesNestingAplicados(
  trazabilidad: unknown,
): LoteNestingCompuestoSnapshot[] {
  if (
    !trazabilidad ||
    typeof trazabilidad !== 'object' ||
    Array.isArray(trazabilidad)
  ) {
    return [];
  }
  const analisis = (trazabilidad as Record<string, unknown>)
    .analisisNestingCompuesto;
  if (!analisis || typeof analisis !== 'object' || Array.isArray(analisis)) {
    return [];
  }
  const grupos = (analisis as Record<string, unknown>).grupos;
  if (!Array.isArray(grupos)) return [];
  return grupos.flatMap((grupo) => {
    if (!grupo || typeof grupo !== 'object' || Array.isArray(grupo)) return [];
    const registro = grupo as Record<string, unknown>;
    const aplicacion = registro.aplicacion;
    const lote = registro.lote;
    if (
      !aplicacion ||
      typeof aplicacion !== 'object' ||
      Array.isArray(aplicacion) ||
      (aplicacion as Record<string, unknown>).aplicado !== true ||
      !lote ||
      typeof lote !== 'object' ||
      Array.isArray(lote)
    ) {
      return [];
    }
    const candidato = lote as unknown as LoteNestingCompuestoSnapshot;
    return typeof candidato.id === 'string' &&
      Array.isArray(candidato.participantes) &&
      candidato.participantes.length >= 2
      ? [candidato]
      : [];
  });
}

function grafoDesdeSnapshotReceta(valor: Prisma.JsonValue | null | undefined) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const grafo = (valor as Record<string, Prisma.JsonValue>).grafoProduccion;
  if (!grafo || typeof grafo !== 'object' || Array.isArray(grafo)) return null;
  const candidato = grafo as unknown as GrafoProduccion;
  return Array.isArray(candidato.nodos) && Array.isArray(candidato.aristas)
    ? candidato
    : null;
}

function pasosActivados(trazabilidad: unknown): PasoTrazabilidad[] {
  const pasos = (trazabilidad as { pasos?: unknown } | null | undefined)?.pasos;
  if (!Array.isArray(pasos)) return [];
  return (pasos as PasoTrazabilidad[]).filter((paso) => paso?.activado);
}

type ItemAMaterializar = {
  id: string;
  ordenId: string;
  cotizacionItemId: string | null;
};

/** Transiciones válidas de un paso de producción por acción del Tablero. */
export const TRANSICIONES_PASO: Record<
  AccionPasoOrdenTrabajoDto['accion'],
  { desde: OrdenTrabajoPasoEstado[]; verbo: string }
> = {
  iniciar: { desde: ['pendiente'], verbo: 'iniciado' },
  pausar: { desde: ['en_curso'], verbo: 'pausado' },
  continuar: { desde: ['pausado'], verbo: 'reanudado' },
  completar: {
    desde: ['pendiente', 'en_curso', 'pausado'],
    verbo: 'completado',
  },
  bloquear: { desde: ['pendiente', 'en_curso', 'pausado'], verbo: 'bloqueado' },
  desbloquear: { desde: ['bloqueado'], verbo: 'desbloqueado' },
  reabrir: { desde: ['hecho'], verbo: 'reabierto' },
};

/**
 * Suma en minutos de los tramos CERRADOS de un paso (el tiempo medido, D2).
 * Un tramo abierto no suma: se cierra antes de completar/pausar.
 */
/**
 * Si esta orden se puede cancelar. Lanza con el motivo si no.
 *
 * Vive suelta y no adentro de `cancelar()` para poder probarla sin base: es la
 * regla que decide si una venta desaparece de los números, y el caso caro —una
 * orden ya facturada— no puede depender de que alguien acierte el escenario.
 */
export function validarCancelacion(
  estado: OrdenTrabajoEstado,
  facturadoTotal: number,
): void {
  if (estado === ESTADO_CANCELADA) {
    throw new BadRequestException('La orden ya estaba cancelada.');
  }
  if (!esCancelable(estado)) {
    // Dos mensajes distintos porque son dos situaciones distintas, y en una de
    // ellas SÍ hay salida: la finalizada por error se reabre.
    throw new BadRequestException(
      estado === 'finalizada'
        ? 'El trabajo ya está hecho: una orden finalizada no se cancela. Si la finalizaste por error, reabrí un paso desde el tablero —vuelve a producción— y cancelala desde ahí.'
        : 'El trabajo ya se entregó: eso no se cancela. Si hay que devolver, emitile una nota de crédito al cliente.',
    );
  }
  // El eje fiscal manda: si ARCA ya tiene una factura de esta orden, cancelarla
  // dejaría al sistema diciendo dos cosas distintas. La NC es el camino.
  if (facturadoTotal > 0) {
    throw new ConflictException(
      'La orden tiene facturación emitida. Emitile la nota de crédito primero y después cancelala.',
    );
  }
}

export function sumaTramosMin(
  tramos: Array<{ inicioEl: Date; finEl: Date | null }>,
): number {
  return tramos.reduce((acc, tramo) => {
    if (!tramo.finEl) return acc;
    return acc + (tramo.finEl.getTime() - tramo.inicioEl.getTime()) / 60_000;
  }, 0);
}

/**
 * Corte de jornada que aplica a un tramo abierto (D9): la hora `corte`
 * ("HH:mm") del día en que se abrió; si se abrió DESPUÉS del corte (turno
 * nocturno), la del día siguiente. Determinístico: no depende de cuándo
 * corre la reconciliación.
 *
 * El "20:00" de la config es hora de pared del TALLER (`zona` IANA del
 * tenant): con el `setHours` local de antes, el server en UTC cerraba los
 * tramos a las 17:00 de Argentina.
 */
export function corteJornadaDe(
  inicioEl: Date,
  corte: string,
  zona: string = ZONA_DEFAULT,
): Date {
  const [hh, mm] = corte.split(':').map((parte) => Number(parte));
  const hora = `${String(Number.isFinite(hh) ? hh : 20).padStart(2, '0')}:${String(Number.isFinite(mm) ? mm : 0).padStart(2, '0')}`;
  const dia = claveFechaEnZona(inicioEl, zona);
  const corteDia = instanteDe(dia, hora, zona);
  if (inicioEl >= corteDia) {
    return instanteDe(sumarDiasAClave(dia, 1), hora, zona);
  }
  return corteDia;
}

/**
 * Fecha calendario en que la deuda comercial pasa a estar vencida.
 * Se parte del día local del tenant, no del UTC del servidor: una orden
 * finalizada a las 22:30 en Argentina sigue perteneciendo a ese día.
 */
export function vencimientoComercialDesde(
  finalizadaEl: Date,
  plazoDias: number | null | undefined,
  zonaHoraria: string,
): Date {
  const fechaLocal = claveFechaEnZona(finalizadaEl, zonaHoraria);
  const claveVencimiento = sumarDiasAClave(
    fechaLocal,
    Math.max(0, Math.trunc(plazoDias ?? 0)),
  );
  return new Date(`${claveVencimiento}T00:00:00.000Z`);
}

type PasoSecuencia = { indice: number; estado: string };

/**
 * La ruta es una SECUENCIA: un paso está listo para ejecutarse (activo) sólo
 * si es el primero o todos los anteriores ya están hechos. Iniciar,
 * completar o bloquear fuera de la frontera rompería el orden de la ruta.
 */
export function pasoEjecutable(
  pasos: PasoSecuencia[],
  indice: number,
): boolean {
  return pasos
    .filter((paso) => paso.indice < indice)
    .every((paso) => paso.estado === 'hecho');
}

/**
 * Deshacer un paso hecho sólo vale en la frontera hacia atrás: si un paso
 * posterior ya arrancó (o también está hecho/bloqueado), reabrir éste
 * dejaría la secuencia inconsistente.
 */
export function pasoReabrible(pasos: PasoSecuencia[], indice: number): boolean {
  return pasos
    .filter((paso) => paso.indice > indice)
    .every((paso) => paso.estado === 'pendiente');
}

/**
 * Avance por trabajo estimado, no por cantidad de cajitas. Si faltan tiempos,
 * cada desconocido toma la mediana de los conocidos; si faltan todos se cae
 * al conteo histórico. De ese modo un QC de 5 min no pesa igual que 4 h de UV
 * y tampoco se inventa precisión extrema para pasos sin estimación.
 */
export function progresoPonderadoPasos(
  pasos: Array<{ estado: string; duracionEstimadaMin: number | null }>,
): number {
  if (pasos.length === 0) return 0;
  const conocidos = pasos
    .map((paso) => paso.duracionEstimadaMin)
    .filter((valor): valor is number => valor != null && valor > 0)
    .sort((a, b) => a - b);
  const pesoDesconocido =
    conocidos.length > 0 ? conocidos[Math.floor(conocidos.length / 2)] : 1;
  const peso = (paso: (typeof pasos)[number]) =>
    paso.duracionEstimadaMin != null && paso.duracionEstimadaMin > 0
      ? paso.duracionEstimadaMin
      : pesoDesconocido;
  const total = pasos.reduce((suma, paso) => suma + peso(paso), 0);
  const hecho = pasos
    .filter((paso) => paso.estado === 'hecho')
    .reduce((suma, paso) => suma + peso(paso), 0);
  return Math.round((hecho / total) * 100);
}

export function gatesOperativosPendientes(
  gates: Array<{ tipo: string; estado: string }>,
) {
  return gates.filter((gate) => gate.estado !== 'CUMPLIDO');
}

/**
 * Una OT se finaliza sola cuando se completa su último paso pendiente: el
 * total de pasos ya está hecho tras un `completar`. Sólo aplica a esa acción
 * (bloquear/reabrir/desbloquear/iniciar nunca dejan todo hecho).
 */
export function ordenSeFinaliza(
  accion: OrdenTrabajoPasoAccion,
  total: number,
  hechos: number,
): boolean {
  return accion === 'completar' && total > 0 && hechos === total;
}

/**
 * Fecha (ISO) en que la orden ALCANZÓ cada estado, desde los eventos de
 * transición. `emision` deja la orden en pendiente; los `estado` traen el
 * destino en `despues`; la ENTREGA cierra la orden con `{cerrada:true}` en vez
 * de `despues`, así que se mapea aparte. Eventos en orden ascendente: se toma
 * la PRIMERA vez que se alcanzó cada estado.
 */
function fechasEstadoDeEventos(
  eventos: Array<{ tipo: string; fecha: Date; datosJson: Prisma.JsonValue }>,
): Record<string, string> {
  const fechas: Record<string, string> = {};
  const marcar = (estado: string, fecha: Date) => {
    if (!fechas[estado]) fechas[estado] = fecha.toISOString();
  };
  for (const evento of eventos) {
    const datos = (evento.datosJson ?? {}) as Record<string, unknown>;
    if (evento.tipo === 'borrador') marcar('borrador', evento.fecha);
    else if (evento.tipo === 'emision') marcar('pendiente', evento.fecha);
    else if (evento.tipo === 'estado') {
      if (typeof datos.despues === 'string')
        marcar(datos.despues, evento.fecha);
      else if (datos.cerrada === true) marcar('entregada', evento.fecha);
    }
  }
  return fechas;
}

@Injectable()
export class OrdenesTrabajoService {
  private readonly logger = new Logger(OrdenesTrabajoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eta: EtaService,
    private readonly archivos: ArchivosService,
    private readonly avisos: NotificacionesOrdenesService,
    private readonly enlaces: EnlacesPublicosService,
    private readonly empresa: DatosEmpresaService,
    // Para "acreditar y cancelar" en un paso. Es una dependencia de ida:
    // Administración no sabe nada de este módulo, así que no hay ciclo.
    private readonly comprobantes: ComprobantesService,
    private readonly facturacionOrdenes: FacturacionOrdenesService,
    private readonly preparacionesRecorrido: PreparacionesRecorridoService,
    private readonly fidelizacion: FidelizacionService,
    private readonly desarrolloDocumental: DesarrolloDocumentalService,
    @Optional() private readonly eventosSistema?: EventosSistemaService,
  ) {}

  private async prepararRecorridosDeItems(
    auth: CurrentAuth,
    itemIds: string[],
  ): Promise<void> {
    for (const itemId of itemIds) {
      try {
        await this.preparacionesRecorrido.asegurarParaItem(auth, itemId);
      } catch (error) {
        this.logger.warn({
          event: 'preparacion_recorrido_corte_fallida',
          tenantId: auth.tenantId,
          itemId,
          message: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }
  }

  /**
   * Le avisa al cliente por WhatsApp si el estado de la orden lo amerita.
   *
   * Se llama DESPUÉS del commit y sin `await` a propósito. Dos razones, y las
   * dos importan: cerrar una orden no puede tardar lo que tarde Wati en
   * contestar, y una notificación que falla no puede voltear una operación de
   * producción que ya se guardó.
   *
   * Se puede llamar de más sin miedo: `sincronizar` lee el estado actual y la
   * clave única `(evento, orden)` descarta el repetido. Eso es lo que permite
   * sembrarlo después de cualquier operación que PUEDA haber movido la orden
   * en vez de tener que acertar exactamente cuáles la mueven.
   */
  private avisarAlCliente(ordenId: string): void {
    void this.avisos.sincronizar(ordenId);
  }

  /** La moneda del tenant, para mensajes de timeline y errores con montos. */
  private async monedaDe(tenantId: string): Promise<Moneda> {
    return (await regionalDelTenant(this.prisma, tenantId)).moneda;
  }

  /**
   * Logo de la imprenta para el seguimiento público. El token de la orden es
   * la credencial: se resuelve la orden, se toma SU tenant y se firma. Nunca
   * se acepta un id de archivo del cliente.
   */
  async logoPublicoPorToken(token: string): Promise<string | null> {
    // El tenant sale del propio enlace: no hace falta ni tocar la orden.
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.SEGUIMIENTO_OT,
    );
    if (!enlace) return null;
    return this.archivos.urlDeLogoPublico(enlace.tenantId);
  }

  /**
   * QR de retiro para el seguimiento público y para el WhatsApp de "orden
   * lista" (que lo manda como header de imagen: Meta busca esta URL).
   *
   * Codifica el NÚMERO de la orden —lo mismo que el modal del mostrador—, no
   * un token: así el operador puede tipearlo si el QR no lee, y su forma lo
   * distingue de un código de cupón en el mismo lector. El token de la URL es
   * sólo la credencial que autoriza a generarlo; nunca viaja adentro del QR.
   *
   * Corrección de errores alta y con margen: el papel se dobla y se mancha en
   * el mostrador, y WhatsApp recomprime la imagen. Un QR de un número corto es
   * poco denso y sobrevive esa recompresión sin drama.
   */
  async qrRetiroPorToken(token: string): Promise<Buffer | null> {
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.SEGUIMIENTO_OT,
    );
    if (!enlace) return null;
    const orden = await this.prisma.ordenTrabajo.findUnique({
      where: { id: enlace.entidadId },
      select: { numero: true, estado: true },
    });
    // Un borrador no tiene por qué exponer un QR de retiro: todavía no es una
    // orden que el cliente vaya a buscar.
    if (!orden || orden.estado === 'borrador') return null;
    return QRCode.toBuffer(orden.numero, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 512,
      type: 'png',
    });
  }

  /**
   * Descarga de un adjunto desde el link público del cliente.
   *
   * Acá no hay sesión ni tenant en contexto, así que la autorización se hace
   * a mano y con las tres condiciones juntas: el archivo tiene que estar
   * marcado `publico`, estar LISTO, y colgar de ESA orden (o de uno de sus
   * items). Sin el último chequeo, cualquiera con un link de seguimiento
   * podría bajar el adjunto público de otra orden pasando su id.
   */
  async archivoPublicoPorToken(
    token: string,
    archivoId: string,
  ): Promise<string | null> {
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.SEGUIMIENTO_OT,
    );
    if (!enlace) return null;
    const orden = await this.prisma.ordenTrabajo.findUnique({
      where: { id: enlace.entidadId },
      select: { id: true, items: { select: { id: true } } },
    });
    if (!orden) return null;

    const archivo = await this.prisma.archivo.findFirst({
      where: {
        id: archivoId,
        publico: true,
        estado: ArchivoEstado.LISTO,
        OR: [
          { ordenId: orden.id },
          { ordenItemId: { in: orden.items.map((i) => i.id) } },
        ],
      },
    });
    if (!archivo) return null;
    return this.archivos.firmarDescargaDe(archivo);
  }

  /**
   * Captura de métricas del ETA (docs/eta-metricas-historicas-diseno.md):
   * SIEMPRE post-commit y con el error tragado, para que ni la emisión ni la
   * finalización fallen por la telemetría. Se `await`ea (no fire-and-forget)
   * para que la promesa/cierre ya estén escritos cuando la acción responde.
   */
  private async capturarEtaEmision(auth: CurrentAuth, ordenId: string) {
    try {
      await this.eta.capturarEmision(auth, ordenId);
    } catch (error) {
      this.logger.error(
        `Falló la captura de promesa de ETA (orden ${ordenId}).`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async capturarEtaCierre(tenantId: string, ordenId: string) {
    try {
      await this.eta.capturarCierre(tenantId, ordenId);
    } catch (error) {
      this.logger.error(
        `Falló la captura de cierre de ETA (orden ${ordenId}).`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── Listado ──────────────────────────────────────────────────────────

  async findAll(auth: CurrentAuth, query: OrdenesTrabajoQueryDto) {
    const q = query.q?.trim();
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    const hoyClave = claveFechaEnZona(new Date(), regional.zonaHoraria);
    const mananaClave = sumarDiasAClave(hoyClave, 1);
    const en8diasClave = sumarDiasAClave(hoyClave, 8);
    const hoy0 = instanteDe(hoyClave, '00:00', regional.zonaHoraria);
    const manana0 = instanteDe(mananaClave, '00:00', regional.zonaHoraria);
    // `fechaEntrega` es DATE en Postgres y Prisma la representa a medianoche
    // UTC. Sus límites son claves calendario, no instantes del huso horario.
    const hoyDate = new Date(`${hoyClave}T00:00:00.000Z`);
    const en8diasDate = new Date(`${en8diasClave}T00:00:00.000Z`);
    const where: Prisma.OrdenTrabajoWhereInput = {
      tenantId: auth.tenantId,
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.proyectoCampanaId
        ? { proyectoCampanaId: query.proyectoCampanaId }
        : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.urgencia === 'atrasadas'
        ? {
            estado: { in: ['pendiente', 'produccion'] },
            fechaEntrega: { lt: hoyDate },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { numero: { contains: q, mode: 'insensitive' } },
              { cliente: { nombre: { contains: q, mode: 'insensitive' } } },
              {
                vendedor: {
                  nombreCompleto: { contains: q, mode: 'insensitive' },
                },
              },
              {
                items: {
                  some: { nombre: { contains: q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };

    // Los KPIs y los contadores de los chips son del TENANT COMPLETO, no de
    // la página cargada: si se calcularan sobre las filas devueltas (como
    // hacía el front), con más órdenes que el límite empezarían a mentir.
    // Van en la misma transacción: un solo round-trip, snapshot consistente.
    const [
      ordenes,
      total,
      porEstado,
      proximasEntregar,
      atrasadas,
      emitidasHoy,
    ] = await this.prisma.$transaction([
      this.prisma.ordenTrabajo.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy:
          query.urgencia === 'atrasadas'
            ? [{ fechaEntrega: 'asc' }, { createdAt: 'desc' }]
            : { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.ordenTrabajo.count({ where }),
      this.prisma.ordenTrabajo.groupBy({
        by: ['estado'],
        where: { tenantId: auth.tenantId },
        orderBy: { estado: 'asc' },
        _count: { _all: true },
        _sum: { total: true },
      }),
      // "Próximas a entregar": activas que vencen dentro de los 7 días.
      this.prisma.ordenTrabajo.count({
        where: {
          tenantId: auth.tenantId,
          estado: { in: ['pendiente', 'produccion'] },
          fechaEntrega: { gte: hoyDate, lt: en8diasDate },
        },
      }),
      this.prisma.ordenTrabajo.count({
        where: {
          tenantId: auth.tenantId,
          estado: { in: ['pendiente', 'produccion'] },
          fechaEntrega: { lt: hoyDate },
        },
      }),
      // "Emitidas hoy": lo que salió al taller en el día. Una cancelada no
      // cuenta aunque se haya emitido hoy: el número mide trabajo entrando.
      this.prisma.ordenTrabajo.count({
        where: {
          tenantId: auth.tenantId,
          estado: { notIn: ['borrador', ESTADO_CANCELADA] },
          fechaEmision: { gte: hoy0, lt: manana0 },
        },
      }),
    ]);

    const counts: Record<OrdenTrabajoEstado, number> = {
      borrador: 0,
      pendiente: 0,
      produccion: 0,
      finalizada: 0,
      entregada: 0,
      cancelada: 0,
    };
    // "Valor en curso": lo que el taller tiene entre manos. Ni entregado, ni
    // borrador, ni cancelado — esa plata no va a entrar.
    let valorEnCurso = 0;
    for (const grupo of porEstado as Array<{
      estado: string;
      _count: { _all: number };
      _sum: { total: Prisma.Decimal | null };
    }>) {
      const estado = grupo.estado as OrdenTrabajoEstado;
      counts[estado] = grupo._count._all;
      if (
        estado !== 'entregada' &&
        estado !== 'borrador' &&
        estado !== ESTADO_CANCELADA
      ) {
        valorEnCurso += Number(grupo._sum.total ?? 0);
      }
    }

    return {
      ...paginatedResponse(
        ordenes.map((orden) => this.toListItem(orden)),
        total,
        query,
      ),
      stats: {
        porEstado: counts,
        totalOrdenes: Object.values(counts).reduce((a, b) => a + b, 0),
        activas: counts.pendiente + counts.produccion,
        valorEnCurso,
        proximasEntregar,
        atrasadas,
        emitidasHoy,
      },
    };
  }

  // ── Detalle ──────────────────────────────────────────────────────────

  async findOne(auth: CurrentAuth, id: string) {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        ...LIST_INCLUDE,
        _count: {
          select: {
            items: { where: { parentItemId: null } },
            eventos: true,
          },
        },
        items: {
          // Los componentes fabricados son subitems técnicos ejecutables. No
          // son renglones comerciales adicionales ni tienen precio propio.
          where: { parentItemId: null },
          orderBy: { ordenIndice: 'asc' as const },
          include: {
            parentItem: { select: { id: true, nombre: true } },
            // Payload de rehidratación: la vista de la OT emitida es la misma
            // ficha de creación, reconstruida desde el snapshot del cotizador.
            cotizacionItem: {
              select: {
                productoId: true,
                rutaAlternativaId: true,
                jobContextJson: true,
                snapshotJson: true,
                trazabilidadJson: true,
                costoUnitario: true,
                costoTotal: true,
                precioUnitario: true,
                precioTotal: true,
                precioConfigSnapshotJson: true,
                impuestosSnapshotJson: true,
                comisionesSnapshotJson: true,
                precioEspecialClienteSnapshotJson: true,
              },
            },
          },
        },
        // Sólo lo que se serializa (datosJson pesa y no viaja al front) y
        // con tope: el historial crece con cada edición y no puede volver
        // ilimitado el detalle de una orden vieja.
        eventos: {
          orderBy: { fecha: 'desc' as const },
          take: 200,
          select: {
            fecha: true,
            tipo: true,
            descripcion: true,
            usuarioNombre: true,
          },
        },
      },
    });
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }
    // Backfill perezoso del link público: OTs emitidas antes de existir el
    // token no tienen uno; se genera la primera vez que se abre el detalle
    // para que "Compartir seguimiento" siempre tenga link.
    let publicToken = orden.publicToken;
    if (!publicToken && orden.estado !== 'borrador') {
      publicToken = generarTokenPublico();
      await this.prisma.$transaction(async (tx) => {
        await tx.ordenTrabajo.update({
          where: { id: orden.id },
          data: { publicToken },
        });
        await this.enlaces.emitir(tx, {
          tenantId: auth.tenantId,
          tipo: TipoEnlacePublico.SEGUIMIENTO_OT,
          entidadId: orden.id,
          token: publicToken!,
        });
      });
    }
    // Fecha en que la orden alcanzó cada estado, para el stepper del detalle.
    // El detalle no trae `datosJson` (pesa), así que los eventos de transición
    // se leen aparte —son pocos— y se computa el mapa acá.
    const transiciones = await this.prisma.ordenTrabajoEvento.findMany({
      where: {
        ordenId: orden.id,
        tenantId: auth.tenantId,
        tipo: { in: ['borrador', 'emision', 'estado'] },
      },
      select: { tipo: true, fecha: true, datosJson: true },
      orderBy: { fecha: 'asc' as const },
    });
    return {
      ...this.toDetalle({ ...orden, publicToken }),
      fechasEstado: fechasEstadoDeEventos(transiciones),
    };
  }

  // ── Crear ────────────────────────────────────────────────────────────

  async create(auth: CurrentAuth, payload: CrearOrdenTrabajoDto) {
    if (payload.idempotencyKey) {
      const existente = await this.prisma.ordenTrabajo.findFirst({
        where: {
          tenantId: auth.tenantId,
          idempotencyKey: payload.idempotencyKey,
        },
        select: { id: true },
      });
      if (existente) return this.findOne(auth, existente.id);
    }

    const estadoInicial: OrdenTrabajoEstado = payload.estado ?? 'borrador';
    const emitida = estadoInicial === 'pendiente';
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    this.validarEmision(estadoInicial, payload.clienteId ?? null);
    this.validarFechaEntregaEmision(
      estadoInicial,
      payload.fechaEntrega ?? null,
      regional.zonaHoraria,
    );
    // Dos items de la orden no pueden apuntar al mismo snapshot del cotizador.
    const idsSnapshot = payload.items
      .map((item) => item.cotizacionItemId)
      .filter((v): v is string => Boolean(v));
    if (new Set(idsSnapshot).size !== idsSnapshot.length) {
      throw new BadRequestException(
        'Hay items duplicados: dos productos referencian la misma cotización.',
      );
    }
    if (idsSnapshot.length !== payload.items.length) {
      throw new BadRequestException(
        'Todos los productos de la orden deben tener una cotización persistida.',
      );
    }

    // Validaciones de integridad referencial dentro del tenant. El emisor
    // (empleado vinculado al usuario autenticado) es el vendedor por defecto
    // cuando el payload no manda uno explícito.
    const [cliente, vendedor, emisor] = await Promise.all([
      payload.clienteId
        ? this.prisma.cliente.findFirst({
            where: {
              id: payload.clienteId,
              tenantId: auth.tenantId,
              activo: true,
            },
            select: { id: true, nombre: true },
          })
        : null,
      payload.vendedorEmpleadoId
        ? this.prisma.empleado.findFirst({
            where: {
              id: payload.vendedorEmpleadoId,
              tenantId: auth.tenantId,
              activo: true,
            },
            select: { id: true, nombreCompleto: true },
          })
        : null,
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { id: true, nombreCompleto: true },
      }),
    ]);
    if (payload.clienteId && !cliente) {
      throw new NotFoundException('No se encontró el cliente.');
    }
    if (payload.vendedorEmpleadoId && !vendedor) {
      throw new NotFoundException('No se encontró el vendedor.');
    }
    const [cotizacion, encontrados] = await Promise.all([
      payload.cotizacionId
        ? this.prisma.cotizacion.findFirst({
            where: { id: payload.cotizacionId, tenantId: auth.tenantId },
            select: {
              id: true,
              numero: true,
              total: true,
              clienteId: true,
              proyectoCampanaId: true,
              _count: { select: { items: true } },
            },
          })
        : null,
      this.prisma.cotizacionItem.findMany({
        where: { id: { in: idsSnapshot }, tenantId: auth.tenantId },
        select: {
          id: true,
          cotizacionId: true,
          cantidad: true,
          snapshotJson: true,
          precioNetoTotal: true,
          impuestosPorFueraTotal: true,
          precioTotal: true,
          impuestosSnapshotJson: true,
          descuentoTipo: true,
          descuentoValor: true,
          descuentoMonto: true,
          recetaRevisionId: true,
          recetaVersion: true,
          recetaHuella: true,
          costoTotal: true,
          comisionesSnapshotJson: true,
        },
      }),
    ]);
    if (payload.cotizacionId && !cotizacion)
      throw new NotFoundException('No se encontró la cotización.');
    if (
      payload.proyectoCampanaId &&
      cotizacion?.proyectoCampanaId &&
      payload.proyectoCampanaId !== cotizacion.proyectoCampanaId
    ) {
      throw new BadRequestException(
        'La campaña indicada no coincide con la del presupuesto.',
      );
    }
    const proyectoCampanaId =
      payload.proyectoCampanaId ?? cotizacion?.proyectoCampanaId ?? null;
    if (proyectoCampanaId) {
      if (!payload.clienteId) {
        throw new BadRequestException(
          'Para asignar una campaña, la orden debe tener cliente.',
        );
      }
      const campana = await this.prisma.proyectoCampana.findFirst({
        where: {
          id: proyectoCampanaId,
          tenantId: auth.tenantId,
          clienteId: payload.clienteId,
          estado: { not: 'cancelado' },
        },
        select: { id: true },
      });
      if (!campana) {
        throw new BadRequestException(
          'La campaña no existe, está cancelada o pertenece a otro cliente.',
        );
      }
    }
    if (encontrados.length !== idsSnapshot.length) {
      throw new NotFoundException(
        'Algún item de cotización referenciado no existe.',
      );
    }
    const decimales =
      regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales;
    const snapshots = new Map(encontrados.map((item) => [item.id, item]));
    let items = payload.items.map((item) => {
      const snapshot = snapshots.get(item.cotizacionItemId);
      if (!snapshot)
        throw new NotFoundException(
          `No se encontró la cotización de "${item.nombre}".`,
        );
      if (
        payload.cotizacionId &&
        snapshot.cotizacionId !== payload.cotizacionId
      ) {
        throw new BadRequestException(
          `El snapshot de "${item.nombre}" no pertenece a la cotización de la orden.`,
        );
      }
      return this.itemAutorizado(item, snapshot, decimales);
    });
    const reservasPresupuesto = payload.cotizacionId
      ? await this.prisma.cuponRedencion.findMany({
          where: {
            tenantId: auth.tenantId,
            cotizacionId: payload.cotizacionId,
            estado: { in: ['RESERVADA', 'CONSUMIDA'] },
          },
          select: { cuponId: true },
        })
      : [];
    items = await this.validarCupones(
      auth,
      payload.clienteId ?? null,
      items,
      new Set(reservasPresupuesto.map((reserva) => reserva.cuponId)),
    );
    this.validarMontosItems(items);
    if (emitida) {
      await this.exigirDescuentoEmitible(
        auth,
        items.filter((item) => !item.descuentoCuponId),
      );
    }

    let subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const impuestosItems = items.reduce((s, i) => s + i.impuestos, 0);
    const tratamientoFiscal = payload.tratamientoFiscal ?? 'FISCAL';
    const cargos = await this.cargosAutorizados(
      auth.tenantId,
      payload.cargos ?? [],
      subtotal,
      decimales,
    );
    let cargosPersistidos = cargos;
    const cargoPresupuesto =
      cargos.length === 0 &&
      cotizacion?.numero &&
      cotizacion.total != null &&
      cotizacion._count.items === items.length
        ? Math.max(
            0,
            Number(cotizacion.total) - items.reduce((s, i) => s + i.total, 0),
          )
        : 0;
    if (
      cargos.length === 0 &&
      (payload.cargosDirectos ?? 0) > 0 &&
      cargoPresupuesto === 0
    ) {
      throw new BadRequestException(
        'Los cargos de la orden deben enviarse con su catálogo e inputs de cálculo.',
      );
    }
    let cargosDirectos = montoCargosPorTratamiento(
      cargos,
      tratamientoFiscal,
      tratamientoFiscal === 'FISCAL'
        ? cargoPresupuesto
        : cargoPresupuesto > 0
          ? cargoPresupuesto / 1.21
          : 0,
    );
    // Denormalizado para el listado. El descuento YA está dentro de `subtotal`
    // de cada item (el neto persistido es el descontado), no se resta de nuevo.
    const descuentoTotal = items.reduce(
      (s, i) => s + (i.descuentoMonto ?? 0),
      0,
    );
    // Sin comprobante: el desglose oculta el IVA y `total` = neto + cargos.
    // Ver docs/margen-y-decisiones-de-precio.md §6.
    let impuestos =
      tratamientoFiscal === 'SIN_COMPROBANTE' ? 0 : impuestosItems;
    let total = subtotal + impuestos + cargosDirectos;
    const reservaFidelizacionPresupuesto =
      payload.cotizacionId && payload.clienteId
        ? await this.prisma.fidelizacionReserva.findFirst({
            where: {
              tenantId: auth.tenantId,
              clienteId: payload.clienteId,
              cotizacionId: payload.cotizacionId,
              estado: 'RESERVADA',
              ordenId: null,
            },
          })
        : null;
    const margenBase = margenFidelizacion(
      encontrados,
      cargos.reduce((s, cargo) => s + Number(cargo.montoNeto ?? 0), 0),
    );
    const fidelizacion = await this.fidelizacion.simular(
      auth.tenantId,
      payload.clienteId ?? null,
      margenBase,
      total,
      payload.fidelizacionCanjePuntos ?? 0,
      reservaFidelizacionPresupuesto?.puntos ?? 0,
    );
    if ((payload.fidelizacionCanjePuntos ?? 0) > fidelizacion.maximoCanjeable) {
      throw new ConflictException(
        'El cliente ya no tiene suficientes puntos para este canje.',
      );
    }
    if (fidelizacion.canjeMonto > 0 && total > 0) {
      let restante = fidelizacion.canjeMonto;
      const totalOriginal = total;
      items = items.map((item, indice) => {
        const baseItem =
          tratamientoFiscal === 'SIN_COMPROBANTE' ? item.subtotal : item.total;
        const rebaja =
          indice === items.length - 1
            ? Math.min(baseItem, restante)
            : Math.min(
                baseItem,
                redondearDinero(
                  (fidelizacion.canjeMonto * baseItem) / totalOriginal,
                  decimales,
                ),
              );
        restante = redondearDinero(restante - rebaja, decimales);
        const factor = baseItem > 0 ? (baseItem - rebaja) / baseItem : 1;
        const nuevoTotal = redondearDinero(item.total * factor, decimales);
        const nuevoSubtotal = redondearDinero(
          item.subtotal * factor,
          decimales,
        );
        return {
          ...item,
          subtotal: nuevoSubtotal,
          impuestos: redondearDinero(nuevoTotal - nuevoSubtotal, decimales),
          total: nuevoTotal,
          fidelizacionDescuentoNeto: redondearDinero(
            item.subtotal - nuevoSubtotal,
            decimales,
          ),
        };
      });
      if (restante > 0) {
        cargosPersistidos = cargos.map((cargo) => {
          if (restante <= 0) return cargo;
          const baseCargo =
            tratamientoFiscal === 'SIN_COMPROBANTE'
              ? Number(cargo.montoNeto)
              : Number(cargo.total);
          const rebaja = Math.min(baseCargo, restante);
          restante = redondearDinero(restante - rebaja, decimales);
          const factor = baseCargo > 0 ? (baseCargo - rebaja) / baseCargo : 1;
          const montoNeto = redondearDinero(
            Number(cargo.montoNeto) * factor,
            decimales,
          );
          const impuestoMonto = redondearDinero(
            Number(cargo.impuestoMonto) * factor,
            decimales,
          );
          return {
            ...cargo,
            montoNeto,
            impuestoMonto,
            total: redondearDinero(montoNeto + impuestoMonto, decimales),
          };
        });
        cargosDirectos = montoCargosPorTratamiento(
          cargosPersistidos,
          tratamientoFiscal,
          0,
        );
      }
      subtotal = items.reduce((s, item) => s + item.subtotal, 0);
      impuestos =
        tratamientoFiscal === 'SIN_COMPROBANTE'
          ? 0
          : items.reduce((s, item) => s + item.impuestos, 0);
      total = redondearDinero(
        totalOriginal - fidelizacion.canjeMonto,
        decimales,
      );
    }
    const vendedorEmpleadoId = payload.vendedorEmpleadoId ?? emisor?.id ?? null;
    const usuarioNombre = firmaActor(
      auth,
      vendedor?.nombreCompleto ?? emisor?.nombreCompleto ?? auth.email,
    );
    const ahora = new Date();
    // Emitida al taller → link público de seguimiento del cliente. Se acuña
    // acá para poder registrarlo en EnlacePublico dentro de la misma tx.
    const tokenSeguimiento = emitida ? generarTokenPublico() : null;

    let creada: { id: string };
    try {
      creada = await this.prisma.$transaction(async (tx) => {
        const anio = ahora.getFullYear();
        const contador = await tx.ordenTrabajoContador.upsert({
          where: { tenantId_anio: { tenantId: auth.tenantId, anio } },
          create: { tenantId: auth.tenantId, anio, ultimo: 1 },
          update: { ultimo: { increment: 1 } },
        });
        const numero = `OT-${anio}-${String(contador.ultimo).padStart(4, '0')}`;

        const orden = await tx.ordenTrabajo.create({
          data: {
            tenantId: auth.tenantId,
            idempotencyKey: payload.idempotencyKey ?? null,
            numero,
            clienteId: payload.clienteId ?? null,
            vendedorEmpleadoId,
            cotizacionId: payload.cotizacionId ?? null,
            proyectoCampanaId,
            estado: estadoInicial,
            fechaEmision: emitida ? ahora : null,
            publicToken: tokenSeguimiento,
            fechaEntrega: payload.fechaEntrega
              ? new Date(payload.fechaEntrega)
              : null,
            canalVenta: payload.canalVenta ?? null,
            observaciones: payload.observaciones ?? null,
            subtotal,
            impuestos,
            cargosDirectos,
            cargosDirectosJson: cargosPersistidos as never,
            descuentoTotal,
            total,
            tratamientoFiscal,
            fidelizacionMargenBase: margenBase,
            fidelizacionPuntosEstimados: fidelizacion.puntosEstimados,
            fidelizacionCanjePuntos: fidelizacion.canjePuntos,
            fidelizacionCanjeMonto: fidelizacion.canjeMonto,
            fidelizacionSnapshotJson: fidelizacion.snapshot as never,
            items: {
              create: items.map((item, indice) => ({
                tenantId: auth.tenantId,
                cotizacionItemId: item.cotizacionItemId ?? null,
                recetaRevisionId:
                  (item as ItemAutorizado).recetaRevisionId ?? null,
                recetaVersion: (item as ItemAutorizado).recetaVersion ?? null,
                recetaHuella: (item as ItemAutorizado).recetaHuella ?? null,
                recetaSnapshotJson:
                  (item as ItemAutorizado).recetaSnapshotJson ?? undefined,
                codigo: item.codigo,
                nombre: item.nombre,
                familia: item.familia,
                categoriaComercial: item.categoriaComercial ?? '',
                subcategoriaComercial: item.subcategoriaComercial ?? '',
                cantidad: item.cantidad,
                cantidadUnidad: item.cantidadUnidad,
                subtotal: item.subtotal,
                impuestos: item.impuestos,
                total: item.total,
                descuentoTipo: item.descuentoTipo ?? null,
                descuentoValor: item.descuentoValor ?? null,
                descuentoMonto: item.descuentoMonto ?? null,
                descuentoCuponId: item.descuentoCuponId ?? null,
                fidelizacionDescuentoNeto:
                  'fidelizacionDescuentoNeto' in item
                    ? Number(item.fidelizacionDescuentoNeto ?? 0)
                    : 0,
                // Serializado a objetos planos: los DTOs (clases) no matchean
                // InputJsonValue de Prisma.
                specsJson: (item.specs ?? []).map((spec) => ({
                  etiqueta: spec.etiqueta,
                  valor: spec.valor,
                })),
                adicionalesJson: item.adicionales ?? [],
                ordenIndice: indice,
              })),
            },
          },
        });

        if (tokenSeguimiento) {
          await this.enlaces.emitir(tx, {
            tenantId: auth.tenantId,
            tipo: TipoEnlacePublico.SEGUIMIENTO_OT,
            entidadId: orden.id,
            token: tokenSeguimiento,
          });
        }

        if (fidelizacion.canjePuntos > 0 && orden.clienteId) {
          let reserva = payload.cotizacionId
            ? await tx.fidelizacionReserva.findFirst({
                where: {
                  tenantId: auth.tenantId,
                  cotizacionId: payload.cotizacionId,
                  estado: 'RESERVADA',
                  ordenId: null,
                },
              })
            : null;
          if (reserva) {
            if (reserva.puntos > fidelizacion.canjePuntos) {
              const montoSeleccionado = redondearDinero(
                (Number(reserva.monto) * fidelizacion.canjePuntos) /
                  reserva.puntos,
                2,
              );
              await tx.fidelizacionReserva.update({
                where: { id: reserva.id },
                data: {
                  puntos: { decrement: fidelizacion.canjePuntos },
                  monto: { decrement: montoSeleccionado },
                },
              });
              reserva = await tx.fidelizacionReserva.create({
                data: {
                  tenantId: reserva.tenantId,
                  cuentaId: reserva.cuentaId,
                  clienteId: reserva.clienteId,
                  cotizacionId: reserva.cotizacionId,
                  ordenId: orden.id,
                  puntos: fidelizacion.canjePuntos,
                  monto: montoSeleccionado,
                  expiraEl: reserva.expiraEl,
                },
              });
            } else {
              reserva = await tx.fidelizacionReserva.update({
                where: { id: reserva.id },
                data: { ordenId: orden.id },
              });
            }
          } else {
            reserva = await this.fidelizacion.reservar(tx, {
              tenantId: auth.tenantId,
              clienteId: orden.clienteId,
              ordenId: orden.id,
              puntos: fidelizacion.canjePuntos,
            });
          }
          if (emitida && reserva) {
            await this.fidelizacion.consumirReserva(
              tx,
              auth,
              orden.id,
              reserva.id,
            );
          }
        }

        // Emitir al taller materializa los pasos de producción del Tablero
        // desde la trazabilidad del snapshot (el borrador espera a emitirse).
        if (emitida) {
          const itemsCreados = await tx.ordenTrabajoItem.findMany({
            where: { ordenId: orden.id },
            select: { id: true, ordenId: true, cotizacionItemId: true },
          });
          await this.materializarPasosItems(tx, auth.tenantId, itemsCreados);
          // Cupones: la redención (contador + auditoría) va en la MISMA
          // transacción que emite — si el cupón se agotó o venció entre
          // aplicarlo y emitir, la emisión entera se cae con error claro.
          await this.redimirCupones(tx, auth, orden.id, items);
        }

        if (proyectoCampanaId) {
          await this.desarrolloDocumental.materializarRequisitosReceta(tx, {
            tenantId: auth.tenantId,
            ordenId: orden.id,
            proyectoCampanaId,
            actorUserId: auth.userId,
            actorNombre: usuarioNombre,
          });
        }

        // Timeline: se insertan en orden cronológico (productos → borrador →
        // número → emisión) con timestamps levemente separados para que el
        // orden por fecha sea estable.
        const eventos: Array<{ tipo: string; descripcion: string }> = [
          {
            tipo: 'productos',
            descripcion: `${payload.items.length} producto${
              payload.items.length === 1 ? '' : 's'
            } agregado${payload.items.length === 1 ? '' : 's'} a la orden`,
          },
          { tipo: 'borrador', descripcion: 'Borrador guardado' },
          { tipo: 'numero_asignado', descripcion: `Nº asignado ${numero}` },
          ...(emitida
            ? [{ tipo: 'emision', descripcion: 'OT emitida al taller' }]
            : []),
        ];
        await tx.ordenTrabajoEvento.createMany({
          data: eventos.map((evento, i) => {
            const esSistema = evento.tipo === 'numero_asignado';
            return {
              tenantId: auth.tenantId,
              ordenId: orden.id,
              fecha: new Date(
                ahora.getTime() - (eventos.length - 1 - i) * 1000,
              ),
              tipo: evento.tipo,
              descripcion: evento.descripcion,
              usuarioNombre: esSistema ? 'Sistema' : usuarioNombre,
              usuarioId: esSistema ? null : auth.userId,
              origen: esSistema ? 'sistema' : 'usuario',
            };
          }),
        });
        if (proyectoCampanaId) {
          await tx.proyectoCampanaEvento.create({
            data: {
              tenantId: auth.tenantId,
              proyectoCampanaId,
              tipo: 'vinculo',
              descripcion: `Se vinculó la orden ${numero}.`,
              actorUserId: auth.impersonacion?.actorUserId ?? auth.userId,
              actorNombre: usuarioNombre,
              datosJson: { tipo: 'orden', documentoId: orden.id },
              origen: auth.impersonacion
                ? 'soporte'
                : auth.mcp
                  ? 'api'
                  : 'usuario',
            },
          });
        }

        return orden;
      });
    } catch (error) {
      // Dos requests con la misma llave pueden pasar el lookup inicial a la
      // vez. El índice único elige un ganador; el perdedor devuelve esa misma
      // orden en lugar de transformar un retry seguro en un conflicto.
      if (
        payload.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existente = await this.prisma.ordenTrabajo.findFirst({
          where: {
            tenantId: auth.tenantId,
            idempotencyKey: payload.idempotencyKey,
          },
          select: { id: true },
        });
        if (existente) return this.findOne(auth, existente.id);
      }
      throw error;
    }

    // Emitida directo al taller: congela la promesa de ETA (post-commit).
    if (emitida) {
      await this.capturarEtaEmision(auth, creada.id);
    }

    this.avisarAlCliente(creada.id);

    const itemsCreados = await this.prisma.ordenTrabajoItem.findMany({
      where: { tenantId: auth.tenantId, ordenId: creada.id },
      select: { id: true },
    });
    await this.prepararRecorridosDeItems(
      auth,
      itemsCreados.map((item) => item.id),
    );

    return this.findOne(auth, creada.id);
  }

  /**
   * Fuente común de verdad para una OT y un presupuesto. Conserva únicamente
   * la proyección descriptiva del cliente; cantidades, precios, impuestos y
   * descuentos salen de los snapshots persistidos por el motor.
   */
  async autorizarItemsCotizados(
    auth: CurrentAuth,
    cotizacionId: string,
    payload: CrearOrdenTrabajoItemDto[],
    clienteId: string | null = null,
  ): Promise<CrearOrdenTrabajoItemDto[]> {
    const ids = payload.map((item) => item.cotizacionItemId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Hay items duplicados: dos productos referencian la misma cotización.',
      );
    }
    const [encontrados, regional] = await Promise.all([
      this.prisma.cotizacionItem.findMany({
        where: {
          tenantId: auth.tenantId,
          cotizacionId,
          id: { in: ids },
        },
        select: {
          id: true,
          cotizacionId: true,
          cantidad: true,
          snapshotJson: true,
          precioNetoTotal: true,
          impuestosPorFueraTotal: true,
          precioTotal: true,
          impuestosSnapshotJson: true,
          descuentoTipo: true,
          descuentoValor: true,
          descuentoMonto: true,
          recetaRevisionId: true,
          recetaVersion: true,
          recetaHuella: true,
        },
      }),
      regionalDelTenant(this.prisma, auth.tenantId),
    ]);
    if (encontrados.length !== ids.length) {
      throw new BadRequestException(
        'Algún item no existe o no pertenece a esta cotización.',
      );
    }
    const porId = new Map(encontrados.map((item) => [item.id, item]));
    const decimales =
      regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales;
    const autorizados = payload.map((item) =>
      this.itemAutorizado(item, porId.get(item.cotizacionItemId)!, decimales),
    );
    this.validarMontosItems(autorizados);
    return this.validarCupones(auth, clienteId, autorizados);
  }

  /** Calcula y congela cargos desde el catálogo vigente del tenant. */
  async autorizarCargosCotizados(
    auth: CurrentAuth,
    cargos: CrearOrdenTrabajoCargoDto[],
    subtotal: number,
  ) {
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    const decimales =
      regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales;
    return this.cargosAutorizados(auth.tenantId, cargos, subtotal, decimales);
  }

  // ── Edición de datos comerciales ─────────────────────────────────────

  /**
   * Guarda el staging completo del editor en una sola transacción. Además de
   * impedir estados intermedios (por ejemplo, una OT sin ítems), usa el
   * `updatedAt` que recibió el navegador como versión optimista.
   */
  async editarLote(
    auth: CurrentAuth,
    id: string,
    payload: EditarOrdenTrabajoLoteDto,
  ) {
    const [orden, actor, regional] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: { items: true },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
      regionalDelTenant(this.prisma, auth.tenantId),
    ]);
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }

    const versionEsperada = new Date(payload.expectedVersion);
    if (
      Number.isNaN(versionEsperada.getTime()) ||
      versionEsperada.getTime() !== orden.updatedAt.getTime()
    ) {
      throw new ConflictException(
        'La orden cambió mientras la estabas editando. Recargala para revisar la versión más reciente antes de volver a guardar.',
      );
    }

    const estado = orden.estado as OrdenTrabajoEstado;
    const campos = (
      [
        'clienteId',
        'vendedorEmpleadoId',
        'canalVenta',
        'fechaEntrega',
        'observaciones',
      ] as const
    ).filter((campo) => payload[campo] !== undefined);
    const bloqueados = campos.filter(
      (campo) => !this.camposEditables(estado).has(campo),
    );
    if (bloqueados.length > 0) {
      throw new BadRequestException(
        `Con la orden en estado "${ORDEN_TRABAJO_ESTADO_LABELS[estado]}" no se puede editar: ${bloqueados.join(', ')}.`,
      );
    }
    if (payload.items && !this.puedeEditarItems(estado)) {
      throw new BadRequestException(
        `Con la orden en estado "${ORDEN_TRABAJO_ESTADO_LABELS[estado]}" no se pueden modificar los productos.`,
      );
    }
    if (payload.fechaEntrega !== undefined) {
      this.validarFechaEntregaEmision(
        estado,
        payload.fechaEntrega,
        regional.zonaHoraria,
      );
    }

    const [clienteNuevo, vendedorNuevo] = await Promise.all([
      payload.clienteId
        ? this.prisma.cliente.findFirst({
            where: {
              id: payload.clienteId,
              tenantId: auth.tenantId,
              activo: true,
            },
            select: { id: true },
          })
        : null,
      payload.vendedorEmpleadoId
        ? this.prisma.empleado.findFirst({
            where: {
              id: payload.vendedorEmpleadoId,
              tenantId: auth.tenantId,
              activo: true,
            },
            select: { id: true },
          })
        : null,
    ]);
    if (payload.clienteId && !clienteNuevo)
      throw new NotFoundException('No se encontró el cliente.');
    if (payload.vendedorEmpleadoId && !vendedorNuevo)
      throw new NotFoundException('No se encontró el vendedor.');

    let itemsAutorizados:
      | Array<
          CrearOrdenTrabajoItemDto & {
            id?: string;
            archivosOrigenItemIds?: string[];
          }
        >
      | undefined;
    // El editor de la OT guarda el conjunto completo en una sola operación.
    // Conservamos los ids materializados para preparar los archivos recién
    // DESPUÉS del commit: antes todavía no existe una fuente estable a la que
    // vincular revisiones, recorridos y TAP.
    let itemIdsParaPreparar: string[] = [];
    if (payload.items) {
      const idsExistentes = payload.items
        .map((item) => item.id)
        .filter((itemId): itemId is string => Boolean(itemId));
      if (new Set(idsExistentes).size !== idsExistentes.length) {
        throw new BadRequestException('Hay productos repetidos en la edición.');
      }
      const pertenecen = new Set(orden.items.map((item) => item.id));
      if (idsExistentes.some((itemId) => !pertenecen.has(itemId))) {
        throw new BadRequestException(
          'Algún producto editado no pertenece a esta orden.',
        );
      }
      const origenesArchivos = payload.items.flatMap(
        (item) => item.archivosOrigenItemIds ?? [],
      );
      if (new Set(origenesArchivos).size !== origenesArchivos.length) {
        throw new BadRequestException(
          'Una línea anterior no puede transferir sus archivos a más de un producto.',
        );
      }
      if (origenesArchivos.some((itemId) => !pertenecen.has(itemId))) {
        throw new BadRequestException(
          'Algún archivo a conservar pertenece a otro producto u otra orden.',
        );
      }
      for (const item of payload.items) {
        if (
          item.archivosOrigenItemIds?.some(
            (origenId) =>
              idsExistentes.includes(origenId) && origenId !== item.id,
          )
        ) {
          throw new BadRequestException(
            'No se pueden transferir archivos desde un producto que permanece en la orden.',
          );
        }
      }
      const cotizacionIds = payload.items.map((item) => item.cotizacionItemId);
      if (new Set(cotizacionIds).size !== cotizacionIds.length) {
        throw new BadRequestException(
          'Dos productos no pueden referenciar la misma cotización.',
        );
      }
      const snapshots = await this.prisma.cotizacionItem.findMany({
        where: { tenantId: auth.tenantId, id: { in: cotizacionIds } },
        select: {
          id: true,
          cotizacionId: true,
          cantidad: true,
          snapshotJson: true,
          precioNetoTotal: true,
          impuestosPorFueraTotal: true,
          precioTotal: true,
          impuestosSnapshotJson: true,
          descuentoTipo: true,
          descuentoValor: true,
          descuentoMonto: true,
          recetaRevisionId: true,
          recetaVersion: true,
          recetaHuella: true,
        },
      });
      if (snapshots.length !== cotizacionIds.length) {
        throw new BadRequestException(
          'Algún producto no tiene una cotización válida en este negocio.',
        );
      }
      if (
        orden.cotizacionId &&
        snapshots.some(
          (snapshot) => snapshot.cotizacionId !== orden.cotizacionId,
        )
      ) {
        throw new BadRequestException(
          'Algún producto no pertenece a la cotización de la orden.',
        );
      }
      const porId = new Map(
        snapshots.map((snapshot) => [snapshot.id, snapshot]),
      );
      const decimales =
        regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales;
      itemsAutorizados = payload.items.map((item) => ({
        ...this.itemAutorizado(
          item,
          porId.get(item.cotizacionItemId)!,
          decimales,
        ),
        id: item.id,
        archivosOrigenItemIds: item.archivosOrigenItemIds,
      }));
      this.validarMontosItems(itemsAutorizados);

      const redenciones = await this.prisma.cuponRedencion.findMany({
        where: { tenantId: auth.tenantId, ordenId: orden.id },
        select: { cuponId: true },
      });
      itemsAutorizados = (await this.validarCupones(
        auth,
        payload.clienteId ?? orden.clienteId,
        itemsAutorizados,
        new Set(redenciones.map((redencion) => redencion.cuponId)),
      )) as Array<
        CrearOrdenTrabajoItemDto & {
          id?: string;
          archivosOrigenItemIds?: string[];
        }
      >;
      if (estado !== 'borrador') {
        await this.exigirDescuentoEmitible(
          auth,
          itemsAutorizados.filter((item) => !item.descuentoCuponId),
        );
      }
    }

    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      const reclamo = await tx.ordenTrabajo.updateMany({
        where: {
          id: orden.id,
          tenantId: auth.tenantId,
          estado,
          updatedAt: versionEsperada,
        },
        data: {
          ...(payload.clienteId !== undefined
            ? { clienteId: payload.clienteId }
            : {}),
          ...(payload.vendedorEmpleadoId !== undefined
            ? { vendedorEmpleadoId: payload.vendedorEmpleadoId }
            : {}),
          ...(payload.canalVenta !== undefined
            ? { canalVenta: payload.canalVenta }
            : {}),
          ...(payload.fechaEntrega !== undefined
            ? {
                fechaEntrega: new Date(
                  `${payload.fechaEntrega.slice(0, 10)}T00:00:00.000Z`,
                ),
              }
            : {}),
          ...(payload.observaciones !== undefined
            ? { observaciones: payload.observaciones }
            : {}),
          updatedAt: ahora,
        },
      });
      if (reclamo.count !== 1) {
        throw new ConflictException(
          'La orden cambió mientras la estabas editando. Recargala antes de volver a guardar.',
        );
      }

      if (itemsAutorizados) {
        const conservados = new Set(
          itemsAutorizados
            .map((item) => item.id)
            .filter((itemId): itemId is string => Boolean(itemId)),
        );
        const eliminados = orden.items
          .map((item) => item.id)
          .filter((itemId) => !conservados.has(itemId));
        const materializables: ItemAMaterializar[] = [];
        const transferenciasArchivos: Array<{
          destinoId: string;
          origenIds: string[];
        }> = [];
        for (const [ordenIndice, item] of itemsAutorizados.entries()) {
          let destinoId: string;
          if (item.id) {
            const actualizado = await tx.ordenTrabajoItem.update({
              where: { id: item.id },
              data: { ...this.buildItemData(item), ordenIndice },
            });
            materializables.push({
              id: actualizado.id,
              ordenId: orden.id,
              cotizacionItemId: actualizado.cotizacionItemId,
            });
            destinoId = actualizado.id;
          } else {
            const creado = await tx.ordenTrabajoItem.create({
              data: {
                tenantId: auth.tenantId,
                ordenId: orden.id,
                ...this.buildItemData(item),
                ordenIndice,
              },
            });
            materializables.push({
              id: creado.id,
              ordenId: orden.id,
              cotizacionItemId: creado.cotizacionItemId,
            });
            destinoId = creado.id;
          }
          if (item.archivosOrigenItemIds?.length) {
            transferenciasArchivos.push({
              destinoId,
              origenIds: item.archivosOrigenItemIds,
            });
          }
        }
        await this.reemplazarItemsConservandoArchivos(
          tx,
          auth.tenantId,
          orden.id,
          eliminados,
          transferenciasArchivos,
        );
        if (estado === 'pendiente') {
          await this.materializarPasosItems(
            tx,
            auth.tenantId,
            materializables,
            { reemplazar: true },
          );
        }
        itemIdsParaPreparar = materializables.map((item) => item.id);
        if (estado === 'pendiente') {
          await this.reconciliarCupones(tx, auth, orden.id, itemsAutorizados);
        }
        await this.recalcularTotales(
          tx,
          orden.id,
          Number(orden.cargosDirectos ?? 0),
        );
      }

      if (orden.proyectoCampanaId) {
        await this.desarrolloDocumental.materializarRequisitosReceta(tx, {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          proyectoCampanaId: orden.proyectoCampanaId,
          actorUserId: auth.userId,
          actorNombre: firmaActor(auth, actor?.nombreCompleto ?? auth.email),
        });
      }

      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: 'modificacion',
          descripcion: `Edición guardada: ${campos.length} campo(s) y ${itemsAutorizados ? `${itemsAutorizados.length} producto(s)` : 'sin cambios de productos'}`,
          usuarioNombre: firmaActor(auth, actor?.nombreCompleto ?? auth.email),
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            campos,
            itemsAntes: orden.items.length,
            itemsDespues: itemsAutorizados?.length ?? orden.items.length,
          },
        },
      });
    });

    // Mismo contrato que crear/agregar/editar un item individual: al volver
    // del guardado, cualquier producto vectorial ya tiene sus revisiones por
    // placa listas. `asegurarParaItem` compara hashes, por lo que recorrer el
    // conjunto completo es idempotente y no crea revisiones duplicadas.
    await this.prepararRecorridosDeItems(auth, itemIdsParaPreparar);

    return this.findOne(auth, orden.id);
  }

  /**
   * Reasigna primero los adjuntos y recién después elimina las líneas fuente.
   * El orden es parte de la garantía: Archivo.ordenItem tiene onDelete Cascade.
   */
  private async reemplazarItemsConservandoArchivos(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
    eliminados: string[],
    transferencias: Array<{ destinoId: string; origenIds: string[] }>,
  ): Promise<void> {
    for (const transferencia of transferencias) {
      await tx.archivo.updateMany({
        where: {
          tenantId,
          scope: 'ORDEN_ITEM',
          ordenItemId: { in: transferencia.origenIds },
        },
        data: { ordenItemId: transferencia.destinoId },
      });
    }
    if (eliminados.length > 0) {
      await tx.ordenTrabajoItem.deleteMany({
        where: { ordenId, id: { in: eliminados } },
      });
    }
  }

  /**
   * Qué campos admiten edición según el estado. Regla acordada 2026-07-16:
   * borrador/pendiente = datos comerciales completos; produccion = sólo
   * fecha y observaciones (el taller ya arrancó); finalizada/entregada =
   * nada (sólo lectura; notas y pagos van por sus propios flujos).
   */
  camposEditables(estado: OrdenTrabajoEstado): ReadonlySet<string> {
    switch (estado) {
      case 'borrador':
      case 'pendiente':
        return new Set([
          'clienteId',
          'vendedorEmpleadoId',
          'canalVenta',
          'fechaEntrega',
          'observaciones',
        ]);
      case 'produccion':
        return new Set(['fechaEntrega', 'observaciones']);
      case 'finalizada':
      case 'entregada':
      // Cancelada es de sólo lectura como las cerradas: es el registro de algo
      // que no va a pasar, y editarlo después sería reescribir la historia.
      case 'cancelada':
        return new Set();
    }
  }

  async editar(auth: CurrentAuth, id: string, payload: EditarOrdenTrabajoDto) {
    const [orden, actor, regional] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: {
          cliente: { select: { nombre: true } },
          vendedor: { select: { nombreCompleto: true } },
        },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
      regionalDelTenant(this.prisma, auth.tenantId),
    ]);
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }

    const estado = orden.estado as OrdenTrabajoEstado;
    const editables = this.camposEditables(estado);
    const enviados = (
      [
        'clienteId',
        'vendedorEmpleadoId',
        'canalVenta',
        'fechaEntrega',
        'observaciones',
      ] as const
    ).filter((campo) => payload[campo] !== undefined);
    if (enviados.length === 0) return this.findOne(auth, orden.id);
    const bloqueados = enviados.filter((campo) => !editables.has(campo));
    if (bloqueados.length > 0) {
      throw new BadRequestException(
        `Con la orden en estado "${ORDEN_TRABAJO_ESTADO_LABELS[estado]}" no se puede editar: ${bloqueados.join(', ')}.`,
      );
    }

    // Integridad referencial + reglas de negocio de los campos enviados.
    const [clienteNuevo, vendedorNuevo] = await Promise.all([
      payload.clienteId
        ? this.prisma.cliente.findFirst({
            where: {
              id: payload.clienteId,
              tenantId: auth.tenantId,
              activo: true,
            },
            select: { id: true, nombre: true },
          })
        : null,
      payload.vendedorEmpleadoId
        ? this.prisma.empleado.findFirst({
            where: {
              id: payload.vendedorEmpleadoId,
              tenantId: auth.tenantId,
              activo: true,
            },
            select: { id: true, nombreCompleto: true },
          })
        : null,
    ]);
    if (payload.clienteId && !clienteNuevo) {
      throw new NotFoundException('No se encontró el cliente.');
    }
    if (payload.vendedorEmpleadoId && !vendedorNuevo) {
      throw new NotFoundException('No se encontró el vendedor.');
    }
    if (payload.fechaEntrega !== undefined) {
      this.validarFechaEntregaEmision(
        estado,
        payload.fechaEntrega,
        regional.zonaHoraria,
      );
    }

    // Diff campo por campo: sólo lo que realmente cambia genera update+evento.
    const fechaActualIso = orden.fechaEntrega
      ? orden.fechaEntrega.toISOString().slice(0, 10)
      : null;
    const ordenCanal = (orden as { canalVenta?: string | null }).canalVenta;
    const cambios: Array<{
      campo: string;
      antes: string | null;
      despues: string | null;
      descripcion: string;
      data: Prisma.OrdenTrabajoUpdateInput;
    }> = [];
    if (payload.clienteId && payload.clienteId !== orden.clienteId) {
      cambios.push({
        campo: 'clienteId',
        antes: orden.clienteId,
        despues: payload.clienteId,
        descripcion: `Cliente: ${orden.cliente?.nombre ?? 'Sin cliente'} → ${clienteNuevo!.nombre}`,
        data: { cliente: { connect: { id: payload.clienteId } } },
      });
    }
    if (
      payload.vendedorEmpleadoId &&
      payload.vendedorEmpleadoId !== orden.vendedorEmpleadoId
    ) {
      cambios.push({
        campo: 'vendedorEmpleadoId',
        antes: orden.vendedorEmpleadoId,
        despues: payload.vendedorEmpleadoId,
        descripcion: `Vendedor: ${orden.vendedor?.nombreCompleto ?? '—'} → ${vendedorNuevo!.nombreCompleto}`,
        data: { vendedor: { connect: { id: payload.vendedorEmpleadoId } } },
      });
    }
    if (payload.canalVenta && payload.canalVenta !== ordenCanal) {
      cambios.push({
        campo: 'canalVenta',
        antes: ordenCanal ?? null,
        despues: payload.canalVenta,
        descripcion: `Canal de venta: ${ordenCanal ?? '—'} → ${payload.canalVenta}`,
        data: { canalVenta: payload.canalVenta } as never,
      });
    }
    if (
      payload.fechaEntrega !== undefined &&
      payload.fechaEntrega !== fechaActualIso
    ) {
      cambios.push({
        campo: 'fechaEntrega',
        antes: fechaActualIso,
        despues: payload.fechaEntrega,
        descripcion: `Fecha de entrega: ${formatFechaCorta(fechaActualIso)} → ${formatFechaCorta(payload.fechaEntrega)}`,
        data: { fechaEntrega: new Date(payload.fechaEntrega) },
      });
    }
    if (
      payload.observaciones !== undefined &&
      payload.observaciones !== (orden.observaciones ?? '')
    ) {
      cambios.push({
        campo: 'observaciones',
        antes: orden.observaciones,
        despues: payload.observaciones,
        descripcion: 'Observaciones actualizadas',
        data: { observaciones: payload.observaciones },
      });
    }

    if (cambios.length === 0) return this.findOne(auth, orden.id);

    const usuarioNombre = firmaActor(auth, actor?.nombreCompleto ?? auth.email);
    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.ordenTrabajo.updateMany({
        where: {
          id: orden.id,
          tenantId: auth.tenantId,
          estado,
          updatedAt: orden.updatedAt,
        },
        data: cambios.reduce(
          (acc, cambio) => ({ ...acc, ...cambio.data }),
          {} as Prisma.OrdenTrabajoUpdateManyMutationInput,
        ),
      });
      if (actualizado.count !== 1) {
        throw new ConflictException(
          'La orden cambió mientras la estabas editando. Recargala antes de volver a guardar.',
        );
      }
      await tx.ordenTrabajoEvento.createMany({
        data: cambios.map((cambio, i) => ({
          tenantId: auth.tenantId,
          ordenId: orden.id,
          fecha: new Date(ahora.getTime() + i),
          tipo: 'modificacion',
          descripcion: cambio.descripcion,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            campo: cambio.campo,
            antes: cambio.antes,
            despues: cambio.despues,
          },
        })),
      });
    });

    return this.findOne(auth, orden.id);
  }

  // ── Edición de items ─────────────────────────────────────────────────

  /**
   * Los items sólo se tocan mientras el taller no arrancó (regla acordada
   * 2026-07-16): borrador y pendiente. En produccion+ el contenido queda
   * congelado — cambios de alcance ahí son otra conversación de negocio.
   */
  puedeEditarItems(estado: OrdenTrabajoEstado): boolean {
    return estado === 'borrador' || estado === 'pendiente';
  }

  private async cargarOrdenParaItems(auth: CurrentAuth, ordenId: string) {
    const [orden, actor] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id: ordenId, tenantId: auth.tenantId },
        select: {
          id: true,
          estado: true,
          clienteId: true,
          cotizacionId: true,
          proyectoCampanaId: true,
          cargosDirectos: true,
          updatedAt: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
    ]);
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }
    const estado = orden.estado as OrdenTrabajoEstado;
    if (!this.puedeEditarItems(estado)) {
      throw new BadRequestException(
        `Con la orden en estado "${ORDEN_TRABAJO_ESTADO_LABELS[estado]}" no se pueden modificar los productos.`,
      );
    }
    return {
      orden,
      usuarioNombre: firmaActor(auth, actor?.nombreCompleto ?? auth.email),
    };
  }

  /**
   * Cambia el tratamiento fiscal de la orden (FISCAL ↔ SIN_COMPROBANTE) y
   * recalcula sus denormalizados. SIN_COMPROBANTE oculta el IVA del desglose,
   * deja `total` = neto y saca la orden de la cola de facturar.
   *
   * Candado de ciclo de vida: sólo en borrador/pendiente y si la orden NO
   * tiene facturación emitida — no se des-factura marcando "sin comprobante".
   * Ver docs/margen-y-decisiones-de-precio.md §6.
   */
  async setTratamientoFiscal(
    auth: CurrentAuth,
    id: string,
    tratamientoFiscal: 'FISCAL' | 'SIN_COMPROBANTE',
  ) {
    const [orden, actor] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id, tenantId: auth.tenantId },
        select: {
          id: true,
          estado: true,
          tratamientoFiscal: true,
          cargosDirectos: true,
          cargosDirectosJson: true,
          facturadoTotal: true,
          updatedAt: true,
        },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
    ]);
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }
    if (orden.tratamientoFiscal === tratamientoFiscal) {
      return this.findOne(auth, id);
    }
    if (!['borrador', 'pendiente'].includes(orden.estado)) {
      throw new BadRequestException(
        'El tratamiento fiscal sólo se cambia con la orden en borrador o pendiente.',
      );
    }
    if (
      tratamientoFiscal === 'SIN_COMPROBANTE' &&
      Number(orden.facturadoTotal) > 0.01
    ) {
      throw new BadRequestException(
        'La orden ya tiene facturación emitida: no se puede marcar sin comprobante. Anulá la factura con una nota de crédito primero.',
      );
    }

    const usuarioNombre = firmaActor(auth, actor?.nombreCompleto ?? auth.email);
    const cargosDirectos = montoCargosPorTratamiento(
      orden.cargosDirectosJson,
      tratamientoFiscal,
      Number(orden.cargosDirectos ?? 0),
    );
    await this.prisma.$transaction(async (tx) => {
      const reclamo = await tx.ordenTrabajo.updateMany({
        where: {
          id,
          tenantId: auth.tenantId,
          estado: orden.estado,
          updatedAt: orden.updatedAt,
        },
        data: { tratamientoFiscal, cargosDirectos },
      });
      if (reclamo.count !== 1) {
        throw new ConflictException(
          'La orden cambió mientras actualizabas su tratamiento fiscal. Recargala e intentá nuevamente.',
        );
      }
      // Recalcula total/impuestos leyendo el flag recién guardado.
      await this.recalcularTotales(tx, id, cargosDirectos);
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: id,
          tipo: 'tratamiento_fiscal',
          descripcion:
            tratamientoFiscal === 'SIN_COMPROBANTE'
              ? 'Marcada sin comprobante fiscal en el sistema'
              : 'Marcada con comprobante fiscal (tratamiento fiscal normal)',
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: { tratamientoFiscal },
        },
      });
    });
    return this.findOne(auth, id);
  }

  /** Recalcula los denormalizados de la orden a partir de sus items. */
  private async recalcularTotales(
    tx: Prisma.TransactionClient,
    ordenId: string,
    cargosDirectosFallback: number,
  ) {
    const agregado = await tx.ordenTrabajoItem.aggregate({
      where: { ordenId },
      _sum: { subtotal: true, impuestos: true, descuentoMonto: true },
    });
    const subtotal = Number(agregado._sum.subtotal ?? 0);
    const impuestosItems = Number(agregado._sum.impuestos ?? 0);
    const descuentoTotal = Number(agregado._sum.descuentoMonto ?? 0);
    // El total no puede quedar por debajo de lo ya FACTURADO: antes hay
    // que anular la factura o emitir una nota de crédito.
    const actual = await tx.ordenTrabajo.findUniqueOrThrow({
      where: { id: ordenId },
      select: {
        facturadoTotal: true,
        tenantId: true,
        tratamientoFiscal: true,
        cargosDirectosJson: true,
      },
    });
    const regional = await regionalDelTenant(this.prisma, actual.tenantId);
    const cargos = recalcularCargosPorSubtotal(
      actual.cargosDirectosJson,
      subtotal,
      regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales,
    );
    // Sin comprobante: el desglose oculta el IVA y `total` = neto + cargos.
    // Los snapshots de ítem no se tocan (impuestosItems sigue siendo su IVA);
    // sólo cae el denormalizado de la orden. Ver §6 del cuaderno de margen.
    const sinComprobante = actual.tratamientoFiscal === 'SIN_COMPROBANTE';
    const impuestos = sinComprobante ? 0 : impuestosItems;
    const cargosDirectos = montoCargosPorTratamiento(
      cargos,
      sinComprobante ? 'SIN_COMPROBANTE' : 'FISCAL',
      cargosDirectosFallback,
    );
    const total = subtotal + impuestos + cargosDirectos;
    if (total < Number(actual.facturadoTotal) - 0.01) {
      const { moneda } = regional;
      const dinero = (n: number) =>
        formatearMoneda(n, moneda, { decimales: 0 });
      throw new ConflictException(
        `La orden ya tiene ${dinero(Number(actual.facturadoTotal))} facturados y esta edición la dejaría en ${dinero(total)}: anulá la factura o emitile una nota de crédito primero.`,
      );
    }
    await tx.ordenTrabajo.update({
      where: { id: ordenId },
      data: {
        subtotal,
        impuestos,
        cargosDirectos,
        ...(cargos.length > 0 ? { cargosDirectosJson: cargos as never } : {}),
        descuentoTotal,
        total,
      },
    });
  }

  private itemAutorizado(
    item: CrearOrdenTrabajoItemDto,
    snapshot: CotizacionItemFinanciero,
    decimales: number,
  ): ItemAutorizado {
    const montos = montosCotizacionItem(snapshot, decimales);
    if (!montos) {
      throw new BadRequestException(
        `La cotización de "${item.nombre}" no tiene un precio válido. Volvé a cotizar el producto.`,
      );
    }
    const raiz =
      snapshot.snapshotJson &&
      typeof snapshot.snapshotJson === 'object' &&
      !Array.isArray(snapshot.snapshotJson)
        ? (snapshot.snapshotJson as Record<string, unknown>)
        : {};
    const producto =
      raiz.producto &&
      typeof raiz.producto === 'object' &&
      !Array.isArray(raiz.producto)
        ? (raiz.producto as Record<string, unknown>)
        : {};
    const receta =
      raiz.receta &&
      typeof raiz.receta === 'object' &&
      !Array.isArray(raiz.receta)
        ? (raiz.receta as Record<string, unknown>)
        : {};
    return {
      ...item,
      codigo: String(producto.codigo ?? item.codigo),
      nombre: String(producto.nombre ?? item.nombre),
      cantidad: Number(snapshot.cantidad),
      subtotal: montos.subtotal,
      impuestos: montos.impuestos,
      total: montos.total,
      descuentoTipo:
        snapshot.descuentoTipo === 'PORCENTAJE' ||
        snapshot.descuentoTipo === 'MONTO'
          ? snapshot.descuentoTipo
          : null,
      descuentoValor:
        snapshot.descuentoValor != null
          ? Number(snapshot.descuentoValor)
          : null,
      descuentoMonto:
        snapshot.descuentoMonto != null
          ? Number(snapshot.descuentoMonto)
          : null,
      descuentoCuponId: item.descuentoCuponId ?? null,
      recetaRevisionId: snapshot.recetaRevisionId ?? null,
      recetaVersion: snapshot.recetaVersion ?? null,
      recetaHuella: snapshot.recetaHuella ?? null,
      recetaSnapshotJson:
        receta.bom && typeof receta.bom === 'object'
          ? (receta.bom as Prisma.InputJsonValue)
          : null,
    };
  }

  /** Revalida en backend todo cupón antes de tratarlo como autorización. */
  private async validarCupones(
    auth: CurrentAuth,
    clienteId: string | null,
    items: CrearOrdenTrabajoItemDto[],
    cuponesYaRedimidos: ReadonlySet<string> = new Set(),
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<CrearOrdenTrabajoItemDto[]> {
    const idsCupon = Array.from(
      new Set(
        items
          .map((item) => item.descuentoCuponId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (idsCupon.length === 0) return items;

    const [cupones, referencias, regional] = await Promise.all([
      db.cupon.findMany({
        where: { tenantId: auth.tenantId, id: { in: idsCupon } },
      }),
      db.cotizacionItem.findMany({
        where: {
          tenantId: auth.tenantId,
          id: { in: items.map((item) => item.cotizacionItemId) },
        },
        select: {
          id: true,
          productoId: true,
          producto: {
            select: {
              codigo: true,
              subcategoriaComercial: {
                select: {
                  codigo: true,
                  categoria: { select: { codigo: true } },
                },
              },
            },
          },
        },
      }),
      regionalDelTenant(db, auth.tenantId),
    ]);
    if (cupones.length !== idsCupon.length) {
      throw new BadRequestException(
        'Algún cupón aplicado no existe o pertenece a otro negocio.',
      );
    }
    const referenciaPorId = new Map(
      referencias.map((referencia) => [referencia.id, referencia]),
    );
    const contexto = {
      ahora: new Date(),
      zonaHoraria: regional.zonaHoraria,
      clienteId,
      items: items.map((item) => {
        const referencia = referenciaPorId.get(item.cotizacionItemId);
        return {
          key: item.cotizacionItemId,
          productoId: referencia?.productoId ?? null,
          productoCodigo: referencia?.producto.codigo ?? item.codigo,
          categoriaCodigo:
            referencia?.producto.subcategoriaComercial.categoria.codigo ?? null,
          subcategoriaCodigo:
            referencia?.producto.subcategoriaComercial.codigo ?? null,
          neto: item.subtotal + Number(item.descuentoMonto ?? 0),
        };
      }),
    };

    for (const cupon of cupones) {
      const evaluacion = evaluarCupon(
        {
          codigo: cupon.codigo,
          tipo: cupon.tipo,
          valor: Number(cupon.valor),
          alcanceTipo: cupon.alcanceTipo,
          alcanceRef: cupon.alcanceRef,
          montoMinimo:
            cupon.montoMinimo != null ? Number(cupon.montoMinimo) : null,
          vigenciaDesde:
            cupon.vigenciaDesde?.toISOString().slice(0, 10) ?? null,
          vigenciaHasta:
            cupon.vigenciaHasta?.toISOString().slice(0, 10) ?? null,
          usoMax: cupon.usoMax,
          // La evaluación de una edición no debe contar contra sí misma el
          // uso que esta misma orden ya reservó al emitir.
          usoCount: Math.max(
            0,
            cupon.usoCount - (cuponesYaRedimidos.has(cupon.id) ? 1 : 0),
          ),
          activo: cupon.activo,
        },
        contexto,
      );
      if (!evaluacion.ok) throw new BadRequestException(evaluacion.motivo);
      const alcanzadas = new Set(evaluacion.alcanzadas);
      const aplicados = items.filter(
        (item) => item.descuentoCuponId === cupon.id,
      );
      if (
        aplicados.some(
          (item) =>
            !alcanzadas.has(item.cotizacionItemId) ||
            item.descuentoTipo !== cupon.tipo,
        )
      ) {
        throw new BadRequestException(
          `El cupón ${cupon.codigo} no autoriza alguno de los descuentos aplicados.`,
        );
      }
      const decimales =
        regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales;
      const plan = planDescuentoCupon(
        { tipo: cupon.tipo, valor: Number(cupon.valor) },
        contexto.items,
        evaluacion.alcanzadas,
        decimales,
      );
      if (aplicados.length !== plan.length) {
        throw new BadRequestException(
          `El cupón ${cupon.codigo} debe aplicarse completo a todos los productos alcanzados.`,
        );
      }
      const esperado = new Map(plan.map((linea) => [linea.key, linea]));
      const tolerancia = 1 / 10 ** decimales / 2;
      for (const item of aplicados) {
        const linea = esperado.get(item.cotizacionItemId);
        const real =
          cupon.tipo === 'MONTO'
            ? Number(item.descuentoMonto ?? 0)
            : Number(item.descuentoValor ?? 0);
        if (!linea || Math.abs(real - linea.valor) > tolerancia) {
          throw new BadRequestException(
            `La distribución aplicada no coincide con el cupón ${cupon.codigo}. Volvé a aplicarlo.`,
          );
        }
      }
    }
    return items;
  }

  private async cargosAutorizados(
    tenantId: string,
    cargos: CrearOrdenTrabajoCargoDto[],
    subtotalProductos: number,
    decimales: number,
  ) {
    if (cargos.length === 0) return [];
    const ids = cargos.map((cargo) => cargo.cargoDirectoCatalogoId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException(
        'No se puede agregar dos veces el mismo cargo a una orden.',
      );
    const catalogos = await this.prisma.cargoDirectoCatalogo.findMany({
      where: { tenantId, id: { in: ids }, activo: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
        modoCalculo: true,
        configJson: true,
      },
    });
    if (catalogos.length !== ids.length)
      throw new NotFoundException(
        'Algún cargo no existe, está inactivo o pertenece a otro negocio.',
      );
    const porId = new Map(catalogos.map((catalogo) => [catalogo.id, catalogo]));
    return cargos.map((input) => {
      const catalogo = porId.get(input.cargoDirectoCatalogoId)!;
      const config =
        catalogo.configJson &&
        typeof catalogo.configJson === 'object' &&
        !Array.isArray(catalogo.configJson)
          ? (catalogo.configJson as Record<string, unknown>)
          : {};
      const inputConfig = input.configInput ?? {};
      let montoNeto = 0;
      let detalle = 'Monto fijo';
      const configSnapshot: Record<string, unknown> = { ...config };
      if (catalogo.modoCalculo === 'MONTO_FIJO_PLANO') {
        const zonas = Array.isArray(config.zonas) ? config.zonas : [];
        const zonaCodigo = String(
          (inputConfig.zonaAplicada as { codigo?: unknown } | undefined)
            ?.codigo ?? '',
        );
        if (zonas.length > 0) {
          const zona = zonas.find(
            (raw) =>
              raw &&
              typeof raw === 'object' &&
              String((raw as { codigo?: unknown }).codigo ?? '') === zonaCodigo,
          ) as
            | { codigo?: unknown; nombre?: unknown; monto?: unknown }
            | undefined;
          if (!zona)
            throw new BadRequestException(
              `Elegí un importe válido para el cargo "${catalogo.nombre}".`,
            );
          montoNeto = Number(zona.monto ?? 0);
          configSnapshot.zonaAplicada = {
            codigo: String(zona.codigo ?? ''),
            nombre: String(zona.nombre ?? zona.codigo ?? ''),
            monto: montoNeto,
          };
          detalle = `Zona ${String(zona.nombre ?? zona.codigo ?? '')}`;
        } else {
          montoNeto = Number(input.montoNeto);
        }
        configSnapshot.montoAplicado = montoNeto;
      } else if (catalogo.modoCalculo === 'PORCENTAJE_SOBRE_BASE') {
        const porcentaje = Number(
          inputConfig.porcentajeAplicado ??
            config.porcentaje ??
            config.porcentajeDefault ??
            0,
        );
        if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100)
          throw new BadRequestException(
            `El porcentaje del cargo "${catalogo.nombre}" debe estar entre 0 y 100.`,
          );
        montoNeto = (subtotalProductos * porcentaje) / 100;
        configSnapshot.porcentajeAplicado = porcentaje;
        detalle = `${porcentaje}% sobre subtotal`;
      } else if (catalogo.modoCalculo === 'POR_UNIDAD_INPUT') {
        const cantidad = Number(input.cantidadInput ?? 0);
        const precio = Number(
          inputConfig.precioPorUnidadAplicado ?? config.precioPorUnidad ?? 0,
        );
        if (
          !Number.isFinite(cantidad) ||
          cantidad < 0 ||
          !Number.isFinite(precio) ||
          precio < 0
        )
          throw new BadRequestException(
            `La cantidad y el precio de "${catalogo.nombre}" deben ser válidos.`,
          );
        montoNeto = cantidad * precio;
        configSnapshot.cantidadAplicada = cantidad;
        configSnapshot.precioPorUnidadAplicado = precio;
        detalle = `${cantidad} × ${precio}`;
      } else {
        throw new BadRequestException(
          `El cargo "${catalogo.nombre}" tiene un modo de cálculo no soportado.`,
        );
      }
      if (!Number.isFinite(montoNeto) || montoNeto < 0)
        throw new BadRequestException(
          `El importe del cargo "${catalogo.nombre}" no es válido.`,
        );
      const neto = redondearDinero(montoNeto, decimales);
      const impuestoPorcentaje = Number(config.impuestoPorcentaje ?? 21);
      if (
        !Number.isFinite(impuestoPorcentaje) ||
        impuestoPorcentaje < 0 ||
        impuestoPorcentaje > 100
      )
        throw new BadRequestException(
          `La alícuota configurada para "${catalogo.nombre}" no es válida.`,
        );
      const impuestoMonto = redondearDinero(
        (neto * impuestoPorcentaje) / 100,
        decimales,
      );
      return {
        id: randomUUID(),
        cargoDirectoCatalogoId: catalogo.id,
        codigoSnapshot: catalogo.codigo,
        nombreSnapshot: catalogo.nombre,
        descripcionSnapshot: catalogo.descripcion,
        modoCalculoSnapshot: catalogo.modoCalculo,
        configSnapshot,
        baseCalculo: subtotalProductos,
        cantidadInput:
          catalogo.modoCalculo === 'POR_UNIDAD_INPUT'
            ? Number(input.cantidadInput ?? 0)
            : undefined,
        montoNeto: neto,
        impuestoPorcentaje,
        impuestoMonto,
        total: redondearDinero(neto + impuestoMonto, decimales),
        detalle,
        nota: input.nota?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
    });
  }

  private buildItemData(item: CrearOrdenTrabajoItemDto | ItemAutorizado) {
    const autorizado = item as ItemAutorizado;
    return {
      cotizacionItemId: item.cotizacionItemId ?? null,
      recetaRevisionId: autorizado.recetaRevisionId ?? null,
      recetaVersion: autorizado.recetaVersion ?? null,
      recetaHuella: autorizado.recetaHuella ?? null,
      recetaSnapshotJson: autorizado.recetaSnapshotJson ?? undefined,
      codigo: item.codigo,
      nombre: item.nombre,
      familia: item.familia,
      categoriaComercial: item.categoriaComercial ?? '',
      subcategoriaComercial: item.subcategoriaComercial ?? '',
      cantidad: item.cantidad,
      cantidadUnidad: item.cantidadUnidad,
      subtotal: item.subtotal,
      impuestos: item.impuestos,
      total: item.total,
      descuentoTipo: item.descuentoTipo ?? null,
      descuentoValor: item.descuentoValor ?? null,
      descuentoMonto: item.descuentoMonto ?? null,
      descuentoCuponId: item.descuentoCuponId ?? null,
      specsJson: (item.specs ?? []).map((spec) => ({
        etiqueta: spec.etiqueta,
        valor: spec.valor,
      })),
      adicionalesJson: item.adicionales ?? [],
    };
  }

  private async validarSnapshotDisponible(
    auth: CurrentAuth,
    ordenId: string,
    cotizacionItemId: string | undefined,
    exceptoItemId?: string,
  ) {
    if (!cotizacionItemId)
      throw new BadRequestException(
        'El producto debe tener una cotización persistida.',
      );
    const snapshot = await this.prisma.cotizacionItem.findFirst({
      where: { id: cotizacionItemId, tenantId: auth.tenantId },
      select: {
        id: true,
        cotizacionId: true,
        cantidad: true,
        snapshotJson: true,
        precioNetoTotal: true,
        impuestosPorFueraTotal: true,
        precioTotal: true,
        impuestosSnapshotJson: true,
        descuentoTipo: true,
        descuentoValor: true,
        descuentoMonto: true,
        recetaRevisionId: true,
        recetaVersion: true,
        recetaHuella: true,
      },
    });
    if (!snapshot) {
      throw new NotFoundException(
        'El item de cotización referenciado no existe.',
      );
    }
    const usado = await this.prisma.ordenTrabajoItem.count({
      where: {
        tenantId: auth.tenantId,
        ordenId,
        cotizacionItemId,
        ...(exceptoItemId ? { id: { not: exceptoItemId } } : {}),
      },
    });
    if (usado > 0) {
      throw new BadRequestException(
        'Otro producto de la orden ya referencia esa cotización.',
      );
    }
    return snapshot;
  }

  async agregarItem(
    auth: CurrentAuth,
    ordenId: string,
    payload: CrearOrdenTrabajoItemDto,
  ) {
    const { orden, usuarioNombre } = await this.cargarOrdenParaItems(
      auth,
      ordenId,
    );
    const [snapshot, regional] = await Promise.all([
      this.validarSnapshotDisponible(auth, orden.id, payload.cotizacionItemId),
      regionalDelTenant(this.prisma, auth.tenantId),
    ]);
    if (orden.cotizacionId && snapshot.cotizacionId !== orden.cotizacionId)
      throw new BadRequestException(
        'La cotización del producto no pertenece a la orden.',
      );
    const item = this.itemAutorizado(
      payload,
      snapshot,
      regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales,
    );
    this.validarMontosItems([item]);
    // La orden ya está en el taller: un item nuevo con descuento sobre el
    // umbral es el mismo gate que la emisión (si no, sería el bypass obvio:
    // emitir limpia y agregar el descuento después).
    if (orden.estado !== 'borrador') {
      await this.exigirDescuentoEmitible(auth, [item]);
      const [otros, redenciones] = await Promise.all([
        this.prisma.ordenTrabajoItem.findMany({
          where: { ordenId: orden.id },
        }),
        this.prisma.cuponRedencion.findMany({
          where: { tenantId: auth.tenantId, ordenId: orden.id },
          select: { cuponId: true },
        }),
      ]);
      await this.validarCupones(
        auth,
        orden.clienteId,
        [...otros, item] as unknown as CrearOrdenTrabajoItemDto[],
        new Set(redenciones.map((redencion) => redencion.cuponId)),
      );
    }

    const ultimo = await this.prisma.ordenTrabajoItem.aggregate({
      where: { ordenId: orden.id },
      _max: { ordenIndice: true },
    });
    let creadoId = '';
    await this.prisma.$transaction(async (tx) => {
      const reclamo = await tx.ordenTrabajo.updateMany({
        where: {
          id: orden.id,
          tenantId: auth.tenantId,
          estado: orden.estado,
          updatedAt: orden.updatedAt,
        },
        data: { updatedAt: new Date() },
      });
      if (reclamo.count !== 1)
        throw new ConflictException(
          'La orden cambió mientras agregabas el producto. Recargala e intentá nuevamente.',
        );
      const creado = await tx.ordenTrabajoItem.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          ...this.buildItemData(item),
          ordenIndice: (ultimo._max.ordenIndice ?? -1) + 1,
        },
      });
      creadoId = creado.id;
      // La orden ya está emitida: el item nuevo entra al Tablero con pasos.
      if (orden.estado === 'pendiente') {
        await this.materializarPasosItems(tx, auth.tenantId, [
          {
            id: creado.id,
            ordenId: orden.id,
            cotizacionItemId: creado.cotizacionItemId,
          },
        ]);
        const itemsCupon = await tx.ordenTrabajoItem.findMany({
          where: { ordenId: orden.id },
          select: { descuentoCuponId: true, descuentoMonto: true },
        });
        await this.reconciliarCupones(tx, auth, orden.id, itemsCupon);
      }
      if (orden.proyectoCampanaId) {
        await this.desarrolloDocumental.materializarRequisitosReceta(tx, {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          proyectoCampanaId: orden.proyectoCampanaId,
          actorUserId: auth.userId,
          actorNombre: usuarioNombre,
        });
      }
      await this.recalcularTotales(
        tx,
        orden.id,
        Number(orden.cargosDirectos ?? 0),
      );
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: 'item_agregado',
          descripcion: `Producto agregado: "${item.nombre}" · ${item.cantidad} ${item.cantidadUnidad} · ${formatearMoneda(item.total, await this.monedaDe(auth.tenantId), { decimales: 0 })}`,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemId: creado.id,
            codigo: item.codigo,
            nombre: item.nombre,
            cantidad: item.cantidad,
            total: item.total,
          },
        },
      });
    });
    await this.prepararRecorridosDeItems(auth, [creadoId]);
    return this.findOne(auth, orden.id);
  }

  async editarItem(
    auth: CurrentAuth,
    ordenId: string,
    itemId: string,
    payload: CrearOrdenTrabajoItemDto,
  ) {
    const { orden, usuarioNombre } = await this.cargarOrdenParaItems(
      auth,
      ordenId,
    );
    const existente = await this.prisma.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId: auth.tenantId, ordenId: orden.id },
    });
    if (!existente) {
      throw new NotFoundException('No se encontró el producto en la orden.');
    }
    const [snapshot, regional] = await Promise.all([
      this.validarSnapshotDisponible(
        auth,
        orden.id,
        payload.cotizacionItemId,
        existente.id,
      ),
      regionalDelTenant(this.prisma, auth.tenantId),
    ]);
    if (orden.cotizacionId && snapshot.cotizacionId !== orden.cotizacionId)
      throw new BadRequestException(
        'La cotización del producto no pertenece a la orden.',
      );
    const item = this.itemAutorizado(
      payload,
      snapshot,
      regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales,
    );
    this.validarMontosItems([item]);
    // En una orden ya emitida sólo gatea un descuento que AUMENTA: reeditar
    // specs de un item cuyo descuento ya salió firmado (o emitido por un
    // supervisor) no puede trabarse por reenviar el mismo porcentaje.
    if (
      orden.estado !== 'borrador' &&
      this.descuentoPctDe(item) > this.descuentoPctDe(existente) + 0.01
    ) {
      await this.exigirDescuentoEmitible(auth, [item]);
    }
    if (orden.estado !== 'borrador') {
      const [otros, redenciones] = await Promise.all([
        this.prisma.ordenTrabajoItem.findMany({
          where: { ordenId: orden.id, id: { not: existente.id } },
        }),
        this.prisma.cuponRedencion.findMany({
          where: { tenantId: auth.tenantId, ordenId: orden.id },
          select: { cuponId: true },
        }),
      ]);
      await this.validarCupones(
        auth,
        orden.clienteId,
        [...otros, item] as unknown as CrearOrdenTrabajoItemDto[],
        new Set(redenciones.map((redencion) => redencion.cuponId)),
      );
    }

    const antes = {
      cantidad: Number(existente.cantidad),
      subtotal: Number(existente.subtotal),
      impuestos: Number(existente.impuestos),
      total: Number(existente.total),
      specs: existente.specsJson,
      adicionales: existente.adicionalesJson,
    };
    const moneda = await this.monedaDe(auth.tenantId);
    const partes: string[] = [];
    if (antes.cantidad !== item.cantidad) {
      partes.push(
        `cantidad ${antes.cantidad} → ${item.cantidad} ${item.cantidadUnidad}`,
      );
    }
    if (antes.total !== item.total) {
      const dinero = (n: number) =>
        formatearMoneda(n, moneda, { decimales: 0 });
      partes.push(`total ${dinero(antes.total)} → ${dinero(item.total)}`);
    }
    if (partes.length === 0) partes.push('especificaciones actualizadas');

    await this.prisma.$transaction(async (tx) => {
      const reclamo = await tx.ordenTrabajo.updateMany({
        where: {
          id: orden.id,
          tenantId: auth.tenantId,
          estado: orden.estado,
          updatedAt: orden.updatedAt,
        },
        data: { updatedAt: new Date() },
      });
      if (reclamo.count !== 1)
        throw new ConflictException(
          'La orden cambió mientras editabas el producto. Recargala e intentá nuevamente.',
        );
      await tx.ordenTrabajoItem.update({
        where: { id: existente.id },
        data: this.buildItemData(item),
      });
      // Emitida: el item pudo cambiar de snapshot/ruta → pasos de nuevo.
      // No hay ejecución que pisar: ejecutar promueve a `produccion`, y ahí
      // los items quedan congelados.
      if (orden.estado === 'pendiente') {
        await this.materializarPasosItems(
          tx,
          auth.tenantId,
          [
            {
              id: existente.id,
              ordenId: orden.id,
              cotizacionItemId: item.cotizacionItemId ?? null,
            },
          ],
          { reemplazar: true },
        );
        const itemsCupon = await tx.ordenTrabajoItem.findMany({
          where: { ordenId: orden.id },
          select: { descuentoCuponId: true, descuentoMonto: true },
        });
        await this.reconciliarCupones(tx, auth, orden.id, itemsCupon);
      }
      if (orden.proyectoCampanaId) {
        await this.desarrolloDocumental.materializarRequisitosReceta(tx, {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          proyectoCampanaId: orden.proyectoCampanaId,
          actorUserId: auth.userId,
          actorNombre: usuarioNombre,
        });
      }
      await this.recalcularTotales(
        tx,
        orden.id,
        Number(orden.cargosDirectos ?? 0),
      );
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: 'item_modificado',
          descripcion: `Producto modificado: "${item.nombre}" — ${partes.join(' · ')}`,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemId: existente.id,
            antes,
            despues: {
              cantidad: item.cantidad,
              subtotal: item.subtotal,
              impuestos: item.impuestos,
              total: item.total,
              // Objetos planos: los DTOs (clases) no matchean InputJsonValue.
              specs: (item.specs ?? []).map((spec) => ({
                etiqueta: spec.etiqueta,
                valor: spec.valor,
              })),
              adicionales: item.adicionales ?? [],
            },
          },
        },
      });
    });
    await this.prepararRecorridosDeItems(auth, [existente.id]);
    return this.findOne(auth, orden.id);
  }

  async quitarItem(auth: CurrentAuth, ordenId: string, itemId: string) {
    const { orden, usuarioNombre } = await this.cargarOrdenParaItems(
      auth,
      ordenId,
    );
    const existente = await this.prisma.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId: auth.tenantId, ordenId: orden.id },
    });
    if (!existente) {
      throw new NotFoundException('No se encontró el producto en la orden.');
    }
    if (orden._count.items <= 1) {
      throw new BadRequestException(
        'La orden no puede quedar sin productos. Agregá otro antes de quitar este, o anulá la orden.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const reclamo = await tx.ordenTrabajo.updateMany({
        where: {
          id: orden.id,
          tenantId: auth.tenantId,
          estado: orden.estado,
          updatedAt: orden.updatedAt,
        },
        data: { updatedAt: new Date() },
      });
      if (reclamo.count !== 1)
        throw new ConflictException(
          'La orden cambió mientras quitabas el producto. Recargala e intentá nuevamente.',
        );
      await tx.ordenTrabajoItem.delete({ where: { id: existente.id } });
      if (orden.estado === 'pendiente') {
        const itemsCupon = await tx.ordenTrabajoItem.findMany({
          where: { ordenId: orden.id },
          select: { descuentoCuponId: true, descuentoMonto: true },
        });
        await this.reconciliarCupones(tx, auth, orden.id, itemsCupon);
      }
      await this.recalcularTotales(
        tx,
        orden.id,
        Number(orden.cargosDirectos ?? 0),
      );
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: 'item_quitado',
          descripcion: `Producto quitado: "${existente.nombre}" · ${formatearMoneda(Number(existente.total), await this.monedaDe(auth.tenantId), { decimales: 0 })}`,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemId: existente.id,
            codigo: existente.codigo,
            nombre: existente.nombre,
            cantidad: Number(existente.cantidad),
            total: Number(existente.total),
            cotizacionItemId: existente.cotizacionItemId,
          },
        },
      });
    });
    return this.findOne(auth, orden.id);
  }

  // ── Transición de estado ─────────────────────────────────────────────

  async cambiarEstado(
    auth: CurrentAuth,
    id: string,
    payload: CambiarEstadoOrdenTrabajoDto,
  ) {
    const [orden, actor, regional] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: { vendedor: { select: { nombreCompleto: true } } },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
      regionalDelTenant(this.prisma, auth.tenantId),
    ]);
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }

    const desde = orden.estado as OrdenTrabajoEstado;
    const hacia = payload.estado as OrdenTrabajoEstado;
    this.validarTransicion(desde, hacia);
    if (hacia === 'produccion') {
      await this.desarrolloDocumental.exigirGatesCumplidos(orden.id);
    }
    // Salir de borrador (a cualquier estado) es emitir: exige cliente y
    // fecha de entrega vigente, igual que la emisión directa.
    if (desde === 'borrador') {
      this.validarEmision(hacia, orden.clienteId);
      this.validarFechaEntregaEmision(
        hacia,
        orden.fechaEntrega
          ? orden.fechaEntrega.toISOString().slice(0, 10)
          : null,
        regional.zonaHoraria,
      );
      // Emitir el borrador es mandarlo al taller: mismo gate de descuento
      // que la emisión directa (F3 descuentos). Las líneas con CUPÓN quedan
      // exentas — el cupón es la autorización, y la redención de acá abajo
      // lo valida en la misma transacción.
      const itemsDescuento = await this.prisma.ordenTrabajoItem.findMany({
        where: { ordenId: orden.id },
        select: {
          subtotal: true,
          descuentoMonto: true,
          descuentoCuponId: true,
        },
      });
      await this.exigirDescuentoEmitible(
        auth,
        itemsDescuento.filter((item) => !item.descuentoCuponId),
      );
    }

    const progresoPct =
      payload.progresoPct !== undefined
        ? Math.min(100, payload.progresoPct)
        : hacia === 'finalizada' || hacia === 'entregada'
          ? 100
          : orden.progresoPct;

    // Salir de borrador es emitir → link público de seguimiento.
    const tokenSeguimiento =
      desde === 'borrador' && !orden.publicToken ? generarTokenPublico() : null;

    await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.ordenTrabajo.updateMany({
        where: {
          id: orden.id,
          tenantId: auth.tenantId,
          estado: desde,
          updatedAt: orden.updatedAt,
        },
        data: {
          estado: hacia,
          progresoPct,
          // Cualquier salida de borrador marca la emisión si faltaba.
          fechaEmision:
            desde === 'borrador' && !orden.fechaEmision
              ? new Date()
              : undefined,
          publicToken: tokenSeguimiento ?? undefined,
        },
      });
      if (actualizado.count !== 1) {
        throw new ConflictException(
          'La orden cambió de estado mientras la estabas actualizando. Recargala e intentá nuevamente.',
        );
      }
      if (tokenSeguimiento) {
        await this.enlaces.emitir(tx, {
          tenantId: auth.tenantId,
          tipo: TipoEnlacePublico.SEGUIMIENTO_OT,
          entidadId: orden.id,
          token: tokenSeguimiento,
        });
      }
      // Primera finalización: nace la deuda comercial y arranca su aging.
      // Sólo la primera (reabrir y re-finalizar no la resetea).
      if (hacia === 'finalizada') {
        await this.marcarPrimeraFinalizacion(tx, auth.tenantId, orden.id);
      }
      // Primera entrega: es el ancla del pedido de reseña. Mismo criterio que
      // arriba —sólo la primera— para que corregir el estado de una orden ya
      // entregada no le vuelva a pedir la opinión al cliente.
      if (hacia === 'entregada') {
        await tx.ordenTrabajo.updateMany({
          where: { id: orden.id, fechaEntregada: null },
          data: { fechaEntregada: new Date() },
        });
      }
      // Salir de borrador es emitir: se materializan los pasos de
      // producción del Tablero desde la trazabilidad del snapshot.
      if (desde === 'borrador') {
        const items = await tx.ordenTrabajoItem.findMany({
          where: { ordenId: orden.id },
          select: {
            id: true,
            ordenId: true,
            cotizacionItemId: true,
            descuentoCuponId: true,
            descuentoMonto: true,
          },
        });
        await this.materializarPasosItems(tx, auth.tenantId, items);
        if (orden.proyectoCampanaId) {
          await this.desarrolloDocumental.materializarRequisitosReceta(tx, {
            tenantId: auth.tenantId,
            ordenId: orden.id,
            proyectoCampanaId: orden.proyectoCampanaId,
            actorUserId: auth.userId,
            actorNombre: firmaActor(
              auth,
              actor?.nombreCompleto ??
                orden.vendedor?.nombreCompleto ??
                auth.email,
            ),
          });
        }
        // Cupones aplicados en el borrador: se redimen recién acá, que es
        // cuando la orden se compromete (misma transacción, F4 descuentos).
        await this.redimirCupones(tx, auth, orden.id, items);
        const reserva = await tx.fidelizacionReserva.findFirst({
          where: {
            tenantId: auth.tenantId,
            ordenId: orden.id,
            estado: 'RESERVADA',
          },
        });
        if (reserva) {
          await this.fidelizacion.consumirReserva(
            tx,
            auth,
            orden.id,
            reserva.id,
          );
        }
      }
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: hacia === 'pendiente' ? 'emision' : 'estado',
          descripcion:
            hacia === 'pendiente'
              ? 'OT emitida al taller'
              : `Estado: ${ORDEN_TRABAJO_ESTADO_LABELS[desde]} → ${ORDEN_TRABAJO_ESTADO_LABELS[hacia]}`,
          // El evento registra a QUIEN ejecutó el cambio, no al vendedor.
          usuarioNombre: firmaActor(auth, actor?.nombreCompleto ?? auth.email),
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            campo: 'estado',
            antes: desde,
            despues: hacia,
            ...(payload.progresoPct !== undefined
              ? { progresoPct: payload.progresoPct }
              : {}),
          },
        },
      });
      await this.fidelizacion.reconciliarOrden(tx, auth.tenantId, orden.id);
    });

    // Salir de borrador es emitir → congela la promesa; finalizar → cierra.
    if (desde === 'borrador') {
      await this.capturarEtaEmision(auth, orden.id);
    }
    if (hacia === 'finalizada' && desde !== 'finalizada') {
      await this.capturarEtaCierre(auth.tenantId, orden.id);
    }
    this.avisarAlCliente(orden.id);

    return this.findOne(auth, orden.id);
  }

  // ── Cancelación ──────────────────────────────────────────────────────

  /**
   * Cancela una orden: la saca del taller y de las ventas, dejando por escrito
   * quién, cuándo, por qué y con cuánto trabajo encima.
   *
   * Lo que NO hace, a propósito:
   *
   * - **No toca la plata.** Los cobros quedan como están: esa plata entró de
   *   verdad. Al desaparecer la orden de la deuda, lo cobrado queda como saldo
   *   a favor del cliente —que es lo que la cuenta corriente ya calcula sola—.
   *   Devolverlo es otra operación, y anular el cobro sería mentir sobre la caja.
   * - **No borra el trabajo hecho.** Los pasos, sus tramos y a quién
   *   pertenecen siguen ahí: esas horas se trabajaron y se pagaron. La orden
   *   sale del eje comercial (ventas, margen, deuda), no del eje de trabajo
   *   (horas, utilización, eficiencia).
   * - **No le avisa al cliente.** Cancelar es una conversación humana; el
   *   sistema no manda un WhatsApp por su cuenta.
   *
   * Y no se puede cancelar una orden facturada: primero hay que emitir la nota
   * de crédito, o el eje fiscal queda diciendo algo que el comercial ya negó.
   */
  async cancelar(
    auth: CurrentAuth,
    id: string,
    payload: CancelarOrdenTrabajoDto,
  ) {
    const [orden, actor] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id, tenantId: auth.tenantId },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
    ]);
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }

    const desde = orden.estado as OrdenTrabajoEstado;
    const motivo = payload.motivo.trim();

    /**
     * "Acreditar y cancelar" en un solo acto: la NC sale ANTES y fuera de la
     * transacción de la cancelación —habla con ARCA por red, y una llamada
     * externa no puede vivir dentro de una transacción de base—. Si ARCA
     * rechaza, no se cancela nada: la orden queda como estaba y el error se ve.
     */
    if (payload.emitirNotaCredito && Number(orden.facturadoTotal) > 0) {
      if (!auth.permisos?.has('administracion.anular')) {
        throw new ForbiddenException(
          'No podés emitir notas de crédito. Pedile a administración que acredite la factura y después cancelá la orden.',
        );
      }
      await this.acreditarFacturasDeOrden(auth, orden.id, motivo);
      const refrescada = await this.prisma.ordenTrabajo.findFirst({
        where: { id: orden.id, tenantId: auth.tenantId },
        select: { facturadoTotal: true },
      });
      validarCancelacion(desde, Number(refrescada?.facturadoTotal ?? 0));
    } else {
      validarCancelacion(desde, Number(orden.facturadoTotal));
    }
    if (!motivo) {
      throw new BadRequestException('Contá por qué se cancela la orden.');
    }

    // Foto del avance ANTES de tocar nada: es lo que después permite decidir
    // si se le cobra algo al cliente.
    const pasos = await this.prisma.ordenTrabajoItemPaso.findMany({
      where: { tenantId: auth.tenantId, item: { ordenId: orden.id } },
      select: {
        id: true,
        estado: true,
        tiempoRealMin: true,
        tramos: { select: { inicioEl: true, finEl: true } },
      },
    });
    const ahora = new Date();
    const pasosHechos = pasos.filter((p) => p.estado === 'hecho').length;
    const minutosReales = Math.round(
      pasos.reduce((acc, p) => {
        const asentado =
          p.tiempoRealMin != null ? Number(p.tiempoRealMin) : null;
        return acc + (asentado ?? sumaTramosMin(p.tramos));
      }, 0),
    );

    await this.prisma.$transaction(async (tx) => {
      // Reclama la versión observada antes de tocar pasos, enlaces o cupones.
      // Así dos acciones simultáneas no pueden cancelar y avanzar la misma OT.
      const cancelada = await tx.ordenTrabajo.updateMany({
        where: {
          id: orden.id,
          tenantId: auth.tenantId,
          estado: desde,
          updatedAt: orden.updatedAt,
        },
        data: {
          estado: ESTADO_CANCELADA,
          canceladaEl: ahora,
          estadoAlCancelar: desde,
          motivoCancelacion: motivo,
          canceladaPorId: auth.userId,
          canceladaPorNombre: firmaActor(
            auth,
            actor?.nombreCompleto ?? auth.email,
          ),
          pasosHechosAlCancelar: pasosHechos,
          pasosTotalAlCancelar: pasos.length,
          minutosRealesAlCancelar: minutosReales,
        },
      });
      if (cancelada.count !== 1) {
        throw new ConflictException(
          'La orden cambió mientras la estabas cancelando. Recargala antes de volver a intentar.',
        );
      }

      // 1. Los cronómetros que quedaron corriendo. Si no se cierran acá nadie
      //    los cierra: la orden sale del tablero y el barrido de fin de jornada
      //    sólo mira lo que el tablero lee.
      await tx.ordenTrabajoPasoTramo.updateMany({
        where: {
          tenantId: auth.tenantId,
          finEl: null,
          paso: { item: { ordenId: orden.id } },
        },
        data: { finEl: ahora, motivoFin: 'cancelacion' },
      });

      // 2. El tiempo trabajado se asienta en los pasos que quedaron a mitad de
      //    camino. El paso no se marca 'hecho' —no se completó—, pero sus
      //    minutos tienen que existir: son horas que el taller pagó.
      for (const paso of pasos) {
        if (paso.tiempoRealMin != null) continue;
        const abiertos = paso.tramos.filter((t) => !t.finEl);
        const minutos =
          sumaTramosMin(paso.tramos) +
          abiertos.reduce(
            (acc, t) => acc + (ahora.getTime() - t.inicioEl.getTime()) / 60_000,
            0,
          );
        if (minutos <= 0) continue;
        await tx.ordenTrabajoItemPaso.update({
          where: { id: paso.id },
          data: {
            tiempoRealMin: Math.round(minutos * 100) / 100,
            tiempoFuente: 'medido',
          },
        });
      }

      // 3. Nadie sigue teniendo esto en su mesa.
      await tx.ordenTrabajoItemPaso.updateMany({
        where: {
          tenantId: auth.tenantId,
          item: { ordenId: orden.id },
          mesaUsuarioId: { not: null },
        },
        data: { mesaUsuarioId: null },
      });

      // 4. El seguimiento no puede seguir mostrándole al cliente un trabajo
      //    que ya no se va a hacer.
      await this.enlaces.revocar(
        tx,
        TipoEnlacePublico.SEGUIMIENTO_OT,
        orden.id,
      );

      // 5. Los cupones redimidos por esta orden se liberan: un sorteo no se
      //    quema con una orden que no salió (F4 descuentos).
      await this.liberarCupones(tx, auth.tenantId, orden.id);
      await this.fidelizacion.liberarReservas(
        tx,
        auth.tenantId,
        { ordenId: orden.id },
        'Orden cancelada',
      );
      await this.fidelizacion.revertirCanjeOrden(
        tx,
        auth.tenantId,
        orden.id,
        'Orden cancelada',
      );
      await this.fidelizacion.reconciliarOrden(tx, auth.tenantId, orden.id);

      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: 'cancelacion',
          descripcion: `Orden cancelada (estaba ${ORDEN_TRABAJO_ESTADO_LABELS[desde].toLowerCase()}): ${motivo}`,
          usuarioNombre: firmaActor(auth, actor?.nombreCompleto ?? auth.email),
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            campo: 'estado',
            antes: desde,
            despues: ESTADO_CANCELADA,
            motivo,
            pasosHechos,
            pasosTotal: pasos.length,
            minutosReales,
            cobradoTotal: Number(orden.cobradoTotal),
          },
        },
      });
    });

    // La promesa de entrega de algo que no se va a entregar no es un dato de
    // precisión del pronóstico: es ruido. Post-commit y sin romper si falla,
    // igual que el resto de la telemetría del ETA.
    await this.descartarPromesasEta(auth.tenantId, orden.id);

    return this.findOne(auth, orden.id);
  }

  /**
   * Congela el nacimiento y el vencimiento de la deuda comercial. Una venta
   * común vence el mismo día que finaliza; una cuenta corriente suma el plazo
   * vigente del cliente. Reabrir o editar luego al cliente no cambia la foto.
   */
  private async marcarPrimeraFinalizacion(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
  ) {
    const orden = await tx.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId },
      select: {
        fechaFinalizada: true,
        cliente: { select: { plazoCuentaCorrienteDias: true } },
      },
    });
    if (!orden || orden.fechaFinalizada) return;

    const ahora = new Date();
    const { zonaHoraria } = await regionalDelTenant(tx, tenantId);
    const vencimiento = vencimientoComercialDesde(
      ahora,
      orden.cliente?.plazoCuentaCorrienteDias,
      zonaHoraria,
    );

    await tx.ordenTrabajo.updateMany({
      where: { id: ordenId, tenantId, fechaFinalizada: null },
      data: {
        fechaFinalizada: ahora,
        fechaVencimientoComercial: vencimiento,
      },
    });
    await this.facturacionOrdenes.aplicarAnticiposClienteAOrden(
      tx,
      tenantId,
      ordenId,
    );
  }

  /**
   * Emite una nota de crédito por cada factura viva de la orden, para poder
   * cancelarla en el mismo paso.
   *
   * Una a una y en orden: si la orden se facturó en dos veces, cada factura
   * necesita su propia NC (ARCA corrige comprobante por comprobante). Si
   * alguna falla se corta acá — las anteriores ya emitidas quedan, que es lo
   * correcto: son comprobantes fiscales reales, no un borrador que se descarta.
   */
  private async acreditarFacturasDeOrden(
    auth: CurrentAuth,
    ordenId: string,
    motivo: string,
  ): Promise<void> {
    const vinculos = await this.prisma.comprobanteOrden.findMany({
      where: {
        tenantId: auth.tenantId,
        ordenId,
        comprobante: {
          tipo: 'factura',
          estado: 'emitido',
          anuladoEl: null,
        },
      },
      select: { comprobanteId: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const v of vinculos) {
      await this.comprobantes.notaCreditoDeOrden(auth, ordenId, {
        comprobanteOrigenId: v.comprobanteId,
        motivo: `Cancelación de la orden — ${motivo}`.slice(0, 200),
      });
    }
  }

  private async descartarPromesasEta(tenantId: string, ordenId: string) {
    try {
      await this.eta.descartarPromesasAbiertas(tenantId, ordenId);
    } catch (error) {
      this.logger.error(
        `Falló el descarte de promesas de ETA (orden ${ordenId}).`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Emitir al taller (o cualquier salida de borrador) exige cliente asignado;
   * el borrador puede no tenerlo todavía (se completa antes de emitir).
   */
  validarEmision(estado: OrdenTrabajoEstado, clienteId: string | null) {
    if (estado !== 'borrador' && !clienteId) {
      throw new BadRequestException(
        'Para emitir la orden al taller tenés que asignar un cliente.',
      );
    }
  }

  /**
   * Emitir exige fecha de entrega comprometida y que no sea pasada. El
   * borrador puede no tenerla todavía.
   */
  validarFechaEntregaEmision(
    estado: OrdenTrabajoEstado,
    fechaEntrega: string | null,
    zonaHoraria: string = ZONA_DEFAULT,
  ) {
    if (estado === 'borrador') return;
    if (!fechaEntrega) {
      throw new BadRequestException(
        'Para emitir la orden definí la fecha de entrega comprometida.',
      );
    }
    const [datePart] = fechaEntrega.split('T');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(datePart) ||
      datePart < claveFechaEnZona(new Date(), zonaHoraria)
    ) {
      throw new BadRequestException(
        'La fecha de entrega no puede ser anterior a hoy.',
      );
    }
  }

  /**
   * Coherencia de montos por item: total = subtotal + impuestos, con
   * tolerancia de 1 UNIDAD de la moneda por redondeos de la capa comercial.
   * Una unidad y no un porcentaje a propósito: cubre tanto el peor caso del
   * redondeo a 2 decimales como el del redondeo a entero (CLP, o
   * `redondeoPrecio: 'entero'`), donde el error máximo es exactamente 1.
   */
  /** % de descuento de un item sobre su neto de lista (0 = sin descuento). */
  private descuentoPctDe(item: {
    subtotal: number | Prisma.Decimal;
    descuentoMonto?: number | Prisma.Decimal | null;
  }): number {
    const monto = Number(item.descuentoMonto ?? 0);
    if (monto <= 0) return 0;
    const netoLista = Number(item.subtotal) + monto;
    return netoLista > 0 ? (monto / netoLista) * 100 : 0;
  }

  /**
   * Gate de descuento en la emisión DIRECTA de OT (F3 descuentos): un
   * OPERADOR no manda al taller un descuento que supera el umbral del tenant.
   * Mismo criterio que el envío de presupuestos: SUPERVISOR/ADMIN exentos,
   * umbral null = desactivado, el igual pasa. El BORRADOR no gatea (no viaja
   * al taller) — por eso esto corre sólo al emitir, no al guardar.
   */
  private async exigirDescuentoEmitible(
    auth: CurrentAuth,
    items: Array<{
      subtotal: number | Prisma.Decimal;
      descuentoMonto?: number | Prisma.Decimal | null;
    }>,
  ) {
    if (auth.role !== RolSistema.OPERADOR) return;
    const maxPct = items.reduce(
      (max, item) => Math.max(max, this.descuentoPctDe(item)),
      0,
    );
    if (maxPct <= 0) return;
    const cfg = await this.prisma.configuracionPresupuestos.findUnique({
      where: { tenantId: auth.tenantId },
      select: { aprobacionDescuentoMaxPct: true },
    });
    const umbral =
      cfg?.aprobacionDescuentoMaxPct != null
        ? Number(cfg.aprobacionDescuentoMaxPct)
        : null;
    if (umbral == null || maxPct <= umbral) return;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    throw new BadRequestException(
      `El descuento del ${r1(maxPct)}% supera el máximo del ${r1(umbral)}% permitido sin aprobación. Guardala como borrador, emitila como presupuesto para pedir la aprobación, o pedile a un supervisor que la emita.`,
    );
  }

  /**
   * Redime los cupones aplicados a los items en la MISMA transacción que
   * emite la orden (F4 descuentos). Reserva atómica al estilo del despachador
   * de WhatsApp: el UPDATE condicional sólo incrementa si el cupón sigue
   * activo, vigente y con usos — carrera de dos vendedores por el último uso:
   * uno emite, el otro recibe el error. Cancelar la orden libera la redención.
   */
  private async redimirCupones(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    ordenId: string,
    items: Array<{
      descuentoCuponId?: string | null;
      descuentoMonto?: number | Prisma.Decimal | null;
    }>,
  ) {
    const montos = new Map<string, number>();
    for (const item of items) {
      if (!item.descuentoCuponId) continue;
      montos.set(
        item.descuentoCuponId,
        (montos.get(item.descuentoCuponId) ?? 0) +
          Number(item.descuentoMonto ?? 0),
      );
    }
    if (montos.size === 0) return;

    // Bloquea las reglas antes de revalidarlas dentro de ESTA transacción:
    // ningún supervisor puede cambiar alcance/valor/vigencia entre validar y
    // tomar el uso.
    const idsCupon = [...montos.keys()];
    await tx.$queryRaw`
      SELECT "id" FROM "Cupon"
      WHERE "tenantId" = ${auth.tenantId}::uuid
        AND "id" IN (${Prisma.join(idsCupon.map((id) => Prisma.sql`${id}::uuid`))})
      FOR UPDATE`;
    const orden = await tx.ordenTrabajo.findUniqueOrThrow({
      where: { id: ordenId },
      select: { clienteId: true, cotizacionId: true },
    });
    const reservas = orden.cotizacionId
      ? await tx.cuponRedencion.findMany({
          where: {
            tenantId: auth.tenantId,
            cotizacionId: orden.cotizacionId,
            cuponId: { in: idsCupon },
            estado: { in: ['RESERVADA', 'CONSUMIDA'] },
          },
          select: { id: true, cuponId: true, estado: true, ordenId: true },
        })
      : [];
    const reservasPorCupon = new Map(
      reservas.map((reserva) => [reserva.cuponId, reserva]),
    );
    await this.validarCupones(
      auth,
      orden.clienteId,
      items as CrearOrdenTrabajoItemDto[],
      new Set(reservas.map((reserva) => reserva.cuponId)),
      tx,
    );

    for (const [cuponId, monto] of montos) {
      const reserva = reservasPorCupon.get(cuponId);
      if (reserva) {
        if (reserva.estado === 'RESERVADA') {
          await tx.cuponRedencion.update({
            where: { id: reserva.id },
            data: {
              estado: 'CONSUMIDA',
              ordenId: reserva.ordenId ?? ordenId,
              montoAplicado: monto,
              consumidaEl: new Date(),
            },
          });
        }
        // La reserva del presupuesto ya contabilizó el uso. En conversiones
        // parciales las OTs posteriores comparten ese mismo uso.
        continue;
      }
      const anterior = await tx.cuponRedencion.findUnique({
        where: { cuponId_ordenId: { cuponId, ordenId } },
      });
      const tomados = await tx.$executeRaw`
        UPDATE "Cupon" SET "usoCount" = "usoCount" + 1
        WHERE "id" = ${cuponId}::uuid AND "tenantId" = ${auth.tenantId}::uuid
          AND "activo" = true
          AND ("usoMax" IS NULL OR "usoCount" < "usoMax")`;
      if (tomados === 0) {
        // Diagnóstico para el error: por qué no se pudo tomar.
        const cupon = await tx.cupon.findFirst({
          where: { id: cuponId, tenantId: auth.tenantId },
          select: {
            codigo: true,
            activo: true,
            usoMax: true,
            usoCount: true,
            vigenciaHasta: true,
          },
        });
        const motivo = !cupon
          ? 'el cupón ya no existe'
          : !cupon.activo
            ? `el cupón ${cupon.codigo} fue desactivado`
            : cupon.usoMax != null && cupon.usoCount >= cupon.usoMax
              ? `el cupón ${cupon.codigo} se quedó sin usos`
              : `el cupón ${cupon.codigo} venció`;
        throw new BadRequestException(
          `No se pudo emitir: ${motivo}. Quitá el descuento del cupón y volvé a intentar.`,
        );
      }
      const dataRedencion = {
        estado: 'CONSUMIDA',
        montoAplicado: monto,
        actorId: auth.userId,
        actorNombre: firmaActor(
          auth,
          auth.mcp?.credencialNombre ?? auth.email ?? 'Usuario',
        ),
        consumidaEl: new Date(),
        liberadaEl: null,
        liberadaMotivo: null,
      } as const;
      if (anterior) {
        await tx.cuponRedencion.update({
          where: { id: anterior.id },
          data: dataRedencion,
        });
      } else {
        await tx.cuponRedencion.create({
          data: {
            tenantId: auth.tenantId,
            cuponId,
            ordenId,
            ...dataRedencion,
          },
        });
      }
    }
  }

  /** Mantiene una redención por cupón igual al conjunto final de la OT. */
  private async reconciliarCupones(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    ordenId: string,
    items: Array<{
      descuentoCuponId?: string | null;
      descuentoMonto?: number | Prisma.Decimal | null;
    }>,
  ) {
    const deseadas = new Map<string, number>();
    for (const item of items) {
      if (!item.descuentoCuponId) continue;
      deseadas.set(
        item.descuentoCuponId,
        (deseadas.get(item.descuentoCuponId) ?? 0) +
          Number(item.descuentoMonto ?? 0),
      );
    }
    const actuales = await tx.cuponRedencion.findMany({
      where: { tenantId: auth.tenantId, ordenId },
      select: {
        id: true,
        cuponId: true,
        montoAplicado: true,
        cotizacionId: true,
        estado: true,
      },
    });
    const actualesPorCupon = new Map(
      actuales.map((redencion) => [redencion.cuponId, redencion]),
    );

    for (const redencion of actuales) {
      const monto = deseadas.get(redencion.cuponId);
      if (monto === undefined) {
        if (!redencion.cotizacionId && redencion.estado !== 'LIBERADA') {
          await tx.cuponRedencion.update({
            where: { id: redencion.id },
            data: {
              estado: 'LIBERADA',
              liberadaEl: new Date(),
              liberadaMotivo: 'El cupón se quitó de la orden.',
            },
          });
          await tx.$executeRaw`
            UPDATE "Cupon" SET "usoCount" = GREATEST("usoCount" - 1, 0)
            WHERE "id" = ${redencion.cuponId}::uuid
              AND "tenantId" = ${auth.tenantId}::uuid`;
        }
      } else if (Number(redencion.montoAplicado) !== monto) {
        await tx.cuponRedencion.update({
          where: { id: redencion.id },
          data: { montoAplicado: monto },
        });
      }
    }

    const nuevas = items.filter(
      (item) =>
        item.descuentoCuponId && !actualesPorCupon.has(item.descuentoCuponId),
    );
    if (nuevas.length > 0) {
      await this.redimirCupones(tx, auth, ordenId, nuevas);
    }
  }

  /**
   * Cancelar una orden devuelve los usos de sus cupones (un sorteo no se
   * quema con una orden que no salió): borra la redención y decrementa el
   * contador, con piso 0 por las dudas.
   */
  private async liberarCupones(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
  ) {
    const redenciones = await tx.cuponRedencion.findMany({
      where: { tenantId, ordenId },
      select: { id: true, cuponId: true, cotizacionId: true, estado: true },
    });
    for (const redencion of redenciones) {
      // Una reserva nacida de presupuesto ya respaldó una propuesta enviada
      // al cliente; cancelar una OT no borra ni devuelve ese compromiso.
      if (redencion.cotizacionId || redencion.estado === 'LIBERADA') continue;
      await tx.cuponRedencion.update({
        where: { id: redencion.id },
        data: {
          estado: 'LIBERADA',
          liberadaEl: new Date(),
          liberadaMotivo: 'Orden cancelada.',
        },
      });
      await tx.$executeRaw`
        UPDATE "Cupon" SET "usoCount" = GREATEST("usoCount" - 1, 0)
        WHERE "id" = ${redencion.cuponId}::uuid AND "tenantId" = ${tenantId}::uuid`;
    }
  }

  validarMontosItems(
    items: Array<{
      nombre: string;
      subtotal: number;
      impuestos: number;
      total: number;
    }>,
  ) {
    for (const item of items) {
      const esperado = item.subtotal + item.impuestos;
      if (Math.abs(item.total - esperado) > 1) {
        throw new BadRequestException(
          `Los montos de "${item.nombre}" no cierran: total ${item.total} ≠ subtotal + impuestos (${esperado.toFixed(2)}).`,
        );
      }
    }
  }

  /**
   * Sólo transiciones hacia adelante en el flujo (sin saltos hacia atrás).
   *
   * `cancelada` queda FUERA de esta validación a propósito: no es una etapa más
   * adelante sino una salida lateral, y comparar índices la volvería alcanzable
   * desde cualquier lado —incluida una orden ya entregada— por accidente del
   * orden del array y no por decisión. Se cancela por su propio endpoint, que
   * es el que sabe qué hay que frenar y qué hay que cerrar. Ver `cancelar()`.
   */
  validarTransicion(desde: OrdenTrabajoEstado, hacia: OrdenTrabajoEstado) {
    if (desde === ESTADO_CANCELADA) {
      throw new BadRequestException(
        'La orden está cancelada: no se le puede cambiar el estado.',
      );
    }
    if (hacia === ESTADO_CANCELADA) {
      throw new BadRequestException(
        'Para cancelar una orden usá la acción de cancelar, que pide el motivo.',
      );
    }
    const desdeIdx = ORDEN_TRABAJO_FLUJO.indexOf(
      desde as (typeof ORDEN_TRABAJO_FLUJO)[number],
    );
    const haciaIdx = ORDEN_TRABAJO_FLUJO.indexOf(
      hacia as (typeof ORDEN_TRABAJO_FLUJO)[number],
    );
    if (desdeIdx < 0 || haciaIdx < 0) {
      throw new BadRequestException('Estado de orden inválido.');
    }
    if (haciaIdx <= desdeIdx) {
      throw new BadRequestException(
        `Transición inválida: ${ORDEN_TRABAJO_ESTADO_LABELS[desde]} → ${ORDEN_TRABAJO_ESTADO_LABELS[hacia]}. El flujo sólo avanza.`,
      );
    }
  }

  // ── Tablero de producción ────────────────────────────────────────────
  // Los pasos de producción (OrdenTrabajoItemPaso) se materializan desde el
  // snapshot del cotizador al emitir la orden; acá vive su ejecución.
  // Ver docs/tablero-produccion-conexion-diseno.md

  /** Filas de pasos a crear para un item, desde su trazabilidad. */
  private pasosDesdeTrazabilidad(
    tenantId: string,
    ordenId: string,
    itemId: string,
    trazabilidad: unknown,
    proveedorNombrePorId: Map<string, string> = new Map(),
    grafoProduccion: GrafoProduccion | null = null,
  ) {
    const pasos = pasosActivados(trazabilidad);
    return pasos.map((paso, indice) => {
      const familiaCodigo = paso.familiaCodigo ?? 'trabajo_manual';
      const familia = resolverFamilia(familiaCodigo);
      const esTercerizado = paso.tercerizado === true;
      const claveRuta = paso.rutaPasoId ? `ruta:${paso.rutaPasoId}` : null;
      const claveExtra = paso.rutaPasoId ? `extra:${paso.rutaPasoId}` : null;
      const clavesDeclaradas = new Set(
        grafoProduccion?.nodos.map((nodo) => nodo.clave) ?? [],
      );
      const nodoClave =
        (claveRuta && clavesDeclaradas.has(claveRuta) && claveRuta) ||
        (claveExtra && clavesDeclaradas.has(claveExtra) && claveExtra) ||
        claveRuta ||
        `paso:${indice + 1}:${familiaCodigo}`;
      return {
        tenantId,
        ordenId,
        itemId,
        indice,
        nodoClave,
        esTerminal: grafoProduccion
          ? grafoProduccion.terminales.includes(nodoClave)
          : indice === pasos.length - 1,
        rutaPasoId: paso.rutaPasoId ?? null,
        familiaCodigo,
        categoriaFamilia: familia?.categoria ?? 'operaciones_manuales',
        nombre: paso.nombreVisible?.trim() || familia?.nombre || familiaCodigo,
        centroCostoId: paso.tiempo?.centroCostoId ?? null,
        centroCostoNombre: paso.tiempo?.centroCostoNombre ?? null,
        maquinaId: paso.tiempo?.maquinaId ?? null,
        duracionEstimadaMin: paso.tiempo?.totalMin ?? null,
        operacionesIncorporacionSnapshotJson: paso.operacionesInternas?.length
          ? (paso.operacionesInternas.map((operacion) => ({
              ...operacion,
              modoTiempo: 'FIJO',
              cantidadResuelta: 1,
              unidadCantidad: 'etapa',
              dotacionOperarios: 1,
            })) as Prisma.InputJsonValue)
          : paso.operacionesIncorporacion?.length
            ? (paso.operacionesIncorporacion as Prisma.InputJsonValue)
            : undefined,
        modoRegistro: modoRegistroDeFamilia(familiaCodigo),
        // === Tercerización (F2): el paso comprado va al panel de Compras. ===
        tipoEjecucion: esTercerizado ? 'tercerizado' : 'interno',
        proveedorId: esTercerizado ? (paso.proveedorId ?? null) : null,
        proveedorNombre:
          esTercerizado && paso.proveedorId
            ? (proveedorNombrePorId.get(paso.proveedorId) ?? null)
            : null,
        plazoProveedorDias: esTercerizado
          ? (paso.plazoProveedorDias ?? null)
          : null,
        estadoCompra: esTercerizado ? 'pendiente' : null,
      };
    });
  }

  /**
   * Materializa los pasos de producción de los items dados. Con
   * `reemplazar` pisa los existentes (edición de item en `pendiente`, donde
   * todavía no puede haber ejecución: ejecutar promueve a `produccion`, que
   * congela los items).
   */
  private async materializarPasosItems(
    tx: Prisma.TransactionClient,
    tenantId: string,
    items: ItemAMaterializar[],
    opts?: { reemplazar?: boolean },
  ) {
    const conSnapshot = items.filter((item) => item.cotizacionItemId);
    if (opts?.reemplazar && items.length > 0) {
      await tx.ordenTrabajoItemPaso.deleteMany({
        where: { tenantId, itemId: { in: items.map((item) => item.id) } },
      });
    }
    if (conSnapshot.length === 0) return;

    const snapshots = await tx.cotizacionItem.findMany({
      where: {
        id: { in: conSnapshot.map((item) => item.cotizacionItemId!) },
        tenantId,
      },
      select: { id: true, trazabilidadJson: true },
    });
    const trazabilidadPorId = new Map(
      snapshots.map((snap) => [snap.id, snap.trazabilidadJson]),
    );
    const itemsConReceta = await tx.ordenTrabajoItem.findMany({
      where: {
        tenantId,
        id: { in: conSnapshot.map((item) => item.id) },
      },
      select: { id: true, recetaSnapshotJson: true },
    });
    const grafoPorItem = new Map(
      itemsConReceta.map((item) => [
        item.id,
        grafoDesdeSnapshotReceta(item.recetaSnapshotJson),
      ]),
    );
    // Snapshot del nombre de cada proveedor de los pasos tercerizados.
    const proveedorIds = new Set<string>();
    for (const snap of snapshots) {
      for (const paso of pasosActivados(snap.trazabilidadJson)) {
        if (paso.tercerizado && paso.proveedorId) {
          proveedorIds.add(paso.proveedorId);
        }
      }
    }
    const proveedorNombrePorId = new Map<string, string>();
    if (proveedorIds.size > 0) {
      const provs = await tx.proveedor.findMany({
        where: { tenantId, id: { in: [...proveedorIds] } },
        select: { id: true, nombre: true },
      });
      for (const p of provs) proveedorNombrePorId.set(p.id, p.nombre);
    }
    const dataPorItem = new Map(
      conSnapshot.map((item) => {
        const filas = this.pasosDesdeTrazabilidad(
          tenantId,
          item.ordenId,
          item.id,
          trazabilidadPorId.get(item.cotizacionItemId!),
          proveedorNombrePorId,
          grafoPorItem.get(item.id) ?? null,
        );
        const grafoCompleto = grafoPorItem.get(item.id);
        if (grafoCompleto) {
          const grafoEfectivo = reducirGrafoAClaves(
            grafoCompleto,
            new Set(filas.map((fila) => fila.nodoClave)),
          );
          grafoPorItem.set(item.id, grafoEfectivo);
          for (const fila of filas) {
            fila.esTerminal = grafoEfectivo.terminales.includes(fila.nodoClave);
          }
        }
        return [item.id, filas] as const;
      }),
    );
    const data = [...dataPorItem.values()].flat();
    if (data.length > 0) {
      // skipDuplicates = ON CONFLICT DO NOTHING contra el único
      // (itemId, indice): si dos materializaciones corren a la vez, el
      // perdedor no inserta en vez de reventar una lectura del tablero.
      await tx.ordenTrabajoItemPaso.createMany({ data, skipDuplicates: true });

      // La Fase 4 nace compatible: toda ruta histórica lineal se compila a un
      // DAG trivial A → B → C. `indice` conserva el orden visual, mientras
      // estas aristas pasan a ser el contrato de precedencia explícito.
      const pasosPersistidos = await tx.ordenTrabajoItemPaso.findMany({
        where: {
          tenantId,
          itemId: { in: conSnapshot.map((item) => item.id) },
        },
        select: {
          id: true,
          itemId: true,
          indice: true,
          nodoClave: true,
        },
        orderBy: [{ itemId: 'asc' }, { indice: 'asc' }],
      });
      const pasosPorItem = new Map<string, typeof pasosPersistidos>();
      for (const paso of pasosPersistidos) {
        const actuales = pasosPorItem.get(paso.itemId) ?? [];
        actuales.push(paso);
        pasosPorItem.set(paso.itemId, actuales);
      }

      const dependencias = conSnapshot.flatMap((item) => {
        const pasosItem = pasosPorItem.get(item.id) ?? [];
        const grafo = grafoPorItem.get(item.id);
        if (grafo) {
          const porClave = new Map(
            pasosItem.flatMap((paso) =>
              paso.nodoClave ? [[paso.nodoClave, paso.id] as const] : [],
            ),
          );
          return grafo.aristas.map((arista) => ({
            tenantId,
            ordenId: item.ordenId,
            predecesorPasoId: porClave.get(arista.desdeClave)!,
            sucesorPasoId: porClave.get(arista.haciaClave)!,
          }));
        }
        return pasosItem.slice(1).map((paso, index) => ({
          tenantId,
          ordenId: item.ordenId,
          predecesorPasoId: pasosItem[index].id,
          sucesorPasoId: paso.id,
        }));
      });
      if (dependencias.length > 0) {
        await tx.ordenTrabajoPasoDependencia.createMany({
          data: dependencias,
          skipDuplicates: true,
        });
      }

      const gatesOperativos = conSnapshot.flatMap((item) => {
        const pasosItem = pasosPorItem.get(item.id) ?? [];
        const porClave = new Map(
          pasosItem.flatMap((paso) =>
            paso.nodoClave ? [[paso.nodoClave, paso.id] as const] : [],
          ),
        );
        return (grafoPorItem.get(item.id)?.nodos ?? []).flatMap((nodo) =>
          (nodo.gates ?? []).flatMap((tipo) => {
            const pasoId = porClave.get(nodo.clave);
            return pasoId
              ? [{ tenantId, ordenId: item.ordenId, pasoId, tipo }]
              : [];
          }),
        );
      });
      if (gatesOperativos.length > 0) {
        await tx.ordenTrabajoPasoGate.createMany({
          data: gatesOperativos,
          skipDuplicates: true,
        });
      }

      for (const item of conSnapshot) {
        const pasosItem = pasosPorItem.get(item.id) ?? [];
        if (pasosItem.length === 0) continue;
        const grafo =
          grafoPorItem.get(item.id) ??
          compilarRutaLineal(
            pasosItem.map((paso) => ({
              clave: paso.nodoClave ?? `paso:${paso.indice + 1}`,
              indice: paso.indice,
            })),
          );
        await tx.ordenTrabajoItem.update({
          where: { id: item.id },
          data: {
            topologiaProduccion: grafo.topologia,
            grafoProduccionSnapshotJson: grafo as Prisma.InputJsonValue,
          },
        });
      }

      await this.materializarComponentesFabricados(
        tx,
        tenantId,
        conSnapshot.map((item) => item.id),
      );
    }
  }

  /**
   * Convierte cada componente INDEPENDIENTE versionado por Fase 3 en un item
   * hijo ejecutable y conecta sus terminales al nodo de incorporación padre.
   * La cola admite componentes anidados; la validación de recetas ya impide
   * ciclos y el unique (parentItemId, componenteCodigo) lo vuelve idempotente.
   */
  private async materializarComponentesFabricados(
    tx: Prisma.TransactionClient,
    tenantId: string,
    padresIniciales: string[],
  ) {
    const pendientes = [...padresIniciales];
    const visitados = new Set<string>();
    while (pendientes.length > 0) {
      const padreId = pendientes.shift()!;
      if (visitados.has(padreId)) continue;
      visitados.add(padreId);
      const padre = await tx.ordenTrabajoItem.findFirst({
        where: { id: padreId, tenantId },
        include: {
          cotizacionItem: {
            select: { jobContextJson: true, trazabilidadJson: true },
          },
          recetaRevision: {
            include: { componentes: { orderBy: { orden: 'asc' } } },
          },
        },
      });
      if (!padre?.recetaRevision) continue;

      for (const componente of padre.recetaRevision.componentes) {
        // Publicaciones F3 anteriores a la convergencia conservan su ejecución
        // histórica: sólo las nuevas revisiones con nodo declarado crean red.
        if (
          componente.politicaEjecucion !== 'INDEPENDIENTE' ||
          !componente.nodoIncorporacionClave
        ) {
          continue;
        }
        const revisionHija = await tx.productoRecetaRevision.findFirst({
          where: {
            id: componente.recetaRevisionId,
            tenantId,
            estado: { in: ['PUBLICADA', 'DEPRECADA'] },
          },
          include: { recursos: { orderBy: { orden: 'asc' } } },
        });
        if (!revisionHija) {
          throw new ConflictException(
            `La receta congelada del componente "${componente.nombre}" ya no está disponible.`,
          );
        }

        const contextoPadreCrudo =
          padre.jobContextSnapshotJson ?? padre.cotizacionItem?.jobContextJson;
        const contextoPadreLeido =
          contextoPadreCrudo &&
          typeof contextoPadreCrudo === 'object' &&
          !Array.isArray(contextoPadreCrudo)
            ? (contextoPadreCrudo as Record<string, unknown>)
            : {};
        const contextoPadre = {
          cantidad: Number(padre.cantidad),
          ...contextoPadreLeido,
        };
        const traza =
          padre.cotizacionItem?.trazabilidadJson &&
          typeof padre.cotizacionItem.trazabilidadJson === 'object' &&
          !Array.isArray(padre.cotizacionItem.trazabilidadJson)
            ? (padre.cotizacionItem.trazabilidadJson as Record<string, unknown>)
            : null;
        const costeados = Array.isArray(traza?.componentesFabricados)
          ? traza.componentesFabricados
          : [];
        const outputsComponentes = Object.fromEntries(
          costeados.flatMap((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
              return [];
            }
            const snapshot = item as Record<string, unknown>;
            const codigo = snapshot.codigo;
            const outputs = snapshot.outputsPublicos;
            return typeof codigo === 'string' &&
              outputs &&
              typeof outputs === 'object' &&
              !Array.isArray(outputs)
              ? [[codigo, outputs as Record<string, unknown>]]
              : [];
          }),
        );
        const costeado = costeados.find(
          (item) =>
            item &&
            typeof item === 'object' &&
            !Array.isArray(item) &&
            (item as Record<string, unknown>).codigo === componente.codigo,
        ) as Record<string, unknown> | undefined;
        const jobContextHijoCrudo = costeado?.jobContext;
        const jobContextHijo =
          jobContextHijoCrudo &&
          typeof jobContextHijoCrudo === 'object' &&
          !Array.isArray(jobContextHijoCrudo)
            ? (jobContextHijoCrudo as Record<string, unknown>)
            : resolverJobContextComponente({
                configuracion: componente.configuracionJson,
                contextoPadre,
                codigoComponente: componente.codigo,
                cantidadLegacy: Number(componente.cantidad),
                outputsComponentes,
              });

        let hijo = await tx.ordenTrabajoItem.findFirst({
          where: {
            tenantId,
            parentItemId: padre.id,
            componenteCodigo: componente.codigo,
          },
        });
        if (!hijo) {
          hijo = await tx.ordenTrabajoItem.create({
            data: {
              tenantId,
              ordenId: padre.ordenId,
              parentItemId: padre.id,
              componenteCodigo: componente.codigo,
              nodoIncorporacionClave: componente.nodoIncorporacionClave,
              recetaRevisionId: revisionHija.id,
              recetaVersion: revisionHija.numero,
              recetaHuella: revisionHija.huellaConfiguracion,
              recetaSnapshotJson:
                revisionHija.snapshotJson as Prisma.InputJsonValue,
              jobContextSnapshotJson: jobContextHijo as Prisma.InputJsonValue,
              topologiaProduccion: revisionHija.topologiaProduccion,
              grafoProduccionSnapshotJson:
                (revisionHija.grafoProduccionJson as Prisma.InputJsonValue) ??
                undefined,
              codigo: `${padre.codigo}/${componente.codigo}`.slice(0, 180),
              nombre: componente.nombre,
              familia: 'Componente fabricado',
              categoriaComercial: 'Producción interna',
              subcategoriaComercial: 'Componente fabricado',
              cantidad: Number(jobContextHijo.cantidad),
              cantidadUnidad: componente.unidad,
              subtotal: 0,
              impuestos: 0,
              total: 0,
              ordenIndice: padre.ordenIndice,
            },
          });
        }

        const snapshot = revisionHija.snapshotJson as unknown as {
          pasos?: Array<{
            clave?: string;
            nombre?: string;
            familiaCodigo?: string;
            orden?: number;
            recurso?: {
              plazoProveedorDias?: number | null;
            };
          }>;
        };
        const pasosSnapshot = Array.isArray(snapshot.pasos)
          ? snapshot.pasos
          : [];
        const grafoGuardado = revisionHija.grafoProduccionJson as
          | (GrafoProduccion & Prisma.JsonObject)
          | null;
        const grafoHijo = grafoGuardado
          ? (grafoGuardado as unknown as GrafoProduccion)
          : compilarRutaLineal(
              pasosSnapshot.map((paso, index) => ({
                clave: paso.clave ?? `paso:${index + 1}`,
                indice: paso.orden ?? index,
              })),
            );
        const recursoPorClave = new Map(
          revisionHija.recursos.map((recurso) => [recurso.pasoClave, recurso]),
        );
        const snapshotPorClave = new Map(
          pasosSnapshot.flatMap((paso) =>
            paso.clave ? [[paso.clave, paso] as const] : [],
          ),
        );
        const pasosCosteados = Array.isArray(costeado?.pasos)
          ? (costeado.pasos as PasoTrazabilidad[])
          : [];
        const clavesDeclaradas = new Set(
          grafoHijo.nodos.map((nodo) => nodo.clave),
        );
        const claveDePasoCosteado = (paso: PasoTrazabilidad) => {
          if (!paso.rutaPasoId) return null;
          const ruta = `ruta:${paso.rutaPasoId}`;
          const extra = `extra:${paso.rutaPasoId}`;
          if (clavesDeclaradas.has(ruta)) return ruta;
          if (clavesDeclaradas.has(extra)) return extra;
          return null;
        };
        const clavesActivasHijas = new Set(
          pasosCosteados
            .filter((paso) => paso.activado)
            .map(claveDePasoCosteado)
            .filter((clave): clave is string => Boolean(clave)),
        );
        const grafoHijoEfectivo =
          pasosCosteados.length > 0
            ? reducirGrafoAClaves(grafoHijo, clavesActivasHijas)
            : grafoHijo;
        const filasHijas =
          pasosCosteados.length > 0
            ? this.pasosDesdeTrazabilidad(
                tenantId,
                padre.ordenId,
                hijo.id,
                { pasos: pasosCosteados },
                new Map(),
                grafoHijoEfectivo,
              )
            : grafoHijoEfectivo.nodos.map((nodo) => {
                const recurso = recursoPorClave.get(nodo.clave);
                const pasoSnapshot = snapshotPorClave.get(nodo.clave);
                const familiaCodigo =
                  recurso?.familiaCodigo ??
                  pasoSnapshot?.familiaCodigo ??
                  'trabajo_manual';
                const familia = resolverFamilia(familiaCodigo);
                return {
                  tenantId,
                  ordenId: padre.ordenId,
                  itemId: hijo!.id,
                  indice: nodo.indice,
                  nodoClave: nodo.clave,
                  esTerminal: grafoHijoEfectivo.terminales.includes(nodo.clave),
                  rutaPasoId: nodo.clave.replace(/^(ruta|extra):/, ''),
                  familiaCodigo,
                  categoriaFamilia:
                    familia?.categoria ?? 'operaciones_manuales',
                  nombre:
                    recurso?.pasoNombre ??
                    pasoSnapshot?.nombre ??
                    familia?.nombre ??
                    familiaCodigo,
                  centroCostoId: recurso?.centroCostoId ?? null,
                  centroCostoNombre: recurso?.centroCostoNombre ?? null,
                  maquinaId: recurso?.maquinaId ?? null,
                  duracionEstimadaMin: null,
                  operacionesIncorporacionSnapshotJson: undefined,
                  modoRegistro: modoRegistroDeFamilia(familiaCodigo),
                  tipoEjecucion: recurso?.tercerizado
                    ? 'tercerizado'
                    : 'interno',
                  proveedorId: recurso?.proveedorId ?? null,
                  proveedorNombre: recurso?.proveedorNombre ?? null,
                  plazoProveedorDias:
                    pasoSnapshot?.recurso?.plazoProveedorDias ?? null,
                  estadoCompra: recurso?.tercerizado ? 'pendiente' : null,
                };
              });
        if (filasHijas.length > 0) {
          await tx.ordenTrabajoItemPaso.createMany({
            data: filasHijas,
            skipDuplicates: true,
          });
        }
        const pasosHijos = await tx.ordenTrabajoItemPaso.findMany({
          where: { tenantId, itemId: hijo.id },
          select: { id: true, nodoClave: true },
        });
        const idPorClave = new Map(
          pasosHijos.flatMap((paso) =>
            paso.nodoClave ? [[paso.nodoClave, paso.id] as const] : [],
          ),
        );
        const gatesHijos = grafoHijoEfectivo.nodos.flatMap((nodo) =>
          (nodo.gates ?? []).flatMap((tipo) => {
            const pasoId = idPorClave.get(nodo.clave);
            return pasoId
              ? [{ tenantId, ordenId: padre.ordenId, pasoId, tipo }]
              : [];
          }),
        );
        if (gatesHijos.length > 0) {
          await tx.ordenTrabajoPasoGate.createMany({
            data: gatesHijos,
            skipDuplicates: true,
          });
        }
        const aristasHijas = grafoHijoEfectivo.aristas.map((arista) => ({
          tenantId,
          ordenId: padre.ordenId,
          predecesorPasoId: idPorClave.get(arista.desdeClave)!,
          sucesorPasoId: idPorClave.get(arista.haciaClave)!,
        }));
        const incorporacion = await tx.ordenTrabajoItemPaso.findFirst({
          where: {
            tenantId,
            itemId: padre.id,
            nodoClave: componente.nodoIncorporacionClave,
          },
          select: { id: true },
        });
        if (!incorporacion) {
          throw new ConflictException(
            `No se pudo ubicar el nodo de incorporación de "${componente.nombre}" en la OT.`,
          );
        }
        const convergencias = grafoHijoEfectivo.terminales.map((clave) => ({
          tenantId,
          ordenId: padre.ordenId,
          predecesorPasoId: idPorClave.get(clave)!,
          sucesorPasoId: incorporacion.id,
          tipo: 'componente_fabricado',
        }));
        const clavesPredecesoras = componente.nodosPredecesoresClaves ?? [];
        const predecesoresPadre = clavesPredecesoras.length
          ? await tx.ordenTrabajoItemPaso.findMany({
              where: {
                tenantId,
                itemId: padre.id,
                nodoClave: { in: clavesPredecesoras },
              },
              select: { id: true },
            })
          : [];
        const habilitaciones = predecesoresPadre.flatMap((predecesor) =>
          grafoHijoEfectivo.raices.map((clave) => ({
            tenantId,
            ordenId: padre.ordenId,
            predecesorPasoId: predecesor.id,
            sucesorPasoId: idPorClave.get(clave)!,
            tipo: 'componente_fabricado',
          })),
        );
        const dependencias = [
          ...aristasHijas,
          ...habilitaciones,
          ...convergencias,
        ].filter(
          (dependencia) =>
            dependencia.predecesorPasoId && dependencia.sucesorPasoId,
        );
        if (dependencias.length > 0) {
          await tx.ordenTrabajoPasoDependencia.createMany({
            data: dependencias,
            skipDuplicates: true,
          });
        }
        pendientes.push(hijo.id);
      }
    }

    await this.materializarLotesNestingCompuesto(tx, tenantId, padresIniciales);
  }

  /**
   * Proyecta el lote económico congelado por el motor a una única operación
   * de taller. Los demás pasos siguen existiendo como aliases para conservar
   * la topología y la trazabilidad por componente, pero no se muestran ni se
   * ejecutan por separado.
   */
  private async materializarLotesNestingCompuesto(
    tx: Prisma.TransactionClient,
    tenantId: string,
    padresIniciales: string[],
  ) {
    for (const padreId of padresIniciales) {
      const padre = await tx.ordenTrabajoItem.findFirst({
        where: { id: padreId, tenantId },
        select: {
          ordenId: true,
          cotizacionItem: { select: { trazabilidadJson: true } },
        },
      });
      if (!padre) continue;
      const lotes = lotesNestingAplicados(
        padre.cotizacionItem?.trazabilidadJson,
      );
      if (lotes.length === 0) continue;

      const componentes = await tx.ordenTrabajoItem.findMany({
        where: { tenantId, parentItemId: padreId },
        select: {
          componenteCodigo: true,
          pasos: {
            select: {
              id: true,
              rutaPasoId: true,
              nombre: true,
            },
          },
        },
      });
      const pasosPorParticipante = new Map(
        componentes.flatMap((componente) =>
          componente.pasos.map(
            (paso) =>
              [
                `${componente.componenteCodigo ?? ''}:${paso.rutaPasoId ?? ''}`,
                paso,
              ] as const,
          ),
        ),
      );

      for (const lote of lotes) {
        const participantes = lote.participantes.map((participante) => ({
          snapshot: participante,
          paso: pasosPorParticipante.get(
            `${participante.componenteCodigo}:${participante.rutaPasoId}`,
          ),
        }));
        if (participantes.some((participante) => !participante.paso)) {
          throw new ConflictException(
            `No se pudo materializar el lote de nesting compartido ${lote.id}: falta un paso participante en la OT.`,
          );
        }
        const resueltos = participantes as Array<{
          snapshot: LoteNestingCompuestoSnapshot['participantes'][number];
          paso: { id: string; rutaPasoId: string | null; nombre: string };
        }>;
        const operativo =
          resueltos.find(
            (participante) => participante.snapshot.esPasoOperativo,
          ) ?? resueltos[0];
        const aliases = resueltos.filter(
          (participante) => participante.paso.id !== operativo.paso.id,
        );
        const idsParticipantes = resueltos.map(
          (participante) => participante.paso.id,
        );

        const [dependencias, gates] = await Promise.all([
          tx.ordenTrabajoPasoDependencia.findMany({
            where: {
              tenantId,
              ordenId: padre.ordenId,
              OR: [
                { predecesorPasoId: { in: idsParticipantes } },
                { sucesorPasoId: { in: idsParticipantes } },
              ],
            },
            select: {
              predecesorPasoId: true,
              sucesorPasoId: true,
              tipo: true,
              obligatoria: true,
            },
          }),
          tx.ordenTrabajoPasoGate.findMany({
            where: { tenantId, pasoId: { in: idsParticipantes } },
            select: { tipo: true },
          }),
        ]);
        const idsSet = new Set(idsParticipantes);
        const dependenciasOperativas = dependencias.flatMap((dependencia) => {
          if (
            idsSet.has(dependencia.sucesorPasoId) &&
            !idsSet.has(dependencia.predecesorPasoId)
          ) {
            return [{ ...dependencia, sucesorPasoId: operativo.paso.id }];
          }
          if (
            idsSet.has(dependencia.predecesorPasoId) &&
            !idsSet.has(dependencia.sucesorPasoId)
          ) {
            return [{ ...dependencia, predecesorPasoId: operativo.paso.id }];
          }
          return [];
        });
        if (dependenciasOperativas.length > 0) {
          await tx.ordenTrabajoPasoDependencia.createMany({
            data: dependenciasOperativas.map((dependencia) => ({
              tenantId,
              ordenId: padre.ordenId,
              ...dependencia,
            })),
            skipDuplicates: true,
          });
        }
        if (gates.length > 0) {
          await tx.ordenTrabajoPasoGate.createMany({
            data: [...new Set(gates.map((gate) => gate.tipo))].map((tipo) => ({
              tenantId,
              ordenId: padre.ordenId,
              pasoId: operativo.paso.id,
              tipo,
            })),
            skipDuplicates: true,
          });
        }

        await tx.ordenTrabajoItemPaso.update({
          where: { id: operativo.paso.id },
          data: {
            nestingLoteId: lote.id,
            nestingLoteRol: 'OPERATIVO',
            nestingLoteSnapshotJson: lote as unknown as Prisma.InputJsonValue,
            nombre: operativo.paso.nombre.startsWith('Nesting compartido · ')
              ? operativo.paso.nombre
              : `Nesting compartido · ${operativo.paso.nombre}`,
            duracionEstimadaMin: lote.duracionEstimadaMin,
          },
        });
        if (aliases.length > 0) {
          await tx.ordenTrabajoItemPaso.updateMany({
            where: { id: { in: aliases.map((alias) => alias.paso.id) } },
            data: {
              nestingLoteId: lote.id,
              nestingLoteRol: 'PARTICIPANTE',
              nestingLoteSnapshotJson: Prisma.JsonNull,
              duracionEstimadaMin: 0,
            },
          });
        }
      }
    }
  }

  /**
   * Materialización perezosa segura. El chequeo "items sin pasos" que hacen
   * los llamadores corre FUERA de la transacción, así que para cuando ésta
   * abre, otro request (o la emisión de la OT) puede haberlos materializado
   * ya. Se vuelve a filtrar acá adentro, y el único (itemId, indice) tapa la
   * ventana que aún queda entre este SELECT y el INSERT.
   */
  private async materializarPasosFaltantes(
    tenantId: string,
    candidatos: ItemAMaterializar[],
  ) {
    if (candidatos.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      const yaConPasos = await tx.ordenTrabajoItemPaso.findMany({
        where: { tenantId, itemId: { in: candidatos.map((c) => c.id) } },
        select: { itemId: true },
        distinct: ['itemId'],
      });
      const materializados = new Set(yaConPasos.map((p) => p.itemId));
      const faltantes = candidatos.filter((c) => !materializados.has(c.id));
      if (faltantes.length === 0) return;
      await this.materializarPasosItems(tx, tenantId, faltantes);
    });
  }

  /**
   * Backfill perezoso: órdenes emitidas ANTES de que existieran los pasos
   * materializados (o cuya trazabilidad no se procesó) reciben sus pasos la
   * primera vez que alguien abre el Tablero. Idempotente: sólo toma items
   * activos con snapshot y cero pasos.
   */
  private async backfillPasosTablero(auth: CurrentAuth) {
    const candidatos = await this.prisma.ordenTrabajoItem.findMany({
      where: {
        tenantId: auth.tenantId,
        cotizacionItemId: { not: null },
        pasos: { none: {} },
        orden: { estado: { in: ESTADOS_TABLERO } },
      },
      select: { id: true, ordenId: true, cotizacionItemId: true },
    });
    await this.materializarPasosFaltantes(auth.tenantId, candidatos);
  }

  /**
   * Cierre perezoso por jornada (D9 de registro-tiempos): el backend no
   * tiene scheduler, así que cada lectura/acción del tablero cierra los
   * tramos abiertos cuya jornada venció, retroactivamente a la HORA DE
   * CORTE del día en que se abrieron (determinístico: da lo mismo cuándo
   * corre). El paso en curso queda pausado; el operario decide continuar.
   */
  private async reconciliarTramosVencidos(tenantId: string) {
    const abiertos = await this.prisma.ordenTrabajoPasoTramo.findMany({
      where: { tenantId, finEl: null },
      select: { id: true, pasoId: true, inicioEl: true },
    });
    if (abiertos.length === 0) return;
    const config = await this.prisma.configuracionProduccion.findUnique({
      where: { tenantId },
      select: { corteJornada: true },
    });
    const corte = config?.corteJornada ?? '20:00';
    const { zonaHoraria } = await regionalDelTenant(this.prisma, tenantId);
    const ahora = new Date();
    const vencidos = abiertos
      .map((tramo) => ({
        ...tramo,
        corteEl: corteJornadaDe(tramo.inicioEl, corte, zonaHoraria),
      }))
      .filter((tramo) => tramo.corteEl <= ahora);
    if (vencidos.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      for (const tramo of vencidos) {
        await tx.ordenTrabajoPasoTramo.update({
          where: { id: tramo.id },
          data: { finEl: tramo.corteEl, motivoFin: 'fin_jornada' },
        });
        await tx.ordenTrabajoItemPaso.updateMany({
          where: { id: tramo.pasoId, estado: 'en_curso' },
          data: { estado: 'pausado' },
        });
      }
    });
  }

  /**
   * Tramos abiertos DEL usuario que mira: alimenta el widget flotante
   * "En curso" (visible en toda la app). Reconcilia primero para no
   * mostrar cronómetros de ayer.
   */
  async misTramosAbiertos(auth: CurrentAuth) {
    await this.reconciliarTramosVencidos(auth.tenantId);
    const tramos = await this.prisma.ordenTrabajoPasoTramo.findMany({
      where: { tenantId: auth.tenantId, usuarioId: auth.userId, finEl: null },
      orderBy: { inicioEl: 'asc' },
      include: {
        paso: {
          select: {
            id: true,
            ordenId: true,
            itemId: true,
            nombre: true,
            estado: true,
            duracionEstimadaMin: true,
            item: { select: { nombre: true } },
            orden: {
              select: {
                numero: true,
                cliente: { select: { nombre: true } },
              },
            },
            tramos: {
              where: { finEl: { not: null } },
              select: { inicioEl: true, finEl: true },
            },
          },
        },
      },
    });
    return {
      tramos: tramos.map((tramo) => ({
        id: tramo.id,
        pasoId: tramo.paso.id,
        ordenId: tramo.paso.ordenId,
        itemId: tramo.paso.itemId,
        pasoNombre: tramo.paso.nombre,
        itemNombre: tramo.paso.item.nombre,
        ordenNumero: tramo.paso.orden.numero,
        clienteNombre: tramo.paso.orden.cliente?.nombre ?? 'Sin cliente',
        inicioEl: tramo.inicioEl.toISOString(),
        duracionEstimadaMin:
          tramo.paso.duracionEstimadaMin != null
            ? Number(tramo.paso.duracionEstimadaMin)
            : null,
        // Minutos ya trabajados en tramos ANTERIORES (cerrados): el widget
        // los suma al cronómetro vivo para decidir si ofrecer declarar (D8).
        acumuladoPrevioMin:
          Math.round(sumaTramosMin(tramo.paso.tramos) * 100) / 100,
      })),
    };
  }

  /**
   * Pausa automática por inactividad (D13): el widget la dispara cuando el
   * operario no respondió el "¿seguís con este paso?". Cierra el tramo con
   * motivo `auto_pausa`. Si el paso ya no está corriendo (lo completaron o
   * pausaron en el medio), no-op honesto: devuelve el item actual.
   */
  async autoPausarPaso(auth: CurrentAuth, pasoId: string) {
    const paso = await this.prisma.ordenTrabajoItemPaso.findFirst({
      where: { id: pasoId, tenantId: auth.tenantId },
      select: {
        id: true,
        ordenId: true,
        itemId: true,
        estado: true,
        tramos: { where: { finEl: null }, select: { usuarioId: true } },
      },
    });
    if (!paso) {
      throw new NotFoundException('No se encontró el paso de producción.');
    }
    if (paso.estado !== 'en_curso' || paso.tramos.length === 0) {
      return this.tableroItemActualizado(auth, paso.itemId);
    }
    if (paso.tramos[0].usuarioId !== auth.userId) {
      throw new BadRequestException(
        'El tramo abierto de este paso es de otro usuario.',
      );
    }
    return this.accionPaso(
      auth,
      paso.ordenId,
      paso.itemId,
      paso.id,
      { accion: 'pausar' },
      { autoPausa: true },
    );
  }

  /** Items activos con sus pasos, personalizados por alcance efectivo. */
  async tablero(auth: CurrentAuth) {
    await this.reconciliarTramosVencidos(auth.tenantId);
    await this.backfillPasosTablero(auth);
    const alcance = alcanceTableroProduccionDe(auth);
    const puedeGestionar =
      auth.permisos?.has('produccion.ejecutar') ||
      auth.permisos?.has('produccion.supervisar') ||
      false;
    const supervisa = auth.permisos?.has('produccion.supervisar') ?? false;
    const empleadoEjecutor =
      puedeGestionar && !supervisa
        ? await this.prisma.empleado.findFirst({
            where: {
              tenantId: auth.tenantId,
              userId: auth.userId,
              activo: true,
            },
            select: {
              estaciones: { select: { estacionId: true } },
            },
          })
        : null;
    const estacionIdsEjecutables = supervisa
      ? null
      : (empleadoEjecutor?.estaciones.map((fila) => fila.estacionId) ?? []);

    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: {
        tenantId: auth.tenantId,
        estado: { in: ESTADOS_TABLERO },
      },
      include: {
        cliente: { select: { nombre: true } },
        vendedor: { select: { nombreCompleto: true } },
        items: {
          orderBy: { ordenIndice: 'asc' as const },
          include: {
            // El tablero necesita conservar la jerarquía del BOM: sin el
            // padre cargado los componentes se proyectaban como productos
            // independientes y se perdía el contexto de la OT compuesta.
            parentItem: { select: { id: true, nombre: true } },
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
                  select: { predecesorPasoId: true },
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
          },
        },
      },
      orderBy: [
        { fechaEntrega: { sort: 'asc' as const, nulls: 'last' as const } },
        { createdAt: 'asc' as const },
      ],
    });
    const tecnologias = await this.tecnologiaPorMaquinaDeItems(
      auth.tenantId,
      ordenes.flatMap((orden) => orden.items),
    );
    const items = ordenes.flatMap((orden) =>
      orden.items
        .map((item) =>
          this.toTableroItem(
            orden,
            item,
            auth.userId,
            tecnologias,
            new Map(
              orden.items.flatMap((fila) =>
                fila.pasos.map((paso) => [paso.id, paso.estado] as const),
              ),
            ),
          ),
        )
        .map((item) => item),
    );
    return {
      items,
      alcance,
      puedeGestionar,
      estacionIdsEjecutables,
      vendedorSinVinculo: false,
    };
  }

  /**
   * Pasos materializados de UNA orden — alimenta el tab "Producción" del
   * detalle de OT (ver el estado sin ir al Tablero). Reusa la misma
   * proyección que el Tablero, pero acotada a la orden y sin el filtro de
   * estados: una OT terminada muestra su ruta completa. Backfill perezoso.
   */
  async pasosDeOrden(auth: CurrentAuth, ordenId: string) {
    await this.reconciliarTramosVencidos(auth.tenantId);
    const existe = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!existe) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }
    const candidatos = await this.prisma.ordenTrabajoItem.findMany({
      where: {
        tenantId: auth.tenantId,
        ordenId,
        cotizacionItemId: { not: null },
        pasos: { none: {} },
      },
      select: { id: true, ordenId: true, cotizacionItemId: true },
    });
    await this.materializarPasosFaltantes(auth.tenantId, candidatos);
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId: auth.tenantId },
      include: {
        cliente: { select: { nombre: true } },
        vendedor: { select: { nombreCompleto: true } },
        items: {
          orderBy: { ordenIndice: 'asc' as const },
          include: {
            parentItem: { select: { id: true, nombre: true } },
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
                  select: { predecesorPasoId: true },
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
          },
        },
      },
    });
    const tecnologias = await this.tecnologiaPorMaquinaDeItems(
      auth.tenantId,
      orden?.items ?? [],
    );
    return {
      items: (orden?.items ?? []).map((item) =>
        this.toTableroItem(
          orden!,
          item,
          auth.userId,
          tecnologias,
          new Map(
            (orden?.items ?? []).flatMap((fila) =>
              fila.pasos.map((paso) => [paso.id, paso.estado] as const),
            ),
          ),
        ),
      ),
    };
  }

  /**
   * Toma o suelta un paso de "mi mesa de trabajo" (vista Por estación).
   * El reclamo es exclusivo: nunca se pisa silenciosamente el trabajo que ya
   * tomó otra persona. El update condicional también cierra la carrera entre
   * dos usuarios que intentan tomarlo al mismo tiempo.
   */
  private async validarEjecucionEnEstacion(
    auth: CurrentAuth,
    paso: { familiaCodigo: string; maquinaId: string | null },
  ) {
    if (!(auth.permisos?.has('produccion.ejecutar') ?? false)) {
      throw new ForbiddenException(
        'No tenés permiso para ejecutar producción.',
      );
    }
    const [empleado, maquina, estaciones] = await Promise.all([
      this.prisma.empleado.findFirst({
        where: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          activo: true,
        },
        select: { id: true },
      }),
      paso.maquinaId
        ? this.prisma.maquina.findFirst({
            where: { tenantId: auth.tenantId, id: paso.maquinaId },
            select: {
              plantilla: true,
              parametrosTecnicosJson: true,
              capacidadesAvanzadasJson: true,
            },
          })
        : Promise.resolve(null),
      this.prisma.estacion.findMany({
        where: { tenantId: auth.tenantId, activo: true },
        select: {
          id: true,
          activo: true,
          reglas: { select: { tipo: true, valor: true } },
          maquinas: {
            select: { id: true, centroCostoPrincipalId: true },
          },
          empleados: { select: { empleadoId: true } },
        },
      }),
    ]);
    if (!empleado) {
      throw new ForbiddenException(
        'Tu usuario debe estar vinculado a un empleado activo para ejecutar pasos.',
      );
    }
    const familia = resolverFamilia(paso.familiaCodigo);
    const estacion = resolverEstacionDePaso(
      estaciones.map((item) => ({
        ...item,
        familias: item.reglas
          .filter((regla) => regla.tipo === 'familia')
          .map((regla) => regla.valor),
        reglas: item.reglas.filter((regla) => regla.tipo !== 'familia'),
        maquinas: item.maquinas.map((itemMaquina) => ({
          id: itemMaquina.id,
          centroCostoId: itemMaquina.centroCostoPrincipalId,
        })),
      })),
      {
        familiaCodigo: paso.familiaCodigo,
        plantillaCodigo: familia?.plantillaCodigo ?? null,
        centroCostoId: null,
        maquinaId: paso.maquinaId,
        tecnologia: resolverTecnologiaMaquina(maquina),
      },
    );
    if (!estacion) {
      throw new ForbiddenException(
        'El paso no tiene una estación activa configurada.',
      );
    }
    if (!estacion.empleados.some((fila) => fila.empleadoId === empleado.id)) {
      throw new ForbiddenException(
        'No estás habilitado para ejecutar trabajos de esta estación.',
      );
    }
  }

  async mesaPaso(auth: CurrentAuth, pasoId: string, en: boolean) {
    const paso = await this.prisma.ordenTrabajoItemPaso.findFirst({
      where: { id: pasoId, tenantId: auth.tenantId },
      select: {
        id: true,
        itemId: true,
        estado: true,
        mesaUsuarioId: true,
        familiaCodigo: true,
        maquinaId: true,
      },
    });
    if (!paso) {
      throw new NotFoundException('No se encontró el paso de producción.');
    }
    if (en && !auth.permisos?.has('produccion.supervisar')) {
      await this.validarEjecucionEnEstacion(auth, paso);
    }
    if (en && paso.estado === 'hecho') {
      throw new BadRequestException(
        'El paso ya está hecho: no va a ninguna mesa.',
      );
    }
    if (en && paso.mesaUsuarioId === auth.userId) {
      return this.tableroItemActualizado(auth, paso.itemId);
    }
    if (en && paso.mesaUsuarioId) {
      throw new ConflictException(
        'Otra persona ya tomó este paso. Actualizá el tablero para ver su asignación.',
      );
    }
    if (!en && paso.mesaUsuarioId !== auth.userId) {
      throw new ConflictException(
        'No podés soltar un paso que no está en tu mesa.',
      );
    }
    const actualizado = await this.prisma.ordenTrabajoItemPaso.updateMany({
      where: {
        id: paso.id,
        tenantId: auth.tenantId,
        mesaUsuarioId: en ? null : auth.userId,
      },
      data: { mesaUsuarioId: en ? auth.userId : null },
    });
    if (actualizado.count !== 1) {
      throw new ConflictException(
        'La asignación cambió mientras operabas. Actualizá el tablero e intentá nuevamente.',
      );
    }
    return this.tableroItemActualizado(auth, paso.itemId);
  }

  /** Acción de ejecución sobre un paso (iniciar/pausar/completar/…). */
  async accionPaso(
    auth: CurrentAuth,
    ordenId: string,
    itemId: string,
    pasoId: string,
    payload: AccionPasoOrdenTrabajoDto,
    /**
     * Uso interno: `tiempoLoteMin` = prorrateo de la tanda (D11);
     * `autoPausa` = pausa sin respuesta del operario (D13, la dispara el
     * widget tras el countdown — no lleva motivo del catálogo).
     */
    interno?: { tiempoLoteMin?: number; autoPausa?: boolean },
  ) {
    await this.reconciliarTramosVencidos(auth.tenantId);
    const [paso, actor] = await Promise.all([
      this.prisma.ordenTrabajoItemPaso.findFirst({
        where: { id: pasoId, tenantId: auth.tenantId, ordenId, itemId },
        include: {
          orden: {
            select: {
              estado: true,
              progresoPct: true,
              proyectoCampanaId: true,
            },
          },
          item: { select: { nombre: true, ordenIndice: true } },
          tramos: {
            select: { id: true, usuarioId: true, inicioEl: true, finEl: true },
          },
          gatesOperativos: {
            select: { tipo: true, estado: true },
          },
        },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
    ]);
    if (!paso) {
      throw new NotFoundException('No se encontró el paso de producción.');
    }
    if (paso.nestingLoteRol === 'PARTICIPANTE') {
      throw new ConflictException(
        'Este paso forma parte de un nesting compartido y se ejecuta desde su operación principal.',
      );
    }
    const supervisa = auth.permisos?.has('produccion.supervisar') ?? false;
    if (
      (payload.accion === 'desbloquear' || payload.accion === 'reabrir') &&
      !supervisa
    ) {
      throw new ForbiddenException(
        'Sólo un supervisor puede desbloquear o reabrir pasos.',
      );
    }
    if (!supervisa) {
      await this.validarEjecucionEnEstacion(auth, paso);
      if (
        paso.mesaUsuarioId !== auth.userId &&
        !paso.tramos.some(
          (tramo) => tramo.usuarioId === auth.userId && !tramo.finEl,
        )
      ) {
        throw new ForbiddenException(
          'Este paso no está en tu mesa de trabajo.',
        );
      }
    }
    const ordenEstado = paso.orden.estado as OrdenTrabajoEstado;
    // Reabrir un paso de una OT ya finalizada la vuelve a producción (deshacer
    // la auto-finalización); el resto de acciones exige orden activa.
    const reabreFinalizada =
      ordenEstado === 'finalizada' && payload.accion === 'reabrir';
    if (!ESTADOS_TABLERO.includes(ordenEstado) && !reabreFinalizada) {
      throw new BadRequestException(
        `Con la orden en estado "${ORDEN_TRABAJO_ESTADO_LABELS[ordenEstado]}" no se pueden ejecutar pasos.`,
      );
    }

    const transicion = TRANSICIONES_PASO[payload.accion];
    const estadoActual = paso.estado as OrdenTrabajoPasoEstado;
    if (!transicion.desde.includes(estadoActual)) {
      throw new BadRequestException(
        `No se puede ${payload.accion} un paso en estado "${estadoActual}".`,
      );
    }

    // En modo solo_completar (runtime de máquina, D10) no hay cronómetro:
    // el paso se completa de un click y el tiempo asentado es el estimado.
    const esCronometro = paso.modoRegistro === 'cronometro';
    const accionCronometro =
      payload.accion === 'iniciar' ||
      payload.accion === 'pausar' ||
      payload.accion === 'continuar';
    if (!esCronometro && accionCronometro) {
      throw new BadRequestException(
        `"${paso.nombre}" es un paso de máquina: se completa directo, sin cronómetro.`,
      );
    }

    // Fase 4: para órdenes nuevas mandan las precedencias explícitas. Una OT
    // histórica sin nodoClave conserva exactamente la frontera por índice.
    const pasosOrden = await this.prisma.ordenTrabajoItemPaso.findMany({
      where: { tenantId: auth.tenantId, ordenId },
      select: {
        id: true,
        itemId: true,
        indice: true,
        nodoClave: true,
        estado: true,
      },
    });
    const pasosItem = pasosOrden.filter(
      (candidato) => candidato.itemId === itemId,
    );
    const usaGrafo =
      pasosItem.length > 0 &&
      pasosItem.every((candidato) => candidato.nodoClave);
    const dependencias = usaGrafo
      ? ((await this.prisma.ordenTrabajoPasoDependencia.findMany({
          where: { tenantId: auth.tenantId, ordenId, obligatoria: true },
          select: { predecesorPasoId: true, sucesorPasoId: true },
        })) ?? [])
      : [];
    const ejecuta =
      payload.accion === 'iniciar' ||
      payload.accion === 'pausar' ||
      payload.accion === 'continuar' ||
      payload.accion === 'completar' ||
      payload.accion === 'bloquear';
    const evaluarFrontera = (
      pasosEvaluados: typeof pasosOrden,
      dependenciasEvaluadas: typeof dependencias,
    ) => {
      const delItem = pasosEvaluados.filter(
        (candidato) => candidato.itemId === itemId,
      );
      const conGrafo =
        delItem.length > 0 && delItem.every((candidato) => candidato.nodoClave);
      if (!conGrafo) {
        return {
          ejecutable: pasoEjecutable(delItem, paso.indice),
          reabrible: pasoReabrible(delItem, paso.indice),
        };
      }
      const estados = pasosEvaluados.map((candidato) => ({
        clave: candidato.id,
        estado: candidato.estado,
      }));
      const aristas = dependenciasEvaluadas.map((dependencia) => ({
        desdeClave: dependencia.predecesorPasoId,
        haciaClave: dependencia.sucesorPasoId,
      }));
      return {
        ejecutable: nodoEjecutable(paso.id, estados, aristas),
        reabrible: nodoReabrible(paso.id, estados, aristas),
      };
    };
    const frontera = evaluarFrontera(pasosOrden, dependencias);
    const listoParaEjecutar = frontera.ejecutable;
    if (ejecuta && !listoParaEjecutar) {
      throw new BadRequestException(
        `"${paso.nombre}" todavía no está listo: faltan dependencias obligatorias por completar.`,
      );
    }
    const puedeReabrir = frontera.reabrible;
    if (payload.accion === 'reabrir' && !puedeReabrir) {
      throw new BadRequestException(
        `No se puede reabrir "${paso.nombre}": hay pasos posteriores que ya arrancaron.`,
      );
    }
    if (
      payload.accion === 'iniciar' ||
      payload.accion === 'continuar' ||
      payload.accion === 'completar'
    ) {
      const gatesPendientes = gatesOperativosPendientes(
        paso.gatesOperativos ?? [],
      );
      if (gatesPendientes.length > 0) {
        const etiquetas: Record<string, string> = {
          MATERIAL: 'material asignado/disponible',
          CALIDAD: 'condición de calidad satisfecha',
        };
        throw new ConflictException(
          `"${paso.nombre}" todavía no está listo: falta ${gatesPendientes
            .map((gate) => etiquetas[gate.tipo] ?? gate.tipo.toLowerCase())
            .join(' y ')}.`,
        );
      }
      await this.desarrolloDocumental.exigirGatesCumplidos(
        ordenId,
        paso.id,
        paso.itemId,
      );
    }

    const motivo = payload.motivo?.trim();
    if (payload.accion === 'bloquear' && !motivo) {
      throw new BadRequestException(
        'Para bloquear un paso indicá el motivo (qué lo está frenando).',
      );
    }
    if (payload.accion === 'pausar' && !interno?.autoPausa) {
      if (!motivo || !MOTIVOS_PAUSA.includes(motivo as MotivoPausa)) {
        throw new BadRequestException(
          'Para pausar un paso elegí un motivo del catálogo.',
        );
      }
      if (motivo === 'otro' && !payload.motivoDetalle?.trim()) {
        throw new BadRequestException(
          'Contanos brevemente el motivo de la pausa.',
        );
      }
    }

    const tramoAbierto = paso.tramos.find((tramo) => !tramo.finEl) ?? null;
    if (
      (payload.accion === 'iniciar' || payload.accion === 'continuar') &&
      tramoAbierto
    ) {
      throw new BadRequestException(
        `"${paso.nombre}" ya tiene un tramo de trabajo abierto.`,
      );
    }

    const usuarioNombre = firmaActor(auth, actor?.nombreCompleto ?? auth.email);
    const ahora = new Date();

    // Tiempo asentado al completar (D3): medido = suma de tramos (cerrando
    // el abierto acá mismo); un instantáneo no vale (D8) salvo que el
    // operario declare; el lote pisa con el prorrateo de la tanda (D11);
    // los pasos de máquina asientan el estimado del motor (D10).
    let tiempoRealMin: number | null = null;
    let tiempoFuente: TiempoFuente | null = null;
    if (payload.accion === 'completar') {
      const estimado =
        paso.duracionEstimadaMin != null
          ? Number(paso.duracionEstimadaMin)
          : null;
      if (interno?.tiempoLoteMin != null) {
        tiempoRealMin = Math.round(interno.tiempoLoteMin * 100) / 100;
        tiempoFuente = 'medido_lote';
      } else if (!esCronometro) {
        tiempoRealMin = estimado;
        tiempoFuente = estimado != null ? 'estimado' : 'invalido';
      } else {
        const abiertoMin = tramoAbierto
          ? (ahora.getTime() - tramoAbierto.inicioEl.getTime()) / 60_000
          : 0;
        const suma = sumaTramosMin(paso.tramos) + abiertoMin;
        if (tiempoMedidoValido(suma, estimado)) {
          tiempoRealMin = Math.round(suma * 100) / 100;
          tiempoFuente = 'medido';
        } else if (payload.tiempoDeclaradoMin != null) {
          tiempoRealMin = payload.tiempoDeclaradoMin;
          tiempoFuente = 'declarado';
        } else {
          tiempoFuente = 'invalido';
        }
      }
    }

    const data: Prisma.OrdenTrabajoItemPasoUncheckedUpdateInput = (() => {
      switch (payload.accion) {
        case 'iniciar':
        case 'continuar':
          return {
            estado: 'en_curso',
            iniciadoEl: paso.iniciadoEl ?? ahora,
            // Atribución del primer tramo (D5) + auto-reclamo de mesa (D6).
            ...(paso.iniciadoPorId == null
              ? { iniciadoPorId: auth.userId, iniciadoPorNombre: usuarioNombre }
              : {}),
            mesaUsuarioId: auth.userId,
          };
        case 'pausar':
          return { estado: 'pausado' };
        case 'completar':
          return {
            estado: 'hecho',
            completadoEl: ahora,
            iniciadoEl: paso.iniciadoEl ?? ahora,
            completadoPorId: auth.userId,
            completadoPorNombre: usuarioNombre,
            tiempoRealMin,
            tiempoFuente,
          };
        case 'bloquear':
          return { estado: 'bloqueado', motivoBloqueo: motivo };
        case 'desbloquear':
          // Volver de un bloqueo no reabre el cronómetro solo: si hubo
          // trabajo queda pausado y el operario decide continuar.
          return {
            estado: esCronometro && paso.iniciadoEl ? 'pausado' : 'pendiente',
            motivoBloqueo: null,
          };
        case 'reabrir':
          // D12: conserva iniciadoEl y los tramos históricos; el tiempo se
          // recalcula sobre todos los tramos al re-completar.
          return {
            estado: 'pendiente',
            completadoEl: null,
            tiempoRealMin: null,
            tiempoFuente: null,
            completadoPorId: null,
            completadoPorNombre: null,
          };
      }
    })();

    // Arrancar trabajo sobre una orden emitida la promueve a "produccion".
    const promueve =
      ordenEstado === 'pendiente' &&
      (payload.accion === 'iniciar' || payload.accion === 'completar');
    const letraItem = String.fromCharCode(65 + (paso.item.ordenIndice % 26));

    const ordenFinalizada = await this.prisma.$transaction(async (tx) => {
      // Serializa todas las acciones de una misma OT antes de recalcular su
      // progreso. Evita que dos pasos distintos escriban porcentajes tomados
      // de snapshots concurrentes.
      const ordenTomada = await tx.ordenTrabajo.updateMany({
        where: {
          id: ordenId,
          tenantId: auth.tenantId,
          estado: ordenEstado,
        },
        data: { updatedAt: ahora },
      });
      if (ordenTomada.count !== 1) {
        throw new ConflictException(
          'La orden cambió mientras operabas. Actualizá el tablero e intentá nuevamente.',
        );
      }

      // La fila de la orden ya está bloqueada por esta transacción. Volvemos
      // a leer la frontera para que dos operadores sobre ramas relacionadas
      // no puedan abrir/reabrir un nodo usando un snapshot concurrente viejo.
      const pasosActuales = await tx.ordenTrabajoItemPaso.findMany({
        where: { tenantId: auth.tenantId, ordenId },
        select: {
          id: true,
          itemId: true,
          indice: true,
          nodoClave: true,
          estado: true,
        },
      });
      const pasosItemActuales = pasosActuales.filter(
        (candidato) => candidato.itemId === itemId,
      );
      const usaGrafoActual =
        pasosItemActuales.length > 0 &&
        pasosItemActuales.every((candidato) => candidato.nodoClave);
      const dependenciasActuales = usaGrafoActual
        ? ((await tx.ordenTrabajoPasoDependencia.findMany({
            where: { tenantId: auth.tenantId, ordenId, obligatoria: true },
            select: { predecesorPasoId: true, sucesorPasoId: true },
          })) ?? [])
        : [];
      const fronteraActual = evaluarFrontera(
        pasosActuales,
        dependenciasActuales,
      );
      if (ejecuta && !fronteraActual.ejecutable) {
        throw new ConflictException(
          `Las dependencias de "${paso.nombre}" cambiaron mientras operabas. Actualizá el tablero.`,
        );
      }
      if (payload.accion === 'reabrir' && !fronteraActual.reabrible) {
        throw new ConflictException(
          `Un nodo descendiente de "${paso.nombre}" ya arrancó. Actualizá el tablero.`,
        );
      }

      // Compare-and-set: la transición sólo se confirma si el paso conserva
      // exactamente el estado que validamos. El segundo de dos clicks
      // concurrentes obtiene conflicto y no abre otro tramo.
      const pasoTomado = await tx.ordenTrabajoItemPaso.updateMany({
        where: {
          id: paso.id,
          tenantId: auth.tenantId,
          ordenId,
          itemId,
          estado: estadoActual,
        },
        data,
      });
      if (pasoTomado.count !== 1) {
        throw new ConflictException(
          'El paso cambió mientras operabas. Actualizá el tablero e intentá nuevamente.',
        );
      }

      // F4.4.2: el paso visible gobierna la tanda física completa. Sus
      // aliases conservan la trazabilidad de cada componente y avanzan en la
      // misma transacción, sin duplicar tiempo ni trabajo en el tablero.
      if (paso.nestingLoteRol === 'OPERATIVO' && paso.nestingLoteId) {
        await tx.ordenTrabajoItemPaso.updateMany({
          where: {
            tenantId: auth.tenantId,
            ordenId,
            nestingLoteId: paso.nestingLoteId,
            nestingLoteRol: 'PARTICIPANTE',
          },
          data: {
            ...data,
            duracionEstimadaMin: 0,
            ...(payload.accion === 'completar'
              ? { tiempoRealMin: 0, tiempoFuente: 'medido_lote' }
              : {}),
          },
        });
      }

      // Tramos (D2): iniciar/continuar abren sesión de trabajo; pausar,
      // completar y bloquear cierran la abierta con su motivo.
      if (payload.accion === 'iniciar' || payload.accion === 'continuar') {
        await tx.ordenTrabajoPasoTramo.create({
          data: {
            tenantId: auth.tenantId,
            pasoId: paso.id,
            usuarioId: auth.userId,
            usuarioNombre,
            inicioEl: ahora,
          },
        });
      } else if (tramoAbierto) {
        await tx.ordenTrabajoPasoTramo.update({
          where: { id: tramoAbierto.id },
          data: {
            finEl: ahora,
            motivoFin:
              payload.accion === 'completar'
                ? 'completado'
                : payload.accion === 'bloquear'
                  ? 'bloqueo'
                  : interno?.autoPausa
                    ? 'auto_pausa'
                    : `pausa:${motivo}`,
            ...(payload.accion === 'pausar' && motivo === 'otro'
              ? { motivoDetalle: payload.motivoDetalle?.trim() }
              : {}),
          },
        });
      }

      // Progreso real: duración estimada ponderada. El helper conserva un
      // fallback honesto por conteo cuando la orden no tiene tiempos.
      const pasosParaProgreso = await tx.ordenTrabajoItemPaso.findMany({
        where: { ordenId },
        select: { estado: true, duracionEstimadaMin: true },
      });
      const total = pasosParaProgreso.length;
      const hechos = pasosParaProgreso.filter(
        (candidato) => candidato.estado === 'hecho',
      ).length;
      const progresoPonderado = progresoPonderadoPasos(
        pasosParaProgreso.map((candidato) => ({
          estado: candidato.estado,
          duracionEstimadaMin:
            candidato.duracionEstimadaMin != null
              ? Number(candidato.duracionEstimadaMin)
              : null,
        })),
      );
      // Estado destino de la OT tras la acción:
      // - completar el último paso pendiente la FINALIZA sola;
      // - reabrir un paso de una OT finalizada la reabre a producción;
      // - el primer trabajo sobre una OT pendiente la promueve a producción.
      const nuevoEstadoOrden: OrdenTrabajoEstado | null = ordenSeFinaliza(
        payload.accion,
        total,
        hechos,
      )
        ? 'finalizada'
        : reabreFinalizada
          ? 'produccion'
          : promueve
            ? 'produccion'
            : null;
      await tx.ordenTrabajo.update({
        where: { id: ordenId },
        data: {
          ...(nuevoEstadoOrden ? { estado: nuevoEstadoOrden } : {}),
          ...(total > 0 ? { progresoPct: progresoPonderado } : {}),
        },
      });
      // Primera finalización (acá: el último paso completado la finaliza
      // solo): nace la deuda comercial y arranca su aging.
      if (nuevoEstadoOrden === 'finalizada') {
        await this.marcarPrimeraFinalizacion(tx, auth.tenantId, ordenId);
      }

      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId,
          tipo: 'paso',
          descripcion: `Producción: "${paso.nombre}" ${transicion.verbo} — item ${letraItem} · ${paso.item.nombre}${
            payload.accion === 'bloquear'
              ? ` (${motivo})`
              : payload.accion === 'pausar'
                ? ` (${
                    interno?.autoPausa
                      ? 'automática: sin respuesta'
                      : MOTIVO_PAUSA_LABELS[motivo as MotivoPausa]
                  })`
                : ''
          }`,
          usuarioNombre: interno?.autoPausa ? 'Sistema' : usuarioNombre,
          usuarioId: interno?.autoPausa ? null : auth.userId,
          origen: interno?.autoPausa ? 'sistema' : 'usuario',
          datosJson: {
            pasoId: paso.id,
            itemId,
            accion: payload.accion,
            antes: estadoActual,
            ...(paso.nestingLoteId
              ? { nestingLoteId: paso.nestingLoteId }
              : {}),
            ...(motivo ? { motivo } : {}),
          },
        },
      });
      if (nuevoEstadoOrden) {
        const nota =
          nuevoEstadoOrden === 'finalizada'
            ? 'todos los pasos completados'
            : ordenEstado === 'finalizada'
              ? 'se reabrió un paso'
              : 'arrancó la producción';
        await tx.ordenTrabajoEvento.create({
          data: {
            tenantId: auth.tenantId,
            ordenId,
            fecha: new Date(ahora.getTime() + 1),
            tipo: 'estado',
            descripcion: `Estado: ${ORDEN_TRABAJO_ESTADO_LABELS[ordenEstado]} → ${ORDEN_TRABAJO_ESTADO_LABELS[nuevoEstadoOrden]} (${nota})`,
            usuarioNombre: 'Sistema',
            usuarioId: null,
            origen: 'sistema',
            datosJson: {
              campo: 'estado',
              antes: ordenEstado,
              despues: nuevoEstadoOrden,
            },
          },
        });
      }
      await this.eventosSistema?.publicar(
        {
          tenantId: auth.tenantId,
          actorUserId: interno?.autoPausa
            ? null
            : (auth.impersonacion?.actorUserId ?? auth.userId),
          actorNombre: interno?.autoPausa ? 'Sistema' : usuarioNombre,
          tipo: `produccion.paso_${payload.accion}`,
          entidadTipo: 'orden_trabajo',
          entidadId: ordenId,
          titulo:
            nuevoEstadoOrden === 'finalizada'
              ? 'Orden finalizada'
              : payload.accion === 'bloquear'
                ? 'Producción bloqueada'
                : 'Avance de producción',
          mensaje: `“${paso.nombre}” ${transicion.verbo} en ${paso.item.nombre}.`,
          href: `/produccion/ordenes/${ordenId}`,
          severidad:
            payload.accion === 'bloquear'
              ? SeveridadNotificacionInterna.ADVERTENCIA
              : nuevoEstadoOrden === 'finalizada' ||
                  payload.accion === 'completar'
                ? SeveridadNotificacionInterna.EXITO
                : SeveridadNotificacionInterna.INFO,
          topicos: [
            `orden:${ordenId}`,
            'tablero-produccion',
            ...(paso.orden.proyectoCampanaId
              ? [`campana:${paso.orden.proyectoCampanaId}`]
              : []),
          ],
          proyectoCampanaId: paso.orden.proyectoCampanaId ?? undefined,
        },
        tx,
      );
      return nuevoEstadoOrden === 'finalizada';
    });

    // La orden se finalizó sola (último paso completado): cierra el ciclo real
    // y completa las promesas abiertas. Post-commit, best-effort.
    if (ordenFinalizada) {
      await this.capturarEtaCierre(auth.tenantId, ordenId);
    }
    this.avisarAlCliente(ordenId);

    return this.tableroItemActualizado(auth, itemId);
  }

  /**
   * Completa VARIOS pasos de una (el impresor manda varios archivos juntos
   * y no debería marcar card por card). Reusa la acción individual por
   * paso — mismas validaciones de frontera/estado, eventos, promoción de
   * orden y auto-finalización — y devuelve un resultado PARCIAL honesto:
   * los que no pudieron completarse vuelven con su motivo.
   */
  async completarPasosLote(
    auth: CurrentAuth,
    pasoIds: string[],
    duracionTandaMin?: number,
    ahorro?: AhorroConsolidacionDto,
    validarCompatibilidadLaser = false,
  ) {
    const unicos = [...new Set(pasoIds)];
    const pasos = await this.prisma.ordenTrabajoItemPaso.findMany({
      where: { id: { in: unicos }, tenantId: auth.tenantId },
      select: {
        id: true,
        ordenId: true,
        itemId: true,
        nombre: true,
        rutaPasoId: true,
        familiaCodigo: true,
        estado: true,
        tipoEjecucion: true,
        duracionEstimadaMin: true,
        item: {
          select: {
            cotizacionItem: {
              select: { jobContextJson: true, trazabilidadJson: true },
            },
            pasos: {
              where: { estado: { not: 'hecho' } },
              orderBy: { indice: 'asc' },
              take: 1,
              select: { id: true, estado: true },
            },
          },
        },
      },
    });
    const porId = new Map(pasos.map((paso) => [paso.id, paso]));

    if (validarCompatibilidadLaser) {
      if (pasos.length !== unicos.length) {
        throw new BadRequestException(
          'La tanda cambió. Actualizá la cola antes de confirmar la impresión.',
        );
      }

      const extraidas = pasos.map((paso) => ({
        paso,
        datos: extraerCompatibilidadLaser(
          paso.item.cotizacionItem?.jobContextJson ?? null,
          paso.item.cotizacionItem?.trazabilidadJson ?? null,
          paso.rutaPasoId,
        ),
      }));
      const configIds = [
        ...new Set(
          extraidas
            .map((item) => item.datos.configPasoId)
            .filter((id): id is string => id !== null),
        ),
      ];
      const configs = configIds.length
        ? await this.prisma.productoConfigPaso.findMany({
            where: { tenantId: auth.tenantId, id: { in: configIds } },
            select: { id: true, paramsPasoJson: true, maquinaM1Id: true },
          })
        : [];
      const configPorId = new Map(configs.map((item) => [item.id, item]));
      const claves = new Set<string>();

      for (const { paso, datos } of extraidas) {
        if (
          colaConsolidacionDeFamilia(paso.familiaCodigo) !== 'laser' ||
          paso.tipoEjecucion === 'tercerizado' ||
          paso.estado === 'bloqueado' ||
          paso.item.pasos[0]?.id !== paso.id
        ) {
          throw new BadRequestException(
            'La tanda cambió: uno de los trabajos ya no está listo para impresión láser.',
          );
        }
        const resuelta = aplicarFallbackConfigLaser(
          datos,
          datos.configPasoId ? configPorId.get(datos.configPasoId) : undefined,
        );
        const faltantes = faltantesCompatibilidadLaser(resuelta);
        const clave = claveCompatibilidadLoteLaser(resuelta);
        if (!clave) {
          throw new BadRequestException(
            `No se puede completar la tanda: faltan ${faltantes.join(', ')}.`,
          );
        }
        claves.add(clave);
      }
      if (claves.size !== 1) {
        throw new BadRequestException(
          'La tanda contiene trabajos con máquina, papel o configuración de impresión incompatibles.',
        );
      }
    }

    let ahorroVerificado: {
      materiaPrimaId: string;
      materiaPrimaNombre: string;
      tecnologia: string | null;
      jobs: number;
      consumoSeparadoMl: number;
      consumoConsolidadoMl: number;
      ahorroMl: number;
      costoSeparado: number | null;
      costoConsolidado: number | null;
      ahorroPesos: number | null;
      baselineParcial: boolean;
    } | null = null;

    if (ahorro) {
      if (pasos.length !== unicos.length) {
        throw new BadRequestException(
          'La tanda cambió. Actualizá la cola antes de confirmar la impresión.',
        );
      }
      const acomodo = acomodarTanda(pasos, [ahorro.anchoMm]).anchos[0];
      if (
        !acomodo ||
        acomodo.consumedLengthMm == null ||
        acomodo.piezasAcomodadas === 0 ||
        acomodo.incompatibles.length > 0
      ) {
        throw new BadRequestException(
          'El ancho elegido no admite todos los trabajos de la tanda.',
        );
      }

      const snapshots = pasos.map(snapshotAhorroPaso);
      const idsVariantes = [
        ...new Set(
          snapshots
            .map((item) => item.varianteId)
            .filter((id): id is string => id !== null),
        ),
      ];
      const variantes = await this.prisma.materiaPrimaVariante.findMany({
        where: {
          tenantId: auth.tenantId,
          id: { in: [...idsVariantes, ahorro.varianteId] },
          activo: true,
        },
        select: {
          id: true,
          materiaPrimaId: true,
          atributosVarianteJson: true,
          precioReferencia: true,
          stocks: { select: { cantidadDisponible: true } },
          materiaPrima: { select: { nombre: true } },
        },
      });
      const seleccionada = variantes.find(
        (item) => item.id === ahorro.varianteId,
      );
      const anchoSeleccionado = Number(
        (seleccionada?.atributosVarianteJson as { anchoMm?: unknown } | null)
          ?.anchoMm,
      );
      if (!seleccionada || anchoSeleccionado !== ahorro.anchoMm) {
        throw new BadRequestException(
          'El rollo seleccionado ya no está disponible para ese ancho.',
        );
      }

      const compatibilidad = claveCompatibilidadVariante(
        seleccionada.atributosVarianteJson,
      );
      const porVariante = new Map(variantes.map((item) => [item.id, item]));
      const compatibles = snapshots.every((snapshot) => {
        const variante = snapshot.varianteId
          ? porVariante.get(snapshot.varianteId)
          : null;
        return (
          variante != null &&
          variante.materiaPrimaId === seleccionada.materiaPrimaId &&
          claveCompatibilidadVariante(variante.atributosVarianteJson) ===
            compatibilidad
        );
      });
      if (!compatibles) {
        throw new BadRequestException(
          'La tanda contiene variantes de material que no se pueden imprimir juntas.',
        );
      }

      const consumoConsolidadoMl = acomodo.consumedLengthMm / 1000;
      const stockConocido = seleccionada.stocks.length > 0;
      const stockDisponible = seleccionada.stocks.reduce(
        (total, item) => total + Number(item.cantidadDisponible),
        0,
      );
      if (stockConocido && stockDisponible < consumoConsolidadoMl) {
        throw new BadRequestException(
          'El rollo seleccionado no tiene stock suficiente para la tanda.',
        );
      }

      const conConsumo = snapshots.filter(
        (item) => item.consumoCotizadoMl != null,
      );
      const conCosto = conConsumo.filter((item) => item.precioMl != null);
      const consumoSeparadoMl = conConsumo.reduce(
        (total, item) => total + (item.consumoCotizadoMl ?? 0),
        0,
      );
      const costoSeparado = conCosto.reduce(
        (total, item) =>
          total + (item.consumoCotizadoMl ?? 0) * (item.precioMl ?? 0),
        0,
      );
      const precioSeleccionado =
        seleccionada.precioReferencia != null
          ? Number(seleccionada.precioReferencia)
          : null;
      const costoConsolidado =
        precioSeleccionado != null
          ? consumoConsolidadoMl * precioSeleccionado
          : null;
      const redondear = (valor: number) => Math.round(valor * 100) / 100;
      ahorroVerificado = {
        materiaPrimaId: seleccionada.materiaPrimaId,
        materiaPrimaNombre: seleccionada.materiaPrima.nombre,
        tecnologia:
          snapshots.map((item) => item.tecnologia).find((item) => item) ?? null,
        jobs: pasos.length,
        consumoSeparadoMl: redondear(consumoSeparadoMl),
        consumoConsolidadoMl: redondear(consumoConsolidadoMl),
        ahorroMl: redondear(consumoSeparadoMl - consumoConsolidadoMl),
        costoSeparado: conCosto.length > 0 ? redondear(costoSeparado) : null,
        costoConsolidado:
          costoConsolidado != null ? redondear(costoConsolidado) : null,
        ahorroPesos:
          conCosto.length > 0 && costoConsolidado != null
            ? redondear(costoSeparado - costoConsolidado)
            : null,
        baselineParcial:
          conConsumo.length < snapshots.length ||
          conCosto.length < snapshots.length,
      };
    }

    // Prorrateo de la tanda (D11): un solo número medido para todo el lote,
    // repartido por peso del estimado. Los pasos sin estimado pesan como el
    // estimado promedio (o 1 si ninguno tiene).
    const tiempoLotePorPaso = new Map<string, number>();
    if (duracionTandaMin != null && duracionTandaMin > 0 && pasos.length > 0) {
      const estimados = pasos
        .map((paso) =>
          paso.duracionEstimadaMin != null
            ? Number(paso.duracionEstimadaMin)
            : null,
        )
        .filter((valor): valor is number => valor != null && valor > 0);
      const pesoDefault =
        estimados.length > 0
          ? estimados.reduce((a, b) => a + b, 0) / estimados.length
          : 1;
      const pesoDe = (paso: (typeof pasos)[number]) => {
        const estimado =
          paso.duracionEstimadaMin != null
            ? Number(paso.duracionEstimadaMin)
            : null;
        return estimado != null && estimado > 0 ? estimado : pesoDefault;
      };
      const sumaPesos = pasos.reduce((acc, paso) => acc + pesoDe(paso), 0);
      for (const paso of pasos) {
        tiempoLotePorPaso.set(
          paso.id,
          (duracionTandaMin * pesoDe(paso)) / sumaPesos,
        );
      }
    }

    let completados = 0;
    const errores: Array<{ pasoId: string; motivo: string }> = [];
    // Secuencial a propósito: dos pasos del lote pueden ser del mismo item
    // (la frontera avanza al completar el primero) y la promoción de la
    // orden no debe correr en paralelo consigo misma.
    for (const pasoId of unicos) {
      const paso = porId.get(pasoId);
      if (!paso) {
        errores.push({ pasoId, motivo: 'No se encontró el paso.' });
        continue;
      }
      try {
        await this.accionPaso(
          auth,
          paso.ordenId,
          paso.itemId,
          paso.id,
          { accion: 'completar' },
          { tiempoLoteMin: tiempoLotePorPaso.get(paso.id) },
        );
        completados += 1;
      } catch (error: unknown) {
        errores.push({
          pasoId,
          motivo:
            error instanceof Error ? error.message : 'No se pudo completar.',
        });
      }
    }

    // Ahorro por consolidación de la tanda (simulador gran formato): se
    // asienta SOLO si el lote completó entero — con completados parciales
    // los números del batch (calculados para la tanda completa) mentirían.
    if (ahorroVerificado && completados > 0 && errores.length === 0) {
      const actor = await this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      });
      await this.prisma.ahorroConsolidacion.create({
        data: {
          tenantId: auth.tenantId,
          usuarioId: auth.userId,
          usuarioNombre: firmaActor(auth, actor?.nombreCompleto ?? auth.email),
          materiaPrimaId: ahorroVerificado.materiaPrimaId,
          materiaPrimaNombre: ahorroVerificado.materiaPrimaNombre,
          tecnologia: ahorroVerificado.tecnologia,
          jobs: ahorroVerificado.jobs,
          consumoSeparadoMl: ahorroVerificado.consumoSeparadoMl,
          consumoConsolidadoMl: ahorroVerificado.consumoConsolidadoMl,
          ahorroMl: ahorroVerificado.ahorroMl,
          costoSeparado: ahorroVerificado.costoSeparado,
          costoConsolidado: ahorroVerificado.costoConsolidado,
          ahorroPesos: ahorroVerificado.ahorroPesos,
          baselineParcial: ahorroVerificado.baselineParcial,
        },
      });
    }

    return { completados, errores };
  }

  /** Re-proyección de un item del tablero después de una acción. */
  private async tableroItemActualizado(auth: CurrentAuth, itemId: string) {
    const item = await this.prisma.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId: auth.tenantId },
      include: {
        cotizacionItem: {
          select: {
            jobContextJson: true,
            producto: { select: { nombre: true } },
          },
        },
        pasos: {
          orderBy: { indice: 'asc' as const },
          include: {
            mesaUsuario: { select: { nombreCompleto: true, email: true } },
            dependenciasEntrantes: {
              where: { obligatoria: true },
              select: { predecesorPasoId: true },
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
        orden: {
          include: {
            cliente: { select: { nombre: true } },
            vendedor: { select: { nombreCompleto: true } },
          },
        },
      },
    });
    if (!item) {
      throw new NotFoundException('No se encontró el item de la orden.');
    }
    const tecnologias = await this.tecnologiaPorMaquinaDeItems(auth.tenantId, [
      item,
    ]);
    const estadosOrden = new Map(
      (
        await this.prisma.ordenTrabajoItemPaso.findMany({
          where: { tenantId: auth.tenantId, ordenId: item.ordenId },
          select: { id: true, estado: true },
        })
      ).map((paso) => [paso.id, paso.estado] as const),
    );
    const proyectado = this.toTableroItem(
      item.orden,
      item,
      auth.userId,
      tecnologias,
      estadosOrden,
    );
    if (alcanceTableroProduccionDe(auth) !== 'operario') return proyectado;
    return {
      ...proyectado,
      clienteNombre: 'Cliente no visible',
      vendedorNombre: '—',
      specs: [],
      pasos: pasosVisiblesParaOperario(proyectado.pasos),
    };
  }

  /**
   * Panel de Compras de la OT (F2): avanza el estado de compra de un paso
   * TERCERIZADO — pendiente → pedido → recibido → entregado. Al llegar a
   * recibido/entregado el paso pasa a `estado:'hecho'`, lo que desbloquea el
   * paso interno siguiente (secuencialidad) y lo cuenta en el progreso.
   */
  async avanzarCompra(auth: CurrentAuth, pasoId: string, estadoCompra: string) {
    const VALIDOS = ['pendiente', 'pedido', 'recibido', 'entregado'];
    if (!VALIDOS.includes(estadoCompra)) {
      throw new BadRequestException('Estado de compra inválido.');
    }
    const resultado = await this.prisma.$transaction(async (tx) => {
      const paso = await tx.ordenTrabajoItemPaso.findFirst({
        where: { id: pasoId, tenantId: auth.tenantId },
        include: { item: { select: { nombre: true } } },
      });
      if (!paso) throw new NotFoundException('Paso no encontrado.');
      if (paso.tipoEjecucion !== 'tercerizado') {
        throw new BadRequestException('El paso no es una compra tercerizada.');
      }
      // La ruta es una SECUENCIA también para las compras: no se le puede pedir
      // al proveedor hasta que lo anterior esté hecho (ej. el diseño gráfico que
      // hay que mandarle). Volver a 'pendiente' siempre se permite (es deshacer).
      if (estadoCompra !== 'pendiente') {
        const previoPendiente = await tx.ordenTrabajoItemPaso.findFirst({
          where: {
            itemId: paso.itemId,
            indice: { lt: paso.indice },
            estado: { not: 'hecho' },
          },
          orderBy: { indice: 'asc' },
          select: { nombre: true },
        });
        if (previoPendiente) {
          throw new BadRequestException(
            `No se puede avanzar la compra: falta completar "${previoPendiente.nombre}".`,
          );
        }
      }
      const recibido =
        estadoCompra === 'recibido' || estadoCompra === 'entregado';
      await tx.ordenTrabajoItemPaso.update({
        where: { id: pasoId },
        data: {
          estadoCompra,
          estado: recibido ? 'hecho' : 'pendiente',
          completadoEl: recibido ? (paso.completadoEl ?? new Date()) : null,
        },
      });
      const ordenId = paso.ordenId;
      const [orden, total, hechos] = await Promise.all([
        tx.ordenTrabajo.findFirst({
          where: { id: ordenId },
          select: { estado: true },
        }),
        tx.ordenTrabajoItemPaso.count({ where: { ordenId } }),
        tx.ordenTrabajoItemPaso.count({ where: { ordenId, estado: 'hecho' } }),
      ]);
      const promueve =
        orden?.estado === 'pendiente' && estadoCompra !== 'pendiente';
      const finaliza =
        total > 0 &&
        hechos === total &&
        (orden?.estado === 'produccion' || promueve);
      await tx.ordenTrabajo.update({
        where: { id: ordenId },
        data: {
          ...(total > 0
            ? { progresoPct: Math.round((hechos / total) * 100) }
            : {}),
          ...(finaliza
            ? { estado: 'finalizada' }
            : promueve
              ? { estado: 'produccion' }
              : {}),
        },
      });
      if (finaliza) {
        await this.marcarPrimeraFinalizacion(tx, auth.tenantId, ordenId);
      }
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId,
          tipo: 'compra',
          descripcion: `Compra tercerizada: "${paso.nombre}" (${paso.item.nombre}) → ${estadoCompra}`,
          usuarioNombre: auth.email,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: { pasoId, estadoCompra },
        },
      });
      return { ok: true, pasoId, estadoCompra, ordenId };
    });

    // Recibir una compra tercerizada puede promover la orden a producción o
    // finalizarla —ver el cálculo de `promueve`/`finaliza` de arriba—, así que
    // también tiene que avisar. Es la TERCERA puerta por la que se mueve una
    // orden; las otras dos son `cambiarEstado` y `accionPaso`.
    this.avisarAlCliente(resultado.ordenId);

    return {
      ok: resultado.ok,
      pasoId: resultado.pasoId,
      estadoCompra: resultado.estadoCompra,
    };
  }

  /**
   * Resolución manual y auditada del contrato de gate de Fase 4. Las fases de
   * Calidad e Inventario llamarán esta misma transición desde sus evidencias;
   * hasta entonces sólo un supervisor puede afirmar o revocar la condición.
   */
  async resolverGatePaso(
    auth: CurrentAuth,
    pasoId: string,
    payload: ResolverGatePasoDto,
  ) {
    const detalle = payload.detalle?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      const gate = await tx.ordenTrabajoPasoGate.findFirst({
        where: {
          tenantId: auth.tenantId,
          pasoId,
          tipo: payload.tipo,
        },
        include: {
          paso: { select: { nombre: true } },
        },
      });
      if (!gate) {
        throw new NotFoundException(
          'Ese paso no exige la condición operativa indicada.',
        );
      }
      const cumplido = payload.estado === 'CUMPLIDO';
      const actualizado = await tx.ordenTrabajoPasoGate.update({
        where: { id: gate.id },
        data: {
          estado: payload.estado,
          detalle,
          resueltoEl: cumplido ? new Date() : null,
          resueltoPorId: cumplido ? auth.userId : null,
          resueltoPorNombre: cumplido ? auth.email : null,
        },
      });
      const etiqueta = payload.tipo === 'MATERIAL' ? 'Material' : 'Calidad';
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: gate.ordenId,
          tipo: 'gate_operativo',
          descripcion: `${etiqueta} ${cumplido ? 'confirmado' : 'reabierto'} para "${gate.paso.nombre}".`,
          usuarioNombre: auth.email,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            pasoId,
            gateId: gate.id,
            tipo: payload.tipo,
            estado: payload.estado,
            detalle,
          },
        },
      });
      return {
        id: actualizado.id,
        pasoId,
        tipo: actualizado.tipo,
        estado: actualizado.estado,
        detalle: actualizado.detalle,
        resueltoEl: actualizado.resueltoEl?.toISOString() ?? null,
        resueltoPorNombre: actualizado.resueltoPorNombre,
      };
    });
  }

  /**
   * Mapa `maquinaId → tecnología` para el lote de items del tablero. La
   * tecnología NO se persiste en el paso (una sola fuente de verdad); se deriva
   * de `Maquina` en lectura para rutear "por tecnología". Una query por lote.
   */
  private async tecnologiaPorMaquinaDeItems(
    tenantId: string,
    items: Array<{ pasos: Array<{ maquinaId: string | null }> }>,
  ): Promise<Map<string, string | null>> {
    const maquinaIds = new Set<string>();
    for (const item of items) {
      for (const paso of item.pasos) {
        if (paso.maquinaId) maquinaIds.add(paso.maquinaId);
      }
    }
    if (maquinaIds.size === 0) return new Map();
    const maquinas = await this.prisma.maquina.findMany({
      where: { tenantId, id: { in: Array.from(maquinaIds) } },
      select: {
        id: true,
        plantilla: true,
        parametrosTecnicosJson: true,
        capacidadesAvanzadasJson: true,
      },
    });
    return new Map(
      maquinas.map((m) => [m.id, resolverTecnologiaMaquina(m)] as const),
    );
  }

  private toTableroItem(
    orden: {
      id: string;
      numero: string;
      estado: string;
      fechaEntrega: Date | null;
      cliente: { nombre: string } | null;
      vendedor: { nombreCompleto: string } | null;
    },
    item: {
      id: string;
      parentItemId: string | null;
      componenteCodigo: string | null;
      nodoIncorporacionClave: string | null;
      parentItem?: { id: string; nombre: string } | null;
      ordenIndice: number;
      codigo: string;
      nombre: string;
      cantidad: Prisma.Decimal;
      cantidadUnidad: string;
      specsJson: Prisma.JsonValue;
      cotizacionItemId: string | null;
      /** Producto vivo (vía la cotización): su nombre ACTUAL, para no mostrar
       *  el snapshot viejo si se renombró el producto. Null en OT manuales. */
      cotizacionItem?: {
        jobContextJson: Prisma.JsonValue;
        producto: { nombre: string } | null;
      } | null;
      /** Sólo el conteo: el tablero muestra un clip, no la lista. */
      _count?: { archivos: number };
      pasos: Array<{
        id: string;
        indice: number;
        nodoClave: string | null;
        esTerminal: boolean;
        /** Paso de la ruta que lo originó: empareja con el snapshot del costeo. */
        rutaPasoId: string | null;
        nombre: string;
        familiaCodigo: string;
        categoriaFamilia: string;
        centroCostoId: string | null;
        centroCostoNombre: string | null;
        maquinaId: string | null;
        duracionEstimadaMin: Prisma.Decimal | null;
        operacionesIncorporacionSnapshotJson: Prisma.JsonValue;
        nestingLoteId: string | null;
        nestingLoteRol: string | null;
        nestingLoteSnapshotJson: Prisma.JsonValue;
        estado: string;
        motivoBloqueo: string | null;
        tipoEjecucion: string;
        proveedorNombre: string | null;
        plazoProveedorDias: number | null;
        estadoCompra: string | null;
        iniciadoEl: Date | null;
        completadoEl: Date | null;
        modoRegistro: string;
        tiempoRealMin: Prisma.Decimal | null;
        tiempoFuente: string | null;
        iniciadoPorNombre: string | null;
        completadoPorNombre: string | null;
        mesaUsuarioId: string | null;
        mesaUsuario: { nombreCompleto: string | null; email: string } | null;
        dependenciasEntrantes: Array<{ predecesorPasoId: string }>;
        dependenciasSalientes: Array<{ sucesorPasoId: string }>;
        gatesOperativos?: Array<{
          id: string;
          tipo: string;
          estado: string;
          detalle: string | null;
          resueltoEl: Date | null;
          resueltoPorNombre: string | null;
        }>;
        tramos: Array<{
          usuarioId: string | null;
          usuarioNombre: string;
          inicioEl: Date;
          finEl: Date | null;
          motivoFin: string | null;
          motivoDetalle: string | null;
        }>;
        // (la suma de cerrados sale de sumaTramosMin sobre este array)
      }>;
    },
    /** Usuario que MIRA el tablero: define `mesaEsMia` por paso. */
    viewerUserId: string,
    /**
     * Tecnología por máquina (derivada), para rutear el paso a su estación
     * "por tecnología" (docs/estaciones-reglas-diseno.md). No se persiste: se
     * arma en lectura desde `Maquina`. Default vacío = ruteo por fallback.
     */
    tecnologiaPorMaquina: Map<string, string | null> = new Map(),
    estadoPasosOrden: Map<string, string> = new Map(),
  ) {
    const jobContext =
      item.cotizacionItem?.jobContextJson &&
      typeof item.cotizacionItem.jobContextJson === 'object' &&
      !Array.isArray(item.cotizacionItem.jobContextJson)
        ? (item.cotizacionItem.jobContextJson as Record<string, unknown>)
        : null;
    const pasosVisibles = item.pasos.filter(
      (paso) => paso.nestingLoteRol !== 'PARTICIPANTE',
    );
    return {
      id: item.id,
      parentItemId: item.parentItemId,
      componenteCodigo: item.componenteCodigo,
      nodoIncorporacionClave: item.nodoIncorporacionClave,
      componenteDe: item.parentItem
        ? { id: item.parentItem.id, nombre: item.parentItem.nombre }
        : null,
      ordenId: orden.id,
      ordenNumero: orden.numero,
      ordenEstado: orden.estado,
      itemIndice: item.ordenIndice,
      codigo: item.codigo,
      // Nombre ACTUAL del producto (renombrarlo se refleja en el tablero), con
      // fallback al snapshot del item para OT manuales o producto borrado.
      nombre: item.cotizacionItem?.producto?.nombre ?? item.nombre,
      clienteNombre: orden.cliente?.nombre ?? 'Sin cliente',
      vendedorNombre: orden.vendedor?.nombreCompleto ?? '—',
      cantidad: Number(item.cantidad),
      cantidadUnidad: item.cantidadUnidad,
      specs: (item.specsJson ?? []) as Array<{
        etiqueta: string;
        valor: string;
      }>,
      fechaEntrega: orden.fechaEntrega
        ? orden.fechaEntrega.toISOString().slice(0, 10)
        : null,
      archivosCount: item._count?.archivos ?? 0,
      // El operario necesita estas instrucciones antes de iniciar Diseño
      // gráfico. Se proyecta sólo el brief, no todo el jobContext comercial.
      briefDiseno: jobContext?.briefDiseno ?? null,
      caras: jobContext?.caras === 2 ? 2 : 1,
      sinRuta: pasosVisibles.length === 0,
      pasos: pasosVisibles.map((paso) => ({
        id: paso.id,
        indice: paso.indice,
        nodoClave: paso.nodoClave,
        esTerminal: paso.esTerminal,
        predecesorPasoIds: (paso.dependenciasEntrantes ?? []).map(
          (dependencia) => dependencia.predecesorPasoId,
        ),
        predecesoresSatisfechos: (paso.dependenciasEntrantes ?? []).every(
          (dependencia) =>
            estadoPasosOrden.get(dependencia.predecesorPasoId) === 'hecho',
        ),
        sucesorPasoIds: (paso.dependenciasSalientes ?? []).map(
          (dependencia) => dependencia.sucesorPasoId,
        ),
        gatesOperativos: (paso.gatesOperativos ?? []).map((gate) => ({
          ...gate,
          resueltoEl: gate.resueltoEl?.toISOString() ?? null,
        })),
        // Clave de emparejamiento con el paso del snapshot de costeo: la vista
        // consolidada de Costos cruza el tiempo REAL de acá con la tarifa y el
        // costo COTIZADOS de allá. Sale del `rutaPasoId` que la
        // materialización ya copió de la trazabilidad, así que no depende de
        // que las dos listas queden en el mismo orden.
        rutaPasoId: paso.rutaPasoId,
        nombre: paso.nombre,
        familiaCodigo: paso.familiaCodigo,
        // [E2 pasos-tenant] Un paso del tenant tiene por código un UUID que
        // ningún mapa de UI ni regla de estación conoce. Se deriva —no se
        // guarda— la plantilla de la que hereda, para caer ahí.
        plantillaCodigo:
          resolverFamilia(paso.familiaCodigo)?.plantillaCodigo ?? null,
        categoriaFamilia: paso.categoriaFamilia,
        centroCostoId: paso.centroCostoId,
        centroCostoNombre: paso.centroCostoNombre,
        // Señal real de ruteo a estación (rediseño por reglas): la máquina que
        // ejecutó el paso y su tecnología derivada. Null en pasos sin máquina
        // o en órdenes viejas → caen al fallback por familia + centro.
        maquinaId: paso.maquinaId,
        tecnologia: paso.maquinaId
          ? (tecnologiaPorMaquina.get(paso.maquinaId) ?? null)
          : null,
        duracionEstimadaMin:
          paso.duracionEstimadaMin != null
            ? Number(paso.duracionEstimadaMin)
            : null,
        operacionesIncorporacionSnapshotJson: Array.isArray(
          paso.operacionesIncorporacionSnapshotJson,
        )
          ? paso.operacionesIncorporacionSnapshotJson
          : null,
        nestingLote:
          paso.nestingLoteRol === 'OPERATIVO'
            ? {
                id: paso.nestingLoteId,
                snapshot: paso.nestingLoteSnapshotJson,
              }
            : null,
        estado: paso.estado,
        motivoBloqueo: paso.motivoBloqueo,
        tipoEjecucion: paso.tipoEjecucion,
        proveedorNombre: paso.proveedorNombre,
        plazoProveedorDias: paso.plazoProveedorDias,
        estadoCompra: paso.estadoCompra,
        iniciadoEl: paso.iniciadoEl ? paso.iniciadoEl.toISOString() : null,
        completadoEl: paso.completadoEl
          ? paso.completadoEl.toISOString()
          : null,
        modoRegistro: paso.modoRegistro,
        tiempoRealMin:
          paso.tiempoRealMin != null ? Number(paso.tiempoRealMin) : null,
        tiempoFuente: paso.tiempoFuente,
        iniciadoPorNombre: paso.iniciadoPorNombre,
        completadoPorNombre: paso.completadoPorNombre,
        // Último tramo: si sigue abierto es el cronómetro corriendo; si el
        // paso quedó pausado, su motivo de cierre explica la pausa.
        tramoAbierto:
          paso.tramos[0] && !paso.tramos[0].finEl
            ? {
                usuarioNombre: paso.tramos[0].usuarioNombre,
                inicioEl: paso.tramos[0].inicioEl.toISOString(),
                esMio: paso.tramos[0].usuarioId === viewerUserId,
              }
            : null,
        // Minutos ya trabajados (tramos CERRADOS): la UI evalúa con esto si
        // completar dejaría el tiempo inválido y ofrece declarar (D8).
        tiempoAcumuladoMin: Math.round(sumaTramosMin(paso.tramos) * 100) / 100,
        motivoPausa:
          paso.estado === 'pausado' && paso.tramos[0]
            ? etiquetaMotivoFin(
                paso.tramos[0].motivoFin,
                paso.tramos[0].motivoDetalle,
              )
            : null,
        mesaEsMia: paso.mesaUsuarioId === viewerUserId,
        mesaUsuarioNombre: paso.mesaUsuario
          ? paso.mesaUsuario.nombreCompleto || paso.mesaUsuario.email
          : null,
      })),
    };
  }

  // ── Mapeos al contrato del frontend ──────────────────────────────────

  private toListItem(
    orden: Omit<OrdenConRelaciones, 'items'> & {
      items: Array<{ nombre: string; parentItemId?: string | null }>;
    },
  ) {
    const estado = orden.estado as OrdenTrabajoEstado;
    const itemsComerciales = orden.items.filter(
      (item) => item.parentItemId == null,
    );
    return {
      id: orden.id,
      numero: orden.numero,
      clienteId: orden.clienteId,
      clienteNombre: orden.cliente?.nombre ?? 'Sin cliente',
      vendedorEmpleadoId: orden.vendedorEmpleadoId,
      vendedorNombre: orden.vendedor?.nombreCompleto ?? '—',
      estado,
      creadaEl: orden.createdAt.toISOString(),
      fechaEmision: orden.fechaEmision?.toISOString() ?? null,
      version: orden.updatedAt.toISOString(),
      fechaEntrega: orden.fechaEntrega
        ? orden.fechaEntrega.toISOString().slice(0, 10)
        : null,
      itemsCount: itemsComerciales.length,
      total: Number(orden.total ?? 0),
      progresoPct: progresoEfectivo(estado, orden.progresoPct),
      resumen: itemsComerciales.map((item) => item.nombre).join(' · '),
      proyectoCampana: orden.proyectoCampana,
    };
  }

  private toDetalle(
    orden: OrdenConRelaciones & {
      _count: { items: number; eventos: number };
      eventos: Array<{
        fecha: Date;
        tipo: string;
        descripcion: string;
        usuarioNombre: string;
      }>;
    },
  ) {
    return {
      ...this.toListItem(orden),
      cotizacionId: orden.cotizacionId,
      observaciones: orden.observaciones,
      canalVenta: (orden as { canalVenta?: string | null }).canalVenta ?? null,
      cargosDirectos: Number(orden.cargosDirectos ?? 0),
      subtotal: Number(orden.subtotal ?? 0),
      impuestos: Number(orden.impuestos ?? 0),
      descuentoTotal: Number(orden.descuentoTotal ?? 0),
      fidelizacion: {
        puntosEstimados: Number(
          (orden as { fidelizacionPuntosEstimados?: number | null })
            .fidelizacionPuntosEstimados ?? 0,
        ),
        canjePuntos: Number(
          (orden as { fidelizacionCanjePuntos?: number | null })
            .fidelizacionCanjePuntos ?? 0,
        ),
        canjeMonto: Number(
          (orden as { fidelizacionCanjeMonto?: unknown })
            .fidelizacionCanjeMonto ?? 0,
        ),
      },
      cargos: Array.isArray(
        (orden as { cargosDirectosJson?: unknown }).cargosDirectosJson,
      )
        ? (orden as { cargosDirectosJson: unknown[] }).cargosDirectosJson
        : [],
      // Tratamiento fiscal: FISCAL | SIN_COMPROBANTE (§6 cuaderno de margen).
      tratamientoFiscal:
        (orden as { tratamientoFiscal?: string | null }).tratamientoFiscal ??
        'FISCAL',
      // Token del link público de seguimiento (para "Compartir" desde el staff).
      publicToken:
        (orden as { publicToken?: string | null }).publicToken ?? null,
      // Ejes fiscal y de cobranza de la orden (denormalizados del motor de
      // facturación). Ver docs/facturacion-ordenes-deuda-comercial-diseno.md
      facturadoTotal: Number(
        (orden as { facturadoTotal?: unknown }).facturadoTotal ?? 0,
      ),
      cobradoTotal: Number(
        (orden as { cobradoTotal?: unknown }).cobradoTotal ?? 0,
      ),
      // Cancelación: el motivo se muestra en la ficha, no escondido en el
      // historial. Quien abre una orden cancelada pregunta exactamente eso.
      cancelacion: (() => {
        const o = orden as {
          canceladaEl?: Date | null;
          estadoAlCancelar?: string | null;
          motivoCancelacion?: string | null;
          canceladaPorNombre?: string | null;
          pasosHechosAlCancelar?: number | null;
          pasosTotalAlCancelar?: number | null;
          minutosRealesAlCancelar?: number | null;
        };
        if (!o.canceladaEl) return null;
        return {
          fecha: o.canceladaEl.toISOString(),
          estadoAlCancelar: o.estadoAlCancelar ?? null,
          motivo: o.motivoCancelacion ?? '',
          por: o.canceladaPorNombre ?? null,
          pasosHechos: o.pasosHechosAlCancelar ?? 0,
          pasosTotal: o.pasosTotalAlCancelar ?? 0,
          minutosReales: o.minutosRealesAlCancelar ?? 0,
        };
      })(),
      productos: orden.items
        .filter((item) => item.parentItemId == null)
        .map((item) => {
          const cotItem = (
            item as typeof item & {
              cotizacionItem?: {
                productoId: string;
                rutaAlternativaId: string | null;
                jobContextJson: unknown;
                snapshotJson: unknown;
                trazabilidadJson: unknown;
                costoUnitario: unknown;
                costoTotal: unknown;
                precioUnitario: unknown;
                precioTotal: unknown;
                precioConfigSnapshotJson: unknown;
                impuestosSnapshotJson: unknown;
                comisionesSnapshotJson: unknown;
                precioEspecialClienteSnapshotJson: unknown;
              } | null;
            }
          ).cotizacionItem;
          const itemCategorias = item as typeof item & {
            categoriaComercial?: string;
            subcategoriaComercial?: string;
          };
          const itemDescuento = item as typeof item & {
            descuentoTipo?: 'PORCENTAJE' | 'MONTO' | null;
            descuentoValor?: unknown;
            descuentoMonto?: unknown;
            descuentoCuponId?: string | null;
          };
          return {
            id: item.id,
            cotizacionItemId: item.cotizacionItemId,
            // Descuento comercial persistido (F1): para rehidratar la ficha con el
            // mismo descuento que aplicó el vendedor. Ver descuentos-diseno.md §10.
            descuentoTipo: itemDescuento.descuentoTipo ?? null,
            descuentoValor:
              itemDescuento.descuentoValor != null
                ? Number(itemDescuento.descuentoValor)
                : null,
            descuentoMonto:
              itemDescuento.descuentoMonto != null
                ? Number(itemDescuento.descuentoMonto)
                : null,
            descuentoCuponId: itemDescuento.descuentoCuponId ?? null,
            codigo: item.codigo,
            nombre: item.nombre,
            familia: item.familia,
            categoriaComercial: itemCategorias.categoriaComercial ?? '',
            subcategoriaComercial: itemCategorias.subcategoriaComercial ?? '',
            cantidad: Number(item.cantidad),
            cantidadUnidad: item.cantidadUnidad,
            subtotal: Number(item.subtotal),
            impuestos: Number(item.impuestos),
            total: Number(item.total),
            specs: (item.specsJson ?? []) as Array<{
              etiqueta: string;
              valor: string;
            }>,
            adicionales: (item.adicionalesJson ?? []) as string[],
            snapshot: cotItem
              ? {
                  productoId: cotItem.productoId,
                  rutaAlternativaId: cotItem.rutaAlternativaId,
                  jobContext: cotItem.jobContextJson ?? null,
                  resumen: cotItem.snapshotJson ?? null,
                  trazabilidad: cotItem.trazabilidadJson ?? null,
                  costoUnitario:
                    cotItem.costoUnitario != null
                      ? Number(cotItem.costoUnitario)
                      : null,
                  costoTotal:
                    cotItem.costoTotal != null
                      ? Number(cotItem.costoTotal)
                      : null,
                  precioUnitario:
                    cotItem.precioUnitario != null
                      ? Number(cotItem.precioUnitario)
                      : null,
                  precioTotal:
                    cotItem.precioTotal != null
                      ? Number(cotItem.precioTotal)
                      : null,
                  precioSnapshots: {
                    precioConfig: cotItem.precioConfigSnapshotJson ?? null,
                    impuestos: cotItem.impuestosSnapshotJson ?? null,
                    comisiones: cotItem.comisionesSnapshotJson ?? null,
                    precioEspecialCliente:
                      cotItem.precioEspecialClienteSnapshotJson ?? null,
                  },
                }
              : null,
          };
        }),
      eventos: orden.eventos.map((evento) => ({
        fecha: evento.fecha.toISOString(),
        tipo: evento.tipo,
        descripcion: evento.descripcion,
        usuarioNombre: evento.usuarioNombre,
      })),
      eventosTotal: orden._count.eventos,
      // El plan de pagos llega con el módulo de pagos (ver doc de diseño).
      pago: null,
    };
  }

  // ── Seguimiento público (cliente) ────────────────────────────────────
  // Vista pública por link privado (token). SIN sesión: el token se resuelve
  // contra EnlacePublico (que ES el scope) y se devuelve SÓLO una proyección
  // cliente-facing — nunca montos, costos ni datos internos.
  // Ver docs/enlaces-publicos-diseno.md y docs/tracking-publico-diseno.md

  async trackingPublico(token: string) {
    // El enlace traduce token → orden. Sin sesión no hay tenantContext, así
    // que la extensión de aislamiento no filtra — está bien, el token es
    // único global y las relaciones de la orden son FK suyas (no pueden
    // cruzar tenants). Esta es la apertura que cuenta como visita.
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.SEGUIMIENTO_OT,
      { contarVisita: true },
    );
    if (!enlace) {
      throw new NotFoundException('No encontramos ese pedido.');
    }
    const orden = await this.prisma.ordenTrabajo.findUnique({
      where: { id: enlace.entidadId },
      select: {
        numero: true,
        estado: true,
        createdAt: true,
        fechaEntrega: true,
        cliente: { select: { nombre: true } },
        vendedor: {
          select: {
            nombreCompleto: true,
            telefonoCodigo: true,
            telefonoNumero: true,
          },
        },
        tenantId: true,
        fidelizacionPuntosEstimados: true,
        fidelizacionCanjePuntos: true,
        fidelizacionCanjeMonto: true,
        movimientosFidelizacion: {
          select: { tipo: true, reversionDeId: true },
          orderBy: { createdAt: 'desc' as const },
        },
        tenant: { select: { nombre: true, logoArchivoId: true } },
        // Sólo los marcados `publico`: el arte de producción y los adjuntos
        // internos NUNCA salen por acá. El filtro va en la relación, así que
        // un archivo privado no llega ni a materializarse en memoria.
        archivos: {
          where: ARCHIVOS_VISIBLES_AL_CLIENTE,
          select: ARCHIVO_PUBLICO,
        },
        items: {
          orderBy: { ordenIndice: 'asc' as const },
          select: {
            id: true,
            nombre: true,
            specsJson: true,
            archivos: {
              where: ARCHIVOS_VISIBLES_AL_CLIENTE,
              select: ARCHIVO_PUBLICO,
            },
            pasos: {
              orderBy: { indice: 'asc' as const },
              select: {
                indice: true,
                nombre: true,
                familiaCodigo: true,
                estado: true,
                completadoEl: true,
                duracionEstimadaMin: true,
                centroCostoNombre: true,
              },
            },
          },
        },
        eventos: {
          where: { tipo: 'emision' },
          orderBy: { fecha: 'asc' as const },
          take: 1,
          select: { fecha: true },
        },
      },
    });
    if (!orden || orden.estado === 'borrador') {
      throw new NotFoundException('No encontramos ese pedido.');
    }

    let pasosTotal = 0;
    let pasosHechos = 0;
    const items = orden.items.map((item) => {
      const total = item.pasos.length;
      const hechos = item.pasos.filter((p) => p.estado === 'hecho').length;
      pasosTotal += total;
      pasosHechos += hechos;
      const actual = item.pasos.find((p) => p.estado !== 'hecho');
      return {
        id: item.id,
        nombre: item.nombre,
        // El cliente ve la medida que pidió, no la de corte: si un paso PRE la
        // agrandó (bolsillo, refuerzo), ese número es para el operario.
        specs: filtrarSpecsPublicas(
          (item.specsJson ?? []) as Array<{
            etiqueta: string;
            valor: string;
          }>,
        ),
        progresoPct: total > 0 ? Math.round((hechos / total) * 100) : 0,
        pasoActual: actual?.nombre ?? null,
        estacionActual: actual?.centroCostoNombre ?? null,
        archivos: item.archivos.map(archivoPublico),
        pasos: item.pasos.map((p) => ({
          indice: p.indice,
          nombre: p.nombre,
          familiaCodigo: p.familiaCodigo,
          // [E2] Un paso propio del tenant cae al copy público de su
          // plantilla (su código es un UUID que COPY_FAMILIA no conoce).
          plantillaCodigo:
            resolverFamilia(p.familiaCodigo)?.plantillaCodigo ?? null,
          estado: p.estado,
          completadoEl: p.completadoEl ? p.completadoEl.toISOString() : null,
          duracionEstimadaMin:
            p.duracionEstimadaMin != null
              ? Number(p.duracionEstimadaMin)
              : null,
        })),
      };
    });

    // Actividad cliente-facing: pasos completados (con su fecha) + emisión.
    // Se arma desde los pasos (no desde los eventos internos, que traen texto
    // de staff/montos), así nunca hay fuga de datos internos.
    const actividad: Array<{ fecha: string; texto: string }> = [];
    for (const item of orden.items) {
      for (const paso of item.pasos) {
        if (paso.estado === 'hecho' && paso.completadoEl) {
          actividad.push({
            fecha: paso.completadoEl.toISOString(),
            texto: `Listo: ${paso.nombre}`,
          });
        }
      }
    }
    if (orden.eventos[0]) {
      actividad.push({
        fecha: orden.eventos[0].fecha.toISOString(),
        texto: 'Recibimos tu pedido y entró a producción.',
      });
    }
    actividad.sort((a, b) => b.fecha.localeCompare(a.fecha));

    const empresa = await this.empresa.paraDocumentos(orden.tenantId);

    const telefono =
      orden.vendedor &&
      (orden.vendedor.telefonoCodigo || orden.vendedor.telefonoNumero)
        ? `${orden.vendedor.telefonoCodigo ?? ''}${orden.vendedor.telefonoNumero ?? ''}`.trim()
        : null;

    return {
      numero: orden.numero,
      estado: orden.estado,
      creadaEl: orden.createdAt.toISOString(),
      fechaEntrega: orden.fechaEntrega
        ? orden.fechaEntrega.toISOString().slice(0, 10)
        : null,
      progresoPct:
        pasosTotal > 0 ? Math.round((pasosHechos / pasosTotal) * 100) : 0,
      fidelizacion: {
        puntos: orden.fidelizacionCanjePuntos
          ? orden.fidelizacionCanjePuntos
          : (orden.fidelizacionPuntosEstimados ?? 0),
        tipo: orden.fidelizacionCanjePuntos ? 'CANJE' : 'GANANCIA',
        montoCanje: Number(orden.fidelizacionCanjeMonto ?? 0),
        estado: orden.fidelizacionCanjePuntos
          ? orden.movimientosFidelizacion.some((m) => m.tipo === 'CANJE')
            ? 'CANJEADOS'
            : 'RESERVADOS'
          : orden.movimientosFidelizacion.some(
                (m) => m.tipo === 'REVERSO_GANANCIA',
              )
            ? 'REVERTIDOS'
            : orden.movimientosFidelizacion.some((m) => m.tipo === 'GANANCIA')
              ? 'ACREDITADOS'
              : 'PENDIENTES',
      },
      imprenta: {
        nombre: orden.tenant.nombre,
        iniciales: inicialesDe(orden.tenant.nombre),
        // Cómo ubicar a la imprenta (Configuración › Empresa). El cliente que
        // abre esto suele querer dos cosas que antes no estaban: preguntar
        // algo y saber dónde y hasta qué hora retirar.
        contacto: {
          telefono: empresa.telefonoLink,
          whatsapp: empresa.whatsapp,
          domicilio: empresa.domicilio,
          horario: empresa.horarioAtencion,
          sitioWeb: empresa.sitioWeb,
          // Si el negocio cargó su ficha de Google, "Ver mapa" abre esa; si
          // no, el front cae a buscar el domicilio en Google Maps.
          urlPerfilGoogle: empresa.urlPerfilGoogle,
        },
        // Sólo el flag: la URL la arma el front con su propio prefijo de
        // proxy (el token ya lo tiene, es el parámetro de la página). El API
        // no tiene por qué saber cómo rutea Next.
        tieneLogo: orden.tenant.logoArchivoId !== null,
      },
      cliente: {
        // COMPLETO. Antes se recortaba al primer token para que no saliera
        // "Hola Distribuidora del Sur S.R.L.", y el resultado fue peor:
        // "Imprenta Imagen SRL" saludaba "Hola Imprenta", que se lee como si
        // le hubiéramos errado al nombre.
        nombre: orden.cliente ? orden.cliente.nombre.trim() : 'Hola',
        iniciales: orden.cliente ? inicialesDe(orden.cliente.nombre) : '·',
      },
      vendedor: orden.vendedor
        ? {
            nombre: orden.vendedor.nombreCompleto,
            iniciales: inicialesDe(orden.vendedor.nombreCompleto),
            telefono,
          }
        : null,
      items,
      archivos: orden.archivos.map(archivoPublico),
      actividad: actividad.slice(0, 8),
    };
  }
}
