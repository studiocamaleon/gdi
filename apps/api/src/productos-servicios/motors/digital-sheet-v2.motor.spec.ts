/**
 * Etapa C.4 — Tests del DigitalSheetMotorModuleV2.
 *
 * Usa producto seed "Tarjetas de Visita" con ProductoMotorConfig v2 (copia v1)
 * y variante "Estandar 9x5" (90×50mm). Pliego A4 (210×297), 10 piezas por A4
 * con demasía/margen default.
 */
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosServiciosService } from '../productos-servicios.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizacionCanonica } from '../dto/cotizacion-canonica.dto';

const VARIANTE_ID = '947969f5-442f-4ede-b43b-26df9a3a4e8a'; // Tarjetas 9x5

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'digital-v2-test',
  tenantId: '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8',
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

describe('DigitalSheetMotorModuleV2 (C.4 — piloto MVP tarjetas)', () => {
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

  async function cotizar(cantidad: number): Promise<CotizacionCanonica> {
    const motor = service['motorRegistry'].getModule('impresion_digital_laser', 2);
    return (await motor.quoteVariant(AUTH, VARIANTE_ID, {
      cantidad,
      periodo: '2026-04',
      parametros: {},
    } as never)) as CotizacionCanonica;
  }

  describe('Shape canónica', () => {
    it('cotiza 100 tarjetas: 4 pasos (pre_prensa, impresion_por_hoja, corte, embalaje)', async () => {
      const r = await cotizar(100);
      expect(r.motorCodigo).toBe('impresion_digital_laser');
      expect(r.motorVersion).toBe(2);
      expect(r.pasos).toHaveLength(4);
      expect(r.pasos.map((p) => p.tipo)).toEqual([
        'pre_prensa',
        'impresion_por_hoja',
        'corte',
        'operacion_manual',
      ]);
    });

    it('buckets suman total', async () => {
      const r = await cotizar(500);
      const suma =
        r.subtotales.centroCosto + r.subtotales.materiasPrimas + r.subtotales.cargosFlat;
      expect(Math.abs(suma - r.total)).toBeLessThanOrEqual(0.02);
    });

    it('unitario = total / cantidad', async () => {
      const r = await cotizar(250);
      expect(r.unitario).toBeCloseTo(r.total / 250, 2);
    });
  });

  describe('Nesting en pliego', () => {
    it('paso impresion incluye trazabilidad con placements y pliegos', async () => {
      const r = await cotizar(50);
      const impresion = r.pasos.find((p) => p.tipo === 'impresion_por_hoja')!;
      const traza = impresion.trazabilidad as Record<string, unknown>;
      const nesting = traza.nesting as Record<string, unknown>;
      expect(nesting.algoritmo).toBe('nesting-hoja');
      expect(Number(nesting.piezasPorPliego)).toBeGreaterThan(0);
      expect(Number(nesting.pliegosNecesarios)).toBeGreaterThan(0);
      expect(Array.isArray(nesting.placements)).toBe(true);
    });

    it('más cantidad → más pliegos necesarios', async () => {
      const r100 = await cotizar(100);
      const r500 = await cotizar(500);
      const pliegos100 = Number(
        (r100.pasos.find((p) => p.tipo === 'impresion_por_hoja')!.trazabilidad as any).nesting
          .pliegosNecesarios,
      );
      const pliegos500 = Number(
        (r500.pasos.find((p) => p.tipo === 'impresion_por_hoja')!.trazabilidad as any).nesting
          .pliegosNecesarios,
      );
      expect(pliegos500).toBeGreaterThan(pliegos100);
    });

    it('piezasPorPliego > 1 para tarjetas 9x5 en pliego A4', async () => {
      const r = await cotizar(100);
      const impresion = r.pasos.find((p) => p.tipo === 'impresion_por_hoja')!;
      const nesting = (impresion.trazabilidad as any).nesting;
      expect(nesting.piezasPorPliego).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Comportamiento de cantidad', () => {
    it('cantidad <= 0 se clampa a 1 (consistente con otros motores v2)', async () => {
      const r = await cotizar(0);
      expect(r.cantidad).toBe(1);
    });
  });
});
