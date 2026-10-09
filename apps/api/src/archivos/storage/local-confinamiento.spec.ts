import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDriver } from './local.driver';

describe('Las claves locales sólo identifican objetos dentro del storage', () => {
  let carpeta: string;
  let driver: LocalDriver;
  const original = Buffer.from('archivo ficticio fuera del storage');

  beforeAll(async () => {
    carpeta = await realpath(await mkdtemp(join(tmpdir(), 'grafo-storage-')));
    await mkdir(join(carpeta, '.storage'));
    await mkdir(join(carpeta, '.storage-vecino'));
    await writeFile(join(carpeta, 'externo.txt'), original);
    await writeFile(join(carpeta, '.storage-vecino', 'externo.txt'), original);
    const cwd = jest.spyOn(process, 'cwd').mockReturnValue(carpeta);
    try {
      driver = new LocalDriver();
    } finally {
      cwd.mockRestore();
    }
  });

  afterAll(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });

  it.each([
    '../externo.txt',
    'empresa/../../externo.txt',
    '../.storage-vecino/externo.txt',
  ])(
    'rechaza lectura, escritura y borrado fuera de la raíz: %s',
    async (key) => {
      expect(await driver.leer(key)).toBeNull();
      await expect(driver.abrirLectura(key)).rejects.toThrow('fuera de rango');
      expect(await driver.leerCabecera(key, 8)).toBeNull();
      expect(await driver.cabecera(key)).toBeNull();
      await expect(driver.escribir(key, Buffer.from('cambio'))).rejects.toThrow(
        'fuera de rango',
      );
      await expect(
        driver.escribir(key, Buffer.from('cambio'), { soloCrear: true }),
      ).rejects.toThrow('fuera de rango');
      await expect(driver.borrar(key)).rejects.toThrow('fuera de rango');
      expect(await readFile(join(carpeta, 'externo.txt'))).toEqual(original);
      expect(
        await readFile(join(carpeta, '.storage-vecino', 'externo.txt')),
      ).toEqual(original);
    },
  );

  it.each(['', '.', 'empresa/..'])(
    'no trata la propia carpeta de storage como un objeto: %s',
    async (key) => {
      expect(await driver.cabecera(key)).toBeNull();
      await expect(driver.borrar(key)).rejects.toThrow('fuera de rango');
      await expect(driver.escribir(key, Buffer.from('cambio'))).rejects.toThrow(
        'fuera de rango',
      );
    },
  );

  it('rechaza rutas absolutas, sin reinterpretarlas como nombres relativos', async () => {
    const key = join(carpeta, 'externo.txt');
    await expect(driver.escribir(key, Buffer.from('cambio'))).rejects.toThrow(
      'fuera de rango',
    );
    expect(await readFile(key)).toEqual(original);
  });

  it('conserva lectura parcial, escritura y borrado de un objeto válido anidado', async () => {
    const key = 'empresa/documentos/archivo.pdf';
    const contenido = Buffer.from('%PDF-ficticio');
    await driver.escribir(key, contenido, { soloCrear: true });
    expect(await driver.cabecera(key)).toEqual({
      bytes: contenido.length,
      contentType: null,
    });
    expect(await driver.leer(key)).toEqual(contenido);
    const stream = await driver.abrirLectura(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(contenido);
    expect(await driver.leerCabecera(key, 4)).toEqual(Buffer.from('%PDF'));
    await expect(
      driver.escribir(key, Buffer.from('reemplazo'), { soloCrear: true }),
    ).rejects.toThrow('ya fue subido');
    await driver.borrar(key);
    expect(await driver.leer(key)).toBeNull();
  });
});
