import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ArchivoEstado,
  Prisma,
  RolSistema,
  TipoEnlacePublico,
} from '@prisma/client';
import QRCode from 'qrcode';
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
  ORDEN_TRABAJO_ESTADOS,
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
  CrearOrdenTrabajoDto,
  CrearOrdenTrabajoItemDto,
  EditarOrdenTrabajoDto,
} from './dto/crear-orden-trabajo.dto';
import type { AccionPasoOrdenTrabajoDto } from './dto/accion-paso.dto';
import type { AhorroConsolidacionDto } from './dto/completar-pasos-lote.dto';
import {
  modoRegistroDeFamilia,
  resolverFamilia,
} from '../productos-servicios/pasos/familias';
import type { FamiliaCodigo } from '../productos-servicios/pasos/types';

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
import { ComprobantesService } from '../administracion/comprobantes.service';
import { NotificacionesOrdenesService } from '../integraciones/notificaciones/notificaciones-ordenes.service';
import { formatearMoneda, type Moneda } from '../common/moneda';
import { regionalDelTenant } from '../common/regional';
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
    _count: { select: { items: true } };
    items: true;
  };
}>;

const LIST_INCLUDE = {
  cliente: { select: { nombre: true } },
  vendedor: { select: { nombreCompleto: true } },
  _count: { select: { items: true } },
  items: {
    select: { nombre: true, ordenIndice: true },
    orderBy: { ordenIndice: 'asc' as const },
  },
};

/** Órdenes que viven en el Tablero: emitidas y todavía no terminadas. */
const ESTADOS_TABLERO: OrdenTrabajoEstado[] = ['pendiente', 'produccion'];

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
  /// Paso tercerizado (compra a proveedor) — ver F2 en el diseño.
  tercerizado?: boolean;
  proveedorId?: string | null;
  plazoProveedorDias?: number | null;
};

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
  ) {}

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
    const where: Prisma.OrdenTrabajoWhereInput = {
      tenantId: auth.tenantId,
      ...(query.estado ? { estado: query.estado } : {}),
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
    const hoy0 = new Date();
    hoy0.setHours(0, 0, 0, 0);
    const manana0 = new Date(hoy0);
    manana0.setDate(manana0.getDate() + 1);
    const en8dias = new Date(hoy0);
    en8dias.setDate(en8dias.getDate() + 8);

    const [ordenes, total, porEstado, proximasEntregar, emitidasHoy] =
      await this.prisma.$transaction([
        this.prisma.ordenTrabajo.findMany({
          where,
          include: LIST_INCLUDE,
          orderBy: { createdAt: 'desc' },
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
            fechaEntrega: { gte: hoy0, lt: en8dias },
          },
        }),
        // "Emitidas hoy": lo que salió al taller en el día. Una cancelada no
        // cuenta aunque se haya emitido hoy: el número mide trabajo entrando.
        this.prisma.ordenTrabajo.count({
          where: {
            tenantId: auth.tenantId,
            estado: { notIn: ['borrador', ESTADO_CANCELADA] },
            createdAt: { gte: hoy0, lt: manana0 },
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
        items: {
          orderBy: { ordenIndice: 'asc' as const },
          include: {
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
    return this.toDetalle({ ...orden, publicToken });
  }

  // ── Crear ────────────────────────────────────────────────────────────

  async create(auth: CurrentAuth, payload: CrearOrdenTrabajoDto) {
    const estadoInicial: OrdenTrabajoEstado = payload.estado ?? 'borrador';
    const emitida = estadoInicial === 'pendiente';
    this.validarEmision(estadoInicial, payload.clienteId ?? null);
    this.validarFechaEntregaEmision(
      estadoInicial,
      payload.fechaEntrega ?? null,
    );
    this.validarMontosItems(payload.items);
    // Emisión directa (no borrador): el descuento por encima del umbral exige
    // un supervisor — el mismo control que el envío de presupuestos. Las
    // líneas con CUPÓN están exentas: el cupón ES la autorización, y la
    // redención (misma transacción de emisión) valida que sea real y vigente.
    if (emitida) {
      await this.exigirDescuentoEmitible(
        auth,
        payload.items.filter((item) => !item.descuentoCuponId),
      );
    }

    // Dos items de la orden no pueden apuntar al mismo snapshot del cotizador.
    const idsSnapshot = payload.items
      .map((item) => item.cotizacionItemId)
      .filter((v): v is string => Boolean(v));
    if (new Set(idsSnapshot).size !== idsSnapshot.length) {
      throw new BadRequestException(
        'Hay items duplicados: dos productos referencian la misma cotización.',
      );
    }

    // Validaciones de integridad referencial dentro del tenant. El emisor
    // (empleado vinculado al usuario autenticado) es el vendedor por defecto
    // cuando el payload no manda uno explícito.
    const [cliente, vendedor, emisor] = await Promise.all([
      payload.clienteId
        ? this.prisma.cliente.findFirst({
            where: { id: payload.clienteId, tenantId: auth.tenantId },
            select: { id: true, nombre: true },
          })
        : null,
      payload.vendedorEmpleadoId
        ? this.prisma.empleado.findFirst({
            where: { id: payload.vendedorEmpleadoId, tenantId: auth.tenantId },
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
    if (payload.cotizacionId) {
      const cot = await this.prisma.cotizacion.findFirst({
        where: { id: payload.cotizacionId, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (!cot) throw new NotFoundException('No se encontró la cotización.');
    }
    const cotizacionItemIds = payload.items
      .map((item) => item.cotizacionItemId)
      .filter((v): v is string => Boolean(v));
    if (cotizacionItemIds.length > 0) {
      const encontrados = await this.prisma.cotizacionItem.count({
        where: { id: { in: cotizacionItemIds }, tenantId: auth.tenantId },
      });
      if (encontrados !== new Set(cotizacionItemIds).size) {
        throw new NotFoundException(
          'Algún item de cotización referenciado no existe.',
        );
      }
    }

    const subtotal = payload.items.reduce((s, i) => s + i.subtotal, 0);
    const impuestos = payload.items.reduce((s, i) => s + i.impuestos, 0);
    const cargosDirectos = payload.cargosDirectos ?? 0;
    // Denormalizado para el listado. El descuento YA está dentro de `subtotal`
    // de cada item (el neto persistido es el descontado), no se resta de nuevo.
    const descuentoTotal = payload.items.reduce(
      (s, i) => s + (i.descuentoMonto ?? 0),
      0,
    );
    const total = subtotal + impuestos + cargosDirectos;
    const vendedorEmpleadoId = payload.vendedorEmpleadoId ?? emisor?.id ?? null;
    const usuarioNombre = firmaActor(
      auth,
      vendedor?.nombreCompleto ?? emisor?.nombreCompleto ?? auth.email,
    );
    const ahora = new Date();
    // Emitida al taller → link público de seguimiento del cliente. Se acuña
    // acá para poder registrarlo en EnlacePublico dentro de la misma tx.
    const tokenSeguimiento = emitida ? generarTokenPublico() : null;

    const creada = await this.prisma.$transaction(async (tx) => {
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
          numero,
          clienteId: payload.clienteId ?? null,
          vendedorEmpleadoId,
          cotizacionId: payload.cotizacionId ?? null,
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
          descuentoTotal,
          total,
          items: {
            create: payload.items.map((item, indice) => ({
              tenantId: auth.tenantId,
              cotizacionItemId: item.cotizacionItemId ?? null,
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
        await this.redimirCupones(tx, auth, orden.id, payload.items);
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
            fecha: new Date(ahora.getTime() - (eventos.length - 1 - i) * 1000),
            tipo: evento.tipo,
            descripcion: evento.descripcion,
            usuarioNombre: esSistema ? 'Sistema' : usuarioNombre,
            usuarioId: esSistema ? null : auth.userId,
            origen: esSistema ? 'sistema' : 'usuario',
          };
        }),
      });

      return orden;
    });

    // Emitida directo al taller: congela la promesa de ETA (post-commit).
    if (emitida) {
      await this.capturarEtaEmision(auth, creada.id);
    }

    this.avisarAlCliente(creada.id);

    return this.findOne(auth, creada.id);
  }

  // ── Edición de datos comerciales ─────────────────────────────────────

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
    const [orden, actor] = await Promise.all([
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
            where: { id: payload.clienteId, tenantId: auth.tenantId },
            select: { id: true, nombre: true },
          })
        : null,
      payload.vendedorEmpleadoId
        ? this.prisma.empleado.findFirst({
            where: { id: payload.vendedorEmpleadoId, tenantId: auth.tenantId },
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
      this.validarFechaEntregaEmision(estado, payload.fechaEntrega);
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
    await this.prisma.$transaction([
      this.prisma.ordenTrabajo.update({
        where: { id: orden.id },
        data: cambios.reduce(
          (acc, cambio) => ({ ...acc, ...cambio.data }),
          {} as Prisma.OrdenTrabajoUpdateInput,
        ),
      }),
      this.prisma.ordenTrabajoEvento.createMany({
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
      }),
    ]);

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
          cargosDirectos: true,
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

  /** Recalcula los denormalizados de la orden a partir de sus items. */
  private async recalcularTotales(
    tx: Prisma.TransactionClient,
    ordenId: string,
    cargosDirectos: number,
  ) {
    const agregado = await tx.ordenTrabajoItem.aggregate({
      where: { ordenId },
      _sum: { subtotal: true, impuestos: true, descuentoMonto: true },
    });
    const subtotal = Number(agregado._sum.subtotal ?? 0);
    const impuestos = Number(agregado._sum.impuestos ?? 0);
    const descuentoTotal = Number(agregado._sum.descuentoMonto ?? 0);
    const total = subtotal + impuestos + cargosDirectos;
    // El total no puede quedar por debajo de lo ya FACTURADO: antes hay
    // que anular la factura o emitir una nota de crédito.
    const actual = await tx.ordenTrabajo.findUniqueOrThrow({
      where: { id: ordenId },
      select: { facturadoTotal: true, tenantId: true },
    });
    if (total < Number(actual.facturadoTotal) - 0.01) {
      const { moneda } = await regionalDelTenant(this.prisma, actual.tenantId);
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
        descuentoTotal,
        total,
      },
    });
  }

  private buildItemData(item: CrearOrdenTrabajoItemDto) {
    return {
      cotizacionItemId: item.cotizacionItemId ?? null,
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
    if (!cotizacionItemId) return;
    const existe = await this.prisma.cotizacionItem.count({
      where: { id: cotizacionItemId, tenantId: auth.tenantId },
    });
    if (!existe) {
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
    this.validarMontosItems([payload]);
    // La orden ya está en el taller: un item nuevo con descuento sobre el
    // umbral es el mismo gate que la emisión (si no, sería el bypass obvio:
    // emitir limpia y agregar el descuento después).
    if (orden.estado !== 'borrador') {
      await this.exigirDescuentoEmitible(auth, [payload]);
    }
    await this.validarSnapshotDisponible(
      auth,
      orden.id,
      payload.cotizacionItemId,
    );

    const ultimo = await this.prisma.ordenTrabajoItem.aggregate({
      where: { ordenId: orden.id },
      _max: { ordenIndice: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const creado = await tx.ordenTrabajoItem.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          ...this.buildItemData(payload),
          ordenIndice: (ultimo._max.ordenIndice ?? -1) + 1,
        },
      });
      // La orden ya está emitida: el item nuevo entra al Tablero con pasos.
      if (orden.estado === 'pendiente') {
        await this.materializarPasosItems(tx, auth.tenantId, [
          {
            id: creado.id,
            ordenId: orden.id,
            cotizacionItemId: creado.cotizacionItemId,
          },
        ]);
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
          descripcion: `Producto agregado: "${payload.nombre}" · ${payload.cantidad} ${payload.cantidadUnidad} · ${formatearMoneda(payload.total, await this.monedaDe(auth.tenantId), { decimales: 0 })}`,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemId: creado.id,
            codigo: payload.codigo,
            nombre: payload.nombre,
            cantidad: payload.cantidad,
            total: payload.total,
          },
        },
      });
    });
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
    this.validarMontosItems([payload]);
    // En una orden ya emitida sólo gatea un descuento que AUMENTA: reeditar
    // specs de un item cuyo descuento ya salió firmado (o emitido por un
    // supervisor) no puede trabarse por reenviar el mismo porcentaje.
    if (
      orden.estado !== 'borrador' &&
      this.descuentoPctDe(payload) > this.descuentoPctDe(existente) + 0.01
    ) {
      await this.exigirDescuentoEmitible(auth, [payload]);
    }
    await this.validarSnapshotDisponible(
      auth,
      orden.id,
      payload.cotizacionItemId,
      existente.id,
    );

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
    if (antes.cantidad !== payload.cantidad) {
      partes.push(
        `cantidad ${antes.cantidad} → ${payload.cantidad} ${payload.cantidadUnidad}`,
      );
    }
    if (antes.total !== payload.total) {
      const dinero = (n: number) =>
        formatearMoneda(n, moneda, { decimales: 0 });
      partes.push(`total ${dinero(antes.total)} → ${dinero(payload.total)}`);
    }
    if (partes.length === 0) partes.push('especificaciones actualizadas');

    await this.prisma.$transaction(async (tx) => {
      await tx.ordenTrabajoItem.update({
        where: { id: existente.id },
        data: this.buildItemData(payload),
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
              cotizacionItemId: payload.cotizacionItemId ?? null,
            },
          ],
          { reemplazar: true },
        );
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
          descripcion: `Producto modificado: "${payload.nombre}" — ${partes.join(' · ')}`,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemId: existente.id,
            antes,
            despues: {
              cantidad: payload.cantidad,
              subtotal: payload.subtotal,
              impuestos: payload.impuestos,
              total: payload.total,
              // Objetos planos: los DTOs (clases) no matchean InputJsonValue.
              specs: (payload.specs ?? []).map((spec) => ({
                etiqueta: spec.etiqueta,
                valor: spec.valor,
              })),
              adicionales: payload.adicionales ?? [],
            },
          },
        },
      });
    });
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
      await tx.ordenTrabajoItem.delete({ where: { id: existente.id } });
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
    const [orden, actor] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: { vendedor: { select: { nombreCompleto: true } } },
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
    const hacia = payload.estado as OrdenTrabajoEstado;
    this.validarTransicion(desde, hacia);
    // Salir de borrador (a cualquier estado) es emitir: exige cliente y
    // fecha de entrega vigente, igual que la emisión directa.
    if (desde === 'borrador') {
      this.validarEmision(hacia, orden.clienteId);
      this.validarFechaEntregaEmision(
        hacia,
        orden.fechaEntrega
          ? orden.fechaEntrega.toISOString().slice(0, 10)
          : null,
      );
      // Emitir el borrador es mandarlo al taller: mismo gate de descuento
      // que la emisión directa (F3 descuentos). Las líneas con CUPÓN quedan
      // exentas — el cupón es la autorización, y la redención de acá abajo
      // lo valida en la misma transacción.
      const itemsDescuento = await this.prisma.ordenTrabajoItem.findMany({
        where: { ordenId: orden.id },
        select: { subtotal: true, descuentoMonto: true, descuentoCuponId: true },
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
      await tx.ordenTrabajo.update({
        where: { id: orden.id },
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
        await tx.ordenTrabajo.updateMany({
          where: { id: orden.id, fechaFinalizada: null },
          data: { fechaFinalizada: new Date() },
        });
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
        // Cupones aplicados en el borrador: se redimen recién acá, que es
        // cuando la orden se compromete (misma transacción, F4 descuentos).
        await this.redimirCupones(tx, auth, orden.id, items);
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
        const asentado = p.tiempoRealMin != null ? Number(p.tiempoRealMin) : null;
        return acc + (asentado ?? sumaTramosMin(p.tramos));
      }, 0),
    );

    await this.prisma.$transaction(async (tx) => {
      // 1. Los cronómetros que quedaron corriendo. Si no se cierran acá nadie
      //    los cierra: la orden sale del tablero y el barrido de fin de jornada
      //    sólo mira lo que el tablero lee.
      await tx.ordenTrabajoPasoTramo.updateMany({
        where: { tenantId: auth.tenantId, finEl: null, paso: { item: { ordenId: orden.id } } },
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

      await tx.ordenTrabajo.update({
        where: { id: orden.id },
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
  ) {
    if (estado === 'borrador') return;
    if (!fechaEntrega) {
      throw new BadRequestException(
        'Para emitir la orden definí la fecha de entrega comprometida.',
      );
    }
    const [datePart] = fechaEntrega.split('T');
    const [anio, mes, dia] = datePart.split('-').map(Number);
    const entrega = new Date(anio, (mes ?? 1) - 1, dia ?? 1);
    const ahora = new Date();
    const hoy = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
    );
    if (Number.isNaN(entrega.getTime()) || entrega < hoy) {
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
    for (const [cuponId, monto] of montos) {
      const tomados = await tx.$executeRaw`
        UPDATE "Cupon" SET "usoCount" = "usoCount" + 1
        WHERE "id" = ${cuponId}::uuid AND "tenantId" = ${auth.tenantId}::uuid
          AND "activo" = true
          AND ("usoMax" IS NULL OR "usoCount" < "usoMax")
          AND ("vigenciaHasta" IS NULL OR "vigenciaHasta" >= NOW())`;
      if (tomados === 0) {
        // Diagnóstico para el error: por qué no se pudo tomar.
        const cupon = await tx.cupon.findFirst({
          where: { id: cuponId, tenantId: auth.tenantId },
          select: { codigo: true, activo: true, usoMax: true, usoCount: true, vigenciaHasta: true },
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
      await tx.cuponRedencion.create({
        data: {
          tenantId: auth.tenantId,
          cuponId,
          ordenId,
          montoAplicado: monto,
        },
      });
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
      select: { id: true, cuponId: true },
    });
    for (const redencion of redenciones) {
      await tx.cuponRedencion.delete({ where: { id: redencion.id } });
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
  ) {
    return pasosActivados(trazabilidad).map((paso, indice) => {
      const familiaCodigo = paso.familiaCodigo ?? 'trabajo_manual';
      const familia = resolverFamilia(familiaCodigo);
      const esTercerizado = paso.tercerizado === true;
      return {
        tenantId,
        ordenId,
        itemId,
        indice,
        rutaPasoId: paso.rutaPasoId ?? null,
        familiaCodigo,
        categoriaFamilia: familia?.categoria ?? 'operaciones_manuales',
        nombre: paso.nombreVisible?.trim() || familia?.nombre || familiaCodigo,
        centroCostoId: paso.tiempo?.centroCostoId ?? null,
        centroCostoNombre: paso.tiempo?.centroCostoNombre ?? null,
        maquinaId: paso.tiempo?.maquinaId ?? null,
        duracionEstimadaMin: paso.tiempo?.totalMin ?? null,
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
    const data = conSnapshot.flatMap((item) =>
      this.pasosDesdeTrazabilidad(
        tenantId,
        item.ordenId,
        item.id,
        trazabilidadPorId.get(item.cotizacionItemId!),
        proveedorNombrePorId,
      ),
    );
    if (data.length > 0) {
      // skipDuplicates = ON CONFLICT DO NOTHING contra el único
      // (itemId, indice): si dos materializaciones corren a la vez, el
      // perdedor no inserta en vez de reventar una lectura del tablero.
      await tx.ordenTrabajoItemPaso.createMany({ data, skipDuplicates: true });
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

  /** Items activos con sus pasos: el dataset COMPLETO del Tablero. */
  async tablero(auth: CurrentAuth) {
    await this.reconciliarTramosVencidos(auth.tenantId);
    await this.backfillPasosTablero(auth);
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: { tenantId: auth.tenantId, estado: { in: ESTADOS_TABLERO } },
      include: {
        cliente: { select: { nombre: true } },
        vendedor: { select: { nombreCompleto: true } },
        items: {
          orderBy: { ordenIndice: 'asc' as const },
          include: {
            // Producto vivo (vía cotización): su nombre ACTUAL para el card, así
            // renombrar el producto se refleja en el tablero. Null en OT manuales.
            cotizacionItem: { select: { producto: { select: { nombre: true } } } },
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
    return {
      items: ordenes.flatMap((orden) =>
        orden.items.map((item) =>
          this.toTableroItem(orden, item, auth.userId, tecnologias),
        ),
      ),
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
            // Producto vivo (vía cotización): su nombre ACTUAL para el card, así
            // renombrar el producto se refleja en el tablero. Null en OT manuales.
            cotizacionItem: { select: { producto: { select: { nombre: true } } } },
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
        this.toTableroItem(orden!, item, auth.userId, tecnologias),
      ),
    };
  }

  /**
   * Toma o suelta un paso de "mi mesa de trabajo" (vista Por estación).
   * Reclamo simple y visible: tomar pisa el reclamo de otro (taller chico);
   * los pasos hechos no se reclaman. Devuelve el item re-proyectado.
   */
  async mesaPaso(auth: CurrentAuth, pasoId: string, en: boolean) {
    const paso = await this.prisma.ordenTrabajoItemPaso.findFirst({
      where: { id: pasoId, tenantId: auth.tenantId },
      select: { id: true, itemId: true, estado: true },
    });
    if (!paso) {
      throw new NotFoundException('No se encontró el paso de producción.');
    }
    if (en && paso.estado === 'hecho') {
      throw new BadRequestException(
        'El paso ya está hecho: no va a ninguna mesa.',
      );
    }
    await this.prisma.ordenTrabajoItemPaso.update({
      where: { id: paso.id },
      data: { mesaUsuarioId: en ? auth.userId : null },
    });
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
          orden: { select: { estado: true, progresoPct: true } },
          item: { select: { nombre: true, ordenIndice: true } },
          tramos: { select: { id: true, inicioEl: true, finEl: true } },
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

    // La ruta es una secuencia: sólo se ejecuta el paso ACTIVO (frontera).
    const pasosItem = await this.prisma.ordenTrabajoItemPaso.findMany({
      where: { tenantId: auth.tenantId, itemId },
      select: { indice: true, estado: true },
    });
    const ejecuta =
      payload.accion === 'iniciar' ||
      payload.accion === 'pausar' ||
      payload.accion === 'continuar' ||
      payload.accion === 'completar' ||
      payload.accion === 'bloquear';
    if (ejecuta && !pasoEjecutable(pasosItem, paso.indice)) {
      throw new BadRequestException(
        `"${paso.nombre}" todavía no está listo: la ruta es secuencial y hay pasos anteriores sin completar.`,
      );
    }
    if (
      payload.accion === 'reabrir' &&
      !pasoReabrible(pasosItem, paso.indice)
    ) {
      throw new BadRequestException(
        `No se puede reabrir "${paso.nombre}": hay pasos posteriores que ya arrancaron.`,
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
      await tx.ordenTrabajoItemPaso.update({
        where: { id: paso.id },
        data,
      });

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

      // Progreso real de la orden: pasos hechos sobre el total (D3 del doc).
      const [total, hechos] = await Promise.all([
        tx.ordenTrabajoItemPaso.count({ where: { ordenId } }),
        tx.ordenTrabajoItemPaso.count({
          where: { ordenId, estado: 'hecho' },
        }),
      ]);
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
          ...(total > 0
            ? { progresoPct: Math.round((hechos / total) * 100) }
            : {}),
        },
      });
      // Primera finalización (acá: el último paso completado la finaliza
      // solo): nace la deuda comercial y arranca su aging.
      if (nuevoEstadoOrden === 'finalizada') {
        await tx.ordenTrabajo.updateMany({
          where: { id: ordenId, fechaFinalizada: null },
          data: { fechaFinalizada: new Date() },
        });
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
  ) {
    const unicos = [...new Set(pasoIds)];
    const pasos = await this.prisma.ordenTrabajoItemPaso.findMany({
      where: { id: { in: unicos }, tenantId: auth.tenantId },
      select: {
        id: true,
        ordenId: true,
        itemId: true,
        nombre: true,
        duracionEstimadaMin: true,
      },
    });
    const porId = new Map(pasos.map((paso) => [paso.id, paso]));

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
    if (ahorro && completados > 0 && errores.length === 0) {
      const actor = await this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      });
      await this.prisma.ahorroConsolidacion.create({
        data: {
          tenantId: auth.tenantId,
          usuarioId: auth.userId,
          usuarioNombre: firmaActor(auth, actor?.nombreCompleto ?? auth.email),
          materiaPrimaId: ahorro.materiaPrimaId ?? null,
          materiaPrimaNombre: ahorro.materiaPrimaNombre,
          tecnologia: ahorro.tecnologia ?? null,
          jobs: ahorro.jobs,
          consumoSeparadoMl: ahorro.consumoSeparadoMl,
          consumoConsolidadoMl: ahorro.consumoConsolidadoMl,
          ahorroMl: ahorro.ahorroMl,
          costoSeparado: ahorro.costoSeparado ?? null,
          costoConsolidado: ahorro.costoConsolidado ?? null,
          ahorroPesos: ahorro.ahorroPesos ?? null,
          baselineParcial: ahorro.baselineParcial ?? false,
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
        cotizacionItem: { select: { producto: { select: { nombre: true } } } },
        pasos: {
          orderBy: { indice: 'asc' as const },
          include: {
            mesaUsuario: { select: { nombreCompleto: true, email: true } },
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
    return this.toTableroItem(item.orden, item, auth.userId, tecnologias);
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
        await tx.ordenTrabajo.updateMany({
          where: { id: ordenId, fechaFinalizada: null },
          data: { fechaFinalizada: new Date() },
        });
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
      ordenIndice: number;
      codigo: string;
      nombre: string;
      cantidad: Prisma.Decimal;
      cantidadUnidad: string;
      specsJson: Prisma.JsonValue;
      cotizacionItemId: string | null;
      /** Producto vivo (vía la cotización): su nombre ACTUAL, para no mostrar
       *  el snapshot viejo si se renombró el producto. Null en OT manuales. */
      cotizacionItem?: { producto: { nombre: string } | null } | null;
      /** Sólo el conteo: el tablero muestra un clip, no la lista. */
      _count?: { archivos: number };
      pasos: Array<{
        id: string;
        indice: number;
        /** Paso de la ruta que lo originó: empareja con el snapshot del costeo. */
        rutaPasoId: string | null;
        nombre: string;
        familiaCodigo: string;
        categoriaFamilia: string;
        centroCostoId: string | null;
        centroCostoNombre: string | null;
        maquinaId: string | null;
        duracionEstimadaMin: Prisma.Decimal | null;
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
  ) {
    return {
      id: item.id,
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
      sinRuta: item.pasos.length === 0,
      pasos: item.pasos.map((paso) => ({
        id: paso.id,
        indice: paso.indice,
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
      items: Array<{ nombre: string }>;
    },
  ) {
    const estado = orden.estado as OrdenTrabajoEstado;
    return {
      id: orden.id,
      numero: orden.numero,
      clienteId: orden.clienteId,
      clienteNombre: orden.cliente?.nombre ?? 'Sin cliente',
      vendedorEmpleadoId: orden.vendedorEmpleadoId,
      vendedorNombre: orden.vendedor?.nombreCompleto ?? '—',
      estado,
      creadaEl: orden.createdAt.toISOString(),
      fechaEntrega: orden.fechaEntrega
        ? orden.fechaEntrega.toISOString().slice(0, 10)
        : null,
      itemsCount: orden._count.items,
      total: Number(orden.total ?? 0),
      progresoPct: progresoEfectivo(estado, orden.progresoPct),
      resumen: orden.items.map((item) => item.nombre).join(' · '),
    };
  }

  private toDetalle(
    orden: OrdenConRelaciones & {
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
      productos: orden.items.map((item) => {
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
