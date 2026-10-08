import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosService } from '../productos.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { productoParaCotizacion } from '../producto-cotizacion-publico';

describe('Frecuencia por producto y empresa (PostgreSQL)', () => {
  const db = new PrismaService();
  const tenants = [randomUUID(), randomUUID()];
  const categoriaId = randomUUID();
  const subcategoriaId = randomUUID();
  const ids: string[] = [];
  const cotizaciones: string[] = [];
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !url.pathname.endsWith('_test') ||
      !['localhost', '127.0.0.1'].includes(url.hostname)
    )
      throw new Error('Sólo base local de pruebas');
    await db.tenant.createMany({
      data: tenants.map((id) => ({
        id,
        slug: `uso-${id}`,
        nombre: 'Empresa ficticia',
      })),
    });
    await db.productoCategoriaComercial.create({
      data: {
        id: categoriaId,
        codigo: `uso-${categoriaId}`,
        nombre: 'Pruebas',
      },
    });
    await db.productoSubcategoriaComercial.create({
      data: {
        id: subcategoriaId,
        categoriaId,
        codigo: `uso-${subcategoriaId}`,
        nombre: 'Pruebas',
        atributosSchemaJson: [],
      },
    });
    for (const tenantId of tenants) {
      const c = await db.cotizacion.create({ data: { tenantId } });
      cotizaciones.push(c.id);
      for (const codigo of ['BLANCO', 'AZUL']) {
        const p = await db.producto.create({
          data: {
            tenantId,
            subcategoriaComercialId: subcategoriaId,
            codigo,
            nombre: `Vinilo ${codigo}`,
          },
        });
        ids.push(p.id);
      }
    }
  });
  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenants } } });
    await db.productoSubcategoriaComercial.deleteMany({
      where: { id: subcategoriaId },
    });
    await db.productoCategoriaComercial.deleteMany({
      where: { id: categoriaId },
    });
    await db.$disconnect();
  });
  async function agregar(
    tenant: number,
    productoId: string,
    estado: string,
    repeticiones = 1,
    hijo = false,
  ) {
    const tenantId = tenants[tenant];
    const orden = await db.ordenTrabajo.create({
      data: { tenantId, numero: `OT-${randomUUID()}`, estado },
    });
    const cotizacionItem = await db.cotizacionItem.create({
      data: {
        tenantId,
        cotizacionId: cotizaciones[tenant],
        productoId,
        cantidad: 1,
        jobContextJson: {},
        snapshotJson: {},
      },
    });
    const datos = {
      tenantId,
      ordenId: orden.id,
      codigo: 'PRODUCTO',
      nombre: 'Producto ficticio',
      familia: 'Prueba',
      cantidad: 10000,
      cantidadUnidad: 'unidad',
      subtotal: 100,
      impuestos: 21,
      total: 121,
    };
    const padre = hijo
      ? await db.ordenTrabajoItem.create({ data: datos })
      : null;
    for (let i = 0; i < repeticiones; i++)
      await db.ordenTrabajoItem.create({
        data: {
          ...datos,
          cotizacionItemId: cotizacionItem.id,
          parentItemId: padre?.id,
        },
      });
  }
  it('cuenta órdenes distintas, no unidades ni repeticiones, y excluye borradores, canceladas, hijos y otro tenant', async () => {
    await agregar(0, ids[0], 'pendiente', 3);
    await agregar(0, ids[0], 'produccion');
    await agregar(0, ids[0], 'finalizada');
    await agregar(0, ids[0], 'entregada');
    await agregar(0, ids[1], 'finalizada');
    await agregar(0, ids[1], 'borrador');
    await agregar(0, ids[1], 'cancelada');
    await agregar(0, ids[1], 'pendiente', 1, true);
    await agregar(1, ids[3], 'entregada', 5);
    const service = Object.assign(Object.create(ProductosService.prototype), {
      prisma: db,
    }) as ProductosService;
    const r = await service.listarProductos(tenants[0], {
      pagination: new PaginationDto(),
    });
    expect(r.data.find((p) => p.id === ids[0])?.usosEnOrdenes).toBe(4);
    expect(r.data.find((p) => p.id === ids[1])?.usosEnOrdenes).toBe(1);
    expect(r.data).toHaveLength(2);
    const publico = productoParaCotizacion(r.data) as Array<{
      id: string;
      usosEnOrdenes: number;
    }>;
    expect(publico.find((p) => p.id === ids[0])?.usosEnOrdenes).toBe(4);
  });
});
