import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ReplaceCentroLineasDto,
  SeccionCentroCostoLineaDto,
} from './replace-centro-lineas.dto';

describe('Lineas del centro de costo', () => {
  const linea = (extra: Record<string, unknown>) =>
    plainToInstance(ReplaceCentroLineasDto, {
      lineas: [{ nombre: 'X', ...extra }],
    });

  it('un gasto general no necesita los campos de empleado ni de activo fijo', async () => {
    const errors = await validate(
      linea({
        seccion: SeccionCentroCostoLineaDto.gasto_general,
        valorMensual: 100,
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('una linea de empleado exige sueldo y porcentaje de cargas', async () => {
    const errors = await validate(
      linea({ seccion: SeccionCentroCostoLineaDto.empleado }),
    );

    expect(errors).toHaveLength(1);
    const campos = Object.keys(
      errors[0].children?.[0]?.children?.reduce(
        (acc, e) => ({ ...acc, [e.property]: true }),
        {},
      ) ?? {},
    );
    expect(campos).toEqual(
      expect.arrayContaining(['salarioMensual', 'cargasPct']),
    );
  });

  it('un activo fijo con vida util cero se rechaza: no se divide por cero', async () => {
    const errors = await validate(
      linea({
        seccion: SeccionCentroCostoLineaDto.activo_fijo,
        vidaUtilRestanteMeses: 0,
        valorActual: 5000,
        valorFinalVida: 500,
      }),
    );

    expect(errors).toHaveLength(1);
  });

  it('mandar el importe mensual se rechaza: el total lo calcula el servidor', async () => {
    const dto = plainToInstance(ReplaceCentroLineasDto, {
      lineas: [
        {
          seccion: SeccionCentroCostoLineaDto.gasto_general,
          nombre: 'Energia',
          valorMensual: 100,
          importeMensual: 999999,
        },
      ],
    });

    // Las mismas opciones que el ValidationPipe global de main.ts: sin ellas
    // la propiedad desconocida sobrevive al plainToInstance y el test no
    // estaría midiendo lo que pasa de verdad en la ruta.
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors)).toContain('importeMensual');
  });
});
