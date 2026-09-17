import { CotizacionJobsService } from './cotizacion-jobs.service';
import type { CotizarInput } from '../../motor-universal/tipos';
import {
  errorPublicoCotizacion,
  idTrabajoCotizacion,
} from './cotizacion-jobs.service';

const input: CotizarInput = {
  tenantId: 'tenant-prueba',
  productoId: 'producto-prueba',
  rutaAlternativaId: null,
  jobContext: { cantidad: 1 },
  clienteId: null,
  periodo: null,
  descuento: null,
};

describe('identidad durable de cotizaciones', () => {
  it('deduplica el mismo input dentro del mismo alcance de pantalla', () => {
    expect(idTrabajoCotizacion(input.tenantId, 'sheet-prueba', input)).toBe(
      idTrabajoCotizacion(input.tenantId, 'sheet-prueba', { ...input }),
    );
  });

  it('no comparte resultados entre tenants', () => {
    expect(idTrabajoCotizacion(input.tenantId, 'sheet-prueba', input)).not.toBe(
      idTrabajoCotizacion('otro-tenant', 'sheet-prueba', {
        ...input,
        tenantId: 'otro-tenant',
      }),
    );
  });
});

describe('errores públicos de cotización', () => {
  it('conserva el motivo de una receta desactualizada y ofrece publicarla', () => {
    const error = errorPublicoCotizacion(
      'La receta publicada V12 tiene cambios productivos sin publicar. Actualizá y publicá una nueva revisión antes de cotizar por esta vía.',
      'producto-1',
      'ruta-1',
    );

    expect(error).toMatchObject({
      codigo: 'RECETA_DESACTUALIZADA',
      accion: {
        tipo: 'ABRIR_PUBLICACION',
        etiqueta: 'Revisar publicación',
      },
    });
    expect(error.mensaje).toContain('V12');
    expect(error.accion.href).toContain('producto-1');
    expect(error.accion.href).toContain('rutaAltId=ruta-1');
  });

  it('dirige los problemas vectoriales a GrafoNest sin exponer OpenNest', () => {
    const error = errorPublicoCotizacion(
      'OpenNest devolvió una pieza fuera del área útil.',
      'producto-1',
    );

    expect(error.codigo).toBe('NESTING_FALLIDO');
    expect(error.accion.tipo).toBe('GENERAR_NESTING');
    expect(error.mensaje).toContain('GrafoNest');
    expect(error.mensaje).not.toContain('OpenNest');
  });

  it('oculta una excepción interna desconocida y permite reintentar', () => {
    const error = errorPublicoCotizacion(
      'TypeError: Cannot read properties of undefined',
      'producto-1',
    );

    expect(error).toMatchObject({
      codigo: 'CALCULO_FALLIDO',
      accion: { tipo: 'REINTENTAR' },
    });
    expect(error.mensaje).not.toContain('TypeError');
  });
});

describe('cotizaciones con nesting reutilizable', () => {
  it.each(['completed', 'failed'])(
    'refresca el trabajo que pasa a %s entre las dos lecturas',
    async (estado) => {
      const servicio = new CotizacionJobsService();
      const id = idTrabajoCotizacion(input.tenantId, 'carrera', input);
      const viejo = {
        id,
        data: { input, correlationId: 'corr' },
        timestamp: Date.now(),
        getState: () => Promise.resolve(estado),
      };
      const nuevo = {
        ...viejo,
        finishedOn: Date.now(),
        returnvalue:
          estado === 'completed' ? { exitoso: true, errores: [] } : undefined,
        failedReason: 'Configuración incompleta',
      };
      const getJob = jest
        .fn()
        .mockResolvedValueOnce(viejo)
        .mockResolvedValueOnce(nuevo);
      jest
        .spyOn(servicio as unknown as { getQueue(): unknown }, 'getQueue')
        .mockReturnValue({ getJob });
      const vista = await servicio.consultar(input.tenantId, id);
      expect(getJob).toHaveBeenCalledTimes(2);
      expect(vista.finalizadoEl).toBeTruthy();
      if (estado === 'completed') expect(vista.resultado?.exitoso).toBe(true);
      else expect(vista.error).toBeTruthy();
    },
  );
  it('no informa completado si un trabajo terminal carece de resultado incluso al releer', async () => {
    const servicio = new CotizacionJobsService();
    const id = idTrabajoCotizacion(input.tenantId, 'sin-resultado', input);
    const job = {
      id,
      data: { input },
      getState: () => Promise.resolve('completed'),
    };
    jest
      .spyOn(servicio as unknown as { getQueue(): unknown }, 'getQueue')
      .mockReturnValue({ getJob: jest.fn().mockResolvedValue(job) });
    await expect(servicio.consultar(input.tenantId, id)).rejects.toThrow(
      'todavía no está disponible',
    );
  });
  it('no reutiliza precios de una cotización terminada aunque sus inputs coincidan', async () => {
    const servicio = new CotizacionJobsService();
    const cotizacion = {
      tenantId: 'empresa-prueba',
      productoId: 'producto-prueba',
      jobContext: { cantidad: 50 },
    };
    const getJob = jest
      .fn()
      .mockResolvedValueOnce({ getState: () => Promise.resolve('completed') })
      .mockResolvedValueOnce(null);
    const add = jest
      .fn()
      .mockImplementation(
        (_tipo: string, data: unknown, options: { jobId: string }) => ({
          id: options.jobId,
          data,
          timestamp: Date.now(),
          progress: 0,
          getState: () => Promise.resolve('waiting'),
        }),
      );
    jest
      .spyOn(servicio as unknown as { getQueue(): unknown }, 'getQueue')
      .mockReturnValue({ getJob, add });
    const resultado = await servicio.crear({
      cotizacion,
      claveSolicitud: 'sheet',
    });
    expect(resultado.estado).toBe('pendiente');
    expect(resultado.id).not.toBe(
      idTrabajoCotizacion(cotizacion.tenantId, 'sheet', cotizacion),
    );
    expect(resultado.resultado).toBeUndefined();
    expect(add).toHaveBeenCalledTimes(1);
  });
});
