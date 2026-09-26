-- Pausa temporal de coexistencia, distinta de revocar el acceso.
ALTER TYPE "EstadoVinculoMeta" ADD VALUE 'SUSPENDIDO';
ALTER TABLE "MetaVinculo" ADD COLUMN "ultimoEventoCuenta" TEXT;
