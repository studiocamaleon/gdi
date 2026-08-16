ALTER TABLE "Empleado"
  ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "fechaBaja" DATE,
  ADD COLUMN "motivoBaja" VARCHAR(300);

CREATE INDEX "Empleado_tenantId_activo_idx"
  ON "Empleado"("tenantId", "activo");

CREATE TABLE "EmpleadoEvento" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "empleadoId" UUID NOT NULL,
  "tipo" VARCHAR(40) NOT NULL,
  "actorId" UUID,
  "actorNombre" TEXT,
  "detalle" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmpleadoEvento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmpleadoEvento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EmpleadoEvento_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EmpleadoEvento_tenantId_empleadoId_createdAt_idx"
  ON "EmpleadoEvento"("tenantId", "empleadoId", "createdAt");

INSERT INTO "EmpleadoEvento" (
  "tenantId", "empleadoId", "tipo", "actorNombre", "detalle", "createdAt"
)
SELECT "tenantId", "id", 'creado', 'Migración', '{"origen":"backfill"}'::jsonb, "createdAt"
FROM "Empleado";

UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['registros.gestionar_empleados']::TEXT[]
WHERE "codigo" = 'administrador'
  AND "esDelSistema" = true
  AND NOT ('registros.gestionar_empleados' = ANY("permisos"));

UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['registros.ver_comisiones']::TEXT[]
WHERE "codigo" = 'administrador'
  AND "esDelSistema" = true
  AND NOT ('registros.ver_comisiones' = ANY("permisos"));
