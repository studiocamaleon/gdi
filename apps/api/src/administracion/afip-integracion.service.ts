import { Injectable, Logger } from '@nestjs/common';
import {
  EstadoIntegracion,
  Prisma,
  ProveedorIntegracion,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { ConfiguracionFiscalService } from './configuracion-fiscal.service';
import { AfipSdkProvider } from './invoicing/afip-sdk.provider';

/**
 * La integración con AFIP, que NO es "conectar con credenciales": es
 * delegación. Un solo certificado de Grafo representa a N CUITs; el cliente no
 * sube nada, sólo delega su facturación a Grafo desde ARCA.
 *
 * Por eso acá no hay secreto que guardar (`credencialesCifradas` queda null) y
 * la única operación real es VERIFICAR que la delegación se haya hecho —
 * usándola, porque ARCA no tiene un webservice que la consulte.
 * Ver docs/integracion-afip-delegacion-diseno.md
 */

export type ResultadoVerificacion = {
  ok: boolean;
  /** El CUIT del emisor con el que se probó. */
  cuit: string | null;
  /** El punto de venta contra el que se consultó. */
  puntoVenta: number | null;
  /** Último número autorizado que devolvió ARCA (0 = autorizado, nada emitido). */
  ultimoNumero: number | null;
  /** En castellano, si algo impidió verificar. */
  motivo: string | null;
};

type AfipMetadata = {
  ambiente: 'dev' | 'prod';
  representanteCuit: string | null;
  cuitVerificado?: string | null;
  puntoVentaProbado?: number | null;
  ultimoNumeroVisto?: number | null;
};

export type AfipIntegracionDto = {
  estado: EstadoIntegracion;
  ambiente: 'dev' | 'prod';
  /** El CUIT de Grafo que el cliente delega en ARCA. */
  representanteCuit: string | null;
  /** Datos fiscales del emisor (de ConfiguracionFiscal). */
  emisor: {
    cuit: string | null;
    razonSocial: string | null;
    condicionFiscal: string | null;
    domicilioFiscal: string | null;
    puntosVenta: Array<{ numero: number; numeroFormateado: string }>;
  };
  ultimoChequeoEl: string | null;
  ultimoErrorTexto: string | null;
  conectadaEl: string | null;
};

@Injectable()
export class AfipIntegracionService {
  private readonly logger = new Logger(AfipIntegracionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configFiscal: ConfiguracionFiscalService,
    private readonly afip: AfipSdkProvider,
  ) {}

  private get representanteCuit(): string | null {
    return process.env.AFIP_REPRESENTANTE_CUIT?.trim() || null;
  }

  /** El estado + los datos que la vista necesita. */
  async obtener(auth: CurrentAuth): Promise<AfipIntegracionDto> {
    const [fila, config] = await Promise.all([
      this.prisma.integracionTenant.findFirst({
        where: { proveedor: ProveedorIntegracion.AFIP },
      }),
      this.configFiscal.obtener(auth),
    ]);

    return {
      estado: fila?.estado ?? EstadoIntegracion.DESCONECTADA,
      ambiente: this.afip.environment,
      representanteCuit: this.representanteCuit,
      emisor: {
        cuit: config?.cuit ?? null,
        razonSocial: config?.razonSocial ?? null,
        condicionFiscal: config?.condicionFiscal ?? null,
        domicilioFiscal: config?.domicilioFiscal ?? null,
        puntosVenta: (config?.puntosVenta ?? []).map((pv) => ({
          numero: pv.numero,
          numeroFormateado: pv.numeroFormateado,
        })),
      },
      ultimoChequeoEl: fila?.ultimoChequeoEl?.toISOString() ?? null,
      ultimoErrorTexto: fila?.ultimoErrorTexto ?? null,
      conectadaEl: fila?.conectadaEl?.toISOString() ?? null,
    };
  }

  /**
   * Verifica la delegación sin cambiar el estado: sirve para chequear ANTES de
   * activar. Persiste el resultado (chequeo/error/metadata) para que la vista
   * lo muestre aunque no se active.
   */
  async verificar(auth: CurrentAuth): Promise<ResultadoVerificacion> {
    const config = await this.configFiscal.obtener(auth);
    const cuit = config?.cuit ?? null;
    const pv =
      config?.puntosVenta?.find((p) => p.activo) ?? config?.puntosVenta?.[0];

    // Precondición: sin CUIT ni punto de venta no hay nada contra qué probar.
    if (!cuit || !pv) {
      const motivo =
        'Cargá el CUIT del emisor y al menos un punto de venta antes de verificar.';
      await this.persistirChequeo(auth, { ok: false, motivo });
      return {
        ok: false,
        cuit,
        puntoVenta: pv?.numero ?? null,
        ultimoNumero: null,
        motivo,
      };
    }

    if (!this.afip.disponible) {
      const motivo =
        'La facturación electrónica no está disponible en este entorno.';
      await this.persistirChequeo(auth, { ok: false, motivo });
      return {
        ok: false,
        cuit,
        puntoVenta: pv.numero,
        ultimoNumero: null,
        motivo,
      };
    }

    const res = await this.afip.verificarDelegacion(cuit, pv.numero);
    await this.persistirChequeo(auth, {
      ok: res.ok,
      motivo: res.motivo ?? null,
      cuit,
      puntoVenta: pv.numero,
      ultimoNumero: res.numero,
    });

    return {
      ok: res.ok,
      cuit,
      puntoVenta: pv.numero,
      ultimoNumero: res.numero,
      motivo: res.ok ? null : (res.motivo ?? 'ARCA rechazó la consulta.'),
    };
  }

  /**
   * Enciende la facturación electrónica. Verifica primero: no se puede activar
   * una delegación rota. Si pasa → CONECTADA (aparece el botón Facturar); si
   * no → ERROR con el motivo.
   */
  async activar(auth: CurrentAuth): Promise<AfipIntegracionDto> {
    const res = await this.verificar(auth);
    if (res.ok) {
      await this.upsert(auth, {
        estado: EstadoIntegracion.CONECTADA,
        conectadaEl: new Date(),
        conectadaPorId: auth.userId,
        ultimoErrorTexto: null,
      });
    } else {
      await this.upsert(auth, {
        estado: EstadoIntegracion.ERROR,
        ultimoErrorTexto: res.motivo,
      });
    }
    return this.obtener(auth);
  }

  /** Apaga la facturación: el botón Facturar desaparece. No borra la config fiscal. */
  async desactivar(auth: CurrentAuth): Promise<AfipIntegracionDto> {
    const fila = await this.prisma.integracionTenant.findFirst({
      where: { proveedor: ProveedorIntegracion.AFIP },
    });
    if (fila) {
      await this.prisma.integracionTenant.update({
        where: { id: fila.id },
        data: {
          estado: EstadoIntegracion.DESCONECTADA,
          conectadaEl: null,
        },
      });
    }
    return this.obtener(auth);
  }

  /** ¿Se puede facturar? La usa el gate del botón y la red del backend. */
  async facturacionHabilitada(): Promise<boolean> {
    const fila = await this.prisma.integracionTenant.findFirst({
      where: { proveedor: ProveedorIntegracion.AFIP },
      select: { estado: true },
    });
    return fila?.estado === EstadoIntegracion.CONECTADA;
  }

  // ── internos ─────────────────────────────────────────────────────────

  private async persistirChequeo(
    auth: CurrentAuth,
    r: {
      ok: boolean;
      motivo?: string | null;
      cuit?: string | null;
      puntoVenta?: number | null;
      ultimoNumero?: number | null;
    },
  ): Promise<void> {
    const metadata: AfipMetadata = {
      ambiente: this.afip.environment,
      representanteCuit: this.representanteCuit,
      cuitVerificado: r.ok ? (r.cuit ?? null) : null,
      puntoVentaProbado: r.puntoVenta ?? null,
      ultimoNumeroVisto: r.ultimoNumero ?? null,
    };
    await this.upsert(auth, {
      ultimoChequeoEl: new Date(),
      ultimoErrorTexto: r.ok ? null : (r.motivo ?? null),
      metadataJson: metadata as unknown as Prisma.InputJsonValue,
    });
  }

  /**
   * Upsert que NO pisa el estado si no se lo pasan: verificar en seco actualiza
   * el chequeo sin encender ni apagar nada. La fila nace DESCONECTADA.
   */
  private async upsert(
    auth: CurrentAuth,
    data: Prisma.IntegracionTenantUncheckedUpdateInput,
  ): Promise<void> {
    await this.prisma.integracionTenant.upsert({
      where: {
        tenantId_proveedor: {
          tenantId: auth.tenantId,
          proveedor: ProveedorIntegracion.AFIP,
        },
      },
      create: {
        tenantId: auth.tenantId,
        proveedor: ProveedorIntegracion.AFIP,
        estado:
          (data.estado as EstadoIntegracion | undefined) ??
          EstadoIntegracion.DESCONECTADA,
        ultimoChequeoEl: (data.ultimoChequeoEl as Date | undefined) ?? null,
        ultimoErrorTexto:
          (data.ultimoErrorTexto as string | null | undefined) ?? null,
        conectadaEl: (data.conectadaEl as Date | undefined) ?? null,
        conectadaPorId: (data.conectadaPorId as string | undefined) ?? null,
        metadataJson:
          (data.metadataJson as Prisma.InputJsonValue | undefined) ??
          Prisma.JsonNull,
      },
      update: data,
    });
  }
}
