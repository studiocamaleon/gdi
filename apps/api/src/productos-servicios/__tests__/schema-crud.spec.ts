/**
 * Tests CRUD del schema del Modelo Universal V2.
 *
 * Verifican que las entidades nuevas:
 * - Se pueden leer del seed (las creadas por seed-modulos/)
 * - Las relaciones funcionan vía Prisma include/select
 * - Los campos JSON serializan/deserializan correctamente
 * - Las constraints únicas y FKs funcionan
 *
 * NO verifican lógica de negocio del motor (eso es F.2).
 *
 * Pre-requisito: `npx prisma db seed` debe haberse ejecutado al menos una vez.
 * Si la DB está vacía, los tests se skippean con mensaje claro.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_SLUG = 'gdi-demo';

let tenantId: string | null = null;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  tenantId = tenant?.id ?? null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Schema CRUD — Modelo Universal V2', () => {
  describe('Tenant + Auth', () => {
    it('existe el tenant Corporearte', () => {
      if (!tenantId) {
        console.warn('⚠ Saltando test: ejecutar `npx prisma db seed` primero');
        return;
      }
      expect(tenantId).toBeTruthy();
    });
  });

  describe('Catálogo de máquinas', () => {
    it('hay 7 máquinas activas', async () => {
      if (!tenantId) return;
      const count = await prisma.maquina.count({
        where: { tenantId, activo: true },
      });
      expect(count).toBe(7);
    });

    it('cada máquina tiene al menos 1 perfil operativo', async () => {
      if (!tenantId) return;
      const maquinas = await prisma.maquina.findMany({
        where: { tenantId, activo: true },
        include: { perfilesOperativos: true },
      });
      for (const m of maquinas) {
        expect(m.perfilesOperativos.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('Ricoh PRO C5100 tiene 2 perfiles (simple/doble faz)', async () => {
      if (!tenantId) return;
      const ricoh = await prisma.maquina.findFirstOrThrow({
        where: { tenantId, codigo: 'RICOH-PRO-C5100' },
        include: { perfilesOperativos: true },
      });
      expect(ricoh.perfilesOperativos.length).toBe(2);
      const nombres = ricoh.perfilesOperativos.map((p) => p.nombre).sort();
      expect(nombres).toEqual([
        'Papel grueso doble faz',
        'Papel grueso simple faz',
      ]);
    });
  });

  describe('Materiales', () => {
    it('hay 11 materias primas activas (seed v3.0)', async () => {
      if (!tenantId) return;
      const count = await prisma.materiaPrima.count({
        where: { tenantId, activo: true },
      });
      expect(count).toBe(11);
    });

    it('Vinilo blanco tiene 2 variantes (1.37m y 1.52m)', async () => {
      if (!tenantId) return;
      const vinilo = await prisma.materiaPrima.findFirstOrThrow({
        where: { tenantId, codigo: 'VINILO-BLANCO-MONO' },
        include: { variantes: true },
      });
      expect(vinilo.variantes.length).toBe(2);
    });

    it('las materias primas seed usan plantillas vigentes', async () => {
      if (!tenantId) return;
      const legacyTemplateIds = [
        'papel_hoja',
        'vinilo_rollo',
        'rigido_placa',
        'film_laminado',
        'embalaje',
        'consumible_maquina',
      ];
      const count = await prisma.materiaPrima.count({
        where: { tenantId, templateId: { in: legacyTemplateIds } },
      });
      expect(count).toBe(0);
    });

    it('Tóner Ricoh tiene variantes CMYK completas', async () => {
      if (!tenantId) return;
      const toner = await prisma.materiaPrima.findFirstOrThrow({
        where: { tenantId, codigo: 'TONER-CMYK-RICOH' },
        include: { variantes: { where: { activo: true } } },
      });
      expect(toner.templateId).toBe('toner_v1');
      expect(toner.variantes).toHaveLength(4);
      const colores = toner.variantes
        .map(
          (variante) =>
            (variante.atributosVarianteJson as Record<string, unknown>).color,
        )
        .sort();
      expect(colores).toEqual(['Amarillo', 'Cian', 'Magenta', 'Negro']);
    });

    it('atributos técnicos JSON se preservan', async () => {
      if (!tenantId) return;
      const opalina = await prisma.materiaPrima.findFirstOrThrow({
        where: { tenantId, codigo: 'PAPEL-OPALINA-300' },
      });
      const attrs = opalina.atributosTecnicosJson as Record<string, unknown>;
      expect(attrs.gramajeGr).toBe(300);
      expect(attrs.color).toBe('blanco');
    });
  });

  describe('Cargos directos catálogo (D.6)', () => {
    it('hay 5 tipos en el catálogo', async () => {
      if (!tenantId) return;
      const count = await prisma.cargoDirectoCatalogo.count({
        where: { tenantId, activo: true },
      });
      expect(count).toBe(5);
    });

    it('viatico tiene zonas configuradas en JSON', async () => {
      if (!tenantId) return;
      const viatico = await prisma.cargoDirectoCatalogo.findFirstOrThrow({
        where: { tenantId, codigo: 'viatico' },
      });
      expect(viatico.modoCalculo).toBe('MONTO_FIJO_PLANO');
      const config = viatico.configJson as {
        zonas?: Array<{ codigo: string; monto: number }>;
      };
      expect(config.zonas?.length).toBeGreaterThan(0);
    });

    it('combustible_flete usa POR_UNIDAD_INPUT con $/km', async () => {
      if (!tenantId) return;
      const combustible = await prisma.cargoDirectoCatalogo.findFirstOrThrow({
        where: { tenantId, codigo: 'combustible_flete' },
      });
      expect(combustible.modoCalculo).toBe('POR_UNIDAD_INPUT');
      const config = combustible.configJson as {
        precioPorUnidad?: number;
        unidad?: string;
      };
      expect(config.unidad).toBe('km');
      expect(config.precioPorUnidad).toBe(80);
    });
  });

  describe('Rutas de producción', () => {
    it('hay 5 rutas activas', async () => {
      if (!tenantId) return;
      const count = await prisma.ruta.count({
        where: { tenantId, activo: true },
      });
      expect(count).toBe(5);
    });

    it('cada ruta tiene su versión inicial guardada', async () => {
      if (!tenantId) return;
      const rutas = await prisma.ruta.findMany({
        where: { tenantId, activo: true },
        include: { versiones: true },
      });
      for (const r of rutas) {
        expect(r.versiones.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('Ruta "Talonario emblocado" tiene 10 pasos en orden', async () => {
      if (!tenantId) return;
      const ruta = await prisma.ruta.findFirstOrThrow({
        where: { tenantId, codigo: 'RUTA-TALONARIO-EMBLOCADO' },
        include: { pasos: { orderBy: { orden: 'asc' } } },
      });
      expect(ruta.pasos.length).toBe(10);
      // Verificar orden + familias
      expect(ruta.pasos[0].familiaCodigo).toBe('diseno_grafico');
      expect(ruta.pasos[1].familiaCodigo).toBe('pre_prensa');
      // 3 pasos consecutivos de impresión (capas 1, 2, 3)
      expect(ruta.pasos[2].familiaCodigo).toBe('impresion_por_hoja');
      expect(ruta.pasos[3].familiaCodigo).toBe('impresion_por_hoja');
      expect(ruta.pasos[4].familiaCodigo).toBe('impresion_por_hoja');
      // Encuadernación + corte + embalaje al final
      expect(ruta.pasos[7].familiaCodigo).toBe('engomado_emblocado');
    });
  });

  describe('Productos + configuración por paso', () => {
    it('hay al menos los 4 productos del seed activos', async () => {
      if (!tenantId) return;
      // ≥ 4 (no === 4) para tolerar productos creados manualmente por el
      // usuario vía UI durante pruebas; el seed instala 4 fijos.
      const count = await prisma.producto.count({
        where: { tenantId, activo: true },
      });
      expect(count).toBeGreaterThanOrEqual(4);
      const seedCodigos = [
        'TARJ-PREMIUM-300',
        'VINILO-BLANCO-IMP',
        'TALON-DUPL-A4',
        'RIGIDO-CUSTOM',
      ];
      const seedExistentes = await prisma.producto.count({
        where: { tenantId, activo: true, codigo: { in: seedCodigos } },
      });
      expect(seedExistentes).toBe(4);
    });

    it('Talonario tiene 2 rutas alternativas (emblocado preferido + abrochado)', async () => {
      if (!tenantId) return;
      const talonario = await prisma.producto.findFirstOrThrow({
        where: { tenantId, codigo: 'TALON-DUPL-A4' },
        include: { rutasAlternativas: { include: { ruta: true } } },
      });
      expect(talonario.rutasAlternativas.length).toBe(2);

      const preferida = talonario.rutasAlternativas.find((r) => r.esPreferida);
      expect(preferida).toBeDefined();
      expect(preferida!.nombre).toBe('Emblocado');

      const noPreferida = talonario.rutasAlternativas.find(
        (r) => !r.esPreferida,
      );
      expect(noPreferida!.nombre).toBe('Abrochado');
    });

    it('Tarjetas Premium 300gr tiene config completa con maquina M-1 y materiales', async () => {
      if (!tenantId) return;
      const tarjetas = await prisma.producto.findFirstOrThrow({
        where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
        include: {
          rutasAlternativas: {
            include: {
              configPasos: {
                include: {
                  maquinaM1: true,
                  perfilM1: true,
                  slotsMateriales: {
                    include: { candidatos: { include: { variantes: true } } },
                  },
                  rutaPaso: true,
                },
                orderBy: { rutaPaso: { orden: 'asc' } },
              },
            },
          },
        },
      });
      const ruta = tarjetas.rutasAlternativas[0];
      expect(ruta.configPasos.length).toBe(7);

      const impresion = ruta.configPasos.find(
        (c) => c.rutaPaso.familiaCodigo === 'impresion_por_hoja',
      );
      expect(impresion).toBeDefined();
      expect(impresion!.maquinaM1?.codigo).toBe('RICOH-PRO-C5100');
      expect(impresion!.perfilM1?.nombre).toBe('Papel grueso simple faz');
      expect(impresion!.slotsMateriales.length).toBe(1);
      expect(impresion!.slotsMateriales[0].slotCodigo).toBe(
        'sustrato_principal',
      );
      expect(impresion!.slotsMateriales[0].modoSeleccion).toBe('HARDCODED');
    });

    it('Vinilo blanco tiene cargo viático asociado a cotización (OPCIONAL)', async () => {
      if (!tenantId) return;
      const vinilo = await prisma.producto.findFirstOrThrow({
        where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
        include: {
          cargosDirectosCotizacion: {
            include: { cargoDirectoCatalogo: true },
          },
        },
      });
      expect(vinilo.cargosDirectosCotizacion.length).toBe(1);
      const viatico = vinilo.cargosDirectosCotizacion[0];
      expect(viatico.cargoDirectoCatalogo.codigo).toBe('viatico');
      expect(viatico.modoActivacion).toBe('OPCIONAL');
    });

    it('Vinilo blanco usa MOTOR_ELIGE_AUTO con criterio MAYOR_APROVECHAMIENTO', async () => {
      if (!tenantId) return;
      const vinilo = await prisma.producto.findFirstOrThrow({
        where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
        include: {
          rutasAlternativas: {
            include: {
              configPasos: {
                include: {
                  slotsMateriales: {
                    include: { candidatos: { include: { variantes: true } } },
                  },
                  rutaPaso: true,
                },
              },
            },
          },
        },
      });
      const ruta = vinilo.rutasAlternativas[0];
      const impresion = ruta.configPasos.find(
        (c) => c.rutaPaso.familiaCodigo === 'impresion_por_area',
      );
      expect(impresion).toBeDefined();
      const slot = impresion!.slotsMateriales[0];
      expect(slot.modoSeleccion).toBe('MOTOR_ELIGE_AUTO');
      expect(slot.criterioMotorAuto).toBe('MAYOR_APROVECHAMIENTO');
      const variantes = slot.candidatos.flatMap((c) => c.variantes);
      expect(variantes.length).toBe(2); // 2 anchos de rollo (1.37m + 1.52m)
    });

    it('Talonario emblocado tiene 3 pasos impresión con activación CONDICIONAL por capa', async () => {
      if (!tenantId) return;
      const talonario = await prisma.producto.findFirstOrThrow({
        where: { tenantId, codigo: 'TALON-DUPL-A4' },
        include: {
          rutasAlternativas: {
            where: { esPreferida: true },
            include: {
              configPasos: {
                include: { rutaPaso: true },
                orderBy: { rutaPaso: { orden: 'asc' } },
              },
            },
          },
        },
      });
      const ruta = talonario.rutasAlternativas[0];
      const pasosImpresion = ruta.configPasos.filter(
        (c) => c.rutaPaso.familiaCodigo === 'impresion_por_hoja',
      );
      expect(pasosImpresion.length).toBe(3);

      // Capa 1 OBLIGATORIO, Capa 2 y 3 CONDICIONAL
      expect(pasosImpresion[0].modoActivacion).toBe('OBLIGATORIO');
      expect(pasosImpresion[1].modoActivacion).toBe('CONDICIONAL');
      expect(pasosImpresion[2].modoActivacion).toBe('CONDICIONAL');

      // Verificar regla JsonLogic
      const condicion2 = pasosImpresion[1].condicionActivacionJson as {
        '>='?: unknown[];
      };
      expect(condicion2['>=']).toBeDefined();
    });

    it('Talonario emblocado declara "modoTalonarioIncompleto" en el paso del original', async () => {
      if (!tenantId) return;
      const talonario = await prisma.producto.findFirstOrThrow({
        where: { tenantId, codigo: 'TALON-DUPL-A4' },
        include: {
          rutasAlternativas: {
            where: { esPreferida: true },
            include: {
              configPasos: {
                include: { rutaPaso: true },
              },
            },
          },
        },
      });
      const ruta = talonario.rutasAlternativas[0];
      // El modo vive en el paso que imprime el original: es el que acomoda y
      // el que publica las pilas. Pre-prensa ya no calcula nada.
      const original = ruta.configPasos
        .filter((c) => c.rutaPaso.familiaCodigo === 'impresion_por_hoja')
        .sort((a, b) => a.rutaPaso.orden - b.rutaPaso.orden)[0];
      expect(original).toBeDefined();
      const params = original!.paramsPasoJson as {
        modoTalonarioIncompleto?: string;
      };
      expect(params.modoTalonarioIncompleto).toBe('aprovechar_pliego');
    });

    it('Rígido custom usa modoMedidas LIBRE (gap H4)', async () => {
      if (!tenantId) return;
      const rigido = await prisma.producto.findFirstOrThrow({
        where: { tenantId, codigo: 'RIGIDO-CUSTOM' },
      });
      expect(rigido.modoMedidas).toBe('LIBRE');
      expect(rigido.medidaDefaultAnchoMm).toBeNull();
      expect(rigido.medidaDefaultAltoMm).toBeNull();
    });

    it('Tarjetas usa modoMedidas FIJA con default 90x50', async () => {
      if (!tenantId) return;
      const tarjetas = await prisma.producto.findFirstOrThrow({
        where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      });
      expect(tarjetas.modoMedidas).toBe('FIJA');
      expect(tarjetas.medidaDefaultAnchoMm?.toString()).toBe('90');
      expect(tarjetas.medidaDefaultAltoMm?.toString()).toBe('50');
    });
  });

  describe('Tab Precio (preservado)', () => {
    it('cada producto tiene precioConfigJson con método válido', async () => {
      if (!tenantId) return;
      const productos = await prisma.producto.findMany({
        where: { tenantId, activo: true },
      });
      const metodosValidos = new Set([
        'margen_variable',
        'por_margen',
        'precio_fijo',
        'fijado_por_cantidad',
        'fijo_con_margen_variable',
        'variable_por_cantidad',
        'precio_fijo_para_margen_minimo',
      ]);
      for (const p of productos) {
        const cfg = p.precioConfigJson as { metodoCalculo?: string } | null;
        expect(cfg).toBeTruthy();
        expect(metodosValidos.has(cfg!.metodoCalculo!)).toBe(true);
      }
    });
  });
});
