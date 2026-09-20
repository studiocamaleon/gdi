import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InventarioService } from '../../inventario/inventario.service';
import { ReservasMaterialService } from '../../inventario/reservas-material.service';
import { ComprasService } from '../../compras/compras.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CrearOrdenTrabajoDto } from '../dto/crear-orden-trabajo.dto';

// Emisión real (create/cambiarEstado), stock y compras en la DB aislada.
// Sólo se sustituyen servicios externos y el enriquecimiento de la respuesta.
describe('Emisión OT → reservas y necesidades de compras', () => {
  const db = new PrismaService();
  const inventario = new InventarioService(db);
  const reservas = new ReservasMaterialService(db, inventario);
  const compras = new ComprasService(db, inventario, reservas);
  const ordenes = new OrdenesTrabajoService(
    db,
    { capturarEmision: jest.fn(), sincronizarAsignaciones: jest.fn() } as never,
    {} as never,
    { sincronizar: jest.fn() } as never,
    { emitir: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    { asegurarParaItem: jest.fn() } as never,
    {
      simular: jest.fn().mockResolvedValue({
        maximoCanjeable: 0,
        canjeMonto: 0,
        canjePuntos: 0,
      }),
      reconciliarOrden: jest.fn(),
    } as never,
    {} as never,
    undefined,
    reservas,
  );
  let auth: CurrentAuth,
    categoriaId: string,
    varianteId: string,
    ubicacionId: string,
    payload: CrearOrdenTrabajoDto;
  jest.spyOn(ordenes, 'findOne').mockImplementation(
    async (a, id) =>
      (await db.ordenTrabajo.findFirstOrThrow({
        where: { id, tenantId: a.tenantId },
      })) as never,
  );

  beforeEach(async () => {
    const tenantId = randomUUID(),
      userId = randomUUID();
    auth = {
      tenantId,
      userId,
      email: `${userId}@test.invalid`,
      role: 'ADMINISTRADOR',
    } as CurrentAuth;
    await db.user.create({ data: { id: userId, email: auth.email } });
    await db.tenant.create({
      data: { id: tenantId, slug: `auto-${tenantId}`, nombre: 'Emisión test' },
    });
    const cliente = await db.cliente.create({
      data: {
        tenantId,
        nombre: 'Cliente test',
        telefonoCodigo: '+54',
        telefonoNumero: '',
        paisCodigo: 'AR',
      },
    });
    const categoria = await db.productoCategoriaComercial.create({
      data: { codigo: tenantId, nombre: 'Test' },
    });
    categoriaId = categoria.id;
    const sub = await db.productoSubcategoriaComercial.create({
      data: {
        categoriaId,
        codigo: tenantId,
        nombre: 'Test',
        atributosSchemaJson: {},
      },
    });
    const producto = await db.producto.create({
      data: {
        tenantId,
        subcategoriaComercialId: sub.id,
        codigo: 'DOC',
        nombre: 'Documento',
      },
    });
    const m = await db.materiaPrima.create({
      data: {
        tenantId,
        codigo: 'PAPEL',
        nombre: 'Papel',
        familia: 'SUSTRATO',
        subfamilia: 'SUSTRATO_RIGIDO',
        tipoTecnico: 'test',
        templateId: 'test',
        unidadStock: 'HOJA',
        unidadCompra: 'HOJA',
        atributosTecnicosJson: {},
      },
    });
    varianteId = (
      await db.materiaPrimaVariante.create({
        data: {
          tenantId,
          materiaPrimaId: m.id,
          sku: 'A4',
          atributosVarianteJson: {},
          unidadStock: 'HOJA',
          unidadCompra: 'HOJA',
        },
      })
    ).id;
    const almacen = await inventario.createAlmacen(auth, {
      nombre: 'Depósito',
      codigo: 'D',
      activo: true,
    });
    ubicacionId = (
      await db.almacenMateriaPrimaUbicacion.findFirstOrThrow({
        where: { tenantId, almacenId: almacen.id },
      })
    ).id;
    await inventario.registrarMovimiento(auth, {
      varianteId,
      ubicacionId,
      tipo: 'ingreso',
      origen: 'compra',
      cantidad: 10,
      costoUnitario: 2,
    } as never);
    await reservas.guardarPolitica(tenantId, {
      habilitada: true,
      incluirConsumibles: false,
      modo: 'AL_EMITIR',
      version: 0,
    });
    const cotizacion = await db.cotizacion.create({ data: { tenantId } });
    const item = await db.cotizacionItem.create({
      data: {
        tenantId,
        cotizacionId: cotizacion.id,
        productoId: producto.id,
        cantidad: 1,
        jobContextJson: {},
        snapshotJson: {},
        precioNetoTotal: 100,
        impuestosPorFueraTotal: 0,
        precioTotal: 100,
        trazabilidadJson: {
          pasos: [
            {
              activado: true,
              rutaPasoId: 'impresion',
              nombre: 'Impresión',
              familiaCodigo: 'IMPRESION',
              materiales: [
                {
                  materialVarianteId: varianteId,
                  materialDisplayName: 'Papel A4',
                  tipoLineaCosto: 'MATERIAL',
                  cantidad: 15,
                  unidad: 'hoja',
                  contextoUnidadesSnapshot: {
                    unidadStock: 'HOJA',
                    unidadCompra: 'HOJA',
                  },
                },
              ],
            },
          ],
        },
      },
    });
    payload = {
      idempotencyKey: randomUUID(),
      estado: 'pendiente',
      canalVenta: 'mostrador',
      clienteId: cliente.id,
      fechaEntrega: '2099-12-31',
      items: [
        {
          cotizacionItemId: item.id,
          codigo: 'DOC',
          nombre: 'Documento',
          familia: 'Documentos',
          cantidad: 1,
          cantidadUnidad: 'u.',
          subtotal: 100,
          impuestos: 0,
          total: 100,
        },
      ],
    };
  });
  afterEach(async () => {
    // Restrict en necesidades/reservas: respetar el orden de borrado de la fixture.
    const tenantId = auth.tenantId;
    await db.reservaMaterialOt.deleteMany({ where: { tenantId } });
    await db.necesidadMaterialOt.deleteMany({ where: { tenantId } });
    await db.operacionReservasMaterial.deleteMany({ where: { tenantId } });
    await db.tenant.delete({ where: { id: tenantId } });
    await db.user.delete({ where: { id: auth.userId } });
    await db.productoSubcategoriaComercial.deleteMany({
      where: { categoriaId },
    });
    await db.productoCategoriaComercial.delete({ where: { id: categoriaId } });
  });
  afterAll(() => db.$disconnect());

  it('crear y emitir reserva sin comando manual y publica sólo 5 hojas pendientes en compras', async () => {
    const o = await ordenes.create(auth, payload);
    expect(o).toMatchObject({
      estado: 'pendiente',
      materialesControlados: true,
    });
    const necesidades = await compras.necesidades(auth);
    expect(necesidades.data).toHaveLength(1);
    expect(Number(necesidades.data[0].reservada)).toBe(10);
    expect(Number(necesidades.data[0].porCubrir)).toBe(5);
    expect(
      (await reservas.consultar(auth.tenantId, o.id)).control.materiales[0]
        .fisico,
    ).toBe(10);
    const retry = await ordenes.create(auth, payload);
    expect(retry.id).toBe(o.id);
    expect(
      await db.operacionReservasMaterial.count({
        where: { tenantId: auth.tenantId, accion: 'emision' },
      }),
    ).toBe(1);
  });
  it('guardar borrador no compromete; emitirlo luego hace la misma reserva automática', async () => {
    const o = await ordenes.create(auth, { ...payload, estado: 'borrador' });
    expect(o.materialesControlados).toBe(false);
    expect((await compras.necesidades(auth)).total).toBe(0);
    await ordenes.cambiarEstado(auth, o.id, { estado: 'pendiente' });
    expect(
      (await reservas.consultar(auth.tenantId, o.id)).control.materiales[0],
    ).toMatchObject({ reservada: 10, faltante: 5 });
    expect((await compras.necesidades(auth)).total).toBe(1);
  });
  it('modo manual también incorpora necesidades desde emisión, sin apartar stock', async () => {
    await reservas.guardarPolitica(auth.tenantId, {
      habilitada: true,
      incluirConsumibles: false,
      modo: 'MANUAL',
      version: 1,
    });
    const o = await ordenes.create(auth, payload);
    expect(
      (await reservas.consultar(auth.tenantId, o.id)).control.materiales[0]
        .reservada,
    ).toBe(0);
    expect((await compras.necesidades(auth)).total).toBe(1);
  });
  it('sin control de inventario se puede emitir normalmente, sin demanda persistida ni reservas', async () => {
    await reservas.guardarPolitica(auth.tenantId, {
      habilitada: false,
      incluirConsumibles: false,
      version: 1,
    });
    const o = await ordenes.create(auth, payload);
    expect(o).toMatchObject({
      estado: 'pendiente',
      materialesControlados: false,
    });
    expect((await compras.necesidades(auth)).total).toBe(0);
  });
});
