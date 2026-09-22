CREATE TABLE "PlanPaddleRecurso" (
  "id" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "entorno" TEXT NOT NULL,
  "clave" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'pendiente',
  "referencia" TEXT,
  "creadoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEl" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanPaddleRecurso_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlanPaddleRecurso_versionId_entorno_clave_key" ON "PlanPaddleRecurso"("versionId", "entorno", "clave");
ALTER TABLE "Suscripcion" ADD COLUMN "implementacionResueltaEl" TIMESTAMP(3), ADD COLUMN "implementacionImporte" DECIMAL(14,2);
-- Los contratos anteriores a esta política no reciben un cargo retroactivo.
UPDATE "Suscripcion" SET "implementacionResueltaEl" = CURRENT_TIMESTAMP, "implementacionImporte" = 0 WHERE "referenciaExterna" IS NOT NULL;
-- Retiro del catálogo; se conservan referencias y antecedentes.
UPDATE "Plan" SET "activo" = false, "publico" = false, "registroPublico" = false, "recomendado" = false WHERE "codigo" IN ('taller','estudio','diamante');
-- Mantener las selecciones del usuario. Sólo agregar las condiciones comerciales.
UPDATE "PlanBorrador" SET "contenido" = "contenido" || jsonb_build_object('comercial', jsonb_build_object('acceso','publico','trialDias',14,'implementacion',CASE "codigo" WHEN 'esencial' THEN 199 WHEN 'pro' THEN 499 ELSE 1200 END)), "revision" = "revision" + 1, "actualizadoEl" = CURRENT_TIMESTAMP WHERE "codigo" IN ('esencial','pro','avanzado');
INSERT INTO "PlanBorrador" ("id","codigo","orden","revision","catalogoVersion","contenido","actualizadoEl")
SELECT gen_random_uuid(), 'cofounder-' || "codigo", "orden" + 10, 1, "catalogoVersion", "contenido" || jsonb_build_object('nombre',CASE "codigo" WHEN 'pro' THEN 'Co-founder Pro' ELSE 'Co-founder Avanzado' END,'comercial', jsonb_build_object('acceso','invitacion','trialDias',30,'implementacion',0)), CURRENT_TIMESTAMP
FROM "PlanBorrador" WHERE "codigo" IN ('pro','avanzado') ON CONFLICT ("codigo") DO NOTHING;
