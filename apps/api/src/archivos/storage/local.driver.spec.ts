import { LocalDriver } from './local.driver';
import { randomUUID } from 'node:crypto';
it('lee sólo el rango pedido, también al superar EOF, sin cargar todo por leer()', async () => {
  const driver = new LocalDriver();
  const key = `test-rango-${randomUUID()}.bin`;
  const completo = jest.spyOn(driver, 'leer');
  try {
    await driver.escribir(key, Buffer.from('contenido ficticio'));
    expect(await driver.leerCabecera(key, 4)).toEqual(Buffer.from('cont'));
    expect(await driver.leerCabecera(key, 100)).toEqual(
      Buffer.from('contenido ficticio'),
    );
    expect(completo).not.toHaveBeenCalled();
  } finally {
    await driver.borrar(key);
    completo.mockRestore();
  }
});
