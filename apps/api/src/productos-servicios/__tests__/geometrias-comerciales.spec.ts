import { BadRequestException } from '@nestjs/common';
import {
  leerGeometriasComerciales,
  validarGeometriasComerciales,
} from '../geometrias-comerciales';
import { ProductosService } from '../productos.service';

describe('geometrías comerciales', () => {
  it('mantiene productos legacy como rectangulares sin fuentes', () => {
    expect(leerGeometriasComerciales(null)).toEqual({
      version: 1,
      modo: 'RECTANGULAR',
      fuentes: [],
      permitirCotizacionManual: false,
    });
  });

  it('conserva fuentes nombradas para compartirlas entre componentes', () => {
    const atributos = {
      otraConfiguracion: true,
      geometriasComerciales: {
        version: 1,
        modo: 'VECTORIAL',
        fuentes: [
          {
            id: 'contorno_cartel',
            nombre: 'Contorno del cartel',
            requerida: true,
          },
          { id: 'frente', nombre: 'Frente', requerida: false },
        ],
      },
    };
    expect(leerGeometriasComerciales(atributos)).toEqual({
      ...atributos.geometriasComerciales,
      permitirCotizacionManual: false,
    });
    expect(() => validarGeometriasComerciales(atributos)).not.toThrow();
  });

  it('conserva la excepción manual sólo cuando fue habilitada', () => {
    const atributos = {
      geometriasComerciales: {
        version: 1,
        modo: 'VECTORIAL',
        fuentes: [{ id: 'principal', nombre: 'Principal', requerida: true }],
        permitirCotizacionManual: true,
      },
    };
    expect(leerGeometriasComerciales(atributos).permitirCotizacionManual).toBe(
      true,
    );
    expect(() => validarGeometriasComerciales(atributos)).not.toThrow();
  });

  it('rechaza identificadores repetidos y un vectorial sin fuentes', () => {
    expect(() =>
      validarGeometriasComerciales({
        geometriasComerciales: {
          version: 1,
          modo: 'VECTORIAL',
          fuentes: [],
        },
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validarGeometriasComerciales({
        geometriasComerciales: {
          version: 1,
          modo: 'AMBAS',
          fuentes: [
            { id: 'frente', nombre: 'Frente', requerida: true },
            { id: 'frente', nombre: 'Dorso', requerida: true },
          ],
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('no permite eliminar una fuente que una receta todavía hereda', async () => {
    const prisma = {
      producto: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'producto-padre',
          sistemaCodigo: null,
          updatedAt: new Date('2026-09-03T12:00:00.000Z'),
          atributosComercialesJson: {
            geometriasComerciales: {
              version: 1,
              modo: 'VECTORIAL',
              fuentes: [
                {
                  id: 'contorno_principal',
                  nombre: 'Contorno principal',
                  requerida: true,
                },
              ],
            },
          },
        }),
      },
      productoRecetaComponente: {
        findMany: jest.fn().mockResolvedValue([
          {
            nombre: 'Frente de acrílico',
            configuracionJson: {
              version: 2,
              bindings: [
                {
                  clave: 'cantidad',
                  origen: 'PADRE',
                  requerido: true,
                  padreClave: 'cantidad',
                },
                {
                  clave: 'disenoVectorialFuente',
                  origen: 'PADRE',
                  requerido: true,
                  regla: {
                    campoPadre: 'geometriasVectoriales.contorno_principal',
                    operador: 'COPIAR',
                    fuente: {
                      tipo: 'PADRE',
                      campo: 'geometriasVectoriales.contorno_principal',
                    },
                  },
                },
              ],
            },
          },
        ]),
      },
    };
    const servicio = new ProductosService(prisma as never);

    await expect(
      servicio.actualizarProducto('tenant-1', 'producto-padre', {
        atributosComercialesJson: {
          geometriasComerciales: {
            version: 1,
            modo: 'RECTANGULAR',
            fuentes: [],
          },
        },
      } as never),
    ).rejects.toThrow('Frente de acrílico');
  });
});
