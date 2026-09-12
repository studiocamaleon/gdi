import {
  Optional,
  Logger,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { EtaService } from '../eta/eta.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import {
  obtenerCotizacionesF6,
  cantidadesParaPlanificar,
  contextoParaCantidad,
} from '../eta/planificacion/cotizaciones-por-cantidad';
import {
  planificarCotizacionesF6,
  planesGuardadosF6,
  type PlanGeometricoF6,
} from '../eta/planificacion/adaptador-cotizacion';
import { evaluarLayoutsEntregas } from '../eta/planificacion/layouts-entregas';
import { esFechaCalendario } from '../common/zona';
import type {
  CotizarInput,
  CotizarOutput,
  CotizacionResultado,
} from '../motor-universal/tipos';
import type {
  ReprogramarEntregasDto,
  SolicitarPlanEntregaDto,
  ElegirPlanEntregaDto,
  EliminarPlanEntregaDto,
} from './planificacion.dto';
import { actualizarFechaFinalOrden } from './resumen-entregas';
import {
  huellaContextoPlan,
  huellaPlan,
  huellaOrigenCotizacion,
  serializarPlan,
  type ResultadoPlanGuardado,
  type SolicitudPlanCongelada,
} from './planificacion-contrato';

import { bloquearColaEntrega } from './reprogramacion-bloqueo';
import {
  calcularReprogramacion,
  cerrarReprogramaciones,
} from './reprogramacion-computo';
import { RENOVACION_PLAN_MS } from './planificacion-vida';

const VIGENCIA_MS = 5 * 60_000;
const MAX_REVISIONES_PENDIENTES = 2;
const respuestaError = (error: unknown) =>
  error instanceof Error
    ? error.message.slice(0, 1200)
    : 'No se pudo calcular el plan de entregas.';

@Injectable()
export class PlanificacionEntregasService {
  private readonly logger = new Logger(PlanificacionEntregasService.name);
  async onApplicationShutdown() {
    await cerrarReprogramaciones();
  }
  /** El worker sólo calcula. La adopción se ejecuta en el API, dentro de la OT. */
  private produccion(): OrdenesTrabajoService {
    if (!this.ordenes)
      throw new Error(
        'La adopción de lotes requiere el módulo de órdenes de trabajo.',
      );
    return this.ordenes;
  }

  constructor(
    private readonly db: PrismaService,
    private readonly eta: EtaService,
    @Optional() private readonly ordenes?: OrdenesTrabajoService,
  ) {}

  private async origen(
    tenantId: string,
    itemId: string,
    borrador = false,
    db: Prisma.TransactionClient = this.db,
  ) {
    if (borrador) return this.origenCotizacion(tenantId, itemId, db);
    const item = await db.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId },
      select: {
        id: true,
        parentItemId: true,
        cantidad: true,
        nombre: true,
        cotizacionItemId: true,
        recetaRevisionId: true,
        recetaHuella: true,
        orden: {
          select: {
            id: true,
            estado: true,
            updatedAt: true,
            clienteId: true,
            items: {
              select: {
                id: true,
                parentItemId: true,
                pasos: { select: { estado: true, nestingLoteRol: true } },
              },
            },
          },
        },
        cotizacionItem: {
          select: {
            id: true,
            tenantId: true,
            cantidad: true,
            productoId: true,
            rutaAlternativaId: true,
            jobContextJson: true,
            updatedAt: true,
            recetaRevisionId: true,
            recetaHuella: true,
          },
        },
      },
    });
    if (!item)
      throw new NotFoundException('No se encontró el ítem de la orden.');
    if (item.parentItemId)
      throw new BadRequestException(
        'La distribución se define sobre el producto completo.',
      );
    const cotizacion = item.cotizacionItem;
    if (!cotizacion || cotizacion.tenantId !== tenantId)
      throw new BadRequestException(
        'El ítem necesita una cotización guardada para planificar sus entregas.',
      );
    if (!['borrador', 'pendiente'].includes(item.orden.estado))
      throw new ConflictException(
        'La planificación inicial está disponible antes de comenzar la producción.',
      );
    const ids = new Set([itemId]);
    for (let cambio = true; cambio; ) {
      cambio = false;
      for (const h of item.orden.items)
        if (h.parentItemId && ids.has(h.parentItemId) && !ids.has(h.id)) {
          ids.add(h.id);
          cambio = true;
        }
    }
    if (
      item.orden.items.some(
        (h) =>
          ids.has(h.id) &&
          h.pasos.some(
            (p) =>
              p.nestingLoteRol !== 'PARTICIPANTE' && p.estado !== 'pendiente',
          ),
      )
    )
      throw new ConflictException(
        'El producto ya tiene trabajo iniciado. Su replanificación requiere conservar lo ejecutado.',
      );
    const cantidad = Number(item.cantidad);
    if (
      !Number.isSafeInteger(cantidad) ||
      cantidad < 1 ||
      cantidad > 1_000_000 ||
      cantidad !== Number(cotizacion.cantidad)
    )
      throw new BadRequestException(
        'La planificación requiere unidades enteras y una cotización de la misma cantidad.',
      );
    const input: CotizarInput = {
      tenantId,
      productoId: cotizacion.productoId,
      rutaAlternativaId: cotizacion.rutaAlternativaId,
      clienteId: item.orden.clienteId ?? undefined,
      jobContext: {
        ...(cotizacion.jobContextJson as Record<string, unknown>),
        cantidad,
      },
    };
    const huella = huellaPlan({
      itemId,
      cantidad,
      cotizacionId: cotizacion.id,
      cotizacionVersion: cotizacion.updatedAt,
      recetaRevisionId: item.recetaRevisionId ?? cotizacion.recetaRevisionId,
      recetaHuella: item.recetaHuella ?? cotizacion.recetaHuella,
      ordenVersion: item.orden.updatedAt,
      estado: item.orden.estado,
    });
    return {
      item,
      input,
      cantidad,
      ids,
      huella,
      recetaRevisionId: cotizacion.recetaRevisionId,
      recetaHuella: cotizacion.recetaHuella,
    };
  }

  private async origenCotizacion(
    tenantId: string,
    cotizacionItemId: string,
    db: Prisma.TransactionClient = this.db,
  ) {
    const c = await db.cotizacionItem.findFirst({
      where: { id: cotizacionItemId, tenantId },
      select: {
        id: true,
        updatedAt: true,
        productoId: true,
        rutaAlternativaId: true,
        cantidad: true,
        recetaRevisionId: true,
        recetaHuella: true,
        jobContextJson: true,
        cotizacion: { select: { clienteId: true } },
        ordenTrabajoItems: { select: { id: true }, take: 1 },
      },
    });
    if (!c)
      throw new NotFoundException('No se encontró la cotización del producto.');
    if (c.ordenTrabajoItems.length)
      throw new ConflictException(
        'Esta cotización ya pertenece a una OT. Abrí su distribución desde la orden.',
      );
    const cantidad = Number(c.cantidad);
    if (!Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 1_000_000)
      throw new BadRequestException(
        'La distribución requiere unidades enteras.',
      );
    return {
      cantidad,
      ids: new Set<string>(),
      huella: huellaOrigenCotizacion(c),
      recetaRevisionId: c.recetaRevisionId,
      recetaHuella: c.recetaHuella,
      input: {
        tenantId,
        productoId: c.productoId,
        rutaAlternativaId: c.rutaAlternativaId,
        clienteId: c.cotizacion.clienteId ?? undefined,
        jobContext: {
          ...(c.jobContextJson as Record<string, unknown>),
          cantidad,
        },
      } satisfies CotizarInput,
    };
  }

  private async origenDePlan(tenantId: string, planId: string) {
    const p = await this.db.planEntregaItem.findFirstOrThrow({
      where: { id: planId, tenantId },
      select: { ordenItemId: true, cotizacionItemId: true },
    });
    if (p.ordenItemId) return this.origen(tenantId, p.ordenItemId);
    if (p.cotizacionItemId)
      return this.origenCotizacion(tenantId, p.cotizacionItemId);
    throw new ConflictException('El plan no tiene un producto de origen.');
  }

  private async contexto(
    tenantId: string,
    ids: Set<string>,
    tx?: Prisma.TransactionClient,
  ) {
    const c = await this.eta.contextoSimulacion(tenantId, tx);
    // Una OT pendiente ya está en la cola. Sustituimos sólo esta rama en el
    // escenario; los demás ítems y compromisos siguen ocupando el taller.
    const taller = { ...c, items: c.items.filter((i) => !ids.has(i.id)) };
    return { taller, huella: huellaContextoPlan(taller, c.margenEtaDias) };
  }

  /** Lectura diferida de un lote. El listado no transporta el CAD de todos. */
  async detalleLote(tenantId: string, itemId: string, loteId: string) {
    const lote = await this.db.loteProduccionEntrega.findFirst({
      where: { id: loteId, tenantId, productoItemId: itemId },
      include: {
        fuente: true,
        trabajos: {
          where: { parentItemId: itemId },
          select: { id: true, nombre: true },
        },
      },
    });
    if (!lote || lote.trabajos.length !== 1)
      throw new NotFoundException('No se encontró el lote de producción.');
    return {
      id: lote.id,
      itemId: lote.trabajos[0].id,
      nombre: lote.trabajos[0].nombre,
      cantidad: lote.cantidad,
      fechaEntrega: lote.fechaEntrega.toISOString().slice(0, 10),
      cotizacion: lote.fuente.calculoJson,
      jobContext: lote.fuente.contextoJson,
    };
  }

  async solicitar(
    auth: CurrentAuth,
    itemId: string,
    dto: SolicitarPlanEntregaDto,
    borrador = false,
  ) {
    const origen = await this.origen(auth.tenantId, itemId, borrador);
    const claves = new Set<string>();
    let anterior = '';
    for (const e of dto.entregas) {
      if (
        !e.clave.trim() ||
        claves.has(e.clave) ||
        (e.fechaSolicitada &&
          (!esFechaCalendario(e.fechaSolicitada) ||
            e.fechaSolicitada < anterior))
      )
        throw new BadRequestException(
          'Las entregas necesitan claves únicas y fechas válidas en orden.',
        );
      claves.add(e.clave);
      if (e.fechaSolicitada) anterior = e.fechaSolicitada;
    }
    let cantidades: number[];
    try {
      cantidades = cantidadesParaPlanificar(
        origen.cantidad,
        dto.entregas.map((e) => ({ ...e, id: e.clave })),
        true,
      );
    } catch (error) {
      throw new BadRequestException(respuestaError(error));
    }
    if (cantidades.length > 12)
      throw new BadRequestException(
        'Esta distribución necesita demasiados cálculos. Agrupá algunas entregas.',
      );
    const solicitud: SolicitudPlanCongelada = {
      schemaVersion: 1,
      input: origen.input,
      recetaRevisionId: origen.recetaRevisionId,
      recetaHuella: origen.recetaHuella,
      entregas: dto.entregas,
      porEntrega: true,
    };
    const solicitudHuella = huellaPlan({
      itemId,
      entregas: dto.entregas,
      origen: origen.huella,
      politica: 'POR_ENTREGA',
    });
    const preparada = this.db.prepararSnapshot('PlanEntregaRevision', {
      solicitudJson: solicitud as unknown as Prisma.InputJsonValue,
    });
    await this.db.$transaction(
      async (tx) => {
        // Orden estable de cerrojos: empresa antes de plan. Serializa también
        // la primera creación y el cupo de cálculos entre productos.
        await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${auth.tenantId}::uuid FOR UPDATE`;
        // Mismo cerrojo para todas las escrituras del plan, también su elección.
        const plan = await tx.planEntregaItem.upsert({
          where: borrador
            ? { cotizacionItemId: itemId }
            : { ordenItemId: itemId },
          update: {},
          create: {
            tenantId: auth.tenantId,
            ...(borrador
              ? { cotizacionItemId: itemId }
              : { ordenItemId: itemId }),
          },
        });
        await tx.$queryRaw`SELECT "id" FROM "PlanEntregaItem" WHERE "id" = ${plan.id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
        const repetida = await tx.planEntregaRevision.findFirst({
          where: {
            tenantId: auth.tenantId,
            idempotencyKey: dto.idempotencyKey,
          },
        });
        if (repetida) {
          if (
            repetida.planId !== plan.id ||
            repetida.solicitudHuella !== solicitudHuella
          )
            throw new ConflictException(
              'Esa solicitud ya se utilizó con otros datos.',
            );
          return;
        }
        const actual = await tx.planEntregaItem.findFirstOrThrow({
          where: { id: plan.id, tenantId: auth.tenantId },
        });
        if (borrador && actual.ordenItemId)
          throw new ConflictException(
            'La distribución ya fue guardada en una OT.',
          );
        if (actual.version !== dto.expectedVersion)
          throw new ConflictException(
            'El plan cambió en otra ventana. Actualizalo antes de continuar.',
          );
        // Serializa también el límite de solicitudes entre ítems de un tenant.
        const pendientes = await tx.planEntregaRevision.count({
          where: {
            tenantId: auth.tenantId,
            estado: { in: ['SOLICITADA', 'CALCULANDO'] },
            planId: { not: plan.id },
          },
        });
        if (pendientes >= MAX_REVISIONES_PENDIENTES)
          throw new ConflictException(
            'Ya hay dos planes de esta empresa calculándose. Esperá a que termine uno.',
          );
        await tx.planEntregaRevision.updateMany({
          where: {
            tenantId: auth.tenantId,
            planId: plan.id,
            estado: { in: ['SOLICITADA', 'CALCULANDO'] },
          },
          data: { estado: 'SUPERADA', ejecucionId: null },
        });
        const numero = actual.revisionActual + 1;
        const revision = await tx.planEntregaRevision.create({
          data: {
            tenantId: auth.tenantId,
            planId: plan.id,
            numero,
            idempotencyKey: dto.idempotencyKey,
            solicitudHuella,
            origenHuella: origen.huella,
            cantidad: origen.cantidad,
            solicitadoPorId: auth.userId,
            ...preparada,
          },
        });
        await tx.planEntregaSolicitud.createMany({
          data: dto.entregas.map((e, i) => ({
            tenantId: auth.tenantId,
            revisionId: revision.id,
            clave: e.clave,
            secuencia: i,
            cantidad: e.cantidad,
            fechaSolicitada: e.fechaSolicitada
              ? new Date(`${e.fechaSolicitada}T00:00:00Z`)
              : null,
          })),
        });
        await tx.planEntregaItem.update({
          where: { id: plan.id, tenantId: auth.tenantId },
          data: {
            revisionActual: numero,
            version: { increment: 1 },
            alternativaElegidaId: null,
            ajusteNestingAceptado: false,
            elegidaEl: null,
            elegidaPorId: null,
          },
        });
      },
      { timeout: 10_000 },
    );
    return this.consultar(auth.tenantId, itemId, borrador);
  }

  async consultar(tenantId: string, itemId: string, borrador = false) {
    const filtro = {
      where: { id: itemId, tenantId },
      select: { id: true as const },
    };
    const existe = borrador
      ? await this.db.cotizacionItem.findFirst(filtro)
      : await this.db.ordenTrabajoItem.findFirst(filtro);
    if (!existe)
      throw new NotFoundException('No se encontró el ítem de la orden.');
    const plan = await this.db.planEntregaItem.findFirst({
      where: {
        tenantId,
        ...(borrador
          ? { cotizacionItemId: itemId, ordenItemId: null }
          : { ordenItemId: itemId }),
      },
      include: {
        revisiones: {
          orderBy: { numero: 'desc' },
          take: 1,
          select: {
            id: true,
            numero: true,
            estado: true,
            cantidad: true,
            cantidadCalculada: true,
            resultadoJson: true,
            calculadaEl: true,
            aplicadaEl: true,
            origenHuella: true,
            contextoHuella: true,
            error: true,
            fuentesProduccion: { select: { cantidad: true } },
            entregas: {
              orderBy: { secuencia: 'asc' },
              select: { clave: true, cantidad: true, fechaSolicitada: true },
            },
          },
        },
      },
    });
    if (!plan) return { plan: null, reservaCapacidad: false as const };
    const r = plan.revisiones[0];
    const resultado =
      r?.resultadoJson as unknown as ResultadoPlanGuardado | null;
    let desactualizado = false,
      motivo: string | null = null;
    if (
      r?.estado === 'LISTA' &&
      plan.reprogramacionAplicadaRevisionId !== r.id
    ) {
      try {
        const o = await this.origen(tenantId, itemId, borrador),
          c = await this.contexto(tenantId, o.ids);
        if (o.huella !== r.origenHuella)
          motivo = 'Cambió la orden o su cotización.';
        else if (c.huella !== r.contextoHuella)
          motivo = 'Cambió la carga, el calendario o la capacidad del taller.';
        else if (
          !r.calculadaEl ||
          c.taller.ahora.getTime() - r.calculadaEl.getTime() > VIGENCIA_MS
        )
          motivo = 'Actualizá la proyección con la hora y la carga actuales.';
      } catch (error) {
        motivo = respuestaError(error);
      }
      if (!motivo && resultado?.politica !== 'POR_ENTREGA')
        motivo =
          'Recalculá para fabricar una tanda por entrega y revisar sus layouts.';
      if (
        !motivo &&
        r.entregas.some(
          (e) => !r.fuentesProduccion.some((f) => f.cantidad === e.cantidad),
        )
      )
        motivo =
          'Recalculá esta propuesta para conservar los archivos y las rutas de cada lote.';
      desactualizado = motivo !== null;
    }
    const compromisos = await this.db.loteProduccionEntrega.findMany({
      where: { tenantId, productoItemId: itemId, revisionId: r.id },
      select: { clave: true, fechaEntrega: true },
    });
    const historial = await this.db.planEntregaRevision.findMany({
      where: { tenantId, planId: plan.id },
      orderBy: { numero: 'desc' },
      take: 10,
      select: {
        id: true,
        numero: true,
        estado: true,
        createdAt: true,
        calculadaEl: true,
      },
    });
    return {
      reservaCapacidad: !!r.aplicadaEl,
      plan: {
        id: plan.id,
        version: plan.version,
        alternativaElegidaId: plan.alternativaElegidaId,
        ajusteNestingAceptado: plan.ajusteNestingAceptado,
        cambioEntregasAceptado: plan.cambioEntregasAceptado,
        reprogramacionAplicada: plan.reprogramacionAplicadaRevisionId === r.id,
        reprogramacion: resultado?.reprogramacion ?? null,
        nesting: resultado?.nesting ?? null,
        revisionId: r.id,
        revision: r.numero,
        estado: r.estado,
        cantidad: r.cantidad,
        cantidadCalculada: r.cantidadCalculada,
        entregas: r.entregas.map((e) => ({
          clave: e.clave,
          cantidad: e.cantidad,
          fechaSolicitada:
            compromisos
              .find((l) => l.clave === e.clave)
              ?.fechaEntrega.toISOString()
              .slice(0, 10) ??
            e.fechaSolicitada?.toISOString().slice(0, 10) ??
            null,
        })),
        calculadaEl: r.calculadaEl?.toISOString() ?? null,
        zona: resultado?.zona ?? null,
        margenDiasHabiles: resultado?.margenDiasHabiles ?? null,
        recomendadaId: resultado?.resultado.recomendadaId ?? null,
        economicaId: resultado?.resultado.economicaId ?? null,
        alternativas: resultado ? this.alternativasPublicas(resultado) : [],
        desactualizado,
        motivoDesactualizado: motivo,
        error: r.error,
        historial,
      },
    };
  }

  private alternativasPublicas(r: ResultadoPlanGuardado) {
    return r.resultado.alternativas.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      estado: a.estado,
      costo: a.costo,
      costoAdicional: a.costoAdicional,
      preparacionMin: a.preparacionMin,
      condiciones: a.condiciones,
      esperaCola: a.esperaCola ?? false,
      reprogramacion: a.reprogramacion
        ? { ...a.reprogramacion, agenda: undefined }
        : undefined,
      operacionesDesplazadas: a.trabajosDesplazados.length,
      entregas: a.entregas.map((e) => ({
        id: e.id,
        cantidad: e.cantidad,
        fechaSolicitada: e.fechaSolicitada ?? null,
        finProduccion: e.finProduccion,
        fechaSugerida: e.fechaSugerida,
        cumple: e.cumple,
        cumpleConMargen: e.cumpleConMargen,
      })),
      lotes: a.operaciones.map((o) => ({
        id: o.id,
        nombre:
          r.operaciones.find((p) => p.codigo === o.operacion)?.nombre ??
          o.operacion,
        cantidad: o.cantidadProductos,
        piezas: o.cantidadPiezas,
        desde: o.desde,
        hasta: o.hasta,
        minutos: o.medicion
          ? o.medicion.preparacionMin + o.medicion.ejecucionMin
          : null,
      })),
      placas:
        r.detalles.find(
          (d) => d.alternativaId === (a.reprogramacion ? 'por-entrega' : a.id),
        )?.placasNuevas ?? null,
    }));
  }

  /** Publica una revisión de cola sin recalcular los archivos por cantidad. */
  /** Nuevas agendas usando las mediciones ya calculadas; jamás vuelve a nestear. */
  async reprogramar(
    auth: CurrentAuth,
    itemId: string,
    dto: ReprogramarEntregasDto,
    borrador = false,
  ) {
    if (!auth.permisos?.has('produccion.supervisar'))
      throw new ForbiddenException(
        'Necesitás permiso de supervisión de producción.',
      );
    const origen = await this.origen(auth.tenantId, itemId, borrador);
    const revision = await this.db.planEntregaRevision.findFirst({
      where: {
        id: dto.revisionId,
        tenantId: auth.tenantId,
        plan: borrador
          ? { cotizacionItemId: itemId, ordenItemId: null }
          : { ordenItemId: itemId },
      },
      include: { plan: true, entregas: { orderBy: { secuencia: 'asc' } } },
    });
    if (
      !revision ||
      revision.estado !== 'LISTA' ||
      revision.plan.version !== dto.expectedVersion ||
      revision.numero !== revision.plan.revisionActual ||
      revision.origenHuella !== origen.huella
    )
      throw new ConflictException(
        'Cambió la distribución o su cotización. Actualizá antes de buscar opciones.',
      );
    const anterior = revision.resultadoJson as unknown as ResultadoPlanGuardado;
    const { taller, huella } = await this.contexto(auth.tenantId, origen.ids);
    const entregas = revision.entregas.map((e) => ({
      id: e.clave,
      cantidad: e.cantidad,
      fechaSolicitada: e.fechaSolicitada?.toISOString().slice(0, 10),
    }));
    const { resultado, busqueda } = await calcularReprogramacion({
      tenantId: auth.tenantId,
      excluidas: dto.ordenesExcluidas,
      piloto: {
        cantidad: revision.cantidad,
        entregas,
        operaciones: anterior.operaciones,
        taller,
        margenDiasHabiles: taller.margenEtaDias,
        condicionesPendientes:
          anterior.resultado.alternativas[0]?.condiciones ?? [],
        prioridadSinFechas: 'PRIMERAS_ENTREGAS',
        porEntrega: true,
      },
    });
    const guardado: ResultadoPlanGuardado = {
      ...anterior,
      calculadaEl: taller.ahora.toISOString(),
      zona: taller.zona,
      margenDiasHabiles: taller.margenEtaDias,
      resultado: {
        ...resultado,
        alternativas: [...resultado.alternativas, ...busqueda.alternativas],
      },
      reprogramacion: {
        trabajos: busqueda.trabajos,
        excluidas: dto.ordenesExcluidas,
        evaluadas: busqueda.evaluadas,
        motivo: busqueda.motivo,
      },
    };
    const datos = this.db.prepararSnapshot('PlanEntregaRevision', {
      solicitudJson: revision.solicitudJson as Prisma.InputJsonValue,
      resultadoJson: JSON.parse(
        JSON.stringify(guardado),
      ) as Prisma.InputJsonValue,
    });
    await this.db.$transaction(
      async (tx) => {
        await bloquearColaEntrega(tx, auth.tenantId);
        const actual = await tx.planEntregaItem.findFirstOrThrow({
          where: { id: revision.planId, tenantId: auth.tenantId },
        });
        if (
          actual.version !== dto.expectedVersion ||
          (await this.origen(auth.tenantId, itemId, borrador, tx)).huella !==
            origen.huella ||
          (await this.contexto(auth.tenantId, origen.ids, tx)).huella !== huella
        )
          throw new ConflictException(
            'La cola cambió durante la búsqueda. Volvé a buscar las opciones actualizadas.',
          );
        const nueva = await tx.planEntregaRevision.create({
          data: {
            tenantId: auth.tenantId,
            planId: revision.planId,
            numero: actual.revisionActual + 1,
            idempotencyKey: randomUUID(),
            solicitudHuella: huellaPlan({
              origen: revision.solicitudHuella,
              excluidas: dto.ordenesExcluidas,
              huella,
            }),
            origenHuella: origen.huella,
            contextoHuella: huella,
            cantidad: revision.cantidad,
            estado: 'LISTA',
            calculadaEl: taller.ahora,
            solicitadoPorId: auth.userId,
            ...datos,
          },
        });
        await tx.planEntregaSolicitud.createMany({
          data: revision.entregas.map((e) => ({
            tenantId: auth.tenantId,
            revisionId: nueva.id,
            clave: e.clave,
            secuencia: e.secuencia,
            cantidad: e.cantidad,
            fechaSolicitada: e.fechaSolicitada,
          })),
        });
        // Reutiliza los snapshots comprimidos sin leer ni duplicar CAD en memoria.
        await tx.$executeRaw`INSERT INTO "FuenteProduccionEntrega" ("id","tenantId","revisionId","cantidad","calculoJson","contextoJson")
        SELECT gen_random_uuid(), "tenantId", ${nueva.id}::uuid, "cantidad", "calculoJson", "contextoJson"
        FROM "FuenteProduccionEntrega" WHERE "revisionId" = ${revision.id}::uuid AND "tenantId" = ${auth.tenantId}::uuid`;
        await tx.planEntregaItem.update({
          where: { id: actual.id, tenantId: auth.tenantId },
          data: {
            revisionActual: nueva.numero,
            version: { increment: 1 },
            alternativaElegidaId: null,
            ajusteNestingAceptado: actual.ajusteNestingAceptado,
            cambioEntregasAceptado: false,
            elegidaEl: null,
            elegidaPorId: null,
          },
        });
      },
      { timeout: 30_000 },
    );
    return this.consultar(auth.tenantId, itemId, borrador);
  }

  async elegir(
    auth: CurrentAuth,
    itemId: string,
    dto: ElegirPlanEntregaDto,
    borrador = false,
  ) {
    const origen = await this.origen(auth.tenantId, itemId, borrador);
    const plan = await this.db.planEntregaItem.findFirst({
      where: {
        tenantId: auth.tenantId,
        ...(borrador
          ? { cotizacionItemId: itemId, ordenItemId: null }
          : { ordenItemId: itemId }),
      },
    });
    if (!plan) throw new NotFoundException('No se encontró el plan.');
    await this.db.$transaction(
      async (tx) => {
        await bloquearColaEntrega(tx, auth.tenantId);
        const contexto = await this.contexto(auth.tenantId, origen.ids, tx);
        if (
          (await this.origen(auth.tenantId, itemId, borrador, tx)).huella !==
          origen.huella
        )
          throw new ConflictException(
            'Cambió la orden mientras confirmabas. Actualizá la propuesta.',
          );
        await tx.$queryRaw`SELECT "id" FROM "PlanEntregaItem" WHERE "id" = ${plan.id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
        const actual = await tx.planEntregaItem.findFirstOrThrow({
          where: { id: plan.id, tenantId: auth.tenantId },
        });
        if (
          actual.version === dto.expectedVersion + 1 &&
          actual.alternativaElegidaId === dto.alternativaId &&
          actual.reprogramacionAplicadaRevisionId === dto.revisionId
        )
          return;
        if (borrador && actual.ordenItemId)
          throw new ConflictException(
            'La distribución ya fue guardada en una OT.',
          );
        const r = await tx.planEntregaRevision.findFirst({
          where: {
            tenantId: auth.tenantId,
            planId: plan.id,
            numero: actual.revisionActual,
            id: dto.revisionId,
          },
        });
        if (
          !r ||
          r.estado !== 'LISTA' ||
          r.origenHuella !== origen.huella ||
          r.contextoHuella !== contexto.huella ||
          !r.calculadaEl ||
          contexto.taller.ahora.getTime() - r.calculadaEl.getTime() >
            VIGENCIA_MS
        )
          throw new ConflictException(
            'La propuesta está desactualizada. Recalculá antes de guardar la alternativa.',
          );
        const resultado = r.resultadoJson as unknown as ResultadoPlanGuardado;
        if (
          resultado.politica !== 'POR_ENTREGA' ||
          !resultado.resultado.alternativas.some(
            (a) => a.id === dto.alternativaId,
          )
        )
          throw new BadRequestException(
            'Recalculá la propuesta para fabricar una tanda por entrega.',
          );
        const alternativa = resultado.resultado.alternativas.find(
          (a) => a.id === dto.alternativaId,
        );
        if (
          !alternativa ||
          ['SIN_ESTIMACION', 'DESPLAZA_TRABAJOS', 'FUERA_DE_FECHA'].includes(
            alternativa.estado,
          )
        )
          throw new BadRequestException(
            alternativa?.estado === 'DESPLAZA_TRABAJOS'
              ? 'La propuesta desplaza operaciones de otras órdenes. Recalculá con la carga actual.'
              : alternativa?.estado === 'FUERA_DE_FECHA'
                ? 'La producción termina después de una fecha solicitada. Revisá esa fecha o dejala vacía para que el sistema la sugiera.'
                : 'Faltan tiempos o recursos para estimar toda la producción. Revisá los datos pendientes.',
          );
        if (alternativa.reprogramacion) {
          if (!auth.permisos?.has('produccion.supervisar'))
            throw new ForbiddenException(
              'Necesitás permiso de supervisión de producción para reprogramar otras órdenes.',
            );
          if (
            alternativa.reprogramacion.entregasAfectadas.some(
              (e) => e.cambiaEntrega,
            ) &&
            !dto.aceptarCambioEntregas
          )
            throw new BadRequestException(
              'Aceptá expresamente las nuevas fechas de entrega indicadas.',
            );
        }
        const requiereAceptacion =
          resultado.nesting?.estado === 'REQUIERE_AJUSTE';
        if (
          requiereAceptacion &&
          !dto.aceptarAjusteNesting &&
          !actual.ajusteNestingAceptado
        )
          throw new BadRequestException(
            'Aceptá el ajuste de los layouts y su costo adicional antes de usar esta distribución.',
          );
        if (actual.version !== dto.expectedVersion) {
          if (actual.alternativaElegidaId === dto.alternativaId) return; // Reintento exacto.
          throw new ConflictException(
            'Otra ventana modificó la elección. Actualizá el plan.',
          );
        }
        await tx.planEntregaItem.update({
          where: { id: plan.id, tenantId: auth.tenantId },
          data: {
            alternativaElegidaId: dto.alternativaId,
            cambioEntregasAceptado: !!dto.aceptarCambioEntregas,
            ajusteNestingAceptado:
              requiereAceptacion &&
              (dto.aceptarAjusteNesting === true ||
                actual.ajusteNestingAceptado),
            elegidaPorId: auth.userId,
            elegidaEl: contexto.taller.ahora,
            version: { increment: 1 },
          },
        });
        await tx.planEntregaRevision.update({
          where: { id: r.id, tenantId: auth.tenantId },
          data: {
            eleccionJson: {
              alternativaId: dto.alternativaId,
              cambioEntregasAceptado: !!dto.aceptarCambioEntregas,
              usuarioId: auth.userId,
            },
          },
        });
        if (!borrador && 'item' in origen && origen.item) {
          const i = origen.item;
          await this.produccion().sincronizarLotesEntrega(
            tx,
            auth.tenantId,
            i.id,
          );
          await tx.ordenTrabajoEvento.create({
            data: {
              tenantId: auth.tenantId,
              ordenId: i.orden.id,
              tipo: 'planificacion_entregas',
              descripcion: `Se aplicó la distribución de ${origen.cantidad} unidades en ${alternativa.entregas.length} lotes de producción.`,
              usuarioId: auth.userId,
              usuarioNombre: auth.email ?? 'Usuario',
              origen: 'usuario',
              datosJson: {
                planId: plan.id,
                revisionId: r.id,
                ajusteNestingAceptado: requiereAceptacion,
              },
            },
          });
          await actualizarFechaFinalOrden(tx, auth.tenantId, i.orden.id);
          const orden = await tx.ordenTrabajo.findUniqueOrThrow({
            where: { id: i.orden.id },
            select: { updatedAt: true },
          });
          // Cambiar la fecha de cierre no invalida la elección que la produjo.
          await tx.planEntregaRevision.update({
            where: { id: r.id, tenantId: auth.tenantId },
            data: {
              origenHuella: huellaPlan({
                itemId,
                cantidad: origen.cantidad,
                cotizacionId: i.cotizacionItem!.id,
                cotizacionVersion: i.cotizacionItem!.updatedAt,
                recetaRevisionId:
                  i.recetaRevisionId ?? i.cotizacionItem!.recetaRevisionId,
                recetaHuella: i.recetaHuella ?? i.cotizacionItem!.recetaHuella,
                ordenVersion: orden.updatedAt,
                estado: i.orden.estado,
              }),
            },
          });
        }
      },
      { timeout: 30_000 },
    );
    if (!borrador)
      await this.produccion().prepararRecorridosDeItems(auth, [itemId]);
    return this.consultar(auth.tenantId, itemId, borrador);
  }

  async eliminar(
    auth: CurrentAuth,
    itemId: string,
    dto: EliminarPlanEntregaDto,
  ) {
    const origen = await this.origen(auth.tenantId, itemId);
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${auth.tenantId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "PlanEntregaItem" WHERE "id" = ${dto.planId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const actual = await tx.planEntregaItem.findFirst({
        where: { id: dto.planId, tenantId: auth.tenantId, ordenItemId: itemId },
      });
      if (!actual || actual.version !== dto.expectedVersion)
        throw new ConflictException(
          'La distribución cambió. Volvé a abrirla antes de eliminarla.',
        );
      await tx.planEntregaItem.update({
        where: { id: actual.id },
        data: { alternativaElegidaId: null },
      });
      await this.produccion().sincronizarLotesEntrega(
        tx,
        auth.tenantId,
        itemId,
        true,
      );
      await tx.planEntregaItem.delete({
        where: { id: actual.id, tenantId: auth.tenantId },
      });
      if ('item' in origen && origen.item)
        await actualizarFechaFinalOrden(
          tx,
          auth.tenantId,
          origen.item.orden.id,
        );
    });
    await this.produccion().prepararRecorridosDeItems(auth, [itemId]);
    return { plan: null, reservaCapacidad: false as const };
  }

  /** Ejecutado sólo por el worker. El callback recibe inputs originados en DB. */
  async calcular(
    tenantId: string,
    revisionId: string,
    cotizar: (
      input: CotizarInput,
      signal?: AbortSignal,
    ) => Promise<CotizarOutput>,
    signal?: AbortSignal,
  ) {
    const revision = await this.db.planEntregaRevision.findFirst({
      where: { id: revisionId, tenantId },
      include: { plan: true },
    });
    if (!revision || ['LISTA', 'SUPERADA', 'FALLIDA'].includes(revision.estado))
      return;
    const ejecucionId = randomUUID();
    const reclamo = await this.db.planEntregaRevision.updateMany({
      where: {
        id: revision.id,
        tenantId,
        estado: { in: ['SOLICITADA', 'CALCULANDO'] },
      },
      data: { estado: 'CALCULANDO', ejecucionId, error: null },
    });
    if (!reclamo.count) return;
    // El pulso usa el token de esta ejecución: un worker anterior nunca renueva
    // ni publica sobre una revisión que otro worker ya retomó o reemplazó.
    let renovando = false;
    const pulso = setInterval(() => {
      if (renovando) return;
      renovando = true;
      void this.db.planEntregaRevision
        .updateMany({
          where: {
            id: revisionId,
            tenantId,
            estado: 'CALCULANDO',
            ejecucionId,
          },
          data: { updatedAt: new Date() },
        })
        .catch((error: unknown) => this.logger.warn(respuestaError(error)))
        .finally(() => {
          renovando = false;
        });
    }, RENOVACION_PLAN_MS);
    pulso.unref();
    try {
      const solicitud =
        revision.solicitudJson as unknown as SolicitudPlanCongelada;
      const origen = await this.origenDePlan(tenantId, revision.planId);
      if (origen.huella !== revision.origenHuella)
        throw new Error(
          'La orden cambió desde la solicitud. Volvé a calcular la distribución.',
        );
      const entregas = solicitud.entregas.map((e) => ({
        id: e.clave,
        cantidad: e.cantidad,
        fechaSolicitada: e.fechaSolicitada,
      }));
      const fuentes = await obtenerCotizacionesF6({
        input: solicitud.input,
        entregas,
        porEntrega: true,
        signal,
        cotizar: async (input, s) => {
          const vigente = await this.db.planEntregaRevision.findFirst({
            where: {
              id: revisionId,
              tenantId,
              estado: 'CALCULANDO',
              ejecucionId,
            },
            select: { id: true },
          });
          if (!vigente)
            throw new Error(
              'Esta revisión fue reemplazada por una solicitud más reciente.',
            );
          await this.db.planEntregaRevision.updateMany({
            where: { id: revisionId, tenantId, ejecucionId },
            data: { cantidadCalculada: Number(input.jobContext.cantidad) },
          });
          return cotizar(input, s);
        },
      });
      // El contexto se obtiene después del nesting, que puede tardar minutos.
      const actual = await this.origenDePlan(tenantId, revision.planId);
      if (actual.huella !== revision.origenHuella)
        throw new Error(
          'La orden cambió mientras se calculaba. Actualizá la propuesta.',
        );
      const { taller, huella } = await this.contexto(tenantId, actual.ids);
      const condiciones: string[] = [];
      if (
        fuentes.some(
          (f) =>
            f.cotizacion.receta?.revisionId !== solicitud.recetaRevisionId ||
            f.cotizacion.receta?.huella !== solicitud.recetaHuella,
        )
      )
        condiciones.push(
          'La receta actual difiere de la cotizada en la OT. Revisá la cotización antes de adoptar un plan productivo.',
        );
      const calculado = planificarCotizacionesF6({
        tenantId,
        configuracionId: fuentes[0].configuracionId,
        fuentes,
        cantidad: revision.cantidad,
        entregas,
        taller,
        margenDiasHabiles: taller.margenEtaDias,
        prioridadSinFechas: 'PRIMERAS_ENTREGAS',
        condicionesPendientes: condiciones,
        // Una operación sólo se comparte entre lotes cuando su receta lo declare.
        // Hasta definir esa política de catálogo, todas conservan su costo por tanda.
        operacionesUnaVez: [],
        porEntrega: true,
      });
      signal?.throwIfAborted();
      const resultadoJson = serializarPlan(
        calculado,
        taller.zona,
        taller.margenEtaDias,
        taller.ahora,
      );
      resultadoJson.politica = 'POR_ENTREGA';
      // Compara contra los archivos cotizados, no contra un nuevo nesting del total.
      const cotizacionId =
        revision.plan.cotizacionItemId ??
        ('item' in origen ? origen.item?.cotizacionItemId : null);
      const guardada = cotizacionId
        ? await this.db.cotizacionItem.findFirst({
            where: { id: cotizacionId, tenantId },
            select: { trazabilidadJson: true, snapshotJson: true },
          })
        : null;
      let originales: PlanGeometricoF6[] | null = null;
      try {
        const traza = guardada?.trazabilidadJson as unknown as Pick<
          CotizacionResultado,
          'pasos' | 'componentesFabricados' | 'analisisNestingCompuesto'
        >;
        const snapshot = guardada?.snapshotJson as {
          ejecucion?: { costos?: CotizacionResultado['costos'] };
        } | null;
        if (traza?.pasos)
          originales = planesGuardadosF6({
            ...fuentes[0],
            cotizacion: {
              ...fuentes[0].cotizacion,
              ...traza,
              costos:
                snapshot?.ejecucion?.costos ?? fuentes[0].cotizacion.costos,
            },
          }, true);
      } catch {
        /* Un histórico incompleto no permite afirmar que conserva sus layouts. */
      }
      resultadoJson.nesting = evaluarLayoutsEntregas(
        originales,
        calculado.detalles.find((d) => d.alternativaId === 'por-entrega')
          ?.lotesGeometricos ?? [],
      );
      const preparada = this.db.prepararSnapshot('PlanEntregaRevision', {
        resultadoJson: resultadoJson as unknown as Prisma.InputJsonValue,
      });
      // El solver no vuelve a ejecutarse al emitir. Conservamos una fuente por
      // cantidad distinta, también cuando los layouts requieren aceptación.
      const cantidadesEntregas = new Set(entregas.map((e) => e.cantidad));
      const fuentesProduccion = fuentes
        .filter((f) => cantidadesEntregas.has(f.cotizacion.cantidadPedida))
        .map((f) =>
          this.db.prepararSnapshot('FuenteProduccionEntrega', {
            tenantId,
            revisionId,
            cantidad: f.cotizacion.cantidadPedida,
            calculoJson: f.cotizacion as unknown as Prisma.InputJsonValue,
            contextoJson: contextoParaCantidad(
              solicitud.input.jobContext,
              f.cotizacion.cantidadPedida,
            ) as unknown as Prisma.InputJsonValue,
          }),
        );
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "PlanEntregaItem" WHERE "id" = ${revision.planId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
        const plan = await tx.planEntregaItem.findFirstOrThrow({
          where: { id: revision.planId, tenantId },
        });
        if (plan.revisionActual !== revision.numero) return;
        const vigente = await tx.planEntregaRevision.findFirst({
          where: {
            id: revisionId,
            tenantId,
            estado: 'CALCULANDO',
            ejecucionId,
          },
          select: { id: true },
        });
        if (!vigente) return;
        await tx.fuenteProduccionEntrega.createMany({
          data: fuentesProduccion,
          skipDuplicates: true,
        });
        await tx.planEntregaRevision.updateMany({
          where: {
            id: revisionId,
            tenantId,
            estado: 'CALCULANDO',
            ejecucionId,
          },
          data: {
            ...preparada,
            estado: 'LISTA',
            contextoHuella: huella,
            calculadaEl: taller.ahora,
            ejecucionId: null,
            error: null,
          },
        });
      });
    } catch (error) {
      await this.db.planEntregaRevision.updateMany({
        where: { id: revisionId, tenantId, estado: 'CALCULANDO', ejecucionId },
        data: {
          estado: 'FALLIDA',
          error: respuestaError(error),
          ejecucionId: null,
        },
      });
    } finally {
      clearInterval(pulso);
    }
  }
}
