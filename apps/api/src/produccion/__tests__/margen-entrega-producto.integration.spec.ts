import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosService } from '../../productos-servicios/productos.service';
import {
  ModoMedidasDto,
  UnidadComercialDto,
} from '../../productos-servicios/dto/producto.dto';
import { EtaService } from '../../eta/eta.service';
import type { ProduccionService } from '../produccion.service';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';

const db = new PrismaService();
const tenantId = randomUUID(),
  otroTenant = randomUUID();
const codigo = `margen-${randomUUID()}`;
const capacidades = capacidadesDePrueba();
const productos = new ProductosService(db, capacidades);
const eta = new EtaService(
  db,
  {
    findEstaciones: jest.fn().mockResolvedValue([]),
    findDuracionesFamilias: jest.fn().mockResolvedValue([]),
    findDiasNoLaborables: jest.fn().mockResolvedValue([]),
    getConfiguracion: jest
      .fn()
      .mockResolvedValue({ margenEtaDias: 2, tiempoEntrePasosMin: 0 }),
  } as unknown as ProduccionService,
  capacidades,
);

beforeAll(async () => {
  await db.tenant.createMany({
    data: [tenantId, otroTenant].map((id) => ({
      id,
      nombre: 'Taller de prueba',
      slug: id,
    })),
  });
  await db.productoCategoriaComercial.create({
    data: {
      codigo,
      nombre: 'Prueba margen entrega',
      subcategorias: {
        create: {
          codigo,
          nombre: 'Prueba margen entrega',
          atributosSchemaJson: {},
        },
      },
    },
  });
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otroTenant] } } });
  await db.productoSubcategoriaComercial.deleteMany({ where: { codigo } });
  await db.productoCategoriaComercial.deleteMany({ where: { codigo } });
  await db.$disconnect();
});

it('persiste y revierte la exclusión conservando atributos; la ETA sólo lee productos de su empresa', async () => {
  const datos = {
    nombre: 'Producto inmediato',
    subcategoriaComercialCodigo: codigo,
    unidadComercial: UnidadComercialDto.unidad,
    modoMedidas: ModoMedidasDto.FIJA,
    dimensionesRequeridas: [],
    medidasPredefinidasJson: [],
    atributosComercialesJson: {
      referencia: 'Conservar',
      excluirMargenEntrega: true,
    },
  };
  const propio = await productos.crearProducto(tenantId, datos);
  const ajeno = await productos.crearProducto(otroTenant, datos);
  const contexto = await eta.contextoSimulacion(tenantId);
  expect(contexto.productosSinMargenEntrega).toEqual([propio.id]);
  expect(contexto.productosSinMargenEntrega).not.toContain(ajeno.id);
  expect(contexto.margenEtaDias).toBe(2);
  await productos.actualizarProducto(tenantId, propio.id, {
    expectedUpdatedAt: propio.updatedAt.toISOString(),
    atributosComercialesJson: {
      ...datos.atributosComercialesJson,
      excluirMargenEntrega: false,
    },
  });
  expect(
    (await db.producto.findUniqueOrThrow({ where: { id: propio.id } }))
      .atributosComercialesJson,
  ).toEqual({ referencia: 'Conservar', excluirMargenEntrega: false });
  expect(
    (await eta.contextoSimulacion(tenantId)).productosSinMargenEntrega,
  ).toEqual([]);
  await expect(
    productos.actualizarProducto(tenantId, propio.id, {
      atributosComercialesJson: { excluirMargenEntrega: 'sí' },
    }),
  ).rejects.toThrow('verdadera o falsa');
});
