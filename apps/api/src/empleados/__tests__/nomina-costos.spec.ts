import { NominaCostosService } from '../nomina-costos.service';
import { RemuneracionesService } from '../remuneraciones.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Lo que se le escribe al centro de costo, que es lo que después mueve la
 * tarifa hora.
 *
 * La regla: importe = sueldo del legajo × dedicación × prorrateo del aguinaldo.
 * Los tres factores tienen que estar; que falte cualquiera pasa desapercibido
 * en pantalla y aparece como una tarifa mal calculada meses después.
 */

function armar(opts: {
  recursos?: Array<{ empleadoId: string; nombre: string; pct: number }>;
  remuneracion?: Record<string, unknown> | null;
} = {}) {
  const {
    recursos = [{ empleadoId: 'e1', nombre: 'Iván Sanz', pct: 35 }],
    remuneracion = {
      id: 'rem1',
      empleadoId: 'e1',
      sueldoNeto: 1_500_000,
      cargasSociales: 750_000,
      sueldosPorAnio: 13,
      vigenteDesde: '2026-07',
      vigenteHasta: null,
      motivo: null,
      notas: null,
    },
  } = opts;

  const createMany = jest.fn().mockResolvedValue({ count: 2 });
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });

  const prisma = {
    centroCostoRecurso: {
      findMany: jest.fn().mockResolvedValue(
        recursos.map((r, i) => ({
          id: `rec${i}`,
          empleadoId: r.empleadoId,
          porcentajeAsignacion: r.pct,
          empleado: { id: r.empleadoId, nombreCompleto: r.nombre },
        })),
      ),
    },
    centroCostoComponenteCostoPeriodo: { createMany, deleteMany },
    empleadoRemuneracion: {
      findFirst: jest.fn().mockResolvedValue(remuneracion),
    },
  } as unknown as PrismaService;

  const remuneraciones = new RemuneracionesService(
    prisma,
    { sincronizarEmpleado: jest.fn() } as never,
  );
  const service = new NominaCostosService(prisma, remuneraciones);
  return { service, createMany, deleteMany };
}

/** Los dos importes escritos (SUELDOS y CARGAS) de la primera persona. */
function importes(createMany: jest.Mock) {
  const filas = createMany.mock.calls[0][0].data as Array<{
    categoria: string;
    importeMensual: { toString(): string };
    nombre: string;
  }>;
  return {
    sueldos: Number(filas[0].importeMensual.toString()),
    cargas: Number(filas[1].importeMensual.toString()),
    nombreSueldos: filas[0].nombre,
  };
}

describe('nómina → centros de costo', () => {
  it('imputa sueldo × dedicación × prorrateo del aguinaldo', async () => {
    const { service, createMany } = armar();

    await service.sincronizarCentroPeriodo('t1', 'c1', '2026-07');

    // 1.500.000 × 13/12 × 35% = 568.750
    // 750.000   × 13/12 × 35% = 284.375
    const { sueldos, cargas } = importes(createMany);
    expect(sueldos).toBeCloseTo(568_750, 2);
    expect(cargas).toBeCloseTo(284_375, 2);
    // La suma es el costo mensual real por su dedicación.
    expect(sueldos + cargas).toBeCloseTo((2_250_000 * 13) / 12 * 0.35, 2);
  });

  it('sin aguinaldo no recarga nada', async () => {
    const { service, createMany } = armar({
      remuneracion: {
        id: 'rem1',
        empleadoId: 'e1',
        sueldoNeto: 1_500_000,
        cargasSociales: 750_000,
        sueldosPorAnio: 12,
        vigenteDesde: '2026-07',
        vigenteHasta: null,
        motivo: null,
        notas: null,
      },
    });

    await service.sincronizarCentroPeriodo('t1', 'c1', '2026-07');

    const { sueldos } = importes(createMany);
    expect(sueldos).toBeCloseTo(1_500_000 * 0.35, 2);
  });

  /**
   * El importe ya no es el sueldo de bolsillo: llamarlo "Sueldo neto" —como se
   * llamaba antes— sería mentir en la única etiqueta que el usuario ve.
   */
  it('no llama "neto" a un importe que lleva aguinaldo adentro', async () => {
    const { service, createMany } = armar();
    await service.sincronizarCentroPeriodo('t1', 'c1', '2026-07');
    expect(importes(createMany).nombreSueldos).not.toMatch(/neto/i);
  });

  it('avisa de la gente asignada que todavía no tiene sueldo cargado', async () => {
    const { service, createMany } = armar({ remuneracion: null });

    const r = await service.sincronizarCentroPeriodo('t1', 'c1', '2026-07');

    expect(r.sinRemuneracion).toEqual([
      { empleadoId: 'e1', nombre: 'Iván Sanz' },
    ]);
    expect(createMany).not.toHaveBeenCalled();
  });

  /**
   * Sólo se borran los componentes CON persona: un SUELDOS cargado a mano y sin
   * legajo detrás (una changa, un reemplazo) es una decisión de quien lo puso.
   */
  it('no pisa los componentes de sueldo cargados a mano', async () => {
    const { service, deleteMany } = armar();

    await service.sincronizarCentroPeriodo('t1', 'c1', '2026-07');

    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ empleadoId: { not: null } }),
      }),
    );
  });

  it('ignora al que está asignado al 0%', async () => {
    const { service, createMany } = armar({
      recursos: [{ empleadoId: 'e1', nombre: 'Iván Sanz', pct: 0 }],
    });

    await service.sincronizarCentroPeriodo('t1', 'c1', '2026-07');

    expect(createMany).not.toHaveBeenCalled();
  });
});
