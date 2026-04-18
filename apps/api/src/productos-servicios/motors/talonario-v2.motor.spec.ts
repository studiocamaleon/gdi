/**
 * Etapa C.6 — Tests del TalonarioMotorModuleV2.
 *
 * Producto seed "Talonarios emblocados" variante "10x15" (95×140mm) con
 * ProductoMotorConfig v2 copiado de v1. COPIA_SIMPLE, numerosXTalonarioDefault=50.
 */
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosServiciosService } from '../productos-servicios.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizacionCanonica } from '../dto/cotizacion-canonica.dto';

const VARIANTE_ID = 'dd823592-1887-493e-93be-33f7b5232878'; // Talonario 10x15

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'talonario-v2-test',
  tenantId: '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8',
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

describe('TalonarioMotorModuleV2 (C.6 — piloto MVP COPIA_SIMPLE)', () => {
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
    cantidadTalonarios: number,
    params: Record<string, unknown> = {},
  ): Promise<CotizacionCanonica> {
    const motor = service['motorRegistry'].getModule('talonario', 2);
    return (await motor.quoteVariant(AUTH, VARIANTE_ID, {
      cantidad: cantidadTalonarios,
      periodo: '2026-04',
      parametros: params,
    } as never)) as CotizacionCanonica;
  }

  describe('Shape canónica', () => {
    it('cotiza 10 talonarios: 4 pasos (pre_prensa, impresion, encuadernado, embalaje)', async () => {
      const r = await cotizar(10);
      expect(r.motorCodigo).toBe('talonario');
      expect(r.motorVersion).toBe(2);
      expect(r.pasos).toHaveLength(4);
      expect(r.pasos.map((p) => p.tipo)).toEqual([
        'pre_prensa',
        'impresion_por_hoja',
        'encuadernado',
        'operacion_manual',
      ]);
    });

    it('buckets suman total', async () => {
      const r = await cotizar(5);
      const suma =
        r.subtotales.centroCosto + r.subtotales.materiasPrimas + r.subtotales.cargosFlat;
      expect(Math.abs(suma - r.total)).toBeLessThanOrEqual(0.02);
    });

    it('unitario = total / cantidadTalonarios', async () => {
      const r = await cotizar(20);
      expect(r.unitario).toBeCloseTo(r.total / 20, 2);
    });
  });

  describe('Numeración y formularios', () => {
    it('usa numerosXTalonarioDefault si no se pasa override (50 seed)', async () => {
      const r = await cotizar(5);
      const traza = r.trazabilidad as Record<string, unknown>;
      expect(traza.numerosXTalonario).toBe(50);
      expect(traza.totalFormularios).toBe(5 * 50 * 1);
    });

    it('numerosXTalonario override en parametros', async () => {
      const r = await cotizar(3, { numerosXTalonario: 100 });
      const traza = r.trazabilidad as Record<string, unknown>;
      expect(traza.numerosXTalonario).toBe(100);
      expect(traza.totalFormularios).toBe(3 * 100 * 1);
    });

    it('tipoCopia default = COPIA_SIMPLE (1 capa)', async () => {
      const r = await cotizar(5);
      const traza = r.trazabilidad as Record<string, unknown>;
      expect(traza.tipoCopia).toBe('COPIA_SIMPLE');
      expect(traza.capas).toBe(1);
    });
  });

  describe('Nesting en pliego', () => {
    it('paso impresion incluye trazabilidad con pliegos y piezasPorPliego', async () => {
      const r = await cotizar(10);
      const impresion = r.pasos.find((p) => p.tipo === 'impresion_por_hoja')!;
      const nesting = (impresion.trazabilidad as any).nesting;
      expect(nesting.algoritmo).toBe('nesting-hoja');
      expect(nesting.piezasPorPliego).toBeGreaterThan(0);
      expect(nesting.pliegosNecesarios).toBeGreaterThan(0);
    });

    it('más talonarios → más pliegos necesarios', async () => {
      const r5 = await cotizar(5);
      const r50 = await cotizar(50);
      const pliegos5 = (r5.pasos.find((p) => p.tipo === 'impresion_por_hoja')!.trazabilidad as any).nesting.pliegosNecesarios;
      const pliegos50 = (r50.pasos.find((p) => p.tipo === 'impresion_por_hoja')!.trazabilidad as any).nesting.pliegosNecesarios;
      expect(pliegos50).toBeGreaterThan(pliegos5);
    });
  });
});
