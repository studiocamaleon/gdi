import { BadRequestException } from '@nestjs/common';
import { validarContenidoTarifario } from '../contenido-tarifario';
import { contenidoEjemplo } from './fixtures';

describe('Contrato persistido de tarifarios', () => {
  it('conserva precios exactos, pendientes y reglas sin inyectar valores por defecto', () => {
    const c = contenidoEjemplo();
    expect(validarContenidoTarifario(c)).toEqual(c);
    expect(validarContenidoTarifario(c)).not.toBe(c);
  });

  it.each([
    null,
    [],
    {},
    { ...contenidoEjemplo(), tenantId: 'ajeno' },
    { ...contenidoEjemplo(), esquema: 2 },
    { ...contenidoEjemplo(), monedaCodigo: 'XXX' },
    { ...contenidoEjemplo(), hojas: null, cad: null },
  ])('rechaza contenido inválido o campos no admitidos %#', (c) => {
    expect(() => validarContenidoTarifario(c)).toThrow(BadRequestException);
  });

  it.each([
    { rangosGenerales: [10, 100] },
    { rangosGenerales: [1, 100, 100] },
    { rangosGenerales: [1, 2.5] },
    { filas: null },
    {
      filas: [
        ...contenidoEjemplo().hojas!.filas,
        ...contenidoEjemplo().hojas!.filas,
      ],
    },
    { reglas: { ...contenidoEjemplo().hojas!.reglas, unidad: 'ML' } },
  ])('comparte las reglas comerciales de hojas %#', (cambios) => {
    const c = contenidoEjemplo();
    expect(() =>
      validarContenidoTarifario({ ...c, hojas: { ...c.hojas, ...cambios } }),
    ).toThrow(BadRequestException);
  });

  it.each(['-1', '1e2', '1,50', '0.123456789', '1000000000000000000.1'])(
    'rechaza el precio %s sin redondearlo',
    (precioUnitario) => {
      const c = contenidoEjemplo();
      c.hojas!.filas[0].precios[0].precioUnitario = precioUnitario;
      expect(() => validarContenidoTarifario(c)).toThrow(BadRequestException);
    },
  );

  it('admite una sección sin la otra y celdas ausentes o explícitamente cero', () => {
    const c = contenidoEjemplo();
    c.cad = null;
    c.hojas!.filas[0].precios = [{ desdeCantidad: 1, precioUnitario: '0' }];
    expect(validarContenidoTarifario(c)).toEqual(c);
    expect(
      validarContenidoTarifario({
        ...c,
        hojas: null,
        cad: contenidoEjemplo().cad,
      }),
    ).toMatchObject({ hojas: null });
  });

  it('rechaza campos extra anidados y precios de tramos inexistentes', () => {
    const c = contenidoEjemplo();
    const precio = c.hojas!.filas[0].precios[0];
    Object.assign(precio, { descuentoOculto: 10 });
    expect(() => validarContenidoTarifario(c)).toThrow(BadRequestException);
    c.hojas!.filas[0].precios[0] = { desdeCantidad: 99, precioUnitario: '100' };
    expect(() => validarContenidoTarifario(c)).toThrow(BadRequestException);
  });

  it('no acepta otro sistema de cobertura en CAD ni bandas duplicadas numéricamente', () => {
    const c = contenidoEjemplo();
    c.cad!.reglas.cobertura = 'DIFERENCIADA';
    expect(() => validarContenidoTarifario(c)).toThrow(BadRequestException);
    c.cad!.reglas.cobertura = 'UNICA';
    c.cad!.rangosGenerales = ['0', '1', '1.00'];
    expect(() => validarContenidoTarifario(c)).toThrow(BadRequestException);
  });

  it('valida unidades, redondeo CAD y límites de preparación y mínimo', () => {
    const c = contenidoEjemplo();
    c.cad!.reglas.redondeo = { modalidad: 'HACIA_ARRIBA', incrementoMl: '0' };
    expect(() => validarContenidoTarifario(c)).toThrow(BadRequestException);
    c.cad!.reglas.redondeo = { modalidad: 'SIN_REDONDEO' };
    c.composicion.preparacion = { modalidad: 'FIJA_PEDIDO', importe: '-1' };
    expect(() => validarContenidoTarifario(c)).toThrow(BadRequestException);
    c.composicion.preparacion = { modalidad: 'FIJA_PEDIDO', importe: '250.50' };
    c.composicion.minimo = { modalidad: 'IMPORTE_PEDIDO', importe: '1000' };
    expect(validarContenidoTarifario(c)).toEqual(c);
  });
});
