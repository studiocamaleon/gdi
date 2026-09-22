import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CapacidadGuard } from '../../suscripciones/capacidad.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { MargenesInterceptor } from '../../auth/margenes.interceptor';
import type { CurrentAuth } from '../../auth/auth.types';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';
import { EtaService } from '../../eta/eta.service';
import { ProduccionService } from '../../produccion/produccion.service';
import { ReportesController } from '../reportes.controller';
import { ReportesService } from '../reportes.service';
import { RentabilidadService } from '../rentabilidad.service';
import { CobranzaService } from '../cobranza.service';
import { VentasService } from '../ventas.service';
import { ProductoService } from '../producto.service';
import { ReporteProduccionService } from '../produccion.service';
import { AlertasService } from '../alertas.service';
import { ClientesService } from '../clientes.service';
import { EquipoService } from '../equipo.service';
import { EmbudoService } from '../embudo.service';

const db = new PrismaService();
afterAll(() => db.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const base = '/reportes/panel/';
const rango = { desde: '2026-08-01', hasta: '2026-08-31' };
const rutas = [
  ['resumen', 'reportes_resumen'],
  ['comercial', 'reportes_resumen'],
  ['embudo', 'reportes_resumen'],
  ['finanzas', 'reportes_finanzas'],
  ['producto', 'reportes_comerciales'],
  ['producto/mix-categoria', 'reportes_comerciales'],
  ['clientes', 'reportes_comerciales'],
  ['produccion', 'reportes_produccion'],
  ['equipo', 'reportes_produccion'],
  ['salud-eta', 'reportes_produccion'],
  ['alertas', 'reportes_produccion'],
  ['umbrales', 'reportes_produccion'],
] as const;

async function escenario(
  c: Contexto,
  ejecutar: (f: Awaited<ReturnType<typeof preparar>>) => Promise<void>,
) {
  const f = await preparar(c);
  try {
    await ejecutar(f);
  } finally {
    await f.app.close();
  }
}

async function preparar(c: Contexto) {
  const tenant = await c.db.tenant.create({
    data: { nombre: 'Reportes QA', slug: `reportes-plan-${randomUUID()}` },
  });
  const tenantId = tenant.id;
  const plan = await c.db.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Reportes QA',
      precioMensual: 100,
      featuresJson: {},
    },
  });
  await c.db.suscripcion.create({
    data: {
      tenantId,
      planId: plan.id,
      planVersionId: c.versiones[2].id,
      estado: 'activa',
      proveedor: 'manual',
    },
  });
  const cliente = await c.db.cliente.create({
    data: {
      tenantId,
      nombre: 'Cliente QA',
      telefonoCodigo: '+54',
      telefonoNumero: '',
      paisCodigo: 'AR',
    },
  });
  await c.db.ordenTrabajo.create({
    data: {
      tenantId,
      numero: 'OT-REPORTES',
      estado: 'finalizada',
      clienteId: cliente.id,
      fechaEmision: new Date('2026-08-10T15:00:00Z'),
      fechaFinalizada: new Date('2026-08-11T15:00:00Z'),
      subtotal: 100,
      impuestos: 21,
      total: 121,
      items: {
        create: {
          tenantId,
          codigo: 'QA',
          nombre: 'Trabajo QA',
          familia: 'Manual',
          categoriaComercial: 'QA',
          cantidad: 1,
          cantidadUnidad: 'u',
          subtotal: 100,
          impuestos: 21,
          total: 121,
        },
      },
    },
  });
  const categoria = await c.db.categoriaEgreso.create({
    data: {
      tenantId,
      codigo: 'QA',
      nombre: 'Estructura QA',
      naturaleza: 'GASTO_ESTRUCTURA',
    },
  });
  await c.db.gastoFijoEstructura.create({
    data: {
      tenantId,
      nombre: 'Estructura QA',
      categoriaEgresoId: categoria.id,
      valor: 5000,
      importeMensual: 5000,
      vigenteDesde: '2026-01',
    },
  });
  const completa: CurrentAuth = {
    ...c.auth,
    tenantId,
    role: 'OPERARIO',
    permisos: new Set([
      'reportes.ver',
      'reportes.ver_resumen',
      'finanzas.ver_margenes',
      'registros.ver_comisiones',
    ]),
  };
  let auth = completa;
  const capacidades = new CapacidadesEmpresaService(c.db);
  const modulo = await Test.createTestingModule({
    controllers: [ReportesController],
    providers: [
      Reflector,
      CapacidadGuard,
      { provide: PrismaService, useValue: c.db },
      { provide: CapacidadesEmpresaService, useValue: capacidades },
      {
        provide: EtaService,
        useValue: new EtaService(
          c.db,
          new ProduccionService(c.db),
          capacidades,
        ),
      },
      ReportesService,
      RentabilidadService,
      CobranzaService,
      VentasService,
      ProductoService,
      ReporteProduccionService,
      AlertasService,
      ClientesService,
      EquipoService,
      EmbudoService,
    ],
  }).compile();
  const app = modulo.createNestApplication();
  app.use((req: { auth: CurrentAuth }, _res: unknown, next: () => void) => {
    req.auth = auth;
    next();
  });
  app.useGlobalGuards(new PermisosGuard(new Reflector()));
  app.useGlobalInterceptors(new MargenesInterceptor(new Reflector()));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  const http = request(app.getHttpServer() as Server);
  const asignar = async (versionId: string) => {
    const d = await c.asignaciones.diagnostico({ tenantId, versionId });
    return c.asignaciones.asignar(c.staff, {
      tenantId,
      versionId,
      huella: d.huella,
      revision: d.actual.revision,
      motivo: 'Ensayo de reportes',
      operacionId: randomUUID(),
      revisionesAceptadas: d.revisiones,
    });
  };
  const get = (ruta: string) =>
    http.get(base + ruta).query(
      ruta === 'umbrales'
        ? {}
        : {
            ...rango,
            ...(ruta === 'producto/mix-categoria' ? { categoria: 'QA' } : {}),
          },
    );
  return {
    app,
    http,
    get,
    asignar,
    tenantId,
    completa,
    setAuth: (a: CurrentAuth) => {
      auth = a;
    },
    rentabilidad: modulo.get(RentabilidadService),
  };
}

it.each(['Esencial', 'Pro', 'Avanzado'])(
  '%s: todas las rutas HTTP usan el contrato publicado asignado',
  async (nombre) => {
    await conPlanesAsignados(db, (c) =>
      escenario(c, async (f) => {
        const indice = ['Esencial', 'Pro', 'Avanzado'].indexOf(nombre);
        if (indice !== 2) await f.asignar(c.versiones[indice].id);
        for (const [ruta, capacidad] of rutas) {
          const incluida =
            PROPUESTA_PLANES[indice].contenido.funciones[capacidad];
          const respuesta = await f.get(ruta);
          expect({ ruta, status: respuesta.status }).toEqual({
            ruta,
            status: incluida ? 200 : 403,
          });
        }
        await f.http
          .put(base + 'umbrales')
          .send({ diasClienteDormido: 90 })
          .expect(indice === 2 ? 200 : 403);
      }),
    );
  },
);

it('las funciones analíticas no exigen módulos opcionales para leer la historia', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      const contenido = structuredClone(PROPUESTA_PLANES[2].contenido);
      contenido.almacenamientoModo = 'limitado';
      contenido.almacenamientoGb = 1500;
      for (const clave of [
        'eta_capacidad',
        'asignacion_automatica',
        'planificacion_avanzada',
        'cuentas_cobrar',
        'tesoreria',
        'valores',
        'cuentas_pagar',
        'gastos_recurrentes',
        'gastos_fijos',
        'presupuestos',
        'aprobacion_presupuestos',
        'proyectos',
        'compras',
        'recepciones',
        'reservas',
        'prevision_materiales',
      ] as const)
        contenido.funciones[clave] = false;
      const version = await c.publicar(contenido);
      await f.asignar(version.id);
      for (const [ruta] of rutas) await f.get(ruta).expect(200);
      const resumen = (await f.get('resumen')).body as {
        rentabilidad: { ventas: number; costosFijos: number };
        topClientes: { nombre: string }[];
      };
      expect(resumen.rentabilidad).toMatchObject({
        ventas: 100,
        costosFijos: 5000,
      });
      expect(resumen.topClientes.map((x) => x.nombre)).toEqual(['Cliente QA']);
    }),
  );
});

it.each([
  'reportes_resumen',
  'reportes_finanzas',
  'reportes_comerciales',
  'reportes_produccion',
] as const)(
  '%s funciona sin contratar los otros tres grupos de informes',
  async (unica) => {
    await conPlanesAsignados(db, (c) =>
      escenario(c, async (f) => {
        const contenido = structuredClone(PROPUESTA_PLANES[2].contenido);
        contenido.almacenamientoModo = 'limitado';
        contenido.almacenamientoGb = 1500;
        for (const clave of [
          'reportes_resumen',
          'reportes_finanzas',
          'reportes_comerciales',
          'reportes_produccion',
        ] as const)
          contenido.funciones[clave] = clave === unica;
        await f.asignar((await c.publicar(contenido)).id);
        for (const [ruta, capacidad] of rutas)
          await f.get(ruta).expect(capacidad === unica ? 200 : 403);
      }),
    );
  },
);

it('un permiso especial no evita el permiso de entrada a Reportes, y viceversa', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      const calculo = jest.spyOn(f.rentabilidad, 'bloque');
      for (const permisos of [
        [],
        ['reportes.ver_resumen', 'finanzas.ver_margenes'],
      ]) {
        f.setAuth({ ...f.completa, permisos: new Set(permisos) });
        for (const [ruta] of rutas) await f.get(ruta).expect(403);
        await f.http
          .put(base + 'umbrales')
          .send({ diasClienteDormido: 90 })
          .expect(403);
      }
      expect(calculo).not.toHaveBeenCalled();
      f.setAuth({ ...f.completa, permisos: new Set(['reportes.ver']) });
      await f.get('resumen').expect(403);
      await f.get('finanzas').expect(403);
      await f.http
        .put(base + 'umbrales')
        .send({ diasClienteDormido: 90 })
        .expect(403);
      await f.get('comercial').expect(200);
    }),
  );
});

it('el usuario sin márgenes recibe ventas, sin costos ni rentabilidad oculta en alertas', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      type Alertas = { activas: { id: string; detalle: string }[] };
      const conAcceso = (await f.get('alertas')).body as Alertas;
      expect(conAcceso.activas.map((a) => a.id)).toContain('punto-equilibrio');
      const productoCompleto = (await f.get('producto')).body as {
        porCategoria: { ventas: number; margen: number; costo: number }[];
      };
      expect(productoCompleto.porCategoria).toMatchObject([
        { ventas: 100, margen: 100, costo: 0 },
      ]);
      f.setAuth({ ...f.completa, permisos: new Set(['reportes.ver']) });
      const sinAcceso = (await f.get('alertas')).body as Alertas;
      expect(sinAcceso.activas.map((a) => a.id)).not.toContain(
        'punto-equilibrio',
      );
      const comercial = (await f.get('comercial')).body as Record<
        string,
        unknown
      >;
      expect(JSON.stringify(comercial)).toContain('Cliente QA');
      expect(JSON.stringify(comercial)).not.toMatch(
        /"(?:costo|margen|margenPct|contribucion)":/,
      );
      for (const ruta of ['producto', 'clientes', 'equipo']) {
        const respuesta = await f.get(ruta).expect(200);
        expect(respuesta.body as unknown).toMatchObject({
          margenesVisibles: false,
        });
        expect(JSON.stringify(respuesta.body)).not.toMatch(
          /"(?:costo|margen|margenPct|margenClientes|contribucion)":/,
        );
      }
      // El resumen concede explícitamente la visión integral del negocio.
      f.setAuth({
        ...f.completa,
        permisos: new Set(['reportes.ver', 'reportes.ver_resumen']),
      });
      const resumen = (await f.get('resumen')).body as {
        rentabilidad: { margenBruto: number };
      };
      expect(resumen.rentabilidad.margenBruto).toBe(100);
    }),
  );
});

it('rechaza empresa inyectada por query y no mezcla datos entre empresas', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      await f.http
        .get(base + 'resumen')
        .query({ ...rango, tenantId: c.tenantId })
        .expect(400);
      f.setAuth({ ...f.completa, tenantId: c.tenantId });
      const otro = (await f.get('comercial').expect(200)).body as unknown;
      expect(JSON.stringify(otro)).not.toContain('Cliente QA');
      expect(JSON.stringify(otro)).not.toContain('Trabajo QA');
    }),
  );
});

it('la retirada se aplica a la siguiente lectura; las cuentas vencidas conservan consulta y no editan umbrales', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      await f.get('finanzas').expect(200);
      await f.asignar(c.versiones[0].id);
      await f.get('finanzas').expect(403);
      await f.get('resumen').expect(200);
      await f.asignar(c.versiones[2].id);
      await c.db.suscripcion.update({
        where: { tenantId: f.tenantId },
        data: { estado: 'vencida' },
      });
      for (const [ruta] of rutas) await f.get(ruta).expect(200);
      await f.http
        .put(base + 'umbrales')
        .send({ diasClienteDormido: 90 })
        .expect(403);
    }),
  );
});
