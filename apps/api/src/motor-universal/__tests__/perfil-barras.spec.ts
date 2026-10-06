import { MotorUniversalService } from '../motor.service';
import { runDerivador } from '../derivadores';
import { derivacionesDelJobContext } from '../derivadores/tipos';
import {
  calcularBarrasNecesarias,
  calcularEstructuraBastidor,
  parsearParamsEstructuraBastidor,
  parsearPerfilEstructural,
} from '../estructura-bastidor';
import {
  materialUnitConversion,
  materialPriceInUseUnit,
  validateMaterialUnits,
} from '../../inventario/material-units';
import {
  normalizarPerfilEstructural,
  seccionPerfil,
  errorPerfilEstructural,
} from '../../inventario/perfil-estructural';
import type { JobContext } from '../tipos';

const job = () =>
  ({
    cantidad: 1,
    piezas: [{ cantidad: 1, anchoMm: 2400, altoMm: 1200 }],
    profundidadMm: 180,
  }) as unknown as JobContext;
const attrs = { seccion: '40×40 mm', largoBarra: 6, espesor: 1.6 };
const context = {
  templateId: 'perfil_estructural_v1',
  atributos: attrs,
  unidadCompra: 'BARRA',
  unidadStock: 'BARRA',
  unidadUso: 'METRO_LINEAL',
  unidadPrecio: 'BARRA',
};

it.each(['20x30 mm', '20×30', '2x3 cm', '20,0 × 30,0 mm'])(
  'interpreta ambos lados y las unidades de %s',
  (seccion) => {
    expect(seccionPerfil({ seccion })).toEqual({ ancho: 20, alto: 30 });
    expect(
      parsearPerfilEstructural({ seccion, desarrolloSeccion: 0.08 }),
    ).toEqual({ ladoM: 0.02, profundidadM: 0.03, desarrolloM: 0.1 });
  },
);
it('los campos estructurados mandan y no altera perfiles no rectangulares', () => {
  expect(
    normalizarPerfilEstructural({
      seccion: '40x40',
      seccionAnchoMm: 20,
      seccionAltoMm: '30,5',
    }).seccion,
  ).toBe('20×30.5 mm');
  expect(normalizarPerfilEstructural({ seccion: 'abrazadera' })).toEqual({
    seccion: 'abrazadera',
  });
  expect(seccionPerfil({ seccion: '20x30', seccionAnchoMm: '' })).toBeNull();
  expect(errorPerfilEstructural({ seccion: '20x30', espesor: 10 })).toContain(
    'espesor',
  );
});
it('girar el caño cambia el interior y los conectores, pero no su superficie por metro', () => {
  const perfil = parsearPerfilEstructural({ seccion: '20x30' });
  const r = (orientacionPerfil: string) =>
    calcularEstructuraBastidor(
      job(),
      parsearParamsEstructuraBastidor({ orientacionPerfil }),
      perfil,
    )!;
  expect(r('ancho_al_frente').interiorAnchoM).toBeCloseTo(2.36);
  expect(r('alto_al_frente').interiorAnchoM).toBeCloseTo(2.34);
  expect(r('ancho_al_frente').despieceMm).toContain(120);
  expect(r('alto_al_frente').despieceMm).toContain(140);
  expect(
    r('ancho_al_frente').pinturaM2 / r('ancho_al_frente').mlTotal,
  ).toBeCloseTo(0.11);
});
it('conserva precio y equivalencia entre barra y metro, sin confundir ml con mililitros', () => {
  expect(
    materialUnitConversion(context, 'barra', 'metro_lineal'),
  ).toMatchObject({ ok: true, factor: 6 });
  expect(
    materialUnitConversion(context, 'metro_lineal', 'barra'),
  ).toMatchObject({ ok: true, factor: 1 / 6 });
  expect(materialPriceInUseUnit(context, 6000)).toEqual({
    ok: true,
    precio: 1000,
  });
  expect(materialUnitConversion(context, 'barra', 'ml').ok).toBe(false);
  expect(validateMaterialUnits({ ...context, atributos: {} })).toContain(
    'largo',
  );
  expect(
    validateMaterialUnits({ ...context, atributos: { largoBarra: '6,5' } }),
  ).toBeNull();
});
it.each([
  ['METRO_LINEAL', 18],
  ['BARRA', 3],
  ['UNIDAD', 3],
  ['CM', 1800],
])('el packing entrega la cantidad en %s', (unidadStock, expected) => {
  const ctx = job();
  derivacionesDelJobContext(ctx).paso = runDerivador(
    'bastidor_rectangular',
    ctx,
    {},
    attrs,
  );
  const service = Object.create(MotorUniversalService.prototype);
  const cantidad = service.cantidadSlotDerivada(
    { familiaCodigo: 'estructura_bastidor', configPasoId: 'paso' },
    { slotCodigo: 'perfil_estructural', formula: 'por_unidad_productiva' },
    ctx,
    {
      unidadStock,
      contextoUnidades: { ...context, unidadUso: unidadStock },
      atributosVarianteJson: attrs,
    },
  );
  expect(cantidad).toBeCloseTo(expected as number);
  const derivado = derivacionesDelJobContext(ctx).paso!;
  expect(derivado.magnitudes.mlTotal).toBeCloseTo(17.12);
  expect((derivado.traza?.estructura as any).barras).toMatchObject({
    cantidad: 3,
    metrosComerciales: 18,
  });
});
it('bloquea un tramo imposible, una sección desconocida y un cajón más angosto que el perfil', () => {
  const largo = {
    ...job(),
    piezas: [{ cantidad: 1, anchoMm: 7000, altoMm: 1200 }],
  } as unknown as JobContext;
  expect(
    runDerivador('bastidor_rectangular', largo, {}, attrs)?.diagnostico?.codigo,
  ).toBe('perfil_barra_insuficiente');
  expect(
    runDerivador('bastidor_rectangular', job(), {}, { seccion: 'sin datos' })
      ?.diagnostico?.codigo,
  ).toBe('perfil_estructural_invalido');
  expect(
    runDerivador(
      'bastidor_rectangular',
      { ...job(), profundidadMm: 50 },
      {},
      attrs,
    )?.diagnostico?.codigo,
  ).toBe('perfil_no_cabe_en_bastidor');
});
it('respeta la pérdida de corte y no genera restos negativos al usar una barra completa', () => {
  expect(calcularBarrasNecesarias([6000], 6000)).toMatchObject({
    barras: 1,
    sobranteMm: 0,
  });
  expect(calcularBarrasNecesarias([5998], 6000)).toBeNull();
  expect(calcularBarrasNecesarias([2995, 3000], 6000)).toMatchObject({
    barras: 1,
    sobranteMm: 0,
  });
});
