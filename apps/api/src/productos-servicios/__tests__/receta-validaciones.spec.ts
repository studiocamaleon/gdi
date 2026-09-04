import { BadRequestException } from '@nestjs/common';
import { UnidadMateriaPrima } from '@prisma/client';
import { RecetasProductoService } from '../recetas-producto.service';

type ValidadorInterno = {
  validarUnidades(
    snapshot: {
      pasos: Array<{
        nombre: string;
        slots: Array<Record<string, unknown>>;
      }>;
    },
    unidades: Map<
      string,
      { unidad: UnidadMateriaPrima | null; sku: string; nombre: string }
    >,
  ): void;
  validarCiclos(
    tenantId: string,
    productoRaizId: string,
    componentesIniciales: string[],
  ): Promise<void>;
  validarReferenciasBorrador(
    tenantId: string,
    productoId: string,
    documentos: Array<Record<string, unknown>>,
    componentes: Array<Record<string, unknown>>,
    clavesPaso?: Set<string>,
    atributosComercialesJson?: unknown,
  ): Promise<void>;
};

function servicioConPrisma(prisma: Record<string, unknown>) {
  return new RecetasProductoService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  ) as unknown as ValidadorInterno;
}

describe('validaciones industriales de receta', () => {
  it('rechaza unidades incompatibles también en variantes candidatas', () => {
    const servicio = servicioConPrisma({});

    expect(() =>
      servicio.validarUnidades(
        {
          pasos: [
            {
              nombre: 'Frente impreso',
              slots: [
                {
                  slotCodigo: 'sustrato_principal',
                  formula: 'por_m2',
                  candidatos: [
                    {
                      defaultVarianteId: 'variante-unidad',
                      variantes: [{ variante: { id: 'variante-m2' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        new Map([
          [
            'variante-unidad',
            {
              unidad: UnidadMateriaPrima.UNIDAD,
              sku: 'UNIDAD',
              nombre: 'Variante por unidad',
            },
          ],
          [
            'variante-m2',
            {
              unidad: UnidadMateriaPrima.M2,
              sku: 'M2',
              nombre: 'Variante por metro cuadrado',
            },
          ],
        ]),
      ),
    ).toThrow(BadRequestException);
  });

  it('rechaza un componente fabricado sin receta publicada', async () => {
    const servicio = servicioConPrisma({
      productoReceta: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      servicio.validarCiclos('tenant-1', 'producto-raiz', ['componente-1']),
    ).rejects.toThrow('debe tener una receta publicada');
  });

  it('detecta ciclos indirectos entre productos fabricados', async () => {
    const servicio = servicioConPrisma({
      productoReceta: {
        findFirst: jest.fn().mockResolvedValue({
          revisionPublicada: {
            componentes: [{ productoComponenteId: 'producto-raiz' }],
          },
        }),
      },
    });

    await expect(
      servicio.validarCiclos('tenant-1', 'producto-raiz', ['componente-1']),
    ).rejects.toThrow('ciclo de componentes');
  });

  it('rechaza configuraciones de parámetros con formato inválido', async () => {
    const servicio = servicioConPrisma({});

    await expect(
      servicio.validarReferenciasBorrador(
        'tenant-1',
        'producto-raiz',
        [],
        [
          {
            productoComponenteId: 'componente-1',
            codigo: 'COMP-1',
            nombre: 'Componente',
            formula: 'por_unidad',
            cantidad: 1,
            unidad: 'unidad',
            configuracionJson: { version: 9, bindings: [] },
          },
        ],
      ),
    ).rejects.toThrow('no tiene un formato válido');
  });

  it('acepta dos ocurrencias del mismo producto con códigos distintos', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const servicio = servicioConPrisma({ producto: { count } });

    await expect(
      servicio.validarReferenciasBorrador(
        'tenant-1',
        'producto-raiz',
        [],
        [
          {
            productoComponenteId: 'vinilo-impreso',
            codigo: 'VINILO-IMPRESO',
            nombre: 'Vinilo frente',
            formula: 'por_unidad',
            cantidad: 1,
            unidad: 'unidad',
          },
          {
            productoComponenteId: 'vinilo-impreso',
            codigo: 'VINILO-IMPRESO-2',
            nombre: 'Vinilo lateral',
            formula: 'por_unidad',
            cantidad: 1,
            unidad: 'unidad',
          },
        ],
        new Set(),
      ),
    ).resolves.toBeUndefined();
    expect(count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['vinilo-impreso'] },
        activo: true,
      },
    });
  });

  it('rechaza un componente que hereda una fuente geométrica eliminada', async () => {
    const servicio = servicioConPrisma({});

    await expect(
      servicio.validarReferenciasBorrador(
        'tenant-1',
        'producto-raiz',
        [],
        [
          {
            productoComponenteId: 'componente-vectorial',
            codigo: 'FRENTE',
            nombre: 'Frente de acrílico',
            formula: 'por_unidad',
            cantidad: 1,
            unidad: 'unidad',
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
                    campoPadre: 'geometriasVectoriales.contorno_viejo',
                    operador: 'COPIAR',
                    fuente: {
                      tipo: 'PADRE',
                      campo: 'geometriasVectoriales.contorno_viejo',
                    },
                  },
                },
              ],
            },
          },
        ],
        new Set(),
        {
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
      ),
    ).rejects.toThrow('ya no existe');
  });
});
