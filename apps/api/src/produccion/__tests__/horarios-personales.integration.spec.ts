import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ProduccionService } from '../produccion.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { calendarioDefault } from '../../eta/motor/estaciones-tipos';
import { huellaContextoPlan } from '../../planificacion-entregas/planificacion-contrato';

const db = new PrismaService(),
  a = randomUUID(),
  b = randomUUID();
const service = new ProduccionService(db);
const auth = { tenantId: a, userId: randomUUID() } as CurrentAuth;
let empleadoId: string, ajenoId: string;
const calendario = calendarioDefault();
const payload = (nombre: string) => ({
  nombre,
  activo: true,
  planificacionPorEmpleados: true,
  calendario,
  empleadoIds: [empleadoId],
  familias: [],
  maquinaIds: [],
});
beforeAll(async () => {
  await db.tenant.createMany({
    data: [a, b].map((id) => ({
      id,
      nombre: 'Horario QA',
      slug: `qa-horarios-${id}`,
    })),
  });
  for (const tenantId of [a, b]) {
    const e = await db.empleado.create({
      data: {
        tenantId,
        nombreCompleto: 'Persona QA',
        emailPrincipal: 'persona@example.test',
        telefonoCodigo: '+54',
        telefonoNumero: '000',
        sector: 'Taller',
        fechaIngreso: new Date('2026-01-01'),
      },
    });
    if (tenantId === a) empleadoId = e.id;
    else ajenoId = e.id;
  }
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [a, b] } } });
  await db.$disconnect();
});
it('persiste un único horario por persona, se comparte y cambia la huella de planificación', async () => {
  const primera = await service.createEstacion(auth, {
    ...payload('Diseño'),
    horariosEmpleados: [{ empleadoId, calendario }],
  });
  const segunda = await service.createEstacion(auth, payload('Armado'));
  const contexto = async () => ({
    estaciones: await service.findEstaciones(a),
    items: [],
    medianas: new Map<string, number>(),
    ahora: new Date(),
    zona: 'America/Argentina/Rio_Gallegos',
  });
  const antes = huellaContextoPlan(await contexto(), 1);
  const modificado = {
    ...calendario,
    dias: { ...calendario.dias, lun: [{ desde: '11:00', hasta: '17:00' }] },
  };
  await service.updateEstacion(auth, primera.id, {
    ...payload('Diseño'),
    horariosEmpleados: [{ empleadoId, calendario: modificado }],
  });
  const estaciones = await service.findEstaciones(a);
  expect(
    estaciones.find((e) => e.id === segunda.id)?.empleados[0].calendario,
  ).toEqual(modificado);
  expect(estaciones.every((e) => e.planificacionPorEmpleados)).toBe(true);
  expect(huellaContextoPlan(await contexto(), 1)).not.toBe(antes);
  expect((await service.recursosEstaciones(a)).empleados[0].calendario).toEqual(
    modificado,
  );
  expect(
    (await db.empleado.findUniqueOrThrow({ where: { id: empleadoId } })).userId,
  ).toBeNull();
});
it('rechaza modificar horarios de otra empresa o de personas no asignadas', async () => {
  await expect(
    service.createEstacion(auth, {
      ...payload('Ajena'),
      empleadoIds: [ajenoId],
      horariosEmpleados: [{ empleadoId: ajenoId, calendario }],
    }),
  ).rejects.toThrow();
  await expect(
    service.createEstacion(auth, {
      ...payload('Fuera'),
      empleadoIds: [],
      horariosEmpleados: [{ empleadoId, calendario }],
    }),
  ).rejects.toThrow('asignado');
  expect(
    (await db.empleado.findUniqueOrThrow({ where: { id: ajenoId } }))
      .calendarioProduccionJson,
  ).toBeNull();
});
it('rechaza franjas solapadas y no modifica datos al fallar', async () => {
  const antes = await db.empleado.findUniqueOrThrow({
    where: { id: empleadoId },
  });
  await expect(
    service.createEstacion(auth, {
      ...payload('Inválida'),
      horariosEmpleados: [
        {
          empleadoId,
          calendario: {
            ...calendario,
            dias: {
              ...calendario.dias,
              lun: [
                { desde: '09:00', hasta: '12:00' },
                { desde: '11:00', hasta: '14:00' },
              ],
            },
          },
        },
      ],
    }),
  ).rejects.toThrow();
  expect(
    (await db.empleado.findUniqueOrThrow({ where: { id: empleadoId } }))
      .calendarioProduccionJson,
  ).toEqual(antes.calendarioProduccionJson);
});
it('permite quitar una asignación sin borrar el horario personal', async () => {
  const s = await service.createEstacion(auth, payload('Temporal'));
  await service.updateEstacion(auth, s.id, {
    ...payload('Temporal'),
    empleadoIds: [],
  });
  expect(
    (await db.empleado.findUniqueOrThrow({ where: { id: empleadoId } }))
      .calendarioProduccionJson,
  ).not.toBeNull();
});
it('la migración es explícita, conserva el vínculo anterior para no duplicar capacidad y no puede revertirse con un cliente antiguo', async () => {
  const equipo = await db.equipoProduccion.create({
    data: {
      tenantId: a,
      nombre: 'Anterior QA',
      personas: 2,
      calendarioJson: calendario,
    },
  });
  const s = await service.createEstacion(auth, {
    nombre: 'Anterior',
    activo: true,
    equipoProduccionId: equipo.id,
    capacidadConcurrente: 2,
  });
  expect(s.planificacionPorEmpleados).toBe(false);
  const migrada = await service.updateEstacion(auth, s.id, payload('Anterior'));
  expect(migrada.planificacionPorEmpleados).toBe(true);
  expect(migrada.equipoProduccionId).toBe(equipo.id);
  expect(
    (
      await service.updateEstacion(auth, s.id, {
        ...payload('Anterior'),
        planificacionPorEmpleados: false,
      })
    ).planificacionPorEmpleados,
  ).toBe(true);
});
