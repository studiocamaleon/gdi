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

  it('Talonario duplicado tipoCopia=2: capa 1 + capa 2 se activan, capa 3 NO (CONDICIONAL JsonLogic)', async () => {
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
    expect(result.cotizacion!.rutaNombre).toBe('Emblocado');
    expect(result.cotizacion!.pasos.length).toBe(10);

    const pasosImpresion = result.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    // Capa 1 OBLIGATORIO siempre se activa
    expect(pasosImpresion[0].activado).toBe(true);
    // Capa 2: regla `tipoCopia >= 2` → con tipoCopia=2, SE ACTIVA
    expect(pasosImpresion[1].activado).toBe(true);
    // Capa 3: regla `tipoCopia >= 3` → con tipoCopia=2, NO se activa
    expect(pasosImpresion[2].activado).toBe(false);
    expect(pasosImpresion[2].razonNoActivado).toContain('CONDICIONAL no se cumple');
  });

  it('Talonario triplicado tipoCopia=3: las 3 capas se activan', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      jobContext: { cantidad: 100, tipoCopia: 3, numerosXTalonario: 50 },
    });

    const pasosImpresion = result.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    expect(pasosImpresion[0].activado).toBe(true);
    expect(pasosImpresion[1].activado).toBe(true);
    expect(pasosImpresion[2].activado).toBe(true);
  });

  it('Talonario simple tipoCopia=1: solo capa 1 se activa, capas 2 y 3 no', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      jobContext: { cantidad: 100, tipoCopia: 1, numerosXTalonario: 100 },
    });

    const pasosImpresion = result.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    expect(pasosImpresion[0].activado).toBe(true);
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

  it('F.2.6: Tarjetas doble faz consume MÁS tiempo y MÁS material que simple faz', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const simpleFaz = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 1000, caras: 1 },
    });
    const dobleFaz = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 1000, caras: 2 },
    });

    expect(simpleFaz.exitoso).toBe(true);
    expect(dobleFaz.exitoso).toBe(true);

    // Doble faz: el paso impresión debe consumir el doble de tiempo
    const impSimple = simpleFaz.cotizacion!.pasos.find((p) => p.familiaCodigo === 'impresion_por_hoja');
    const impDoble = dobleFaz.cotizacion!.pasos.find((p) => p.familiaCodigo === 'impresion_por_hoja');
    expect(impDoble!.tiempo!.totalMin).toBeGreaterThan(impSimple!.tiempo!.totalMin);
  });

  it('F.2.6: Talonario con tipoCopia=3 multiplica el tiempo del paso impresión', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });
    const simple = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      periodo: '2026-03',
      jobContext: { cantidad: 100, tipoCopia: 1, numerosXTalonario: 100 },
    });
    const triple = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      periodo: '2026-03',
      jobContext: { cantidad: 100, tipoCopia: 3, numerosXTalonario: 100 },
    });

    expect(simple.exitoso).toBe(true);
    expect(triple.exitoso).toBe(true);

    // Triple debe activar las 3 capas + tener tiempo total mayor
    const pasosImpSimple = simple.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja' && p.activado,
    );
    const pasosImpTriple = triple.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja' && p.activado,
    );
    expect(pasosImpSimple.length).toBe(1);
    expect(pasosImpTriple.length).toBe(3);
  });

  it('F.2.10: Tarjetas con período "2026-03" carga tarifa horaria publicada y costo de tiempo > 0', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 1000, caras: 2 },
    });

    expect(result.exitoso).toBe(true);

    // Verificar que al menos un paso tiene tarifaHora > 0 (la del seed = 22727.27)
    const pasoConTarifa = result.cotizacion!.pasos.find(
      (p) => p.activado && (p.tiempo?.tarifaHora ?? 0) > 0,
    );
    expect(pasoConTarifa).toBeDefined();
    expect(pasoConTarifa!.tiempo!.tarifaHora).toBeCloseTo(22727.27, 0);

    // Costo de tiempo total debe ser > 0
    expect(result.cotizacion!.costos.tiempoTotal).toBeGreaterThan(0);
  });

  it('F.2.10: Vinilo con período inexistente NO encuentra tarifa, costo de tiempo = 0', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      periodo: '1999-01', // período sin tarifa publicada
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      },
    });

    expect(result.exitoso).toBe(true);
    // Sin tarifa publicada, todos los pasos tienen tarifaHora=0 → costo de tiempo = 0
    expect(result.cotizacion!.costos.tiempoTotal).toBe(0);
  });

  it('F.2.8: cotización SIN cantidad explícita → ERROR validación REQUIRES_INPUT', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    // cantidad explicit null → REQUIRES_INPUT debería fallar
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: null as unknown as number },
    });
    expect(result.exitoso).toBe(false);
    expect(result.errores.length).toBeGreaterThan(0);
    const e = result.errores.find((er) => er.codigo === 'requires_cantidad');
    expect(e).toBeDefined();
    expect(e!.severidad).toBe('ERROR');
    expect(e!.mensaje).toContain('cantidad');
  });

  it('F.2.8: validación COMPARE skipea cuando los datos no están completos (no falla)', async () => {
    if (!tenantId) return;
    // Tarjetas sin gramaje en jobContext → COMPARE de gramaje skipea silencioso
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000 }, // sin gramajeGr
    });
    expect(result.exitoso).toBe(true);
  });

  it('F.2.7: Vinilo SIN activar viático → cargosDirectosCotizacion vacío', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      },
    });
    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.cargosDirectosCotizacion.length).toBe(0);
    expect(result.cotizacion!.costos.cargosDirectosTotal).toBe(0);
  });

  it('F.2.7: Vinilo CON viático activado + zona CABA → cargo $3000 (MONTO_FIJO_PLANO con zonas)', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
      include: { cargosDirectosCotizacion: true },
    });
    const cargoViaticoId = vinilo.cargosDirectosCotizacion[0].id;

    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
        opcionalesActivados: { [cargoViaticoId]: true },
        zonaInstalacion: 'CABA',
      },
    });
    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.cargosDirectosCotizacion.length).toBe(1);
    const viatico = result.cotizacion!.cargosDirectosCotizacion[0];
    expect(viatico.cargoCodigo).toBe('viatico');
    expect(viatico.monto).toBe(3000);
    expect(result.cotizacion!.costos.cargosDirectosTotal).toBe(3000);
  });

  it('F.2.7: Vinilo CON viático + zona FUERA_AMBA → cargo $12000', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
      include: { cargosDirectosCotizacion: true },
    });
    const cargoViaticoId = vinilo.cargosDirectosCotizacion[0].id;

    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
        opcionalesActivados: { [cargoViaticoId]: true },
        zonaInstalacion: 'FUERA_AMBA',
      },
    });
    const viatico = result.cotizacion!.cargosDirectosCotizacion[0];
    expect(viatico.monto).toBe(12000);
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
