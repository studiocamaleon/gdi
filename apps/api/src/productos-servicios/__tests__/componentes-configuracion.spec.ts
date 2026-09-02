import { BadRequestException } from '@nestjs/common';
import {
  ordenarComponentesPorCalculo,
  proyectarEspecificacionesEfectivasComponente,
  resolverJobContextComponente,
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
