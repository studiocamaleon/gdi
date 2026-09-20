import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { InventarioService } from '../../inventario/inventario.service';
import { ReservasMaterialService } from '../../inventario/reservas-material.service';
import { PrevisionMaterialesService } from '../../inventario/prevision-materiales.service';
import { ComprasService } from '../compras.service';
import { fechaCivil, estimarReposicion } from '../plazos-compra';
import type { CurrentAuth } from '../../auth/auth.types';
import type {
  CrearCompraDto,
  LineaCompraDto,
  OfertaCompraDto,
} from '../dto/compras.dto';

describe('Compras y recepciones: DB exclusiva de tests', () => {
  const prisma = new PrismaClient();
  const inventario = new InventarioService(prisma as never);
  const reservas = new ReservasMaterialService(prisma as never, inventario);
  const service = new ComprasService(prisma as never, inventario, reservas);
  let tenantId: string,
    varianteId: string,
    ubicacionId: string,
    proveedorId: string;
  let auth: CurrentAuth;
  const linea = (extra: Partial<LineaCompraDto> = {}): LineaCompraDto => ({
    varianteId,
    unidadCompra: 'RESMA',
    factorStock: 500,
    cantidad: 2,
    precio: 5000,
    asignaciones: [],
    ...extra,
  });
  const payload = (extra: Partial<CrearCompraDto> = {}): CrearCompraDto => ({
    clave: randomUUID(),
    proveedorId,
    ubicacionId,
    fechaPedido: '2026-09-18',
    moneda: 'ARS',
    tipoCambio: 1,
    lineas: [linea()],
    ...extra,
  });
  async function crear(data = payload()) {
    const result = (await service.crear(auth, data)) as { ordenId: string };
    return service.detalle(auth, result.ordenId);
  }
  async function emitir(id: string) {
    const o = await service.detalle(auth, id);
    await service.actuar(auth, id, {
      clave: randomUUID(),
      version: o.version,
      accion: 'emitir',
    });
    return service.detalle(auth, id);
  }
  async function recibir(
    id: string,
    cantidad: number,
    cantidadStock = cantidad * 500,
  ) {
    const o = await service.detalle(auth, id);
    const data = {
      clave: randomUUID(),
      version: o.version,
      ubicacionId,
      lineas: [{ lineaId: o.lineas[0].id, cantidad, cantidadStock }],
    };
    await service.recibir(auth, id, data);
    return data;
  }
  const traza = (qty: number) => ({
    pasos: [
      {
        activado: true,
        rutaPasoId: 'imprimir',
        materiales: [
          {
            materialVarianteId: varianteId,
            materialDisplayName: 'Papel A4',
            tipoLineaCosto: 'MATERIAL',
            cantidad: qty,
            unidad: 'hoja',
            contextoUnidadesSnapshot: {
              unidadStock: 'HOJA',
              unidadCompra: 'RESMA',
            },
          },
        ],
      },
    ],
  });
  async function necesidad(qty = 500, automatica = false) {
    const o = await prisma.ordenTrabajo.create({
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
            trazabilidadSnapshotJson: traza(qty),
          },
        },
      },
      include: { items: true },
    });
    const m = await reservas.consultar(tenantId, o.id);
    if (automatica) {
      await prisma.$transaction((tx) =>
        reservas.sincronizarOrdenTx(tx, tenantId, o.id, {
          alEmitir: true,
          auth,
        }),
      );
    } else {
      await reservas.ejecutar(auth, o.id, {
        clave: randomUUID(),
        revision: m.revision,
        accion: 'reservar',
      });
    }

    const n = await prisma.necesidadMaterialOt.findFirstOrThrow({
      where: { tenantId, ordenId: o.id },
    });
    return {
      o,
      n,
      asignacion: { necesidadId: n.id, revision: n.revision, cantidad: qty },
    };
  }
  async function oferta(extra: Partial<OfertaCompraDto> = {}) {
    return service.guardarOferta(auth, {
      proveedorId,
      varianteId,
      version: 0,
      unidadCompra: 'RESMA',
      factorStock: 500,
      precio: 5000,
      moneda: 'ARS',
      minimo: 1,
      multiplo: 1,
      activo: true,
      ...extra,
    });
  }
  beforeEach(async () => {
    tenantId = randomUUID();
    auth = {
      tenantId,
      userId: randomUUID(),
      email: 'compras@test.local',
      role: 'ADMINISTRADOR',
    } as CurrentAuth;
    await prisma.tenant.create({
      data: { id: tenantId, nombre: 'C2 test', slug: `c2-${tenantId}` },
    });
    proveedorId = (
      await prisma.proveedor.create({
        data: {
          tenantId,
          nombre: 'Papelera',
          emailPrincipal: '',
          telefonoCodigo: '',
          telefonoNumero: '',
          paisCodigo: 'AR',
          reposicionDias: 2,
          reposicionTipo: 'HABILES',
        },
      })
    ).id;
    const m = await prisma.materiaPrima.create({
      data: {
        tenantId,
        codigo: 'TEST',
        nombre: 'Papel A4',
        familia: 'SUSTRATO',
        subfamilia: 'SUSTRATO_RIGIDO',
        tipoTecnico: 'test',
        templateId: 'test',
        unidadStock: 'HOJA',
        unidadCompra: 'RESMA',
        atributosTecnicosJson: {},
      },
    });
    varianteId = (
      await prisma.materiaPrimaVariante.create({
        data: {
          tenantId,
          materiaPrimaId: m.id,
          sku: 'A4',
          atributosVarianteJson: {},
          proveedorReferenciaId: proveedorId,
          precioReferencia: 999,
          unidadStock: 'HOJA',
          unidadCompra: 'RESMA',
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
    await reservas.guardarPolitica(tenantId, {
      modo: 'MANUAL',
      habilitada: true,
      incluirConsumibles: false,
      version: 0,
    });
  });
  afterEach(async () => {
    await prisma.detalleRecepcionCompra.deleteMany({ where: { tenantId } });
    await prisma.recepcionCompra.deleteMany({ where: { tenantId } });
    await prisma.coberturaCompra.deleteMany({ where: { tenantId } });
    await prisma.lineaOrdenCompra.deleteMany({ where: { tenantId } });
    await prisma.ordenCompra.deleteMany({ where: { tenantId } });
    await prisma.ofertaCompra.deleteMany({ where: { tenantId } });
    await prisma.consumoMaterialOt.deleteMany({ where: { tenantId } });
    await prisma.reservaMaterialOt.deleteMany({ where: { tenantId } });
    await prisma.necesidadMaterialOt.deleteMany({ where: { tenantId } });
    await prisma.operacionReservasMaterial.deleteMany({ where: { tenantId } });
    await prisma.ordenTrabajoItem.deleteMany({ where: { tenantId } });
    await prisma.ordenTrabajo.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });
  afterAll(() => prisma.$disconnect());
  it('catálogo incluye el costo y las equivalencias guardadas para preparar la compra', async () => {
    await prisma.materiaPrimaVariante.update({
      where: { id: varianteId },
      data: {
        precioReferencia: 12,
        moneda: 'ARS',
        unidadPrecio: 'HOJA',
        equivalenciasJson: [{ origen: 'RESMA', destino: 'HOJA', factor: 500 }],
      },
    });
    const c = await service.catalogo(auth);
    expect(c.variantes).toHaveLength(1);
    expect(Number(c.variantes[0].precioReferencia)).toBe(12);
    expect(c.variantes[0]).toMatchObject({
      moneda: 'ARS',
      contextoUnidades: {
        unidadPrecio: 'HOJA',
        unidadCompra: 'RESMA',
        unidadStock: 'HOJA',
        equivalencias: [{ origen: 'RESMA', destino: 'HOJA', factor: 500 }],
      },
    });
  });
  it('plazo desconocido, cero explícito, fines de semana y fechas civiles inválidas', () => {
    expect(
      estimarReposicion(fechaCivil('2026-09-18'), 2, 'HABILES')!
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-09-22');
    expect(
      estimarReposicion(fechaCivil('2026-09-18'), 2, 'CORRIDOS')!
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-09-20');
    expect(
      estimarReposicion(fechaCivil('2026-09-18'), 0, 'HABILES')!
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-09-18');
    expect(
      estimarReposicion(fechaCivil('2026-09-18'), null, 'HABILES'),
    ).toBeNull();
    expect(() => fechaCivil('2026-02-30')).toThrow();
  });
  it('hereda plazo y congela unidades, oferta y costo; recibir no cambia el precio del catálogo', async () => {
    const f = await oferta();
    const o = await crear();
    expect(o.lineas[0].fechaEstimada!.toISOString().slice(0, 10)).toBe(
      '2026-09-22',
    );
    await oferta({
      version: f.version,
      factorStock: 400,
      precio: 9999,
      reposicionDias: 9,
      reposicionTipo: 'CORRIDOS',
    });
    await emitir(o.id);
    await recibir(o.id, 1);
    const stock = await prisma.stockMateriaPrimaVariante.findFirstOrThrow({
      where: { tenantId },
    });
    expect(Number(stock.cantidadDisponible)).toBe(500);
    expect(Number(stock.costoPromedio)).toBe(10);
    expect(
      Number(
        (
          await prisma.materiaPrimaVariante.findUniqueOrThrow({
            where: { id: varianteId },
          })
        ).precioReferencia,
      ),
    ).toBe(999);
    expect(
      Number((await service.detalle(auth, o.id)).lineas[0].factorStock),
    ).toBe(500);
  });
  it('el plazo específico cero gana al general y fecha confirmada gana a estimada', async () => {
    await oferta({ reposicionDias: 0, reposicionTipo: 'CORRIDOS' });
    const o = await crear(
      payload({ lineas: [linea({ fechaConfirmada: '2026-09-21' })] }),
    );
    expect(o.lineas[0].fechaEstimada!.toISOString().slice(0, 10)).toBe(
      '2026-09-18',
    );
    expect(o.lineas[0].fechaConfirmada!.toISOString().slice(0, 10)).toBe(
      '2026-09-21',
    );
  });
  it('recepción parcial e idempotencia aun con versión anterior; conflicto si se reutiliza la clave', async () => {
    const o = await crear();
    await emitir(o.id);
    const d = await recibir(o.id, 1);
    await service.recibir(auth, o.id, d);
    expect(
      await prisma.movimientoStockMateriaPrima.count({ where: { tenantId } }),
    ).toBe(1);
    await expect(
      service.recibir(auth, o.id, { ...d, notas: 'diferente' }),
    ).rejects.toThrow('otros datos');
    expect((await service.detalle(auth, o.id)).estado).toBe('PARCIAL');
    await recibir(o.id, 1);
    expect((await service.detalle(auth, o.id)).estado).toBe('RECIBIDA');
  });
  it('dos recepciones concurrentes no exceden el saldo; mismo reintento ejecuta una vez', async () => {
    const o = await emitir((await crear()).id);
    const d = {
      clave: randomUUID(),
      version: o.version,
      ubicacionId,
      lineas: [{ lineaId: o.lineas[0].id, cantidad: 2, cantidadStock: 1000 }],
    };
    const results = await Promise.allSettled([
      service.recibir(auth, o.id, d),
      service.recibir(auth, o.id, { ...d, clave: randomUUID() }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.movimientoStockMateriaPrima.count({ where: { tenantId } }),
    ).toBe(1);
  });
  it('consolida dos OTs y la recepción transforma cobertura en reserva sin duplicar stock', async () => {
    const a = await necesidad(400),
      b = await necesidad(600);
    const o = await crear(
      payload({
        lineas: [linea({ asignaciones: [a.asignacion, b.asignacion] })],
      }),
    );
    expect(
      (await reservas.consultar(tenantId, a.o.id)).control.materiales[0]
        .enCompra,
    ).toBe(0);
    await emitir(o.id);
    expect(
      (await reservas.consultar(tenantId, a.o.id)).control.materiales[0]
        .enCompra,
    ).toBe(400);
    await recibir(o.id, 1);
    const rows = (await service.necesidades(auth)).data;
    expect(rows.reduce((s, n) => s + Number(n.enCompra), 0)).toBe(500);
    expect(rows.reduce((s, n) => s + Number(n.reservada), 0)).toBe(500);
    await recibir(o.id, 1);
    expect(
      (await reservas.consultar(tenantId, a.o.id)).control.materiales[0],
    ).toMatchObject({ enCompra: 0, reservada: 400, consumida: 0 });
    expect(
      (await reservas.consultar(tenantId, b.o.id)).control.materiales[0]
        .reservada,
    ).toBe(600);
    expect(
      Number(
        (
          await prisma.stockMateriaPrimaVariante.findFirstOrThrow({
            where: { tenantId },
          })
        ).cantidadDisponible,
      ),
    ).toBe(1000);
  });
  it('dos compradores no asignan simultáneamente el mismo faltante; cancelar borrador libera la necesidad', async () => {
    const a = await necesidad(500);
    const d = payload({
      lineas: [linea({ cantidad: 1, asignaciones: [a.asignacion] })],
    });
    const results = await Promise.allSettled([
      crear(d),
      crear({ ...d, clave: randomUUID() }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const o = await prisma.ordenCompra.findFirstOrThrow({
      where: { tenantId },
    });
    await service.actuar(auth, o.id, {
      clave: randomUUID(),
      version: o.version,
      accion: 'cancelar',
      motivo: 'Pedido duplicado',
    });
    expect(Number((await service.necesidades(auth)).data[0].porCubrir)).toBe(
      500,
    );
    expect(
      await prisma.movimientoStockMateriaPrima.count({ where: { tenantId } }),
    ).toBe(0);
  });
  it('cancelar una OT deja la compra pendiente y al recibir su material queda libre', async () => {
    const a = await necesidad(500);
    const o = await crear(
      payload({
        lineas: [linea({ cantidad: 1, asignaciones: [a.asignacion] })],
      }),
    );
    await emitir(o.id);
    await prisma.$transaction(async (tx) => {
      await tx.ordenTrabajo.update({
        where: { id: a.o.id },
        data: { estado: 'cancelada' },
      });
      await reservas.cancelarOrdenTx(tx, tenantId, a.o.id);
    });
    await recibir(o.id, 1);
    expect(
      await prisma.reservaMaterialOt.count({
        where: { tenantId, cantidad: { gt: 0 } },
      }),
    ).toBe(0);
    expect(
      Number(
        (
          await prisma.stockMateriaPrimaVariante.findFirstOrThrow({
            where: { tenantId },
          })
        ).cantidadDisponible,
      ),
    ).toBe(500);
  });
  it('editar necesidad no transfiere una cobertura obsoleta a reserva', async () => {
    const a = await necesidad(500);
    const o = await crear(
      payload({
        lineas: [linea({ cantidad: 1, asignaciones: [a.asignacion] })],
      }),
    );
    await emitir(o.id);
    await prisma.$transaction(async (tx) => {
      await tx.ordenTrabajoItem.update({
        where: { id: a.o.items[0].id },
        data: { trazabilidadSnapshotJson: traza(600) },
      });
      await reservas.sincronizarOrdenTx(tx, tenantId, a.o.id);
    });
    expect(
      (await reservas.consultar(tenantId, a.o.id)).control.materiales[0]
        .enCompra,
    ).toBe(0);
    await recibir(o.id, 1);
    expect(
      await prisma.reservaMaterialOt.count({
        where: { tenantId, cantidad: { gt: 0 } },
      }),
    ).toBe(0);
  });
  it('cerrar el saldo conserva la recepción y libera sólo el futuro', async () => {
    const a = await necesidad(1000);
    const o = await crear(
      payload({ lineas: [linea({ asignaciones: [a.asignacion] })] }),
    );
    await emitir(o.id);
    await recibir(o.id, 1);
    const parcial = await service.detalle(auth, o.id);
    await service.actuar(auth, o.id, {
      clave: randomUUID(),
      version: parcial.version,
      accion: 'cerrar',
      motivo: 'El proveedor no entrega el resto',
    });
    expect(
      (await reservas.consultar(tenantId, a.o.id)).control.materiales[0],
    ).toMatchObject({ enCompra: 0, reservada: 500 });
    expect(Number((await service.necesidades(auth)).data[0].porCubrir)).toBe(
      500,
    );
  });
  it('reintento de crear retorna la misma compra y no consume otro número', async () => {
    const d = payload();
    const [a, b] = await Promise.all([crear(d), crear(d)]);
    expect(a.id).toBe(b.id);
    expect(await prisma.ordenCompra.count({ where: { tenantId } })).toBe(1);
  });
  it('rechaza exceso, línea ajena y revierte toda una recepción inválida', async () => {
    const o = await emitir(
      (await crear(payload({ lineas: [linea(), linea()] }))).id,
    );
    await expect(
      service.recibir(auth, o.id, {
        clave: randomUUID(),
        version: o.version,
        ubicacionId,
        lineas: [
          { lineaId: o.lineas[0].id, cantidad: 1, cantidadStock: 500 },
          { lineaId: o.lineas[1].id, cantidad: 3, cantidadStock: 1500 },
        ],
      }),
    ).rejects.toThrow('saldo');
    expect(
      await prisma.movimientoStockMateriaPrima.count({ where: { tenantId } }),
    ).toBe(0);
    expect(await prisma.recepcionCompra.count({ where: { tenantId } })).toBe(0);
    await expect(
      service.recibir(auth, o.id, {
        clave: randomUUID(),
        version: o.version,
        ubicacionId,
        lineas: [{ lineaId: randomUUID(), cantidad: 1, cantidadStock: 500 }],
      }),
    ).rejects.toThrow('pertenece');
  });
  it('respeta mínimos, múltiplos, vigencia, versión y conversión por misma unidad', async () => {
    const f = await oferta({ minimo: 4, multiplo: 2 });
    await expect(crear()).rejects.toThrow('mínimo');
    await expect(
      crear(payload({ lineas: [linea({ cantidad: 5 })] })),
    ).rejects.toThrow('múltiplo');
    await expect(oferta()).rejects.toThrow('cambió');
    await oferta({ version: f.version, vigenteHasta: '2026-09-17' });
    await expect(crear()).rejects.toThrow('venció');
    await expect(
      oferta({ version: f.version + 1, unidadCompra: 'HOJA', factorStock: 10 }),
    ).rejects.toThrow('misma unidad');
  });
  it('no expone costos sin permiso y aísla compras/proveedores por tenant', async () => {
    const o = await crear();
    const otro = { ...auth, tenantId: randomUUID() };
    await expect(service.detalle(otro, o.id)).rejects.toThrow('no encontrada');
    await expect(service.crear(otro, payload())).rejects.toThrow(
      'Proveedor no disponible',
    );
    await expect(
      service.catalogo({ ...auth, permisos: new Set(['inventario.ver']) }),
    ).rejects.toThrow('costos');
    await expect(
      service.crear(
        { ...auth, permisos: new Set(['inventario.gestionar']) },
        payload(),
      ),
    ).rejects.toThrow('costos');
    await expect(crear(payload({ ubicacionId: randomUUID() }))).rejects.toThrow(
      'ubicación',
    );
  });
  it('peso real a placas y tipo de cambio quedan congelados; no usa el coeficiente del catálogo', async () => {
    await prisma.materiaPrimaVariante.update({
      where: { id: varianteId },
      data: { unidadStock: 'PLACA' },
    });
    const o = await crear(
      payload({
        moneda: 'USD',
        tipoCambio: 1000,
        lineas: [
          linea({
            unidadCompra: 'KG',
            factorStock: 0.5,
            cantidad: 20,
            precio: 4.16,
          }),
        ],
      }),
    );
    await emitir(o.id);
    await recibir(o.id, 10, 6);
    const stock = await prisma.stockMateriaPrimaVariante.findFirstOrThrow({
      where: { tenantId },
    });
    expect(Number(stock.cantidadDisponible)).toBe(6);
    expect(Number(stock.costoPromedio)).toBeCloseTo(6933.333333, 6);
    const detalle = await prisma.detalleRecepcionCompra.findFirstOrThrow({
      where: { tenantId },
    });
    expect(Number(detalle.cantidadCompra)).toBe(10);
    expect(Number(detalle.cantidadStock)).toBe(6);
  });
  it('recepción por presentación fija no permite alterar la cantidad de stock arbitrariamente', async () => {
    const o = await emitir((await crear()).id);
    await expect(recibir(o.id, 1, 200)).rejects.toThrow('conversión congelada');
  });
  it('una recepción real menor no promete más stock del pendiente en compra', async () => {
    const a = await necesidad(10);
    const o = await crear(
      payload({
        lineas: [
          linea({
            unidadCompra: 'KG',
            factorStock: 0.5,
            cantidad: 20,
            precio: 4.16,
            asignaciones: [a.asignacion],
          }),
        ],
      }),
    );
    await emitir(o.id);
    await recibir(o.id, 10, 4);
    const estado = (await reservas.consultar(tenantId, a.o.id)).control
      .materiales[0];
    expect(estado).toMatchObject({ reservada: 4, enCompra: 5 });
    expect(Number((await service.necesidades(auth)).data[0].porCubrir)).toBe(1);
  });
  it('no desactiva reservas con compras pendientes vinculadas', async () => {
    const a = await necesidad(500);
    await crear(
      payload({
        lineas: [linea({ cantidad: 1, asignaciones: [a.asignacion] })],
      }),
    );
    await expect(
      reservas.guardarPolitica(tenantId, {
        version: 1,
        habilitada: false,
        incluirConsumibles: false,
      }),
    ).rejects.toThrow('compras vinculadas');
  });
  it('una reserva manual posterior no cuenta otra vez su cobertura futura', async () => {
    const a = await necesidad(500);
    const o = await crear(
      payload({
        lineas: [linea({ cantidad: 1, asignaciones: [a.asignacion] })],
      }),
    );
    await emitir(o.id);
    await inventario.registrarMovimiento(auth, {
      varianteId,
      ubicacionId,
      tipo: 'ingreso',
      origen: 'compra',
      cantidad: 500,
      unidad: 'hoja',
      costoUnitario: 10,
    } as never);
    const m = await reservas.consultar(tenantId, a.o.id);
    await reservas.ejecutar(auth, a.o.id, {
      clave: randomUUID(),
      revision: m.revision,
      accion: 'reservar',
    });
    expect(
      (await reservas.consultar(tenantId, a.o.id)).control.materiales[0],
    ).toMatchObject({ reservada: 500, enCompra: 0 });
    await recibir(o.id, 1);
    expect(
      (await reservas.consultar(tenantId, a.o.id)).control.materiales[0],
    ).toMatchObject({ reservada: 500, libre: 500, enCompra: 0 });
  });
  it('al emitir revalida otras compras si entretanto se reservó parte del material', async () => {
    const a = await necesidad(1000);
    const l = linea({
      unidadCompra: 'HOJA',
      factorStock: 1,
      cantidad: 500,
      precio: 10,
      asignaciones: [{ ...a.asignacion, cantidad: 500 }],
    });
    const uno = await crear(payload({ lineas: [l] })),
      dos = await crear(payload({ lineas: [l] }));
    await inventario.registrarMovimiento(auth, {
      varianteId,
      ubicacionId,
      tipo: 'ingreso',
      origen: 'compra',
      cantidad: 400,
      unidad: 'hoja',
      costoUnitario: 10,
    } as never);
    const m = await reservas.consultar(tenantId, a.o.id);
    await reservas.ejecutar(auth, a.o.id, {
      clave: randomUUID(),
      revision: m.revision,
      accion: 'reservar',
    });
    await emitir(uno.id);
    await expect(emitir(dos.id)).rejects.toThrow('otra compra emitida');
  });
  it('sin reservar a mano: emisión → faltante → compra → recepción reservada para la OT', async () => {
    await reservas.guardarPolitica(tenantId, {
      habilitada: true,
      incluirConsumibles: false,
      modo: 'AL_EMITIR',
      version: 1,
    });
    await inventario.registrarMovimiento(auth, {
      varianteId,
      ubicacionId,
      tipo: 'ingreso',
      origen: 'compra',
      cantidad: 10,
      costoUnitario: 2,
    } as never);
    const { o, asignacion } = await necesidad(15, true);
    const needs = await service.necesidades(auth);
    expect(Number(needs.data[0].porCubrir)).toBe(5);
    const oc = await crear(
      payload({
        lineas: [
          linea({
            unidadCompra: 'HOJA',
            factorStock: 1,
            cantidad: 5,
            precio: 2,
            asignaciones: [{ ...asignacion, cantidad: 5 }],
          }),
        ],
      }),
    );
    await emitir(oc.id);
    await recibir(oc.id, 5, 5);
    const material = (await reservas.consultar(tenantId, o.id)).control
      .materiales[0];
    expect(material).toMatchObject({
      cantidad: 15,
      reservada: 15,
      fisico: 15,
      consumida: 0,
      faltante: 0,
      enCompra: 0,
    });
    expect(Number((await service.necesidades(auth)).data[0].porCubrir)).toBe(0);
  });
  describe('Previsión comercial antes de emitir (sólo lectura)', () => {
    const prevision = new PrevisionMaterialesService(prisma as never);
    const hoy = new Date('2026-09-18T15:00:00Z');
    const consultar = (cantidad = 20, consumible = false) =>
      prevision.consultar(
        tenantId,
        {
          pendientes: 0,
          materiales: [{ varianteId, cantidad, unidad: 'hoja', consumible }],
        },
        hoy,
      );
    it('estima faltantes con el plazo general y no crea OT, reserva ni compra', async () => {
      const before = await Promise.all([
        prisma.ordenTrabajo.count({ where: { tenantId } }),
        prisma.ordenCompra.count({ where: { tenantId } }),
        prisma.reservaMaterialOt.count({ where: { tenantId } }),
        prisma.necesidadMaterialOt.count({ where: { tenantId } }),
      ]);
      const result = await consultar();
      expect(result).toMatchObject({
        estado: 'requiere_compra',
        disponibleDesde: '2026-09-22',
      });
      expect(result.materiales[0]).toMatchObject({
        necesario: 20,
        libre: 0,
        faltante: 20,
        fuentes: [
          {
            tipo: 'plazo_proveedor',
            proveedor: 'Papelera',
            fecha: '2026-09-22',
            cantidad: 20,
          },
        ],
      });
      expect(JSON.stringify(result)).not.toMatch(
        /precio|costoPromedio|tenantId/,
      );
      expect(
        await Promise.all([
          prisma.ordenTrabajo.count({ where: { tenantId } }),
          prisma.ordenCompra.count({ where: { tenantId } }),
          prisma.reservaMaterialOt.count({ where: { tenantId } }),
          prisma.necesidadMaterialOt.count({ where: { tenantId } }),
        ]),
      ).toEqual(before);
    });
    it('agrupa productos y descuenta stock reservado para otras OT', async () => {
      const compra = await emitir((await crear()).id);
      await recibir(compra.id, 1);
      await necesidad(450);
      const result = await prevision.consultar(
        tenantId,
        {
          pendientes: 0,
          materiales: [30, 40].map((cantidad) => ({
            varianteId,
            cantidad,
            unidad: 'hoja',
            consumible: false,
          })),
        },
        hoy,
      );
      expect(result.materiales[0]).toMatchObject({
        necesario: 70,
        libre: 50,
        faltante: 20,
      });
      expect(result.materiales[0].fuentes[0]).toMatchObject({
        tipo: 'compra_estimada',
        cantidad: 20,
      });
      expect((await consultar(40)).estado).toBe('disponible');
    });
    it('no ofrece a la cotización las compras asignadas a otra OT y respeta recepción parcial', async () => {
      const n = await necesidad(800);
      const compra = await emitir(
        (
          await crear(
            payload({
              lineas: [
                linea({
                  asignaciones: [n.asignacion],
                  fechaConfirmada: '2026-09-21',
                }),
              ],
            }),
          )
        ).id,
      );
      await recibir(compra.id, 1);
      const result = await consultar(250);
      // 500 recibidas y reservadas a la OT; quedan 300 comprometidas + 200 libres por llegar.
      expect(result.materiales[0]).toMatchObject({
        libre: 0,
        faltante: 250,
        fuentes: [
          { tipo: 'compra_confirmada', cantidad: 200, fecha: '2026-09-21' },
          { tipo: 'plazo_proveedor', cantidad: 50, fecha: '2026-09-22' },
        ],
      });
    });
    it('una oferta específica reemplaza el plazo; cero es válido, null es desconocido', async () => {
      const f = await oferta({ reposicionDias: 0, reposicionTipo: 'CORRIDOS' });
      expect((await consultar()).disponibleDesde).toBe('2026-09-18');
      await oferta({
        version: f.version,
        reposicionDias: 3,
        reposicionTipo: 'CORRIDOS',
      });
      expect((await consultar()).disponibleDesde).toBe('2026-09-21');
      await prisma.ofertaCompra.updateMany({
        where: { tenantId },
        data: { activo: false },
      });
      await prisma.proveedor.update({
        where: { id: proveedorId },
        data: { reposicionDias: null },
      });
      expect(await consultar()).toMatchObject({
        estado: 'por_confirmar',
        disponibleDesde: null,
      });
    });
    it('compras vencidas o sin fecha no producen promesas de entrega', async () => {
      const compra = await emitir((await crear()).id);
      for (const fecha of [null, fechaCivil('2026-09-17')]) {
        await prisma.lineaOrdenCompra.updateMany({
          where: { ordenId: compra.id },
          data: { fechaEstimada: fecha, fechaConfirmada: null },
        });
        expect(await consultar()).toMatchObject({
          estado: 'por_confirmar',
          disponibleDesde: null,
          materiales: [{ fuentes: [{ tipo: 'sin_fecha', fecha: null }] }],
        });
      }
    });
    it('aísla variantes ajenas, detecta unidades incompatibles y cantidades no resueltas', async () => {
      for (const cambio of [
        { varianteId: randomUUID() },
        { unidad: 'kg' },
        { cantidad: null },
      ]) {
        const r = await prevision.consultar(
          tenantId,
          {
            pendientes: 0,
            materiales: [
              {
                varianteId,
                cantidad: 5,
                unidad: 'hoja',
                consumible: false,
                ...cambio,
              },
            ],
          },
          hoy,
        );
        expect(r).toMatchObject({
          estado: 'por_confirmar',
          disponibleDesde: null,
          materiales: [{ revisar: true }],
        });
      }
      expect(
        (
          await prevision.consultar(
            tenantId,
            { pendientes: 1, materiales: [] },
            hoy,
          )
        ).estado,
      ).toBe('por_confirmar');
    });
    it('respeta consumibles excluidos y tenants sin control', async () => {
      expect(await consultar(20, true)).toMatchObject({
        estado: 'disponible',
        materiales: [],
      });
      await prisma.politicaReservasMaterial.update({
        where: { tenantId },
        data: { habilitada: false },
      });
      expect(await consultar()).toMatchObject({
        estado: 'sin_control',
        materiales: [],
        disponibleDesde: null,
      });
    });
  });
});
