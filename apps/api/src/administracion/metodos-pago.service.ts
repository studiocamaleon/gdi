import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import type { UpsertMetodoPagoDto } from './dto/metodo-pago.dto';

/**
 * Catálogo sugerido (valores del diseño Grafo V2 · admin/metodos-pago,
 * basados en la investigación de julio 2026). Son punto de partida
 * editables por tenant — comisiones y plazos cambian seguido.
 */
const CATALOGO_SUGERIDO: Array<{
  codigo: string;
  nombre: string;
  tipo: string;
  comisionPct: number;
  ivaComisionPct: number;
  plazoAcreditacionDias: number;
  sufreRetencion: boolean;
  /** Cuenta genérica destino (se crea si no existe). */
  cuentaSugerida?: { nombre: string; tipo: string };
}> = [
  {
    codigo: 'efectivo',
    nombre: 'Efectivo',
    tipo: 'efectivo',
    comisionPct: 0,
    ivaComisionPct: 0,
    plazoAcreditacionDias: 0,
    sufreRetencion: false,
    cuentaSugerida: { nombre: 'Caja mostrador', tipo: 'caja' },
  },
  {
    codigo: 'transferencia',
    nombre: 'Transferencia',
    tipo: 'transferencia',
    comisionPct: 0,
    ivaComisionPct: 0,
    plazoAcreditacionDias: 0,
    sufreRetencion: true,
  },
  {
    codigo: 'qr_30',
    nombre: 'QR 3.0',
    tipo: 'billetera_qr',
    comisionPct: 0.8,
    ivaComisionPct: 21,
    plazoAcreditacionDias: 1,
    sufreRetencion: true,
  },
  {
    codigo: 'debito',
    nombre: 'Débito',
    tipo: 'tarjeta_debito',
    comisionPct: 1.8,
    ivaComisionPct: 21,
    plazoAcreditacionDias: 2,
    sufreRetencion: true,
  },
  {
    codigo: 'credito_1_pago',
    nombre: 'Crédito 1 pago',
    tipo: 'tarjeta_credito',
    comisionPct: 3.5,
    ivaComisionPct: 21,
    plazoAcreditacionDias: 10,
    sufreRetencion: true,
  },
  {
    codigo: 'credito_cuotas',
    nombre: 'Crédito en cuotas',
    tipo: 'tarjeta_credito',
    comisionPct: 5.2,
    ivaComisionPct: 21,
    plazoAcreditacionDias: 10,
    sufreRetencion: true,
  },
  {
    codigo: 'mp_por_canal',
    nombre: 'MP por canal',
    tipo: 'billetera_qr',
    comisionPct: 4.99,
    ivaComisionPct: 21,
    plazoAcreditacionDias: 0,
    sufreRetencion: true,
  },
  {
    codigo: 'echeq',
    nombre: 'Echeq',
    tipo: 'cheque_echeq',
    comisionPct: 0,
    ivaComisionPct: 0,
    plazoAcreditacionDias: 30,
    sufreRetencion: false,
    cuentaSugerida: { nombre: 'Cartera de valores', tipo: 'cartera_valores' },
  },
  {
    codigo: 'debin',
    nombre: 'DEBIN',
    tipo: 'debito_automatico',
    comisionPct: 0.6,
    ivaComisionPct: 21,
    plazoAcreditacionDias: 1,
    sufreRetencion: true,
  },
];

function slugify(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

@Injectable()
export class MetodosPagoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(auth: CurrentAuth) {
    const metodos = await this.prisma.metodoPago.findMany({
      where: { tenantId: auth.tenantId },
      include: { cuentaDestino: { select: { id: true, nombre: true } } },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
    return metodos.map((metodo) => this.toResponse(metodo));
  }

  async create(auth: CurrentAuth, payload: UpsertMetodoPagoDto) {
    await this.validarCuentaDestino(auth, payload.cuentaDestinoId);
    const codigo = await this.codigoDisponible(auth, slugify(payload.nombre));
    const ultimo = await this.prisma.metodoPago.aggregate({
      where: { tenantId: auth.tenantId },
      _max: { orden: true },
    });
    const creado = await this.prisma.metodoPago.create({
      data: {
        tenantId: auth.tenantId,
        codigo,
        nombre: payload.nombre,
        tipo: payload.tipo,
        comisionPct: payload.comisionPct,
        ivaComisionPct: payload.ivaComisionPct,
        plazoAcreditacionDias: payload.plazoAcreditacionDias,
        sufreRetencion: payload.sufreRetencion,
        cuentaDestinoId: payload.cuentaDestinoId ?? null,
        activo: payload.activo ?? true,
        orden: (ultimo._max.orden ?? -1) + 1,
      },
      include: { cuentaDestino: { select: { id: true, nombre: true } } },
    });
    return this.toResponse(creado);
  }

  async update(auth: CurrentAuth, id: string, payload: UpsertMetodoPagoDto) {
    const existente = await this.prisma.metodoPago.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!existente) {
      throw new NotFoundException('No se encontró el método de pago.');
    }
    await this.validarCuentaDestino(auth, payload.cuentaDestinoId);
    const actualizado = await this.prisma.metodoPago.update({
      where: { id: existente.id },
      data: {
        nombre: payload.nombre,
        tipo: payload.tipo,
        comisionPct: payload.comisionPct,
        ivaComisionPct: payload.ivaComisionPct,
        plazoAcreditacionDias: payload.plazoAcreditacionDias,
        sufreRetencion: payload.sufreRetencion,
        cuentaDestinoId: payload.cuentaDestinoId ?? null,
        ...(payload.activo !== undefined ? { activo: payload.activo } : {}),
      },
      include: { cuentaDestino: { select: { id: true, nombre: true } } },
    });
    return this.toResponse(actualizado);
  }

  async toggle(auth: CurrentAuth, id: string) {
    const existente = await this.prisma.metodoPago.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!existente) {
      throw new NotFoundException('No se encontró el método de pago.');
    }
    const actualizado = await this.prisma.metodoPago.update({
      where: { id: existente.id },
      data: { activo: !existente.activo },
      include: { cuentaDestino: { select: { id: true, nombre: true } } },
    });
    return this.toResponse(actualizado);
  }

  /**
   * Instala el catálogo sugerido: crea los métodos que falten (por código)
   * y las cuentas genéricas seguras (Caja mostrador, Cartera de valores).
   * Idempotente: correrlo dos veces no duplica nada.
   */
  async instalarCatalogo(auth: CurrentAuth) {
    let creados = 0;
    for (const [indice, sugerido] of CATALOGO_SUGERIDO.entries()) {
      const existe = await this.prisma.metodoPago.findFirst({
        where: { tenantId: auth.tenantId, codigo: sugerido.codigo },
        select: { id: true },
      });
      if (existe) continue;

      let cuentaDestinoId: string | null = null;
      if (sugerido.cuentaSugerida) {
        const cuenta = await this.prisma.cuentaFondos.upsert({
          where: {
            tenantId_nombre: {
              tenantId: auth.tenantId,
              nombre: sugerido.cuentaSugerida.nombre,
            },
          },
          create: {
            tenantId: auth.tenantId,
            nombre: sugerido.cuentaSugerida.nombre,
            tipo: sugerido.cuentaSugerida.tipo,
          },
          update: {},
        });
        cuentaDestinoId = cuenta.id;
      }

      await this.prisma.metodoPago.create({
        data: {
          tenantId: auth.tenantId,
          codigo: sugerido.codigo,
          nombre: sugerido.nombre,
          tipo: sugerido.tipo,
          comisionPct: sugerido.comisionPct,
          ivaComisionPct: sugerido.ivaComisionPct,
          plazoAcreditacionDias: sugerido.plazoAcreditacionDias,
          sufreRetencion: sugerido.sufreRetencion,
          cuentaDestinoId,
          orden: indice,
        },
      });
      creados += 1;
    }
    return { creados, total: CATALOGO_SUGERIDO.length };
  }

  async listarCuentas(auth: CurrentAuth) {
    const cuentas = await this.prisma.cuentaFondos.findMany({
      where: { tenantId: auth.tenantId, activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, tipo: true, moneda: true },
    });
    return cuentas;
  }

  private async validarCuentaDestino(
    auth: CurrentAuth,
    cuentaDestinoId: string | null | undefined,
  ) {
    if (!cuentaDestinoId) return;
    const cuenta = await this.prisma.cuentaFondos.count({
      where: { id: cuentaDestinoId, tenantId: auth.tenantId },
    });
    if (!cuenta) {
      throw new BadRequestException('La cuenta destino no existe.');
    }
  }

  private async codigoDisponible(auth: CurrentAuth, base: string) {
    const codigo = base || 'metodo';
    let candidato = codigo;
    let sufijo = 1;
    while (
      await this.prisma.metodoPago.findFirst({
        where: { tenantId: auth.tenantId, codigo: candidato },
        select: { id: true },
      })
    ) {
      sufijo += 1;
      candidato = `${codigo}_${sufijo}`;
    }
    return candidato;
  }

  private toResponse(metodo: {
    id: string;
    codigo: string;
    nombre: string;
    tipo: string;
    comisionPct: unknown;
    ivaComisionPct: unknown;
    plazoAcreditacionDias: number;
    sufreRetencion: boolean;
    activo: boolean;
    orden: number;
    cuentaDestino?: { id: string; nombre: string } | null;
  }) {
    return {
      id: metodo.id,
      codigo: metodo.codigo,
      nombre: metodo.nombre,
      tipo: metodo.tipo,
      comisionPct: Number(metodo.comisionPct),
      ivaComisionPct: Number(metodo.ivaComisionPct),
      plazoAcreditacionDias: metodo.plazoAcreditacionDias,
      sufreRetencion: metodo.sufreRetencion,
      cuentaDestinoId: metodo.cuentaDestino?.id ?? null,
      cuentaDestinoNombre: metodo.cuentaDestino?.nombre ?? null,
      activo: metodo.activo,
      orden: metodo.orden,
    };
  }
}
