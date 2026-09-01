import {
  construirBomMultinivel,
  type BomRevisionFuente,
} from '../bom-multinivel';

function revision(
  id: string,
  nombre: string,
  opciones: Partial<BomRevisionFuente> = {},
): BomRevisionFuente {
  return {
    id,
    numero: 1,
    estado: 'PUBLICADA',
    huellaConfiguracion: `huella-${id}`,
    recetaId: `receta-${id}`,
    rutaAlternativaId: `ruta-${id}`,
    rutaNombre: `Ruta ${nombre}`,
    productoId: `producto-${id}`,
    productoCodigo: id.toUpperCase(),
    productoNombre: nombre,
    unidadComercial: 'unidad',
    materiales: [],
    recursos: [],
    documentos: [],
    componentes: [],
    ...opciones,
  };
}

function componente(
  codigo: string,
  nombre: string,
  recetaRevisionId: string,
  cantidad = 1,
) {
  return {
    id: `componente-${codigo}`,
    productoComponenteId: `producto-${recetaRevisionId}`,
    recetaRevisionId,
    recetaVersion: 1,
    recetaHuella: `huella-${recetaRevisionId}`,
    codigo,
    nombre,
    politicaEjecucion: 'INDEPENDIENTE' as const,
    formula: 'por_unidad',
    cantidad,
    unidad: 'unidad',
    requerido: true,
    configuracionJson: null,
    nodoIncorporacionClave: null,
    orden: 0,
  };
}

function material(id: string, nombre: string, cantidadFactor = 1) {
  return {
    id,
    pasoClave: `paso-${id}`,
    pasoNombre: `Paso ${nombre}`,
    slotCodigo: `slot-${id}`,
    slotNombre: nombre,
    rol: 'SUSTRATO',
    modoSeleccion: 'FIJO',
    materialVarianteId: `variante-${id}`,
    materialSku: `SKU-${id}`,
    materialNombre: nombre,
    unidad: 'M2',
    formula: 'por_m2',
    cantidadBase: null,
    cantidadFactor,
    fuenteMedida: 'area_neta_m2',
    mermaAdicionalPct: 0,
    aplicaMultiCaras: false,
    orden: 0,
  };
}

describe('proyección de BOM multinivel', () => {
  it('mantiene compatible un producto simple como raíz de un solo nivel', async () => {
    const simple = revision('simple', 'Tarjeta personal', {
      materiales: [material('papel', 'Papel ilustración', 1)],
    });

    const bom = await construirBomMultinivel('simple', async () => simple);

    expect(bom?.resumen).toEqual(
      expect.objectContaining({
        niveles: 1,
        productosFabricados: 1,
        materialesDirectos: 1,
        materialesAcumulados: 1,
      }),
    );
    expect(bom?.raiz.hijos).toHaveLength(0);
  });

  it('conserva la jerarquía y acumula materiales de todos los niveles', async () => {
    const revisiones = new Map<string, BomRevisionFuente>([
      [
        'raiz',
        revision('raiz', 'Cartel Backlight', {
          componentes: [componente('BASTIDOR', 'Bastidor', 'bastidor', 1)],
        }),
      ],
      [
        'bastidor',
        revision('bastidor', 'Bastidor', {
          materiales: [material('perfil', 'Perfil de aluminio', 4)],
          componentes: [componente('LED', 'Módulo LED', 'led', 10)],
        }),
      ],
      [
        'led',
        revision('led', 'Módulo LED', {
          materiales: [material('diodo', 'Diodo LED', 1)],
        }),
      ],
    ]);

    const bom = await construirBomMultinivel(
      'raiz',
      async (id) => revisiones.get(id) ?? null,
    );

    expect(bom?.resumen).toEqual(
      expect.objectContaining({
        niveles: 3,
        productosFabricados: 3,
        materialesDirectos: 0,
        materialesAcumulados: 2,
      }),
    );
    expect(bom?.raiz.hijos[0].productoNombre).toBe('Bastidor');
    expect(bom?.raiz.hijos[0].hijos[0].productoNombre).toBe('Módulo LED');
    expect(bom?.raiz.hijos[0].hijos[0].factorReferencia).toBe(10);
    expect(bom?.materialesConsolidados).toHaveLength(2);
  });

  it('mantiene dos ocurrencias de una misma revisión sin confundirlas', async () => {
    const hijo = revision('hijo', 'Panel', {
      materiales: [material('placa', 'Placa rígida', 1)],
    });
    const raiz = revision('raiz', 'Exhibidor', {
      componentes: [
        componente('PANEL-A', 'Panel A', 'hijo'),
        componente('PANEL-B', 'Panel B', 'hijo'),
      ],
    });

    const bom = await construirBomMultinivel('raiz', async (id) =>
      id === 'raiz' ? raiz : hijo,
    );

    expect(bom?.raiz.hijos).toHaveLength(2);
    expect(bom?.raiz.hijos[0].ocurrenciaId).not.toBe(
      bom?.raiz.hijos[1].ocurrenciaId,
    );
    expect(bom?.materialesConsolidados[0].ocurrencias).toHaveLength(2);
  });

  it('rechaza ciclos aun cuando las revisiones ya estén en caché', async () => {
    const raiz = revision('raiz', 'Producto A', {
      componentes: [componente('B', 'Producto B', 'hijo')],
    });
    const hijo = revision('hijo', 'Producto B', {
      componentes: [componente('A', 'Producto A', 'raiz')],
    });

    await expect(
      construirBomMultinivel('raiz', async (id) =>
        id === 'raiz' ? raiz : hijo,
      ),
    ).rejects.toThrow('contiene un ciclo');
  });
});
