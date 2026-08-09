import { FormularioCotizacionService } from '../formulario-cotizacion.service';
import type { ProductosService } from '../productos.service';

/**
 * La derivación del formulario es lo que una IA EXTERNA usa para armar el
 * jobContext: si acá se filtra un paso NO_EJECUTAR, se pierde un multiplicador
 * o se abre un param fijado, la cotización sale mal EN SILENCIO (el motor
 * descarta claves no whitelisteadas sin error). Por eso los bordes que se
 * testean son los del contrato, no los del caso feliz.
 *
 * Usa familias REALES del catálogo (estructura_bastidor, impresion_por_area)
 * para que el schema de params sea el verdadero, no un mock que no diverge.
 */

const CONFIG_BASE = {
  nombreVisible: null,
  condicionActivacionJson: null,
  tercerizado: false,
  fuenteCostoTercerizado: null,
  tercerizadoConfigJson: null,
  tercerizadoEntradas: [],
  multiplicadoresActivos: [] as string[],
  slotsMateriales: [] as unknown[],
  cargosDirectosPaso: [] as unknown[],
  requiereRutaPasoIds: [] as string[],
  paramsPasoJson: {} as Record<string, unknown>,
  modoColorOptions: [] as Array<{ value: string; label: string }>,
};

function productoFixture() {
  return {
    id: 'prod-1',
    codigo: 'BAN-01',
    nombre: 'Banner con ojales',
    descripcion: 'Lona frontlight con terminación de ojales',
    activo: true,
    unidadComercial: 'm2',
    modoMedidas: 'LIBRE',
    medidaDefaultAnchoMm: null,
    medidaDefaultAltoMm: null,
    medidasPredefinidasJson: null,
    personalizacionesJson: null,
    minimoComercialPolitica: 'BLOQUEAR',
    minimoComercialCantidad: 1,
    minimoComercialBase: 'cantidad_comercial',
    subcategoriaComercial: {
      nombre: 'Banners',
      categoria: { nombre: 'Gran formato' },
    },
    cargosDirectosCotizacion: [
      {
        id: 'cargo-cot-1',
        modoActivacion: 'OPCIONAL',
        cargoDirectoCatalogo: {
          nombre: 'Instalación',
          descripcion: 'Colocación en obra',
        },
      },
    ],
    rutasAlternativas: [
      {
        id: 'ruta-1',
        nombre: 'Vía impresión directa',
        esPreferida: true,
        reglaAutoSeleccionJson: null,
        pasosExtras: [],
        configPasos: [
          {
            ...CONFIG_BASE,
            id: 'cp-impresion',
            rutaPasoId: 'rp-1',
            modoActivacion: 'OBLIGATORIO',
            rutaPaso: {
              familiaCodigo: 'impresion_por_area',
              familiaNombre: 'Impresión por área',
              activo: true,
              orden: 1,
            },
            multiplicadoresActivos: ['caras'],
            modoColorOptions: [
              { value: 'CMYK', label: 'Full color' },
              { value: 'BN', label: 'Blanco y negro' },
            ],
            paramsPasoJson: {
              modoColorConfig: { comercialElige: true, defaultMode: 'CMYK' },
            },
            slotsMateriales: [
              {
                slotCodigo: 'sustrato_principal',
                slotNombre: 'Lona',
                modoSeleccion: 'COMERCIAL_ELIGE',
                candidatos: [
                  {
                    materiaPrimaId: 'mp-lona',
                    defaultVarianteId: 'var-440',
                    todasLasVariantes: false,
                    materiaPrima: { nombre: 'Lona frontlight', variantes: [] },
                    variantes: [
                      {
                        variante: {
                          id: 'var-440',
                          sku: 'LON-440',
                          nombreVariante: '440g',
                          precioReferencia: 1000,
                          atributosVarianteJson: { anchoMm: 1580 },
                        },
                      },
                      {
                        variante: {
                          id: 'var-340',
                          sku: 'LON-340',
                          nombreVariante: '340g',
                          precioReferencia: null,
                          atributosVarianteJson: null,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            ...CONFIG_BASE,
            id: 'cp-bastidor',
            rutaPasoId: 'rp-2',
            modoActivacion: 'OPCIONAL',
            rutaPaso: {
              familiaCodigo: 'estructura_bastidor',
              familiaNombre: 'Estructura / bastidor',
              activo: true,
              orden: 2,
            },
            requiereRutaPasoIds: ['rp-3'],
            // El modelador fijó la separación V y dejó lo demás como viene.
            paramsPasoJson: {
              tipoBastidor: 'doble',
              camposFijadosComercial: ['sepRefuerzoVcm'],
            },
          },
          {
            ...CONFIG_BASE,
            id: 'cp-refuerzo',
            rutaPasoId: 'rp-3',
            modoActivacion: 'OPCIONAL',
            rutaPaso: {
              familiaCodigo: 'trabajo_manual',
              familiaNombre: 'Refuerzo perimetral',
              activo: true,
              orden: 3,
            },
          },
          {
            ...CONFIG_BASE,
            id: 'cp-muerto',
            rutaPasoId: 'rp-4',
            modoActivacion: 'NO_EJECUTAR',
            rutaPaso: {
              familiaCodigo: 'iluminacion_led',
              familiaNombre: 'Iluminación LED',
              activo: true,
              orden: 4,
            },
            paramsPasoJson: { camposEditablesComercial: ['densidad'] },
          },
        ],
      },
    ],
  };
}

function servicio(fixture: unknown) {
  const productos = {
    obtenerProducto: async () => fixture,
  } as unknown as ProductosService;
  return new FormularioCotizacionService(productos);
}

describe('formulario de cotización', () => {
  it('un paso NO_EJECUTAR no aporta NINGUNA pregunta', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    const deMuerto = form.preguntas.filter(
      (p) => p.configPasoId === 'cp-muerto',
    );
    expect(deMuerto).toHaveLength(0);
    // Ni siquiera sus params abiertos (densidad estaba en editables).
    expect(
      form.preguntas.some((p) => p.jobContextKey?.toString().includes('densidad')),
    ).toBe(false);
  });

  it('camposFijadosComercial gana sobre expuestoAlComercial de la familia', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    const params = form.preguntas.filter(
      (p) => p.tipo === 'param' && p.configPasoId === 'cp-bastidor',
    );
    const campos = params.map((p) => p.campo);
    // La familia expone sepRefuerzoVcm/sepRefuerzoHcm/solapaCenefaCm por
    // default; el modelador fijó la V: no puede aparecer como pregunta.
    expect(campos).not.toContain('sepRefuerzoVcm');
    expect(campos).toContain('sepRefuerzoHcm');
  });

  it('slot COMERCIAL_ELIGE: opciones etiquetadas, default y sinPrecio', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    const slot = form.preguntas.find((p) => p.tipo === 'material');
    expect(slot).toBeDefined();
    expect(slot!.jobContextKey).toBe(
      'slotMateriales.cp-impresion_sustrato_principal',
    );
    const opciones = slot!.opciones as Array<Record<string, unknown>>;
    expect(opciones).toHaveLength(2);
    const default440 = opciones.find((o) => o.varianteId === 'var-440');
    expect(default440?.esDefault).toBe(true);
    expect(default440?.etiqueta).toBe('Lona frontlight · 440g · 1580mm de ancho');
    expect(opciones.find((o) => o.varianteId === 'var-340')?.sinPrecio).toBe(
      true,
    );
  });

  it('multiplicador caras se deriva y el jobContextKey es explícito', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    const caras = form.multiplicadores.find((m) => m.campo === 'caras');
    expect(caras).toBeDefined();
    expect(caras!.jobContextKey).toBe('caras');
    expect(caras!.obligatorio).toBe(true);
  });

  it('modo de color: pregunta con opciones ya intersectadas y default', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    const color = form.preguntas.find((p) => p.tipo === 'modo_color');
    expect(color).toBeDefined();
    expect(color!.jobContextKey).toBe('modoColor_cp-impresion');
    expect(color!.default).toBe('CMYK');
  });

  it('adicionales: paso opcional con arrastre traducido a configPasoId', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    const bastidor = form.adicionales.find((a) => a.id === 'cp-bastidor');
    expect(bastidor).toBeDefined();
    expect(bastidor!.jobContextKey).toBe('opcionalesActivados.cp-bastidor');
    // requiereRutaPasoIds venía como rutaPasoId (rp-3) → sale como configPasoId.
    expect(bastidor!.requiereIds).toEqual(['cp-refuerzo']);
    // El cargo de cotización también está.
    expect(
      form.adicionales.some((a) => a.id === 'cargo-cot-1'),
    ).toBe(true);
  });

  it('bastidor doble sin profundidad fija pregunta profundidadMm', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    const prof = form.preguntas.find((p) => p.tipo === 'profundidad');
    expect(prof).toBeDefined();
    expect(prof!.jobContextKey).toBe('profundidadMm');
    expect(prof!.requerido).toBe(true);
  });

  it('medidas LIBRE instruye pedir ancho×alto en mm', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    expect(form.medidas.instruccion).toBe('pedir_ancho_alto');
    expect(form.medidas.unidadEntrada).toBe('mm');
  });

  it('mínimo comercial BLOQUEAR viaja para avisar ANTES de cotizar', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    expect(form.cantidad.minimo?.politica).toBe('BLOQUEAR');
  });

  it('producto sin rutas activas rechaza con mensaje accionable', async () => {
    const fixture = productoFixture();
    fixture.rutasAlternativas = [];
    await expect(servicio(fixture).obtener('t1', 'prod-1')).rejects.toThrow(
      /no tiene rutas/,
    );
  });
});
