import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { AdministracionController } from '../../administracion/administracion.controller';
import { MetodosPagoService } from '../../administracion/metodos-pago.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { UsuariosController } from '../../usuarios/usuarios.controller';
import { TesoreriaService } from '../../administracion/tesoreria.service';
import { ConfiguracionFiscalService } from '../../administracion/configuracion-fiscal.service';
import { ImputacionesService } from '../../administracion/imputaciones.service';
import { AuthGuard } from '../auth.guard';
import { RolesGuard } from '../roles.guard';
import { PermisosGuard } from '../permisos.guard';

/** Servicios probados y PostgreSQL reales. Se sustituye la lectura del plan.
 * Las dependencias de emisión, correo y archivos fallan si se invocan: este
 * recorrido no emite comprobantes ni contacta proveedores externos. */
describe('Tesorería: permisos y relaciones entre empresas por HTTP', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const secretAnterior = process.env.JWT_SECRET;
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const cuentas: string[][] = [[], []];
  const metodos: string[] = [];
  const puntos: string[] = [];
  const cobros: string[] = [];
  const comprobantes: string[] = [];
  const tokens: Record<string, string> = {};
  let app: INestApplication<Server>;
  let baseValidada = false;
  const ajenoNoInvocado = jest.fn(() => {
    throw new Error('Dependencia externa fuera del recorrido de prueba');
  });
  const noUsado = new Proxy(
    {},
    {
      get: (_target, propiedad) =>
        [
          'then',
          'onModuleInit',
          'onModuleDestroy',
          'onApplicationBootstrap',
          'beforeApplicationShutdown',
          'onApplicationShutdown',
        ].includes(String(propiedad))
          ? undefined
          : ajenoNoInvocado,
    },
  );

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
          slug: `qa-tesoreria-${tenantId}`,
          nombre: 'Empresa ficticia',
        },
      });
      for (const numero of [1, 2]) {
        const cuenta = await prisma.cuentaFondos.create({
          data: {
            tenantId,
            tipo: 'caja',
            nombre: `Caja ficticia ${numero}`,
            saldo: 100,
          },
        });
        cuentas[i].push(cuenta.id);
      }
      const metodo = await prisma.metodoPago.create({
        data: {
          tenantId,
          codigo: 'qa-efectivo',
          nombre: 'Efectivo ficticio',
          tipo: 'efectivo',
          cuentaDestinoId: cuentas[i][0],
        },
      });
      metodos.push(metodo.id);
      const config = await prisma.configuracionFiscal.create({
        data: {
          tenantId,
          razonSocial: `Empresa ficticia ${i}`,
          cuit: '00000000000',
        },
      });
      const punto = await prisma.puntoVenta.create({
        data: {
          tenantId,
          configuracionFiscalId: config.id,
          numero: 1,
          nombre: 'Punto ficticio',
          modalidad: 'talonario',
        },
      });
      puntos.push(punto.id);
      const cobro = await prisma.cobro.create({
        data: {
          tenantId,
          metodoPagoId: metodo.id,
          cuentaDestinoId: cuentas[i][0],
          fecha: new Date(),
          montoBruto: 100,
          netoAcreditado: 100,
          disponibleReal: 100,
        },
      });
      cobros.push(cobro.id);
      const comprobante = await prisma.comprobante.create({
        data: {
          tenantId,
          puntoVentaId: punto.id,
          tipo: 'factura',
          letra: 'B',
          fecha: new Date(),
          receptorSnapshot: {},
          itemsJson: [],
          ivaPorAlicuota: [],
          netoGravado: 100,
          total: 100,
          saldoPendiente: 100,
          estado: 'emitido',
          idempotencyKey: randomUUID(),
        },
      });
      comprobantes.push(comprobante.id);
    }
    for (const [actor, permisos] of [
      ['gestor', ['administracion.ver', 'administracion.gestionar', 'configuracion.usuarios.gestionar']],
      ['lector', ['administracion.ver']],
      ['sin-permisos', []],
      ['cajero', ['acceso.por_vista', 'administracion.tesoreria.ver', 'tesoreria.arquear', 'tesoreria.transferir']],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `qa-tesoreria-${randomUUID()}@example.invalid`,
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
          cuentasRestringidas: actor === 'cajero',
          cuentasOperablesIds: actor === 'cajero' ? [cuentas[0][0]] : [],
          cuentasDestinoIds: actor === 'cajero' ? [cuentas[0][1]] : [],
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
    const reales = new Map<unknown, unknown>([
      [MetodosPagoService, new MetodosPagoService(prisma, capacidades)],
      [
        TesoreriaService,
        new TesoreriaService(prisma, noUsado as never, capacidades),
      ],
      [
        ConfiguracionFiscalService,
        new ConfiguracionFiscalService(prisma, capacidades),
      ],
      [ImputacionesService, new ImputacionesService(prisma)],
    ]);
    const dependencias = Reflect.getMetadata(
      'design:paramtypes',
      AdministracionController,
    ) as Array<new (...args: never[]) => unknown>;
    const modulo = await Test.createTestingModule({
      controllers: [AdministracionController, UsuariosController],
      providers: [
        { provide: CapacidadesEmpresaService, useValue: capacidades },
        { provide: UsuariosService, useValue: new UsuariosService(prisma, { invalidarTenant: jest.fn() } as never, noUsado as never) },
        ...dependencias.map((provide) => ({
          provide,
          useValue: reales.get(provide) ?? noUsado,
        })),
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
      // Primero las relaciones restrictivas de los fixtures financieros.
      const where = { tenantId: { in: tenants } };
      await prisma.cobroImputacion.deleteMany({ where });
      await prisma.movimientoFondos.deleteMany({ where });
      await prisma.cobro.deleteMany({ where });
      await prisma.comprobante.deleteMany({ where });
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  });

  function http(
    method: 'get' | 'post' | 'patch' | 'delete',
    ruta: string,
    actor = 'gestor',
  ) {
    return request(app.getHttpServer())
      [method](`/administracion/${ruta}`)
      .auth(tokens[actor], { type: 'bearer' })
      .set('x-tenant-id', tenants[1]);
  }
  const metodoPayload = (cuentaDestinoId = cuentas[0][0]) => ({
    nombre: 'Método nuevo',
    tipo: 'efectivo',
    comisionPct: 0,
    ivaComisionPct: 0,
    plazoAcreditacionDias: 0,
    sufreRetencion: false,
    cuentaDestinoId,
  });
  async function saldos() {
    const rows = await prisma.cuentaFondos.findMany({
      where: { tenantId: { in: tenants } },
      orderBy: { id: 'asc' },
      select: { id: true, saldo: true },
    });
    return rows.map((r) => ({ id: r.id, saldo: Number(r.saldo) }));
  }

  it.each(['cuentas', 'metodos-pago', 'configuracion-fiscal'])(
    '%s requiere sesión, permiso y devuelve sólo su empresa',
    async (ruta) => {
      await request(app.getHttpServer())
        .get(`/administracion/${ruta}`)
        .expect(401);
      await http('get', ruta, 'sin-permisos').expect(403);
      const res = await http('get', ruta, 'lector').expect(200);
      for (const id of [...cuentas[1], metodos[1], puntos[1]])
        expect(JSON.stringify(res.body)).not.toContain(id);
      expect(JSON.stringify(res.body)).toContain(
        ruta === 'cuentas'
          ? cuentas[0][0]
          : ruta === 'metodos-pago'
            ? metodos[0]
            : puntos[0],
      );
    },
  );

  it('impide las escrituras de un lector antes de acceder al servicio', async () => {
    const antes = await saldos();
    for (const [method, ruta] of [
      ['post', 'cuentas'],
      ['patch', `cuentas/${cuentas[0][0]}`],
      ['post', 'cuentas/transferencias'],
      ['post', `cuentas/${cuentas[0][0]}/arqueo`],
      ['post', 'metodos-pago'],
      ['patch', `metodos-pago/${metodos[0]}/toggle`],
      ['post', 'puntos-venta'],
      ['delete', `puntos-venta/${puntos[0]}`],
      ['post', `cobros/${cobros[0]}/imputaciones`],
      ['post', `cobros/${cobros[0]}/acreditar`],
    ] as const)
      await http(method, ruta, 'lector').send({}).expect(403);
    expect(await saldos()).toEqual(antes);
  });

  it('rechaza lectura y edición de cuentas y métodos de otra empresa', async () => {
    await http('get', `cuentas/${cuentas[1][0]}/movimientos`).expect(404);
    await http('patch', `cuentas/${cuentas[1][0]}`)
      .send({ nombre: 'No aplicar' })
      .expect(404);
    await http('patch', `metodos-pago/${metodos[1]}`)
      .send(metodoPayload())
      .expect(404);
    await http('patch', `metodos-pago/${metodos[1]}/toggle`)
      .send({})
      .expect(404);
    await http('patch', `puntos-venta/${puntos[1]}`)
      .send({ numero: 2, nombre: 'No aplicar', modalidad: 'talonario' })
      .expect(404);
    await http('delete', `puntos-venta/${puntos[1]}`).expect(404);
    expect(
      (
        await prisma.cuentaFondos.findUniqueOrThrow({
          where: { id: cuentas[1][0] },
        })
      ).nombre,
    ).toBe('Caja ficticia 1');
    expect(
      (await prisma.metodoPago.findUniqueOrThrow({ where: { id: metodos[1] } }))
        .activo,
    ).toBe(true);
    expect(
      (await prisma.puntoVenta.findUniqueOrThrow({ where: { id: puntos[1] } }))
        .numero,
    ).toBe(1);
  });

  it('rechaza enlazar cuentas ajenas sin altas ni ediciones parciales', async () => {
    const before = await prisma.metodoPago.count({
      where: { tenantId: tenants[0] },
    });
    await http('post', 'metodos-pago')
      .send(metodoPayload(cuentas[1][0]))
      .expect(400);
    await http('patch', `metodos-pago/${metodos[0]}`)
      .send(metodoPayload(cuentas[1][0]))
      .expect(400);
    expect(
      await prisma.metodoPago.count({ where: { tenantId: tenants[0] } }),
    ).toBe(before);
    expect(
      (await prisma.metodoPago.findUniqueOrThrow({ where: { id: metodos[0] } }))
        .cuentaDestinoId,
    ).toBe(cuentas[0][0]);
  });

  it('rechaza transferencias en ambos sentidos y arqueo sobre cuenta ajena sin mover fondos', async () => {
    const antes = await saldos();
    for (const [desdeCuentaId, haciaCuentaId] of [
      [cuentas[0][0], cuentas[1][0]],
      [cuentas[1][0], cuentas[0][0]],
    ]) {
      await http('post', 'cuentas/transferencias')
        .send({ desdeCuentaId, haciaCuentaId, monto: 25 })
        .expect(404);
    }
    await http('post', `cuentas/${cuentas[1][0]}/arqueo`)
      .send({ contado: 999 })
      .expect(404);
    expect(await saldos()).toEqual(antes);
    expect(
      await prisma.movimientoFondos.count({
        where: { tenantId: { in: tenants } },
      }),
    ).toBe(0);
  });

  it('rechaza imputaciones a cobro o comprobante ajeno sin modificar saldos', async () => {
    await http('post', `cobros/${cobros[1]}/imputaciones`)
      .send({ comprobanteId: comprobantes[0], monto: 25 })
      .expect(404);
    await http('post', `cobros/${cobros[0]}/imputaciones`)
      .send({ comprobanteId: comprobantes[1], monto: 25 })
      .expect(404);
    expect(
      await prisma.cobroImputacion.count({
        where: { tenantId: { in: tenants } },
      }),
    ).toBe(0);
    const rows = await prisma.comprobante.findMany({
      where: { id: { in: comprobantes } },
    });
    expect(rows.map((r) => Number(r.saldoPendiente))).toEqual([100, 100]);
  });

  it('permite transferencia propia idempotente, sin afectar la empresa ajena', async () => {
    const body = {
      desdeCuentaId: cuentas[0][0],
      haciaCuentaId: cuentas[0][1],
      monto: 25,
      idempotencyKey: randomUUID(),
    };
    const primero = await http('post', 'cuentas/transferencias')
      .send(body)
      .expect(201);
    const repetido = await http('post', 'cuentas/transferencias')
      .send(body)
      .expect(201);
    const primeraOperacion = (primero.body as { operacionId: string })
      .operacionId;
    expect(primeraOperacion).toMatch(/^[a-f0-9-]{36}$/);
    expect((repetido.body as { operacionId: string }).operacionId).toBe(
      primeraOperacion,
    );
    const values = new Map((await saldos()).map((r) => [r.id, r.saldo]));
    expect(cuentas[0].map((id) => values.get(id))).toEqual([75, 125]);
    expect(cuentas[1].map((id) => values.get(id))).toEqual([100, 100]);
    expect(
      await prisma.movimientoFondos.count({ where: { tenantId: tenants[0] } }),
    ).toBe(2);
    expect(
      await prisma.movimientoFondos.count({ where: { tenantId: tenants[1] } }),
    ).toBe(0);
  });

  it('permite imputación propia y rechaza borrado ajeno y tenantId inyectado', async () => {
    const propia = await http('post', `cobros/${cobros[0]}/imputaciones`)
      .send({ comprobanteId: comprobantes[0], monto: 25 })
      .expect(201);
    expect(
      Number(
        (
          await prisma.comprobante.findUniqueOrThrow({
            where: { id: comprobantes[0] },
          })
        ).saldoPendiente,
      ),
    ).toBe(75);
    const ajena = await prisma.cobroImputacion.create({
      data: {
        tenantId: tenants[1],
        cobroId: cobros[1],
        comprobanteId: comprobantes[1],
        monto: 10,
      },
    });
    await http('delete', `imputaciones/${ajena.id}`).expect(404);
    expect(
      await prisma.cobroImputacion.findUnique({ where: { id: ajena.id } }),
    ).not.toBeNull();
    await http(
      'delete',
      `imputaciones/${(propia.body as { id: string }).id}`,
    ).expect(200);
    expect(
      Number(
        (
          await prisma.comprobante.findUniqueOrThrow({
            where: { id: comprobantes[0] },
          })
        ).saldoPendiente,
      ),
    ).toBe(100);
    const before = await prisma.cuentaFondos.count({
      where: { tenantId: tenants[0] },
    });
    await http('post', 'cuentas')
      .send({ tipo: 'caja', nombre: 'No aplicar', tenantId: tenants[1] })
      .expect(400);
    expect(
      await prisma.cuentaFondos.count({ where: { tenantId: tenants[0] } }),
    ).toBe(before);
    expect(ajenoNoInvocado).not.toHaveBeenCalled();
  });
  it('un vendedor sólo recibe su cuenta, sus totales y destinos sin saldos', async () => {
    const res = await http('get', 'tesoreria', 'cajero').expect(200);
    expect(res.body.accesoRestringido).toBe(true);
    expect(res.body.cuentas.map((c: { id: string }) => c.id)).toEqual([cuentas[0][0]]);
    expect(res.body.kpis.posicionLocal).toBe(Number(res.body.cuentas[0].saldo));
    expect(JSON.stringify(res.body)).not.toContain(cuentas[0][1]);
    const selector = await http('get', 'cuentas', 'cajero').expect(200);
    expect(selector.body.map((c: {id: string}) => c.id)).toEqual([cuentas[0][0]]);
    const destinos = await http('get', 'cuentas/destinos-transferencia', 'cajero').expect(200);
    expect(destinos.body).toEqual([{ id: cuentas[0][1], nombre: 'Caja ficticia 2', moneda: 'ARS' }]);
  });

  it('el destino no permite consultar movimientos, arquear, ajustar, configurar ni transferir en sentido inverso', async () => {
    const antes = await saldos();
    await http('get', `cuentas/${cuentas[0][1]}/movimientos`, 'cajero').expect(403);
    await http('get', `cuentas/${cuentas[1][0]}/movimientos`, 'cajero').expect(403);
    await http('post', `cuentas/${cuentas[0][1]}/arqueo`, 'cajero').send({ contado: 100 }).expect(403);
    await http('post', `cuentas/${cuentas[0][0]}/ajustes`, 'cajero').send({}).expect(403);
    await http('patch', `cuentas/${cuentas[0][0]}`, 'cajero').send({ nombre: 'No cambiar' }).expect(403);
    await http('post', 'cuentas/transferencias', 'cajero').send({ desdeCuentaId: cuentas[0][1], haciaCuentaId: cuentas[0][0], monto: 5 }).expect(403);
    await http('post', 'cuentas/transferencias', 'cajero').send({ desdeCuentaId: cuentas[0][0], haciaCuentaId: cuentas[1][0], monto: 5 }).expect(403);
    expect(await saldos()).toEqual(antes);
  });

  it('registra un arqueo exacto una sola vez y conserva el contado y responsable', async () => {
    const saldo = Number((await prisma.cuentaFondos.findUniqueOrThrow({ where: { id: cuentas[0][0] } })).saldo);
    const clave = randomUUID();
    const payload = { contado: saldo, notas: 'Cierre ficticio', idempotencyKey: clave };
    const a = await http('post', `cuentas/${cuentas[0][0]}/arqueo`, 'cajero').send(payload).expect(201);
    const b = await http('post', `cuentas/${cuentas[0][0]}/arqueo`, 'cajero').send(payload).expect(201);
    expect(a.body.id).toBe(b.body.id);
    expect(b.body.idempotente).toBe(true);
    const registros = await http('get', `cuentas/${cuentas[0][0]}/arqueos`, 'cajero').expect(200);
    expect(registros.body.filter((r: {id: string}) => r.id === a.body.id)).toHaveLength(1);
    expect(registros.body[0].detalleJson).toMatchObject({ esperado: saldo, contado: saldo, diferencia: 0 });
    expect(registros.body[0].actorNombre).toBeTruthy();
    await http('post', `cuentas/${cuentas[0][0]}/arqueo`, 'cajero').send({ ...payload, contado: saldo + 1 }).expect(409);
  });

  it('registra diferencia una sola vez y transfiere sólo desde el origen autorizado', async () => {
    const saldo = Number((await prisma.cuentaFondos.findUniqueOrThrow({ where: { id: cuentas[0][0] } })).saldo);
    const payload = { contado: saldo + 10, idempotencyKey: randomUUID() };
    await http('post', `cuentas/${cuentas[0][0]}/arqueo`, 'cajero').send(payload).expect(201);
    await http('post', `cuentas/${cuentas[0][0]}/arqueo`, 'cajero').send(payload).expect(201);
    expect(Number((await prisma.cuentaFondos.findUniqueOrThrow({ where: { id: cuentas[0][0] } })).saldo)).toBe(saldo + 10);
    const mov = { desdeCuentaId: cuentas[0][0], haciaCuentaId: cuentas[0][1], monto: 5, idempotencyKey: randomUUID() };
    const a = await http('post', 'cuentas/transferencias', 'cajero').send(mov).expect(201);
    const b = await http('post', 'cuentas/transferencias', 'cajero').send(mov).expect(201);
    expect(a.body.operacionId).toBe(b.body.operacionId);
    expect(Number((await prisma.cuentaFondos.findUniqueOrThrow({ where: { id: cuentas[0][0] } })).saldo)).toBe(saldo + 5);
  });

  it('un reintento simultáneo de arqueo no duplica el conteo ni el ajuste', async () => {
    const cuenta = await prisma.cuentaFondos.findUniqueOrThrow({where:{id:cuentas[0][0]}});
    const payload = {contado:Number(cuenta.saldo)+3,idempotencyKey:randomUUID(),notas:'Conteo simultáneo ficticio'};
    const resultados = await Promise.all([1,2].map(()=>http('post',`cuentas/${cuenta.id}/arqueo`,'cajero').send(payload)));
    expect(resultados.map(r=>r.status)).toEqual([201,201]);
    expect(resultados[0].body.id).toBe(resultados[1].body.id);
    expect(await prisma.cuentaFondosEvento.count({where:{tenantId:tenants[0],idempotencyKey:payload.idempotencyKey}})).toBe(1);
    expect(await prisma.movimientoFondos.count({where:{tenantId:tenants[0],idempotencyKey:payload.idempotencyKey}})).toBe(1);
    expect(Number((await prisma.cuentaFondos.findUniqueOrThrow({where:{id:cuenta.id}})).saldo)).toBe(payload.contado);
  });
  it('rechaza reutilizar una clave de transferencia para un importe distinto', async () => {
    const payload={desdeCuentaId:cuentas[0][0],haciaCuentaId:cuentas[0][1],monto:1,idempotencyKey:randomUUID()};
    await http('post','cuentas/transferencias','cajero').send(payload).expect(201);
    await http('post','cuentas/transferencias','cajero').send({...payload,monto:8}).expect(409);
  });
  it('sólo quien administra usuarios asigna cuentas, y nunca de otra empresa', async () => {
    const miembro=await prisma.membership.findFirstOrThrow({where:{tenantId:tenants[0],rolDelTenant:{nombre:'cajero'}}});
    const ruta=`/usuarios/${miembro.userId}/cuentas`;
    const body={restringidas:true,operables:[cuentas[0][0]],destinos:[cuentas[0][1]]};
    await request(app.getHttpServer()).put(ruta).set('Authorization',`Bearer ${tokens.cajero}`).send(body).expect(403);
    await request(app.getHttpServer()).put(ruta).set('Authorization',`Bearer ${tokens.gestor}`).send({...body,destinos:[cuentas[1][0]]}).expect(400);
    expect((await prisma.membership.findUniqueOrThrow({where:{id:miembro.id}})).cuentasDestinoIds).toEqual([cuentas[0][1]]);
    await request(app.getHttpServer()).put(ruta).set('Authorization',`Bearer ${tokens.gestor}`).send(body).expect(200);
    expect(await prisma.eventoAcceso.count({where:{tenantId:tenants[0],usuarioAfectadoId:miembro.userId,tipo:'cuentas_asignadas'}})).toBe(1);
  });
  it('revocar las cuentas toma efecto en la misma sesión y una lista vacía no abre todo', async () => {
    const miembro = await prisma.membership.findFirstOrThrow({ where: { tenantId: tenants[0], rolDelTenant: { nombre: 'cajero' } } });
    await prisma.membership.update({ where: { id: miembro.id }, data: { cuentasOperablesIds: [], cuentasDestinoIds: [] } });
    const r = await http('get', 'tesoreria', 'cajero').expect(200);
    expect(r.body.cuentas).toEqual([]);
    expect(r.body.kpis.posicionLocal).toBe(0);
    await http('get', `cuentas/${cuentas[0][0]}/movimientos`, 'cajero').expect(403);
    await http('post', `cuentas/${cuentas[0][0]}/arqueo`, 'cajero').send({ contado: 10 }).expect(403);
  });

});
