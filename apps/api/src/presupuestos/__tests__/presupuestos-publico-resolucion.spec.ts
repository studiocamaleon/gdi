import { TipoEnlacePublico } from '@prisma/client';
import { PresupuestosService } from '../presupuestos.service';

const auth = {
  tenantId: 'tenant-1',
  userId: 'comercial-1',
  role: 'OPERADOR',
  email: 'comercial@example.test',
} as never;

function escenario(estado = 'enviado', fechaValidez = new Date('2099-09-30')) {
  const cotizacion = {
    id: 'pres-1',
    tenantId: 'tenant-1',
    numero: 'PRES-1',
    estado,
    fechaValidez,
    tenant: { nombre: 'Imprenta', logoArchivoId: 'logo-1' },
    primeraVistaEl: new Date(),
    emisionJson: { items: [] },
  };
  const tx = {
    cotizacion: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    cotizacion: {
      findFirst: jest.fn().mockResolvedValue(cotizacion),
      findUnique: jest.fn().mockResolvedValue(cotizacion),
    },
    cotizacionEvento: { create: jest.fn().mockResolvedValue({}) },
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ nombreCompleto: 'Comercial de prueba' }),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
  };
  const archivos = {
    urlDeLogoPublico: jest
      .fn()
      .mockResolvedValue('https://storage.example.test/logo-firmado'),
  };
  const enlaces = {
    resolver: jest
      .fn()
      .mockResolvedValue({ entidadId: 'pres-1', tenantId: 'tenant-1' }),
  };
  const avisos = { sincronizar: jest.fn().mockResolvedValue(undefined) };
  const empresa = {
    regional: jest
      .fn()
      .mockResolvedValue({
        moneda: { codigo: 'ARS' },
        zonaHoraria: 'America/Argentina/Buenos_Aires',
      }),
  };
  const cupones = {
    liberarReservasPresupuesto: jest.fn().mockResolvedValue(undefined),
  };
  const fidelizacion = {
    liberarReservas: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PresupuestosService(
    prisma as never,
    {} as never,
    archivos as never,
    {} as never,
    avisos as never,
    enlaces as never,
    empresa as never,
    cupones as never,
    fidelizacion as never,
  );
  jest
    .spyOn(service, 'detalle')
    .mockResolvedValue({ estado: 'aprobado' } as never);
  return {
    service,
    prisma,
    tx,
    cotizacion,
    archivos,
    enlaces,
    avisos,
    cupones,
    fidelizacion,
  };
}

describe('logo público de presupuestos', () => {
  it('firma únicamente el logo del tenant autorizado por el token de presupuesto', async () => {
    const { service, enlaces, archivos } = escenario();
    await expect(service.logoPublicoPorToken('token')).resolves.toBe(
      'https://storage.example.test/logo-firmado',
    );
    expect(enlaces.resolver).toHaveBeenCalledWith(
      'token',
      TipoEnlacePublico.PRESUPUESTO,
    );
    expect(archivos.urlDeLogoPublico).toHaveBeenCalledWith('tenant-1');
  });

  it('no consulta archivos cuando el token no es válido', async () => {
    const { service, enlaces, archivos } = escenario();
    enlaces.resolver.mockResolvedValue(null);
    await expect(service.logoPublicoPorToken('invalido')).resolves.toBeNull();
    expect(archivos.urlDeLogoPublico).not.toHaveBeenCalled();
  });

  it('informa si la cabecera tiene logo sin exponer el identificador del archivo', async () => {
    const { service, cotizacion } = escenario();
    await expect(service.publico('token')).resolves.toMatchObject({
      tieneLogo: true,
      negocio: 'Imprenta',
    });
    const result = await service.publico('token');
    expect(result).not.toHaveProperty('logoArchivoId');
    cotizacion.tenant.logoArchivoId = null as never;
    await expect(service.publico('token')).resolves.toMatchObject({
      tieneLogo: false,
    });
  });
});

describe('aprobación del cliente registrada por el comercial', () => {
  it('registra la decisión, fecha y autor y deja la conversión para otra acción', async () => {
    const { service, tx, prisma, cupones, fidelizacion } = escenario();
    await expect(
      service.resolver(auth, 'pres-1', { resultado: 'aprobado' }),
    ).resolves.toMatchObject({ estado: 'aprobado' });
    expect(tx.cotizacion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'pres-1',
          estado: 'enviado',
          fechaValidez: { gte: expect.any(Date) },
        },
        data: expect.objectContaining({
          estado: 'aprobado',
          fechaResuelto: expect.any(Date),
          motivoPerdida: null,
        }),
      }),
    );
    expect(prisma.cotizacionEvento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: 'comercial-1',
        usuarioNombre: 'Comercial de prueba',
        tipo: 'aprobado',
        descripcion: expect.stringContaining('por otro canal'),
      }),
    });
    expect(cupones.liberarReservasPresupuesto).not.toHaveBeenCalled();
    expect(fidelizacion.liberarReservas).not.toHaveBeenCalled();
  });

  it.each([
    'borrador',
    'pendiente_aprobacion',
    'aprobado',
    'rechazado',
    'convertido',
  ])('rechaza la aprobación si está %s', async (estado) => {
    const { service, tx } = escenario(estado);
    await expect(
      service.resolver(auth, 'pres-1', { resultado: 'aprobado' }),
    ).rejects.toThrow('La acción no aplica');
    expect(tx.cotizacion.updateMany).not.toHaveBeenCalled();
  });

  it('no permite aprobar un vencido', async () => {
    const { service, tx } = escenario('vencido');
    await expect(
      service.resolver(auth, 'pres-1', { resultado: 'aprobado' }),
    ).rejects.toThrow('está vencido');
    expect(tx.cotizacion.updateMany).not.toHaveBeenCalled();
  });

  it('vence primero un enviado cuya fecha ya pasó', async () => {
    const { service, tx, prisma } = escenario(
      'enviado',
      new Date('2000-01-01'),
    );
    await expect(
      service.resolver(auth, 'pres-1', { resultado: 'aprobado' }),
    ).rejects.toThrow('está vencido');
    expect(tx.cotizacion.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.cotizacion.updateMany).toHaveBeenCalledWith({
      where: { id: 'pres-1', estado: 'enviado' },
      data: { estado: 'vencido' },
    });
    expect(prisma.cotizacionEvento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'vencido' }),
    });
  });

  it('no sobrescribe una decisión concurrente ni agrega un evento de aprobación falso', async () => {
    const { service, tx, prisma, avisos } = escenario();
    tx.cotizacion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.resolver(auth, 'pres-1', { resultado: 'aprobado' }),
    ).rejects.toThrow('cambió de estado');
    expect(prisma.cotizacionEvento.create).not.toHaveBeenCalled();
    expect(avisos.sincronizar).not.toHaveBeenCalled();
  });

  it('mantiene el motivo de rechazo y libera las reservas asociadas', async () => {
    const { service, tx, cupones, fidelizacion } = escenario();
    await service.resolver(auth, 'pres-1', {
      resultado: 'rechazado',
      motivoPerdida: 'precio',
    });
    expect(tx.cotizacion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'rechazado',
          motivoPerdida: 'precio',
        }),
      }),
    );
    expect(cupones.liberarReservasPresupuesto).toHaveBeenCalled();
    expect(fidelizacion.liberarReservas).toHaveBeenCalled();
  });
});
