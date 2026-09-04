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
    dimensionesRequeridas: ['ANCHO', 'ALTO'],
    medidaDefaultAnchoMm: null,
    medidaDefaultAltoMm: null,
    medidasPredefinidasJson: null,
    atributosComercialesJson: {
      geometriasComerciales: {
        version: 1,
        modo: 'AMBAS',
        fuentes: [
          {
            id: 'contorno_principal',
            nombre: 'Contorno principal',
            requerida: true,
          },
        ],
      },
    },
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
  it('publica las fuentes geométricas nombradas del producto', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    expect(form.geometrias).toEqual({
      version: 1,
      modo: 'AMBAS',
      fuentes: [
        {
          id: 'contorno_principal',
          nombre: 'Contorno principal',
          requerida: true,
        },
      ],
    });
  });

  it('un paso NO_EJECUTAR no aporta NINGUNA pregunta', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    const deMuerto = form.preguntas.filter(
      (p) => p.configPasoId === 'cp-muerto',
    );
    expect(deMuerto).toHaveLength(0);
    // Ni siquiera sus params abiertos (densidad estaba en editables).
    expect(
      form.preguntas.some((p) =>
        p.jobContextKey?.toString().includes('densidad'),
      ),
    ).toBe(false);
  });

  it('publica el diseño vectorial como herramienta compleja del producto hijo', async () => {
    const fixture = productoFixture();
    fixture.rutasAlternativas[0].configPasos = [
      {
        ...CONFIG_BASE,
        id: 'cp-vectorial',
        rutaPasoId: 'rp-vectorial',
        modoActivacion: 'OBLIGATORIO',
        rutaPaso: {
          familiaCodigo: 'corte_hilo_caliente',
          familiaNombre: 'Corte de formas',
          activo: true,
          orden: 1,
        },
      },
    ] as never;

    const form = await servicio(fixture).obtener('t1', 'prod-1');

    expect(form.herramientas).toEqual([
      {
        tipo: 'diseno_vectorial',
        jobContextKey: 'disenoVectorialFuente',
        etiqueta: 'Diseño vectorial',
        requerido: true,
      },
    ]);
  });

  it('publica el diseño vectorial opcional cuando fue activado en láser/CNC', async () => {
    const fixture = productoFixture();
    fixture.rutasAlternativas[0].configPasos = [
      {
        ...CONFIG_BASE,
        id: 'cp-laser-vectorial',
        rutaPasoId: 'rp-laser-vectorial',
        modoActivacion: 'OBLIGATORIO',
        paramsPasoJson: { usarDisenoVectorial: true },
        rutaPaso: {
          familiaCodigo: 'corte_laser',
          familiaNombre: 'Corte láser',
          activo: true,
          orden: 1,
        },
      },
    ] as never;

    const form = await servicio(fixture).obtener('t1', 'prod-1');

    expect(form.herramientas).toEqual([
      expect.objectContaining({
        tipo: 'diseno_vectorial',
        jobContextKey: 'disenoVectorialFuente',
        requerido: true,
      }),
    ]);
  });

  it('publica láser/CNC como capacidad vectorial opcional aunque use medidas por defecto', async () => {
    const fixture = productoFixture();
    fixture.rutasAlternativas[0].configPasos = [
      {
        ...CONFIG_BASE,
        id: 'cp-laser-medidas',
        rutaPasoId: 'rp-laser-medidas',
        modoActivacion: 'OBLIGATORIO',
        paramsPasoJson: {},
        rutaPaso: {
          familiaCodigo: 'corte_laser',
          familiaNombre: 'Corte láser',
          activo: true,
          orden: 1,
        },
      },
    ] as never;

    const form = await servicio(fixture).obtener('t1', 'prod-1');

    expect(form.herramientas).toEqual([
      expect.objectContaining({
        tipo: 'diseno_vectorial',
        jobContextKey: 'disenoVectorialFuente',
        requerido: false,
      }),
    ]);
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
    expect(default440?.etiqueta).toBe(
      'Lona frontlight · 440g · 1580mm de ancho',
    );
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
    expect(form.adicionales.some((a) => a.id === 'cargo-cot-1')).toBe(true);
  });

  it('no infiere profundidad desde un paso de bastidor', async () => {
    const form = await servicio(productoFixture()).obtener('t1', 'prod-1');
    const prof = form.preguntas.find((p) => p.tipo === 'profundidad');
    expect(prof).toBeUndefined();
    expect(form.medidas.ejes).toEqual(['ANCHO', 'ALTO']);
  });

  it('producto 3D publica profundidad aunque la ruta no sea su propietaria', async () => {
    const fixture = productoFixture();
    fixture.dimensionesRequeridas = ['ANCHO', 'ALTO', 'PROFUNDIDAD'];
    const form = await servicio(fixture).obtener('t1', 'prod-1');
    expect(form.medidas.instruccion).toBe('pedir_ancho_alto_profundidad');
    expect(form.medidas.jobContextKeys).toContain('profundidadMm');
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

  it('los pasos EXTRAS aportan preguntas (el caso Cartelería PVC)', async () => {
    // El montaje_sobre_sustrato como paso extra con slot COMERCIAL_ELIGE era
    // invisible para el formulario: la IA no veía la plancha y el motor
    // cortaba con montaje_sin_nesting.
    const fixture = productoFixture();
    (fixture.rutasAlternativas[0] as Record<string, unknown>).pasosExtras = [
      {
        id: 'pe-montaje',
        familiaCodigo: 'montaje_sobre_sustrato',
        nombreVisible: null,
        modoActivacion: 'OBLIGATORIO',
        ordenInterno: 1,
        activo: true,
        paramsPasoJson: {},
        multiplicadoresActivos: [],
        tercerizado: false,
        cargosDirectosPaso: [
          {
            id: 'cargo-extra-montaje',
            modoActivacion: 'OPCIONAL',
            nivelCodigo: null,
            configOverrideJson: null,
            cargoDirectoCatalogo: {
              nombre: 'Viático de instalación',
              descripcion: 'Traslado del equipo de montaje',
              modoCalculo: 'FIJO',
              configCalculoJson: { monto: 12000 },
            },
          },
        ],
        slotsMateriales: [
          {
            slotCodigo: 'sustrato_montaje',
            slotNombre: 'Plancha',
            modoSeleccion: 'COMERCIAL_ELIGE',
            candidatos: [
              {
                materiaPrimaId: 'mp-pvc',
                defaultVarianteId: 'var-pvc3',
                todasLasVariantes: false,
                materiaPrima: { nombre: 'PVC espumado', variantes: [] },
                variantes: [
                  {
                    variante: {
                      id: 'var-pvc3',
                      sku: 'PVC-3',
                      nombreVariante: null,
                      precioReferencia: 500,
                      atributosVarianteJson: {
                        espesorMm: 3,
                        anchoMm: 1220,
                        colorBase: 'Blanco',
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const form = await servicio(fixture).obtener('t1', 'prod-1');
    const slot = form.preguntas.find(
      (p) => p.jobContextKey === 'slotMateriales.pe-montaje_sustrato_montaje',
    );
    expect(slot).toBeDefined();
    const opciones = slot!.opciones as Array<Record<string, unknown>>;
    // La etiqueta distingue color (colorBase): dos planchas del mismo espesor
    // sólo difieren en eso.
    expect(opciones[0].etiqueta).toBe(
      'PVC espumado · 3mm · 1220mm de ancho · Blanco',
    );
    const cargoExtra = form.adicionales.find(
      (a) => a.id === 'cargo-extra-montaje',
    );
    expect(cargoExtra).toMatchObject({
      tipo: 'cargo_paso',
      configPasoId: 'pe-montaje',
      jobContextKey: 'opcionalesActivados.cargo-extra-montaje',
    });
  });

  it('personalizaciones: clave de medida, no de área calculada', async () => {
    const fixture = productoFixture();
    (fixture as Record<string, unknown>).personalizacionesJson = [
      {
        codigo: 'pers_1',
        nombre: 'Estampa pecho',
        modoMedida: 'CLIENTE',
        anchoMm: 280,
        altoMm: 280,
        obligatoria: false,
      },
    ];
    const form = await servicio(fixture).obtener('t1', 'prod-1');
    expect(form.personalizaciones[0].jobContextKey).toBe(
      'personalizacion_pers_1',
    );
    expect(form.personalizaciones[0].modoMedida).toBe('CLIENTE');
  });
});
