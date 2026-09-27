import { isUUID } from 'class-validator';
import { Injectable } from '@nestjs/common';
import { EstadoAltaMeta, Prisma } from '@prisma/client';
import { runWithTenant } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import {
  SecretosService,
  type SecretoCifrado,
} from '../cripto/secretos.service';
import { ErrorConexionMeta, MetaConexionClient } from './meta-conexion.client';
import {
  configuracionMetaConexion,
  modoAltaPermitido,
} from './meta-conexion.config';

const proximos: Partial<Record<EstadoAltaMeta, EstadoAltaMeta>> = {
  PENDIENTE: 'SUSCRIBIENDO',
  CONTACTOS_PENDIENTES: 'SOLICITANDO_CONTACTOS',
  HISTORIAL_PENDIENTE: 'SOLICITANDO_HISTORIAL',
};
const enVuelo: EstadoAltaMeta[] = [
  'SUSCRIBIENDO',
  'SOLICITANDO_CONTACTOS',
  'SOLICITANDO_HISTORIAL',
];

/** La API sólo agenda. Este trabajo persiste independientemente del navegador.
 * No hay reintentos automáticos de POST ni transacciones abiertas durante red. */
@Injectable()
export class MetaAltaService {
  constructor(
    private readonly db: PrismaService,
    private readonly secretos: SecretosService,
    private readonly client: MetaConexionClient,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async procesarSiguiente(): Promise<boolean> {
    if (
      process.env.META_CONEXION_MODO !== 'coexistencia' ||
      process.env.META_INBOX_RECEPCION_ENABLED !== 'true'
    )
      return false;
    const config = configuracionMetaConexion();
    if (!config || !this.secretos.disponible) return false;
    const ids = (process.env.META_CONEXION_TENANT_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => isUUID(s, '4'));
    const pendientes = await this.db.metaAlta.findMany({
      where: {
        tenantId: { in: ids },
        OR: [
          {
            estado: {
              in: ['PENDIENTE', 'CONTACTOS_PENDIENTES', 'HISTORIAL_PENDIENTE'],
            },
          },
          {
            estado: { in: enVuelo },
            pasoIniciadoEl: { lt: new Date(Date.now() - 120_000) },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    for (const candidata of pendientes) {
      const reclamo = await runWithTenant(candidata.tenantId, () =>
        this.db.$transaction(async (tx) => {
          const lock = await tx.$queryRaw<
            Array<{ id: string }>
          >`SELECT id FROM "Tenant" WHERE id = ${candidata.tenantId}::uuid FOR NO KEY UPDATE SKIP LOCKED`;
          if (!lock.length) return null;
          await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id = ${candidata.vinculoId}::uuid AND "tenantId" = ${candidata.tenantId}::uuid FOR NO KEY UPDATE`;
          const alta = await tx.metaAlta.findFirstOrThrow({
            where: { id: candidata.id, tenantId: candidata.tenantId },
            include: { vinculo: true },
          });
          const v = alta.vinculo;
          const autorizar = await tx.metaAutorizacion.findFirst({
            where: {
              id: alta.autorizacionId,
              tenantId: alta.tenantId,
              modo: 'COEXISTENCIA',
              estado: 'VERIFICADA',
            },
          });
          if (
            modoAltaPermitido(alta.tenantId) !== 'COEXISTENCIA' ||
            v.tipo !== 'COEXISTENCIA' ||
            !autorizar ||
            v.estado !== 'VERIFICADO' ||
            v.autorizacionId !== alta.autorizacionId ||
            !v.tokenCifrado ||
            [v.tokenVenceEl, v.accesoDatosVenceEl].some(
              (d) => d && d <= new Date(),
            )
          ) {
            await tx.metaAlta.update({
              where: { id: alta.id },
              data: { estado: 'PAUSADA', falloCodigo: 'CANAL_NO_VIGENTE' },
            });
            return { terminado: true } as const;
          }
          if (enVuelo.includes(alta.estado)) {
            if (
              alta.pasoIniciadoEl &&
              alta.pasoIniciadoEl.getTime() > Date.now() - 120_000
            )
              return null;
            await tx.metaAlta.update({
              where: { id: alta.id },
              data: { estado: 'REVISION', falloCodigo: 'RESPUESTA_INCIERTA' },
            });
            return { terminado: true } as const;
          }
          const paso = proximos[alta.estado];
          if (!paso) return null;
          if (
            alta.venceEl <= new Date() ||
            alta.appId !== config.appId ||
            alta.graphVersion !== config.graphVersion
          ) {
            await tx.metaAlta.update({
              where: { id: alta.id },
              data: {
                estado: 'REVISION',
                falloCodigo:
                  alta.venceEl <= new Date()
                    ? 'PLAZO_VENCIDO'
                    : 'CONFIGURACION_CAMBIO',
              },
            });
            return { terminado: true } as const;
          }
          try {
            await this.capacidades.exigirOperacionTx(tx, alta.tenantId, [
              'whatsapp_automatico',
            ]);
          } catch {
            await tx.metaAlta.update({
              where: { id: alta.id },
              data: {
                estado: 'PAUSADA',
                falloCodigo: 'CAPACIDAD_NO_DISPONIBLE',
              },
            });
            return { terminado: true } as const;
          }
          // Antes de suscribir: un webhook puede llegar durante la llamada HTTP.
          if (!v.recepcionDesdeEl)
            await tx.metaVinculo.update({
              where: { id: v.id, tenantId: v.tenantId },
              data: { recepcionDesdeEl: new Date() },
            });
          let token: string;
          try {
            token = this.secretos.descifrar(v.tokenCifrado as SecretoCifrado);
          } catch {
            await tx.metaAlta.update({
              where: { id: alta.id },
              data: {
                estado: 'REVISION',
                falloCodigo: 'CREDENCIAL_NO_DISPONIBLE',
              },
            });
            return { terminado: true } as const;
          }
          await tx.metaAlta.update({
            where: { id: alta.id },
            data: {
              estado: paso,
              pasoIniciadoEl: new Date(),
              falloCodigo: null,
            },
          });
          return { terminado: false, alta, paso, token } as const;
        }),
      );
      if (!reclamo) continue;
      if (reclamo.terminado) return true;
      const { alta, paso, token } = reclamo;
      let datos: Prisma.MetaAltaUpdateManyMutationInput;
      try {
        if (paso === 'SUSCRIBIENDO') {
          await this.client.suscribir(config, token, alta.vinculo.wabaId);
          datos = { estado: 'CONTACTOS_PENDIENTES' };
        } else {
          const contactos = paso === 'SOLICITANDO_CONTACTOS';
          const requestId = await this.client.sincronizar(
            config,
            token,
            alta.vinculo.phoneNumberId,
            contactos ? 'smb_app_state_sync' : 'history',
          );
          datos = contactos
            ? { estado: 'HISTORIAL_PENDIENTE', contactosRequestId: requestId }
            : {
                estado: 'SOLICITUDES_COMPLETADAS',
                historialRequestId: requestId,
              };
        }
      } catch (e) {
        datos = {
          estado: 'REVISION',
          falloCodigo:
            e instanceof ErrorConexionMeta ? e.motivo : 'RESPUESTA_INCIERTA',
        };
      }
      // Si desconectaron o iniciaron otra generación durante la red, conservar
      // el trabajo para soporte, sin reactivar el canal ni aplicar su respuesta.
      await runWithTenant(alta.tenantId, () =>
        this.db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${alta.tenantId}::uuid FOR NO KEY UPDATE`;
          await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id = ${alta.vinculoId}::uuid AND "tenantId" = ${alta.tenantId}::uuid FOR NO KEY UPDATE`;
          const actual = await tx.metaVinculo.findFirst({
            where: { id: alta.vinculoId, tenantId: alta.tenantId },
          });
          const vigente =
            actual?.estado === 'VERIFICADO' &&
            actual.autorizacionId === alta.autorizacionId &&
            actual.recepcionDesdeEl;
          await tx.metaAlta.updateMany({
            where: { id: alta.id, tenantId: alta.tenantId, estado: paso },
            data: vigente
              ? datos
              : { estado: 'PAUSADA', falloCodigo: 'CANAL_NO_VIGENTE' },
          });
        }),
      );
      return true;
    }
    return false;
  }
}
