-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoDireccion" AS ENUM ('PRINCIPAL', 'FACTURACION', 'ENTREGA');

-- CreateEnum
CREATE TYPE "SexoEmpleado" AS ENUM ('MASCULINO', 'FEMENINO', 'NO_BINARIO', 'PREFIERO_NO_DECIR');

-- CreateEnum
CREATE TYPE "RolSistema" AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoComision" AS ENUM ('PORCENTAJE', 'FIJO');

-- CreateEnum
CREATE TYPE "TipoCentroCosto" AS ENUM ('PRODUCTIVO', 'APOYO', 'ADMINISTRATIVO', 'COMERCIAL', 'LOGISTICO', 'TERCERIZADO');

-- CreateEnum
CREATE TYPE "CategoriaGraficaCentroCosto" AS ENUM ('PREPRENSA', 'IMPRESION', 'TERMINACION', 'EMPAQUE', 'LOGISTICA', 'CALIDAD', 'MANTENIMIENTO', 'ADMINISTRACION', 'COMERCIAL', 'TERCERIZADO');

-- CreateEnum
CREATE TYPE "ImputacionPreferidaCentroCosto" AS ENUM ('DIRECTA', 'INDIRECTA', 'REPARTO');

-- CreateEnum
CREATE TYPE "UnidadBaseCentroCosto" AS ENUM ('NINGUNA', 'HORA_MAQUINA', 'HORA_HOMBRE', 'PLIEGO', 'UNIDAD', 'M2', 'KG');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "nombreCompleto" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rol" "RolSistema" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "currentTenantId" UUID NOT NULL,
    "currentMembershipId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "empleadoId" UUID,
    "invitedByMembershipId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "RolSistema" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "razonSocial" TEXT,
    "emailPrincipal" TEXT NOT NULL,
    "telefonoCodigo" TEXT NOT NULL,
    "telefonoNumero" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "razonSocial" TEXT,
    "emailPrincipal" TEXT NOT NULL,
    "telefonoCodigo" TEXT NOT NULL,
    "telefonoNumero" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "nombreCompleto" TEXT NOT NULL,
    "emailPrincipal" TEXT NOT NULL,
    "telefonoCodigo" TEXT NOT NULL,
    "telefonoNumero" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "ocupacion" TEXT,
    "sexo" "SexoEmpleado",
    "fechaIngreso" DATE NOT NULL,
    "fechaNacimiento" DATE,
    "comisionesHabilitadas" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteContacto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefonoCodigo" TEXT,
    "telefonoNumero" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteContacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteDireccion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
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

    CONSTRAINT "ClienteDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProveedorContacto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proveedorId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefonoCodigo" TEXT,
    "telefonoNumero" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProveedorContacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProveedorDireccion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proveedorId" UUID NOT NULL,
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

    CONSTRAINT "ProveedorDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpleadoDireccion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
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
    "tenantId" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoComision" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpleadoComision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planta" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaCosto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "plantaId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaCosto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCosto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "plantaId" UUID NOT NULL,
    "areaCostoId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoCentro" "TipoCentroCosto" NOT NULL,
    "categoriaGrafica" "CategoriaGraficaCentroCosto" NOT NULL,
    "imputacionPreferida" "ImputacionPreferidaCentroCosto" NOT NULL,
    "unidadBaseFutura" "UnidadBaseCentroCosto" NOT NULL DEFAULT 'NINGUNA',
    "responsableEmpleadoId" UUID,
    "proveedorDefaultId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCosto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_currentTenantId_idx" ON "AuthSession"("currentTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_tenantId_email_idx" ON "Invitation"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Invitation_empleadoId_idx" ON "Invitation"("empleadoId");

-- CreateIndex
CREATE INDEX "Cliente_tenantId_nombre_idx" ON "Cliente"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tenantId_nombre_key" ON "Cliente"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "Proveedor_tenantId_nombre_idx" ON "Proveedor"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_tenantId_nombre_key" ON "Proveedor"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "Empleado_tenantId_nombreCompleto_idx" ON "Empleado"("tenantId", "nombreCompleto");

-- CreateIndex
CREATE INDEX "Empleado_tenantId_sector_idx" ON "Empleado"("tenantId", "sector");

-- CreateIndex
CREATE INDEX "ClienteContacto_tenantId_clienteId_idx" ON "ClienteContacto"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "ClienteDireccion_tenantId_clienteId_idx" ON "ClienteDireccion"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "ProveedorContacto_tenantId_proveedorId_idx" ON "ProveedorContacto"("tenantId", "proveedorId");

-- CreateIndex
CREATE INDEX "ProveedorDireccion_tenantId_proveedorId_idx" ON "ProveedorDireccion"("tenantId", "proveedorId");

-- CreateIndex
CREATE INDEX "EmpleadoDireccion_tenantId_empleadoId_idx" ON "EmpleadoDireccion"("tenantId", "empleadoId");

-- CreateIndex
CREATE INDEX "EmpleadoComision_tenantId_empleadoId_idx" ON "EmpleadoComision"("tenantId", "empleadoId");

-- CreateIndex
CREATE INDEX "Planta_tenantId_nombre_idx" ON "Planta"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Planta_tenantId_codigo_key" ON "Planta"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "AreaCosto_tenantId_plantaId_nombre_idx" ON "AreaCosto"("tenantId", "plantaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "AreaCosto_tenantId_plantaId_codigo_key" ON "AreaCosto"("tenantId", "plantaId", "codigo");

-- CreateIndex
CREATE INDEX "CentroCosto_tenantId_plantaId_areaCostoId_idx" ON "CentroCosto"("tenantId", "plantaId", "areaCostoId");

-- CreateIndex
CREATE INDEX "CentroCosto_tenantId_nombre_idx" ON "CentroCosto"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCosto_tenantId_codigo_key" ON "CentroCosto"("tenantId", "codigo");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_currentTenantId_fkey" FOREIGN KEY ("currentTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_currentMembershipId_fkey" FOREIGN KEY ("currentMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByMembershipId_fkey" FOREIGN KEY ("invitedByMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteContacto" ADD CONSTRAINT "ClienteContacto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteContacto" ADD CONSTRAINT "ClienteContacto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteDireccion" ADD CONSTRAINT "ClienteDireccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteDireccion" ADD CONSTRAINT "ClienteDireccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorContacto" ADD CONSTRAINT "ProveedorContacto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorContacto" ADD CONSTRAINT "ProveedorContacto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorDireccion" ADD CONSTRAINT "ProveedorDireccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorDireccion" ADD CONSTRAINT "ProveedorDireccion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoDireccion" ADD CONSTRAINT "EmpleadoDireccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoDireccion" ADD CONSTRAINT "EmpleadoDireccion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoComision" ADD CONSTRAINT "EmpleadoComision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoComision" ADD CONSTRAINT "EmpleadoComision_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planta" ADD CONSTRAINT "Planta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaCosto" ADD CONSTRAINT "AreaCosto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaCosto" ADD CONSTRAINT "AreaCosto_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "Planta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCosto" ADD CONSTRAINT "CentroCosto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCosto" ADD CONSTRAINT "CentroCosto_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "Planta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCosto" ADD CONSTRAINT "CentroCosto_areaCostoId_fkey" FOREIGN KEY ("areaCostoId") REFERENCES "AreaCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCosto" ADD CONSTRAINT "CentroCosto_responsableEmpleadoId_fkey" FOREIGN KEY ("responsableEmpleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCosto" ADD CONSTRAINT "CentroCosto_proveedorDefaultId_fkey" FOREIGN KEY ("proveedorDefaultId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

