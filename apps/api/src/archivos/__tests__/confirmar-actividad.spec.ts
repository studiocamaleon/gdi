import type { CurrentAuth } from '../../auth/auth.types';
import { ArchivosService } from '../archivos.service';

function setup({ confirmado = false, ganaConfirmacion = true, item = false } = {}) {
  const archivo = {
    id: 'archivo-1', tenantId: 'tenant-1', estado: confirmado ? 'LISTO' : 'PENDIENTE',
    nombreOriginal: 'arte-final.pdf', mimeType: 'application/pdf', bytes: 20n,
    key: 'tenant-1/arte.pdf', scope: item ? 'ORDEN_ITEM' : 'ORDEN',
    ordenId: item ? null : 'ot-1', ordenItemId: item ? 'item-1' : null,
    createdAt: new Date(),
  };
  const tx = {
    archivo: { updateMany: jest.fn().mockResolvedValue({ count: ganaConfirmacion ? 1 : 0 }), findFirstOrThrow: jest.fn().mockResolvedValue({ ...archivo, estado: 'LISTO' }) },
    tenant: { update: jest.fn() },
    ordenTrabajoItem: { findFirst: jest.fn().mockResolvedValue({ ordenId: 'ot-1' }) },
  };
  const prisma = { archivo: { findFirst: jest.fn().mockResolvedValue(archivo) }, $transaction: jest.fn((cb: (db: typeof tx) => unknown) => cb(tx)) };
  const storage = { cabecera: jest.fn().mockResolvedValue({ bytes: 20, contentType: 'application/pdf' }), leerCabecera: jest.fn().mockResolvedValue(Buffer.from('%PDF-')) };
  const eventos = { publicarDesdeAuth: jest.fn() };
  const service = new ArchivosService(prisma as never, storage as never, {} as never, eventos as never);
  const auth = { tenantId: 'tenant-1', userId: 'usuario-1' } as CurrentAuth;
  return { service, auth, tx, prisma, storage, eventos };
}

describe('Confirmación de archivos y actividad', () => {
  it.each([false, true])('registra la subida junto con el estado y los bytes; archivo de ítem: %s', async (item) => {
    const { service, auth, tx, eventos } = setup({ item });
    await service.confirmar(auth, 'archivo-1');
    expect(tx.archivo.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'archivo-1', tenantId: 'tenant-1', estado: 'PENDIENTE' } }));
    expect(tx.tenant.update).toHaveBeenCalledTimes(1);
    expect(eventos.publicarDesdeAuth).toHaveBeenCalledWith(auth, expect.objectContaining({ tipo: 'archivo.orden_confirmado', href: '/produccion/ordenes/ot-1', mensaje: 'arte-final.pdf' }), tx);
  });
  it('reintentar un archivo listo no duplica eventos ni bytes', async () => {
    const { service, auth, prisma, eventos } = setup({ confirmado: true });
    await service.confirmar(auth, 'archivo-1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(eventos.publicarDesdeAuth).not.toHaveBeenCalled();
  });
  it('una confirmación concurrente sólo publica si obtiene la transición', async () => {
    const { service, auth, tx, eventos } = setup({ ganaConfirmacion: false });
    await service.confirmar(auth, 'archivo-1');
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(eventos.publicarDesdeAuth).not.toHaveBeenCalled();
  });
  it('una carga sin objeto confirmado no aparece en actividad', async () => {
    const { service, auth, storage, eventos, prisma } = setup();
    storage.cabecera.mockResolvedValue(null as never);
    await expect(service.confirmar(auth, 'archivo-1')).rejects.toThrow('almacenamiento');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(eventos.publicarDesdeAuth).not.toHaveBeenCalled();
  });
});
