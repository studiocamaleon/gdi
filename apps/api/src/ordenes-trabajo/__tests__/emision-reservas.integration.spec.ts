import { DisponibilidadCotizacion } from '../../motor-universal/disponibilidad-materiales';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { contratoPropuesto } from '../../suscripciones/evaluador-capacidades';
import {
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
} from '../../plataforma/planes/catalogo-planes';
import { PrevisionMaterialesService } from '../../inventario/prevision-materiales.service';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InventarioService } from '../../inventario/inventario.service';
import { ReservasMaterialService } from '../../inventario/reservas-material.service';
import { ComprasService } from '../../compras/compras.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import { FidelizacionService } from '../../fidelizacion/fidelizacion.service';
import { DesarrolloDocumentalService } from '../../desarrollo-documental/desarrollo-documental.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CrearOrdenTrabajoDto } from '../dto/crear-orden-trabajo.dto';
import { EtaService } from '../../eta/eta.service';
import { calendarioDefault } from '../../eta/motor/estaciones-tipos';

// Emisión real (create/cambiarEstado), stock y compras en la DB aislada.
// Sólo se sustituyen servicios externos y el enriquecimiento de la respuesta.
describe('Emisión OT → reservas y necesidades de compras', () => {
  const db = new PrismaService();
  const inventario = new InventarioService(db);
  const capacidades = new CapacidadesEmpresaService(db);
  const reservas = new ReservasMaterialService(db, inventario, capacidades);
  const prevision = new PrevisionMaterialesService(db, capacidades);
  const actualOriginal = capacidades.actual.bind(capacidades);
  let contratoSimulado: ReturnType<typeof contratoPropuesto> | null = null;
  jest.spyOn(capacidades, 'actual').mockImplementation(async (tenantId, tx) => {
    const actual = await actualOriginal(tenantId, tx);
    return tenantId === auth.tenantId && contratoSimulado
      ? { ...actual, contrato: contratoSimulado }
      : actual;
  });
  const simularPlan = (indice: number) => {
    contratoSimulado = contratoPropuesto(
      PROPUESTA_PLANES[indice].contenido,
      VERSION_CATALOGO_PLANES,
    );
  };
  const compras = new ComprasService(db, inventario, reservas);
  const eta = new EtaService(
    db,
    {
      findEstaciones: async () => [
        {
          id: 'estacion-test',
          nombre: 'Estación',
          activo: true,
          capacidadConcurrente: 1,
          tiempoPreparacionMin: 0,
          calendario: calendarioDefault(),
          familias: ['trabajo_manual'],
          maquinas: [],
        },
      ],
      findDuracionesFamilias: async () => [
        { familiaCodigo: 'trabajo_manual', medianaMin: 540 },
      ],
      findDiasNoLaborables: async () => [{ fecha: '2099-09-23' }],
      getConfiguracion: async () => ({
        margenEtaDias: 1,
        tiempoEntrePasosMin: 0,
      }),
    } as never,
    capacidades,
  );
  const contextoOriginal = eta.contextoSimulacion.bind(eta);
  jest.spyOn(eta, 'contextoSimulacion').mockImplementation(async (...args) => ({
    ...(await contextoOriginal(...args)),
    ahora: new Date('2099-09-21T12:00:00Z'),
  }));
  const ordenes = new OrdenesTrabajoService(
    db,
    {
      capturarEmision: jest.fn(),
      sincronizarAsignaciones: jest.fn(),
      contextoSimulacion: (
        ...args: Parameters<EtaService['contextoSimulacion']>
      ) => eta.contextoSimulacion(...args),
    } as never,
    {} as never,
    { sincronizar: jest.fn() } as never,
    { emitir: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    { asegurarParaItem: jest.fn() } as never,
    new FidelizacionService(db, capacidades),
    new DesarrolloDocumentalService(
      db,
      {} as never,
      {} as never,
      undefined,
      capacidades,
    ),
    undefined,
    reservas,
    capacidades,
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
    contratoSimulado = null;
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

  const prepararConversion = async (cantidad = 2) => {
    simularPlan(2);
    const item = await db.cotizacionItem.findUniqueOrThrow({
      where: { id: payload.items[0].cotizacionItemId },
    });
    payload.cotizacionId = item.cotizacionId;
    payload.fechaEntrega = '2001-01-01';
    const traza = {
      pasos: [
        {
          activado: true,
          rutaPasoId: 'impresion',
          nombre: 'Impresión',
          familiaCodigo: 'trabajo_manual',
          tiempo: { totalMin: 540 },
          materiales: [],
        },
      ],
    };
    await db.cotizacionItem.update({
      where: { id: item.id },
      data: { trazabilidadJson: traza },
    });
    for (let i = 1; i < cantidad; i++) {
      const otro = await db.cotizacionItem.create({
        data: {
          tenantId: auth.tenantId,
          cotizacionId: item.cotizacionId,
          productoId: item.productoId,
          cantidad: 1,
          jobContextJson: {},
          snapshotJson: {},
          precioNetoTotal: 100,
          impuestosPorFueraTotal: 0,
          precioTotal: 100,
          trazabilidadJson: traza,
        },
      });
      payload.items.push({
        ...payload.items[0],
        cotizacionItemId: otro.id,
        nombre: `Documento ${i + 1}`,
      });
    }
    await db.cotizacion.update({
      where: { id: item.cotizacionId },
      data: { estado: 'aprobado', numero: 'PRES-TEST', total: 100 * cantidad },
    });
    return {
      conversionPresupuesto: {
        itemIds: payload.items.map((i) => i.cotizacionItemId),
      },
    };
  };

  it('convierte y emite todos los ítems juntos, recalcula con cola actual y cierra el presupuesto atómicamente', async () => {
    const opciones = await prepararConversion();
    const orden = await ordenes.create(auth, payload, opciones);
    expect(orden.estado).toBe('pendiente');
    expect(orden.fechaEmision).toBeInstanceOf(Date);
    const items = await db.ordenTrabajoItem.findMany({
      where: { ordenId: orden.id },
      orderBy: { ordenIndice: 'asc' },
      include: { pasos: true },
    });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.pasos.length > 0)).toBe(true);
    expect(
      items.every(
        (i) => i.fechaEntrega && i.fechaEntrega > new Date('2099-09-20'),
      ),
    ).toBe(true);
    expect(new Set(items.map((i) => i.fechaEntrega!.toISOString())).size).toBe(
      2,
    );
    expect(orden.fechaEntrega).toEqual(
      new Date(Math.max(...items.map((i) => i.fechaEntrega!.getTime()))),
    );
    expect(
      (
        await db.cotizacion.findUniqueOrThrow({
          where: { id: payload.cotizacionId },
        })
      ).estado,
    ).toBe('convertido');
    expect(
      await db.cotizacionEvento.count({
        where: { cotizacionId: payload.cotizacionId, tipo: 'convertido' },
      }),
    ).toBe(1);
    expect((await ordenes.create(auth, payload, opciones)).id).toBe(orden.id);
  });

  it('una conversión parcial posterior contempla la primera OT que ya ocupa el taller', async () => {
    const opciones = await prepararConversion();
    const primera = await ordenes.create(
      auth,
      { ...payload, items: [payload.items[0]] },
      opciones,
    );
    expect(
      (
        await db.cotizacion.findUniqueOrThrow({
          where: { id: payload.cotizacionId },
        })
      ).estado,
    ).toBe('aprobado');
    const segunda = await ordenes.create(
      auth,
      { ...payload, idempotencyKey: randomUUID(), items: [payload.items[1]] },
      opciones,
    );
    expect(segunda.fechaEntrega!.getTime()).toBeGreaterThan(
      primera.fechaEntrega!.getTime(),
    );
    expect(
      (
        await db.cotizacion.findUniqueOrThrow({
          where: { id: payload.cotizacionId },
        })
      ).estado,
    ).toBe('convertido');
  });

  it('no persiste OT, pasos ni cambio del presupuesto cuando la entrega no se puede estimar', async () => {
    const opciones = await prepararConversion(1);
    await db.cotizacionItem.update({
      where: { id: payload.items[0].cotizacionItemId },
      data: { trazabilidadJson: {} },
    });
    await expect(ordenes.create(auth, payload, opciones)).rejects.toThrow(
      'No se emitió la OT',
    );
    expect(
      await db.ordenTrabajo.count({ where: { tenantId: auth.tenantId } }),
    ).toBe(0);
    expect(
      await db.ordenTrabajoContador.count({
        where: { tenantId: auth.tenantId },
      }),
    ).toBe(0);
    expect(
      (
        await db.cotizacion.findUniqueOrThrow({
          where: { id: payload.cotizacionId },
        })
      ).estado,
    ).toBe('aprobado');
  });

  it('un plan sin ETA puede convertir y emitir con la fecha comercial vigente', async () => {
    const opciones = await prepararConversion(1);
    simularPlan(0);
    payload.fechaEntrega = '2099-12-31';
    const orden = await ordenes.create(auth, payload, opciones);
    expect(orden.estado).toBe('pendiente');
    expect(orden.fechaEntrega).toEqual(new Date('2099-12-31T00:00:00Z'));
  });

  it.each([7, null])('con reposición de %s días emite y reserva; sin plazo deja entrega por confirmar', async (dias) => {
    const opciones = await prepararConversion(1);
    const proveedor = await db.proveedor.create({
      data: {
        tenantId: auth.tenantId,
        nombre: 'Papelera QA',
        emailPrincipal: '',
        telefonoCodigo: '',
        telefonoNumero: '',
        paisCodigo: 'AR',
        reposicionDias: dias,
        reposicionTipo: 'CORRIDOS',
      },
    });
    await db.materiaPrimaVariante.update({
      where: { id: varianteId },
      data: { proveedorReferenciaId: proveedor.id },
    });
    await db.cotizacionItem.update({
      where: { id: payload.items[0].cotizacionItemId },
      data: {
        trazabilidadJson: {
          pasos: [
            {
              activado: true,
              rutaPasoId: 'impresion',
              nombre: 'Trabajo',
              familiaCodigo: 'trabajo_manual',
              tiempo: { totalMin: 540 },
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
    const orden = await ordenes.create(auth, payload, opciones);
    expect(orden.fechaEntrega).toEqual(dias === null ? null : new Date('2099-09-30T00:00:00Z'));
    const paso = await db.ordenTrabajoItemPaso.findFirstOrThrow({
      where: { ordenId: orden.id },
    });
    expect(paso.planificadoDesde).toEqual(dias === null ? null : new Date('2099-09-29T03:00:00Z'));
    expect(
      (await reservas.consultar(auth.tenantId, orden.id)).control.materiales[0],
    ).toMatchObject({ reservada: 10, faltante: 5 });
  });

  it.each(['AL_EMITIR', 'MANUAL'] as const)('revalida Sólo stock disponible antes de emitir con reservas %s', async (modo) => {
    const id = payload.items[0].cotizacionItemId!;
    const item = await db.cotizacionItem.findUniqueOrThrow({ where: { id } });
    const traza = item.trazabilidadJson as any;
    traza.pasos[0].materiales[0].seleccionStock = { politica: 'SOLO_DISPONIBLES', estado: 'disponible' };
    await db.cotizacionItem.update({ where: { id }, data: { trazabilidadJson: traza } });
    await reservas.guardarPolitica(auth.tenantId, { habilitada: true, incluirConsumibles: false, modo, version: 1 });
    await expect(ordenes.create(auth, payload)).rejects.toThrow('Sólo stock disponible');
    expect(await db.ordenTrabajo.count({ where: { tenantId: auth.tenantId } })).toBe(0);
    expect(await db.reservaMaterialOt.count({ where: { tenantId: auth.tenantId } })).toBe(0);
    expect((await db.cotizacionItem.findUniqueOrThrow({ where: { id } })).precioNetoTotal.toNumber()).toBe(100);
    traza.pasos[0].materiales[0].seleccionStock.politica = 'PREFERIR_DISPONIBLES';
    await db.cotizacionItem.update({ where: { id }, data: { trazabilidadJson: traza } });
    expect((await ordenes.create(auth, payload)).estado).toBe('pendiente');
  });

  it('dos conversiones simultáneas no emiten el mismo producto dos veces', async () => {
    const opciones = await prepararConversion(1);
    const resultados = await Promise.allSettled([
      ordenes.create(auth, payload, opciones),
      ordenes.create(
        auth,
        { ...payload, idempotencyKey: randomUUID() },
        opciones,
      ),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.ordenTrabajo.count({ where: { tenantId: auth.tenantId } }),
    ).toBe(1);
    expect(
      await db.cotizacionEvento.count({
        where: { cotizacionId: payload.cotizacionId, tipo: 'convertido' },
      }),
    ).toBe(1);
  });

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
  it('al editar una OT reconoce sus propias reservas sin liberar las de otras órdenes', async () => {
    const orden = await ordenes.create(auth, payload);
    const nueva = new DisponibilidadCotizacion(db, auth.tenantId);
    const misma = new DisponibilidadCotizacion(db, auth.tenantId, [], orden.id);
    expect(await nueva.evaluarCantidad(varianteId, 10, 'hoja')).toMatchObject({ libre: 0, alcanza: false });
    expect(await misma.evaluarCantidad(varianteId, 10, 'hoja')).toMatchObject({ libre: 10, alcanza: true });
    expect((await reservas.consultar(auth.tenantId, orden.id)).control.materiales[0].reservada).toBe(10);
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

  it.each(['directa', 'desde borrador'])(
    'Esencial permite emitir %s con política activa sin comprometer materiales',
    async (camino) => {
      simularPlan(0);
      const o = await ordenes.create(auth, {
        ...payload,
        estado: camino === 'directa' ? 'pendiente' : 'borrador',
      });
      if (camino !== 'directa')
        await ordenes.cambiarEstado(auth, o.id, { estado: 'pendiente' });
      const guardada = await db.ordenTrabajo.findUniqueOrThrow({
        where: { id: o.id },
      });
      expect(guardada.estado).toBe('pendiente');
      expect(guardada.materialesControlados).toBe(false);
      expect(guardada.fechaEntrega?.toISOString().slice(0, 10)).toBe(
        '2099-12-31',
      );
      for (const modelo of [
        db.necesidadMaterialOt,
        db.reservaMaterialOt,
        db.operacionReservasMaterial,
      ])
        expect(
          await (
            modelo.count as (args: {
              where: { tenantId: string };
            }) => Promise<number>
          )({ where: { tenantId: auth.tenantId } }),
        ).toBe(0);
      const saldo = await db.stockMateriaPrimaVariante.findFirstOrThrow({
        where: { tenantId: auth.tenantId, varianteId },
      });
      expect(Number(saldo.cantidadDisponible)).toBe(10);
      expect((await ordenes.create(auth, payload)).id).toBe(o.id);
    },
  );
  it('Pro conserva la reserva automática y el faltante en compras', async () => {
    simularPlan(1);
    const o = await ordenes.create(auth, payload);
    expect(
      (await reservas.consultar(auth.tenantId, o.id)).control.materiales[0],
    ).toMatchObject({ reservada: 10, faltante: 5 });
  });
  it('Esencial no consulta el faltante ni condiciona la fecha comercial y rechaza comandos de reserva', async () => {
    simularPlan(0);
    expect(
      await prevision.consultar(auth.tenantId, {
        materiales: [
          { varianteId, cantidad: 15, unidad: 'hoja', consumible: false },
        ],
        pendientes: 0,
      }),
    ).toMatchObject({
      estado: 'no_incluido',
      materiales: [],
      disponibleDesde: null,
    });
    const o = await ordenes.create(auth, payload);
    await expect(
      reservas.ejecutar(auth, o.id, {
        accion: 'reservar',
        clave: randomUUID(),
        revision: 'x',
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      reservas.guardarPolitica(auth.tenantId, { habilitada: true, version: 1 }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('no corrompe reservas históricas al retirar la función y permite liberarlas al cancelar', async () => {
    const o = await ordenes.create(auth, payload);
    simularPlan(0);
    await expect(
      db.$transaction((tx) =>
        reservas.sincronizarOrdenTx(tx, auth.tenantId, o.id),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await reservas.consultar(auth.tenantId, o.id)).control.materiales[0]
        .reservada,
    ).toBe(10);
    await db.$transaction((tx) =>
      reservas.cancelarOrdenTx(tx, auth.tenantId, o.id, auth),
    );
    expect(
      await db.reservaMaterialOt.count({
        where: { tenantId: auth.tenantId, cantidad: { gt: 0 } },
      }),
    ).toBe(0);
    expect(
      await db.necesidadMaterialOt.count({
        where: { tenantId: auth.tenantId, estado: 'CANCELADA' },
      }),
    ).toBe(1);
  });
});
