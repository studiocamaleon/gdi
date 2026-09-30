ALTER TABLE "User" ADD COLUMN "emailVerificado" TEXT, ADD COLUMN "emailVerificadoEl" TIMESTAMP(3);
-- No acreditar automáticamente correos históricos de procedencia desconocida.
CREATE TABLE "AccesoToken" (
 "id" UUID NOT NULL, "userId" UUID NOT NULL, "tipo" TEXT NOT NULL,
 "email" TEXT NOT NULL, "passwordStamp" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
 "venceEl" TIMESTAMP(3) NOT NULL, "usadoEl" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AccesoToken_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AccesoToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccesoToken_tokenHash_key" ON "AccesoToken"("tokenHash");
CREATE INDEX "AccesoToken_userId_idx" ON "AccesoToken"("userId");
CREATE INDEX "AccesoToken_venceEl_idx" ON "AccesoToken"("venceEl");
CREATE TABLE "AccesoCorreo" (
 "id" UUID NOT NULL, "userId" UUID, "tipo" TEXT NOT NULL, "sobre" JSONB,
 "estado" TEXT NOT NULL DEFAULT 'pendiente', "intentos" INTEGER NOT NULL DEFAULT 0,
 "proximoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lease" UUID, "leaseHasta" TIMESTAMP(3), "venceEl" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AccesoCorreo_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AccesoCorreo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AccesoCorreo_estado_proximoEl_idx" ON "AccesoCorreo"("estado", "proximoEl");
CREATE INDEX "AccesoCorreo_venceEl_idx" ON "AccesoCorreo"("venceEl");
CREATE TABLE "AccesoLimite" (
 "clave" TEXT NOT NULL, "cantidad" INTEGER NOT NULL, "venceEl" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AccesoLimite_pkey" PRIMARY KEY ("clave")
);
CREATE INDEX "AccesoLimite_venceEl_idx" ON "AccesoLimite"("venceEl");
