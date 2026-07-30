/**
 * B.3.4 — El dispatcher rutea familias TENANT por su declaración
 * (`nestingConfig.superficie`), no por el código. Sin DB: las familias se
 * registran directo en el registro síncrono del resolver.
 */
import { runNestingForPaso } from '../nesting-dispatcher';
import {
  quitarFamiliaTenantDelRegistro,
  registrarFamiliaTenant,
} from '../../productos-servicios/pasos/familias';
import type { DefinicionFamiliaResuelta } from '../../productos-servicios/pasos/types';
import type { JobContext, PasoCargado } from '../tipos';

const FAMILIA_BASE: Omit<DefinicionFamiliaResuelta, 'codigo' | 'nombre'> = {
  categoria: 'operaciones_manuales' as DefinicionFamiliaResuelta['categoria'],
  esDeTenant: true,
  tenantId: 'tenant-test',
  activo: true,
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: [],
  validaciones: [],
  paramsPasoSchema: [],
};

function pasoTenant(familiaCodigo: string): PasoCargado {
  return {
    rutaPasoId: 'rp-test',
    rutaPasoOrden: 1,
    familiaCodigo,
    configPasoId: 'cfg-test',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-2',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: null,
    maquinaM1Id: null,
    perfilM1Id: null,
    centroCostoId: null,
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: null,
    slots: [],
  } as unknown as PasoCargado;
}

describe('nesting-dispatcher: familias tenant (B.3.4)', () => {
  const ID_ROLLO = 'aaaaaaaa-0000-0000-0000-00000000roll';
  const ID_PLIEGO = 'bbbbbbbb-0000-0000-0000-0000000sheet';

  beforeAll(() => {
    registrarFamiliaTenant({
      ...FAMILIA_BASE,
      codigo: ID_ROLLO,
      nombre: 'Corte tenant sobre rollo',
      nestingConfig: { superficie: 'rollo' },
    });
    registrarFamiliaTenant({
      ...FAMILIA_BASE,
      codigo: ID_PLIEGO,
      nombre: 'Estampado tenant en pliego',
      nestingConfig: { superficie: 'pliego' },
    });
  });

  afterAll(() => {
    quitarFamiliaTenantDelRegistro(ID_ROLLO);
    quitarFamiliaTenantDelRegistro(ID_PLIEGO);
  });

  it('superficie ROLLO → algoritmo de rollo con largo consumido real', async () => {
    const jobContext = {
      cantidad: 3,
      piezas: [{ cantidad: 3, anchoMm: 500, altoMm: 500 }],
    } as unknown as JobContext;
    const result = await runNestingForPaso(
      pasoTenant(ID_ROLLO),
      jobContext,
      { atributosVarianteJson: { anchoMm: 1100 } },
      undefined,
    );
    expect(result).not.toBeNull();
    expect(['shelf-rollo', 'maxrects-rollo']).toContain(result!.algorithm);
    expect(result!.substrates[0]?.kind).toBe('roll');
    expect(result!.consumedLengthMm ?? 0).toBeGreaterThan(0);
  });

  it('superficie PLIEGO con piezas uniformes → grid-2d-single con poses e imposición', async () => {
    const jobContext = {
      cantidad: 100,
      piezas: [{ cantidad: 100, anchoMm: 60, altoMm: 40 }],
    } as unknown as JobContext;
    const result = await runNestingForPaso(
      pasoTenant(ID_PLIEGO),
      jobContext,
      // La medida del pliego sale del material del slot (hoja 320×450).
      { atributosVarianteJson: { anchoMm: 320, altoMm: 450 } },
      undefined,
    );
    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('grid-2d-single');
    // 60×40 en 320×450 sin márgenes: ≥50 poses por pliego → 2 pliegos.
    expect(result!.piezasPorPliego ?? 0).toBeGreaterThanOrEqual(50);
    expect(result!.cantidadCalculada).toBe(2);
  });

  it('una familia del SISTEMA no pasa por la entrada tenant (branch intacto)', async () => {
    // trabajo_manual no tiene nesting: el dispatcher devuelve null y el
    // motor sigue con su fallback — igual que siempre.
    const result = await runNestingForPaso(
      pasoTenant('trabajo_manual'),
      {
        cantidad: 10,
        piezas: [{ cantidad: 10, anchoMm: 100, altoMm: 100 }],
      } as unknown as JobContext,
      { atributosVarianteJson: { anchoMm: 1000 } },
      undefined,
    );
    expect(result).toBeNull();
  });
});
