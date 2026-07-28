import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FrecuenciaGastoFijo, NaturalezaEgreso, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { UpsertGastoFijoDto } from './dto/upsert-gasto-fijo.dto';

/**
 * Gastos fijos de estructura — fuente ÚNICA del pool de costos fijos del
 * PUNTO DE EQUILIBRIO, desacoplada de los centros de costo (que arman
 * tarifas). Modelo recurrente con vigencia mensual 'YYYY-MM'.
 * Ver docs/gastos-fijos-estructura-diseno.md
 */

type GastoFijoRow = Prisma.GastoFijoEstructuraGetPayload<{
  include: typeof INCLUDE_GASTO;
}>;

/** Cuántas veces al año se paga cada frecuencia. */
const CUOTAS_POR_ANIO: Record<FrecuenciaGastoFijo, number> = {
  MENSUAL: 12,
  BIMESTRAL: 6,
  TRIMESTRAL: 4,
  SEMESTRAL: 2,
  ANUAL: 1,
};

const INCLUDE_GASTO = {
  categoria: { select: { nombre: true, codigo: true } },
  proveedor: { select: { nombre: true } },
  metodoPago: { select: { nombre: true } },
} as const;

@Injectable()
export class GastosFijosService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async listar(auth: CurrentAuth) {
    const rows = await this.prisma.gastoFijoEstructura.findMany({
      where: { tenantId: auth.tenantId },
      include: INCLUDE_GASTO,
      orderBy: [{ categoria: { nombre: 'asc' } }, { nombre: 'asc' }],
    });
    return rows.map((g) => this.toResponse(g));
  }

  async crear(auth: CurrentAuth, dto: UpsertGastoFijoDto) {
    this.validarVigencia(dto);
    await this.validarCategoria(auth, dto.categoriaEgresoId);
    const row = await this.prisma.gastoFijoEstructura.create({
      data: {
        tenantId: auth.tenantId,
        ...this.datosDesdeDto(dto),
      },
      include: INCLUDE_GASTO,
    });
    return this.toResponse(row);
  }

  async actualizar(auth: CurrentAuth, id: string, dto: UpsertGastoFijoDto) {
    this.validarVigencia(dto);
    await this.validarCategoria(auth, dto.categoriaEgresoId);
    await this.obtenerOFallar(auth, id);
    const row = await this.prisma.gastoFijoEstructura.update({
      where: { id },
      data: this.datosDesdeDto(dto),
      include: INCLUDE_GASTO,
    });
    return this.toResponse(row);
  }

  async alternarActivo(auth: CurrentAuth, id: string) {
    const actual = await this.obtenerOFallar(auth, id);
    const row = await this.prisma.gastoFijoEstructura.update({
      where: { id },
      data: { activo: !actual.activo },
      include: INCLUDE_GASTO,
    });
    return this.toResponse(row);
  }

  async eliminar(auth: CurrentAuth, id: string) {
    await this.obtenerOFallar(auth, id);
    await this.prisma.gastoFijoEstructura.delete({ where: { id } });
    return { id, eliminado: true };
  }





  /**
   * El usuario carga el valor de UNA cuota y cada cuánto se paga; el importe
   * mensual se deriva. Sin esto, un seguro anual de $1.200.000 haría saltar el
   * punto de equilibrio en un solo mes y lo dejaría en cero los otros once.
   */
  private datosDesdeDto(dto: UpsertGastoFijoDto) {
    const valor = new Prisma.Decimal(dto.valor);
    const cuotas = CUOTAS_POR_ANIO[dto.frecuencia];
    return {
      nombre: dto.nombre.trim(),
      categoriaEgresoId: dto.categoriaEgresoId,
      valor,
      frecuencia: dto.frecuencia,
      importeMensual: valor.mul(cuotas).div(12).toDecimalPlaces(2),
      proveedorId: dto.proveedorId ?? null,
      metodoPagoId: dto.metodoPagoId ?? null,
      documento: dto.documento?.trim() || null,
      vigenteDesde: dto.vigenteDesde,
      vigenteHasta: dto.vigenteHasta ?? null,
      activo: dto.activo ?? true,
      notas: dto.notas?.trim() || null,
    };
  }

  private async obtenerOFallar(auth: CurrentAuth, id: string): Promise<GastoFijoRow> {
    const row = await this.prisma.gastoFijoEstructura.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: INCLUDE_GASTO,
    });
    if (!row) throw new NotFoundException('Gasto fijo no encontrado.');
    return row;
  }

  /**
   * La categoría sale del catálogo de Cuentas por pagar, pero no cualquiera
   * sirve: un gasto fijo es por definición de estructura, así que "materiales"
   * o "maquinaria" (que son costo de producción e inversión) quedan afuera.
   */
  private async validarCategoria(auth: CurrentAuth, categoriaEgresoId: string) {
    const categoria = await this.prisma.categoriaEgreso.findFirst({
      where: { id: categoriaEgresoId, tenantId: auth.tenantId },
      select: { naturaleza: true, nombre: true },
    });
    if (!categoria) throw new NotFoundException('Categoría no encontrada.');
    if (categoria.naturaleza !== NaturalezaEgreso.GASTO_ESTRUCTURA) {
      throw new BadRequestException(
        `"${categoria.nombre}" no es una categoría de gasto de estructura.`,
      );
    }
  }

  private validarVigencia(dto: UpsertGastoFijoDto) {
    if (dto.vigenteHasta && dto.vigenteHasta < dto.vigenteDesde) {
      throw new BadRequestException(
        'La vigencia "hasta" no puede ser anterior a "desde".',
      );
    }
  }

  private mesActual(): string {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  }

  private toResponse(g: GastoFijoRow) {
    return {
      id: g.id,
      nombre: g.nombre,
      categoriaEgresoId: g.categoriaEgresoId,
      categoriaNombre: g.categoria.nombre,
      categoriaCodigo: g.categoria.codigo,
      valor: Number(g.valor.toFixed(2)),
      frecuencia: g.frecuencia,
      importeMensual: Number(g.importeMensual.toFixed(2)),
      proveedorId: g.proveedorId,
      proveedorNombre: g.proveedor?.nombre ?? null,
      metodoPagoId: g.metodoPagoId,
      metodoPagoNombre: g.metodoPago?.nombre ?? null,
      documento: g.documento,
      vigenteDesde: g.vigenteDesde,
      vigenteHasta: g.vigenteHasta,
      activo: g.activo,
      notas: g.notas,
    };
  }
}
