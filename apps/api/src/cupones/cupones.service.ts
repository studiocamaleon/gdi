import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import {
  evaluarCupon,
  normalizarCodigoCupon,
  type CuponEvaluable,
} from './cupon-reglas';
import type {
  ActualizarCuponDto,
  CrearCuponDto,
  ValidarCuponDto,
} from './dto/cupones.dto';

@Injectable()
export class CuponesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(auth: CurrentAuth) {
    const rows = await this.prisma.cupon.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ activo: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return rows.map((c) => this.proyectar(c));
  }

  async crear(auth: CurrentAuth, dto: CrearCuponDto) {
    const codigo = normalizarCodigoCupon(dto.codigo);
    if (dto.alcanceTipo && dto.alcanceTipo !== 'ORDEN' && !dto.alcanceRef) {
      throw new BadRequestException(
        'Un cupón con alcance necesita a qué apunta (categoría, producto o cliente).',
      );
    }
    if (dto.tipo === 'PORCENTAJE' && dto.valor > 100) {
      throw new BadRequestException('El porcentaje no puede superar el 100%.');
    }
    try {
      const cupon = await this.prisma.cupon.create({
        data: {
          tenantId: auth.tenantId,
          codigo,
          descripcion: dto.descripcion ?? null,
          tipo: dto.tipo,
          valor: dto.valor,
          alcanceTipo: dto.alcanceTipo ?? 'ORDEN',
          alcanceRef: dto.alcanceRef ?? null,
          montoMinimo: dto.montoMinimo ?? null,
          vigenciaDesde: dto.vigenciaDesde ? new Date(dto.vigenciaDesde) : null,
          vigenciaHasta: dto.vigenciaHasta ? new Date(dto.vigenciaHasta) : null,
          usoMax: dto.usoMax ?? null,
        },
      });
      return this.proyectar(cupon);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(`Ya existe un cupón "${codigo}".`);
      }
      throw error;
    }
  }

  async actualizar(auth: CurrentAuth, id: string, dto: ActualizarCuponDto) {
    const existente = await this.exigir(auth, id);
    if (
      dto.valor != null &&
      existente.tipo === 'PORCENTAJE' &&
      dto.valor > 100
    ) {
      throw new BadRequestException('El porcentaje no puede superar el 100%.');
    }
    const cupon = await this.prisma.cupon.update({
      where: { id: existente.id },
      data: {
        ...(dto.descripcion !== undefined
          ? { descripcion: dto.descripcion }
          : {}),
        ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
        ...(dto.montoMinimo !== undefined
          ? { montoMinimo: dto.montoMinimo }
          : {}),
        ...(dto.vigenciaDesde !== undefined
          ? {
              vigenciaDesde: dto.vigenciaDesde
                ? new Date(dto.vigenciaDesde)
                : null,
            }
          : {}),
        ...(dto.vigenciaHasta !== undefined
          ? {
              vigenciaHasta: dto.vigenciaHasta
                ? new Date(dto.vigenciaHasta)
                : null,
            }
          : {}),
        ...(dto.usoMax !== undefined ? { usoMax: dto.usoMax } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
    return this.proyectar(cupon);
  }

  /**
   * Valida un código contra el carrito de la ficha y devuelve qué líneas
   * alcanza. NO redime: la redención (contador + auditoría) ocurre recién al
   * emitir la OT, en la transacción de emisión.
   */
  async validar(auth: CurrentAuth, dto: ValidarCuponDto) {
    const cupon = await this.prisma.cupon.findUnique({
      where: {
        tenantId_codigo: {
          tenantId: auth.tenantId,
          codigo: normalizarCodigoCupon(dto.codigo),
        },
      },
    });
    if (!cupon) throw new NotFoundException('No existe un cupón con ese código.');
    const resultado = evaluarCupon(this.aEvaluable(cupon), {
      ahora: new Date(),
      clienteId: dto.clienteId ?? null,
      items: dto.items.map((i) => ({
        key: i.key,
        productoId: i.productoId ?? null,
        categoriaCodigo: i.categoriaCodigo ?? null,
        subcategoriaCodigo: i.subcategoriaCodigo ?? null,
        neto: i.neto,
      })),
    });
    if (!resultado.ok) throw new BadRequestException(resultado.motivo);
    return {
      cupon: this.proyectar(cupon),
      alcanzadas: resultado.alcanzadas,
    };
  }

  /** QR con el código PLANO: el lector 2D lo tipea como teclado. */
  async qr(auth: CurrentAuth, id: string) {
    const cupon = await this.exigir(auth, id);
    const dataUrl = await QRCode.toDataURL(cupon.codigo, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 480,
    });
    return { codigo: cupon.codigo, dataUrl };
  }

  private async exigir(auth: CurrentAuth, id: string) {
    const cupon = await this.prisma.cupon.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!cupon) throw new NotFoundException('El cupón no existe.');
    return cupon;
  }

  private aEvaluable(cupon: {
    codigo: string;
    tipo: string;
    valor: Prisma.Decimal;
    alcanceTipo: string;
    alcanceRef: string | null;
    montoMinimo: Prisma.Decimal | null;
    vigenciaDesde: Date | null;
    vigenciaHasta: Date | null;
    usoMax: number | null;
    usoCount: number;
    activo: boolean;
  }): CuponEvaluable {
    return {
      codigo: cupon.codigo,
      tipo: cupon.tipo,
      valor: Number(cupon.valor),
      alcanceTipo: cupon.alcanceTipo,
      alcanceRef: cupon.alcanceRef,
      montoMinimo: cupon.montoMinimo != null ? Number(cupon.montoMinimo) : null,
      vigenciaDesde: cupon.vigenciaDesde,
      vigenciaHasta: cupon.vigenciaHasta,
      usoMax: cupon.usoMax,
      usoCount: cupon.usoCount,
      activo: cupon.activo,
    };
  }

  private proyectar(cupon: {
    id: string;
    codigo: string;
    descripcion: string | null;
    tipo: string;
    valor: Prisma.Decimal;
    alcanceTipo: string;
    alcanceRef: string | null;
    montoMinimo: Prisma.Decimal | null;
    vigenciaDesde: Date | null;
    vigenciaHasta: Date | null;
    usoMax: number | null;
    usoCount: number;
    activo: boolean;
    createdAt: Date;
  }) {
    return {
      id: cupon.id,
      codigo: cupon.codigo,
      descripcion: cupon.descripcion,
      tipo: cupon.tipo as 'PORCENTAJE' | 'MONTO',
      valor: Number(cupon.valor),
      alcanceTipo: cupon.alcanceTipo,
      alcanceRef: cupon.alcanceRef,
      montoMinimo: cupon.montoMinimo != null ? Number(cupon.montoMinimo) : null,
      vigenciaDesde: cupon.vigenciaDesde?.toISOString() ?? null,
      vigenciaHasta: cupon.vigenciaHasta?.toISOString() ?? null,
      usoMax: cupon.usoMax,
      usoCount: cupon.usoCount,
      activo: cupon.activo,
      createdAt: cupon.createdAt.toISOString(),
    };
  }
}
