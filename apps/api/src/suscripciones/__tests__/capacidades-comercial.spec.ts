import { TipoEnlacePublico } from '@prisma/client';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { contratoCompatible } from '../evaluador-capacidades';
import { resolverAccesoEmpresa } from '../acceso-empresa';
import type { CurrentAuth } from '../../auth/auth.types';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { OrdenesTrabajoService } from '../../ordenes-trabajo/ordenes-trabajo.service';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { CotizacionJobsService } from '../../workers/cotizacion/cotizacion-jobs.service';
import { EnlacesPublicosService } from '../../enlaces-publicos/enlaces-publicos.service';
import { DocumentosPdfService } from '../../documentos-pdf/documentos-pdf.service';
import { DocumentosPdfWorker } from '../../documentos-pdf/documentos-pdf.worker';
import { RecibosService } from '../../administracion/recibos.service';
import { ComprobantesService } from '../../administracion/comprobantes.service';
import { PresupuestoPilotoService } from '../../presupuestos/pdf-piloto/presupuesto-piloto.service';

const auth = { tenantId: 'empresa', userId: 'usuario' } as CurrentAuth;
function capacidades(funciones: Record<string, boolean>) {
  const service = new CapacidadesEmpresaService({} as never);
  const contrato = contratoCompatible(null);
  Object.assign(contrato.funciones, funciones);
  jest.spyOn(service, 'actual').mockResolvedValue({
    empresa: { id: auth.tenantId, nombre: 'Prueba' },
    contrato,
    acceso: resolverAccesoEmpresa(true, null),
    almacenamientoAjustadoBytes: null,
  });
  return service;
}
function presupuesto(
  caps: CapacidadesEmpresaService,
  prisma = {},
  archivos = {},
) {
  return new PresupuestosService(
    prisma as never,
    {} as never,
    archivos as never,
    {} as never,
    { sincronizar: jest.fn() } as never,
    {} as never,
    {} as never,
    { reservarParaPresupuesto: jest.fn() } as never,
    { exigirCompromisoTx: jest.fn() } as never,
    new DocumentosPdfService(prisma as never, caps),
    caps,
  );
}
function ordenes(caps: CapacidadesEmpresaService, prisma = {}) {
  return new OrdenesTrabajoService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    caps,
  );
}

describe('Capacidades comerciales y continuidad del historial', () => {
  it('detiene cotización síncrona, persistida y en cola antes de calcular o crear trabajos', async () => {
    const caps = capacidades({ cotizacion: false });
    const motor = new MotorUniversalService(
      {} as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      caps,
    );
    const input = { tenantId: auth.tenantId } as never;
    for (const resultado of [
      motor.cotizar(input),
      motor.cotizarYGuardar(input),
      motor.recotizarItem(input),
      new CotizacionJobsService(caps).crear({ cotizacion: input }),
    ])
      await expect(resultado).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'cotizacion' },
      });
  });

  it('impide emitir presupuestos nuevos o convertirlos en OT sin la capacidad correspondiente', async () => {
    const service = presupuesto(
      capacidades({ presupuestos: false, ordenes: false }),
    );
    await expect(service.emitir(auth, {} as never)).rejects.toMatchObject({
      status: 403,
      response: { capacidad: 'presupuestos' },
    });
    await expect(
      service.convertir(auth, 'presupuesto', {} as never),
    ).rejects.toMatchObject({
      status: 403,
      response: { capacidad: 'ordenes' },
    });
    await expect(
      service.actualizarConfig(auth.tenantId, {} as never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('permite emitir sin crear enlace ni PDF cuando esos complementos están excluidos', async () => {
    const caps = capacidades({
      aprobacion_presupuestos: false,
      documentos_pdf: false,
    });
    const c = {
      id: 'presupuesto',
      numero: 'PRES-1',
      estado: 'borrador',
      clienteId: 'cliente',
      publicToken: null,
      fechaValidez: new Date('2099-01-01'),
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      cotizacion: { findFirst: jest.fn().mockResolvedValue(c), updateMany },
      $transaction: (fn: (tx: unknown) => unknown) =>
        Promise.resolve(fn(prisma)),
    };
    const service = presupuesto(caps, prisma);
    Object.assign(service, {
      evaluarReglas: jest.fn().mockResolvedValue([]),
      evento: jest.fn(),
    });
    jest
      .spyOn(service, 'detalle')
      .mockResolvedValue({ ...c, estado: 'enviado' } as never);
    const pdf = jest.spyOn(service, 'materializarPdf');
    await expect(service.enviar(auth, c.id)).resolves.toMatchObject({
      estado: 'enviado',
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'enviado',
          publicToken: null,
        }) as unknown,
      }),
    );
    expect(pdf).not.toHaveBeenCalled();
  });

  it('conserva la respuesta de una creación idempotente ya completada tras retirar órdenes', async () => {
    const service = ordenes(capacidades({ ordenes: false }), {
      ordenTrabajo: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ot-existente' }),
      },
    });
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'ot-existente' } as never);
    await expect(
      service.create(auth, { idempotencyKey: 'intento' } as never),
    ).resolves.toEqual({ id: 'ot-existente' });
    await expect(service.create(auth, {} as never)).rejects.toMatchObject({
      status: 403,
    });
  });

  it.each(['agregarItem', 'editarItem', 'quitarItem'] as const)(
    'protege el endpoint alternativo %s',
    async (metodo) => {
      const service = ordenes(capacidades({ ordenes: false }));
      const resultado =
        metodo === 'agregarItem'
          ? service.agregarItem(auth, 'ot', {} as never)
          : metodo === 'editarItem'
            ? service.editarItem(auth, 'ot', 'item', {} as never)
            : service.quitarItem(auth, 'ot', 'item');
      await expect(resultado).rejects.toMatchObject({ status: 403 });
    },
  );

  it.each([TipoEnlacePublico.PRESUPUESTO, TipoEnlacePublico.SEGUIMIENTO_OT])(
    'preserva el enlace %s vigente, pero impide emitirlo o revivirlo',
    async (tipo) => {
      const upsert = jest.fn();
      const prisma = {
        enlacePublico: {
          upsert,
          findUnique: jest.fn().mockResolvedValue({
            tipo,
            entidadId: 'documento',
            tenantId: auth.tenantId,
            revocadoEl: null,
            expiraEl: null,
          }),
        },
      };
      const service = new EnlacesPublicosService(
        prisma as never,
        capacidades({ aprobacion_presupuestos: false, seguimiento_qr: false }),
      );
      await expect(service.resolver('token', tipo)).resolves.toEqual({
        entidadId: 'documento',
        tenantId: auth.tenantId,
      });
      await expect(
        service.emitir(prisma as never, {
          tipo,
          entidadId: 'documento',
          tenantId: auth.tenantId,
          token: 'token',
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it('descarga el PDF histórico del presupuesto sin generar uno nuevo', async () => {
    const archivo = { id: 'archivo' };
    const service = presupuesto(capacidades({ documentos_pdf: false }), {
      archivo: { findFirst: jest.fn().mockResolvedValue(archivo) },
    });
    await expect(service.materializarPdf(auth, 'presupuesto')).resolves.toEqual(
      archivo,
    );
    const sinArchivo = presupuesto(capacidades({ documentos_pdf: false }), {
      archivo: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      sinArchivo.materializarPdf(auth, 'presupuesto'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('mantiene las descargas de recibos y facturas guardados sin permitir render nuevo', async () => {
    const caps = capacidades({ documentos_pdf: false });
    const archivo = { id: 'archivo' };
    const archivos = { generadoDe: jest.fn().mockResolvedValue(archivo) };
    const recibos = new RecibosService(
      {
        cobro: {
          findFirst: jest.fn().mockResolvedValue({ tenantId: auth.tenantId }),
        },
      } as never,
      archivos as never,
      {} as never,
      {} as never,
      {} as never,
      caps,
    );
    const facturas = new ComprobantesService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      archivos as never,
      {} as never,
      {} as never,
      caps,
    );
    await expect(recibos.pdfDe('cobro', auth.tenantId)).resolves.toEqual(
      archivo,
    );
    await expect(facturas.pdfDe(auth.tenantId, 'factura')).resolves.toEqual(
      archivo,
    );
    await expect(
      recibos.materializarPdf('cobro', auth.tenantId),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      facturas.materializarPdf(auth.tenantId, 'factura'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('no registra ni reencola un PDF sin capacidad', async () => {
    const updateMany = jest.fn();
    const prisma = {
      documentoPdf: {
        updateMany,
        findFirst: jest.fn().mockResolvedValue({ estado: 'FALLIDO' }),
      },
    };
    const service = new DocumentosPdfService(
      prisma as never,
      capacidades({ documentos_pdf: false }),
    );
    await expect(
      service.registrar(prisma as never, { tenantId: auth.tenantId } as never),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.reintentar(auth.tenantId, 'c', 2),
    ).rejects.toMatchObject({ status: 403 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('el piloto vuelve a comprobar el plan aunque tenga el PDF en caché', async () => {
    const anterior = process.env.PRESUPUESTO_PDF_PILOTO;
    process.env.PRESUPUESTO_PDF_PILOTO = 'true';
    try {
      const caps = capacidades({ documentos_pdf: true });
      const generar = jest.fn().mockResolvedValue(Buffer.from('%PDF-test'));
      const service = new PresupuestoPilotoService({ generar } as never, caps);
      const datos = { items: [] } as never;
      await service.generar(auth.tenantId, 'presupuesto', datos);
      (await caps.actual(auth.tenantId)).contrato.funciones.documentos_pdf =
        false;
      await expect(
        service.generar(auth.tenantId, 'presupuesto', datos),
      ).rejects.toMatchObject({ status: 403 });
      expect(generar).toHaveBeenCalledTimes(1);
    } finally {
      if (anterior === undefined) delete process.env.PRESUPUESTO_PDF_PILOTO;
      else process.env.PRESUPUESTO_PDF_PILOTO = anterior;
    }
  });

  it('revalida el plan del trabajo PDF en cola y distingue la exclusión del límite de espacio', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const generar = jest.fn();
    const materializarVersionPdf = jest.fn();
    const liberar = jest.fn().mockResolvedValue(undefined);
    const worker = new DocumentosPdfWorker(
      {
        documentoPdf: {
          updateMany,
          findFirstOrThrow: jest.fn().mockResolvedValue({}),
        },
      } as never,
      { generar } as never,
      { materializarVersionPdf } as never,
      { adquirir: jest.fn().mockResolvedValue({}), liberar } as never,
      capacidades({ documentos_pdf: false }),
    );
    await expect(
      worker.procesar({
        id: 'job',
        data: {
          tenantId: auth.tenantId,
          documentoId: 'pdf',
          ronda: 0,
          intentoAnterior: 0,
        },
      } as never),
    ).rejects.toMatchObject({ status: 403 });
    expect(generar).not.toHaveBeenCalled();
    expect(materializarVersionPdf).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'FALLIDO',
          errorCodigo: 'CAPACIDAD_NO_DISPONIBLE',
        }) as unknown,
      }),
    );
    expect(liberar).toHaveBeenCalled();
  });
});
