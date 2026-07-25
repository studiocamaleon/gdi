import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { EmpleadoRemuneracion, Prisma } from '@prisma/client';

import { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertRemuneracionDto } from './dto/remuneracion.dto';
import { NominaCostosService } from './nomina-costos.service';

/**
 * La remuneración de cada persona, con vigencia.
 *
 * Fuente ÚNICA del costo laboral: antes el sueldo se re-tipeaba en cada centro
 * de costo donde la persona trabajaba y ya había divergido —la misma persona
 * con dos sueldos distintos en centros distintos—. Los centros ahora consumen
 * de acá. Ver docs/legajos-nomina-diseno.md
 */

export type RemuneracionCalculada = {
  id: string;
  empleadoId: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  sueldoNeto: number;
  cargasSociales: number;
  sueldosPorAnio: number;
  /** neto + cargas, sin prorratear el aguinaldo. Lo que se paga en un mes común. */
  costoMensualSinSac: number;
  /** La parte del aguinaldo que le toca a cada mes. Cero si son 12 sueldos. */
  provisionSacMensual: number;
  /** Lo que la persona cuesta por mes de verdad: (neto + cargas) × n / 12. */
  costoMensual: number;
  motivo: string | null;
  notas: string | null;
};

/** 'YYYY-MM' → el mes anterior. '2026-01' → '2025-12'. */
export function mesAnterior(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  return mes === 1
    ? `${anio - 1}-12`
    : `${anio}-${String(mes - 1).padStart(2, '0')}`;
}

@Injectable()
export class RemuneracionesService {
  constructor(
    private readonly prisma: PrismaService,
    /**
     * Se resuelve tarde a propósito: NominaCostosService depende de este
     * service, así que inyectarlo derecho sería una dependencia circular
     * dentro del módulo. `forwardRef` la corta.
     */
    @Inject(forwardRef(() => NominaCostosService))
    private readonly nominaCostos: NominaCostosService,
  ) {}

  /**
   * El costo mensual real de una persona.
   *
   * El aguinaldo se PRORRATEA en vez de imputarse en junio y diciembre: si no,
   * la tarifa hora subfactura once meses y sobrefactura dos, y el mismo trabajo
   * costaría distinto según el mes en que se produce. Con 13 sueldos el recargo
   * es del 8,33%, que es exactamente la provisión del SAC.
   */
  calcular(r: EmpleadoRemuneracion): RemuneracionCalculada {
    const neto = Number(r.sueldoNeto);
    const cargas = Number(r.cargasSociales);
    const base = neto + cargas;
    const costoMensual = (base * r.sueldosPorAnio) / 12;
    return {
      id: r.id,
      empleadoId: r.empleadoId,
      vigenteDesde: r.vigenteDesde,
      vigenteHasta: r.vigenteHasta,
      sueldoNeto: neto,
      cargasSociales: cargas,
      sueldosPorAnio: r.sueldosPorAnio,
      costoMensualSinSac: redondear(base),
      provisionSacMensual: redondear(costoMensual - base),
      costoMensual: redondear(costoMensual),
      motivo: r.motivo,
      notas: r.notas,
    };
  }

  /** El historial completo, de la más nueva a la más vieja. */
  async listar(
    auth: CurrentAuth,
    empleadoId: string,
  ): Promise<RemuneracionCalculada[]> {
    await this.exigirEmpleado(auth, empleadoId);
    const filas = await this.prisma.empleadoRemuneracion.findMany({
      where: { tenantId: auth.tenantId, empleadoId },
      orderBy: { vigenteDesde: 'desc' },
    });
    return filas.map((f) => this.calcular(f));
  }

  /**
   * La que rige en un mes dado. Es lo que consumen los centros de costo.
   *
   * Una fila rige si empezó en ese mes o antes y no se cerró antes de él. Se
   * ordena descendente y se toma la primera: si hubiera solapamiento por una
   * carga a mano, gana la más reciente en vez de tirar un error en medio de un
   * cálculo de tarifas.
   */
  async vigenteEn(
    tenantId: string,
    empleadoId: string,
    periodo: string,
  ): Promise<EmpleadoRemuneracion | null> {
    return this.prisma.empleadoRemuneracion.findFirst({
      where: {
        tenantId,
        empleadoId,
        vigenteDesde: { lte: periodo },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: periodo } }],
      },
      orderBy: { vigenteDesde: 'desc' },
    });
  }

  /** Las vigentes en un mes, por empleado. Para costear un período entero. */
  async vigentesEn(
    tenantId: string,
    periodo: string,
  ): Promise<Map<string, EmpleadoRemuneracion>> {
    const filas = await this.prisma.empleadoRemuneracion.findMany({
      where: {
        tenantId,
        vigenteDesde: { lte: periodo },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: periodo } }],
      },
      orderBy: { vigenteDesde: 'asc' },
    });
    // Ascendente + sobrescritura = gana la más reciente, igual que vigenteEn().
    const porEmpleado = new Map<string, EmpleadoRemuneracion>();
    for (const f of filas) porEmpleado.set(f.empleadoId, f);
    return porEmpleado;
  }

  /**
   * Lo que cuesta la nómina entera en un mes. Es lo que Gastos fijos puede
   * traer en vez de que alguien tipee un número a ojo.
   */
  async nominaDelPeriodo(tenantId: string, periodo: string) {
    const vigentes = await this.vigentesEn(tenantId, periodo);
    let neto = 0;
    let cargas = 0;
    let costoMensual = 0;
    for (const r of vigentes.values()) {
      const c = this.calcular(r);
      neto += c.sueldoNeto;
      cargas += c.cargasSociales;
      costoMensual += c.costoMensual;
    }
    return {
      periodo,
      personas: vigentes.size,
      sueldoNeto: redondear(neto),
      cargasSociales: redondear(cargas),
      /** Incluye la provisión del aguinaldo. Es el costo real del mes. */
      costoMensual: redondear(costoMensual),
    };
  }

  /**
   * Carga un cambio de sueldo y CIERRA la vigencia anterior.
   *
   * Cerrarla sola es lo que evita el solapamiento: quien carga un aumento
   * piensa "desde julio gana esto", no "y además andá a cerrar la fila vieja".
   */
  async crear(
    auth: CurrentAuth,
    empleadoId: string,
    dto: UpsertRemuneracionDto,
  ): Promise<RemuneracionCalculada> {
    await this.exigirEmpleado(auth, empleadoId);
    this.validarRango(dto);

    const yaHay = await this.prisma.empleadoRemuneracion.findFirst({
      where: {
        tenantId: auth.tenantId,
        empleadoId,
        vigenteDesde: dto.vigenteDesde,
      },
    });
    if (yaHay) {
      throw new BadRequestException(
        `Ya hay una remuneración que arranca en ${dto.vigenteDesde}. Editá esa en vez de agregar otra.`,
      );
    }

    const creada = await this.prisma.$transaction(async (tx) => {
      // Toda fila abierta que arrancó antes se cierra el mes previo al nuevo.
      await tx.empleadoRemuneracion.updateMany({
        where: {
          tenantId: auth.tenantId,
          empleadoId,
          vigenteHasta: null,
          vigenteDesde: { lt: dto.vigenteDesde },
        },
        data: { vigenteHasta: mesAnterior(dto.vigenteDesde) },
      });

      return tx.empleadoRemuneracion.create({
        data: {
          tenantId: auth.tenantId,
          empleadoId,
          vigenteDesde: dto.vigenteDesde,
          vigenteHasta: dto.vigenteHasta ?? null,
          sueldoNeto: new Prisma.Decimal(dto.sueldoNeto),
          cargasSociales: new Prisma.Decimal(dto.cargasSociales),
          sueldosPorAnio: dto.sueldosPorAnio ?? 13,
          motivo: dto.motivo ?? null,
          notas: dto.notas ?? null,
        },
      });
    });

    // Los centros donde trabaje quedan con el sueldo viejo hasta que esto
    // corra. No se espera dentro de la transacción: recalcular tarifas no puede
    // hacer fallar el registro de un aumento.
    await this.nominaCostos.sincronizarEmpleado(auth.tenantId, empleadoId);

    return this.calcular(creada);
  }

  async actualizar(
    auth: CurrentAuth,
    empleadoId: string,
    id: string,
    dto: UpsertRemuneracionDto,
  ): Promise<RemuneracionCalculada> {
    await this.exigirEmpleado(auth, empleadoId);
    this.validarRango(dto);
    const actual = await this.exigirRemuneracion(auth, empleadoId, id);

    const actualizada = await this.prisma.empleadoRemuneracion.update({
      where: { id: actual.id },
      data: {
        vigenteDesde: dto.vigenteDesde,
        vigenteHasta: dto.vigenteHasta ?? null,
        sueldoNeto: new Prisma.Decimal(dto.sueldoNeto),
        cargasSociales: new Prisma.Decimal(dto.cargasSociales),
        sueldosPorAnio: dto.sueldosPorAnio ?? 13,
        motivo: dto.motivo ?? null,
        notas: dto.notas ?? null,
      },
    });
    await this.nominaCostos.sincronizarEmpleado(auth.tenantId, empleadoId);
    return this.calcular(actualizada);
  }

  /**
   * Borra una remuneración y REABRE la anterior si la borrada era la última.
   * Si no, el historial queda con un agujero y los meses posteriores se quedan
   * sin sueldo vigente sin que nadie lo pida.
   */
  async eliminar(
    auth: CurrentAuth,
    empleadoId: string,
    id: string,
  ): Promise<void> {
    await this.exigirEmpleado(auth, empleadoId);
    const actual = await this.exigirRemuneracion(auth, empleadoId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.empleadoRemuneracion.delete({ where: { id: actual.id } });

      if (actual.vigenteHasta !== null) return;
      const previa = await tx.empleadoRemuneracion.findFirst({
        where: {
          tenantId: auth.tenantId,
          empleadoId,
          vigenteDesde: { lt: actual.vigenteDesde },
        },
        orderBy: { vigenteDesde: 'desc' },
      });
      if (previa) {
        await tx.empleadoRemuneracion.update({
          where: { id: previa.id },
          data: { vigenteHasta: null },
        });
      }
    });

    await this.nominaCostos.sincronizarEmpleado(auth.tenantId, empleadoId);
  }

  private validarRango(dto: UpsertRemuneracionDto): void {
    if (dto.vigenteHasta && dto.vigenteHasta < dto.vigenteDesde) {
      throw new BadRequestException(
        'El último mes de vigencia no puede ser anterior al primero.',
      );
    }
    if (Number(dto.sueldoNeto) < 0 || Number(dto.cargasSociales) < 0) {
      throw new BadRequestException('El sueldo y las cargas no pueden ser negativos.');
    }
  }

  private async exigirEmpleado(
    auth: CurrentAuth,
    empleadoId: string,
  ): Promise<void> {
    const existe = await this.prisma.empleado.findFirst({
      where: { id: empleadoId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!existe) {
      throw new NotFoundException('No encontré ese legajo.');
    }
  }

  private async exigirRemuneracion(
    auth: CurrentAuth,
    empleadoId: string,
    id: string,
  ): Promise<EmpleadoRemuneracion> {
    const fila = await this.prisma.empleadoRemuneracion.findFirst({
      where: { id, empleadoId, tenantId: auth.tenantId },
    });
    if (!fila) {
      throw new NotFoundException('No encontré esa remuneración.');
    }
    return fila;
  }
}

/** Dos decimales. La plata no se muestra con catorce. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
