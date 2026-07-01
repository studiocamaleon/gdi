import { ValidationPipe } from '@nestjs/common';

import { CotizarDto } from '../cotizar.dto';

describe('CotizarDto', () => {
  it('preserva claves runtime del jobContext con ValidationPipe whitelist', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
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
      (result.jobContext as Record<string, unknown>)[`modoColor_${configPasoId}`],
    ).toBe('BN');
    expect(
      (result.jobContext as Record<string, unknown>)[
        `maquinaSeleccionada_${configPasoId}`
      ],
    ).toBe(maquinaId);
  });
});
