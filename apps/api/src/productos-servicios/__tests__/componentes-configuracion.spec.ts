import { BadRequestException } from '@nestjs/common';
import {
  agruparComponentesPorNivelCalculo,
  codigoOcurrenciaComponente,
  leerOcurrenciasAdicionalesComponente,
  ordenarComponentesPorCalculo,
  proyectarEspecificacionesEfectivasComponente,
  resolverJobContextComponente,
  resolverOcurrenciasCotizadasComponente,
  resolverOperacionesIncorporacion,
  validarConfiguracionComponente,
} from '../componentes-configuracion';

describe('configuración de componentes fabricados', () => {
  it('proyecta todos los parámetros efectivos con etiquetas humanas', () => {
    const configuracion = {
      version: 1,
      bindings: [
        {
          clave: 'cantidad',
          etiqueta: 'Cantidad de piezas',
          tipoDato: 'number',
          unidad: 'unidad',
          origen: 'FORMULA',
          requerido: true,
          regla: {
            campoPadre: 'cantidad',
            operador: 'MULTIPLICAR',
            valor: 2,
          },
        },
        {
          clave: 'medidaCustomMm.anchoMm',
          etiqueta: 'Ancho',
          tipoDato: 'number',
          unidad: 'mm',
          origen: 'FIJO',
          valor: 1000,
        },
        {
          clave: 'modoColor_impresion',
          etiqueta: 'Impresión por área',
          tipoDato: 'modo_color',
          origen: 'DEFAULT_HIJO',
          valor: 'CMYK+blanco',
          opciones: [{ valor: 'CMYK+blanco', etiqueta: 'CMYK + Blanco' }],
        },
        {
          clave: 'opcionalesActivados.diseno',
          etiqueta: 'Diseño gráfico',
          tipoDato: 'boolean',
          origen: 'COTIZACION',
          valor: false,
        },
      ],
    };
    const jobContext = resolverJobContextComponente({
      configuracion,
      contextoPadre: { cantidad: 3 },
      codigoComponente: 'vinilo',
      cantidadLegacy: 1,
    });

    expect(
      proyectarEspecificacionesEfectivasComponente({
        configuracion,
        jobContext,
      }),
    ).toEqual([
      expect.objectContaining({
        clave: 'cantidad',
        etiqueta: 'Cantidad de piezas',
        origen: 'FORMULA',
        valor: 6,
        valorTexto: '6',
      }),
      expect.objectContaining({
        clave: 'medidaCustomMm.anchoMm',
        etiqueta: 'Ancho',
        valor: 1000,
      }),
      expect.objectContaining({
        clave: 'modoColor_impresion',
        etiqueta: 'Impresión por área',
        valor: 'CMYK+blanco',
        valorTexto: 'CMYK + Blanco',
      }),
      expect.objectContaining({
        clave: 'opcionalesActivados.diseno',
        etiqueta: 'Diseño gráfico',
        valor: false,
        valorTexto: 'No',
      }),
    ]);
  });

  it('resuelve operaciones fijas y por output público sin fórmulas libres', () => {
    const operaciones = resolverOperacionesIncorporacion({
      configuracion: {
        version: 2,
        bindings: [{ clave: 'cantidad', origen: 'FIJO', valor: 1 }],
        operacionesIncorporacion: [
          {
            codigo: 'tensar_lona',
            nombre: 'Tensar lona',
            modoTiempo: 'POR_UNIDAD',
            fuenteCantidad: {
              tipo: 'COMPONENTE',
              componenteCodigo: 'bastidor',
              campo: 'ml_estructura',
            },
            unidadCantidad: 'm',
            minutosPorUnidad: 5,
            dotacionOperarios: 2,
            orden: 1,
          },
          {
            codigo: 'prueba',
            nombre: 'Conexión y prueba',
            modoTiempo: 'FIJO',
            minutosFijos: 20,
            orden: 2,
          },
        ],
      },
      contextoPadre: { cantidad: 1 },
      outputsComponentes: { bastidor: { ml_estructura: 6 } },
      componenteCodigo: 'lona',
      componenteNombre: 'Lona Backlight',
      nodoDestinoClave: 'ruta:ensamblaje',
    });

    expect(operaciones).toEqual([
      expect.objectContaining({
        codigo: 'tensar_lona',
        cantidadResuelta: 6,
        duracionMin: 30,
        dotacionOperarios: 2,
      }),
      expect.objectContaining({
        codigo: 'prueba',
        cantidadResuelta: 1,
        duracionMin: 20,
        dotacionOperarios: 1,
      }),
    ]);
  });

  it('combina fórmula, herencia, fijo y dato de cotización en un JobContext normal', () => {
    const result = resolverJobContextComponente({
      codigoComponente: 'vinilo_impreso',
      cantidadLegacy: 1,
      contextoPadre: {
        cantidad: 30,
        medidaCustomMm: { anchoMm: 800, altoMm: 1800 },
        componentesConfiguracion: {
          vinilo_impreso: { laminado: 'mate' },
        },
      },
      configuracion: {
        version: 1,
        bindings: [
          {
            clave: 'cantidad',
            origen: 'FORMULA',
            regla: {
              campoPadre: 'cantidad',
              operador: 'MULTIPLICAR',
              valor: 1,
            },
            requerido: true,
          },
          {
            clave: 'medidaCustomMm.anchoMm',
            origen: 'FORMULA',
            regla: {
              campoPadre: 'medidaCustomMm.anchoMm',
              operador: 'RESTAR',
              valor: 40,
            },
            requerido: true,
          },
          {
            clave: 'medidaCustomMm.altoMm',
            origen: 'FORMULA',
            regla: {
              campoPadre: 'medidaCustomMm.altoMm',
              operador: 'RESTAR',
              valor: 60,
            },
            requerido: true,
          },
          {
            clave: 'calidad',
            origen: 'FIJO',
            valor: 'alta',
          },
          {
            clave: 'laminado',
            etiqueta: 'Laminado',
            origen: 'COTIZACION',
            requerido: true,
          },
        ],
      },
    });

    expect(result).toMatchObject({
      cantidad: 30,
      medidaCustomMm: { anchoMm: 760, altoMm: 1740 },
      piezas: [{ cantidad: 30, anchoMm: 760, altoMm: 1740 }],
      calidad: 'alta',
      laminado: 'mate',
    });
    expect(result.piezaAreaTotalM2).toBeCloseTo(39.672);
  });

  it('inyecta activaciones opcionales resueltas dentro del JobContext hijo', () => {
    const result = resolverJobContextComponente({
      codigoComponente: 'lona_backlight',
      cantidadLegacy: 1,
      contextoPadre: {
        cantidad: 1,
        componentesConfiguracion: {
          lona_backlight: {
            opcionalesActivados: { 'paso-diseno': true },
          },
        },
      },
      configuracion: {
        version: 2,
        bindings: [
          {
            clave: 'cantidad',
            origen: 'FIJO',
            valor: 1,
            requerido: true,
          },
          {
            clave: 'opcionalesActivados.paso-diseno',
            etiqueta: 'Diseño gráfico',
            tipoDato: 'boolean',
            origen: 'COTIZACION',
            valor: false,
          },
        ],
      },
    });

    expect(result).toMatchObject({
      cantidad: 1,
      opcionalesActivados: { 'paso-diseno': true },
    });
  });

  it('transporta y valida la fuente vectorial propia de un componente', () => {
    const fuente = {
      schemaVersion: 1,
      nombreArchivo: 'frente.svg',
      svg: '<svg viewBox="0 0 20 10"><path d="M0 0h20v10H0z"/></svg>',
      anchoFinalMm: 200,
      altoFinalMm: 100,
    };
    const configuracion = {
      version: 2,
      bindings: [
        { clave: 'cantidad', origen: 'FIJO', valor: 1 },
        {
          clave: 'disenoVectorialFuente',
          tipoDato: 'vectorial',
          origen: 'COTIZACION',
          requerido: true,
        },
      ],
    };

    expect(
      resolverJobContextComponente({
        configuracion,
        contextoPadre: {
          cantidad: 1,
          componentesConfiguracion: {
            frente: { disenoVectorialFuente: fuente },
          },
        },
        codigoComponente: 'frente',
        cantidadLegacy: 1,
      }),
    ).toMatchObject({ cantidad: 1, disenoVectorialFuente: fuente });

    expect(() =>
      resolverJobContextComponente({
        configuracion,
        contextoPadre: {
          cantidad: 1,
          componentesConfiguracion: {
            frente: { disenoVectorialFuente: { svg: 'incompleto' } },
          },
        },
        codigoComponente: 'frente',
        cantidadLegacy: 1,
      }),
    ).toThrow(BadRequestException);
  });

  it('mantiene la compatibilidad con componentes anteriores', () => {
    expect(
      resolverJobContextComponente({
        configuracion: null,
        contextoPadre: { cantidad: 8 },
        codigoComponente: 'caja',
        cantidadLegacy: 2,
      }),
    ).toEqual({ cantidad: 16 });
  });

  it('valida y resuelve ocurrencias adicionales autorizadas por la receta', () => {
    const configuracion = {
      version: 2,
      bindings: [
        {
          clave: 'cantidad',
          origen: 'PADRE',
          padreClave: 'cantidad',
        },
        {
          clave: 'medidaCustomMm.anchoMm',
          origen: 'COTIZACION',
          requerido: true,
        },
      ],
      repeticion: { version: 1, permitida: true, maximo: 4 },
    };
    const contextoPadre = {
      cantidad: 10,
      componentesConfiguracion: {
        estampa: {
          __ocurrenciasAdicionales: [
            {
              id: 'manga-derecha',
              nombre: 'Estampa manga derecha',
              valores: { medidaCustomMm: { anchoMm: 80 } },
            },
          ],
        },
      },
    };

    const [ocurrencia] = leerOcurrenciasAdicionalesComponente({
      configuracion,
      contextoPadre,
      codigoComponente: 'estampa',
      nombreComponente: 'Estampa',
    });
    const jobContext = resolverJobContextComponente({
      configuracion,
      contextoPadre,
      codigoComponente: 'estampa',
      cantidadLegacy: 1,
      overrideCotizacion: ocurrencia.valores,
    });

    expect(ocurrencia.nombre).toBe('Estampa manga derecha');
    expect(codigoOcurrenciaComponente('estampa', ocurrencia.id)).toBe(
      'estampa__manga-derecha',
    );
    expect(jobContext).toMatchObject({
      cantidad: 10,
      medidaCustomMm: { anchoMm: 80 },
    });
  });

  it('permite que una plantilla 0..N comience vacía y materializa sólo lo agregado', () => {
    const configuracion = {
      version: 2,
      bindings: [{ clave: 'cantidad', origen: 'FIJO', valor: 1 }],
      repeticion: {
        version: 1,
        permitida: true,
        minimo: 0,
        maximo: 3,
      },
    };

    expect(
      resolverOcurrenciasCotizadasComponente({
        configuracion,
        contextoPadre: { cantidad: 10 },
        codigoComponente: 'estampa',
        nombreComponente: 'Estampa DTF',
      }),
    ).toEqual([]);

    expect(
      resolverOcurrenciasCotizadasComponente({
        configuracion,
        contextoPadre: {
          cantidad: 10,
          componentesConfiguracion: {
            estampa: {
              __ocurrenciasAdicionales: [
                {
                  id: 'manga',
                  nombre: 'Estampa manga',
                  valores: { medidaCustomMm: { anchoMm: 80, altoMm: 60 } },
                },
              ],
            },
          },
        },
        codigoComponente: 'estampa',
        nombreComponente: 'Estampa DTF',
      }),
    ).toEqual([
      expect.objectContaining({
        codigo: 'estampa__manga',
        nombre: 'Estampa manga',
        ocurrenciaId: 'manga',
      }),
    ]);
  });

  it('mantiene una ocurrencia base en recetas repetibles anteriores', () => {
    expect(
      resolverOcurrenciasCotizadasComponente({
        configuracion: {
          version: 2,
          bindings: [{ clave: 'cantidad', origen: 'FIJO', valor: 1 }],
          repeticion: { version: 1, permitida: true, maximo: 3 },
        },
        contextoPadre: { cantidad: 1 },
        codigoComponente: 'frente',
        nombreComponente: 'Frente',
      }),
    ).toEqual([{ codigo: 'frente', nombre: 'Frente' }]);
  });

  it('rechaza ocurrencias adicionales si la plantilla no las permite', () => {
    expect(() =>
      leerOcurrenciasAdicionalesComponente({
        configuracion: {
          version: 1,
          bindings: [{ clave: 'cantidad', origen: 'FIJO', valor: 1 }],
        },
        contextoPadre: {
          cantidad: 1,
          componentesConfiguracion: {
            estampa: {
              __ocurrenciasAdicionales: [
                { id: 'manga', nombre: 'Manga', valores: {} },
              ],
            },
          },
        },
        codigoComponente: 'estampa',
        nombreComponente: 'Estampa',
      }),
    ).toThrow(BadRequestException);
  });

  it('acepta una colección vacía si el componente no admite ocurrencias', () => {
    expect(
      leerOcurrenciasAdicionalesComponente({
        configuracion: {
          version: 1,
          bindings: [{ clave: 'cantidad', origen: 'FIJO', valor: 1 }],
        },
        contextoPadre: {
          cantidad: 1,
          componentesConfiguracion: {
            frentes: { __ocurrenciasAdicionales: [] },
          },
        },
        codigoComponente: 'frentes',
        nombreComponente: 'Frentes de vinilo',
      }),
    ).toEqual([]);
  });

  it('impide cotizar si falta un dato solicitado', () => {
    expect(() =>
      resolverJobContextComponente({
        codigoComponente: 'vinilo',
        cantidadLegacy: 1,
        contextoPadre: { cantidad: 2 },
        configuracion: {
          version: 1,
          bindings: [
            {
              clave: 'laminado',
              etiqueta: 'Laminado',
              origen: 'COTIZACION',
              requerido: true,
            },
          ],
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza expresiones que intentan ejecutar código', () => {
    expect(() =>
      resolverJobContextComponente({
        codigoComponente: 'vinilo',
        cantidadLegacy: 1,
        contextoPadre: { cantidad: 2 },
        configuracion: {
          version: 1,
          bindings: [
            {
              clave: 'cantidad',
              origen: 'FORMULA',
              expresion: 'process.exit(1)',
            },
          ],
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza reglas manipuladas fuera de los controles permitidos', () => {
    expect(() =>
      validarConfiguracionComponente(
        {
          version: 1,
          bindings: [
            {
              clave: 'cantidad',
              origen: 'FORMULA',
              regla: {
                campoPadre: 'cantidad',
                operador: 'EJECUTAR',
                valor: 1,
              },
            },
          ],
        },
        'Vinilo',
      ),
    ).toThrow(BadRequestException);
  });

  it('resuelve parámetros desde outputs públicos de otro componente', () => {
    const result = resolverJobContextComponente({
      codigoComponente: 'lona_backlight',
      cantidadLegacy: 1,
      contextoPadre: { cantidad: 1 },
      outputsComponentes: {
        bastidor: {
          'lonaBrutaMm.anchoMm': 2080,
          'lonaBrutaMm.altoMm': 1080,
        },
      },
      configuracion: {
        version: 1,
        bindings: [
          {
            clave: 'cantidad',
            origen: 'FIJO',
            valor: 1,
            requerido: true,
          },
          {
            clave: 'medidaCustomMm.anchoMm',
            origen: 'PADRE',
            requerido: true,
            regla: {
              campoPadre: 'lonaBrutaMm.anchoMm',
              operador: 'COPIAR',
              fuente: {
                tipo: 'COMPONENTE',
                componenteCodigo: 'bastidor',
                campo: 'lonaBrutaMm.anchoMm',
              },
            },
          },
          {
            clave: 'medidaCustomMm.altoMm',
            origen: 'FORMULA',
            requerido: true,
            regla: {
              campoPadre: 'lonaBrutaMm.altoMm',
              operador: 'SUMAR',
              valor: 20,
              fuente: {
                tipo: 'COMPONENTE',
                componenteCodigo: 'bastidor',
                campo: 'lonaBrutaMm.altoMm',
              },
            },
          },
        ],
      },
    });

    expect(result).toMatchObject({
      cantidad: 1,
      medidaCustomMm: { anchoMm: 2080, altoMm: 1100 },
    });
  });

  it('ordena el cálculo por dependencias sin usar el orden visual', () => {
    const componentes = [
      {
        codigo: 'lona',
        nombre: 'Lona',
        orden: 1,
        configuracionJson: {
          version: 1,
          bindings: [
            {
              clave: 'cantidad',
              origen: 'PADRE',
              regla: {
                campoPadre: 'ml_estructura',
                operador: 'COPIAR',
                fuente: {
                  tipo: 'COMPONENTE',
                  componenteCodigo: 'bastidor',
                  campo: 'ml_estructura',
                },
              },
            },
          ],
        },
      },
      {
        codigo: 'bastidor',
        nombre: 'Bastidor',
        orden: 2,
        configuracionJson: null,
      },
    ];

    expect(
      ordenarComponentesPorCalculo(componentes).map((item) => item.codigo),
    ).toEqual(['bastidor', 'lona']);
    expect(
      agruparComponentesPorNivelCalculo([
        ...componentes,
        {
          codigo: 'frente',
          nombre: 'Frente independiente',
          orden: 3,
          configuracionJson: null,
        },
      ]).map((nivel) => nivel.map((item) => item.codigo)),
    ).toEqual([['bastidor', 'frente'], ['lona']]);
  });

  it('reutiliza la misma fuente vectorial nombrada del padre en un hijo', () => {
    const fuente = {
      schemaVersion: 1,
      nombreArchivo: 'contorno-cartel.svg',
      svg: '<svg viewBox="0 0 100 50"><path d="M0 0h100v50H0z"/></svg>',
      anchoFinalMm: 1_000,
      altoFinalMm: 500,
    };
    const result = resolverJobContextComponente({
      codigoComponente: 'frente_acrilico',
      cantidadLegacy: 1,
      contextoPadre: {
        cantidad: 2,
        geometriasVectoriales: { contorno_cartel: fuente },
      },
      configuracion: {
        version: 1,
        bindings: [
          {
            clave: 'cantidad',
            origen: 'PADRE',
            requerido: true,
            padreClave: 'cantidad',
          },
          {
            clave: 'disenoVectorialFuente',
            etiqueta: 'Diseño vectorial',
            tipoDato: 'vectorial',
            origen: 'PADRE',
            requerido: true,
            padreClave: 'geometriasVectoriales.contorno_cartel',
          },
          {
            clave: 'medidaCustomMm.anchoMm',
            etiqueta: 'Ancho',
            tipoDato: 'number',
            origen: 'COTIZACION',
            requerido: true,
          },
          {
            clave: 'medidaCustomMm.altoMm',
            etiqueta: 'Alto',
            tipoDato: 'number',
            origen: 'COTIZACION',
            requerido: true,
          },
        ],
      },
    });

    expect(result.cantidad).toBe(2);
    expect(result.disenoVectorialFuente).toEqual(fuente);
    expect(result.medidaCustomMm).toEqual({
      anchoMm: 1_000,
      altoMm: 500,
    });
    expect(result.piezas).toEqual([
      { cantidad: 2, anchoMm: 1_000, altoMm: 500 },
    ]);
  });

  it('obtiene el alto proporcional del SVG cuando la fuente sólo fija el ancho', () => {
    const result = resolverJobContextComponente({
      codigoComponente: 'frente_acrilico',
      cantidadLegacy: 1,
      contextoPadre: { cantidad: 1 },
      configuracion: {
        version: 1,
        bindings: [
          {
            clave: 'cantidad',
            origen: 'PADRE',
            requerido: true,
            padreClave: 'cantidad',
          },
          {
            clave: 'disenoVectorialFuente',
            origen: 'FIJO',
            requerido: true,
            valor: {
              schemaVersion: 1,
              nombreArchivo: 'frente.svg',
              svg: '<svg viewBox="0 0 200 50"><path d="M0 0h200v50H0z"/></svg>',
              anchoFinalMm: 800,
            },
          },
          {
            clave: 'medidaCustomMm.anchoMm',
            etiqueta: 'Ancho',
            origen: 'COTIZACION',
            requerido: true,
          },
          {
            clave: 'medidaCustomMm.altoMm',
            etiqueta: 'Alto',
            origen: 'COTIZACION',
            requerido: true,
          },
        ],
      },
    });

    expect(result.medidaCustomMm).toEqual({ anchoMm: 800, altoMm: 200 });
  });

  it('rechaza ciclos entre outputs de componentes', () => {
    const componente = (codigo: string, dependeDe: string) => ({
      codigo,
      nombre: codigo,
      configuracionJson: {
        version: 1,
        bindings: [
          {
            clave: 'cantidad',
            origen: 'PADRE',
            regla: {
              campoPadre: 'salida',
              operador: 'COPIAR',
              fuente: {
                tipo: 'COMPONENTE',
                componenteCodigo: dependeDe,
                campo: 'salida',
              },
            },
          },
        ],
      },
    });

    expect(() =>
      ordenarComponentesPorCalculo([
        componente('estructura', 'lona'),
        componente('lona', 'estructura'),
      ]),
    ).toThrow(BadRequestException);
  });
});
