import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { ArchivosService } from '../archivos.service';
import type { StorageDriver } from '../storage/storage.driver';
import { UMBRAL_MULTIPART } from '../storage/multipart';

/** Concurrencia real contra PostgreSQL; el storage simulado no usa red. */
describe('Cupo y ciclo de archivos (PostgreSQL de test)', () => {
  const prisma = new PrismaService();
  const objetos = new Map<string, Buffer>();
  const png = (bytes = 60) =>
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      Buffer.alloc(bytes - 8),
    ]);
  const storage = {
    nombre: 'local',
    firmarSubida: jest.fn((key: string) =>
      Promise.resolve({
        url: key,
        headers: {},
        expiraEn: 900,
      }),
    ),
    firmarDescarga: jest.fn((key: string) => Promise.resolve(key)),
    subir: jest.fn((key: string, contenido: Buffer) => {
      objetos.set(key, contenido);
      return Promise.resolve();
    }),
    cabecera: jest.fn((key: string) =>
      Promise.resolve(
        objetos.has(key)
          ? { bytes: objetos.get(key)!.length, contentType: 'image/png' }
          : null,
      ),
    ),
    leerCabecera: jest.fn((key: string) =>
      Promise.resolve(objetos.get(key) ?? null),
    ),
    borrar: jest.fn((key: string) => {
      objetos.delete(key);
      return Promise.resolve();
    }),
    abortarMultipart: jest.fn().mockResolvedValue(undefined),
    iniciarMultipart: jest.fn(
      async (
        _key: string,
        opciones: Parameters<StorageDriver['iniciarMultipart']>[1],
      ) => {
        await opciones.alCrear?.('multipart-test');
        return { uploadId: 'multipart-test', partes: [], tamanioParte: 100 };
      },
    ),
  };
  const eventos = { publicarDesdeAuth: jest.fn().mockResolvedValue(undefined) };
  const service = new ArchivosService(
    prisma,
    storage as unknown as StorageDriver,
    eventos as never,
  );
  let tenantId: string;
  let otroTenant: string;
  let userId: string;
  let cotizacionId: string;
  let auth: CurrentAuth;

  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
      throw new Error('Requiere base de test');
    await prisma.$connect();
    tenantId = (
      await prisma.tenant.create({
        data: {
          nombre: 'QA espacio',
          slug: `qa-espacio-${randomUUID()}`,
          cuotaBytesArchivos: 100,
        },
      })
    ).id;
    otroTenant = (
      await prisma.tenant.create({
        data: { nombre: 'QA aislado', slug: `qa-espacio-${randomUUID()}` },
      })
    ).id;
    userId = (
      await prisma.user.create({
        data: { email: `qa-espacio-${randomUUID()}@example.test` },
      })
    ).id;
    auth = { tenantId, userId } as CurrentAuth;
    cotizacionId = (
      await prisma.cotizacion.create({
        data: { tenantId, numero: `QA-${randomUUID()}` },
      })
    ).id;
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    objetos.clear();
    storage.subir.mockImplementation((key, contenido) => {
      objetos.set(key, contenido);
      return Promise.resolve();
    });
    storage.firmarSubida.mockImplementation((key) =>
      Promise.resolve({
        url: key,
        headers: {},
        expiraEn: 900,
      }),
    );
    storage.borrar.mockImplementation((key) => {
      objetos.delete(key);
      return Promise.resolve();
    });
    await prisma.archivo.deleteMany({
      where: { tenantId: { in: [tenantId, otroTenant] } },
    });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { cuotaBytesArchivos: 100, bytesArchivos: 0 },
    });
  });
  afterAll(async () => {
    await prisma.archivo.deleteMany({
      where: { tenantId: { in: [tenantId, otroTenant] } },
    });
    await prisma.cotizacion.delete({ where: { id: cotizacionId } });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otroTenant] } },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });
  const iniciar = (bytes = 60) =>
    service.iniciar(auth, {
      nombre: 'arte.png',
      mimeType: 'image/png',
      bytes,
      scope: 'TENANT_BRANDING',
    });
  async function cargar(bytes = 60) {
    const inicio = await iniciar(bytes);
    const fila = await prisma.archivo.findUniqueOrThrow({
      where: { id: inicio.archivoId },
    });
    objetos.set(fila.key, png(bytes));
    return fila;
  }
  async function listo(bytes = 60) {
    const fila = await cargar(bytes);
    await service.confirmar(auth, fila.id);
    return fila;
  }
  const generar = (bytes: number) =>
    service.materializar({
      tenantId,
      scope: 'COTIZACION',
      entidadId: cotizacionId,
      nombre: 'presupuesto.pdf',
      mimeType: 'application/pdf',
      contenido: Buffer.alloc(bytes),
    });

  it('reserva antes de firmar: dos cargas simultáneas compiten por el mismo espacio', async () => {
    const resultados = await Promise.allSettled([iniciar(), iniciar()]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(storage.firmarSubida).toHaveBeenCalledTimes(1);
    expect(await service.uso(tenantId)).toMatchObject({
      bytes: 0,
      bytesReservados: 60,
      cargasPendientes: 1,
      restanteBytes: 40,
      porcentaje: 60,
    });
  });
  it('convierte la reserva en bytes reales sin contarlos dos veces', async () => {
    const fila = await cargar();
    objetos.set(fila.key, png(40));
    await Promise.all([
      service.confirmar(auth, fila.id),
      service.confirmar(auth, fila.id),
    ]);
    expect(await service.uso(tenantId)).toMatchObject({
      bytes: 40,
      bytesReservados: 0,
      cargasPendientes: 0,
      restanteBytes: 60,
    });
  });
  it('detecta un tamaño real mayor aunque la declaración inicial entrara en el cupo', async () => {
    const fila = await cargar(40);
    await iniciar(50);
    objetos.set(fila.key, png(60));
    await expect(service.confirmar(auth, fila.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await service.uso(tenantId)).toMatchObject({
      bytes: 0,
      bytesReservados: 90,
    });
  });
  it('una firma fallida libera el cupo y conserva la clave para limpiar después', async () => {
    storage.firmarSubida.mockRejectedValueOnce(new Error('Firma fallida'));
    await expect(iniciar()).rejects.toThrow('Firma fallida');
    expect(await service.uso(tenantId)).toMatchObject({ bytesReservados: 0 });
    expect(
      await prisma.archivo.count({ where: { tenantId, estado: 'PURGANDO' } }),
    ).toBe(1);
    await expect(iniciar()).resolves.toHaveProperty('archivoId');
  });
  it('cancelar varias veces libera una sola reserva; no permite confirmar después', async () => {
    const fila = await cargar();
    await Promise.all([
      service.cancelarSubida(auth, fila.id),
      service.cancelarSubida(auth, fila.id),
    ]);
    expect(await service.uso(tenantId)).toMatchObject({
      bytesReservados: 0,
      bytes: 0,
    });
    await expect(service.confirmar(auth, fila.id)).rejects.toThrow(
      'ya no está disponible',
    );
    await expect(iniciar()).resolves.toHaveProperty('archivoId');
  });
  it('cancelar tras una confirmación cuya respuesta se perdió preserva el archivo', async () => {
    const fila = await listo();
    await service.cancelarSubida(auth, fila.id);
    expect(await service.uso(tenantId)).toMatchObject({ bytes: 60 });
    expect(
      (await prisma.archivo.findUniqueOrThrow({ where: { id: fila.id } }))
        .estado,
    ).toBe('LISTO');
  });
  it('la reserva vencida deja espacio libre sin esperar al cron y ya no se puede confirmar', async () => {
    const fila = await cargar();
    await prisma.archivo.update({
      where: { id: fila.id },
      data: { reservaHasta: new Date(Date.now() - 1000) },
    });
    expect(await service.uso(tenantId)).toMatchObject({ bytesReservados: 0 });
    await iniciar();
    await expect(service.confirmar(auth, fila.id)).rejects.toThrow('venció');
  });
  it('rechazar el contenido inválido libera la reserva', async () => {
    const fila = await cargar();
    objetos.set(fila.key, Buffer.from('un ejecutable no es una imagen PNG'));
    await expect(service.confirmar(auth, fila.id)).rejects.toThrow(
      'contenido no corresponde',
    );
    expect(await service.uso(tenantId)).toMatchObject({
      bytesReservados: 0,
      bytes: 0,
    });
  });
  it('borrar y restaurar concurrentemente no duplican los cambios del contador', async () => {
    const fila = await listo();
    await Promise.all([
      service.eliminar(auth, fila.id),
      service.eliminar(auth, fila.id),
    ]);
    expect(await service.uso(tenantId)).toMatchObject({
      bytes: 0,
      papelera: { bytes: 60, cantidad: 1 },
    });
    await Promise.all([
      service.restaurar(auth, fila.id),
      service.restaurar(auth, fila.id),
    ]);
    expect(await service.uso(tenantId)).toMatchObject({
      bytes: 60,
      papelera: { bytes: 0, cantidad: 0 },
    });
  });
  it('restaurar debe respetar el espacio reservado por otras cargas', async () => {
    const fila = await listo();
    await service.eliminar(auth, fila.id);
    await iniciar();
    await expect(service.restaurar(auth, fila.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await service.uso(tenantId)).toMatchObject({
      bytes: 0,
      bytesReservados: 60,
    });
  });
  it('dos restauraciones distintas no pueden superar juntas el cupo', async () => {
    const a = await listo();
    await service.eliminar(auth, a.id);
    const b = await listo();
    await service.eliminar(auth, b.id);
    const resultados = await Promise.allSettled([
      service.restaurar(auth, a.id),
      service.restaurar(auth, b.id),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await service.uso(tenantId)).toMatchObject({ bytes: 60 });
  });
  it('una reducción del cupo frena nuevas cargas pero conserva las descargas', async () => {
    const fila = await listo();
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { cuotaBytesArchivos: 40 },
    });
    expect(await service.uso(tenantId)).toMatchObject({
      excedidoBytes: 20,
      restanteBytes: 0,
    });
    await expect(iniciar(10)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.urlDeDescarga(fila.id)).resolves.toBe(fila.key);
  });
  it('revalida una reducción del cupo ocurrida mientras se subía', async () => {
    const fila = await cargar();
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { cuotaBytesArchivos: 40 },
    });
    await expect(service.confirmar(auth, fila.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await service.uso(tenantId)).toMatchObject({ bytes: 0 });
  });
  it('el aislamiento es explícito en uso y cancelación', async () => {
    const fila = await cargar();
    await expect(
      service.cancelarSubida({ ...auth, tenantId: otroTenant }, fila.id),
    ).rejects.toThrow('no encontrado');
    expect(await service.uso(otroTenant)).toMatchObject({
      bytes: 0,
      bytesReservados: 0,
      porScope: [],
    });
    expect(await service.uso(tenantId)).toMatchObject({ bytesReservados: 60 });
  });
  it('los PDF generados compiten con las reservas de los adjuntos antes de subir', async () => {
    await iniciar(60);
    await expect(generar(50)).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.subir).not.toHaveBeenCalled();
  });
  it('reemplaza un PDF utilizando sólo la diferencia y conserva un único vigente', async () => {
    const anterior = await generar(100);
    const nuevo = await generar(80);
    expect(nuevo.id).not.toBe(anterior.id);
    expect(await service.uso(tenantId)).toMatchObject({
      bytes: 80,
      bytesReservados: 0,
    });
    expect(
      await prisma.archivo.count({
        where: { tenantId, estado: 'LISTO', generado: true },
      }),
    ).toBe(1);
    expect(
      (await prisma.archivo.findUniqueOrThrow({ where: { id: anterior.id } }))
        .estado,
    ).toBe('ELIMINADO');
  });
  it('si falla el reemplazo del PDF, mantiene disponible la versión anterior', async () => {
    const anterior = await generar(80);
    storage.subir.mockRejectedValueOnce(new Error('Storage caído'));
    await expect(generar(100)).rejects.toThrow('Storage caído');
    expect(await service.uso(tenantId)).toMatchObject({
      bytes: 80,
      bytesReservados: 0,
    });
    expect(
      (await prisma.archivo.findUniqueOrThrow({ where: { id: anterior.id } }))
        .estado,
    ).toBe('LISTO');
  });
  it('registra el multipart antes de firmar y conserva el ID aunque falle la firma', async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { cuotaBytesArchivos: UMBRAL_MULTIPART * 3 },
    });
    storage.iniciarMultipart.mockImplementationOnce(async (_key, opciones) => {
      await opciones.alCrear?.('upload-creado-remotamente');
      throw new Error('Falló la firma de una parte');
    });
    await expect(iniciar(UMBRAL_MULTIPART + 1)).rejects.toThrow(
      'Falló la firma',
    );
    const fila = await prisma.archivo.findFirstOrThrow({ where: { tenantId } });
    expect(fila).toMatchObject({
      estado: 'PURGANDO',
      multipartUploadId: 'upload-creado-remotamente',
      bytesReservados: 0n,
    });
    await prisma.archivo.update({
      where: { id: fila.id },
      data: { reservaHasta: new Date(Date.now() - 1000) },
    });
    await service.barrerPendientes();
    expect(storage.abortarMultipart).toHaveBeenCalledWith(
      fila.key,
      'upload-creado-remotamente',
    );
  });
  it('conserva el rastro de una carga cancelada para limpiar un PUT tardío', async () => {
    const fila = await cargar();
    await service.cancelarSubida(auth, fila.id);
    await service.barrerPendientes();
    expect(
      await prisma.archivo.findUnique({ where: { id: fila.id } }),
    ).not.toBeNull();
    await prisma.archivo.update({
      where: { id: fila.id },
      data: { reservaHasta: new Date(Date.now() - 1000) },
    });
    await service.barrerPendientes();
    expect(
      await prisma.archivo.findUnique({ where: { id: fila.id } }),
    ).toBeNull();
    expect(objetos.has(fila.key)).toBe(false);
  });
  it('una purga fallida queda rastreable y no permite restaurar durante el borrado', async () => {
    const fila = await listo();
    await service.eliminar(auth, fila.id);
    await prisma.archivo.update({
      where: { id: fila.id },
      data: { eliminadoEl: new Date(Date.now() - 31 * 86400000) },
    });
    storage.borrar.mockRejectedValueOnce(
      new Error('Storage temporalmente caído'),
    );
    await service.purgarPapelera();
    expect(
      (await prisma.archivo.findUniqueOrThrow({ where: { id: fila.id } }))
        .estado,
    ).toBe('PURGANDO');
    await expect(service.restaurar(auth, fila.id)).rejects.toThrow(
      'no está en la papelera',
    );
    await service.barrerPendientes();
    expect(
      await prisma.archivo.findUnique({ where: { id: fila.id } }),
    ).toBeNull();
  });
  it('reconcilia sólo bytes confirmados sin transformar reservas en consumo', async () => {
    await listo(40);
    await iniciar(30);
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { bytesArchivos: 80 },
    });
    await service.resincronizarContadores();
    expect(await service.uso(tenantId)).toMatchObject({
      bytes: 40,
      bytesReservados: 30,
      restanteBytes: 30,
    });
  });
});
