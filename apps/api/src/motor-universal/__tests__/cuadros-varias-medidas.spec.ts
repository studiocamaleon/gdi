import { resolverJobContextComponente } from '../../productos-servicios/componentes-configuracion';
import { runDerivador } from '../derivadores';
import type { JobContext } from '../tipos';

const piezas = [
  { cantidad: 1, anchoMm: 250, altoMm: 350 },
  { cantidad: 2, anchoMm: 450, altoMm: 550 },
];
const configuracion = {
  version: 1,
  bindings: [
    {
      clave: 'cantidad',
      origen: 'FORMULA',
      regla: {
        campoPadre: 'cantidad',
        operador: 'MULTIPLICAR',
        valor: 1,
      },
    },
    ...['anchoMm', 'altoMm'].map((lado) => ({
      clave: `medidaCustomMm.${lado}`,
      origen: 'FORMULA',
      regla: {
        campoPadre: `medidaCustomMm.${lado}`,
        operador: 'SUMAR',
        valor: 80,
        fuente: { tipo: 'PADRE', campo: `medidaCustomMm.${lado}` },
      },
    })),
    { clave: 'modoColor_impresion', origen: 'DEFAULT_HIJO', valor: 'CMYK' },
  ],
};
const resolver = (ps = piezas, config = configuracion) =>
  resolverJobContextComponente({
    configuracion: config,
    contextoPadre: {
      cantidad: ps.reduce((n, p) => n + p.cantidad, 0),
      piezas: ps,
    },
    codigoComponente: 'TELA-DE-PRUEBA',
    cantidadLegacy: 1,
  });
const bastidor = (ps = piezas, extra = {}) =>
  runDerivador(
    'bastidor_rectangular',
    {
      cantidad: ps.reduce((n, p) => n + p.cantidad, 0),
      piezas: ps,
      ...extra,
    } as JobContext,
    { tipoBastidor: 'simple', sepRefuerzoVcm: 100 },
    { seccion: '25x25 mm', largoBarra: 3, tipoPerfil: 'macizo' },
  )!;

describe('cuadros con varias medidas', () => {
  it('hereda cada medida con su demasía, conservando cantidades y una sola colección', () => {
    const ctx = resolver();
    expect(ctx.piezas).toMatchObject([
      { cantidad: 1, anchoMm: 330, altoMm: 430 },
      { cantidad: 2, anchoMm: 530, altoMm: 630 },
    ]);
    expect(ctx.cantidad).toBe(3);
    expect(ctx.medidaCustomMm).toBeUndefined();
    expect(ctx.piezaAreaTotalM2).toBeCloseTo(0.8097);
    expect(ctx.piezaPerimetroTotalM).toBeCloseTo(6.16);
    expect(ctx.modoColor_impresion).toBe('CMYK');
    expect(piezas[0].anchoMm).toBe(250);
  });

  it('aplica un multiplicador de componentes sin volver a multiplicar las cantidades del pedido', () => {
    const config = structuredClone(configuracion);
    config.bindings[0].regla!.valor = 2;
    expect(resolver(piezas, config).piezas).toMatchObject([
      { cantidad: 2, anchoMm: 330 },
      { cantidad: 4, anchoMm: 530 },
    ]);
  });

  it('rechaza medidas calculadas negativas y repartos de cantidades fraccionarias', () => {
    const config = structuredClone(configuracion);
    config.bindings[1].regla!.valor = -500;
    expect(() => resolver(piezas, config)).toThrow('medidas calculadas');
    config.bindings[1].regla!.valor = 80;
    config.bindings[0].regla!.valor = 0.5;
    expect(() => resolver(piezas, config)).toThrow('piezas enteras');
  });

  it('no cambia un componente de medidas fijas aunque el padre tenga varios tamaños', () => {
    const ctx = resolverJobContextComponente({
      configuracion: {
        version: 1,
        bindings: [
          { clave: 'cantidad', origen: 'PADRE', padreClave: 'cantidad' },
          { clave: 'medidaCustomMm.anchoMm', origen: 'FIJO', valor: 50 },
          { clave: 'medidaCustomMm.altoMm', origen: 'FIJO', valor: 60 },
        ],
      },
      contextoPadre: { cantidad: 3, piezas },
      codigoComponente: 'ETIQUETA',
      cantidadLegacy: 1,
    });
    expect(ctx.piezas).toEqual([{ cantidad: 3, anchoMm: 50, altoMm: 60 }]);
  });

  it('calcula todas las estructuras y optimiza la compra conjunta de barras', () => {
    const r = bastidor();
    expect(r.diagnostico).toBeUndefined();
    // 1,10 m del primero + 2 × 1,90 m del segundo.
    expect(r.magnitudes.mlTotal).toBeCloseTo(4.9);
    expect(r.magnitudes.cortes).toBe(12);
    expect(r.despieces!.perfil_estructural).toEqual([
      250, 250, 300, 300, 450, 450, 500, 500, 450, 450, 500, 500,
    ]);
    expect(r.traza!.estructura).toMatchObject({
      barras: { cantidad: 2, metrosUtiles: 4.9, metrosComerciales: 6 },
      variantes: [
        { cantidad: 1, anchoM: 0.25, altoM: 0.35 },
        { cantidad: 2, anchoM: 0.45, altoM: 0.55 },
      ],
    });
  });

  it('usa las medidas visibles de cada cuadro aunque la tela tenga demasía', () => {
    const r = bastidor(
      piezas.map((p) => ({
        ...p,
        anchoMm: p.anchoMm + 80,
        altoMm: p.altoMm + 80,
      })),
      {
        piezasVisibles: piezas,
        medidaVisibleMm: { anchoMm: 450, altoMm: 550 },
      },
    );
    expect(r.magnitudes.mlTotal).toBeCloseTo(4.9);
  });

  it('rechaza una segunda medida que no cabe en el perfil o la barra', () => {
    expect(
      bastidor([piezas[0], { cantidad: 1, anchoMm: 450, altoMm: 40 }])
        .diagnostico?.codigo,
    ).toBe('perfil_no_cabe_en_bastidor');
    expect(
      bastidor([piezas[0], { cantidad: 1, anchoMm: 4000, altoMm: 550 }])
        .diagnostico?.codigo,
    ).toBe('perfil_barra_insuficiente');
  });
});
