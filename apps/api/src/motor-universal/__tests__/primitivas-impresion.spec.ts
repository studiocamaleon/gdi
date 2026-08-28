import {
  REGISTRO_AVISOS,
  REGISTRO_DESGASTE,
  REGISTRO_SELECCION_PERFIL,
} from '../primitivas';
import type { PasoCargado } from '../tipos';

const simple = {
  id: 'simple',
  nombre: 'Simple faz',
  activo: true,
  detalleJson: { caras: 'SIMPLE_FAZ', gramajeMaxGr: 150 },
};
const doble = {
  id: 'doble',
  nombre: 'Doble faz',
  activo: true,
  detalleJson: { caras: 'DOBLE_FAZ', gramajeMaxGr: 300 },
};

const paso = {
  configPasoId: 'config',
  rutaPasoId: 'ruta',
  rutaPasoOrden: 1,
  familiaCodigo: 'impresion_por_hoja',
  perfilM1Id: simple.id,
  perfilesDisponibles: [doble, simple],
  maquina: { id: 'maquina', nombre: 'Impresora' },
} as unknown as PasoCargado;

describe('primitivas de impresión por hoja', () => {
  it('sin gramaje conserva el perfil default y no depende del orden de carga', () => {
    const seleccionado = REGISTRO_SELECCION_PERFIL.cadena_caras_gramaje(
      paso,
      { cantidad: 1 },
      [doble, simple] as never,
      {
        carasEfectivas: () => 1,
        perfilEsDobleFaz: (perfil) =>
          (perfil.detalleJson as { caras?: string }).caras === 'DOBLE_FAZ',
        elegirPorEscalonDeGramaje: () => null,
        numeroPositivo: () => undefined,
      },
    );

    expect(seleccionado?.id).toBe(simple.id);
  });

  it('avisa cuando el gramaje supera el máximo del perfil elegido', () => {
    const errores: Array<{ codigo: string }> = [];
    REGISTRO_AVISOS.gramaje_perfil_fuera_rango(
      paso,
      { cantidad: 1, gramajeMaterialGr: 320 } as never,
      doble as never,
      errores as never,
      {} as never,
    );

    expect(errores).toEqual([
      expect.objectContaining({ codigo: 'gramaje_perfil_fuera_rango' }),
    ]);
  });

  it('mantiene el redondeo hacia arriba de clicks A4 equivalentes', () => {
    const clicks = REGISTRO_DESGASTE.clicks_a4(
      paso,
      { cantidad: 1, caras: 1 },
      null,
      {
        resolverCantidad: () => 1,
        carasConsumible: () => 1,
        factorVelocidad: () => 2.31,
      },
    );

    expect(clicks).toBe(3);
  });
});
