import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProduccionService } from '../produccion/produccion.service';
import { EtaService } from '../eta/eta.service';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { FidelizacionService } from '../fidelizacion/fidelizacion.service';
import { DesarrolloDocumentalService } from '../desarrollo-documental/desarrollo-documental.service';
import { calendarioDefault } from '../eta/motor/estaciones-tipos';
import { leerPersonalPrevisto } from './personal-previsto';
import { leerAsignacionManual } from '../produccion/asignacion-manual';
import type { CurrentAuth } from '../auth/auth.types';
import type { CrearOrdenTrabajoDto } from './dto/crear-orden-trabajo.dto';

// Persistencia, revisión y emisión reales; sólo se sustituyen efectos externos
// y la respuesta enriquecida. Base exclusiva de tests con identidades ficticias.
const db = new PrismaService();
const produccion = new ProduccionService(db);
const eta = new EtaService(db, produccion);
const service = new OrdenesTrabajoService(
  db,
  eta,
  {} as never,
  { sincronizar: jest.fn() } as never,
  { emitir: jest.fn() } as never,
  {} as never,
  {} as never,
  {} as never,
  { asegurarParaItem: jest.fn() } as never,
  new FidelizacionService(db),
  new DesarrolloDocumentalService(db, {} as never, {} as never),
);
let auth: CurrentAuth,
  ajeno: string,
  categoriaId: string,
  habitual: string,
  apoyo: string,
  estacionId: string;
let payload: CrearOrdenTrabajoDto;
const cal = calendarioDefault();
const ahora = new Date('2026-10-05T09:00:00-03:00');
const realContexto = eta.contextoSimulacion.bind(eta);
const elecciones = () => [
  { nodoClave: 'ruta:impresion', empleadoIds: [apoyo] },
];
const dto = (asignacionesPersonal = elecciones()) => ({
  ...payload,
  items: payload.items.map((i) => ({ ...i, asignacionesPersonal })),
});
const revisar = (asignacionesPersonal = elecciones()) =>
  service.revisarPersonalPrevisto(auth, [
    {
      cotizacionItemId: payload.items[0].cotizacionItemId,
      asignacionesPersonal,
    },
  ]);

beforeEach(async () => {
  const tenantId = randomUUID(),
    userId = randomUUID();
  ajeno = randomUUID();
  auth = {
    tenantId,
    userId,
    email: `${userId}@qa.invalid`,
    role: 'ADMINISTRADOR',
    permisos: new Set(['produccion.supervisar', 'comercial.crear']),
  } as CurrentAuth;
  await db.tenant.createMany({
    data: [tenantId, ajeno].map((id) => ({
      id,
      slug: `qa-previo-${id}`,
      nombre: 'Taller ficticio',
    })),
  });
  await db.user.create({ data: { id: userId, email: auth.email } });
  const cliente = await db.cliente.create({
    data: {
      tenantId,
      nombre: 'Cliente ficticio',
      telefonoCodigo: '+54',
      telefonoNumero: '',
      paisCodigo: 'AR',
    },
  });
  const personal = [];
  for (const nombre of ['Ana Habitual', 'Bruno Apoyo'])
    personal.push(
      await db.empleado.create({
        data: {
          tenantId,
          nombreCompleto: nombre,
          emailPrincipal: `${randomUUID()}@qa.invalid`,
          telefonoCodigo: '+54',
          telefonoNumero: '',
          sector: 'Taller',
          fechaIngreso: ahora,
          calendarioProduccionJson: cal,
        },
      }),
    );
  habitual = personal[0].id;
  apoyo = personal[1].id;
  estacionId = (
    await db.estacion.create({
      data: {
        tenantId,
        nombre: 'Revisión',
        calendarioJson: cal,
        planificacionPorEmpleados: true,
        tiempoPreparacionMin: 0,
        reglas: { create: { tenantId, tipo: 'familia', valor: 'pre_prensa' } },
        empleados: {
          create: personal.map((p, i) => ({
            tenantId,
            empleadoId: p.id,
            asignacionAutomatica: i === 0,
          })),
        },
      },
    })
  ).id;
  categoriaId = (
    await db.productoCategoriaComercial.create({
      data: { codigo: tenantId, nombre: 'QA' },
    })
  ).id;
  const sub = await db.productoSubcategoriaComercial.create({
    data: {
      categoriaId,
      codigo: tenantId,
      nombre: 'QA',
      atributosSchemaJson: {},
    },
  });
  const producto = await db.producto.create({
    data: {
      tenantId,
      codigo: 'QA',
      nombre: 'Trabajo ficticio',
      subcategoriaComercialId: sub.id,
    },
  });
  const cot = await db.cotizacion.create({ data: { tenantId } });
  const ci = await db.cotizacionItem.create({
    data: {
      tenantId,
      cotizacionId: cot.id,
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
            rutaPasoId: 'impresion',
            activado: true,
            familiaCodigo: 'pre_prensa',
            nombreVisible: 'Revisión',
            tiempo: { totalMin: 60 },
          },
        ],
      },
    },
  });
  payload = {
    idempotencyKey: randomUUID(),
    estado: 'borrador',
    clienteId: cliente.id,
    canalVenta: 'mostrador',
    fechaEntrega: '2026-12-31',
    items: [
      {
        cotizacionItemId: ci.id,
        codigo: 'QA',
        nombre: 'Trabajo ficticio',
        familia: 'Manual',
        cantidad: 1,
        cantidadUnidad: 'u',
        subtotal: 100,
        impuestos: 0,
        total: 100,
      },
    ],
  };
  jest.spyOn(eta, 'contextoSimulacion').mockImplementation(async (...args) => ({
    ...(await realContexto(...args)),
    ahora,
  }));
  jest.spyOn(eta, 'capturarEmision').mockResolvedValue(undefined as never);
  jest
    .spyOn(eta, 'sincronizarAsignaciones')
    .mockResolvedValue(undefined as never);
  jest.spyOn(service, 'findOne').mockImplementation(
    async (a, id) =>
      (await db.ordenTrabajo.findFirstOrThrow({
        where: { id, tenantId: a.tenantId },
      })) as never,
  );
});
afterEach(async () => {
  jest.restoreAllMocks();
  await db.tenant.deleteMany({ where: { id: { in: [auth.tenantId, ajeno] } } });
  await db.user.delete({ where: { id: auth.userId } });
  await db.productoSubcategoriaComercial.deleteMany({ where: { categoriaId } });
  await db.productoCategoriaComercial.delete({ where: { id: categoriaId } });
});
afterAll(() => db.$disconnect());

it('ofrece habitual y apoyo, guarda el borrador y emite con la elección intacta', async () => {
  const vista = await revisar();
  expect(
    vista.items[0].pasos[0].candidatos.map((p) => p.asignacionAutomatica),
  ).toEqual([true, false]);
  expect(vista.items[0].pasos[0].finElegido).toBeTruthy();
  const orden = await service.create(auth, dto());
  const item = await db.ordenTrabajoItem.findFirstOrThrow({
    where: { ordenId: orden.id },
  });
  expect(
    leerPersonalPrevisto(item.personalPrevistoJson)?.pasos[0].asignacion
      .empleadoIds,
  ).toEqual([apoyo]);
  expect(
    await db.ordenTrabajoItemPaso.count({ where: { ordenId: orden.id } }),
  ).toBe(0);
  await service.cambiarEstado(auth, orden.id, { estado: 'pendiente' });
  const paso = await db.ordenTrabajoItemPaso.findFirstOrThrow({
    where: { ordenId: orden.id },
  });
  expect(leerAsignacionManual(paso.asignacionManualJson)?.empleadoIds).toEqual([
    apoyo,
  ]);
  // Reconciliar la agenda conserva la decisión humana.
  jest.spyOn(eta, 'sincronizarAsignaciones').mockRestore();
  await eta.sincronizarAsignaciones(auth.tenantId);
  expect(
    leerAsignacionManual(
      (
        await db.ordenTrabajoItemPaso.findUniqueOrThrow({
          where: { id: paso.id },
        })
      ).asignacionManualJson,
    )?.empleadoIds,
  ).toEqual([apoyo]);
});

it('no permite consultar ni guardar operadores sin supervisión', async () => {
  const limitado = { ...auth, permisos: new Set<string>() };
  await expect(
    service.revisarPersonalPrevisto(limitado, [
      { cotizacionItemId: payload.items[0].cotizacionItemId },
    ]),
  ).rejects.toThrow('supervisión');
  await expect(service.create(limitado, dto())).rejects.toThrow('supervisión');
  expect(
    await db.ordenTrabajo.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
});
it('aísla cotizaciones y borradores de otra empresa', async () => {
  await expect(
    service.revisarPersonalPrevisto({ ...auth, tenantId: ajeno }, [
      { cotizacionItemId: payload.items[0].cotizacionItemId },
    ]),
  ).rejects.toThrow('cotización');
  await expect(
    service.revisarPersonalPrevisto(auth, [
      {
        cotizacionItemId: payload.items[0].cotizacionItemId,
        ordenItemId: randomUUID(),
      },
    ]),
  ).rejects.toThrow('borrador propio');
});
it('rechaza personal fuera de la estación, pasos inexistentes y dotación incorrecta', async () => {
  await expect(
    revisar([{ nodoClave: 'ruta:impresion', empleadoIds: [randomUUID()] }]),
  ).rejects.toThrow('habilitado');
  await expect(
    revisar([{ nodoClave: 'no-existe', empleadoIds: [apoyo] }]),
  ).rejects.toThrow('ya no existe');
  await expect(
    revisar([{ nodoClave: 'ruta:impresion', empleadoIds: [apoyo, habitual] }]),
  ).rejects.toThrow('exactamente');
});
it('revalida al emitir y revierte la emisión si el operador dejó de estar habilitado', async () => {
  const orden = await service.create(auth, dto());
  await db.estacionEmpleado.deleteMany({
    where: { estacionId, empleadoId: apoyo },
  });
  await expect(
    service.cambiarEstado(auth, orden.id, { estado: 'pendiente' }),
  ).rejects.toThrow('habilitado');
  expect(
    (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } }))
      .estado,
  ).toBe('borrador');
  expect(
    await db.ordenTrabajoItemPaso.count({ where: { ordenId: orden.id } }),
  ).toBe(0);
});
it('mantiene el automático cuando no se elige personal', async () => {
  const orden = await service.create(auth, { ...payload, estado: 'pendiente' });
  const paso = await db.ordenTrabajoItemPaso.findFirstOrThrow({
    where: { ordenId: orden.id },
  });
  expect(paso.asignacionManualJson).toBeNull();
});

it('editar un borrador conserva la elección omitida y sólo supervisión puede cambiarla', async () => {
  const orden = await service.create(auth, dto());
  const item = await db.ordenTrabajoItem.findFirstOrThrow({
    where: { ordenId: orden.id },
  });
  const editar = async (
    a: CurrentAuth,
    asignacionesPersonal?: { nodoClave: string; empleadoIds: string[] }[],
  ) => {
    const ot = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: orden.id },
    });
    return service.editarLote(a, orden.id, {
      expectedVersion: ot.updatedAt.toISOString(),
      items: [
        {
          ...payload.items[0],
          id: item.id,
          ...(asignacionesPersonal === undefined
            ? {}
            : { asignacionesPersonal }),
        },
      ],
    });
  };
  const limitado = { ...auth, permisos: new Set<string>() };
  await editar(limitado);
  expect(
    leerPersonalPrevisto(
      (await db.ordenTrabajoItem.findUniqueOrThrow({ where: { id: item.id } }))
        .personalPrevistoJson,
    )?.pasos[0].asignacion.empleadoIds,
  ).toEqual([apoyo]);
  await expect(editar(limitado, [])).rejects.toThrow('supervisión');
  await editar(auth, []);
  expect(
    leerPersonalPrevisto(
      (await db.ordenTrabajoItem.findUniqueOrThrow({ where: { id: item.id } }))
        .personalPrevistoJson,
    )?.pasos,
  ).toEqual([]);
});
it('una orden emitida cambia de operador por el flujo de Producción, no por la edición comercial', async () => {
  const orden = await service.create(auth, { ...dto(), estado: 'pendiente' });
  const item = await db.ordenTrabajoItem.findFirstOrThrow({
    where: { ordenId: orden.id },
  });
  const ot = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: orden.id },
  });
  await expect(
    service.editarLote(auth, orden.id, {
      expectedVersion: ot.updatedAt.toISOString(),
      items: [{ ...payload.items[0], id: item.id, asignacionesPersonal: [] }],
    }),
  ).rejects.toThrow('ya está emitida');
});
it('no emite una selección con horario sin intersección con la estación', async () => {
  const orden = await service.create(auth, dto());
  await db.empleado.update({
    where: { id: apoyo },
    data: {
      calendarioProduccionJson: {
        dias: { lun: [{ desde: '02:00', hasta: '03:00' }] },
      },
    },
  });
  await expect(
    service.cambiarEstado(auth, orden.id, { estado: 'pendiente' }),
  ).rejects.toThrow('fecha realizable');
  expect(
    (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } }))
      .estado,
  ).toBe('borrador');
});

it('editar una OT emitida conserva la reasignación vigente y no revive la selección antigua del borrador', async () => {
  const orden = await service.create(auth, { ...dto(), estado: 'pendiente' });
  const item = await db.ordenTrabajoItem.findFirstOrThrow({
    where: { ordenId: orden.id },
  });
  const paso = await db.ordenTrabajoItemPaso.findFirstOrThrow({
    where: { itemId: item.id },
  });
  const original = leerAsignacionManual(paso.asignacionManualJson)!;
  await db.ordenTrabajoItemPaso.update({
    where: { id: paso.id },
    data: {
      asignacionManualJson: {
        ...original,
        empleadoIds: [habitual],
        revision: randomUUID(),
      },
    },
  });
  await db.estacionEmpleado.deleteMany({
    where: { estacionId, empleadoId: apoyo },
  });
  const ot = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: orden.id },
  });
  await service.editarLote(auth, orden.id, {
    expectedVersion: ot.updatedAt.toISOString(),
    items: [
      { ...payload.items[0], id: item.id, asignacionesPersonal: elecciones() },
    ],
  });
  const actual = await db.ordenTrabajoItemPaso.findFirstOrThrow({
    where: { itemId: item.id },
  });
  expect(
    leerAsignacionManual(actual.asignacionManualJson)?.empleadoIds,
  ).toEqual([habitual]);
});
