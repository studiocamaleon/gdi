CREATE TABLE "MfaDispositivo" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "tokenHash" TEXT NOT NULL,
  "alcance" TEXT NOT NULL, "passwordStamp" TEXT NOT NULL, "mfaVersion" INTEGER NOT NULL,
  "verificadoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "venceEl" TIMESTAMP(3) NOT NULL, "ultimoUsoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revocadoEl" TIMESTAMP(3),
  CONSTRAINT "MfaDispositivo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MfaDispositivo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MfaDispositivo_alcance" CHECK ("alcance" IN ('tenant', 'plataforma'))
);
CREATE UNIQUE INDEX "MfaDispositivo_tokenHash_key" ON "MfaDispositivo"("tokenHash");
CREATE INDEX "MfaDispositivo_userId_venceEl_idx" ON "MfaDispositivo"("userId", "venceEl");
CREATE INDEX "MfaDispositivo_venceEl_idx" ON "MfaDispositivo"("venceEl");
ALTER TABLE "AuthSession" ADD COLUMN "mfaDispositivoId" UUID;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_mfaDispositivoId_fkey" FOREIGN KEY ("mfaDispositivoId") REFERENCES "MfaDispositivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
