import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermisosGuard } from '../auth/permisos.guard';
import { todosLosPermisos, expandir } from '../auth/permisos';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { TipoCambioService } from '../cotizaciones/tipo-cambio.service';
import { TrabajosMedidaService } from './trabajos-medida.service';
import { TrabajosMedidaController } from './trabajos-medida.controller';
import { TrabajoMedidaDto } from './trabajo-medida.dto';
import type { CurrentAuth } from '../auth/auth.types';
import { capacidadesDePrueba } from '../../test/fixture-capacidades';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import { DatosEmpresaService } from '../tenants/datos-empresa.service';
import { FacturacionOrdenesService } from '../administracion/facturacion-ordenes.service';
import { FidelizacionService } from '../fidelizacion/fidelizacion.service';
import { DesarrolloDocumentalService } from '../desarrollo-documental/desarrollo-documental.service';
import { PresupuestosService } from '../presupuestos/presupuestos.service';
import { RentabilidadService } from '../reportes/rentabilidad.service';
import { renglonesFacturaOrden } from '../administracion/invoicing/items-factura-orden';
import { calcularTotales } from '../administracion/invoicing/totales-comprobante';
import type { CrearOrdenTrabajoDto } from '../ordenes-trabajo/dto/crear-orden-trabajo.dto';

describe('Trabajos a medida: HTTP, órdenes, producción y economía en base aislada', () => {
  const db = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const cambio = new TipoCambioService(db, capacidades);
  const service = new TrabajosMedidaService(db, cambio, capacidades);
  const tenantId = randomUUID(),
    ajenoId = randomUUID(),
    userId = randomUUID();
  const auth = {
    tenantId,
    userId,
    role: 'ADMINISTRADOR',
    email: 'administrador@example.invalid',
    permisos: expandir(todosLosPermisos()),
  } as CurrentAuth;
  const vendedor = { ...auth, permisos: expandir(['comercial.gestionar']) };
  const documentos = new DesarrolloDocumentalService(
    db,
    {} as never,
    {} as never,
    undefined,
    capacidades,
  );
  const ordenes = new OrdenesTrabajoService(
    db,
    { capturarEmision: jest.fn(), sincronizarAsignaciones: jest.fn() } as never,
    {} as never,
    { sincronizar: jest.fn() } as never,
    { emitir: jest.fn() } as never,
    new DatosEmpresaService(db),
    {} as never,
    new FacturacionOrdenesService(db),
    { asegurarParaItem: jest.fn() } as never,
    new FidelizacionService(db, capacidades),
    documentos,
    undefined,
    undefined,
    capacidades,
  );
  jest.spyOn(ordenes, 'findOne').mockImplementation(
    async (a, id) =>
      (await db.ordenTrabajo.findFirstOrThrow({
        where: { id, tenantId: a.tenantId },
        include: {
          items: { include: { cotizacionItem: true, pasos: true } },
        },
      })) as never,
  );
  let app: INestApplication<Server>,
    estacionId: string,
    centroId: string,
    clienteId: string,
    tipoCambioId: string,
    rutaId: string;
  const tokens: Record<string, string> = {};
  const roles: Record<string, string> = {};
  const secretoAnterior = process.env.JWT_SECRET;
  const jwt = new JwtService({
    secret: 'clave-ficticia-solo-para-pruebas-medida',
  });

  async function usuario(
    nombre: string,
    permisos: string[],
    empresa = tenantId,
  ) {
    const rol = await db.rol.create({
      data: { tenantId: empresa, nombre, permisos },
    });
    roles[nombre] = rol.id;
    const membresia = await db.membership.create({
      data: { tenantId: empresa, userId, rolId: rol.id, rol: 'ADMINISTRADOR' },
    });
    const sesion = await db.authSession.create({
      data: {
        userId,
        currentTenantId: empresa,
        currentMembershipId: membresia.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    tokens[nombre] = jwt.sign({
      sub: userId,
      sessionId: sesion.id,
      tenantId: empresa,
      membershipId: membresia.id,
      role: 'ADMINISTRADOR',
      email: auth.email,
    });
  }
  const entrada = (): TrabajoMedidaDto => ({
    nombre: 'Exhibidor de prueba',
    descripcion: 'Proyecto ficticio para validar el circuito',
    cantidad: 3,
    unidad: 'unidad',
    precio: 242000,
    tipoPrecio: 'FINAL',
    basePrecio: 'TOTAL',
    categoriaFiscal: 'general',
    costos: {
      materiales: 80000,
      otros: [{ nombre: 'Traslado', costo: 10000 }],
    },
    produccion: true,
    operaciones: [
      {
        clave: randomUUID(),
        nombre: 'Diseño',
        estacionId,
        familiaCodigo: 'trabajo_manual',
        centroCostoId: centroId,
        horas: 1,
      },
      {
        clave: randomUUID(),
        nombre: 'Armado',
        estacionId,
        familiaCodigo: 'trabajo_manual',
        centroCostoId: centroId,
        horas: 2,
      },
    ],
    tipoCambioId,
    clienteId,
    rutaOrigenId: rutaId,
  });
  async function guardar(dto = entrada()) {
    const previo = await service.calcular(auth, dto);
    return service.guardar(auth, {
      ...dto,
      huellaCalculo: previo.huellaCalculo,
    });
  }
  function payload(
    g: Awaited<ReturnType<typeof guardar>>,
  ): CrearOrdenTrabajoDto {
    return {
      estado: 'pendiente',
      clienteId,
      fechaEntrega: '2099-12-20',
      canalVenta: 'mostrador',
      items: [
        {
          cotizacionItemId: g.cotizacionItemId,
          fechaEntrega: '2099-12-20',
          codigo: 'A-MEDIDA',
          nombre: 'Exhibidor de prueba',
          familia: 'Trabajo a medida',
          categoriaComercial: 'Trabajos a medida',
          cantidad: 3,
          cantidadUnidad: 'u.',
          subtotal: g.resumen.neto,
          impuestos: g.resumen.impuestos,
          total: g.resumen.total,
        },
      ],
    };
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw Error('Requiere una base local de pruebas.');
    process.env.JWT_SECRET = 'clave-ficticia-solo-para-pruebas-medida';
    await db.tenant.createMany({
      data: [tenantId, ajenoId].map((id) => ({
        id,
        slug: `medida-${id}`,
        nombre: 'Empresa ficticia',
      })),
    });
    await db.user.create({
      data: { id: userId, email: `medida-${userId}@example.invalid` },
    });
    await db.datosEmpresa.create({
      data: {
        tenantId,
        monedaCodigo: 'ARS',
        redondeoPrecio: 'moneda',
        tipoCambioConfig: {
          modo: 'manual',
          tasaManual: 1000,
          monedaDestino: 'ARS',
        },
      },
    });
    clienteId = (
      await db.cliente.create({
        data: {
          tenantId,
          nombre: 'Cliente ficticio',
          paisCodigo: 'AR',
          telefonoCodigo: '+54',
          telefonoNumero: '',
        },
      })
    ).id;
    const planta = await db.planta.create({
      data: { tenantId, codigo: 'QA', nombre: 'Taller ficticio' },
    });
    centroId = (
      await db.centroCosto.create({
        data: {
          tenantId,
          plantaId: planta.id,
          codigo: 'ARM',
          nombre: 'Armado de prueba',
          tipoCentro: 'PRODUCTIVO',
        },
      })
    ).id;
    await db.centroCostoTarifaPeriodo.create({
      data: {
        tenantId,
        centroCostoId: centroId,
        periodo: '2020-01',
        estado: 'PUBLICADA',
        tarifaCalculada: 20000,
        capacidadPractica: 100,
        costoMensualTotal: 2000000,
        resumenJson: {},
      },
    });
    await db.productoImpuestoCatalogo.create({
      data: {
        tenantId,
        codigo: 'IVA',
        nombre: 'IVA de prueba',
        porcentaje: 21,
        traslado: 'POR_FUERA',
        alcance: 'PRODUCTO',
        categoriaFiscal: 'general',
      },
    });
    tipoCambioId = (
      await cambio.crear(tenantId, userId, { modo: 'manual', tasa: 1000 })
    ).id;
    estacionId = (
      await db.estacion.create({
        data: {
          tenantId,
          nombre: 'Taller de prueba',
          reglas: {
            create: { tenantId, tipo: 'paso', valor: 'trabajo_manual' },
          },
        },
      })
    ).id;
    rutaId = (
      await db.ruta.create({
        data: {
          tenantId,
          codigo: 'ESPECIAL',
          nombre: 'Ruta ficticia',
          pasos: {
            create: [
              {
                tenantId,
                orden: 0,
                familiaCodigo: 'trabajo_manual',
                nombreVisible: 'Armado',
              },
            ],
          },
        },
      })
    ).id;
    // Membership es única por usuario/empresa: cada rol usa su propia identidad ficticia.
    await usuario('admin', todosLosPermisos());
    const modulo = await Test.createTestingModule({
      controllers: [TrabajosMedidaController],
      providers: [{ provide: TrabajosMedidaService, useValue: service }],
    }).compile();
    app = modulo.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, db),
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
    await db.ordenTrabajo.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, ajenoId] } } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
    if (secretoAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretoAnterior;
  });
  it('expone opciones de esta empresa y calcula desde HTTP con validación', async () => {
    const opciones = await request(app.getHttpServer())
      .get('/trabajos-medida/opciones')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    expect(opciones.body.centros).toEqual([
      expect.objectContaining({ id: centroId, tarifaHora: 20000 }),
    ]);
    expect(opciones.body.estaciones).toEqual([
      { id: estacionId, nombre: 'Taller de prueba' },
    ]);
    const heredado = opciones.body.rutas[0].pasos[0];
    expect(heredado.nombre).toBe('Armado');
    await expect(
      service.calcular(auth, {
        ...entrada(),
        operaciones: [
          { ...entrada().operaciones[0], clave: heredado.id, estacionId: null },
        ],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.calcular(auth, {
        ...entrada(),
        operaciones: [{ ...entrada().operaciones[0], estacionId: null }],
      }),
    ).rejects.toThrow('estación');
    await expect(
      service.calcular(auth, {
        ...entrada(),
        operaciones: [
          { ...entrada().operaciones[0], estacionId: randomUUID() },
        ],
      }),
    ).rejects.toThrow('estación');
    const r = await request(app.getHttpServer())
      .post('/trabajos-medida/calcular')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send(entrada())
      .expect(201);
    expect(r.body.resumen).toMatchObject({
      costoTotal: 150000,
      neto: 200000,
      total: 242000,
      margen: 50000,
      contribucion: 110000,
    });
    await request(app.getHttpServer())
      .post('/trabajos-medida/calcular')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ ...entrada(), costos: null })
      .expect(400);
  });
  it('revocar el permiso impide calcular, guardar y leer inputs incluso con el token anterior', async () => {
    const g = await guardar();
    await db.rol.update({
      where: { id: roles.admin },
      data: { permisos: ['comercial.gestionar'] },
    });
    for (const endpoint of ['calcular', 'guardar'])
      await request(app.getHttpServer())
        .post(`/trabajos-medida/${endpoint}`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send(entrada())
        .expect(403);
    await request(app.getHttpServer())
      .get(`/trabajos-medida/${g.cotizacionItemId}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(403);
    await db.rol.update({
      where: { id: roles.admin },
      data: { permisos: todosLosPermisos() },
    });
  });
  it('rechaza centros, rutas y snapshots de otra empresa sin crear datos', async () => {
    const g = await guardar();
    const ajeno = { ...auth, tenantId: ajenoId };
    await expect(service.obtener(ajeno, g.cotizacionItemId)).rejects.toThrow(
      'No se encontró',
    );
    await expect(
      service.calcular(auth, { ...entrada(), rutaOrigenId: randomUUID() }),
    ).rejects.toThrow('ruta');
    await expect(
      service.calcular(auth, {
        ...entrada(),
        operaciones: [
          { ...entrada().operaciones[0], centroCostoId: randomUUID() },
        ],
      }),
    ).rejects.toThrow('recurso');
    await expect(service.guardar(vendedor, entrada())).rejects.toThrow(
      'permiso',
    );
  });
  it('congela costos y rechaza el guardado si cambió una tarifa después de la revisión', async () => {
    const input = entrada(),
      previo = await service.calcular(auth, input),
      g = await guardar(input);
    await db.centroCostoTarifaPeriodo.updateMany({
      where: { tenantId },
      data: { tarifaCalculada: 30000 },
    });
    await expect(
      service.guardar(auth, { ...input, huellaCalculo: previo.huellaCalculo }),
    ).rejects.toThrow('cambiaron');
    expect(
      Number(
        (
          await db.cotizacionItem.findUniqueOrThrow({
            where: { id: g.cotizacionItemId },
          })
        ).costoTotal,
      ),
    ).toBe(150000);
    await db.centroCostoTarifaPeriodo.updateMany({
      where: { tenantId },
      data: { tarifaCalculada: 20000 },
    });
  });
  it('emite una orden con pasos ordenados, tiempos manuales y sin descontar materiales', async () => {
    const g = await guardar();
    const orden = await ordenes.create(auth, payload(g));
    const item = await db.ordenTrabajoItem.findFirstOrThrow({
      where: { ordenId: orden.id },
      include: { pasos: { orderBy: { indice: 'asc' } } },
    });
    expect(
      item.pasos.map((p) => [p.nombre, Number(p.duracionEstimadaMin)]),
    ).toEqual([
      ['Diseño', 60],
      ['Armado', 120],
    ]);
    expect(item.pasos.map((p) => p.estacionManualId)).toEqual([
      estacionId,
      estacionId,
    ]);
    expect(Number(item.total)).toBe(242000);
    expect(item.fechaEntrega?.toISOString().slice(0, 10)).toBe('2099-12-20');
    expect(await db.necesidadMaterialOt.count({ where: { tenantId } })).toBe(0);
    expect(await db.reservaMaterialOt.count({ where: { tenantId } })).toBe(0);
  });
  it('impide agregar o duplicar manuales con permisos comerciales generales', async () => {
    const g = await guardar();
    await expect(ordenes.create(vendedor, payload(g))).rejects.toThrow(
      'permiso',
    );
    await expect(
      ordenes.autorizarItemsCotizados(
        vendedor,
        g.cotizacionId,
        payload(g).items,
        clienteId,
      ),
    ).rejects.toThrow('permiso');
  });
  it('exige pasos de producción y conserva el precio pactado al facturar', async () => {
    await expect(
      service.guardar(auth, { ...entrada(), produccion: false }),
    ).rejects.toThrow('ruta de producción');
    await expect(
      service.calcular(auth, { ...entrada(), operaciones: [] }),
    ).rejects.toThrow('ruta de producción');
    const g = await guardar();
    const o = await ordenes.create(auth, payload(g));
    const orden = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: o.id },
      include: { items: { include: { cotizacionItem: true } } },
    });
    expect(
      await db.ordenTrabajoItemPaso.count({ where: { ordenId: o.id } }),
    ).toBe(2);
    for (const letra of ['A', 'B'] as const) {
      const lineas = renglonesFacturaOrden(orden, letra, 242000, 'items');
      expect(calcularTotales(letra, lineas).total).toBe(242000);
      expect(lineas[0].descripcion).toBe('Exhibidor de prueba');
    }
  });
  it('ventas, costos y contribución entran en los reportes sin duplicar las horas', async () => {
    const reporte = await new RentabilidadService(db).periodo(tenantId, {
      desde: new Date('2020-01-01'),
      hasta: new Date('2100-01-01'),
      zona: 'America/Argentina/Buenos_Aires',
    } as never);
    expect(reporte).toMatchObject({
      ventas: 400000,
      costoTotal: 300000,
      costosVariables: 180000,
      contribucion: 220000,
      itemsCostoEstimado: 2,
      itemsCostoParcial: 0,
    });
  });
  it('guarda un presupuesto, crea una revisión sin alterar el original y convierte sin permiso de creación', async () => {
    const presupuestos = new PresupuestosService(
      db,
      ordenes,
      { revincularCotizacionAOrden: jest.fn() } as never,
      {} as never,
      { sincronizar: jest.fn() } as never,
      {} as never,
      new DatosEmpresaService(db),
      {
        reservarParaPresupuesto: jest.fn(),
        liberarReservasPresupuesto: jest.fn(),
      } as never,
      new FidelizacionService(db, capacidades),
      {} as never,
      capacidades,
      { publicar: jest.fn() } as never,
    );
    const g = await guardar();
    const dto = { ...payload(g), clienteId, cotizacionId: g.cotizacionId };
    const primero = await presupuestos.guardarBorrador(auth, dto);
    expect(primero.total).toBe(242000);
    const original = await db.cotizacion.findUniqueOrThrow({
      where: { id: g.cotizacionId },
    });
    const g2 = await guardar({
      ...entrada(),
      precio: 363000,
      anteriorItemId: g.cotizacionItemId,
    });
    await presupuestos.nuevaVersion(auth, g.cotizacionId, {
      ...payload(g2),
      clienteId,
      cotizacionId: g2.cotizacionId,
      revisionBaseActualizadaEl: original.updatedAt.toISOString(),
    });
    expect(
      Number(
        (
          await db.cotizacionItem.findUniqueOrThrow({
            where: { id: g.cotizacionItemId },
          })
        ).precioTotal,
      ),
    ).toBe(242000);
    await db.cotizacion.update({
      where: { id: g2.cotizacionId },
      data: { estado: 'aprobado' },
    });
    const convertido = await presupuestos.convertir(vendedor, g2.cotizacionId, {
      fechaEntrega: '2099-12-21',
    });
    const orden = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: convertido.ordenId },
      include: { items: true },
    });
    expect(Number(orden.total)).toBe(363000);
    expect(orden.items[0].fechaEntrega?.toISOString().slice(0, 10)).toBe(
      '2099-12-21',
    );
    expect(
      await db.ordenTrabajoItemPaso.count({ where: { ordenId: orden.id } }),
    ).toBe(2);
  });
  it('un paso sin horas conserva su centro, indica costo parcial y no inventa duración', async () => {
    const input = entrada();
    input.operaciones[0].horas = null;
    const g = await guardar(input);
    expect(g.resumen.estimacionParcial).toBe(true);
    const o = await ordenes.create(auth, payload(g));
    const paso = await db.ordenTrabajoItemPaso.findFirstOrThrow({
      where: { ordenId: o.id, indice: 0 },
    });
    expect(paso.centroCostoId).toBe(centroId);
    expect(paso.duracionEstimadaMin).toBeNull();
  });
  it('el costo total incluye los pasos aún sin horas; sólo queda pendiente el desglose', async () => {
    const input = entrada();
    input.operaciones[0].horas = null;
    input.costos = {
      modo: 'TOTAL',
      totalEstimado: 150000,
      materiales: 0,
      otros: [],
    };
    const g = await guardar(input);
    expect(g.resumen).toMatchObject({
      costoTotal: 150000,
      estimacionParcial: false,
    });
  });
  it('una orden combina trabajos manuales y catálogo sin alterar precios ni cantidades', async () => {
    const categoria = await db.productoCategoriaComercial.create({
      data: { codigo: randomUUID(), nombre: 'Catálogo de prueba' },
    });
    const subcategoria = await db.productoSubcategoriaComercial.create({
      data: {
        categoriaId: categoria.id,
        codigo: randomUUID(),
        nombre: 'Productos de prueba',
        atributosSchemaJson: {},
      },
    });
    const producto = await db.producto.create({
      data: {
        tenantId,
        subcategoriaComercialId: subcategoria.id,
        codigo: 'PRUEBA',
        nombre: 'Producto ficticio',
      },
    });
    const g = await guardar();
    const catalogo = await db.cotizacionItem.create({
      data: {
        tenantId,
        cotizacionId: g.cotizacionId,
        productoId: producto.id,
        cantidad: 2,
        jobContextJson: { cantidad: 2 },
        snapshotJson: {
          producto: {
            id: producto.id,
            codigo: 'PRUEBA',
            nombre: 'Producto ficticio',
          },
          ejecucion: {
            cantidadEfectiva: 2,
            cantidadComercialReal: 2,
            cantidadComercialPricing: 2,
          },
        },
        costoTotal: 40,
        costoUnitario: 20,
        precioNetoTotal: 100,
        precioNetoUnitario: 50,
        precioTotal: 121,
        precioUnitario: 60.5,
        impuestosPorFueraTotal: 21,
        trazabilidadJson: { pasos: [] },
      },
    });
    let ordenId: string | undefined;
    try {
      const base = payload(g);
      const o = await ordenes.create(auth, {
        ...base,
        items: [
          ...base.items,
          {
            ...base.items[0],
            cotizacionItemId: catalogo.id,
            codigo: 'PRUEBA',
            nombre: 'Producto ficticio',
            cantidad: 2,
            subtotal: 100,
            impuestos: 21,
            total: 121,
          },
        ],
      });
      ordenId = o.id;
      const filas = await db.ordenTrabajoItem.findMany({
        where: { ordenId: o.id },
        orderBy: { ordenIndice: 'asc' },
      });
      expect(filas.map((i) => [Number(i.cantidad), Number(i.total)])).toEqual([
        [3, 242000],
        [2, 121],
      ]);
      expect(
        Number(
          (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } }))
            .total,
        ),
      ).toBe(242121);
    } finally {
      if (ordenId) await db.ordenTrabajo.delete({ where: { id: ordenId } });
      await db.cotizacionItem.delete({ where: { id: catalogo.id } });
      await db.producto.delete({ where: { id: producto.id } });
      await db.productoSubcategoriaComercial.delete({
        where: { id: subcategoria.id },
      });
      await db.productoCategoriaComercial.delete({
        where: { id: categoria.id },
      });
    }
  });
});
