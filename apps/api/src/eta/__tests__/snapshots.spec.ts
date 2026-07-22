import type { CalendarioEstacion } from '../../produccion/calendario';
import {
  construirSnapshotsEstacion,
  construirSnapshotsItem,
  type EstacionInfo,
  type PasoTraza,
} from '../snapshots';

/** L–V 08:00–17:00 (540 min/día), fin de semana cerrado. */
const CAL: CalendarioEstacion = {
  dias: {
    lun: [{ desde: '08:00', hasta: '17:00' }],
    mar: [{ desde: '08:00', hasta: '17:00' }],
    mie: [{ desde: '08:00', hasta: '17:00' }],
    jue: [{ desde: '08:00', hasta: '17:00' }],
    vie: [{ desde: '08:00', hasta: '17:00' }],
    sab: null,
    dom: null,
  },
};

/** Lunes 20 de julio de 2026, 08:00. */
const AHORA = new Date(2026, 6, 20, 8, 0);
const el = (h: number) => new Date(2026, 6, 20, h, 0);

const est: EstacionInfo = {
  id: 'e1',
  nombre: 'Impresión',
  calendario: CAL,
  capacidadConcurrente: 1,
};

const paso = (over: Partial<PasoTraza>): PasoTraza => ({
  estacionKey: 'e1',
  duracionMin: 60,
  esperaMin: 0,
  candidatos: 1,
  inicio: el(8),
  tercerizado: false,
  ...over,
});

describe('construirSnapshotsEstacion', () => {
  it('agrega cola, esperas, contención y utilización', () => {
    const traza = [
      paso({ duracionMin: 270, inicio: el(8), esperaMin: 0, candidatos: 2 }),
      paso({ duracionMin: 120, inicio: el(13), esperaMin: 60, candidatos: 3 }),
    ];
    const [foto] = construirSnapshotsEstacion(traza, [est], AHORA, new Set());
    expect(foto.estacionNombre).toBe('Impresión');
    expect(foto.pasosEnPlan).toBe(2);
    expect(foto.colaMin).toBe(390); // 270 + 120
    expect(foto.contencionMax).toBe(3);
    expect(foto.esperaP50Min).toBe(30); // p50 de [0,60]
    // cap 5 días hábiles = 5 × 540 = 2700; programado 390 → 14.4%.
    expect(foto.utilizacion5dPct).toBeCloseTo(14.4, 1);
    // cola 390 / 540 por día → 0.7 jornadas.
    expect(foto.horizonteDias).toBeCloseTo(0.7, 1);
  });

  it('la cola excluye los pasos tercerizados (no ocupan puesto)', () => {
    const traza = [
      paso({ duracionMin: 120, tercerizado: false }),
      paso({ duracionMin: null, tercerizado: true, estacionKey: '__proveedor__' }),
    ];
    const fotos = construirSnapshotsEstacion(traza, [est], AHORA, new Set());
    const e1 = fotos.find((f) => f.estacionKey === 'e1')!;
    expect(e1.colaMin).toBe(120);
    const prov = fotos.find((f) => f.estacionKey === '__proveedor__')!;
    expect(prov.estacionNombre).toBe('Proveedor');
    expect(prov.colaMin).toBe(0);
    expect(prov.horizonteDias).toBeNull(); // sintético: sin calendario
  });

  it('el bucket sin estación se rotula y no proyecta capacidad', () => {
    const traza = [paso({ estacionKey: 'sin-estacion', duracionMin: 60 })];
    const [foto] = construirSnapshotsEstacion(traza, [est], AHORA, new Set());
    expect(foto.estacionNombre).toBe('Sin estación');
    expect(foto.utilizacion5dPct).toBe(0);
    expect(foto.horizonteDias).toBeNull();
  });
});

describe('construirSnapshotsItem', () => {
  const eta = (
    finEstimado: Date | null,
    over: { sinEstimar?: boolean; parcial?: boolean } = {},
  ) => ({ finEstimado, sinEstimar: false, parcial: false, ...over });

  it('margen negativo si el ETA cae antes del cierre del día de entrega', () => {
    // Entrega 2026-07-22 (deadline 23:59); ETA 2026-07-21 10:00 → temprano.
    const porItem = new Map([['i1', eta(new Date(2026, 6, 21, 10, 0))]]);
    const [foto] = construirSnapshotsItem(
      porItem,
      new Map([['i1', '2026-07-22']]),
    );
    expect(foto.margenMin).toBeLessThan(0);
  });

  it('margen positivo si el ETA se pasa del día de entrega', () => {
    const porItem = new Map([['i1', eta(new Date(2026, 6, 23, 10, 0))]]);
    const [foto] = construirSnapshotsItem(
      porItem,
      new Map([['i1', '2026-07-22']]),
    );
    expect(foto.margenMin).toBeGreaterThan(0);
  });

  it('sin entrega o sin ETA → margen null; pasa los flags', () => {
    const porItem = new Map([
      ['i1', eta(new Date(2026, 6, 23), { parcial: true })],
      ['i2', eta(null, { sinEstimar: true })],
    ]);
    const fotos = construirSnapshotsItem(
      porItem,
      new Map([['i1', null]]),
    );
    const i1 = fotos.find((f) => f.itemId === 'i1')!;
    const i2 = fotos.find((f) => f.itemId === 'i2')!;
    expect(i1.margenMin).toBeNull();
    expect(i1.parcial).toBe(true);
    expect(i2.margenMin).toBeNull();
    expect(i2.sinEstimar).toBe(true);
  });
});
