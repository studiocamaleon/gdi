import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { CapacidadGuard } from '../suscripciones/capacidad.guard';
import { PermisosGuard } from '../auth/permisos.guard';
import type { CurrentAuth } from '../auth/auth.types';
import { PlanificacionEntregasController } from './planificacion.controller';
import { PlanificacionCotizacionController } from './planificacion-cotizacion.controller';
import { PrismaService } from '../prisma/prisma.service';
import { conPlanesAsignados } from '../../test/soporte-planes-asignados';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { PlanificacionEntregasService } from './planificacion.service';
import type { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import type { EtaService } from '../eta/eta.service';
import type { CotizarInput, CotizarOutput } from '../motor-universal/tipos';
import { cotizacionesExhibidor } from '../../test/fixtures/f6-planificacion/cotizaciones-exhibidor';
import { exhibidorControlado } from '../../test/fixtures/f6-planificacion/exhibidor-controlado';

const prisma = new PrismaService();
afterAll(() => prisma.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const pendiente = { response: { code: 'CAMBIO_PLAN_PENDIENTE' } };

async function preparar(c: Contexto) {
  const { id: tenantId } = await c.tx.tenant.create({
    data: { nombre: 'Planificación de prueba', slug: `planes-${randomUUID()}` },
  });
  const auth = { ...c.auth, tenantId };
  const plan = await c.tx.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Ensayo',
      precioMensual: 690,
      featuresJson: {},
    },
  });
  await c.tx.suscripcion.create({
    data: {
      tenantId,
      planId: plan.id,
      planVersionId: c.versiones[2].id,
      estado: 'activa',
      proveedor: 'manual',
    },
  });
  const oferta = await c.tx.planOferta.create({
    data: {
      planId: plan.id,
      versionId: c.versiones[1].id,
      entorno: 'sandbox',
      registroPublico: false,
      recomendado: false,
      creadaPorId: auth.userId,
      motivo: 'Prueba',
    },
  });
  const categoria = await c.tx.productoCategoriaComercial.create({
    data: { codigo: randomUUID(), nombre: 'Ensayo' },
  });
  const subcategoria = await c.tx.productoSubcategoriaComercial.create({
    data: {
      categoriaId: categoria.id,
      codigo: randomUUID(),
      nombre: 'Ensayo',
      atributosSchemaJson: {},
    },
  });
  const producto = await c.tx.producto.create({
    data: {
      tenantId,
      subcategoriaComercialId: subcategoria.id,
      codigo: 'EXH',
      nombre: 'Exhibidor',
    },
  });
  const cotizacion = await c.tx.cotizacion.create({ data: { tenantId } });
  const cotizacionItem = await c.tx.cotizacionItem.create({
    data: {
      tenantId,
      cotizacionId: cotizacion.id,
      productoId: producto.id,
      cantidad: 200,
      jobContextJson: { cantidad: 200 },
      snapshotJson: {},
    },
  });
  const orden = await c.tx.ordenTrabajo.create({
    data: { tenantId, numero: randomUUID(), estado: 'pendiente' },
  });
  const item = await c.tx.ordenTrabajoItem.create({
    data: {
      tenantId,
      ordenId: orden.id,
      cotizacionItemId: cotizacionItem.id,
      codigo: 'EXH',
      nombre: 'Exhibidor',
      familia: 'Ensayo',
      cantidad: 200,
      cantidadUnidad: 'u',
      subtotal: 1000,
      impuestos: 210,
      total: 1210,
    },
  });
  const fuentes = cotizacionesExhibidor(),
    base = exhibidorControlado().taller;
  const pasos = [
    ...fuentes[0].cotizacion.pasos,
    ...fuentes[0].cotizacion.componentesFabricados!.flatMap((h) => h.pasos!),
  ].filter((p) => p.activado);
  const taller = {
    ...base,
    ahora: new Date('2026-09-09T08:00:00-03:00'),
    items: [],
    margenEtaDias: 1,
    estaciones: pasos.map((p) => ({
      ...base.estaciones[0],
      id: p.familiaCodigo,
      equipoProduccion: {
        ...base.estaciones[0].equipoProduccion!,
        id: `equipo-${p.familiaCodigo}`,
      },
      familias: [p.familiaCodigo],
      maquinas: p.tiempo?.maquinaId
        ? [
            {
              id: p.tiempo.maquinaId,
              centroCostoId: p.tiempo.centroCostoId ?? null,
            },
          ]
        : [],
    })),
  };
  const capacidades = new CapacidadesEmpresaService(c.db);
  const produccion = {
    sincronizarLotesEntrega: jest.fn(),
    prepararRecorridosDeItems: jest.fn(),
  };
  const service = new PlanificacionEntregasService(
    c.db,
    {
      contextoSimulacion: () => Promise.resolve(taller),
    } as unknown as EtaService,
    produccion as unknown as OrdenesTrabajoService,
    capacidades,
  );
  const cotizar = jest.fn(
    (input: CotizarInput): Promise<CotizarOutput> =>
      Promise.resolve({
        exitoso: true,
        errores: [],
        cotizacion: {
          ...fuentes.find(
            (f) =>
              f.cotizacion.cantidadPedida === Number(input.jobContext.cantidad),
          )!.cotizacion,
          productoId: producto.id,
        },
      }),
  );
  const solicitud = () => ({
    expectedVersion: 0,
    idempotencyKey: randomUUID(),
    entregas: [1, 2, 3, 4].map((i) => ({
      clave: `entrega-${i}`,
      cantidad: 50,
    })),
  });
  const solicitar = () => service.solicitar(auth, item.id, solicitud());
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
  const retirar = async () => {
    const versionId = c.versiones[1].id;
    const d = await c.asignaciones.diagnostico({ tenantId, versionId });
    expect(d.bloqueos).toEqual([]);
    return c.asignaciones.asignar(c.staff, {
      tenantId,
      versionId,
      revision: d.actual.revision,
      huella: d.huella,
      motivo: 'Ensayo de cambio durante cálculo',
      operacionId: randomUUID(),
      revisionesAceptadas: d.revisiones,
    });
  };
  return {
    tenantId,
    auth,
    item,
    cotizacionItem,
    service,
    capacidades,
    produccion,
    cotizar,
    solicitar,
    iniciar,
    retirar,
  };
}

describe('Planificación con cambios reales de contrato', () => {
  it('mantiene la consulta HTTP de distribuciones anteriores sin permitir nuevos cálculos ni acceso ajeno', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      await x.solicitar();
      await x.retirar();
      let authHttp: CurrentAuth = {
        ...x.auth,
        permisos: new Set([
          'comercial.ver',
          'comercial.gestionar',
          'produccion.supervisar',
        ]),
      };
      const modulo = await Test.createTestingModule({
        controllers: [
          PlanificacionEntregasController,
          PlanificacionCotizacionController,
        ],
        providers: [
          Reflector,
          CapacidadGuard,
          { provide: PlanificacionEntregasService, useValue: x.service },
          { provide: CapacidadesEmpresaService, useValue: x.capacidades },
        ],
      }).compile();
      const app = modulo.createNestApplication();
      app.use((req: { auth: CurrentAuth }, _res: unknown, next: () => void) => {
        req.auth = authHttp;
        next();
      });
      app.useGlobalGuards(new PermisosGuard(new Reflector()));
      try {
        await app.init();
        const http = request(app.getHttpServer() as Server);
        const urls = [
          `/ordenes-trabajo/items/${x.item.id}/planificacion-entregas`,
          `/cotizaciones/items/${x.cotizacionItem.id}/planificacion-entregas`,
        ];
        for (const url of urls) {
          await http.get(url).expect(200);
          for (const sufijo of ['', '/elegir', '/reprogramar'])
            await http
              .post(url + sufijo)
              .send({})
              .expect(403);
        }
        authHttp = { ...authHttp, permisos: new Set() };
        for (const url of urls) await http.get(url).expect(403);
        authHttp = {
          ...x.auth,
          tenantId: randomUUID(),
          permisos: new Set(['comercial.ver', 'comercial.gestionar']),
        };
        for (const url of urls) await http.get(url).expect(404);
      } finally {
        await app.close();
      }
    }));
  it.each(['enviando', 'checkout', 'verificar'])(
    'cierra solicitudes pendientes si %s retira la función, sin ejecutar el motor',
    (estado) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c),
          r = (await x.solicitar()).plan!;
        await x.iniciar(estado);
        await expect(x.solicitar()).rejects.toMatchObject(pendiente);
        await x.service.calcular(x.tenantId, r.revisionId, x.cotizar);
        await x.service.calcular(x.tenantId, r.revisionId, x.cotizar);
        const guardada = await c.tx.planEntregaRevision.findUniqueOrThrow({
          where: { id: r.revisionId },
        });
        expect(guardada).toMatchObject({
          estado: 'FALLIDA',
          ejecucionId: null,
        });
        expect(guardada.error).toBeTruthy();
        expect(x.cotizar).not.toHaveBeenCalled();
        expect(
          await c.tx.fuenteProduccionEntrega.count({
            where: { tenantId: x.tenantId },
          }),
        ).toBe(0);
      }),
  );

  it.each(['enviando', 'checkout', 'verificar'])(
    'si %s comienza durante el cálculo, no publica alternativas ni fuentes de producción',
    (estado) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c),
          r = (await x.solicitar()).plan!;
        let cambio = false;
        await x.service.calcular(x.tenantId, r.revisionId, async (input) => {
          if (!cambio) {
            cambio = true;
            await x.iniciar(estado);
          }
          return x.cotizar(input);
        });
        expect(x.cotizar).toHaveBeenCalled();
        expect(
          (
            await c.tx.planEntregaRevision.findUniqueOrThrow({
              where: { id: r.revisionId },
            })
          ).estado,
        ).toBe('FALLIDA');
        expect(
          await c.tx.fuenteProduccionEntrega.count({
            where: { tenantId: x.tenantId },
          }),
        ).toBe(0);
        expect(x.produccion.sincronizarLotesEntrega).not.toHaveBeenCalled();
      }),
  );

  it.each(['antes', 'durante'])(
    'revalida un contrato ya asignado %s del cálculo y conserva la consulta del resultado',
    (momento) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c),
          r = (await x.solicitar()).plan!;
        if (momento === 'antes') await x.retirar();
        let cambio = false;
        await x.service.calcular(x.tenantId, r.revisionId, async (input) => {
          if (!cambio) {
            cambio = true;
            await x.retirar();
          }
          return x.cotizar(input);
        });
        const vista = await x.service.consultar(x.tenantId, x.item.id);
        expect(vista.plan?.estado).toBe('FALLIDA');
        expect(vista.plan?.error).toBeTruthy();
        expect(
          await c.tx.fuenteProduccionEntrega.count({
            where: { tenantId: x.tenantId },
          }),
        ).toBe(0);
      }),
  );

  it('revalida una solicitud que pasó el control inicial con el plan anterior', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c),
        exigir = x.capacidades.exigir.bind(x.capacidades);
      const spy = jest
        .spyOn(x.capacidades, 'exigir')
        .mockImplementationOnce(async (...args) => {
          await exigir(...args);
          await x.retirar();
        });
      try {
        await expect(x.solicitar()).rejects.toMatchObject({
          response: {
            code: 'CAPACIDAD_NO_DISPONIBLE',
            capacidad: 'planificacion_avanzada',
          },
        });
        expect(
          await c.tx.planEntregaItem.count({ where: { tenantId: x.tenantId } }),
        ).toBe(0);
      } finally {
        spy.mockRestore();
      }
    }));

  it('no adopta una alternativa calculada si una contratación pendiente retira planificación', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c),
        r = (await x.solicitar()).plan!;
      await x.service.calcular(x.tenantId, r.revisionId, x.cotizar);
      const vista = (await x.service.consultar(x.tenantId, x.item.id)).plan!;
      expect(vista.estado).toBe('LISTA');
      await x.iniciar();
      await expect(
        x.service.elegir(x.auth, x.item.id, {
          expectedVersion: vista.version,
          revisionId: r.revisionId,
          alternativaId: 'por-entrega',
          aceptarAjusteNesting: true,
        }),
      ).rejects.toMatchObject(pendiente);
      expect(x.produccion.sincronizarLotesEntrega).not.toHaveBeenCalled();
      expect(
        (await c.tx.planEntregaItem.findUniqueOrThrow({ where: { id: r.id } }))
          .alternativaElegidaId,
      ).toBeNull();
    }));
});
