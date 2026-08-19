import { PERMISO_KEY } from '../../auth/permiso.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { PanelGeneralController } from '../panel-general.controller';
import { PanelGeneralService } from '../panel-general.service';

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
  const servicio = new PanelGeneralService(prisma as never, ordenes as never);
  return { prisma, ordenes, servicio };
}

describe('Panel General', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('protege el endpoint con panel.ver', () => {
    expect(Reflect.getMetadata(PERMISO_KEY, PanelGeneralController)).toEqual([
      'panel.ver',
    ]);
  });

  it('para un operario sólo devuelve su mesa y no filtra clientes ni importes', async () => {
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

    expect(respuesta.trabajoPersonal.total).toBe(1);
    expect(respuesta.trabajoPersonal.tareas[0]).toMatchObject({
      ordenNumero: 'OT-001',
      pasoNombre: 'Impresión',
      activa: true,
    });
    expect(respuesta.taller).toBeNull();
    expect(respuesta.proximasEntregas).toEqual([]);
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

    expect(respuesta.vendedorSinVinculo).toBe(true);
    expect(respuesta.proximasEntregas).toEqual([]);
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
    expect(respuesta.proximasEntregas).toEqual([]);
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

  it('permite al administrador previsualizar la composición de operario', async () => {
    const { servicio, ordenes } = dependencias();
    ordenes.tablero.mockResolvedValue({ items: [] });

    const respuesta = await servicio.obtener(
      authCon(['panel.ver', 'configuracion.gestionar']),
      'operario',
    );

    expect(respuesta.vistaActual).toBe('operario');
    expect(respuesta.previsualizando).toBe(true);
    expect(respuesta.vistasDisponibles.map((vista) => vista.id)).toEqual([
      'actual',
      'jefe_produccion',
      'vendedor',
      'administrativo',
      'operario',
    ]);
    expect(respuesta.taller).toBeNull();
    expect(respuesta.administracion).toBeNull();
    expect(respuesta.accionesRapidas.map((accion) => accion.id)).toEqual([
      'mi-mesa',
    ]);
  });

  it('ignora una previsualización solicitada por quien no es administrador', async () => {
    const { servicio } = dependencias();
    const auth = authCon(['panel.ver', 'produccion.gestionar']);
    auth.role = 'OPERADOR';

    const respuesta = await servicio.obtener(auth, 'administrativo');

    expect(respuesta.vistaActual).toBe('actual');
    expect(respuesta.previsualizando).toBe(false);
    expect(respuesta.vistasDisponibles).toHaveLength(1);
    expect(respuesta.administracion).toBeNull();
  });

  it.each([
    ['administrador', ['crear-orden', 'tablero', 'cobro', 'egreso']],
    ['producción', ['tablero', 'estaciones']],
    ['vendedor', ['crear-orden', 'presupuestos', 'tablero']],
    ['administrativo', ['cobro', 'egreso', 'facturacion']],
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
      cobra: ['administrador', 'administrativo'].includes(_perfil),
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
