import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { EstadoAutorizacionMeta, Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import type { CurrentAuth } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { bloquearCupoUsuarios } from '../../suscripciones/cupos-usuarios';
import {
  SecretosService,
  type SecretoCifrado,
} from '../cripto/secretos.service';
import { exigirAccesoConexionMeta } from './meta-conexion-acceso';
import { ErrorConexionMeta, MetaConexionClient } from './meta-conexion.client';
import {
  configuracionMetaConexion,
  modoAltaPermitido,
} from './meta-conexion.config';
import { configuracionMetaPiloto } from './meta-piloto.config';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const pendientes: EstadoAutorizacionMeta[] = [
  'PREPARADA',
  'CANJEANDO',
  'CANJEADA',
  'VERIFICANDO',
];
export type IntentoMeta = { id: string; estadoSecreto: string };

/** Autoriza el alta. Su controller mantiene el recorrido desactivado por
 * defecto y limitado a empresas de ensayo. Sandbox nunca crea un vínculo. */
@Injectable()
export class MetaConexionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretos: SecretosService,
    private readonly client: MetaConexionClient,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  private config() {
    const config = configuracionMetaConexion();
    if (!config || !this.secretos.disponible)
      throw new ServiceUnavailableException(
        'La conexión con Meta todavía no está preparada.',
      );
    return config;
  }

  private filtro(auth: CurrentAuth, intento: IntentoMeta) {
    if (
      !isUUID(intento.id, '4') ||
      !/^[A-Za-z0-9_-]{43}$/.test(intento.estadoSecreto)
    )
      throw new NotFoundException();
    return {
      id: intento.id,
      tenantId: auth.tenantId,
      userId: auth.userId,
      sessionId: auth.sessionId,
      membershipId: auth.membershipId,
      estadoHash: hash(intento.estadoSecreto),
    };
  }

  private async limpiarVencidos(tenantId: string) {
    // Limpieza al acceder, además del barrido del worker.
    await this.prisma.metaAutorizacion.updateMany({
      where: {
        tenantId,
        estado: { in: pendientes },
        venceEl: { lte: new Date() },
      },
      data: {
        estado: 'REINICIAR',
        tokenCifrado: Prisma.DbNull,
        falloCodigo: 'INTENTO_VENCIDO',
      },
    });
  }

  private async escribir<T>(
    auth: CurrentAuth,
    ip: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'whatsapp_automatico',
      ]);
      await exigirAccesoConexionMeta(tx, auth, ip);
      return fn(tx);
    });
  }

  async preparar(auth: CurrentAuth, ip: string) {
    const config = this.config();
    await exigirAccesoConexionMeta(this.prisma, auth, ip);
    await this.limpiarVencidos(auth.tenantId);
    const estadoSecreto = randomBytes(32).toString('base64url');
    const venceEl = new Date(Date.now() + 15 * 60_000);
    const fila = await this.escribir(auth, ip, async (tx) => {
      const canal = await tx.metaVinculo.findFirst({
        where: {
          tenantId: auth.tenantId,
          estado: 'VERIFICADO',
          altas: { some: {} },
        },
      });
      if (canal)
        throw new ConflictException(
          'La conexión existente debe revisarse antes de iniciar otra alta.',
        );
      // Una sola autorización pendiente por empresa, incluso en dos pestañas.
      // Crear otra cancela la anterior; cualquier respuesta en vuelo falla su CAS.
      await tx.metaAutorizacion.updateMany({
        where: { tenantId: auth.tenantId, estado: { in: pendientes } },
        data: { estado: 'CANCELADA', tokenCifrado: Prisma.DbNull },
      });
      return tx.metaAutorizacion.create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          sessionId: auth.sessionId,
          membershipId: auth.membershipId,
          estadoHash: hash(estadoSecreto),
          venceEl,
          appId: config.appId,
          configId: config.configId,
          modo: config.modo ?? 'COEXISTENCIA',
          graphVersion: config.graphVersion,
        },
        select: { id: true },
      });
    });
    return {
      id: fila.id,
      estadoSecreto,
      venceEl: venceEl.toISOString(),
      appId: config.appId,
      configId: config.configId,
      graphVersion: config.graphVersion,
      modo: config.modo ?? 'COEXISTENCIA',
    };
  }

  async consultar(auth: CurrentAuth, ip: string, intento: IntentoMeta) {
    await exigirAccesoConexionMeta(this.prisma, auth, ip);
    await this.limpiarVencidos(auth.tenantId);
    const fila = await this.prisma.metaAutorizacion.findFirst({
      where: this.filtro(auth, intento),
      select: {
        id: true,
        estado: true,
        venceEl: true,
        verificadaEl: true,
        falloCodigo: true,
        modo: true,
      },
    });
    if (!fila) throw new NotFoundException();
    // Lista cerrada: ni token, ni hash, ni otros datos del intento salen al cliente.
    return fila;
  }

  /** Lectura sin efectos: nunca crea intentos ni inicia solicitudes a Meta. */
  async estado(auth: CurrentAuth, ip: string) {
    await exigirAccesoConexionMeta(this.prisma, auth, ip);
    const modo = modoAltaPermitido(auth.tenantId);
    const capacidad = modo
      ? await this.capacidades.puedeOperar(auth.tenantId, 'whatsapp_automatico')
      : false;
    const vinculo = await this.prisma.metaVinculo.findFirst({
      where: { tenantId: auth.tenantId },
      select: {
        id: true,
        numero: true,
        estado: true,
        autorizacionId: true,
        tokenVenceEl: true,
        accesoDatosVenceEl: true,
        recepcionDesdeEl: true,
      },
    });
    const alta = vinculo
      ? await this.prisma.metaAlta.findFirst({
          where: {
            tenantId: auth.tenantId,
            vinculoId: vinculo.id,
            autorizacionId: vinculo.autorizacionId,
          },
          select: { estado: true, falloCodigo: true, updatedAt: true },
        })
      : null;
    const importacion = vinculo
      ? await this.prisma.inboxImportacion.findFirst({
          where: {
            tenantId: auth.tenantId,
            vinculoId: vinculo.id,
            autorizacionId: vinculo.autorizacionId,
          },
          select: {
            progresoInformado: true,
            finInformadoEl: true,
            historialRechazado: true,
            necesitaRevision: true,
          },
        })
      : null;
    const pendientes = vinculo
      ? await this.prisma.inboxTrabajoEvento.count({
          where: {
            tenantId: auth.tenantId,
            vinculoId: vinculo.id,
            autorizacionId: vinculo.autorizacionId,
            estado: 'PENDIENTE',
          },
        })
      : 0;
    const revisiones = vinculo
      ? await this.prisma.inboxTrabajoEvento.count({
          where: {
            tenantId: auth.tenantId,
            vinculoId: vinculo.id,
            autorizacionId: vinculo.autorizacionId,
            estado: { in: ['REVISION', 'PAUSADO'] },
          },
        })
      : 0;
    const sandbox = await this.prisma.metaAutorizacion.findFirst({
      where: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        modo: 'SANDBOX',
        estado: 'VERIFICADA',
      },
      orderBy: { verificadaEl: 'desc' },
      select: { verificadaEl: true },
    });
    return {
      empresaId: auth.tenantId,
      usuarioId: auth.userId,
      modo,
      disponible: Boolean(
        modo &&
        capacidad &&
        configuracionMetaConexion() &&
        this.secretos.disponible &&
        (!vinculo || vinculo.estado !== 'VERIFICADO' || !alta),
      ),
      sandboxVerificadoEl: sandbox?.verificadaEl ?? null,
      canal: vinculo
        ? {
            numero: vinculo.numero,
            estado: vinculo.estado,
            credencialVencida: [
              vinculo.tokenVenceEl,
              vinculo.accesoDatosVenceEl,
            ].some((d) => d && d <= new Date()),
            recepcionPreparada: Boolean(vinculo.recepcionDesdeEl),
            alta,
            importacion,
            pendientes,
            revisiones,
          }
        : null,
    };
  }

  private async reiniciar(
    auth: CurrentAuth,
    intento: IntentoMeta,
    estado: EstadoAutorizacionMeta,
    error: unknown,
  ) {
    const falloCodigo =
      error instanceof ErrorConexionMeta
        ? error.motivo
        : error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ? 'ASOCIACION_NO_DISPONIBLE'
          : 'AUTORIZACION_NO_COMPLETADA';
    await this.prisma.metaAutorizacion.updateMany({
      where: { ...this.filtro(auth, intento), estado },
      data: { estado: 'REINICIAR', tokenCifrado: Prisma.DbNull, falloCodigo },
    });
  }

  async canjear(
    auth: CurrentAuth,
    ip: string,
    intento: IntentoMeta,
    codigo: string,
  ) {
    const config = this.config();
    const filtro = this.filtro(auth, intento);
    // Reclamar en PostgreSQL ANTES de hablar con Meta. No sostener la
    // transacción durante la red y no repetir el canje si se corta la respuesta.
    const reclamo = await this.escribir(auth, ip, (tx) =>
      tx.metaAutorizacion.updateMany({
        where: {
          ...filtro,
          estado: 'PREPARADA',
          venceEl: { gt: new Date() },
          appId: config.appId,
          configId: config.configId,
          graphVersion: config.graphVersion,
          modo: config.modo ?? 'COEXISTENCIA',
        },
        data: { estado: 'CANJEANDO', canjeIniciadoEl: new Date() },
      }),
    );
    if (!reclamo.count) return this.consultar(auth, ip, intento);
    try {
      const token = await this.client.canjear(config, codigo);
      const tokenCifrado = this.secretos.cifrar(token);
      const guardado = await this.escribir(auth, ip, (tx) =>
        tx.metaAutorizacion.updateMany({
          where: {
            ...filtro,
            estado: 'CANJEANDO',
            venceEl: { gt: new Date() },
          },
          data: { estado: 'CANJEADA', tokenCifrado, canjeadoEl: new Date() },
        }),
      );
      if (!guardado.count)
        throw new ConflictException('La autorización dejó de estar vigente.');
    } catch (error) {
      await this.reiniciar(auth, intento, 'CANJEANDO', error);
      // Incluso con una respuesta incierta el código pudo consumirse. Nueva
      // autorización explícita; jamás reintentar automáticamente este GET.
    }
    return this.consultar(auth, ip, intento);
  }

  async verificar(
    auth: CurrentAuth,
    ip: string,
    intento: IntentoMeta,
    seleccion: { wabaId: string; phoneNumberId?: string },
  ) {
    const config = this.config();
    const filtro = this.filtro(auth, intento);
    const fila = await this.escribir(auth, ip, async (tx) => {
      const reclamo = await tx.metaAutorizacion.updateMany({
        where: {
          ...filtro,
          estado: 'CANJEADA',
          venceEl: { gt: new Date() },
          appId: config.appId,
          configId: config.configId,
          graphVersion: config.graphVersion,
          modo: config.modo ?? 'COEXISTENCIA',
        },
        data: { estado: 'VERIFICANDO' },
      });
      return reclamo.count
        ? tx.metaAutorizacion.findFirst({ where: filtro })
        : null;
    });
    if (!fila) return this.consultar(auth, ip, intento);
    try {
      if (!fila.tokenCifrado) throw new ConflictException();
      const token = this.secretos.descifrar(
        fila.tokenCifrado as SecretoCifrado,
      );
      if (fila.modo === 'SANDBOX') {
        await this.client.verificarSandbox(config, token, seleccion.wabaId);
        await this.escribir(auth, ip, async (tx) => {
          const cambio = await tx.metaAutorizacion.updateMany({
            where: {
              ...filtro,
              estado: 'VERIFICANDO',
              venceEl: { gt: new Date() },
            },
            data: {
              estado: 'VERIFICADA',
              tokenCifrado: Prisma.DbNull,
              verificadaEl: new Date(),
            },
          });
          if (!cambio.count) throw new ConflictException();
        });
        return this.consultar(auth, ip, intento);
      }
      const activos = await this.client.verificar(config, token, seleccion);
      await this.escribir(auth, ip, async (tx) => {
        if (
          [activos.tokenVenceEl, activos.accesoDatosVenceEl].some(
            (fecha) => fecha && fecha.getTime() <= Date.now(),
          )
        )
          throw new ErrorConexionMeta('TOKEN_INVALIDO');
        const piloto = configuracionMetaPiloto();
        if (
          piloto &&
          piloto.tenantId !== auth.tenantId &&
          (piloto.wabaId === activos.wabaId ||
            piloto.phoneNumberId === activos.phoneNumberId)
        )
          throw new ConflictException();
        // Compatibilidad con asociaciones anteriores almacenadas en JSON.
        // Consulta global deliberada: sólo devuelve un booleano, jamás el tenant ajeno.
        const [legacy] = await tx.$queryRaw<Array<{ ocupado: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM "IntegracionTenant"
            WHERE proveedor = 'META_WHATSAPP' AND "tenantId" <> ${auth.tenantId}::uuid
              AND ("metadataJson"->>'wabaId' = ${activos.wabaId}
                OR "metadataJson"->>'phoneNumberId' = ${activos.phoneNumberId})) AS ocupado`;
        if (legacy.ocupado) throw new ConflictException();
        // CAS primero: un cancelar/reiniciar concurrente impide guardar el vínculo.
        const vigente = await tx.metaAutorizacion.updateMany({
          where: {
            ...filtro,
            estado: 'VERIFICANDO',
            venceEl: { gt: new Date() },
          },
          data: {
            estado: 'VERIFICADA',
            tokenCifrado: Prisma.DbNull,
            verificadaEl: new Date(),
          },
        });
        if (!vigente.count) throw new ConflictException();
        const anterior = await tx.metaVinculo.findFirst({
          where: { tenantId: auth.tenantId },
        });
        if (
          anterior &&
          (anterior.wabaId !== activos.wabaId ||
            anterior.phoneNumberId !== activos.phoneNumberId)
        )
          throw new ConflictException(
            'El cambio de número necesita un traslado explícito.',
          );
        const data = {
          ...activos,
          tokenCifrado: this.secretos.cifrar(token),
          autorizacionId: fila.id,
          verificadoEl: new Date(),
          estado: 'VERIFICADO' as const,
          desconectadoEl: null,
          recepcionDesdeEl: null,
          ultimoCambioCuentaEl: null,
        };
        // Índices globales de cuenta y número evitan adjudicarlos a dos tenants,
        // aun cuando las consultas de cada uno sólo ven sus propios registros.
        const vinculo = anterior
          ? await tx.metaVinculo.update({
              where: { id: anterior.id, tenantId: auth.tenantId },
              data,
            })
          : await tx.metaVinculo.create({
              data: { ...data, tenantId: auth.tenantId },
            });
        // Sólo las altas activadas expresamente generan trabajo. En la misma
        // transacción: cerrar la pestaña no pierde la solicitud inicial.
        if (modoAltaPermitido(auth.tenantId) === 'COEXISTENCIA')
          await tx.metaAlta.create({
            data: {
              tenantId: auth.tenantId,
              vinculoId: vinculo.id,
              autorizacionId: fila.id,
              appId: fila.appId,
              graphVersion: fila.graphVersion,
              // Cota conservadora: el alta de Meta ocurrió después de preparar.
              venceEl: new Date(fila.createdAt.getTime() + 24 * 3600_000),
            },
          });
      });
    } catch (error) {
      await this.reiniciar(auth, intento, 'VERIFICANDO', error);
    }
    return this.consultar(auth, ip, intento);
  }

  async cancelar(auth: CurrentAuth, ip: string, intento: IntentoMeta) {
    await exigirAccesoConexionMeta(this.prisma, auth, ip);
    await this.prisma.metaAutorizacion.updateMany({
      where: { ...this.filtro(auth, intento), estado: { in: pendientes } },
      data: { estado: 'CANCELADA', tokenCifrado: Prisma.DbNull },
    });
    return this.consultar(auth, ip, intento);
  }

  /** Cancela sólo la preparación local. No llama deregister: en coexistencia
   * el usuario desvincula desde WhatsApp Business. No liberar la propiedad. */
  async descartarVinculoPreparado(auth: CurrentAuth, ip: string) {
    await this.prisma.$transaction(async (tx) => {
      // Mismo lock de empresa que usa exigirOperacionTx, sin exigir un plan
      // de pago para poder dejar de conservar una credencial.
      await bloquearCupoUsuarios(tx, auth.tenantId);
      await exigirAccesoConexionMeta(tx, auth, ip);
      await tx.metaAutorizacion.updateMany({
        where: { tenantId: auth.tenantId, estado: { in: pendientes } },
        data: { estado: 'CANCELADA', tokenCifrado: Prisma.DbNull },
      });
      await tx.metaVinculo.updateMany({
        where: { tenantId: auth.tenantId },
        data: {
          estado: 'DESCONECTADO',
          tokenCifrado: Prisma.DbNull,
          desconectadoEl: new Date(),
          recepcionDesdeEl: null,
        },
      });
    });
  }
}
