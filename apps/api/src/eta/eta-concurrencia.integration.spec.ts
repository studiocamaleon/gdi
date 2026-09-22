import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProduccionService } from '../produccion/produccion.service';
import { bloquearCupoUsuarios } from '../suscripciones/cupos-usuarios';
import type { CurrentAuth } from '../auth/auth.types';
import { EtaService } from './eta.service';

const db = new PrismaService();
afterAll(() => db.$disconnect());
beforeAll(async () => {
  const [fila] = await db.$queryRaw<
    Array<{ nombre: string }>
  >`SELECT current_database() AS nombre`;
  if (!fila.nombre.endsWith('_test')) throw new Error('Sólo base de pruebas.');
});

function senal<T = void>() {
  let resolver!: (value: T) => void;
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

async function escenario(
  fn: (f: {
    tenantId: string;
    ordenId: string;
    auth: CurrentAuth;
  }) => Promise<void>,
) {
  const tenant = await db.tenant.create({
    data: {
      nombre: 'ETA concurrente',
      slug: `eta-concurrente-${randomUUID()}`,
    },
  });
  try {
    // La cuenta compatible permite ETA. Las versiones publicadas se prueban
    // en eta-planes; aquí se verifica el cerrojo real entre conexiones.
    const orden = await db.ordenTrabajo.create({
      data: {
        tenantId: tenant.id,
        numero: 'OT-QA',
        estado: 'pendiente',
        items: {
          create: {
            tenantId: tenant.id,
            codigo: 'QA',
            nombre: 'Trabajo',
            familia: 'Manual',
            cantidad: 1,
            cantidadUnidad: 'u',
            subtotal: 0,
            impuestos: 0,
            total: 0,
          },
        },
      },
    });
    await fn({
      tenantId: tenant.id,
      ordenId: orden.id,
      auth: { tenantId: tenant.id } as CurrentAuth,
    });
  } finally {
    await db.tenant.delete({ where: { id: tenant.id } });
  }
}

it('dos capturas de emisión simultáneas guardan una única promesa', async () => {
  await escenario(async (f) => {
    const eta = new EtaService(db, new ProduccionService(db));
    const calcular = eta.correr.bind(eta);
    const listas = senal();
    let calculadas = 0;
    jest.spyOn(eta, 'correr').mockImplementation(async (tenantId) => {
      const resultado = await calcular(tenantId);
      if (++calculadas === 2) listas.resolver();
      await listas.promesa;
      return resultado;
    });
    await Promise.all([
      eta.capturarEmision(f.auth, f.ordenId),
      eta.capturarEmision(f.auth, f.ordenId),
    ]);
    expect(await db.etaPromesa.count({ where: { tenantId: f.tenantId } })).toBe(
      1,
    );
  });
});

it('la publicación espera un bloqueo de cuenta y vuelve a validar tras el commit', async () => {
  await escenario(async (f) => {
    const bloqueador = senal<number>(),
      publicador = senal<number>(),
      liberar = senal();
    const bloqueo = db.$transaction(
      async (tx) => {
        await bloquearCupoUsuarios(tx, f.tenantId);
        await tx.tenant.update({
          where: { id: f.tenantId },
          data: { activo: false },
        });
        const [fila] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`;
        bloqueador.resolver(fila.pid);
        await liberar.promesa;
      },
      { timeout: 15000 },
    );
    const cliente = new Proxy(db, {
      get(target, prop) {
        if (prop === '$transaction')
          return (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
            db.$transaction(
              async (tx) => {
                const [fila] = await tx.$queryRaw<
                  Array<{ pid: number }>
                >`SELECT pg_backend_pid() AS pid`;
                publicador.resolver(fila.pid);
                return fn(tx);
              },
              { timeout: 15000 },
            );
        return Reflect.get(target, prop) as unknown;
      },
    });
    const eta = new EtaService(cliente, new ProduccionService(db));
    let captura: Promise<void> | undefined;
    try {
      const pidBloqueador = await Promise.race([
        bloqueador.promesa,
        bloqueo.then(() => {
          throw new Error('No tomó el cerrojo');
        }),
      ]);
      captura = eta.capturarEmision(f.auth, f.ordenId);
      const pidPublicador = await Promise.race([
        publicador.promesa,
        captura.then(() => {
          throw new Error('Terminó sin intentar publicar');
        }),
      ]);
      expect(pidPublicador).not.toBe(pidBloqueador);
      let esperando = false;
      const limite = Date.now() + 4000;
      while (Date.now() < limite) {
        const [fila] = await db.$queryRaw<
          Array<{ pids: number[] }>
        >`SELECT pg_blocking_pids(${pidPublicador}::int) AS pids`;
        if (fila.pids.includes(pidBloqueador)) {
          esperando = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(esperando).toBe(true);
    } finally {
      liberar.resolver();
      await bloqueo;
      await captura;
    }
    expect(await db.etaPromesa.count({ where: { tenantId: f.tenantId } })).toBe(
      0,
    );
  });
});
