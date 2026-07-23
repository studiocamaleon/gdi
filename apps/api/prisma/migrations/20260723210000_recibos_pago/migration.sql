-- Recibos de pago: el documento del cobro. Ver docs/recibos-pago-diseno.md

-- AlterTable
ALTER TABLE "Cobro" ADD COLUMN "numeroRecibo" TEXT;
ALTER TABLE "Cobro" ADD COLUMN "referencia" VARCHAR(60);
ALTER TABLE "Cobro" ADD COLUMN "registradoPorNombre" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Cobro_numeroRecibo_key" ON "Cobro"("numeroRecibo");

-- CreateTable
CREATE TABLE "ReciboContador" (
    "tenantId" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReciboContador_pkey" PRIMARY KEY ("tenantId","anio")
);

-- AddForeignKey
ALTER TABLE "ReciboContador" ADD CONSTRAINT "ReciboContador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
