import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { EtaService } from '../eta/eta.service';
import { simularRepartoProgramado } from '../eta/reparto-computo';
import { sumarDiasHabiles } from '../eta/motor/flujo-produccion';
import { claveFechaEnZona, instanteDe, sumarDiasAClave } from '../common/zona';
import { runWithTenant } from '../common/tenant-context';
import { textoErrorLog } from '../common/log-seguro';
import { PrevisionMaterialesService } from '../inventario/prevision-materiales.service';
import { solicitudDesdeMateriales } from '../inventario/prevision-materiales.proyeccion';
import { PreparacionesRecorridoService } from '../recorridos-vectoriales/preparaciones-recorrido.service';
import { NotificacionesOrdenesService } from '../integraciones/notificaciones/notificaciones-ordenes.service';
import { actualizarFechaFinalOrden } from '../planificacion-entregas/resumen-entregas';
import { leerMaterialesOrden } from './materiales-orden.consulta';
import {
  reclamarEmisiones,
  reprogramarEmision,
  type TrabajoEmision,
} from './trabajos-emision';

type Contexto = Awaited<ReturnType<EtaService['contextoSimulacion']>>;
type Simulacion = Awaited<ReturnType<EtaService['correr']>>;

@Injectable()
export class EmisionWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(EmisionWorker.name);
  private timer?: NodeJS.Timeout;
  private detenido = false;
  private enCurso?: Promise<void>;

  constructor(
    private readonly db: PrismaService,
    private readonly eta: EtaService,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly prevision: PrevisionMaterialesService,
    private readonly avisos: NotificacionesOrdenesService,
    private readonly recorridos: PreparacionesRecorridoService,
    private readonly eventos: EventosSistemaService,
  ) {}

  onApplicationBootstrap() {
    this.programar(0);
  }

  async onApplicationShutdown() {
    this.detenido = true;
    clearTimeout(this.timer);
    await this.enCurso;
  }

  private programar(ms: number) {
    if (this.detenido) return;
    this.timer = setTimeout(() => {
      this.enCurso = this.procesarSiguiente().then(
        (hubo) => this.programar(hubo ? 10 : 2000),
        (error) => {
          this.logger.error(textoErrorLog(error));
          this.programar(5000);
        },
      );
    }, ms);
  }

  async procesarSiguiente(soloTenant?: string) {
    const trabajos = await reclamarEmisiones(this.db, soloTenant);
    if (!trabajos.length) return false;
    const { tenantId, turno } = trabajos[0];
    const renovar = setInterval(() => {
      void this.db
        .$executeRaw`UPDATE "TrabajoEmisionOt" SET "disponibleEl" = now() + interval '3 minutes'
        WHERE turno = ${turno}::uuid AND "tenantId" = ${tenantId}::uuid`.catch(
        (e) => this.logger.error(textoErrorLog(e)),
      );
    }, 30_000);
    try {
      await runWithTenant(tenantId, () =>
        this.procesarTaller(tenantId, trabajos),
      );
    } finally {
      clearInterval(renovar);
    }
    return true;
  }

  private async procesarTaller(tenantId: string, trabajos: TrabajoEmision[]) {
    const ordenes = await this.db.ordenTrabajo.findMany({
      where: {
        tenantId,
        id: { in: trabajos.map((t) => t.ordenId) },
        estado: { in: ['pendiente', 'produccion'] },
      },
      select: { id: true, fechaEntrega: true, updatedAt: true },
    });
    const activas = new Map(ordenes.map((o) => [o.id, o]));
    const planificables = trabajos.filter(
      (t) => t.planificar && activas.has(t.ordenId),
    );
    let contexto: Contexto | undefined;
    let simulacion: Simulacion | undefined;
    const sinMaterial = new Set<string>();
    const fallidas = new Set<string>();
    try {
      if (planificables.length) {
        await this.eta.sincronizarAsignaciones(
          tenantId,
          simularRepartoProgramado,
        );
        if (await this.capacidades.puedeOperar(tenantId, 'eta_capacidad')) {
          contexto = await this.eta.contextoSimulacion(tenantId);
          for (const t of planificables.filter(
            (t) => t.fechasDiferidas && !activas.get(t.ordenId)?.fechaEntrega,
          )) {
            try {
              if (!(await this.aplicarDisponibilidad(contexto, t)))
                sinMaterial.add(t.ordenId);
            } catch (error) {
              this.logger.error(textoErrorLog(error));
              fallidas.add(t.ordenId);
            }
          }
          simulacion = await this.eta.correr(
            tenantId,
            false,
            contexto,
            (entrada) => simularRepartoProgramado(entrada, 120_000),
          );
        }
      }
    } catch (error) {
      this.logger.error(textoErrorLog(error));
      for (const t of planificables) fallidas.add(t.ordenId);
    }
    for (const t of trabajos) {
      try {
        const activa = activas.get(t.ordenId);
        let esperar = false;
        if (activa && t.planificar && !fallidas.has(t.ordenId)) {
          if (t.fechasDiferidas && !activa.fechaEntrega) {
            esperar =
              !contexto ||
              !simulacion ||
              sinMaterial.has(t.ordenId) ||
              !(await this.completarFechas(
                t,
                activa.updatedAt,
                contexto,
                simulacion,
              ));
          }
          if (!esperar && simulacion)
            await this.eta.capturarEmision(
              { tenantId },
              t.ordenId,
              simulacion.porItem,
            );
          if (!esperar)
            await this.db
              .$executeRaw`UPDATE "TrabajoEmisionOt" SET planificar = false
            WHERE "ordenId" = ${t.ordenId}::uuid AND turno = ${t.turno}::uuid`;
        }
        if (t.preparar) await this.prepararRecorridos(t);
        if (esperar || fallidas.has(t.ordenId)) {
          await reprogramarEmision(this.db, t);
          continue;
        }
        await this.avisos.encolarSegunEstado(t.ordenId, true);
        await this.db.$executeRaw`DELETE FROM "TrabajoEmisionOt"
          WHERE "ordenId" = ${t.ordenId}::uuid AND turno = ${t.turno}::uuid`;
      } catch (error) {
        this.logger.error(
          `Emisión pendiente ${t.ordenId}: ${textoErrorLog(error)}`,
        );
        await reprogramarEmision(this.db, t);
      }
    }
  }

  private async aplicarDisponibilidad(
    contexto: Contexto,
    { tenantId, ordenId }: TrabajoEmision,
  ) {
    const { materiales } = await leerMaterialesOrden(
      this.db,
      tenantId,
      ordenId,
    );
    const stock = await this.prevision.consultar(
      tenantId,
      { ...solicitudDesdeMateriales(materiales), ordenId },
      contexto.ahora,
      undefined,
      ordenId,
    );
    if (stock.estado === 'por_confirmar') return false;
    if (stock.estado === 'requiere_compra') {
      if (!stock.disponibleDesde) return false;
      const desde = instanteDe(
        sumarDiasAClave(stock.disponibleDesde, 1),
        '00:00',
        stock.zona,
      ).toISOString();
      for (const item of contexto.items.filter((i) => i.ordenId === ordenId))
        for (const paso of item.pasos)
          if (!paso.planificadoDesde || paso.planificadoDesde < desde)
            paso.planificadoDesde = desde;
    }
    return true;
  }

  private completarFechas(
    t: TrabajoEmision,
    version: Date,
    contexto: Contexto,
    simulacion: Simulacion,
  ) {
    const { tenantId, ordenId } = t;
    return this.db.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(
        tx,
        tenantId,
        ['eta_capacidad'],
        ['eta_capacidad'],
      );
      const [orden] = await tx.$queryRaw<
        Array<{ fechaEntrega: Date | null; updatedAt: Date; estado: string }>
      >`
        SELECT o."fechaEntrega", o."updatedAt", o.estado FROM "OrdenTrabajo" o
        JOIN "TrabajoEmisionOt" t ON t."ordenId" = o.id
        WHERE o.id = ${ordenId}::uuid AND o."tenantId" = ${tenantId}::uuid AND t.turno = ${t.turno}::uuid
        FOR UPDATE OF o, t`;
      if (!orden) return false;
      if (
        orden.fechaEntrega ||
        !['pendiente', 'produccion'].includes(orden.estado)
      )
        return true;
      if (orden.updatedAt.getTime() !== version.getTime()) return false;
      const items = await tx.ordenTrabajoItem.findMany({
        where: { tenantId, ordenId },
        select: {
          id: true,
          parentItemId: true,
          fechaEntrega: true,
          cotizacionItem: { select: { productoId: true } },
        },
      });
      const fechas = new Map<string, string>();
      for (const i of items) {
        const eta = simulacion.porItem.get(i.id);
        if (i.fechaEntrega)
          fechas.set(i.id, i.fechaEntrega.toISOString().slice(0, 10));
        else if (eta?.finEstimado && !eta.sinEstimar) {
          const sinMargen = contexto.productosSinMargenEntrega.includes(
            i.cotizacionItem?.productoId ?? '',
          );
          fechas.set(
            i.id,
            claveFechaEnZona(
              sumarDiasHabiles(
                eta.finEstimado,
                sinMargen ? 0 : contexto.margenEtaDias,
                contexto.noLaborables,
                contexto.zona,
              ),
              contexto.zona,
            ),
          );
        }
      }
      // Resolver compuestos desde las hojas. Una promesa manual se conserva.
      const porId = new Map(items.map((i) => [i.id, i]));
      const padres = new Set(items.map((i) => i.parentItemId));
      const conPasos = new Set(
        contexto.items
          .filter((i) => i.ordenId === ordenId && i.pasos.length)
          .map((i) => i.id),
      );
      for (const i of items) {
        if (!fechas.has(i.id) && (!padres.has(i.id) || conPasos.has(i.id)))
          return false;
        let padre = i.parentItemId;
        const fecha = fechas.get(i.id);
        const visitados = new Set([i.id]);
        while (padre && fecha && !visitados.has(padre)) {
          visitados.add(padre);
          const p = porId.get(padre);
          if (!p || p.fechaEntrega) break;
          if ((fechas.get(padre) ?? '') < fecha) fechas.set(padre, fecha);
          padre = p.parentItemId;
        }
      }
      if (!items.length || fechas.size !== items.length) return false;
      const idsPorFecha = new Map<string, string[]>();
      for (const item of items) {
        if (item.fechaEntrega) continue;
        const dia = fechas.get(item.id)!;
        const ids = idsPorFecha.get(dia) ?? [];
        ids.push(item.id);
        idsPorFecha.set(dia, ids);
      }
      for (const [dia, ids] of idsPorFecha) {
        await tx.ordenTrabajoItem.updateMany({
          where: { tenantId, ordenId, id: { in: ids }, fechaEntrega: null },
          data: { fechaEntrega: new Date(dia + 'T00:00:00Z') },
        });
      }
      const fecha = await actualizarFechaFinalOrden(tx, tenantId, ordenId);
      if (fecha)
        await this.eventos.publicar(
          {
            tenantId,
            actorNombre: 'Sistema',
            tipo: 'produccion.fecha_entrega',
            entidadTipo: 'orden_trabajo',
            entidadId: ordenId,
            titulo: 'Fecha de entrega asignada',
            mensaje: 'Se actualizó la entrega prevista.',
            topicos: [`orden:${ordenId}`, 'tablero-produccion'],
          },
          tx,
        );
      return Boolean(fecha);
    });
  }

  private async prepararRecorridos(t: TrabajoEmision) {
    if (
      await this.capacidades.puedeOperar(t.tenantId, 'recorridos_fabricacion')
    ) {
      const items = await this.db.ordenTrabajoItem.findMany({
        where: {
          tenantId: t.tenantId,
          ordenId: t.ordenId,
          contieneLotesEntrega: false,
          listoEnMostrador: false,
        },
        select: { id: true },
      });
      for (const i of items) {
        try {
          await this.recorridos.asegurarParaItem(
            {
              tenantId: t.tenantId,
              userId: t.usuarioId,
              email: t.usuarioNombre,
            },
            i.id,
          );
        } catch (error) {
          this.logger.warn(`Recorrido ${i.id}: ${textoErrorLog(error)}`);
        }
      }
    }
    await this.db.$executeRaw`UPDATE "TrabajoEmisionOt" SET preparar = false
      WHERE "ordenId" = ${t.ordenId}::uuid AND turno = ${t.turno}::uuid`;
  }
}
