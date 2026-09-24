/**
 * Catálogo persistente para probar corte en la base LOCAL, nunca en producción.
 * Desde apps/api: node --env-file=.env scripts/demo-corte-local.cjs --aplicar
 * Requiere npm run build. --recorrido agrega cotizaciones/OT y simula producción.
 * Las altas son idempotentes; no sobrescribe productos demo ya editados.
 */
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { AppModule } = require('../dist/src/app.module');
const { runWithTenant } = require('../dist/src/common/tenant-context');
const {
  MaquinariaService,
} = require('../dist/src/maquinaria/maquinaria.service');
const {
  InventarioService,
} = require('../dist/src/inventario/inventario.service');
const {
  RecetasProductoService,
} = require('../dist/src/productos-servicios/recetas-producto.service');
const {
  MotorUniversalService,
} = require('../dist/src/motor-universal/motor.service');
const {
  OrdenesTrabajoService,
} = require('../dist/src/ordenes-trabajo/ordenes-trabajo.service');
const {
  EntregaService,
} = require('../dist/src/ordenes-trabajo/entrega.service');
const {
  ReservasMaterialService,
} = require('../dist/src/inventario/reservas-material.service');
const {
  NotificacionesOrdenesService,
} = require('../dist/src/integraciones/notificaciones/notificaciones-ordenes.service');

const tenantId = '5569e52a-e642-4124-9114-daedfdf0136e';
const marca = 'DEMO-CORTE-20260923';
const periodo = '2026-09';
const dir = path.resolve(__dirname, '../../../outputs/qa-corte');
const manifestPath = path.join(dir, 'demo-local.json');
const p = new PrismaClient();
let app;
const json = (v) => JSON.parse(JSON.stringify(v));
const registro = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : {
      marca,
      tenantId,
      materiales: [],
      maquinas: [],
      productos: [],
      cotizaciones: [],
      ordenes: [],
    };
function guardar() {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(registro, null, 2) + '\n');
}
const fuenteAmana =
  'https://www.amanatool.com/pub/media/productattachments/Plastic-O-Flute-Speed-Chart-v9.pdf';
const fuenteZund =
  'https://www.zund.com/media/474/download/pri_Overview%20of%20oscillating_tools_8_EN-us.pdf?v=2';

async function material(codigo, nombre, attrs, precio, rollo = false) {
  const m = await p.materiaPrima.upsert({
    where: { tenantId_codigo: { tenantId, codigo } },
    update: {},
    create: {
      tenantId,
      codigo,
      nombre,
      descripcion:
        'Material simulado para pruebas de corte. No es stock físico del taller.',
      familia: 'SUSTRATO',
      subfamilia: rollo ? 'SUSTRATO_ROLLO_FLEXIBLE' : 'SUSTRATO_RIGIDO',
      tipoTecnico: rollo ? 'sustrato_rollo_flexible' : 'sustrato_rigido',
      templateId: rollo ? 'sustrato_rollo_flexible_v1' : 'sustrato_rigido_v1',
      unidadStock: 'M2',
      unidadUso: 'M2',
      unidadCompra: 'M2',
      atributosTecnicosJson: attrs,
      variantes: {
        create: {
          tenantId,
          sku: codigo + '-01',
          nombreVariante: nombre.replace('DEMO · ', ''),
          atributosVarianteJson: attrs,
          precioReferencia: precio,
          moneda: 'ARS',
          unidadPrecio: 'M2',
          unidadStock: 'M2',
          unidadUso: 'M2',
          unidadCompra: 'M2',
        },
      },
    },
    include: { variantes: true },
  });
  assert.equal(m.variantes.length, 1);
  return { ...m, variante: m.variantes[0] };
}

async function configurarMaquina(
  auth,
  id,
  centro,
  ancho,
  largo,
  herramientas,
  perfiles,
  tiempos,
  fuente,
) {
  const svc = app.get(MaquinariaService);
  const old = await p.maquina.findUniqueOrThrow({
    where: { id },
    include: { perfilesOperativos: true },
  });
  assert.equal(old.tenantId, tenantId);
  const backup = path.resolve(
    __dirname,
    '../../../.tmp/demo/corte-maquinas-originales.json',
  );
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  const originales = fs.existsSync(backup)
    ? JSON.parse(fs.readFileSync(backup, 'utf8'))
    : {};
  if (!originales[id]) {
    originales[id] = json(old);
    fs.writeFileSync(backup, JSON.stringify(originales, null, 2), {
      mode: 0o600,
    });
  }
  if (old.observaciones?.includes(marca) && old.perfilesOperativos.length)
    return svc.findOne(auth, id);
  assert.equal(
    old.perfilesOperativos.length,
    0,
    'No reemplazar perfiles cargados por el usuario',
  );
  const result = await svc.update(auth, id, {
    nombre: old.nombre,
    plantilla: old.plantilla.toLowerCase(),
    plantaId: old.plantaId,
    centroCostoPrincipalId: centro,
    estacionId: 'ed7c7403-50b0-459f-b314-36d5ad4101a2',
    estado: 'activa',
    estadoConfiguracion: 'lista',
    activo: true,
    geometriaTrabajo: old.geometriaTrabajo.toLowerCase(),
    unidadProduccionPrincipal: old.unidadProduccionPrincipal.toLowerCase(),
    anchoUtil: ancho,
    largoUtil: largo,
    altoUtil: 100,
    espesorMaximo: 10,
    observaciones: `${marca}. Perfiles DEMO para cotización local; requieren calibración. Fuente de referencia: ${fuente}. Dimensiones de Vega y tiempos auxiliares simulados.`,
    expectedUpdatedAt: old.updatedAt.toISOString(),
    parametrosTecnicos: {
      ...old.parametrosTecnicosJson,
      procesamientoCorte: {
        version: 1,
        posiciones: herramientas.length,
        cambio: 'MANUAL',
        cambioMin: 2,
        activacionSeg: 0,
        preparacionMin: 5,
        limpiezaMin: 2,
        cargaDescargaPlacaMin: 1,
        registroPlacaMin: 0.5,
        ...tiempos,
        herramientas,
      },
    },
    perfilesOperativos: perfiles,
    consumibles: [],
    componentesDesgaste: [],
  });
  assert.deepEqual(result.diagnosticoConfiguracion.faltantes, []);
  return result;
}

const herramienta = (id, nombre, tipo, posicion, operaciones, diametroMm) => ({
  id,
  nombre,
  tipo,
  posicion,
  operaciones,
  activo: true,
  montada: true,
  espesorMaxMm: 10,
  ...(diametroMm ? { diametroMm } : {}),
  desgaste: { modo: 'INCLUIDO_CENTRO' },
});
const perfil = (
  nombre,
  herramientaId,
  materialIds,
  espesor,
  velocidad,
  operacion = 'CORTE_COMPLETO',
  extra = {},
) => ({
  nombre: 'DEMO · ' + nombre,
  tipoPerfil: herramientaId === 'fresa-demo' ? 'mecanizado' : 'corte',
  activo: true,
  productivityValue: velocidad,
  productivityUnit: 'mm_min',
  setupMin: 0,
  cleanupMin: 0,
  detalle: {
    procesamientoCorteVersion: 1,
    herramientaId,
    operacionCorte: operacion,
    material: materialIds,
    espesorMinMm: espesor,
    espesorMaxMm: espesor,
    modoVelocidad: 'POR_PASADA',
    pasadas: 1,
    anchoCorteMm: 0,
    ...extra,
  },
});

async function crearProducto(spec) {
  const existing = await p.producto.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: spec.codigo } },
  });
  if (existing) return { ...spec, id: existing.id };
  return p.$transaction(async (tx) => {
    const producto = await tx.producto.create({
      data: {
        tenantId,
        codigo: spec.codigo,
        nombre: spec.nombre,
        descripcion:
          'Producto DEMO para validar cotización y producción. Valores de prueba, ajustables desde la ficha.',
        subcategoriaComercialId: spec.categoria,
        unidadComercial: 'unidad',
        modoMedidas: 'LIBRE',
        dimensionesRequeridas: [],
        atributosComercialesJson: {
          geometriasComerciales: {
            version: 1,
            modo: spec.rollo ? 'RECTANGULAR' : 'AMBAS',
            fuentes: [],
            permitirCotizacionManual: !spec.rollo,
          },
        },
        precioConfigJson: {
          metodoCalculo: 'por_margen',
          detalle: { marginPct: 30 },
        },
      },
    });
    const ruta = await tx.ruta.create({
      data: {
        tenantId,
        codigo: spec.codigo,
        nombre: spec.nombre,
        descripcion: marca,
      },
    });
    const pasos = [];
    if (spec.impresora)
      pasos.push(
        await tx.rutaPaso.create({
          data: {
            tenantId,
            rutaId: ruta.id,
            orden: 0,
            familiaCodigo: 'impresion_por_area',
            nombreVisible: spec.rollo
              ? 'Impresión ecosolvente'
              : 'Impresión UV',
            icono: 'Printer',
          },
        }),
      );
    pasos.push(
      await tx.rutaPaso.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          orden: pasos.length,
          familiaCodigo: spec.familia,
          nombreVisible: spec.corteNombre,
          icono: 'Scissors',
        },
      }),
    );
    await tx.rutaVersion.create({
      data: {
        tenantId,
        rutaId: ruta.id,
        version: 1,
        snapshotJson: json({ pasos }),
        cambios: marca,
      },
    });
    const alternativa = await tx.productoRutaAlternativa.create({
      data: {
        tenantId,
        productoId: producto.id,
        rutaId: ruta.id,
        rutaVersion: 1,
        nombre: spec.nombre,
        esPreferida: true,
      },
    });
    const nestingConfig = {
      margins: {
        leftMm: 10,
        rightMm: 10,
        topMm: 100,
        bottomMm: 100,
        startMm: 100,
        endMm: 100,
      },
      separationHMm: spec.familia === 'cnc' ? 8 : 5,
      separationVMm: spec.familia === 'cnc' ? 8 : 5,
      pieceBleedMm: 0,
      allowRotation: true,
      costing: { strategy: 'simple' },
    };
    for (const [i, paso] of pasos.entries()) {
      const impresion = spec.impresora && i === 0;
      const config = await tx.productoConfigPaso.create({
        data: {
          tenantId,
          productoRutaAlternativaId: alternativa.id,
          rutaPasoId: paso.id,
          modoActivacion: 'OBLIGATORIO',
          modoTiempo: 'T-3',
          mecanismoCantidad: 'CALCULADO_POR_PASO',
          maquinaM1Id: impresion ? spec.impresora : spec.maquina,
          perfilM1Id: impresion ? spec.perfilImpresora : (spec.perfil ?? null),
          paramsPasoJson: impresion
            ? { nestingConfig }
            : {
                usarDisenoVectorial: !spec.rollo,
                cotizarOperacionesVectoriales: !spec.rollo,
                nestingConfig,
              },
        },
      });
      await tx.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: config.id,
          slotCodigo: impresion ? 'sustrato_principal' : 'sustrato_corte',
          ...(!impresion && spec.impresora
            ? {
                modoSeleccion: 'HEREDA_DE_PASO',
                heredaDeRutaPasoId: pasos[0].id,
                heredaDeSlotCodigo: 'sustrato_principal',
              }
            : {
                modoSeleccion: 'HARDCODED',
                materialVarianteId: spec.variante,
              }),
        },
      });
    }
    return { ...spec, id: producto.id };
  });
}

async function main() {
  const db = new URL(process.env.DATABASE_URL);
  assert(
    ['localhost', '127.0.0.1'].includes(db.hostname) &&
      db.pathname === '/gdi_saas' &&
      process.env.NODE_ENV !== 'production',
    'Sólo base local gdi_saas',
  );
  assert(process.argv.includes('--aplicar'), 'Requiere --aplicar');
  // Compilar DI sin init: no arranca crons ni listeners adicionales. Los únicos
  // efectos suprimidos son avisos externos; motor, ETA, stock y OT son reales.
  app = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(NotificacionesOrdenesService)
    .useValue({ sincronizar: async () => {}, cambioEntrega: async () => {} })
    .compile();
  const membership = await p.membership.findFirstOrThrow({
    where: { tenantId, rol: 'ADMINISTRADOR', activa: true },
    include: { user: true },
  });
  const auth = {
    tenantId,
    userId: membership.userId,
    membershipId: membership.id,
    role: 'ADMINISTRADOR',
    email: membership.user.email,
    sessionId: marca,
    permisos: new Set([
      'produccion.supervisar',
      'produccion.gestionar',
      'comercial.gestionar',
      'comercial.ver',
      'finanzas.ver_margenes',
      'inventario.gestionar',
    ]),
  };
  await runWithTenant(tenantId, async () => {
    const placa = (a, h, e, colorBase) => ({
      ancho: a / 1000,
      alto: h / 1000,
      anchoMm: a,
      altoMm: h,
      largoMm: h,
      espesor: e,
      espesorMm: e,
      colorBase,
    });
    const acrilico = await material(
      'DEMO-CORTE-ACR3',
      'DEMO · Acrílico cristal 3 mm',
      placa(1220, 1220, 3, 'Cristal'),
      38834.990594,
    );
    const pp = await material(
      'DEMO-CORTE-PP3',
      'DEMO · Polipropileno corrugado 3 mm',
      placa(1000, 2000, 3, 'Blanco'),
      9500,
    );
    const carton = await material(
      'DEMO-CORTE-CARTON3',
      'DEMO · Cartón microcorrugado 3 mm',
      placa(1000, 1500, 3, 'Kraft'),
      3200,
    );
    const vinilo = await material(
      'DEMO-CORTE-VINILO',
      'DEMO · Vinilo blanco imprimible',
      {
        ancho: 1.37,
        largo: 50,
        anchoMm: 1370,
        largoMm: 50000,
        largoRolloMm: 50000,
        acabado: 'Brillante',
      },
      1842,
      true,
    );
    const mats = [acrilico, pp, carton, vinilo];
    // El catálogo antiguo tenía importes por ml con unidadPrecio sin confirmar.
    // Se completa explícitamente para este ensayo; conservar el respaldo local.
    const tintas = await p.materiaPrimaVariante.findMany({
      where: {
        tenantId,
        materiaPrima: { codigo: 'TINTA_ECOSOLVENTE_CMYK' },
        unidadPrecio: null,
      },
    });
    if (tintas.length) {
      const backup = path.resolve(
        __dirname,
        '../../../.tmp/demo/corte-tintas-originales.json',
      );
      if (!fs.existsSync(backup))
        fs.writeFileSync(backup, JSON.stringify(tintas, null, 2), {
          mode: 0o600,
        });
      await p.materiaPrimaVariante.updateMany({
        where: {
          tenantId,
          id: { in: tintas.map((t) => t.id) },
          unidadPrecio: null,
        },
        data: { unidadPrecio: 'ML' },
      });
      registro.ajusteTintas = {
        ids: tintas.map((t) => t.id),
        precioConservado: true,
        unidadPrecio: 'ML',
        motivo: 'Interpretación explícita de prueba de los importes históricos',
      };
    }
    registro.materiales = mats.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      varianteId: m.variante.id,
    }));
    guardar();
    const router = await configurarMaquina(
      auth,
      '942672e2-9d75-4dc3-a910-d950ef1e0c46',
      '75258615-f12e-4ddb-9ef5-97b7d42d446a',
      1300,
      1800,
      [
        herramienta(
          'fresa-demo',
          'DEMO · Fresa O-flute 3 mm',
          'FRESA',
          1,
          ['CORTE_COMPLETO'],
          3,
        ),
      ],
      [
        perfil(
          'Acrílico 3 mm · fresa 3 mm · 18.000 rpm',
          'fresa-demo',
          [acrilico.id, 'e6bbabf3-feba-4021-9919-bef2b56b0d07'],
          3,
          2000,
          'CORTE_COMPLETO',
          {
            rpm: 18000,
            anchoCorteMm: 3,
            profundidadPasadaMm: 3,
            entradaSeg: 1,
          },
        ),
      ],
      {},
      fuenteAmana,
    );
    const mesa = await configurarMaquina(
      auth,
      '2b2cdb40-74a5-4149-a22b-a2f0b8878b0b',
      '57e3e6b7-ff2b-48f2-a8fe-7102335b666b',
      1600,
      2500,
      [
        herramienta(
          'oscilante-demo',
          'DEMO · Cuchilla oscilante',
          'OSCILANTE',
          1,
          ['CORTE_COMPLETO', 'CORTE_PARCIAL'],
        ),
        herramienta('rueda-demo', 'DEMO · Rueda de hendido', 'RUEDA', 2, [
          'HENDIDO',
        ]),
      ],
      [
        perfil('PP corrugado 3 mm · corte', 'oscilante-demo', [pp.id], 3, 6000),
        perfil('Cartón 3 mm · corte', 'oscilante-demo', [carton.id], 3, 9000),
        perfil(
          'Cartón 3 mm · medio corte',
          'oscilante-demo',
          [carton.id],
          3,
          6000,
          'CORTE_PARCIAL',
        ),
        perfil(
          'Cartón 3 mm · hendido',
          'rueda-demo',
          [carton.id],
          3,
          12000,
          'HENDIDO',
        ),
      ],
      { preparacionMin: 4 },
      fuenteZund,
    );
    registro.maquinas = [router, mesa].map((m) => ({
      id: m.id,
      nombre: m.nombre,
      perfiles: m.perfilesOperativos.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        velocidad: v.productivityValue,
        unidad: v.productivityUnit,
      })),
    }));
    guardar();
    const almacen = await p.almacenMateriaPrima.upsert({
      where: { tenantId_codigo: { tenantId, codigo: marca } },
      update: {},
      create: { tenantId, codigo: marca, nombre: 'DEMO · Pruebas de corte' },
    });
    const ubicacion = await p.almacenMateriaPrimaUbicacion.upsert({
      where: {
        tenantId_almacenId_codigo: {
          tenantId,
          almacenId: almacen.id,
          codigo: 'DEMO',
        },
      },
      update: {},
      create: {
        tenantId,
        almacenId: almacen.id,
        codigo: 'DEMO',
        nombre: 'Material simulado',
      },
    });
    for (const m of mats)
      if (
        !(await p.movimientoStockMateriaPrima.findFirst({
          where: { tenantId, varianteId: m.variante.id, referenciaId: marca },
        }))
      ) {
        await app.get(InventarioService).registrarMovimiento(auth, {
          varianteId: m.variante.id,
          ubicacionId: ubicacion.id,
          tipo: 'ingreso',
          origen: 'otro',
          cantidad: 100,
          costoUnitario: Number(m.variante.precioReferencia),
          referenciaTipo: 'DEMO',
          referenciaId: marca,
          notas:
            'Ingreso simulado para validación local; no representa stock físico.',
        });
      }
    registro.ubicacionId = ubicacion.id;
    const cncCat = '20000000-0000-4000-8000-000000000031',
      rigCat = '20000000-0000-4000-8000-000000000016',
      vinCat = '20000000-0000-4000-8000-000000000012';
    const uv = {
      impresora: 'a9c3a32f-5b16-4387-881f-3130dd9ad217',
      perfilImpresora: '75c95bd4-a153-4aab-8ffb-266ecf1eba6b',
    };
    const specs = [
      {
        codigo: 'DEMO-CNC-ACR',
        nombre: 'DEMO · Acrílico cortado en CNC',
        categoria: cncCat,
        familia: 'cnc',
        maquina: router.id,
        variante: acrilico.variante.id,
        corteNombre: 'Corte CNC',
      },
      {
        codigo: 'DEMO-UV-CNC',
        nombre: 'DEMO · Acrílico UV + CNC',
        categoria: rigCat,
        familia: 'cnc',
        maquina: router.id,
        variante: acrilico.variante.id,
        corteNombre: 'Corte CNC',
        ...uv,
      },
      {
        codigo: 'DEMO-MESA-PP',
        nombre: 'DEMO · Corrugado cortado en mesa',
        categoria: rigCat,
        familia: 'troquelado_digital',
        maquina: mesa.id,
        variante: pp.variante.id,
        corteNombre: 'Corte oscilante',
      },
      {
        codigo: 'DEMO-UV-MESA',
        nombre: 'DEMO · Corrugado UV + mesa de corte',
        categoria: rigCat,
        familia: 'troquelado_digital',
        maquina: mesa.id,
        variante: pp.variante.id,
        corteNombre: 'Corte oscilante',
        ...uv,
      },
      {
        codigo: 'DEMO-MESA-PACK',
        nombre: 'DEMO · Packaging: corte, medio corte y hendido',
        categoria: rigCat,
        familia: 'troquelado_digital',
        maquina: mesa.id,
        variante: carton.variante.id,
        corteNombre: 'Corte y hendido',
        packaging: true,
      },
      ...[false, true].map((imp) => ({
        codigo: imp ? 'DEMO-IMP-PLOTTER' : 'DEMO-PLOTTER',
        nombre: imp
          ? 'DEMO · Vinilo impreso + plotter'
          : 'DEMO · Vinilo cortado en plotter',
        categoria: vinCat,
        familia: 'plotter_corte',
        maquina: '19b84789-85b1-43ee-9a81-03630914c00a',
        perfil: '677be7b7-18ec-4e24-8a82-8b74a60051ff',
        variante: vinilo.variante.id,
        corteNombre: 'Corte en plotter',
        rollo: true,
        ...(imp
          ? {
              impresora: '4174d0b2-86f9-4130-bfc2-e40fa15174d9',
              perfilImpresora: '6b9e66eb-498b-4117-b277-4968defd6550',
            }
          : {}),
      })),
    ];
    const productos = [];
    for (const spec of specs) productos.push(await crearProducto(spec));
    registro.productos = productos.map(({ id, codigo, nombre }) => ({
      id,
      codigo,
      nombre,
    }));
    guardar();
    const pub = await app.get(RecetasProductoService).sincronizarPublicaciones(
      auth,
      productos.map((p) => p.id),
    );
    assert.deepEqual(pub.bloqueos, [], JSON.stringify(pub.bloqueos));
    console.log(
      'CATALOGO_LISTO',
      JSON.stringify({
        productos: registro.productos,
        perfiles: registro.maquinas,
      }),
    );
    if (process.argv.includes('--recorrido'))
      await recorrido(auth, productos, ubicacion.id);
  });
}

async function recorrido(auth, productos, ubicacionId) {
  // Implementación del recorrido abajo: usa los mismos servicios de la API.
  const motor = app.get(MotorUniversalService);
  const svg = fs.readFileSync(path.join(dir, 'contorno-L-200x100.svg'), 'utf8');
  for (const producto of productos.filter((p) => !p.packaging)) {
    for (const modo of producto.rollo
      ? ['medidas']
      : ['medidas', 'svg', 'placas']) {
      const key = `${producto.codigo}:${modo}`;
      if (registro.cotizaciones.some((c) => c.key === key)) continue;
      const cantidad = 20;
      const jobContext = {
        cantidad,
        modoCotizacionVectorial: modo,
        ...(modo === 'medidas'
          ? {
              medidaCustomMm: { anchoMm: 200, altoMm: 100 },
              piezas: [{ anchoMm: 200, altoMm: 100, cantidad }],
            }
          : modo === 'svg'
            ? {
                disenoVectorialFuente: {
                  schemaVersion: 1,
                  svg,
                  nombreArchivo: 'contorno-L-200x100.svg',
                  anchoFinalMm: 200,
                },
              }
            : {
                placasVectorialesManuales: 2,
                metrosCortePorPlacaVectorial: 6,
                entradasCortePorPlacaVectorial: 10,
              }),
      };
      const q = await motor.cotizarYGuardar({
        tenantId,
        productoId: producto.id,
        periodo,
        jobContext,
      });
      assert(q.result.exitoso, JSON.stringify(q.result.errores));
      const pasos = q.result.cotizacion.pasos,
        corte = pasos.at(-1);
      assert(corte.tiempo.totalMin > 0);
      if (producto.impresora) {
        const coords = (n) =>
          n.placements.map((p) => [p.substrateIndex, p.xMm, p.yMm, p.rotated]);
        assert.deepEqual(
          coords(corte.nestingResult),
          coords(pasos[0].nestingResult),
        );
        assert.equal(
          corte.materiales.filter(
            (m) => m.materialVarianteId === producto.variante,
          ).length,
          0,
        );
      }
      registro.cotizaciones.push({
        key,
        productoId: producto.id,
        cotizacionId: q.cotizacionId,
        cotizacionItemId: q.cotizacionItemId,
        modo,
        cantidad,
        pasos: pasos.map((p) => ({
          nombre: p.nombre,
          familia: p.familiaCodigo,
          minutos: p.tiempo?.totalMin,
          algoritmo: p.nestingResult?.algorithm,
          cantidadMaterial: p.nestingResult?.cantidadCalculada,
          operaciones: p.tiempo?.procesamientoCorte?.operaciones.map((o) => ({
            operacion: o.operacion,
            metros: o.metros,
            minutos: o.recorridoMin,
          })),
        })),
      });
      guardar();
      console.log('COTIZADO', key);
    }
  }
  const packaging = productos.find((p) => p.packaging);
  const packKey = `${packaging.codigo}:svg`;
  const anterior = registro.cotizaciones.find((c) => c.key === packKey);
  if (anterior && anterior.fixtureVersion !== 2) {
    // Conservar evidencia de la primera fixture; jamás modificar una geometría
    // o un snapshot de OT que ya se emitió.
    registro.fixturesReemplazadas ??= [];
    const otAnterior = registro.ordenes.find((o) => o.key === packKey);
    registro.fixturesReemplazadas.push({
      cotizacion: anterior,
      orden: otAnterior,
      motivo:
        'DXF mínimo rechazado por el visor CAD; se repite con DXF completo.',
    });
    registro.cotizaciones = registro.cotizaciones.filter((c) => c !== anterior);
    registro.ordenes = registro.ordenes.filter((o) => o !== otAnterior);
    guardar();
  }
  if (!registro.cotizaciones.some((c) => c.key === packKey)) {
    const {
      interpretarVector,
    } = require('../dist/src/productos-servicios/geometrias/interpretar-vector');
    const { createHash } = require('node:crypto');
    // Generador DXF completo: el visor CAD requiere tablas y subclases,
    // además de los puntos que alcanza a leer el parser de contornos.
    const Drawing = require('dxf-writer');
    const d = new Drawing();
    d.setUnits('Millimeters');
    d.addLayer('EXTERIOR', Drawing.ACI.RED, 'CONTINUOUS')
      .setActiveLayer('EXTERIOR')
      .drawPolyline(
        [
          [0, 0],
          [200, 0],
          [200, 100],
          [0, 100],
        ],
        true,
      );
    d.addLayer('HENDIDO', Drawing.ACI.BLUE, 'CONTINUOUS')
      .setActiveLayer('HENDIDO')
      .drawLine(100, 0, 100, 100);
    d.addLayer('CORTE PARCIAL', Drawing.ACI.GREEN, 'CONTINUOUS')
      .setActiveLayer('CORTE PARCIAL')
      .drawLine(10, 20, 90, 20);
    const svgPack = d.toDxfString();
    const nombreArchivo = 'packaging-corte-hendido-200x100.dxf';
    fs.writeFileSync(path.join(dir, nombreArchivo), svgPack);
    const {
      inspeccionarDxfNativo,
    } = require('../dist/src/productos-servicios/geometrias/dxf-nativo');
    const inspeccion = await inspeccionarDxfNativo(svgPack);
    const seleccion = {
      exteriorId: inspeccion.sugeridaId,
      unidad: 'mm',
      cerrarExterior: false,
      operaciones: inspeccion.entidades
        .filter((e) => e.capa === 'HENDIDO' || e.capa === 'CORTE PARCIAL')
        .map((e) => ({
          entidadId: e.id,
          tipo: e.capa === 'HENDIDO' ? 'HENDIDO' : 'CORTE_PARCIAL',
        })),
    };
    assert.equal(seleccion.operaciones.length, 2, JSON.stringify(inspeccion));
    const {
      STORAGE_DRIVER,
    } = require('../dist/src/archivos/storage/storage.driver');
    const hash = createHash('sha256').update(svgPack).digest('hex');
    const key = `${tenantId}/productos/${packaging.id}/${marca}-packaging-v2.dxf`;
    await app
      .get(STORAGE_DRIVER)
      .subir(key, Buffer.from(svgPack), 'application/dxf');
    const archivo =
      (await p.archivo.findFirst({ where: { tenantId, key } })) ??
      (await p.archivo.create({
        data: {
          tenantId,
          productoId: packaging.id,
          scope: 'PRODUCTO',
          key,
          nombreOriginal: nombreArchivo,
          mimeType: 'application/dxf',
          bytes: BigInt(Buffer.byteLength(svgPack)),
          estado: 'LISTO',
        },
      }));
    const guardada = await p.geometriaProducto.findFirst({
      where: {
        tenantId,
        productoId: packaging.id,
        archivoId: archivo.id,
        hash,
      },
    });
    const geometriaId = guardada?.id ?? randomUUID();
    const fuente = interpretarVector(inspeccion, seleccion, {
      geometriaId,
      archivoId: archivo.id,
      hash,
      nombreArchivo,
    });
    if (!guardada)
      await p.geometriaProducto.create({
        data: {
          id: geometriaId,
          tenantId,
          productoId: packaging.id,
          archivoId: archivo.id,
          hash,
          interpretacionJson: json(seleccion),
          fuenteJson: json(fuente),
        },
      });
    await p.producto.update({
      where: { id: packaging.id },
      data: {
        atributosComercialesJson: {
          geometriasComerciales: {
            version: 1,
            modo: 'VECTORIAL',
            permitirCotizacionManual: false,
            fuentes: [
              {
                id: 'troquel',
                nombre: 'Troquel DEMO de corte y hendido',
                requerida: true,
                permitirReemplazo: true,
                predeterminada: fuente,
              },
            ],
          },
        },
      },
    });
    assert.deepEqual(
      (
        await app
          .get(RecetasProductoService)
          .sincronizarPublicaciones(auth, [packaging.id])
      ).bloqueos,
      [],
    );
    const q = await motor.cotizarYGuardar({
      tenantId,
      productoId: packaging.id,
      periodo,
      jobContext: { cantidad: 20, modoCotizacionVectorial: 'svg' },
    });
    assert(q.result.exitoso, JSON.stringify(q.result.errores));
    const ops =
      q.result.cotizacion.pasos.at(-1).tiempo.procesamientoCorte.operaciones;
    assert.deepEqual(ops.map((o) => o.operacion).sort(), [
      'CORTE_COMPLETO',
      'CORTE_PARCIAL',
      'HENDIDO',
    ]);
    registro.cotizaciones.push({
      key: packKey,
      fixtureVersion: 2,
      productoId: packaging.id,
      cotizacionId: q.cotizacionId,
      cotizacionItemId: q.cotizacionItemId,
      modo: 'svg',
      cantidad: 20,
      operaciones: ops.map((o) => ({
        operacion: o.operacion,
        metros: o.metros,
        minutos: o.recorridoMin,
      })),
    });
    guardar();
    console.log('COTIZADO', packKey);
  }
  const cliente = await p.cliente.upsert({
    where: {
      tenantId_nombre: { tenantId, nombre: 'DEMO · Validación CNC y mesa' },
    },
    update: {},
    create: {
      tenantId,
      nombre: 'DEMO · Validación CNC y mesa',
      telefonoCodigo: '54',
      telefonoNumero: '',
      paisCodigo: 'AR',
      aceptaWhatsapp: false,
    },
  });
  registro.clienteId = cliente.id;
  guardar();
  const ordenes = app.get(OrdenesTrabajoService),
    reservas = app.get(ReservasMaterialService);
  for (const key of [
    'DEMO-UV-CNC:svg',
    'DEMO-UV-MESA:medidas',
    packKey,
    'DEMO-IMP-PLOTTER:medidas',
    'DEMO-UV-CNC:placas',
  ]) {
    const q = registro.cotizaciones.find((c) => c.key === key),
      producto = productos.find((p) => p.id === q.productoId);
    let registroOt = registro.ordenes.find((o) => o.key === key);
    if (!registroOt) {
      q.emisionKey ??= randomUUID();
      guardar();
      const orden = await ordenes.create(auth, {
        idempotencyKey: q.emisionKey,
        estado: 'pendiente',
        clienteId: cliente.id,
        cotizacionId: q.cotizacionId,
        fechaEntrega: '2026-09-30',
        canalVenta: 'mostrador',
        observaciones: marca + ': recorrido simulado local',
        items: [
          {
            cotizacionItemId: q.cotizacionItemId,
            codigo: producto.codigo,
            nombre: producto.nombre,
            familia: 'DEMO · Validación de corte',
            cantidad: q.cantidad,
            cantidadUnidad: 'unidad',
            subtotal: 0,
            impuestos: 0,
            total: 0,
            nota: 'Simulación local de producción; no enviar a una máquina física.',
          },
        ],
      });
      registroOt = {
        key,
        id: orden.id,
        numero: orden.numero,
        estado: orden.estado,
        total: orden.total,
      };
      registro.ordenes.push(registroOt);
      guardar();
      console.log('OT_EMITIDA', orden.numero, key);
    }
    if (key.endsWith(':placas')) continue; // Se deja emitida para revisión manual.
    let actual = await p.ordenTrabajo.findUniqueOrThrow({
      where: { id: registroOt.id },
      include: { items: true },
    });
    if (actual.estado === 'entregada') continue;
    // Descontar solamente el sustrato DEMO; tintas del taller conservan sus saldos.
    const ctrl = await reservas.consultar(tenantId, actual.id);
    const m = ctrl.control.materiales.find(
      (m) => m.varianteId === producto.variante,
    );
    assert(
      m?.cantidad > 0 && m.reservada + m.consumida >= m.cantidad,
      JSON.stringify(ctrl.control),
    );
    registroOt.reservaInicial = m.reservada;
    if (m.cantidad > m.consumida)
      await reservas.ejecutar(auth, actual.id, {
        clave: randomUUID(),
        revision: ctrl.revision,
        accion: 'consumir',
        varianteId: m.varianteId,
        ubicacionId,
        cantidad: m.cantidad - m.consumida,
        unidad: m.unidad,
        motivo: marca + ': fabricación simulada',
      });
    let vueltas = 0;
    while (vueltas++ < 20) {
      const pasos = await p.ordenTrabajoItemPaso.findMany({
        where: { tenantId, ordenId: actual.id },
        include: { dependenciasEntrantes: { include: { predecesor: true } } },
        orderBy: { indice: 'asc' },
      });
      if (pasos.every((s) => s.estado === 'hecho')) break;
      const siguiente = pasos.find(
        (s) =>
          s.estado !== 'hecho' &&
          s.nestingLoteRol !== 'PARTICIPANTE' &&
          (s.nodoClave
            ? s.dependenciasEntrantes.every(
                (d) => !d.obligatoria || d.predecesor.estado === 'hecho',
              )
            : pasos
                .filter((o) => o.itemId === s.itemId && o.indice < s.indice)
                .every((o) => o.estado === 'hecho')),
      );
      assert(siguiente, 'No hay paso ejecutable');
      if (
        siguiente.modoRegistro === 'cronometro' &&
        siguiente.estado === 'pendiente'
      )
        await ordenes.accionPaso(
          auth,
          actual.id,
          siguiente.itemId,
          siguiente.id,
          { accion: 'iniciar' },
        );
      await ordenes.accionPaso(
        auth,
        actual.id,
        siguiente.itemId,
        siguiente.id,
        { accion: 'completar', sinTiempoConfirmado: true },
      );
    }
    actual = await p.ordenTrabajo.findUniqueOrThrow({
      where: { id: actual.id },
      include: { items: true, pasos: true },
    });
    assert.equal(actual.estado, 'finalizada');
    assert.equal(actual.progresoPct, 100);
    await app.get(EntregaService).entregar(auth, actual.id, {
      itemIds: actual.items.filter((i) => !i.parentItemId).map((i) => i.id),
    });
    const final = await p.ordenTrabajo.findUniqueOrThrow({
      where: { id: actual.id },
    });
    assert.equal(final.estado, 'entregada');
    const finStock = await reservas.consultar(tenantId, actual.id);
    const usado = finStock.control.materiales.find(
      (m) => m.varianteId === producto.variante,
    );
    assert.equal(usado.reservada, 0);
    assert.equal(usado.consumida, usado.cantidad);
    Object.assign(registroOt, {
      estado: final.estado,
      consumo: usado.consumida,
      unidad: usado.unidad,
      pasosCompletados: actual.pasos.length,
    });
    guardar();
    console.log('OT_ENTREGADA', registroOt.numero, key);
  }
}

main()
  .catch((e) => {
    console.error(e.stack || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (app) await app.close();
    await p.$disconnect();
  });
