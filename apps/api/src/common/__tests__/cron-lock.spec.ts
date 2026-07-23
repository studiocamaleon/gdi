import { conLockDeCron } from '../cron-lock';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Lo único que este lease tiene que garantizar es que dos instancias no corran
 * el mismo job a la vez. Todo lo demás —el TTL, el registro de cuándo corrió—
 * es comodidad.
 *
 * Se simula Postgres con una tabla en memoria que respeta la misma regla que
 * el `ON CONFLICT ... WHERE expiraEl < now()`: la fila se toma sólo si no
 * existe o si venció.
 */
function prismaFalso() {
  const tabla = new Map<string, { expiraEl: number; instancia: string }>();
  const llamadas = { tomar: 0, liberar: 0 };

  const prisma = {
    $queryRawUnsafe(
      _sql: string,
      nombre: string,
      ttlSegundos: number,
      instancia: string,
    ) {
      llamadas.tomar += 1;
      const actual = tabla.get(nombre);
      if (actual && actual.expiraEl > Date.now()) return Promise.resolve([]);
      tabla.set(nombre, {
        expiraEl: Date.now() + ttlSegundos * 1000,
        instancia,
      });
      return Promise.resolve([{ nombre }]);
    },
    $executeRawUnsafe(_sql: string, nombre: string, instancia: string) {
      llamadas.liberar += 1;
      const actual = tabla.get(nombre);
      // Igual que el SQL: sólo libera quien lo tiene.
      if (actual?.instancia === instancia) {
        tabla.set(nombre, { ...actual, expiraEl: Date.now() });
      }
      return Promise.resolve(1);
    },
  } as unknown as PrismaService;

  return { prisma, tabla, llamadas };
}

describe('conLockDeCron', () => {
  it('corre el job y devuelve lo que devolvió', async () => {
    const { prisma } = prismaFalso();
    await expect(
      conLockDeCron(prisma, 'job', 60, () => Promise.resolve('listo')),
    ).resolves.toBe('listo');
  });

  /**
   * El caso que justifica todo esto: con dos instancias del API, el mismo
   * cron se dispara dos veces. Si las dos corren, el barrido de acreditaciones
   * acredita dos veces y el alta de plantillas quema el doble del cupo de Meta.
   */
  it('la segunda instancia no corre mientras la primera tiene el lease', async () => {
    const { prisma } = prismaFalso();
    const corridas: string[] = [];
    let soltar: (() => void) | undefined;
    const bloqueado = new Promise<void>((r) => {
      soltar = r;
    });

    const primera = conLockDeCron(prisma, 'job', 60, async () => {
      corridas.push('A');
      await bloqueado;
    });
    const segunda = await conLockDeCron(prisma, 'job', 60, () => {
      corridas.push('B');
      return Promise.resolve();
    });

    expect(segunda).toBeNull();
    expect(corridas).toEqual(['A']);
    soltar!();
    await primera;
  });

  it('libera al terminar, así la corrida siguiente entra', async () => {
    const { prisma } = prismaFalso();
    await conLockDeCron(prisma, 'job', 60, () => Promise.resolve());
    const segunda = await conLockDeCron(prisma, 'job', 60, () =>
      Promise.resolve('ok'),
    );
    expect(segunda).toBe('ok');
  });

  /**
   * Si un job que lanza dejara el lease tomado, el cron quedaría muerto hasta
   * que venciera el TTL — y con TTL de media hora eso es media hora sin
   * correr, sin ningún indicio de por qué.
   */
  it('libera aunque el job explote', async () => {
    const { prisma } = prismaFalso();
    await expect(
      conLockDeCron(prisma, 'job', 60, () =>
        Promise.reject(new Error('falló el job')),
      ),
    ).rejects.toThrow('falló el job');

    await expect(
      conLockDeCron(prisma, 'job', 60, () => Promise.resolve('despues')),
    ).resolves.toBe('despues');
  });

  it('un lease vencido lo puede tomar otro', async () => {
    const { prisma, tabla } = prismaFalso();
    await conLockDeCron(prisma, 'job', 60, () => Promise.resolve());
    tabla.set('job', { expiraEl: Date.now() - 1, instancia: 'otra-instancia' });

    await expect(
      conLockDeCron(prisma, 'job', 60, () => Promise.resolve('retomado')),
    ).resolves.toBe('retomado');
  });

  /**
   * Sin base no hay nada que hacer, pero un error del lock no puede leerse
   * como "el job corrió". Se saltea la corrida y ya.
   */
  it('si no puede tomar el lease no corre el job', async () => {
    const prisma = {
      $queryRawUnsafe: () => Promise.reject(new Error('sin conexión')),
      $executeRawUnsafe: () => Promise.resolve(0),
    } as unknown as PrismaService;

    const fn = jest.fn();
    await expect(conLockDeCron(prisma, 'job', 60, fn)).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
