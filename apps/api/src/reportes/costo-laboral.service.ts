import { Injectable } from '@nestjs/common';
import {
  CategoriaComponenteCostoCentro,
  TipoRecursoCentroCosto,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RemuneracionesService } from '../empleados/remuneraciones.service';

/**
 * Qué cuesta cada persona y a dónde va ese costo.
 *
 * Es lo que habilitó mudar la nómina al legajo: antes el sueldo de una persona
 * estaba repartido en filas de varios centros, con su nombre metido en un
 * texto, así que "¿cuánto me cuesta Iván?" no se podía responder sin parsear
 * strings. Ver docs/legajos-nomina-diseno.md
 *
 * NO atribuye margen ni producción a las personas. El margen es del TRABAJO —
 * depende del precio que se puso y del material— y el costo de la persona es un
 * insumo suyo. Rankear operarios por resultado es la práctica que el módulo de
 * Equipo descartó a propósito.
 */

export type PersonaCostoLaboral = {
  empleadoId: string;
  nombre: string;
  sector: string;
  sueldoNeto: number;
  cargasSociales: number;
  sueldosPorAnio: number;
  /** Con el aguinaldo prorrateado: lo que cuesta el mes de verdad. */
  costoMensual: number;
  /** Suma de su dedicación en todos los centros. 100 = está entero asignado. */
  dedicacionPct: number;
  /** Horas al mes que aporta, según la capacidad de los centros donde está. */
  horasMes: number;
  /** costoMensual / horasMes. `null` si no tiene horas asignadas. */
  costoHora: number | null;
  /** Lo que efectivamente se imputó a centros (sueldos + cargas derivados). */
  imputado: number;
  /** costoMensual − imputado: la parte que no entra en ninguna tarifa. */
  sinImputar: number;
  centros: Array<{
    codigo: string;
    nombre: string;
    dedicacionPct: number;
    horasMes: number;
    imputado: number;
  }>;
};

@Injectable()
export class CostoLaboralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly remuneraciones: RemuneracionesService,
  ) {}

  limites(): string[] {
    return [
      'El costo por hora sale de dividir el sueldo del legajo por las horas que la persona aporta según la capacidad de sus centros: es un costo de disponibilidad, no de trabajo efectivamente cronometrado.',
      'La parte "sin imputar" es sueldo que no entra en ninguna tarifa, así que ningún precio la está cubriendo.',
      'No se atribuye producción ni margen por persona: el margen es del trabajo, no de quien lo ejecuta.',
    ];
  }

  async porPersona(tenantId: string, periodo: string) {
    const [remuneraciones, recursos, capacidades, componentes, empleados] =
      await Promise.all([
        this.remuneraciones.vigentesEn(tenantId, periodo),
        this.prisma.centroCostoRecurso.findMany({
          where: {
            tenantId,
            periodo,
            tipoRecurso: TipoRecursoCentroCosto.EMPLEADO,
            activo: true,
            empleadoId: { not: null },
          },
          include: {
            centroCosto: { select: { id: true, codigo: true, nombre: true } },
          },
        }),
        this.prisma.centroCostoCapacidadPeriodo.findMany({
          where: { tenantId, periodo },
          select: {
            centroCostoId: true,
            diasPorMes: true,
            horasPorDia: true,
          },
        }),
        this.prisma.centroCostoComponenteCostoPeriodo.findMany({
          where: {
            tenantId,
            periodo,
            empleadoId: { not: null },
            categoria: {
              in: [
                CategoriaComponenteCostoCentro.SUELDOS,
                CategoriaComponenteCostoCentro.CARGAS,
              ],
            },
          },
          select: {
            empleadoId: true,
            centroCostoId: true,
            importeMensual: true,
          },
        }),
        this.prisma.empleado.findMany({
          where: { tenantId },
          select: { id: true, nombreCompleto: true, sector: true },
        }),
      ]);

    // Horas base de cada centro en el mes (días × horas/día).
    const horasCentro = new Map<string, number>();
    for (const c of capacidades) {
      horasCentro.set(
        c.centroCostoId,
        Number(c.diasPorMes) * Number(c.horasPorDia),
      );
    }

    const imputadoPorPar = new Map<string, number>();
    for (const c of componentes) {
      const clave = `${c.empleadoId}|${c.centroCostoId}`;
      imputadoPorPar.set(
        clave,
        (imputadoPorPar.get(clave) ?? 0) + Number(c.importeMensual),
      );
    }

    const porEmpleado = new Map<string, PersonaCostoLaboral>();
    const datosEmpleado = new Map(empleados.map((e) => [e.id, e]));

    for (const recurso of recursos) {
      const empleadoId = recurso.empleadoId;
      if (!empleadoId) continue;
      const datos = datosEmpleado.get(empleadoId);
      if (!datos) continue;

      if (!porEmpleado.has(empleadoId)) {
        const rem = remuneraciones.get(empleadoId);
        const calc = rem ? this.remuneraciones.calcular(rem) : null;
        porEmpleado.set(empleadoId, {
          empleadoId,
          nombre: datos.nombreCompleto,
          sector: datos.sector,
          sueldoNeto: calc?.sueldoNeto ?? 0,
          cargasSociales: calc?.cargasSociales ?? 0,
          sueldosPorAnio: calc?.sueldosPorAnio ?? 0,
          costoMensual: calc?.costoMensual ?? 0,
          dedicacionPct: 0,
          horasMes: 0,
          costoHora: null,
          imputado: 0,
          sinImputar: 0,
          centros: [],
        });
      }

      const persona = porEmpleado.get(empleadoId)!;
      const pct = Number(recurso.porcentajeAsignacion ?? 0);
      const horas = ((horasCentro.get(recurso.centroCostoId) ?? 0) * pct) / 100;
      const imputado =
        imputadoPorPar.get(`${empleadoId}|${recurso.centroCostoId}`) ?? 0;

      persona.dedicacionPct += pct;
      persona.horasMes += horas;
      persona.imputado += imputado;
      persona.centros.push({
        codigo: recurso.centroCosto?.codigo ?? '?',
        nombre: recurso.centroCosto?.nombre ?? 'Centro',
        dedicacionPct: pct,
        horasMes: r2(horas),
        imputado: r2(imputado),
      });
    }

    const personas = [...porEmpleado.values()]
      .map((p) => ({
        ...p,
        dedicacionPct: r2(p.dedicacionPct),
        horasMes: r2(p.horasMes),
        // Sin horas asignadas no hay costo por hora: dividir por cero y mostrar
        // "infinito" sería peor que decir que no se sabe.
        costoHora: p.horasMes > 0 ? r2(p.costoMensual / p.horasMes) : null,
        imputado: r2(p.imputado),
        sinImputar: r2(Math.max(0, p.costoMensual - p.imputado)),
        centros: p.centros.sort((a, b) => b.dedicacionPct - a.dedicacionPct),
      }))
      .sort((a, b) => b.costoMensual - a.costoMensual);

    const totales = {
      personas: personas.length,
      costoMensual: r2(personas.reduce((n, p) => n + p.costoMensual, 0)),
      imputado: r2(personas.reduce((n, p) => n + p.imputado, 0)),
      sinImputar: r2(personas.reduce((n, p) => n + p.sinImputar, 0)),
      horasMes: r2(personas.reduce((n, p) => n + p.horasMes, 0)),
    };

    // Gente con sueldo cargado que no está asignada a ningún centro: su costo
    // no lo absorbe ninguna tarifa y no aparecería en la tabla de arriba.
    const sinCentro = [...remuneraciones.keys()]
      .filter((id) => !porEmpleado.has(id))
      .map((id) => {
        const datos = datosEmpleado.get(id);
        const rem = remuneraciones.get(id)!;
        return {
          empleadoId: id,
          nombre: datos?.nombreCompleto ?? 'Persona',
          costoMensual: this.remuneraciones.calcular(rem).costoMensual,
        };
      })
      .filter((p) => p.costoMensual > 0);

    return { periodo, personas, totales, sinCentro };
  }
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
