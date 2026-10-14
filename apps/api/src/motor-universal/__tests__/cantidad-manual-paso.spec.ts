import {
  fixtureCantidadManual,
  motorCantidadManual,
} from '../../../test/cantidad-manual-fixture';
import type { JobContext } from '../tipos';
import { errorConfigCantidadManual } from '../cantidad-manual-paso';

async function cotizar(
  value: unknown = 5,
  activo = true,
  dificultad = 'normal',
) {
  const fixture = fixtureCantidadManual();
  const ctx: JobContext = {
    ...fixture.contexto,
    cantidadManual_desploteo: value,
    opcionalesActivados: { desploteo: activo },
    nivelPaso_desploteo: dificultad,
  };
  return motorCantidadManual().cotizar(
    {
      tenantId: 'empresa-ficticia',
      productoId: 'producto',
      periodo: '2026-10',
      jobContext: ctx,
    },
    { productoPrecargado: fixture.producto },
  );
}
describe('Cantidad propia por paso: 12 m² de ploteo y 5 m² de desploteo', () => {
  it('separa material, tiempos y costo con el motor completo', async () => {
    const r = await cotizar();
    expect(r.errores).toEqual([]);
    expect(r.exitoso).toBe(true);
    const [ploteo, desploteo] = r.cotizacion!.pasos;
    expect(ploteo.materiales?.[0]).toMatchObject({
      cantidad: 12,
      costoTotal: 24000,
    });
    expect(ploteo.tiempo).toMatchObject({
      runMin: 60,
      totalMin: 60,
      costo: 6000,
    });
    expect(desploteo.cantidadManual).toEqual({
      valor: 5,
      etiqueta: 'Superficie a desplotear',
      unidad: 'm²',
    });
    expect(desploteo.tiempo).toMatchObject({
      runMin: 37.5,
      totalMin: 38,
      costo: 3800,
    });
    expect(ploteo.costoTotal + desploteo.costoTotal).toBe(35000);
  });
  it('la dificultad cambia el ritmo, nunca la superficie del ploteo', async () => {
    const r = await cotizar(5, true, 'dificil');
    expect(r.exitoso).toBe(true);
    expect(r.cotizacion!.pasos[1].tiempo).toMatchObject({
      runMin: 75,
      costo: 7500,
    });
    expect(r.cotizacion!.pasos[0].materiales?.[0].cantidad).toBe(12);
  });
  it.each([null, 0, -1, '5', true, {}, []])(
    'rechaza la cantidad inválida %j en un paso activo sin heredar los 12 m²',
    async (value) => {
      const r = await cotizar(value);
      expect(r.exitoso).toBe(false);
      expect(r.errores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codigo: 'cantidad_manual_invalida' }),
        ]),
      );
    },
  );
  it('no exige cantidad ni cobra un paso desactivado', async () => {
    const r = await cotizar(null, false);
    expect(r.exitoso).toBe(true);
    expect(r.cotizacion!.pasos[1]).toMatchObject({
      activado: false,
      costoTotal: 0,
    });
  });
  it('admite decimales y no multiplica la cantidad del paso por la del producto', async () => {
    const r = await cotizar(2.5);
    expect(r.cotizacion!.pasos[1].tiempo?.runMin).toBe(18.75);
  });
  it('configurar la fuente exige nombre y unidad', () => {
    const base = { productivityQuantitySource: 'cantidad_manual' };
    expect(errorConfigCantidadManual(base)).toContain('nombre');
    expect(
      errorConfigCantidadManual({
        ...base,
        cantidadManual: { etiqueta: 'Superficie' },
      }),
    ).toContain('unidad');
  });
});

describe('activación y compatibilidad de la cantidad ingresada', () => {
  it('exige la cantidad en opcionales arrastrados y sólo en condicionales que corren', async () => {
    const f = fixtureCantidadManual();
    f.ploteo.requiereRutaPasoIds = ['desploteo'];
    const ctx = {
      ...f.contexto,
      cantidadManual_desploteo: null,
      opcionalesActivados: {},
    };
    const input = {
      tenantId: 'empresa-ficticia',
      productoId: 'producto',
      periodo: '2026-10',
      jobContext: ctx,
    };
    let r = await motorCantidadManual().cotizar(input, {
      productoPrecargado: f.producto,
    });
    expect(r.errores.some((e) => e.codigo === 'cantidad_manual_invalida')).toBe(
      true,
    );
    f.ploteo.requiereRutaPasoIds = [];
    f.desploteo.modoActivacion = 'CONDICIONAL';
    f.desploteo.condicionActivacionJson = { '>': [{ var: 'cantidad' }, 1] };
    r = await motorCantidadManual().cotizar(input, {
      productoPrecargado: f.producto,
    });
    expect(r.exitoso).toBe(true);
    expect(r.cotizacion!.pasos[1].activado).toBe(false);
    r = await motorCantidadManual().cotizar(
      { ...input, jobContext: { ...ctx, cantidad: 2 } },
      { productoPrecargado: f.producto },
    );
    expect(r.errores.some((e) => e.codigo === 'cantidad_manual_invalida')).toBe(
      true,
    );
  });
  it('usa la cantidad propia aunque queden valores antiguos de tiempo manual o fijo', async () => {
    const f = fixtureCantidadManual();
    Object.assign(f.desploteo.paramsPasoJson!, {
      horasEstimadas: 10,
      tiempoManual: { habilitado: true, obligatorio: true },
    });
    const r = await motorCantidadManual().cotizar(
      {
        tenantId: 'empresa-ficticia',
        productoId: 'producto',
        periodo: '2026-10',
        jobContext: {
          ...f.contexto,
          cantidad: 3,
          tiempoManualMin_desploteo: 100,
        },
      },
      { productoPrecargado: f.producto },
    );
    expect(r.exitoso).toBe(true);
    expect(r.cotizacion!.pasos[1].tiempo?.runMin).toBe(37.5);
  });
  it('rechaza un paso sin ritmo en vez de cotizar su trabajo en cero', async () => {
    const f = fixtureCantidadManual();
    Object.assign(f.desploteo.paramsPasoJson!, {
      productivityValue: 0,
      niveles: null,
    });
    const r = await motorCantidadManual().cotizar(
      {
        tenantId: 'empresa-ficticia',
        productoId: 'producto',
        periodo: '2026-10',
        jobContext: f.contexto,
      },
      { productoPrecargado: f.producto },
    );
    expect(r.exitoso).toBe(false);
    expect(
      r.errores.some((e) => e.codigo === 'cantidad_manual_sin_ritmo'),
    ).toBe(true);
  });
});
