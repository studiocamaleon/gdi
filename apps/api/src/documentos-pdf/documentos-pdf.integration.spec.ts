import { randomUUID } from 'node:crypto';
import type { Job, Queue } from 'bullmq';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ArchivosService } from '../archivos/archivos.service';
import { PresupuestosService } from '../presupuestos/presupuestos.service';
import type { PresupuestoPdfDatos } from '../presupuestos/presupuesto-pdf.service';
import { DocumentosPdfService, hashDatosPdf } from './documentos-pdf.service';
import { DocumentosPdfWorker, PdfJob } from './documentos-pdf.worker';

const datos: PresupuestoPdfDatos = {
  numero: 'PRES-QA',
  negocio: 'Imprenta',
  cliente: 'Cliente',
  vendedor: null,
  fechaEmision: '2026-09-17',
  fechaValidez: '2026-09-30',
  observaciones: null,
  senaSugeridaPct: 50,
  condicionesTexto: 'Condiciones originales',
  subtotal: 1000,
  impuestos: 210,
  cargosDirectos: 0,
  total: 1210,
  items: [
    {
      nombre: 'Tarjetas',
      cantidad: 500,
      cantidadUnidad: 'u.',
      total: 1210,
      specs: [],
      adicionales: [],
    },
  ],
};

describe('documentos PDF durables (PostgreSQL de test)', () => {
  const prisma = new PrismaService();
  const documentos = new DocumentosPdfService(prisma);
  const storage = {
    subir: jest.fn().mockResolvedValue(undefined),
    firmarDescarga: jest.fn().mockResolvedValue('https://storage.test/pdf'),
  };
  const archivos = new ArchivosService(prisma, storage as never, {} as never);
  const renderer = {
    generar: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7 ejemplo')),
  };
  const tenants = {
    adquirir: jest.fn().mockResolvedValue({
      clave: 'test',
      propietario: 'test',
      duracionMs: 120000,
    }),
    renovar: jest.fn().mockResolvedValue(true),
    liberar: jest.fn().mockResolvedValue(undefined),
  };
  let worker: DocumentosPdfWorker;
  let tenantId: string;
  let otroTenant: string;
  let cotizacionId: string;
  const envAnterior = process.env.PRESUPUESTO_PDF_ASYNC;
  const colaAnterior = process.env.PDF_QUEUE_NAME;
  const colasTest: string[] = [];

  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
      throw new Error('Requiere una base de test.');
    await prisma.$connect();
    tenantId = (
      await prisma.tenant.create({
        data: {
          nombre: 'QA PDF',
          slug: `qa-pdf-${randomUUID()}`,
          cuotaBytesArchivos: 1000000,
        },
      })
    ).id;
    otroTenant = (
      await prisma.tenant.create({
        data: {
          nombre: 'QA aislado',
          slug: `qa-pdf-${randomUUID()}`,
          cuotaBytesArchivos: 1000000,
        },
      })
    ).id;
  });
  beforeEach(async () => {
    process.env.PDF_QUEUE_NAME = `pdf-test-${randomUUID()}`;
    colasTest.push(`pdf-dispatch-${process.env.PDF_QUEUE_NAME}`);
    jest.clearAllMocks();
    renderer.generar
      .mockReset()
      .mockResolvedValue(Buffer.from('%PDF-1.7 ejemplo'));
    storage.subir.mockReset().mockResolvedValue(undefined);
    tenants.renovar.mockReset().mockResolvedValue(true);
    worker = new DocumentosPdfWorker(
      prisma,
      renderer as never,
      archivos,
      tenants as never,
    );
    cotizacionId = (
      await prisma.cotizacion.create({
        data: { tenantId, numero: `PRES-${randomUUID()}` },
      })
    ).id;
    process.env.PRESUPUESTO_PDF_ASYNC = 'true';
  });
  afterEach(async () => {
    await prisma.archivo.deleteMany({ where: { tenantId } });
    await prisma.documentoPdf.deleteMany({ where: { tenantId } });
    await prisma.cotizacion.deleteMany({ where: { tenantId } });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { cuotaBytesArchivos: 1000000, bytesArchivos: 0 },
    });
  });
  afterAll(async () => {
    if (colaAnterior === undefined) delete process.env.PDF_QUEUE_NAME;
    else process.env.PDF_QUEUE_NAME = colaAnterior;
    await prisma.cronLock.deleteMany({ where: { nombre: { in: colasTest } } });
    if (envAnterior === undefined) delete process.env.PRESUPUESTO_PDF_ASYNC;
    else process.env.PRESUPUESTO_PDF_ASYNC = envAnterior;
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otroTenant] } },
    });
    await prisma.$disconnect();
  });
  const registrar = (revision = 2) =>
    prisma.$transaction((tx) =>
      documentos.registrar(
        tx,
        documentos.preparar(tenantId, cotizacionId, revision, datos),
      ),
    );
  const job = (doc: { id: string; ronda: number; intentos: number }) =>
    ({
      id: `test-${randomUUID()}`,
      data: {
        documentoId: doc.id,
        tenantId,
        ronda: doc.ronda,
        intentoAnterior: doc.intentos,
      },
    }) as Job<PdfJob>;
  function presupuestoService() {
    return new PresupuestosService(
      prisma,
      {} as never,
      archivos,
      {} as never,
      {} as never,
      { emitir: jest.fn().mockResolvedValue(undefined) } as never,
      {
        regional: jest
          .fn()
          .mockResolvedValue({ zonaHoraria: 'America/Argentina/Buenos_Aires' }),
      } as never,
      {
        reservarParaPresupuesto: jest.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      documentos,
    );
  }
  function colaMock() {
    const queue = {
      setGlobalConcurrency: jest.fn().mockResolvedValue(undefined),
      getJobs: jest.fn().mockResolvedValue([]),
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(worker, 'queue', {
      value: queue as unknown as Queue<PdfJob>,
    });
    return queue;
  }

  it('conserva el primer snapshot, incluso si dos solicitudes compiten', async () => {
    const [a, b] = await Promise.all([registrar(), registrar()]);
    expect(a.id).toBe(b.id);
    await prisma.$transaction((tx) =>
      documentos.registrar(
        tx,
        documentos.preparar(tenantId, cotizacionId, 2, {
          ...datos,
          total: 9999,
        }),
      ),
    );
    const guardado = await documentos.buscar(tenantId, cotizacionId, 2);
    expect(guardado?.datosHash).toBe(hashDatosPdf(datos));
    expect(
      hashDatosPdf(guardado!.datosJson as unknown as PresupuestoPdfDatos),
    ).toBe(a.datosHash);
    await expect(
      prisma.documentoPdf.update({
        where: { id: a.id },
        data: { datosHash: 'alterado' },
      }),
    ).rejects.toThrow('inmutable');
  });

  it('no publica archivos ni consume cuota dos veces ante trabajos duplicados', async () => {
    const doc = await registrar();
    await Promise.all([worker.procesar(job(doc)), worker.procesar(job(doc))]);
    await worker.procesar(job(doc));
    expect(renderer.generar).toHaveBeenCalledTimes(1);
    expect(
      await prisma.archivo.count({ where: { tenantId, estado: 'LISTO' } }),
    ).toBe(1);
    const listo = await documentos.buscar(tenantId, cotizacionId, 2);
    expect(listo?.estado).toBe('LISTO');
    expect(
      (await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }))
        .bytesArchivos,
    ).toBe(listo!.archivo!.bytes);
    await expect(
      prisma.documentoPdf.update({
        where: { id: doc.id },
        data: { estado: 'PENDIENTE' },
      }),
    ).rejects.toThrow('no puede reemplazarse');
  });

  it('guarda borrador y emitido separados, y el final no queda marcado como borrador', async () => {
    const previo = await registrar(1);
    await worker.procesar(job(previo));
    const final = await registrar(2);
    await worker.procesar(job(final));
    expect(
      await prisma.archivo.count({ where: { tenantId, estado: 'LISTO' } }),
    ).toBe(2);
    const nombres = (await prisma.archivo.findMany({ where: { tenantId } }))
      .map((a) => a.nombreOriginal)
      .sort();
    expect(nombres).toEqual(['PRES-QA-borrador.pdf', 'PRES-QA.pdf']);
  });

  it('reintenta tres veces y una recuperación manual reutiliza los mismos datos', async () => {
    let doc = await registrar();
    renderer.generar.mockRejectedValue(new Error('Renderer caído'));
    for (let intento = 1; intento <= 3; intento++) {
      await expect(worker.procesar(job(doc))).rejects.toThrow('Renderer caído');
      doc = await prisma.documentoPdf.findUniqueOrThrow({
        where: { id: doc.id },
      });
      expect(doc.intentos).toBe(intento);
      expect(doc.estado).toBe(intento < 3 ? 'PENDIENTE' : 'FALLIDO');
    }
    const reintento = await documentos.reintentar(tenantId, cotizacionId, 2);
    expect(reintento).toMatchObject({
      ronda: 1,
      intentos: 0,
      datosHash: doc.datosHash,
    });
    renderer.generar.mockResolvedValue(Buffer.from('%PDF-1.7 recuperado'));
    await worker.procesar(job(reintento!));
    expect((await documentos.buscar(tenantId, cotizacionId, 2))?.estado).toBe(
      'LISTO',
    );
  });

  it('rechaza por cuota antes de subir y no deja archivos ni reservas', async () => {
    const doc = await registrar();
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { cuotaBytesArchivos: 1 },
    });
    await expect(worker.procesar(job(doc))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(
      (await documentos.buscar(tenantId, cotizacionId, 2))?.errorCodigo,
    ).toBe('SIN_ESPACIO');
    expect(
      (await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }))
        .bytesArchivos,
    ).toBe(0n);
    expect(
      await prisma.archivo.count({ where: { tenantId, estado: 'LISTO' } }),
    ).toBe(0);
    expect(
      await prisma.archivo.count({ where: { tenantId, estado: 'PENDIENTE' } }),
    ).toBe(0);
    expect(storage.subir).not.toHaveBeenCalled();
  });

  it('un fallo de almacenamiento no publica un PDF incompleto', async () => {
    const doc = await registrar();
    storage.subir.mockRejectedValueOnce(new Error('Storage no disponible'));
    await expect(worker.procesar(job(doc))).rejects.toThrow(
      'Storage no disponible',
    );
    expect((await documentos.buscar(tenantId, cotizacionId, 2))?.estado).toBe(
      'PENDIENTE',
    );
    expect(
      await prisma.archivo.count({ where: { tenantId, estado: 'PURGANDO' } }),
    ).toBe(1);
    expect(
      (await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }))
        .bytesArchivos,
    ).toBe(0n);
  });

  it('impide publicar a un worker cuyo lease venció durante la subida', async () => {
    const doc = await registrar();
    storage.subir.mockImplementationOnce(async () => {
      await prisma.documentoPdf.update({
        where: { id: doc.id },
        data: { leaseToken: randomUUID() },
      });
    });
    await expect(worker.procesar(job(doc))).rejects.toThrow(
      'PDF_LEASE_PERDIDO',
    );
    expect(
      await prisma.archivo.count({ where: { tenantId, estado: 'LISTO' } }),
    ).toBe(0);
  });

  it('recupera leases vencidos y trabajos Redis terminales que no llegaron a reclamar el documento', async () => {
    const doc = await registrar();
    await prisma.documentoPdf.update({
      where: { id: doc.id },
      data: {
        estado: 'PROCESANDO',
        intentos: 1,
        leaseToken: randomUUID(),
        leaseHasta: new Date(0),
      },
    });
    const queue = colaMock();
    const remove = jest.fn().mockResolvedValue(undefined);
    queue.getJob.mockResolvedValue({
      getState: () => Promise.resolve('failed'),
      remove,
    } as never);
    await worker.despachar();
    expect(remove).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'render',
      expect.objectContaining({ documentoId: doc.id, intentoAnterior: 1 }),
      expect.anything(),
    );
    expect((await documentos.buscar(tenantId, cotizacionId, 2))?.estado).toBe(
      'PENDIENTE',
    );
  });

  it('conserva la solicitud cuando Redis está caído y vuelve a despacharla al recuperarse', async () => {
    const doc = await registrar();
    const queue = colaMock();
    queue.setGlobalConcurrency.mockRejectedValueOnce(new Error('Redis caído'));
    await worker.despachar();
    expect((await documentos.buscar(tenantId, cotizacionId, 2))?.estado).toBe(
      'PENDIENTE',
    );
    expect(queue.add).not.toHaveBeenCalled();
    // El scheduler real vuelve en otra pasada. Forzamos ese instante: un
    // timestamp(3) recién liberado puede redondearse al mismo ms que NOW().
    await prisma.cronLock.update({
      where: { nombre: `pdf-dispatch-${process.env.PDF_QUEUE_NAME}` },
      data: { expiraEl: new Date(0) },
    });
    await worker.despachar();
    expect(queue.add).toHaveBeenCalledWith(
      'render',
      expect.objectContaining({ documentoId: doc.id }),
      expect.anything(),
    );
  });

  it('rechaza consultas y reintentos de otro tenant', async () => {
    await registrar();
    expect(await documentos.buscar(otroTenant, cotizacionId, 2)).toBeNull();
    await expect(
      documentos.reintentar(otroTenant, cotizacionId, 2),
    ).rejects.toThrow('No se encontró');
    await expect(
      presupuestoService().estadoPdf(
        { tenantId: otroTenant } as never,
        cotizacionId,
      ),
    ).rejects.toThrow('no existe');
  });

  it('reutiliza el PDF histórico sin crear un nuevo snapshot', async () => {
    await prisma.archivo.create({
      data: {
        tenantId,
        cotizacionId,
        scope: 'COTIZACION',
        generado: true,
        estado: 'LISTO',
        key: `qa/${randomUUID()}`,
        nombreOriginal: 'original.pdf',
        mimeType: 'application/pdf',
        bytes: 123,
      },
    });
    expect(
      await presupuestoService().estadoPdf({ tenantId } as never, cotizacionId),
    ).toMatchObject({ estado: 'listo' });
    expect(await prisma.documentoPdf.count({ where: { cotizacionId } })).toBe(
      0,
    );
    expect(renderer.generar).not.toHaveBeenCalled();
  });

  it('dos publicaciones concurrentes no pueden superar juntas la cuota disponible', async () => {
    const a = await registrar(1);
    const b = await registrar(2);
    const bytes = Buffer.byteLength('%PDF-1.7 ejemplo');
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { cuotaBytesArchivos: bytes },
    });
    const resultados = await Promise.allSettled([
      worker.procesar(job(a)),
      worker.procesar(job(b)),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.archivo.count({ where: { tenantId, estado: 'LISTO' } }),
    ).toBe(1);
    expect(
      (await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }))
        .bytesArchivos,
    ).toBe(BigInt(bytes));
  });

  it('rechaza un snapshot corrupto antes de llamar al renderer', async () => {
    const entrada = documentos.preparar(tenantId, cotizacionId, 2, datos);
    const doc = await prisma.$transaction((tx) =>
      documentos.registrar(tx, { ...entrada, datosHash: 'corrupto' }),
    );
    await expect(worker.procesar(job(doc))).rejects.toThrow(
      'PDF_SNAPSHOT_INVALIDO',
    );
    expect(renderer.generar).not.toHaveBeenCalled();
    expect((await documentos.buscar(tenantId, cotizacionId, 2))?.estado).toBe(
      'FALLIDO',
    );
  });

  it('revierte el envío si no pudo guardar su snapshot en la misma transacción', async () => {
    const service = presupuestoService();
    jest.spyOn(service, 'datosPdf').mockResolvedValue(datos);
    const registrarSpy = jest
      .spyOn(documentos, 'registrar')
      .mockRejectedValueOnce(new Error('Outbox no disponible'));
    await expect(
      (
        service as unknown as {
          ejecutarEnvio: (
            a: unknown,
            c: unknown,
            o: unknown,
          ) => Promise<unknown>;
        }
      ).ejecutarEnvio(
        { tenantId },
        {
          id: cotizacionId,
          clienteId: null,
          publicToken: null,
          fechaValidez: new Date('2026-09-30'),
          emisionJson: { items: [] },
        },
        { reenvio: false },
      ),
    ).rejects.toThrow('Outbox no disponible');
    registrarSpy.mockRestore();
    expect(
      (
        await prisma.cotizacion.findUniqueOrThrow({
          where: { id: cotizacionId },
        })
      ).estado,
    ).toBe('borrador');
    expect(await prisma.documentoPdf.count({ where: { cotizacionId } })).toBe(
      0,
    );
  });
});
