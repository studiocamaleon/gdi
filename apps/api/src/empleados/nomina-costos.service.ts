import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
  CategoriaComponenteCostoCentro,
  OrigenComponenteCostoCentro,
  Prisma,
  TipoRecursoCentroCosto,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RemuneracionesService } from './remuneraciones.service';

/**
 * El puente entre el legajo y los centros de costo.
 *
 * Los componentes de SUELDOS y CARGAS de cada centro son DERIVADOS: salen de
 * cruzar el porcentaje de dedicación (que declara el centro) con la
 * remuneración vigente (que declara el legajo). Nadie los tipea.
 *
 * Antes los escribía el navegador con el sueldo que la persona acababa de
 * cargar ahí mismo, y por eso el mismo sueldo terminaba distinto en centros
 * distintos. Ahora hay un solo lugar donde vive el número y dos momentos en que
 * esto se vuelve a calcular: cuando cambia la dedicación (lo dispara Costos) y
 * cuando cambia el sueldo (lo dispara el legajo).
 *
 * Vive en Empleados y no en Costos para no armar un ciclo de módulos: Costos
 * importa Empleados, no al revés. Ver docs/legajos-nomina-diseno.md
 */

/** Lo que se usa dentro de una transacción de Prisma. */
type Tx = Prisma.TransactionClient;

export type ResultadoSincronizacion = {
  /** Cuántos componentes quedaron escritos. */
  componentes: number;
  /** Personas asignadas al centro que todavía no tienen sueldo en el legajo. */
  sinRemuneracion: Array<{ empleadoId: string; nombre: string }>;
};

@Injectable()
export class NominaCostosService {
  private readonly logger = new Logger(NominaCostosService.name);

  constructor(
    private readonly prisma: PrismaService,
    /**
     * La relación con RemuneracionesService es de ida y vuelta a propósito:
     * acá se lee el sueldo vigente, y allá se dispara esta sincronización
     * cuando el sueldo cambia. Los dos `forwardRef` cortan el ciclo.
     */
    @Inject(forwardRef(() => RemuneracionesService))
    private readonly remuneraciones: RemuneracionesService,
  ) {}

  /**
   * Rehace los componentes de sueldo de un centro en un período.
   *
   * Sólo toca los que tienen `empleadoId`: un componente de SUELDOS cargado a
   * mano y sin persona detrás (una changa, un reemplazo puntual) es una
   * decisión de quien lo puso y no le corresponde a este método borrarla.
   */
  async sincronizarCentroPeriodo(
    tenantId: string,
    centroCostoId: string,
    periodo: string,
    tx?: Tx,
  ): Promise<ResultadoSincronizacion> {
    const db = tx ?? this.prisma;

    const recursos = await db.centroCostoRecurso.findMany({
      where: {
        tenantId,
        centroCostoId,
        periodo,
        tipoRecurso: TipoRecursoCentroCosto.EMPLEADO,
        activo: true,
        empleadoId: { not: null },
      },
      include: { empleado: { select: { id: true, nombreCompleto: true } } },
    });

    await db.centroCostoComponenteCostoPeriodo.deleteMany({
      where: {
        tenantId,
        centroCostoId,
        periodo,
        empleadoId: { not: null },
        categoria: {
          in: [
            CategoriaComponenteCostoCentro.SUELDOS,
            CategoriaComponenteCostoCentro.CARGAS,
          ],
        },
      },
    });

    const sinRemuneracion: ResultadoSincronizacion['sinRemuneracion'] = [];
    let componentes = 0;

    for (const recurso of recursos) {
      const empleado = recurso.empleado;
      if (!empleado) continue;

      const vigente = await this.remuneraciones.vigenteEn(
        tenantId,
        empleado.id,
        periodo,
      );
      if (!vigente) {
        sinRemuneracion.push({
          empleadoId: empleado.id,
          nombre: empleado.nombreCompleto,
        });
        continue;
      }

      const calc = this.remuneraciones.calcular(vigente);
      const fraccion = Number(recurso.porcentajeAsignacion ?? 0) / 100;
      if (fraccion <= 0) continue;

      // El aguinaldo se prorratea sobre las dos partes por igual, así la suma
      // sigue dando el costo mensual real de la persona por su dedicación.
      const factorSac = vigente.sueldosPorAnio / 12;
      const sueldos = calc.sueldoNeto * factorSac * fraccion;
      const cargas = calc.cargasSociales * factorSac * fraccion;

      const detalle = {
        kind: 'empleado',
        // `sourceKey` es lo que el configurador usa para reconocer que este
        // componente es DERIVADO y no uno cargado a mano. Sin él la pantalla lo
        // trata como manual: lo muestra en la lista de "otros costos" y lo
        // vuelve a mandar al guardar. Ver getDerivedComponentKey().
        sourceKey: empleado.id,
        origen: 'legajo',
        empleadoId: empleado.id,
        empleadoNombre: empleado.nombreCompleto,
        remuneracionId: vigente.id,
        sueldoNeto: calc.sueldoNeto,
        cargasSociales: calc.cargasSociales,
        sueldosPorAnio: vigente.sueldosPorAnio,
        porcentajeAsignacion: Number(recurso.porcentajeAsignacion ?? 0),
      };

      const nota =
        vigente.sueldosPorAnio === 12
          ? 'Sale del legajo. Sin aguinaldo.'
          : `Sale del legajo, con el aguinaldo prorrateado (${vigente.sueldosPorAnio} sueldos al año).`;

      await db.centroCostoComponenteCostoPeriodo.createMany({
        data: [
          {
            tenantId,
            centroCostoId,
            periodo,
            categoria: CategoriaComponenteCostoCentro.SUELDOS,
            // No dice "Sueldo neto" a propósito: el importe incluye la parte
            // del aguinaldo, así que llamarlo neto sería mentir.
            nombre: `Sueldo · ${empleado.nombreCompleto}`,
            origen: OrigenComponenteCostoCentro.SUGERIDO,
            importeMensual: new Prisma.Decimal(sueldos.toFixed(2)),
            empleadoId: empleado.id,
            notas: nota,
            detalleJson: { ...detalle, part: 'sueldos' },
          },
          {
            tenantId,
            centroCostoId,
            periodo,
            categoria: CategoriaComponenteCostoCentro.CARGAS,
            nombre: `Cargas sociales · ${empleado.nombreCompleto}`,
            origen: OrigenComponenteCostoCentro.SUGERIDO,
            importeMensual: new Prisma.Decimal(cargas.toFixed(2)),
            empleadoId: empleado.id,
            notas: nota,
            detalleJson: { ...detalle, part: 'cargas' },
          },
        ],
      });
      componentes += 2;
    }

    return { componentes, sinRemuneracion };
  }

  /**
   * Un sueldo cambió: rehace los centros donde esa persona esté asignada.
   *
   * Sin esto, cargar un aumento dejaría las tarifas de todos sus centros
   * calculadas con el sueldo viejo, en silencio — que es exactamente el tipo de
   * dato desactualizado que este módulo vino a eliminar.
   *
   * Corre FUERA de la transacción del guardado del sueldo y sin tumbarlo si
   * falla: que una tarifa quede pendiente de recalcular es molesto; que no se
   * pueda registrar un aumento porque un centro está roto, es peor.
   */
  async sincronizarEmpleado(
    tenantId: string,
    empleadoId: string,
  ): Promise<void> {
    try {
      const asignaciones = await this.prisma.centroCostoRecurso.findMany({
        where: {
          tenantId,
          empleadoId,
          tipoRecurso: TipoRecursoCentroCosto.EMPLEADO,
          activo: true,
        },
        select: { centroCostoId: true, periodo: true },
        distinct: ['centroCostoId', 'periodo'],
      });

      for (const a of asignaciones) {
        await this.sincronizarCentroPeriodo(
          tenantId,
          a.centroCostoId,
          a.periodo,
        );
      }
    } catch (error) {
      this.logger.error(
        `No se pudieron recalcular los centros del empleado ${empleadoId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
