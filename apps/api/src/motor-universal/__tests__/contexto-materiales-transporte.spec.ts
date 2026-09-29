import { ValidationPipe } from '@nestjs/common';
import { serializarCotizacion } from '../../../../../src/lib/fuentes-geometria-transporte';
import {
  CotizarAsincronoDto,
  CotizarDto,
  RecotizarItemDto,
} from '../cotizar.dto';

describe('contexto de materiales enviado por la aplicación', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const materiales = [
    {
      varianteId: '22222222-2222-4222-8222-222222222222',
      cantidad: 5,
      unidad: 'hoja',
      consumible: false,
    },
    {
      varianteId: '33333333-3333-4333-8333-333333333333',
      cantidad: 0.8,
      unidad: 'ml',
      consumible: true,
    },
    {
      varianteId: '44444444-4444-4444-8444-444444444444',
      cantidad: null,
      unidad: null,
      consumible: false,
    },
  ];

  it.each([CotizarDto, CotizarAsincronoDto, RecotizarItemDto])(
    'acepta el transporte de %p sin relajar la validación del API',
    async (metatype) => {
      const solicitud = {
        ...(metatype === RecotizarItemDto
          ? {}
          : { productoId: '11111111-1111-4111-8111-111111111111' }),
        jobContext: { cantidad: 1 },
        contextoMateriales: materiales,
      };
      // El contrato de inventario sigue sin ser un contrato válido de cotización.
      await expect(
        pipe.transform(solicitud, { type: 'body', metatype }),
      ).rejects.toMatchObject({ status: 400 });

      const transportada = JSON.parse(serializarCotizacion(solicitud));
      const validada = await pipe.transform(transportada, {
        type: 'body',
        metatype,
      });
      expect(validada.contextoMateriales).toEqual([
        { varianteId: materiales[0].varianteId, cantidad: 5, unidad: 'hoja' },
        { varianteId: materiales[1].varianteId, cantidad: 0.8, unidad: 'ml' },
        { varianteId: materiales[2].varianteId, cantidad: null, unidad: null },
      ]);
    },
  );
});
