import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';
import { operacionesCambioPlan } from '../../plataforma/planes/operaciones-cambio-plan';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { InventarioService } from '../inventario.service';
import { ReservasMaterialService } from '../reservas-material.service';
import { PrevisionMaterialesService } from '../prevision-materiales.service';
import type { ComandoReservasDto } from '../dto/comando-reservas.dto';
import { OrdenesTrabajoService } from '../../ordenes-trabajo/ordenes-trabajo.service';
import { FidelizacionService } from '../../fidelizacion/fidelizacion.service';
import { DesarrolloDocumentalService } from '../../desarrollo-documental/desarrollo-documental.service';
import type { CrearOrdenTrabajoDto } from '../../ordenes-trabajo/dto/crear-orden-trabajo.dto';

const prisma = new PrismaService();
afterAll(() => prisma.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const pendiente = { response: { code: 'CAMBIO_PLAN_PENDIENTE' } };

async function preparar(c: Contexto) {
  const { id: tenantId } = await c.tx.tenant.create({
    data: { nombre: 'Reservas de prueba', slug: `reservas-${randomUUID()}` },
  });
  const auth = { ...c.auth, tenantId };
  const plan = await c.tx.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Prueba',
      precioMensual: 290,
      featuresJson: {},
    },
  });
  await c.tx.suscripcion.create({
    data: {
      tenantId,
      planId: plan.id,
      planVersionId: c.versiones[1].id,
      estado: 'activa',
      proveedor: 'manual',
    },
  });
  const oferta = await c.tx.planOferta.create({
    data: {
      planId: plan.id,
      versionId: c.versiones[0].id,
      entorno: 'sandbox',
      registroPublico: false,
      recomendado: false,
      creadaPorId: auth.userId,
      motivo: 'Prueba',
    },
  });
  const material = await c.tx.materiaPrima.create({
    data: {
      tenantId,
      codigo: 'PAPEL',
      nombre: 'Papel',
      familia: 'SUSTRATO',
      subfamilia: 'SUSTRATO_RIGIDO',
      tipoTecnico: 'test',
      templateId: 'test',
      unidadStock: 'HOJA',
      unidadCompra: 'RESMA',
      atributosTecnicosJson: {},
    },
  });
  const variante = await c.tx.materiaPrimaVariante.create({
    data: {
      tenantId,
      materiaPrimaId: material.id,
      sku: 'A4',
      atributosVarianteJson: {},
      unidadStock: 'HOJA',
      unidadCompra: 'RESMA',
    },
  });
  const almacen = await c.tx.almacenMateriaPrima.create({
    data: { tenantId, nombre: 'Depósito', codigo: 'D' },
  });
  const ubicacion = await c.tx.almacenMateriaPrimaUbicacion.create({
    data: { tenantId, almacenId: almacen.id, nombre: 'Principal', codigo: 'P' },
  });
  await c.tx.stockMateriaPrimaVariante.create({
    data: {
      tenantId,
      varianteId: variante.id,
      ubicacionId: ubicacion.id,
      cantidadDisponible: 10,
      costoPromedio: 2,
    },
  });
  const capacidades = new CapacidadesEmpresaService(c.db);
  const service = new ReservasMaterialService(
    c.db,
    new InventarioService(c.db),
    capacidades,
  );
  await service.guardarPolitica(tenantId, {
    habilitada: true,
    modo: 'AL_EMITIR',
    incluirConsumibles: false,
    version: 0,
  });
  const traza = (cantidad: number) => ({
    pasos: [
      {
        activado: true,
        rutaPasoId: 'impresion',
        materiales: [
          {
            materialVarianteId: variante.id,
            materialDisplayName: 'Papel',
            tipoLineaCosto: 'MATERIAL',
            cantidad,
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
  const orden = () =>
    c.tx.ordenTrabajo.create({
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
            cantidadUnidad: 'u',
            subtotal: 100,
            impuestos: 0,
            total: 100,
            trazabilidadSnapshotJson: traza(8),
          },
        },
      },
      include: { items: true },
    });
  const iniciar = (estado = 'checkout') =>
    c.tx.planContratacion.create({
      data: {
        tenantId,
        userId: auth.userId,
        ofertaId: oferta.id,
        ciclo: 'mensual',
        adicionales: 0,
        tipo: 'checkout',
        estado,
        huella: 'prueba',
        revisionContrato: 0,
        revisionJson: {},
        cobroJson: {},
        expiraEl: new Date(1),
      },
    });
  const emitir = (id: string) =>
    c.db.$transaction((tx) =>
      service.sincronizarOrdenTx(tx, tenantId, id, { alEmitir: true }),
    );
  const comando = async (id: string, extra: Partial<ComandoReservasDto> = {}) =>
    service.ejecutar(auth, id, {
      clave: randomUUID(),
      revision: (await service.consultar(tenantId, id)).revision,
      accion: 'reservar',
      ...extra,
    });
  const asignar = async (versionId: string) => {
    const d = await c.asignaciones.diagnostico({ tenantId, versionId });
    expect(d.bloqueos).toEqual([]);
    return c.asignaciones.asignar(c.staff, {
      tenantId,
      versionId,
      revision: d.actual.revision,
      huella: d.huella,
      motivo: 'Ensayo de continuidad',
      operacionId: randomUUID(),
      revisionesAceptadas: d.revisiones,
    });
  };
  return {
    tenantId,
    auth,
    variante,
    ubicacion,
    service,
    orden,
    emitir,
    comando,
    iniciar,
    traza,
    asignar,
  };
}

describe('Reservas y previsión con contratos publicados', () => {
  it.each(['directa', 'desde borrador'])(
    'la emisión %s revierte ante una retirada pendiente y vuelve a funcionar sin reservas al aplicar Esencial',
    (camino) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c);
        const categoria = await c.tx.productoCategoriaComercial.create({
          data: { codigo: randomUUID(), nombre: 'Ensayo' },
        });
        const sub = await c.tx.productoSubcategoriaComercial.create({
          data: {
            categoriaId: categoria.id,
            codigo: randomUUID(),
            nombre: 'Ensayo',
            atributosSchemaJson: {},
          },
        });
        const producto = await c.tx.producto.create({
          data: {
            tenantId: x.tenantId,
            subcategoriaComercialId: sub.id,
            codigo: 'DOC',
            nombre: 'Documento',
          },
        });
        const cotizacion = await c.tx.cotizacion.create({
          data: { tenantId: x.tenantId },
        });
        const item = await c.tx.cotizacionItem.create({
          data: {
            tenantId: x.tenantId,
            cotizacionId: cotizacion.id,
            productoId: producto.id,
            cantidad: 1,
            jobContextJson: {},
            snapshotJson: {},
            precioNetoTotal: 100,
            impuestosPorFueraTotal: 0,
            precioTotal: 100,
            trazabilidadJson: x.traza(8),
          },
        });
        const cliente = await c.tx.cliente.create({
          data: {
            tenantId: x.tenantId,
            nombre: 'Cliente',
            telefonoCodigo: '+54',
            telefonoNumero: '',
            paisCodigo: 'AR',
          },
        });
        const ordenes = new OrdenesTrabajoService(
          c.db,
          {
            capturarEmision: jest.fn(),
            sincronizarAsignaciones: jest.fn(),
          } as never,
          {} as never,
          { sincronizar: jest.fn() } as never,
          { emitir: jest.fn() } as never,
          {} as never,
          {} as never,
          {} as never,
          { asegurarParaItem: jest.fn() } as never,
          new FidelizacionService(c.db),
          new DesarrolloDocumentalService(c.db, {} as never, {} as never),
          undefined,
          x.service,
          new CapacidadesEmpresaService(c.db),
        );
        jest.spyOn(ordenes, 'findOne').mockImplementation(
          async (auth, id) =>
            (await c.tx.ordenTrabajo.findFirstOrThrow({
              where: { id, tenantId: auth.tenantId },
            })) as never,
        );
        const payload: CrearOrdenTrabajoDto = {
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
              cantidadUnidad: 'u',
              subtotal: 100,
              impuestos: 0,
              total: 100,
            },
          ],
        };
        const borrador =
          camino === 'desde borrador'
            ? await ordenes.create(x.auth, { ...payload, estado: 'borrador' })
            : null;
        const intento = await x.iniciar();
        const emitir = () =>
          borrador
            ? ordenes.cambiarEstado(x.auth, borrador.id, {
                estado: 'pendiente',
              })
            : ordenes.create(x.auth, payload);
        await expect(emitir()).rejects.toMatchObject(pendiente);
        expect(
          await c.tx.necesidadMaterialOt.count({
            where: { tenantId: x.tenantId },
          }),
        ).toBe(0);
        const guardadas = await c.tx.ordenTrabajo.findMany({
          where: { tenantId: x.tenantId },
        });
        expect(guardadas).toHaveLength(borrador ? 1 : 0);
        if (borrador) expect(guardadas[0].estado).toBe('borrador');
        await c.tx.planContratacion.update({
          where: { id: intento.id },
          data: { estado: 'rechazada' },
        });
        await x.asignar(c.versiones[0].id);
        const emitida = await emitir();
        expect(emitida).toMatchObject({
          estado: 'pendiente',
          materialesControlados: false,
        });
        expect(
          await c.tx.reservaMaterialOt.count({
            where: { tenantId: x.tenantId },
          }),
        ).toBe(0);
        expect(
          Number(
            (
              await c.tx.stockMateriaPrimaVariante.findFirstOrThrow({
                where: { tenantId: x.tenantId },
              })
            ).cantidadDisponible,
          ),
        ).toBe(10);
      }),
  );
  it.each(['enviando', 'checkout', 'verificar'])(
    'no crea necesidades durante %s; conserva consumo, liberación e idempotencia',
    (estado) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c);
        const anterior = await x.orden(),
          nueva = await x.orden();
        await x.emitir(anterior.id);
        const intento = await x.iniciar(estado);
        await expect(x.emitir(nueva.id)).rejects.toMatchObject(pendiente);
        await expect(x.comando(nueva.id)).rejects.toMatchObject(pendiente);
        await expect(
          x.service.guardarPolitica(x.tenantId, {
            version: 1,
            habilitada: true,
            modo: 'AL_EMITIR',
            incluirConsumibles: false,
          }),
        ).rejects.toMatchObject(pendiente);
        expect(
          await c.tx.necesidadMaterialOt.count({
            where: { tenantId: x.tenantId, ordenId: nueva.id },
          }),
        ).toBe(0);
        const consumo: ComandoReservasDto = {
          clave: randomUUID(),
          revision: (await x.service.consultar(x.tenantId, anterior.id))
            .revision,
          accion: 'consumir',
          varianteId: x.variante.id,
          ubicacionId: x.ubicacion.id,
          cantidad: 3,
        };
        await x.service.ejecutar(x.auth, anterior.id, consumo);
        await expect(
          x.service.ejecutar(x.auth, anterior.id, consumo),
        ).resolves.toMatchObject({ repetida: true });
        await x.comando(anterior.id, { accion: 'liberar' });
        expect(
          (await x.service.consultar(x.tenantId, anterior.id)).control
            .materiales[0],
        ).toMatchObject({ consumida: 3, reservada: 0, fisico: 7 });
        await c.tx.planContratacion.update({
          where: { id: intento.id },
          data: { estado: 'rechazada' },
        });
        await x.emitir(nueva.id);
        expect(
          (await x.service.consultar(x.tenantId, nueva.id)).control
            .materiales[0],
        ).toMatchObject({ reservada: 7, faltante: 1 });
      }),
  );

  it('cerrar reservas no incorpora una nueva cantidad del snapshot como efecto secundario', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c),
        o = await x.orden();
      await x.emitir(o.id);
      await c.tx.ordenTrabajoItem.update({
        where: { id: o.items[0].id },
        data: { trazabilidadSnapshotJson: x.traza(20) },
      });
      await x.iniciar();
      await x.comando(o.id, {
        accion: 'consumir',
        varianteId: x.variante.id,
        ubicacionId: x.ubicacion.id,
        cantidad: 2,
      });
      await x.comando(o.id, { accion: 'liberar' });
      const n = await c.tx.necesidadMaterialOt.findFirstOrThrow({
        where: { tenantId: x.tenantId, ordenId: o.id },
      });
      expect(Number(n.cantidad)).toBe(8);
      expect(Number(n.consumida)).toBe(2);
      expect(
        await c.tx.necesidadMaterialOt.count({
          where: { tenantId: x.tenantId },
        }),
      ).toBe(1);
    }));

  it('emitir sin reservas conserva la OT y no genera compromisos opcionales', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      await x.asignar(c.versiones[0].id);
      const o = await x.orden();
      await x.emitir(o.id);
      expect(
        await c.tx.necesidadMaterialOt.count({
          where: { tenantId: x.tenantId },
        }),
      ).toBe(0);
      expect(
        (await c.tx.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } }))
          .materialesControlados,
      ).toBe(false);
      await expect(x.comando(o.id)).rejects.toMatchObject({ status: 403 });
    }));

  it('la previsión funciona sin reservas ni política configurada y nunca modifica stock', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      const contenido = {
        ...structuredClone(PROPUESTA_PLANES[1].contenido),
        almacenamientoModo: 'limitado' as const,
        almacenamientoGb: 500,
      };
      contenido.funciones.reservas = false;
      const version = await c.publicar(contenido);
      await x.asignar(version.id);
      await c.tx.politicaReservasMaterial.delete({
        where: { tenantId: x.tenantId },
      });
      const prevision = new PrevisionMaterialesService(
        c.db,
        new CapacidadesEmpresaService(c.db),
      );
      const consultar = (cantidad: number) =>
        prevision.consultar(x.tenantId, {
          pendientes: 0,
          materiales: [
            {
              varianteId: x.variante.id,
              cantidad,
              unidad: 'hoja',
              consumible: false,
            },
          ],
        });
      expect(await consultar(8)).toMatchObject({
        estado: 'disponible',
        modoReserva: null,
        materiales: [{ libre: 10, faltante: 0 }],
      });
      expect(await consultar(15)).toMatchObject({
        estado: 'por_confirmar',
        modoReserva: null,
        disponibleDesde: null,
        materiales: [{ libre: 10, faltante: 5 }],
      });
      expect(
        await c.tx.necesidadMaterialOt.count({
          where: { tenantId: x.tenantId },
        }),
      ).toBe(0);
      expect(
        await c.tx.movimientoStockMateriaPrima.count({
          where: { tenantId: x.tenantId },
        }),
      ).toBe(0);
    }));

  it('retirar sólo la previsión no exige cerrar necesidades que conservan sus reservas', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c),
        o = await x.orden();
      await x.emitir(o.id);
      const soloPrevision = await operacionesCambioPlan(
        c.tx,
        x.tenantId,
        new Set(['prevision_materiales']),
      );
      expect(soloPrevision.every((p) => p.cantidad === 0)).toBe(true);
      const stock = await operacionesCambioPlan(
        c.tx,
        x.tenantId,
        new Set(['existencias']),
      );
      expect(
        stock.find((p) => p.codigo === 'necesidades_abiertas')?.cantidad,
      ).toBe(1);
      const contenido = {
        ...structuredClone(PROPUESTA_PLANES[1].contenido),
        almacenamientoModo: 'limitado' as const,
        almacenamientoGb: 500,
      };
      contenido.funciones.prevision_materiales = false;
      await x.asignar((await c.publicar(contenido)).id);
      await x.comando(o.id, {
        accion: 'consumir',
        varianteId: x.variante.id,
        ubicacionId: x.ubicacion.id,
        cantidad: 8,
      });
      expect(
        (await x.service.consultar(x.tenantId, o.id)).control.materiales[0]
          .consumida,
      ).toBe(8);
    }));

  it('una OT entregada no puede reabrir necesidades durante la retirada de reservas', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c),
        o = await x.orden();
      await x.emitir(o.id);
      await c.tx.ordenTrabajo.update({
        where: { id: o.id },
        data: { estado: 'entregada' },
      });
      await x.iniciar();
      await expect(
        c.db.$transaction((tx) =>
          x.service.exigirReaperturaTx(tx, x.tenantId, o.id),
        ),
      ).rejects.toMatchObject(pendiente);
      await x.comando(o.id, {
        accion: 'consumir',
        varianteId: x.variante.id,
        ubicacionId: x.ubicacion.id,
        cantidad: 8,
      });
      await expect(
        c.db.$transaction((tx) =>
          x.service.exigirReaperturaTx(tx, x.tenantId, o.id),
        ),
      ).resolves.toBeUndefined();
    }));
});
