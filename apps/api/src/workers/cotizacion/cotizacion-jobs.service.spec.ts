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
