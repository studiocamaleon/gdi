import { ValidationPipe } from '@nestjs/common';

import {
  UpsertConfiguracionBaseFamiliaSistemaDto,
  UpsertProductoConfigPasoDto,
} from '../dto/producto-ruta.dto';
import { FAMILIAS } from '../pasos/familias';

describe('DTO de configuración base de familia del sistema', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('declara corte láser exclusivamente como productividad de máquina T-3', () => {
    expect(FAMILIAS.corte_laser.modosTiempoSoportados).toEqual(['T-3']);
  });

  it('acepta la configuración sin rutaPasoId porque el código viene en la URL', async () => {
    await expect(
      pipe.transform(
        { modoTiempo: 'T-3', mecanismoCantidad: 'CALCULADO_POR_PASO' },
        {
          type: 'body',
          metatype: UpsertConfiguracionBaseFamiliaSistemaDto,
        },
      ),
    ).resolves.toEqual({
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
    });
  });

  it('mantiene el UUID obligatorio para configurar un paso concreto de ruta', async () => {
    await expect(
      pipe.transform(
        { rutaPasoId: 'corte_laser', modoTiempo: 'T-3' },
        { type: 'body', metatype: UpsertProductoConfigPasoDto },
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining(['rutaPasoId must be a UUID']),
      },
    });
  });
});
