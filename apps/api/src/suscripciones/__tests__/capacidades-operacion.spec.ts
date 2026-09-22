import { PDFDocument } from 'pdf-lib';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { contratoCompatible } from '../evaluador-capacidades';
import { resolverAccesoEmpresa } from '../acceso-empresa';
import { InventarioService } from '../../inventario/inventario.service';
import { CuentaCorrienteService } from '../../administracion/cuenta-corriente.service';
import { EquiposProduccionService } from '../../produccion/equipos-produccion.service';
import { ProduccionService } from '../../produccion/produccion.service';
import { ImpresionService } from '../../impresion/impresion.service';
import type { CurrentAuth } from '../../auth/auth.types';

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
const denegada = (capacidad: string) => ({
  status: 403,
  response: { capacidad },
});

describe('Stock, equipos, cuentas y etiquetas independientes', () => {
  it('bloquea todas las mutaciones públicas de stock antes de escribir, incluso con origen de consumo o compra', async () => {
    const service = new InventarioService(
      {} as never,
      undefined,
      capacidades({ existencias: false }),
    );
    const operaciones = [
      () => service.createAlmacen(auth, {} as never),
      () => service.updateAlmacen(auth, 'deposito', {} as never),
      () => service.toggleAlmacen(auth, 'deposito'),
      () => service.createUbicacion(auth, 'deposito', {} as never),
      () => service.updateUbicacion(auth, 'ubicacion', {} as never),
      () => service.toggleUbicacion(auth, 'ubicacion'),
      () => service.registrarTransferencia(auth, {} as never),
      ...['compra', 'consumo_produccion', 'otro'].map(
        (origen) => () =>
          service.registrarMovimiento(auth, { origen } as never),
      ),
    ];
    for (const operar of operaciones)
      await expect(operar()).rejects.toMatchObject(denegada('existencias'));
  });

  it('mantiene la lectura de depósitos existentes sin habilitar su gestión', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new InventarioService(
      { almacenMateriaPrima: { findMany } } as never,
      undefined,
      capacidades({ existencias: false }),
    );
    await expect(service.findAllAlmacenes(auth)).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: auth.tenantId } }),
    );
  });

  it('protege el extracto consolidado y el listado de deudores', async () => {
    const service = new CuentaCorrienteService(
      {} as never,
      capacidades({ cuentas_cobrar: false }),
    );
    await expect(service.obtener(auth, 'cliente')).rejects.toMatchObject(
      denegada('cuentas_cobrar'),
    );
    await expect(service.deudores(auth)).rejects.toMatchObject(
      denegada('cuentas_cobrar'),
    );
  });

  it('no permite configurar equipos ni activar planificación por personas indirectamente desde una estación', async () => {
    const caps = capacidades({ equipos_produccion: false });
    const equipos = new EquiposProduccionService({} as never, caps);
    await expect(
      equipos.guardar(auth.tenantId, {} as never),
    ).rejects.toMatchObject(denegada('equipos_produccion'));
    await expect(
      equipos.guardar(auth.tenantId, {} as never, 'equipo'),
    ).rejects.toMatchObject(denegada('equipos_produccion'));
    const estaciones = new ProduccionService({} as never, caps);
    for (const extra of [
      { equipoProduccionId: 'equipo' },
      { planificacionPorEmpleados: true },
      { empleadoIds: ['persona'] },
      { horariosEmpleados: [{}] },
    ])
      await expect(
        estaciones.createEstacion(auth, { ...extra } as never),
      ).rejects.toMatchObject(denegada('equipos_produccion'));
  });

  function impresion(funciones: Record<string, boolean>) {
    const findFirst = jest.fn().mockResolvedValue({
      numero: 'OT-PRUEBA',
      estado: 'finalizada',
      fechaEntrega: null,
      tenant: { nombre: 'Grafo' },
      cliente: { nombre: 'Prueba' },
      items: [{ nombre: 'Documento', cantidad: 1, cantidadUnidad: 'u' }],
    });
    const service = new ImpresionService(
      { ordenTrabajo: { findFirst } } as never,
      { logoDataUri: jest.fn().mockResolvedValue(null) } as never,
      { get: jest.fn() } as never,
      capacidades(funciones),
    );
    return { service, findFirst };
  }

  it('sin etiquetas ni impresión directa no renderiza siquiera la vista previa', async () => {
    const { service, findFirst } = impresion({
      etiquetas_pdf: false,
      impresion_directa: false,
    });
    await expect(service.vistaPrevia(auth, 'ot')).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.descargarPdf(auth, 'ot')).rejects.toMatchObject(
      denegada('etiquetas_pdf'),
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('la descarga manual genera un PDF de 100 × 150 sin certificado ni impresión directa', async () => {
    const { service } = impresion({
      etiquetas_pdf: true,
      impresion_directa: false,
    });
    const buffer = await service.descargarPdf(auth, 'ot');
    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPages()).toHaveLength(1);
    expect((pdf.getPage(0).getWidth() * 25.4) / 72).toBeCloseTo(100);
    expect((pdf.getPage(0).getHeight() * 25.4) / 72).toBeCloseTo(150);
    await expect(
      service.preparar(auth, 'ot', 'Xprinter', 1, 0),
    ).rejects.toMatchObject(denegada('impresion_directa'));
  });

  it('impresión directa permite la vista previa pero no concede automáticamente la descarga PDF', async () => {
    const { service } = impresion({
      etiquetas_pdf: false,
      impresion_directa: true,
    });
    await expect(service.vistaPrevia(auth, 'ot')).resolves.toMatchObject({
      numero: 'OT-PRUEBA',
    });
    await expect(service.descargarPdf(auth, 'ot')).rejects.toMatchObject(
      denegada('etiquetas_pdf'),
    );
  });
});
