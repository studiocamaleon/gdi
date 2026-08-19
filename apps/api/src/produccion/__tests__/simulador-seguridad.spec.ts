import type { CurrentAuth } from '../../auth/auth.types';
import { ProduccionService } from '../produccion.service';

const varianteId = '11111111-1111-4111-8111-111111111111';
const materiaPrimaId = '22222222-2222-4222-8222-222222222222';

function auth(permisos: string[]): CurrentAuth {
  return {
    userId: 'usuario',
    sessionId: 'sesion',
    tenantId: 'tenant-seguro',
    membershipId: 'membership',
    role: 'OPERADOR',
    email: 'operario@test.local',
    permisos: new Set(permisos),
  } as CurrentAuth;
}

function crearServicio() {
  const prisma = {
    ordenTrabajo: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'orden',
          numero: 'OT-0001',
          fechaEntrega: new Date('2026-08-18T12:00:00Z'),
          cliente: { nombre: 'Cliente reservado' },
          items: [
            {
              id: 'item',
              codigo: 'A',
              nombre: 'Trabajo gráfico',
              ordenIndice: 0,
              cotizacionItem: {
                jobContextJson: {
                  tecnologia: 'uv',
                  piezas: [{ anchoMm: 100, altoMm: 100 }],
                },
                trazabilidadJson: {
                  pasos: [
                    {
                      rutaPasoId: 'ruta',
                      materiales: [
                        {
                          tipoLineaCosto: 'MATERIAL',
                          materialVarianteId: varianteId,
                          materialSku: 'VIN-BLA-60',
                          materiaPrimaNombre: 'Vinilo',
                          precioUnitario: 1500,
                          atributosVarianteJson: { anchoMm: 600 },
                        },
                      ],
                      nestingResult: { consumedLengthMm: 500 },
                    },
                  ],
                },
              },
              pasos: [
                {
                  id: 'paso',
                  indice: 0,
                  familiaCodigo: 'impresion_por_area',
                  estado: 'pendiente',
                  tipoEjecucion: 'interno',
                  rutaPasoId: 'ruta',
                  duracionEstimadaMin: null,
                },
              ],
            },
          ],
        },
      ]),
    },
    materiaPrimaVariante: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: varianteId,
          materiaPrimaId,
          atributosVarianteJson: { anchoMm: 600, color: 'blanco' },
        },
      ]),
    },
    materiaPrima: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: materiaPrimaId,
          nombre: 'Vinilo',
          variantes: [
            {
              id: varianteId,
              sku: 'VIN-BLA-60',
              atributosVarianteJson: { anchoMm: 600, color: 'blanco' },
              precioReferencia: 1500,
              stocks: [{ cantidadDisponible: 20 }],
            },
          ],
        },
      ]),
    },
  };
  const service = Object.create(
    ProduccionService.prototype,
  ) as ProduccionService;
  (service as unknown as { prisma: unknown }).prisma = prisma;
  return { service, prisma };
}

describe('simulador gran formato — datos por permisos', () => {
  it('oculta cliente e importes al operario sin perder la cola productiva', async () => {
    const { service, prisma } = crearServicio();
    const result = await service.simulador(
      auth(['produccion.ver', 'produccion.gestionar']),
    );

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].cliente).toBeNull();
    expect(result.jobs[0].varianteCotizada?.precioMl).toBeNull();
    expect(result.materiales[0].anchos[0].precioMl).toBeNull();
    expect(result.puedeVerImportes).toBe(false);
    expect(prisma.ordenTrabajo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-seguro' }),
      }),
    );
  });

  it('conserva cliente e importes con permisos comerciales y financieros', async () => {
    const { service } = crearServicio();
    const result = await service.simulador(
      auth(['produccion.ver', 'comercial.ver', 'finanzas.ver_margenes']),
    );

    expect(result.jobs[0].cliente).toBe('Cliente reservado');
    expect(result.jobs[0].varianteCotizada?.precioMl).toBe(1500);
    expect(result.materiales[0].anchos[0].precioMl).toBe(1500);
    expect(result.puedeVerImportes).toBe(true);
  });
});

function crearServicioLaser() {
  const prisma = {
    ordenTrabajo: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'orden-laser',
          numero: 'OT-2026-0001',
          fechaEntrega: new Date('2026-08-18T12:00:00Z'),
          cliente: { nombre: 'Cliente reservado' },
          items: [
            {
              id: 'item-laser',
              nombre: 'Tarjetas',
              ordenIndice: 0,
              cotizacionItem: {
                jobContextJson: {
                  caras: 2,
                  modoColorPorPaso: { 'config-laser': 'cmyk' },
                  ['maquinaSeleccionada_config-laser']: 'maquina-laser',
                },
                trazabilidadJson: {
                  pasos: [
                    {
                      rutaPasoId: 'ruta-laser',
                      configPasoId: 'config-laser',
                      materiales: [
                        {
                          tipoLineaCosto: 'MATERIAL',
                          materiaPrimaId: 'papel-ilustracion',
                          materialVarianteId: 'ilustracion-150-mate',
                          materiaPrimaNombre: 'Papel ilustración',
                          atributosVarianteJson: {
                            gramaje: 150,
                            acabado: 'mate',
                          },
                        },
                      ],
                      outputsCanonicos: {
                        pliegos_impresos: 25,
                        pliego_impresion_ancho_mm: 320,
                        pliego_impresion_alto_mm: 450,
                      },
                    },
                  ],
                },
              },
              pasos: [
                {
                  id: 'paso-laser',
                  indice: 0,
                  nombre: 'Impresión',
                  familiaCodigo: 'impresion_por_hoja',
                  estado: 'pendiente',
                  tipoEjecucion: 'interno',
                  rutaPasoId: 'ruta-laser',
                  centroCostoId: 'centro-laser',
                  centroCostoNombre: 'Impresión láser',
                  duracionEstimadaMin: 5,
                  iniciadoEl: null,
                },
              ],
            },
          ],
        },
      ]),
    },
    productoConfigPaso: { findMany: jest.fn().mockResolvedValue([]) },
    maquina: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'maquina-laser', nombre: 'Ricoh 9003' }]),
    },
  };
  const service = Object.create(
    ProduccionService.prototype,
  ) as ProduccionService;
  (service as unknown as { prisma: unknown }).prisma = prisma;
  return { service, prisma };
}

describe('simulador láser — compatibilidad y privacidad', () => {
  it('publica una clave segura con variante exacta y oculta el cliente al operario', async () => {
    const { service, prisma } = crearServicioLaser();
    const result = await service.simuladorLaser(
      auth(['produccion.ver', 'produccion.gestionar']),
    );

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toEqual(
      expect.objectContaining({
        cliente: null,
        maquinaId: 'maquina-laser',
        modoColor: 'CMYK',
        compatibilidadKey: expect.any(String),
        faltantesCompatibilidad: [],
        papel: expect.objectContaining({
          varianteId: 'ilustracion-150-mate',
          gramaje: 150,
        }),
      }),
    );
    expect(prisma.ordenTrabajo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-seguro' }),
      }),
    );
  });

  it('conserva el cliente sólo con permiso comercial', async () => {
    const { service } = crearServicioLaser();
    const result = await service.simuladorLaser(
      auth(['produccion.ver', 'comercial.ver']),
    );
    expect(result.jobs[0].cliente).toBe('Cliente reservado');
  });
});
