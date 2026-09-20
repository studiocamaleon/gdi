import { randomUUID } from 'node:crypto';
import { PrismaClient, RolSistema, UnidadMateriaPrima } from '@prisma/client';
import { InventarioService } from '../inventario.service';
import type { CurrentAuth } from '../../auth/auth.types';

// Usa exclusivamente la base de pruebas fijada en jest-setup-db.
describe('Lecturas de inventario: ficha, stock e historial', () => {
  const prisma = new PrismaClient();
  const service = new InventarioService(prisma as never);
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const auth = {
    tenantId,
    userId: randomUUID(),
    role: RolSistema.ADMINISTRADOR,
  } as CurrentAuth;
  let materialId: string;
  let placaId: string;
  let tintaId: string;
  let sinStockId: string;
  let principal: string;
  let secundaria: string;
  let vacia: string;
  let almacenId: string;

  beforeAll(async () => {
    for (const id of [tenantId, otherTenantId]) {
      await prisma.tenant.create({
        data: {
          id,
          nombre: 'Inventario consultas test',
          slug: `stock-read-${id}`,
        },
      });
    }
    const material = await prisma.materiaPrima.create({
      data: {
        tenantId,
        codigo: 'TEST-STOCK',
        nombre: 'Material prueba stock',
        familia: 'SUSTRATO',
        subfamilia: 'SUSTRATO_RIGIDO',
        tipoTecnico: 'prueba',
        templateId: 'sustrato_rigido_v1',
        unidadStock: 'PLACA',
        unidadCompra: 'PLACA',
        atributosTecnicosJson: {},
      },
    });
    materialId = material.id;
    const makeVariant = (sku: string, unit: UnidadMateriaPrima) =>
      prisma.materiaPrimaVariante.create({
        data: {
          tenantId,
          materiaPrimaId: materialId,
          sku,
          nombreVariante: sku,
          atributosVarianteJson: {},
          unidadStock: unit,
          unidadCompra: unit,
          unidadUso: unit,
        },
      });
    placaId = (await makeVariant('PLACA', 'PLACA')).id;
    tintaId = (await makeVariant('TINTA', 'ML')).id;
    sinStockId = (await makeVariant('SIN-MOVIMIENTOS', 'UNIDAD')).id;
    const almacen = await service.createAlmacen(auth, {
      nombre: 'Principal',
      codigo: 'PRINCIPAL',
      activo: true,
    });
    almacenId = almacen.id;
    principal = (
      await prisma.almacenMateriaPrimaUbicacion.findFirstOrThrow({
        where: { almacenId },
      })
    ).id;
    secundaria = (
      await prisma.almacenMateriaPrimaUbicacion.create({
        data: { tenantId, almacenId, codigo: 'SEC', nombre: 'Secundaria' },
      })
    ).id;
    const otro = await service.createAlmacen(auth, {
      nombre: 'Vacío',
      codigo: 'VACIO',
      activo: true,
    });
    vacia = (
      await prisma.almacenMateriaPrimaUbicacion.findFirstOrThrow({
        where: { almacenId: otro.id },
      })
    ).id;
    for (const [varianteId, ubicacionId, cantidad, costoUnitario] of [
      [placaId, principal, 3, 10],
      [placaId, secundaria, 2, 20],
      [placaId, vacia, 1, 30],
      [tintaId, principal, 1000, 0.125],
    ] as const) {
      await service.registrarMovimiento(auth, {
        varianteId,
        ubicacionId,
        cantidad,
        costoUnitario,
        tipo: 'ingreso',
        origen: 'compra',
      } as never);
    }
    await service.registrarMovimiento(auth, {
      varianteId: placaId,
      ubicacionId: vacia,
      cantidad: 1,
      tipo: 'egreso',
      origen: 'otro',
    } as never);
  });
  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });
    await prisma.$disconnect();
  });

  it('deduplica depósitos, excluye saldo cero y conserva cada unidad persistida', async () => {
    const rows = await service.getResumenStockMaterial(auth, materialId);
    expect(rows.find((row) => row.varianteId === placaId)).toMatchObject({
      unidadStock: 'placa',
      stockTotal: 5,
      valorStock: 70,
      costoPromedio: 14,
      almacenesConStock: 1,
    });
    expect(rows.find((row) => row.varianteId === tintaId)).toMatchObject({
      unidadStock: 'ml',
      stockTotal: 1000,
      valorStock: 125,
      costoPromedio: 0.125,
      almacenesConStock: 1,
    });
    expect(rows.find((row) => row.varianteId === sinStockId)).toMatchObject({
      stockTotal: 0,
      almacenesConStock: 0,
      ultimoMovimiento: null,
    });
    const latest = await service.getKardex(auth, {
      varianteId: placaId,
      pageSize: 1,
    });
    expect(
      rows.find((row) => row.varianteId === placaId)?.ultimoMovimiento
        ?.movimientoId,
    ).toBe(latest.items[0].movimientoId);
  });

  it('pagina stock sin perder el filtro de material, depósito y ubicación', async () => {
    const first = await service.getStockPage(auth, {
      materiaPrimaId: materialId,
      almacenId,
      soloConStock: 'true',
      page: 1,
      pageSize: 1,
    });
    const second = await service.getStockPage(auth, {
      materiaPrimaId: materialId,
      almacenId,
      soloConStock: 'true',
      page: 2,
      pageSize: 1,
    });
    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    const selected = await service.getStockPage(auth, {
      varianteId: placaId,
      ubicacionId: secundaria,
    });
    expect(selected.total).toBe(1);
    expect(selected.items[0]).toMatchObject({
      ubicacionId: secundaria,
      cantidadDisponible: 2,
      unidadStock: 'placa',
    });
  });

  it('el historial contextual incluye transferencias con unidad y ubicación correctas', async () => {
    const transfer = await service.registrarTransferencia(auth, {
      varianteId: placaId,
      ubicacionOrigenId: secundaria,
      ubicacionDestinoId: principal,
      cantidad: 1,
    });
    const response = await service.getKardex(auth, {
      materiaPrimaId: materialId,
      varianteId: placaId,
      almacenId,
      ubicacionId: secundaria,
      pageSize: 1,
    });
    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      movimientoId: transfer.salida.movimientoId,
      ubicacionId: secundaria,
      almacenId,
      unidadStock: 'placa',
      cantidad: 1,
      saldoPosterior: 1,
    });
    const stock = await service.getStockActual(auth, { varianteId: placaId });
    expect(
      stock.find((row) => row.ubicacionId === principal)?.cantidadDisponible,
    ).toBe(4);
  });

  it('no permite leer resúmenes, saldos ni movimientos de otra empresa', async () => {
    const otherAuth = { ...auth, tenantId: otherTenantId };
    await expect(
      service.getResumenStockMaterial(otherAuth, materialId),
    ).rejects.toThrow('No existe');
    expect(
      (await service.getStockPage(otherAuth, { materiaPrimaId: materialId }))
        .total,
    ).toBe(0);
    expect(
      (await service.getKardex(otherAuth, { materiaPrimaId: materialId }))
        .total,
    ).toBe(0);
  });
});
