import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import {
  BadRequestException,
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContextInterceptor } from '../../../common/interceptors/tenant-context.interceptor';
import { AuthGuard } from '../../../auth/auth.guard';
import { RolesGuard } from '../../../auth/roles.guard';
import { PermisosGuard } from '../../../auth/permisos.guard';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import { CentroCopiadoAuditoriaService } from '../../centro-copiado-auditoria.service';
import { CentroCopiadoTarifariosService } from '../centro-copiado-tarifarios.service';
import { CentroCopiadoTarifariosController } from '../centro-copiado-tarifarios.controller';
import { contenidoEjemplo } from './fixtures';
import { validarContenidoTarifario } from '../contenido-tarifario';
import { calcularComercialHojas } from '../../comercial/calculo-hojas';
import { documento } from '../../comercial/__tests__/fixtures';
import { CentroCopiadoSimulacionController } from '../centro-copiado-simulacion.controller';
import { CentroCopiadoSimulacionService } from '../centro-copiado-simulacion.service';

/** PostgreSQL, transacciones y guardas HTTP reales. Sólo la suscripción está sustituida. */
describe('Tarifarios: persistencia, vigencia y aislamiento', () => {
  const prisma = new PrismaService();
  const auditoria = new CentroCopiadoAuditoriaService(prisma);
  const servicio = new CentroCopiadoTarifariosService(prisma, auditoria);
  const costeador = {
    simularCostoHojas: jest.fn(() =>
      Promise.reject(new BadRequestException('Motor ficticio sin configurar.')),
    ),
  };
  const simulacion = new CentroCopiadoSimulacionService(
    prisma,
    servicio,
    costeador as never,
    {} as never,
  );
  const jwtSecretAnterior = process.env.JWT_SECRET;
  const jwtSecret = randomUUID();
  const jwt = new JwtService({ secret: jwtSecret });
  const tenants = [randomUUID(), randomUUID()];
  const papeles = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const tokens: Record<string, string> = {};
  const capacidades = { exigirIncluida: jest.fn(() => Promise.resolve()) };
  let app: INestApplication<Server>;
  let baseValidada = false;
  const contenido = () => contenidoEjemplo(papeles[0]);
  const crear = () =>
    servicio.crear(tenants[0], users[0], {
      nombre: 'Tarifario ficticio',
      contenido: contenido(),
    });
  const inmediata = (revision: number) => ({
    revision,
    tipoVigencia: 'INMEDIATA' as const,
  });
  const publicar = (id: string, revision: number) =>
    servicio.publicar(tenants[0], id, users[0], inmediata(revision));

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    ) {
      throw new Error('Se requiere base local de test y aislamiento activo.');
    }
    baseValidada = true;
    process.env.JWT_SECRET = jwtSecret;
    await prisma.$connect();
    for (const [i, id] of tenants.entries()) {
      await prisma.tenant.create({
        data: { id, slug: `qa-tarifarios-${id}`, nombre: 'Empresa ficticia' },
      });
      await prisma.materiaPrima.create({
        data: {
          id: papeles[i],
          tenantId: id,
          codigo: 'PAPEL-FICTICIO',
          nombre: 'Papel ficticio',
          familia: 'SUSTRATO',
          subfamilia: 'SUSTRATO_HOJA',
          tipoTecnico: 'PAPEL',
          templateId: 'papel-ficticio',
          unidadStock: 'HOJA',
          unidadCompra: 'RESMA',
          atributosTecnicosJson: {},
        },
      });
    }
    for (const [actor, rolBase, permisos] of [
      ['gestor', 'OPERADOR', ['configuracion.copiado.gestionar']],
      ['lector', 'OPERADOR', ['configuracion.copiado.ver']],
      [
        'con-margenes',
        'OPERADOR',
        ['configuracion.copiado.ver', 'finanzas.ver_margenes'],
      ],
      ['solo-margenes', 'OPERADOR', ['finanzas.ver_margenes']],
      [
        'administrador-limitado',
        'ADMINISTRADOR',
        ['configuracion.copiado.ver'],
      ],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `qa-tarifarios-${randomUUID()}@example.invalid` },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: { tenantId: tenants[0], nombre: actor, permisos: [...permisos] },
      });
      const membership = await prisma.membership.create({
        data: {
          tenantId: tenants[0],
          userId: user.id,
          rol: rolBase,
          rolId: rol.id,
        },
      });
      const session = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: tenants[0],
          currentMembershipId: membership.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      tokens[actor] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: session.id,
        tenantId: tenants[0],
        membershipId: membership.id,
        role: rolBase,
      });
    }
    const modulo = await Test.createTestingModule({
      controllers: [
        CentroCopiadoTarifariosController,
        CentroCopiadoSimulacionController,
      ],
      providers: [
        { provide: CentroCopiadoTarifariosService, useValue: servicio },
        { provide: CentroCopiadoSimulacionService, useValue: simulacion },
        { provide: CapacidadesEmpresaService, useValue: capacidades },
      ],
    }).compile();
    app = modulo.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, prisma),
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

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (jwtSecretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtSecretAnterior;
    await app?.close();
    try {
      if (baseValidada) {
        await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('consultar no crea tarifarios, configuraciones ni eventos', async () => {
    await request(app.getHttpServer())
      .get('/centro-copiado/tarifarios')
      .auth(tokens.lector, { type: 'bearer' })
      .expect(200, { items: [], siguiente: null });
    expect(
      await prisma.centroCopiadoConfig.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(0);
    expect(
      await prisma.centroCopiadoEvento.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(0);
  });

  it('guarda una copia, publica y mantiene esa versión al editar el borrador', async () => {
    const borrador = await crear();
    expect(borrador).toMatchObject({
      revision: 1,
      ultimoNumero: 0,
      contenido: contenido(),
    });
    expect(await servicio.vigente(tenants[0], borrador.id)).toBeNull();
    const version = await publicar(borrador.id, 1);
    expect(version).toMatchObject({
      numero: 1,
      revisionBorrador: 1,
      publicadoPorId: users[0],
      contenido: contenido(),
    });
    const nuevosPrecios = contenido();
    nuevosPrecios.hojas!.filas[0].precios[0].precioUnitario = '999';
    const editado = await servicio.editar(tenants[0], borrador.id, users[0], {
      revision: 2,
      nombre: 'Nuevo nombre',
      contenido: nuevosPrecios,
    });
    expect(editado).toMatchObject({
      revision: 3,
      ultimoNumero: 1,
      contenido: nuevosPrecios,
    });
    expect(await servicio.version(tenants[0], borrador.id, version.id)).toEqual(
      version,
    );
    expect(await servicio.vigente(tenants[0], borrador.id)).toEqual(version);
    const eventos = await prisma.centroCopiadoEvento.findMany({
      where: {
        tenantId: tenants[0],
        datosJson: { path: ['tarifarioId'], equals: borrador.id },
      },
    });
    expect(eventos.map((e) => e.tipo).sort()).toEqual([
      'TARIFARIO_CREADO',
      'TARIFARIO_EDITADO',
      'TARIFARIO_PUBLICADO',
    ]);
  });

  it('una pestaña vieja no sobrescribe ni publica cambios que no revisó', async () => {
    const b = await crear();
    await servicio.editar(tenants[0], b.id, users[0], {
      revision: 1,
      nombre: 'Actualizado',
      contenido: contenido(),
    });
    await expect(
      servicio.editar(tenants[0], b.id, users[0], {
        revision: 1,
        nombre: 'Viejo',
        contenido: contenido(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(publicar(b.id, 1)).rejects.toBeInstanceOf(ConflictException);
    expect((await servicio.obtener(tenants[0], b.id)).nombre).toBe(
      'Actualizado',
    );
  });

  it('el cálculo de hojas consume los precios de la versión guardada y mantiene su identidad', async () => {
    const b = await crear();
    const v = await publicar(b.id, 1);
    const guardada = await servicio.version(tenants[0], b.id, v.id);
    const c = validarContenidoTarifario(guardada.contenido);
    const resultado = calcularComercialHojas(
      {
        tenantId: tenants[0],
        pedidoId: 'pedido-ficticio',
        cargas: [
          {
            id: 'carga-ficticia',
            documentos: [
              documento('archivo-ficticio', {
                papelMateriaPrimaId: papeles[0],
                paginas: 5,
                faz: 2,
                copias: 2,
              }),
            ],
          },
        ],
      },
      {
        tenantId: guardada.tenantId,
        tarifarioId: guardada.tarifarioId,
        versionId: guardada.id,
        ...c.hojas!,
      },
    );
    expect(resultado).toMatchObject({
      tenantId: tenants[0],
      tarifarioId: b.id,
      versionId: v.id,
      hojasFisicas: 6,
      carillasImpresas: 10,
      importeImpresionMatriz: '603',
    });
  });

  it('dos ediciones simultáneas sólo aceptan una revisión', async () => {
    const b = await crear();
    const intentos = await Promise.allSettled(
      ['Primera', 'Segunda'].map((nombre) =>
        servicio.editar(tenants[0], b.id, users[0], {
          revision: 1,
          nombre,
          contenido: contenido(),
        }),
      ),
    );
    expect(intentos.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazo = intentos.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rechazo.reason).toBeInstanceOf(ConflictException);
    expect((await servicio.obtener(tenants[0], b.id)).revision).toBe(2);
  });

  it('repetir o enviar simultáneamente una publicación produce una sola versión y un evento', async () => {
    const b = await crear();
    const versiones = await Promise.all(
      Array.from({ length: 4 }, () => publicar(b.id, 1)),
    );
    expect(new Set(versiones.map((v) => v.id)).size).toBe(1);
    expect(await publicar(b.id, 1)).toEqual(versiones[0]);
    expect((await servicio.obtener(tenants[0], b.id)).revision).toBe(2);
    expect((await servicio.versiones(tenants[0], b.id)).items).toHaveLength(1);
    expect(
      await prisma.centroCopiadoEvento.count({
        where: {
          tenantId: tenants[0],
          tipo: 'TARIFARIO_PUBLICADO',
          datosJson: { path: ['tarifarioId'], equals: b.id },
        },
      }),
    ).toBe(1);
  });

  it('una carrera entre editar y publicar no mezcla nombre, reglas y precios', async () => {
    const b = await crear();
    const resultados = await Promise.allSettled([
      publicar(b.id, 1),
      servicio.editar(tenants[0], b.id, users[0], {
        revision: 1,
        nombre: 'Otro nombre',
        contenido: { ...contenido(), monedaCodigo: 'USD' },
      }),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const version = await servicio.vigente(tenants[0], b.id);
    if (version)
      expect(version).toMatchObject({
        nombre: b.nombre,
        contenido: b.contenido,
      });
    else
      expect((await servicio.obtener(tenants[0], b.id)).nombre).toBe(
        'Otro nombre',
      );
  });

  it('resuelve la vigencia por fecha y conserva publicaciones programadas al publicar otra inmediata', async () => {
    const b = await crear();
    const v1 = await publicar(b.id, 1);
    const fecha = new Date(Date.now() + 86400000);
    const dto = {
      revision: 2,
      tipoVigencia: 'PROGRAMADA' as const,
      vigenteDesde: fecha.toISOString(),
    };
    const v2 = await servicio.publicar(tenants[0], b.id, users[0], dto);
    expect(await servicio.vigente(tenants[0], b.id)).toEqual(v1);
    expect(
      await servicio.vigente(tenants[0], b.id, new Date(fecha.getTime() - 1)),
    ).toEqual(v1);
    expect(await servicio.vigente(tenants[0], b.id, fecha)).toEqual(v2);
    const v3 = await publicar(b.id, 3);
    expect(await servicio.vigente(tenants[0], b.id)).toEqual(v3);
    expect(await servicio.vigente(tenants[0], b.id, fecha)).toEqual(v2);
    expect(await servicio.publicar(tenants[0], b.id, users[0], dto)).toEqual(
      v2,
    );
    await expect(
      servicio.publicar(tenants[0], b.id, users[0], {
        ...dto,
        vigenteDesde: new Date(fecha.getTime() + 1000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('normaliza el huso horario y revierte la transacción si se repite la fecha de vigencia', async () => {
    const b = await crear();
    const fecha = new Date(Date.now() + 86400000).toISOString();
    const local = new Date(new Date(fecha).getTime() - 10800000)
      .toISOString()
      .replace('Z', '-03:00');
    const v = await servicio.publicar(tenants[0], b.id, users[0], {
      revision: 1,
      tipoVigencia: 'PROGRAMADA',
      vigenteDesde: local,
    });
    expect(v.vigenteDesde.toISOString()).toBe(fecha);
    await expect(
      servicio.publicar(tenants[0], b.id, users[0], {
        revision: 2,
        tipoVigencia: 'PROGRAMADA',
        vigenteDesde: fecha,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await servicio.obtener(tenants[0], b.id)).toMatchObject({
      revision: 2,
      ultimoNumero: 1,
    });
  });

  it.each([
    undefined,
    '2027-01-01T10:00:00',
    '2027-02-30T10:00:00Z',
    '2000-01-01T00:00:00Z',
    '2099-01-01T00:00:00.0001Z',
  ])('rechaza programación inválida %s', async (vigenteDesde) => {
    const b = await crear();
    await expect(
      servicio.publicar(tenants[0], b.id, users[0], {
        revision: 1,
        tipoVigencia: 'PROGRAMADA',
        vigenteDesde,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await servicio.versiones(tenants[0], b.id)).items).toHaveLength(0);
  });

  it('rechaza fecha enviada para publicación inmediata', async () => {
    const b = await crear();
    await expect(
      servicio.publicar(tenants[0], b.id, users[0], {
        ...inmediata(1),
        vigenteDesde: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PostgreSQL rechaza editar y borrar una versión incluso fuera del servicio', async () => {
    const b = await crear();
    const v = await publicar(b.id, 1);
    await expect(
      prisma.centroCopiadoTarifarioVersion.updateMany({
        where: { id: v.id, tenantId: tenants[0] },
        data: { nombre: 'Reescrito' },
      }),
    ).rejects.toThrow('inmutables');
    await expect(
      prisma.centroCopiadoTarifarioVersion.deleteMany({
        where: { id: v.id, tenantId: tenants[0] },
      }),
    ).rejects.toThrow('inmutables');
    await expect(
      prisma.centroCopiadoTarifario.deleteMany({
        where: { id: b.id, tenantId: tenants[0] },
      }),
    ).rejects.toThrow('inmutables');
    expect(await servicio.version(tenants[0], b.id, v.id)).toEqual(v);
  });

  it('la clave foránea impide enlazar una versión al tarifario de otra empresa', async () => {
    const b = await crear();
    await expect(
      prisma.centroCopiadoTarifarioVersion.create({
        data: {
          tenantId: tenants[1],
          tarifarioId: b.id,
          numero: 1,
          revisionBorrador: 1,
          nombre: 'Versión inválida',
          contenido: contenido(),
          tipoVigencia: 'INMEDIATA',
          vigenteDesde: new Date(),
          publicadoPorId: users[0],
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('un fallo de auditoría revierte la publicación, el contador y la revisión', async () => {
    const b = await crear();
    jest
      .spyOn(auditoria, 'registrar')
      .mockRejectedValueOnce(new Error('Fallo de prueba'));
    await expect(publicar(b.id, 1)).rejects.toThrow('Fallo de prueba');
    expect(await servicio.obtener(tenants[0], b.id)).toMatchObject({
      revision: 1,
      ultimoNumero: 0,
    });
    expect((await servicio.versiones(tenants[0], b.id)).items).toHaveLength(0);
  });

  it('exige sesión y respeta la capacidad contratada antes de leer o guardar', async () => {
    await request(app.getHttpServer())
      .get('/centro-copiado/tarifarios')
      .expect(401);
    await request(app.getHttpServer())
      .post('/centro-copiado/tarifarios')
      .send({ nombre: 'Nuevo', contenido: contenido() })
      .expect(401);
    jest
      .spyOn(capacidades, 'exigirIncluida')
      .mockRejectedValueOnce(new BadRequestException('Capacidad no incluida'));
    await request(app.getHttpServer())
      .get('/centro-copiado/tarifarios')
      .auth(tokens.gestor, { type: 'bearer' })
      .expect(400);
  });

  it.each(['lector', 'administrador-limitado'])(
    '%s puede consultar pero no crear, editar ni publicar',
    async (actor) => {
      const b = await crear();
      await request(app.getHttpServer())
        .get(`/centro-copiado/tarifarios/${b.id}`)
        .auth(tokens[actor], { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/centro-copiado/tarifarios')
        .auth(tokens[actor], { type: 'bearer' })
        .send({ nombre: 'No permitido', contenido: contenido() })
        .expect(403);
      await request(app.getHttpServer())
        .put(`/centro-copiado/tarifarios/${b.id}`)
        .auth(tokens[actor], { type: 'bearer' })
        .send({ revision: 1, nombre: 'No permitido', contenido: contenido() })
        .expect(403);
      await request(app.getHttpServer())
        .post(`/centro-copiado/tarifarios/${b.id}/publicar`)
        .auth(tokens[actor], { type: 'bearer' })
        .send(inmediata(1))
        .expect(403);
      expect((await servicio.obtener(tenants[0], b.id)).revision).toBe(1);
    },
  );

  it('no permite consultar, editar ni publicar identificadores ajenos por HTTP', async () => {
    const b = await servicio.crear(tenants[1], users[0], {
      nombre: 'Ajeno',
      contenido: contenidoEjemplo(papeles[1]),
    });
    const v = await servicio.publicar(tenants[1], b.id, users[0], inmediata(1));
    for (const ruta of ['', '/versiones', '/vigente', `/versiones/${v.id}`]) {
      await request(app.getHttpServer())
        .get(`/centro-copiado/tarifarios/${b.id}${ruta}`)
        .auth(tokens.gestor, { type: 'bearer' })
        .expect(404);
    }
    await request(app.getHttpServer())
      .put(`/centro-copiado/tarifarios/${b.id}`)
      .auth(tokens.gestor, { type: 'bearer' })
      .send({ revision: 2, nombre: 'No permitido', contenido: contenido() })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/centro-copiado/tarifarios/${b.id}/publicar`)
      .auth(tokens.gestor, { type: 'bearer' })
      .send(inmediata(1))
      .expect(404);
  });

  it('rechaza papeles ajenos, inexistentes e IDs internos enviados en el cuerpo', async () => {
    for (const papelId of [papeles[1], randomUUID()]) {
      await request(app.getHttpServer())
        .post('/centro-copiado/tarifarios')
        .auth(tokens.gestor, { type: 'bearer' })
        .send({ nombre: 'Inválido', contenido: contenidoEjemplo(papelId) })
        .expect(400);
    }
    for (const extras of [
      { tenantId: tenants[1] },
      { publicadoPorId: users[1] },
      { revision: 99 },
    ]) {
      await request(app.getHttpServer())
        .post('/centro-copiado/tarifarios')
        .auth(tokens.gestor, { type: 'bearer' })
        .send({ nombre: 'Inválido', contenido: contenido(), ...extras })
        .expect(400);
    }
  });

  it('el gestor crea y publica con su identidad de sesión e ignora encabezados ajenos', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/centro-copiado/tarifarios')
      .auth(tokens.gestor, { type: 'bearer' })
      .set('x-tenant-id', tenants[1])
      .send({ nombre: '  Mostrador ficticio  ', contenido: contenido() })
      .expect(201);
    const b = respuesta.body as {
      id: string;
      tenantId: string;
      nombre: string;
      revision: number;
    };
    expect(b).toMatchObject({
      tenantId: tenants[0],
      nombre: 'Mostrador ficticio',
      revision: 1,
    });
    await request(app.getHttpServer())
      .put(`/centro-copiado/tarifarios/${b.id}`)
      .auth(tokens.gestor, { type: 'bearer' })
      .send({ revision: 1, nombre: 'Editado por HTTP', contenido: contenido() })
      .expect(200);
    const pub = await request(app.getHttpServer())
      .post(`/centro-copiado/tarifarios/${b.id}/publicar`)
      .auth(tokens.gestor, { type: 'bearer' })
      .send(inmediata(2))
      .expect(201);
    expect(pub.body).toMatchObject({
      tenantId: tenants[0],
      publicadoPorId: users[0],
      revisionBorrador: 2,
    });
    expect(
      await prisma.centroCopiadoConfig.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(0);
  });

  it('paginas e identificadores inválidos no llegan a consultas sin límite', async () => {
    for (const ruta of [
      '/centro-copiado/tarifarios?desplazamiento=-1',
      '/centro-copiado/tarifarios?desplazamiento=0.5',
      '/centro-copiado/tarifarios/no-es-uuid',
    ]) {
      await request(app.getHttpServer())
        .get(ruta)
        .auth(tokens.lector, { type: 'bearer' })
        .expect(400);
    }
  });

  it('la simulación exige configuración y márgenes a la vez, incluso al administrador limitado', async () => {
    const b = await crear();
    costeador.simularCostoHojas.mockClear();
    for (const actor of [
      'lector',
      'gestor',
      'solo-margenes',
      'administrador-limitado',
    ]) {
      await request(app.getHttpServer())
        .post(`/centro-copiado/tarifarios/${b.id}/simulaciones`)
        .auth(tokens[actor], { type: 'bearer' })
        .send({
          revision: b.revision,
          celdas: [{ seccion: 'hojas', fila: 0, tramo: 0 }],
        })
        .expect(403);
    }
    expect(costeador.simularCostoHojas).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post(`/centro-copiado/tarifarios/${b.id}/simulaciones`)
      .auth(tokens['con-margenes'], { type: 'bearer' })
      .send({
        revision: b.revision,
        celdas: [{ seccion: 'hojas', fila: 0, tramo: 0 }],
      })
      .expect(201);
    expect(costeador.simularCostoHojas).toHaveBeenCalledTimes(3);
    expect(costeador.simularCostoHojas).toHaveBeenCalledWith(
      tenants[0],
      expect.any(Object),
    );
  });

  it('no simula tarifarios ni versiones de otra empresa aun falsificando el encabezado', async () => {
    const ajeno = await servicio.crear(tenants[1], users[0], {
      nombre: 'Otra empresa ficticia',
      contenido: contenidoEjemplo(papeles[1]),
    });
    const versionAjena = await servicio.publicar(
      tenants[1],
      ajeno.id,
      users[0],
      inmediata(ajeno.revision),
    );
    const propio = await crear();
    costeador.simularCostoHojas.mockClear();
    for (const [id, fuente] of [
      [ajeno.id, { revision: ajeno.revision }],
      [propio.id, { versionId: versionAjena.id }],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/centro-copiado/tarifarios/${id}/simulaciones`)
        .auth(tokens['con-margenes'], { type: 'bearer' })
        .set('x-tenant-id', tenants[1])
        .send({ ...fuente, celdas: [{ seccion: 'hojas', fila: 0, tramo: 0 }] })
        .expect(404);
    }
    expect(costeador.simularCostoHojas).not.toHaveBeenCalled();
  });
});
