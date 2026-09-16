import { huellaFuenteProductiva } from './fuente-productiva-equivalente';

const fuente = () => ({
  productoId: 'exhibidor',
  rutaAlternativaId: 'mesa-corte',
  cantidad: 200,
  recetaRevisionId: 'revision-1',
  recetaHuella: 'receta',
  jobContextJson: {
    cantidad: 200,
    piezas: [{ archivo: 'exhibidor.dxf', copias: 2 }],
  },
  snapshotJson: {
    motor: {
      contractVersion: 1,
      periodoTarifario: '2026-09',
      inputHash: 'cliente-a',
      generadoAt: 'antes',
    },
    receta: { grafo: ['imprimir', 'cortar', 'armar'] },
    ruta: { maquinaId: 'mesa-1', perfilId: 'corrugado' },
    ejecucion: { cantidadEfectiva: 200, costos: { total: 500 } },
  },
  trazabilidadJson: {
    pasos: [
      {
        tiempo: { totalMin: 60 },
        nestingResult: { placements: [{ x: 1, y: 2 }] },
      },
    ],
    componentesFabricados: [
      {
        codigo: 'cuerpo',
        cantidad: 200,
        costoTotal: 400,
        pricing: { margen: 20 },
      },
    ],
    desglosePricingCompuesto: { precio: 1000 },
  },
  precioTotal: 1000,
});

it('conserva fabricación al cambiar sólo precio, cliente y metadatos de la recotización', () => {
  const a = fuente(),
    b = fuente();
  b.precioTotal = 800;
  b.snapshotJson.motor.inputHash = 'cliente-b';
  b.snapshotJson.motor.generadoAt = 'despues';
  b.trazabilidadJson.desglosePricingCompuesto.precio = 800;
  b.trazabilidadJson.componentesFabricados[0].pricing.margen = 10;
  expect(huellaFuenteProductiva(b)).toBe(huellaFuenteProductiva(a));
});

it('reconoce el mismo layout reutilizado aunque cambie la telemetría de búsqueda', () => {
  const a = fuente(),
    b = fuente();
  const resultado = {
    algorithm: 'irregular-2d-bottom-left-v1',
    duracionMs: 120000,
    busqueda: { motivoFin: 'PRESUPUESTO_AGOTADO' },
    placements: [{ x: 1, y: 2 }],
  };
  Object.assign(a.trazabilidadJson.pasos[0].nestingResult, {
    solucionNesting: { resultado },
  });
  Object.assign(b.trazabilidadJson.pasos[0].nestingResult, {
    solucionNesting: {
      resultado: {
        ...structuredClone(resultado),
        duracionMs: 0,
        busqueda: { motivoFin: 'PLAN_REUTILIZADO' },
      },
    },
  });
  expect(huellaFuenteProductiva(a)).toBe(huellaFuenteProductiva(b));
  resultado.placements[0].x = 20; // Nunca se descartan posiciones ni geometría.
  expect(huellaFuenteProductiva(a)).not.toBe(huellaFuenteProductiva(b));
});

it.each([
  [
    'piezas',
    (c: ReturnType<typeof fuente>) => {
      c.jobContextJson.piezas[0].copias = 3;
    },
  ],
  [
    'archivo',
    (c: ReturnType<typeof fuente>) => {
      c.jobContextJson.piezas[0].archivo = 'otro.dxf';
    },
  ],
  [
    'cantidad',
    (c: ReturnType<typeof fuente>) => {
      c.cantidad = 150;
    },
  ],
  [
    'máquina',
    (c: ReturnType<typeof fuente>) => {
      c.snapshotJson.ruta.maquinaId = 'mesa-2';
    },
  ],
  [
    'tiempo',
    (c: ReturnType<typeof fuente>) => {
      c.trazabilidadJson.pasos[0].tiempo.totalMin = 90;
    },
  ],
  [
    'layout',
    (c: ReturnType<typeof fuente>) => {
      c.trazabilidadJson.pasos[0].nestingResult.placements[0].x = 3;
    },
  ],
  [
    'costo',
    (c: ReturnType<typeof fuente>) => {
      c.snapshotJson.ejecucion.costos.total = 600;
    },
  ],
  [
    'período',
    (c: ReturnType<typeof fuente>) => {
      c.snapshotJson.motor.periodoTarifario = '2026-10';
    },
  ],
] as const)('requiere revisar la distribución si cambia %s', (_, cambiar) => {
  const a = fuente(),
    b = fuente();
  cambiar(b);
  expect(huellaFuenteProductiva(b)).not.toBe(huellaFuenteProductiva(a));
});
