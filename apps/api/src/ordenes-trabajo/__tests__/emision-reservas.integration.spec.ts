import { ReporteProduccionService } from '../../reportes/produccion.service';
import { FacturacionOrdenesService } from '../../administracion/facturacion-ordenes.service';
import { itemActivoTablero, itemTerminadoTablero } from '../tablero-consultas';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { DisponibilidadCotizacion } from '../../motor-universal/disponibilidad-materiales';
import { inicioSinStock } from '../../inventario/inicio-sin-stock';
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
import { UsuariosService } from '../../usuarios/usuarios.service';

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
    new FacturacionOrdenesService(db),
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

  async function prepararCopiadoListo() {
    const snapshot = await db.cotizacionItem.findUniqueOrThrow({
      where: { id: payload.items[0].cotizacionItemId },
    });
    await db.producto.update({
      where: { id: snapshot.productoId },
      data: { codigo: 'SYS-IMPRESION-DOC' },
    });
    const planta = await db.planta.create({ data: { tenantId: auth.tenantId, codigo: 'QA', nombre: 'Planta ficticia' } });
    const centro = await db.centroCosto.create({ data: { tenantId: auth.tenantId, plantaId: planta.id, codigo: 'QA', nombre: 'Copiado ficticio', tipoCentro: 'PRODUCTIVO' } });
    const traza = snapshot.trazabilidadJson as { pasos: Array<Record<string, unknown>> };
    const actualizado = await db.cotizacionItem.update({
      where: { id: snapshot.id },
      data: {
        trazabilidadJson: { ...traza, pasos: [...traza.pasos.map(p => ({ ...p, tiempo: { totalMin: 12, centroCostoId: centro.id, centroCostoNombre: centro.nombre } })), { activado: true, rutaPasoId: 'pouch', familiaCodigo: 'plastificado_pouch', tiempo: { totalMin: 3, centroCostoId: centro.id, centroCostoNombre: centro.nombre } }] },
        snapshotJson: {
          producto: { codigo: 'SYS-IMPRESION-DOC', nombre: 'Copias ficticias' },
        },
      },
    });
    payload.items[0].listoEnMostrador = true;
    return actualizado;
  }

  it.each(['directa', 'borrador'])(
    'producción finalizada: emisión %s registra pasos y tiempos sin cola y conserva precios y materiales',
    async (via) => {
      await prepararCopiadoListo();
      const creada = await ordenes.create(auth, {
        ...payload,
        estado: via === 'directa' ? 'pendiente' : 'borrador',
      });
      if (via === 'borrador') {
        const i = await db.ordenTrabajoItem.findFirstOrThrow({
          where: { ordenId: creada.id },
        });
        expect(i.listoEnMostrador).toBe(true);
        expect(i.listoEnMostradorEl).toBeNull();
        await ordenes.cambiarEstado(auth, creada.id, { estado: 'pendiente' });
      }
      const ot = await db.ordenTrabajo.findUniqueOrThrow({
        where: { id: creada.id },
        include: { items: true, pasos: { orderBy: { indice: 'asc' } } },
      });
      expect(ot.estado).toBe('finalizada');
      expect(ot.progresoPct).toBe(100);
      expect(ot.fechaFinalizada).not.toBeNull();
      expect(ot.fechaEntregada).toBeNull();
      expect(Number(ot.cobradoTotal)).toBe(0);
      expect(Number(ot.total)).toBe(100);
      expect(ot.items[0].cotizacionItemId).toBe(
        payload.items[0].cotizacionItemId,
      );
      expect(ot.items[0].listoEnMostradorEl).not.toBeNull();
      expect(ot.items[0].listoEnMostradorPorNombre).toBeTruthy();
      expect(ot.pasos).toHaveLength(2);
      expect(ot.pasos[0]).toMatchObject({ estado: 'hecho', tiempoFuente: 'estimado', completadoPorId: auth.userId, asignacionPersonalJson: null, asignacionManualJson: null });
      expect(Number(ot.pasos[0].duracionEstimadaMin)).toBe(12);
      expect(Number(ot.pasos[0].tiempoRealMin)).toBe(12);
      expect(ot.pasos[0].completadoEl).not.toBeNull();
      expect(ot.items[0].grafoProduccionSnapshotJson).toBeNull();
      expect(await db.ordenTrabajoPasoDependencia.count({ where: { ordenId: ot.id } })).toBe(0);
      expect(await db.ordenTrabajoPasoGate.count({ where: { ordenId: ot.id } })).toBe(0);
      expect(await db.ordenTrabajoPasoTramo.count({ where: { tenantId: auth.tenantId } })).toBe(0);
      // La lectura habitual muestra pasos hechos, sin crear una ruta operativa ni duplicarlos.
      const tablero = await ordenes.pasosDeOrden(auth, ot.id);
      expect(tablero.items[0]).toMatchObject({
        listoEnMostrador: true,
        sinRuta: false,
        pasos: [expect.objectContaining({ estado: 'hecho', tiempoRealMin: 12, tiempoFuente: 'estimado' }), expect.objectContaining({ estado: 'hecho', tiempoRealMin: 3, tiempoFuente: 'estimado' })],
      });
      expect(
        await db.ordenTrabajoItemPaso.count({ where: { ordenId: ot.id } }),
      ).toBe(2);
      expect(
        await db.ordenTrabajoItem.count({
          where: { ordenId: ot.id, ...itemActivoTablero },
        }),
      ).toBe(0);
      expect(
        await db.ordenTrabajoItem.count({
          where: { ordenId: ot.id, ...itemTerminadoTablero },
        }),
      ).toBe(1);
      // Los reportes reales incluyen el trabajo y la utilización, sin fingir mediciones.
      const hoy = new Date();
      const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
      const reporte = await new ReporteProduccionService(db).produccion(auth.tenantId, { desde: inicio, hasta: inicio, zona: 'UTC' });
      expect(reporte.throughput.reduce((total, dia) => total + dia.cantidad, 0)).toBe(2);
      expect(reporte.registroTiempos.fuentes).toEqual([{ fuente: 'estimado', pasos: 2, pct: 100 }]);
      expect(reporte.utilizacion).toEqual([expect.objectContaining({ centro: 'Copiado ficticio', horasReales: 0.25 })]);
      expect(reporte.kpis.trabajosEnCola).toBe(0);
      expect(reporte.eficiencia.porFamilia).toEqual([]);
      expect(reporte.registroTiempos.operadores).toEqual([]);
      const necesidad = await db.necesidadMaterialOt.findFirstOrThrow({
        where: { ordenId: ot.id },
      });
      expect(Number(necesidad.cantidad)).toBe(15);
      expect(Number(necesidad.consumida)).toBe(0); // Flujo de consumo explícito, igual al resto de OTs.
      expect(
        await db.movimientoStockMateriaPrima.count({
          where: { tenantId: auth.tenantId },
        }),
      ).toBe(1);
      await ordenes.create(auth, payload); // Reintento idempotente.
      expect(
        await db.ordenTrabajoEvento.count({
          where: { ordenId: ot.id, tipo: 'productos_listos' },
        }),
      ).toBe(1);
    },
  );

  it('la OT mixta deja pendiente sólo la producción sin marcar', async () => {
    const snapshot = await prepararCopiadoListo();
    const { id: _id, createdAt: _created, ...copia } = snapshot;
    void _id;
    void _created;
    const otro = await db.cotizacionItem.create({
      data: {
        ...copia,
        snapshotJson: { producto: { codigo: 'SYS-IMPRESION-DOC' } },
      } as never,
    });
    payload.items.push({
      ...payload.items[0],
      cotizacionItemId: otro.id,
      listoEnMostrador: false,
    });
    const ot = await ordenes.create(auth, payload);
    expect(ot.estado).toBe('pendiente');
    const items = await db.ordenTrabajoItem.findMany({
      where: { ordenId: ot.id },
      include: { pasos: true },
      orderBy: { ordenIndice: 'asc' },
    });
    expect(items[0].pasos).toHaveLength(2);
    expect(items[0].pasos[0].estado).toBe('hecho');
    expect(items[1].pasos[0].estado).toBe('pendiente');
    expect(items[0].listoEnMostradorEl).not.toBeNull();
    expect(items[1].pasos).toHaveLength(2);
    expect(items[1].listoEnMostradorEl).toBeNull();
    expect(Number(ot.total)).toBe(200);
    await expect((ordenes as any).aplicarAccionPaso(db, auth, ot.id, items[0].id, items[0].pasos[0].id, { accion: 'reabrir' })).rejects.toThrow('no tiene una ruta activa');
    await expect(
      ordenes.editarItem(auth, ot.id, items[1].id, {
        ...payload.items[1],
        listoEnMostrador: true,
      }),
    ).rejects.toThrow('antes de emitir');
    await expect(ordenes.quitarItem(auth, ot.id, items[0].id)).rejects.toThrow(
      'producción finalizada',
    );
  });

  it('rechaza listo para un producto común aunque el cliente falsifique el código', async () => {
    payload.items[0].listoEnMostrador = true;
    payload.items[0].codigo = 'SYS-IMPRESION-DOC';
    await expect(ordenes.create(auth, payload)).rejects.toThrow(
      'Sólo los ítems de Centro de copiado',
    );
    expect(
      await db.ordenTrabajo.count({ where: { tenantId: auth.tenantId } }),
    ).toBe(0);
  });

  it.each(['directa', 'borrador'])(
    'modo de inicio emite por vía %s sin stock ficticio ni demanda de compra',
    async (via) => {
      const activado = await reservas.guardarInicio(auth, {
        activo: true,
        version: 1,
      });
      const item = await db.cotizacionItem.findUniqueOrThrow({
        where: { id: payload.items[0].cotizacionItemId },
      });
      const traza = item.trazabilidadJson as any;
      traza.pasos[0].materiales[0].seleccionStock = {
        politica: 'SOLO_DISPONIBLES',
        estado: 'sin_verificar_inicio',
        alternativas: [],
      };
      await db.cotizacionItem.update({
        where: { id: item.id },
        data: { trazabilidadJson: traza },
      });
      const stockAntes = await db.stockMateriaPrimaVariante.findMany({
        where: { tenantId: auth.tenantId },
      });
      const movimientosAntes = await db.movimientoStockMateriaPrima.count({
        where: { tenantId: auth.tenantId },
      });
      const orden = await ordenes.create(auth, {
        ...payload,
        estado: via === 'directa' ? 'pendiente' : 'borrador',
      });
      if (via === 'borrador') {
        expect(orden.materialesInicioSinStock).toBe(false);
        await ordenes.cambiarEstado(auth, orden.id, { estado: 'pendiente' });
      }
      expect(
        await db.ordenTrabajo.findUnique({ where: { id: orden.id } }),
      ).toMatchObject({
        materialesInicioSinStock: true,
        materialesControlados: false,
        total: orden.total,
      });
      expect(
        (await reservas.consultar(auth.tenantId, orden.id)).control
          .inicioSinStock,
      ).toBe(true);
      expect((await compras.necesidades(auth)).total).toBe(0);
      expect(
        await db.necesidadMaterialOt.count({
          where: { tenantId: auth.tenantId },
        }),
      ).toBe(0);
      expect(
        await db.reservaMaterialOt.count({
          where: { tenantId: auth.tenantId },
        }),
      ).toBe(0);
      expect(
        await db.stockMateriaPrimaVariante.findMany({
          where: { tenantId: auth.tenantId },
        }),
      ).toEqual(stockAntes);
      expect(
        await db.movimientoStockMateriaPrima.count({
          where: { tenantId: auth.tenantId },
        }),
      ).toBe(movimientosAntes);
      await reservas.guardarInicio(auth, {
        activo: false,
        version: activado.version,
      });
      expect(await inicioSinStock(db, auth.tenantId, orden.id)).toBe(true);
      expect(await inicioSinStock(db, auth.tenantId)).toBe(false);
      await db.$transaction((tx) =>
        reservas.sincronizarOrdenTx(tx, auth.tenantId, orden.id),
      );
      const lectura = await reservas.consultar(auth.tenantId, orden.id);
      await expect(
        reservas.ejecutar(auth, orden.id, {
          clave: randomUUID(),
          revision: lectura.revision,
          accion: 'reservar',
        }),
      ).rejects.toThrow('modo de inicio');
      await expect(
        ordenes.create(auth, { ...payload, idempotencyKey: randomUUID() }),
      ).rejects.toThrow('Sólo stock disponible');
      expect(
        await db.eventoSistema.count({
          where: { tenantId: auth.tenantId, tipo: 'inventario.modo_inicio' },
        }),
      ).toBe(2);
    },
  );

  it('omite únicamente los gates materiales al emitir un borrador', async () => {
    await reservas.guardarInicio(auth, { activo: true, version: 1 });
    const orden = await ordenes.create(auth, {
      ...payload,
      estado: 'borrador',
    });
    const item = await db.ordenTrabajoItem.findFirstOrThrow({
      where: { tenantId: auth.tenantId, ordenId: orden.id },
    });
    const paso = await db.ordenTrabajoItemPaso.create({
      data: {
        tenantId: auth.tenantId,
        ordenId: orden.id,
        itemId: item.id,
        indice: 0,
        nombre: 'Control',
        familiaCodigo: 'trabajo_manual',
        categoriaFamilia: 'produccion',
      },
    });
    await db.ordenTrabajoPasoGate.createMany({
      data: ['MATERIAL', 'CALIDAD'].map((tipo) => ({
        tenantId: auth.tenantId,
        ordenId: orden.id,
        pasoId: paso.id,
        tipo,
      })),
    });
    await ordenes.cambiarEstado(auth, orden.id, { estado: 'pendiente' });
    const gates = await db.ordenTrabajoPasoGate.findMany({
      where: { pasoId: paso.id },
    });
    expect(gates.find((g) => g.tipo === 'MATERIAL')).toMatchObject({
      estado: 'OMITIDO_INICIO',
      resueltoEl: null,
      resueltoPorId: null,
    });
    expect(gates.find((g) => g.tipo === 'CALIDAD')).toMatchObject({
      estado: 'PENDIENTE',
    });
    await expect(
      ordenes.resolverGatePaso(auth, paso.id, {
        tipo: 'MATERIAL',
        estado: 'CUMPLIDO',
      }),
    ).rejects.toThrow('modo de inicio');
  });

  it('el modo de inicio no libera reservas de OTs anteriores y controla versiones', async () => {
    const anterior = await ordenes.create(auth, payload);
    await reservas.guardarInicio(auth, { activo: true, version: 1 });
    await expect(
      reservas.guardarInicio(auth, { activo: false, version: 1 }),
    ).rejects.toThrow('configuración cambió');
    expect(await inicioSinStock(db, auth.tenantId, anterior.id)).toBe(false);
    await db.$transaction((tx) =>
      reservas.sincronizarOrdenTx(tx, auth.tenantId, anterior.id),
    );
    expect(
      (await reservas.consultar(auth.tenantId, anterior.id)).control
        .materiales[0].reservada,
    ).toBe(10);
    expect(
      await db.ordenTrabajo.findUnique({ where: { id: anterior.id } }),
    ).toMatchObject({ materialesInicioSinStock: false });
  });

  it('previsión en modo de inicio no inventa disponibilidad ni espera proveedores', async () => {
    const consulta = {
      materiales: [
        { varianteId, cantidad: 15, unidad: 'hoja', consumible: false },
      ],
      pendientes: 0,
    };
    const antes = await prevision.consultar(auth.tenantId, consulta);
    expect(antes.estado).toBe('por_confirmar');
    const modo = await reservas.guardarInicio(auth, {
      activo: true,
      version: 1,
    });
    const durante = await prevision.consultar(auth.tenantId, consulta);
    expect(durante).toMatchObject({
      estado: 'inicio_sin_stock',
      materiales: [],
      modoReserva: null,
    });
    expect(durante.disponibleDesde).toBeTruthy();
    await reservas.guardarInicio(auth, {
      activo: false,
      version: modo.version,
    });
    expect((await prevision.consultar(auth.tenantId, consulta)).estado).toBe(
      'por_confirmar',
    );
    const ajena = randomUUID();
    await expect(
      inicioSinStock(db, ajena, (await ordenes.create(auth, payload)).id),
    ).rejects.toThrow('no encontrada');
  });

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

  it('conserva el desglose aprobado de cargos al convertir todo el presupuesto fiscal', async () => {
    const opciones = await prepararConversion(1);
    const cargo = { nombreSnapshot: 'Traslado ficticio', montoNeto: 200, impuestoMonto: 42, impuestoPorcentaje: 21, total: 242 };
    await db.cotizacion.update({ where: { id: payload.cotizacionId }, data: { total: 342, cargosDirectosCotizacionJson: [cargo] } });
    const orden = await ordenes.create(auth, payload, opciones);
    const persistida = await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } });
    expect(persistida.cargosDirectosJson).toEqual([cargo]);
    expect(Number(orden.cargosDirectos)).toBe(242);
    expect(Number(orden.total)).toBe(342);
  });

  it('una conversión parcial no hereda los cargos completos del presupuesto', async () => {
    const opciones = await prepararConversion(2);
    await db.cotizacion.update({ where: { id: payload.cotizacionId }, data: {
      total: 442,
      cargosDirectosCotizacionJson: [{ nombreSnapshot: 'Traslado ficticio', montoNeto: 200, impuestoMonto: 42, impuestoPorcentaje: 21, total: 242 }],
    } });
    const orden = await ordenes.create(auth, { ...payload, items: payload.items.slice(0, 1) }, opciones);
    const persistida = await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } });
    expect(persistida.cargosDirectosJson).toEqual([]);
    expect(Number(persistida.cargosDirectos)).toBe(0);
    expect(Number(persistida.total)).toBe(100);
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

  it('guardar y editar cargos en borrador no numera; emitir asigna la primera OT y conserva los cargos', async () => {
    const o = await ordenes.create(auth, { ...payload, estado: 'borrador' });
    expect(o.numero).toMatch(/^BORRADOR-/);
    expect(await db.ordenTrabajoContador.count({ where: { tenantId: auth.tenantId } })).toBe(0);
    expect(await db.ordenTrabajoEvento.count({ where: { ordenId: o.id, tipo: 'numero_asignado' } })).toBe(0);
    const cargo = await db.cargoDirectoCatalogo.create({ data: {
      tenantId: auth.tenantId, codigo: 'viatico', nombre: 'Viático de prueba', modoCalculo: 'MONTO_FIJO_PLANO',
      configJson: { zonas: [{ codigo: 'centro', nombre: 'Centro', monto: 500 }], impuestoPorcentaje: 21 },
    } });
    const editada = await ordenes.editarLote(auth, o.id, {
      expectedVersion: o.updatedAt.toISOString(),
      cargos: [{ cargoDirectoCatalogoId: cargo.id, configInput: { zonaAplicada: { codigo: 'centro' } }, montoNeto: 1 }],
    });
    expect(Number(editada.cargosDirectos)).toBe(605);
    expect(Number(editada.total)).toBe(705);
    expect(await db.ordenTrabajoContador.count({ where: { tenantId: auth.tenantId } })).toBe(0);
    await ordenes.cambiarEstado(auth, o.id, { estado: 'pendiente' });
    const emitida = await db.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } });
    expect(emitida.numero).toMatch(/^OT-\d{4}-0001$/);
    expect(Number(emitida.total)).toBe(705);
    expect(await db.ordenTrabajoEvento.count({ where: { ordenId: o.id, tipo: 'numero_asignado' } })).toBe(1);
    await expect(ordenes.cambiarEstado(auth, o.id, { estado: 'pendiente' })).rejects.toThrow();
    expect((await db.ordenTrabajoContador.findFirstOrThrow({ where: { tenantId: auth.tenantId } })).ultimo).toBe(1);
  });

  it('emisiones concurrentes de un borrador consumen un único número', async () => {
    const o = await ordenes.create(auth, { ...payload, estado: 'borrador' });
    const resultados = await Promise.allSettled([
      ordenes.cambiarEstado(auth, o.id, { estado: 'pendiente' }),
      ordenes.cambiarEstado(auth, o.id, { estado: 'pendiente' }),
    ]);
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.ordenTrabajoContador.findFirstOrThrow({ where: { tenantId: auth.tenantId } })).ultimo).toBe(1);
  });

  it('un fallo de emisión revierte el número y permite reintentar sin saltos', async () => {
    const o = await ordenes.create(auth, { ...payload, estado: 'borrador' });
    const fallo = jest.spyOn(ordenes as any, 'materializarPasosItems').mockRejectedValueOnce(new Error('Fallo simulado'));
    await expect(ordenes.cambiarEstado(auth, o.id, { estado: 'pendiente' })).rejects.toThrow('Fallo simulado');
    expect(await db.ordenTrabajoContador.count({ where: { tenantId: auth.tenantId } })).toBe(0);
    expect((await db.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } })).numero).toMatch(/^BORRADOR-/);
    fallo.mockRestore();
    await ordenes.cambiarEstado(auth, o.id, { estado: 'pendiente' });
    expect((await db.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } })).numero).toMatch(/-0001$/);
  });

  it('conserva los números asignados a borradores históricos', async () => {
    const o = await ordenes.create(auth, { ...payload, estado: 'borrador' });
    await db.ordenTrabajo.update({ where: { id: o.id }, data: { numero: 'OT-2020-0040' } });
    await ordenes.cambiarEstado(auth, o.id, { estado: 'pendiente' });
    expect((await db.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } })).numero).toBe('OT-2020-0040');
    expect(await db.ordenTrabajoContador.count({ where: { tenantId: auth.tenantId } })).toBe(0);
  });

  it.each(['borrador', 'pendiente', 'produccion', 'finalizada', 'entregada'])('permite agregar y quitar cargos en %s con historial y sin alterar productos', async estado => {
    const o = await ordenes.create(auth, { ...payload, estado: 'borrador' });
    const actual = await db.ordenTrabajo.update({ where: { id: o.id }, data: { estado } });
    const cargo = await db.cargoDirectoCatalogo.create({ data: {
      tenantId: auth.tenantId, codigo: 'entrega', nombre: 'Entrega', modoCalculo: 'MONTO_FIJO_PLANO', configJson: {},
    } });
    const entrada = { cargoDirectoCatalogoId: cargo.id, configInput: {}, montoNeto: 100 };
    const editada = await ordenes.editarLote(auth, o.id, { expectedVersion: actual.updatedAt.toISOString(), cargos: [entrada] });
    expect(Number(editada.total)).toBe(221);
    const conservado = (editada.cargosDirectosJson as any[])[0];
    // El catálogo puede cambiar; un cargo conservado no se revaloriza ni acepta importes adulterados.
    await db.cargoDirectoCatalogo.update({ where: { id: cargo.id }, data: { activo: false } });
    const intacta = await ordenes.editarLote(auth, o.id, { expectedVersion: editada.updatedAt.toISOString(), cargos: [{ ...entrada, id: conservado.id, montoNeto: 1 }] });
    expect(Number(intacta.total)).toBe(221);
    const quitada = await ordenes.editarLote(auth, o.id, { expectedVersion: intacta.updatedAt.toISOString(), cargos: [] });
    expect(Number(quitada.total)).toBe(100);
    expect(Number(quitada.cargosDirectos)).toBe(0);
    expect(quitada.cargosDirectosJson).toEqual([]);
    expect(await db.ordenTrabajoItem.count({ where: { ordenId: o.id } })).toBe(1);
    expect(await db.ordenTrabajoEvento.count({ where: { ordenId: o.id, tipo: 'modificacion' } })).toBe(3);
  });

  it('rechaza cambios de cargos con factura, versión vieja, ID ajeno, duplicados o total inferior a cobros', async () => {
    const o = await ordenes.create(auth, { ...payload, estado: 'borrador' });
    const cargo = await db.cargoDirectoCatalogo.create({ data: {
      tenantId: auth.tenantId, codigo: 'entrega', nombre: 'Entrega', modoCalculo: 'MONTO_FIJO_PLANO', configJson: {},
    } });
    const entrada = { cargoDirectoCatalogoId: cargo.id, configInput: {}, montoNeto: 100 };
    await expect(ordenes.editarLote(auth, o.id, { expectedVersion: '2000-01-01T00:00:00Z', cargos: [entrada] })).rejects.toThrow('cambió');
    await expect(ordenes.editarLote(auth, o.id, { expectedVersion: o.updatedAt.toISOString(), cargos: [{ ...entrada, id: randomUUID() }] })).rejects.toThrow('no pertenece');
    await expect(ordenes.editarLote(auth, o.id, { expectedVersion: o.updatedAt.toISOString(), cargos: [entrada, entrada] })).rejects.toThrow('dos veces');
    await expect(ordenes.editarLote(auth, o.id, { expectedVersion: o.updatedAt.toISOString(), cargos: [{ ...entrada, cargoDirectoCatalogoId: randomUUID() }] })).rejects.toThrow('no existe');
    const facturada = await db.ordenTrabajo.update({ where: { id: o.id }, data: { facturadoTotal: 10 } });
    await expect(ordenes.editarLote(auth, o.id, { expectedVersion: facturada.updatedAt.toISOString(), cargos: [entrada] })).rejects.toThrow('facturación');
    const cobrada = await db.ordenTrabajo.update({ where: { id: o.id }, data: { facturadoTotal: 0, cobradoTotal: 300 } });
    await expect(ordenes.editarLote(auth, o.id, { expectedVersion: cobrada.updatedAt.toISOString(), cargos: [entrada] })).rejects.toThrow('debajo de lo cobrado');
    const intacta = await db.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } });
    expect(Number(intacta.total)).toBe(100);
    expect(intacta.cargosDirectosJson).toEqual([]);
  });

  it('atribuye las nuevas OT y presupuestos al administrador vinculado y conserva las ventas al desvincularlo', async () => {
    const membership = await db.membership.create({
      data: { tenantId: auth.tenantId, userId: auth.userId, rol: 'ADMINISTRADOR' },
    });
    const empleado = await db.empleado.create({
      data: {
        tenantId: auth.tenantId, nombreCompleto: 'Ana Administradora Demo',
        emailPrincipal: 'ana@example.invalid', telefonoCodigo: '', telefonoNumero: '',
        sector: 'Comercial', fechaIngreso: new Date('2026-01-01'),
      },
    });
    const usuarios = new UsuariosService(db, { invalidarTenant: jest.fn() } as never, {} as never);
    await usuarios.editar(auth, auth.userId, { empleadoId: empleado.id });
    expect(await db.membership.findUnique({ where: { id: membership.id } })).toMatchObject({ rol: 'ADMINISTRADOR', activa: true });

    const orden = await ordenes.create(auth, { ...payload, estado: 'borrador' });
    expect(await db.ordenTrabajo.findUnique({ where: { id: orden.id } })).toMatchObject({ vendedorEmpleadoId: empleado.id });
    const snapshot = await db.cotizacionItem.findUniqueOrThrow({ where: { id: payload.items[0].cotizacionItemId } });
    const presupuestos = Object.assign(Object.create(PresupuestosService.prototype), {
      prisma: db, ordenes, capacidades, fidelizacion: new FidelizacionService(db, capacidades), nombreCache: new Map(),
      detalle: (_auth: CurrentAuth, id: string) => db.cotizacion.findUniqueOrThrow({ where: { id } }),
    }) as PresupuestosService;
    const presupuesto = await presupuestos.guardarBorrador(auth, {
      cotizacionId: snapshot.cotizacionId, clienteId: payload.clienteId!, canalVenta: 'mostrador', items: payload.items,
    });
    expect(presupuesto).toMatchObject({ vendedorEmpleadoId: empleado.id });
    await usuarios.editar(auth, auth.userId, { empleadoId: null });
    expect(await db.empleado.findUnique({ where: { id: empleado.id } })).toMatchObject({ userId: null });
    expect(await db.ordenTrabajo.findUnique({ where: { id: orden.id } })).toMatchObject({ vendedorEmpleadoId: empleado.id });
    expect(await db.cotizacion.findUnique({ where: { id: presupuesto.id } })).toMatchObject({ vendedorEmpleadoId: empleado.id });
    expect(await db.eventoAcceso.count({ where: { tenantId: auth.tenantId, tipo: { in: ['empleado_vinculado', 'empleado_desvinculado'] } } })).toBe(2);
  });

  it('guarda el presupuesto con productos y cargos sin crear OT, enlaces ni envíos', async () => {
    const snapshot = await db.cotizacionItem.findUniqueOrThrow({ where: { id: payload.items[0].cotizacionItemId } });
    const enviar = jest.fn();
    const servicio = Object.assign(Object.create(PresupuestosService.prototype), {
      prisma: db, ordenes, capacidades, fidelizacion: new FidelizacionService(db, capacidades), enviar, nombreCache: new Map(),
      detalle: (_auth: CurrentAuth, id: string) => db.cotizacion.findUniqueOrThrow({ where: { id } }),
    }) as PresupuestosService;
    const resultado = await servicio.guardarBorrador(auth, {
      cotizacionId: snapshot.cotizacionId, clienteId: payload.clienteId!, canalVenta: 'mostrador', items: payload.items,
    });
    expect(resultado).toMatchObject({ estado: 'borrador', fechaEmision: null, fechaEnvio: null, fechaValidez: null, publicToken: null });
    expect(resultado.numero).toMatch(/^PRES-/);
    expect(Number(resultado.total)).toBe(100);
    expect(enviar).not.toHaveBeenCalled();
    expect(await db.ordenTrabajo.count({ where: { tenantId: auth.tenantId } })).toBe(0);
    expect(await db.ordenTrabajoContador.count({ where: { tenantId: auth.tenantId } })).toBe(0);
    await expect(servicio.guardarBorrador(auth, { cotizacionId: snapshot.cotizacionId, clienteId: payload.clienteId!, canalVenta: 'mostrador', items: payload.items })).rejects.toThrow('ya es el presupuesto');
    expect((await db.cotizacionContador.findFirstOrThrow({ where: { tenantId: auth.tenantId } })).ultimo).toBe(1);
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
  async function snapshotExtra(nombre = 'PVC') {
    const anterior = await db.cotizacionItem.findUniqueOrThrow({ where: { id: payload.items[0].cotizacionItemId } });
    const { id, createdAt, updatedAt, ...datos } = anterior;
    const revision = await db.cotizacion.create({ data: { tenantId: auth.tenantId } });
    const nuevo = await db.cotizacionItem.create({ data: {
      ...datos, cotizacionId: revision.id, snapshotJson: { producto: { nombre, codigo: 'PVC' } },
      trazabilidadJson: anterior.trazabilidadJson as never,
      precioConfigSnapshotJson: undefined, impuestosSnapshotJson: undefined,
      comisionesSnapshotJson: undefined, precioEspecialClienteSnapshotJson: undefined,
    } as never });
    return { ...payload.items[0], cotizacionItemId: nuevo.id, nombre, codigo: 'PVC' };
  }
  async function enProduccion() {
    const creada = await ordenes.create(auth, payload);
    const item = await db.ordenTrabajoItem.findFirstOrThrow({ where: { ordenId: creada.id } });
    await db.ordenTrabajoItemPaso.updateMany({ where: { itemId: item.id }, data: { estado: 'en_curso', iniciadoEl: new Date() } });
    const orden = await db.ordenTrabajo.update({ where: { id: creada.id }, data: { estado: 'produccion' } });
    return { orden, item };
  }
  it('agrega PVC en producción y conserva íntegros los pasos y componentes ya iniciados', async () => {
    const { orden, item } = await enProduccion();
    const hijo = await db.ordenTrabajoItem.create({ data: { tenantId: auth.tenantId, ordenId: orden.id, parentItemId: item.id, codigo: 'HIJO', nombre: 'Componente', familia: 'Interno', cantidad: 1, cantidadUnidad: 'u', subtotal: 0, impuestos: 0, total: 0, ordenIndice: 0 } });
    const pasos = await db.ordenTrabajoItemPaso.findMany({ where: { itemId: item.id } });
    await ordenes.editarLote(auth, orden.id, { expectedVersion: orden.updatedAt.toISOString(), items: [
      { ...payload.items[0], id: item.id, conservar: true, nombre: 'Intento ignorado' }, await snapshotExtra(),
    ] });
    expect(await db.ordenTrabajoItemPaso.findMany({ where: { itemId: item.id } })).toEqual(pasos);
    expect(await db.ordenTrabajoItem.findUnique({ where: { id: hijo.id } })).not.toBeNull();
    expect((await db.ordenTrabajoItem.findUniqueOrThrow({ where: { id: item.id } })).nombre).toBe(item.nombre);
    const pvc = await db.ordenTrabajoItem.findFirstOrThrow({ where: { ordenId: orden.id, codigo: 'PVC' } });
    expect(await db.ordenTrabajoItemPaso.count({ where: { itemId: pvc.id, estado: 'pendiente' } })).toBeGreaterThan(0);
    expect(Number((await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } })).total)).toBe(200);
  });
  it('reemplaza un producto sin iniciar en producción, sin reescribir otro iniciado', async () => {
    const { orden, item } = await enProduccion();
    await ordenes.agregarItem(auth, orden.id, await snapshotExtra('Vinilo'));
    const vinilo = await db.ordenTrabajoItem.findFirstOrThrow({ where: { ordenId: orden.id, nombre: 'Vinilo' } });
    const hijo = await db.ordenTrabajoItem.create({ data: { tenantId: auth.tenantId, ordenId: orden.id, parentItemId: vinilo.id, codigo: 'HIJO', nombre: 'Componente viejo', familia: 'Interno', cantidad: 1, cantidadUnidad: 'u', subtotal: 0, impuestos: 0, total: 0, ordenIndice: 1 } });
    const archivo = await db.archivo.create({ data: { tenantId: auth.tenantId, scope: 'ORDEN_ITEM', ordenItemId: hijo.id, key: `ficticio/${randomUUID()}`, nombreOriginal: 'arte-ficticio.pdf', mimeType: 'application/pdf' } });
    await ordenes.editarItem(auth, orden.id, vinilo.id, await snapshotExtra('PVC'));
    expect(await db.ordenTrabajoItem.findUnique({ where: { id: hijo.id } })).toBeNull();
    expect((await db.archivo.findUniqueOrThrow({ where: { id: archivo.id } })).ordenItemId).toBe(vinilo.id);
    expect((await db.ordenTrabajoItem.findUniqueOrThrow({ where: { id: vinilo.id } })).nombre).toBe('PVC');
    expect(await db.ordenTrabajoItemPaso.count({ where: { itemId: item.id, estado: 'en_curso' } })).toBeGreaterThan(0);
    await ordenes.quitarItem(auth, orden.id, vinilo.id);
    expect(await db.ordenTrabajoItem.findUnique({ where: { id: vinilo.id } })).toBeNull();
  });
  it('rechaza modificar, quitar o reemplazar en lote un producto iniciado y revierte todo', async () => {
    const { orden, item } = await enProduccion();
    const nuevo = await snapshotExtra();
    await expect(ordenes.editarItem(auth, orden.id, item.id, nuevo)).rejects.toThrow('trabajo iniciado');
    await expect(ordenes.editarLote(auth, orden.id, { expectedVersion: orden.updatedAt.toISOString(), items: [nuevo] })).rejects.toThrow('trabajo iniciado');
    expect(await db.ordenTrabajoItem.count({ where: { ordenId: orden.id } })).toBe(1);
    expect((await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } })).updatedAt).toEqual(orden.updatedAt);
  });
  it('bloquea agregar a una OT facturada y conserva importes cobrados', async () => {
    const { orden, item } = await enProduccion();
    const nuevo = await snapshotExtra();
    await db.ordenTrabajo.update({ where: { id: orden.id }, data: { facturadoTotal: 1 } });
    await expect(ordenes.agregarItem(auth, orden.id, nuevo)).rejects.toThrow('facturación');
    await db.ordenTrabajo.update({ where: { id: orden.id }, data: { facturadoTotal: 0 } });
    await ordenes.agregarItem(auth, orden.id, nuevo);
    const pvc = await db.ordenTrabajoItem.findFirstOrThrow({ where: { ordenId: orden.id, codigo: 'PVC' } });
    await db.ordenTrabajo.update({ where: { id: orden.id }, data: { cobradoTotal: 200 } });
    await expect(ordenes.quitarItem(auth, orden.id, pvc.id)).rejects.toThrow(/cobrad/);
    expect(await db.ordenTrabajoItem.count({ where: { ordenId: orden.id } })).toBe(2);
  });

  it.each(['componente', 'tanda', 'compra'])('protege el producto con %s aunque su paso propio siga pendiente', async (caso) => {
    const creada = await ordenes.create(auth, payload);
    const item = await db.ordenTrabajoItem.findFirstOrThrow({ where: { ordenId: creada.id } });
    let itemId = item.id;
    if (caso === 'componente') {
      itemId = (await db.ordenTrabajoItem.create({ data: { tenantId: auth.tenantId, ordenId: creada.id, parentItemId: item.id, codigo: 'HIJO', nombre: 'Componente', familia: 'Interno', cantidad: 1, cantidadUnidad: 'u', subtotal: 0, impuestos: 0, total: 0, ordenIndice: 0 } })).id;
      await db.ordenTrabajoItemPaso.create({ data: { tenantId: auth.tenantId, ordenId: creada.id, itemId, indice: 0, nombre: 'Trabajo hijo', familiaCodigo: 'manual', categoriaFamilia: 'manual', estado: 'hecho', completadoEl: new Date() } });
    } else await db.ordenTrabajoItemPaso.updateMany({ where: { itemId }, data: caso === 'tanda' ? { nestingLoteId: 'tanda-ficticia' } : { estadoCompra: 'pedido' } });
    await expect(ordenes.editarItem(auth, creada.id, item.id, await snapshotExtra())).rejects.toThrow(caso === 'tanda' ? 'tanda compartida' : 'trabajo iniciado');
    expect(await db.ordenTrabajoItem.findUnique({ where: { id: itemId } })).not.toBeNull();
  });
  it('no agrega productos con una factura agrupada preparada aunque el total facturado siga en cero', async () => {
    const { orden } = await enProduccion();
    const cfg = await db.configuracionFiscal.create({ data: { tenantId: auth.tenantId, razonSocial: 'Empresa ficticia', cuit: '00000000000' } });
    const pv = await db.puntoVenta.create({ data: { tenantId: auth.tenantId, configuracionFiscalId: cfg.id, numero: 1, nombre: 'Ensayo', modalidad: 'manual' } });
    await db.comprobante.create({ data: { tenantId: auth.tenantId, tipo: 'factura', letra: 'B', puntoVentaId: pv.id, fecha: new Date(), receptorSnapshot: {}, itemsJson: [], ivaPorAlicuota: [], netoGravado: 100, total: 100, idempotencyKey: randomUUID(), estado: 'borrador', ordenes: { create: { tenantId: auth.tenantId, ordenId: orden.id, monto: 100 } } } });
    await expect(ordenes.agregarItem(auth, orden.id, await snapshotExtra())).rejects.toThrow('facturación');
    expect(await db.ordenTrabajoItem.count({ where: { ordenId: orden.id } })).toBe(1);
  });

});
