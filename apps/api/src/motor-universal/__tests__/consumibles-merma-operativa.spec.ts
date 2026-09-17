import { MotorUniversalService } from '../motor.service';
import type {
  ErrorMotor,
  JobContext,
  MaterialEjecutado,
  PasoCargado,
} from '../tipos';

type MotorConPrivados = {
  calcularConsumiblesMaquina: (
    paso: PasoCargado,
    jobContext: JobContext,
    nesting: null,
    errores: ErrorMotor[],
    material: null,
  ) => MaterialEjecutado[];
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

describe('Motor — consumibles con merma operativa', () => {
  it('aplica la pérdida del sustrato a la tinta y conserva el desglose', () => {
    const paso = {
      rutaPasoId: 'ruta',
      rutaPasoOrden: 1,
      configPasoId: 'config',
      familiaCodigo: 'impresion_por_area',
      perfilM1Id: 'perfil',
      slots: [
        {
          slotCodigo: 'sustrato_principal',
          mermaAdicionalPct: 20,
        },
      ],
      perfil: {
        id: 'perfil',
        nombre: 'Perfil BN',
        detalleJson: { colores: ['BN'] },
      },
      maquina: {
        id: 'plotter',
        nombre: 'Plotter',
        plantilla: 'PLOTTER_CAD',
        consumibles: [
          {
            id: 'tinta-k',
            perfilOperativoId: 'perfil',
            nombre: 'Tinta negra',
            tipo: 'tinta',
            unidad: 'ml',
            rendimientoEstimado: null,
            consumoBase: 2,
            consumoPorCoberturaJson: null,
            activo: true,
            detalleJson: { color: 'negro' },
            materialVariante: {
              id: 'variante-k',
              sku: 'TINTA-K',
              materiaPrimaNombre: 'Tinta negra',
              precioReferencia: 100,
              unidadStock: 'ml',
            },
          },
        ],
      },
    } as unknown as PasoCargado;
    const errores: ErrorMotor[] = [];

    const lineas = createService().calcularConsumiblesMaquina(
      paso,
      { m2: 2, caras: 1 } as unknown as JobContext,
      null,
      errores,
      null,
    );

    expect(errores).toEqual([]);
    expect(lineas).toHaveLength(1);
    expect(lineas[0].cantidad).toBeCloseTo(4.8);
    expect(lineas[0].costoTotal).toBeCloseTo(480);
    expect(lineas[0].mermaAdicional).toMatchObject({
      porcentaje: 20,
      cantidadTrabajo: 4,
      cantidadMerma: 0.8,
    });
  });

  it('aplica la misma pérdida a los clicks esperados de la máquina', () => {
    const paso = {
      rutaPasoId: 'ruta',
      rutaPasoOrden: 1,
      configPasoId: 'config',
      familiaCodigo: 'impresion_por_hoja',
      mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
      slots: [
        {
          slotCodigo: 'sustrato_principal',
          mermaAdicionalPct: 20,
        },
      ],
      maquina: {
        id: 'laser',
        nombre: 'Láser',
        plantilla: 'IMPRESORA_LASER',
        componentesDesgaste: [
          {
            id: 'drum',
            nombre: 'Drum negro',
            unidadDesgaste: 'COPIAS_A4_EQUIV',
            vidaUtilEstimada: 1_000,
            precioUnitario: 100,
            soloColor: false,
          },
        ],
      },
    } as unknown as PasoCargado;

    const lineas = createService().calcularDesgasteMaquina(
      paso,
      { cantidad: 10, caras: 1 } as unknown as JobContext,
      null,
      null,
    );

    expect(lineas).toHaveLength(1);
    expect(lineas[0].cantidad).toBeCloseTo(12);
    expect(lineas[0].costoTotal).toBeCloseTo(1.2);
    expect(lineas[0].mermaAdicional).toMatchObject({
      porcentaje: 20,
      cantidadTrabajo: 10,
      cantidadMerma: 2,
    });
  });
});
