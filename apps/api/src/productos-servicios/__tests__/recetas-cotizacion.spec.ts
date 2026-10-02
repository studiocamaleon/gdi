import { NotFoundException } from '@nestjs/common';
import { RecetasProductoService } from '../recetas-producto.service';

describe('Recetas publicadas para el cotizador comercial', () => {
  const auth = { tenantId: 'empresa-ficticia' };
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const service = new RecetasProductoService(
    { producto: { findFirst }, productoReceta: { findMany } } as never,
    {} as never, {} as never, {} as never,
  );
  beforeEach(() => jest.resetAllMocks());

  it('consulta sólo publicaciones vigentes de la empresa, sin borradores ni snapshots', async () => {
    findFirst.mockResolvedValue({ id: 'producto' });
    findMany.mockResolvedValue([{ rutaAlternativa: { id: 'ruta' }, revisionPublicada: {
      componentes: [{ id: 'componente', codigo: 'base', nombre: 'Base', formula: 'por_unidad', cantidad: 2, configuracionJson: {
        version: 2,
        bindings: [{ clave: 'ancho', origen: 'COTIZACION', valor: 300, costo: 99 }],
        piezas: [{ nombre: 'Cara', medidas: { anchoMm: 100, altoMm: 50 } }],
        repeticion: { permitida: true, maximo: 5 },
        pricing: { precioConfigSnapshot: { price: 5000 } },
        operacionesIncorporacion: [{ minutosFijos: 10 }],
        secretoFuturo: 'privado',
      } }],
    } }]);
    const resultado = await service.obtenerParaCotizacion(auth, 'producto');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'producto', tenantId: auth.tenantId, activo: true }, select: { id: true } });
    const consulta = findMany.mock.calls[0][0];
    expect(consulta.where).toEqual({ tenantId: auth.tenantId, productoId: 'producto', activo: true, rutaAlternativa: { activo: true }, revisionPublicada: { estado: 'PUBLICADA' } });
    expect(Object.keys(consulta.select)).toEqual(['rutaAlternativa', 'revisionPublicada']);
    expect(Object.keys(consulta.select.revisionPublicada.select)).toEqual(['componentes']);
    expect(resultado[0].revisionPublicada!.componentes[0].configuracionJson).toEqual({
      version: 2,
      bindings: [{ clave: 'ancho', origen: 'COTIZACION', valor: 300 }],
      piezas: [{ nombre: 'Cara', medidas: { anchoMm: 100, altoMm: 50 } }],
      repeticion: { permitida: true, maximo: 5 },
    });
  });

  it('rechaza productos de otra empresa o desactivados antes de consultar recetas', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.obtenerParaCotizacion(auth, 'ajeno')).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
