/**
 * E.1 — Defaults declarados del paso: la precedencia es siempre
 * "config del producto → default de familia → default duro", y estos
 * tests la protegen sin DB (funciones puras + resolveNestingConfig).
 */
import {
  aplicarCentroDefault,
  centroCostoEfectivo,
  productividadPropiaEfectiva,
  tiempoFijoEfectivoMin,
} from '../familia-defaults';
import { resolveNestingConfig } from '../nesting-config';
import type { DefaultsFamiliaPaso, JobContext, PasoCargado } from '../tipos';

const DEFAULTS: DefaultsFamiliaPaso = {
  centroCostoId: 'cc-taller',
  centroCostoCodigo: 'IMP-003',
  centroCostoNombre: 'Produccion & Taller',
  productividadHora: 45,
  tiempoFijoMin: 25,
  demasiaMm: 3,
  solapePanelMm: 30,
};

function pasoBase(extra: Partial<PasoCargado> = {}): PasoCargado {
  return {
    rutaPasoId: 'rp-1',
    rutaPasoOrden: 1,
    familiaCodigo: 'trabajo_manual',
    configPasoId: 'cfg-1',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-2',
    mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: null,
    maquinaM1Id: null,
    perfilM1Id: null,
    centroCostoId: null,
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: null,
    ...extra,
  } as unknown as PasoCargado;
}

describe('defaults declarados del paso (E.1)', () => {
  it('tiempo fijo: override del producto → default de familia → 0', () => {
    expect(
      tiempoFijoEfectivoMin(
        pasoBase({ tiempoFijoOverrideMin: 10, defaultsFamilia: DEFAULTS }),
      ),
    ).toBe(10);
    expect(
      tiempoFijoEfectivoMin(pasoBase({ defaultsFamilia: DEFAULTS })),
    ).toBe(25);
    expect(tiempoFijoEfectivoMin(pasoBase())).toBe(0);
  });

  it('productividad T-2: config del producto → default de familia → 0', () => {
    const conDefault = pasoBase({ defaultsFamilia: DEFAULTS });
    expect(
      productividadPropiaEfectiva({ productivityValue: 60 }, conDefault),
    ).toBe(60);
    expect(productividadPropiaEfectiva({}, conDefault)).toBe(45);
    // 0 o basura en la config NO pisan el default (0 = "sin definir").
    expect(
      productividadPropiaEfectiva({ productivityValue: 0 }, conDefault),
    ).toBe(45);
    expect(productividadPropiaEfectiva({}, pasoBase())).toBe(0);
  });

  it('centro de costo: config → default de familia; con máquina no aplica', () => {
    const propio = { id: 'cc-x', codigo: 'X', nombre: 'Propio' };
    expect(
      centroCostoEfectivo(
        pasoBase({
          centroCostoId: 'cc-x',
          centroCosto: propio,
          defaultsFamilia: DEFAULTS,
        }),
      ),
    ).toEqual(propio);
    expect(
      centroCostoEfectivo(pasoBase({ defaultsFamilia: DEFAULTS })),
    ).toEqual({
      id: 'cc-taller',
      codigo: 'IMP-003',
      nombre: 'Produccion & Taller',
    });
    expect(
      centroCostoEfectivo(
        pasoBase({ maquinaM1Id: 'maq-1', defaultsFamilia: DEFAULTS }),
      ),
    ).toBeNull();

    // aplicarCentroDefault muta el paso cargado sólo si estaba vacío.
    const paso = pasoBase({ defaultsFamilia: DEFAULTS });
    aplicarCentroDefault(paso);
    expect(paso.centroCostoId).toBe('cc-taller');
    expect(paso.centroCosto?.nombre).toBe('Produccion & Taller');
  });

  it('demasía: config del producto → default de familia → derivado legacy', () => {
    const jobContext = { cantidad: 10 } as unknown as JobContext;
    // Sin config del producto → gana el default de familia (3 mm).
    const conDefault = resolveNestingConfig(
      pasoBase({ defaultsFamilia: DEFAULTS }),
      jobContext,
      null,
    );
    expect(conDefault.pieceBleedMm).toBe(3);
    // La config del producto pisa al default.
    const conConfig = resolveNestingConfig(
      pasoBase({
        defaultsFamilia: DEFAULTS,
        paramsPasoJson: { nestingConfig: { pieceBleedMm: 1 } },
      }),
      jobContext,
      null,
    );
    expect(conConfig.pieceBleedMm).toBe(1);
    // Sin default: el derivado legacy sigue intacto (trabajo_manual → 0).
    expect(resolveNestingConfig(pasoBase(), jobContext, null).pieceBleedMm).toBe(0);
  });

  it('solape de panel: config del producto → default de familia → 20', () => {
    const jobContext = { cantidad: 10 } as unknown as JobContext;
    expect(
      resolveNestingConfig(pasoBase({ defaultsFamilia: DEFAULTS }), jobContext, null)
        .panelizado.overlapMm,
    ).toBe(30);
    expect(
      resolveNestingConfig(
        pasoBase({
          defaultsFamilia: DEFAULTS,
          paramsPasoJson: { nestingConfig: { panelizado: { overlapMm: 15 } } },
        }),
        jobContext,
        null,
      ).panelizado.overlapMm,
    ).toBe(15);
    expect(
      resolveNestingConfig(pasoBase(), jobContext, null).panelizado.overlapMm,
    ).toBe(20);
  });
});
