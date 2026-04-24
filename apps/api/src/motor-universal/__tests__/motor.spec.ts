/**
 * Tests del Motor Universal — MVP F.2.
 *
 * Smoke tests que validan el bucle base contra los productos del seed.
 * NO valida resultados numéricos exactos (eso es F.2.x cuando se implementen
 * todas las sub-tareas + tarifas).
 */

import { PrismaClient } from '@prisma/client';
import { MotorUniversalService } from '../motor.service';

const prisma = new PrismaClient();

let tenantId: string | null = null;
let motorService: MotorUniversalService;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'gdi-demo' } });
  tenantId = tenant?.id ?? null;
  // Inyectamos el prisma client directamente (sin DI de NestJS para test unitario)
  motorService = new MotorUniversalService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('MotorUniversalService — smoke tests', () => {
  it('cotiza Tarjetas Premium 300gr y devuelve estructura válida', async () => {
    if (!tenantId) {
      console.warn('⚠ Saltando: ejecutar `npx prisma db seed` primero');
      return;
    }
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000, caras: 2 },
    });

    expect(result.exitoso).toBe(true);
    expect(result.errores).toEqual([]);
    expect(result.cotizacion).toBeDefined();
    expect(result.cotizacion!.productoId).toBe(tarjetas.id);
    expect(result.cotizacion!.cantidadPedida).toBe(1000);
    expect(result.cotizacion!.pasos.length).toBe(7);
  });

  it('Tarjetas: pasos OBLIGATORIOS se activan, OPCIONALES no se activan por default', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 100 },
    });

    expect(result.exitoso).toBe(true);
    const pasos = result.cotizacion!.pasos;
    // pre_prensa, impresion_por_hoja, corte_guillotina, embalaje deben estar activos
    const obligatorios = pasos.filter((p) => p.activado);
    const opcionales = pasos.filter((p) => !p.activado);
    expect(obligatorios.length).toBe(4); // los 4 OBLIGATORIO
    expect(opcionales.length).toBe(3); // diseño, laminado, redondeo
  });

  it('Tarjetas: con laminado activado por comercial, se ejecuta', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: {
            configPasos: { include: { rutaPaso: true } },
          },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find((c) => c.rutaPaso.familiaCodigo === 'laminado');
    expect(laminado).toBeDefined();

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 100,
        caras: 2,
        opcionalesActivados: { [laminado!.id]: true },
      },
    });

    expect(result.exitoso).toBe(true);
    const pasoLaminado = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    );
    expect(pasoLaminado!.activado).toBe(true);
  });

  it('cotiza Vinilo blanco impreso (ruta gran formato) sin errores', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 3, anchoMm: 2000, altoMm: 1000 }],
        tecnologia: 'latex',
      },
    });

    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.pasos.length).toBe(6);
  });

  it('cotiza Talonario duplicado A4 (3 capas, ruta emblocada preferida)', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      jobContext: {
        cantidad: 100,
        tipoCopia: 2,
        numerosXTalonario: 50,
      },
    });

    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.rutaNombre).toBe('Emblocado'); // preferida
    expect(result.cotizacion!.pasos.length).toBe(10);

    // Capa 1 OBLIGATORIO se activa
    const pasosImpresion = result.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    expect(pasosImpresion[0].activado).toBe(true);
    // Capas 2 y 3 son CONDICIONAL (todavía no implementadas, devuelven activado=false)
    expect(pasosImpresion[1].activado).toBe(false);
    expect(pasosImpresion[2].activado).toBe(false);
  });

  it('cotiza Talonario con ruta alternativa Abrochado explícita', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
      include: { rutasAlternativas: true },
    });
    const abrochada = talonario.rutasAlternativas.find((r) => r.nombre === 'Abrochado');

    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      rutaAlternativaId: abrochada!.id,
      jobContext: { cantidad: 100, tipoCopia: 1 },
    });

    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.rutaNombre).toBe('Abrochado');
  });

  it('cotiza Rígido impreso custom (modoMedidas LIBRE)', async () => {
    if (!tenantId) return;
    const rigido = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'RIGIDO-CUSTOM' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: rigido.id,
      jobContext: {
        cantidad: 5,
        medidaCustomMm: { anchoMm: 200, altoMm: 300 },
      },
    });

    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.pasos.length).toBe(8);
  });

  it('devuelve error si productoId no existe', async () => {
    if (!tenantId) return;
    const result = await motorService.cotizar({
      tenantId,
      productoId: '00000000-0000-0000-0000-000000000000',
      jobContext: { cantidad: 100 },
    });

    expect(result.exitoso).toBe(false);
    expect(result.errores.length).toBeGreaterThan(0);
    expect(result.errores[0].codigo).toBe('producto_no_encontrado');
  });

  it('cantidad efectiva = cantidad pedida cuando no hay grouping', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000 },
    });
    expect(result.cotizacion!.cantidadEfectiva).toBe(1000);
    expect(result.cotizacion!.cantidadPedida).toBe(1000);
  });

  it('estructura de costos siempre presente, aunque sean 0', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000 },
    });
    const c = result.cotizacion!.costos;
    expect(c).toMatchObject({
      tiempoTotal: expect.any(Number),
      materialesTotal: expect.any(Number),
      cargosDirectosTotal: expect.any(Number),
      total: expect.any(Number),
      unitario: expect.any(Number),
    });
  });
});
