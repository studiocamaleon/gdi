/**
 * Etapa D (anilladora): un TOMO con la terminación "Anillado" activa suma una
 * línea de anillado = 1 anillo × juegos + tiempo de anilladora, y el motor elige
 * el Ø del espiral por capacidad (menor que cubre las hojas del libro). La
 * impresión se sigue cotizando por sub-documento.
 *
 * Corre contra gdi_saas_test (DB aislada). Crea su propia anilladora (colgada del
 * mismo centro de costo que la láser, para heredar tarifa) + anillo con precio, y
 * limpia todo en afterAll. Si el tenant demo no está sembrado, se saltea.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { CentroCopiadoService } from '../centro-copiado.service';
import {
  CC_PRODUCTO_CODIGO,
  asegurarPasoAnilladoCC,
  provisionarPlantillaCentroCopiado,
} from '../provisionar-plantilla';

const prisma = new PrismaClient();
const PERIODO = '2026-03';

let tenantId = '';
let plantaId = '';
let service: CentroCopiadoService;
let papelId = '';
let anilladoraId = '';
let anilloId = '';
let tapaFrontalId = '';
let tapaPosteriorId = '';
let anilladoPasoId = '';
let cotizacionCreada = '';

const A4 = { tamano: 'A4', tamanoAnchoMm: 210, tamanoAltoMm: 297 };
const doc = (id: string, paginas: number) => ({
  id,
  nombre: `${id}.pdf`,
  paginas,
  copias: 1,
  ...A4,
  papelMateriaPrimaId: papelId,
  color: 'BN' as const,
  faz: 1 as const,
  grupoId: 'T',
});

async function limpiarPasoAnillado() {
  const producto = await prisma.producto.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
    select: {
      rutasAlternativas: {
        where: { activo: true },
        take: 1,
        select: {
          rutaId: true,
          rutaVersion: true,
          configPasos: {
            where: { rutaPaso: { familiaCodigo: 'encuadernado_anillado' } },
            select: { id: true, rutaPasoId: true },
          },
        },
      },
    },
  });
  const ruta = producto?.rutasAlternativas[0];
  for (const cp of ruta?.configPasos ?? []) {
    await prisma.productoConfigPaso
      .delete({ where: { id: cp.id } })
      .catch(() => undefined);
    await prisma.rutaPaso
      .delete({ where: { id: cp.rutaPasoId } })
      .catch(() => undefined);
  }
  // Sacar la entrada de anillado del snapshot (deja la ruta compartida limpia).
  if (ruta) {
    const ver = await prisma.rutaVersion.findFirst({
      where: { rutaId: ruta.rutaId, version: ruta.rutaVersion },
      select: { id: true, snapshotJson: true },
    });
    const snap = (ver?.snapshotJson ?? {}) as { pasos?: unknown[] };
    if (ver && Array.isArray(snap.pasos)) {
      const pasos = snap.pasos.filter(
        (p) => (p as { familia?: string }).familia !== 'encuadernado_anillado',
      );
      await prisma.rutaVersion
        .update({
          where: { id: ver.id },
          data: {
            snapshotJson: { ...snap, pasos } as Prisma.InputJsonObject,
          },
        })
        .catch(() => undefined);
    }
  }
}

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'gdi-demo' },
    select: { id: true },
  });
  tenantId = tenant?.id ?? '';
  if (!tenantId) return;

  const motor = new MotorUniversalService(
    prisma as never,
    new AplicarPrecioService(),
    new PreciosEspecialesClientesService(prisma as never),
  );
  service = new CentroCopiadoService(prisma as never, motor);

  const planta = await prisma.planta.findFirst({
    where: { tenantId },
    select: { id: true },
  });
  plantaId = planta?.id ?? '';

  const papel = await prisma.materiaPrima.findFirst({
    where: { tenantId, subfamilia: 'SUSTRATO_HOJA' },
    orderBy: { nombre: 'asc' },
    select: { id: true },
  });
  papelId = papel?.id ?? '';

  // Centro de costo de una máquina que ya cotiza (para heredar su tarifa).
  const laser = await prisma.maquina.findFirst({
    where: { tenantId, centroCostoPrincipalId: { not: null } },
    select: { centroCostoPrincipalId: true },
  });
  if (!plantaId || !papelId || !laser?.centroCostoPrincipalId) {
    tenantId = ''; // no se puede montar el escenario → saltear
    return;
  }

  await provisionarPlantillaCentroCopiado(prisma, tenantId);

  const anilladora = await prisma.maquina.create({
    data: {
      tenantId,
      codigo: 'TEST-ANILLADORA-TOMO',
      nombre: 'Anilladora de prueba (tomo)',
      plantilla: 'ANILLADORA',
      geometriaTrabajo: 'PLIEGO',
      unidadProduccionPrincipal: 'PIEZAS_H',
      plantaId,
      centroCostoPrincipalId: laser.centroCostoPrincipalId,
      perfilesOperativos: {
        create: [
          {
            tenantId,
            nombre: 'Espiral plástico',
            tipoPerfil: 'FABRICACION',
            productivityValue: 1200, // hojas/h
            productivityUnit: 'PIEZAS_H',
            detalleJson: { tipoAnillo: 'ESPIRAL_PLASTICO' },
          },
        ],
      },
    },
  });
  anilladoraId = anilladora.id;

  const anillo = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: 'TEST-ESPIRAL-TOMO',
      nombre: 'Espiral plástico (test tomo)',
      familia: 'TERMINACION_EDITORIAL',
      subfamilia: 'ANILLADO_ENCUADERNACION',
      tipoTecnico: 'anillado_encuadernacion',
      templateId: 'anillado_encuadernacion_v1',
      unidadStock: 'UNIDAD',
      unidadCompra: 'CAJA',
      atributosTecnicosJson: {},
      variantes: {
        create: [
          {
            tenantId,
            sku: 'TEST-ESPIRAL-TOMO-10',
            precioReferencia: 100,
            moneda: 'ARS',
            atributosVarianteJson: {
              tipoAnillo: 'ESPIRAL_PLASTICO',
              diametro: 10,
              capacidadMaxHojas: 80,
            },
          },
          {
            tenantId,
            sku: 'TEST-ESPIRAL-TOMO-14',
            precioReferencia: 140,
            moneda: 'ARS',
            atributosVarianteJson: {
              tipoAnillo: 'ESPIRAL_PLASTICO',
              diametro: 14,
              capacidadMaxHojas: 120,
            },
          },
          // Wire-O: mismo material, distinto tipo. Ø distintos para distinguir
          // que el filtro por tipo elige dentro del tipo pedido.
          {
            tenantId,
            sku: 'TEST-WIREO-TOMO-11',
            precioReferencia: 200,
            moneda: 'ARS',
            atributosVarianteJson: {
              tipoAnillo: 'WIRE_O',
              diametro: 11,
              capacidadMaxHojas: 75,
            },
          },
          {
            tenantId,
            sku: 'TEST-WIREO-TOMO-13',
            precioReferencia: 240,
            moneda: 'ARS',
            atributosVarianteJson: {
              tipoAnillo: 'WIRE_O',
              diametro: 13,
              capacidadMaxHojas: 110,
            },
          },
        ],
      },
    },
  });
  anilloId = anillo.id;

  // Tapas de encuadernación (frontal transparente + contratapa cartón), A4. El
  // provisionador crea los 2 slots de tapa en el paso y los pinnea por tamaño.
  const tapaFrontal = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: 'TEST-TAPA-FRONTAL-TOMO',
      nombre: 'Tapa transparente (test tomo)',
      familia: 'TERMINACION_EDITORIAL',
      subfamilia: 'TAPA_ENCUADERNACION',
      tipoTecnico: 'tapa_encuadernacion',
      templateId: 'tapa_encuadernacion_v1',
      unidadStock: 'UNIDAD',
      unidadCompra: 'CAJA',
      atributosTecnicosJson: {
        colorBase: 'transparente',
        material: 'polipropileno',
      },
      variantes: {
        create: [
          {
            tenantId,
            sku: 'TEST-TAPA-FRONTAL-A4',
            precioReferencia: 150,
            moneda: 'ARS',
            atributosVarianteJson: {
              ancho: 210,
              alto: 297,
              material: 'polipropileno',
            },
          },
        ],
      },
    },
  });
  tapaFrontalId = tapaFrontal.id;

  const tapaPosterior = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: 'TEST-TAPA-POSTERIOR-TOMO',
      nombre: 'Contratapa cartón (test tomo)',
      familia: 'TERMINACION_EDITORIAL',
      subfamilia: 'TAPA_ENCUADERNACION',
      tipoTecnico: 'tapa_encuadernacion',
      templateId: 'tapa_encuadernacion_v1',
      unidadStock: 'UNIDAD',
      unidadCompra: 'CAJA',
      atributosTecnicosJson: { colorBase: 'negro', material: 'carton' },
      variantes: {
        create: [
          {
            tenantId,
            sku: 'TEST-TAPA-POSTERIOR-A4',
            precioReferencia: 120,
            moneda: 'ARS',
            atributosVarianteJson: { ancho: 210, alto: 297, material: 'carton' },
          },
        ],
      },
    },
  });
  tapaPosteriorId = tapaPosterior.id;

  // NO se setea config.maquinaAnilladoraId (mutar la config compartida del tenant
  // demo hace flaky a otros specs en paralelo). El provisionador usa la ÚNICA
  // anilladora activa; este spec es el único que crea una.
  await asegurarPasoAnilladoCC(prisma, tenantId);

  const cp = await prisma.productoConfigPaso.findFirst({
    where: {
      productoRutaAlternativa: {
        producto: { tenantId, codigo: CC_PRODUCTO_CODIGO },
      },
      rutaPaso: { familiaCodigo: 'encuadernado_anillado' },
    },
    select: { id: true },
  });
  anilladoPasoId = cp?.id ?? '';
});

afterAll(async () => {
  if (tenantId) {
    if (cotizacionCreada) {
      await prisma.cotizacionItem
        .deleteMany({ where: { cotizacionId: cotizacionCreada } })
        .catch(() => undefined);
      await prisma.cotizacion
        .delete({ where: { id: cotizacionCreada } })
        .catch(() => undefined);
    }
    await limpiarPasoAnillado();
    if (anilladoraId)
      await prisma.maquina
        .delete({ where: { id: anilladoraId } })
        .catch(() => undefined);
    if (anilloId)
      await prisma.materiaPrima
        .delete({ where: { id: anilloId } })
        .catch(() => undefined);
    for (const id of [tapaFrontalId, tapaPosteriorId]) {
      if (id)
        await prisma.materiaPrima
          .delete({ where: { id } })
          .catch(() => undefined);
    }
  }
  await prisma.$disconnect();
});

it('el paso de anillado quedó cableado en la ruta', () => {
  if (!tenantId) return;
  expect(anilladoPasoId).toBeTruthy();
});

it('el paso es OPCIONAL, T-3, cantidad = jobContext.juegos', async () => {
  if (!tenantId) return;
  const cp = await prisma.productoConfigPaso.findUniqueOrThrow({
    where: { id: anilladoPasoId },
    select: {
      modoActivacion: true,
      modoTiempo: true,
      mecanismoCantidad: true,
      mecanismoCantidadConfigJson: true,
      multiplicadoresActivos: true,
      maquinaM1Id: true,
    },
  });
  expect(cp.modoActivacion).toBe('OPCIONAL');
  // T-3 = productividad del perfil (hojas/h); con T-2 el tiempo saldría 0.
  expect(cp.modoTiempo).toBe('T-3');
  expect(cp.mecanismoCantidad).toBe('HEREDAR_DEL_OUTPUT_CANONICO');
  expect(
    (cp.mecanismoCantidadConfigJson as { campoOutput?: string } | null)
      ?.campoOutput,
  ).toBe('juegos');
  expect(cp.multiplicadoresActivos).toContain('hojasPorLibro');
  expect(cp.maquinaM1Id).toBe(anilladoraId);
});

it('el slot anillo: MENOR_CAPACIDAD_QUE_CUMPLA + filtro por tipoAnillo', async () => {
  if (!tenantId) return;
  const slot = await prisma.productoConfigPasoSlotMaterial.findFirstOrThrow({
    where: { productoConfigPasoId: anilladoPasoId, slotCodigo: 'anillo' },
    select: {
      modoSeleccion: true,
      criterioMotorAuto: true,
      criterioInputCampo: true,
      criterioMaterialCampo: true,
      criterioFiltroCampo: true,
      formula: true,
      candidatos: { select: { materiaPrimaId: true } },
    },
  });
  expect(slot.modoSeleccion).toBe('MOTOR_ELIGE_AUTO');
  expect(slot.criterioMotorAuto).toBe('MENOR_CAPACIDAD_QUE_CUMPLA');
  expect(slot.criterioInputCampo).toBe('hojasPorLibro');
  expect(slot.criterioMaterialCampo).toBe('capacidadMaxHojas');
  expect(slot.criterioFiltroCampo).toBe('tipoAnillo');
  expect(slot.formula).toBe('por_unidad_productiva');
  expect(slot.candidatos.map((c) => c.materiaPrimaId)).toContain(anilloId);
});

it('re-provisionar es idempotente (no duplica el paso)', async () => {
  if (!tenantId) return;
  await asegurarPasoAnilladoCC(prisma, tenantId);
  const producto = await prisma.producto.findUniqueOrThrow({
    where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
    select: {
      rutasAlternativas: {
        where: { activo: true },
        take: 1,
        select: {
          configPasos: {
            where: { rutaPaso: { familiaCodigo: 'encuadernado_anillado' } },
            select: { id: true },
          },
        },
      },
    },
  });
  expect(producto.rutasAlternativas[0].configPasos).toHaveLength(1);
});

it('self-heal: re-provisionar re-alinea máquina/perfil/tiempo/mecanismo', async () => {
  if (!tenantId) return;
  // Simular un paso "viejo": sin perfil, T-2, cantidad directa.
  await prisma.productoConfigPaso.update({
    where: { id: anilladoPasoId },
    data: {
      perfilM1Id: null,
      modoTiempo: 'T-2',
      mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
      mecanismoCantidadConfigJson: Prisma.DbNull,
    },
  });
  await asegurarPasoAnilladoCC(prisma, tenantId);
  const cp = await prisma.productoConfigPaso.findUniqueOrThrow({
    where: { id: anilladoPasoId },
    select: {
      perfilM1Id: true,
      modoTiempo: true,
      mecanismoCantidad: true,
      maquinaM1Id: true,
    },
  });
  expect(cp.perfilM1Id).toBeTruthy(); // re-apuntó al perfil de la anilladora
  expect(cp.modoTiempo).toBe('T-3');
  expect(cp.mecanismoCantidad).toBe('HEREDAR_DEL_OUTPUT_CANONICO');
  expect(cp.maquinaM1Id).toBe(anilladoraId);
});

it('elige el Ø DENTRO del tipo de anillo pedido (espiral vs wire-o)', async () => {
  if (!tenantId) return;
  const docs = [doc('A', 40), doc('B', 30)]; // hojasPorLibro = 70
  const espiral = await service.cotizar(
    tenantId,
    {
      documentos: docs,
      grupos: [
        {
          id: 'T',
          juegos: 2,
          terminaciones: ['Anillado'],
          tipoAnillo: 'ESPIRAL_PLASTICO',
        },
      ],
    },
    PERIODO,
  );
  const wireo = await service.cotizar(
    tenantId,
    {
      documentos: docs,
      grupos: [
        {
          id: 'T',
          juegos: 2,
          terminaciones: ['Anillado'],
          tipoAnillo: 'WIRE_O',
        },
      ],
    },
    PERIODO,
  );
  // Espiral: caps 80/120 → cubre 70 con Ø10. Wire-o: caps 75/110 → Ø11.
  expect(espiral.grupos[0].anillado?.tipoAnillo).toBe('ESPIRAL_PLASTICO');
  expect(espiral.grupos[0].anillado?.diametroMm).toBe(10);
  expect(wireo.grupos[0].anillado?.tipoAnillo).toBe('WIRE_O');
  expect(wireo.grupos[0].anillado?.diametroMm).toBe(11);
});

it('un tomo con Anillado suma la línea y elige el Ø por capacidad', async () => {
  if (!tenantId) return;
  // hojasPorLibro = 40 + 30 = 70 (faz 1). Menor capacidad que cubre 70 → 80 (Ø10).
  const r = await service.cotizar(
    tenantId,
    {
      documentos: [doc('A', 40), doc('B', 30)],
      grupos: [{ id: 'T', juegos: 3, terminaciones: ['Anillado'] }],
    },
    PERIODO,
  );
  const grupo = r.grupos[0];
  expect(grupo.hojasPorLibro).toBe(70);
  expect(grupo.anillado).toBeTruthy();
  expect(grupo.anillado?.error).toBeNull();
  // 3 juegos × anillo (precio 100) ⇒ material > 0, más margen e IVA.
  expect(grupo.anillado?.subtotal ?? 0).toBeGreaterThan(0);
  expect(grupo.anillado?.diametroMm).toBe(10);
  // El subtotal del grupo es UN ítem: impresión + anillado juntos.
  const impresionSola = r.documentos
    .filter((d) => d.grupoId === 'T')
    .reduce((s, d) => s + d.subtotal, 0);
  expect(grupo.subtotal).toBeCloseTo(
    impresionSola + (grupo.anillado?.subtotal ?? 0),
    2,
  );
  // El total general = impresión de los sub-docs + el anillado del tomo.
  expect(r.totales.subtotal).toBeCloseTo(
    impresionSola + (grupo.anillado?.subtotal ?? 0),
    2,
  );
});

it('construirItems: el TOMO es UN ítem con impresión + anillado', async () => {
  if (!tenantId) return;
  const r = await service.construirItems(
    tenantId,
    {
      documentos: [doc('A', 40), doc('B', 30)],
      grupos: [{ id: 'T', juegos: 3, terminaciones: ['Anillado'] }],
    },
    PERIODO,
  );
  // Un solo ítem (el compuesto del tomo), no un renglón de anillado aparte.
  expect(r.items).toHaveLength(1);
  const item = r.items[0];
  expect(item.error ?? null).toBeNull();
  const familias = (item.cotizacion?.pasos ?? []).map((p) => p.familiaCodigo);
  expect(familias).toContain('impresion_por_hoja');
  expect(familias).toContain('encuadernado_anillado');
  // El anillado aporta TIEMPO de anilladora (T-3) al costo del ítem.
  expect(item.cotizacion?.costos.tiempoTotal ?? 0).toBeGreaterThan(0);
});

it('documento suelto con Anillado: UN ítem con impresión + anillado', async () => {
  if (!tenantId) return;
  const r = await service.cotizar(
    tenantId,
    {
      documentos: [
        {
          ...doc('S', 50),
          grupoId: null,
          copias: 2,
          terminaciones: ['Anillado'],
          tipoAnillo: 'ESPIRAL_PLASTICO',
        },
      ],
    },
    PERIODO,
  );
  const d = r.documentos[0];
  // El anillado va FOLDED en el mismo ítem: el meta muestra el Ø, y el costo ya
  // está en d.subtotal (no una línea aparte).
  expect(d.anillado).toBeTruthy();
  expect(d.anillado?.error).toBeNull();
  expect(d.anillado?.diametroMm).toBeTruthy();
  // El total = el subtotal del doc (que ya incluye el anillado), sin extra.
  expect(r.totales.subtotal).toBeCloseTo(d.subtotal, 2);

  // Y en construirItems es UN solo ítem con los dos pasos.
  const items = await service.construirItems(
    tenantId,
    {
      documentos: [
        {
          ...doc('S', 50),
          grupoId: null,
          copias: 2,
          terminaciones: ['Anillado'],
          tipoAnillo: 'ESPIRAL_PLASTICO',
        },
      ],
    },
    PERIODO,
  );
  expect(items.items).toHaveLength(1);
  const familias = (items.items[0].cotizacion?.pasos ?? []).map(
    (p) => p.familiaCodigo,
  );
  expect(familias).toContain('impresion_por_hoja');
  expect(familias).toContain('encuadernado_anillado');
  // El renglón anillado se mide en LIBROS (= copias), no en hojas.
  expect(items.items[0].cantidad).toBe(2);
  expect(items.items[0].unidad).toBe('libros');
  // El paso de encuadernado SEPARA el costo del anillo como material (no "-").
  const encuad = (items.items[0].cotizacion?.pasos ?? []).find(
    (p) => p.familiaCodigo === 'encuadernado_anillado',
  );
  const materialAnillo = (encuad?.materiales ?? []).reduce(
    (acc, m) => acc + m.costoTotal,
    0,
  );
  expect(materialAnillo).toBeGreaterThan(0);
  // Tapa frontal + contratapa: 1 por LIBRO (cantidad = juegos = copias = 2), no
  // por hoja. Ambas salen como material del paso con costo > 0.
  const tapaFrontal = (encuad?.materiales ?? []).find(
    (m) => m.slotCodigo === 'tapa_frontal',
  );
  const tapaPosterior = (encuad?.materiales ?? []).find(
    (m) => m.slotCodigo === 'tapa_posterior',
  );
  expect(tapaFrontal?.costoTotal ?? 0).toBeGreaterThan(0);
  expect(tapaPosterior?.costoTotal ?? 0).toBeGreaterThan(0);
  expect(tapaFrontal?.cantidad).toBe(2); // 2 libros, no 2×hojasPorLibro
  expect(tapaPosterior?.cantidad).toBe(2);
  // La especificación lista las tapas.
  expect(items.items[0].especificaciones['Tapas']).toBeTruthy();
});

it('Wire-O NO lleva tapas (sí anillo)', async () => {
  if (!tenantId) return;
  const items = await service.construirItems(
    tenantId,
    {
      documentos: [
        {
          ...doc('W', 50),
          grupoId: null,
          copias: 2,
          terminaciones: ['Anillado'],
          tipoAnillo: 'WIRE_O',
        },
      ],
    },
    PERIODO,
  );
  const encuad = (items.items[0].cotizacion?.pasos ?? []).find(
    (p) => p.familiaCodigo === 'encuadernado_anillado',
  );
  // El anillo Wire-O sí se cotiza como material...
  const anillo = (encuad?.materiales ?? []).find(
    (m) => m.slotCodigo === 'anillo',
  );
  expect(anillo?.costoTotal ?? 0).toBeGreaterThan(0);
  // ...pero NO hay tapas.
  const tapas = (encuad?.materiales ?? []).filter((m) =>
    m.slotCodigo.startsWith('tapa_'),
  );
  expect(tapas).toHaveLength(0);
  expect(items.items[0].especificaciones['Tapas']).toBeUndefined();
});

it('documento suelto SIN anillado: se mide en hojas', async () => {
  if (!tenantId) return;
  const items = await service.construirItems(
    tenantId,
    {
      documentos: [
        {
          ...doc('S', 50),
          grupoId: null,
          copias: 2,
          terminaciones: [],
        },
      ],
    },
    PERIODO,
  );
  expect(items.items).toHaveLength(1);
  // 50 páginas doble faz × 2 copias = 25 hojas/copia × 2 = 50 hojas.
  expect(items.items[0].unidad).toBe('hojas');
  expect(items.items[0].cantidad).toBeGreaterThan(2);
});

it('agregarAOrden (camino eager) también persiste el renglón de anillado', async () => {
  if (!tenantId) return;
  const r = await service.agregarAOrden(
    tenantId,
    {
      documentos: [doc('A', 40), doc('B', 30)],
      grupos: [{ id: 'T', juegos: 3, terminaciones: ['Anillado'] }],
    },
    PERIODO,
  );
  cotizacionCreada = r.cotizacionId;
  const anillado = r.items.find((i) => i.documentoId.endsWith('::anillado'));
  expect(anillado).toBeTruthy();
  expect(anillado?.cotizacionItemId).toBeTruthy(); // persistido
  expect(anillado?.subtotal ?? 0).toBeGreaterThan(0);
  expect(anillado?.grupoTomoId).toBe('T');
});

it('sin Anillado activo, el tomo no suma línea de anillado', async () => {
  if (!tenantId) return;
  const r = await service.cotizar(
    tenantId,
    {
      documentos: [doc('A', 40), doc('B', 30)],
      grupos: [{ id: 'T', juegos: 3, terminaciones: [] }],
    },
    PERIODO,
  );
  expect(r.grupos[0].anillado).toBeNull();
});

it('si ningún espiral cubre las hojas, degrada con motivo y sin línea', async () => {
  if (!tenantId) return;
  // hojasPorLibro = 300 > 120 (máxima capacidad instalada) ⇒ sin anillo que cubra.
  const r = await service.cotizar(
    tenantId,
    {
      documentos: [doc('A', 300)],
      grupos: [{ id: 'T', juegos: 1, terminaciones: ['Anillado'] }],
    },
    PERIODO,
  );
  const grupo = r.grupos[0];
  expect(grupo.anillado?.error).toBeTruthy();
  expect(grupo.anillado?.diametroMm ?? null).toBeNull();
  // El anillado con error NO se suma al subtotal del grupo (sólo impresión).
  const impresionSola = r.documentos
    .filter((d) => d.grupoId === 'T')
    .reduce((s, d) => s + d.subtotal, 0);
  expect(grupo.subtotal).toBeCloseTo(impresionSola, 2);
});
