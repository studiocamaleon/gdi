import { BadRequestException } from '@nestjs/common';
import { resolverJobContextComponente } from '../componentes-configuracion';

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
            expresion: 'padre.cantidad * 1',
            requerido: true,
          },
          {
            clave: 'medidaCustomMm.anchoMm',
            origen: 'FORMULA',
            expresion: 'padre.medidas.ancho - 40',
            requerido: true,
          },
          {
            clave: 'medidaCustomMm.altoMm',
            origen: 'FORMULA',
            expresion: 'padre.medidas.alto - 60',
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
});
