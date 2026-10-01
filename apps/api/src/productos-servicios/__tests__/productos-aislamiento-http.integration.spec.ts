import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { PrismaService } from '../../prisma/prisma.service';
import { EventosSistemaService } from '../../eventos-sistema/eventos-sistema.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { ProductosServiciosController } from '../productos-servicios.controller';
import { ProductosServiciosService } from '../productos-servicios.service';
import { ProductosService } from '../productos.service';
import { RutasProduccionService } from '../rutas-produccion.service';
import { ProductoRutasService } from '../producto-rutas.service';
import { ConfigPasosService } from '../config-pasos.service';
import { FamiliasPasosService } from '../familias-pasos.service';
import { CargosDirectosProductoService } from '../cargos-directos-producto.service';
import { ProductoValidacionService } from '../producto-validacion.service';
import { PasosTenantService } from '../pasos-tenant.service';
import { FormularioCotizacionService } from '../formulario-cotizacion.service';
import { RecetasProductoService } from '../recetas-producto.service';
import { PublicacionAutomaticaInterceptor } from '../publicacion-automatica.interceptor';

/** PostgreSQL, autenticación, permisos, servicios y publicación reales.
 * Se sustituye la lectura del plan y la entrega de eventos fuera del proceso. */
describe('Productos: fronteras HTTP y referencias de rutas entre empresas', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const secretAnterior = process.env.JWT_SECRET;
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const productos: string[] = [];
  const rutas: string[] = [];
  const alternativas: string[] = [];
  const pasosRuta: string[] = [];
  const pasosPropios: string[] = [];
  const tokens: Record<string, string> = {};
  const categoriaId = randomUUID();
  const subcategoriaId = randomUUID();
  const codigoCategoria = `qa-${randomUUID()}`;
  const eventos = { publicar: jest.fn().mockResolvedValue(undefined) };
  let app: INestApplication<Server>;
  let baseValidada = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test y aislamiento activo');
    baseValidada = true;
    process.env.JWT_SECRET = secret;
    await prisma.$connect();
    await prisma.productoCategoriaComercial.create({
      data: {
        id: categoriaId,
        codigo: codigoCategoria,
        nombre: 'Categoría ficticia',
      },
    });
    await prisma.productoSubcategoriaComercial.create({
      data: {
        id: subcategoriaId,
        categoriaId,
        codigo: codigoCategoria,
        nombre: 'Subcategoría ficticia',
        atributosSchemaJson: {},
      },
    });
    for (const [i, tenantId] of tenants.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          nombre: 'Empresa ficticia',
          slug: `qa-productos-${tenantId}`,
        },
      });
      const producto = await prisma.producto.create({
        data: {
          tenantId,
          codigo: 'QA-PRODUCTO',
          nombre: `Producto privado ${i}`,
          subcategoriaComercialId: subcategoriaId,
          dimensionesRequeridas: [],
        },
      });
      productos.push(producto.id);
      const ruta = await prisma.ruta.create({
        data: { tenantId, codigo: 'QA-RUTA', nombre: `Ruta privada ${i}` },
      });
      rutas.push(ruta.id);
      const paso = await prisma.rutaPaso.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          familiaCodigo: 'trabajo_manual',
          orden: 1,
        },
      });
      pasosRuta.push(paso.id);
      await prisma.rutaVersion.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          version: 1,
          snapshotJson: { pasos: [JSON.parse(JSON.stringify(paso))] },
        },
      });
      const alternativa = await prisma.productoRutaAlternativa.create({
        data: {
          tenantId,
          productoId: producto.id,
          rutaId: ruta.id,
          rutaVersion: 1,
          nombre: `Alternativa privada ${i}`,
          esPreferida: true,
        },
      });
      alternativas.push(alternativa.id);
      await prisma.productoConfigPaso.create({
        data: {
          tenantId,
          productoRutaAlternativaId: alternativa.id,
          rutaPasoId: paso.id,
          modoActivacion: 'OBLIGATORIO',
          modoTiempo: 'FIJO',
          tiempoFijoOverrideMin: 5,
        },
      });
      const propio = await prisma.pasoTenant.create({
        data: {
          tenantId,
          nombre: `Paso propio privado ${i}`,
          plantillaCodigo: 'embalaje',
        },
      });
      pasosPropios.push(propio.id);
    }
    for (const [actor, i, permisos] of [
      ['gestor', 0, ['costos.ver', 'costos.gestionar', 'comercial.ver']],
      ['lector', 0, ['costos.ver']],
      ['sin-permisos', 0, []],
      ['otro-gestor', 1, ['costos.ver', 'costos.gestionar']],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `qa-productos-${randomUUID()}@example.invalid` },
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
    const modulo = await Test.createTestingModule({
      controllers: [ProductosServiciosController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: CapacidadesEmpresaService, useValue: capacidades },
        { provide: EventosSistemaService, useValue: eventos },
        ProductosServiciosService,
        ProductosService,
        RutasProduccionService,
        ProductoRutasService,
        ConfigPasosService,
        FamiliasPasosService,
        CargosDirectosProductoService,
        ProductoValidacionService,
        PasosTenantService,
        FormularioCotizacionService,
        RecetasProductoService,
        PublicacionAutomaticaInterceptor,
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
    if (secretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretAnterior;
    await app?.close();
    if (baseValidada) {
      await prisma.productoReceta.deleteMany({
        where: { tenantId: { in: tenants } },
      });
      await prisma.producto.deleteMany({
        where: { tenantId: { in: tenants } },
      });
      await prisma.ruta.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.productoSubcategoriaComercial.deleteMany({
        where: { id: subcategoriaId },
      });
      await prisma.productoCategoriaComercial.deleteMany({
        where: { id: categoriaId },
      });
    }
    await prisma.$disconnect();
  });

  const http = (
    metodo: 'get' | 'post' | 'patch' | 'delete',
    ruta: string,
    actor = 'gestor',
  ) =>
    request(app.getHttpServer())
      [metodo](`/productos-servicios/${ruta}`)
      .auth(tokens[actor], { type: 'bearer' })
      .set('x-tenant-id', tenants[1]);
  const cuerpoProducto = () => ({
    nombre: 'Producto ficticio nuevo',
    subcategoriaComercialCodigo: codigoCategoria,
    unidadComercial: 'unidad',
    modoMedidas: 'LIBRE',
    dimensionesRequeridas: [],
  });
  const cuerpoAlternativa = (i = 0) => ({
    rutaId: rutas[i],
    rutaVersion: 1,
    nombre: 'Ruta alternativa ficticia',
  });
  async function estado() {
    const where = { tenantId: { in: tenants } };
    const orderBy = { id: 'asc' as const };
    return Promise.all([
      prisma.producto.findMany({ where, orderBy }),
      prisma.ruta.findMany({ where, orderBy }),
      prisma.rutaPaso.findMany({ where, orderBy }),
      prisma.productoRutaAlternativa.findMany({ where, orderBy }),
      prisma.productoConfigPaso.findMany({ where, orderBy }),
      prisma.productoReceta.findMany({ where, orderBy }),
      prisma.productoRecetaRevision.findMany({ where, orderBy }),
    ]);
  }

  it('exige sesión y permiso real para leer el catálogo privado', async () => {
    await request(app.getHttpServer())
      .get('/productos-servicios/productos')
      .expect(401);
    await http('get', 'productos', 'sin-permisos').expect(403);
  });

  it.each(['productos', 'rutas', 'pasos-tenant'])(
    '%s mantiene la pertenencia de ambas sesiones concurrentes',
    async (ruta) => {
      const ids =
        ruta === 'productos'
          ? productos
          : ruta === 'rutas'
            ? rutas
            : pasosPropios;
      const resultados = await Promise.all([
        http('get', ruta).expect(200),
        http('get', ruta, 'otro-gestor').expect(200),
      ]);
      for (const [i, r] of resultados.entries()) {
        expect(r.text).toContain(ids[i]);
        expect(r.text).not.toContain(ids[1 - i]);
      }
    },
  );

  it('leer costos no permite editar, duplicar o eliminar productos, rutas ni configuraciones', async () => {
    const antes = await estado();
    await http('post', 'productos', 'lector')
      .send(cuerpoProducto())
      .expect(403);
    await http('patch', `productos/${productos[0]}`, 'lector')
      .send({ nombre: 'No guardar' })
      .expect(403);
    await http('post', `productos/${productos[0]}/duplicar`, 'lector')
      .send({})
      .expect(403);
    await http('delete', `productos/${productos[0]}`, 'lector').expect(403);
    await http('post', 'rutas', 'lector')
      .send({
        nombre: 'No guardar',
        pasos: [{ orden: 1, familiaCodigo: 'embalaje' }],
      })
      .expect(403);
    await http('patch', `rutas/${rutas[0]}`, 'lector')
      .send({ nombre: 'No guardar' })
      .expect(403);
    await http('post', `productos/${productos[0]}/rutas-alternativas`, 'lector')
      .send(cuerpoAlternativa())
      .expect(403);
    await http(
      'post',
      `productos/rutas-alternativas/${alternativas[0]}/config-pasos`,
      'lector',
    )
      .send({ rutaPasoId: pasosRuta[0] })
      .expect(403);
    expect(await estado()).toEqual(antes);
  });

  it('un gestor no puede leer, modificar ni duplicar productos y rutas ajenas', async () => {
    const antes = await estado();
    for (const [ruta, id] of [
      ['productos', productos[1]],
      ['rutas', rutas[1]],
    ]) {
      await http('get', `${ruta}/${id}`).expect(404);
      await http('patch', `${ruta}/${id}`)
        .send({ nombre: 'No guardar' })
        .expect(404);
      await http('post', `${ruta}/${id}/duplicar`).send({}).expect(404);
      await http('delete', `${ruta}/${id}`).expect(404);
    }
    await http('get', `productos/${productos[1]}/receta`).expect(404);
    await http('get', `productos/${productos[1]}/formulario-cotizacion`).expect(
      404,
    );
    expect(await estado()).toEqual(antes);
  });

  it('rechaza asociar una ruta ajena y usar una ruta propia en un producto ajeno', async () => {
    const antes = await estado();
    await http('post', `productos/${productos[0]}/rutas-alternativas`)
      .send(cuerpoAlternativa(1))
      .expect(404);
    await http('post', `productos/${productos[1]}/rutas-alternativas`)
      .send(cuerpoAlternativa(0))
      .expect(404);
    expect(await estado()).toEqual(antes);
  });

  it('rechaza modificar, borrar o copiar una alternativa ajena, incluyendo su configuración de pasos', async () => {
    const antes = await estado();
    const ruta = `productos/rutas-alternativas/${alternativas[1]}`;
    await http('patch', ruta).send({ nombre: 'No guardar' }).expect(404);
    await http('delete', ruta).expect(404);
    await http('post', `${ruta}/duplicar`).send({}).expect(404);
    await http('post', `${ruta}/config-pasos`)
      .send({ rutaPasoId: pasosRuta[1] })
      .expect(404);
    expect(await estado()).toEqual(antes);
  });

  it('rechaza un paso de otra ruta/empresa en la configuración y el reordenamiento', async () => {
    const antes = await estado();
    const ruta = `productos/rutas-alternativas/${alternativas[0]}`;
    await http('post', `${ruta}/config-pasos`)
      .send({ rutaPasoId: pasosRuta[1] })
      .expect(400);
    await http('patch', `${ruta}/orden-pasos`)
      .send({ pasoIds: [pasosRuta[1]] })
      .expect(400);
    expect(await estado()).toEqual(antes);
  });

  it('rechaza la familia privada ajena al crear una ruta, aunque el registro global la conozca', async () => {
    const antes = await estado();
    await http('post', 'rutas')
      .send({
        nombre: 'Ruta ficticia rechazada',
        pasos: [{ orden: 1, familiaCodigo: pasosPropios[1] }],
      })
      .expect(400);
    expect(await estado()).toEqual(antes);
  });

  it('rechaza una migración con alternativas mezcladas sin modificar las propias', async () => {
    const antes = await estado();
    await http('post', `rutas/${rutas[0]}/migrar-productos`)
      .send({ rutaAlternativaIds: [alternativas[0], alternativas[1]] })
      .expect(400);
    expect(await estado()).toEqual(antes);
  });

  it('rechaza cambiar el propietario o identificador por campos adicionales', async () => {
    const antes = await estado();
    await http('post', 'productos')
      .send({ ...cuerpoProducto(), tenantId: tenants[1] })
      .expect(400);
    await http('patch', `productos/${productos[0]}`)
      .send({ nombre: 'No guardar', id: productos[1] })
      .expect(400);
    expect(await estado()).toEqual(antes);
  });

  it('permite la edición y duplicación propia con publicación real sin alterar datos ajenos', async () => {
    const ajeno = await prisma.producto.findUniqueOrThrow({
      where: { id: productos[1] },
    });
    await http('patch', `productos/${productos[0]}`)
      .send({ nombre: 'Producto propio actualizado' })
      .expect(200);
    expect(
      await prisma.producto.findUniqueOrThrow({ where: { id: productos[0] } }),
    ).toMatchObject({
      nombre: 'Producto propio actualizado',
      tenantId: tenants[0],
    });
    const duplicado = await http('post', `productos/${productos[0]}/duplicar`)
      .send({ nombre: 'Copia ficticia propia' })
      .expect(201);
    const id = (duplicado.body as { id: string }).id;
    expect(id).toEqual(expect.any(String));
    expect(
      await prisma.producto.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({ tenantId: tenants[0] });
    const alternativa = await prisma.productoRutaAlternativa.findFirstOrThrow({
      where: { productoId: id },
    });
    expect(alternativa).toMatchObject({
      tenantId: tenants[0],
      rutaId: rutas[0],
    });
    expect(
      await prisma.producto.findUniqueOrThrow({ where: { id: productos[1] } }),
    ).toEqual(ajeno);
  });
});
