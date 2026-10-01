import { productoParaCotizacion } from '../producto-cotizacion-publico';
describe('Catálogo auxiliar de cotización sin acceso al modelador', () => {
  it('no publica columnas futuras ni configuración de ganancias', () => {
    const p = productoParaCotizacion({
      id: 'producto-ficticio',
      nombre: 'Vinilo ficticio',
      tenantId: 'empresa-ficticia',
      secretoFuturo: 'no publicar',
      precioConfigJson: {
        metodoCalculo: 'fijado_por_cantidad',
        margenPct: 40,
        detalle: { tiers: [{ quantity: 100, cost: 800, price: 1200 }] },
      },
      rutasAlternativas: [
        {
          id: 'ruta',
          configPasos: [
            {
              id: 'paso',
              proveedorId: 'proveedor-privado',
              tarifaHora: 5000,
              slotsMateriales: [
                {
                  materialVariante: {
                    id: 'variante',
                    precioReferencia: 700,
                    atributosVarianteJson: { anchoMm: 1200 },
                  },
                },
              ],
            },
          ],
        },
      ],
    }) as any;
    expect(p.tenantId).toBeUndefined();
    expect(p.secretoFuturo).toBeUndefined();
    expect(p.precioConfigJson).toEqual({
      metodoCalculo: 'fijado_por_cantidad',
      detalle: { tiers: [{ quantity: 100 }] },
    });
    const paso = p.rutasAlternativas[0].configPasos[0];
    expect(paso.proveedorId).toBeUndefined();
    expect(paso.tarifaHora).toBeUndefined();
    expect(paso.slotsMateriales[0].materialVariante).toEqual({
      id: 'variante',
      precioCargado: true,
      atributosVarianteJson: { anchoMm: 1200 },
    });
  });
  it('conserva márgenes físicos y preguntas, sin costos ocultos en JSON', () => {
    const p = productoParaCotizacion({
      paramsPasoJson: {
        margenNoImprimibleMm: 3,
        margenesNoImprimiblesMm: { arriba: 5 },
        precio: 30,
        niveles: [{ codigo: 'fino', cost: 500, margin: 40, espesorMm: 2 }],
      },
      configJson: {
        inputCantidad: 'cantidadDeOjales',
        precioUnidad: 100,
        importe: 200,
        descuentoPrivado: 7,
      },
    }) as any;
    expect(p.paramsPasoJson).toEqual({
      margenNoImprimibleMm: 3,
      margenesNoImprimiblesMm: { arriba: 5 },
      niveles: [{ codigo: 'fino', espesorMm: 2 }],
    });
    expect(p.configJson).toEqual({ inputCantidad: 'cantidadDeOjales' });
  });
  it('distingue un material sin precio de uno con costo positivo sin revelar el importe', () => {
    expect(
      productoParaCotizacion([
        { id: 'a', precioReferencia: 0 },
        { id: 'b', precioReferencia: '10.25' },
      ]),
    ).toEqual([
      { id: 'a', precioCargado: false },
      { id: 'b', precioCargado: true },
    ]);
  });
  it('conserva el orden de extras y los ejes tercerizados sin sus costos', () => {
    const p = productoParaCotizacion({
      pasosExtras: [
        {
          id: 'extra',
          insertarDespuesDeRutaPasoId: 'corte',
          ordenFlujo: 2,
          maquinaM1Id: 'laser',
          tercerizadoConfigJson: {
            tecnologia: 'LASER',
            ejes: [
              {
                clave: 'cantidad',
                valores: [{ clave: '100', label: '100 unidades', costo: 150 }],
              },
            ],
            costoEstimado: 1000,
          },
        },
      ],
    }) as any;
    expect(p.pasosExtras[0]).toEqual({
      id: 'extra',
      insertarDespuesDeRutaPasoId: 'corte',
      ordenFlujo: 2,
      maquinaM1Id: 'laser',
      tercerizadoConfigJson: {
        tecnologia: 'LASER',
        ejes: [
          {
            clave: 'cantidad',
            valores: [{ clave: '100', label: '100 unidades' }],
          },
        ],
        costoEstimadoDisponible: true,
      },
    });
  });
});
