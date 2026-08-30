import { BadRequestException } from '@nestjs/common';
import {
  leerConfiguracionesPasosCompuestos,
  leerDefinicionesPasoCompuesto,
  resolverPasoCompuesto,
} from '../pasos-compuestos';

describe('pasos compuestos', () => {
  it('separa la definición reutilizable de la configuración del producto', () => {
    const definiciones = leerDefinicionesPasoCompuesto([
      {
        codigo: 'tensar_lona',
        nombre: 'Tensar lona',
        dimension: 'LONGITUD',
        requerida: true,
        orden: 0,
      },
    ]);
    const configuraciones = leerConfiguracionesPasosCompuestos([
      {
        version: 1,
        nodoClave: 'ruta:ensamblaje',
        pasoTenantId: '7f3ec28c-eb81-4f41-aec1-7fe976793860',
        pasoNombre: 'Ensamblaje de cartel',
        operaciones: [
          {
            codigo: 'tensar_lona',
            nombre: 'Tensar lona',
            activa: true,
            componentesCodigos: ['lona', 'bastidor'],
            modoTiempo: 'POR_UNIDAD',
            fuenteCantidad: {
              tipo: 'COMPONENTE',
              componenteCodigo: 'bastidor',
              campo: 'perimetro_ml',
            },
            minutosPorUnidad: 5,
            unidadCantidad: 'm',
            dotacionOperarios: 2,
          },
        ],
      },
    ]);

    expect(definiciones[0]).not.toHaveProperty('componentesCodigos');
    expect(configuraciones[0].operaciones[0].componentesCodigos).toEqual([
      'lona',
      'bastidor',
    ]);
  });

  it('resuelve tiempo desde el output público de otro componente', () => {
    const configuracion = leerConfiguracionesPasosCompuestos([
      {
        version: 1,
        nodoClave: 'ruta:ensamblaje',
        pasoTenantId: '7f3ec28c-eb81-4f41-aec1-7fe976793860',
        pasoNombre: 'Ensamblaje de cartel',
        operaciones: [
          {
            codigo: 'tensar_lona',
            nombre: 'Tensar lona',
            activa: true,
            componentesCodigos: ['lona', 'bastidor'],
            modoTiempo: 'POR_UNIDAD',
            fuenteCantidad: {
              tipo: 'COMPONENTE',
              componenteCodigo: 'bastidor',
              campo: 'perimetro_ml',
            },
            minutosPorUnidad: 5,
            unidadCantidad: 'm',
            dotacionOperarios: 2,
          },
        ],
      },
    ])[0];

    const [resultado] = resolverPasoCompuesto({
      configuracion,
      contextoPadre: { cantidad: 1 },
      outputsComponentes: { bastidor: { perimetro_ml: 5 } },
      nombresComponentes: {
        lona: 'Lona Backlight',
        bastidor: 'Bastidor',
      },
    });

    expect(resultado.duracionMin).toBe(25);
    expect(resultado.componentesNombres).toEqual([
      'Lona Backlight',
      'Bastidor',
    ]);
  });

  it('rechaza una operación sin una regla controlada válida', () => {
    expect(() =>
      leerConfiguracionesPasosCompuestos([
        {
          version: 1,
          nodoClave: 'ruta:ensamblaje',
          pasoTenantId: '7f3ec28c-eb81-4f41-aec1-7fe976793860',
          pasoNombre: 'Ensamblaje',
          operaciones: [
            {
              codigo: 'montar',
              nombre: 'Montar',
              activa: true,
              componentesCodigos: ['modulos'],
              modoTiempo: 'POR_UNIDAD',
              minutosPorUnidad: 0,
            },
          ],
        },
      ]),
    ).toThrow(BadRequestException);
  });
});
