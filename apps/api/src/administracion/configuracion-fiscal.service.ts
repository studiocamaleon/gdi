import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CurrentAuth } from '../auth/auth.types';
import { cuitValido, normalizarCuit } from '../common/cuit';
import { PrismaService } from '../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { exigirContinuidadCompromiso } from '../suscripciones/contratacion-pendiente';
import type { ClaveCapacidad } from '../suscripciones/evaluador-capacidades';
import {
  UpsertConfiguracionFiscalDto,
  UpsertPuntoVentaDto,
} from './dto/configuracion-fiscal.dto';
import {
  letraComprobante,
  type CondicionFiscalEmisor,
  type CondicionFiscalReceptor,
  type LeyendaA,
} from './letra-comprobante';

type PuntoVentaRow = {
  id: string;
  numero: number;
  nombre: string;
  modalidad: string;
  activo: boolean;
};

type ConfiguracionFiscalRow = {
  id: string;
  razonSocial: string;
  cuit: string;
  condicionFiscal: string;
  ingresosBrutos: string | null;
  domicilioFiscal: string | null;
  inicioActividades: Date | null;
  leyendaFacturaA: string | null;
  proveedorFacturacion: string;
  puntosVenta: PuntoVentaRow[];
};

@Injectable()
export class ConfiguracionFiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  private escribir<T>(
    auth: CurrentAuth,
    fiscal: boolean,
    ejecutar: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    const funciones: ClaveCapacidad[] = fiscal
      ? ['fiscal_argentina']
      : ['identidad'];
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(
        tx,
        auth.tenantId,
        funciones,
        fiscal ? funciones : [],
      );
      return ejecutar(tx);
    });
  }

  /**
   * Config fiscal del tenant con sus puntos de venta. Devuelve null si
   * todavía no se configuró — la vista muestra el estado vacío y no un
   * error: emitir sin datos del emisor no tiene sentido.
   */
  async obtener(
    auth: CurrentAuth,
    db: Pick<Prisma.TransactionClient, 'configuracionFiscal'> = this.prisma,
  ) {
    const config = await db.configuracionFiscal.findUnique({
      where: { tenantId: auth.tenantId },
      include: { puntosVenta: { orderBy: { numero: 'asc' } } },
    });
    return config ? this.toResponse(config) : null;
  }

  async guardar(auth: CurrentAuth, payload: UpsertConfiguracionFiscalDto) {
    return this.escribir(auth, false, async (tx) => {
      const cuit = normalizarCuit(payload.cuit);
      if (!cuitValido(cuit)) {
        throw new BadRequestException(
          'El CUIT del emisor no es válido (revisá los 11 dígitos y el verificador).',
        );
      }

      const datos = {
        razonSocial: payload.razonSocial.trim(),
        cuit,
        condicionFiscal: payload.condicionFiscal,
        ingresosBrutos: payload.ingresosBrutos?.trim() || null,
        domicilioFiscal: payload.domicilioFiscal?.trim() || null,
        inicioActividades: payload.inicioActividades
          ? new Date(payload.inicioActividades)
          : null,
        // La leyenda sólo aplica a las A, que sólo emite un RI.
        leyendaFacturaA:
          payload.condicionFiscal === 'RI'
            ? (payload.leyendaFacturaA ?? null)
            : null,
        proveedorFacturacion: payload.proveedorFacturacion ?? 'manual',
      };

      const previa = await tx.configuracionFiscal.findUnique({
        where: { tenantId: auth.tenantId },
      });
      if (
        datos.proveedorFacturacion === 'afipsdk' &&
        previa?.proveedorFacturacion !== 'afipsdk'
      ) {
        await this.capacidades.exigirTodas(
          auth.tenantId,
          ['fiscal_argentina'],
          tx,
        );
        await exigirContinuidadCompromiso(tx, auth.tenantId, [
          'fiscal_argentina',
        ]);
      }
      const config = await tx.configuracionFiscal.upsert({
        where: { tenantId: auth.tenantId },
        create: { tenantId: auth.tenantId, ...datos },
        update: datos,
        include: { puntosVenta: { orderBy: { numero: 'asc' } } },
      });
      if (
        previa &&
        (previa.cuit !== config.cuit ||
          previa.proveedorFacturacion !== config.proveedorFacturacion)
      ) {
        await tx.integracionTenant.updateMany({
          where: { tenantId: auth.tenantId, proveedor: 'AFIP' },
          data: { estado: 'DESCONECTADA', conectadaEl: null },
        });
      }
      return this.toResponse(config);
    });
  }

  async crearPuntoVenta(auth: CurrentAuth, payload: UpsertPuntoVentaDto) {
    return this.escribir(auth, true, async (tx) => {
      const config = await tx.configuracionFiscal.findUnique({
        where: { tenantId: auth.tenantId },
        select: { id: true },
      });
      if (!config) {
        throw new BadRequestException(
          'Configurá primero los datos fiscales del emisor.',
        );
      }

      const existe = await tx.puntoVenta.findFirst({
        where: { tenantId: auth.tenantId, numero: payload.numero },
        select: { id: true },
      });
      if (existe) {
        throw new ConflictException(
          `Ya existe el punto de venta ${String(payload.numero).padStart(4, '0')}.`,
        );
      }

      const pv = await tx.puntoVenta.create({
        data: {
          tenantId: auth.tenantId,
          configuracionFiscalId: config.id,
          numero: payload.numero,
          nombre: payload.nombre.trim(),
          modalidad: payload.modalidad ?? 'web_services',
          activo: payload.activo ?? true,
        },
      });
      return this.puntoVentaResponse(pv);
    });
  }

  async actualizarPuntoVenta(
    auth: CurrentAuth,
    id: string,
    payload: UpsertPuntoVentaDto,
  ) {
    return this.escribir(auth, true, async (tx) => {
      await this.puntoVentaOrThrow(auth, id, tx);

      const duplicado = await tx.puntoVenta.findFirst({
        where: {
          tenantId: auth.tenantId,
          numero: payload.numero,
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicado) {
        throw new ConflictException(
          `Ya existe el punto de venta ${String(payload.numero).padStart(4, '0')}.`,
        );
      }

      const pv = await tx.puntoVenta.update({
        where: { id },
        data: {
          numero: payload.numero,
          nombre: payload.nombre.trim(),
          modalidad: payload.modalidad ?? 'web_services',
          activo: payload.activo ?? true,
        },
      });
      return this.puntoVentaResponse(pv);
    });
  }

  async eliminarPuntoVenta(auth: CurrentAuth, id: string) {
    return this.escribir(auth, false, async (tx) => {
      await this.puntoVentaOrThrow(auth, id, tx);
      // TODO(etapa C2): impedir el borrado si ya tiene comprobantes emitidos.
      await tx.puntoVenta.delete({ where: { id } });
      return { ok: true };
    });
  }

  /**
   * Letra sugerida para un receptor, según el emisor configurado.
   * La usa la pantalla de emisión para explicar la sugerencia.
   */
  async letraPara(auth: CurrentAuth, receptor: CondicionFiscalReceptor) {
    const config = await this.prisma.configuracionFiscal.findUnique({
      where: { tenantId: auth.tenantId },
      select: { condicionFiscal: true, leyendaFacturaA: true },
    });
    if (!config) {
      throw new BadRequestException(
        'Configurá primero los datos fiscales del emisor.',
      );
    }
    return letraComprobante(
      config.condicionFiscal as CondicionFiscalEmisor,
      receptor,
      config.leyendaFacturaA as LeyendaA | null,
    );
  }

  private async puntoVentaOrThrow(
    auth: CurrentAuth,
    id: string,
    db: Pick<Prisma.TransactionClient, 'puntoVenta'> = this.prisma,
  ) {
    const pv = await db.puntoVenta.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!pv) {
      throw new NotFoundException(`No existe el punto de venta ${id}`);
    }
    return pv;
  }

  private toResponse(config: ConfiguracionFiscalRow) {
    return {
      id: config.id,
      razonSocial: config.razonSocial,
      cuit: config.cuit,
      condicionFiscal: config.condicionFiscal,
      ingresosBrutos: config.ingresosBrutos,
      domicilioFiscal: config.domicilioFiscal,
      inicioActividades: config.inicioActividades
        ? config.inicioActividades.toISOString().slice(0, 10)
        : null,
      leyendaFacturaA: config.leyendaFacturaA,
      proveedorFacturacion: config.proveedorFacturacion,
      puntosVenta: config.puntosVenta.map((pv) => this.puntoVentaResponse(pv)),
    };
  }

  private puntoVentaResponse(pv: PuntoVentaRow) {
    return {
      id: pv.id,
      numero: pv.numero,
      /** "0001" — como lo muestra ARCA y el diseño. */
      numeroFormateado: String(pv.numero).padStart(4, '0'),
      nombre: pv.nombre,
      modalidad: pv.modalidad,
      activo: pv.activo,
    };
  }
}
