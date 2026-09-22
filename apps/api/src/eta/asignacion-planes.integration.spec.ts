import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { conPlanesAsignados } from '../../test/soporte-planes-asignados';
import { serviciosRecorridoF4 } from '../../test/soporte-recorridos-f4';
import { PROPUESTA_PLANES } from '../plataforma/planes/catalogo-planes';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { ProduccionService } from '../produccion/produccion.service';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import { AsignacionPersonalService } from '../ordenes-trabajo/asignacion-personal.service';
import { EtaService } from './eta.service';
import { calendarioDefault } from './motor/estaciones-tipos';
import { leerAsignacionPersonal } from '../produccion/asignacion-personal';

const db = new PrismaService();
const secretoOriginal = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = 'prueba-asignacion-planes';
});
afterAll(async () => {
  if (secretoOriginal === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = secretoOriginal;
  await db.$disconnect();
});
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];

async function preparar(c: Contexto, indice = 2) {
  const tenant = await c.db.tenant.create({
    data: {
      nombre: 'Asignación de prueba',
      slug: `asignacion-plan-${randomUUID()}`,
    },
  });
  const tenantId = tenant.id;
  const plan = await c.db.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Contrato de prueba',
      precioMensual: 100,
      featuresJson: {},
    },
  });
  await c.db.suscripcion.create({
    data: {
      tenantId,
      planId: plan.id,
      planVersionId: c.versiones[indice].id,
      estado: 'activa',
      proveedor: 'manual',
    },
  });
  const auth = { ...c.auth, tenantId };
  const asignar = async (versionId: string) => {
    const d = await c.asignaciones.diagnostico({ tenantId, versionId });
    return c.asignaciones.asignar(c.staff, {
      tenantId,
      versionId,
      huella: d.huella,
      revision: d.actual.revision,
      motivo: 'Probar continuidad del reparto',
      operacionId: randomUUID(),
      revisionesAceptadas: d.revisiones,
    });
  };
  const cal = calendarioDefault();
  const empleado = await c.db.empleado.create({
    data: {
      tenantId,
      userId: auth.userId,
      nombreCompleto: 'Operario de prueba',
      emailPrincipal: auth.email,
      telefonoCodigo: '+54',
      telefonoNumero: '',
      sector: 'Taller',
      fechaIngreso: new Date('2026-01-01'),
      calendarioProduccionJson: cal,
    },
  });
  await c.db.estacion.create({
    data: {
      tenantId,
      nombre: 'Preprensa QA',
      planificacionPorEmpleados: true,
      calendarioJson: cal,
      tiempoPreparacionMin: 0,
      reglas: { create: { tenantId, tipo: 'familia', valor: 'pre_prensa' } },
      empleados: { create: { tenantId, empleadoId: empleado.id } },
    },
  });
  const orden = await c.db.ordenTrabajo.create({
    data: {
      tenantId,
      numero: 'OT-QA',
      estado: 'pendiente',
      fechaEntrega: new Date('2026-09-30'),
      items: {
        create: {
          tenantId,
          codigo: 'QA',
          nombre: 'Diseño',
          familia: 'Manual',
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
      tenantId,
      ordenId: orden.id,
      itemId: orden.items[0].id,
      indice: 0,
      nombre: 'Preprensa',
      familiaCodigo: 'pre_prensa',
      categoriaFamilia: 'pre_prensa',
      duracionEstimadaMin: 30,
      modoRegistro: 'cronometro',
      demandaHumanaJson: {
        version: 1,
        verificada: true,
        fases: [{ minutos: 30, personas: 1 }],
      },
    },
  });
  const capacidades = new CapacidadesEmpresaService(c.db);
  const eta = new EtaService(c.db, new ProduccionService(c.db), capacidades);
  const contexto = eta.contextoSimulacion.bind(eta);
  jest.spyOn(eta, 'contextoSimulacion').mockImplementation(async (...args) => ({
    ...(await contexto(...args)),
    ahora: new Date('2026-09-22T09:00:00-03:00'),
  }));
  const manual = new AsignacionPersonalService(
    c.db,
    eta,
    new EventosSistemaService(c.db),
    capacidades,
  );
  const leer = () =>
    c.db.ordenTrabajoItemPaso.findUniqueOrThrow({ where: { id: paso.id } });
  const publicar = async (sinEta: boolean) => {
    const contenido = {
      ...structuredClone(PROPUESTA_PLANES[2].contenido),
      almacenamientoModo: 'limitado' as const,
      almacenamientoGb: 1500,
    };
    if (sinEta) {
      contenido.funciones.eta_capacidad = false;
      contenido.funciones.planificacion_avanzada = false;
    } else contenido.funciones.asignacion_automatica = false;
    return c.publicar(contenido);
  };
  const pendiente = async (estado: string) => {
    const version = await publicar(false);
    const oferta = await c.db.planOferta.create({
      data: {
        planId: plan.id,
        versionId: version.id,
        entorno: 'sandbox',
        registroPublico: false,
        recomendado: false,
        creadaPorId: auth.userId,
        motivo: 'Prueba',
      },
    });
    return c.db.planContratacion.create({
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
  };
  return {
    tenantId,
    auth,
    capacidades,
    eta,
    manual,
    empleado,
    orden,
    paso,
    leer,
    publicar,
    asignar,
    pendiente,
  };
}

it.each(['Esencial', 'Pro', 'Avanzado'])(
  '%s: el reparto automático y la asignación supervisada verifican su propia función',
  async (nombre) => {
    await conPlanesAsignados(db, async (c) => {
      const indice = ['Esencial', 'Pro', 'Avanzado'].indexOf(nombre);
      const s = await preparar(c, indice);
      await s.eta.sincronizarAsignaciones(s.tenantId);
      if (indice < 2) {
        expect((await s.leer()).asignacionPersonalJson).toBeNull();
        await expect(
          s.manual.contexto(s.auth, s.paso.id),
        ).rejects.toMatchObject({
          status: 403,
          response: { capacidad: 'asignacion_automatica' },
        });
      } else {
        expect(
          leerAsignacionPersonal(
            (await s.leer()).asignacionPersonalJson,
          )?.personas.map((p) => p.empleadoId),
        ).toEqual([s.empleado.id]);
        expect(
          (await s.manual.contexto(s.auth, s.paso.id)).candidatos.map(
            (p) => p.id,
          ),
        ).toEqual([s.empleado.id]);
      }
    });
  },
);

it('P04 funciona sin ETA y ETA no habilita P04: simulación y confirmación independientes', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    await s.asignar((await s.publicar(true)).id);
    await expect(s.eta.correr(s.tenantId)).rejects.toMatchObject({
      status: 403,
      response: { capacidad: 'eta_capacidad' },
    });
    await s.eta.sincronizarAsignaciones(s.tenantId);
    const revision = await s.manual.simular(s.auth, s.paso.id, [s.empleado.id]);
    expect(revision.viable).toBe(true);
    await s.manual.confirmar(s.auth, s.paso.id, {
      token: revision.token!,
      motivo: 'Confirmar asignación',
    });
    expect((await s.leer()).asignacionManualJson).toMatchObject({
      empleadoIds: [s.empleado.id],
    });
    await s.asignar((await s.publicar(false)).id);
    await expect(s.eta.correr(s.tenantId)).resolves.toHaveProperty('traza');
    await expect(
      s.manual.simular(s.auth, s.paso.id, [s.empleado.id]),
    ).rejects.toMatchObject({
      status: 403,
      response: { capacidad: 'asignacion_automatica' },
    });
  });
});

it('la retirada conserva personal y ejecución de lo asignado, pero detiene el recálculo', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    await s.eta.sincronizarAsignaciones(s.tenantId);
    const previo = await s.leer();
    const version = await s.publicar(false);
    const d = await c.asignaciones.diagnostico({
      tenantId: s.tenantId,
      versionId: version.id,
    });
    expect(d.revisiones).toContain('personal_asignado');
    await s.asignar(version.id);
    await s.eta.sincronizarAsignaciones(s.tenantId);
    expect((await s.leer()).asignacionPersonalJson).toEqual(
      previo.asignacionPersonalJson,
    );
    const { ordenes } = serviciosRecorridoF4(c.db);
    Object.assign(ordenes, {
      capturarEtaCierre: jest.fn(),
      avisarAlCliente: jest.fn(),
    });
    const operario = {
      ...s.auth,
      permisos: new Set(['produccion.ejecutar', 'produccion.ver']),
    };
    await ordenes.accionesPasos(operario, [
      {
        ordenId: s.orden.id,
        itemId: s.paso.itemId,
        pasoId: s.paso.id,
        payload: { accion: 'iniciar' },
      },
    ]);
    await ordenes.accionesPasos(operario, [
      {
        ordenId: s.orden.id,
        itemId: s.paso.itemId,
        pasoId: s.paso.id,
        payload: { accion: 'completar', sinTiempoConfirmado: true },
      },
    ]);
    const final = await s.leer();
    expect(final.estado).toBe('hecho');
    expect(final.asignacionPersonalJson).toEqual(previo.asignacionPersonalJson);
    expect(final.planReferenciaJson).toEqual(previo.planReferenciaJson);
  });
});

it('retirar la función entre la comprobación inicial y el reparto no escribe una asignación', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    const version = await s.publicar(false);
    const puedeOperar = s.capacidades.puedeOperar.bind(s.capacidades);
    jest
      .spyOn(s.capacidades, 'puedeOperar')
      .mockImplementationOnce(async (...args) => {
        const resultado = await puedeOperar(...args);
        await s.asignar(version.id);
        return resultado;
      });
    await expect(s.eta.sincronizarAsignaciones(s.tenantId)).resolves.toBe(0);
    expect((await s.leer()).asignacionPersonalJson).toBeNull();
  });
});

it('revalida la confirmación supervisada si el plan cambia después del permiso inicial', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    const revision = await s.manual.simular(s.auth, s.paso.id, [s.empleado.id]);
    const version = await s.publicar(false);
    const exigir = s.capacidades.exigir.bind(s.capacidades);
    jest
      .spyOn(s.capacidades, 'exigir')
      .mockImplementationOnce(async (...args) => {
        await exigir(...args);
        await s.asignar(version.id);
      });
    await expect(
      s.manual.confirmar(s.auth, s.paso.id, { token: revision.token! }),
    ).rejects.toMatchObject({
      status: 403,
      response: { capacidad: 'asignacion_automatica' },
    });
    expect((await s.leer()).asignacionManualJson).toBeNull();
    expect(
      await c.db.eventoSistema.count({
        where: { tenantId: s.tenantId, tipo: 'produccion.personal_asignado' },
      }),
    ).toBe(0);
  });
});

it('una asignación cambiada invalida el diagnóstico aunque siga habiendo un solo trabajo asignado', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    await s.eta.sincronizarAsignaciones(s.tenantId);
    const version = await s.publicar(false);
    const d = await c.asignaciones.diagnostico({
      tenantId: s.tenantId,
      versionId: version.id,
    });
    const anterior = leerAsignacionPersonal(
      (await s.leer()).asignacionPersonalJson,
    )!;
    await c.db.ordenTrabajoItemPaso.update({
      where: { id: s.paso.id },
      data: {
        asignacionPersonalJson: {
          ...anterior,
          conflicto: 'Cambió la disponibilidad del personal',
        },
      },
    });
    await expect(
      c.asignaciones.asignar(c.staff, {
        tenantId: s.tenantId,
        versionId: version.id,
        huella: d.huella,
        revision: d.actual.revision,
        motivo: 'Retirada con diagnóstico anterior',
        operacionId: randomUUID(),
        revisionesAceptadas: d.revisiones,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await s.capacidades.puedeOperar(s.tenantId, 'asignacion_automatica'),
    ).toBe(true);
  });
});

it.each(['enviando', 'checkout', 'verificar'])(
  'contratación %s que retira P04 pausa el reparto y rechaza una nueva confirmación',
  async (estado) => {
    await conPlanesAsignados(db, async (c) => {
      const s = await preparar(c);
      const revision = await s.manual.simular(s.auth, s.paso.id, [
        s.empleado.id,
      ]);
      await s.pendiente(estado);
      await expect(s.eta.sincronizarAsignaciones(s.tenantId)).resolves.toBe(0);
      expect((await s.leer()).asignacionPersonalJson).toBeNull();
      await expect(
        s.manual.confirmar(s.auth, s.paso.id, { token: revision.token! }),
      ).rejects.toMatchObject({ response: { code: 'CAMBIO_PLAN_PENDIENTE' } });
      expect((await s.leer()).asignacionManualJson).toBeNull();
    });
  },
);
