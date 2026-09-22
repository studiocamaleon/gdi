import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { EnlacesPublicosService } from '../../enlaces-publicos/enlaces-publicos.service';
import { DesarrolloDocumentalService } from '../desarrollo-documental.service';
const db = new PrismaService();
afterAll(() => db.$disconnect());
beforeAll(async () => {
  const [fila] = await db.$queryRaw<
    Array<{ nombre: string }>
  >`SELECT current_database() AS nombre`;
  if (!fila.nombre.endsWith('_test')) throw new Error('Sólo base de pruebas.');
});
function senal() {
  let resolver!: () => void;
  const promesa = new Promise<void>((r) => {
    resolver = r;
  });
  return { resolver, promesa };
}
async function escenario(
  fn: (x: {
    service: DesarrolloDocumentalService;
    capacidades: CapacidadesEmpresaService;
    enlaces: EnlacesPublicosService;
    auth: CurrentAuth;
    solicitudId: string;
    token: string;
  }) => Promise<void>,
) {
  const tenant = await db.tenant.create({
    data: { nombre: 'Arte concurrente', slug: randomUUID() },
  });
  const user = await db.user.create({
    data: { email: `arte-${randomUUID()}@test.local`, nombreCompleto: 'QA' },
  });
  try {
    const auth = {
      tenantId: tenant.id,
      userId: user.id,
      email: user.email,
      role: 'ADMINISTRADOR',
    } as CurrentAuth;
    const capacidades = new CapacidadesEmpresaService(db);
    const enlaces = new EnlacesPublicosService(db, capacidades);
    const service = new DesarrolloDocumentalService(
      db,
      enlaces,
      {} as never,
      undefined,
      capacidades,
    );
    const orden = await db.ordenTrabajo.create({
      data: { tenantId: tenant.id, numero: 'OT-QA' },
    });
    const archivo = await db.archivo.create({
      data: {
        tenantId: tenant.id,
        ordenId: orden.id,
        scope: 'ORDEN',
        key: randomUUID(),
        nombreOriginal: 'arte.pdf',
        mimeType: 'application/pdf',
        hash: 'a'.repeat(64),
        estado: 'LISTO',
      },
    });
    let data = await service.crearMaestro(auth, {
      ordenId: orden.id,
      nombre: 'Arte',
      proposito: 'PRINT',
      etapa: 'DISENO',
    });
    data = await service.crearRevision(auth, data.maestros[0].id, {
      archivoId: archivo.id,
    });
    data = await service.solicitar(auth, data.maestros[0].revisiones[0].id, {
      tipo: 'CLIENTE',
      permiteDecisionExterna: true,
    });
    const solicitudId = data.maestros[0].revisiones[0].solicitudes[0].id;
    const link = await service.emitirLink(auth, solicitudId, {});
    await fn({
      service,
      capacidades,
      enlaces,
      auth,
      solicitudId,
      token: link.token,
    });
  } finally {
    await db.tenant.delete({ where: { id: tenant.id } });
    await db.user.delete({ where: { id: user.id } });
  }
}
it('dos respuestas simultáneas desde conexiones distintas registran una sola decisión', async () => {
  await escenario(async (x) => {
    const listas = senal();
    const pids = new Set<number>();
    const exigir = x.capacidades.exigirOperacionTx.bind(x.capacidades);
    jest
      .spyOn(x.capacidades, 'exigirOperacionTx')
      .mockImplementation(async (tx, tenantId, requeridas, compromisos) => {
        const [fila] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`;
        pids.add(fila.pid);
        if (pids.size === 2) listas.resolver();
        await listas.promesa;
        await exigir(tx, tenantId, requeridas, compromisos);
      });
    const resultados = await Promise.allSettled([
      x.service.decidirPublico(x.token, {
        decision: 'APROBAR',
        actorNombre: 'Cliente A',
      }),
      x.service.decidirPublico(x.token, {
        decision: 'RECHAZAR',
        actorNombre: 'Cliente B',
        comentario: 'Corregir color',
      }),
    ]);
    expect(pids.size).toBe(2);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { status: 409 },
    });
    expect(
      await db.decisionAprobacionDocumentoRegistro.count({
        where: { solicitudId: x.solicitudId },
      }),
    ).toBe(1);
  });
});
it('revocar el enlace después de resolver el token impide confirmar la decisión', async () => {
  await escenario(async (x) => {
    const leida = senal(),
      continuar = senal();
    const resolver = x.enlaces.resolver.bind(x.enlaces);
    jest.spyOn(x.enlaces, 'resolver').mockImplementation(async (...args) => {
      const resuelto = await resolver(...args);
      leida.resolver();
      await continuar.promesa;
      return resuelto;
    });
    const decision = x.service.decidirPublico(x.token, {
      decision: 'APROBAR',
      actorNombre: 'Cliente',
    });
    // Conservar el rechazo mientras se coordina la intercalación.
    const resultado = decision.then(
      () => null,
      (error) => error as { status: number },
    );
    try {
      await leida.promesa;
      await x.service.revocarLink(x.auth, x.solicitudId);
    } finally {
      continuar.resolver();
    }
    expect(await resultado).toMatchObject({ status: 404 });
    expect(
      await db.decisionAprobacionDocumentoRegistro.count({
        where: { solicitudId: x.solicitudId },
      }),
    ).toBe(0);
  });
});
