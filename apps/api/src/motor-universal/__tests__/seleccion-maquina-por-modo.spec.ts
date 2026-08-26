/**
 * La máquina candidata y el modo de color son una sola decisión comercial:
 * si B/N pertenece a una máquina y CMYK a otra, el motor no debe caer en la
 * candidata preferida cuando el navegador omite o conserva un id viejo.
 */
import { MotorUniversalService } from '../motor.service';
import type { PasoCargado } from '../tipos';

const motor = new MotorUniversalService(
  {} as never,
  {} as never,
  {} as never,
);

const perfil = (id: string, colores: string[]) => ({
  id,
  nombre: id,
  tipoPerfil: 'IMPRESION',
  activo: true,
  productivityValue: 60,
  productivityUnit: 'PPM',
  setupMin: 0,
  cleanupMin: 0,
  feedReloadMin: null,
  detalleJson: { colores, caras: 'SIMPLE_FAZ' },
});

const candidata = (
  maquinaId: string,
  modo: 'BN' | 'CMYK',
  esPreferida: boolean,
) => ({
  id: `cand-${maquinaId}`,
  maquinaId,
  perfilDefaultId: `perfil-${maquinaId}`,
  perfilDefaultPorModo: null,
  modoColorAllowedModes: [modo],
  esPreferida,
  orden: esPreferida ? 0 : 1,
  maquina: {
    id: maquinaId,
    codigo: maquinaId,
    nombre: maquinaId,
    plantilla: 'IMPRESORA_LASER',
  },
  perfilesOperativos: [perfil(`perfil-${maquinaId}`, [modo])],
});

const paso = {
  configPasoId: 'cfg-impresion',
  rutaPasoId: 'rp-impresion',
  rutaPasoOrden: 1,
  familiaCodigo: 'impresion_por_hoja',
  maquinaM1Id: 'c8003',
  perfilM1Id: 'perfil-c8003',
  paramsPasoJson: {},
  perfilesDisponibles: [perfil('perfil-c8003', ['CMYK'])],
  maquinasCandidatas: [
    candidata('c8003', 'CMYK', true),
    candidata('9003', 'BN', false),
  ],
} as unknown as PasoCargado;

const resolver = (jobContext: Record<string, unknown>) =>
  (
    motor as unknown as {
      resolverMaquinaM2: (
        paso: PasoCargado,
        jobContext: Record<string, unknown>,
      ) => PasoCargado;
    }
  ).resolverMaquinaM2(paso, jobContext);

describe('resolverMaquinaM2 — candidata por modo de color', () => {
  it('B/N elige la 9003 aunque la C8003 sea la preferida', () => {
    expect(resolver({ modoColor: 'BN' }).maquinaM1Id).toBe('9003');
  });

  it('corrige una selección explícita vieja incompatible con B/N', () => {
    expect(
      resolver({
        modoColor: 'BN',
        maquinaSeleccionada_cfg_impresion: 'c8003',
      }).maquinaM1Id,
    ).toBe('9003');
  });

  it('CMYK conserva la C8003', () => {
    expect(resolver({ modoColor: 'CMYK' }).maquinaM1Id).toBe('c8003');
  });

  it('sin modo conserva el comportamiento preferido histórico', () => {
    expect(resolver({}).maquinaM1Id).toBe('c8003');
  });
});
