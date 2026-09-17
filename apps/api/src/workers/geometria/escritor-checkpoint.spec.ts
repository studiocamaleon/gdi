import { EscritorCheckpoint } from './escritor-checkpoint';

describe('escritura acotada de checkpoints', () => {
  it('conserva el último avance sin acumular cientos de escrituras ni solaparlas', async () => {
    let terminar: () => void = () => undefined;
    const guardados: number[] = [];
    const escritura = new Promise<void>((resolve) => {
      terminar = resolve;
    });
    const error = jest.fn();
    const escritor = new EscritorCheckpoint<number>(async (n) => {
      guardados.push(n);
      if (n === 1) await escritura;
    }, error);
    escritor.programar(1);
    await Promise.resolve();
    for (let n = 2; n <= 1000; n++) escritor.programar(n);
    expect(guardados).toEqual([1]);
    let vacio = false;
    const vaciar = escritor.vaciar().then(() => {
      vacio = true;
    });
    await Promise.resolve();
    expect(vacio).toBe(false);
    terminar();
    await vaciar;
    expect(guardados).toEqual([1, 1000]);
    expect(error).not.toHaveBeenCalled();
    escritor.programar(1001);
    await escritor.vaciar();
    expect(guardados).toEqual([1, 1000, 1001]);
  });

  it('informa un fallo de persistencia y permite guardar el siguiente candidato', async () => {
    const fallo = new Error('Base temporalmente no disponible');
    const informar = jest.fn();
    const guardar = jest.fn(async (n: number) => {
      if (n === 1) throw fallo;
    });
    const escritor = new EscritorCheckpoint(guardar, informar);
    escritor.programar(1);
    await escritor.vaciar();
    expect(informar).toHaveBeenCalledWith(fallo);
    escritor.programar(2);
    await escritor.vaciar();
    expect(guardar).toHaveBeenLastCalledWith(2);
  });
});
