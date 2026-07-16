import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/auth.types';
import { cuitValido, normalizarCuit } from '../common/cuit';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Config fiscal del tenant con sus puntos de venta. Devuelve null si
   * todavía no se configuró — la vista muestra el estado vacío y no un
   * error: emitir sin datos del emisor no tiene sentido.
   */
  async obtener(auth: CurrentAuth) {
    const config = await this.prisma.configuracionFiscal.findUnique({
      where: { tenantId: auth.tenantId },
      include: { puntosVenta: { orderBy: { numero: 'asc' } } },
    });
    return config ? this.toResponse(config) : null;
  }

  async guardar(auth: CurrentAuth, payload: UpsertConfiguracionFiscalDto) {
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

    const config = await this.prisma.configuracionFiscal.upsert({
      where: { tenantId: auth.tenantId },
      create: { tenantId: auth.tenantId, ...datos },
      update: datos,
      include: { puntosVenta: { orderBy: { numero: 'asc' } } },
    });
    return this.toResponse(config);
  }

  async crearPuntoVenta(auth: CurrentAuth, payload: UpsertPuntoVentaDto) {
    const config = await this.prisma.configuracionFiscal.findUnique({
      where: { tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!config) {
      throw new BadRequestException(
        'Configurá primero los datos fiscales del emisor.',
      );
    }

    const existe = await this.prisma.puntoVenta.findFirst({
      where: { tenantId: auth.tenantId, numero: payload.numero },
      select: { id: true },
    });
    if (existe) {
      throw new ConflictException(
        `Ya existe el punto de venta ${String(payload.numero).padStart(4, '0')}.`,
      );
    }

    const pv = await this.prisma.puntoVenta.create({
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
  }

  async actualizarPuntoVenta(
    auth: CurrentAuth,
    id: string,
    payload: UpsertPuntoVentaDto,
  ) {
    await this.puntoVentaOrThrow(auth, id);

    const duplicado = await this.prisma.puntoVenta.findFirst({
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

    const pv = await this.prisma.puntoVenta.update({
      where: { id },
      data: {
        numero: payload.numero,
        nombre: payload.nombre.trim(),
        modalidad: payload.modalidad ?? 'web_services',
        activo: payload.activo ?? true,
      },
    });
    return this.puntoVentaResponse(pv);
  }

  async eliminarPuntoVenta(auth: CurrentAuth, id: string) {
    await this.puntoVentaOrThrow(auth, id);
    // TODO(etapa C2): impedir el borrado si ya tiene comprobantes emitidos.
    await this.prisma.puntoVenta.delete({ where: { id } });
    return { ok: true };
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

  private async puntoVentaOrThrow(auth: CurrentAuth, id: string) {
    const pv = await this.prisma.puntoVenta.findFirst({
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
