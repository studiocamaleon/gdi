/**
 * Etapa B.2/B.3 + C.2 — Tests del WideFormatMotorModuleV2.
 *
 * Ahora el motor lee config + materiales desde la DB. Los tests instancian
 * el service real con Prisma y prueban cotización contra el producto "Vinilo
 * adhesivo blanco" con 3 materiales compatibles (ancho 1.06 / 1.37 / 1.52m).
 */
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosServiciosService } from '../productos-servicios.service';
import type { CurrentAuth } from '../../auth/auth.types';

const VARIANTE_ID = '2a0f807e-ebe9-4706-b5ba-07a439474f25'; // Genérico del producto Vinilo adhesivo blanco

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'wide-format-v2-test',
  tenantId: '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8',
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

describe('WideFormatMotorModuleV2 (C.2 — nesting real + selección de material)', () => {
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

  async function cotizar(params: Record<string, unknown>, cantidad = 1, conLaminado = false) {
    const motor = service['motorRegistry'].getModule('gran_formato', 2);
    return motor.quoteVariant(AUTH, VARIANTE_ID, {
      cantidad,
      periodo: '2026-04',
      parametros: { ...params, conLaminado },
    } as never);
  }

  describe('Shape canónica + selección de material', () => {
    it('cotiza 1 pieza 1000×500mm: elige material y muestra materialesEvaluados', async () => {
      const r = await cotizar({ anchoMm: 1000, altoMm: 500 }, 1);
      expect(r.motorCodigo).toBe('gran_formato');
      expect(r.motorVersion).toBe(2);
      expect(r.pasos).toHaveLength(4);

      const impresion = r.pasos.find((p) => p.tipo === 'impresion_por_area');
      expect(impresion).toBeDefined();
      const traza = impresion!.trazabilidad as Record<string, unknown>;
      expect(traza.materialElegido).toBeDefined();
      expect(traza.materialesEvaluados).toBeDefined();
      expect(Array.isArray(traza.materialesEvaluados)).toBe(true);
    });

    it('con laminado: agrega 5to paso', async () => {
      const r = await cotizar({ anchoMm: 1000, altoMm: 500 }, 1, true);
      expect(r.pasos).toHaveLength(5);
      expect(r.pasos.map((p) => p.tipo)).toContain('laminado');
    });

    it('buckets suman total', async () => {
      const r = await cotizar({ anchoMm: 600, altoMm: 400 }, 3);
      const suma =
        r.subtotales.centroCosto + r.subtotales.materiasPrimas + r.subtotales.cargosFlat;
      expect(Math.abs(suma - r.total)).toBeLessThanOrEqual(0.02);
    });

    it('unitario = total / cantidad', async () => {
      const r = await cotizar({ anchoMm: 500, altoMm: 500 }, 4);
      expect(r.unitario).toBeCloseTo(r.total / 4, 2);
    });
  });

  describe('Selección de material por menor_costo_total', () => {
    it('pieza 1000×1400mm: cabe en todos; elige el rollo de 1060mm (menor costo)', async () => {
      // Orientación natural: ancho 1000 <= 1050 (ancho útil 1060). Cabe.
      // Los 3 rollos aceptan la pieza; gana el 1060mm por menor costo total
      // (mismo precio por m² pero menos área consumida = menor costo).
      const r = await cotizar({ anchoMm: 1000, altoMm: 1400 }, 1);
      const impresion = r.pasos.find((p) => p.tipo === 'impresion_por_area')!;
      const traza = impresion.trazabilidad as Record<string, unknown>;
      const material = traza.materialElegido as { rolloAnchoMm: number };
      expect(material.rolloAnchoMm).toBe(1060);

      // Los 3 materiales deben estar evaluados (criterio "menor_costo_total" ganó el de 1060)
      const evaluados = traza.materialesEvaluados as Array<{ rolloAnchoMm: number; esGanador: boolean }>;
      expect(evaluados).toHaveLength(3);
      const ganador = evaluados.find((e) => e.esGanador);
      expect(ganador?.rolloAnchoMm).toBe(1060);
    });

    it('pieza 1600×1600mm: ningún rollo la soporta → error', async () => {
      // 1600 y 1600 no caben en ancho útil 1510 del rollo más grande (1520mm - 2×5 margen).
      await expect(cotizar({ anchoMm: 1600, altoMm: 1600 }, 1)).rejects.toThrow(
        /ninguno de los materiales compatibles/,
      );
    });

    it('aprovechamiento del ganador se expone en trazabilidad', async () => {
      const r = await cotizar({ anchoMm: 500, altoMm: 300 }, 10);
      const impresion = r.pasos.find((p) => p.tipo === 'impresion_por_area')!;
      const traza = impresion.trazabilidad as Record<string, unknown>;
      const nesting = traza.nesting as Record<string, unknown>;
      expect(nesting.aprovechamientoPct).toBeDefined();
      expect(Number(nesting.aprovechamientoPct)).toBeGreaterThan(0);
      expect(Number(nesting.aprovechamientoPct)).toBeLessThanOrEqual(100);
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
            { anchoMm: 500, altoMm: 300, cantidad: 2 },
            { anchoMm: 800, altoMm: 400, cantidad: 1 },
          ],
        },
        1,
      );
      expect(r.cantidad).toBe(3);
      expect(r.pasos).toHaveLength(4);
    });
  });
});
