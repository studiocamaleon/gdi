import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { EgresosController } from '../../egresos/egresos.controller';
import { EgresosService } from '../../egresos/egresos.service';
import { RecurrentesService } from '../../egresos/recurrentes.service';
import { AdministracionController } from '../../administracion/administracion.controller';
import { TesoreriaService } from '../../administracion/tesoreria.service';
import { CobrosService } from '../../administracion/cobros.service';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { CapacidadGuard } from '../capacidad.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import type { CurrentAuth } from '../../auth/auth.types';

const prisma = new PrismaService();
afterAll(() => prisma.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];

async function preparar(c: Contexto) {
  const tenant = await c.tx.tenant.create({
    data: { nombre: 'Historial financiero', slug: `historial-${randomUUID()}` },
  });
  const tenantId = tenant.id;
  const auth: CurrentAuth = {
    ...c.auth,
    tenantId,
    permisos: new Set([
      'administracion.ver',
      'administracion.gestionar',
      'administracion.anular',
      'administracion.configurar',
      'finanzas.ver_margenes',
    ]),
  };
  await c.tx.suscripcion.create({
    data: {
      tenantId,
      planId: (
        await c.tx.plan.create({
          data: {
            codigo: randomUUID(),
            nombre: 'Contrato histórico',
            precioMensual: 290,
            featuresJson: {},
          },
        })
      ).id,
      planVersionId: c.versiones[1].id,
      estado: 'activa',
      proveedor: 'manual',
    },
  });
  const capacidades = new CapacidadesEmpresaService(c.db);
  const pdf = {
    generar: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4\nensayo')),
  };
  const egresos = new EgresosService(
    c.db,
    { paraDocumentos: jest.fn().mockResolvedValue(null) } as never,
    { logoDataUri: jest.fn().mockResolvedValue(null) } as never,
    pdf as never,
    capacidades,
  );
  const recurrentes = new RecurrentesService(c.db);
  const cobros = new CobrosService(
    c.db,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const tesoreria = new TesoreriaService(c.db, cobros, capacidades);
  const categoria = await c.tx.categoriaEgreso.create({
    data: {
      tenantId,
      codigo: 'ENSAYO',
      nombre: 'Material de ensayo',
      naturaleza: 'COSTO_PRODUCCION',
    },
  });
  const cuenta = await c.tx.cuentaFondos.create({
    data: { tenantId, tipo: 'banco', nombre: 'Cuenta histórica', saldo: 1000 },
  });
  const metodo = await c.tx.metodoPago.create({
    data: {
      tenantId,
      codigo: 'TRANSFERENCIA',
      nombre: 'Transferencia',
      tipo: 'transferencia',
    },
  });
  const egreso = await egresos.crear(auth, {
    descripcion: 'Factura histórica',
    categoriaEgresoId: categoria.id,
    beneficiarioNombre: 'Proveedor de ensayo',
    neto: 100,
    fechaVencimiento: '2099-01-01',
  });
  const pago = await egresos.registrarPago(auth, {
    metodoPagoId: metodo.id,
    cuentaOrigenId: cuenta.id,
    imputaciones: [{ egresoId: egreso.id, monto: 100 }],
    idempotencyKey: randomUUID(),
  });
  const plantilla = await recurrentes.crear(auth, {
    descripcion: 'Plantilla histórica',
    categoriaEgresoId: categoria.id,
    monto: 200,
    vigenteDesde: '2099-01',
  });
  await recurrentes.editar(auth, plantilla.id, { activo: false });
  const valor = await c.tx.valor.create({
    data: {
      tenantId,
      origen: 'propio',
      formato: 'echeq',
      modalidad: 'comun',
      numero: 'ENSAYO',
      banco: 'Banco',
      claveInstrumento: 'propio|banco|ensayo',
      importe: 10,
      estado: 'anulado',
      anuladoEl: new Date(),
      eventos: {
        create: {
          tenantId,
          tipo: 'anulado',
          actorNombre: 'Ensayo',
          detalleJson: { motivo: 'Instrumento cerrado de prueba' },
        },
      },
    },
  });
  const bajar = async () => {
    const d = await c.asignaciones.diagnostico({
      tenantId,
      versionId: c.versiones[0].id,
    });
    expect(d.bloqueos).toEqual([]);
    await c.asignaciones.asignar(c.staff, {
      tenantId,
      versionId: c.versiones[0].id,
      huella: d.huella,
      revision: d.actual.revision,
      motivo: 'Verificar conservación del historial',
      operacionId: randomUUID(),
      revisionesAceptadas: d.revisiones,
    });
  };
  return {
    tenantId,
    auth,
    egresos,
    recurrentes,
    cobros,
    tesoreria,
    capacidades,
    categoria,
    cuenta,
    metodo,
    egreso,
    pago,
    plantilla,
    valor,
    bajar,
    pdf,
  };
}

describe('Historial financiero después de retirar módulos', () => {
  it('conserva por HTTP egresos, pagos, plantillas, cuentas y valores tras asignar Esencial; rechaza las operaciones y aísla empresas', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      await x.bajar();
      let authHttp = x.auth;
      const modulo = await Test.createTestingModule({
        controllers: [EgresosController, AdministracionController],
        providers: [
          Reflector,
          CapacidadGuard,
          { provide: CapacidadesEmpresaService, useValue: x.capacidades },
          { provide: EgresosService, useValue: x.egresos },
          { provide: RecurrentesService, useValue: x.recurrentes },
          { provide: TesoreriaService, useValue: x.tesoreria },
          { provide: CobrosService, useValue: x.cobros },
        ],
      })
        .useMocker(() => ({}))
        .compile();
      const app = modulo.createNestApplication();
      app.use((req: { auth: CurrentAuth }, _res: unknown, next: () => void) => {
        req.auth = authHttp;
        next();
      });
      app.useGlobalGuards(new PermisosGuard(new Reflector()));
      try {
        await app.init();
        const http = request(app.getHttpServer() as Server);
        const lista = await http.get('/egresos').expect(200);
        expect(lista.body).toMatchObject({
          egresos: [{ id: x.egreso.id, estado: 'pagado' }],
        });
        const pagos = await http
          .get(`/egresos/${x.egreso.id}/pagos`)
          .expect(200);
        expect(pagos.body).toMatchObject({
          pagos: [{ id: x.pago.id, monto: 100 }],
        });
        await http.get('/egresos/categorias').expect(200);
        await http.get('/egresos/resumen').expect(200);
        await http.get('/egresos/proveedores').expect(200);
        expect(
          (await http.get('/egresos/recurrentes').expect(200)).body,
        ).toMatchObject({
          recurrentes: [{ id: x.plantilla.id, activo: false }],
        });
        expect(
          (await http.get('/administracion/tesoreria').expect(200)).body,
        ).toMatchObject({ cuentas: [{ id: x.cuenta.id, saldo: 900 }] });
        const movimientos = await http
          .get(`/administracion/cuentas/${x.cuenta.id}/movimientos`)
          .expect(200);
        expect(movimientos.body).toMatchObject({
          total: 1,
          items: [{ tipo: 'salida', monto: 100 }],
        });
        expect(
          (await http.get('/administracion/valores').expect(200)).body,
        ).toMatchObject([
          { id: x.valor.id, estado: 'anulado', eventos: [{ tipo: 'anulado' }] },
        ]);
        await http
          .get(`/egresos/pagos/${x.pago.id}/orden-pago.pdf`)
          .expect(200)
          .expect('Content-Type', /pdf/);
        expect(x.pdf.generar).toHaveBeenCalledTimes(1);
        for (const ruta of [
          '/egresos/reporte',
          '/egresos/presupuestado',
          '/egresos/valores-en-cartera',
        ])
          await http.get(ruta).expect(403);
        for (const ruta of [
          '/egresos',
          '/egresos/pagos',
          '/egresos/categorias',
          '/egresos/recurrentes',
          '/egresos/recurrentes/generar',
          `/egresos/valores/${x.valor.id}/debitar`,
          `/egresos/valores/${x.valor.id}/rechazar`,
          '/administracion/cuentas/transferencias',
          `/administracion/cuentas/${x.cuenta.id}/arqueo`,
          `/administracion/cuentas/${x.cuenta.id}/ajustes`,
          ...[
            'depositar',
            'acreditar',
            'rechazar',
            'revertir-deposito',
            'revertir-acreditacion',
          ].map((a) => `/administracion/valores/${x.valor.id}/${a}`),
        ])
          await http.post(ruta).send({}).expect(403);
        for (const ruta of [
          `/egresos/${x.egreso.id}`,
          `/egresos/${x.egreso.id}/anular`,
          `/egresos/pagos/${x.pago.id}/anular`,
          `/egresos/categorias/${x.categoria.id}`,
          `/egresos/recurrentes/${x.plantilla.id}`,
          `/administracion/cuentas/${x.cuenta.id}/movimientos/${randomUUID()}/conciliacion`,
        ])
          await http.patch(ruta).send({}).expect(403);
        await http.delete(`/egresos/categorias/${x.categoria.id}`).expect(403);
        await http.delete(`/egresos/recurrentes/${x.plantilla.id}`).expect(403);
        await expect(
          x.egresos.editarCategoria(x.auth, x.categoria.id, {
            nombre: 'No permitido',
          }),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          x.egresos.borrarCategoria(x.auth, x.categoria.id),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          x.egresos.crearCategoria(x.auth, {
            nombre: 'No permitido',
            naturaleza: 'COSTO_PRODUCCION',
          }),
        ).rejects.toMatchObject({ status: 403 });
        expect(
          Number(
            (
              await c.tx.cuentaFondos.findUniqueOrThrow({
                where: { id: x.cuenta.id },
              })
            ).saldo,
          ),
        ).toBe(900);
        expect(
          await c.tx.movimientoFondos.count({
            where: { tenantId: x.tenantId },
          }),
        ).toBe(1);
        authHttp = { ...x.auth, permisos: new Set() };
        for (const ruta of [
          '/egresos',
          '/egresos/recurrentes',
          '/administracion/tesoreria',
          '/administracion/valores',
          `/egresos/${x.egreso.id}/pagos`,
        ])
          await http.get(ruta).expect(403);
        const otro = await c.tx.tenant.create({
          data: { nombre: 'Otra empresa', slug: `otro-${randomUUID()}` },
        });
        authHttp = { ...x.auth, tenantId: otro.id };
        expect((await http.get('/egresos').expect(200)).body).toMatchObject({
          egresos: [],
        });
        expect(
          (await http.get(`/egresos/${x.egreso.id}/pagos`).expect(200)).body,
        ).toEqual({ pagos: [] });
        expect(
          (await http.get('/administracion/valores').expect(200)).body,
        ).toEqual([]);
        await http
          .get(`/administracion/cuentas/${x.cuenta.id}/movimientos`)
          .expect(404);
        await http
          .get(`/egresos/pagos/${x.pago.id}/orden-pago.pdf`)
          .expect(404);
      } finally {
        await app.close();
      }
    }));

  it('consultar cuentas y cobros no acredita vencidos ni mueve fondos; el cron conserva su ejecución independiente', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      await x.bajar();
      const cobro = await c.tx.cobro.create({
        data: {
          tenantId: x.tenantId,
          fecha: new Date(1),
          metodoPagoId: x.metodo.id,
          cuentaDestinoId: x.cuenta.id,
          montoBruto: 20,
          netoAcreditado: 20,
          disponibleReal: 20,
          estadoAcreditacion: 'pendiente',
          fechaAcreditacionEstimada: new Date(2),
        },
      });
      expect((await x.tesoreria.resumen(x.auth)).kpis.aAcreditar).toBe(20);
      expect(await x.cobros.pendientesAcreditacion(x.auth)).toHaveLength(1);
      expect(
        Number(
          (
            await c.tx.cuentaFondos.findUniqueOrThrow({
              where: { id: x.cuenta.id },
            })
          ).saldo,
        ),
      ).toBe(900);
      expect(
        (await c.tx.cobro.findUniqueOrThrow({ where: { id: cobro.id } }))
          .estadoAcreditacion,
      ).toBe('pendiente');
      expect(await x.cobros.barrerVencidos(x.tenantId)).toBe(1);
      expect(
        Number(
          (
            await c.tx.cuentaFondos.findUniqueOrThrow({
              where: { id: x.cuenta.id },
            })
          ).saldo,
        ),
      ).toBe(920);
    }));

  it.each(['activa', 'cancelada'])(
    'no siembra categorías desde el historial sin CxP, con suscripción %s',
    (estado) =>
      conPlanesAsignados(prisma, async (c) => {
        const tenant = await c.tx.tenant.create({
          data: { nombre: 'Historial vacío', slug: `vacio-${randomUUID()}` },
        });
        await c.tx.suscripcion.create({
          data: {
            tenantId: tenant.id,
            planId: (
              await c.tx.plan.create({
                data: {
                  codigo: randomUUID(),
                  nombre: 'Contrato vacío',
                  precioMensual: 190,
                  featuresJson: {},
                },
              })
            ).id,
            planVersionId: c.versiones[0].id,
            estado,
            proveedor: 'manual',
          },
        });
        const egresos = new EgresosService(
          c.db,
          {} as never,
          {} as never,
          {} as never,
        );
        expect(
          await egresos.categorias({ ...c.auth, tenantId: tenant.id }),
        ).toEqual([]);
        expect(
          await c.tx.categoriaEgreso.count({ where: { tenantId: tenant.id } }),
        ).toBe(0);
      }),
  );
  it('revalida la inicialización de categorías si el contrato cambia antes de tomar el lock', () =>
    conPlanesAsignados(prisma, async (c) => {
      const tenant = await c.tx.tenant.create({
        data: {
          nombre: 'Inicialización de categorías',
          slug: `categorias-${randomUUID()}`,
        },
      });
      const plan = await c.tx.plan.create({
        data: {
          codigo: randomUUID(),
          nombre: 'Pro de prueba',
          precioMensual: 290,
          featuresJson: {},
        },
      });
      await c.tx.suscripcion.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          planVersionId: c.versiones[1].id,
          estado: 'activa',
          proveedor: 'manual',
        },
      });
      const db = new Proxy(c.db, {
        get(target, prop) {
          if (prop === '$transaction')
            return async (fn: Parameters<typeof c.db.$transaction>[0]) => {
              await c.tx.suscripcion.update({
                where: { tenantId: tenant.id },
                data: { planVersionId: c.versiones[0].id },
              });
              return target.$transaction(fn);
            };
          return Reflect.get(target, prop) as unknown;
        },
      });
      const service = new EgresosService(
        db,
        {} as never,
        {} as never,
        {} as never,
      );
      expect(
        await service.categorias({ ...c.auth, tenantId: tenant.id }),
      ).toEqual([]);
      expect(
        await c.tx.categoriaEgreso.count({ where: { tenantId: tenant.id } }),
      ).toBe(0);
    }));
});
