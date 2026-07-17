-- AlterTable
ALTER TABLE "Estacion" ADD COLUMN     "capacidadConcurrente" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "horario" TEXT,
ADD COLUMN     "icono" TEXT;

-- AlterTable
ALTER TABLE "Maquina" ADD COLUMN     "estacionId" UUID;

-- CreateTable
CREATE TABLE "EstacionFamilia" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "estacionId" UUID NOT NULL,
    "familiaCodigo" TEXT NOT NULL,

    CONSTRAINT "EstacionFamilia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstacionEmpleado" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "estacionId" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,

    CONSTRAINT "EstacionEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstacionFamilia_tenantId_estacionId_idx" ON "EstacionFamilia"("tenantId", "estacionId");

-- CreateIndex
CREATE UNIQUE INDEX "EstacionFamilia_tenantId_familiaCodigo_key" ON "EstacionFamilia"("tenantId", "familiaCodigo");

-- CreateIndex
CREATE INDEX "EstacionEmpleado_tenantId_empleadoId_idx" ON "EstacionEmpleado"("tenantId", "empleadoId");

-- CreateIndex
CREATE UNIQUE INDEX "EstacionEmpleado_estacionId_empleadoId_key" ON "EstacionEmpleado"("estacionId", "empleadoId");

-- CreateIndex
CREATE INDEX "Maquina_tenantId_estacionId_idx" ON "Maquina"("tenantId", "estacionId");

-- AddForeignKey
ALTER TABLE "Maquina" ADD CONSTRAINT "Maquina_estacionId_fkey" FOREIGN KEY ("estacionId") REFERENCES "Estacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstacionFamilia" ADD CONSTRAINT "EstacionFamilia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstacionFamilia" ADD CONSTRAINT "EstacionFamilia_estacionId_fkey" FOREIGN KEY ("estacionId") REFERENCES "Estacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstacionEmpleado" ADD CONSTRAINT "EstacionEmpleado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstacionEmpleado" ADD CONSTRAINT "EstacionEmpleado_estacionId_fkey" FOREIGN KEY ("estacionId") REFERENCES "Estacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstacionEmpleado" ADD CONSTRAINT "EstacionEmpleado_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
