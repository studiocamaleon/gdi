import { OrdenesTrabajoService } from '../../ordenes-trabajo/ordenes-trabajo.service';
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
  excluir = true,
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
  cargado.pasos[0].nombreVisible = 'Preprensa';
  cargado.pasos[0].modoActivacion = excluir ? 'CONDICIONAL' : 'OBLIGATORIO';
  cargado.pasos[0].condicionActivacionJson = excluir
    ? { '==': [{ var: 'pasoActivo_opcional' }, 0] }
    : null;
  cargado.pasos[1].nombreVisible = 'Diseño gráfico';
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
    requerido.modoActivacion = 'OBLIGATORIO';
    requerido.requiereRutaPasoIds = ['opcional'];
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
        pasoActivo_opcional: activo ? 0 : 1, // No confiar en un estado enviado por cliente.
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

describe('Exclusión entre pasos: cotización completa y operaciones de OT', () => {
  it('activar y desactivar Diseño cambia costos, tiempos y operaciones sin acumular estados', async () => {
    for (const activo of [false, true, false]) {
      const resultado = await cotizar({ activo, incluidoMin: 10, minutos: 30 });
      const [preprensa, diseno] = resultado.pasos;
      expect(preprensa.activado).toBe(!activo);
      expect(diseno.activado).toBe(activo);
      expect(preprensa.costoTotal).toBe(activo ? 0 : 1000);
      expect(diseno.costoTotal).toBe(activo ? 3000 : 0);
      expect(
        resultado.pasos.reduce(
          (total, p) => total + (p.tiempo?.totalMin ?? 0),
          0,
        ),
      ).toBe(activo ? 30 : 10);
      expect(resultado.precio?.precioTotal).toBe(activo ? 14000 : 10000);
      const ot = Object.create(OrdenesTrabajoService.prototype);
      const operaciones = ot.pasosDesdeTrazabilidad(
        'tenant-ficticio',
        'orden-ficticia',
        'item-ficticio',
        resultado,
      );
      expect(operaciones.map((p: { nombre: string }) => p.nombre)).toEqual([
        activo ? 'Diseño gráfico' : 'Preprensa',
      ]);
      expect(operaciones[0].duracionEstimadaMin).toBe(activo ? 30 : 10);
    }
  });
  it('también excluye cuando Diseño se activa automáticamente por otro paso', async () => {
    const resultado = await cotizar({
      activo: false,
      arrastre: true,
      incluidoMin: 10,
    });
    expect(resultado.pasos[0].activado).toBe(false);
    expect(resultado.pasos[0].costoTotal).toBe(0);
    expect(
      resultado.pasos.find((p) => p.configPasoId === 'opcional')?.activado,
    ).toBe(true);
  });
  it('mantiene los pasos obligatorios sin regla de exclusión', async () => {
    const resultado = await cotizar({
      activo: true,
      excluir: false,
      incluidoMin: 10,
    });
    expect(resultado.pasos.map((p) => p.activado)).toEqual([true, true]);
    expect(resultado.pasos.reduce((s, p) => s + p.costoTotal, 0)).toBe(4000);
  });
});
