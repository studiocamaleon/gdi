import { PERMISO_KEY } from '../../auth/permiso.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { PanelGeneralController } from '../panel-general.controller';
import { PanelGeneralService } from '../panel-general.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';

const authCon = (permisos: string[]): CurrentAuth =>
  ({
    userId: 'usuario-1',
    sessionId: 'sesion-1',
    tenantId: 'tenant-a',
    membershipId: 'membership-1',
    role: 'ADMINISTRADOR',
    email: 'persona@ejemplo.com',
    permisos: new Set(permisos),
  }) as CurrentAuth;

function dependencias() {
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'tenant-a',
        nombre: 'Prueba',
        activo: true,
        suscripcion: null,
        cuotaBytesArchivos: null,
      }),
    },
    datosEmpresa: {
      findUnique: jest.fn().mockResolvedValue({
        monedaCodigo: 'ARS',
        zonaHoraria: 'America/Argentina/Buenos_Aires',
        redondeoPrecio: 'entero',
        paisCodigo: 'AR',
      }),
    },
    empleado: { findFirst: jest.fn().mockResolvedValue(null) },
    ordenTrabajo: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ordenTrabajoItem: { count: jest.fn().mockResolvedValue(0) },
    ordenTrabajoItemPaso: { count: jest.fn().mockResolvedValue(0) },
    cotizacion: { count: jest.fn().mockResolvedValue(0) },
    egreso: { findMany: jest.fn().mockResolvedValue([]) },
    cobro: { count: jest.fn().mockResolvedValue(0) },
    etaSnapshotEstacion: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const ordenes = { tablero: jest.fn().mockResolvedValue({ items: [] }) };
  const admin = {
    obtener: jest.fn().mockResolvedValue({
      actividad: { items: [], siguienteCursor: null },
      pasosCompletadosHoy: 0,
      documentacionPendiente: { total: 0, ordenes: [] },
    }),
  };
  const servicio = new PanelGeneralService(
    prisma as never,
    ordenes as never,
    admin as never,
    new CapacidadesEmpresaService(prisma as never),
  );
  return { prisma, ordenes, servicio, admin };
}

describe('Panel General', () => {
  it('separa hoy y próximas antes del límite de seis, usando la fecha del tenant', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-16T01:30:00Z'));
    const { servicio, prisma } = dependencias();
    const fechas = [
      ...Array<string>(8).fill('2026-09-14'),
      '2026-09-15',
      '2026-09-15',
      '2026-09-16',
      '2026-09-22',
    ];
    prisma.ordenTrabajo.findMany.mockResolvedValue(
      fechas.map((fecha, i) => ({
        id: `ot-${i}`,
        numero: `OT-${i}`,
        estado: 'pendiente',
        fechaEntrega: new Date(`${fecha}T00:00:00Z`),
        cliente: null,
        items: [],
      })),
    );
    const respuesta = await servicio.obtener(
      authCon(['panel.ver', 'produccion.ver', 'comercial.ver']),
    );
    expect(respuesta.fechaLocal).toBe('2026-09-15');
    expect(respuesta.entregas?.atrasada.total).toBe(8);
    expect(respuesta.entregas?.atrasada.items).toHaveLength(6);
    expect(respuesta.entregas?.hoy.total).toBe(2);
    expect(respuesta.entregas?.hoy.items.map((e) => e.id)).toEqual([
      'ot-8',
      'ot-9',
    ]);
    expect(respuesta.entregas?.proxima.total).toBe(2);
    expect(
      respuesta.entregas?.proxima.items.map((e) => e.fechaEntrega),
    ).toEqual(['2026-09-16', '2026-09-22']);
    expect(prisma.ordenTrabajo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          estado: { in: ['pendiente', 'produccion', 'finalizada'] },
          fechaEntrega: { lte: new Date('2026-09-22T00:00:00Z') },
        },
      }),
    );
  });

  it.each(['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR'] as const)(
    'devuelve el mismo modelo de panel para %s con sus permisos efectivos',
    async (role) => {
      const { servicio, ordenes } = dependencias();
      const auth = {
        ...authCon(['panel.ver', 'produccion.ver', 'comercial.ver']),
        role,
      };
      const respuesta = await servicio.obtener(auth);
      expect(respuesta.entregas).toEqual({
        hoy: { items: [], total: 0 },
        atrasada: { items: [], total: 0 },
        proxima: { items: [], total: 0 },
      });
      expect(respuesta.kpis.map((kpi) => kpi.id)).toEqual([
        'entregas-hoy',
        'atrasadas',
        'en-produccion',
        'bloqueados',
        'listos-retiro',
      ]);
      expect(respuesta).not.toHaveProperty('vistaActual');
      expect(respuesta).not.toHaveProperty('previsualizando');
      expect(respuesta).not.toHaveProperty('vistasDisponibles');
      expect(respuesta).not.toHaveProperty('trabajoPersonal');
      expect(ordenes.tablero).toHaveBeenCalledWith(auth);
    },
  );

  it('conserva la autorización del historial empresarial al compartir la presentación', async () => {
    const { servicio, admin } = dependencias();
    const auth = authCon(['panel.ver', 'configuracion.gestionar']);
    await servicio.obtener({ ...auth, role: 'OPERADOR' });
    expect(admin.obtener).not.toHaveBeenCalled();
    await servicio.obtener(auth);
    expect(admin.obtener).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('protege el endpoint con panel.ver', () => {
    expect(Reflect.getMetadata(PERMISO_KEY, PanelGeneralController)).toEqual([
      'panel.ver',
    ]);
  });

  it('para un operario conserva las métricas propias y no expone clientes ni importes', async () => {
    const { servicio, ordenes, prisma } = dependencias();
    ordenes.tablero.mockResolvedValue({
      items: [
        {
          ordenId: 'ot-1',
          ordenNumero: 'OT-001',
          nombre: 'Cartel secreto',
          clienteNombre: 'CLIENTE SECRETO',
          sinRuta: false,
          pasos: [
            {
              id: 'paso-1',
              nombre: 'Impresión',
              estado: 'en_curso',
              motivoBloqueo: null,
              mesaEsMia: true,
              tramoAbierto: { esMio: true },
            },
          ],
        },
      ],
    });

    const respuesta = await servicio.obtener(
      authCon(['panel.ver', 'produccion.ver', 'produccion.gestionar']),
    );
    const serializado = JSON.stringify(respuesta);

    expect(
      respuesta.kpis.find((kpi) => kpi.id === 'en-produccion')?.valor,
    ).toBe(1);
    expect(respuesta.taller).toBeNull();
    expect(respuesta.entregas).toBeNull();
    expect(respuesta.accionesRapidas.map((a) => a.id)).toEqual(['mi-mesa']);
    expect(serializado).not.toContain('CLIENTE SECRETO');
    expect(serializado).not.toContain('monto');
    expect(prisma.ordenTrabajo.findMany).not.toHaveBeenCalled();
  });

  it('un vendedor sin empleado vinculado no recibe órdenes globales', async () => {
    const { servicio, prisma } = dependencias();

    const respuesta = await servicio.obtener(
      authCon([
        'panel.ver',
        'comercial.ver',
        'comercial.gestionar',
        'produccion.ver',
      ]),
    );

    expect(respuesta.entregas).toEqual({
      hoy: { items: [], total: 0 },
      atrasada: { items: [], total: 0 },
      proxima: { items: [], total: 0 },
    });
    expect(respuesta.taller).toBeNull();
    expect(respuesta.atencion[0]).toMatchObject({
      id: 'vendedor-sin-vinculo',
      dominio: 'comercial',
    });
    const consultas = prisma.ordenTrabajo.findMany.mock
      .calls as unknown as Array<[{ where: Record<string, unknown> }]>;
    expect(
      consultas.some(
        ([args]) =>
          args.where.tenantId === 'tenant-a' &&
          args.where.vendedorEmpleadoId === '__sin_empleado__',
      ),
    ).toBe(true);
    expect(prisma.etaSnapshotEstacion.findFirst).not.toHaveBeenCalled();
  });

  it('respeta zona horaria, tenant y ausencia de módulos en un rol personalizado', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T01:30:00.000Z'));
    const { servicio, prisma, ordenes } = dependencias();

    const respuesta = await servicio.obtener(
      authCon(['panel.ver', 'administracion.gestionar']),
    );

    expect(respuesta.fechaLocal).toBe('2026-08-18');
    expect(respuesta.taller).toBeNull();
    expect(respuesta.entregas).toBeNull();
    expect(ordenes.tablero).not.toHaveBeenCalled();
    expect(prisma.ordenTrabajo.count).not.toHaveBeenCalled();
    expect(prisma.datosEmpresa.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-a' } }),
    );
    const consultasOrdenes = prisma.ordenTrabajo.findMany.mock
      .calls as unknown as Array<[{ where: Record<string, unknown> }]>;
    for (const [args] of consultasOrdenes) {
      expect(args.where.tenantId).toBe('tenant-a');
    }
    const consultasEgresos = prisma.egreso.findMany.mock
      .calls as unknown as Array<[{ where: Record<string, unknown> }]>;
    for (const [args] of consultasEgresos) {
      expect(args.where.tenantId).toBe('tenant-a');
    }
  });

  it('el endpoint ya no reenvía una selección de vista al servicio', async () => {
    const panel = { obtener: jest.fn().mockResolvedValue({}) };
    const controller = new PanelGeneralController(panel as never, {} as never);
    const auth = authCon(['panel.ver']);
    // Incluso un cliente antiguo que mande un segundo argumento no altera permisos.
    await (controller.obtener as (...args: unknown[]) => unknown)(
      auth,
      'administrativo',
    );
    expect(panel.obtener).toHaveBeenCalledWith(auth);
  });

  it('incluye el avance individual de los productos en próximas entregas', async () => {
    const { servicio, prisma } = dependencias();
    prisma.ordenTrabajo.findMany.mockResolvedValue([
      {
        id: 'ot-1',
        numero: 'OT-001',
        estado: 'produccion',
        fechaEntrega: new Date('2026-08-20T00:00:00.000Z'),
        cliente: { nombre: 'Cliente' },
        items: [
          {
            id: 'item-1',
            nombre: 'Tarjetas',
            pasos: [
              {
                estado: 'hecho',
                nombre: 'Impresión',
                centroCostoNombre: 'Impresión',
              },
              {
                estado: 'pendiente',
                nombre: 'Corte',
                centroCostoNombre: 'Terminación',
              },
            ],
          },
          {
            id: 'item-2',
            nombre: 'Sobres',
            pasos: [
              {
                estado: 'hecho',
                nombre: 'Impresión',
                centroCostoNombre: 'Impresión',
              },
            ],
          },
        ],
      },
    ]);

    const proximas = await (
      servicio as unknown as {
        ordenesProximas(
          tenantId: string,
          hoy: string,
          enSiete: string,
          filtroVendedor: Record<string, unknown>,
        ): Promise<Array<{ producto: string; productos: unknown[] }>>;
      }
    ).ordenesProximas('tenant-a', '2026-08-19', '2026-08-26', {});

    expect(proximas[0]).toMatchObject({
      producto: '2 productos',
      productos: [
        { id: 'item-1', nombre: 'Tarjetas', progresoPct: 50 },
        { id: 'item-2', nombre: 'Sobres', progresoPct: 100 },
      ],
    });
  });

  it.each([
    ['administrador', ['crear-orden', 'tablero', 'egreso']],
    ['producción', ['tablero', 'estaciones']],
    ['vendedor', ['crear-orden', 'presupuestos', 'tablero']],
    ['administrativo', ['egreso', 'facturacion']],
    ['operario', ['mi-mesa']],
  ])('compone acciones para el perfil %s', (_perfil, esperadas) => {
    const { servicio } = dependencias();
    const acciones = (
      servicio as unknown as {
        accionesRapidas(p: Record<string, boolean>): Array<{ id: string }>;
      }
    ).accionesRapidas({
      gestionaComercial: ['administrador', 'vendedor'].includes(_perfil),
      veProduccion: ['administrador', 'producción', 'vendedor'].includes(
        _perfil,
      ),
      gestionaProduccion: ['administrador', 'producción', 'operario'].includes(
        _perfil,
      ),
      gestionaAdministracion: ['administrador', 'administrativo'].includes(
        _perfil,
      ),
      perfilSoloProductivo: _perfil === 'operario',
    });
    expect(acciones.map((a) => a.id)).toEqual(esperadas);
  });

  it('ordena alertas críticas antes que atención e informativas', () => {
    const { servicio } = dependencias();
    const alertas = (
      servicio as unknown as {
        armarAtencion(input: unknown): Array<{ severidad: string }>;
      }
    ).armarAtencion({
      prod: {
        entregasHoy: 1,
        atrasadas: 1,
        enProduccion: 1,
        bloqueados: 1,
        listosRetiro: 1,
      },
      comerciales: { pendientesAprobacion: 1, porVencer: 1 },
      administracion: null,
      vendedorSinVinculo: false,
      aprueba: true,
      veComercial: true,
      veProduccion: true,
    });
    expect(alertas.map((a) => a.severidad)).toEqual([
      'critico',
      'critico',
      'atencion',
      'atencion',
      'atencion',
      'info',
    ]);
  });
});

it.each([
  ['Esencial', 0, false],
  ['Pro', 1, true],
] as const)(
  'las acciones rápidas de %s respetan las funciones de su versión',
  async (_nombre, indice, puedeEgreso) => {
    const { servicio, prisma } = dependencias();
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-a',
      nombre: 'Prueba',
      activo: true,
      cuotaBytesArchivos: null,
      suscripcion: {
        estado: 'activa',
        proveedor: 'manual',
        trialHasta: null,
        graciaHasta: null,
        plan: { nombre: 'Plan', featuresJson: {} },
        planVersion: {
          id: 'version-asignada',
          numero: 2,
          catalogoVersion: 1,
          contenido: {
            ...PROPUESTA_PLANES[indice].contenido,
            almacenamientoModo: 'limitado',
            almacenamientoGb: 250,
          },
        },
      },
    });
    const r = await servicio.obtener(
      authCon([
        'comercial.ver',
        'comercial.gestionar',
        'produccion.ver',
        'produccion.gestionar',
        'administracion.gestionar',
      ]),
    );
    const ids = r.accionesRapidas.map((a) => a.id);
    expect(ids).toContain('crear-orden');
    expect(ids.includes('egreso')).toBe(puedeEgreso);
  },
);

it('el panel en sólo lectura conserva consulta y no ofrece crear órdenes ni egresos', async () => {
  const { servicio, prisma } = dependencias();
  prisma.tenant.findUnique.mockResolvedValue({
    id: 'tenant-a',
    nombre: 'Prueba',
    activo: true,
    cuotaBytesArchivos: null,
    suscripcion: {
      estado: 'baja',
      proveedor: 'paddle',
      estadoProveedor: 'canceled',
      plan: { featuresJson: { todo: true } },
    },
  });
  const r = await servicio.obtener(
    authCon([
      'comercial.ver',
      'comercial.gestionar',
      'produccion.ver',
      'produccion.gestionar',
      'administracion.gestionar',
    ]),
  );
  expect(r.accionesRapidas.map((a) => a.id)).toEqual(['tablero']);
});
