import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegistroService } from './registro.service';
import { TenantProvisioningService } from '../provisionamiento/tenant-provisioning.service';
import type { CurrentAuth } from '../auth/auth.types';

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** PostgreSQL y provisión reales. Sólo se sustituyen correo y emisión de JWT;
 * los puntos de espera simulan otra solicitud sin hacer llamadas externas. */
describe('Registro público: consumo único y versión exacta del enlace', () => {
  const prisma = new PrismaService();
  const planes: string[] = [];
  const tenants: string[] = [];
  const emails: string[] = [];
  let baseValidada = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    ) {
      throw new Error('Sólo base local de test');
    }
    baseValidada = true;
    await prisma.$connect();
  });

  afterAll(async () => {
    if (baseValidada) {
      await prisma.registroTenant.deleteMany({
        where: { email: { in: emails } },
      });
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.plan.deleteMany({ where: { id: { in: planes } } });
    }
    await prisma.$disconnect();
  });

  async function preparar(existente: boolean) {
    const email = `qa-registro-${randomUUID()}@example.invalid`;
    emails.push(email);
    const plan = await prisma.plan.create({
      data: {
        codigo: `qa-registro-${randomUUID()}`,
        nombre: 'Plan ficticio',
        precioMensual: 0,
        featuresJson: {},
        trialDias: 14,
      },
    });
    planes.push(plan.id);
    const user = existente
      ? await prisma.user.create({
          data: { email, passwordHash: 'hash-ficticio-no-login' },
        })
      : null;
    const token = randomUUID();
    const registro = await prisma.registroTenant.create({
      data: {
        email,
        nombreCompleto: 'Persona ficticia',
        empresaNombre: 'Empresa ficticia',
        passwordHash: existente ? null : 'hash-original-ficticio-no-login',
        planId: plan.id,
        paisCodigo: 'AR',
        zonaHoraria: 'America/Argentina/Buenos_Aires',
        tokenHash: hash(token),
        tokenExpiraEl: new Date(Date.now() + 3600000),
        terminosVersion: 'qa',
        terminosAceptadosEl: new Date(),
      },
    });
    const current = { userId: user?.id, email } as CurrentAuth;
    const auth = {
      crearSesionParaMembership: jest.fn(() =>
        Promise.resolve({ accessToken: 'jwt-ficticio-no-valido' }),
      ),
    };
    const provisionamiento = new TenantProvisioningService();
    const original = provisionamiento.provisionarBase.bind(provisionamiento);
    const provisionar = jest
      .spyOn(provisionamiento, 'provisionarBase')
      .mockImplementation(async (tx, args) => {
        // Hace visible el solapamiento sin alterar la lógica transaccional.
        await tx.$queryRaw`SELECT pg_sleep(0.1)::text`;
        const alta = await original(tx, args);
        tenants.push(alta.tenantId);
        return alta;
      });
    let antesDeTransaccion = () => Promise.resolve();
    const db = new Proxy(prisma, {
      get(target, key) {
        if (key === '$transaction') {
          return async (
            fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
          ) => {
            await antesDeTransaccion();
            return target.$transaction(fn);
          };
        }
        return Reflect.get(target, key) as unknown;
      },
    });
    const service = new RegistroService(
      db,
      {} as never,
      provisionamiento,
      auth as never,
    );
    return {
      email,
      user,
      registro,
      token,
      current,
      auth,
      provisionar,
      service,
      antes(fn: () => Promise<void>) {
        antesDeTransaccion = fn;
      },
      completar() {
        return existente
          ? service.completarExistente(token, current)
          : service.completarNuevo(token);
      },
    };
  }

  it.each([false, true])(
    'un enlace sustituido entre la lectura y el alta no autoriza los datos nuevos (existente=%s)',
    async (existente) => {
      const c = await preparar(existente);
      const nuevoToken = randomUUID();
      c.antes(async () => {
        await prisma.registroTenant.update({
          where: { id: c.registro.id },
          data: {
            tokenHash: hash(nuevoToken),
            tokenVersion: { increment: 1 },
            passwordHash: 'hash-ajeno-ficticio-no-login',
          },
        });
      });
      await expect(c.completar()).rejects.toThrow();
      expect(c.provisionar).not.toHaveBeenCalled();
      expect(c.auth.crearSesionParaMembership).not.toHaveBeenCalled();
      expect(
        await prisma.registroTenant.findUniqueOrThrow({
          where: { id: c.registro.id },
        }),
      ).toMatchObject({ tokenHash: hash(nuevoToken), completadoEl: null });
      if (!existente)
        expect(
          await prisma.user.findUnique({ where: { email: c.email } }),
        ).toBeNull();
    },
  );

  it('dos solicitudes simultáneas de un mismo usuario no crean dos empresas ni dos sesiones', async () => {
    const c = await preparar(true);
    let llegadas = 0;
    let liberar!: () => void;
    const ambas = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    c.antes(async () => {
      llegadas += 1;
      if (llegadas === 2) liberar();
      await ambas;
    });
    const resultados = await Promise.allSettled([c.completar(), c.completar()]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(c.provisionar).toHaveBeenCalledTimes(1);
    expect(c.auth.crearSesionParaMembership).toHaveBeenCalledTimes(1);
    expect(
      await prisma.membership.count({ where: { userId: c.user!.id } }),
    ).toBe(1);
  });

  it('un fallo al preparar la empresa devuelve el enlace y no deja usuario ni sesión parcial', async () => {
    const c = await preparar(false);
    c.provisionar.mockRejectedValueOnce(
      new Error('Fallo ficticio de provisión'),
    );
    await expect(c.completar()).rejects.toThrow('Fallo ficticio de provisión');
    expect(
      await prisma.user.findUnique({ where: { email: c.email } }),
    ).toBeNull();
    expect(
      await prisma.registroTenant.findUniqueOrThrow({
        where: { id: c.registro.id },
      }),
    ).toMatchObject({ tokenHash: hash(c.token), completadoEl: null });
    expect(c.auth.crearSesionParaMembership).not.toHaveBeenCalled();
    await expect(c.completar()).resolves.toMatchObject({
      requiereLogin: false,
    });
    expect(
      await prisma.user.findUniqueOrThrow({ where: { email: c.email } }),
    ).toMatchObject({
      passwordHash: c.registro.passwordHash,
      emailVerificado: c.email,
    });
    await expect(c.completar()).rejects.toThrow();
    expect(c.auth.crearSesionParaMembership).toHaveBeenCalledTimes(1);
  });

  it.each(['revocado', 'vencido'] as const)(
    'revalida el enlace %s antes de empezar a crear la empresa',
    async (estado) => {
      const c = await preparar(false);
      c.antes(async () => {
        await prisma.registroTenant.update({
          where: { id: c.registro.id },
          data:
            estado === 'revocado'
              ? { revocadoEl: new Date() }
              : { tokenExpiraEl: new Date(Date.now() - 1_000) },
        });
      });
      await expect(c.completar()).rejects.toThrow();
      expect(c.provisionar).not.toHaveBeenCalled();
      expect(c.auth.crearSesionParaMembership).not.toHaveBeenCalled();
      expect(
        await prisma.user.findUnique({ where: { email: c.email } }),
      ).toBeNull();
    },
  );

  it('otro correo autenticado no puede usar el enlace', async () => {
    const c = await preparar(true);
    await expect(
      c.service.completarExistente(c.token, {
        ...c.current,
        email: 'otra-persona@example.invalid',
      }),
    ).rejects.toThrow();
    expect(c.provisionar).not.toHaveBeenCalled();
    expect(c.auth.crearSesionParaMembership).not.toHaveBeenCalled();
  });
});
