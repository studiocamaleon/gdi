import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Archivo, ArchivoEstado, TipoEnlacePublico } from '@prisma/client';
import request from 'supertest';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { DatosEmpresaService } from '../../tenants/datos-empresa.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { PresupuestosController } from '../../presupuestos/presupuestos.controller';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { PresupuestoPdfService } from '../../presupuestos/presupuesto-pdf.service';
import { PresupuestoPilotoService } from '../../presupuestos/pdf-piloto/presupuesto-piloto.service';
import { CorreoPresupuestoService } from '../../presupuestos/correo-presupuesto.service';
import { OrdenesTrabajoController } from '../../ordenes-trabajo/ordenes-trabajo.controller';
import { OrdenesTrabajoService } from '../../ordenes-trabajo/ordenes-trabajo.service';
import { EntregaService } from '../../ordenes-trabajo/entrega.service';
import { MaterialesOrdenService } from '../../ordenes-trabajo/materiales-orden.service';
import {
  EnlacesPublicosService,
  generarTokenPublico,
} from '../enlaces-publicos.service';

/** HTTP, resolución del enlace y consultas reales. Sólo la lectura del plan,
 * la firma del almacenamiento y la notificación externa son fixtures.
 * No se arranca el sistema completo ni se contactan proveedores. */
describe('Enlaces públicos: alcance de la credencial y revocación por HTTP', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const enlaces = new EnlacesPublicosService(prisma, capacidades);
  const empresa = new DatosEmpresaService(prisma);
  const avisos = { sincronizar: jest.fn(() => Promise.resolve()) };
  const archivos = {
    firmarDescargaDe: jest.fn((archivo: Archivo) =>
      Promise.resolve(`https://archivos.example.invalid/${archivo.id}`),
    ),
    urlDeLogoPublico: jest.fn((tenantId: string) =>
      Promise.resolve(`https://archivos.example.invalid/logo/${tenantId}`),
    ),
  };
  const ordenes = new OrdenesTrabajoService(
    prisma,
    {} as never,
    archivos as never,
    avisos as never,
    enlaces,
    empresa,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    capacidades,
  );
  const presupuestos = new PresupuestosService(
    prisma,
    ordenes,
    archivos as never,
    {} as never,
    avisos as never,
    enlaces,
    empresa,
    {} as never,
    {} as never,
    {} as never,
    capacidades,
  );
  const tenantIds = [randomUUID(), randomUUID()];
  const ordenIds: string[] = [];
  const presupuestoIds: string[] = [];
  const tokensOt: string[] = [];
  const tokensPresupuesto: string[] = [];
  const adjuntos: Archivo[][] = [];
  let app: INestApplication<Server>;
  let baseLocalValidada = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local exclusiva de test con aislamiento');
    baseLocalValidada = true;
    await prisma.$connect();
    for (const [i, tenantId] of tenantIds.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          nombre: `Imprenta pública QA ${i}`,
          slug: `qa-link-${tenantId}`,
        },
      });
      const cliente = await prisma.cliente.create({
        data: {
          tenantId,
          nombre: `Cliente público QA ${i}`,
          paisCodigo: 'AR',
          telefonoCodigo: '+1',
          telefonoNumero: `202555010${i}`,
        },
      });
      const orden = await prisma.ordenTrabajo.create({
        data: {
          tenantId,
          clienteId: cliente.id,
          numero: `OT-QA-${i}`,
          estado: 'pendiente',
          total: 100 + i,
          observaciones: `NOTA-INTERNA-OT-${i}`,
        },
      });
      ordenIds.push(orden.id);
      const cotizacion = await prisma.cotizacion.create({
        data: {
          tenantId,
          clienteId: cliente.id,
          numero: `PRES-QA-${i}`,
          estado: 'enviado',
          total: 200 + i,
          fechaValidez: new Date(Date.now() + 86_400_000),
          primeraVistaEl: new Date(),
          emisionJson: { items: [] },
        },
      });
      presupuestoIds.push(cotizacion.id);
      tokensOt.push(
        await enlaces.emitir(prisma, {
          tenantId,
          tipo: TipoEnlacePublico.SEGUIMIENTO_OT,
          entidadId: orden.id,
          token: generarTokenPublico(),
        }),
      );
      tokensPresupuesto.push(
        await enlaces.emitir(prisma, {
          tenantId,
          tipo: TipoEnlacePublico.PRESUPUESTO,
          entidadId: cotizacion.id,
          token: generarTokenPublico(),
        }),
      );
      const files: Archivo[] = [];
      for (const [publico, estado] of [
        [true, ArchivoEstado.LISTO],
        [false, ArchivoEstado.LISTO],
        [true, ArchivoEstado.PENDIENTE],
      ] as const)
        files.push(
          await prisma.archivo.create({
            data: {
              tenantId,
              ordenId: orden.id,
              scope: 'ORDEN',
              key: `qa/${randomUUID()}`,
              nombreOriginal: `Archivo-${i}-${files.length}.pdf`,
              mimeType: 'application/pdf',
              bytes: 10,
              publico,
              estado,
            },
          }),
        );
      adjuntos.push(files);
    }
    const modulo = await Test.createTestingModule({
      controllers: [PresupuestosController, OrdenesTrabajoController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: PresupuestosService, useValue: presupuestos },
        { provide: OrdenesTrabajoService, useValue: ordenes },
        { provide: ArchivosService, useValue: archivos },
        ...[
          PresupuestoPdfService,
          PresupuestoPilotoService,
          CorreoPresupuestoService,
          EntregaService,
          MaterialesOrdenService,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    }).compile();
    app = modulo.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(
        reflector,
        new JwtService({ secret: randomUUID() }),
        prisma,
      ),
      new RolesGuard(reflector),
      new PermisosGuard(reflector),
    );
    app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (baseLocalValidada)
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });
  const get = (ruta: string) => request(app.getHttpServer()).get(ruta);
  const ot = (i = 0) => `/ordenes-trabajo/track/${tokensOt[i]}`;
  const presupuesto = (i = 0) => `/presupuestos/track/${tokensPresupuesto[i]}`;

  it('la credencial no abre el listado privado ni cambia de empresa por una cabecera', async () => {
    await get('/ordenes-trabajo')
      .auth(tokensOt[0], { type: 'bearer' })
      .expect(401);
    await get('/presupuestos')
      .auth(tokensPresupuesto[0], { type: 'bearer' })
      .expect(401);
    for (const i of [0, 1]) {
      const r = await get(ot(i))
        .set('x-tenant-id', tenantIds[1 - i])
        .expect(200);
      expect(r.text).toContain(`Cliente público QA ${i}`);
      expect(r.text).not.toContain(`Cliente público QA ${1 - i}`);
      expect(r.text).not.toContain('NOTA-INTERNA');
      expect(r.text).not.toContain(adjuntos[i][0].key);
      const p = await get(presupuesto(i)).expect(200);
      expect(p.text).toContain(`Imprenta pública QA ${i}`);
      expect(p.text).not.toContain(`Imprenta pública QA ${1 - i}`);
      expect(p.text).not.toContain(tenantIds[i]);
    }
  });
  it('un token no abre una clase distinta de documento', async () => {
    await get(`/ordenes-trabajo/track/${tokensPresupuesto[0]}`).expect(404);
    await get(`/presupuestos/track/${tokensOt[0]}`).expect(404);
    await request(app.getHttpServer())
      .post(`/presupuestos/track/${tokensOt[0]}/decision`)
      .send({ decision: 'aprobado' })
      .expect(404);
  });
  it('sólo lista y permite descargar adjuntos públicos listos de esa orden', async () => {
    const r = await get(ot()).expect(200);
    expect(r.text).toContain(adjuntos[0][0].nombreOriginal);
    expect(r.text).not.toContain(adjuntos[0][1].nombreOriginal);
    expect(r.text).not.toContain(adjuntos[0][2].nombreOriginal);
    archivos.firmarDescargaDe.mockClear();
    for (const f of [adjuntos[0][1], adjuntos[0][2], adjuntos[1][0]])
      await get(`${ot()}/archivos/${f.id}`).expect(404);
    expect(archivos.firmarDescargaDe).not.toHaveBeenCalled();
    await get(`${ot()}/archivos/${adjuntos[0][0].id}`)
      .expect(302)
      .expect(
        'Location',
        `https://archivos.example.invalid/${adjuntos[0][0].id}`,
      );
    expect(archivos.firmarDescargaDe).toHaveBeenCalledTimes(1);
  });
  it('sólo firma el logo de la empresa que emitió el enlace', async () => {
    await get(`${ot()}/logo`)
      .set('x-tenant-id', tenantIds[1])
      .expect(302)
      .expect(
        'Location',
        `https://archivos.example.invalid/logo/${tenantIds[0]}`,
      );
    await get(`${presupuesto(1)}/logo`)
      .expect(302)
      .expect(
        'Location',
        `https://archivos.example.invalid/logo/${tenantIds[1]}`,
      );
  });
  it('no permite decidir otra entidad ni agregar campos internos', async () => {
    await request(app.getHttpServer())
      .post(`${presupuesto()}/decision`)
      .send({
        decision: 'aprobado',
        tenantId: tenantIds[1],
        id: presupuestoIds[1],
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${presupuesto()}/decision`)
      .send({ decision: 'facturado' })
      .expect(400);
    expect(
      await prisma.cotizacion.count({
        where: {
          id: { in: presupuestoIds },
          estado: 'enviado',
        },
      }),
    ).toBe(2);
  });
  it('una doble aprobación sólo registra una decisión e historial', async () => {
    const respuestas = await Promise.all(
      [0, 1].map(() =>
        request(app.getHttpServer())
          .post(`${presupuesto()}/decision`)
          .send({ decision: 'aprobado' }),
      ),
    );
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(
      await prisma.cotizacionEvento.count({
        where: {
          cotizacionId: presupuestoIds[0],
          tipo: 'aprobado',
        },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.cotizacion.findUniqueOrThrow({
          where: { id: presupuestoIds[1] },
        })
      ).estado,
    ).toBe('enviado');
  });
  it.each(['revocado', 'vencido'] as const)(
    '%s bloquea vista, logo, QR, descarga y decisión',
    async (tipo) => {
      const data =
        tipo === 'revocado'
          ? { revocadoEl: new Date() }
          : { expiraEl: new Date(Date.now() - 60_000) };
      await prisma.enlacePublico.updateMany({
        where: { token: { in: [tokensOt[1], tokensPresupuesto[1]] } },
        data,
      });
      try {
        for (const ruta of [
          ot(1),
          `${ot(1)}/logo`,
          `${ot(1)}/qr-retiro.png`,
          `${ot(1)}/archivos/${adjuntos[1][0].id}`,
          presupuesto(1),
          `${presupuesto(1)}/logo`,
        ])
          await get(ruta).expect(404);
        await request(app.getHttpServer())
          .post(`${presupuesto(1)}/decision`)
          .send({ decision: 'aprobado' })
          .expect(404);
        expect(
          (
            await prisma.cotizacion.findUniqueOrThrow({
              where: { id: presupuestoIds[1] },
            })
          ).estado,
        ).toBe('enviado');
      } finally {
        await prisma.enlacePublico.updateMany({
          where: { token: { in: [tokensOt[1], tokensPresupuesto[1]] } },
          data: { revocadoEl: null, expiraEl: null },
        });
      }
    },
  );
  it('reemisión invalida la credencial anterior y conserva la nueva', async () => {
    const anterior = tokensOt[1];
    tokensOt[1] = await enlaces.emitir(prisma, {
      tenantId: tenantIds[1],
      entidadId: ordenIds[1],
      tipo: TipoEnlacePublico.SEGUIMIENTO_OT,
      token: generarTokenPublico(),
    });
    await get(`/ordenes-trabajo/track/${anterior}`).expect(404);
    await get(ot(1)).expect(200);
  });
});
