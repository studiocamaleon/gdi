import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FrecuenciaGastoFijo, NaturalezaEgreso, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { UpsertGastoFijoDto } from './dto/upsert-gasto-fijo.dto';
import { exigirProveedorActivoDelTenant } from '../proveedores/proveedor-validacion';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { bloquearCupoUsuarios } from '../suscripciones/cupos-usuarios';
import { regionalDelTenant } from '../common/regional';

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
  recurrentes: {
    orderBy: { createdAt: 'asc' as const },
    include: { _count: { select: { egresos: true } } },
  },
} as const;

@Injectable()
export class GastosFijosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
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
    await exigirProveedorActivoDelTenant(
      this.prisma,
      auth.tenantId,
      dto.proveedorId,
    );
    return this.prisma.$transaction(async (tx) => {
      await bloquearCupoUsuarios(tx, auth.tenantId);
      const row = await tx.gastoFijoEstructura.create({
        data: { tenantId: auth.tenantId, ...this.datosDesdeDto(dto) },
        include: INCLUDE_GASTO,
      });
      await this.sincronizarProgramacion(tx, auth, row, dto.programacion);
      return this.toResponse(
        await tx.gastoFijoEstructura.findUniqueOrThrow({
          where: { id: row.id },
          include: INCLUDE_GASTO,
        }),
      );
    });
  }

  async actualizar(auth: CurrentAuth, id: string, dto: UpsertGastoFijoDto) {
    this.validarVigencia(dto);
    await this.validarCategoria(auth, dto.categoriaEgresoId);
    await exigirProveedorActivoDelTenant(
      this.prisma,
      auth.tenantId,
      dto.proveedorId,
    );
    return this.prisma.$transaction(async (tx) => {
      await bloquearCupoUsuarios(tx, auth.tenantId);
      await this.obtenerOFallar(auth, id, tx);
      const row = await tx.gastoFijoEstructura.update({
        where: { id },
        data: this.datosDesdeDto(dto),
        include: INCLUDE_GASTO,
      });
      await this.sincronizarProgramacion(tx, auth, row, dto.programacion);
      return this.toResponse(
        await tx.gastoFijoEstructura.findUniqueOrThrow({
          where: { id },
          include: INCLUDE_GASTO,
        }),
      );
    });
  }

  async alternarActivo(auth: CurrentAuth, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await bloquearCupoUsuarios(tx, auth.tenantId);
      const actual = await this.obtenerOFallar(auth, id, tx);
      // Reactivar el presupuesto no reactiva compromisos de pago.
      if (actual.activo)
        await tx.gastoRecurrente.updateMany({
          where: { tenantId: auth.tenantId, gastoFijoEstructuraId: id },
          data: { activo: false },
        });
      const row = await tx.gastoFijoEstructura.update({
        where: { id },
        data: { activo: !actual.activo },
        include: INCLUDE_GASTO,
      });
      return this.toResponse(row);
    });
  }

  async eliminar(auth: CurrentAuth, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await bloquearCupoUsuarios(tx, auth.tenantId);
      const actual = await this.obtenerOFallar(auth, id, tx);
      if (
        actual.recurrentes.length ||
        (await tx.egreso.count({
          where: { tenantId: auth.tenantId, gastoFijoEstructuraId: id },
        }))
      )
        throw new ConflictException(
          'Este gasto tiene programación o egresos asociados. Desactivalo para conservar el historial.',
        );
      await tx.gastoFijoEstructura.delete({ where: { id } });
      return { id, eliminado: true };
    });
  }

  private async sincronizarProgramacion(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    gasto: GastoFijoRow,
    solicitud?: UpsertGastoFijoDto['programacion'],
  ) {
    const anteriores = gasto.recurrentes;
    if (!anteriores.length && !solicitud?.activa) return;
    // Incluso si hay vínculos antiguos duplicados, siempre se puede detener la emisión.
    if (!gasto.activo || solicitud?.activa === false) {
      await tx.gastoRecurrente.updateMany({
        where: { tenantId: auth.tenantId, gastoFijoEstructuraId: gasto.id },
        data: { activo: false },
      });
      return;
    }
    if (anteriores.length > 1)
      throw new ConflictException(
        'Hay varias programaciones vinculadas a este gasto. Revisalas en Programaciones anteriores antes de editarlo.',
      );
    const anterior = anteriores[0];
    const activa =
      (solicitud?.activa ?? anterior?.activo ?? false) && gasto.activo;
    // Un presupuesto sin programación activa sigue siendo independiente del plan de pagos.
    if (!activa) {
      if (anterior)
        await tx.gastoRecurrente.update({
          where: { id: anterior.id },
          data: { activo: false },
        });
      return;
    }
    if (!auth.permisos?.has('administracion.gestionar'))
      throw new ForbiddenException(
        'Necesitás permiso para gestionar pagos antes de activar o modificar su generación.',
      );
    await this.capacidades.exigirOperacionTx(
      tx,
      auth.tenantId,
      ['cuentas_pagar', 'gastos_recurrentes'],
      ['cuentas_pagar', 'gastos_recurrentes'],
    );
    const desde = solicitud?.desde ?? anterior.vigenteDesde;
    const dia = solicitud?.diaVencimiento ?? anterior.diaVencimiento;
    if (
      desde < gasto.vigenteDesde ||
      (gasto.vigenteHasta && desde > gasto.vigenteHasta)
    )
      throw new BadRequestException(
        'El inicio de la generación debe estar dentro de la vigencia del gasto.',
      );
    if (Number(gasto.valor) <= 0)
      throw new BadRequestException(
        'La generación necesita un importe por período mayor que cero.',
      );
    if (
      anterior?._count.egresos &&
      (desde !== anterior.vigenteDesde ||
        gasto.frecuencia.toLowerCase() !== anterior.frecuencia)
    )
      throw new ConflictException(
        'Esta programación ya emitió egresos: conservá su inicio y frecuencia. Para otro calendario, desactivá este gasto y creá uno nuevo.',
      );
    const { moneda } = await regionalDelTenant(tx, auth.tenantId);
    const data = {
      descripcion: gasto.nombre,
      categoriaEgresoId: gasto.categoriaEgresoId,
      proveedorId: gasto.proveedorId,
      metodoPagoId: gasto.metodoPagoId,
      monto: gasto.valor,
      moneda: moneda.codigo,
      frecuencia: gasto.frecuencia.toLowerCase(),
      vigenteDesde: desde,
      vigenteHasta: gasto.vigenteHasta,
      diaVencimiento: dia,
      activo: true,
    };
    if (anterior)
      await tx.gastoRecurrente.update({ where: { id: anterior.id }, data });
    else
      await tx.gastoRecurrente.create({
        data: {
          ...data,
          tenantId: auth.tenantId,
          gastoFijoEstructuraId: gasto.id,
        },
      });
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

  private async obtenerOFallar(
    auth: CurrentAuth,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<GastoFijoRow> {
    const row = await db.gastoFijoEstructura.findFirst({
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
      programacion: g.recurrentes?.length
        ? {
            activa: g.recurrentes.some((r) => r.activo),
            desde: g.recurrentes[0].vigenteDesde,
            diaVencimiento: g.recurrentes[0].diaVencimiento,
            ultimoPeriodoGenerado: g.recurrentes[0].ultimoPeriodoGenerado,
            egresosEmitidos: g.recurrentes.reduce(
              (s, r) => s + r._count.egresos,
              0,
            ),
            cantidad: g.recurrentes.length,
          }
        : null,
    };
  }
}
