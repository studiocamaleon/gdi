import { ConflictException, Injectable } from '@nestjs/common';
import {
  EstadoIntegracion,
  Prisma,
  ProveedorIntegracion,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { ConfiguracionFiscalService } from './configuracion-fiscal.service';
import { AfipSdkProvider } from './invoicing/afip-sdk.provider';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { decisionCapacidad } from '../suscripciones/evaluador-capacidades';
import { regionalDelTenant } from '../common/regional';

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
  /**
   * El tenant factura con el MISMO CUIT que el certificado (Grupo Idea, dueño
   * de la plataforma, facturando como Corporearte). No hay nada que delegar —
   * a uno mismo no se delega—: el cert ya está autorizado para su propio CUIT.
   * La vista muestra "sos el titular" en vez del instructivo de delegación.
   */
  esCuitPropio: boolean;
  /**
   * Inclusión en el contrato vigente; no implica acceso operativo.
   */
  planPermiteAfip: boolean;
  puedeOperarAfip: boolean;
  puedeDesactivarAfip: boolean;
  restriccionAfip: string | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly configFiscal: ConfiguracionFiscalService,
    private readonly afip: AfipSdkProvider,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  private get representanteCuit(): string | null {
    return process.env.AFIP_REPRESENTANTE_CUIT?.trim() || null;
  }

  /** Compara CUITs por sus dígitos: uno puede venir con guiones y el otro no. */
  private mismoCuit(a: string | null, b: string | null): boolean {
    if (!a || !b) return false;
    const soloDigitos = (s: string) => s.replace(/\D/g, '');
    return soloDigitos(a) === soloDigitos(b);
  }

  /** El estado + los datos que la vista necesita. */
  async obtener(auth: CurrentAuth): Promise<AfipIntegracionDto> {
    const [fila, config, actual, regional] = await Promise.all([
      this.prisma.integracionTenant.findFirst({
        where: {
          tenantId: auth.tenantId,
          proveedor: ProveedorIntegracion.AFIP,
        },
      }),
      this.configFiscal.obtener(auth),
      this.capacidades.actual(auth.tenantId),
      regionalDelTenant(this.prisma, auth.tenantId),
    ]);

    const decision = decisionCapacidad(
      actual.contrato,
      'fiscal_argentina',
      actual.acceso,
    );
    const argentina = regional.paisCodigo === 'AR';
    return {
      estado: fila?.estado ?? EstadoIntegracion.DESCONECTADA,
      ambiente: this.afip.environment,
      representanteCuit: this.representanteCuit,
      esCuitPropio: this.mismoCuit(
        config?.cuit ?? null,
        this.representanteCuit,
      ),
      planPermiteAfip: decision.incluida,
      puedeOperarAfip: decision.puedeOperar && argentina,
      puedeDesactivarAfip: decisionCapacidad(
        actual.contrato,
        'identidad',
        actual.acceso,
      ).puedeOperar,
      restriccionAfip:
        actual.acceso.modo !== 'operativo'
          ? actual.acceso.descripcion
          : !decision.incluida
            ? 'Tu plan no incluye facturación electrónica. Los datos y el historial se conservan.'
            : !argentina
              ? 'La integración ARCA corresponde a empresas de Argentina.'
              : null,
      emisor: {
        cuit: config?.cuit ?? null,
        razonSocial: config?.razonSocial ?? null,
        condicionFiscal: config?.condicionFiscal ?? null,
        domicilioFiscal: config?.domicilioFiscal ?? null,
        puntosVenta: (config?.puntosVenta ?? [])
          .filter((pv) => pv.activo)
          .map((pv) => ({
            numero: pv.numero,
            numeroFormateado: pv.numeroFormateado,
          })),
      },
      ultimoChequeoEl: fila?.ultimoChequeoEl?.toISOString() ?? null,
      ultimoErrorTexto: fila?.ultimoErrorTexto ?? null,
      conectadaEl: fila?.conectadaEl?.toISOString() ?? null,
    };
  }

  /** Verificar consulta ARCA; sólo activar modifica el interruptor. */
  async verificar(auth: CurrentAuth): Promise<ResultadoVerificacion> {
    return this.comprobar(auth, false);
  }

  async activar(auth: CurrentAuth): Promise<AfipIntegracionDto> {
    await this.comprobar(auth, true);
    return this.obtener(auth);
  }

  private async comprobar(auth: CurrentAuth, activar: boolean) {
    // La consulta externa no conserva una transacción abierta. Capturamos los
    // datos probados y volvemos a autorizar antes de publicar el resultado.
    const inicial = await this.prisma.$transaction(async (tx) => {
      await this.exigirFiscal(tx, auth.tenantId);
      return this.contexto(tx, auth);
    });
    const config = inicial.config;
    const cuit = config?.cuit ?? null;
    const pv = config?.puntosVenta.find((p) => p.activo);
    let res: ResultadoVerificacion;
    if (!cuit || !pv) {
      res = {
        ok: false,
        cuit,
        puntoVenta: pv?.numero ?? null,
        ultimoNumero: null,
        motivo:
          'Cargá el CUIT del emisor y al menos un punto de venta activo antes de verificar.',
      };
    } else if (!this.afip.disponible) {
      res = {
        ok: false,
        cuit,
        puntoVenta: pv.numero,
        ultimoNumero: null,
        motivo:
          'La facturación electrónica no está disponible en este entorno.',
      };
    } else {
      const remoto = await this.afip.verificarDelegacion(cuit, pv.numero);
      res = {
        ok: remoto.ok,
        cuit,
        puntoVenta: pv.numero,
        ultimoNumero: remoto.numero,
        motivo: remoto.ok
          ? null
          : (remoto.motivo ?? 'ARCA rechazó la consulta.'),
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.exigirFiscal(tx, auth.tenantId);
      const actual = await this.contexto(tx, auth);
      if (JSON.stringify(actual) !== JSON.stringify(inicial)) {
        throw new ConflictException(
          'La configuración fiscal o la integración cambió durante la consulta. Volvé a verificar con los datos actuales.',
        );
      }
      const metadata: AfipMetadata = {
        ambiente: this.afip.environment,
        representanteCuit: this.representanteCuit,
        cuitVerificado: res.ok ? res.cuit : null,
        puntoVentaProbado: res.puntoVenta,
        ultimoNumeroVisto: res.ultimoNumero,
      };
      await this.upsert(tx, auth, {
        ultimoChequeoEl: new Date(),
        ultimoErrorTexto: res.motivo,
        metadataJson: metadata as unknown as Prisma.InputJsonValue,
        ...(activar
          ? {
              estado: res.ok
                ? EstadoIntegracion.CONECTADA
                : EstadoIntegracion.ERROR,
              conectadaEl: res.ok ? new Date() : null,
              conectadaPorId: res.ok ? auth.userId : null,
            }
          : {}),
      });
    });
    return res;
  }

  private async exigirFiscal(tx: Prisma.TransactionClient, tenantId: string) {
    await this.capacidades.exigirOperacionTx(
      tx,
      tenantId,
      ['fiscal_argentina'],
      ['fiscal_argentina'],
    );
    if ((await regionalDelTenant(tx, tenantId)).paisCodigo !== 'AR') {
      throw new ConflictException(
        'La integración ARCA corresponde a empresas de Argentina.',
      );
    }
  }

  private async contexto(tx: Prisma.TransactionClient, auth: CurrentAuth) {
    const [config, fila] = await Promise.all([
      this.configFiscal.obtener(auth, tx),
      tx.integracionTenant.findFirst({
        where: {
          tenantId: auth.tenantId,
          proveedor: ProveedorIntegracion.AFIP,
        },
        select: { id: true, updatedAt: true, estado: true },
      }),
    ]);
    return { config, integracion: fila };
  }

  /** Desactivar sigue permitido al retirar la función, con acceso operativo. */
  async desactivar(auth: CurrentAuth): Promise<AfipIntegracionDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'identidad',
      ]);
      await tx.integracionTenant.updateMany({
        where: {
          tenantId: auth.tenantId,
          proveedor: ProveedorIntegracion.AFIP,
        },
        data: { estado: EstadoIntegracion.DESCONECTADA, conectadaEl: null },
      });
    });
    return this.obtener(auth);
  }

  /** Estado efectivo: tener la delegación conectada no concede la función. */
  async facturacionHabilitada(tenantId: string): Promise<boolean> {
    const [fila, permitida, regional] = await Promise.all([
      this.prisma.integracionTenant.findFirst({
        where: { tenantId, proveedor: ProveedorIntegracion.AFIP },
        select: { estado: true },
      }),
      this.capacidades.puedeOperar(tenantId, 'fiscal_argentina'),
      regionalDelTenant(this.prisma, tenantId),
    ]);
    return (
      fila?.estado === EstadoIntegracion.CONECTADA &&
      permitida &&
      regional.paisCodigo === 'AR'
    );
  }

  // ── internos ─────────────────────────────────────────────────────────

  /**
   * Upsert que NO pisa el estado si no se lo pasan: verificar en seco actualiza
   * el chequeo sin encender ni apagar nada. La fila nace DESCONECTADA.
   */
  private async upsert(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    data: Prisma.IntegracionTenantUncheckedUpdateInput,
  ): Promise<void> {
    await tx.integracionTenant.upsert({
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
