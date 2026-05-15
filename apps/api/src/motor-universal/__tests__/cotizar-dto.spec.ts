import { ValidationPipe } from '@nestjs/common';

import { CotizarDto } from '../cotizar.dto';

describe('CotizarDto', () => {
  it('preserva modoColor y modoColorPorPaso con ValidationPipe whitelist', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const payload = {
      productoId: '11111111-1111-4111-8111-111111111111',
      jobContext: {
        cantidad: 500,
        caras: 1,
        modoColor: 'BN',
        modoColorPorPaso: {
          '22222222-2222-4222-8222-222222222222': 'BN',
        },
        'modoColor_22222222-2222-4222-8222-222222222222': 'BN',
      },
    };

    const result = (await pipe.transform(payload, {
      type: 'body',
      metatype: CotizarDto,
    })) as CotizarDto;

    expect(result.jobContext.modoColor).toBe('BN');
    expect(result.jobContext.modoColorPorPaso).toEqual({
      '22222222-2222-4222-8222-222222222222': 'BN',
    });
    expect(
      (result.jobContext as Record<string, unknown>)[
        'modoColor_22222222-2222-4222-8222-222222222222'
      ],
    ).toBeUndefined();
  });
});
