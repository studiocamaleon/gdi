CREATE TABLE "PantallaProduccion" (
  "id" UUID NOT NULL,
  "tenantId" UUID,
  "membershipId" UUID,
  "tokenHash" TEXT NOT NULL,
  "codigoHash" TEXT,
  "venceCodigoEl" TIMESTAMP(3) NOT NULL,
  "nombre" TEXT,
  "intervaloSegundos" INTEGER NOT NULL DEFAULT 15,
  "creadaEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vinculadaEl" TIMESTAMP(3),
  "revocadaEl" TIMESTAMP(3),
  "expiraEl" TIMESTAMP(3) NOT NULL,
  "ultimaConexionEl" TIMESTAMP(3),
  CONSTRAINT "PantallaProduccion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PantallaProduccion_intervalo_check" CHECK ("intervaloSegundos" BETWEEN 10 AND 60),
  CONSTRAINT "PantallaProduccion_vinculo_check" CHECK (
    ("tenantId" IS NULL AND "membershipId" IS NULL AND "vinculadaEl" IS NULL)
    OR ("tenantId" IS NOT NULL AND "membershipId" IS NOT NULL AND "vinculadaEl" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "PantallaProduccion_tokenHash_key" ON "PantallaProduccion"("tokenHash");
CREATE UNIQUE INDEX "PantallaProduccion_codigoHash_key" ON "PantallaProduccion"("codigoHash");
CREATE INDEX "PantallaProduccion_tenantId_creadaEl_idx" ON "PantallaProduccion"("tenantId", "creadaEl");
CREATE INDEX "PantallaProduccion_expiraEl_idx" ON "PantallaProduccion"("expiraEl");
ALTER TABLE "PantallaProduccion" ADD CONSTRAINT "PantallaProduccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PantallaProduccion" ADD CONSTRAINT "PantallaProduccion_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
