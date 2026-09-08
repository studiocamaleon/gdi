import { ValidationPipe } from '@nestjs/common';

import {
  CotizarDto,
  CotizarAsincronoDto,
  jobContextCotizacionValido,
  RecotizarItemDto,
} from '../cotizar.dto';
import {
  inspeccionarVector,
  interpretarVector,
} from '../../productos-servicios/geometrias/interpretar-vector';

describe('CotizarDto', () => {
  it('acepta por HTTP piezas rectangulares dentro de grupos y rechaza contratos adulterados', async () => {
    const pieza = { id: 'frente', tipo: 'RECTANGULAR', nombre: 'Frente', cantidadPorUnidad: 2, medidas: { anchoMm: 300, altoMm: 100 } };
    const contexto = (p: unknown) => ({ cantidad: 10, componentesConfiguracion: { VINILO: { __ocurrenciasAdicionales: [{ id: 'sucursal-a', nombre: 'Sucursal A', valores: { piezas: [p] } }] } } });
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(pipe.transform({ productoId: '22222222-2222-4222-8222-222222222222', jobContext: contexto(pieza) }, { type: 'body', metatype: CotizarDto })).resolves.toBeDefined();
    for (const p of [
      { ...pieza, medidas: { anchoMm: 0, altoMm: 100 } },
      { ...pieza, cantidadPorUnidad: 1.5 },
      { ...pieza, extras: { campo: 'no permitido' } },
      { ...pieza, medidas: { ...pieza.medidas, extra: { profundo: true } } },
    ]) expect(jobContextCotizacionValido(contexto(p))).toBe(false);
  });
  const referencia = {
    tipo: 'REFERENCIA_GEOMETRIA',
    schemaVersion: 1,
    procedencia: {
      version: 1,
      geometriaId: '22222222-2222-4222-8222-222222222222',
      archivoId: '33333333-3333-4333-8333-333333333333',
      hash: 'a'.repeat(64),
    },
  };

  it.each([CotizarDto, CotizarAsincronoDto, RecotizarItemDto])(
    'acepta referencias compactas en la entrada HTTP de %p',
    async (metatype) => {
      const jobContext = JSON.parse(
        JSON.stringify({
          cantidad: 50,
          disenoVectorialFuente: referencia,
          geometriasVectoriales: Object.fromEntries(
            Array.from({ length: 6 }, (_, i) => [`pieza${i}`, referencia]),
          ),
          componentesConfiguracion: {
            frente: {
              ocurrencias: [
                { overrides: { disenoVectorialFuente: referencia } },
              ],
            },
          },
        }),
      );
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
      const result = await pipe.transform(
        {
          ...(metatype === RecotizarItemDto
            ? {}
            : { productoId: '11111111-1111-4111-8111-111111111111' }),
          jobContext,
        },
        { type: 'body', metatype },
      );
      expect(result.jobContext).toEqual(jobContext);
    },
  );

  it('acepta seis fuentes completas de mil puntos dentro del límite HTTP', () => {
    const puntos = Array.from(
      { length: 1000 },
      (_, i) =>
        `${50 + 40 * Math.cos((i * Math.PI) / 500)},${50 + 40 * Math.sin((i * Math.PI) / 500)}`,
    ).join(' ');
    const inspeccion = inspeccionarVector(
      `<svg viewBox="0 0 100 100"><polygon points="${puntos}"/></svg>`,
      'grande.svg',
    );
    const f = interpretarVector(
      inspeccion,
      {
        exteriorId: inspeccion.sugeridaId,
        unidad: 'mm',
        cerrarExterior: false,
        operaciones: [],
      },
      { ...referencia.procedencia, nombreArchivo: 'grande.svg' },
    );
    const jobContext = JSON.parse(
      JSON.stringify({
        cantidad: 50,
        geometriasVectoriales: Object.fromEntries(
          Array.from({ length: 6 }, (_, i) => [`pieza${i}`, f]),
        ),
      }),
    );
    expect(Buffer.byteLength(JSON.stringify(jobContext))).toBeLessThan(
      1_000_000,
    );
    expect(jobContextCotizacionValido(jobContext)).toBe(true);
    jobContext.geometriasVectoriales.pieza0.fabricacion.entidades[0].puntos[0].x =
      Infinity;
    expect(jobContextCotizacionValido(jobContext)).toBe(false);
  });

  it('rechaza referencias mal formadas también dentro de ocurrencias', () => {
    for (const fuente of [
      { ...referencia, svg: '<svg/>' },
      {
        ...referencia,
        procedencia: { ...referencia.procedencia, hash: 'invalido' },
      },
    ]) {
      expect(
        jobContextCotizacionValido({
          cantidad: 1,
          componentesConfiguracion: {
            frente: { ocurrencias: [{ disenoVectorialFuente: fuente }] },
          },
        }),
      ).toBe(false);
    }
  });

  it('mantiene los límites para parámetros comerciales y geometrías fuera de presupuesto', () => {
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        campoLibre: Array.from({ length: 1001 }, () => 1),
      }),
    ).toBe(false);
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        disenoVectorialFuente: {
          schemaVersion: 1,
          nombreArchivo: 'a.svg',
          svg: '<svg/>',
          anchoFinalMm: 10,
          puntos: Array.from({ length: 50_001 }, () => 1),
        },
      }),
    ).toBe(false);
  });
  const inspeccion = inspeccionarVector(
    '<svg viewBox="0 0 100 60"><path d="M0 0H100V60H0Z"/></svg>',
    'cuerpo.svg',
  );
  const fuenteGuardada = interpretarVector(
    inspeccion,
    {
      exteriorId: inspeccion.sugeridaId,
      unidad: 'mm',
      cerrarExterior: false,
      operaciones: [],
    },
    {
      nombreArchivo: 'cuerpo.svg',
      geometriaId: '22222222-2222-4222-8222-222222222222',
      archivoId: '33333333-3333-4333-8333-333333333333',
      hash: 'a'.repeat(64),
    },
  );

  it.each([CotizarDto, CotizarAsincronoDto])(
    'acepta archivos reutilizables producidos por el importador en %p',
    async (metatype) => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
      const jobContext = JSON.parse(
        JSON.stringify({
          cantidad: 50,
          geometriasVectoriales: {
            cuerpo: fuenteGuardada,
            estante: fuenteGuardada,
          },
        }),
      );
      const result = await pipe.transform(
        {
          productoId: '11111111-1111-4111-8111-111111111111',
          jobContext,
        },
        { type: 'body', metatype },
      );
      expect(result.jobContext).toEqual(jobContext);
      expect(
        jobContextCotizacionValido(
          JSON.parse(
            JSON.stringify({
              cantidad: 50,
              disenoVectorialFuente: fuenteGuardada,
            }),
          ),
        ),
      ).toBe(true);
    },
  );

  it.each([{ geometriaId: 'invalida' }, { archivoId: null }, { hash: '' }])(
    'rechaza referencias guardadas incompletas: %j',
    (patch) => {
      expect(
        jobContextCotizacionValido({
          cantidad: 50,
          geometriasVectoriales: {
            cuerpo: {
              ...fuenteGuardada,
              procedencia: { ...fuenteGuardada.procedencia, ...patch },
            },
          },
        }),
      ).toBe(false);
    },
  );
  it('preserva claves runtime del jobContext con ValidationPipe whitelist', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const configPasoId = '22222222-2222-4222-8222-222222222222';
    const maquinaId = '33333333-3333-4333-8333-333333333333';
    const payload = {
      productoId: '11111111-1111-4111-8111-111111111111',
      jobContext: {
        cantidad: 500,
        caras: 1,
        modoColor: 'BN',
        modoColorPorPaso: {
          [configPasoId]: 'BN',
        },
        [`modoColor_${configPasoId}`]: 'BN',
        [`maquinaSeleccionada_${configPasoId}`]: maquinaId,
      },
    };

    const result = (await pipe.transform(payload, {
      type: 'body',
      metatype: CotizarDto,
    })) as CotizarDto;

    expect(result.jobContext.modoColor).toBe('BN');
    expect(result.jobContext.modoColorPorPaso).toEqual({
      [configPasoId]: 'BN',
    });
    expect(
      (result.jobContext as Record<string, unknown>)[
        `modoColor_${configPasoId}`
      ],
    ).toBe('BN');
    expect(
      (result.jobContext as Record<string, unknown>)[
        `maquinaSeleccionada_${configPasoId}`
      ],
    ).toBe(maquinaId);
  });

  it.each([
    { cantidad: 0 },
    { cantidad: -5 },
    { cantidad: 1.5 },
    { cantidad: Number.MAX_SAFE_INTEGER + 1 },
    { cantidad: 1, piezas: [] },
    {
      cantidad: 1,
      piezas: [{ cantidad: 0, anchoMm: 100, altoMm: 100 }],
    },
    { cantidad: 1, medidaCustomMm: { anchoMm: 0, altoMm: 100 } },
    { cantidad: 1, distanciaKm: Number.POSITIVE_INFINITY },
  ])('rechaza un jobContext financiero inválido: %j', async (jobContext) => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          productoId: '11111111-1111-4111-8111-111111111111',
          jobContext,
        },
        { type: 'body', metatype: CotizarDto },
      ),
    ).rejects.toThrow();
  });

  it('valida el body concreto de recotización y conserva claves dinámicas', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const result = (await pipe.transform(
      {
        jobContext: { cantidad: 10, campoDinamico: 'valor' },
        periodo: '2026-08',
      },
      { type: 'body', metatype: RecotizarItemDto },
    )) as RecotizarItemDto;

    expect(result).toBeInstanceOf(RecotizarItemDto);
    expect((result.jobContext as Record<string, unknown>).campoDinamico).toBe(
      'valor',
    );
  });

  it('rechaza períodos que no usan YYYY-MM', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    await expect(
      pipe.transform(
        {
          productoId: '11111111-1111-4111-8111-111111111111',
          jobContext: { cantidad: 1 },
          periodo: 'agosto-2026',
        },
        { type: 'body', metatype: CotizarDto },
      ),
    ).rejects.toThrow();
  });

  it('rechaza referencias circulares en invocaciones internas', () => {
    const jobContext: Record<string, unknown> = { cantidad: 1 };
    jobContext.circular = jobContext;

    expect(jobContextCotizacionValido(jobContext)).toBe(false);
  });

  it('acepta una configuración vectorial multicapa válida', () => {
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        disenoVectorialFuente: {
          schemaVersion: 2,
          nombreArchivo: 'logo.svg',
          svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
          anchoFinalMm: 100,
          configuracionCapas: {
            schemaVersion: 1,
            niveles: [
              { id: 'base', nombre: 'Base', orden: 1, colorVisual: 1 },
              { id: 'frente', nombre: 'Frente', orden: 2, colorVisual: 2 },
            ],
            asignaciones: [
              { objetoId: 'objeto-1', nivelId: 'base', modo: 'pieza' },
              {
                objetoId: 'objeto-2',
                nivelId: 'frente',
                modo: 'pieza',
              },
            ],
          },
        },
      }),
    ).toBe(true);
  });

  it('mantiene compatibilidad con fuentes vectoriales v1 sin capas', () => {
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        disenoVectorialFuente: {
          schemaVersion: 1,
          nombreArchivo: 'logo-anterior.svg',
          svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
          anchoFinalMm: 100,
        },
      }),
    ).toBe(true);
  });

  it('acepta y valida el registro de geometrías vectoriales nombradas', () => {
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        geometriasVectoriales: {
          contorno_principal: {
            schemaVersion: 1,
            nombreArchivo: 'contorno.svg',
            svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
            anchoFinalMm: 100,
            altoFinalMm: 100,
          },
        },
      }),
    ).toBe(true);
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        geometriasVectoriales: {
          'id no valido': {
            schemaVersion: 1,
            nombreArchivo: 'contorno.svg',
            svg: '<svg/>',
            anchoFinalMm: 100,
          },
        },
      }),
    ).toBe(false);
  });

  it('rechaza fuentes vectoriales v2 sin configuración de capas', () => {
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        disenoVectorialFuente: {
          schemaVersion: 2,
          nombreArchivo: 'logo.svg',
          svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
          anchoFinalMm: 100,
        },
      }),
    ).toBe(false);
  });

  it('rechaza el tratamiento eliminado de solo pintura', () => {
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        disenoVectorialFuente: {
          schemaVersion: 2,
          nombreArchivo: 'logo.svg',
          svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
          anchoFinalMm: 100,
          configuracionCapas: {
            schemaVersion: 1,
            niveles: [{ id: 'base', nombre: 'Base', orden: 1, colorVisual: 1 }],
            asignaciones: [
              {
                objetoId: 'objeto-1',
                nivelId: 'base',
                modo: 'solo_pintura',
              },
            ],
          },
        },
      }),
    ).toBe(false);
  });

  it('rechaza asignaciones que apuntan a un nivel inexistente', () => {
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        disenoVectorialFuente: {
          schemaVersion: 1,
          nombreArchivo: 'logo.svg',
          svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
          anchoFinalMm: 100,
          configuracionCapas: {
            schemaVersion: 1,
            niveles: [{ id: 'base', nombre: 'Base', orden: 1, colorVisual: 1 }],
            asignaciones: [
              { objetoId: 'objeto-1', nivelId: 'otro', modo: 'pieza' },
            ],
          },
        },
      }),
    ).toBe(false);
  });

  it('acepta una cotización vectorial manual por placas', () => {
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        placasVectorialesManuales: 4,
        metrosCortePorPlacaVectorial: 10,
      }),
    ).toBe(true);
  });

  it('rechaza cantidades manuales de placas fraccionarias', () => {
    expect(
      jobContextCotizacionValido({
        cantidad: 1,
        placasVectorialesManuales: 1.5,
        metrosCortePorPlacaVectorial: 10,
      }),
    ).toBe(false);
  });
});
