import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { regionalDelTenant } from '../common/regional';
import type {
  CrearRecurrenteDto,
  EditarRecurrenteDto,
} from './dto/recurrente.dto';
import { exigirProveedorActivoDelTenant } from '../proveedores/proveedor-validacion';

const r2 = (n: number) => Math.round(n * 100) / 100;
const dec = (v: Prisma.Decimal | null | undefined) => (v ? Number(v) : 0);

/** Meses que avanza cada frecuencia. */
export const MESES_POR_FRECUENCIA: Record<string, number> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** 'YYYY-MM' → índice absoluto de mes, para poder restar períodos. */
function indiceMes(periodo: string): number {
  const [y, m] = periodo.split('-').map(Number);
  return y * 12 + (m - 1);
}

function periodoDeIndice(indice: number): string {
  const y = Math.floor(indice / 12);
  const m = (indice % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Fecha de vencimiento del período, con CLAMP a fin de mes.
 *
 * Un vencimiento el 31 en febrero cae el 28 y no se saltea el mes ni se
 * desborda al 3 de marzo, que es lo que hace `new Date(y, m, 31)` solo.
 */
export function vencimientoDe(periodo: string, dia: number): Date {
  const [y, m] = periodo.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, Math.min(dia, ultimoDia)));
}

/**
 * Qué períodos le corresponde emitir a una plantilla hasta `hastaPeriodo`.
 *
 * Devuelve TODOS los pendientes y no sólo el actual: si el cron no corrió por
 * unos días —o el tenant estuvo dormido— los meses que faltan se emiten
 * igual. Un alquiler que no aparece porque el servidor estuvo caído no es un
 * alquiler que no haya que pagar.
 */
export function periodosPendientes(
  plantilla: {
    frecuencia: string;
    vigenteDesde: string;
    vigenteHasta: string | null;
    ultimoPeriodoGenerado: string | null;
  },
  hastaPeriodo: string,
): string[] {
  const paso = MESES_POR_FRECUENCIA[plantilla.frecuencia] ?? 1;
  const desde = indiceMes(plantilla.vigenteDesde);
  const hasta = Math.min(
    indiceMes(hastaPeriodo),
    plantilla.vigenteHasta ? indiceMes(plantilla.vigenteHasta) : Infinity,
  );
  const ultimo = plantilla.ultimoPeriodoGenerado
    ? indiceMes(plantilla.ultimoPeriodoGenerado)
    : null;

  const salida: string[] = [];
  for (let i = desde; i <= hasta; i += paso) {
    if (ultimo !== null && i <= ultimo) continue;
    salida.push(periodoDeIndice(i));
  }
  return salida;
}

@Injectable()
export class RecurrentesService {
  private readonly log = new Logger(RecurrentesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── ABM ────────────────────────────────────────────────────────────────

  async listar(auth: CurrentAuth) {
    const filas = await this.prisma.gastoRecurrente.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ activo: 'desc' }, { descripcion: 'asc' }],
      include: {
        categoria: { select: { nombre: true, naturaleza: true } },
        proveedor: { select: { nombre: true } },
        gastoFijo: { select: { nombre: true, importeMensual: true } },
        _count: { select: { egresos: true } },
      },
    });
    return {
      recurrentes: filas.map((r) => ({
        id: r.id,
        descripcion: r.descripcion,
        categoriaEgresoId: r.categoriaEgresoId,
        categoriaNombre: r.categoria.nombre,
        naturaleza: r.categoria.naturaleza,
        proveedorId: r.proveedorId,
        proveedorNombre: r.proveedor?.nombre ?? null,
        monto: dec(r.monto),
        moneda: r.moneda,
        frecuencia: r.frecuencia,
        diaVencimiento: r.diaVencimiento,
        vigenteDesde: r.vigenteDesde,
        vigenteHasta: r.vigenteHasta,
        gastoFijoEstructuraId: r.gastoFijoEstructuraId,
        gastoFijoNombre: r.gastoFijo?.nombre ?? null,
        activo: r.activo,
        ultimoPeriodoGenerado: r.ultimoPeriodoGenerado,
        egresosEmitidos: r._count.egresos,
      })),
    };
  }

  async crear(auth: CurrentAuth, dto: CrearRecurrenteDto) {
    const cat = await this.prisma.categoriaEgreso.findFirst({
      where: { id: dto.categoriaEgresoId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!cat) throw new NotFoundException('Esa categoría no existe.');
    if (dto.vigenteHasta && dto.vigenteHasta < dto.vigenteDesde) {
      throw new BadRequestException(
        'El período final no puede ser anterior al inicial.',
      );
    }
    await exigirProveedorActivoDelTenant(
      this.prisma,
      auth.tenantId,
      dto.proveedorId,
    );
    await this.validarGastoFijoDelTenant(
      auth,
      dto.gastoFijoEstructuraId,
    );
    return this.prisma.gastoRecurrente.create({
      data: {
        tenantId: auth.tenantId,
        descripcion: dto.descripcion.trim(),
        categoriaEgresoId: dto.categoriaEgresoId,
        proveedorId: dto.proveedorId ?? null,
        monto: r2(dto.monto),
        moneda: dto.moneda ?? 'ARS',
        metodoPagoId: dto.metodoPagoId ?? null,
        frecuencia: dto.frecuencia ?? 'mensual',
        diaVencimiento: dto.diaVencimiento ?? 10,
        vigenteDesde: dto.vigenteDesde,
        vigenteHasta: dto.vigenteHasta ?? null,
        gastoFijoEstructuraId: dto.gastoFijoEstructuraId ?? null,
      },
    });
  }

  async editar(auth: CurrentAuth, id: string, dto: EditarRecurrenteDto) {
    const actual = await this.prisma.gastoRecurrente.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true, gastoFijoEstructuraId: true },
    });
    if (!actual) throw new NotFoundException('No encontramos esa plantilla.');

    await this.validarGastoFijoDelTenant(
      auth,
      dto.gastoFijoEstructuraId,
    );

    // Vincular la plantilla al presupuestado alcanza a los egresos YA
    // emitidos: si no, quien descubre el reporte después de meses de uso lo
    // ve vacío para toda su historia, que es justo cuando más sirve.
    //
    // Sólo los que no tienen imputación: uno que alguien apuntó a mano a otro
    // gasto fijo se respeta.
    if (
      dto.gastoFijoEstructuraId !== undefined &&
      dto.gastoFijoEstructuraId !== actual.gastoFijoEstructuraId
    ) {
      await this.prisma.egreso.updateMany({
        where: {
          tenantId: auth.tenantId,
          gastoRecurrenteId: id,
          gastoFijoEstructuraId: null,
        },
        data: { gastoFijoEstructuraId: dto.gastoFijoEstructuraId },
      });
    }

    return this.prisma.gastoRecurrente.update({
      where: { id },
      data: {
        ...(dto.descripcion !== undefined
          ? { descripcion: dto.descripcion.trim() }
          : {}),
        ...(dto.monto !== undefined ? { monto: r2(dto.monto) } : {}),
        ...(dto.diaVencimiento !== undefined
          ? { diaVencimiento: dto.diaVencimiento }
          : {}),
        ...(dto.vigenteHasta !== undefined
          ? { vigenteHasta: dto.vigenteHasta }
          : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.gastoFijoEstructuraId !== undefined
          ? { gastoFijoEstructuraId: dto.gastoFijoEstructuraId }
          : {}),
      },
    });
  }

  /**
   * El id llega como escalar porque Prisma no puede expresar una relación
   * compuesta por tenant. Sin esta guarda, un UUID conocido de otra empresa
   * podría quedar vinculado y contaminar el análisis presupuestado vs. real.
   */
  private async validarGastoFijoDelTenant(
    auth: CurrentAuth,
    gastoFijoId: string | null | undefined,
  ): Promise<void> {
    if (gastoFijoId === undefined || gastoFijoId === null) return;
    const gasto = await this.prisma.gastoFijoEstructura.findFirst({
      where: { id: gastoFijoId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!gasto) {
      throw new NotFoundException('Ese gasto fijo no existe en esta empresa.');
    }
  }

  /**
   * Se desactiva, no se borra, si ya emitió egresos: esos egresos son plata
   * real y quedarían sin explicación de dónde salieron.
   */
  async borrar(auth: CurrentAuth, id: string) {
    const r = await this.prisma.gastoRecurrente.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true, _count: { select: { egresos: true } } },
    });
    if (!r) throw new NotFoundException('No encontramos esa plantilla.');
    if (r._count.egresos > 0) {
      await this.prisma.gastoRecurrente.update({
        where: { id },
        data: { activo: false },
      });
      return { ok: true, desactivada: true };
    }
    await this.prisma.gastoRecurrente.delete({ where: { id } });
    return { ok: true, desactivada: false };
  }

  // ── Generación ─────────────────────────────────────────────────────────

  /**
   * Emite los egresos pendientes de un tenant. Idempotente por partida doble:
   * el `ultimoPeriodoGenerado` de la plantilla evita el trabajo, y el único
   * `(gastoRecurrenteId, periodoRecurrente)` evita el duplicado de verdad si
   * dos procesos corren a la vez.
   */
  async generarDeTenant(tenantId: string): Promise<number> {
    const { zonaHoraria } = await regionalDelTenant(this.prisma, tenantId);
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const periodoActual = hoy.slice(0, 7);

    const plantillas = await this.prisma.gastoRecurrente.findMany({
      where: { tenantId, activo: true },
      include: { proveedor: { select: { nombre: true } } },
    });

    let emitidos = 0;
    for (const p of plantillas) {
      const periodos = periodosPendientes(p, periodoActual);
      for (const periodo of periodos) {
        const creado = await this.emitirPeriodo(tenantId, p, periodo);
        if (creado) emitidos += 1;
      }
    }
    return emitidos;
  }

  private async emitirPeriodo(
    tenantId: string,
    plantilla: {
      id: string;
      descripcion: string;
      categoriaEgresoId: string;
      proveedorId: string | null;
      proveedor: { nombre: string } | null;
      monto: Prisma.Decimal;
      moneda: string;
      diaVencimiento: number;
      gastoFijoEstructuraId: string | null;
    },
    periodo: string,
  ): Promise<boolean> {
    const monto = dec(plantilla.monto);
    const vencimiento = vencimientoDe(periodo, plantilla.diaVencimiento);
    // La competencia es el PRIMERO del período, no el día del vencimiento: el
    // alquiler de agosto es gasto de agosto aunque venza el 10.
    const competencia = new Date(`${periodo}-01T00:00:00.000Z`);
    try {
      await this.prisma.$transaction(async (tx) => {
        const anio = competencia.getUTCFullYear();
        const c = await tx.egresoContador.upsert({
          where: { tenantId_anio: { tenantId, anio } },
          create: { tenantId, anio, ultimo: 1 },
          update: { ultimo: { increment: 1 } },
        });
        await tx.egreso.create({
          data: {
            tenantId,
            numero: `EGR-${anio}-${String(c.ultimo).padStart(4, '0')}`,
            descripcion: `${plantilla.descripcion} ${periodo}`,
            categoriaEgresoId: plantilla.categoriaEgresoId,
            proveedorId: plantilla.proveedorId,
            beneficiarioNombre:
              plantilla.proveedor?.nombre ?? plantilla.descripcion,
            fechaCompetencia: competencia,
            fechaVencimiento: vencimiento,
            moneda: plantilla.moneda,
            neto: monto,
            iva: 0,
            otrosImpuestos: 0,
            total: monto,
            estado: 'pendiente',
            origen: 'recurrente',
            gastoFijoEstructuraId: plantilla.gastoFijoEstructuraId,
            gastoRecurrenteId: plantilla.id,
            periodoRecurrente: periodo,
            registradoPorNombre: 'Sistema (gasto recurrente)',
          },
        });
        await tx.gastoRecurrente.update({
          where: { id: plantilla.id },
          data: { ultimoPeriodoGenerado: periodo },
        });
      });
      return true;
    } catch (e) {
      // El único es la red de seguridad: si otro proceso ya lo emitió, esto
      // no es un error, es la idempotencia funcionando.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        await this.prisma.gastoRecurrente.update({
          where: { id: plantilla.id },
          data: { ultimoPeriodoGenerado: periodo },
        });
        return false;
      }
      throw e;
    }
  }

  /** Generación a mano desde la UI, para no esperar al cron. */
  async generarAhora(auth: CurrentAuth) {
    const emitidos = await this.generarDeTenant(auth.tenantId);
    return { emitidos };
  }

  // ── Presupuestado vs. real (journey E4) ───────────────────────────────

  /**
   * Lo que la estructura DEBERÍA costar contra lo que realmente se pagó.
   *
   * El presupuestado sale de `GastoFijoEstructura`, que es lo que el motor usa
   * para el punto de equilibrio; el real sale de los egresos registrados en
   * el período, aunque sigan pendientes de pago. Son
   * dos números distintos y ninguno reemplaza al otro: es el mismo patrón
   * "cotizado vs. real" que ya usamos en las órdenes, aplicado a la estructura.
   *
   * Sólo compara los gastos fijos que tienen un recurrente o egresos
   * apuntándoles: comparar contra cero un gasto que nadie registró todavía
   * mostraría un ahorro que no existe.
   */
  async presupuestadoVsReal(auth: CurrentAuth, periodo?: string) {
    const { zonaHoraria } = await regionalDelTenant(this.prisma, auth.tenantId);
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const per = periodo ?? hoy.slice(0, 7);
    const desde = new Date(`${per}-01T00:00:00.000Z`);
    const hasta = new Date(desde);
    hasta.setUTCMonth(hasta.getUTCMonth() + 1);

    const [fijos, egresos] = await Promise.all([
      this.prisma.gastoFijoEstructura.findMany({
        where: {
          tenantId: auth.tenantId,
          activo: true,
          vigenteDesde: { lte: per },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: per } }],
        },
        select: { id: true, nombre: true, categoria: true, importeMensual: true },
      }),
      this.prisma.egreso.findMany({
        where: {
          tenantId: auth.tenantId,
          estado: { not: 'anulado' },
          gastoFijoEstructuraId: { not: null },
          fechaCompetencia: { gte: desde, lt: hasta },
        },
        select: { gastoFijoEstructuraId: true, total: true },
      }),
    ]);

    const realPorFijo = new Map<string, number>();
    for (const e of egresos) {
      const k = e.gastoFijoEstructuraId!;
      realPorFijo.set(k, (realPorFijo.get(k) ?? 0) + dec(e.total));
    }

    const lineas = fijos
      .map((f) => {
        const presupuestado = dec(f.importeMensual);
        const real = realPorFijo.get(f.id) ?? 0;
        return {
          gastoFijoId: f.id,
          nombre: f.nombre,
          categoria: f.categoria,
          presupuestado: r2(presupuestado),
          real: r2(real),
          desvio: r2(real - presupuestado),
          desvioPct:
            presupuestado > 0
              ? r2(((real - presupuestado) / presupuestado) * 100)
              : null,
          /** Sin egresos todavía: el desvío no significa nada. */
          sinRegistrar: real === 0,
        };
      })
      .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));

    const conRegistro = lineas.filter((l) => !l.sinRegistrar);
    const presupuestado = r2(
      conRegistro.reduce((acc, l) => acc + l.presupuestado, 0),
    );
    const real = r2(conRegistro.reduce((acc, l) => acc + l.real, 0));

    return {
      periodo: per,
      lineas,
      /** Totales SÓLO de lo que tiene registro: comparar peras con peras. */
      presupuestado,
      real,
      desvio: r2(real - presupuestado),
      desvioPct:
        presupuestado > 0
          ? r2(((real - presupuestado) / presupuestado) * 100)
          : null,
      sinRegistrar: lineas.length - conRegistro.length,
    };
  }
}
