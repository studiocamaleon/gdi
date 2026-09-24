import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CorreoPresupuestoService } from '../correo-presupuesto.service';
import type { CurrentAuth } from '../../auth/auth.types';

describe('correo de presupuestos (PostgreSQL de test, transporte simulado)', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const otroTenantId = randomUUID();
  const userId = randomUUID();
  const clienteId = randomUUID();
  const auth = {
    tenantId,
    userId,
    email: 'comercial@example.test',
    role: 'ADMINISTRADOR',
  } as CurrentAuth;
  const presupuestos = {
    estadoPdf: jest.fn(),
    enviar: jest.fn(),
    reintentarPdf: jest.fn(),
  };
  const pdf = Buffer.from('%PDF-1.7\nPDF emitido, sin recalcular');
  const archivos = { leerContenido: jest.fn() };
  const capacidades = { exigir: jest.fn() };
  const transporte = {
    disponible: true,
    remitente: () => 'Imprenta vía Grafo <registro@grafo.test>',
    enviar: jest.fn(),
  };
  const service = new CorreoPresupuestoService(
    prisma,
    presupuestos as never,
    archivos as never,
    capacidades as never,
    transporte as never,
  );
  let cotizacionId: string;
  let archivoId: string;
  const entrada = () => ({
    idempotencia: randomUUID(),
    para: 'cliente@example.test',
    asunto: 'Tu presupuesto',
    mensaje: 'Hola, adjuntamos tu presupuesto.',
  });
  const obtener = (id: string) =>
    prisma.correoPresupuesto.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
      throw new Error('Requiere una base de test.');
    await prisma.$connect();
    await prisma.tenant.createMany({
      data: [tenantId, otroTenantId].map((id) => ({
        id,
        nombre: 'Imprenta QA',
        slug: `qa-correo-${id}`,
      })),
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `qa-${userId}@example.test`,
        nombreCompleto: 'Comercial QA',
      },
    });
    await prisma.datosEmpresa.create({
      data: { tenantId, email: 'ventas@imprenta.test' },
    });
    await prisma.cliente.create({
      data: {
        id: clienteId,
        tenantId,
        nombre: 'Cliente QA',
        emailPrincipal: 'cliente@example.test',
        telefonoCodigo: '54',
        telefonoNumero: '11111111',
        paisCodigo: 'AR',
      },
    });
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    presupuestos.estadoPdf.mockResolvedValue({
      estado: 'listo',
      url: 'https://storage.test/solo-vista',
    });
    presupuestos.reintentarPdf.mockResolvedValue({ estado: 'preparando' });
    archivos.leerContenido.mockResolvedValue(pdf);
    transporte.disponible = true;
    transporte.enviar.mockReset().mockResolvedValue('resend-simulado');
    capacidades.exigir.mockReset().mockResolvedValue(undefined);
    cotizacionId = (
      await prisma.cotizacion.create({
        data: {
          tenantId,
          clienteId,
          numero: `PRES-${randomUUID()}`,
          estado: 'enviado',
          fechaValidez: new Date('2099-01-01'),
          publicToken: randomUUID(),
        },
      })
    ).id;
    archivoId = (
      await prisma.archivo.create({
        data: {
          tenantId,
          cotizacionId,
          key: `t/${tenantId}/${randomUUID()}.pdf`,
          scope: 'COTIZACION',
          generado: true,
          nombreOriginal: 'presupuesto.pdf',
          mimeType: 'application/pdf',
          bytes: pdf.length,
          estado: 'LISTO',
        },
      })
    ).id;
  });
  afterEach(async () => {
    await prisma.archivo.deleteMany({ where: { tenantId } });
    await prisma.documentoPdf.deleteMany({ where: { tenantId } });
    await prisma.cotizacion.deleteMany({ where: { tenantId } });
    await prisma.configuracionPresupuestos.deleteMany({ where: { tenantId } });
  });
  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otroTenantId] } },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('completa datos del catálogo y permite una plantilla y respuesta propias del tenant', async () => {
    expect(await service.preparar(auth, cotizacionId)).toMatchObject({
      para: 'cliente@example.test',
      responderA: 'ventas@imprenta.test',
      mensaje: expect.stringContaining('Cliente QA'),
    });
    await prisma.configuracionPresupuestos.create({
      data: {
        tenantId,
        correoResponderA: 'comercial@imprenta.test',
        correoAsunto: '{cliente} · {presupuesto}',
        correoMensaje: 'Saludos desde {empresa}',
      },
    });
    expect(await service.preparar(auth, cotizacionId)).toMatchObject({
      responderA: 'comercial@imprenta.test',
      asunto: expect.stringContaining('Cliente QA · PRES-'),
      mensaje: 'Saludos desde Imprenta QA',
    });
  });

  it('encola sin enviar todavía, adjunta el PDF emitido y conserva el contenido editable en el historial', async () => {
    const dto = entrada();
    const result = await service.encolar(auth, cotizacionId, dto);
    expect(result.estado).toBe('PENDIENTE');
    expect(transporte.enviar).not.toHaveBeenCalled();
    expect(
      (
        await prisma.cotizacion.findUniqueOrThrow({
          where: { id: cotizacionId },
        })
      ).notificarWhatsapp,
    ).toBe(false);
    await service.procesar(await obtener(result.id));
    expect(transporte.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        pdf,
        asunto: dto.asunto,
        mensaje: dto.mensaje,
        para: dto.para,
        responderA: 'ventas@imprenta.test',
        archivoId,
        url: expect.stringContaining('/p/'),
      }),
    );
    expect((await service.historial(auth, cotizacionId))[0]).toMatchObject({
      estado: 'ENVIADO',
      asunto: dto.asunto,
      mensaje: dto.mensaje,
    });
    expect(
      await prisma.cotizacionEvento.count({
        where: { cotizacionId, tipo: 'correo_enviado' },
      }),
    ).toBe(1);
  });

  it('deduplica peticiones y workers concurrentes y no permite cambiar los datos de la misma clave', async () => {
    const dto = entrada();
    const [a, b] = await Promise.all([
      service.encolar(auth, cotizacionId, dto),
      service.encolar(auth, cotizacionId, dto),
    ]);
    expect(a.id).toBe(b.id);
    const fila = await obtener(a.id);
    await Promise.all([service.procesar(fila), service.procesar(fila)]);
    expect(transporte.enviar).toHaveBeenCalledTimes(1);
    await expect(
      service.encolar(auth, cotizacionId, { ...dto, asunto: 'Otro asunto' }),
    ).rejects.toThrow('otro envío');
    await service.procesar(await obtener(a.id));
    expect(transporte.enviar).toHaveBeenCalledTimes(1);
  });

  it('falla sin enviar si falta el PDF y permite reintentar con la misma identidad', async () => {
    const { id } = await service.encolar(auth, cotizacionId, entrada());
    archivos.leerContenido.mockResolvedValueOnce(null);
    await service.procesar(await obtener(id));
    expect((await obtener(id)).estado).toBe('FALLIDO');
    expect(transporte.enviar).not.toHaveBeenCalled();
    await service.reintentar(auth, cotizacionId, id);
    await service.procesar(await obtener(id));
    expect((await obtener(id)).estado).toBe('ENVIADO');
    expect(transporte.enviar.mock.calls[0][0].id).toBe(id);
  });

  it('no cambia el canal ni crea un envío si falla la preparación del PDF', async () => {
    presupuestos.estadoPdf.mockResolvedValueOnce({ estado: 'fallido' });
    await expect(
      service.encolar(auth, cotizacionId, entrada()),
    ).rejects.toThrow('generar el PDF');
    expect(
      await prisma.correoPresupuesto.count({ where: { cotizacionId } }),
    ).toBe(0);
    expect(
      (
        await prisma.cotizacion.findUniqueOrThrow({
          where: { id: cotizacionId },
        })
      ).notificarWhatsapp,
    ).toBe(true);
  });

  it('revierte el envío si el cliente resuelve el presupuesto mientras se prepara el PDF', async () => {
    presupuestos.estadoPdf.mockImplementationOnce(async () => {
      await prisma.cotizacion.update({
        where: { id: cotizacionId },
        data: { estado: 'aprobado' },
      });
      return { estado: 'listo' };
    });
    await expect(
      service.encolar(auth, cotizacionId, entrada()),
    ).rejects.toThrow('El presupuesto cambió');
    expect(
      await prisma.correoPresupuesto.count({ where: { cotizacionId } }),
    ).toBe(0);
    expect(
      (
        await prisma.cotizacion.findUniqueOrThrow({
          where: { id: cotizacionId },
        })
      ).notificarWhatsapp,
    ).toBe(true);
  });

  it('espera el PDF emitido sin sustituirlo por un documento de borrador', async () => {
    const doc = await prisma.documentoPdf.create({
      data: {
        tenantId,
        cotizacionId,
        revision: 2,
        plantillaVersion: 'qa',
        datosHash: 'a'.repeat(64),
        datosJson: {},
      },
    });
    const { id } = await service.encolar(auth, cotizacionId, entrada());
    expect((await obtener(id)).archivoId).toBeNull();
    await service.procesar(await obtener(id));
    expect((await obtener(id)).estado).toBe('PENDIENTE');
    expect(transporte.enviar).not.toHaveBeenCalled();
    await prisma.archivo.update({
      where: { id: archivoId },
      data: { documentoPdfId: doc.id },
    });
    await prisma.documentoPdf.update({
      where: { id: doc.id },
      data: { estado: 'LISTO' },
    });
    await service.procesar(await obtener(id));
    expect((await obtener(id)).estado).toBe('ENVIADO');
  });

  it.each(['pendiente_aprobacion', 'rechazado', 'aprobado', 'vencido'])(
    'no envía un presupuesto %s',
    async (estado) => {
      await prisma.cotizacion.update({
        where: { id: cotizacionId },
        data: { estado },
      });
      await expect(
        service.encolar(auth, cotizacionId, entrada()),
      ).rejects.toThrow('Sólo podés enviar');
      expect(transporte.enviar).not.toHaveBeenCalled();
      expect(
        await prisma.correoPresupuesto.count({ where: { cotizacionId } }),
      ).toBe(0);
    },
  );

  it('bloquea historial, envío y reintento desde otra empresa', async () => {
    const { id } = await service.encolar(auth, cotizacionId, entrada());
    const otroAuth = { ...auth, tenantId: otroTenantId };
    await expect(service.historial(otroAuth, cotizacionId)).rejects.toThrow(
      'no existe',
    );
    await expect(
      service.encolar(otroAuth, cotizacionId, entrada()),
    ).rejects.toThrow('no existe');
    await expect(
      service.reintentar(otroAuth, cotizacionId, id),
    ).rejects.toThrow('no existe');
  });

  it('una baja de capacidades antes del despacho impide enviar sin PDF o sin aprobación pública', async () => {
    const { id } = await service.encolar(auth, cotizacionId, entrada());
    capacidades.exigir.mockRejectedValue(
      new Error('La función no está incluida.'),
    );
    await service.procesar(await obtener(id));
    expect((await obtener(id)).estado).toBe('FALLIDO');
    expect(transporte.enviar).not.toHaveBeenCalled();
  });

  it('no reintenta fuera de la ventana de idempotencia de Resend', async () => {
    const { id } = await service.encolar(auth, cotizacionId, entrada());
    await prisma.correoPresupuesto.update({
      where: { id },
      data: {
        estado: 'FALLIDO',
        primerIntentoEl: new Date(Date.now() - 24 * 3600_000),
      },
    });
    await expect(service.reintentar(auth, cotizacionId, id)).rejects.toThrow(
      'reintento seguro',
    );
    expect(transporte.enviar).not.toHaveBeenCalled();
  });
});
