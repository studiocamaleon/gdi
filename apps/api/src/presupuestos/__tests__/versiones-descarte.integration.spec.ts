import { FidelizacionService } from '../../fidelizacion/fidelizacion.service';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PresupuestosService } from '../presupuestos.service';
import { CurrentAuth } from '../../auth/auth.types';
import { NuevaVersionPresupuestoDto } from '../dto/presupuestos.dto';

// PostgreSQL real para probar exclusión mutua e inmutabilidad; sin proveedores.
describe('versiones y descarte de presupuestos', () => {
  const db = new PrismaClient();
  const tenantId = randomUUID();
  const ajenoId = randomUUID();
  const userId = randomUUID();
  const categoriaId = randomUUID(),
    subcategoriaId = randomUUID(),
    productoId = randomUUID();
  let clienteId: string;
  const auth = {
    tenantId,
    userId,
    email: 'versiones@example.invalid',
    role: 'ADMINISTRADOR',
    permisos: new Set(['comercial.aprobar_descuento']),
  } as CurrentAuth;
  const avisos = { sincronizar: jest.fn() };
  const liberarCupon = jest.fn();
  const liberarPuntos = jest.fn();
  const enlaces = { resolver: jest.fn() };
  const service = new PresupuestosService(
    db as never,
    {
      autorizarItemsCotizados: async (
        _auth: unknown,
        _id: string,
        items: unknown[],
      ) => items,
      autorizarCargosCotizados: async () => [],
    } as never,
    {} as never,
    {} as never,
    avisos as never,
    enlaces as never,
    {
      regional: async () => ({ zonaHoraria: 'America/Argentina/Buenos_Aires' }),
    } as never,
    {
      liberarReservasPresupuesto: liberarCupon,
      reservarParaPresupuesto: jest.fn(),
    } as never,
    {
      liberarReservas: liberarPuntos,
      exigirCompromisoTx: jest.fn(),
      simularCotizacion: async () => ({
        puntosEstimados: 0,
        canjePuntos: 0,
        canjeMonto: 0,
        maximoCanjeable: 0,
        margen: 0,
        snapshot: {},
      }),
    } as never,
    {} as never,
    {
      exigir: jest.fn(),
      incluida: async () => false,
      puedeOperar: async () => false,
    } as never,
    { publicar: jest.fn() } as never,
  );

  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
      throw Error('Sólo base de pruebas.');
    await db.tenant.createMany({
      data: [tenantId, ajenoId].map((id) => ({
        id,
        nombre: 'QA versiones',
        slug: `versiones-${id}`,
      })),
    });
    await db.user.create({
      data: {
        id: userId,
        email: `versiones-${userId}@example.invalid`,
        nombreCompleto: 'Comercial ficticio',
      },
    });
    await db.productoCategoriaComercial.create({
      data: { id: categoriaId, codigo: categoriaId, nombre: 'QA' },
    });
    await db.productoSubcategoriaComercial.create({
      data: {
        id: subcategoriaId,
        categoriaId,
        codigo: subcategoriaId,
        nombre: 'QA',
        atributosSchemaJson: {},
      },
    });
    await db.producto.create({
      data: {
        id: productoId,
        tenantId,
        subcategoriaComercialId: subcategoriaId,
        codigo: 'QA',
        nombre: 'Tarjetas ficticias',
      },
    });
    clienteId = (
      await db.cliente.create({
        data: {
          tenantId,
          nombre: 'Cliente ficticio',
          telefonoCodigo: '+54',
          telefonoNumero: '0000000000',
          paisCodigo: 'AR',
        },
      })
    ).id;
  });
  afterAll(async () => {
    await db.ordenTrabajo.deleteMany({ where: { tenantId } });
    await db.cotizacion.deleteMany({ where: { tenantId } });
    await db.cliente.deleteMany({ where: { tenantId } });
    await db.producto.deleteMany({ where: { tenantId } });
    await db.productoSubcategoriaComercial.delete({
      where: { id: subcategoriaId },
    });
    await db.productoCategoriaComercial.delete({ where: { id: categoriaId } });
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, ajenoId] } } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });
  const item = (cantidad: number) => ({
    codigo: 'TARJETAS',
    nombre: 'Tarjetas',
    familia: 'Impresión',
    cantidad,
    cantidadUnidad: 'u.',
    subtotal: cantidad * 100,
    impuestos: 0,
    total: cantidad * 100,
  });
  async function caso(estado = 'enviado') {
    const anterior = await db.cotizacion.create({
      data: {
        tenantId,
        clienteId,
        numero: `PRES-QA-${randomUUID()}`,
        estado,
        subtotal: 50000,
        total: 50000,
        emisionJson: { items: [item(500)] },
        fechaValidez: new Date('2099-01-01'),
        publicToken: randomUUID(),
      },
    });
    const nueva = await db.cotizacion.create({ data: { tenantId, clienteId } });
    const dto: NuevaVersionPresupuestoDto = {
      cotizacionId: nueva.id,
      clienteId,
      canalVenta: 'mostrador',
      items: [item(300)],
      revisionBaseActualizadaEl: anterior.updatedAt.toISOString(),
      notificarWhatsapp: false,
    };
    return { anterior, nueva, dto };
  }
  it('500 → 300: mismo número, nueva versión, importes e historia anteriores intactos y sin nueva numeración', async () => {
    const { anterior, dto } = await caso();
    const contador = await db.cotizacionContador.count({ where: { tenantId } });
    const d = await service.nuevaVersion(auth, anterior.id, dto);
    expect(d).toMatchObject({
      numero: anterior.numero,
      versionPresupuesto: 2,
      estado: 'borrador',
      total: 30000,
      publicToken: null,
    });
    expect(d.versiones).toHaveLength(2);
    expect(d.items[0].cantidad).toBe(300);
    const vieja = await db.cotizacion.findUniqueOrThrow({
      where: { id: anterior.id },
    });
    expect(vieja).toMatchObject({
      versionVigente: false,
      estado: 'enviado',
      emisionJson: { items: [item(500)] },
      publicToken: anterior.publicToken,
    });
    expect(Number(vieja.total)).toBe(50000);
    expect(await db.cotizacionContador.count({ where: { tenantId } })).toBe(
      contador,
    );
    expect(liberarCupon).toHaveBeenCalled();
    expect(liberarPuntos).toHaveBeenCalled();
    expect(avisos.sincronizar).not.toHaveBeenCalled();
    await expect(service.enviar(auth, anterior.id)).rejects.toThrow(
      'versión anterior',
    );
    enlaces.resolver.mockResolvedValue({ tenantId, entidadId: anterior.id });
    await expect(
      service.decisionPublica('token', { decision: 'aprobado' }),
    ).rejects.toThrow('reemplazado');
    expect(
      (
        await service.listado(auth, { busqueda: anterior.numero! })
      ).presupuestos.map((p) => p.id),
    ).toEqual([d.id]);
  });
  it.each(['aprobado', 'convertido', 'pendiente_aprobacion'])(
    'rechaza crear versiones de %s',
    async (estado) => {
      const { anterior, dto } = await caso(estado);
      await expect(
        service.nuevaVersion(auth, anterior.id, dto),
      ).rejects.toThrow();
      expect(
        (await db.cotizacion.findUniqueOrThrow({ where: { id: anterior.id } }))
          .versionVigente,
      ).toBe(true);
    },
  );
  it('dos editores no crean simultáneamente dos versiones vigentes', async () => {
    const { anterior, dto } = await caso();
    const otra = await db.cotizacion.create({ data: { tenantId, clienteId } });
    const r = await Promise.allSettled([
      service.nuevaVersion(auth, anterior.id, dto),
      service.nuevaVersion(auth, anterior.id, {
        ...dto,
        cotizacionId: otra.id,
      }),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.cotizacion.count({
        where: { tenantId, numero: anterior.numero, versionVigente: true },
      }),
    ).toBe(1);
    expect(
      await db.cotizacion.count({
        where: { tenantId, numero: anterior.numero },
      }),
    ).toBe(2);
  });
  it('aprobar mientras se edita impide guardar la nueva propuesta', async () => {
    const { anterior, dto } = await caso();
    await db.cotizacion.update({
      where: { id: anterior.id },
      data: { estado: 'aprobado' },
    });
    await expect(
      service.nuevaVersion(auth, anterior.id, dto),
    ).rejects.toThrow();
  });
  it('descarta sólo borradores, conserva el registro y lo retira del listado activo', async () => {
    const { anterior } = await caso('borrador');
    const d = await service.descartar(auth, anterior.id);
    expect(d.estado).toBe('descartado');
    expect(
      d.eventos.some(
        (e) => e.tipo === 'descartado' && e.usuario === 'Comercial ficticio',
      ),
    ).toBe(true);
    expect(
      (await service.listado(auth, { busqueda: anterior.numero! }))
        .presupuestos,
    ).toHaveLength(0);
    expect(
      (
        await service.listado(auth, {
          estado: 'descartado',
          busqueda: anterior.numero!,
        })
      ).presupuestos,
    ).toHaveLength(1);
    await expect(service.enviar(auth, anterior.id)).rejects.toThrow();
    const emitido = await caso();
    await expect(
      service.descartar(auth, emitido.anterior.id),
    ).rejects.toThrow();
  });
  it('restringe edición y descarte al tenant', async () => {
    const { anterior, dto } = await caso('borrador');
    const otro = { ...auth, tenantId: ajenoId };
    await expect(service.nuevaVersion(otro, anterior.id, dto)).rejects.toThrow(
      'no existe',
    );
    await expect(service.descartar(otro, anterior.id)).rejects.toThrow(
      'no existe',
    );
  });
  it('rechaza una versión con OT aunque el estado recibido siga en enviado', async () => {
    const { anterior, dto } = await caso();
    await db.ordenTrabajo.create({
      data: {
        tenantId,
        numero: `OT-QA-${randomUUID()}`,
        cotizacionId: anterior.id,
      },
    });
    await expect(service.nuevaVersion(auth, anterior.id, dto)).rejects.toThrow(
      'ya tiene una OT',
    );
  });
  it('reabre cantidades y configuración desde el snapshot sin alterar el histórico', async () => {
    const { anterior } = await caso();
    const snap = await db.cotizacionItem.create({
      data: {
        tenantId,
        cotizacionId: anterior.id,
        productoId,
        cantidad: 500,
        jobContextJson: { cantidad: 500, caras: 2 },
        snapshotJson: { precio: { precioTotal: 50000 } },
        precioTotal: 50000,
        precioUnitario: 100,
      },
    });
    await db.cotizacion.update({
      where: { id: anterior.id },
      data: {
        emisionJson: {
          items: [{ ...item(500), cotizacionItemId: snap.id }],
          fechaEntrega: '2099-01-10',
          validezDias: 15,
        },
      },
    });
    const edicion = await service.edicion(auth, anterior.id);
    expect(edicion.cliente?.nombre).toBe('Cliente ficticio');
    expect(edicion.fechaEntrega).toBe('2099-01-10');
    expect(edicion.productos[0]).toMatchObject({
      cantidad: 500,
      specs: [],
      snapshot: { productoId, jobContext: { cantidad: 500, caras: 2 } },
    });
    expect(
      (await db.cotizacionItem.findUniqueOrThrow({ where: { id: snap.id } }))
        .jobContextJson,
    ).toEqual({ cantidad: 500, caras: 2 });
  });
  it('recupera sólo los puntos reservados por la misma versión y el mismo cliente', async () => {
    const { anterior } = await caso();
    const cuenta = await db.fidelizacionCuenta.upsert({
      where: { clienteId },
      create: { tenantId, clienteId, saldoPuntos: 100, reservadosPuntos: 40 },
      update: {},
    });
    await db.fidelizacionReserva.create({
      data: {
        tenantId,
        clienteId,
        cuentaId: cuenta.id,
        cotizacionId: anterior.id,
        puntos: 40,
        monto: 400,
        estado: 'RESERVADA',
      },
    });
    const puntos = new FidelizacionService(db as never);
    expect(
      await puntos.puntosReservaPresupuesto(tenantId, clienteId, anterior.id),
    ).toBe(40);
    await expect(
      puntos.puntosReservaPresupuesto(ajenoId, clienteId, anterior.id),
    ).rejects.toThrow();
    await db.cotizacion.update({
      where: { id: anterior.id },
      data: { estado: 'aprobado' },
    });
    await expect(
      puntos.puntosReservaPresupuesto(tenantId, clienteId, anterior.id),
    ).rejects.toThrow();
  });
  it('ni la API de recotización puede modificar los snapshots de un borrador formal', async () => {
    const { anterior } = await caso('borrador');
    const snap = await db.cotizacionItem.create({
      data: {
        tenantId,
        cotizacionId: anterior.id,
        productoId,
        cantidad: 500,
        jobContextJson: { cantidad: 500 },
        snapshotJson: {},
      },
    });
    const motor = Object.assign(
      Object.create(MotorUniversalService.prototype),
      { prisma: db, capacidadesPlan: { exigir: jest.fn() } },
    ) as MotorUniversalService;
    await expect(
      motor.recotizarItem({
        tenantId,
        cotizacionItemId: snap.id,
        jobContext: { cantidad: 300 },
      }),
    ).rejects.toThrow('nueva versión');
    expect(
      Number(
        (await db.cotizacionItem.findUniqueOrThrow({ where: { id: snap.id } }))
          .cantidad,
      ),
    ).toBe(500);
  });
});
