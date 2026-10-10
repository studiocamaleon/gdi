import { MotorUniversalService } from '../motor.service';
import {
  aplicarNivelAlPaso,
  leerNivelesPaso,
  perfilIdDelNivel,
} from '../niveles-paso';
import { MotorCotizacionError } from '../motor-error';
const perfil = (id: string, ritmo: number, setup = 0) => ({
  id,
  nombre: id,
  tipoPerfil: 'CORTE',
  activo: true,
  productivityValue: ritmo,
  productivityUnit: 'M2_H',
  setupMin: setup,
  cleanupMin: 0,
  feedReloadMin: 0,
  detalleJson: {},
});
const simple = perfil('simple', 8),
  complejo = perfil('complejo', 4, 3);
const niveles = {
  etiqueta: 'Troquelado',
  opciones: [
    {
      codigo: 'simple',
      nombre: 'Simple',
      esDefault: true,
      overrides: {
        perfilesPorMaquina: { plotter: 'simple', otro: 'otro-simple' },
      },
    },
    {
      codigo: 'complejo',
      nombre: 'Complejo',
      overrides: {
        perfilesPorMaquina: { plotter: 'complejo', otro: 'otro-complejo' },
      },
    },
  ],
};
const paso = (extra = {}): any => ({
  configPasoId: 'extra-troquelado',
  rutaPasoId: 'extra-troquelado',
  rutaPasoOrden: 2,
  familiaCodigo: 'plotter_corte',
  nombreVisible: 'Troquelado opcional',
  modoActivacion: 'OPCIONAL',
  modoTiempo: 'T-3',
  mecanismoCantidad: 'CALCULADO_POR_PASO',
  maquinaM1Id: 'plotter',
  maquina: { id: 'plotter', centroCostoPrincipalId: 'centro' },
  perfilM1Id: 'simple',
  perfil: simple,
  perfilesDisponibles: [simple, complejo],
  paramsPasoJson: { niveles },
  slots: [],
  ...extra,
});
const contexto = {
  cantidad: 1,
  piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 1000 }],
  tiempoReal: true,
  opcionalesActivados: { 'extra-troquelado': true },
};
const motor = Object.create(MotorUniversalService.prototype) as any;
const elegir = (p: any, ctx: any) => {
  const configurado = aplicarNivelAlPaso(p, ctx);
  return {
    ...configurado,
    perfil: motor.resolverPerfil(configurado, ctx) ?? configurado.perfil,
  };
};
const cotizar = (p: any, ctx: any) => {
  const errores: unknown[] = [];
  const resultado = motor.calcularTiempo(
    elegir(p, ctx),
    ctx,
    errores,
    new Map([['centro', { tarifa: 8000 }]]),
    '2026-10',
  );
  expect(errores).toEqual([]);
  return resultado;
};
describe('niveles con perfiles de máquina', () => {
  it('Troquelado opcional cambia perfil, preparación, tiempo y costo sin modificar la base', () => {
    const p = paso(),
      base = cotizar(p, contexto),
      ctx = { ...contexto, 'nivelPaso_extra-troquelado': 'complejo' },
      elegido = cotizar(p, ctx);
    expect(base.runMin).toBe(7.5);
    expect(base.costo).toBe(1000);
    expect(elegido.runMin).toBe(15);
    expect(elegido.setupMin).toBe(3);
    expect(elegido.costo).toBe(2400);
    expect(p.perfil.id).toBe('simple');
    expect(elegir(p, ctx).perfil.id).toBe('complejo');
  });
  it('no depende del código de la plantilla para aplicar un nivel', () => {
    const p = paso({ familiaCodigo: 'nodo-personalizado' });
    expect(
      perfilIdDelNivel(p, { 'nivelPaso_extra-troquelado': 'complejo' }),
    ).toBe('complejo');
    expect(
      elegir(p, { 'nivelPaso_extra-troquelado': 'complejo' }).perfil.id,
    ).toBe('complejo');
  });
  it('elige el perfil de la candidata activa, sin mezclar máquinas', () => {
    const p = paso({
      maquinaM1Id: 'otro',
      maquina: { id: 'otro' },
      perfilM1Id: 'otro-simple',
      perfil: perfil('otro-simple', 12),
      perfilesDisponibles: [
        perfil('otro-simple', 12),
        perfil('otro-complejo', 6),
      ],
    });
    expect(
      elegir(p, { 'nivelPaso_extra-troquelado': 'complejo' }).perfil.id,
    ).toBe('otro-complejo');
  });
  it('hereda el perfil cuando el nivel no lo cambia', () => {
    const p = paso({
      paramsPasoJson: {
        niveles: {
          ...niveles,
          opciones: niveles.opciones.map((o) => ({ ...o, overrides: {} })),
        },
      },
    });
    expect(elegir(p, contexto).perfil.id).toBe('simple');
  });
  it('valida y calcula con el perfil de M2 después de cambiar de máquina', () => {
    const candidata = (id: string, perfiles: unknown[]) => ({
      id: `candidata-${id}`,
      maquinaId: id,
      maquina: { id, centroCostoPrincipalId: 'centro' },
      perfilDefaultId: id === 'plotter' ? 'simple' : 'otro-simple',
      perfilesOperativos: perfiles,
    });
    const p = paso({
      maquinasCandidatas: [
        candidata('plotter', [simple, complejo]),
        candidata('otro', [
          perfil('otro-simple', 12),
          perfil('otro-complejo', 6),
        ]),
      ],
    });
    const ctx = {
      ...contexto,
      'maquinaSeleccionada_extra-troquelado': 'otro',
      'nivelPaso_extra-troquelado': 'complejo',
    };
    expect(motor.validarSeleccionesExplicitas([p], ctx)).toEqual([]);
    const activo = motor.resolverMaquinaM2(p, ctx);
    expect(elegir(activo, ctx).perfil.id).toBe('otro-complejo');
    expect(cotizar(activo, ctx).runMin).toBe(10);
  });
  it.each(['ajeno', 'inactivo', 'incompatible'])(
    'rechaza un perfil %s en lugar de usar otro',
    (caso) => {
      const p = paso({
        perfilesDisponibles: [
          simple,
          ...(caso === 'ajeno'
            ? []
            : [
                {
                  ...complejo,
                  ...(caso === 'inactivo'
                    ? { activo: false }
                    : { tipoPerfil: 'IMPRESION' }),
                },
              ]),
        ],
      });
      expect(() =>
        elegir(p, { 'nivelPaso_extra-troquelado': 'complejo' }),
      ).toThrow(MotorCotizacionError);
      expect(
        motor.validarSeleccionesExplicitas([p], {
          ...contexto,
          'nivelPaso_extra-troquelado': 'complejo',
        }),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codigo: 'perfil_nivel_invalido' }),
        ]),
      );
    },
  );
  it('el nivel explícito gana a un perfil heredado anterior', () => {
    expect(
      elegir(paso(), {
        ...contexto,
        'nivelPaso_extra-troquelado': 'complejo',
        'perfilSeleccionado_extra-troquelado': 'simple',
      }).perfil.id,
    ).toBe('complejo');
  });
  it('mantiene la elección histórica al convertir complejidad en niveles', () => {
    const p = paso({
      paramsPasoJson: {
        niveles: {
          ...niveles,
          opciones: niveles.opciones.map((o) => ({
            ...o,
            codigo: `perfil_${o.codigo}`,
          })),
        },
      },
    });
    expect(
      elegir(p, { 'perfilSeleccionado_extra-troquelado': 'complejo' }).perfil
        .id,
    ).toBe('complejo');
  });
  it('no bloquea por el perfil de un opcional desactivado', () => {
    const p = paso({ perfilesDisponibles: [simple] });
    expect(
      motor.validarSeleccionesExplicitas([p], {
        opcionalesActivados: {},
        'nivelPaso_extra-troquelado': 'complejo',
      }),
    ).toEqual([]);
  });
  it('no ignora una asignación incompatible con perfiles por operación', () => {
    const p = paso({
      paramsPasoJson: { niveles, cotizarOperacionesVectoriales: true },
    });
    expect(motor.validarSeleccionesExplicitas([p], contexto)[0].codigo).toBe(
      'perfil_nivel_invalido',
    );
  });
  it('conserva ritmo, dotación y bloques adicionales en los pasos manuales', () => {
    const p = paso({
      maquina: null,
      maquinaM1Id: null,
      paramsPasoJson: {
        tiemposExtra: [{ id: 'traslado', minutos: 20 }],
        niveles: {
          opciones: [
            { codigo: 'a', overrides: {} },
            {
              codigo: 'b',
              overrides: {
                productividadHora: 6,
                dotacion: 2,
                tiemposExtraMin: { traslado: 40 },
              },
            },
          ],
        },
      },
    });
    const aplicado = aplicarNivelAlPaso(p, {
      'nivelPaso_extra-troquelado': 'b',
    });
    expect(aplicado.paramsPasoJson).toMatchObject({
      productivityValue: 6,
      tiemposExtra: [{ minutos: 40 }],
    });
    expect(aplicado.dotacionOperarios).toBe(2);
    expect(perfilIdDelNivel(aplicado, contexto)).toBeNull();
  });
  it('normaliza el mapa y descarta valores que no son perfiles', () => {
    const datos = leerNivelesPaso({
      niveles: {
        opciones: [
          {
            codigo: 'a',
            overrides: {
              perfilesPorMaquina: { plotter: '  simple  ', invalido: 1 },
            },
          },
          { codigo: 'b' },
        ],
      },
    });
    expect(datos?.opciones[0].overrides.perfilesPorMaquina).toEqual({
      plotter: 'simple',
    });
  });
});
