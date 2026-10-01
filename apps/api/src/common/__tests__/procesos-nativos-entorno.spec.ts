import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ejecutarSubprocesoJson } from '../../workers/geometria/opennest.service';
import { ejecutarDxfNativo } from '../../productos-servicios/geometrias/dxf-nativo';
import { prepararMedioInbox } from '../../integraciones/meta/inbox/meta-medios-formato';
import { entornoProcesoNativo } from '../entorno-proceso-nativo';

/** Procesos reales, datos ficticios. No imprime valores de credenciales. */
describe('Procesadores nativos no reciben credenciales del coordinador', () => {
  const claves = ['GRAFO_PRUEBA_SECRETO', 'META_APP_SECRET', 'JWT_SECRET'];
  const cambiadas = [...claves, 'DXF_PYTHON', 'INBOX_FFPROBE_PATH'];
  const anteriores = new Map(cambiadas.map((k) => [k, process.env[k]]));
  let carpeta: string;
  const detectar = `const claves = ${JSON.stringify(claves)};
    const presentes = claves.filter(k => process.env[k] !== undefined);`;

  beforeAll(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'grafo-entorno-nativo-'));
    for (const clave of claves) process.env[clave] = 'valor-ficticio-del-test';
  });
  afterAll(async () => {
    for (const [clave, valor] of anteriores) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
    if (carpeta) await rm(carpeta, { recursive: true, force: true });
  });

  it('permite configuración operativa y descarta claves nuevas por defecto', () => {
    expect(
      entornoProcesoNativo({
        PATH: '/bin',
        TMPDIR: '/tmp',
        GRAFONEST_SELECTOR_THREADS: '2',
        DATABASE_URL: 'ficticio',
        REDIS_URL: 'ficticio',
        NUEVO_PROVEEDOR_TOKEN: 'ficticio',
        NODE_OPTIONS: '--require=ficticio',
        PYTHONPATH: '/ficticio',
      }),
    ).toEqual({
      PATH: '/bin',
      TMPDIR: '/tmp',
      GRAFONEST_SELECTOR_THREADS: '2',
    });
  });

  it('el runner geométrico conserva su protocolo sin recibir secretos', async () => {
    const resultado = await ejecutarSubprocesoJson({
      ejecutable: process.execPath,
      argumentos: [
        '-e',
        `${detectar}
        process.stdin.resume();
        process.stdin.on('end', () => console.log('GRAFO_OPENNEST_RESULT:' + JSON.stringify({
          presentes, guardia: process.env.GRAFONEST_GUARD_FD,
          sinBuffer: process.env.PYTHONUNBUFFERED,
        })));`,
      ],
      entrada: { datos: 'ficticios' },
      timeoutMs: 3000,
    });
    expect(resultado).toEqual({
      presentes: [],
      guardia: process.platform === 'win32' ? undefined : '3',
      sinBuffer: '1',
    });
  });

  it('la conversión CAD no entrega secretos al intérprete', async () => {
    const programa = join(carpeta, 'cad-ficticio');
    await writeFile(
      programa,
      `#!${process.execPath}\n${detectar}
      process.stdin.resume();
      process.stdin.on('end', () => console.log(JSON.stringify({ presentes })));`,
      { mode: 0o700 },
    );
    process.env.DXF_PYTHON = programa;
    await expect(ejecutarDxfNativo({ accion: 'ficticia' })).resolves.toEqual({
      presentes: [],
    });
  });

  it('la sonda multimedia funciona sin recibir secretos', async () => {
    const programa = join(carpeta, 'sonda-ficticia');
    await writeFile(
      programa,
      `#!${process.execPath}\n${detectar}
      if (presentes.length) process.exit(9);
      console.log(JSON.stringify({streams:[{codec_type:'audio',codec_name:'mp3'}],format:{duration:'1'}}));`,
      { mode: 0o700 },
    );
    process.env.INBOX_FFPROBE_PATH = programa;
    const bytes = Buffer.from('ID3contenido-ficticio');
    await expect(prepararMedioInbox(bytes, 'audio/mpeg')).resolves.toEqual({
      bytes,
      mime: 'audio/mpeg',
    });
  });
});
