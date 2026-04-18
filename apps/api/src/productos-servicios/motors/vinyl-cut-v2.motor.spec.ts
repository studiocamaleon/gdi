/**
 * Etapa C.3 — Tests del VinylCutMotorModuleV2.
 *
 * Usa producto seed "Vinilo de corte" con ProductoMotorConfig v2 (copia de v1).
 */
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosServiciosService } from '../productos-servicios.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizacionCanonica } from '../dto/cotizacion-canonica.dto';

const VARIANTE_ID = '2e653683-c08b-4093-8b69-1fb0b16e5668'; // Genérico de Vinilo de corte

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'vinyl-cut-v2-test',
  tenantId: '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8',
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

describe('VinylCutMotorModuleV2 (C.3 — piloto single-color)', () => {
  let prisma: PrismaService;
  let service: ProductosServiciosService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ProductosServiciosService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cotizar(
    params: Record<string, unknown>,
    cantidad = 1,
  ): Promise<CotizacionCanonica> {
    const motor = service['motorRegistry'].getModule('vinilo_de_corte', 2);
    return (await motor.quoteVariant(AUTH, VARIANTE_ID, {
      cantidad,
      periodo: '2026-04',
      parametros: params,
    } as never)) as CotizacionCanonica;
  }

  describe('Shape canónica', () => {
    it('cotiza 1 pieza 500×300mm: 3 pasos (pre_prensa, corte, embalaje)', async () => {
      const r = await cotizar({ anchoMm: 500, altoMm: 300 }, 1);
      expect(r.motorCodigo).toBe('vinilo_de_corte');
      expect(r.motorVersion).toBe(2);
      expect(r.pasos).toHaveLength(3);
      expect(r.pasos.map((p) => p.tipo)).toEqual(['pre_prensa', 'corte', 'operacion_manual']);
    });

    it('buckets suman total', async () => {
      const r = await cotizar({ anchoMm: 300, altoMm: 200 }, 5);
      const suma =
        r.subtotales.centroCosto + r.subtotales.materiasPrimas + r.subtotales.cargosFlat;
      expect(Math.abs(suma - r.total)).toBeLessThanOrEqual(0.02);
    });

    it('unitario = total / cantidad', async () => {
      const r = await cotizar({ anchoMm: 400, altoMm: 300 }, 10);
      expect(r.unitario).toBeCloseTo(r.total / 10, 2);
    });
  });

  describe('Nesting sobre rollo', () => {
    it('paso corte incluye trazabilidad de nesting (placements, largo consumido)', async () => {
      const r = await cotizar({ anchoMm: 300, altoMm: 200 }, 4);
      const corte = r.pasos.find((p) => p.tipo === 'corte');
      expect(corte).toBeDefined();
      const traza = corte!.trazabilidad as Record<string, unknown>;
      const nesting = traza.nesting as Record<string, unknown>;
      expect(nesting.largoConsumidoMm).toBeDefined();
      expect(Array.isArray(nesting.placements)).toBe(true);
      expect(nesting.aprovechamientoPct).toBeDefined();
    });

    it('pieza gigante que no entra en ningún rollo → error', async () => {
      // Rollo seed: vinilo calandrado 0.63m, ancho útil ~620mm.
      await expect(cotizar({ anchoMm: 2000, altoMm: 1500 }, 1)).rejects.toThrow(
        /ninguno de los materiales compatibles/,
      );
    });

    it('materialElegido expone metadata del rollo ganador', async () => {
      const r = await cotizar({ anchoMm: 400, altoMm: 200 }, 2);
      const corte = r.pasos.find((p) => p.tipo === 'corte')!;
      const traza = corte.trazabilidad as Record<string, unknown>;
      const material = traza.materialElegido as Record<string, unknown>;
      expect(material.id).toBeDefined();
      expect(material.rolloAnchoMm).toBeGreaterThan(0);
      expect(material.rolloLargoM).toBeGreaterThan(0);
      expect(material.precioPorM2).toBeGreaterThan(0);
    });
  });

  describe('Validación de inputs', () => {
    it('rechaza si no hay medidas', async () => {
      await expect(cotizar({}, 1)).rejects.toThrow(/anchoMm/);
    });

    it('acepta medidas múltiples', async () => {
      const r = await cotizar(
        {
          medidas: [
            { anchoMm: 300, altoMm: 200, cantidad: 2 },
            { anchoMm: 500, altoMm: 300, cantidad: 1 },
          ],
        },
        1,
      );
      expect(r.cantidad).toBe(3);
      expect(r.pasos).toHaveLength(3);
    });
  });
});
