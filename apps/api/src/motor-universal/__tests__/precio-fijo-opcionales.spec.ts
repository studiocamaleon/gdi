import { MotorUniversalService } from '../motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import type { PasoCargado, ProductoCargado } from '../tipos';

function paso(id: string, opcional: boolean): PasoCargado {
  return {
    rutaPasoId: id,
    rutaPasoOrden: opcional ? 2 : 1,
    configPasoId: id,
    familiaCodigo: 'diseno_grafico',
    nombreVisible: opcional ? 'Diseño opcional' : 'Trabajo incluido',
    modoActivacion: opcional ? 'OPCIONAL' : 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-1',
    mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: { tiempoManual: { habilitado: true } },
    maquinaM1Id: null,
    perfilM1Id: null,
    centroCostoId: 'centro-ficticio',
    centroCosto: { id: 'centro-ficticio', nombre: 'Diseño', codigo: 'DIS' },
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: 30,
    slots: [],
    cargosDirectosPaso: [],
  };
}
async function cotizar({
  minutos = 30,
  activo = true,
  cantidad = 1,
  tramos = false,
  incluidoMin = 30,
  minimo = false,
  arrastre = false,
} = {}) {
  const precioConfig = {
    metodoCalculo: tramos ? 'variable_por_cantidad' : 'precio_fijo',
    detalle: tramos
      ? {
          tiers: [
            { quantityUntil: 10, price: 10000 },
            { quantityUntil: 1000, price: 8000 },
          ],
          margenOpcionalesPct: 25,
        }
      : { price: 10000, margenOpcionalesPct: 25 },
  };
  const cargado: ProductoCargado = {
    productoId: 'producto-ficticio',
    productoCodigo: 'PRODUCTO',
    productoNombre: 'Producto de prueba',
    unidadComercial: 'unidad',
    modoMedidas: 'FIJA',
    dimensionesRequeridas: [],
    minimoComercialPolitica: minimo ? 'ADVERTIR_FACTURAR_MINIMO' : 'NONE',
    minimoComercialCantidad: minimo ? 5 : null,
    minimoComercialBase: 'cantidad_comercial',
    medidaDefaultAnchoMm: null,
    medidaDefaultAltoMm: null,
    rutaAlternativaId: 'ruta',
    rutaAlternativaNombre: 'Principal',
    rutaId: 'ruta',
    rutaVersion: 1,
    rutaCodigo: 'RUTA',
    rutaNombre: 'Ruta ficticia',
    pasos: [paso('incluido', false), paso('opcional', true)],
    cargosDirectosCotizacion: [],
  };
  // Sólo se sustituyen lecturas de catálogo y tarifas. El motor ejecuta los
  // pasos y calcula activación, tiempo, costos, cantidades y precio final.
  const db = {
    producto: {
      findFirst: async () => ({
        precioConfigJson: precioConfig,
        categoriaFiscal: 'general',
      }),
    },
    centroCostoTarifaPeriodo: {
      findMany: async () => [
        {
          centroCostoId: 'centro-ficticio',
          periodo: '2026-10',
          estado: 'PUBLICADA',
          tarifaCalculada: 6000,
          tarifaManoObra: 0,
        },
      ],
    },
    politicaReservasMaterial: { findUnique: async () => null },
    productoComisionAplicada: { findMany: async () => [] },
    productoComisionCatalogo: { findMany: async () => [] },
    productoImpuestoCatalogo: { findMany: async () => [] },
    configuracionFiscal: { findUnique: async () => null },
    datosEmpresa: { findUnique: async () => null },
  };
  const motor = new MotorUniversalService(
    db as never,
    new AplicarPrecioService(),
    { buscarActivo: async () => null } as never,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    { exigirTodas: async () => undefined } as never,
  );
  if (arrastre) {
    const requerido = paso('requerido', true);
    requerido.rutaPasoOrden = 2;
    cargado.pasos[1].rutaPasoOrden = 3;
    cargado.pasos[1].requiereRutaPasoIds = ['requerido'];
    cargado.pasos.splice(1, 0, requerido);
  }
  // La cotización de referencia del mínimo relee el mismo catálogo.
  jest
    .spyOn(motor as never, 'cargarProductoYRuta' as never)
    .mockResolvedValue(cargado as never);
  const r = await motor.cotizar(
    {
      tenantId: 'tenant-ficticio',
      productoId: cargado.productoId,
      periodo: '2026-10',
      jobContext: {
        cantidad,
        opcionalesActivados: { opcional: activo },
        tiempoManualMin_incluido: incluidoMin,
        tiempoManualMin_opcional: minutos,
      },
    },
    { productoPrecargado: cargado },
  );
  expect(r.errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
  expect(r.exitoso).toBe(true);
  expect(r.cotizacion?.precio?.precioTotal).toBe(
    r.cotizacion?.desglosePrecio?.precioNetoTotal,
  );
  return r.cotizacion!;
}

describe('Motor completo: fijo más tiempo manual opcional', () => {
  it('aumenta el precio final al pasar de 30 a 60 y 120 minutos', async () => {
    const resultados = await Promise.all(
      [30, 60, 120].map((minutos) => cotizar({ minutos })),
    );
    expect(resultados.map((r) => r.precio?.precioTotal)).toEqual([
      14000, 18000, 26000,
    ]);
    expect(resultados.map((r) => r.pasos[1].costoTotal)).toEqual([
      3000, 6000, 12000,
    ]);
    expect(
      resultados.map(
        (r) => r.desglosePrecio?.precioConfig.detalle.margenOpcionalesPct,
      ),
    ).toEqual([25, 25, 25]);
  });
  it('mantiene el fijo sin activar el opcional aunque cambie el tiempo obligatorio', async () => {
    const r = await cotizar({ activo: false, incluidoMin: 120, minutos: 180 });
    expect(r.precio?.precioTotal).toBe(10000);
    expect(r.pasos[1].activado).toBe(false);
  });
  it('cotiza por tramos y reparte el trabajo opcional fijo entre la cantidad comercial', async () => {
    expect(
      (await cotizar({ cantidad: 20, tramos: true })).precio?.precioTotal,
    ).toBe(164000);
  });
  it('cobra el tiempo opcional una vez al aplicar una cantidad mínima comercial', async () => {
    expect((await cotizar({ minimo: true })).precio?.precioTotal).toBe(54000);
  });
  it('suma también el opcional arrastrado por dependencia, una sola vez', async () => {
    const r = await cotizar({ arrastre: true });
    expect(r.precio?.precioTotal).toBe(18000);
    expect(r.pasos.filter((p) => p.esOpcional && p.activado)).toHaveLength(2);
  });
});
