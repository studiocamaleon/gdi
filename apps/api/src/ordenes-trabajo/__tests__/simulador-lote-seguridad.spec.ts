import { BadRequestException } from '@nestjs/common';

import type { CurrentAuth } from '../../auth/auth.types';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';

const varianteId = '11111111-1111-4111-8111-111111111111';
const materiaPrimaId = '22222222-2222-4222-8222-222222222222';

const auth = {
  userId: 'usuario',
  sessionId: 'sesion',
  tenantId: 'tenant-seguro',
  membershipId: 'membership',
  role: 'OPERADOR',
  email: 'operario@test.local',
  permisos: new Set(['produccion.ver', 'produccion.gestionar']),
} as CurrentAuth;

function paso(id: string, ordenId: string, itemId: string) {
  return {
    id,
    ordenId,
    itemId,
    nombre: 'Impresión',
    rutaPasoId: 'ruta-uv',
    duracionEstimadaMin: 10,
    item: {
      cotizacionItem: {
        jobContextJson: {
          tecnologia: 'uv',
          piezas: [{ anchoMm: 280, altoMm: 280, cantidad: 2 }],
        },
        trazabilidadJson: {
          pasos: [
            {
              rutaPasoId: 'ruta-uv',
              materiales: [
                {
                  tipoLineaCosto: 'MATERIAL',
                  materialVarianteId: varianteId,
                  precioUnitario: 100,
                },
              ],
              nestingResult: {
                consumedLengthMm: 1000,
                algorithm: 'maxrects-rollo',
                visualConfig: {
                  margins: { topMm: 10, rightMm: 10, bottomMm: 10, leftMm: 10 },
                  spacing: { horizontalMm: 5, verticalMm: 5 },
                  allowRotation: true,
                  pieceBleedMm: 0,
                },
              },
            },
          ],
        },
      },
    },
  };
}

function crearServicio() {
  const pasos = [
    paso('paso-a', 'orden-a', 'item-a'),
    paso('paso-b', 'orden-b', 'item-b'),
  ];
  const ahorroCreate = jest.fn().mockResolvedValue({ id: 'ahorro' });
  const prisma = {
    ordenTrabajoItemPaso: { findMany: jest.fn().mockResolvedValue(pasos) },
    materiaPrimaVariante: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: varianteId,
          materiaPrimaId,
          atributosVarianteJson: { anchoMm: 600, color: 'blanco' },
          precioReferencia: 120,
          stocks: [{ cantidadDisponible: 50 }],
          materiaPrima: { nombre: 'Vinilo blanco' },
        },
      ]),
    },
    empleado: {
      findFirst: jest.fn().mockResolvedValue({ nombreCompleto: 'Operario' }),
    },
    ahorroConsolidacion: { create: ahorroCreate },
  };
  const service = Object.create(
    OrdenesTrabajoService.prototype,
  ) as OrdenesTrabajoService;
  const accionPaso = jest.fn().mockResolvedValue({});
  Object.assign(service as object, { prisma, accionPaso });
  return { service, accionPaso, ahorroCreate };
}

describe('completar lote del simulador — integridad del ahorro', () => {
  it('recalcula consumo y costos en el servidor usando sólo el rollo elegido', async () => {
    const { service, accionPaso, ahorroCreate } = crearServicio();

    const result = await service.completarPasosLote(
      auth,
      ['paso-a', 'paso-b'],
      20,
      { varianteId, anchoMm: 600 },
    );

    expect(result).toEqual({ completados: 2, errores: [] });
    expect(accionPaso).toHaveBeenCalledTimes(2);
    expect(ahorroCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-seguro',
        materiaPrimaId,
        materiaPrimaNombre: 'Vinilo blanco',
        jobs: 2,
        consumoSeparadoMl: 2,
        consumoConsolidadoMl: expect.any(Number),
        ahorroMl: expect.any(Number),
        costoSeparado: 200,
        costoConsolidado: expect.any(Number),
        ahorroPesos: expect.any(Number),
      }),
    });
  });

  it('rechaza el lote antes de avanzar pasos cuando una pieza no entra', async () => {
    const { service, accionPaso, ahorroCreate } = crearServicio();

    await expect(
      service.completarPasosLote(auth, ['paso-a', 'paso-b'], undefined, {
        varianteId,
        anchoMm: 200,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accionPaso).not.toHaveBeenCalled();
    expect(ahorroCreate).not.toHaveBeenCalled();
  });
});

function pasoLaserValidacion(id: string, variante: string) {
  return {
    id,
    ordenId: `orden-${id}`,
    itemId: `item-${id}`,
    nombre: 'Impresión láser',
    rutaPasoId: `ruta-${id}`,
    familiaCodigo: 'impresion_por_hoja',
    estado: 'pendiente',
    tipoEjecucion: 'interno',
    duracionEstimadaMin: 5,
    item: {
      pasos: [{ id, estado: 'pendiente' }],
      cotizacionItem: {
        jobContextJson: {
          caras: 1,
          modoColorPorPaso: { [`config-${id}`]: 'BN' },
          [`maquinaSeleccionada_config-${id}`]: 'ricoh',
        },
        trazabilidadJson: {
          pasos: [
            {
              rutaPasoId: `ruta-${id}`,
              configPasoId: `config-${id}`,
              materiales: [
                {
                  tipoLineaCosto: 'MATERIAL',
                  materialVarianteId: variante,
                  materiaPrimaId: 'papel-obra',
                  materiaPrimaNombre: 'Papel obra',
                  atributosVarianteJson: { gramaje: 75 },
                },
              ],
              outputsCanonicos: {
                pliegos_impresos: 10,
                pliego_impresion_ancho_mm: 210,
                pliego_impresion_alto_mm: 297,
              },
            },
          ],
        },
      },
    },
  };
}

function crearServicioValidacionLaser(variantes: [string, string]) {
  const pasos = [
    pasoLaserValidacion('laser-a', variantes[0]),
    pasoLaserValidacion('laser-b', variantes[1]),
  ];
  const prisma = {
    ordenTrabajoItemPaso: { findMany: jest.fn().mockResolvedValue(pasos) },
    productoConfigPaso: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = Object.create(
    OrdenesTrabajoService.prototype,
  ) as OrdenesTrabajoService;
  const accionPaso = jest.fn().mockResolvedValue({});
  Object.assign(service as object, { prisma, accionPaso });
  return { service, accionPaso };
}

describe('completar tanda láser — revalidación de compatibilidad', () => {
  it('acepta la tanda cuando todos los parámetros físicos siguen coincidiendo', async () => {
    const { service, accionPaso } = crearServicioValidacionLaser([
      'obra-75-a4',
      'obra-75-a4',
    ]);

    await expect(
      service.completarPasosLote(
        auth,
        ['laser-a', 'laser-b'],
        undefined,
        undefined,
        true,
      ),
    ).resolves.toEqual({ completados: 2, errores: [] });
    expect(accionPaso).toHaveBeenCalledTimes(2);
  });

  it('rechaza toda la tanda antes de avanzar si cambió la variante de papel', async () => {
    const { service, accionPaso } = crearServicioValidacionLaser([
      'obra-75-mate',
      'obra-75-satinado',
    ]);

    await expect(
      service.completarPasosLote(
        auth,
        ['laser-a', 'laser-b'],
        undefined,
        undefined,
        true,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accionPaso).not.toHaveBeenCalled();
  });
});
