import {
  canalGeneralInbox,
  lecturaGeneralHabilitada,
} from './meta-inbox-canal';
import { ForbiddenException, Injectable, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { CurrentAuth } from '../../auth/auth.types';
import {
  exigirAccesoInbox,
  exigirAccesoConexionMeta,
} from './meta-conexion-acceso';
import { runWithTenant } from '../../common/tenant-context';
import { InboxTiempoRealBus } from '../../inbox-tiempo-real/inbox-tiempo-real.bus';
import type { CanalInbox } from '../../inbox-tiempo-real/inbox-revision';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { configuracionMetaRecepcion } from './meta-recepcion';

/** El AuthGuard ya verificó la firma. Aquí sólo acotamos la vida del stream
 * a la del JWT verificado; nunca se autoriza a partir de su contenido. */
export function vencimientoStream(authorization: string): number {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(
        authorization.replace(/^Bearer /i, '').split('.')[1],
        'base64url',
      ).toString(),
    );
    return payload !== null &&
      typeof payload === 'object' &&
      'exp' in payload &&
      typeof payload.exp === 'number' &&
      Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : 0;
  } catch {
    return 0;
  }
}

type CanalLectura = CanalInbox & {
  origen: 'GENERAL' | 'PILOTO';
  vinculoId?: string;
  autorizacionId?: string;
  permisos?: string;
};

@Injectable()
export class MetaInboxStreamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly bus: InboxTiempoRealBus,
  ) {}

  private async autorizar(auth: CurrentAuth, canal: CanalLectura, ip: string) {
    if (auth.mcp || auth.impersonacion || auth.esPlataforma)
      throw new ForbiddenException();
    if (canal.origen === 'GENERAL') {
      const actual = await canalGeneralInbox(this.prisma, auth.tenantId);
      if (
        !actual ||
        actual.id !== canal.vinculoId ||
        actual.autorizacionId !== canal.autorizacionId ||
        actual.wabaId !== canal.wabaId ||
        actual.phoneNumberId !== canal.phoneNumberId
      )
        throw new ForbiddenException();
    } else {
      const config = configuracionMetaRecepcion();
      if (
        lecturaGeneralHabilitada() ||
        !config ||
        config.tenantId !== canal.tenantId ||
        config.wabaId !== canal.wabaId ||
        config.phoneNumberId !== canal.phoneNumberId
      )
        throw new ForbiddenException();
    }
    const permisos = [
      ...(await (
        canal.origen === 'GENERAL'
          ? exigirAccesoInbox
          : exigirAccesoConexionMeta
      )(this.prisma, auth, ip)),
    ]
      .sort()
      .join('|');
    if (canal.permisos !== undefined && canal.permisos !== permisos)
      throw new ForbiddenException();
    canal.permisos = permisos;
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
  }

  async abrir(auth: CurrentAuth, ip: string, venceEl: number) {
    if (venceEl <= Date.now()) throw new ForbiddenException();
    let canal: CanalLectura;
    if (lecturaGeneralHabilitada()) {
      const actual = await runWithTenant(auth.tenantId, () =>
        canalGeneralInbox(this.prisma, auth.tenantId),
      );
      if (!actual) throw new ForbiddenException();
      canal = {
        tenantId: auth.tenantId,
        wabaId: actual.wabaId,
        phoneNumberId: actual.phoneNumberId,
        vinculoId: actual.id,
        autorizacionId: actual.autorizacionId,
        origen: 'GENERAL',
      };
    } else {
      const config = configuracionMetaRecepcion();
      if (!config || config.tenantId !== auth.tenantId)
        throw new ForbiddenException();
      canal = {
        tenantId: auth.tenantId,
        wabaId: config.wabaId,
        phoneNumberId: config.phoneNumberId,
        origen: 'PILOTO',
      };
    }
    await runWithTenant(auth.tenantId, () => this.autorizar(auth, canal, ip));
    return new Observable<MessageEvent>((subscriber) => {
      let revision: string | undefined, enviada: string | undefined;
      let ocupado = false,
        pendiente = false,
        cerrado = false;
      const identidad = { empresaId: auth.tenantId, usuarioId: auth.userId };
      const emitir = (type: string) =>
        subscriber.next({
          type,
          id: revision ?? '0',
          retry: 2000,
          data: { ...identidad, revision },
        });
      const comprobar = async () => {
        if (cerrado || subscriber.closed || revision === undefined) return;
        if (ocupado) {
          pendiente = true;
          return;
        }
        ocupado = true;
        try {
          await runWithTenant(auth.tenantId, () =>
            this.autorizar(auth, canal, ip),
          );
          if (cerrado || subscriber.closed) return;
          if (Date.now() >= venceEl) {
            subscriber.complete();
            return;
          }
          emitir(
            enviada === undefined
              ? 'ready'
              : enviada !== revision
                ? 'cambio'
                : 'heartbeat',
          );
          enviada = revision;
        } catch (error) {
          if (cerrado || subscriber.closed) return;
          emitir(
            error instanceof ForbiddenException
              ? 'acceso_cerrado'
              : 'reintentar',
          );
          subscriber.complete();
        } finally {
          ocupado = false;
        }
      };
      // Coalescer ráfagas: una revalidación como máximo cada 250 ms por conexión.
      const cambios = setInterval(() => {
        if (!pendiente) return;
        pendiente = false;
        void comprobar();
      }, 250);
      const heartbeat = setInterval(() => void comprobar(), 15000);
      const renovar = setTimeout(
        () => subscriber.complete(),
        Math.min(300000, Math.max(1, venceEl - Date.now())),
      );
      const dejar = this.bus.escuchar(
        {
          tenantId: canal.tenantId,
          wabaId: canal.wabaId,
          phoneNumberId: canal.phoneNumberId,
        },
        (actual) => {
          if (subscriber.closed) return;
          if (actual === null) {
            emitir('reintentar');
            subscriber.complete();
            return;
          }
          revision = actual;
          pendiente = true;
        },
      );
      return () => {
        cerrado = true;
        clearInterval(cambios);
        clearInterval(heartbeat);
        clearTimeout(renovar);
        dejar();
      };
    });
  }
}
