import { NotFoundException } from '@nestjs/common';
import { RecetasProductoService } from '../recetas-producto.service';

describe('Recetas publicadas para el cotizador comercial', () => {
  const auth = { tenantId: 'empresa-ficticia' };
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const variantesFindMany = jest.fn();
  const service = new RecetasProductoService(
    { producto: { findFirst }, productoReceta: { findMany }, materiaPrimaVariante: { findMany: variantesFindMany } } as never,
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
    expect(variantesFindMany).not.toHaveBeenCalled();
  });

  it('hidrata los materiales de recetas existentes sin ampliar opciones ni publicar precios', async () => {
    findFirst.mockResolvedValue({ id: 'producto' });
    const binding = {
      clave: 'slotMateriales.corte_sustrato', tipoDato: 'material', origen: 'COTIZACION',
      opciones: [{ valor: 'oro', etiqueta: 'Dorado' }, { valor: 'plata', etiqueta: 'Plateado' }, { valor: 'inactiva', etiqueta: 'Retirada' }],
    };
    findMany.mockResolvedValue([{ rutaAlternativa: { id: 'ruta' }, revisionPublicada: {
      componentes: [{ id: 'frente', codigo: 'FRENTE', cantidad: 1, configuracionJson: { version: 2, bindings: [binding] } }],
    } }]);
    variantesFindMany.mockResolvedValue(['oro', 'plata'].map((id) => ({
      id, sku: `PLACA-${id}`, nombreVariante: null, precioReferencia: 250,
      atributosVarianteJson: { espesor: 2, ancho: 1.2, alto: 0.6, colorBase: id, costo: 250, proveedorId: 'privado' },
      materiaPrima: { id: 'laminado', nombre: 'Laminado bicapa de prueba', templateId: 'sustrato_rigido_v1' },
    })));
    const result = await service.obtenerParaCotizacion(auth, 'producto');
    expect(variantesFindMany).toHaveBeenCalledTimes(1);
    expect(variantesFindMany.mock.calls[0][0].where).toEqual({
      id: { in: ['oro', 'plata', 'inactiva'] }, tenantId: auth.tenantId, activo: true,
      materiaPrima: { tenantId: auth.tenantId, activo: true },
    });
    const config = result[0].revisionPublicada!.componentes[0].configuracionJson as { bindings: Array<typeof binding & { materiales: Array<{ variantes: Array<Record<string, unknown>> }> }> };
    expect(config.bindings[0].opciones).toEqual(binding.opciones);
    const materiales = config.bindings[0].materiales;
    expect(materiales).toHaveLength(1);
    expect(materiales[0].variantes.map((v) => v.variantId)).toEqual(['oro', 'plata']);
    expect(materiales[0].variantes[0]).toMatchObject({
      missingPrice: false,
      atributosVarianteJson: { espesor: 2, ancho: 1.2, alto: 0.6, colorBase: 'oro' },
    });
    expect(JSON.stringify(materiales)).not.toMatch(/precioReferencia|costo|proveedorId/);
    expect(binding).not.toHaveProperty('materiales');
  });
});
