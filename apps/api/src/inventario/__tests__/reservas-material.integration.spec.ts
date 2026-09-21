import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { InventarioService } from '../inventario.service';
import { ReservasMaterialService } from '../reservas-material.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { ComandoReservasDto } from '../dto/comando-reservas.dto';

describe('Reservas OT: saldos, concurrencia y ciclo de vida (DB de test)', () => {
  const prisma = new PrismaClient();
  const inventario = new InventarioService(prisma as never);
  const service = new ReservasMaterialService(
    prisma as never,
    inventario,
    new CapacidadesEmpresaService(prisma as never),
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

  it('dos OTs simultáneas nunca comprometen las mismas existencias; faltante parcial', async () => {
    const [a, b] = await Promise.all([orden(), orden()]);
    await Promise.all([cmd(a.id), cmd(b.id)]);
    const filas = await Promise.all([fila(a.id), fila(b.id)]);
    expect(filas.map((f) => f.reservada).sort((a, b) => a - b)).toEqual([2, 8]);
    expect(filas.reduce((s, f) => s + f.faltante!, 0)).toBe(6);
    const stock = (await inventario.getStockPage(auth, {})).items[0];
    expect(stock).toMatchObject({
      cantidadDisponible: 10,
      cantidadReservada: 10,
      cantidadLibre: 0,
    });
  });
  it('reservar no altera el físico y egreso, ajuste o transferencia no pueden usar lo reservado', async () => {
    const o = await orden();
    await cmd(o.id);
    for (const tipo of ['egreso', 'ajuste_salida'])
      await expect(
        inventario.registrarMovimiento(auth, {
          varianteId,
          ubicacionId,
          tipo,
          origen: 'otro',
          cantidad: 3,
        } as never),
      ).rejects.toMatchObject({ status: 409 });
    await expect(
      inventario.registrarTransferencia(auth, {
        varianteId,
        ubicacionOrigenId: ubicacionId,
        ubicacionDestinoId: destinoId,
        cantidad: 3,
      } as never),
    ).rejects.toMatchObject({ status: 409 });
    expect(await fila(o.id)).toMatchObject({
      fisico: 10,
      reservada: 8,
      libre: 2,
    });
  });
  it('consume atómicamente y reintentar el mismo envío no duplica egresos', async () => {
    const o = await orden();
    await cmd(o.id);
    const comando: ComandoReservasDto = {
      clave: randomUUID(),
      revision: (await service.consultar(tenantId, o.id)).revision,
      accion: 'consumir',
      varianteId,
      ubicacionId,
      cantidad: 3,
    };
    await Promise.all([
      service.ejecutar(auth, o.id, comando),
      service.ejecutar(auth, o.id, comando),
    ]);
    expect(await fila(o.id)).toMatchObject({
      cantidad: 8,
      consumida: 3,
      reservada: 5,
      fisico: 7,
      libre: 2,
    });
    const consumos = await prisma.consumoMaterialOt.findMany({
      where: { tenantId },
      include: { movimiento: true },
    });
    expect(consumos).toHaveLength(1);
    expect(Number(consumos[0].costoUnitario)).toBe(2.345678);
    expect(consumos[0].movimiento.referenciaId).toBe(o.id);
    expect(Number(consumos[0].movimiento.costoUnitario)).toBe(2.345678);
    await expect(
      service.ejecutar(auth, o.id, { ...comando, cantidad: 4 }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('un consumo excesivo o en otra ubicación no altera reservas ni historial', async () => {
    const o = await orden();
    await cmd(o.id);
    await expect(
      cmd(o.id, { accion: 'consumir', varianteId, ubicacionId, cantidad: 9 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      cmd(o.id, {
        accion: 'consumir',
        varianteId,
        ubicacionId: destinoId,
        cantidad: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await fila(o.id)).toMatchObject({
      reservada: 8,
      consumida: 0,
      fisico: 10,
    });
    expect(await prisma.consumoMaterialOt.count({ where: { tenantId } })).toBe(
      0,
    );
  });
  it('cancelar libera sólo lo pendiente y conserva el consumo físico', async () => {
    const o = await orden();
    await cmd(o.id);
    await cmd(o.id, {
      accion: 'consumir',
      varianteId,
      ubicacionId,
      cantidad: 3,
    });
    await prisma.$transaction(async (tx) => {
      await tx.ordenTrabajo.update({
        where: { id: o.id },
        data: { estado: 'cancelada' },
      });
      await service.cancelarOrdenTx(tx, tenantId, o.id, auth);
    });
    expect(await fila(o.id)).toMatchObject({
      reservada: 0,
      consumida: 3,
      fisico: 7,
      libre: 7,
    });
    await expect(cmd(o.id)).rejects.toMatchObject({ status: 409 });
  });
  it('reconciliar una edición recorta reservas; aumentarla no toma stock automáticamente', async () => {
    const o = await orden();
    await cmd(o.id);
    await editar(o.id, 4);
    expect(await fila(o.id)).toMatchObject({
      cantidad: 4,
      reservada: 4,
      libre: 6,
    });
    await editar(o.id, 12);
    expect(await fila(o.id)).toMatchObject({
      cantidad: 12,
      reservada: 4,
      pendiente: 8,
      faltante: 2,
    });
  });
  it('una edición menor al consumo se rechaza y revierte el snapshot completo', async () => {
    const o = await orden();
    await cmd(o.id);
    await cmd(o.id, {
      accion: 'consumir',
      varianteId,
      ubicacionId,
      cantidad: 3,
    });
    await expect(editar(o.id, 2)).rejects.toMatchObject({ status: 409 });
    expect(await fila(o.id)).toMatchObject({
      cantidad: 8,
      reservada: 5,
      consumida: 3,
    });
  });
  it('una necesidad retirada libera reservas', async () => {
    const o = await orden();
    await cmd(o.id);
    await prisma.$transaction(async (tx) => {
      await tx.ordenTrabajoItem.deleteMany({
        where: { ordenId: o.id, tenantId },
      });
      await service.sincronizarOrdenTx(tx, tenantId, o.id);
    });
    expect(
      Number(
        (
          await prisma.reservaMaterialOt.aggregate({
            where: { tenantId },
            _sum: { cantidad: true },
          })
        )._sum.cantidad,
      ),
    ).toBe(0);
  });
  it('una OT histórica pide definición; al editarla invalida esa definición y libera reservas', async () => {
    const o = await orden(8, true);
    await cmd(o.id);
    expect(await fila(o.id)).toMatchObject({
      cantidad: null,
      reservada: 0,
      revisar: true,
    });
    await cmd(o.id, {
      accion: 'definir',
      varianteId,
      cantidad: 8,
      unidad: 'hoja',
      motivo: 'Conteo de las hojas necesarias',
    });
    await cmd(o.id);
    expect(await fila(o.id)).toMatchObject({
      cantidad: 8,
      reservada: 8,
      fuente: 'manual',
    });
    await editar(o.id, 7, true);
    await cmd(o.id); // no revive por repetir el comando
    expect(await fila(o.id)).toMatchObject({
      cantidad: null,
      reservada: 0,
      revisar: true,
    });
  });
  it('política optativa: desactivada no escribe; no permite desactivar con reservas pendientes', async () => {
    const o = await orden();
    await cmd(o.id);
    await expect(
      service.guardarPolitica(tenantId, {
        habilitada: false,
        incluirConsumibles: false,
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await cmd(o.id, { accion: 'liberar' });
    await service.guardarPolitica(tenantId, {
      habilitada: false,
      incluirConsumibles: false,
      version: 1,
    });
    await expect(cmd(o.id)).rejects.toMatchObject({ status: 409 });
    expect((await service.consultar(tenantId, o.id)).control.habilitado).toBe(
      false,
    );
  });
  it('la revisión evita reservar una versión obsoleta; una ubicación inactiva no se asigna', async () => {
    const o = await orden();
    const revision = (await service.consultar(tenantId, o.id)).revision;
    await editar(o.id, 12);
    await expect(cmd(o.id, { revision })).rejects.toMatchObject({
      status: 409,
    });
    await prisma.almacenMateriaPrimaUbicacion.update({
      where: { id: ubicacionId },
      data: { activo: false },
    });
    await cmd(o.id);
    expect(await fila(o.id)).toMatchObject({
      reservada: 0,
      libre: 0,
      faltante: 12,
    });
  });
  it('tenant ajeno no puede leer ni operar reservas; idempotencia no se reutiliza en otra OT', async () => {
    const a = await orden(),
      b = await orden();
    const clave = randomUUID();
    await cmd(a.id, { clave });
    await expect(cmd(b.id, { clave })).rejects.toMatchObject({ status: 409 });
    await expect(service.consultar(randomUUID(), a.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.ejecutar({ ...auth, tenantId: randomUUID() }, a.id, {
        clave: randomUUID(),
        revision: 'a'.repeat(64),
        accion: 'reservar',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('una salida manual que compite con una reserva nunca deja saldo comprometido sin respaldo', async () => {
    const o = await orden();
    await Promise.allSettled([
      cmd(o.id),
      inventario.registrarMovimiento(auth, {
        varianteId,
        ubicacionId,
        tipo: 'egreso',
        origen: 'otro',
        cantidad: 4,
      } as never),
    ]);
    const f = await fila(o.id);
    expect(f.fisico).toBeGreaterThanOrEqual(f.reservada);
    expect(f.fisico - f.reservada).toBe(f.libre);
  });
  it('las necesidades sin stock también protegen la unidad; una referencia histórica inválida se muestra para revisar', async () => {
    varianteId = (
      await prisma.materiaPrimaVariante.create({
        data: {
          tenantId,
          materiaPrimaId: (
            await prisma.materiaPrima.findFirstOrThrow({ where: { tenantId } })
          ).id,
          sku: 'VACIO',
          atributosVarianteJson: {},
          unidadStock: 'HOJA',
          unidadCompra: 'HOJA',
        },
      })
    ).id;
    const o = await orden();
    await cmd(o.id);
    await expect(
      inventario.bulkUpdateCostos(auth, {
        variantes: [
          {
            id: varianteId,
            unidadStock: 'kg',
            unidadCompra: 'kg',
            unidadUso: 'kg',
          },
        ],
      } as never),
    ).rejects.toThrow('necesidades de una OT');
    varianteId = 'variante-antigua-sin-uuid';
    const legacy = await orden();
    expect(await fila(legacy.id)).toMatchObject({
      cantidad: null,
      revisar: true,
      unidad: null,
    });
  });
  async function automatica() {
    const p = await service.politica(tenantId);
    return service.guardarPolitica(tenantId, { ...p, modo: 'AL_EMITIR' });
  }
  async function emision(id: string) {
    return prisma.$transaction((tx) =>
      service.sincronizarOrdenTx(tx, tenantId, id, { alEmitir: true, auth }),
    );
  }
  it('emisión automática incorpora necesidades, reserva lo libre y admite el faltante sin consumir', async () => {
    await automatica();
    const o = await orden(15);
    await emision(o.id);
    const result = await service.consultar(tenantId, o.id);
    expect(result.control).toMatchObject({
      iniciado: true,
      modoReserva: 'AL_EMITIR',
    });
    expect(await fila(o.id)).toMatchObject({
      reservada: 10,
      cantidad: 15,
      faltante: 5,
      fisico: 10,
      consumida: 0,
    });
    expect(
      await prisma.necesidadMaterialOt.count({
        where: { tenantId, ordenId: o.id, estado: 'ACTIVA' },
      }),
    ).toBe(1);
    expect(
      await prisma.operacionReservasMaterial.findFirst({
        where: { tenantId, ordenId: o.id },
      }),
    ).toMatchObject({ accion: 'emision', actorNombre: auth.email });
  });
  it('dos emisiones concurrentes y sus reintentos no duplican reservas ni auditorías', async () => {
    await automatica();
    const a = await orden(),
      b = await orden();
    await Promise.all([emision(a.id), emision(b.id), emision(a.id)]);
    expect(
      (await Promise.all([fila(a.id), fila(b.id)]))
        .map((f) => f.reservada)
        .sort((a, b) => a - b),
    ).toEqual([2, 8]);
    expect(
      await prisma.operacionReservasMaterial.count({
        where: { tenantId, accion: 'emision' },
      }),
    ).toBe(2);
  });
  it('modo manual incorpora la demanda al emitir pero espera la decisión de reservar', async () => {
    const o = await orden();
    await emision(o.id);
    expect((await service.consultar(tenantId, o.id)).control.iniciado).toBe(
      true,
    );
    expect(await fila(o.id)).toMatchObject({
      reservada: 0,
      cantidad: 8,
      libre: 10,
    });
    await cmd(o.id);
    expect((await fila(o.id)).reservada).toBe(8);
  });
  it('editar en automático toma sólo el incremento, libera el sobrante y nunca consume', async () => {
    await automatica();
    const o = await orden(4);
    await emision(o.id);
    await editar(o.id, 12);
    expect(await fila(o.id)).toMatchObject({
      reservada: 10,
      faltante: 2,
      fisico: 10,
    });
    await editar(o.id, 3);
    expect(await fila(o.id)).toMatchObject({
      reservada: 3,
      libre: 7,
      consumida: 0,
    });
  });
  it('borradores, desactivado y órdenes históricas no se incorporan por una consulta o edición', async () => {
    await automatica();
    const historica = await orden();
    await editar(historica.id, 7);
    await service.consultar(tenantId, historica.id);
    expect(
      await prisma.necesidadMaterialOt.count({ where: { tenantId } }),
    ).toBe(0);
    const draft = await orden();
    await prisma.ordenTrabajo.update({
      where: { id: draft.id },
      data: { estado: 'borrador' },
    });
    await emision(draft.id);
    expect((await service.consultar(tenantId, draft.id)).control.iniciado).toBe(
      false,
    );
    const p = await service.politica(tenantId);
    await service.guardarPolitica(tenantId, {
      ...p,
      habilitada: false,
      modo: 'AL_EMITIR',
    });
    await emision(historica.id);
    expect(
      await prisma.necesidadMaterialOt.count({ where: { tenantId } }),
    ).toBe(0);
  });
  it('una cantidad sin conversión se incorpora para revisión y se reserva al confirmarla', async () => {
    await automatica();
    const o = await orden(8, true);
    await emision(o.id);
    expect(await fila(o.id)).toMatchObject({ revisar: true, reservada: 0 });
    await cmd(o.id, {
      accion: 'definir',
      varianteId,
      unidad: 'hoja',
      cantidad: 8,
      motivo: 'Confirmación física',
    });
    expect(await fila(o.id)).toMatchObject({ revisar: false, reservada: 8 });
  });
  it('liberar explícitamente no se deshace por leer o sincronizar la misma revisión', async () => {
    await automatica();
    const o = await orden();
    await emision(o.id);
    await cmd(o.id, { accion: 'liberar' });
    await emision(o.id);
    expect(await fila(o.id)).toMatchObject({ reservada: 0, libre: 10 });
  });
  it('un fallo posterior a la reserva revierte toda la emisión', async () => {
    await automatica();
    const o = await orden();
    await prisma.ordenTrabajo.update({
      where: { id: o.id },
      data: { estado: 'borrador' },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.ordenTrabajo.update({
          where: { id: o.id },
          data: { estado: 'pendiente' },
        });
        await service.sincronizarOrdenTx(tx, tenantId, o.id, {
          alEmitir: true,
          auth,
        });
        throw new Error('Fallo posterior');
      }),
    ).rejects.toThrow('Fallo posterior');
    expect(
      await prisma.necesidadMaterialOt.count({ where: { tenantId } }),
    ).toBe(0);
    expect(
      (await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } }))
        .estado,
    ).toBe('borrador');
    expect(
      await prisma.operacionReservasMaterial.count({ where: { tenantId } }),
    ).toBe(0);
  });
  it('cambiar a automático no altera reservas existentes ni pierde el modo al guardar desde un cliente anterior', async () => {
    const o = await orden();
    await emision(o.id);
    const p = await automatica();
    expect((await fila(o.id)).reservada).toBe(0);
    const saved = await service.guardarPolitica(tenantId, {
      habilitada: true,
      incluirConsumibles: false,
      version: p.version,
    });
    expect(saved.modo).toBe('AL_EMITIR');
    await expect(
      service.guardarPolitica(tenantId, { ...p, modo: 'MANUAL' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
