-- CreateEnum
CREATE TYPE "TipoDireccion" AS ENUM ('PRINCIPAL', 'FACTURACION', 'ENTREGA');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" UUID NOT NULL,
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
CREATE TABLE "ClienteContacto" (
    "id" UUID NOT NULL,
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

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "Cliente"("nombre");

-- CreateIndex
CREATE INDEX "ClienteContacto_clienteId_idx" ON "ClienteContacto"("clienteId");

-- CreateIndex
CREATE INDEX "ClienteDireccion_clienteId_idx" ON "ClienteDireccion"("clienteId");

-- AddForeignKey
ALTER TABLE "ClienteContacto" ADD CONSTRAINT "ClienteContacto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteDireccion" ADD CONSTRAINT "ClienteDireccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
