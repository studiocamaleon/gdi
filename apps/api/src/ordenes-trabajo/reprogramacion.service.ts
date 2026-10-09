import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { EtaService } from '../eta/eta.service';
import { simularFlujo, sumarDiasHabiles } from '../eta/motor/flujo-produccion';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import {
  claveFechaEnZona,
  instanteDe,
  partesEnZona,
  sumarDiasAClave,
} from '../common/zona';
import {
  huellaContextoPlan,
  huellaPlan,
} from '../planificacion-entregas/planificacion-contrato';
import { bloquearColaEntrega } from '../planificacion-entregas/reprogramacion-bloqueo';
import {
  distribucionesDeItems,
  fechaDistribucion,
} from '../planificacion-entregas/resumen-entregas';
import {
  fijarPlanReferencia,
  leerPlanReferencia,
} from '../produccion/plan-referencia-paso';
import type {
  RevisionReprogramacion,
  SolicitudReprogramacion,
} from './reprogramacion.contrato';
import type { ConfirmarReprogramacionDto } from './dto/reprogramacion.dto';

type Foto = Awaited<ReturnType<ReprogramacionService['leer']>>;
type Propuesta = {
  version: 1;
  tenantId: string;
  usuarioId: string;
  pasoId: string;
  solicitud: SolicitudReprogramacion;
  emitidaEl: number;
  contexto: string;
  impacto: string;
};
const VIGENCIA = 120_000;
const iso = (f?: Date | null) => f?.toISOString() ?? null;
const minuto = (f?: Date | string | null) =>
  f ? Math.floor(new Date(f).getTime() / 60_000) : null;

export function fechaReprogramacion(
  s: SolicitudReprogramacion,
  zona: string,
  ahora: Date,
) {
  if (
    !['produccion', 'entrega'].includes(s.tipo) ||
    !['paso', 'item'].includes(s.alcance) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.fecha) ||
    !Number.isFinite(Date.parse(`${s.fecha}T00:00:00Z`)) ||
    new Date(`${s.fecha}T00:00:00Z`).toISOString().slice(0, 10) !== s.fecha
  )
    throw new BadRequestException('Elegí una fecha válida.');
  if (s.fecha < claveFechaEnZona(ahora, zona))
    throw new BadRequestException(
      'La nueva fecha no puede estar en el pasado.',
    );
  if (s.tipo === 'entrega') {
    if (s.alcance !== 'item' || s.hora)
      throw new BadRequestException(
        'La entrega se acuerda por ítem o lote, sin hora.',
      );
    return s.fecha;
  }
  if (!s.hora || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.hora))
    throw new BadRequestException('Elegí una hora válida.');
  const inicio = instanteDe(s.fecha, s.hora, zona);
  const partes = partesEnZona(inicio, zona);
  if (
    claveFechaEnZona(inicio, zona) !== s.fecha ||
    `${String(partes.hh).padStart(2, '0')}:${String(partes.mm).padStart(2, '0')}` !==
      s.hora
  )
    throw new BadRequestException('Esa hora no existe en la zona del taller.');
  if (minuto(inicio)! < minuto(ahora)!)
    throw new BadRequestException('El inicio no puede estar en el pasado.');
  if (s.fecha > sumarDiasAClave(claveFechaEnZona(ahora, zona), 119))
    throw new BadRequestException(
      'Elegí un inicio dentro de los próximos 119 días.',
    );
  return inicio.toISOString();
}

@Injectable()
export class ReprogramacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eta: EtaService,
    private readonly eventos: EventosSistemaService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  private autorizar(auth: CurrentAuth, tipo: SolicitudReprogramacion['tipo']) {
    const permiso =
      tipo === 'produccion'
        ? 'produccion.supervisar'
        : 'comercial.ordenes.gestionar';
    if (
      !auth.tenantId ||
      !auth.permisos?.has('produccion.planificacion.ver') ||
      !auth.permisos.has(permiso)
    )
      throw new ForbiddenException(
        tipo === 'produccion'
          ? 'Necesitás permiso de supervisión para reprogramar producción.'
          : 'Necesitás permiso para gestionar órdenes y cambiar la entrega.',
      );
  }

  async leer(
    auth: CurrentAuth,
    pasoId: string,
    s: SolicitudReprogramacion,
    db: Prisma.TransactionClient,
  ) {
    this.autorizar(auth, s.tipo);
    await this.capacidades.exigir(auth.tenantId, 'planificacion_avanzada', db);
    const [entrada, registros, items] = await Promise.all([
      this.eta.contextoSimulacion(
        auth.tenantId,
        db,
        'lectura',
        'planificacion_avanzada',
      ),
      db.ordenTrabajoItemPaso.findMany({
        where: {
          tenantId: auth.tenantId,
          orden: { estado: { in: ['pendiente', 'produccion'] } },
        },
        select: {
          id: true,
          itemId: true,
          estado: true,
          iniciadoEl: true,
          planificadoDesde: true,
          planificadoHasta: true,
          planReferenciaJson: true,
          nestingLoteId: true,
          nestingLoteRol: true,
          updatedAt: true,
          tramos: { select: { id: true } },
          gatesOperativos: { select: { tipo: true, estado: true } },
        },
        orderBy: { id: 'asc' },
      }),
      db.ordenTrabajoItem.findMany({
        where: {
          tenantId: auth.tenantId,
          orden: { estado: { in: ['pendiente', 'produccion'] } },
        },
        select: {
          id: true,
          nombre: true,
          ordenId: true,
          parentItemId: true,
          loteEntregaId: true,
          contieneLotesEntrega: true,
          fechaEntrega: true,
          entregadoEl: true,
          orden: { select: { fechaEntrega: true } },
          lotesEntrega: { select: { id: true, fechaEntrega: true } },
          loteEntrega: {
            select: { id: true, fechaEntrega: true, productoItemId: true },
          },
        },
        orderBy: { id: 'asc' },
      }),
    ]);
    const registro = registros.find((p) => p.id === pasoId);
    const item = items.find((i) => i.id === registro?.itemId);
    const paso = entrada.items
      .flatMap((i) => i.pasos)
      .find((p) => p.id === pasoId);
    if (!registro || !item || !paso)
      throw new NotFoundException(
        'El paso ya no está disponible en planificación.',
      );
    let raiz = item;
    const vistos = new Set([raiz.id]);
    while (raiz.parentItemId && !item.loteEntregaId) {
      const padre = items.find(
        (i) => i.id === raiz.parentItemId && i.ordenId === item.ordenId,
      );
      if (!padre || vistos.has(padre.id))
        throw new ConflictException(
          'Revisá la estructura del ítem antes de cambiar sus fechas.',
        );
      raiz = padre;
      vistos.add(raiz.id);
    }
    const idsItem = new Set(
      item.loteEntregaId
        ? items
            .filter((i) => i.loteEntregaId === item.loteEntregaId)
            .map((i) => i.id)
        : [raiz.id],
    );
    if (!item.loteEntregaId)
      for (let cambio = true; cambio; ) {
        cambio = false;
        for (const i of items)
          if (
            i.ordenId === item.ordenId &&
            i.parentItemId &&
            idsItem.has(i.parentItemId) &&
            !idsItem.has(i.id)
          ) {
            idsItem.add(i.id);
            cambio = true;
          }
      }
    if (
      s.tipo === 'entrega' &&
      items.some((i) => idsItem.has(i.id) && i.entregadoEl)
    )
      throw new ConflictException(
        'No se puede cambiar la entrega de un ítem ya entregado.',
      );
    if (
      s.tipo === 'entrega' &&
      !item.loteEntregaId &&
      items.some((i) => idsItem.has(i.id) && i.contieneLotesEntrega)
    )
      throw new ConflictException(
        'Este producto tiene entregas por lotes. Seleccioná un paso del lote cuya entrega querés cambiar.',
      );
    const solicitado = fechaReprogramacion(s, entrada.zona, entrada.ahora);
    const distribuciones = await distribucionesDeItems(
      db,
      auth.tenantId,
      items
        .filter((i) => i.ordenId === item.ordenId && !i.parentItemId)
        .map((i) => i.id),
    );
    const actual = item.orden.fechaEntrega?.toISOString().slice(0, 10) ?? null;
    const fechas = items
      .filter((i) => i.ordenId === item.ordenId && !i.parentItemId)
      .map((i) => {
        if (s.tipo === 'entrega' && item.loteEntrega?.productoItemId === i.id)
          return (
            i.lotesEntrega
              .map((l) =>
                l.id === item.loteEntregaId
                  ? s.fecha
                  : l.fechaEntrega.toISOString().slice(0, 10),
              )
              .sort()
              .at(-1) ?? null
          );
        if (s.tipo === 'entrega' && idsItem.has(i.id)) return s.fecha;
        return (
          fechaDistribucion(distribuciones.get(i.id)) ??
          i.fechaEntrega?.toISOString().slice(0, 10) ??
          actual
        );
      });
    const entregaOrden = {
      actual,
      propuesta:
        s.tipo === 'produccion'
          ? actual
          : fechas.every(Boolean)
            ? (fechas
                .filter((f): f is string => !!f)
                .sort()
                .at(-1) ?? null)
            : null,
    };
    const huella = huellaPlan({
      plan: huellaContextoPlan(entrada, entrada.margenEtaDias),
      registros,
      items,
      distribuciones: [...distribuciones],
    });
    return {
      entrada,
      registros,
      items,
      registro,
      item,
      paso,
      idsItem,
      solicitado,
      entregaOrden,
      huella,
      alcance:
        s.alcance === 'paso'
          ? paso.nombre
          : item.loteEntregaId
            ? `${item.nombre} · lote de entrega`
            : raiz.nombre,
    };
  }

  private evaluar(foto: Foto, s: SolicitudReprogramacion) {
    const { entrada, solicitado } = foto;
    const antes = simularFlujo(entrada);
    const pendientes = (id: string) => {
      const p = foto.registros.find((p) => p.id === id);
      return (
        p &&
        ['pendiente', 'bloqueado'].includes(p.estado) &&
        !p.iniciadoEl &&
        !p.tramos.length
      );
    };
    const objetivos = new Set(
      s.tipo === 'entrega'
        ? []
        : s.alcance === 'paso'
          ? [foto.paso.id]
          : entrada.items
              .filter((i) => foto.idsItem.has(i.id))
              .flatMap((i) =>
                i.pasos.filter((p) => pendientes(p.id)).map((p) => p.id),
              ),
    );
    if (
      s.tipo === 'produccion' &&
      (!objetivos.size || [...objetivos].some((id) => !pendientes(id)))
    )
      throw new ConflictException(
        'Sólo se pueden reprogramar pasos que todavía no se iniciaron.',
      );
    // El cierre usa las mismas precedencias que el motor, incluidas rutas antiguas.
    const previos = new Map<string, string[]>();
    for (const i of entrada.items) {
      const ordenados = [...i.pasos].sort((a, b) => a.indice - b.indice);
      ordenados.forEach((p, n) =>
        previos.set(
          p.id,
          p.nodoClave
            ? (p.predecesorPasoIds ?? [])
            : n
              ? [ordenados[n - 1].id]
              : [],
        ),
      );
    }
    const movidos = new Set(objetivos);
    for (let cambio = true; cambio; ) {
      cambio = false;
      for (const [id, prev] of previos)
        if (
          !movidos.has(id) &&
          prev.some((p) => movidos.has(p)) &&
          pendientes(id)
        ) {
          movidos.add(id);
          cambio = true;
        }
    }
    if (
      [...previos].some(
        ([id, dependencias]) =>
          dependencias.some((p) => movidos.has(p)) &&
          foto.registros.some(
            (p) => p.id === id && p.estado !== 'hecho' && !pendientes(id),
          ),
      )
    )
      throw new ConflictException(
        'Un paso siguiente ya se inició. Revisá el recorrido antes de mover sus dependencias.',
      );
    if (
      foto.registros.some(
        (p) =>
          movidos.has(p.id) &&
          foto.items.some((i) => i.id === p.itemId && i.entregadoEl),
      )
    )
      throw new ConflictException(
        'No se puede reprogramar la producción de un ítem ya entregado.',
      );
    if (foto.registros.some((p) => movidos.has(p.id) && p.nestingLoteId))
      throw new ConflictException(
        'Este recorrido tiene operaciones agrupadas en un trabajo conjunto. La reprogramación conjunta todavía no está disponible.',
      );
    const pisos = new Map<string, string | null>();
    const propuesta = {
      ...entrada,
      items: entrada.items.map((i) => ({
        ...i,
        fechaEntrega:
          s.tipo === 'entrega' && foto.idsItem.has(i.id)
            ? s.fecha
            : i.fechaEntrega,
        pasos: i.pasos.map((p) => {
          if (!movidos.has(p.id)) return p;
          const r = foto.registros.find((r) => r.id === p.id)!;
          // Un inicio sin ventana final puede provenir de materiales. Conservarlo
          // también después de aceptar una agenda, para no perder esa restricción.
          const piso =
            leerPlanReferencia(r.planReferenciaJson)?.inicioMinimo ??
            (!p.planificadoHasta ? p.planificadoDesde : null) ??
            (r.gatesOperativos.some(
              (g) => g.tipo === 'MATERIAL' && g.estado === 'PENDIENTE',
            )
              ? p.planificadoDesde
              : null) ??
            null;
          pisos.set(p.id, piso);
          const desde = objetivos.has(p.id)
            ? [solicitado, piso]
                .filter((v): v is string => !!v)
                .sort()
                .at(-1)!
            : piso;
          return {
            ...p,
            planificadoDesde: desde,
            planificadoHasta: null,
            atencionPlanificada: null,
          };
        }),
      })),
    };
    const despues = simularFlujo(propuesta);
    const a = new Map(antes.traza.map((p) => [p.pasoId, p])),
      b = new Map(despues.traza.map((p) => [p.pasoId, p]));
    const motivos: string[] = [];
    if (
      s.tipo === 'entrega' &&
      entrada.items
        .filter((i) => foto.idsItem.has(i.id))
        .every((i) => i.fechaEntrega === s.fecha)
    )
      motivos.push('El ítem o lote ya tiene esa fecha de entrega.');
    for (const id of movidos)
      if (!b.has(id) || b.get(id)!.parcial) {
        const i = entrada.items.find((i) => i.pasos.some((p) => p.id === id))!;
        motivos.push(
          `${i.nombre}: ${despues.porItem.get(i.id)?.motivoSinEstimar ?? 'faltan datos para confirmar el calendario, los recursos o la duración.'}`,
        );
      }
    if (
      antes.traza.some(
        (p) => !p.parcial && (!b.has(p.pasoId) || b.get(p.pasoId)!.parcial),
      )
    )
      motivos.push(
        'La propuesta dejaría otros pasos sin una estimación completa.',
      );
    const pasos: RevisionReprogramacion['pasos'] = entrada.items.flatMap((i) =>
      i.pasos.flatMap((p) => {
        const actual = a.get(p.id),
          siguiente = b.get(p.id);
        if (
          !movidos.has(p.id) &&
          minuto(actual?.inicio) === minuto(siguiente?.inicio) &&
          minuto(actual?.fin) === minuto(siguiente?.fin)
        )
          return [];
        return [
          {
            id: p.id,
            orden: i.ordenNumero,
            trabajo: i.nombre ?? i.id,
            paso: p.nombre,
            inicioActual: iso(actual?.inicio),
            finActual: iso(actual?.fin),
            inicioPropuesto: iso(siguiente?.inicio),
            finPropuesto: iso(siguiente?.fin),
            seGuarda: movidos.has(p.id),
          },
        ];
      }),
    );
    const entregas: RevisionReprogramacion['entregas'] =
      propuesta.items.flatMap((i) => {
        const previo = entrada.items.find((x) => x.id === i.id)!;
        const fin = despues.porItem.get(i.id)?.finEstimado;
        if (
          !foto.idsItem.has(i.id) &&
          minuto(antes.porItem.get(i.id)?.finEstimado) === minuto(fin)
        )
          return [];
        const dia = fin
          ? claveFechaEnZona(
              sumarDiasHabiles(
                fin,
                entrada.margenEtaDias,
                entrada.noLaborables,
                entrada.zona,
              ),
              entrada.zona,
            )
          : null;
        return [
          {
            id: i.id,
            orden: i.ordenNumero,
            trabajo: i.nombre ?? i.id,
            actual: previo.fechaEntrega,
            propuesta: i.fechaEntrega,
            finPropuesto: iso(fin),
            enRiesgo: !!i.fechaEntrega && (!dia || dia > i.fechaEntrega),
          },
        ];
      });
    const advertencias: string[] = [];
    if (s.tipo === 'produccion') {
      advertencias.push(
        'La entrega comprometida se conserva. El inicio solicitado es un límite: el calendario y las dependencias pueden ubicar el trabajo más tarde.',
      );
      if (
        [...movidos].some(
          (id) =>
            foto.registros.find((p) => p.id === id)?.estado === 'bloqueado' ||
            foto.registros
              .find((p) => p.id === id)
              ?.gatesOperativos.some((g) => g.estado === 'PENDIENTE'),
        )
      )
        advertencias.push(
          'Hay requisitos pendientes. La propuesta supone su resolución; cambiar la fecha no habilita la ejecución.',
        );
      if ([...pisos.values()].some((p) => p && p > solicitado))
        advertencias.push(
          'Se conserva un inicio mínimo anterior del trabajo; puede corresponder a disponibilidad de material.',
        );
    } else
      advertencias.push(
        'Se cambia el compromiso del ítem o lote. La entrega final de la OT refleja el último compromiso cuando todos sus productos tienen fecha.',
      );
    const impacto = {
      viable: !motivos.length,
      motivos: [...new Set(motivos)],
      advertencias,
      alcance: foto.alcance,
      solicitado,
      entregaOrden: foto.entregaOrden,
      pasos,
      entregas,
    };
    const huella = huellaPlan(impacto, (v) =>
      typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? minuto(v) : v,
    );
    return { impacto, huella, despues, movidos, pisos };
  }

  private firma(cuerpo: string) {
    const clave = process.env.JWT_SECRET;
    if (!clave) throw new Error('Falta la clave para firmar la propuesta.');
    return createHmac('sha256', clave)
      .update(`reprogramacion:v1:${cuerpo}`)
      .digest();
  }
  private token(auth: CurrentAuth, pasoId: string, token: string): Propuesta {
    try {
      if (typeof token !== 'string' || token.length > 8192) throw new Error();
      const [cuerpo, firma, extra] = token.split('.');
      if (!cuerpo || !firma || extra !== undefined) throw new Error();
      const recibida = Buffer.from(firma, 'base64url'),
        esperada = this.firma(cuerpo);
      if (
        recibida.length !== esperada.length ||
        !timingSafeEqual(recibida, esperada)
      )
        throw new Error();
      const p = JSON.parse(
        Buffer.from(cuerpo, 'base64url').toString(),
      ) as Propuesta;
      if (
        p.version !== 1 ||
        p.tenantId !== auth.tenantId ||
        p.usuarioId !== auth.userId ||
        p.pasoId !== pasoId ||
        !Number.isFinite(p.emitidaEl) ||
        Date.now() < p.emitidaEl ||
        Date.now() - p.emitidaEl > VIGENCIA
      )
        throw new Error();
      return p;
    } catch {
      throw new ConflictException(
        'La propuesta venció o no es válida. Volvé a revisar el impacto.',
      );
    }
  }
  private async transaccion<T>(
    operar: (tx: Prisma.TransactionClient) => Promise<T>,
    escritura = false,
  ) {
    try {
      return await this.prisma.$transaction(operar, {
        isolationLevel: escritura ? 'Serializable' : 'RepeatableRead',
        timeout: 30_000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' ||
          (error.code === 'P2010' &&
            ['40001', '40P01'].includes(String(error.meta?.code))))
      )
        throw new ConflictException(
          'El taller cambió durante la confirmación. Volvé a revisar el impacto.',
        );
      throw error;
    }
  }
  simular(
    auth: CurrentAuth,
    pasoId: string,
    solicitud: SolicitudReprogramacion,
  ): Promise<RevisionReprogramacion> {
    return this.transaccion(async (tx) => {
      const foto = await this.leer(auth, pasoId, solicitud, tx);
      const e = this.evaluar(foto, solicitud),
        emitidaEl = Date.now();
      const p: Propuesta = {
        version: 1,
        tenantId: auth.tenantId,
        usuarioId: auth.userId,
        pasoId,
        solicitud,
        emitidaEl,
        contexto: foto.huella,
        impacto: e.huella,
      };
      const cuerpo = Buffer.from(JSON.stringify(p)).toString('base64url');
      return {
        ...e.impacto,
        zona: foto.entrada.zona,
        venceEl: new Date(emitidaEl + VIGENCIA).toISOString(),
        token: e.impacto.viable
          ? `${cuerpo}.${this.firma(cuerpo).toString('base64url')}`
          : null,
      };
    });
  }
  async confirmar(
    auth: CurrentAuth,
    pasoId: string,
    body: ConfirmarReprogramacionDto,
  ) {
    const p = this.token(auth, pasoId, body.token);
    this.autorizar(auth, p.solicitud.tipo);
    return this.transaccion(async (tx) => {
      await this.capacidades.exigirOperacionTx(
        tx,
        auth.tenantId,
        ['planificacion_avanzada'],
        ['planificacion_avanzada'],
      );
      await bloquearColaEntrega(tx, auth.tenantId);
      const foto = await this.leer(auth, pasoId, p.solicitud, tx);
      if (foto.huella !== p.contexto)
        throw new ConflictException(
          'Cambiaron los trabajos, las fechas o los horarios. Volvé a revisar el impacto.',
        );
      const e = this.evaluar(foto, p.solicitud);
      if (
        !e.impacto.viable ||
        e.huella !== p.impacto ||
        Date.now() - p.emitidaEl > VIGENCIA
      )
        throw new ConflictException(
          'La proyección cambió. Volvé a revisar el impacto.',
        );
      if (p.solicitud.tipo === 'produccion') {
        for (const plan of e.despues.traza.filter((t) =>
          e.movidos.has(t.pasoId),
        )) {
          const registro = foto.registros.find((r) => r.id === plan.pasoId)!;
          const referencia = {
            ...fijarPlanReferencia(
              registro.planReferenciaJson,
              plan,
              'plan_aceptado',
            ),
            inicioMinimo: e.pisos.get(plan.pasoId) ?? undefined,
          };
          const actualizado = await tx.ordenTrabajoItemPaso.updateMany({
            where: {
              tenantId: auth.tenantId,
              id: plan.pasoId,
              estado: { in: ['pendiente', 'bloqueado'] },
              iniciadoEl: null,
              tramos: { none: {} },
            },
            data: {
              planificadoDesde: plan.inicio,
              planificadoHasta: plan.fin,
              planReferenciaJson: JSON.parse(
                JSON.stringify(referencia),
              ) as Prisma.InputJsonValue,
              atencionPlanificadaJson: plan.atencionPlanificada
                ? (JSON.parse(
                    JSON.stringify(plan.atencionPlanificada),
                  ) as Prisma.InputJsonValue)
                : Prisma.DbNull,
            },
          });
          if (actualizado.count !== 1)
            throw new ConflictException(
              'Un paso ya se inició. Volvé a revisar la propuesta.',
            );
        }
      } else {
        const fecha = new Date(`${p.solicitud.fecha}T00:00:00Z`);
        // Materializar la herencia antes de modificar el cierre de la OT.
        await tx.ordenTrabajoItem.updateMany({
          where: {
            tenantId: auth.tenantId,
            ordenId: foto.item.ordenId,
            fechaEntrega: null,
            id: { notIn: [...foto.idsItem] },
          },
          data: { fechaEntrega: foto.item.orden.fechaEntrega },
        });
        await tx.ordenTrabajoItem.updateMany({
          where: { tenantId: auth.tenantId, id: { in: [...foto.idsItem] } },
          data: { fechaEntrega: fecha },
        });
        if (foto.item.loteEntregaId) {
          await tx.loteProduccionEntrega.update({
            where: { id: foto.item.loteEntregaId, tenantId: auth.tenantId },
            data: { fechaEntrega: fecha },
          });
          const lotes = await tx.loteProduccionEntrega.findMany({
            where: {
              tenantId: auth.tenantId,
              productoItemId: foto.item.loteEntrega!.productoItemId,
            },
            select: { fechaEntrega: true },
          });
          const ultima = lotes.reduce(
            (max, l) => (l.fechaEntrega > max ? l.fechaEntrega : max),
            fecha,
          );
          await tx.ordenTrabajoItem.update({
            where: {
              id: foto.item.loteEntrega!.productoItemId,
              tenantId: auth.tenantId,
            },
            data: { fechaEntrega: ultima },
          });
        }
        await tx.ordenTrabajo.update({
          where: { id: foto.item.ordenId, tenantId: auth.tenantId },
          data: {
            fechaEntrega: foto.entregaOrden.propuesta
              ? new Date(`${foto.entregaOrden.propuesta}T00:00:00Z`)
              : null,
          },
        });
      }
      const mensaje = `${foto.alcance}: ${p.solicitud.tipo === 'produccion' ? 'inicio solicitado' : 'entrega comprometida'} ${foto.solicitado}. ${e.movidos.size} paso(s) reprogramados.${body.motivo?.trim() ? ` Motivo: ${body.motivo.trim()}` : ''}`;
      await this.eventos.publicarDesdeAuth(
        auth,
        {
          tipo: 'produccion.fecha_reprogramada',
          entidadTipo: 'paso',
          entidadId: pasoId,
          titulo: 'Planificación actualizada',
          mensaje,
          href: '/produccion/planificacion',
          topicos: ['tablero-produccion'],
        },
        tx,
      );
      const user = await tx.user.findUniqueOrThrow({
        where: { id: auth.userId },
        select: { nombreCompleto: true },
      });
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: foto.item.ordenId,
          tipo: 'reprogramacion',
          descripcion: mensaje,
          datosJson: JSON.parse(
            JSON.stringify({
              solicitud: p.solicitud,
              pasos: e.impacto.pasos,
              entregas: e.impacto.entregas,
            }),
          ) as Prisma.InputJsonValue,
          usuarioId: auth.impersonacion?.actorUserId ?? auth.userId,
          usuarioNombre:
            auth.impersonacion?.actorNombre ??
            user.nombreCompleto ??
            auth.email,
        },
      });
      return { confirmado: true, pasoId };
    }, true);
  }
}
