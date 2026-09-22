import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { EtaService } from '../eta/eta.service';
import { construirAsignacion } from '../eta/asignacion-automatica';
import {
  simularFlujo,
  sumarDiasHabiles,
  type PasoProgramado,
} from '../eta/motor/flujo-produccion';
import { resolverEstacionDePaso } from '../eta/motor/tablero-tipos';
import { leerDemandaHumana } from '../eta/motor/demanda-humana';
import { leerAsignacionPersonal } from '../produccion/asignacion-personal';
import { leerPlanReferencia } from '../produccion/plan-referencia-paso';
import type { AsignacionManualPersonal } from '../produccion/asignacion-manual';
import {
  huellaContextoPlan,
  huellaPlan,
} from '../planificacion-entregas/planificacion-contrato';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import { claveFechaEnZona } from '../common/zona';
import type {
  ContextoAsignacionPersonal,
  ImpactoPasoAsignacion,
  RevisionAsignacionPersonal,
} from './asignacion-personal.contrato';
import type { ConfirmarAsignacionPersonalDto } from './dto/asignacion-personal.dto';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';

type Entrada = Awaited<ReturnType<EtaService['contextoSimulacion']>>;
type Foto = Awaited<ReturnType<AsignacionPersonalService['leer']>>;
type Propuesta = {
  version: 1;
  tenantId: string;
  usuarioId: string;
  pasoId: string;
  empleadoIds: string[];
  emitidaEl: number;
  contexto: string;
  impacto: string;
};
const VIGENCIA_MS = 120_000;
const minuto = (fecha: Date | string | null | undefined) =>
  fecha ? Math.floor(new Date(fecha).getTime() / 60_000) : null;
const iso = (fecha: Date | null | undefined) => fecha?.toISOString() ?? null;
const diferencia = (a: string | null, b: string | null) =>
  a && b ? minuto(b)! - minuto(a)! : null;
const idsDelPlan = (plan?: PasoProgramado) =>
  [
    ...new Set(
      plan?.reservasHumanas?.flatMap((r) => r.empleadoIds ?? []) ?? [],
    ),
  ].sort();

@Injectable()
export class AsignacionPersonalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eta: EtaService,
    private readonly eventos: EventosSistemaService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  private autorizar(auth: CurrentAuth) {
    if (!auth.tenantId || !auth.permisos?.has('produccion.supervisar'))
      throw new ForbiddenException(
        'Necesitás permiso de supervisión para asignar personal.',
      );
  }

  /** Una foto coherente y sin backfill: revisar una propuesta nunca escribe. */
  async leer(auth: CurrentAuth, pasoId: string, db: Prisma.TransactionClient) {
    this.autorizar(auth);
    await this.capacidades.exigir(auth.tenantId, 'asignacion_automatica', db);
    const [entrada, pasos, empleados] = await Promise.all([
      this.eta.contextoSimulacion(
        auth.tenantId,
        db,
        false,
        'asignacion_automatica',
      ),
      db.ordenTrabajoItemPaso.findMany({
        where: {
          tenantId: auth.tenantId,
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
          nestingLoteRol: true,
          tramos: { select: { id: true } },
        },
        orderBy: { id: 'asc' },
      }),
      db.empleado.findMany({
        where: { tenantId: auth.tenantId },
        select: { id: true, nombreCompleto: true, userId: true, activo: true },
        orderBy: { id: 'asc' },
      }),
    ]);
    const registro = pasos.find((p) => p.id === pasoId);
    const item = entrada.items.find((i) =>
      i.pasos.some((p) => p.id === pasoId),
    );
    const paso = item?.pasos.find((p) => p.id === pasoId);
    if (!registro || !item || !paso)
      throw new NotFoundException(
        'El paso ya no está disponible en producción.',
      );
    if (
      !['pendiente', 'bloqueado'].includes(paso.estado) ||
      registro.iniciadoEl ||
      registro.tramos.length
    )
      throw new ConflictException(
        'Sólo se puede reasignar un paso que todavía no se inició.',
      );
    if (
      paso.tipoEjecucion !== 'interno' ||
      registro.nestingLoteRol === 'PARTICIPANTE'
    )
      throw new BadRequestException(
        'Este paso se gestiona desde su proveedor o desde el trabajo conjunto.',
      );
    const estacion = resolverEstacionDePaso(entrada.estaciones, paso);
    if (!estacion?.activo || !estacion.planificacionPorEmpleados)
      throw new BadRequestException(
        'Configurá el personal de la estación antes de asignar este paso.',
      );
    const total =
      paso.duracionEstimadaMin ?? entrada.medianas.get(paso.familiaCodigo);
    if (total == null || !Number.isFinite(total) || total < 0)
      throw new BadRequestException(
        'El paso no tiene una duración válida para comprobar la asignación.',
      );
    const demanda = leerDemandaHumana(paso.demandaHumana, total);
    const preparacion =
      estacion.tiempoPreparacionMin ?? entrada.tiempoEntrePasosMin;
    const personasNecesarias = Math.max(
      0,
      ...(demanda
        ? demanda.fases.filter((f) => f.minutos > 0).map((f) => f.personas)
        : [total > 0 ? 1 : 0]),
      preparacion > 0 ? 1 : 0,
    );
    if (!personasNecesarias)
      throw new BadRequestException(
        'Este paso no requiere atención de personal.',
      );
    const candidatos = empleados
      .filter(
        (e) =>
          e.activo &&
          estacion.empleados?.some((p) => p.id === e.id && p.activo !== false),
      )
      .map((e) => {
        const calendario = estacion.empleados?.find(
          (p) => p.id === e.id,
        )?.calendario;
        return {
          id: e.id,
          nombre: e.nombreCompleto,
          tieneHorario:
            !!calendario &&
            Object.values(calendario.dias).some((f) => f?.length),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const contexto: ContextoAsignacionPersonal = {
      pasoId,
      paso: paso.nombre,
      trabajo: item.nombre ?? item.id,
      orden: item.ordenNumero,
      estacion: estacion.nombre ?? 'Estación',
      zona: entrada.zona,
      personasNecesarias,
      seleccionActual:
        leerAsignacionPersonal(registro.asignacionPersonalJson)?.personas.map(
          (p) => p.empleadoId,
        ) ?? [],
      candidatos,
    };
    const huella = huellaPlan({
      plan: huellaContextoPlan(entrada, entrada.margenEtaDias),
      pasos: pasos.map((p) => ({ ...p, asignacionPersonalJson: undefined })),
      empleados,
    });
    return {
      entrada,
      pasos,
      empleados,
      registro,
      item,
      paso,
      estacion,
      contexto,
      huella,
    };
  }

  private async transaccion<T>(
    operar: (tx: Prisma.TransactionClient) => Promise<T>,
    escritura = false,
  ) {
    try {
      return await this.prisma.$transaction(operar, {
        isolationLevel: escritura
          ? Prisma.TransactionIsolationLevel.Serializable
          : Prisma.TransactionIsolationLevel.RepeatableRead,
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

  contexto(auth: CurrentAuth, pasoId: string) {
    return this.transaccion(
      async (tx) => (await this.leer(auth, pasoId, tx)).contexto,
    );
  }

  private evaluar(foto: Foto, empleadoIds: string[]) {
    if (
      !Array.isArray(empleadoIds) ||
      empleadoIds.length !== foto.contexto.personasNecesarias ||
      new Set(empleadoIds).size !== empleadoIds.length
    )
      throw new BadRequestException(
        `Elegí exactamente ${foto.contexto.personasNecesarias} persona(s), sin repetir.`,
      );
    if (
      empleadoIds.some(
        (id) =>
          !foto.contexto.candidatos.some((c) => c.id === id && c.tieneHorario),
      )
    )
      throw new BadRequestException(
        'Sólo podés elegir personal activo de esta estación con horario configurado.',
      );
    const entrada: Entrada = {
      ...foto.entrada,
      items: foto.entrada.items.map((i) => ({
        ...i,
        pasos: i.pasos.map((p) =>
          p.id === foto.paso.id
            ? { ...p, personalFijo: { empleadoIds: [...empleadoIds].sort() } }
            : p,
        ),
      })),
    };
    const antes = simularFlujo(foto.entrada),
      despues = simularFlujo(entrada);
    const planesAntes = new Map(antes.traza.map((p) => [p.pasoId, p])),
      planesDespues = new Map(despues.traza.map((p) => [p.pasoId, p]));
    const nombres = (ids: string[]) =>
      ids.map(
        (id) =>
          foto.empleados.find((e) => e.id === id)?.nombreCompleto ??
          'Personal no disponible',
      );
    const impactoPaso = (id: string): ImpactoPasoAsignacion => {
      const item = entrada.items.find((i) => i.pasos.some((p) => p.id === id))!;
      const p = item.pasos.find((p) => p.id === id)!;
      const registro = foto.pasos.find((p) => p.id === id);
      const previo = planesAntes.get(id),
        propuesto = planesDespues.get(id);
      const previsto =
        leerPlanReferencia(registro?.planReferenciaJson)?.fin ??
        p.planificadoHasta ??
        null;
      const actual = iso(previo?.fin),
        fin = iso(propuesto?.fin);
      return {
        pasoId: id,
        paso: p.nombre,
        trabajo: item.nombre ?? item.id,
        orden: item.ordenNumero,
        previsto,
        actual,
        propuesto: fin,
        desvioActualMin: diferencia(previsto, actual),
        desvioPropuestoMin: diferencia(previsto, fin),
        diferenciaMin: diferencia(actual, fin),
        personalActual: nombres(
          previo
            ? idsDelPlan(previo)
            : (leerAsignacionPersonal(
                registro?.asignacionPersonalJson,
              )?.personas.map((p) => p.empleadoId) ?? []),
        ),
        personalPropuesto: nombres(idsDelPlan(propuesto)),
      };
    };
    const motivos: string[] = [];
    const plan = planesDespues.get(foto.paso.id);
    if (
      !plan ||
      plan.parcial ||
      huellaPlan(idsDelPlan(plan)) !== huellaPlan([...empleadoIds].sort())
    )
      motivos.push(
        despues.porItem.get(foto.item.id)?.motivoSinEstimar ??
          'No hay una ventana realizable para esta dotación, sus horarios y las dependencias del paso.',
      );
    const perdidos = antes.traza.filter(
      (p) => !p.parcial && !planesDespues.has(p.pasoId),
    );
    if (perdidos.length)
      motivos.push(
        `${perdidos.length} paso(s) que tenían una proyección quedarían sin estimar.`,
      );
    const afectados = foto.pasos
      .filter(
        (p) =>
          p.id !== foto.paso.id &&
          (minuto(planesAntes.get(p.id)?.fin) !==
            minuto(planesDespues.get(p.id)?.fin) ||
            huellaPlan(idsDelPlan(planesAntes.get(p.id))) !==
              huellaPlan(idsDelPlan(planesDespues.get(p.id)))),
      )
      .map((p) => impactoPaso(p.id));
    const entregas = entrada.items.flatMap((i) => {
      const actual = antes.porItem.get(i.id)?.finEstimado,
        propuesto = despues.porItem.get(i.id)?.finEstimado;
      if (minuto(actual) === minuto(propuesto)) return [];
      const entregaSugerida = propuesto
        ? claveFechaEnZona(
            sumarDiasHabiles(
              propuesto,
              entrada.margenEtaDias,
              entrada.noLaborables,
              entrada.zona,
            ),
            entrada.zona,
          )
        : null;
      return [
        {
          itemId: i.id,
          orden: i.ordenNumero,
          trabajo: i.nombre ?? i.id,
          entrega: i.fechaEntrega,
          entregaSugerida,
          actual: iso(actual),
          propuesto: iso(propuesto),
          enRiesgo:
            !!i.fechaEntrega &&
            (!entregaSugerida || entregaSugerida > i.fechaEntrega.slice(0, 10)),
        },
      ];
    });
    const advertencias = despues.porItem.get(foto.item.id)?.asumeDesbloqueo
      ? [
          'La proyección supone que se resolverán los bloqueos del trabajo. Asignar personal no elimina sus impedimentos ni dependencias.',
        ]
      : [];
    const impacto = {
      viable: !motivos.length,
      motivos,
      advertencias,
      paso: impactoPaso(foto.paso.id),
      afectados,
      entregas,
    };
    // La precisión visible es un minuto. No aceptar en silencio un impacto distinto.
    const huella = huellaPlan(impacto, (v) =>
      typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? minuto(v) : v,
    );
    return { impacto, huella, despues, entrada };
  }

  private firmar(cuerpo: string) {
    const clave = process.env.JWT_SECRET;
    if (!clave)
      throw new Error('Falta la clave del servidor para firmar la propuesta.');
    return createHmac('sha256', clave)
      .update(`asignacion-personal:v1:${cuerpo}`)
      .digest();
  }

  private leerToken(
    auth: CurrentAuth,
    pasoId: string,
    token: string,
  ): Propuesta {
    try {
      if (typeof token !== 'string' || token.length > 8192) throw new Error();
      const partes = token.split('.');
      if (partes.length !== 2) throw new Error();
      const firma = Buffer.from(partes[1], 'base64url'),
        esperada = this.firmar(partes[0]);
      if (firma.length !== esperada.length || !timingSafeEqual(firma, esperada))
        throw new Error();
      const p = JSON.parse(
        Buffer.from(partes[0], 'base64url').toString(),
      ) as Propuesta;
      if (
        p.version !== 1 ||
        p.tenantId !== auth.tenantId ||
        p.usuarioId !== auth.userId ||
        p.pasoId !== pasoId ||
        !Number.isFinite(p.emitidaEl) ||
        Date.now() < p.emitidaEl ||
        Date.now() - p.emitidaEl > VIGENCIA_MS
      )
        throw new Error();
      return p;
    } catch {
      throw new ConflictException(
        'La propuesta venció o no es válida. Volvé a revisar el impacto.',
      );
    }
  }

  simular(
    auth: CurrentAuth,
    pasoId: string,
    empleadoIds: string[],
  ): Promise<RevisionAsignacionPersonal> {
    return this.transaccion(async (tx) => {
      const foto = await this.leer(auth, pasoId, tx);
      const { impacto, huella } = this.evaluar(foto, empleadoIds);
      const emitidaEl = Date.now();
      const propuesta: Propuesta = {
        version: 1,
        tenantId: auth.tenantId,
        usuarioId: auth.userId,
        pasoId,
        empleadoIds: [...empleadoIds].sort(),
        emitidaEl,
        contexto: foto.huella,
        impacto: huella,
      };
      const cuerpo = Buffer.from(JSON.stringify(propuesta)).toString(
        'base64url',
      );
      return {
        ...impacto,
        zona: foto.entrada.zona,
        venceEl: new Date(emitidaEl + VIGENCIA_MS).toISOString(),
        token: impacto.viable
          ? `${cuerpo}.${this.firmar(cuerpo).toString('base64url')}`
          : null,
      };
    });
  }

  async confirmar(
    auth: CurrentAuth,
    pasoId: string,
    body: ConfirmarAsignacionPersonalDto,
  ) {
    this.autorizar(auth);
    await this.capacidades.exigir(auth.tenantId, 'asignacion_automatica');
    const propuesta = this.leerToken(auth, pasoId, body.token);
    return this.transaccion(async (tx) => {
      await this.capacidades.exigirOperacionTx(
        tx,
        auth.tenantId,
        ['asignacion_automatica'],
        ['asignacion_automatica'],
      );
      const foto = await this.leer(auth, pasoId, tx);
      if (foto.huella !== propuesta.contexto)
        throw new ConflictException(
          'Cambiaron los trabajos, las asignaciones o los horarios. Volvé a revisar el impacto.',
        );
      const evaluacion = this.evaluar(foto, propuesta.empleadoIds);
      if (
        !evaluacion.impacto.viable ||
        evaluacion.huella !== propuesta.impacto ||
        Date.now() - propuesta.emitidaEl > VIGENCIA_MS
      )
        throw new ConflictException(
          'La proyección cambió. Volvé a revisar el impacto antes de confirmar.',
        );
      const usuario = await tx.user.findUniqueOrThrow({
        where: { id: auth.userId },
        select: { nombreCompleto: true },
      });
      const manual: AsignacionManualPersonal = {
        version: 1,
        revision: randomUUID(),
        empleadoIds: propuesta.empleadoIds,
        asignadoEl: new Date().toISOString(),
        usuarioId: auth.impersonacion?.actorUserId ?? auth.userId,
        usuarioNombre:
          auth.impersonacion?.actorNombre ??
          usuario.nombreCompleto ??
          auth.email,
      };
      await tx.ordenTrabajoItemPaso.update({
        where: { id: pasoId, tenantId: auth.tenantId },
        data: { asignacionManualJson: manual, mesaUsuarioId: null },
      });
      // Publicar la misma simulación revisada para todo el taller. La referencia,
      // la agenda aceptada y los tramos de ejecución permanecen intactos.
      const planes = new Map(
        evaluacion.despues.traza.map((p) => [p.pasoId, p]),
      );
      for (const registro of foto.pasos) {
        const item = evaluacion.entrada.items.find((i) =>
          i.pasos.some((p) => p.id === registro.id),
        );
        const paso = item?.pasos.find((p) => p.id === registro.id);
        if (!item || !paso || paso.tipoEjecucion !== 'interno') continue;
        const estacion = resolverEstacionDePaso(
          evaluacion.entrada.estaciones,
          paso,
        );
        if (
          !estacion?.planificacionPorEmpleados &&
          !leerAsignacionPersonal(registro.asignacionPersonalJson)
        )
          continue;
        const datos =
          registro.id === pasoId
            ? { ...registro, asignacionManualJson: manual, mesaUsuarioId: null }
            : registro;
        const asignacion = construirAsignacion(
          datos,
          planes.get(registro.id),
          foto.empleados,
          evaluacion.despues.porItem.get(item.id)?.motivoSinEstimar,
        );
        if (
          JSON.stringify(asignacion) !==
          JSON.stringify(registro.asignacionPersonalJson)
        )
          await tx.ordenTrabajoItemPaso.update({
            where: { id: registro.id, tenantId: auth.tenantId },
            data: {
              asignacionPersonalJson:
                asignacion as unknown as Prisma.InputJsonValue,
            },
          });
      }
      const cambio = evaluacion.impacto.paso;
      await this.eventos.publicarDesdeAuth(
        auth,
        {
          tipo: 'produccion.personal_asignado',
          entidadTipo: 'paso',
          entidadId: pasoId,
          titulo: `Personal asignado · ${foto.item.ordenNumero}`,
          mensaje: `${foto.paso.nombre}: ${cambio.personalActual.join(', ') || 'Sin asignar'} → ${cambio.personalPropuesto.join(', ')}. Fin estimado: ${cambio.actual ?? 'Sin estimar'} → ${cambio.propuesto}. Previsto: ${cambio.previsto ?? 'Sin referencia'}. ${evaluacion.impacto.afectados.length} paso(s) afectados.${body.motivo?.trim() ? ` Motivo: ${body.motivo.trim()}` : ''}`,
          href: `/produccion/tablero?vista=lista&item=${foto.item.id}`,
          topicos: ['tablero-produccion'],
        },
        tx,
      );
      return { confirmado: true, pasoId };
    }, true);
  }
}
