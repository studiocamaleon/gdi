import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MetodoDepreciacionMaquinaDto,
  UpsertCentroRecursosMaquinariaDto,
} from './upsert-centro-recursos-maquinaria.dto';

describe('Costos DTO validation', () => {
  it('rechaza porcentajes de maquinaria mayores a 100', async () => {
    const dto = plainToInstance(UpsertCentroRecursosMaquinariaDto, {
      recursos: [
        {
          centroCostoRecursoId: '11111111-1111-1111-1111-111111111111',
          metodoDepreciacion: MetodoDepreciacionMaquinaDto.lineal,
          valorCompra: 1000,
          valorResidual: 0,
          vidaUtilMeses: 12,
          potenciaNominalKw: 1,
          factorCargaPct: 120,
          tarifaEnergiaKwh: 10,
          horasProgramadasMes: 10,
          disponibilidadPct: 101,
          eficienciaPct: 850,
          mantenimientoMensual: 0,
          segurosMensual: 0,
          otrosFijosMensual: 0,
        },
      ],
    });

    const errors = await validate(dto);

    expect(JSON.stringify(errors)).toContain('factorCargaPct');
    expect(JSON.stringify(errors)).toContain('disponibilidadPct');
    expect(JSON.stringify(errors)).toContain('eficienciaPct');
  });
});
