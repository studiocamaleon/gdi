import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContextInterceptor } from '../../../common/interceptors/tenant-context.interceptor';
import { AuthGuard } from '../../../auth/auth.guard';
import { RolesGuard } from '../../../auth/roles.guard';
import { PermisosGuard } from '../../../auth/permisos.guard';
import type { CurrentAuth } from '../../../auth/auth.types';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import { CentroCopiadoAuditoriaService } from '../../centro-copiado-auditoria.service';
import { CentroCopiadoPoliticaService } from '../../tarifarios/centro-copiado-politica.service';
import { CentroCopiadoPoliticaController } from '../../tarifarios/centro-copiado-politica.controller';
import { CentroCopiadoTarifariosService } from '../../tarifarios/centro-copiado-tarifarios.service';
import { politicaPreciosInicial } from '../../tarifarios/politica-precios';
import { contenidoEjemplo } from '../../tarifarios/__tests__/fixtures';
import { CentroCopiadoPedidosService } from '../centro-copiado-pedidos.service';
import { CentroCopiadoEmisionService } from '../centro-copiado-emision.service';
import { CentroCopiadoPedidosController } from '../centro-copiado-pedidos.controller';
import type { AgregarAOrdenCentroCopiadoDto } from '../../dto/cotizar-centro-copiado.dto';

/** Base real, auth/guards reales, cálculo comercial real. El costeador de máquina
 * devuelve un costo ficticio determinista; no se usa catálogo ni archivos reales. */
describe('Pedidos de copiado: activación, precios y autorización', () => {
  const db = new PrismaService();
  const auditoria = new CentroCopiadoAuditoriaService(db);
  const politica = new CentroCopiadoPoliticaService(db, auditoria);
  const tarifas = new CentroCopiadoTarifariosService(db, auditoria);
  const emision = new CentroCopiadoEmisionService(db, politica);
  const tenants = [randomUUID(), randomUUID()],
    papel = randomUUID(),
    categoria = randomUUID(),
    sub = randomUUID();
  const producto = randomUUID(),
    usuarios: string[] = [];
  const secretAntes = process.env.JWT_SECRET,
    secret = randomUUID();
  const jwt = new JwtService({ secret });
  const tokens: Record<string, string> = {};
  const auths: Record<string, CurrentAuth> = {};
  let app: INestApplication<Server>,
    seguro = false;
  let costo = 90;
  let cobraSetup = true;
  const desglose = () => ({
    precioNetoTotal: 150,
    precioBrutoTotal: 181.5,
    impuestos: [
      {
        catalogoId: 'iva-demo',
        nombre: 'IVA',
        porcentaje: 21,
        traslado: 'POR_FUERA',
        baseCalculo: 'NETO',
      },
    ],
    comisiones: [],
    precioConfig: { metodoCalculo: 'MARGEN' },
    precioEspecialCliente: null,
  });
  const costeador = {
    construirItems: jest.fn(
      (_tenant: string, dto: AgregarAOrdenCentroCopiadoDto) =>
        Promise.resolve({
          items: dto.documentos.map((d) => ({
            productoId: producto,
            cantidad: Math.ceil(d.paginas / d.faz) * d.copias,
            jobContext: {
              cantidad: Math.ceil(d.paginas / d.faz) * d.copias,
              caras: d.faz,
              omitirSetupCleanup: !cobraSetup,
              ...(d.archivoBytes
                ? { maquinaSeleccionada_demo: 'laser-ficticia' }
                : {}),
            },
            subtotal: 150,
            total: 181.5,
            impuestoMonto: 31.5,
            error: null,
            cotizacion: {
              costos: { total: costo },
              desglosePrecio: desglose(),
            },
          })),
        }),
    ),
    simularCostoHojas: jest.fn(
      (_tenant: string, _doc: unknown, opciones?: { preparar?: boolean }) => {
        const tiempo =
          !cobraSetup || opciones?.preparar === false
            ? 0
            : Math.max(0, costo - 10);
        return Promise.resolve([
          {
            exitoso: true,
            cotizacion: {
              costos: {
                total: tiempo + 10,
                unitario: tiempo + 10,
                materialesTotal: 10,
                tiempoTotal: tiempo,
              },
              pasos: [
                {
                  rutaPasoOrden: 0,
                  familiaCodigo: 'impresion_laser',
                  costoTotal: tiempo + 10,
                  tiempo: {
                    setupMin: tiempo ? 3 : 0,
                    totalMin: tiempo ? 4 : 1,
                    costo: tiempo,
                  },
                },
              ],
            },
          },
        ]);
      },
    ),
  };
  const pedidos = new CentroCopiadoPedidosService(
    db,
    politica,
    costeador as never,
    {} as never,
    auditoria,
    { usaTipoCambio: false } as never,
    emision,
  );
  const ruta = '/centro-copiado/pedidos';
  async function fuente(tenantId = tenants[0]) {
    const c = await db.cotizacion.create({ data: { tenantId } });
    const p =
      tenantId === tenants[0]
        ? producto
        : (
            await db.producto.create({
              data: {
                tenantId,
                codigo: `SYS-${randomUUID()}`,
                nombre: 'Impresión ficticia',
                subcategoriaComercialId: sub,
              },
            })
          ).id;
    return db.cotizacionItem.create({
      data: {
        tenantId,
        cotizacionId: c.id,
        productoId: p,
        cantidad: 1,
        precioNetoTotal: 150,
        impuestosPorFueraTotal: 31.5,
        precioTotal: 181.5,
        costoTotal: 90,
        jobContextJson: {
          cantidad: 1,
          caras: 2,
          omitirSetupCleanup: !cobraSetup,
          _centroCopiado: {
            esTomo: false,
            paginas: 2,
            copias: 1,
            tamano: 'A4',
            tamanoAnchoMm: 210,
            tamanoAltoMm: 297,
            papelMateriaPrimaId: papel,
            gramaje: 80,
            color: 'BN',
            faz: 2,
            cobertura: 'alta',
            terminaciones: [],
          },
        },
        snapshotJson: { producto: { codigo: 'SYS-IMPRESION-DOC' } },
      },
    });
  }
  async function fuentePdf() {
    const f = await fuente();
    const job = f.jobContextJson as Record<string, unknown>;
    return db.cotizacionItem.update({
      where: { id: f.id },
      data: {
        jobContextJson: {
          ...job,
          maquinaSeleccionada_demo: 'laser-ficticia',
          _centroCopiado: {
            ...(job._centroCopiado as Record<string, string | number>),
            archivoNombre: 'Prueba.pdf',
            archivoBytes: 1000,
            paginasOriginales: 2,
          },
        } as never,
      },
    });
  }
  async function activar(
    anteInsuficiente: 'AUTORIZACION' | 'BLOQUEO' = 'AUTORIZACION',
    pendiente = false,
  ) {
    const contenido = contenidoEjemplo(papel);
    contenido.cad = null;
    contenido.margen = { minimoPorcentaje: '25', anteInsuficiente };
    contenido.hojas!.filas[0].precios = [
      { desdeCantidad: 1, precioUnitario: pendiente ? null : '121' },
      { desdeCantidad: 100, precioUnitario: '96.8' },
    ];
    const b = await tarifas.crear(tenants[0], usuarios[0], {
      nombre: 'Tarifa ficticia',
      contenido,
    });
    await tarifas.publicar(tenants[0], b.id, usuarios[0], {
      revision: b.revision,
      tipoVigencia: 'INMEDIATA',
    });
    const prev = await politica.obtenerBorrador(tenants[0]);
    const pol = await politica.guardarBorrador(tenants[0], usuarios[0], {
      revision: prev.revision,
      contenido: {
        ...politicaPreciosInicial(),
        general: { modalidad: 'TARIFARIO', tarifarioId: b.id },
      },
    });
    await politica.activar(tenants[0], usuarios[0], pol.revision);
    return b;
  }
  const revisar = async (items: string[], actor = 'vendedor') => {
    const r = await request(app.getHttpServer())
      .post(`${ruta}/revisar`)
      .auth(tokens[actor], { type: 'bearer' })
      .send({ items, canalVenta: 'mostrador', tratamientoFiscal: 'FISCAL' });
    return {
      status: r.status,
      body: r.body as {
        modalidad: 'TARIFARIO' | 'MOTOR';
        id: string;
        huella: string;
        calculado: { estado: string; control: { estado: string } };
        items: {
          id: string;
          subtotal: number;
          total: number;
          finanzas?: { costoTotal: number };
          tandaImpresion?: { id: string; prepara: boolean };
        }[];
      },
    };
  };
  async function emitir(ids: string[], cambios: Record<string, unknown> = {}) {
    const items = await db.cotizacionItem.findMany({
      where: { tenantId: tenants[0], id: { in: ids } },
    });
    return db.$transaction((tx) =>
      emision.exigirEmitibleTx(tx, auths.vendedor, {
        canalVenta: 'mostrador',
        clienteId: null,
        items: items.map((i) => ({
          cotizacionItemId: i.id,
          subtotal: i.precioNetoTotal!,
          total: i.precioTotal!,
        })),
        ...cambios,
      }),
    );
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Sólo base local desechable de test.');
    seguro = true;
    process.env.JWT_SECRET = secret;
    await db.$connect();
    for (const id of tenants)
      await db.tenant.create({
        data: { id, slug: `cc-pedidos-${id}`, nombre: 'Empresa ficticia' },
      });
    await db.productoCategoriaComercial.create({
      data: {
        id: categoria,
        codigo: `qa-${categoria}`,
        nombre: 'Categoría ficticia',
      },
    });
    await db.productoSubcategoriaComercial.create({
      data: {
        id: sub,
        categoriaId: categoria,
        codigo: `qa-${sub}`,
        nombre: 'Subcategoría ficticia',
        atributosSchemaJson: [],
      },
    });
    await db.producto.create({
      data: {
        id: producto,
        tenantId: tenants[0],
        codigo: 'SYS-IMPRESION-DOC',
        nombre: 'Impresión ficticia',
        subcategoriaComercialId: sub,
      },
    });
    await db.productoImpuestoCatalogo.create({
      data: {
        tenantId: tenants[0],
        codigo: 'IVA-FICTICIO',
        nombre: 'IVA ficticio',
        porcentaje: 21,
        traslado: 'POR_FUERA',
        baseCalculo: 'NETO',
        categoriaFiscal: 'general',
      },
    });
    await db.materiaPrima.create({
      data: {
        id: papel,
        tenantId: tenants[0],
        codigo: 'PAPEL-DEMO',
        nombre: 'Papel ficticio',
        familia: 'SUSTRATO',
        subfamilia: 'SUSTRATO_HOJA',
        tipoTecnico: 'PAPEL',
        templateId: 'ficticio',
        unidadStock: 'HOJA',
        unidadCompra: 'RESMA',
        atributosTecnicosJson: {},
      },
    });
    for (const [actor, permisos] of [
      ['vendedor', ['comercial.copiado.gestionar']],
      [
        'responsable',
        [
          'comercial.copiado.gestionar',
          'finanzas.ver_margenes',
          'comercial.aprobar_descuento',
        ],
      ],
      ['solo-firma', ['comercial.copiado.ver', 'comercial.aprobar_descuento']],
      ['lector', ['comercial.copiado.ver']],
    ] as const) {
      const u = await db.user.create({
        data: {
          email: `cc-pedido-${randomUUID()}@example.invalid`,
          nombreCompleto: 'Persona ficticia',
        },
      });
      usuarios.push(u.id);
      const rol = await db.rol.create({
        data: { tenantId: tenants[0], nombre: actor, permisos: [...permisos] },
      });
      const m = await db.membership.create({
        data: {
          tenantId: tenants[0],
          userId: u.id,
          rol: 'OPERADOR',
          rolId: rol.id,
        },
      });
      const ss = await db.authSession.create({
        data: {
          userId: u.id,
          currentTenantId: tenants[0],
          currentMembershipId: m.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      tokens[actor] = jwt.sign({
        sub: u.id,
        email: u.email,
        sessionId: ss.id,
        tenantId: tenants[0],
        membershipId: m.id,
        role: 'OPERADOR',
      });
      auths[actor] = {
        userId: u.id,
        email: u.email,
        sessionId: ss.id,
        tenantId: tenants[0],
        membershipId: m.id,
        role: 'OPERADOR',
        permisos: new Set(permisos),
      };
    }
    const module = await Test.createTestingModule({
      controllers: [
        CentroCopiadoPedidosController,
        CentroCopiadoPoliticaController,
      ],
      providers: [
        { provide: CentroCopiadoPedidosService, useValue: pedidos },
        { provide: CentroCopiadoPoliticaService, useValue: politica },
        {
          provide: CapacidadesEmpresaService,
          useValue: {
            exigirIncluida: async () => {},
            exigirTodas: async () => {},
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, db),
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
    if (secretAntes === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretAntes;
    if (seguro) {
      await db.tenant.deleteMany({ where: { id: { in: tenants } } });
      await db.user.deleteMany({ where: { id: { in: usuarios } } });
      await db.productoSubcategoriaComercial.deleteMany({ where: { id: sub } });
      await db.productoCategoriaComercial.deleteMany({
        where: { id: categoria },
      });
    }
    await db.$disconnect();
  });
  beforeEach(() => {
    costo = 90;
    cobraSetup = true;
  });
  it('sin activación conserva el motor; guardar política no la activa', async () => {
    const i = await fuente();
    expect((await revisar([i.id])).body).toEqual({ modalidad: 'MOTOR' });
    await emitir([i.id]);
  });
  it.each([true, false])(
    'en motor respeta setup=%s, conserva precios y rechaza emitir una tanda incompleta',
    async (actual) => {
      cobraSetup = !actual;
      const a = await fuentePdf(),
        b = await fuentePdf();
      cobraSetup = actual;
      const r = await revisar([a.id, b.id], 'responsable');
      expect(r.status).toBe(201);
      expect(r.body.modalidad).toBe('MOTOR');
      expect(r.body.items[0]).toMatchObject({ finanzas: { cargas: [] } });
      expect(r.body.items.map((i) => i.total)).toEqual([181.5, 181.5]);
      expect(
        r.body.items.reduce((s, i) => s + (i.finanzas?.costoTotal ?? NaN), 0),
      ).toBe(actual ? 100 : 20);
      const guardados = await db.cotizacionItem.findMany({
        where: { id: { in: r.body.items.map((i) => i.id) } },
      });
      expect(guardados).toHaveLength(2);
      for (const guardado of guardados) {
        expect(guardado.jobContextJson).toMatchObject({
          omitirSetupCleanup: !actual,
        });
      }
      await emitir(r.body.items.map((i: { id: string }) => i.id));
      await expect(emitir([r.body.items[0].id])).rejects.toThrow('tanda');
    },
  );
  it('un lector no recalcula y una sesión no puede leer trabajos de otra empresa', async () => {
    const a = await fuente(),
      b = await fuente(tenants[1]);
    expect((await revisar([a.id], 'lector')).status).toBe(403);
    expect((await revisar([b.id])).status).toBe(404);
  });
  it('activa precios; no filtra costos y ni el supervisor emite sin autorización expresa', async () => {
    await activar();
    const fuenteOriginal = await fuente();
    const r = await revisar([fuenteOriginal.id]);
    expect(r.status).toBe(201);
    expect(r.body.calculado.control).toEqual({
      estado: 'REQUIERE_AUTORIZACION',
    });
    expect(JSON.stringify(r.body)).not.toMatch(
      /costoImpresion|cargasTotal|lineas/,
    );
    expect(r.body.items[0].subtotal).toBe(100);
    await expect(
      emitir(r.body.items.map((i: { id: string }) => i.id)),
    ).rejects.toThrow('autorización explícita');
    expect(
      Number(
        (
          await db.cotizacionItem.findUniqueOrThrow({
            where: { id: fuenteOriginal.id },
          })
        ).precioNetoTotal,
      ),
    ).toBe(150);
    expect(
      (
        await request(app.getHttpServer())
          .post(`${ruta}/${r.body.id}/autorizar-margen`)
          .auth(tokens.vendedor, { type: 'bearer' })
          .send({ huella: r.body.huella, motivo: 'Acuerdo comercial ficticio' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post(`${ruta}/${r.body.id}/autorizar-margen`)
          .auth(tokens['solo-firma'], { type: 'bearer' })
          .send({ huella: r.body.huella, motivo: 'Acuerdo comercial ficticio' })
      ).status,
    ).toBe(403);
    await request(app.getHttpServer())
      .post(`${ruta}/${r.body.id}/autorizar-margen`)
      .auth(tokens.responsable, { type: 'bearer' })
      .send({ huella: r.body.huella, motivo: 'Acuerdo comercial ficticio' })
      .expect(201);
    await emitir(r.body.items.map((i: { id: string }) => i.id));
    await expect(
      emitir(
        r.body.items.map((i: { id: string }) => i.id),
        { canalVenta: 'web' },
      ),
    ).rejects.toThrow('canal');
    expect(
      await db.centroCopiadoEvento.count({
        where: { tenantId: tenants[0], tipo: 'PEDIDO_MARGEN_AUTORIZADO' },
      }),
    ).toBeGreaterThan(0);
  });
  it.each([false, true])(
    'recotiza una carga existente con setup=%s según la configuración actual, no el flag guardado',
    async (actual) => {
      await activar();
      cobraSetup = !actual;
      const original = await fuentePdf();
      cobraSetup = actual;
      const r = await revisar([original.id], 'responsable');
      expect(r.status).toBe(201);
      expect(r.body.calculado.control).toMatchObject({
        estado: actual ? 'REQUIERE_AUTORIZACION' : 'CUMPLE',
        porcentaje: actual ? '10.00' : '90.00',
      });
      const guardado = await db.cotizacionItem.findUniqueOrThrow({
        where: { id: r.body.items[0].id },
      });
      expect(Number(guardado.costoTotal)).toBe(actual ? 90 : 10);
      expect(Number(guardado.precioTotal)).toBe(121);
      expect(guardado.jobContextJson).toMatchObject({
        omitirSetupCleanup: !actual,
      });
      expect(
        (guardado.snapshotJson as { ejecucion: { costos: { total: number } } })
          .ejecucion.costos.total,
      ).toBe(actual ? 90 : 10);
      expect(
        (
          guardado.trazabilidadJson as {
            pasos: { tiempo: { setupMin: number } }[];
          }
        ).pasos[0].tiempo.setupMin,
      ).toBe(actual ? 3 : 0);
      const reabierto = await revisar([guardado.id], 'responsable');
      expect(reabierto.status).toBe(201);
      expect(reabierto.body.calculado.control).toEqual(
        r.body.calculado.control,
      );
    },
  );
  it('dos PDF de cargas distintas usan una preparación: precio, margen, detalle y reapertura concuerdan', async () => {
    await activar();
    const a = await fuentePdf(),
      b = await fuentePdf();
    const r = await revisar([a.id, b.id], 'responsable');
    expect(r.status).toBe(201);
    expect(r.body.calculado.control).toMatchObject({
      estado: 'CUMPLE',
      porcentaje: '50.00',
    });
    expect(r.body.items.map((i) => i.total)).toEqual([121, 121]);
    expect(new Set(r.body.items.map((i) => i.tandaImpresion?.id)).size).toBe(1);
    expect(r.body.items.filter((i) => i.tandaImpresion?.prepara)).toHaveLength(
      1,
    );
    const guardados = await db.cotizacionItem.findMany({
      where: { id: { in: r.body.items.map((i: { id: string }) => i.id) } },
    });
    expect(guardados.reduce((s, i) => s + Number(i.costoTotal), 0)).toBe(100);
    expect(
      guardados.reduce(
        (s, i) =>
          s +
          Number(
            (i.snapshotJson as { ejecucion: { costos: { total: number } } })
              .ejecucion.costos.total,
          ),
        0,
      ),
    ).toBe(100);
    expect(
      guardados
        .flatMap(
          (i) =>
            (
              i.trazabilidadJson as {
                pasos: { tiempo: { setupMin: number } }[];
              }
            ).pasos,
        )
        .reduce((s, p) => s + p.tiempo.setupMin, 0),
    ).toBe(3);
    await emitir(guardados.map((i) => i.id));
    await expect(emitir([guardados[0].id])).rejects.toThrow(
      'cálculo de copiado cambió',
    );
    const individual = await revisar([guardados[0].id], 'responsable');
    expect(individual.body.items[0].finanzas?.costoTotal).toBe(90);
    expect(individual.body.calculado.control.estado).toBe(
      'REQUIERE_AUTORIZACION',
    );
  });
  it('recupera la revisión sin filtrar costos y registra descuentos explícitos antes del mínimo', async () => {
    await activar();
    const original = await fuente();
    const r = await pedidos.revisar(auths.responsable, {
      items: [original.id],
      canalVenta: 'mostrador',
      tratamientoFiscal: 'FISCAL',
      descuentos: [
        { cotizacionItemId: original.id, tipo: 'PORCENTAJE', valor: 10 },
      ],
    });
    const revision = r as {
      id: string;
      items: { id: string; subtotal: number }[];
    };
    expect(revision.items[0].subtotal).toBe(90);
    const body = {
      items: revision.items.map((i) => i.id),
      canalVenta: 'mostrador',
      tratamientoFiscal: 'FISCAL',
    };
    const respuesta = await request(app.getHttpServer())
      .post(`${ruta}/estado`)
      .auth(tokens.vendedor, { type: 'bearer' })
      .send(body)
      .expect(201);
    expect(respuesta.body).toMatchObject({
      vigente: true,
      revision: { id: revision.id },
    });
    expect(JSON.stringify(respuesta.body)).not.toMatch(
      /costoTotal|costoImpresion|cargasTotal|lineas/,
    );
    await request(app.getHttpServer())
      .post(`${ruta}/estado`)
      .auth(tokens.vendedor, { type: 'bearer' })
      .send({ ...body, items: [(await fuente(tenants[1])).id] })
      .expect(404);
    await request(app.getHttpServer())
      .post(`${ruta}/${revision.id}/autorizar-margen`)
      .auth(tokens.responsable, { type: 'bearer' })
      .send({ huella: '0'.repeat(64), motivo: 'Una referencia falsificada' })
      .expect(409);
    const cambiada = await request(app.getHttpServer())
      .post(`${ruta}/estado`)
      .auth(tokens.vendedor, { type: 'bearer' })
      .send({ ...body, canalVenta: 'web' })
      .expect(201);
    expect(cambiada.body).toMatchObject({ vigente: false });
  });
  it('no admite autorizar bloqueo estricto ni precio pendiente', async () => {
    await activar('BLOQUEO');
    const r = await revisar([(await fuente()).id], 'responsable');
    expect(r.body.calculado.control.estado).toBe('BLOQUEADO');
    await expect(
      emitir(r.body.items.map((i: { id: string }) => i.id)),
    ).rejects.toThrow('bloquea');
    await request(app.getHttpServer())
      .post(`${ruta}/${r.body.id}/autorizar-margen`)
      .auth(tokens.responsable, { type: 'bearer' })
      .send({ huella: r.body.huella, motivo: 'Excepción que no corresponde' })
      .expect(400);
    await activar('AUTORIZACION', true);
    const p = await revisar([(await fuente()).id]);
    expect(p.body.calculado.estado).toBe('PRECIO_PENDIENTE');
    expect(p.body.id).toBeNull();
  });
  it('no se elude quitando una carga, agregando otra, editando metadata o manipulando un snapshot', async () => {
    await activar();
    const a = await fuente(),
      b = await fuente();
    const r = await revisar([a.id, b.id]);
    expect(r.status).toBe(201);
    const ids = r.body.items.map((i: { id: string }) => i.id);
    await expect(emitir(ids.slice(0, 1))).rejects.toThrow('cálculo');
    await expect(emitir([...ids, (await fuente()).id])).rejects.toThrow(
      'todas las cargas',
    );
    await db.cotizacionItem.update({
      where: { id: ids[0] },
      data: { precioNetoTotal: 1 },
    });
    await expect(emitir(ids)).rejects.toThrow('cálculo');
    const falsificado = await fuente();
    await db.cotizacionItem.update({
      where: { id: falsificado.id },
      data: { cantidad: 100 },
    });
    expect((await revisar([falsificado.id])).status).toBe(400);
  });
  it('publicar otra versión invalida un borrador previamente revisado', async () => {
    const tarifa = await activar();
    costo = 10;
    const r = await revisar([(await fuente()).id]);
    expect(r.status).toBe(201);
    await emitir(r.body.items.map((i: { id: string }) => i.id));
    const b = await tarifas.obtener(tenants[0], tarifa.id);
    await tarifas.publicar(tenants[0], b.id, usuarios[0], {
      revision: b.revision,
      tipoVigencia: 'INMEDIATA',
    });
    await expect(
      emitir(r.body.items.map((i: { id: string }) => i.id)),
    ).rejects.toThrow('versión');
  });
  it('costo desconocido bloquea; el administrador no puede inventar una autorización', async () => {
    await activar();
    costeador.simularCostoHojas.mockRejectedValueOnce(
      new Error('Sin tarifa productiva'),
    );
    const r = await revisar([(await fuente()).id]);
    expect(r.body.calculado.control.estado).toBe('NO_VERIFICABLE');
    await expect(
      emitir(r.body.items.map((i: { id: string }) => i.id)),
    ).rejects.toThrow('costos verificables');
  });
});
