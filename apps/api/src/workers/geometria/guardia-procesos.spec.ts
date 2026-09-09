import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ejecutarSubprocesoJson } from './opennest.service';

const esperar = async (condicion: () => boolean) => {
  const limite = Date.now() + 4000;
  while (!condicion()) {
    if (Date.now() > limite)
      throw new Error('El proceso no alcanzó el estado esperado.');
    await new Promise((r) => setTimeout(r, 20));
  }
};
const detenido = (pid: number) => {
  try {
    return execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], {
      encoding: 'utf8',
    })
      .trim()
      .startsWith('Z');
  } catch {
    return true;
  }
};

describe('guardia de procesos reales', () => {
  let dir: string;
  const guardian = join(__dirname, 'python');
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'grafonest-guard-'));
  });
  afterEach(() => {
    const file = join(dir, 'runner.pid');
    if (existsSync(file)) {
      try {
        process.kill(-Number(readFileSync(file, 'utf8')), 'SIGKILL');
      } catch {
        /* grupo terminado */
      }
    }
    rmSync(dir, { recursive: true, force: true });
  });
  const script = (folder: string, finalizar: boolean) => `
import os, sys, time, subprocess
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(guardian)})
from process_guard import start_guard
start_guard()
Path(${JSON.stringify(join(folder, 'runner.pid'))}).write_text(str(os.getpid()))
child = subprocess.Popen([sys.executable, '-c', 'import signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(30)'], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
Path(${JSON.stringify(join(folder, 'native.pid'))}).write_text(str(child.pid))
time.sleep(0.1)
print('GRAFO_OPENNEST_RESULT:{"completo":true}', flush=True)
${finalizar ? '' : 'time.sleep(30)'}
`;

  it.each([true, false])(
    'limpia descendientes que ignoran TERM al finalizar normalmente=%s',
    async (finalizar) => {
      const run = ejecutarSubprocesoJson({
        ejecutable: 'python3',
        argumentos: ['-c', script(dir, finalizar)],
        entrada: {},
        timeoutMs: 800,
      });
      if (finalizar) await expect(run).resolves.toEqual({ completo: true });
      else await expect(run).rejects.toMatchObject({ codigo: 'TIMEOUT' });
      await esperar(() =>
        detenido(Number(readFileSync(join(dir, 'native.pid'), 'utf8'))),
      );
    },
  );

  it('EOF termina Python y su nativo aunque Node reciba SIGKILL', async () => {
    const coordinator = spawn(
      process.execPath,
      [
        '-e',
        `
      const {spawn}=require('node:child_process');
      const child=spawn('python3',['-c',${JSON.stringify(script(dir, false))}],{
        detached:true,env:{...process.env,GRAFONEST_GUARD_FD:'3'},stdio:['ignore','ignore','ignore','pipe']});
      child.once('exit',()=>child.stdio[3].destroy());
    `,
      ],
      { stdio: 'ignore' },
    );
    try {
      await esperar(() => existsSync(join(dir, 'native.pid')));
      coordinator.kill('SIGKILL');
      await esperar(() =>
        detenido(Number(readFileSync(join(dir, 'runner.pid'), 'utf8'))),
      );
      await esperar(() =>
        detenido(Number(readFileSync(join(dir, 'native.pid'), 'utf8'))),
      );
    } finally {
      if (coordinator.exitCode === null) coordinator.kill('SIGKILL');
    }
  });
});
