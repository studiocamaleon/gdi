-- Modelo universal (A.4) — entidad ReglaDeSeleccion.
-- Tabla + enum de dominio. Sin consumidores aún; se llenará en Etapas B/C.

-- CreateEnum
CREATE TYPE "DominioReglaSeleccion" AS ENUM ('MATERIAL', 'CENTRO_COSTO', 'VARIANTE_PASO', 'ACTIVACION', 'PARAMETRO');

-- CreateTable
CREATE TABLE "ReglaDeSeleccion" (
  "id"              UUID                      NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"        UUID                      NOT NULL,
  "nombre"          TEXT                      NOT NULL,
  "descripcion"     TEXT,
  "dominio"         "DominioReglaSeleccion"   NOT NULL,
  "targetRef"       TEXT,
  "inputs"          JSONB                     NOT NULL,
  "casos"           JSONB                     NOT NULL,
  "defaultDecision" JSONB,
  "activa"          BOOLEAN                   NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3)              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)              NOT NULL,
  CONSTRAINT "ReglaDeSeleccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReglaDeSeleccion_tenantId_dominio_activa_idx" ON "ReglaDeSeleccion" ("tenantId", "dominio", "activa");
CREATE INDEX "ReglaDeSeleccion_tenantId_targetRef_idx" ON "ReglaDeSeleccion" ("tenantId", "targetRef");

-- AddForeignKey
ALTER TABLE "ReglaDeSeleccion" ADD CONSTRAINT "ReglaDeSeleccion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
