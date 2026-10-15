import {
  resolverEstadosActivacion,
  validarCondicionesEstadoPasos,
  remapearEstadoPasos,
  type PasoConEstado,
} from '../estado-pasos';
import { resolverArrastreOpcionales } from '../arrastre-opcionales';

const regla = (id: string, activo = 0) => ({
  '==': [{ var: `pasoActivo_${id}` }, activo],
});
const paso = (
  id: string,
  modo = 'OPCIONAL',
  condicion?: unknown,
): PasoConEstado => ({
  rutaPasoId: id,
  configPasoId: `cfg-${id}`,
  nombreVisible: id,
  familiaCodigo: 'trabajo_manual',
  modoActivacion: modo,
  condicionActivacionJson: condicion,
});
const preprensa = () => paso('preprensa', 'CONDICIONAL', regla('diseno'));

describe('Estado efectivo de otro paso', () => {
  it.each([false, true, false])(
    'Diseño activo=%s excluye/restaura Preprensa, sin depender del orden',
    (activo) => {
      for (const pasos of [
        [preprensa(), paso('diseno')],
        [paso('diseno'), preprensa()],
      ]) {
        const estados = resolverEstadosActivacion(pasos, {
          opcionalesActivados: { 'cfg-diseno': activo },
          pasoActivo_diseno: activo ? 0 : 1,
        });
        expect(estados.get('cfg-preprensa')?.activado).toBe(!activo);
        expect(estados.get('cfg-diseno')?.activado).toBe(activo);
        if (activo)
          expect(estados.get('cfg-preprensa')?.razon).toContain(
            'diseno: activo',
          );
      }
    },
  );
  it('lee la activación por arrastre y también permite requerir estado activo', () => {
    const pasos = [
      preprensa(),
      paso('diseno'),
      { ...paso('revision', 'OBLIGATORIO'), requiereRutaPasoIds: ['diseno'] },
      paso('prueba', 'CONDICIONAL', regla('diseno', 1)),
    ];
    const arrastre = resolverArrastreOpcionales(pasos as never, {});
    const estados = resolverEstadosActivacion(pasos, arrastre);
    expect(estados.get('cfg-preprensa')?.activado).toBe(false);
    expect(estados.get('cfg-prueba')?.activado).toBe(true);
  });
  it('resuelve cadenas de condiciones y combinaciones Y/O sobre el pedido', () => {
    const pasos = [
      preprensa(),
      paso('diseno', 'CONDICIONAL', {
        and: [regla('revision', 1), { '>': [{ var: 'cantidad' }, 10] }],
      }),
      paso('revision'),
    ];
    const contexto = {
      cantidad: 20,
      opcionalesActivados: { 'cfg-revision': true },
    };
    expect(
      resolverEstadosActivacion(pasos, contexto).get('cfg-preprensa')?.activado,
    ).toBe(false);
    expect(
      resolverEstadosActivacion(pasos, { ...contexto, cantidad: 1 }).get(
        'cfg-preprensa',
      )?.activado,
    ).toBe(true);
  });
  it('NO_EJECUTAR permanece inactivo aunque el pedido lo seleccione', () => {
    expect(
      resolverEstadosActivacion([preprensa(), paso('diseno', 'NO_EJECUTAR')], {
        opcionalesActivados: { 'cfg-diseno': true },
      }).get('cfg-preprensa')?.activado,
    ).toBe(true);
  });
  it.each([
    [preprensa(), paso('diseno', 'CONDICIONAL', regla('preprensa'))],
    [paso('preprensa', 'CONDICIONAL', regla('preprensa'))],
  ])('rechaza ciclos directos e indirectos', (...pasos) => {
    expect(() => validarCondicionesEstadoPasos(pasos)).toThrow('circular');
    expect(
      resolverEstadosActivacion(pasos, {}).get('cfg-preprensa')?.error,
    ).toContain('circular');
  });
  it('no interpreta una referencia ajena o eliminada como inactiva', () => {
    expect(() => validarCondicionesEstadoPasos([preprensa()])).toThrow(
      'misma ruta y versión',
    );
  });
  it('rechaza estados que todavía dependen de resultados de producción', () => {
    expect(() =>
      validarCondicionesEstadoPasos([
        preprensa(),
        paso('diseno', 'CONDICIONAL', {
          '>': [{ var: 'pliegos_calculados' }, 10],
        }),
      ]),
    ).toThrow('resultados de producción');
  });
  it('no anticipa ni altera reglas legacy ajenas a la nueva condición', () => {
    const pasos = [
      paso('corte', 'CONDICIONAL', {
        '>': [{ var: 'pliegos_calculados' }, 10],
      }),
    ];
    expect(resolverEstadosActivacion(pasos, {}).size).toBe(0);
  });
  it('traduce sólo las referencias de estado al cambiar la versión de ruta', () => {
    const original = {
      and: [
        regla('diseno'),
        { '==': [{ var: ['pasoActivo_revision', 0] }, 1] },
        { '>': [{ var: 'cantidad' }, 5] },
      ],
    };
    const nueva = remapearEstadoPasos(
      original,
      new Map([
        ['diseno', 'diseno-v2'],
        ['revision', 'revision-v2'],
      ]),
    );
    expect(nueva).toEqual({
      and: [
        regla('diseno-v2'),
        { '==': [{ var: ['pasoActivo_revision-v2', 0] }, 1] },
        { '>': [{ var: 'cantidad' }, 5] },
      ],
    });
    expect(remapearEstadoPasos(regla('eliminado'), new Map())).toEqual(
      regla('eliminado'),
    );
  });
});
