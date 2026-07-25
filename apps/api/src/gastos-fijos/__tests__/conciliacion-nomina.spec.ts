import { BadRequestException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';

import { GastosFijosService } from '../gastos-fijos.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RemuneracionesService } from '../../empleados/remuneraciones.service';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * La conciliación entre el punto de equilibrio y la nómina real.
 *
 * Los dos módulos están desacoplados a propósito, así que esto NO fuerza la
 * igualdad: hace visible una diferencia que antes no lo era. Lo que sí tiene
 * que ser exacto es el cierre de vigencias al alinear — si una línea vieja
 * queda abierta, el punto de equilibrio cuenta los sueldos dos veces.
 */

const AUTH: CurrentAuth = {
  userId: 'u1',
  sessionId: 's1',
  tenantId: 't1',
  membershipId: 'm1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@imprenta.test',
};

function linea(over: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    nombre: 'Sueldos y cargas empleados',
    categoria: 'SUELDOS',
    // Number en vez de un Decimal falso: el service hace Number() para sumar
    // y .toFixed(2) para responder, y un número plano soporta las dos.
    importeMensual: 6_600_000,
    vigenteDesde: '2026-07',
    vigenteHasta: null,
    activo: true,
    notas: null,
    ...over,
  } as never;
}

function armar(opts: { lineas?: unknown[]; personas?: number; costo?: number } = {}) {
  const { lineas = [linea()], personas = 7, costo = 16_466_667 } = opts;

  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const create = jest.fn().mockResolvedValue({});
  const tx = { gastoFijoEstructura: { updateMany, create } };

  const prisma = {
    gastoFijoEstructura: { findMany: jest.fn().mockResolvedValue(lineas) },
    $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
  } as unknown as PrismaService;

  const remuneraciones = {
    nominaDelPeriodo: jest.fn().mockResolvedValue({
      periodo: '2026-07',
      personas,
      sueldoNeto: 0,
      cargasSociales: 0,
      costoMensual: costo,
    }),
  } as unknown as RemuneracionesService;

  return {
    service: new GastosFijosService(prisma, remuneraciones),
    updateMany,
    create,
  };
}

describe('conciliación con la nómina', () => {
  it('marca cuando el punto de equilibrio declara de menos', async () => {
    // Declarado 6.600.000 contra una nómina de 16.466.667.
    const { service } = armar();
    const r = await service.conciliacionNomina(AUTH, '2026-07');

    expect(r.declarado).toBe(6_600_000);
    expect(r.estado).toBe('declarado_de_menos');
    expect(r.diferencia).toBeCloseTo(-9_866_667, 0);
  });

  it('marca cuando declara de más', async () => {
    const { service } = armar({ costo: 1_000_000 });
    const r = await service.conciliacionNomina(AUTH, '2026-07');
    expect(r.estado).toBe('declarado_de_mas');
  });

  /** Un peso de diferencia es redondeo, no una decisión que haya que mostrar. */
  it('no grita por centavos', async () => {
    const { service } = armar({ costo: 6_600_000.4 });
    const r = await service.conciliacionNomina(AUTH, '2026-07');
    expect(r.estado).toBe('alineado');
  });

  it('sin legajos cargados no inventa una comparación', async () => {
    const { service } = armar({ personas: 0, costo: 0 });
    const r = await service.conciliacionNomina(AUTH, '2026-07');
    expect(r.estado).toBe('sin_nomina');
  });

  describe('alinear', () => {
    it('cierra las líneas viejas el mes previo y crea una con la nómina', async () => {
      const { service, updateMany, create } = armar();

      await service.alinearConNomina(AUTH, '2026-07');

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vigenteDesde: { lt: '2026-07' } }),
          data: { vigenteHasta: '2026-06' },
        }),
      );
      const creada = create.mock.calls[0][0].data as Record<string, unknown>;
      expect(creada.vigenteDesde).toBe('2026-07');
      expect(creada.nombre).toContain('7 personas');
    });

    /**
     * Cerrar en el mes previo una línea que arranca en este mes daría una
     * vigencia imposible (hasta < desde): esas se desactivan.
     */
    it('desactiva —no cierra— las que arrancan en el mismo mes', async () => {
      const { service, updateMany } = armar();

      await service.alinearConNomina(AUTH, '2026-07');

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vigenteDesde: { gte: '2026-07' } }),
          data: { activo: false },
        }),
      );
    });

    it('cruza el año al cerrar en enero', async () => {
      const { service, updateMany } = armar();

      await service.alinearConNomina(AUTH, '2026-01');

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { vigenteHasta: '2025-12' } }),
      );
    });

    it('sin nómina no alinea contra cero', async () => {
      const { service } = armar({ personas: 0, costo: 0 });

      await expect(service.alinearConNomina(AUTH, '2026-07')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
