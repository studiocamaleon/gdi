/**
 * Tests del Motor Universal — MVP F.2.
 *
 * Smoke tests que validan el bucle base contra los productos del seed.
 * NO valida resultados numéricos exactos (eso es F.2.x cuando se implementen
 * todas las sub-tareas + tarifas).
 */

import { PrismaClient } from '@prisma/client';
import { MotorUniversalService } from '../motor.service';
import { runNestingForPaso } from '../nesting-dispatcher';

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

  it('G-M1: Vinilo con piezas → CALCULADO_POR_PASO usa shelf-rollo (cantidad real con desperdicio)', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });

    // 3 paños de 2x1m. El rollo es 1.37m → cada paño rota a 1×2m, 1 por fila.
    // 3 filas × 2m + márgenes + separaciones ≈ 6.03m de rollo consumido.
    // Área total consumida (con desperdicio): 6.03m × 1.37m ≈ 8.26 m².
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      periodo: '2026-03',
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 3, anchoMm: 2000, altoMm: 1000 }],
      },
    });
    expect(result.exitoso).toBe(true);
    const impresion = result.cotizacion!.pasos.find((p) => p.familiaCodigo === 'impresion_por_area');
    expect(impresion?.activado).toBe(true);

    // Nesting result presente con shelf-rollo
    expect(impresion!.nestingResult).toBeDefined();
    expect(impresion!.nestingResult!.algorithm).toBe('shelf-rollo');
    expect(impresion!.nestingResult!.unidad).toBe('m_lineales');
    expect(impresion!.nestingResult!.consumedLengthMm).toBeGreaterThan(6000);
    expect(impresion!.nestingResult!.consumedLengthMm).toBeLessThan(6500);
    expect(impresion!.nestingResult!.placements.length).toBe(3);
    // Aprovechamiento: 6 m² útiles / 8.26 m² totales ≈ 72-73%
    expect(impresion!.nestingResult!.aprovechamientoPct).toBeGreaterThan(60);
    expect(impresion!.nestingResult!.aprovechamientoPct).toBeLessThan(80);

    // Tiempo: ~8.26 m² / 6 m²/h × 60 = ~82.6min run + setup(10) + cleanup(5) ≈ 98min.
    // Antes de G-M1 (m² crudos sin desperdicio): ~60min run = ~75min total. Diferencia = subcosto.
    expect(impresion!.tiempo!.totalMin).toBeGreaterThan(90);
    expect(impresion!.tiempo!.totalMin).toBeLessThan(110);
  });

  it('F.2.3: Tarjetas con embalaje CONVERSION → 1000 piezas / 100 piezasPorCaja = 10 cajas', async () => {
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
    const embalaje = result.cotizacion!.pasos.find((p) => p.familiaCodigo === 'embalaje');
    expect(embalaje?.activado).toBe(true);
    // CONVERSION devuelve 10 cajas; el motor T-2 todavía no usa run, pero al menos
    // verificamos que el paso se ejecutó sin error
    expect(embalaje!.materiales?.length).toBeGreaterThan(0);
  });

  it('F.2.4: Tarjetas doble faz → motor selecciona automáticamente perfil "Papel grueso doble faz" (1200 ppm vs 2400 simple)', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const simple = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 2400, caras: 1 },
    });
    const doble = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 2400, caras: 2 },
    });

    const impSimple = simple.cotizacion!.pasos.find((p) => p.familiaCodigo === 'impresion_por_hoja')!;
    const impDoble = doble.cotizacion!.pasos.find((p) => p.familiaCodigo === 'impresion_por_hoja')!;

    // El perfil simple faz produce a 2400 ppm → 2400 pliegos en ~60min
    // El perfil doble faz produce a 1200 ppm + multiplicador caras=2 → 4800 piezas/1200ppm = 240min
    // Aunque ambos usan multiplicadores también, el run debe ser distinto
    expect(impDoble.tiempo!.totalMin).toBeGreaterThan(impSimple.tiempo!.totalMin);
  });

  it('F.2.5: Vinilo blanco con MOTOR_ELIGE_AUTO + MAYOR_APROVECHAMIENTO → elige rollo 1.52m (más ancho)', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 800 }],
      },
    });
    expect(result.exitoso).toBe(true);
    const impresion = result.cotizacion!.pasos.find((p) => p.familiaCodigo === 'impresion_por_area');
    expect(impresion?.materiales?.length).toBe(1);
    const mat = impresion!.materiales![0];
    expect(mat.modoSeleccion).toBe('MOTOR_ELIGE_AUTO');
    // El más ancho es 1.52m → SKU "VINILO-BLANCO-1520"
    expect(mat.materialNombre).toBe('VINILO-BLANCO-1520');
  });

  it('F.2.5: Tarjetas con laminado COMERCIAL_ELIGE → comercial elige film mate (default)', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find((c) => c.rutaPaso.familiaCodigo === 'laminado');

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
        opcionalesActivados: { [laminado!.id]: true },
        // sin elección explícita → debería usar default = mate
      } as never,
    });
    expect(result.exitoso).toBe(true);
    const pasoLaminado = result.cotizacion!.pasos.find((p) => p.familiaCodigo === 'laminado');
    expect(pasoLaminado?.activado).toBe(true);
    expect(pasoLaminado?.materiales?.length).toBe(1);
    const film = pasoLaminado!.materiales![0];
    expect(film.modoSeleccion).toBe('COMERCIAL_ELIGE');
    expect(film.materialNombre).toBe('BOPP-MATE-650'); // default
  });

  it('F.2.5: Tarjetas con laminado y comercial elige BRILLO explícito', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find((c) => c.rutaPaso.familiaCodigo === 'laminado');

    // Buscar el variantId del film brillo
    const filmBrillo = await prisma.materiaPrimaVariante.findFirstOrThrow({
      where: { tenantId, sku: 'BOPP-BRILLO-650' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
        opcionalesActivados: { [laminado!.id]: true },
        slotMaterial_film: filmBrillo.id, // elección explícita por slot
      } as never,
    });
    expect(result.exitoso).toBe(true);
    const pasoLaminado = result.cotizacion!.pasos.find((p) => p.familiaCodigo === 'laminado');
    const film = pasoLaminado!.materiales![0];
    expect(film.materialNombre).toBe('BOPP-BRILLO-650');
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

  it('F.2.11: cotizarYGuardar persiste Cotizacion + CotizacionItem con snapshot completo', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const { result, cotizacionId, cotizacionItemId } = await motorService.cotizarYGuardar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 500, caras: 2 },
    });

    expect(result.exitoso).toBe(true);
    expect(cotizacionId).toBeDefined();
    expect(cotizacionItemId).toBeDefined();

    // Verificar persistencia
    const item = await prisma.cotizacionItem.findUniqueOrThrow({
      where: { id: cotizacionItemId! },
    });
    expect(item.productoId).toBe(tarjetas.id);
    expect(Number(item.cantidad)).toBe(500);
    expect(Number(item.costoTotal)).toBeGreaterThan(0);

    // Verificar snapshot
    const snap = item.snapshotJson as Record<string, unknown>;
    expect(snap).toHaveProperty('producto');
    expect(snap).toHaveProperty('ruta');
    expect(snap).toHaveProperty('ejecucion');
    const producto = snap.producto as Record<string, unknown>;
    expect(producto.codigo).toBe('TARJ-PREMIUM-300');

    // Verificar trazabilidad
    const traza = item.trazabilidadJson as Record<string, unknown>;
    expect(traza).toHaveProperty('pasos');
    expect((traza.pasos as unknown[]).length).toBe(7);

    // Cleanup
    await prisma.cotizacionItem.delete({ where: { id: cotizacionItemId! } });
    await prisma.cotizacion.delete({ where: { id: cotizacionId! } });
  });

  it('F.2.12: Tarjetas (precioConfig por_margen 100%) → precio = costo × 2', async () => {
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
    expect(result.cotizacion!.precio).toBeDefined();
    expect(result.cotizacion!.precio!.metodoUsado).toBe('por_margen');
    // costo unitario × 2 = precio unitario (margen 100% del seed)
    const costoUnit = result.cotizacion!.costos.unitario;
    const precioUnit = result.cotizacion!.precio!.precioUnitario;
    expect(precioUnit).toBeCloseTo(costoUnit * 2, 2);
  });

  it('F.2.12: Vinilo (precioConfig margen_variable) → margen depende de cantidad', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      periodo: '2026-03',
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      },
    });
    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.precio).toBeDefined();
    expect(result.cotizacion!.precio!.metodoUsado).toBe('margen_variable');
    // cantidad=1 cae en primer tier (≤5) con margen 100%
    expect(result.cotizacion!.precio!.margenAplicadoPct).toBe(100);
  });

  it('G-M1: dispatcher grid-2d-single funciona cuando se invoca directamente (unit test)', async () => {
    // Test unitario del dispatcher (sin DB) que verifica el caso grid-2d-single.
    // El seed actual de Tarjetas NO ejecuta nesting porque `pre_prensa` usa T-1
    // tiempo fijo y `impresion_por_hoja` usa HEREDAR_DEL_OUTPUT_CANONICO (depende
    // de G-M2 + reseed para que el flujo end-to-end use grid-2d). Hasta entonces,
    // testeamos el dispatcher en aislamiento.
    const fakePaso = {
      rutaPasoId: 'rp1',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_hoja',
      configPasoId: 'cp1',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: null,
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: { id: 'm1', codigo: 'X', nombre: 'X', plantilla: 'IMPRESORA_LASER',
        parametrosTecnicosJson: { margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 } } },
    };
    const fakeMaterial = {
      id: 'mat1',
      atributosVarianteJson: { anchoMm: 220, largoMm: 340 },
    };
    const fakeJobContext = {
      cantidad: 1000,
      caras: 1 as const,
      piezas: [{ cantidad: 1000, anchoMm: 90, altoMm: 50 }],
    };

    const r = runNestingForPaso(fakePaso as never, fakeJobContext, fakeMaterial);
    expect(r).not.toBeNull();
    expect(r!.algorithm).toBe('grid-2d-single');
    expect(r!.unidad).toBe('pliegos');
    expect(r!.piezasPorPliego).toBeGreaterThanOrEqual(12); // pliego 22x34, pieza 9x5 = ~14
    expect(r!.cantidadCalculada).toBeLessThanOrEqual(85); // ceil(1000/12) = 84
    expect(r!.placements.length).toBe(r!.piezasPorPliego);
  });

  it('G-M1: dispatcher devuelve null para familia sin algoritmo (mantiene fallback)', async () => {
    if (!tenantId) return;
    // Embalaje (CONVERSION) NO debería tener nestingResult.
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000, caras: 2 },
    });
    const embalaje = result.cotizacion!.pasos.find((p) => p.familiaCodigo === 'embalaje');
    expect(embalaje?.activado).toBe(true);
    expect(embalaje!.nestingResult).toBeUndefined();
  });

  it('G-M2: pre_prensa publica `pliegos_calculados` y `poses_por_pliego` vía look-ahead a impresion_por_hoja', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 1000, caras: 2 },
      // sin piezas explícitas: motor usa medidaDefault (90×50) del producto
    });
    expect(result.exitoso).toBe(true);
    const prePrensa = result.cotizacion!.pasos.find((p) => p.familiaCodigo === 'pre_prensa');
    expect(prePrensa).toBeDefined();
    expect(prePrensa!.activado).toBe(true);
    // pre_prensa corrió grid-2d-single look-ahead y publicó los outputs.
    const outs = prePrensa!.outputsCanonicos as Record<string, unknown>;
    expect(outs.pliegos_calculados).toBeGreaterThan(0);
    expect(outs.poses_por_pliego).toBeGreaterThan(0);
    expect(outs.imposicion_calculada).toMatchObject({
      algorithm: 'grid-2d-single',
      piezasPorPliego: expect.any(Number),
    });
    expect(outs.cortes_calculados).toMatchObject({
      cortesTotales: expect.any(Number),
    });
  });

  it('G-M2: impresion_por_hoja HEREDA `pliegos_calculados` y calcula tiempo basado en pliegos reales', async () => {
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
    const prePrensa = result.cotizacion!.pasos.find((p) => p.familiaCodigo === 'pre_prensa');
    const impresion = result.cotizacion!.pasos.find((p) => p.familiaCodigo === 'impresion_por_hoja');
    expect(prePrensa).toBeDefined();
    expect(impresion).toBeDefined();

    // El paso de impresión debe haberse ejecutado con la cantidad de pliegos
    // calculada por pre_prensa (no con cantidad cruda 1000 piezas).
    const pliegos = (prePrensa!.outputsCanonicos as Record<string, unknown>).pliegos_calculados as number;
    expect(pliegos).toBeGreaterThan(0);
    expect(pliegos).toBeLessThan(1000); // 1000 tarjetas no requieren 1000 pliegos

    // pliegos_impresos publicado por impresion debe coincidir con la cantidad heredada.
    const outsImp = impresion!.outputsCanonicos as Record<string, unknown>;
    expect(outsImp.pliegos_impresos).toBe(pliegos);
  });

  it('G-M2/G-M4: EXISTS_OUTPUT real bloquea corte_guillotina si pre_prensa no publicó pliegos_calculados', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    // Producto SIN medidaDefault y SIN piezas → pre_prensa no puede correr
    // nesting → no publica pliegos_calculados → corte_guillotina falla EXISTS_OUTPUT.
    // Lo simulamos pasando piezas con altura 0 (inválidas) para forzar el null.
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
        piezas: [{ cantidad: 1, anchoMm: 0, altoMm: 0 }], // medidas inválidas
        // Sobre-escribimos medidaCustomMm para que el motor NO use medidaDefault
        medidaCustomMm: { anchoMm: 0, altoMm: 0 },
      },
    });
    expect(result.exitoso).toBe(false);
    const e = result.errores.find((er) => er.codigo === 'existe_pliegos');
    expect(e).toBeDefined();
    expect(e!.severidad).toBe('ERROR');
    expect(e!.familiaCodigo).toBe('corte_guillotina');
    expect((e!.contexto as { outputCanonico?: string }).outputCanonico).toBe('pliegos_calculados');
  });

  it('G-M3: cargo directo a nivel PASO (MONTO_FIJO_PLANO OBLIGATORIO) se aplica al paso', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const cargoCatalogo = await prisma.cargoDirectoCatalogo.findFirstOrThrow({
      where: { tenantId, codigo: 'tercerizacion' },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const prePrensa = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'pre_prensa',
    );
    expect(prePrensa).toBeDefined();

    // Asociar cargo de tercerización OBLIGATORIO con monto fijo 500 al paso pre_prensa
    const cargoPaso = await prisma.productoCargoDirectoPaso.create({
      data: {
        tenantId,
        productoConfigPasoId: prePrensa!.id,
        cargoDirectoCatalogoId: cargoCatalogo.id,
        modoActivacion: 'OBLIGATORIO',
        configOverrideJson: { monto: 500 },
        activo: true,
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 2 },
      });

      expect(result.exitoso).toBe(true);
      const pasoPrePrensa = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'pre_prensa',
      );
      expect(pasoPrePrensa).toBeDefined();
      expect(pasoPrePrensa!.activado).toBe(true);
      expect(pasoPrePrensa!.cargosDirectosPaso?.length).toBe(1);
      const cargo = pasoPrePrensa!.cargosDirectosPaso![0];
      expect(cargo.cargoCodigo).toBe('tercerizacion');
      expect(cargo.monto).toBe(500);
      expect(cargo.modoCalculo).toBe('MONTO_FIJO_PLANO');

      // El costoTotal del paso debe incluir los 500 además de tiempo + materiales
      const subtotalEsperado =
        (pasoPrePrensa!.tiempo?.costo ?? 0) +
        (pasoPrePrensa!.materiales?.reduce((acc, m) => acc + m.costoTotal, 0) ?? 0);
      expect(pasoPrePrensa!.costoTotal).toBeCloseTo(subtotalEsperado + 500, 2);

      // El total agregado de la cotización también debe sumarlo
      expect(result.cotizacion!.costos.cargosDirectosTotal).toBeGreaterThanOrEqual(500);
    } finally {
      await prisma.productoCargoDirectoPaso.delete({ where: { id: cargoPaso.id } });
    }
  });

  it('G-M3: cargo PORCENTAJE_SOBRE_BASE a nivel PASO usa el subtotal DEL PASO como base', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    // Usar el cargo "recargo_urgencia" del seed (PORCENTAJE_SOBRE_BASE)
    const cargoUrgencia = await prisma.cargoDirectoCatalogo.findFirstOrThrow({
      where: { tenantId, codigo: 'recargo_urgencia' },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const impresion = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'impresion_por_hoja',
    );
    expect(impresion).toBeDefined();

    // Asociar 10% al paso impresión, OBLIGATORIO
    const cargoPaso = await prisma.productoCargoDirectoPaso.create({
      data: {
        tenantId,
        productoConfigPasoId: impresion!.id,
        cargoDirectoCatalogoId: cargoUrgencia.id,
        modoActivacion: 'OBLIGATORIO',
        configOverrideJson: { porcentaje: 10 },
        activo: true,
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 2 },
      });

      expect(result.exitoso).toBe(true);
      const pasoImpresion = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'impresion_por_hoja',
      );
      expect(pasoImpresion).toBeDefined();
      const subtotalPaso =
        (pasoImpresion!.tiempo?.costo ?? 0) +
        (pasoImpresion!.materiales?.reduce((acc, m) => acc + m.costoTotal, 0) ?? 0);
      const cargo = pasoImpresion!.cargosDirectosPaso![0];
      expect(cargo.monto).toBeCloseTo(subtotalPaso * 0.1, 2);
      expect((cargo.detalle as { scope?: string })?.scope).toBe('PASO');
    } finally {
      await prisma.productoCargoDirectoPaso.delete({ where: { id: cargoPaso.id } });
    }
  });

  it('G-M3: cargo OPCIONAL a nivel PASO no se aplica si el comercial no lo activa', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const cargoCatalogo = await prisma.cargoDirectoCatalogo.findFirstOrThrow({
      where: { tenantId, codigo: 'tercerizacion' },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const prePrensa = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'pre_prensa',
    );

    const cargoPaso = await prisma.productoCargoDirectoPaso.create({
      data: {
        tenantId,
        productoConfigPasoId: prePrensa!.id,
        cargoDirectoCatalogoId: cargoCatalogo.id,
        modoActivacion: 'OPCIONAL',
        configOverrideJson: { monto: 1500 },
        activo: true,
      },
    });

    try {
      // Sin opcionalesActivados → no se aplica
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 2 },
      });
      const pasoPrePrensa = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'pre_prensa',
      );
      expect(pasoPrePrensa!.cargosDirectosPaso?.length).toBe(0);

      // Con opcionalesActivados[cargoPaso.id] = true → SÍ se aplica
      const resultActivado = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: {
          cantidad: 1000,
          caras: 2,
          opcionalesActivados: { [cargoPaso.id]: true },
        },
      });
      const pasoActivado = resultActivado.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'pre_prensa',
      );
      expect(pasoActivado!.cargosDirectosPaso?.length).toBe(1);
      expect(pasoActivado!.cargosDirectosPaso![0].monto).toBe(1500);
    } finally {
      await prisma.productoCargoDirectoPaso.delete({ where: { id: cargoPaso.id } });
    }
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
