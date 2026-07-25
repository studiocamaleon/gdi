import { BadRequestException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';

import {
  RemuneracionesService,
  mesAnterior,
} from '../remuneraciones.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * Las dos reglas que no se pueden romper: cómo se prorratea el aguinaldo y
 * cómo se encadenan las vigencias.
 *
 * La segunda existe porque el problema que motivó todo el módulo fue
 * exactamente ese: datos de sueldo que se pisan entre sí sin que nada avise.
 * Ver docs/legajos-nomina-diseno.md
 */

const AUTH: CurrentAuth = {
  userId: 'u1',
  sessionId: 's1',
  tenantId: 't1',
  membershipId: 'm1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@imprenta.test',
};

function fila(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r1',
    tenantId: 't1',
    empleadoId: 'e1',
    vigenteDesde: '2026-07',
    vigenteHasta: null,
    sueldoNeto: 2_000_000,
    cargasSociales: 1_000_000,
    sueldosPorAnio: 13,
    motivo: null,
    notas: null,
    ...over,
  } as never;
}

function armar(opts: { existeEmpleado?: boolean; yaHay?: unknown } = {}) {
  const { existeEmpleado = true, yaHay = null } = opts;
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const create = jest
    .fn()
    .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(fila({ ...data, id: 'nueva' })),
    );

  const tx = {
    empleadoRemuneracion: { updateMany, create },
  };
  const prisma = {
    empleado: {
      findFirst: jest
        .fn()
        .mockResolvedValue(existeEmpleado ? { id: 'e1' } : null),
    },
    empleadoRemuneracion: {
      findFirst: jest.fn().mockResolvedValue(yaHay),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
  } as unknown as PrismaService;

  return { service: new RemuneracionesService(prisma), updateMany, create };
}

describe('remuneraciones', () => {
  describe('prorrateo del aguinaldo', () => {
    it('con 13 sueldos recarga 8,33% sobre el mes', () => {
      const { service } = armar();
      const c = service.calcular(fila());

      // (2.000.000 + 1.000.000) × 13 / 12
      expect(c.costoMensualSinSac).toBe(3_000_000);
      expect(c.costoMensual).toBe(3_250_000);
      expect(c.provisionSacMensual).toBe(250_000);
    });

    it('con 12 sueldos no hay provisión', () => {
      const { service } = armar();
      const c = service.calcular(fila({ sueldosPorAnio: 12 }));

      expect(c.costoMensual).toBe(3_000_000);
      expect(c.provisionSacMensual).toBe(0);
    });

    /** Un convenio con 14 no debería necesitar un release. */
    it('escala con cualquier cantidad de sueldos', () => {
      const { service } = armar();
      const c = service.calcular(fila({ sueldosPorAnio: 14 }));
      expect(c.costoMensual).toBe(3_500_000);
    });

    /** Las cargas también generan aguinaldo: la base es neto + cargas. */
    it('prorratea sobre el neto Y las cargas, no sólo sobre el neto', () => {
      const { service } = armar();
      const conCargas = service.calcular(fila());
      const sinCargas = service.calcular(fila({ cargasSociales: 0 }));

      expect(sinCargas.provisionSacMensual).toBe(166_666.67);
      // Un tercio del sueldo en cargas ⇒ un 50% más de provisión.
      expect(conCargas.provisionSacMensual).toBe(250_000);
    });

    /** La plata no se muestra con catorce decimales. */
    it('redondea a dos decimales', () => {
      const { service } = armar();
      const c = service.calcular(fila({ sueldoNeto: 1_000_000, cargasSociales: 0 }));
      expect(c.costoMensual).toBe(1_083_333.33);
    });
  });

  describe('encadenado de vigencias', () => {
    it('cargar un aumento cierra la remuneración abierta el mes previo', async () => {
      const { service, updateMany } = armar();

      await service.crear(AUTH, 'e1', {
        vigenteDesde: '2026-08',
        sueldoNeto: '2500000',
        cargasSociales: '1250000',
        motivo: 'paritaria',
      });

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            empleadoId: 'e1',
            vigenteHasta: null,
            vigenteDesde: { lt: '2026-08' },
          }),
          data: { vigenteHasta: '2026-07' },
        }),
      );
    });

    it('no deja dos remuneraciones arrancando el mismo mes', async () => {
      const { service } = armar({ yaHay: fila() });

      await expect(
        service.crear(AUTH, 'e1', {
          vigenteDesde: '2026-07',
          sueldoNeto: '1',
          cargasSociales: '0',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un rango dado vuelta', async () => {
      const { service } = armar();

      await expect(
        service.crear(AUTH, 'e1', {
          vigenteDesde: '2026-08',
          vigenteHasta: '2026-06',
          sueldoNeto: '1',
          cargasSociales: '0',
        }),
      ).rejects.toThrow(/no puede ser anterior/);
    });

    it('rechaza importes negativos', async () => {
      const { service } = armar();

      await expect(
        service.crear(AUTH, 'e1', {
          vigenteDesde: '2026-08',
          sueldoNeto: '-1',
          cargasSociales: '0',
        }),
      ).rejects.toThrow(/no pueden ser negativos/);
    });
  });

  describe('mesAnterior', () => {
    it('retrocede dentro del año', () => {
      expect(mesAnterior('2026-07')).toBe('2026-06');
    });

    /** El caso que rompe si se resta 1 sin pensar. */
    it('cruza el año en enero', () => {
      expect(mesAnterior('2026-01')).toBe('2025-12');
    });

    it('mantiene el cero a la izquierda', () => {
      expect(mesAnterior('2026-10')).toBe('2026-09');
    });
  });
});
