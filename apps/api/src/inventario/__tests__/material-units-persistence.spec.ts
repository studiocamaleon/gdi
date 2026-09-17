import { randomUUID } from 'node:crypto';
import { PrismaClient, RolSistema } from '@prisma/client';
import { InventarioService } from '../inventario.service';
import { normalizedMaterialPrice } from '../material-units';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import type { UpsertMateriaPrimaDto } from '../dto/upsert-materia-prima.dto';
import type { CurrentAuth } from '../../auth/auth.types';

// jest-setup-db fija la base dedicada de tests antes de crear Prisma.
describe('Persistencia de compra y uso', () => {
  const prisma = new PrismaClient();
  const service = new InventarioService(prisma as never);
  const tenantId = randomUUID();
  const auth = {
    tenantId,
    userId: randomUUID(),
    sessionId: randomUUID(),
    membershipId: randomUUID(),
    role: RolSistema.ADMINISTRADOR,
    email: 'units@test.local',
  } as CurrentAuth;
  let materialId: string;
  let variantId: string;
  const payload = {
    codigo: 'TEST-CAJA',
    nombre: 'Ojales de prueba',
    familia: 'herraje_accesorio',
    subfamilia: 'ojal_ojalillo_remache',
    tipoTecnico: 'ojal',
    templateId: 'ojal_v1',
    unidadStock: 'unidad',
    unidadCompra: 'caja',
    esConsumible: false,
    esRepuesto: false,
    activo: true,
    atributosTecnicos: {},
    variantes: [
      {
        sku: 'TEST-CAJA-100',
        activo: true,
        atributosVariante: { diametro: 10 },
        unidadPrecio: 'caja',
        equivalenciaCompra: 100,
        precioReferencia: 12000.123456,
      },
    ],
  } as UpsertMateriaPrimaDto;

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        nombre: 'Prueba equivalencias',
        slug: `test-units-${tenantId}`,
      },
    });
  });
  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('guarda y devuelve unidad del precio, contenido y seis decimales', async () => {
    const result = await service.createMateriaPrima(auth, payload);
    materialId = result.id;
    variantId = result.variantes[0].id;
    expect(result.variantes[0]).toMatchObject({
      unidadPrecio: 'caja',
      equivalenciaCompra: 100,
      precioReferencia: 12000.123456,
    });
    const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: variantId },
      include: { materiaPrima: true },
    });
    expect(normalizedMaterialPrice(record)).toBeCloseTo(120.00123456, 8);
  });

  it('el motor lee el mismo costo por uso que inventario', async () => {
    const motor = Object.create(MotorUniversalService.prototype) as {
      prisma: PrismaClient;
      cargarVariantePorId: (
        tenant: string,
        id: string,
      ) => Promise<{ precioReferencia: number }>;
    };
    motor.prisma = prisma;
    expect(
      (await motor.cargarVariantePorId(tenantId, variantId)).precioReferencia,
    ).toBeCloseTo(120.00123456, 8);
  });

  it('la ficha conserva overrides de variantes y equivalencias al editar', async () => {
    const result = await service.updateMateriaPrima(auth, materialId, {
      ...payload,
      unidadStock: 'm2' as never,
      variantes: [
        {
          ...payload.variantes[0],
          unidadStock: 'unidad' as never,
          unidadCompra: 'caja' as never,
        },
      ],
    });
    expect(result.variantes[0]).toMatchObject({
      unidadStock: 'unidad',
      unidadCompra: 'caja',
      unidadPrecio: 'caja',
      equivalenciaCompra: 100,
    });
  });

  it('el editor masivo actualiza contenido y costo sin redondear a centavos', async () => {
    await service.bulkUpdateCostos(auth, {
      variantes: [
        {
          id: variantId,
          equivalenciaCompra: 250,
          precioReferencia: 30000.123456,
          unidadPrecio: 'caja' as never,
        },
      ],
    });
    const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: variantId },
      include: { materiaPrima: true },
    });
    expect(Number(record.equivalenciaCompra)).toBe(250);
    expect(Number(record.precioReferencia)).toBe(30000.123456);
    expect(normalizedMaterialPrice(record)).toBeCloseTo(120.000493824, 9);
  });

  it('rechaza una contradicción sin escribir el precio ni la unidad', async () => {
    await expect(
      service.bulkUpdateCostos(auth, {
        variantes: [
          {
            id: variantId,
            unidadCompra: 'litro' as never,
            unidadStock: 'ml' as never,
            equivalenciaCompra: 900,
            precioReferencia: 1,
          },
        ],
      }),
    ).rejects.toThrow('contradice');
    const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(Number(record.precioReferencia)).toBe(30000.123456);
    expect(record.unidadCompra).toBe('CAJA');
  });

  it('no adivina la unidad del precio pendiente de confirmar', async () => {
    await service.bulkUpdateCostos(auth, {
      variantes: [{ id: variantId, unidadPrecio: null }],
    });
    const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: variantId },
      include: { materiaPrima: true },
    });
    expect(Number(record.precioReferencia)).toBe(30000.123456);
    expect(normalizedMaterialPrice(record)).toBeNull();
  });

  it('conserva seis decimales también al actualizar un precio individual', async () => {
    await service.updateVariantePrecioReferencia(auth, variantId, {
      precioReferencia: 30000.123456,
    });
    const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(Number(record.precioReferencia)).toBe(30000.123456);
    expect(record.unidadPrecio).toBeNull();
  });

  it('permite un costo explícito de ingreso aunque el precio de referencia sea ambiguo', async () => {
    const almacen = await prisma.almacenMateriaPrima.create({
      data: { tenantId, codigo: 'EXPLICITO', nombre: 'Prueba costo explícito' },
    });
    const ubicacion = await prisma.almacenMateriaPrimaUbicacion.create({
      data: {
        tenantId,
        almacenId: almacen.id,
        codigo: 'EXPLICITO',
        nombre: 'Prueba',
      },
    });
    const movimiento = {
      varianteId: variantId,
      ubicacionId: ubicacion.id,
      tipo: 'ingreso' as never,
      origen: 'compra' as never,
      cantidad: 1,
    };
    await expect(service.registrarMovimiento(auth, movimiento)).rejects.toThrow(
      'Confirmá la unidad',
    );
    await service.registrarMovimiento(auth, {
      ...movimiento,
      costoUnitario: 120,
    });
    const stock = await prisma.stockMateriaPrimaVariante.findFirstOrThrow({
      where: { tenantId, varianteId: variantId, ubicacionId: ubicacion.id },
    });
    expect(Number(stock.cantidadDisponible)).toBe(1);
    expect(Number(stock.costoPromedio)).toBe(120);
  });

  it('bloquea cambios de unidad de uso cuando existen movimientos', async () => {
    await service.bulkUpdateCostos(auth, {
      variantes: [{ id: variantId, unidadPrecio: 'caja' as never }],
    });
    const almacen = await prisma.almacenMateriaPrima.create({
      data: { tenantId, codigo: 'TEST', nombre: 'Prueba' },
    });
    const ubicacion = await prisma.almacenMateriaPrimaUbicacion.create({
      data: {
        tenantId,
        almacenId: almacen.id,
        codigo: 'TEST',
        nombre: 'Prueba',
      },
    });
    await service.registrarMovimiento(auth, {
      varianteId: variantId,
      ubicacionId: ubicacion.id,
      tipo: 'ingreso' as never,
      origen: 'compra' as never,
      cantidad: 100,
    });
    await expect(
      service.bulkUpdateCostos(auth, {
        materiales: [{ id: materialId, unidadStock: 'kg' as never }],
      }),
    ).rejects.toThrow('stock o movimientos');
    await expect(
      service.updateMateriaPrima(auth, materialId, {
        ...payload,
        variantes: [{ ...payload.variantes[0], unidadStock: 'kg' as never }],
      }),
    ).rejects.toThrow('stock o movimientos');
    const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(record.unidadStock).toBe('UNIDAD');
    expect(
      Number(
        (
          await prisma.stockMateriaPrimaVariante.findFirstOrThrow({
            where: {
              tenantId,
              varianteId: variantId,
              ubicacionId: ubicacion.id,
            },
          })
        ).cantidadDisponible,
      ),
    ).toBe(100);
  });
});
