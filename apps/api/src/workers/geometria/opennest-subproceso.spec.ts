import { ejecutarSubprocesoJson } from './opennest.service';

const run = (
  script: string,
  options: Partial<Parameters<typeof ejecutarSubprocesoJson>[0]> = {},
) =>
  ejecutarSubprocesoJson({
    ejecutable: process.execPath,
    argumentos: ['-e', script],
    entrada: {},
    timeoutMs: 2000,
    ...options,
  });

describe('candidatos incrementales del selector', () => {
  it('recibe cada JSON completo aunque UTF-8 y líneas estén divididos entre chunks', async () => {
    const recibidos: unknown[] = [];
    const resultado = await run(
      `
      const b = Buffer.from('ruido\\nGRAFO_OPENNEST_RESULT:{"nombre":"cañón","placas":8}\\n');
      const i = b.indexOf(Buffer.from('ñ')) + 1;
      process.stdout.write(b.subarray(0,i));
      setTimeout(() => {
        process.stdout.write(b.subarray(i));
        process.stdout.write('GRAFO_OPENNEST_RESULT:{"placas":7}\\n');
      }, 30);
    `,
      { onCandidate: (c) => recibidos.push(c) },
    );
    expect(recibidos).toEqual([{ nombre: 'cañón', placas: 8 }, { placas: 7 }]);
    expect(resultado).toEqual({ placas: 7 });
  });

  it('conserva el candidato recibido aunque el siguiente objetivo termine por timeout', async () => {
    const recibidos: unknown[] = [];
    await expect(
      run(
        `
      process.stdout.write('GRAFO_OPENNEST_RESULT:{"placas":67}\\n');
      setInterval(() => {}, 100);
    `,
        { timeoutMs: 500, onCandidate: (c) => recibidos.push(c) },
      ),
    ).rejects.toMatchObject({ codigo: 'TIMEOUT' });
    expect(recibidos).toEqual([{ placas: 67 }]);
  });

  it('no publica JSON incompleto o malformado', async () => {
    const recibidos: unknown[] = [];
    await expect(
      run(`process.stdout.write('GRAFO_OPENNEST_RESULT:{"placas":');`, {
        onCandidate: (c) => recibidos.push(c),
      }),
    ).rejects.toMatchObject({ codigo: 'INVALID_OUTPUT' });
    expect(recibidos).toEqual([]);
  });

  it('sigue rechazando cancelaciones y salidas excesivas aunque antes haya recibido un candidato', async () => {
    const controller = new AbortController();
    await expect(
      run(
        `process.stdout.write('GRAFO_OPENNEST_RESULT:{"placas":2}\\n'); setInterval(() => {}, 100);`,
        { signal: controller.signal, onCandidate: () => controller.abort() },
      ),
    ).rejects.toMatchObject({ codigo: 'CANCELLED' });
    await expect(
      run(`process.stdout.write('x'.repeat(1000));`, { maxSalidaBytes: 100 }),
    ).rejects.toMatchObject({ codigo: 'OUTPUT_LIMIT' });
  });
});
