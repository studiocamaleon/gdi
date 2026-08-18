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
});
