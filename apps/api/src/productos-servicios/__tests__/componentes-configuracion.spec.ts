import { BadRequestException } from '@nestjs/common';
import {
  ordenarComponentesPorCalculo,
  resolverJobContextComponente,
  validarConfiguracionComponente,
} from '../componentes-configuracion';

describe('configuración de componentes fabricados', () => {
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
