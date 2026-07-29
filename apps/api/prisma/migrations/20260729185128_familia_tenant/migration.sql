-- CreateTable
CREATE TABLE "FamiliaTenant" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT NOT NULL,
    "relacionMaquina" JSONB NOT NULL,
    "modosTiempo" JSONB NOT NULL,
    "mecanismosCantidad" JSONB NOT NULL,
    "modosActivacion" JSONB NOT NULL,
    "modoActivacionDefault" TEXT NOT NULL,
    "slots" JSONB NOT NULL,
    "multiplicadores" JSONB NOT NULL,
    "plantillasCompatibles" JSONB NOT NULL,
    "tiposPerfilCompatibles" JSONB,
    "inputsRequeridos" JSONB NOT NULL,
    "outputsCanonicos" JSONB NOT NULL,
    "validaciones" JSONB NOT NULL,
    "permiteSlotsAdicionales" BOOLEAN NOT NULL DEFAULT false,
    "modoRegistro" TEXT,
    "presetOrigen" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamiliaTenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamiliaTenant_tenantId_activo_idx" ON "FamiliaTenant"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "FamiliaTenant_tenantId_nombre_key" ON "FamiliaTenant"("tenantId", "nombre");

-- AddForeignKey
ALTER TABLE "FamiliaTenant" ADD CONSTRAINT "FamiliaTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
