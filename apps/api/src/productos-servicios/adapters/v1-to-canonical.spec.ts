/**
 * A.6 — Test del adapter v1 → CotizacionCanonica.
 *
 * Toma los 25 goldens de __fixtures__/quote-cases/* (resultados reales de
 * los motores v1) y valida que el adapter:
 *   1. Produce una shape canónica válida para cada uno.
 *   2. El total canónico coincide con el total v1 (determinismo fuerte).
 *   3. La suma de los 3 buckets coincide con el total (coherencia).
 *   4. Cada paso canónico tiene los campos requeridos.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { v1ToCanonical, validarConsistenciaAdapter, mapSubtotales } from './v1-to-canonical';

const FIXTURES_ROOT = path.join(
  __dirname,
  '..',
  '__fixtures__',
  'quote-cases',
);

function discoverGoldens(): Array<{ motor: string; name: string; goldenPath: string }> {
  const results: Array<{ motor: string; name: string; goldenPath: string }> = [];
  if (!fs.existsSync(FIXTURES_ROOT)) return results;
  for (const motor of fs.readdirSync(FIXTURES_ROOT)) {
    const dir = path.join(FIXTURES_ROOT, motor);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.expected.json')) continue;
      results.push({ motor, name: f.replace('.expected.json', ''), goldenPath: path.join(dir, f) });
    }
  }
  return results;
}

describe('Adapter v1 → CotizacionCanonica (A.6)', () => {
  describe('mapSubtotales', () => {
    it('mapea subtotales digital (procesos, papel, toner, desgaste, etc.)', () => {
      const v1 = {
        procesos: 100,
        papel: 50,
        toner: 30,
        desgaste: 10,
        consumiblesTerminacion: 5,
        adicionalesMateriales: 8,
        adicionalesCostEffects: 20,
      };
      const buckets = mapSubtotales(v1);
      expect(buckets.centroCosto).toBe(100);
      expect(buckets.materiasPrimas).toBe(50 + 30 + 10 + 5 + 8); // todo menos procesos y costEffects
      expect(buckets.cargosFlat).toBe(20);
    });

    it('mapea subtotales rigidos (procesos, material, flexible, tinta)', () => {
      const v1 = {
        procesos: 200,
        material: 100,
        flexible: 50,
        tinta: 30,
        toner: 0,
        desgaste: 0,
        consumiblesTerminacion: 0,
        adicionalesMateriales: 0,
        adicionalesCostEffects: 0,
      };
      const buckets = mapSubtotales(v1);
      expect(buckets.centroCosto).toBe(200);
      expect(buckets.materiasPrimas).toBe(100 + 50 + 30);
      expect(buckets.cargosFlat).toBe(0);
    });

    it('handles subtotales undefined', () => {
      const buckets = mapSubtotales(undefined);
      expect(buckets).toEqual({ centroCosto: 0, materiasPrimas: 0, cargosFlat: 0 });
    });
  });

  describe('round-trip contra los 25 goldens reales', () => {
    const goldens = discoverGoldens();

    if (goldens.length === 0) {
      it('no goldens found', () => {
        expect(goldens.length).toBeGreaterThan(0);
      });
      return;
    }

    it.each(goldens.map((g) => [g.motor, g.name, g.goldenPath] as const))(
      '[%s] %s: conserva total y suma bucket correcto',
      (_motor, _name, goldenPath) => {
        const v1 = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
        const canonica = v1ToCanonical(v1);

        // 1. shape válida
        expect(canonica.total).toBeGreaterThanOrEqual(0);
        expect(canonica.unitario).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(canonica.pasos)).toBe(true);
        expect(canonica.subProductos).toEqual([]);

        // 2. buckets suman el total
        const sumBuckets =
          canonica.subtotales.centroCosto +
          canonica.subtotales.materiasPrimas +
          canonica.subtotales.cargosFlat;
        expect(Math.abs(sumBuckets - canonica.total)).toBeLessThanOrEqual(0.02);

        // 3. total canónico == total v1 (dentro de 1 centavo)
        expect(Math.abs(canonica.total - Number(v1.total))).toBeLessThanOrEqual(0.01);

        // 4. cada paso tiene campos requeridos
        for (const paso of canonica.pasos) {
          expect(typeof paso.id).toBe('string');
          expect(typeof paso.nombre).toBe('string');
          expect(typeof paso.tipo).toBe('string');
          expect(typeof paso.costoCentroCosto).toBe('number');
          expect(typeof paso.costoMateriasPrimas).toBe('number');
          expect(typeof paso.cargosFlat).toBe('number');
        }

        // 5. validarConsistenciaAdapter no reporta diffs
        const diffs = validarConsistenciaAdapter(canonica, v1);
        expect(diffs).toEqual([]);
      },
    );
  });
});
