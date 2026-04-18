/**
 * Etapa B.2/B.3 — Tests del WideFormatMotorModuleV2.
 *
 * Valida que el motor v2:
 *   - Emite shape canónica válida con los 5 pasos esperados.
 *   - Los 3 buckets suman el total.
 *   - Los 4 casos de validación (G1-G4) caen dentro de rangos razonables
 *     (del doc docs/etapa-B-ruta-gran-formato.md).
 */
import { WideFormatMotorModuleV2 } from './wide-format-v2.motor';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { CurrentAuth } from '../../auth/auth.types';

const VARIANTE_ID = '2a0f807e-ebe9-4706-b5ba-07a439474f25';

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'wide-format-v2-test-session',
  tenantId: '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8',
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

// El motor v2 no depende del service para quoteVariant (todo hardcoded/payload),
// así que podemos pasar un stub vacío.
const serviceStub = {} as ProductosServiciosService;

describe('WideFormatMotorModuleV2 (B.2 + B.3)', () => {
  let motor: WideFormatMotorModuleV2;

  beforeAll(() => {
    motor = new WideFormatMotorModuleV2(serviceStub);
  });

  describe('B.2 — shape canónica', () => {
    it('emite CotizacionCanonica con 4 pasos (sin laminado)', async () => {
      const result = await motor.quoteVariant(AUTH, VARIANTE_ID, {
        cantidad: 1,
        periodo: '2026-04',
        parametros: { anchoMm: 1000, altoMm: 500, conLaminado: false },
      } as never);

      expect(result.motorCodigo).toBe('gran_formato');
      expect(result.motorVersion).toBe(2);
      expect(result.pasos).toHaveLength(4); // sin laminado
      expect(result.pasos.map((p) => p.tipo)).toEqual([
        'pre_prensa',
        'impresion_por_area',
        'corte',
        'operacion_manual',
      ]);
      expect(result.subProductos).toEqual([]);
    });

    it('emite 5 pasos con laminado activado', async () => {
      const result = await motor.quoteVariant(AUTH, VARIANTE_ID, {
        cantidad: 1,
        periodo: '2026-04',
        parametros: { anchoMm: 1000, altoMm: 500, conLaminado: true },
      } as never);

      expect(result.pasos).toHaveLength(5);
      expect(result.pasos.map((p) => p.tipo)).toContain('laminado');
    });

    it('suma de buckets = total (coherencia)', async () => {
      const result = await motor.quoteVariant(AUTH, VARIANTE_ID, {
        cantidad: 3,
        periodo: '2026-04',
        parametros: { anchoMm: 1500, altoMm: 800, conLaminado: true },
      } as never);

      const sumaBuckets =
        result.subtotales.centroCosto +
        result.subtotales.materiasPrimas +
        result.subtotales.cargosFlat;
      expect(Math.abs(sumaBuckets - result.total)).toBeLessThanOrEqual(0.02);
    });

    it('rechaza payload sin medidas', async () => {
      await expect(
        motor.quoteVariant(AUTH, VARIANTE_ID, {
          cantidad: 1,
          periodo: '2026-04',
          parametros: {},
        } as never),
      ).rejects.toThrow(/anchoMm y parametros.altoMm/);
    });

    it('unitario = total / cantidad', async () => {
      const result = await motor.quoteVariant(AUTH, VARIANTE_ID, {
        cantidad: 4,
        periodo: '2026-04',
        parametros: { anchoMm: 500, altoMm: 500 },
      } as never);
      expect(result.unitario).toBeCloseTo(result.total / 4, 2);
    });
  });

  describe('B.3 — casos de validación G1-G4', () => {
    it('G1: 1 pieza 1000×500mm con laminado → rango $4.000–$10.000', async () => {
      const r = await motor.quoteVariant(AUTH, VARIANTE_ID, {
        cantidad: 1,
        periodo: '2026-04',
        parametros: { anchoMm: 1000, altoMm: 500, conLaminado: true },
      } as never);
      expect(r.total).toBeGreaterThan(4000);
      expect(r.total).toBeLessThan(10000);
      expect(r.pasos).toHaveLength(5);
    });

    it('G2: 2 piezas 2000×800mm sin laminado → rango $15.000–$40.000', async () => {
      const r = await motor.quoteVariant(AUTH, VARIANTE_ID, {
        cantidad: 2,
        periodo: '2026-04',
        parametros: { anchoMm: 2000, altoMm: 800, conLaminado: false },
      } as never);
      expect(r.total).toBeGreaterThan(15000);
      expect(r.total).toBeLessThan(40000);
      expect(r.pasos).toHaveLength(4);
    });

    it('G3: 10 stickers 500×500mm → incluye embalaje de 10 piezas', async () => {
      const r = await motor.quoteVariant(AUTH, VARIANTE_ID, {
        cantidad: 10,
        periodo: '2026-04',
        parametros: { anchoMm: 500, altoMm: 500, conLaminado: false },
      } as never);
      expect(r.total).toBeGreaterThan(5000);
      expect(r.total).toBeLessThan(25000);
      const embalaje = r.pasos.find((p) => p.tipo === 'operacion_manual');
      expect(embalaje?.trazabilidad).toMatchObject({ cantidad: 10, bolsas: 10 });
    });

    it('G4: rotulación 3000×600mm larga → alto centroCosto por impresión', async () => {
      const r = await motor.quoteVariant(AUTH, VARIANTE_ID, {
        cantidad: 1,
        periodo: '2026-04',
        parametros: { anchoMm: 3000, altoMm: 600, conLaminado: false },
      } as never);
      expect(r.total).toBeGreaterThan(6000);
      expect(r.total).toBeLessThan(30000);
      // 1.8 m² × 4800 = $8640 en sustrato; debe ser la mayor parte
      expect(r.subtotales.materiasPrimas).toBeGreaterThan(r.subtotales.centroCosto);
    });
  });
});
