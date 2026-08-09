-- CreateTable
CREATE TABLE "CredencialMcp" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "pista" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiraEl" TIMESTAMP(3),
    "revocadoEl" TIMESTAMP(3),
    "ultimoUsoEl" TIMESTAMP(3),
    "creadaPorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredencialMcp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CredencialMcp_tokenHash_key" ON "CredencialMcp"("tokenHash");

-- CreateIndex
CREATE INDEX "CredencialMcp_tenantId_idx" ON "CredencialMcp"("tenantId");

-- AddForeignKey
ALTER TABLE "CredencialMcp" ADD CONSTRAINT "CredencialMcp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredencialMcp" ADD CONSTRAINT "CredencialMcp_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
