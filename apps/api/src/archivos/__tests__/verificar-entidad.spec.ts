import { NotFoundException } from '@nestjs/common';
import { ArchivoScope } from '@prisma/client';

import { ArchivosService } from '../archivos.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StorageDriver } from '../storage/storage.driver';
import type { SuscripcionesService } from '../../suscripciones/suscripciones.service';

/**
 * A qué entidad se puede adjuntar un archivo.
 *
 * Este test nace de un bug real: `EGRESO` se agregó al enum y a
 * `CAMPO_POR_SCOPE` —un Record exhaustivo, así que el compilador lo exigió—
 * pero el `switch` que busca la entidad tenía un `default: return null` que se
 * lo tragó en silencio. Adjuntar la factura de un egreso devolvió 404 "No
 * encontré la entidad" desde el primer día, y no lo vio nadie hasta que
 * alguien intentó subir una factura de verdad.
 *
 * El `never` del switch ya impide que se repita en compilación; esto lo fija
 * en runtime y, sobre todo, deja escrito POR QUÉ está.
 */

/** Cada scope con el modelo de Prisma donde tiene que ir a buscar. */
const SCOPE_A_MODELO: Array<[ArchivoScope, string]> = [
  [ArchivoScope.CAMPANA, 'proyectoCampana'],
  [ArchivoScope.CLIENTE, 'cliente'],
  [ArchivoScope.ORDEN, 'ordenTrabajo'],
  [ArchivoScope.ORDEN_ITEM, 'ordenTrabajoItem'],
  [ArchivoScope.COTIZACION, 'cotizacion'],
  [ArchivoScope.COMPROBANTE, 'comprobante'],
  [ArchivoScope.COBRO, 'cobro'],
  [ArchivoScope.PRODUCTO, 'producto'],
  [ArchivoScope.PROVEEDOR, 'proveedor'],
  [ArchivoScope.EGRESO, 'egreso'],
];

/** `encontrado` = si el modelo devuelve la fila o null. */
function armar(encontrado: boolean) {
  const buscados: string[] = [];
  const modelo = (nombre: string) => ({
    findFirst: jest.fn(() => {
      buscados.push(nombre);
      return Promise.resolve(encontrado ? { id: 'e1' } : null);
    }),
  });
  const prisma = Object.fromEntries(
    SCOPE_A_MODELO.map(([, nombre]) => [nombre, modelo(nombre)]),
  ) as unknown as PrismaService;

  const service = new ArchivosService(
    prisma,
    {} as unknown as StorageDriver,
    {} as unknown as SuscripcionesService,
  );
  // `verificarEntidad` es privado a propósito: es una comprobación interna del
  // alta, no una operación que alguien deba poder llamar de afuera.
  const verificar = (scope: ArchivoScope, id: string | null) =>
    (
      service as unknown as {
        verificarEntidad: (s: ArchivoScope, i: string | null) => Promise<void>;
      }
    ).verificarEntidad(scope, id);

  return { verificar, buscados };
}

describe('a qué entidad se adjunta', () => {
  it.each(SCOPE_A_MODELO)(
    'el scope %s busca en el modelo que le corresponde',
    async (scope, modelo) => {
      const { verificar, buscados } = armar(true);
      await expect(verificar(scope, 'e1')).resolves.toBeUndefined();
      expect(buscados).toEqual([modelo]);
    },
  );

  /** El que faltaba, escrito aparte para que se lea el caso. */
  it('EGRESO encuentra su egreso (el bug que motivó esto)', async () => {
    const { verificar, buscados } = armar(true);
    await expect(verificar(ArchivoScope.EGRESO, 'egr1')).resolves.toBeUndefined();
    expect(buscados).toEqual(['egreso']);
  });

  it.each(SCOPE_A_MODELO)(
    'el scope %s da 404 si la entidad no existe',
    async (scope) => {
      const { verificar } = armar(false);
      await expect(verificar(scope, 'no-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    },
  );

  /** El logo del tenant no cuelga de ninguna fila: sale antes de buscar. */
  it('TENANT_BRANDING no busca ninguna entidad', async () => {
    const { verificar, buscados } = armar(false);
    await expect(
      verificar(ArchivoScope.TENANT_BRANDING, null),
    ).resolves.toBeUndefined();
    expect(buscados).toEqual([]);
  });

  it('sin id no se adjunta a nada', async () => {
    const { verificar } = armar(true);
    await expect(verificar(ArchivoScope.EGRESO, null)).rejects.toThrow(
      /Falta la entidad/i,
    );
  });
});
