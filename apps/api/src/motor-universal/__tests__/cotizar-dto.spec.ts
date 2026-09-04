import { ValidationPipe } from '@nestjs/common';

import {
  CotizarDto,
  jobContextCotizacionValido,
  RecotizarItemDto,
} from '../cotizar.dto';

describe('CotizarDto', () => {
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
