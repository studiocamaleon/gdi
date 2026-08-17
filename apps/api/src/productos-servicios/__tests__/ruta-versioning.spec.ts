import { PrismaClient } from '@prisma/client';
import { CargosDirectosProductoService } from '../cargos-directos-producto.service';
import { ConfigPasosService } from '../config-pasos.service';
import { FamiliasPasosService } from '../familias-pasos.service';
import { ProductoRutasService } from '../producto-rutas.service';
import { ProductoValidacionService } from '../producto-validacion.service';
import { ProductosService } from '../productos.service';
import { ProductosServiciosService } from '../productos-servicios.service';
import { RutasProduccionService } from '../rutas-produccion.service';

const prisma = new PrismaClient();
const TENANT_SLUG = 'gdi-demo';
const PRODUCT_CODE = 'TEST-RUTA-VERSIONING';
const ROUTE_CODE = 'TEST-RUTA-VERSIONING-RUTA';

let tenantId: string | null = null;
let service: ProductosServiciosService;

async function cleanup() {
  if (!tenantId) return;
  await prisma.producto.deleteMany({
    where: { tenantId, codigo: { startsWith: PRODUCT_CODE } },
  });
  await prisma.ruta.deleteMany({
    where: { tenantId, codigo: { startsWith: ROUTE_CODE } },
  });
}

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  tenantId = tenant?.id ?? null;
  const familias = new FamiliasPasosService(prisma as never);
  const productos = new ProductosService(prisma as never);
  const configPasos = new ConfigPasosService(prisma as never, familias);
  service = new ProductosServiciosService(
    productos,
    new RutasProduccionService(prisma as never, familias),
    new ProductoRutasService(prisma as never, configPasos),
    configPasos,
    familias,
    new CargosDirectosProductoService(prisma as never, familias),
    new ProductoValidacionService(productos),
  );
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Ruta de producción versionada', () => {
  it('preserva pasos v1 usados por productos cuando la ruta evoluciona a v2', async () => {
    if (!tenantId) return;

    const producto = await service.crearProducto(tenantId, {
      codigo: PRODUCT_CODE,
      nombre: 'Producto test versioning',
      subcategoriaComercialCodigo: 'producto_a_medida',
      unidadComercial: 'unidad',
      modoMedidas: 'FIJA',
    });
    const ruta = await service.crearRuta(tenantId, {
      codigo: ROUTE_CODE,
      nombre: 'Ruta test versioning',
      pasos: [
        {
          orden: 1,
          familiaCodigo: 'pre_prensa',
          nombreVisible: 'Control de archivos',
        },
      ],
    });
    const pasoV1 = ruta.pasos[0];
    const alternativa = await service.crearProductoRutaAlternativa(
      tenantId,
      producto.id,
      {
        rutaId: ruta.id,
        rutaVersion: 1,
        nombre: 'Principal v1',
        esPreferida: true,
      },
    );
    const configDefault = await prisma.productoConfigPaso.findFirstOrThrow({
      where: {
        tenantId,
        productoRutaAlternativaId: alternativa.id,
        rutaPasoId: pasoV1.id,
      },
    });
    expect(configDefault.nombreVisible).toBe('Control de archivos');
    const rutaEnListado = (await service.listarRutas(tenantId)).find(
      (item) => item.id === ruta.id,
    );
    expect(rutaEnListado?.pasos[0].nombreVisible).toBe('Control de archivos');
    await service.upsertConfigPaso(tenantId, alternativa.id, {
      rutaPasoId: pasoV1.id,
      nombreVisible: 'Control de archivos',
    });

    await service.actualizarRuta(tenantId, ruta.id, {
      pasos: [{ orden: 1, familiaCodigo: 'embalaje' }],
      nuevaVersion: true,
      cambios: 'Cambio estructural test',
    });

    const pasos = await prisma.rutaPaso.findMany({
      where: { tenantId, rutaId: ruta.id },
      orderBy: [{ version: 'asc' }, { orden: 'asc' }],
    });
    expect(
      pasos.map((paso) => `${paso.version}:${paso.familiaCodigo}`),
    ).toEqual(['1:pre_prensa', '2:embalaje']);

    const config = await prisma.productoConfigPaso.findFirstOrThrow({
      where: { tenantId, productoRutaAlternativaId: alternativa.id },
      include: { rutaPaso: true },
    });
    expect(config.rutaPaso.version).toBe(1);
    expect(config.rutaPaso.familiaCodigo).toBe('pre_prensa');

    const productoDetalle = await service.obtenerProducto(
      tenantId,
      producto.id,
    );
    expect(
      productoDetalle.rutasAlternativas[0].ruta.pasos.map(
        (paso) => `${paso.version}:${paso.familiaCodigo}`,
      ),
    ).toEqual(['1:pre_prensa']);
  });

  it('rechaza configurar un paso que no pertenece a la versión de la alternativa', async () => {
    if (!tenantId) return;
    const alternativa = await prisma.productoRutaAlternativa.findFirstOrThrow({
      where: { tenantId, producto: { codigo: PRODUCT_CODE } },
    });
    const pasoV2 = await prisma.rutaPaso.findFirstOrThrow({
      where: { tenantId, rutaId: alternativa.rutaId, version: 2 },
    });

    await expect(
      service.upsertConfigPaso(tenantId, alternativa.id, {
        rutaPasoId: pasoV2.id,
      }),
    ).rejects.toThrow('no pertenece a la ruta y versión');
  });

  it('fuerza una versión nueva y permite migrar preservando configuraciones compatibles', async () => {
    if (!tenantId) return;
    const producto = await service.crearProducto(tenantId, {
      codigo: `${PRODUCT_CODE}-INPLACE`,
      nombre: 'Producto test versioning in-place',
      subcategoriaComercialCodigo: 'producto_a_medida',
      unidadComercial: 'unidad',
      modoMedidas: 'FIJA',
    });
    const ruta = await service.crearRuta(tenantId, {
      codigo: `${ROUTE_CODE}-INPLACE`,
      nombre: 'Ruta test versioning in-place',
      pasos: [
        { orden: 1, familiaCodigo: 'pre_prensa' },
        {
          orden: 2,
          familiaCodigo: 'impresion_por_area',
          nombreVisible: 'Impresión principal',
        },
      ],
    });
    const alternativa = await service.crearProductoRutaAlternativa(
      tenantId,
      producto.id,
      {
        rutaId: ruta.id,
        rutaVersion: 1,
        nombre: 'Principal',
        esPreferida: true,
      },
    );
    for (const paso of ruta.pasos) {
      await service.upsertConfigPaso(tenantId, alternativa.id, {
        rutaPasoId: paso.id,
        nombreVisible: paso.nombreVisible,
      });
    }

    await service.actualizarRuta(tenantId, ruta.id, {
      pasos: [
        {
          orden: 1,
          familiaCodigo: 'impresion_por_area',
          nombreVisible: 'Salida principal',
        },
      ],
      nuevaVersion: false,
    });

    const pasos = await prisma.rutaPaso.findMany({
      where: { tenantId, rutaId: ruta.id },
      orderBy: [{ version: 'asc' }, { orden: 'asc' }],
    });
    expect(
      pasos.map((paso) => `${paso.version}:${paso.familiaCodigo}`),
    ).toEqual(['1:pre_prensa', '1:impresion_por_area', '2:impresion_por_area']);

    const alternativaAntes =
      await prisma.productoRutaAlternativa.findUniqueOrThrow({
        where: { id: alternativa.id },
      });
    expect(alternativaAntes.rutaVersion).toBe(1);

    const resultado = await service.migrarProductosRuta(tenantId, ruta.id, [
      alternativa.id,
    ]);
    expect(resultado).toEqual({ migradas: 1, requierenConfiguracion: 0 });

    const configs = await prisma.productoConfigPaso.findMany({
      where: { tenantId, productoRutaAlternativaId: alternativa.id },
      include: { rutaPaso: true },
    });
    expect(configs).toHaveLength(1);
    expect(configs[0].rutaPaso.version).toBe(2);
    expect(configs[0].rutaPaso.familiaCodigo).toBe('impresion_por_area');
    expect(configs[0].nombreVisible).toBe('Salida principal');

    await prisma.producto.delete({ where: { id: producto.id } });
    await prisma.ruta.delete({ where: { id: ruta.id } });
  });
});
