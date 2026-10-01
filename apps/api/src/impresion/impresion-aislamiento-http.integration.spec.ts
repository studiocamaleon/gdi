import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ArchivosService } from '../archivos/archivos.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermisosGuard } from '../auth/permisos.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CatalogoCadService } from '../centro-copiado/catalogo-cad.service';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { MotorUniversalService } from '../motor-universal/motor.service';
import { PrismaService } from '../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { DocumentosOrdenService } from './documentos-orden.service';
import { ImpresionController } from './impresion.controller';
import { ImpresionDirectaGuard } from './impresion-directa.guard';
import { ImpresionService } from './impresion.service';
import { PerfilesCadController } from './perfiles-cad.controller';
import { PerfilesCadService } from './perfiles-cad.service';
import { PerfilesImpresionService } from './perfiles-impresion.service';

/** HTTP, sesiones, permisos, plan evaluado, servicios y PostgreSQL reales.
 * Plan persistido de prueba; storage y motor rechazan llamadas no previstas.
 * No hay certificado QZ, impresoras, archivos ni proveedores reales. */
describe('Impresión: permisos y aislamiento por HTTP', () => {
  const prisma = new PrismaService();
  const jwt = new JwtService({ secret: randomUUID() });
  const capacidades = new CapacidadesEmpresaService(prisma);
  const planId = randomUUID();
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const tokens: Record<string, string> = {};
  const datos: Array<{
    maquina: string;
    papel: string;
    destino: string;
    bandeja: string;
    perfil: string;
    orden: string;
    evento: string;
  }> = [];
  const storage = {
    leerContenido: jest.fn(() => {
      throw new Error('Sin archivos externos');
    }),
    logoDataUri: jest.fn(() => Promise.resolve(null)),
  };
  const motor = {
    cotizar: jest.fn(() => {
      throw new Error('Sin cotización externa');
    }),
  };
  let app: INestApplication<Server>;
  let baseValidada = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test con aislamiento activo');
    baseValidada = true;
    await prisma.$connect();
    for (const [i, tenantId] of tenants.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          slug: `qa-impresion-${tenantId}`,
          nombre: `Empresa ficticia ${i}`,
        },
      });
      const planta = await prisma.planta.create({
        data: { tenantId, codigo: 'P', nombre: 'Planta ficticia' },
      });
      const maquina = await prisma.maquina.create({
        data: {
          tenantId,
          plantaId: planta.id,
          codigo: 'M',
          nombre: `Máquina ${i}`,
          plantilla: 'IMPRESORA_LASER',
          geometriaTrabajo: 'PLIEGO',
          unidadProduccionPrincipal: 'HOJA',
        },
      });
      const papel = await prisma.materiaPrima.create({
        data: {
          tenantId,
          codigo: 'PAP',
          nombre: `Papel ${i}`,
          familia: 'SUSTRATO',
          subfamilia: 'SUSTRATO_HOJA',
          tipoTecnico: 'papel',
          templateId: 'papel',
          unidadStock: 'HOJA',
          unidadCompra: 'HOJA',
          atributosTecnicosJson: {},
        },
      });
      const destino = await prisma.impresionDestino.create({
        data: {
          tenantId,
          maquinaId: maquina.id,
          nombre: `Destino ${i}`,
          host: 'localhost',
          impresora: `COLA_${i}`,
        },
      });
      const bandeja = await prisma.impresionBandeja.create({
        data: {
          tenantId,
          destinoId: destino.id,
          nombre: `Bandeja ${i}`,
          codigo: 'TRAY',
        },
      });
      const perfil = await prisma.impresionPerfil.create({
        data: {
          tenantId,
          bandejaId: bandeja.id,
          papelMateriaPrimaId: papel.id,
          nombre: `Perfil ${i}`,
          gramaje: 80,
          tamano: 'A4',
          color: 'BN',
          faz: 1,
          modo: 'AUTOMATICO',
          probado: true,
          actualizadoPor: 'fixture@example.invalid',
        },
      });
      const orden = await prisma.ordenTrabajo.create({
        data: { tenantId, numero: `OT-QA-${i}`, estado: 'pendiente' },
      });
      const evento = await prisma.ordenTrabajoEvento.create({
        data: {
          tenantId,
          ordenId: orden.id,
          tipo: 'impresion_documento',
          descripcion: `Envío privado ${i}`,
          usuarioNombre: `Autor ${i}`,
          datosJson: { estado: 'SIN_CONFIRMAR', detalle: `Privado ${i}` },
        },
      });
      datos.push({
        maquina: maquina.id,
        papel: papel.id,
        destino: destino.id,
        bandeja: bandeja.id,
        perfil: perfil.id,
        orden: orden.id,
        evento: evento.id,
      });
    }
    await prisma.plan.create({
      data: {
        id: planId,
        codigo: `qa-impresion-${planId}`,
        nombre: 'Plan ficticio',
        precioMensual: 0,
        publico: false,
        featuresJson: { impresionDirecta: true },
        suscripciones: { create: tenants.map((tenantId) => ({ tenantId })) },
      },
    });
    for (const [actor, i, permisos] of [
      [
        'gestor',
        0,
        [
          'configuracion.gestionar',
          'configuracion.ver',
          'produccion.ejecutar',
          'comercial.gestionar',
        ],
      ],
      ['lector', 0, ['configuracion.ver', 'produccion.ver', 'comercial.ver']],
      ['operador', 0, ['produccion.ejecutar']],
      ['ninguno', 0, []],
      [
        'ajeno',
        1,
        ['configuracion.gestionar', 'configuracion.ver', 'produccion.ejecutar'],
      ],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `qa-impresion-${randomUUID()}@example.invalid` },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: { tenantId: tenants[i], nombre: actor, permisos: [...permisos] },
      });
      const miembro = await prisma.membership.create({
        data: {
          tenantId: tenants[i],
          userId: user.id,
          rol: 'ADMINISTRADOR',
          rolId: rol.id,
        },
      });
      const sesion = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: tenants[i],
          currentMembershipId: miembro.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      tokens[actor] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: sesion.id,
        tenantId: tenants[i],
        membershipId: miembro.id,
        role: 'ADMINISTRADOR',
      });
    }
    const impresion = new ImpresionService(
      prisma,
      storage as unknown as ArchivosService,
      new ConfigService({
        QZ_SIGNING_CERTIFICATE_PATH: '',
        QZ_SIGNING_PRIVATE_KEY_PATH: '',
      }),
      capacidades,
    );
    const perfiles = new PerfilesImpresionService(prisma, impresion);
    const documentos = new DocumentosOrdenService(
      prisma,
      storage as unknown as ArchivosService,
      impresion,
      perfiles,
      capacidades,
    );
    const cad = new PerfilesCadService(
      prisma,
      perfiles,
      motor as unknown as MotorUniversalService,
      new CatalogoCadService(prisma),
    );
    const modulo = await Test.createTestingModule({
      controllers: [ImpresionController, PerfilesCadController],
      providers: [
        ImpresionDirectaGuard,
        { provide: ImpresionService, useValue: impresion },
        { provide: PerfilesImpresionService, useValue: perfiles },
        { provide: DocumentosOrdenService, useValue: documentos },
        { provide: PerfilesCadService, useValue: cad },
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

  afterAll(async () => {
    await app?.close();
    if (baseValidada) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.plan.deleteMany({ where: { id: planId } });
    }
    await prisma.$disconnect();
  });

  type Metodo = 'get' | 'post' | 'put';
  const http = (ruta: string, metodo: Metodo = 'get', actor = 'gestor') =>
    request(app.getHttpServer())
      [metodo](`/impresion/${ruta}`)
      .auth(tokens[actor], { type: 'bearer' })
      .set('x-tenant-id', tenants[1]);
  const rutas = (): Array<[Metodo, string]> => {
    const { destino: d, perfil: p, bandeja: b, orden: o, evento: e } = datos[0];
    return [
      ['get', 'perfiles'],
      ['post', 'destinos'],
      ['put', `destinos/${d}`],
      ['post', `destinos/${d}/bandejas`],
      ['put', `destinos/${d}/cad`],
      ['post', `destinos/${d}/prueba-cad`],
      ['post', 'perfiles'],
      ['put', `perfiles/${p}`],
      ['post', `bandejas/${b}/preparacion`],
      ['post', `perfiles/${p}/prueba`],
      ['get', 'configuracion'],
      ['post', 'impresoras'],
      ['post', 'detalles-impresoras'],
      ['post', 'escuchar'],
      ['post', 'prueba-documento'],
      ['get', 'cola'],
      ['post', 'cola/liberar'],
      ['post', `ordenes/${o}/cola`],
      ['post', `ordenes/${o}/liberar-impresion`],
      ['get', `ordenes/${o}/documentos`],
      ['get', `ordenes/${o}/historial-documentos`],
      ['post', `ordenes/${o}/documentos/${randomUUID()}`],
      ['post', `ordenes/${o}/envios/${e}`],
      ['post', `ordenes/${o}/confirmacion-documentos`],
      ['get', `ordenes/${o}/etiqueta/pdf`],
      ['get', `ordenes/${o}/etiqueta`],
      ['post', `ordenes/${o}/etiqueta`],
      ['get', `cad/destinos/${d}/opciones`],
      ['post', 'cad/perfiles'],
      ['put', `cad/perfiles/${p}`],
      ['post', `cad/perfiles/${p}/prueba`],
      ['post', `cad/perfiles/${p}/cotizar-muestra`],
    ];
  };
  const perfilBody = () => ({
    nombre: 'Nuevo perfil',
    bandejaId: datos[0].bandeja,
    papelMateriaPrimaId: datos[0].papel,
    gramaje: 80,
    tamano: 'A4',
    color: 'BN',
    faz: 1,
    modo: 'AUTOMATICO',
    probado: false,
    activo: true,
    prioridad: 1,
    version: 1,
  });
  const destinoBody = () => ({
    nombre: 'Destino editado',
    maquinaId: datos[0].maquina,
    host: 'localhost',
    impresora: 'COLA_0',
    activo: false,
    version: 1,
  });
  const snapshot = () =>
    Promise.all([
      prisma.impresionDestino.findMany({
        where: { tenantId: { in: tenants } },
        orderBy: { id: 'asc' },
      }),
      prisma.impresionBandeja.findMany({
        where: { tenantId: { in: tenants } },
        orderBy: { id: 'asc' },
      }),
      prisma.impresionPerfil.findMany({
        where: { tenantId: { in: tenants } },
        orderBy: { id: 'asc' },
      }),
      prisma.ordenTrabajoEvento.findMany({
        where: { tenantId: { in: tenants } },
        orderBy: { id: 'asc' },
      }),
    ]);

  it('exige sesión y permisos efectivos en las 32 rutas, incluso con rol base administrador', async () => {
    expect(rutas()).toHaveLength(32);
    for (const [metodo, ruta] of rutas()) {
      await request(app.getHttpServer())
        [metodo](`/impresion/${ruta}`)
        .expect(401);
      await http(ruta, metodo, 'ninguno').expect(403);
    }
  });

  it('un lector no modifica perfiles, destinos, bandejas ni envíos', async () => {
    const previo = await snapshot();
    for (const [metodo, ruta] of rutas().filter(
      ([m, r]) =>
        m !== 'get' &&
        !['impresoras', 'escuchar', 'prueba-documento'].includes(r) &&
        !r.endsWith('/etiqueta'),
    ))
      await http(ruta, metodo, 'lector').send({}).expect(403);
    expect(await snapshot()).toEqual(previo);
  });

  it('separa lecturas simultáneas y no acepta la empresa de una cabecera', async () => {
    const respuestas = await Promise.all([
      http('perfiles'),
      http('perfiles', 'get', 'ajeno'),
      http('perfiles'),
    ]);
    for (const [i, r] of respuestas.entries()) {
      expect(r.status).toBe(200);
      const d = datos[i === 1 ? 1 : 0];
      expect(r.body).toMatchObject({
        destinos: [{ id: d.destino }],
        perfiles: [{ id: d.perfil }],
        maquinas: [{ id: d.maquina }],
        papeles: [{ id: d.papel }],
      });
    }
    const config = await http('configuracion').expect(200);
    expect(config.body).toMatchObject({
      tenantId: tenants[0],
      firmaDisponible: false,
      certificado: null,
    });
    expect(config.headers['cache-control']).toBe('no-store');
  });

  it('rechaza referencias a máquina, destino, bandeja, papel y perfil ajenos sin cambios parciales', async () => {
    const previo = await snapshot();
    await http('destinos', 'post')
      .send({ ...destinoBody(), maquinaId: datos[1].maquina })
      .expect(400);
    await http(`destinos/${datos[1].destino}`, 'put')
      .send(destinoBody())
      .expect(404);
    await http(`destinos/${datos[1].destino}/bandejas`, 'post')
      .send({ nombre: 'No', codigo: 'NO' })
      .expect(404);
    await http('perfiles', 'post')
      .send({ ...perfilBody(), bandejaId: datos[1].bandeja })
      .expect(400);
    await http('perfiles', 'post')
      .send({ ...perfilBody(), papelMateriaPrimaId: datos[1].papel })
      .expect(400);
    await http(`perfiles/${datos[1].perfil}`, 'put')
      .send(perfilBody())
      .expect(404);
    await http(`perfiles/${datos[1].perfil}/prueba`, 'post').expect(404);
    await http(`bandejas/${datos[1].bandeja}/preparacion`, 'post')
      .send({ version: 1 })
      .expect(404);
    await http(`bandejas/${datos[0].bandeja}/preparacion`, 'post')
      .send({ version: 1, perfilId: datos[1].perfil })
      .expect(400);
    expect(await snapshot()).toEqual(previo);
  });

  it('el alta propia fija empresa y autor del servidor, y rechaza campos internos', async () => {
    const previo = await snapshot();
    for (const campo of [
      { tenantId: tenants[1] },
      { actualizadoPor: 'falso@example.invalid' },
      { id: datos[1].perfil },
    ])
      await http('perfiles', 'post')
        .send({ ...perfilBody(), ...campo })
        .expect(400);
    expect(await snapshot()).toEqual(previo);
    const r = await http('perfiles', 'post').send(perfilBody()).expect(201);
    const creado = r.body as { id: string };
    const nuevo = await prisma.impresionPerfil.findUniqueOrThrow({
      where: { id: creado.id },
    });
    expect(nuevo.tenantId).toBe(tenants[0]);
    expect(nuevo.actualizadoPor).toMatch(/^qa-impresion-.*@example\.invalid$/);
    await prisma.impresionPerfil.delete({ where: { id: nuevo.id } });
  });

  it('un operador prepara su bandeja, conserva la otra empresa y respeta la versión', async () => {
    const ajena = await prisma.impresionBandeja.findUniqueOrThrow({
      where: { id: datos[1].bandeja },
    });
    await http(`bandejas/${datos[0].bandeja}/preparacion`, 'post', 'operador')
      .send({ version: 1, perfilId: datos[0].perfil })
      .expect(201);
    await http(`bandejas/${datos[0].bandeja}/preparacion`, 'post', 'operador')
      .send({ version: 1 })
      .expect(409);
    expect(
      await prisma.impresionBandeja.findUnique({
        where: { id: datos[0].bandeja },
      }),
    ).toMatchObject({
      version: 2,
      papelPreparadoId: datos[0].papel,
      gramajePreparado: 80,
    });
    expect(
      await prisma.impresionBandeja.findUnique({
        where: { id: datos[1].bandeja },
      }),
    ).toEqual(ajena);
  });

  it('no expone etiquetas, documentos ni historial de otra empresa', async () => {
    for (const sufijo of [
      'documentos',
      'historial-documentos',
      'etiqueta',
      'etiqueta/pdf',
    ])
      await http(`ordenes/${datos[1].orden}/${sufijo}`).expect(404);
    const propio = await http(
      `ordenes/${datos[0].orden}/historial-documentos`,
    ).expect(200);
    const historial = propio.body as { envios: unknown[] };
    expect(historial.envios).toHaveLength(1);
    expect(historial.envios[0]).toMatchObject({
      id: datos[0].evento,
      detalle: 'Privado 0',
    });
    expect(storage.logoDataUri).not.toHaveBeenCalled();
    expect(storage.leerContenido).not.toHaveBeenCalled();
  });

  it('no cambia estados ni confirma envíos ajenos, aunque el permiso propio sea válido', async () => {
    const previo = await snapshot();
    for (const [orden, evento] of [
      [datos[1].orden, datos[1].evento],
      [datos[0].orden, datos[1].evento],
      [datos[1].orden, datos[0].evento],
    ])
      await http(`ordenes/${orden}/envios/${evento}`, 'post')
        .send({ estado: 'ERROR', detalle: 'Falso' })
        .expect(404);
    await http(`ordenes/${datos[1].orden}/confirmacion-documentos`, 'post')
      .send({ envioIds: [datos[1].evento] })
      .expect(404);
    await http(`ordenes/${datos[0].orden}/confirmacion-documentos`, 'post')
      .send({ envioIds: [datos[1].evento] })
      .expect(409);
    expect(await snapshot()).toEqual(previo);
    await http(
      `ordenes/${datos[0].orden}/envios/${datos[0].evento}`,
      'post',
      'operador',
    )
      .send({ estado: 'ERROR', detalle: 'Ensayo propio' })
      .expect(201);
    expect(
      await prisma.ordenTrabajoEvento.findUnique({
        where: { id: datos[0].evento },
      }),
    ).toMatchObject({ datosJson: { estado: 'ERROR' } });
  });

  it('los límites y la whitelist impiden inyectar comandos de impresión', async () => {
    for (const dto of [
      { impresora: 'cola\ncomando', copias: 1, dobleFaz: false },
      { impresora: 'cola', copias: 4, dobleFaz: false },
      { impresora: 'cola', copias: 1, dobleFaz: false, call: 'file.read' },
      {
        impresora: 'cola',
        copias: 1,
        dobleFaz: false,
        params: { data: ['no permitido'] },
      },
    ])
      await http('prueba-documento', 'post').send(dto).expect(400);
    await http('escuchar', 'post')
      .send({ impresoras: ['cola\ncomando'], timestamp: Date.now() })
      .expect(400);
    await http('escuchar', 'post')
      .send({ impresoras: ['cola'], timestamp: Date.now() - 120_000 })
      .expect(400);
    await http('detalles-impresoras', 'post')
      .send({ timestamp: Date.now() - 120_000 })
      .expect(400);
    // Control positivo: cuerpo válido alcanza la exigencia del certificado.
    await http('prueba-documento', 'post')
      .send({ impresora: 'cola', copias: 1, dobleFaz: false })
      .expect(503);
  });

  it('el piloto CAD tampoco permite referencias ajenas ni invoca el motor al rechazarlas', async () => {
    await http(`cad/destinos/${datos[1].destino}/opciones`).expect(404);
    for (const accion of ['prueba', 'cotizar-muestra'])
      await http(`cad/perfiles/${datos[1].perfil}/${accion}`, 'post')
        .send({ version: 1, versionDestino: 1, formato: 'A1' })
        .expect(404);
    expect(motor.cotizar).not.toHaveBeenCalled();
    expect(storage.leerContenido).not.toHaveBeenCalled();
  });

  it('quitar impresión del plan bloquea nuevos trabajos, conserva historial autorizado y no libera permisos', async () => {
    await prisma.plan.update({
      where: { id: planId },
      data: { featuresJson: { impresionDirecta: false } },
    });
    try {
      await http('configuracion').expect(403);
      await http('impresoras', 'post').expect(403);
      await http(`ordenes/${datos[0].orden}/cola`, 'post').expect(403);
      await http(
        `ordenes/${datos[0].orden}/historial-documentos`,
        'get',
        'lector',
      ).expect(200);
      await http(
        `ordenes/${datos[0].orden}/historial-documentos`,
        'get',
        'ninguno',
      ).expect(403);
      await http(
        `ordenes/${datos[1].orden}/historial-documentos`,
        'get',
        'lector',
      ).expect(404);
    } finally {
      await prisma.plan.update({
        where: { id: planId },
        data: { featuresJson: { impresionDirecta: true } },
      });
    }
  });
});
