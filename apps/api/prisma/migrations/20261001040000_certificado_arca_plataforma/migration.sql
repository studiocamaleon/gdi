CREATE TABLE "CredencialFiscalPlataforma" (
  "ambiente" TEXT NOT NULL PRIMARY KEY CHECK ("ambiente" IN ('dev', 'prod')),
  "cuit" TEXT NOT NULL,
  "huella" TEXT NOT NULL,
  "validoDesde" TIMESTAMP(3) NOT NULL,
  "validoHasta" TIMESTAMP(3) NOT NULL,
  "revision" UUID NOT NULL,
  "materialCifrado" JSONB NOT NULL,
  "actualizadoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
