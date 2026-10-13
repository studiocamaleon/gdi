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
import { CentroCopiadoPoliticaService } from '../centro-copiado-politica.service';
import { CentroCopiadoPoliticaController } from '../centro-copiado-politica.controller';
import { CentroCopiadoTarifariosService } from '../centro-copiado-tarifarios.service';
import {
  politicaPreciosInicial,
  type PoliticaPrecios,
} from '../politica-precios';
import { contenidoEjemplo } from './fixtures';
import { calcularComercialHojas } from '../../comercial/calculo-hojas';
import { documento } from '../../comercial/__tests__/fixtures';

describe('Políticas de copiado: borrador y resolución por canal', () => {
  const prisma = new PrismaService();
  const auditoria = new CentroCopiadoAuditoriaService(prisma);
  const politica = new CentroCopiadoPoliticaService(prisma, auditoria);
  const tarifas = new CentroCopiadoTarifariosService(prisma, auditoria);
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const tokens: Record<string, string> = {};
  const roles: Record<string, string> = {};
  const secretAnterior = process.env.JWT_SECRET;
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const capacidades = { exigirIncluida: jest.fn(() => Promise.resolve()) };
  const ruta = '/centro-copiado/politica-precios/borrador';
  let app: INestApplication<Server>;
  let baseValidada = false;
  const guardar = (contenido: PoliticaPrecios, revision = 0) =>
    politica.guardarBorrador(tenants[0], users[0], { revision, contenido });
  const usarTarifario = (id: string): PoliticaPrecios => ({
    ...politicaPreciosInicial(),
    general: { modalidad: 'TARIFARIO' as const, tarifarioId: id },
  });
  async function crearTarifario(
    tenantId = tenants[0],
    publicado = true,
    monedaCodigo = 'ARS',
  ) {
    const contenido = contenidoEjemplo();
    contenido.hojas!.filas = [];
    contenido.cad = null;
    contenido.monedaCodigo = monedaCodigo;
    const b = await tarifas.crear(tenantId, users[0], {
      nombre: 'Tarifario ficticio',
      contenido,
    });
    const version = publicado
      ? await tarifas.publicar(tenantId, b.id, users[0], {
          revision: 1,
          tipoVigencia: 'INMEDIATA',
        })
      : null;
    return { ...b, version };
  }

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Se requiere base local de test y aislamiento activo.');
    baseValidada = true;
    process.env.JWT_SECRET = secret;
    await prisma.$connect();
    for (const id of tenants)
      await prisma.tenant.create({
        data: { id, slug: `qa-politica-${id}`, nombre: 'Empresa ficticia' },
      });
    for (const [actor, rolBase, permisos] of [
      ['gestor', 'OPERADOR', ['configuracion.copiado.gestionar']],
      ['lector', 'OPERADOR', ['configuracion.copiado.ver']],
      [
        'administrador-limitado',
        'ADMINISTRADOR',
        ['configuracion.copiado.ver'],
      ],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `qa-politica-${randomUUID()}@example.invalid` },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: { tenantId: tenants[0], nombre: actor, permisos: [...permisos] },
      });
      roles[actor] = rol.id;
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
      controllers: [CentroCopiadoPoliticaController],
      providers: [
        { provide: CentroCopiadoPoliticaService, useValue: politica },
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

  beforeEach(async () => {
    await prisma.centroCopiadoPoliticaBorrador.deleteMany({
      where: { tenantId: { in: tenants } },
    });
    await prisma.datosEmpresa.deleteMany({
      where: { tenantId: { in: tenants } },
    });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (secretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretAnterior;
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

  it('consultar y previsualizar conserva el estado inicial sin escribir configuración', async () => {
    const eventosAntes = await prisma.centroCopiadoEvento.count({
      where: { tenantId: tenants[0] },
    });
    const inicial = await politica.obtenerBorrador(tenants[0]);
    expect(inicial).toMatchObject({
      revision: 0,
      estado: 'BORRADOR',
      operativa: false,
      contenido: politicaPreciosInicial(),
    });
    const vista = await politica.previsualizar(tenants[0]);
    expect(vista.canales).toHaveLength(5);
    expect(
      vista.canales.every(
        (c) => c.estado === 'MOTOR' && c.origen === 'GENERAL',
      ),
    ).toBe(true);
    expect(
      await prisma.centroCopiadoPoliticaBorrador.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(0);
    expect(
      await prisma.centroCopiadoConfig.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(0);
    expect(
      await prisma.centroCopiadoEvento.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(eventosAntes);
  });

  it('resuelve tarifa general, excepción propia y motor explícito con versiones publicadas', async () => {
    const general = await crearTarifario();
    const online = await crearTarifario();
    const c = usarTarifario(general.id);
    c.canales.web = { modalidad: 'TARIFARIO', tarifarioId: online.id };
    c.canales.email = { modalidad: 'MOTOR' };
    await guardar(c);
    const vista = await politica.previsualizar(tenants[0]);
    expect(vista.borrador.operativa).toBe(false);
    expect(
      vista.canales.find((v) => v.canalVenta === 'mostrador'),
    ).toMatchObject({
      estado: 'TARIFARIO',
      origen: 'GENERAL',
      referencia: {
        politicaRevision: 1,
        tarifarioId: general.id,
        versionId: general.version!.id,
      },
    });
    const web = vista.canales.find((v) => v.canalVenta === 'web');
    expect(web).toMatchObject({
      estado: 'TARIFARIO',
      origen: 'CANAL',
      referencia: { tarifarioId: online.id, versionId: online.version!.id },
    });
    expect(web).not.toHaveProperty('version.contenido');
    expect(vista.canales.find((v) => v.canalVenta === 'email')).toMatchObject({
      estado: 'MOTOR',
      origen: 'CANAL',
    });
    const resuelta = await politica.resolverBorrador(tenants[0], 'web');
    expect(resuelta).toMatchObject({
      version: { contenido: online.contenido },
      referencia: { canalVenta: 'web' },
    });
  });

  it('compartir tarifario no lo duplica y volver a heredar recupera la política general', async () => {
    const t = await crearTarifario();
    const c = usarTarifario(t.id);
    c.canales.web = { modalidad: 'TARIFARIO', tarifarioId: t.id };
    await guardar(c);
    const revision = (await politica.obtenerBorrador(tenants[0])).revision;
    c.general = { modalidad: 'MOTOR' };
    c.canales.web = { modalidad: 'HEREDAR' };
    await guardar(c, revision);
    expect(await politica.resolverBorrador(tenants[0], 'web')).toMatchObject({
      estado: 'MOTOR',
      origen: 'GENERAL',
      referencia: { politicaRevision: 2 },
    });
    expect(
      await prisma.centroCopiadoTarifarioVersion.count({
        where: { tenantId: tenants[0], tarifarioId: t.id },
      }),
    ).toBe(1);
  });

  it('la selección de canal permite recalcular las 100 hojas del pedido con su matriz completa', async () => {
    const papel = await prisma.materiaPrima.create({
      data: {
        tenantId: tenants[0],
        codigo: `PAPEL-${randomUUID()}`,
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
    const ids: string[] = [];
    for (const precio of ['100', '80']) {
      const contenido = contenidoEjemplo(papel.id);
      contenido.cad = null;
      contenido.hojas!.filas[0].precios = [
        { desdeCantidad: 1, precioUnitario: precio },
        { desdeCantidad: 100, precioUnitario: precio },
      ];
      const t = await tarifas.crear(tenants[0], users[0], {
        nombre: 'Tarifario ficticio',
        contenido,
      });
      await tarifas.publicar(tenants[0], t.id, users[0], {
        revision: 1,
        tipoVigencia: 'INMEDIATA',
      });
      ids.push(t.id);
    }
    const c = usarTarifario(ids[0]);
    c.canales.web = { modalidad: 'TARIFARIO', tarifarioId: ids[1] };
    await guardar(c);
    const pedido = {
      tenantId: tenants[0],
      pedidoId: 'pedido-ficticio',
      cargas: ['A', 'B'].map((id) => ({
        id,
        documentos: [
          documento(id, {
            papelMateriaPrimaId: papel.id,
            paginas: 100,
            faz: 2,
          }),
        ],
      })),
    };
    for (const [canal, importe] of [
      ['mostrador', '10000'],
      ['web', '8000'],
    ]) {
      const r = await politica.resolverBorrador(tenants[0], canal);
      if (r.estado !== 'TARIFARIO' || !r.version.contenido.hojas)
        throw new Error('Se esperaba matriz de hojas');
      const calculo = calcularComercialHojas(pedido, {
        ...r.referencia,
        ...r.version.contenido.hojas,
      });
      expect(calculo).toMatchObject({
        hojasFisicas: 100,
        importeImpresionMatriz: importe,
        tarifarioId: r.referencia.tarifarioId,
        versionId: r.version.id,
      });
      expect(calculo.grupos).toHaveLength(1);
    }
  });

  it('permite preparar un tarifario sin publicación pero no lo sustituye por el motor', async () => {
    const t = await crearTarifario(tenants[0], false);
    await guardar(usarTarifario(t.id));
    expect(await politica.resolverBorrador(tenants[0], 'web')).toMatchObject({
      estado: 'PENDIENTE',
      motivo: 'SIN_VERSION_VIGENTE',
      referencia: null,
    });
    const fecha = new Date(Date.now() + 86400000);
    const programada = await tarifas.publicar(tenants[0], t.id, users[0], {
      revision: 1,
      tipoVigencia: 'PROGRAMADA',
      vigenteDesde: fecha.toISOString(),
    });
    expect(
      await politica.resolverBorrador(
        tenants[0],
        'web',
        new Date(fecha.getTime() - 1),
      ),
    ).toMatchObject({ estado: 'PENDIENTE' });
    expect(
      await politica.resolverBorrador(tenants[0], 'web', fecha),
    ).toMatchObject({
      estado: 'TARIFARIO',
      referencia: { versionId: programada.id },
    });
  });

  it('editar precios sin publicar no cambia la selección; publicar otra versión exige revisión', async () => {
    const t = await crearTarifario();
    await guardar(usarTarifario(t.id));
    const preparada = await politica.resolverBorrador(tenants[0], 'web');
    if (preparada.estado !== 'TARIFARIO')
      throw new Error('Se esperaba tarifario');
    const contenido = contenidoEjemplo();
    contenido.hojas!.filas = [];
    contenido.cad = null;
    await tarifas.editar(tenants[0], t.id, users[0], {
      revision: 2,
      nombre: 'Nuevos precios',
      contenido,
    });
    expect(
      await politica.comprobarReferenciaBorrador(
        tenants[0],
        'web',
        preparada.referencia,
      ),
    ).toMatchObject({ referencia: preparada.referencia });
    await tarifas.publicar(tenants[0], t.id, users[0], {
      revision: 3,
      tipoVigencia: 'INMEDIATA',
    });
    await expect(
      politica.comprobarReferenciaBorrador(
        tenants[0],
        'web',
        preparada.referencia,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cambiar canal o revisión de política exige revisar aunque ambos usen el motor', async () => {
    const preparada = await politica.resolverBorrador(tenants[0], 'web');
    if (preparada.estado !== 'MOTOR') throw new Error('Se esperaba motor');
    await expect(
      politica.comprobarReferenciaBorrador(
        tenants[0],
        'mostrador',
        preparada.referencia,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      politica.comprobarReferenciaBorrador(
        tenants[1],
        'web',
        preparada.referencia,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await guardar(politicaPreciosInicial());
    await expect(
      politica.comprobarReferenciaBorrador(
        tenants[0],
        'web',
        preparada.referencia,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza el cálculo sin canal incluso cuando la política preparada usa motor', async () => {
    await expect(
      politica.resolverBorrador(tenants[0], null),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marca moneda incompatible y no convierte ni usa el motor como reemplazo', async () => {
    const t = await crearTarifario(tenants[0], true, 'USD');
    await guardar(usarTarifario(t.id));
    expect(await politica.resolverBorrador(tenants[0], 'web')).toMatchObject({
      estado: 'PENDIENTE',
      motivo: 'MONEDA_INCOMPATIBLE',
    });
    await prisma.datosEmpresa.create({
      data: { tenantId: tenants[0], monedaCodigo: 'USD' },
    });
    const preparada = await politica.resolverBorrador(tenants[0], 'web');
    expect(preparada).toMatchObject({
      estado: 'TARIFARIO',
      referencia: { monedaCodigo: 'USD' },
    });
    if (preparada.estado !== 'TARIFARIO')
      throw new Error('Se esperaba tarifario');
    await prisma.datosEmpresa.update({
      where: { tenantId: tenants[0] },
      data: { monedaCodigo: 'ARS' },
    });
    await expect(
      politica.comprobarReferenciaBorrador(
        tenants[0],
        'web',
        preparada.referencia,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('las ediciones simultáneas del estado inicial sólo crean una configuración', async () => {
    const resultados = await Promise.allSettled([
      guardar(politicaPreciosInicial()),
      guardar(politicaPreciosInicial()),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult)
        .reason,
    ).toBeInstanceOf(ConflictException);
    expect((await politica.obtenerBorrador(tenants[0])).revision).toBe(1);
  });

  it('una revisión vieja no sobrescribe la política; dos ediciones sólo aceptan una', async () => {
    await guardar(politicaPreciosInicial());
    const resultados = await Promise.allSettled([
      guardar(politicaPreciosInicial(), 1),
      guardar(politicaPreciosInicial(), 1),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(guardar(politicaPreciosInicial(), 0)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect((await politica.obtenerBorrador(tenants[0])).revision).toBe(2);
  });

  it('audita la configuración completa y revierte el guardado si falla la auditoría', async () => {
    const b = await guardar(politicaPreciosInicial());
    const evento = await prisma.centroCopiadoEvento.findFirst({
      where: {
        tenantId: tenants[0],
        tipo: 'POLITICA_PRECIOS_BORRADOR_GUARDADO',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(evento).toMatchObject({
      actorUserId: users[0],
      datosJson: { revision: 1, contenido: b.contenido },
    });
    jest
      .spyOn(auditoria, 'registrar')
      .mockRejectedValueOnce(new Error('Fallo ficticio'));
    await expect(guardar(politicaPreciosInicial(), 1)).rejects.toThrow(
      'Fallo ficticio',
    );
    expect((await politica.obtenerBorrador(tenants[0])).revision).toBe(1);
  });

  it('una referencia inexistente almacenada fuera del servicio queda pendiente y no revela otra empresa', async () => {
    const ajeno = await crearTarifario(tenants[1]);
    await prisma.centroCopiadoPoliticaBorrador.create({
      data: {
        tenantId: tenants[0],
        actualizadoPorId: users[0],
        contenido: usarTarifario(ajeno.id),
      },
    });
    const resuelta = await politica.resolverBorrador(tenants[0], 'web');
    expect(resuelta).toMatchObject({
      estado: 'PENDIENTE',
      motivo: 'TARIFARIO_NO_DISPONIBLE',
    });
    expect(resuelta).not.toHaveProperty('version');
  });

  it('las rutas exigen sesión', async () => {
    await request(app.getHttpServer()).get(ruta).expect(401);
    await request(app.getHttpServer())
      .get(`${ruta}/previsualizacion`)
      .expect(401);
    await request(app.getHttpServer())
      .put(ruta)
      .send({ revision: 0, contenido: politicaPreciosInicial() })
      .expect(401);
  });

  it.each(['lector', 'administrador-limitado'])(
    '%s consulta pero no guarda políticas',
    async (actor) => {
      await request(app.getHttpServer())
        .get(ruta)
        .auth(tokens[actor], { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .get(`${ruta}/previsualizacion`)
        .auth(tokens[actor], { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .put(ruta)
        .auth(tokens[actor], { type: 'bearer' })
        .send({ revision: 0, contenido: politicaPreciosInicial() })
        .expect(403);
      expect((await politica.obtenerBorrador(tenants[0])).revision).toBe(0);
    },
  );

  it('guarda y consulta sólo la empresa de sesión aunque se envíe otro encabezado', async () => {
    const ajeno = await crearTarifario(tenants[1]);
    await politica.guardarBorrador(tenants[1], users[0], {
      revision: 0,
      contenido: usarTarifario(ajeno.id),
    });
    await request(app.getHttpServer())
      .put(ruta)
      .auth(tokens.gestor, { type: 'bearer' })
      .set('x-tenant-id', tenants[1])
      .send({ revision: 0, contenido: politicaPreciosInicial() })
      .expect(200);
    const lectura = await request(app.getHttpServer())
      .get(ruta)
      .auth(tokens.lector, { type: 'bearer' })
      .set('x-tenant-id', tenants[1])
      .expect(200);
    expect(lectura.body).toMatchObject({
      revision: 1,
      actualizadoPorId: users[0],
      operativa: false,
      contenido: politicaPreciosInicial(),
    });
    expect((await politica.obtenerBorrador(tenants[1])).contenido).toEqual(
      usarTarifario(ajeno.id),
    );
    expect(
      await prisma.centroCopiadoConfig.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(0);
  });

  it('rechaza tarifarios ajenos tanto en general como en excepciones y también IDs internos', async () => {
    const ajeno = await crearTarifario(tenants[1]);
    const excepcion = politicaPreciosInicial();
    excepcion.canales.web = { modalidad: 'TARIFARIO', tarifarioId: ajeno.id };
    for (const contenido of [
      usarTarifario(ajeno.id),
      usarTarifario(randomUUID()),
      excepcion,
    ])
      await request(app.getHttpServer())
        .put(ruta)
        .auth(tokens.gestor, { type: 'bearer' })
        .send({ revision: 0, contenido })
        .expect(400);
    for (const extra of [
      { tenantId: tenants[1] },
      { actualizadoPorId: users[1] },
      { operativa: true },
    ])
      await request(app.getHttpServer())
        .put(ruta)
        .auth(tokens.gestor, { type: 'bearer' })
        .send({ revision: 0, contenido: politicaPreciosInicial(), ...extra })
        .expect(400);
    expect((await politica.obtenerBorrador(tenants[0])).revision).toBe(0);
  });

  it('retirar el permiso de gestión impide guardar sin renovar la sesión', async () => {
    await prisma.rol.update({
      where: { id: roles.gestor, tenantId: tenants[0] },
      data: { permisos: ['configuracion.copiado.ver'] },
    });
    try {
      await request(app.getHttpServer())
        .put(ruta)
        .auth(tokens.gestor, { type: 'bearer' })
        .send({ revision: 0, contenido: politicaPreciosInicial() })
        .expect(403);
    } finally {
      await prisma.rol.update({
        where: { id: roles.gestor, tenantId: tenants[0] },
        data: { permisos: ['configuracion.copiado.gestionar'] },
      });
    }
  });

  it('verifica la capacidad antes de guardar', async () => {
    jest
      .spyOn(capacidades, 'exigirIncluida')
      .mockRejectedValueOnce(new BadRequestException('Capacidad no incluida'));
    await request(app.getHttpServer())
      .put(ruta)
      .auth(tokens.gestor, { type: 'bearer' })
      .send({ revision: 0, contenido: politicaPreciosInicial() })
      .expect(400);
    expect((await politica.obtenerBorrador(tenants[0])).revision).toBe(0);
  });
});
