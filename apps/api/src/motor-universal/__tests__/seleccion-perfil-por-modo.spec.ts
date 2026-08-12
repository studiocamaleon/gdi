/**
 * Desempate del perfil POR MODO de color (hallazgo del usuario 2026-08-11):
 * con varios modos habilitados, el default global sólo cubre SU modo — el
 * modo no-default caía a candidatos[0] (orden de carga, inestable). El mapa
 * `perfilDefaultPorModo` de la candidata activa declara el desempate por
 * modo; sin mapa, la cadena previa queda idéntica (fix CMYK del 2026-08-10).
 *
 * Unit test sin DB: `resolverPerfil` sólo lee el PasoCargado y el jobContext.
 */
import { MotorUniversalService } from '../motor.service';
import type { PasoCargado } from '../tipos';

const motor = new MotorUniversalService(
  {} as never,
  {} as never,
  {} as never,
);

const perfil = (id: string, nombre: string, colores: string[]) => ({
  id,
  nombre,
  tipoPerfil: 'IMPRESION',
  activo: true,
  productivityValue: 10,
  productivityUnit: 'm2_h',
  setupMin: 0,
  cleanupMin: 0,
  feedReloadMin: null,
  detalleJson: { colores },
});

/** Paso UV mínimo: familia sin primitiva de selección (impresion_por_area),
 *  con CMYK 4-pass como default global y dos perfiles CMYK+blanco. */
const pasoBase = (extra: Partial<PasoCargado> = {}): PasoCargado =>
  ({
    configPasoId: 'cfg-1',
    rutaPasoId: 'rp-1',
    rutaPasoOrden: 1,
    familiaCodigo: 'impresion_por_area',
    paramsPasoJson: {},
    perfilM1Id: 'perfil-cmyk-4p',
    perfilesDisponibles: [
      perfil('perfil-cmyk-4p', 'CMYK 4 pass', ['CMYK']),
      perfil('perfil-blanco-a', 'CMYK+Blanco A', ['CMYK+blanco']),
      perfil('perfil-blanco-b', 'CMYK+Blanco B', ['CMYK+blanco']),
    ],
    ...extra,
  }) as unknown as PasoCargado;

const resolver = (paso: PasoCargado, jobContext: Record<string, unknown>) =>
  (
    motor as unknown as {
      resolverPerfil: (
        p: PasoCargado,
        jc: unknown,
      ) => { id: string } | null;
    }
  ).resolverPerfil(paso, jobContext);

describe('resolverPerfil — perfilDefaultPorModo (desempate por modo)', () => {
  it('sin mapa: CMYK usa el default global (null = mantener default)', () => {
    expect(resolver(pasoBase(), { modoColor: 'CMYK' })).toBeNull();
  });

  it('sin mapa: el modo no-default cae al primer candidato (comportamiento histórico)', () => {
    const elegido = resolver(pasoBase(), { modoColor: 'CMYK+blanco' });
    expect(elegido?.id).toBe('perfil-blanco-a');
  });

  it('con mapa: el modo no-default usa SU default declarado, no el primer candidato', () => {
    const paso = pasoBase({
      perfilDefaultPorModo: { 'CMYK+blanco': 'perfil-blanco-b' },
    });
    const elegido = resolver(paso, { modoColor: 'CMYK+blanco' });
    expect(elegido?.id).toBe('perfil-blanco-b');
  });

  it('con mapa: el modo del default global sigue usando el default (el mapa no lo pisa si no lo declara)', () => {
    const paso = pasoBase({
      perfilDefaultPorModo: { 'CMYK+blanco': 'perfil-blanco-b' },
    });
    expect(resolver(paso, { modoColor: 'CMYK' })).toBeNull();
  });

  it('el mapa también puede pisar el modo del default global', () => {
    const paso = pasoBase({
      perfilDefaultPorModo: { CMYK: 'perfil-cmyk-4p' },
      perfilM1Id: 'perfil-blanco-a',
    });
    const elegido = resolver(paso, { modoColor: 'CMYK' });
    expect(elegido?.id).toBe('perfil-cmyk-4p');
  });

  it('entrada inválida del mapa (perfil inexistente): se ignora y sigue la cadena', () => {
    const paso = pasoBase({
      perfilDefaultPorModo: { 'CMYK+blanco': 'perfil-borrado' },
    });
    const elegido = resolver(paso, { modoColor: 'CMYK+blanco' });
    expect(elegido?.id).toBe('perfil-blanco-a');
  });
});
