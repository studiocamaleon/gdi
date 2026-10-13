import {
  activarPouch,
  pouchParaFormato,
  validarConfigPouch,
  POUCH_DEFAULT,
} from '../pouch-copiado';
import { calcularHojas } from '../adaptador';
import { runNestingForPaso } from '../../motor-universal/nesting-dispatcher';
const variante = {
  id: 'pouch-a4-ficticio',
  materiaPrimaId: 'sobres-ficticios',
  nombre: 'Pouch A4 de prueba',
  anchoMm: 216,
  altoMm: 303,
  margenMm: 3,
};
const config = {
  ...POUCH_DEFAULT,
  centroCostoId: 'centro-ficticio',
  formatos: [{ tamano: 'A4', varianteId: variante.id }],
};
it.each([1, 5, 10])(
  'consume un pouch por hoja física para %i hojas',
  async (hojas) => {
    const a = activarPouch(
      { configPasoId: 'pouch', config, variantes: [variante] },
      'A4',
      210,
      297,
      hojas,
    );
    expect(a.error).toBeNull();
    const paso = {
      configPasoId: 'pouch',
      familiaCodigo: 'plastificado_pouch',
      modoTiempo: 'T-2',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      paramsPasoJson: { fuentePiezas: 'output:copiadoHojasPouch' },
      slots: [],
      maquina: null,
    };
    const resultado = await runNestingForPaso(
      paso as never,
      {
        cantidad: hojas,
        piezas: [{ cantidad: hojas, anchoMm: 200, altoMm: 287 }],
        ...a.additions,
      },
      {
        id: variante.id,
        subfamilia: 'LAMINADO_POUCH',
        atributosVarianteJson: {
          anchoMm: 216,
          altoMm: 303,
          margenNoUsableMm: 3,
        },
      },
    );
    expect(resultado).toMatchObject({
      unidad: 'pouches',
      cantidadCalculada: hojas,
      piezasPorPouch: 1,
    });
  },
);
it('doble faz impar usa hojas físicas y copias, sin duplicar el plastificado por cara', () => {
  const { hojas } = calcularHojas(5, 2, 2);
  const a = activarPouch(
    { configPasoId: 'pouch', config, variantes: [variante] },
    'A4',
    210,
    297,
    hojas,
  );
  expect(a.additions?.copiadoHojasPouch).toEqual([
    { cantidad: 6, anchoMm: 210, altoMm: 297 },
  ]);
});
it('no ofrece un tamaño sin sobre ni permite encajar una hoja dentro del borde sellado', () => {
  expect(
    activarPouch(
      { configPasoId: 'pouch', config, variantes: [variante] },
      'A3',
      297,
      420,
      1,
    ).error,
  ).toContain('A3');
  expect(pouchParaFormato({ ...variante, margenMm: 4 }, 210, 297)).toBe(false);
  expect(pouchParaFormato(variante, 297, 210)).toBe(true);
  expect(
    pouchParaFormato({ ...variante, anchoMm: 303, altoMm: 426 }, 210, 297),
  ).toBe(false);
});
it('una variante retirada no deja una terminación gratuita en el pedido', () => {
  expect(
    activarPouch(
      { configPasoId: 'pouch', config, variantes: [] },
      'A4',
      210,
      297,
      1,
    ).additions,
  ).toBeNull();
});
it('valida empresa, disponibilidad y centro de costo sin aceptar IDs ajenos', async () => {
  const db = {
    centroCosto: { count: jest.fn().mockResolvedValue(0) },
    materiaPrimaVariante: { findMany: jest.fn().mockResolvedValue([]) },
  };
  await expect(
    validarConfigPouch(db as never, 'empresa-ficticia', config, true),
  ).rejects.toThrow('centro de costo');
  expect(db.centroCosto.count).toHaveBeenCalledWith({
    where: {
      id: config.centroCostoId,
      tenantId: 'empresa-ficticia',
      activo: true,
    },
  });
  db.centroCosto.count.mockResolvedValue(1);
  await expect(
    validarConfigPouch(db as never, 'empresa-ficticia', config, true),
  ).rejects.toThrow('pouch de A4');
  expect(db.materiaPrimaVariante.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        tenantId: 'empresa-ficticia',
        activo: true,
        materiaPrima: {
          tenantId: 'empresa-ficticia',
          activo: true,
          subfamilia: 'LAMINADO_POUCH',
        },
      },
    }),
  );
});
it('no habilita la función sin centro, formatos o tiempo válido', async () => {
  for (const c of [
    POUCH_DEFAULT,
    { ...config, minutosPorHoja: 0 },
    { ...config, minutosPorHoja: NaN },
  ])
    await expect(
      validarConfigPouch({} as never, 'empresa-ficticia', c, true),
    ).rejects.toThrow();
});
