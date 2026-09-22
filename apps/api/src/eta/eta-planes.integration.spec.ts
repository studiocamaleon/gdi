import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { conPlanesAsignados } from '../../test/soporte-planes-asignados';
import { PROPUESTA_PLANES } from '../plataforma/planes/catalogo-planes';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { ProduccionService } from '../produccion/produccion.service';
import { AlertasService } from '../reportes/alertas.service';
import { parseRango } from '../reportes/periodo';
import { EtaService } from './eta.service';
import { calendarioDefault } from './motor/estaciones-tipos';

const db = new PrismaService();
afterAll(() => db.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const ahora = new Date('2026-09-22T12:00:00Z');

async function preparar(c: Contexto, indice = 2) {
  const tenant = await c.db.tenant.create({
    data: { nombre: 'ETA de prueba', slug: `eta-plan-${randomUUID()}` },
  });
  const tenantId = tenant.id;
  const plan = await c.db.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Contrato QA',
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
  await c.db.estacion.create({
    data: {
      tenantId,
      nombre: 'Preprensa QA',
      calendarioJson: calendarioDefault(),
      reglas: { create: { tenantId, tipo: 'familia', valor: 'pre_prensa' } },
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
          fechaEntrega: new Date('2026-09-25'),
        },
      },
    },
    include: { items: true },
  });
  const item = orden.items[0];
  const paso = await c.db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId: orden.id,
      itemId: item.id,
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
    ahora,
  }));
  const publicar = async (etaIncluida: boolean, reportes = true) => {
    const contenido = {
      ...structuredClone(PROPUESTA_PLANES[2].contenido),
      almacenamientoModo: 'limitado' as const,
      almacenamientoGb: 1500,
    };
    contenido.funciones.eta_capacidad = etaIncluida;
    contenido.funciones.reportes_produccion = reportes;
    if (!etaIncluida) contenido.funciones.planificacion_avanzada = false;
    return c.publicar(contenido);
  };
  const asignar = async (versionId: string) => {
    const d = await c.asignaciones.diagnostico({ tenantId, versionId });
    return c.asignaciones.asignar(c.staff, {
      tenantId,
      versionId,
      huella: d.huella,
      revision: d.actual.revision,
      motivo: 'Probar continuidad de ETA',
      operacionId: randomUUID(),
      revisionesAceptadas: d.revisiones,
    });
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
    await c.db.planContratacion.create({
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
  const cerrar = async () => {
    await c.db.ordenTrabajoItemPaso.update({
      where: { id: paso.id },
      data: {
        estado: 'hecho',
        iniciadoEl: ahora,
        completadoEl: new Date(ahora.getTime() + 40 * 60_000),
        tiempoRealMin: 40,
      },
    });
    await c.db.ordenTrabajo.update({
      where: { id: orden.id },
      data: { estado: 'finalizada' },
    });
  };
  const leer = () =>
    c.db.etaPromesa.findMany({ where: { tenantId, ordenId: orden.id } });
  return {
    tenantId,
    auth,
    eta,
    capacidades,
    orden,
    item,
    paso,
    publicar,
    asignar,
    pendiente,
    cerrar,
    leer,
  };
}

it.each(['Esencial', 'Pro', 'Avanzado'])(
  '%s: la versión asignada gobierna promesas y registros diarios',
  async (nombre) => {
    await conPlanesAsignados(db, async (c) => {
      const s = await preparar(
        c,
        ['Esencial', 'Pro', 'Avanzado'].indexOf(nombre),
      );
      await s.eta.capturarEmision(s.auth, s.orden.id);
      const guardado = await s.eta.snapshotDiario(s.tenantId, ahora);
      expect(guardado).toBe(nombre === 'Avanzado');
      expect(await s.leer()).toHaveLength(nombre === 'Avanzado' ? 1 : 0);
      if (guardado) {
        const foto = await c.db.etaSnapshotItem.findFirstOrThrow({
          where: { tenantId: s.tenantId },
        });
        expect(foto.itemId).toBe(s.item.id);
        expect(foto.margenMin).toBe(
          Math.round(
            (foto.finEstimado!.getTime() -
              new Date('2026-09-25T23:59:59.999-03:00').getTime()) /
              60_000,
          ),
        );
        const promesa = (await s.leer())[0];
        expect(promesa.finEstimado).not.toBeNull();
        await s.eta.capturarEmision(s.auth, s.orden.id);
        expect(await s.leer()).toEqual([promesa]);
      } else {
        // Se inspecciona el mock; no se invoca el método fuera de su instancia.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(s.eta.contextoSimulacion).not.toHaveBeenCalled();
      }
    });
  },
);

it.each(['promesa', 'snapshot'])(
  '%s: una retirada durante el cálculo impide publicar',
  async (tipo) => {
    await conPlanesAsignados(db, async (c) => {
      const s = await preparar(c);
      const version = await s.publicar(false);
      const correr = s.eta.correr.bind(s.eta);
      jest.spyOn(s.eta, 'correr').mockImplementationOnce(async (tenantId) => {
        const resultado = await correr(tenantId);
        await s.asignar(version.id);
        return resultado;
      });
      if (tipo === 'promesa') await s.eta.capturarEmision(s.auth, s.orden.id);
      else expect(await s.eta.snapshotDiario(s.tenantId, ahora)).toBe(false);
      expect(await s.leer()).toHaveLength(0);
      expect(
        await c.db.etaSnapshotEstacion.count({
          where: { tenantId: s.tenantId },
        }),
      ).toBe(0);
      expect(
        await c.db.etaSnapshotItem.count({ where: { tenantId: s.tenantId } }),
      ).toBe(0);
    });
  },
);

it.each(['enviando', 'checkout', 'verificar'])(
  'checkout %s: no admite nuevas proyecciones',
  async (estado) => {
    await conPlanesAsignados(db, async (c) => {
      const s = await preparar(c);
      await s.pendiente(estado);
      await s.eta.capturarEmision(s.auth, s.orden.id);
      expect(await s.eta.snapshotDiario(s.tenantId, ahora)).toBe(false);
      expect(await s.leer()).toHaveLength(0);
      expect(
        await c.db.etaSnapshotItem.count({ where: { tenantId: s.tenantId } }),
      ).toBe(0);
    });
  },
);

it('el cierre conserva resultados sin ETA, incluso si la cuenta dejó de estar operativa', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    await s.eta.capturarEmision(s.auth, s.orden.id);
    const inicial = (await s.leer())[0];
    await s.asignar((await s.publicar(false)).id);
    await s.cerrar();
    await c.db.suscripcion.update({
      where: { tenantId: s.tenantId },
      data: { estado: 'vencida' },
    });
    const motor = jest.spyOn(s.eta, 'correr');
    await s.eta.capturarCierre(s.tenantId, s.orden.id);
    const cerrado = (await s.leer())[0];
    expect(cerrado).toMatchObject({
      id: inicial.id,
      finEstimado: inicial.finEstimado,
      finReal: new Date(ahora.getTime() + 40 * 60_000),
    });
    expect(cerrado.errorMin).toBe(
      Math.round(
        (cerrado.finReal!.getTime() - inicial.finEstimado!.getTime()) / 60_000,
      ),
    );
    expect(
      await c.db.ordenTrabajoItem.findUniqueOrThrow({
        where: { id: s.item.id },
      }),
    ).toMatchObject({ cicloTotalMin: 40, trabajoRealMin: 40 });
    await s.eta.capturarCierre(s.tenantId, s.orden.id);
    expect(await s.leer()).toEqual([cerrado]);
    expect(motor).not.toHaveBeenCalled();
  });
});

it('sin ETA desde el inicio registra el ciclo real sin inventar una promesa', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c, 0);
    await s.cerrar();
    await s.eta.capturarCierre(s.tenantId, s.orden.id);
    expect(await s.leer()).toHaveLength(0);
    expect(
      await c.db.ordenTrabajoItem.findUniqueOrThrow({
        where: { id: s.item.id },
      }),
    ).toMatchObject({ trabajoRealMin: 40 });
  });
});

it('no cierra otra empresa ni una OT que sigue en producción', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    await s.eta.capturarEmision(s.auth, s.orden.id);
    await s.eta.capturarCierre(s.tenantId, s.orden.id);
    expect((await s.leer())[0].finReal).toBeNull();
    await s.cerrar();
    await s.eta.capturarCierre(c.tenantId, s.orden.id);
    expect((await s.leer())[0].finReal).toBeNull();
  });
});

it('no captura una promesa si la OT se cancela mientras calcula', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    const correr = s.eta.correr.bind(s.eta);
    jest.spyOn(s.eta, 'correr').mockImplementationOnce(async (tenantId) => {
      const resultado = await correr(tenantId);
      await c.db.ordenTrabajo.update({
        where: { id: s.orden.id },
        data: { estado: 'cancelada' },
      });
      return resultado;
    });
    await s.eta.capturarEmision(s.auth, s.orden.id);
    expect(await s.leer()).toHaveLength(0);
  });
});

it('la foto diaria revierte todas las estaciones si falla al guardar un ítem', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    const fallo = new Error('Fallo de escritura del ítem');
    const transaccion = c.db.$transaction.bind(c.db);
    const interceptado = new Proxy(c.db, {
      get(target, prop) {
        if (prop === '$transaction')
          return (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
            transaccion((tx) =>
              fn(
                new Proxy(tx, {
                  get(t, p) {
                    if (p === 'etaSnapshotItem')
                      return {
                        upsert: () => {
                          throw fallo;
                        },
                      };
                    return Reflect.get(t, p) as unknown;
                  },
                }),
              ),
            );
        return Reflect.get(target, prop) as unknown;
      },
    });
    const eta = new EtaService(
      interceptado,
      new ProduccionService(c.db),
      s.capacidades,
    );
    jest
      .spyOn(eta, 'correr')
      .mockImplementation((tenantId) => s.eta.correr(tenantId));
    await expect(eta.snapshotDiario(s.tenantId, ahora)).rejects.toBe(fallo);
    expect(
      await c.db.etaSnapshotEstacion.count({ where: { tenantId: s.tenantId } }),
    ).toBe(0);
  });
});

it('reportes de producción consulta el historial sin ETA; retirar ambos bloquea la consulta sin borrar datos', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    await s.eta.capturarEmision(s.auth, s.orden.id);
    await s.cerrar();
    await s.eta.capturarCierre(s.tenantId, s.orden.id);
    const rango = parseRango('2020-01-01', '2099-12-31');
    for (const [etaIncluida, reportes] of [
      [false, true],
      [true, false],
    ]) {
      await s.asignar((await s.publicar(etaIncluida, reportes)).id);
      expect(await s.eta.precisionEnRango(s.tenantId, rango)).toMatchObject({
        cerradas: 1,
      });
      expect(
        (await s.eta.saludModelo(s.tenantId, rango)).cobertura.promesas,
      ).toBe(1);
    }
    await s.asignar((await s.publicar(false, false)).id);
    for (const consulta of [
      () => s.eta.precisionEnRango(s.tenantId, rango),
      () => s.eta.precision(s.auth),
      () => s.eta.saludModelo(s.tenantId),
      () => s.eta.seriesColas(s.tenantId),
    ])
      await expect(consulta()).rejects.toMatchObject({
        response: { code: 'CAPACIDAD_NO_INCLUIDA' },
      });
    expect(await s.leer()).toHaveLength(1);
  });
});

it('consultar el contexto recupera fases sin modificar pasos históricos', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    await c.db.ordenTrabajoItemPaso.update({
      where: { id: s.paso.id },
      data: { demandaHumanaJson: Prisma.DbNull },
    });
    const anterior = await c.db.ordenTrabajoItemPaso.findUniqueOrThrow({
      where: { id: s.paso.id },
    });
    const contexto = await s.eta.contextoSimulacion(s.tenantId);
    expect(contexto.items).toHaveLength(1);
    expect(
      await c.db.ordenTrabajoItemPaso.findUniqueOrThrow({
        where: { id: s.paso.id },
      }),
    ).toEqual(anterior);
  });
});

it('umbrales: A04 es independiente de ETA y la retirada impide nuevas escrituras', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = await preparar(c);
    const alertas = new AlertasService(c.db, {} as never, s.capacidades);
    await s.asignar((await s.publicar(false, true)).id);
    expect(
      await alertas.actualizarUmbrales(s.tenantId, { diasClienteDormido: 80 }),
    ).toMatchObject({ diasClienteDormido: 80 });
    await s.asignar((await s.publicar(true, false)).id);
    await expect(
      alertas.actualizarUmbrales(s.tenantId, { diasClienteDormido: 90 }),
    ).rejects.toMatchObject({ response: { code: 'CAPACIDAD_NO_DISPONIBLE' } });
    expect(await alertas.getUmbrales(s.tenantId)).toMatchObject({
      diasClienteDormido: 80,
    });
  });
});
