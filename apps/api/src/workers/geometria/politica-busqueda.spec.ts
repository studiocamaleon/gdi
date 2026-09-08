import {
  timeoutOpenNestMs,
  timeoutMaximoOpenNestMs,
} from './politica-busqueda';

describe('presupuesto global de OpenNest', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });
  it('prioriza calidad con dos minutos por defecto y un límite externo independiente', () => {
    delete process.env.OPENNEST_JOB_TIMEOUT_MS;
    delete process.env.OPENNEST_TIMEOUT_MAX_MS;
    expect(timeoutOpenNestMs()).toBe(120_000);
    expect(timeoutMaximoOpenNestMs()).toBe(300_000);
  });
  it('respeta la configuración explícita y rechaza presupuestos inválidos', () => {
    process.env.OPENNEST_JOB_TIMEOUT_MS = '240000';
    process.env.OPENNEST_TIMEOUT_MAX_MS = '360000';
    expect(timeoutOpenNestMs()).toBe(240_000);
    expect(timeoutMaximoOpenNestMs()).toBe(360_000);
    process.env.OPENNEST_JOB_TIMEOUT_MS = '-1';
    process.env.OPENNEST_TIMEOUT_MAX_MS = 'Infinity';
    expect(timeoutOpenNestMs()).toBe(120_000);
    expect(timeoutMaximoOpenNestMs()).toBe(300_000);
  });
});
