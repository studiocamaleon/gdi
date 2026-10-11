import { cargarPapelesMotorCopiado } from '../papeles-motor';
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
const objeto = (valor: Record<string, unknown>): unknown =>
  expect.objectContaining(valor);
function entorno() {
  const slot = {
    id: 'slot-ficticio',
    slotCodigo: 'sustrato_principal',
    modoSeleccion: 'COMERCIAL_ELIGE',
    candidatos: [
      {
        id: 'candidato-original',
        materiaPrimaId: 'papel-obra',
        defaultVarianteId: 'variante-retirada',
        orden: 0,
        variantes: [{ varianteId: 'obra-activa', orden: 0 }],
      },
    ],
  } as SlotCargado;
  const paso = {
    familiaCodigo: 'impresion_por_hoja',
    slots: [slot],
  } as PasoCargado;
  const papeles = [
    {
      id: 'papel-obra',
      variantes: [{ id: 'obra-activa' }, { id: 'obra-nueva' }],
    },
    { id: 'papel-opalina', variantes: [{ id: 'opalina-activa' }] },
  ];
  const findMany = jest.fn().mockResolvedValue(papeles);
  const db = { materiaPrima: { findMany } };
  const cargar = (
    p: { codigo: string; sistemaCodigo: string | null } = producto,
    r: { codigo: string; sistemaCodigo: string | null } = ruta,
  ) => cargarPapelesMotorCopiado(db as never, 'empresa-ficticia', p, r, [paso]);
  return { slot, paso, papeles, findMany, cargar };
}
it('incorpora un papel y una variante posteriores a la plantilla sin escribir en la base', async () => {
  const e = entorno();
  expect(
    e.slot.candidatos.flatMap((c) => c.variantes.map((v) => v.varianteId)),
  ).not.toContain('opalina-activa');
  await e.cargar();
  expect(e.slot.candidatos).toEqual([
    {
      id: 'candidato-original',
      materiaPrimaId: 'papel-obra',
      defaultVarianteId: null,
      orden: 0,
      variantes: [
        { varianteId: 'obra-activa', orden: 0 },
        { varianteId: 'obra-nueva', orden: 1 },
      ],
    },
    {
      id: 'papel-opalina',
      materiaPrimaId: 'papel-opalina',
      defaultVarianteId: null,
      orden: 1,
      variantes: [{ varianteId: 'opalina-activa', orden: 0 }],
    },
  ]);
  expect(e.findMany).toHaveBeenCalledWith(
    objeto({
      where: {
        tenantId: 'empresa-ficticia',
        activo: true,
        subfamilia: 'SUSTRATO_HOJA',
        variantes: { some: { tenantId: 'empresa-ficticia', activo: true } },
      },
      select: objeto({
        variantes: objeto({
          where: { tenantId: 'empresa-ficticia', activo: true },
        }),
      }),
    }),
  );
});
it('no conserva papeles retirados ni variantes inactivas del default histórico', async () => {
  const e = entorno();
  e.findMany.mockResolvedValue([]);
  await e.cargar();
  expect(e.slot.candidatos).toEqual([]);
});
it.each([
  [{ ...producto, codigo: 'producto-de-usuario' }, ruta],
  [{ ...producto, sistemaCodigo: null }, ruta],
  [producto, { ...ruta, codigo: 'ruta-de-usuario' }],
  [producto, { ...ruta, sistemaCodigo: null }],
])(
  'conserva las restricciones de cualquier producto o ruta ajeno a la plantilla',
  async (p, r) => {
    const e = entorno();
    const antes = structuredClone(e.slot);
    await e.cargar(p, r);
    expect(e.findMany).not.toHaveBeenCalled();
    expect(e.slot).toEqual(antes);
  },
);
it.each(['HARDCODED', 'HEREDA_DE_PASO', 'MOTOR_ELIGE_AUTO'])(
  'no reemplaza slots con modo %s',
  async (modo) => {
    const e = entorno();
    e.slot.modoSeleccion = modo;
    await e.cargar();
    expect(e.findMany).not.toHaveBeenCalled();
  },
);
it.each(['impresion_por_area', 'encuadernado_anillado'])(
  'no extiende la oferta de otros pasos: %s',
  async (familia) => {
    const e = entorno();
    e.paso.familiaCodigo = familia;
    await e.cargar();
    expect(e.findMany).not.toHaveBeenCalled();
  },
);
it('no modifica otros materiales del paso de impresión', async () => {
  const e = entorno();
  e.slot.slotCodigo = 'tinta';
  await e.cargar();
  expect(e.findMany).not.toHaveBeenCalled();
});
