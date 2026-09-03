import { MotorUniversalService } from '../motor.service';
import type { JobContext, MaterialEjecutado, PasoCargado } from '../tipos';

type MotorConPrivados = {
  calcularDesgasteMaquina: (
    paso: PasoCargado,
    jobContext: JobContext,
    nesting: null,
    material: null,
  ) => MaterialEjecutado[];
};

function createService(): MotorConPrivados {
  return Object.create(
    MotorUniversalService.prototype,
  ) as unknown as MotorConPrivados;
}

function tinta(id: string, color: string, consumoBase: number) {
  return {
    id,
    perfilOperativoId: 'perfil-cad',
    nombre: `Tinta ${color}`,
    tipo: 'tinta',
    unidad: 'ml',
    rendimientoEstimado: null,
    consumoBase,
    consumoPorCoberturaJson: null,
    activo: true,
    detalleJson: { color },
    materialVariante: {
      id: `variante-${id}`,
      sku: `SKU-${color}`,
      precioReferencia: 100,
      unidadStock: 'ml',
    },
  };
}

describe('Motor — desgaste del cabezal de Plotter CAD', () => {
  it('usa la suma de los consumos CMYK del perfil, sin un campo duplicado', () => {
    const service = createService();
    const paso = {
      familiaCodigo: 'impresion_por_area',
      slots: [
        {
          slotCodigo: 'sustrato_principal',
          mermaAdicionalPct: 10,
        },
      ],
      perfilM1Id: 'perfil-cad',
      perfil: {
        id: 'perfil-cad',
        nombre: 'Planos CAD',
        detalleJson: { colores: ['CMYK'] },
      },
      maquina: {
        id: 'plotter-cad',
        codigo: 'CAD-001',
        nombre: 'Plotter CAD',
        plantilla: 'PLOTTER_CAD',
        consumibles: [
          tinta('c', 'cian', 0.06),
          tinta('m', 'magenta', 0.06),
          tinta('y', 'amarillo', 0.06),
          tinta('k', 'negro', 0.8),
        ],
        componentesDesgaste: [
          {
            id: 'cabezal',
            nombre: 'Cabezal de impresión',
            tipo: 'cabezal',
            unidadDesgaste: 'ml_tinta',
            vidaUtilEstimada: 10_000,
            precioUnitario: 500_000,
            soloColor: false,
            activo: true,
            materiaPrimaVarianteId: null,
            materiaPrimaVariante: null,
          },
        ],
      },
    } as unknown as PasoCargado;

    const lineas = service.calcularDesgasteMaquina(
      paso,
      { m2: 10, caras: 1 } as unknown as JobContext,
      null,
      null,
    );

    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toMatchObject({
      slotNombre: 'Cabezal de impresión',
      unidad: 'ml',
      estrategiaCosto: 'costo_por_ml_tinta',
      modoSeleccion: 'MAQUINA_DESGASTE',
    });
    expect(lineas[0].cantidad).toBeCloseTo(10.78, 8);
    expect(lineas[0].precioUnitario).toBeCloseTo(50, 8);
    expect(lineas[0].costoTotal).toBeCloseTo(539, 8);
    expect(lineas[0].mermaAdicional).toEqual({
      porcentaje: 10,
      cantidadTrabajo: 9.8,
      cantidadMerma: expect.closeTo(0.98, 8),
    });
  });
});
