import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriaGastoFijo, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { UpsertGastoFijoDto } from './dto/upsert-gasto-fijo.dto';
import { RemuneracionesService } from '../empleados/remuneraciones.service';

/**
 * Gastos fijos de estructura — fuente ÚNICA del pool de costos fijos del
 * PUNTO DE EQUILIBRIO, desacoplada de los centros de costo (que arman
 * tarifas). Modelo recurrente con vigencia mensual 'YYYY-MM'.
 * Ver docs/gastos-fijos-estructura-diseno.md
 */

type GastoFijoRow = Prisma.GastoFijoEstructuraGetPayload<object>;

/** Mapeo de categoría de componente de centro → categoría de gasto fijo. */
const CATEGORIA_DESDE_COMPONENTE: Record<string, CategoriaGastoFijo> = {
  SUELDOS: 'SUELDOS',
  CARGAS: 'SUELDOS',
  ALQUILER: 'ALQUILER',
  ENERGIA: 'SERVICIOS',
  MANTENIMIENTO: 'SERVICIOS',
  AMORTIZACION: 'AMORTIZACION',
  TERCERIZACION: 'OTROS',
  INSUMOS_INDIRECTOS: 'OTROS',
  OTROS: 'OTROS',
};

@Injectable()
export class GastosFijosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly remuneraciones: RemuneracionesService,
  ) {}

  async listar(auth: CurrentAuth) {
    const rows = await this.prisma.gastoFijoEstructura.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
    return rows.map((g) => this.toResponse(g));
  }

  async crear(auth: CurrentAuth, dto: UpsertGastoFijoDto) {
    this.validarVigencia(dto);
    const row = await this.prisma.gastoFijoEstructura.create({
      data: {
        tenantId: auth.tenantId,
        nombre: dto.nombre.trim(),
        categoria: dto.categoria,
        importeMensual: new Prisma.Decimal(dto.importeMensual),
        vigenteDesde: dto.vigenteDesde,
        vigenteHasta: dto.vigenteHasta ?? null,
        activo: dto.activo ?? true,
        notas: dto.notas?.trim() || null,
      },
    });
    return this.toResponse(row);
  }

  async actualizar(auth: CurrentAuth, id: string, dto: UpsertGastoFijoDto) {
    this.validarVigencia(dto);
    await this.obtenerOFallar(auth, id);
    const row = await this.prisma.gastoFijoEstructura.update({
      where: { id },
      data: {
        nombre: dto.nombre.trim(),
        categoria: dto.categoria,
        importeMensual: new Prisma.Decimal(dto.importeMensual),
        vigenteDesde: dto.vigenteDesde,
        vigenteHasta: dto.vigenteHasta ?? null,
        activo: dto.activo ?? true,
        notas: dto.notas?.trim() || null,
      },
    });
    return this.toResponse(row);
  }

  async alternarActivo(auth: CurrentAuth, id: string) {
    const actual = await this.obtenerOFallar(auth, id);
    const row = await this.prisma.gastoFijoEstructura.update({
      where: { id },
      data: { activo: !actual.activo },
    });
    return this.toResponse(row);
  }

  async eliminar(auth: CurrentAuth, id: string) {
    await this.obtenerOFallar(auth, id);
    await this.prisma.gastoFijoEstructura.delete({ where: { id } });
    return { id, eliminado: true };
  }

  /**
   * Seed de arranque: precarga la estructura fija completa desde lo que ya
   * está cargado (sueldos/otros en componentes de centro) más maquinaria,
   * activos fijos y gastos generales que hoy solo viven en las tarifas.
   * Guardado: solo corre si el tenant no tiene gastos fijos cargados aún.
   */
  async importarDesdeTarifas(auth: CurrentAuth) {
    const existentes = await this.prisma.gastoFijoEstructura.count({
      where: { tenantId: auth.tenantId },
    });
    if (existentes > 0) {
      return { importados: 0, total: 0, motivo: 'ya_existen_gastos' as const };
    }

    // Último período con componentes cargados (para vigenteDesde).
    const ultimoComp = await this.prisma.centroCostoComponenteCostoPeriodo.findFirst({
      where: { tenantId: auth.tenantId },
      orderBy: { periodo: 'desc' },
      select: { periodo: true },
    });
    const periodo = ultimoComp?.periodo ?? this.mesActual();

    const nuevos: Prisma.GastoFijoEstructuraCreateManyInput[] = [];

    // 1) Componentes de centro (sueldos, cargas, alquiler, etc.) del período.
    const componentes = await this.prisma.centroCostoComponenteCostoPeriodo.findMany({
      where: { tenantId: auth.tenantId, periodo },
      include: { centroCosto: { select: { nombre: true } } },
    });
    for (const c of componentes) {
      nuevos.push({
        tenantId: auth.tenantId,
        nombre: `${c.nombre} · ${c.centroCosto?.nombre ?? 'Centro'}`,
        categoria: CATEGORIA_DESDE_COMPONENTE[c.categoria] ?? 'OTROS',
        importeMensual: c.importeMensual,
        vigenteDesde: periodo,
        vigenteHasta: null,
        activo: true,
        notas: 'Importado desde componentes de centro de costo.',
      });
    }

    // 2) Maquinaria/activos/gastos generales, que solo viven en la tarifa.
    const tarifas = await this.prisma.centroCostoTarifaPeriodo.findMany({
      where: { tenantId: auth.tenantId, periodo, estado: 'PUBLICADA' },
      include: { centroCosto: { select: { nombre: true } } },
    });
    for (const t of tarifas) {
      const resumen = (t.resumenJson ?? {}) as Record<string, unknown>;
      const centro = t.centroCosto?.nombre ?? 'Centro';
      const partes: Array<[string, CategoriaGastoFijo, string]> = [
        ['costoMensualMaquinaria', 'AMORTIZACION', 'Maquinaria'],
        ['costoMensualActivosFijos', 'AMORTIZACION', 'Activos fijos'],
        ['costoMensualGastosGenerales', 'OTROS', 'Gastos generales'],
      ];
      for (const [clave, categoria, etiqueta] of partes) {
        const monto = Number(resumen[clave] ?? 0);
        if (monto > 0) {
          nuevos.push({
            tenantId: auth.tenantId,
            nombre: `${etiqueta} · ${centro}`,
            categoria,
            importeMensual: new Prisma.Decimal(monto),
            vigenteDesde: periodo,
            vigenteHasta: null,
            activo: true,
            notas: 'Importado desde la tarifa del centro.',
          });
        }
      }
    }

    if (nuevos.length === 0) {
      return { importados: 0, total: 0, motivo: 'sin_datos' as const };
    }

    await this.prisma.gastoFijoEstructura.createMany({ data: nuevos });
    const total = nuevos.reduce((acc, g) => acc + Number(g.importeMensual), 0);
    return { importados: nuevos.length, total: Math.round(total * 100) / 100 };
  }

  /**
   * Compara la línea de SUELDOS del punto de equilibrio contra la nómina real
   * de los legajos.
   *
   * Los dos módulos están desacoplados a propósito —responden preguntas
   * distintas— pero desacoplado no es lo mismo que sin conciliar: hasta acá
   * nadie podía decir si la diferencia entre lo que dice esta pantalla y lo que
   * cuesta la gente era una decisión o un número que quedó viejo. Esto NO
   * fuerza la igualdad: la muestra. Ver docs/legajos-nomina-diseno.md §4.3
   */
  async conciliacionNomina(auth: CurrentAuth, periodo?: string) {
    const mes = periodo ?? this.mesActual();
    const nomina = await this.remuneraciones.nominaDelPeriodo(
      auth.tenantId,
      mes,
    );

    const lineas = await this.prisma.gastoFijoEstructura.findMany({
      where: {
        tenantId: auth.tenantId,
        categoria: CategoriaGastoFijo.SUELDOS,
        activo: true,
        vigenteDesde: { lte: mes },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: mes } }],
      },
      orderBy: { nombre: 'asc' },
    });

    const declarado = lineas.reduce((n, l) => n + Number(l.importeMensual), 0);
    const diferencia = Math.round((declarado - nomina.costoMensual) * 100) / 100;

    return {
      periodo: mes,
      nomina,
      declarado: Math.round(declarado * 100) / 100,
      lineas: lineas.map((l) => this.toResponse(l)),
      diferencia,
      // Un peso de diferencia es redondeo, no una decisión. El umbral evita
      // que la pantalla grite por centavos.
      estado:
        nomina.personas === 0
          ? ('sin_nomina' as const)
          : Math.abs(diferencia) < 1
            ? ('alineado' as const)
            : diferencia > 0
              ? ('declarado_de_mas' as const)
              : ('declarado_de_menos' as const),
    };
  }

  /**
   * Reemplaza las líneas de SUELDOS por una sola con la nómina real.
   *
   * Las viejas se CIERRAN (vigenteHasta), no se borran: el punto de equilibrio
   * de los meses anteriores tiene que seguir dando lo que dio. Es la misma
   * regla de vigencia que usa el resto del módulo.
   */
  async alinearConNomina(auth: CurrentAuth, periodo?: string) {
    const mes = periodo ?? this.mesActual();
    const nomina = await this.remuneraciones.nominaDelPeriodo(
      auth.tenantId,
      mes,
    );
    if (nomina.personas === 0) {
      throw new BadRequestException(
        'No hay sueldos cargados en los legajos para ese mes: no hay con qué alinear.',
      );
    }

    const previo = this.mesAnterior(mes);

    await this.prisma.$transaction(async (tx) => {
      // Las que arrancaron ANTES se cierran el mes previo; las que arrancan en
      // este mes o después se desactivan, porque cerrarlas en un mes anterior
      // al que arrancan dejaría una vigencia imposible.
      await tx.gastoFijoEstructura.updateMany({
        where: {
          tenantId: auth.tenantId,
          categoria: CategoriaGastoFijo.SUELDOS,
          activo: true,
          vigenteDesde: { lt: mes },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: mes } }],
        },
        data: { vigenteHasta: previo },
      });
      await tx.gastoFijoEstructura.updateMany({
        where: {
          tenantId: auth.tenantId,
          categoria: CategoriaGastoFijo.SUELDOS,
          activo: true,
          vigenteDesde: { gte: mes },
        },
        data: { activo: false },
      });

      await tx.gastoFijoEstructura.create({
        data: {
          tenantId: auth.tenantId,
          nombre: `Nómina · ${nomina.personas} persona${nomina.personas === 1 ? '' : 's'}`,
          categoria: CategoriaGastoFijo.SUELDOS,
          importeMensual: new Prisma.Decimal(nomina.costoMensual),
          vigenteDesde: mes,
          vigenteHasta: null,
          activo: true,
          notas:
            'Sale de los legajos, con el aguinaldo prorrateado. Si cambia un ' +
            'sueldo, esta línea NO se actualiza sola: volvé a alinear.',
        },
      });
    });

    return this.conciliacionNomina(auth, mes);
  }

  /** 'YYYY-MM' → el mes anterior. */
  private mesAnterior(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);
    return mes === 1
      ? `${anio - 1}-12`
      : `${anio}-${String(mes - 1).padStart(2, '0')}`;
  }

  private async obtenerOFallar(auth: CurrentAuth, id: string): Promise<GastoFijoRow> {
    const row = await this.prisma.gastoFijoEstructura.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!row) throw new NotFoundException('Gasto fijo no encontrado.');
    return row;
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
      categoria: g.categoria,
      importeMensual: Number(g.importeMensual.toFixed(2)),
      vigenteDesde: g.vigenteDesde,
      vigenteHasta: g.vigenteHasta,
      activo: g.activo,
      notas: g.notas,
    };
  }
}
