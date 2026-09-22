import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PlanContratacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleService } from '../cobro/paddle.service';
import {
  SuscripcionSyncService,
  type SuscripcionExterna,
} from '../cobro/suscripcion-sync.service';
import { resolverContratoOferta } from '../cobro/contrato-oferta-paddle';
import { bloquearCupoUsuarios } from './cupos-usuarios';
import { ESTADOS_CONTRATACION_PENDIENTE as PENDIENTES } from './contratacion-pendiente';

export type ResultadoConsultaContratacion = {
  operacion: PlanContratacion;
  resultado:
    | 'aplicada'
    | 'cancelada'
    | 'checkout'
    | 'sin_resultado'
    | 'no_coincide'
    | 'fallida'
    | 'finalizada';
  detalle: string;
};
type Autorizacion = (tx: Prisma.TransactionClient) => Promise<unknown>;

/** Reconciliación compartida por empresa y Plataforma. Sólo hace GET a Paddle.
 * Autoriza antes de leer y de escribir; el resultado y la auditoría se guardan
 * en la misma transacción. Una ausencia o un error nunca habilitan otro cobro. */
@Injectable()
export class ConsultaContratacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleService,
    private readonly sync: SuscripcionSyncService,
  ) {}

  async consultar(
    tenantId: string,
    id: string,
    autorizar: Autorizacion,
    opciones: {
      transaccionId?: string;
      registrar?: (
        tx: Prisma.TransactionClient,
        resultado: ResultadoConsultaContratacion,
      ) => Promise<unknown>;
    } = {},
  ): Promise<ResultadoConsultaContratacion> {
    const op = await this.prisma.$transaction(async (tx) => {
      await autorizar(tx);
      const op = await tx.planContratacion.findFirst({
        where: { id, tenantId },
        include: { oferta: true },
      });
      if (!op) throw new NotFoundException('La contratación no existe.');
      if (op.oferta.entorno !== this.paddle.entorno)
        throw new ConflictException(
          'La contratación pertenece a otro entorno de Paddle.',
        );
      if (
        opciones.transaccionId &&
        (op.tipo !== 'checkout' ||
          (op.transaccionId && op.transaccionId !== opciones.transaccionId))
      )
        throw new ConflictException(
          'La referencia no corresponde a este intento de checkout.',
        );
      return op;
    });
    let t: Awaited<ReturnType<PaddleService['leerCheckoutContratacion']>> =
      null;
    let externa: SuscripcionExterna | null = null;
    let fallo = false;
    let referenciaConsultada: string | null = null;
    if (PENDIENTES.includes(op.estado)) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const lectura = async () => {
          if (!this.paddle.habilitado) throw new Error('Paddle no configurado');
          if (op.tipo === 'checkout') {
            const referencia = opciones.transaccionId ?? op.transaccionId;
            const encontrada = referencia
              ? null
              : await this.paddle.buscarCheckoutContratacion(
                  op.id,
                  op.enviadaEl ?? op.creadaEl,
                );
            const candidata = referencia ?? encontrada?.id;
            // Volver a leer la transacción evita tomar como vigente el resultado de un listado.
            const transaccion = candidata
              ? await this.paddle.leerCheckoutContratacion(candidata)
              : null;
            if (
              transaccion &&
              (transaccion.id !== candidata ||
                transaccion.customData?.tenantId !== tenantId ||
                transaccion.customData?.contratacionId !== id)
            )
              return {
                transaccion,
                externa: null,
                referencia: candidata ?? null,
              };
            return {
              transaccion,
              referencia: candidata ?? null,
              externa: this.sync.extraer(
                transaccion?.subscriptionId
                  ? await this.paddle.obtenerSuscripcion(
                      transaccion.subscriptionId,
                    )
                  : null,
              ),
            };
          }
          return {
            transaccion: null,
            referencia: null,
            externa: this.sync.extraer(
              op.referencia
                ? await this.paddle.obtenerSuscripcion(op.referencia)
                : null,
            ),
          };
        };
        const leida = await Promise.race([
          lectura(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Consulta vencida')),
              15000,
            );
          }),
        ]);
        t = leida.transaccion;
        externa = leida.externa;
        referenciaConsultada = leida.referencia;
      } catch {
        fallo = true;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    return this.prisma.$transaction(
      async (tx) => {
        await autorizar(tx);
        if (externa)
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`paddle:${externa.referencia}`}, 0))::text`;
        await bloquearCupoUsuarios(tx, tenantId);
        const vigente = await tx.planContratacion.findFirstOrThrow({
          where: { id, tenantId },
        });
        const terminar = async (
          resultado: ResultadoConsultaContratacion['resultado'],
          detalle: string,
          data?: Prisma.PlanContratacionUpdateInput,
        ) => {
          const operacion = data
            ? await tx.planContratacion.update({
                where: { id, tenantId },
                data,
              })
            : vigente;
          const respuesta = { operacion, resultado, detalle };
          await opciones.registrar?.(tx, respuesta);
          return respuesta;
        };
        if (!PENDIENTES.includes(vigente.estado))
          return terminar(
            'finalizada',
            vigente.detalle ?? 'El intento ya tiene un resultado registrado.',
          );
        if (fallo)
          return terminar(
            'fallida',
            'No se pudo completar la consulta a Paddle. El intento sigue pendiente; podés consultar nuevamente sin repetir el cobro.',
          );
        if (
          t &&
          (t.customData?.tenantId !== tenantId ||
            t.customData?.contratacionId !== id ||
            referenciaConsultada !== t.id ||
            (vigente.transaccionId && vigente.transaccionId !== t.id) ||
            (opciones.transaccionId && opciones.transaccionId !== t.id))
        )
          return terminar(
            'no_coincide',
            'La transacción no pertenece a esta empresa y contratación. No se modificó el intento.',
          );
        if (t?.status === 'canceled')
          return terminar(
            'cancelada',
            'Paddle confirmó la cancelación de esta transacción.',
            {
              transaccionId: t.id,
              estado: 'rechazada',
              finalizadaEl: new Date(),
              detalle: 'La transacción fue cancelada en Paddle.',
            },
          );
        if (t) {
          const precios = await tx.planOfertaPrecio.findMany({
            where: { ofertaId: vigente.ofertaId, ciclo: vigente.ciclo },
          });
          const base = precios.find((p) => p.tipo === 'base'),
            extra = precios.find((p) => p.tipo === 'usuario');
          const revisionCargo = vigente.revisionJson as {
            implementacionPriceId?: string | null;
            implementacion?: number;
          };
          const esperados = base
            ? [
                { priceId: base.priceId, quantity: 1 },
                ...(revisionCargo.implementacion &&
                revisionCargo.implementacionPriceId
                  ? [
                      {
                        priceId: revisionCargo.implementacionPriceId,
                        quantity: 1,
                      },
                    ]
                  : []),
                ...(vigente.adicionales && extra
                  ? [{ priceId: extra.priceId, quantity: vigente.adicionales }]
                  : []),
              ]
            : [];
          if (
            !base ||
            (vigente.adicionales > 0 && !extra) ||
            t.items?.length !== esperados.length ||
            new Set(t.items.map((i) => i.price?.id)).size !==
              esperados.length ||
            !esperados.every((e) =>
              t.items.some(
                (i) => i.price?.id === e.priceId && i.quantity === e.quantity,
              ),
            )
          )
            return terminar(
              'no_coincide',
              'Los precios o usuarios de la transacción no coinciden con la contratación aceptada. Revisá el caso en Paddle antes de continuar.',
            );
        }
        if (externa) {
          const identidad =
            vigente.tipo === 'checkout'
              ? externa.tenantId === tenantId &&
                externa.contratacionId === id &&
                externa.referencia === t?.subscriptionId
              : (!externa.tenantId || externa.tenantId === tenantId) &&
                externa.referencia === vigente.referencia;
          const contrato = identidad
            ? await resolverContratoOferta(tx, externa)
            : null;
          const coincide =
            contrato?.tipo === 'version' &&
            contrato.ofertaId === vigente.ofertaId &&
            contrato.cicloFacturacion === vigente.ciclo &&
            contrato.usuariosAdicionales === vigente.adicionales;
          if (
            !identidad ||
            !coincide ||
            !['active', 'trialing'].includes(externa.estadoProveedor)
          )
            return terminar(
              'no_coincide',
              'Paddle todavía no confirma las condiciones de este intento. Conservamos el contrato y el bloqueo de nuevos cobros.',
            );
          const aplicada = await this.sync.aplicarEnTransaccion(tx, externa, {
            origen: 'reconciliacion',
          });
          if (aplicada.aplicado)
            return terminar(
              'aplicada',
              'Contrato y cupos recuperados desde Paddle.',
              {
                estado: 'aplicada',
                referencia: externa.referencia,
                ...(t ? { transaccionId: t.id } : {}),
                finalizadaEl: new Date(),
                detalle: 'Contratación confirmada por Paddle.',
              },
            );
          return terminar(
            'no_coincide',
            'La suscripción requiere revisión antes de aplicarse. Se conserva el intento pendiente.',
          );
        }
        if (t) {
          if (['draft', 'ready'].includes(t.status))
            return terminar(
              'checkout',
              'Transacción localizada. El administrador de la empresa puede retomar el mismo pago desde Suscripción.',
              {
                transaccionId: t.id,
                estado: 'checkout',
                detalle: 'Esperando la confirmación del pago.',
              },
            );
          return terminar(
            'sin_resultado',
            'Paddle está procesando la transacción, pero todavía no confirmó la suscripción. Volvé a consultar; no se habilita otro cobro.',
            {
              transaccionId: t.id,
              estado: 'verificar',
              detalle: 'Esperando la confirmación de la suscripción de Paddle.',
            },
          );
        }
        return terminar(
          'sin_resultado',
          'No se encontró evidencia suficiente en esta consulta. Revisá los registros de Paddle y, si encontrás la transacción, consultá su referencia. No se descarta el intento ni se habilita otro cobro.',
        );
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }
}
