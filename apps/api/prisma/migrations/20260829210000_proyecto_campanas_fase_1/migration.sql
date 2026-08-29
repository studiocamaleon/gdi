-- Fase 1 Visual Ilusión: Proyecto / Campaña como capa opcional.
-- Migración expand-only: no modifica ni backfillea documentos existentes.

ALTER TYPE "ArchivoScope" ADD VALUE 'CAMPANA';

CREATE TABLE "ProyectoCampana" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" VARCHAR(180) NOT NULL,
    "descripcion" VARCHAR(2000),
    "tipo" VARCHAR(80),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'borrador',
    "prioridad" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "fechaInicio" DATE,
    "fechaObjetivo" DATE,
    "fechaCompletada" DATE,
    "responsableEmpleadoId" UUID,
    "observaciones" VARCHAR(3000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProyectoCampana_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProyectoCampana_estado_check"
      CHECK ("estado" IN ('borrador', 'activo', 'pausado', 'completado', 'cancelado')),
    CONSTRAINT "ProyectoCampana_prioridad_check"
      CHECK ("prioridad" IN ('baja', 'normal', 'alta', 'critica')),
    CONSTRAINT "ProyectoCampana_fechas_check"
      CHECK ("fechaInicio" IS NULL OR "fechaObjetivo" IS NULL OR "fechaInicio" <= "fechaObjetivo")
);

CREATE TABLE "ProyectoCampanaMiembro" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proyectoCampanaId" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "funcion" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProyectoCampanaMiembro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProyectoCampanaHito" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proyectoCampanaId" UUID NOT NULL,
    "titulo" VARCHAR(180) NOT NULL,
    "descripcion" VARCHAR(1000),
    "responsableEmpleadoId" UUID,
    "fechaObjetivo" DATE,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "notas" VARCHAR(1500),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "completadoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProyectoCampanaHito_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProyectoCampanaHito_estado_check"
      CHECK ("estado" IN ('pendiente', 'en_curso', 'completado', 'cancelado')),
    CONSTRAINT "ProyectoCampanaHito_orden_check" CHECK ("orden" >= 0)
);

CREATE TABLE "ProyectoCampanaEvento" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proyectoCampanaId" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "actorUserId" UUID,
    "actorNombre" VARCHAR(200) NOT NULL,
    "datosJson" JSONB,
    "origen" VARCHAR(20) NOT NULL DEFAULT 'usuario',
    CONSTRAINT "ProyectoCampanaEvento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProyectoCampanaContador" (
    "tenantId" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProyectoCampanaContador_pkey" PRIMARY KEY ("tenantId", "anio")
);

ALTER TABLE "Archivo" ADD COLUMN "proyectoCampanaId" UUID;
ALTER TABLE "Cotizacion" ADD COLUMN "proyectoCampanaId" UUID;
ALTER TABLE "OrdenTrabajo" ADD COLUMN "proyectoCampanaId" UUID;

CREATE UNIQUE INDEX "ProyectoCampana_tenantId_codigo_key"
  ON "ProyectoCampana"("tenantId", "codigo");
CREATE INDEX "ProyectoCampana_tenantId_estado_fechaObjetivo_idx"
  ON "ProyectoCampana"("tenantId", "estado", "fechaObjetivo");
CREATE INDEX "ProyectoCampana_tenantId_clienteId_estado_idx"
  ON "ProyectoCampana"("tenantId", "clienteId", "estado");
CREATE INDEX "ProyectoCampana_tenantId_responsableEmpleadoId_estado_idx"
  ON "ProyectoCampana"("tenantId", "responsableEmpleadoId", "estado");
CREATE INDEX "ProyectoCampana_tenantId_createdAt_idx"
  ON "ProyectoCampana"("tenantId", "createdAt");

CREATE UNIQUE INDEX "ProyectoCampanaMiembro_proyectoCampanaId_empleadoId_key"
  ON "ProyectoCampanaMiembro"("proyectoCampanaId", "empleadoId");
CREATE INDEX "ProyectoCampanaMiembro_tenantId_empleadoId_idx"
  ON "ProyectoCampanaMiembro"("tenantId", "empleadoId");

CREATE INDEX "ProyectoCampanaHito_tenantId_proyectoCampanaId_orden_idx"
  ON "ProyectoCampanaHito"("tenantId", "proyectoCampanaId", "orden");
CREATE INDEX "ProyectoCampanaHito_tenantId_responsableEmpleadoId_estado_idx"
  ON "ProyectoCampanaHito"("tenantId", "responsableEmpleadoId", "estado");
CREATE INDEX "ProyectoCampanaHito_tenantId_fechaObjetivo_estado_idx"
  ON "ProyectoCampanaHito"("tenantId", "fechaObjetivo", "estado");

CREATE INDEX "ProyectoCampanaEvento_tenantId_proyectoCampanaId_fecha_idx"
  ON "ProyectoCampanaEvento"("tenantId", "proyectoCampanaId", "fecha");
CREATE INDEX "ProyectoCampanaEvento_tenantId_fecha_idx"
  ON "ProyectoCampanaEvento"("tenantId", "fecha");

CREATE INDEX "Archivo_tenantId_proyectoCampanaId_idx"
  ON "Archivo"("tenantId", "proyectoCampanaId");
CREATE INDEX "Cotizacion_tenantId_proyectoCampanaId_idx"
  ON "Cotizacion"("tenantId", "proyectoCampanaId");
CREATE INDEX "OrdenTrabajo_tenantId_proyectoCampanaId_idx"
  ON "OrdenTrabajo"("tenantId", "proyectoCampanaId");

ALTER TABLE "ProyectoCampana"
  ADD CONSTRAINT "ProyectoCampana_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProyectoCampana_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProyectoCampana_responsableEmpleadoId_fkey"
  FOREIGN KEY ("responsableEmpleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProyectoCampanaMiembro"
  ADD CONSTRAINT "ProyectoCampanaMiembro_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProyectoCampanaMiembro_proyectoCampanaId_fkey"
  FOREIGN KEY ("proyectoCampanaId") REFERENCES "ProyectoCampana"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProyectoCampanaMiembro_empleadoId_fkey"
  FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProyectoCampanaHito"
  ADD CONSTRAINT "ProyectoCampanaHito_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProyectoCampanaHito_proyectoCampanaId_fkey"
  FOREIGN KEY ("proyectoCampanaId") REFERENCES "ProyectoCampana"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProyectoCampanaHito_responsableEmpleadoId_fkey"
  FOREIGN KEY ("responsableEmpleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProyectoCampanaEvento"
  ADD CONSTRAINT "ProyectoCampanaEvento_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProyectoCampanaEvento_proyectoCampanaId_fkey"
  FOREIGN KEY ("proyectoCampanaId") REFERENCES "ProyectoCampana"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProyectoCampanaEvento_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProyectoCampanaContador"
  ADD CONSTRAINT "ProyectoCampanaContador_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Cotizacion"
  ADD CONSTRAINT "Cotizacion_proyectoCampanaId_fkey"
  FOREIGN KEY ("proyectoCampanaId") REFERENCES "ProyectoCampana"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrdenTrabajo"
  ADD CONSTRAINT "OrdenTrabajo_proyectoCampanaId_fkey"
  FOREIGN KEY ("proyectoCampanaId") REFERENCES "ProyectoCampana"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Archivo"
  ADD CONSTRAINT "Archivo_proyectoCampanaId_fkey"
  FOREIGN KEY ("proyectoCampanaId") REFERENCES "ProyectoCampana"("id") ON DELETE CASCADE ON UPDATE CASCADE;
