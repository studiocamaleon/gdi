import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { InventarioController } from '../../inventario/inventario.controller';
import { InventarioStockController } from '../../inventario/inventario-stock.controller';
import { ReservasMaterialController } from '../../inventario/reservas-material.controller';
import { ReservasMaterialService } from '../../inventario/reservas-material.service';
import { InventarioService } from '../../inventario/inventario.service';
import { InventarioBibliotecaService } from '../../inventario/inventario-biblioteca.service';
import { AuthGuard } from '../auth.guard';
import { RolesGuard } from '../roles.guard';
import { PermisosGuard } from '../permisos.guard';

/** PostgreSQL, sesiones, guards y servicios reales. Sólo se sustituye el plan;
 * no se consultan cotizaciones externas ni se cambia stock fuera del fixture. */
describe('Inventario: permisos HTTP y relaciones entre empresas', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const secretAnterior = process.env.JWT_SECRET;
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const materiales: string[] = [];
  const variantes: string[] = [];
  const almacenes: string[] = [];
  const ubicaciones: string[] = [];
  const proveedores: string[] = [];
  const tokens: Record<string, string> = {};
  let app: INestApplication<Server>;
  let baseValidada = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    ) {
      throw new Error('Requiere base local de test y aislamiento activo');
    }
    baseValidada = true;
    process.env.JWT_SECRET = secret;
    await prisma.$connect();
    for (const [i, tenantId] of tenants.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          slug: `qa-inventario-${tenantId}`,
          nombre: 'Empresa ficticia',
        },
      });
      const proveedor = await prisma.proveedor.create({
        data: {
          tenantId,
          nombre: 'Proveedor ficticio',
          paisCodigo: 'AR',
          emailPrincipal: '',
          telefonoCodigo: '',
          telefonoNumero: '',
        },
      });
      proveedores.push(proveedor.id);
      const material = await prisma.materiaPrima.create({
        data: {
          tenantId,
          codigo: `QA-MAT-${i}`,
          nombre: `Material privado ${i}`,
          familia: 'SUSTRATO',
          subfamilia: 'SUSTRATO_HOJA',
          tipoTecnico: 'papel',
          templateId: 'sustrato_hoja',
          unidadStock: 'HOJA',
          unidadCompra: 'HOJA',
          atributosTecnicosJson: {},
          variantes: {
            create: {
              tenantId,
              sku: `QA-SKU-${i}`,
              precioReferencia: 10,
              moneda: 'ARS',
              proveedorReferenciaId: proveedor.id,
              atributosVarianteJson: {},
            },
          },
        },
        include: { variantes: true },
      });
      materiales.push(material.id);
      variantes.push(material.variantes[0].id);
      const almacen = await prisma.almacenMateriaPrima.create({
        data: {
          tenantId,
          codigo: `QA-ALM-${i}`,
          nombre: `Almacén privado ${i}`,
          ubicaciones: {
            create: { tenantId, codigo: 'QA-UBI', nombre: 'Estante ficticio' },
          },
        },
        include: { ubicaciones: true },
      });
      almacenes.push(almacen.id);
      ubicaciones.push(almacen.ubicaciones[0].id);
      await prisma.stockMateriaPrimaVariante.create({
        data: {
          tenantId,
          varianteId: variantes[i],
          ubicacionId: ubicaciones[i],
          cantidadDisponible: 10,
          costoPromedio: 10,
        },
      });
    }
    for (const [actor, permisos] of [
      ['gestor', ['inventario.ver', 'inventario.gestionar']],
      ['lector', ['inventario.ver']],
      ['sin-permisos', []],
      ['vendedor', ['comercial.ordenes.ver']],
      ['presupuestos', ['comercial.presupuestos.ver']],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `qa-inventario-${randomUUID()}@example.invalid`,
        },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: {
          tenantId: tenants[0],
          nombre: actor,
          permisos: [...permisos],
        },
      });
      const miembro = await prisma.membership.create({
        data: {
          tenantId: tenants[0],
          userId: user.id,
          rol: 'ADMINISTRADOR',
          rolId: rol.id,
        },
      });
      const sesion = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: tenants[0],
          currentMembershipId: miembro.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      tokens[actor] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: sesion.id,
        tenantId: tenants[0],
        membershipId: miembro.id,
        role: 'ADMINISTRADOR',
      });
    }
    const modulo = await Test.createTestingModule({
      controllers: [
        InventarioController,
        InventarioStockController,
        ReservasMaterialController,
      ],
      providers: [
        {
          provide: ReservasMaterialService,
          useValue: new ReservasMaterialService(
            prisma,
            new InventarioService(prisma),
            capacidades,
          ),
        },
        {
          provide: InventarioService,
          useValue: new InventarioService(prisma, undefined, capacidades),
        },
        {
          provide: InventarioBibliotecaService,
          useValue: new InventarioBibliotecaService(prisma, capacidades),
        },
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
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  });

  function http(
    method: 'get' | 'post' | 'put' | 'patch',
    ruta: string,
    actor = 'gestor',
  ) {
    return request(app.getHttpServer())
      [method](ruta)
      .auth(tokens[actor], { type: 'bearer' })
      .set('x-tenant-id', tenants[1]);
  }
  it('el modo de inicio exige gestión, limita cambios a la propia empresa y registra al actor', async () => {
    await request(app.getHttpServer()).get('/inventario/inicio').expect(401);
    await http('get', '/inventario/inicio', 'sin-permisos').expect(403);
    const inicial = await http('get', '/inventario/inicio', 'vendedor').expect(
      200,
    );
    expect(inicial.body).toEqual({ activo: false, version: 0 });
    await http('get', '/inventario/inicio', 'presupuestos').expect(200);
    for (const actor of ['lector', 'vendedor', 'presupuestos', 'sin-permisos'])
      await http('put', '/inventario/inicio', actor)
        .send({ activo: true, version: 0 })
        .expect(403);
    for (const invalido of [
      { activo: true, version: 0, tenantId: tenants[1] },
      { activo: 'true', version: 0 },
      { activo: true, version: -1 },
    ])
      await http('put', '/inventario/inicio').send(invalido).expect(400);
    const activado = await http('put', '/inventario/inicio')
      .send({ activo: true, version: 0 })
      .expect(200);
    expect(activado.body).toEqual({ activo: true, version: 1 });
    await http('put', '/inventario/inicio')
      .send({ activo: false, version: 0 })
      .expect(409);
    expect(
      await prisma.politicaReservasMaterial.findUnique({
        where: { tenantId: tenants[1] },
      }),
    ).toBeNull();
    expect(
      await prisma.eventoSistema.findMany({
        where: { tenantId: tenants[0], tipo: 'inventario.modo_inicio' },
      }),
    ).toEqual([expect.objectContaining({ actorUserId: users[0] })]);
    await http('put', '/inventario/inicio')
      .send({ activo: false, version: activado.body.version })
      .expect(200);
  });

  const materialPayload = (proveedorId = proveedores[0]) => ({
    codigo: 'QA-MATERIAL-NUEVO',
    nombre: 'Material ficticio nuevo',
    familia: 'sustrato',
    subfamilia: 'sustrato_hoja',
    tipoTecnico: 'papel',
    templateId: 'sustrato_hoja',
    unidadStock: 'hoja',
    unidadCompra: 'hoja',
    esConsumible: false,
    esRepuesto: false,
    activo: true,
    atributosTecnicos: {},
    variantes: [
      {
        sku: 'QA-SKU-NUEVO',
        activo: true,
        atributosVariante: {},
        precioReferencia: 10,
        moneda: 'ARS',
        proveedorReferenciaId: proveedorId,
      },
    ],
  });
  const movimiento = (
    varianteId = variantes[0],
    ubicacionId = ubicaciones[0],
  ) => ({
    varianteId,
    ubicacionId,
    tipo: 'ingreso',
    origen: 'ajuste_manual',
    cantidad: 2,
    costoUnitario: 10,
  });

  it.each([
    '/inventario/materias-primas',
    '/inventario/almacenes',
    '/inventario/stock',
    '/inventario/stock/pagina',
    '/inventario/kardex',
  ])(
    'la lectura %s requiere sesión y permiso; no incluye la otra empresa',
    async (ruta) => {
      await request(app.getHttpServer()).get(ruta).expect(401);
      await http('get', ruta, 'sin-permisos').expect(403);
      const res = await http('get', ruta, 'lector').expect(200);
      for (const id of [
        tenants[1],
        materiales[1],
        variantes[1],
        almacenes[1],
        ubicaciones[1],
      ]) {
        expect(JSON.stringify(res.body)).not.toContain(id);
      }
    },
  );

  it.each(['material', 'ubicaciones', 'resumen'])(
    'rechaza lectura directa ajena: %s',
    async (tipo) => {
      const ruta =
        tipo === 'material'
          ? `/inventario/materias-primas/${materiales[1]}`
          : tipo === 'ubicaciones'
            ? `/inventario/almacenes/${almacenes[1]}/ubicaciones`
            : `/inventario/stock/resumen-material/${materiales[1]}`;
      await http('get', ruta).expect(404);
    },
  );

  it('el lector no puede modificar materiales, variantes, almacenes, ubicaciones ni stock', async () => {
    const operaciones: Array<['post' | 'put' | 'patch', string, object]> = [
      ['post', '/inventario/materias-primas', materialPayload()],
      [
        'put',
        `/inventario/materias-primas/${materiales[0]}`,
        materialPayload(),
      ],
      ['patch', `/inventario/materias-primas/${materiales[0]}/toggle`, {}],
      [
        'patch',
        `/inventario/materias-primas/variantes/${variantes[0]}/precio-referencia`,
        { precioReferencia: 20 },
      ],
      [
        'patch',
        '/inventario/materias-primas/costos',
        { variantes: [{ id: variantes[0], precioReferencia: 20 }] },
      ],
      [
        'post',
        '/inventario/almacenes',
        { codigo: 'QA-NUEVO', nombre: 'Nuevo', activo: true },
      ],
      [
        'put',
        `/inventario/almacenes/${almacenes[0]}`,
        { codigo: 'QA-CAMBIO', nombre: 'Cambio', activo: true },
      ],
      ['patch', `/inventario/almacenes/${almacenes[0]}/toggle`, {}],
      [
        'post',
        `/inventario/almacenes/${almacenes[0]}/ubicaciones`,
        { codigo: 'QA-NUEVA', nombre: 'Nueva', activo: true },
      ],
      [
        'put',
        `/inventario/ubicaciones/${ubicaciones[0]}`,
        { codigo: 'QA-CAMBIO', nombre: 'Cambio', activo: true },
      ],
      ['patch', `/inventario/ubicaciones/${ubicaciones[0]}/toggle`, {}],
      ['post', '/inventario/movimientos', movimiento()],
      [
        'post',
        '/inventario/movimientos/transferencia',
        {
          varianteId: variantes[0],
          ubicacionOrigenId: ubicaciones[0],
          ubicacionDestinoId: ubicaciones[1],
          cantidad: 1,
        },
      ],
      ['post', '/inventario/materias-primas/biblioteca/no-existe/instalar', {}],
    ];
    for (const [metodo, ruta, cuerpo] of operaciones) {
      await http(metodo, ruta, 'lector').send(cuerpo).expect(403);
    }
    expect(
      await prisma.materiaPrima.count({ where: { tenantId: tenants[0] } }),
    ).toBe(1);
    expect(
      await prisma.movimientoStockMateriaPrima.count({
        where: { tenantId: { in: tenants } },
      }),
    ).toBe(0);
  });

  it('rechaza un proveedor ajeno en alta y edición sin guardar parcialmente', async () => {
    await http('post', '/inventario/materias-primas')
      .send(materialPayload(proveedores[1]))
      .expect(400);
    await http('put', `/inventario/materias-primas/${materiales[0]}`)
      .send(materialPayload(proveedores[1]))
      .expect(400);
    expect(
      await prisma.materiaPrima.count({ where: { tenantId: tenants[0] } }),
    ).toBe(1);
    expect(
      (
        await prisma.materiaPrima.findUniqueOrThrow({
          where: { id: materiales[0] },
        })
      ).nombre,
    ).toBe('Material privado 0');
  });

  it('rechaza lote mixto de precios sin modificar la variante propia', async () => {
    await http('patch', '/inventario/materias-primas/costos')
      .send({
        variantes: variantes.map((id) => ({ id, precioReferencia: 999 })),
      })
      .expect(404);
    for (const id of variantes) {
      expect(
        Number(
          (
            await prisma.materiaPrimaVariante.findUniqueOrThrow({
              where: { id },
            })
          ).precioReferencia,
        ),
      ).toBe(10);
    }
  });

  it('rechaza modificar objetos de otra empresa aun con permiso de gestión', async () => {
    await http('patch', `/inventario/materias-primas/${materiales[1]}/toggle`)
      .send({})
      .expect(404);
    await http('patch', `/inventario/almacenes/${almacenes[1]}/toggle`)
      .send({})
      .expect(404);
    await http('patch', `/inventario/ubicaciones/${ubicaciones[1]}/toggle`)
      .send({})
      .expect(404);
    await http('post', `/inventario/almacenes/${almacenes[1]}/ubicaciones`)
      .send({ codigo: 'QA-INVALIDA', nombre: 'Ajena', activo: true })
      .expect(404);
  });

  it.each(['variante', 'ubicacion', 'transferencia'])(
    'no mezcla empresas al registrar stock: %s',
    async (caso) => {
      if (caso === 'transferencia') {
        await http('post', '/inventario/movimientos/transferencia')
          .send({
            varianteId: variantes[0],
            ubicacionOrigenId: ubicaciones[0],
            ubicacionDestinoId: ubicaciones[1],
            cantidad: 2,
          })
          .expect(404);
      } else {
        await http('post', '/inventario/movimientos')
          .send(
            movimiento(
              variantes[caso === 'variante' ? 1 : 0],
              ubicaciones[caso === 'ubicacion' ? 1 : 0],
            ),
          )
          .expect(404);
      }
      const saldos = await prisma.stockMateriaPrimaVariante.findMany({
        where: { tenantId: { in: tenants } },
      });
      expect(saldos).toHaveLength(2);
      expect(saldos.every((s) => Number(s.cantidadDisponible) === 10)).toBe(
        true,
      );
      expect(
        await prisma.movimientoStockMateriaPrima.count({
          where: { tenantId: { in: tenants } },
        }),
      ).toBe(0);
    },
  );

  it('el gestor registra stock propio y no puede inyectar tenantId', async () => {
    await http('post', '/inventario/movimientos')
      .send({ ...movimiento(), tenantId: tenants[1] })
      .expect(400);
    const res = await http('post', '/inventario/movimientos')
      .send(movimiento())
      .expect(201);
    expect(res.body).toBeDefined();
    const movimientos = await prisma.movimientoStockMateriaPrima.findMany({
      where: { tenantId: { in: tenants } },
    });
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]).toMatchObject({
      tenantId: tenants[0],
      varianteId: variantes[0],
      ubicacionId: ubicaciones[0],
    });
    const saldos = await prisma.stockMateriaPrimaVariante.findMany({
      where: { tenantId: { in: tenants } },
    });
    expect(
      Number(saldos.find((s) => s.tenantId === tenants[0])!.cantidadDisponible),
    ).toBe(12);
    expect(
      Number(saldos.find((s) => s.tenantId === tenants[1])!.cantidadDisponible),
    ).toBe(10);
  });
});
