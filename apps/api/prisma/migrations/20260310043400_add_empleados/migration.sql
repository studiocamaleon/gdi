-- CreateEnum
CREATE TYPE "SexoEmpleado" AS ENUM ('MASCULINO', 'FEMENINO', 'NO_BINARIO', 'PREFIERO_NO_DECIR');

-- CreateEnum
CREATE TYPE "RolSistema" AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoComision" AS ENUM ('PORCENTAJE', 'FIJO');

-- CreateTable
CREATE TABLE "Empleado" (
    "id" UUID NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "emailPrincipal" TEXT NOT NULL,
    "telefonoCodigo" TEXT NOT NULL,
    "telefonoNumero" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "ocupacion" TEXT,
    "sexo" "SexoEmpleado",
    "fechaIngreso" DATE NOT NULL,
    "fechaNacimiento" DATE,
    "usuarioSistema" BOOLEAN NOT NULL DEFAULT false,
    "emailAcceso" TEXT,
    "rolSistema" "RolSistema",
    "comisionesHabilitadas" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpleadoDireccion" (
    "id" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "codigoPostal" TEXT,
    "direccion" TEXT NOT NULL,
    "numero" TEXT,
    "ciudad" TEXT NOT NULL,
    "tipo" "TipoDireccion" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpleadoDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpleadoComision" (
    "id" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoComision" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpleadoComision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Empleado_nombreCompleto_idx" ON "Empleado"("nombreCompleto");

-- CreateIndex
CREATE INDEX "Empleado_sector_idx" ON "Empleado"("sector");

-- CreateIndex
CREATE INDEX "EmpleadoDireccion_empleadoId_idx" ON "EmpleadoDireccion"("empleadoId");

-- CreateIndex
CREATE INDEX "EmpleadoComision_empleadoId_idx" ON "EmpleadoComision"("empleadoId");

-- AddForeignKey
ALTER TABLE "EmpleadoDireccion" ADD CONSTRAINT "EmpleadoDireccion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoComision" ADD CONSTRAINT "EmpleadoComision_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
