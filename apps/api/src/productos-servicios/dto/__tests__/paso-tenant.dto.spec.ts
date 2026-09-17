import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearPasoTenantDto } from '../paso-tenant.dto';

describe('CrearPasoTenantDto', () => {
  it('acepta el tipo y las operaciones de un paso compuesto con whitelist estricta', async () => {
    const dto = plainToInstance(CrearPasoTenantDto, {
      nombre: 'Ensamblaje de cartel',
      plantillaCodigo: 'trabajo_manual',
      tipoPaso: 'COMPUESTO',
      operacionesCompuestas: [],
    });

    const errores = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errores).toEqual([]);
  });
});
