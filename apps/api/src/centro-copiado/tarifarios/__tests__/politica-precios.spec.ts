import { BadRequestException } from '@nestjs/common';
import { ORDEN_CANALES_VENTA } from '../../../ordenes-trabajo/canales-venta';
import {
  idsTarifariosPolitica,
  mismaReferenciaPolitica,
  politicaPreciosInicial,
  seleccionarPolitica,
  validarPoliticaPrecios,
  type ReferenciaPoliticaPrecios,
} from '../politica-precios';

const id = '00000000-0000-4000-8000-000000000001';
describe('Política general y excepciones por canal', () => {
  it('inicia todos los canales heredando el motor y crea objetos independientes', () => {
    const p = politicaPreciosInicial();
    expect(validarPoliticaPrecios(p)).toEqual(p);
    expect(Object.keys(p.canales)).toEqual([...ORDEN_CANALES_VENTA]);
    for (const canal of ORDEN_CANALES_VENTA)
      expect(seleccionarPolitica(p, canal)).toEqual({
        canalVenta: canal,
        origen: 'GENERAL',
        politica: { modalidad: 'MOTOR' },
      });
    p.canales.web = { modalidad: 'MOTOR' };
    expect(politicaPreciosInicial().canales.web).toEqual({
      modalidad: 'HEREDAR',
    });
  });

  it('el tarifario general se hereda y las excepciones pueden usar motor o el mismo tarifario', () => {
    const p = politicaPreciosInicial();
    p.general = { modalidad: 'TARIFARIO', tarifarioId: id };
    p.canales.web = { modalidad: 'TARIFARIO', tarifarioId: id };
    p.canales.email = { modalidad: 'MOTOR' };
    expect(seleccionarPolitica(p, 'mostrador')).toMatchObject({
      origen: 'GENERAL',
      politica: p.general,
    });
    expect(seleccionarPolitica(p, 'web')).toMatchObject({
      origen: 'CANAL',
      politica: p.general,
    });
    expect(seleccionarPolitica(p, 'email')).toMatchObject({
      origen: 'CANAL',
      politica: { modalidad: 'MOTOR' },
    });
    expect(idsTarifariosPolitica(p)).toEqual([id]);
  });

  it.each([
    null,
    undefined,
    '',
    'WEB',
    'telefono',
    'vendedor_externo',
    'celular',
    'web ',
    {},
  ])('exige un canal actual explícito: %p', (canal) => {
    expect(() => seleccionarPolitica(politicaPreciosInicial(), canal)).toThrow(
      BadRequestException,
    );
  });

  it.each([
    null,
    {},
    { ...politicaPreciosInicial(), esquema: 2 },
    { ...politicaPreciosInicial(), general: { modalidad: 'HEREDAR' } },
    { ...politicaPreciosInicial(), general: { modalidad: 'TARIFARIO' } },
    {
      ...politicaPreciosInicial(),
      general: { modalidad: 'TARIFARIO', tarifarioId: 'ajeno' },
    },
    {
      ...politicaPreciosInicial(),
      general: { modalidad: 'MOTOR', tarifarioId: id },
    },
    { ...politicaPreciosInicial(), canales: { web: { modalidad: 'HEREDAR' } } },
    {
      ...politicaPreciosInicial(),
      canales: {
        ...politicaPreciosInicial().canales,
        telefono: { modalidad: 'MOTOR' },
      },
    },
    {
      ...politicaPreciosInicial(),
      canales: {
        ...politicaPreciosInicial().canales,
        web: { modalidad: 'HEREDAR', tarifarioId: id },
      },
    },
    { ...politicaPreciosInicial(), tenantId: id },
  ])('rechaza políticas incompletas o ambiguas %#', (p) => {
    expect(() => validarPoliticaPrecios(p)).toThrow(BadRequestException);
  });

  describe('referencia de selección', () => {
    const referencia: ReferenciaPoliticaPrecios = {
      tenantId: 'empresa-ficticia',
      politicaRevision: 3,
      canalVenta: 'web',
      monedaCodigo: 'ARS',
      modalidad: 'TARIFARIO',
      tarifarioId: id,
      versionId: 'version-ficticia',
    };
    it('no depende del orden de las propiedades', () => {
      expect(mismaReferenciaPolitica(referencia, { ...referencia })).toBe(true);
    });
    it.each([
      { tenantId: 'otra-empresa' },
      { politicaRevision: 4 },
      { canalVenta: 'mostrador' as const },
      { monedaCodigo: 'USD' },
      { tarifarioId: 'otro-tarifario' },
      { versionId: 'otra-version' },
    ])('detecta cambios en la selección %#', (cambio) => {
      expect(
        mismaReferenciaPolitica(referencia, { ...referencia, ...cambio }),
      ).toBe(false);
    });
    it('distingue motor y matriz aunque pertenezcan al mismo canal', () => {
      const motor: ReferenciaPoliticaPrecios = {
        tenantId: referencia.tenantId,
        politicaRevision: 3,
        canalVenta: 'web',
        monedaCodigo: 'ARS',
        modalidad: 'MOTOR',
      };
      expect(mismaReferenciaPolitica(referencia, motor)).toBe(false);
      expect(mismaReferenciaPolitica(motor, { ...motor })).toBe(true);
    });
  });
});
