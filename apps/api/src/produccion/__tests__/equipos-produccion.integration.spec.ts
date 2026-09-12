import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EquiposProduccionService } from '../equipos-produccion.service';
import { ProduccionService } from '../produccion.service';
import { EquiposProduccionController } from '../equipos-produccion.controller';
import { PERMISO_KEY } from '../../auth/permiso.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { calendarioDefault } from '../../eta/motor/estaciones-tipos';
import { huellaContextoPlan } from '../../planificacion-entregas/planificacion-contrato';

const db = new PrismaService(),
  a = randomUUID(),
  b = randomUUID();
const equipos = new EquiposProduccionService(db),
  produccion = new ProduccionService(db);
const auth = { tenantId: a, userId: randomUUID() } as CurrentAuth;
beforeAll(async () => {
  await db.tenant.createMany({
    data: [a, b].map((id) => ({
      id,
      nombre: 'Equipo QA',
      slug: `qa-equipo-${id}`,
    })),
  });
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [a, b] } } });
  await db.$disconnect();
});

it('crea un equipo, lo comparte, persiste horarios y cambia la huella de planificación al editar capacidad', async () => {
  const payload = {
    nombre: 'Taller',
    personas: 2,
    activo: true,
    calendario: calendarioDefault(),
  };
  const creado = await equipos.guardar(a, payload);
  const agenda = {
    ...calendarioDefault(),
    dias: {
      lun: null,
      mar: null,
      mie: null,
      jue: [{ desde: '09:00', hasta: '18:00' }],
      vie: null,
      sab: null,
      dom: null,
    },
  };
  const estaciones = await Promise.all(
    ['DTF', 'Instalación'].map((nombre) =>
      produccion.createEstacion(auth, {
        nombre,
        activo: true,
        equipoProduccionId: creado.id,
        calendario: nombre === 'DTF' ? agenda : payload.calendario,
        capacidadConcurrente: 1,
        familias: [],
        empleadoIds: [],
        maquinaIds: [],
      }),
    ),
  );
  expect(estaciones.every((e) => e.equipoProduccion?.personas === 2)).toBe(
    true,
  );
  expect(estaciones[0].calendario?.dias.lun).toBeNull();
  const contexto = async () => ({
    estaciones: await produccion.findEstaciones(a),
    items: [],
    medianas: new Map<string, number>(),
    ahora: new Date(),
    zona: 'America/Argentina/Rio_Gallegos',
  });
  const antes = huellaContextoPlan(await contexto(), 1);
  await equipos.guardar(a, { ...payload, personas: 1 }, creado.id);
  expect(huellaContextoPlan(await contexto(), 1)).not.toBe(antes);
  expect(
    (await produccion.findEstaciones(a)).every(
      (e) => e.equipoProduccion?.personas === 1,
    ),
  ).toBe(true);
  await equipos.guardar(a, { ...payload, activo: false }, creado.id);
  expect((await produccion.findEstaciones(a))[0].equipoProduccion?.activo).toBe(
    false,
  );
});
it('aísla lectura, edición y vinculación entre empresas', async () => {
  const e = await equipos.guardar(b, {
    nombre: 'Ajeno',
    personas: 2,
    activo: true,
    calendario: calendarioDefault(),
  });
  expect((await equipos.listar(a)).some((x) => x.id === e.id)).toBe(false);
  await expect(
    equipos.guardar(
      a,
      {
        nombre: 'Ajeno',
        personas: 3,
        activo: true,
        calendario: calendarioDefault(),
      },
      e.id,
    ),
  ).rejects.toBeInstanceOf(NotFoundException);
  await expect(
    produccion.createEstacion(auth, {
      nombre: 'No válida',
      activo: true,
      equipoProduccionId: e.id,
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
});
it('rechaza horarios vacíos y restringe las mutaciones a configuración', async () => {
  expect(Reflect.getMetadata(PERMISO_KEY, EquiposProduccionController)).toEqual(
    ['produccion.configurar'],
  );
  await expect(
    equipos.guardar(a, {
      nombre: 'Sin horario',
      personas: 2,
      activo: true,
      calendario: {
        dias: {
          lun: null,
          mar: null,
          mie: null,
          jue: null,
          vie: null,
          sab: null,
          dom: null,
        },
      },
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
});
