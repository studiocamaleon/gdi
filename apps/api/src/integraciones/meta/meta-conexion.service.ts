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
import { configuracionMetaConexion } from './meta-conexion.config';
import { configuracionMetaPiloto } from './meta-piloto.config';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const pendientes: EstadoAutorizacionMeta[] = [
  'PREPARADA',
  'CANJEANDO',
  'CANJEADA',
  'VERIFICANDO',
];
export type IntentoMeta = { id: string; estadoSecreto: string };

/** Base del alta por empresa. Aún SIN controller ni registro en el módulo:
 * activar el popup antes de tener el importador listo gastaría la ventana de
 * sincronización de Meta. Ver docs/meta-conexion-empresas.md. */
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
    // Limpieza al acceder; sumar barrido periódico antes de habilitar altas.
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
      },
    });
    if (!fila) throw new NotFoundException();
    // Lista cerrada: ni token, ni hash, ni otros datos del intento salen al cliente.
    return fila;
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
        if (anterior)
          await tx.metaVinculo.update({
            where: { id: anterior.id, tenantId: auth.tenantId },
            data,
          });
        else
          await tx.metaVinculo.create({
            data: { ...data, tenantId: auth.tenantId },
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
