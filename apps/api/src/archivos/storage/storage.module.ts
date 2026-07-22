import { Global, Logger, Module } from '@nestjs/common';

import { LocalDriver } from './local.driver';
import { R2Driver } from './r2.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver';

const VARIABLES_R2 = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

/**
 * Elige el driver por entorno: R2 si están las credenciales, disco si no.
 *
 * En producción NO hay fallback silencioso: arrancar sin R2 significaría
 * guardar los archivos de los clientes en el disco efímero del contenedor y
 * perderlos en el próximo deploy, así que preferimos que el arranque falle.
 */
@Global()
@Module({
  providers: [
    LocalDriver,
    {
      provide: STORAGE_DRIVER,
      inject: [LocalDriver],
      useFactory: (local: LocalDriver): StorageDriver => {
        const logger = new Logger('Storage');
        const faltantes = VARIABLES_R2.filter((v) => !process.env[v]);

        if (faltantes.length === 0) {
          logger.log(
            `Almacenamiento: Cloudflare R2 (${process.env.R2_BUCKET}).`,
          );
          return new R2Driver();
        }

        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            `Faltan variables de R2 en producción: ${faltantes.join(', ')}. ` +
              'Sin object storage los archivos se perderían en el próximo deploy.',
          );
        }

        logger.warn(
          `Almacenamiento: disco local (.storage/). Faltan ${faltantes.join(', ')}.`,
        );
        return local;
      },
    },
  ],
  exports: [STORAGE_DRIVER, LocalDriver],
})
export class StorageModule {}
