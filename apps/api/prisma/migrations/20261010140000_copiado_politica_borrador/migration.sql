-- CreateTable
CREATE TABLE "CentroCopiadoPoliticaBorrador" (
    "tenantId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "contenido" JSONB NOT NULL,
    "actualizadoPorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCopiadoPoliticaBorrador_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "CentroCopiadoPoliticaBorrador" ADD CONSTRAINT "CentroCopiadoPoliticaBorrador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CentroCopiadoPoliticaBorrador" ADD CONSTRAINT "copiado_politica_revision_positiva" CHECK ("revision" > 0);
