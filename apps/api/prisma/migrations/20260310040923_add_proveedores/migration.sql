-- CreateTable
CREATE TABLE "Proveedor" (
    "id" UUID NOT NULL,
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
CREATE TABLE "ProveedorContacto" (
    "id" UUID NOT NULL,
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

-- CreateIndex
CREATE INDEX "Proveedor_nombre_idx" ON "Proveedor"("nombre");

-- CreateIndex
CREATE INDEX "ProveedorContacto_proveedorId_idx" ON "ProveedorContacto"("proveedorId");

-- CreateIndex
CREATE INDEX "ProveedorDireccion_proveedorId_idx" ON "ProveedorDireccion"("proveedorId");

-- AddForeignKey
ALTER TABLE "ProveedorContacto" ADD CONSTRAINT "ProveedorContacto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorDireccion" ADD CONSTRAINT "ProveedorDireccion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
