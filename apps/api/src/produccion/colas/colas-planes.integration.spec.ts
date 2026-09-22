import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CapacidadGuard } from '../../suscripciones/capacidad.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { AccionesColaController } from '../../ordenes-trabajo/acciones-cola.controller';
import { OrdenesTrabajoService } from '../../ordenes-trabajo/ordenes-trabajo.service';
import { ColasProduccionService } from './colas.service';
import { SimulacionNestingColaService } from './simulacion-nesting.service';
import { ConsultaColaDto } from './consulta-cola.dto';

const db = new PrismaService();
afterAll(() => db.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];

async function preparar(c: Contexto) {
  const planta = await c.db.planta.create({
    data: { tenantId: c.tenantId, codigo: randomUUID(), nombre: 'QA colas' },
  });
  const estacion = await c.db.estacion.create({
    data: { tenantId: c.tenantId, nombre: 'QA impresión' },
  });
  const maquina = await c.db.maquina.create({
    data: {
      tenantId: c.tenantId,
      plantaId: planta.id,
      estacionId: estacion.id,
      codigo: randomUUID(),
      nombre: 'QA impresora',
      plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
      geometriaTrabajo: 'ROLLO',
      unidadProduccionPrincipal: 'M2',
    },
  });
  const orden = await c.db.ordenTrabajo.create({
    data: {
      tenantId: c.tenantId,
      numero: randomUUID(),
      estado: 'produccion',
      items: {
        create: {
          tenantId: c.tenantId,
          codigo: 'QA',
          nombre: 'Trabajo anterior al cambio',
          familia: 'impresion',
          cantidad: 1,
          cantidadUnidad: 'u',
          subtotal: 0,
          impuestos: 0,
          total: 0,
        },
      },
    },
    include: { items: true },
  });
  const paso = await c.db.ordenTrabajoItemPaso.create({
    data: {
      tenantId: c.tenantId,
      ordenId: orden.id,
      itemId: orden.items[0].id,
      maquinaId: maquina.id,
      nombre: 'Impresión',
      indice: 0,
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
      nodoClave: 'imprimir',
      esTerminal: true,
      modoRegistro: 'solo_completar',
    },
  });
  const { ordenes } = serviciosRecorridoF4(c.db);
  // El comando y el contrato son reales; los efectos posteriores no forman
  // parte de la admisión de la cola ni deben enviar comunicaciones de prueba.
  Object.assign(ordenes, {
    actualizarAsignaciones: jest.fn(),
    capturarEtaCierre: jest.fn(),
    avisarAlCliente: jest.fn(),
  });
  return {
    ordenes,
    maquina,
    orden,
    paso,
    colas: new ColasProduccionService(c.db),
  };
}

async function sinColas(c: Contexto) {
  const contenido = {
    ...structuredClone(PROPUESTA_PLANES[2].contenido),
    almacenamientoModo: 'limitado' as const,
    almacenamientoGb: 1500,
  };
  contenido.funciones.colas_produccion = false;
  return c.publicar(contenido);
}
const completar = { accion: 'completar' as const, sinTiempoConfirmado: true };
const denegada = { status: 403, response: { capacidad: 'colas_produccion' } };

it.each(['Esencial', 'Pro', 'Avanzado'])(
  '%s: las colas leen el contrato publicado, también en llamadas internas',
  async (nombre) => {
    await conPlanesAsignados(db, async (c) => {
      const indice = ['Esencial', 'Pro', 'Avanzado'].indexOf(nombre);
      await c.asignar(c.versiones[indice].id);
      const s = await preparar(c);
      if (indice < 2) {
        await expect(s.colas.maquinas(c.tenantId)).rejects.toMatchObject(
          denegada,
        );
        await expect(
          s.colas.listar(c.tenantId, s.maquina.id, new ConsultaColaDto()),
        ).rejects.toMatchObject(denegada);
        await expect(
          new SimulacionNestingColaService(c.db).simular(
            c.tenantId,
            s.maquina.id,
            [s.paso.id],
          ),
        ).rejects.toMatchObject(denegada);
        await expect(
          s.ordenes.accionTrabajoCola(
            c.auth,
            s.maquina.id,
            s.paso.id,
            completar,
          ),
        ).rejects.toMatchObject(denegada);
        await expect(
          s.ordenes.completarTrabajosCola(c.auth, s.maquina.id, [s.paso.id]),
        ).rejects.toMatchObject(denegada);
      } else {
        expect(
          (await s.colas.maquinas(c.tenantId)).maquinas.map((m) => m.id),
        ).toContain(s.maquina.id);
        const resultado = await s.ordenes.completarTrabajosCola(
          c.auth,
          s.maquina.id,
          [s.paso.id],
          [{ pasoId: s.paso.id, sinTiempoConfirmado: true }],
        );
        expect(resultado.completados).toBe(1);
        expect(
          (
            await c.db.ordenTrabajo.findUniqueOrThrow({
              where: { id: s.orden.id },
            })
          ).estado,
        ).toBe('finalizada');
      }
    });
  },
);

it('retirar P07 bloquea la cola y conserva la finalización de la OT desde el tablero', async () => {
  await conPlanesAsignados(db, async (c) => {
    await c.asignar(c.versiones[2].id);
    const s = await preparar(c);
    const version = await sinColas(c);
    await c.asignar(version.id);
    await expect(
      s.ordenes.accionTrabajoCola(c.auth, s.maquina.id, s.paso.id, completar),
    ).rejects.toMatchObject(denegada);
    expect(
      (
        await c.db.ordenTrabajoItemPaso.findUniqueOrThrow({
          where: { id: s.paso.id },
        })
      ).estado,
    ).toBe('pendiente');
    await s.ordenes.accionPaso(
      c.auth,
      s.orden.id,
      s.paso.itemId,
      s.paso.id,
      completar,
    );
    expect(
      (await c.db.ordenTrabajo.findUniqueOrThrow({ where: { id: s.orden.id } }))
        .estado,
    ).toBe('finalizada');
  });
});

it('revalida P07 dentro de la transacción si el plan cambió tras admitir la petición', async () => {
  await conPlanesAsignados(db, async (c) => {
    await c.asignar(c.versiones[2].id);
    const s = await preparar(c);
    const version = await sinColas(c);
    // Intercalación determinista con asignación real; no simula una carrera
    // entre conexiones independientes.
    Object.assign(s.ordenes, {
      reconciliarTramosVencidos: async () => c.asignar(version.id),
    });
    await expect(
      s.ordenes.completarTrabajosCola(
        c.auth,
        s.maquina.id,
        [s.paso.id],
        [{ pasoId: s.paso.id, sinTiempoConfirmado: true }],
      ),
    ).rejects.toMatchObject(denegada);
    expect(
      (
        await c.db.ordenTrabajoItemPaso.findUniqueOrThrow({
          where: { id: s.paso.id },
        })
      ).estado,
    ).toBe('pendiente');
    expect(
      await c.db.ordenTrabajoEvento.count({ where: { ordenId: s.orden.id } }),
    ).toBe(0);
  });
});

it('HTTP exige P07 y permiso personal en ambas acciones de la cola', async () => {
  await conPlanesAsignados(db, async (c) => {
    await c.asignar(c.versiones[0].id);
    const s = await preparar(c);
    const modulo = await Test.createTestingModule({
      controllers: [AccionesColaController],
      providers: [
        Reflector,
        CapacidadGuard,
        {
          provide: CapacidadesEmpresaService,
          useValue: new CapacidadesEmpresaService(c.db),
        },
        { provide: OrdenesTrabajoService, useValue: s.ordenes },
      ],
    }).compile();
    const app = modulo.createNestApplication();
    let auth = c.auth;
    app.use((req: { auth: typeof auth }, _res: unknown, next: () => void) => {
      req.auth = auth;
      next();
    });
    app.useGlobalGuards(new PermisosGuard(new Reflector()));
    try {
      await app.init();
      const http = request(app.getHttpServer() as Server);
      const base = `/produccion/colas/${s.maquina.id}`;
      await http
        .post(`${base}/pasos/${s.paso.id}/accion`)
        .send(completar)
        .expect(403);
      await http
        .post(`${base}/completar`)
        .send({ pasoIds: [s.paso.id] })
        .expect(403);
      await c.asignar(c.versiones[2].id);
      auth = { ...c.auth, permisos: new Set(['produccion.ver']) };
      await http
        .post(`${base}/pasos/${s.paso.id}/accion`)
        .send(completar)
        .expect(403);
      auth = c.auth;
      await http
        .post(`${base}/pasos/${s.paso.id}/accion`)
        .send(completar)
        .expect(200);
    } finally {
      await app.close();
    }
  });
});
