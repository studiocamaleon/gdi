import { planPapelDerivado } from '../papel-derivado';
import { idPapelCortado } from '../papel-derivado-stock';
import { precioPapelCortado } from '../precio-papel-cortado';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { contratoCompatible } from '../../suscripciones/evaluador-capacidades';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { InventarioService } from '../inventario.service';
import { ReservasMaterialService } from '../reservas-material.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { ComandoReservasDto } from '../dto/comando-reservas.dto';

describe('Papel derivado: consumo y sobrantes (DB de test)', () => {
  const prisma = new PrismaClient();
  const inventario = new InventarioService(prisma as never);
  const capacidades = new CapacidadesEmpresaService(prisma as never);
  const service = new ReservasMaterialService(
    prisma as never,
    inventario,
    capacidades,
  );
  let tenantId: string,
    varianteId: string,
    ubicacionId: string,
    destinoId: string;
  let auth: CurrentAuth;
  const traza = (cantidad: number, historica = false) => ({
    pasos: [
      {
        activado: true,
        rutaPasoId: 'imprimir',
        materiales: [
          {
            materialVarianteId: varianteId,
            materialDisplayName: 'Papel A4',
            tipoLineaCosto: 'MATERIAL',
            cantidad,
            unidad: 'hoja',
            ...(historica
              ? {}
              : {
                  contextoUnidadesSnapshot: {
                    unidadStock: 'HOJA',
                    unidadCompra: 'RESMA',
                  },
                }),
          },
        ],
      },
    ],
  });
  async function orden(cantidad = 8, historica = false) {
    return prisma.ordenTrabajo.create({
      data: {
        tenantId,
        numero: `OT-${randomUUID()}`,
        estado: 'pendiente',
        items: {
          create: {
            tenantId,
            codigo: 'DOC',
            nombre: 'Documento',
            familia: 'Documentos',
            cantidad: 1,
            cantidadUnidad: 'copias',
            subtotal: 100,
            impuestos: 0,
            total: 100,
            trazabilidadSnapshotJson: traza(cantidad, historica),
          },
        },
      },
      include: { items: true },
    });
  }
  async function cmd(id: string, extra: Partial<ComandoReservasDto> = {}) {
    const { revision } = await service.consultar(tenantId, id);
    return service.ejecutar(auth, id, {
      clave: randomUUID(),
      revision,
      accion: 'reservar',
      ...extra,
    });
  }
  async function fila(id: string) {
    return (await service.consultar(tenantId, id)).control.materiales[0];
  }
  async function editar(id: string, cantidad: number, historica = false) {
    return prisma.$transaction(async (tx) => {
      await tx.ordenTrabajo.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      await tx.ordenTrabajoItem.updateMany({
        where: { tenantId, ordenId: id },
        data: { trazabilidadSnapshotJson: traza(cantidad, historica) },
      });
      await service.sincronizarOrdenTx(tx, tenantId, id);
    });
  }
  beforeEach(async () => {
    tenantId = randomUUID();
    auth = {
      tenantId,
      userId: randomUUID(),
      email: 'operario@test.local',
      role: 'ADMINISTRADOR',
    } as CurrentAuth;
    await prisma.tenant.create({
      data: { id: tenantId, nombre: 'C1 test', slug: `c1-${tenantId}` },
    });
    const material = await prisma.materiaPrima.create({
      data: {
        tenantId,
        codigo: 'TEST',
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
      await prisma.materiaPrimaVariante.create({
        data: {
          tenantId,
          materiaPrimaId: material.id,
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
      await prisma.almacenMateriaPrimaUbicacion.findFirstOrThrow({
        where: { tenantId, almacenId: almacen.id },
      })
    ).id;
    destinoId = (
      await prisma.almacenMateriaPrimaUbicacion.create({
        data: { tenantId, almacenId: almacen.id, codigo: 'B', nombre: 'B' },
      })
    ).id;
    await inventario.registrarMovimiento(auth, {
      varianteId,
      ubicacionId,
      tipo: 'ingreso',
      origen: 'compra',
      cantidad: 10,
      costoUnitario: 2.345678,
    } as never);
    await service.guardarPolitica(tenantId, {
      modo: 'MANUAL',
      habilitada: true,
      incluirConsumibles: false,
      version: 0,
    });
  });
  afterEach(async () => {
    await prisma.consumoMaterialOt.deleteMany({ where: { tenantId } });
    await prisma.reservaMaterialOt.deleteMany({ where: { tenantId } });
    await prisma.necesidadMaterialOt.deleteMany({ where: { tenantId } });
    await prisma.operacionReservasMaterial.deleteMany({ where: { tenantId } });
    await prisma.ordenTrabajoItem.deleteMany({ where: { tenantId } });
    await prisma.ordenTrabajo.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });
  afterAll(() => prisma.$disconnect());

  async function preparar(q: number, ancho = 650, alto = 950, precio = 360) {
    const rendimiento = ancho === 650 ? 9 : 2;
    const plan = planPapelDerivado(
      q / rendimiento,
      { anchoMm: ancho, altoMm: alto },
      210,
      297,
    )!;
    await prisma.materiaPrimaVariante.update({
      where: { id: varianteId },
      data: {
        precioReferencia: precio,
        unidadPrecio: 'HOJA',
        unidadUso: 'HOJA',
        moneda: 'ARS',
        atributosVarianteJson: { anchoMm: ancho, altoMm: alto, gramajeGr: 180 },
      },
    });
    await prisma.stockMateriaPrimaVariante.updateMany({
      where: { tenantId, varianteId },
      data: { costoPromedio: precio },
    });
    const o = await orden(q / rendimiento);
    const snapshot = traza(q / rendimiento);
    Object.assign(snapshot.pasos[0].materiales[0], { papelDerivado: plan });
    await prisma.ordenTrabajoItem.update({
      where: { id: o.items[0].id },
      data: { trazabilidadSnapshotJson: snapshot },
    });
    await cmd(o.id);
    return {
      o,
      plan,
      hijo: idPapelCortado(tenantId, varianteId, plan),
      padres: Math.ceil(q / rendimiento),
    };
  }

  it.each([
    [650, 950, 360, 1, 8],
    [650, 950, 360, 5, 4],
    [650, 950, 360, 10, 8],
    [325, 475, 80, 1, 1],
    [325, 475, 80, 5, 1],
    [325, 475, 80, 10, 0],
  ])(
    '%s×%s a %s: %s A4 devuelve %s hojas sin crear valor ni duplicar movimientos',
    async (ancho, alto, precio, q, resto) => {
      const { o, hijo, padres } = await preparar(q, ancho, alto, precio);
      expect((await fila(o.id)).reservada).toBe(padres);
      const clave = randomUUID();
      await cmd(o.id, {
        accion: 'consumir',
        varianteId,
        ubicacionId,
        cantidad: padres,
        clave,
      });
      const movimientos = await prisma.movimientoStockMateriaPrima.count({
        where: { tenantId },
      });
      expect(
        await cmd(o.id, {
          accion: 'consumir',
          varianteId,
          ubicacionId,
          cantidad: padres,
          clave,
        }),
      ).toMatchObject({ repetida: true });
      expect(
        await prisma.movimientoStockMateriaPrima.count({ where: { tenantId } }),
      ).toBe(movimientos);
      const stock = await prisma.stockMateriaPrimaVariante.findMany({
        where: { tenantId },
      });
      expect(
        Number(
          stock.find((s) => s.varianteId === varianteId)!.cantidadDisponible,
        ),
      ).toBe(10 - padres);
      const sobrante = stock.find((s) => s.varianteId === hijo);
      expect(Number(sobrante?.cantidadDisponible ?? 0)).toBe(resto);
      const valorRestante = stock.reduce(
        (sum, v) =>
          sum + Number(v.cantidadDisponible) * Number(v.costoPromedio),
        0,
      );
      expect(10 * precio - valorRestante).toBeCloseTo(
        (q * precio) / (ancho === 650 ? 9 : 2),
        4,
      );
      if (resto) {
        const derivada = await prisma.materiaPrimaVariante.findUniqueOrThrow({
          where: { id: hijo },
        });
        expect(derivada.atributosVarianteJson).toMatchObject({
          anchoMm: 210,
          altoMm: 297,
          formatoComercial: 'A4',
        });
        expect(Number(sobrante!.costoPromedio)).toBe(
          precio / (ancho === 650 ? 9 : 2),
        );
        await prisma.materiaPrimaVariante.update({
          where: { id: varianteId },
          data: { precioReferencia: precio * 2 },
        });
        expect(
          await precioPapelCortado(
            prisma,
            tenantId,
            derivada.atributosVarianteJson as never,
          ),
        ).toMatchObject({ precio: (2 * precio) / (ancho === 650 ? 9 : 2) });
        expect(
          await precioPapelCortado(
            prisma,
            randomUUID(),
            derivada.atributosVarianteJson as never,
          ),
        ).toBeNull();
      }
    },
  );
  it('consumo parcial, rechazo de fracciones y cambios de plan luego de consumir', async () => {
    const { o, hijo } = await preparar(10);
    await expect(
      cmd(o.id, { accion: 'consumir', varianteId, ubicacionId, cantidad: 0.5 }),
    ).rejects.toMatchObject({ status: 400 });
    expect((await fila(o.id)).reservada).toBe(2);
    await cmd(o.id, {
      accion: 'consumir',
      varianteId,
      ubicacionId,
      cantidad: 1,
    });
    expect(
      await prisma.stockMateriaPrimaVariante.count({
        where: { tenantId, varianteId: hijo },
      }),
    ).toBe(0);
    await cmd(o.id, {
      accion: 'consumir',
      varianteId,
      ubicacionId,
      cantidad: 1,
    });
    expect(
      Number(
        (
          await prisma.stockMateriaPrimaVariante.findFirstOrThrow({
            where: { tenantId, varianteId: hijo },
          })
        ).cantidadDisponible,
      ),
    ).toBe(8);
    await expect(editar(o.id, 2)).rejects.toMatchObject({ status: 409 });
  });
  it('reutiliza las A4 como stock físico sin volver a retirar un pliego', async () => {
    const { o, hijo } = await preparar(1);
    await cmd(o.id, {
      accion: 'consumir',
      varianteId,
      ubicacionId,
      cantidad: 1,
    });
    const parentId = varianteId;
    varianteId = hijo;
    const segunda = await orden(5);
    await cmd(segunda.id);
    await cmd(segunda.id, {
      accion: 'consumir',
      varianteId: hijo,
      ubicacionId,
      cantidad: 5,
    });
    const stock = await prisma.stockMateriaPrimaVariante.findMany({
      where: { tenantId },
    });
    expect(
      Number(stock.find((s) => s.varianteId === parentId)!.cantidadDisponible),
    ).toBe(9);
    expect(
      Number(stock.find((s) => s.varianteId === hijo)!.cantidadDisponible),
    ).toBe(3);
  });
  it('dos consumos concurrentes comparten una única variante de sobrantes', async () => {
    const a = await preparar(1),
      b = await preparar(1);
    await Promise.all(
      [a, b].map(({ o }) =>
        cmd(o.id, { accion: 'consumir', varianteId, ubicacionId, cantidad: 1 }),
      ),
    );
    expect(
      Number(
        (
          await prisma.stockMateriaPrimaVariante.findFirstOrThrow({
            where: { tenantId, varianteId: a.hijo },
          })
        ).cantidadDisponible,
      ),
    ).toBe(16);
    expect(
      await prisma.materiaPrimaVariante.count({ where: { tenantId } }),
    ).toBe(2);
  });
  it('un sobrante de stock sin valoración no adquiere valor del precio de referencia', async () => {
    const { o, hijo } = await preparar(1);
    await prisma.stockMateriaPrimaVariante.updateMany({
      where: { tenantId, varianteId },
      data: { costoPromedio: 0 },
    });
    await cmd(o.id, {
      accion: 'consumir',
      varianteId,
      ubicacionId,
      cantidad: 1,
    });
    expect(
      Number(
        (
          await prisma.stockMateriaPrimaVariante.findFirstOrThrow({
            where: { tenantId, varianteId: hijo },
          })
        ).costoPromedio,
      ),
    ).toBe(0);
  });
  it('si cambiaron las medidas del papel revierte consumo, reservas y sobrantes juntos', async () => {
    const { o, hijo } = await preparar(1);
    await prisma.materiaPrimaVariante.update({
      where: { id: varianteId },
      data: { atributosVarianteJson: { anchoMm: 660, altoMm: 950 } },
    });
    await expect(
      cmd(o.id, { accion: 'consumir', varianteId, ubicacionId, cantidad: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await fila(o.id)).reservada).toBe(1);
    expect((await fila(o.id)).consumida).toBe(0);
    expect(
      await prisma.materiaPrimaVariante.count({
        where: { tenantId, id: hijo },
      }),
    ).toBe(0);
  });
});
