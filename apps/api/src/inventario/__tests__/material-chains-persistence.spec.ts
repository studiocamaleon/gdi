import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { randomUUID } from 'node:crypto';
import { PrismaClient, RolSistema } from '@prisma/client';
import { InventarioService } from '../inventario.service';
import {
  materialPriceContext,
  materialPriceInStockUnit,
  normalizedMaterialPrice,
} from '../material-units';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import {
  monedaCotizacionContext,
  precioMaterialEnMonedaCotizacion,
} from '../../cotizaciones/material-moneda-context';
import type { UpsertMateriaPrimaDto } from '../dto/upsert-materia-prima.dto';
import type { CurrentAuth } from '../../auth/auth.types';
import type { TipoCambioSnapshot } from '../../cotizaciones/tipo-cambio.types';

// jest-setup-db fuerza la base dedicada de pruebas.
describe('Compra → stock → consumo con trazabilidad', () => {
  const prisma = new PrismaClient();
  const service = new InventarioService(prisma as never, undefined, capacidadesDePrueba());
  const tenantId = randomUUID();
  const auth = {
    tenantId,
    userId: randomUUID(),
    role: RolSistema.ADMINISTRADOR,
  } as CurrentAuth;
  let ubicacionId: string;
  let destinoId: string;
  const create = (
    codigo: string,
    units: Partial<UpsertMateriaPrimaDto>,
    variante: UpsertMateriaPrimaDto['variantes'][number],
  ) =>
    service.createMateriaPrima(auth, {
      codigo,
      nombre: codigo,
      familia: 'herraje_accesorio',
      subfamilia: 'ojal_ojalillo_remache',
      tipoTecnico: 'ojal',
      templateId: 'ojal_v1',
      unidadCompra: 'pallet',
      unidadStock: 'caja',
      unidadUso: 'unidad',
      esConsumible: false,
      esRepuesto: false,
      activo: true,
      atributosTecnicos: {},
      ...units,
      variantes: [variante],
    } as UpsertMateriaPrimaDto);
  const variant = (suffix: string) =>
    ({
      sku: suffix,
      activo: true,
      atributosVariante: {},
      precioReferencia: 500,
      moneda: 'ARS',
      unidadPrecio: 'pallet',
      equivalencias: [
        { origen: 'pallet', destino: 'caja', factor: 10 },
        { origen: 'caja', destino: 'unidad', factor: 10 },
      ],
    }) as UpsertMateriaPrimaDto['variantes'][number];
  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        nombre: 'Prueba cadenas',
        slug: `chains-${tenantId}`,
      },
    });
    const almacen = await prisma.almacenMateriaPrima.create({
      data: { tenantId, codigo: 'CHAIN', nombre: 'Prueba' },
    });
    for (const codigo of ['ORIGEN', 'DESTINO']) {
      const u = await prisma.almacenMateriaPrimaUbicacion.create({
        data: { tenantId, almacenId: almacen.id, codigo, nombre: codigo },
      });
      if (codigo === 'ORIGEN') ubicacionId = u.id;
      else destinoId = u.id;
    }
  });
  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('guarda botellas, ingresa envases y consume su contenido en ml', async () => {
    const material = await create(
      'BOTELLA',
      {
        unidadCompra: 'botella',
        unidadStock: 'botella',
        unidadUso: 'ml',
      } as never,
      {
        sku: 'BOTELLA-750',
        activo: true,
        atributosVariante: {},
        precioReferencia: 15000,
        moneda: 'ARS',
        unidadPrecio: 'botella',
        equivalencias: [{ origen: 'botella', destino: 'ml', factor: 750 }],
      } as never,
    );
    expect(material).toMatchObject({
      unidadCompra: 'botella',
      unidadStock: 'botella',
      unidadUso: 'ml',
    });
    const varianteId = material.variantes[0].id;
    const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: varianteId },
      include: { materiaPrima: true },
    });
    expect(record.unidadPrecio).toBe('BOTELLA');
    expect(normalizedMaterialPrice(record)).toBe(20);
    const motor = Object.create(MotorUniversalService.prototype) as any;
    motor.prisma = prisma;
    expect(await motor.cargarVariantePorId(tenantId, varianteId)).toMatchObject(
      { unidadStock: 'ML', precioReferencia: 20 },
    );
    expect(
      await service.registrarMovimiento(auth, {
        varianteId,
        ubicacionId,
        tipo: 'ingreso',
        origen: 'compra',
        cantidad: 2,
        unidad: 'botella',
      } as never),
    ).toMatchObject({ cantidad: 2, saldoPosterior: 2, costoUnitario: 15000 });
    expect(
      await service.registrarMovimiento(auth, {
        varianteId,
        ubicacionId,
        tipo: 'egreso',
        origen: 'consumo_produccion',
        cantidad: 375,
        unidad: 'ml',
      } as never),
    ).toMatchObject({
      cantidad: 0.5,
      saldoPosterior: 1.5,
      costoPromedioPost: 15000,
    });
  });

  it('ingresa pallets, consume unidades y transfiere cajas sin perder valor ni decimales', async () => {
    const material = await create('PALLET', {}, variant('PALLET'));
    const varianteId = material.variantes[0].id;
    expect(material).toMatchObject({
      unidadStock: 'caja',
      unidadUso: 'unidad',
      unidadCompra: 'pallet',
    });
    const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: varianteId },
      include: { materiaPrima: true },
    });
    expect(normalizedMaterialPrice(record)).toBe(5);
    expect(materialPriceInStockUnit(materialPriceContext(record), 500)).toEqual(
      { ok: true, precio: 50 },
    );
    const motor = Object.create(MotorUniversalService.prototype) as any;
    motor.prisma = prisma;
    expect(await motor.cargarVariantePorId(tenantId, varianteId)).toMatchObject(
      {
        unidadStock: 'UNIDAD',
        precioReferencia: 5,
        contextoUnidades: { unidadStock: 'CAJA', unidadUso: 'UNIDAD' },
      },
    );
    const ingreso = await service.registrarMovimiento(auth, {
      varianteId,
      ubicacionId,
      tipo: 'ingreso',
      origen: 'compra',
      cantidad: 2,
      unidad: 'pallet',
    } as never);
    expect(ingreso).toMatchObject({
      cantidad: 20,
      saldoPosterior: 20,
      costoUnitario: 50,
      costoPromedioPost: 50,
      conversionSnapshot: {
        cantidadOriginal: 2,
        unidadOriginal: 'pallet',
        factor: 10,
      },
    });
    const salida = await service.registrarMovimiento(auth, {
      varianteId,
      ubicacionId,
      tipo: 'egreso',
      origen: 'consumo_produccion',
      cantidad: 3,
      unidad: 'unidad',
    } as never);
    expect(salida).toMatchObject({
      cantidad: 0.3,
      saldoPosterior: 19.7,
      costoPromedioPost: 50,
    });
    await service.registrarTransferencia(auth, {
      varianteId,
      ubicacionOrigenId: ubicacionId,
      ubicacionDestinoId: destinoId,
      cantidad: 0.00000001,
    });
    const stock = await service.getStockActual(auth, {} as never);
    expect(
      stock.find(
        (s) => s.varianteId === varianteId && s.ubicacionId === ubicacionId,
      )?.cantidadDisponible,
    ).toBe(19.69999999);
    expect(
      stock.find(
        (s) => s.varianteId === varianteId && s.ubicacionId === destinoId,
      )?.cantidadDisponible,
    ).toBe(0.00000001);
    await expect(
      service.registrarMovimiento(auth, {
        varianteId,
        ubicacionId,
        tipo: 'egreso',
        origen: 'otro',
        cantidad: 1000,
        unidad: 'unidad',
      } as never),
    ).rejects.toThrow('insuficiente');
    await service.bulkUpdateCostos(auth, {
      materiales: [{ id: material.id, unidadUso: 'caja' as never }],
    });
    await expect(
      service.bulkUpdateCostos(auth, {
        materiales: [{ id: material.id, unidadStock: 'unidad' as never }],
      }),
    ).rejects.toThrow('stock o movimientos');
    await service.bulkUpdateCostos(auth, {
      variantes: [
        {
          id: varianteId,
          equivalencias: [
            { origen: 'pallet', destino: 'caja', factor: 12 },
            { origen: 'caja', destino: 'unidad', factor: 10 },
          ] as never,
        },
      ],
    });
    const kardex = await service.getKardex(auth, { varianteId } as never);
    expect(
      kardex.items.find((m) => m.movimientoId === ingreso.movimientoId)
        ?.conversionSnapshot,
    ).toMatchObject({ factor: 10 });
  });

  it('compara candidatos en una misma unidad aunque declaren consumos diferentes', async () => {
    const barato = await create(
      'CAJA-BARATA',
      { unidadUso: 'caja' } as never,
      variant('CAJA-BARATA'),
    );
    const caro = await create(
      'UNIDAD-CARA',
      {},
      { ...variant('UNIDAD-CARA'), precioReferencia: 600 },
    );
    const motor = Object.create(MotorUniversalService.prototype) as any;
    motor.prisma = prisma;
    const result = await motor.resolverMaterialSlot(
      tenantId,
      {
        modoSeleccion: 'MOTOR_ELIGE_AUTO',
        criterioMotorAuto: 'MENOR_COSTO',
        formula: 'fijo',
        candidatos: [
          {
            variantes: [
              { varianteId: barato.variantes[0].id },
              { varianteId: caro.variantes[0].id },
            ],
          },
        ],
      },
      {},
    );
    expect(result.id).toBe(barato.variantes[0].id);
  });

  it('dos ingresos simultáneos conservan ambas cantidades y su costo por caja', async () => {
    const material = await create('CONCURRENTE', {}, variant('CONCURRENTE'));
    const varianteId = material.variantes[0].id;
    await Promise.all(
      [1, 2].map((cantidad) =>
        service.registrarMovimiento(auth, {
          varianteId,
          ubicacionId,
          tipo: 'ingreso',
          origen: 'compra',
          cantidad,
          unidad: 'pallet',
          costoUnitario: 700,
        } as never),
      ),
    );
    const stock = await service.getStockActual(auth, { varianteId } as never);
    expect(stock[0]).toMatchObject({
      cantidadDisponible: 30,
      costoPromedio: 70,
      valorStock: 2100,
    });
  });

  it.each(['hoja', 'placa'])(
    'respeta kilos y %s realmente recibidos sin modificar el coeficiente del material',
    async (unidadStock) => {
      const material = await create(
        `PAI-${unidadStock}`,
        {
          unidadCompra: 'kg',
          unidadStock,
          unidadUso: 'm2',
          templateId: 'sustrato_rigido_v1',
        } as never,
        {
          ...variant(`PAI-${unidadStock}`),
          precioReferencia: 4,
          unidadPrecio: 'kg',
          atributosVariante: { ancho: 1, alto: 2 },
          equivalencias: [{ origen: unidadStock, destino: 'kg', factor: 2.5 }],
        } as never,
      );
      expect(material.unidadStock).toBe(unidadStock);
      const varianteId = material.variantes[0].id;
      const nominal = await service.registrarMovimiento(auth, {
        varianteId,
        ubicacionId,
        tipo: 'ingreso',
        origen: 'compra',
        cantidad: 25,
        unidad: 'kg',
      } as never);
      expect(nominal).toMatchObject({
        cantidad: 10,
        costoUnitario: 10,
        costoPromedioPost: 10,
      });
      const real = await service.registrarMovimiento(auth, {
        varianteId,
        ubicacionId,
        tipo: 'ingreso',
        origen: 'compra',
        cantidad: 24,
        unidad: 'kg',
        cantidadStock: 12,
      } as never);
      expect(real).toMatchObject({
        cantidad: 12,
        costoUnitario: 8,
        saldoPosterior: 22,
        costoPromedioPost: 8.909091,
        conversionSnapshot: { origen: 'recepcion_real', factor: 0.5 },
      });
      const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
        where: { id: varianteId },
        include: { materiaPrima: true },
      });
      expect(record.equivalenciasJson).toEqual([
        { origen: unidadStock, destino: 'kg', factor: 2.5 },
      ]);
      expect(normalizedMaterialPrice(record)).toBe(5);
      const salida = await service.registrarMovimiento(auth, {
        varianteId,
        ubicacionId,
        tipo: 'egreso',
        origen: 'consumo_produccion',
        cantidad: 1.2,
        unidad: 'm2',
      } as never);
      expect(salida).toMatchObject({ cantidad: 0.6, saldoPosterior: 21.4 });
      await expect(
        service.registrarMovimiento(auth, {
          varianteId,
          ubicacionId,
          tipo: 'egreso',
          origen: 'otro',
          cantidad: 1,
          unidad: 'kg',
          cantidadStock: 1,
        } as never),
      ).rejects.toThrow('sólo');
      // Cambiar sólo el nombre hoja/placa conserva existencias e históricos.
      await service.bulkUpdateCostos(auth, {
        materiales: [
          {
            id: material.id,
            unidadStock: (unidadStock === 'hoja' ? 'placa' : 'hoja') as never,
          },
        ],
      });
      const stock = await service.getStockActual(auth, { varianteId } as never);
      expect(stock[0]).toMatchObject({
        cantidadDisponible: 21.4,
        costoPromedio: 8.909091,
      });
      const kardex = await service.getKardex(auth, { varianteId } as never);
      expect(
        kardex.items.find((m) => m.movimientoId === nominal.movimientoId)
          ?.conversionSnapshot,
      ).toMatchObject({ unidadStock, factor: 0.4 });
    },
  );

  it('congela la cadena junto al dólar y no multiplica dos veces al cargar el costo', async () => {
    const material = await create(
      'USD',
      {},
      { ...variant('USD'), moneda: 'USD' },
    );
    const record = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: material.variantes[0].id },
      include: { materiaPrima: true },
    });
    const cambio = { monedaDestino: 'ARS', tasa: 1500 } as TipoCambioSnapshot;
    const materiales = new Map();
    monedaCotizacionContext.run({ tenantId, cambio, materiales }, () => {
      expect(precioMaterialEnMonedaCotizacion(record)).toBe(7500);
      expect(precioMaterialEnMonedaCotizacion(record)).toBe(7500);
    });
    expect(materiales.get(record.id)).toMatchObject({
      unidadUso: 'UNIDAD',
      unidadStock: 'CAJA',
      factorCambio: 1500,
      precioOriginal: 500,
      precioPorUnidadUsoOrigen: 5,
      conversionPrecio: { ok: true, factor: 100 },
    });
    const conCambio = new InventarioService(prisma as never, { resolver: jest.fn().mockResolvedValue(cambio) } as never, capacidadesDePrueba());
    const ingresoUSD = await conCambio.registrarMovimiento(auth, {
      varianteId: record.id,
      ubicacionId,
      tipo: 'ingreso',
      origen: 'compra',
      cantidad: 2,
      unidad: 'pallet',
    } as never);
    expect(ingresoUSD).toMatchObject({
      cantidad: 20,
      costoUnitario: 75000,
      costoPromedioPost: 75000,
      conversionSnapshot: {
        costoOriginal: 500,
        monedaCostoOriginal: 'USD',
        tipoCambio: { tasa: 1500 },
      },
    });
    await service.bulkUpdateCostos(auth, {
      variantes: [
        {
          id: record.id,
          equivalencias: [
            { origen: 'pallet', destino: 'caja', factor: 20 },
            { origen: 'caja', destino: 'unidad', factor: 10 },
          ] as never,
        },
      ],
    });
    expect(materiales.get(record.id).conversionPrecio.factor).toBe(100);
  });
});
