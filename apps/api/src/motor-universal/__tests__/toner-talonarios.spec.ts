import { runNestingForPaso } from '../nesting-dispatcher';
import { MotorUniversalService } from '../motor.service';
import type {
  ErrorMotor,
  JobContext,
  MaterialEjecutado,
  PasoCargado,
} from '../tipos';

const papel = {
  id: 'papel-ficticio',
  subfamilia: 'SUSTRATO_HOJA',
  unidadStock: 'hoja',
  atributosVarianteJson: { anchoMm: 220, altoMm: 340 },
};

function pasoImpresion(modo?: string, merma = 0): PasoCargado {
  return {
    rutaPasoId: 'ruta-ficticia',
    rutaPasoOrden: 1,
    configPasoId: 'paso-ficticio',
    familiaCodigo: 'impresion_por_hoja',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    multiplicadoresActivos: [],
    paramsPasoJson: {
      ...(modo ? { modoTalonarioIncompleto: modo } : {}),
      nestingConfig: {
        algorithm: 'grid-2d-single',
        allowRotation: true,
        separationHMm: 0,
        separationVMm: 0,
      },
    },
    slots: [{ slotCodigo: 'sustrato_principal', mermaAdicionalPct: merma }],
    perfilM1Id: 'perfil-ficticio',
    perfil: {
      id: 'perfil-ficticio',
      nombre: 'BN',
      detalleJson: { colores: ['BN'] },
    },
    maquina: {
      id: 'laser-ficticia',
      nombre: 'Láser de prueba',
      plantilla: 'IMPRESORA_LASER',
      parametrosTecnicosJson: {
        geometria: 'PLIEGO',
        margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
      },
      consumibles: [
        {
          id: 'toner-ficticio',
          perfilOperativoId: 'perfil-ficticio',
          nombre: 'Tóner negro',
          tipo: 'toner',
          unidad: 'gramo',
          activo: true,
          consumoBase: 0.45,
          consumoPorCoberturaJson: null,
          detalleJson: { color: 'negro' },
          materialVariante: {
            id: 'variante-ficticia',
            sku: 'TONER-PRUEBA',
            precioReferencia: 10,
            unidadStock: 'gramo',
          },
        },
      ],
    },
  } as unknown as PasoCargado;
}

async function cotizarConsumo(
  cantidad: number,
  modo: string,
  heredado = false,
  caras = 1,
  merma = 0,
) {
  const paso = pasoImpresion(heredado ? undefined : modo, merma);
  const job = {
    cantidad,
    numerosXTalonario: 50,
    caras,
    ...(heredado ? { talonario_modo_incompleto: modo } : {}),
    medidaCustomMm: { anchoMm: 100, altoMm: 150 },
    piezas: [{ cantidad, anchoMm: 100, altoMm: 150 }],
  } as JobContext;
  const nesting = await runNestingForPaso(paso, job, papel);
  expect(nesting?.piezasPorPliego).toBe(4);
  const errores: ErrorMotor[] = [];
  const motor = Object.create(MotorUniversalService.prototype) as {
    calcularConsumiblesMaquina: (
      p: PasoCargado,
      j: JobContext,
      n: typeof nesting,
      e: ErrorMotor[],
      m: typeof papel,
    ) => MaterialEjecutado[];
  };
  const lineas = motor.calcularConsumiblesMaquina(
    paso,
    job,
    nesting,
    errores,
    papel,
  );
  expect(errores).toEqual([]);
  expect(lineas).toHaveLength(1);
  return { nesting: nesting!, toner: lineas[0] };
}

describe.each(['pose_completa', 'aprovechar_pliego'])(
  'tóner de talonarios: %s',
  (modo) => {
    it.each([1, 3, 4, 20, 40])(
      'cuenta una sola vez las 50 hojas de %i talonarios',
      async (cantidad) => {
        const { nesting, toner } = await cotizarConsumo(cantidad, modo);
        const gramos = cantidad * 50 * 0.1 * 0.15 * 0.45;
        expect(toner.cantidad).toBeCloseTo(gramos, 8);
        expect(toner.costoTotal).toBeCloseTo(gramos * 10, 8);
        expect(nesting.cantidadCalculada).toBe(
          modo === 'pose_completa'
            ? Math.ceil(cantidad / 4) * 50
            : Math.ceil((cantidad * 50) / 4),
        );
      },
    );

    it.each([1, 20, 40])(
      'conserva el área total en una copia heredada de %i talonarios',
      async (cantidad) => {
        const { nesting, toner } = await cotizarConsumo(cantidad, modo, true);
        // Las pilas pertenecen sólo al original, pero cada copia imprime sus 50 hojas.
        expect(nesting.talonarioGrouping).toBeUndefined();
        expect(toner.cantidad).toBeCloseTo(
          cantidad * 50 * 0.1 * 0.15 * 0.45,
          8,
        );
      },
    );

    it('aplica caras y merma una sola vez sobre el área realmente impresa', async () => {
      const { toner } = await cotizarConsumo(20, modo, false, 2, 10);
      expect(toner.cantidad).toBeCloseTo(14.85, 8);
      expect(toner.mermaAdicional).toMatchObject({
        porcentaje: 10,
        cantidadTrabajo: 13.5,
        cantidadMerma: 1.35,
      });
    });
  },
);
