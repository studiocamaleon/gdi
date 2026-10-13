import { cargarAnilladoMotorCopiado } from '../anillado-motor';
import type { PasoCargado, SlotCargado } from '../../motor-universal/tipos';
import {
  CC_PRODUCTO_CODIGO,
  CC_RUTA_CODIGO,
  CC_SISTEMA_CODIGO,
} from '../provisionar-plantilla';

const producto = {
  codigo: CC_PRODUCTO_CODIGO,
  sistemaCodigo: CC_SISTEMA_CODIGO,
};
const ruta = { codigo: CC_RUTA_CODIGO, sistemaCodigo: CC_SISTEMA_CODIGO };
function entorno() {
  const slots = ['anillo', 'tapa_frontal', 'tapa_posterior'].map(
    (slotCodigo) => ({
      id: `slot-${slotCodigo}`,
      slotCodigo,
      materialVarianteId: null,
      formula: 'por_unidad_productiva',
      aplicaMultiCaras: false,
      modoSeleccion:
        slotCodigo === 'anillo' ? 'MOTOR_ELIGE_AUTO' : 'COMERCIAL_ELIGE',
      candidatos: [
        {
          id: 'candidato-retirado',
          materiaPrimaId: 'retirado',
          defaultVarianteId: 'retirada',
          orden: 0,
          variantes: [],
        },
      ],
    }),
  ) as SlotCargado[];
  const pasos = [
    { familiaCodigo: 'encuadernado_anillado', slots },
  ] as PasoCargado[];
  const findMany = jest.fn().mockResolvedValue([
    {
      id: 'anillo-nuevo',
      subfamilia: 'ANILLADO_ENCUADERNACION',
      variantes: [{ id: 'anillo-v' }],
    },
    {
      id: 'tapa-nueva',
      subfamilia: 'TAPA_ENCUADERNACION',
      variantes: [{ id: 'tapa-v' }],
    },
  ]);
  const db = { materiaPrima: { findMany } };
  return {
    slots,
    pasos,
    findMany,
    cargar: (p = producto, r = ruta) =>
      cargarAnilladoMotorCopiado(db as never, 'empresa-ficticia', p, r, pasos),
  };
}
it('separa anillos y tapas y retira los candidatos históricos', async () => {
  const e = entorno();
  await e.cargar();
  expect(e.slots.map((s) => s.candidatos.map((c) => c.materiaPrimaId))).toEqual(
    [['anillo-nuevo'], ['tapa-nueva'], ['tapa-nueva']],
  );
  expect(e.findMany.mock.calls[0][0].where).toMatchObject({
    tenantId: 'empresa-ficticia',
    activo: true,
    variantes: { some: { tenantId: 'empresa-ficticia', activo: true } },
  });
  expect(e.findMany.mock.calls[0][0].select.variantes.where).toEqual({
    tenantId: 'empresa-ficticia',
    activo: true,
  });
});
it.each(['producto', 'ruta', 'marcaProducto', 'marcaRuta'])(
  'no amplía materiales de recetas ajenas: %s',
  async (caso) => {
    const e = entorno();
    const p = { ...producto };
    const r = { ...ruta };
    if (caso === 'producto') p.codigo = 'producto-usuario';
    if (caso === 'ruta') r.codigo = 'ruta-usuario';
    if (caso === 'marcaProducto') p.sistemaCodigo = 'otro-sistema';
    if (caso === 'marcaRuta') r.sistemaCodigo = 'otro-sistema';
    const antes = structuredClone(e.slots);
    await e.cargar(p, r);
    expect(e.findMany).not.toHaveBeenCalled();
    expect(e.slots).toEqual(antes);
  },
);
it('conserva selecciones fijas y materiales de otros pasos', async () => {
  const e = entorno();
  e.slots.forEach((s) => {
    s.modoSeleccion = 'HARDCODED';
  });
  await e.cargar();
  expect(e.findMany).not.toHaveBeenCalled();
  e.slots[0].modoSeleccion = 'MOTOR_ELIGE_AUTO';
  e.pasos[0].familiaCodigo = 'otro-paso';
  await e.cargar();
  expect(e.findMany).not.toHaveBeenCalled();
});
