import type { Server } from 'node:http';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { FiscalPlataformaModule } from '../../fiscal-plataforma/fiscal-plataforma.module';
import { CredencialesArcaService } from '../../fiscal-plataforma/credenciales-arca.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { FiscalPlataformaController } from '../fiscal.controller';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { parFicticio } from '../../../test/fixtures/par-arca';

describe('Plataforma ARCA — HTTP, cifrado, concurrencia y auditoría', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: CredencialesArcaService;
  const original = { ...process.env };
  const admin = randomUUID(),
    soporte = randomUUID(),
    usuario = randomUUID();
  let par: ReturnType<typeof parFicticio>;
  const cuerpo = () => ({
    ambiente: 'prod',
    certificado: par.cert,
    clavePrivada: par.key,
    revisionAnterior: null,
  });

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.match(/\/grafo_arca_\d+_test(?:\?|$)/))
      throw new Error(
        'Usar exclusivamente la base aislada grafo_arca_<fecha>_test.',
      );
    process.env.AFIPSDK_ENVIRONMENT = 'prod';
    process.env.INTEGRACIONES_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    );
    par = parFicticio();
    const mod = await Test.createTestingModule({
      imports: [PrismaModule, FiscalPlataformaModule],
      controllers: [FiscalPlataformaController],
      providers: [PlataformaGuard, PlataformaAdminGuard],
    }).compile();
    app = mod.createNestApplication();
    app.use(
      (
        req: Request & { auth?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        // Sólo la identidad está simulada: guard, validación HTTP, Prisma y cifrado son reales.
        const modo = req.headers['x-prueba-identidad'];
        if (modo)
          req.auth = {
            userId:
              modo === 'soporte'
                ? soporte
                : modo === 'tenant'
                  ? usuario
                  : admin,
            esPlataforma: modo !== 'tenant',
            plataformaMfaPendiente: modo === 'sin-mfa',
            ...(modo === 'impersonacion'
              ? { impersonacion: { actorUserId: admin } }
              : {}),
          };
        next();
      },
    );
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    );
    await app.init();
    prisma = mod.get(PrismaService);
    svc = mod.get(CredencialesArcaService);
    await prisma.user.createMany({
      data: [
        {
          id: admin,
          email: `${admin}@example.invalid`,
          rolPlataforma: 'ADMIN',
        },
        {
          id: soporte,
          email: `${soporte}@example.invalid`,
          rolPlataforma: 'SOPORTE',
        },
        { id: usuario, email: `${usuario}@example.invalid` },
      ],
    });
  });
  afterEach(async () => {
    await prisma.credencialFiscalPlataforma.deleteMany();
    await prisma.plataformaEvento.deleteMany({ where: { staffUserId: admin } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [admin, soporte, usuario] } },
    });
    await app.close();
    process.env = { ...original };
  });

  it('sin sesión no permite consultar ni cargar', async () => {
    await request(app.getHttpServer() as Server)
      .get('/plataforma/fiscal/arca')
      .expect(401);
    await request(app.getHttpServer() as Server)
      .put('/plataforma/fiscal/arca')
      .send(cuerpo())
      .expect(401);
  });
  it.each(['tenant', 'soporte', 'sin-mfa', 'impersonacion'])(
    '%s no puede cargar credenciales',
    async (modo) => {
      await request(app.getHttpServer() as Server)
        .put('/plataforma/fiscal/arca')
        .set('x-prueba-identidad', modo)
        .send(cuerpo())
        .expect(403);
      expect(await prisma.credencialFiscalPlataforma.count()).toBe(0);
    },
  );
  it('valida límites y campos sin reflejar claves en el error', async () => {
    const r = await request(app.getHttpServer() as Server)
      .put('/plataforma/fiscal/arca')
      .set('x-prueba-identidad', 'admin')
      .send({
        ...cuerpo(),
        clavePrivada: 'clave-invalida',
        inesperado: 'secreto-ficticio',
      })
      .expect(400);
    expect(r.text).not.toContain('secreto-ficticio');
    expect(r.text).not.toContain('clave-invalida');
    expect(
      await prisma.plataformaEvento.count({ where: { staffUserId: admin } }),
    ).toBe(0);
  });
  it('guarda cifrado, audita y devuelve sólo metadatos incluso a soporte', async () => {
    const r = await request(app.getHttpServer() as Server)
      .put('/plataforma/fiscal/arca')
      .set('x-prueba-identidad', 'admin')
      .send(cuerpo())
      .expect(200);
    expect(r.body).toMatchObject({
      ambiente: 'prod',
      vigente: true,
      certificado: { cuit: '30000000007' },
    });
    expect(r.text).not.toContain('PRIVATE KEY');
    expect(r.text).not.toContain('CERTIFICATE');
    expect(r.text).not.toContain('materialCifrado');
    const fila = await prisma.credencialFiscalPlataforma.findUniqueOrThrow({
      where: { ambiente: 'prod' },
    });
    expect(JSON.stringify(fila)).not.toContain('PRIVATE KEY');
    expect(await svc.material('prod')).toMatchObject({
      cert: par.cert,
      key: par.key,
    });
    const eventos = await prisma.plataformaEvento.findMany({
      where: { staffUserId: admin },
    });
    expect(eventos).toHaveLength(1);
    expect(JSON.stringify(eventos)).not.toContain('PRIVATE KEY');
    const consulta = await request(app.getHttpServer() as Server)
      .get('/plataforma/fiscal/arca')
      .set('x-prueba-identidad', 'soporte')
      .expect(200);
    expect(consulta.headers['cache-control']).toBe('no-store');
    expect(consulta.text).not.toContain('materialCifrado');
  });
  it('sólo uno de dos administradores puede reemplazar la misma revisión', async () => {
    const inicio = await svc.guardar(admin, { ...cuerpo(), ambiente: 'prod' });
    const revisionAnterior = inicio.certificado!.revision;
    const resultados = await Promise.allSettled(
      [1, 2].map(() =>
        svc.guardar(admin, { ...cuerpo(), ambiente: 'prod', revisionAnterior }),
      ),
    );
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.plataformaEvento.count({ where: { staffUserId: admin } }),
    ).toBe(2);
  });
  it('no acepta cambiar el ambiente desde el navegador', async () => {
    await request(app.getHttpServer() as Server)
      .put('/plataforma/fiscal/arca')
      .set('x-prueba-identidad', 'admin')
      .send({ ...cuerpo(), ambiente: 'dev' })
      .expect(409);
  });
  it('rechaza material trasladado a otro ambiente o modificado', async () => {
    await svc.guardar(admin, { ...cuerpo(), ambiente: 'prod' });
    await prisma.credencialFiscalPlataforma.update({
      where: { ambiente: 'prod' },
      data: { ambiente: 'dev' },
    });
    await expect(svc.material('dev')).rejects.toThrow(/no se puede utilizar/);
  });
});
