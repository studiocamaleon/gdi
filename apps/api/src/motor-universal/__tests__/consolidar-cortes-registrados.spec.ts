import { consolidarCortesRegistrados } from '../consolidar-cortes-registrados';
import type {
  ComponenteFabricadoCosteado,
  LoteNestingCompuestoSnapshot,
} from '../tipos';

function escenario() {
  const placements = ['A', 'B'].map((codigo, i) => ({
    pieceId: codigo,
    substrateIndex: 0,
    xMm: i * 30,
    yMm: 0,
    widthMm: 20,
    heightMm: 20,
    rotated: false,
    meta: {
      componenteCodigo: codigo,
      contornos: [
        {
          puntos: [
            { x: i * 30, y: 0 },
            { x: i * 30 + 20, y: 0 },
            { x: i * 30, y: 20 },
          ],
          esHueco: false,
        },
      ],
    },
  }));
  const lote = {
    id: 'impresion',
    materialVarianteId: 'pvc',
    materialNombre: 'PVC',
    participantes: ['A', 'B'].map((componenteCodigo) => ({
      componenteCodigo,
      areaUtilMm2: 200,
    })),
    nestingResult: {
      algorithm: 'irregular-2d-bottom-left-v1',
      cantidadCalculada: 1,
      unidad: 'pliegos',
      aprovechamientoPct: 4,
      substrates: [{ kind: 'sheet', count: 1, widthMm: 100, heightMm: 100 }],
      placements,
    },
  } as LoteNestingCompuestoSnapshot;
  const componentes = ['A', 'B'].map((codigo, i) => ({
    codigo,
    productoId: 'producto',
    politicaEjecucion: 'INDEPENDIENTE',
    cantidad: 1,
    costoTotal: 40,
    costoUnitario: 40,
    pasos: [
      {
        activado: true,
        familiaCodigo: 'corte_laser',
        configPasoId: 'laser-publicado',
        rutaPasoId: `laser-${codigo}`,
        nombreVisible: 'Corte láser',
        costoTotal: 30,
        materiales: [],
        tiempo: {
          setupMin: 6,
          cleanupMin: 4,
          runMin: 20,
          tiempoFijoMin: 0,
          totalMin: 30,
          costo: 30,
          tarifaHora: 60,
          centroCostoId: 'laser',
        },
        nestingResult: {
          ...lote.nestingResult,
          placements: [placements[i]],
          layoutRegistradoLoteId: lote.id,
          maquina: { id: 'laser', nombre: 'Láser' },
          perfil: { id: 'pvc', nombre: 'PVC' },
        },
      },
    ],
  })) as ComponenteFabricadoCosteado[];
  return { lote, componentes };
}

describe('operación de corte registrada con impresión', () => {
  it('mantiene el registro del plano sin descontar preparaciones de cortes secuenciales', () => {
    const { lote, componentes } = escenario();
    componentes[0].nodoIncorporacionClave = 'ruta:control';
    componentes[1].nodosPredecesoresClaves = ['ruta:control'];
    const antes = JSON.stringify(componentes);
    const [grupo] = consolidarCortesRegistrados(lote, componentes);
    expect(grupo.lote).toBeUndefined();
    expect(grupo.aplicacion).toMatchObject({ aplicado: false, ahorroCostoTotal: 0, motivoNoAplicado: expect.stringMatching(/precedencias/) });
    expect(JSON.stringify(componentes)).toBe(antes);
  });
  it('crea un solo corte sobre el mismo plano y cobra una preparación, manteniendo todo el recorrido', () => {
    const { lote, componentes } = escenario();
    const original = JSON.stringify(lote);
    const [grupo] = consolidarCortesRegistrados(lote, componentes);
    expect(grupo.lote).toMatchObject({
      layoutOrigenLoteId: 'impresion',
      costoMaterialTotal: 0,
      costoPreparacionTotal: 10,
      costoTotalAsignado: 50,
      duracionEstimadaMin: 50,
    });
    expect(grupo.lote!.nestingResult.placements).toEqual(
      lote.nestingResult.placements,
    );
    expect(grupo.lote!.participantes.map((p) => p.esPasoOperativo)).toEqual([
      true,
      false,
    ]);
    expect(componentes.map((c) => c.pasos![0].tiempo)).toEqual([
      expect.objectContaining({
        setupMin: 3,
        cleanupMin: 2,
        runMin: 20,
        totalMin: 25,
        costo: 25,
      }),
      expect.objectContaining({
        setupMin: 3,
        cleanupMin: 2,
        runMin: 20,
        totalMin: 25,
        costo: 25,
      }),
    ]);
    expect(componentes.map((c) => c.costoTotal)).toEqual([35, 35]);
    expect(JSON.stringify(lote)).toBe(original);
    expect(consolidarCortesRegistrados(lote, componentes)).toEqual([]);
  });
  it.each([
    'perfil',
    'maquina',
    'configuracion',
    'manual',
    'material',
    'preparacion',
  ])('conserva cortes separados ante distinta %s', (cambio) => {
    const { lote, componentes } = escenario();
    const p = componentes[1].pasos![0];
    if (cambio === 'perfil') p.nestingResult!.perfil!.id = 'otro';
    if (cambio === 'maquina') p.nestingResult!.maquina!.id = 'otra';
    if (cambio === 'configuracion') p.configPasoId = 'otra-config';
    if (cambio === 'manual') p.tiempo!.origenTiempo = 'manual_comercial';
    if (cambio === 'material') p.materiales = [{ costoTotal: 10 } as never];
    if (cambio === 'preparacion') p.tiempo!.setupMin = 8;
    const antes = JSON.stringify(componentes);
    expect(consolidarCortesRegistrados(lote, componentes)).toEqual([]);
    expect(JSON.stringify(componentes)).toBe(antes);
  });
  it('no exporta el plan completo al agrupar sólo un subconjunto compatible', () => {
    const { lote, componentes } = escenario();
    lote.nestingResult.placements.push({
      ...lote.nestingResult.placements[0],
      pieceId: 'C',
      meta: { componenteCodigo: 'C' },
    });
    const antes = JSON.stringify(componentes);
    expect(consolidarCortesRegistrados(lote, componentes)).toEqual([]);
    expect(JSON.stringify(componentes)).toBe(antes);
  });
});
