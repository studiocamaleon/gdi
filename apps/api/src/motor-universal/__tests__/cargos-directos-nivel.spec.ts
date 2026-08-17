import { MotorUniversalService } from '../motor.service';

type AplicarCargosPaso = (
  cargos: Array<Record<string, unknown>>,
  jobContext: Record<string, unknown>,
  subtotalPaso: number,
  nivelCodigo: string | null,
) => Array<{ cargoCodigo: string; monto: number; aplicaMargen: boolean }>;

function cargo(
  id: string,
  nivelCodigo: string | null,
  monto: number,
  aplicaMargen = true,
  aplicaMargenOverride: boolean | null = null,
) {
  return {
    id,
    cargoDirectoCatalogoId: id,
    nivelCodigo,
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    configOverrideJson: null,
    aplicaMargenOverride,
    catalogo: {
      codigo: id,
      nombre: id,
      modoCalculo: 'MONTO_FIJO_PLANO',
      configJson: { monto },
      aplicaMargen,
    },
  };
}

describe('MotorUniversalService — cargos directos por nivel', () => {
  it('aplica el cargo general y sólo el cargo del nivel elegido', () => {
    const motor = Object.create(
      MotorUniversalService.prototype,
    ) as MotorUniversalService;
    const aplicar = (
      motor as unknown as { aplicarCargosPaso: AplicarCargosPaso }
    ).aplicarCargosPaso.bind(motor);

    const resultado = aplicar(
      [
        cargo('general', null, 100),
        cargo('basico', 'basico', 200),
        cargo('profesional', 'profesional', 300),
      ],
      {},
      1_000,
      'profesional',
    );

    expect(resultado.map((item) => item.cargoCodigo)).toEqual([
      'general',
      'profesional',
    ]);
    expect(resultado.reduce((total, item) => total + item.monto, 0)).toBe(400);
  });

  it('no aplica cargos de nivel cuando se usa tiempo personalizado', () => {
    const motor = Object.create(
      MotorUniversalService.prototype,
    ) as MotorUniversalService;
    const aplicar = (
      motor as unknown as { aplicarCargosPaso: AplicarCargosPaso }
    ).aplicarCargosPaso.bind(motor);

    const resultado = aplicar(
      [cargo('general', null, 100), cargo('basico', 'basico', 200)],
      {},
      1_000,
      null,
    );

    expect(resultado.map((item) => item.cargoCodigo)).toEqual(['general']);
  });

  it('hereda la política de margen y permite sobrescribirla por nivel', () => {
    const motor = Object.create(
      MotorUniversalService.prototype,
    ) as MotorUniversalService;
    const aplicar = (
      motor as unknown as { aplicarCargosPaso: AplicarCargosPaso }
    ).aplicarCargosPaso.bind(motor);

    const resultado = aplicar(
      [
        cargo('heredado-sin-margen', 'complejo', 90, false),
        cargo('override-con-margen', 'complejo', 50, false, true),
      ],
      {},
      1_000,
      'complejo',
    );

    expect(resultado.map((item) => item.aplicaMargen)).toEqual([false, true]);
  });
});
