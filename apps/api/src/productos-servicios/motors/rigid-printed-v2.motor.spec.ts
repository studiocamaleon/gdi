/**
 * Etapa C.5 — Tests del RigidPrintedMotorModuleV2.
 *
 * Usa producto seed "MDF Impreso" con ProductoMotorConfig v2 (copia v1).
 * El motor rígidos acepta el productoId en el campo varianteId (product-level
 * flow) porque este dominio suele cotizar sin ProductoVariante — muchas
 * cotizaciones son "medida libre" tomada directo del payload.
 * Placas compatibles: MDF 1.22×2.44m de 3mm ($30k) y 5mm ($45k).
 */
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosServiciosService } from '../productos-servicios.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizacionCanonica } from '../dto/cotizacion-canonica.dto';

// Para rígidos no hay ProductoVariante — el motor acepta productoId directo.
const PRODUCTO_ID = '14516e74-5d26-464f-9589-95225ccb6bb6'; // MDF Impreso

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'rigid-v2-test',
  tenantId: '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8',
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

describe('RigidPrintedMotorModuleV2 (C.5 — piloto MVP rígidos)', () => {
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
    const motor = service['motorRegistry'].getModule('rigidos_impresos', 2);
    return (await motor.quoteVariant(AUTH, PRODUCTO_ID, {
      cantidad,
      periodo: '2026-04',
      parametros: params,
    } as never)) as CotizacionCanonica;
  }

  describe('Shape canónica', () => {
    it('cotiza 1 pieza 400×600mm: 4 pasos (pre_prensa, impresion, corte, embalaje)', async () => {
      const r = await cotizar({ anchoMm: 400, altoMm: 600 }, 1);
      expect(r.motorCodigo).toBe('rigidos_impresos');
      expect(r.motorVersion).toBe(2);
      expect(r.pasos).toHaveLength(4);
      expect(r.pasos.map((p) => p.tipo)).toEqual([
        'pre_prensa',
        'impresion_por_pieza',
        'corte_volumetrico',
        'operacion_manual',
      ]);
    });

    it('buckets suman total', async () => {
      const r = await cotizar({ anchoMm: 300, altoMm: 300 }, 5);
      const suma =
        r.subtotales.centroCosto + r.subtotales.materiasPrimas + r.subtotales.cargosFlat;
      expect(Math.abs(suma - r.total)).toBeLessThanOrEqual(0.02);
    });

    it('unitario = total / cantidad', async () => {
      const r = await cotizar({ anchoMm: 500, altoMm: 500 }, 4);
      expect(r.unitario).toBeCloseTo(r.total / 4, 2);
    });
  });

  describe('Nesting en placa rígida', () => {
    it('paso impresion_por_pieza incluye trazabilidad con placements y nesting', async () => {
      const r = await cotizar({ anchoMm: 400, altoMm: 300 }, 4);
      const impresion = r.pasos.find((p) => p.tipo === 'impresion_por_pieza')!;
      const traza = impresion.trazabilidad as Record<string, unknown>;
      const nesting = traza.nesting as Record<string, unknown>;
      expect(nesting.algoritmo).toBe('nesting-placa-rigida');
      expect(Number(nesting.piezasPorPlaca)).toBeGreaterThan(0);
      expect(Number(nesting.placasNecesarias)).toBeGreaterThan(0);
      expect(Array.isArray(nesting.placements)).toBe(true);
    });

    it('evalúa ambas placas (3mm y 5mm) y elige por menor_costo_total', async () => {
      const r = await cotizar({ anchoMm: 400, altoMm: 300 }, 2);
      const impresion = r.pasos.find((p) => p.tipo === 'impresion_por_pieza')!;
      const traza = impresion.trazabilidad as Record<string, unknown>;
      const placasEval = traza.placasEvaluadas as Array<{ espesor: number; esGanadora: boolean }>;
      expect(placasEval.length).toBe(2);
      const ganadora = placasEval.find((p) => p.esGanadora);
      expect(ganadora).toBeDefined();
      // El MDF 3mm ($30k) es más barato que el 5mm ($45k), así que gana el de 3mm.
      expect(ganadora?.espesor).toBe(3);
    });

    it('pieza gigante que no entra en ninguna placa → error', async () => {
      await expect(cotizar({ anchoMm: 3000, altoMm: 3000 }, 1)).rejects.toThrow(
        /ninguna placa compatible/,
      );
    });

    it('placaVarianteId fuerza la selección de una placa específica', async () => {
      // Forzamos la placa de 5mm (más cara), aunque menor_costo_total elegiría la 3mm.
      const r = await cotizar(
        {
          anchoMm: 400,
          altoMm: 300,
          placaVarianteId: 'b347b7d5-0c14-4c01-b95a-9ccd1260d76f',
        },
        1,
      );
      const impresion = r.pasos.find((p) => p.tipo === 'impresion_por_pieza')!;
      const traza = impresion.trazabilidad as Record<string, unknown>;
      const placa = traza.placaElegida as { espesor: number };
      expect(placa.espesor).toBe(5);
    });
  });

  describe('Validación de inputs', () => {
    it('rechaza si no hay medidas', async () => {
      await expect(cotizar({}, 1)).rejects.toThrow(/anchoMm/);
    });
  });
});
