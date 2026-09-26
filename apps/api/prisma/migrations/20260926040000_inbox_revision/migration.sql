CREATE TABLE "InboxCanalRevision" (
  "tenantId" UUID NOT NULL,
  "wabaId" TEXT NOT NULL,
  "phoneNumberId" TEXT NOT NULL,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InboxCanalRevision_pkey" PRIMARY KEY ("tenantId", "wabaId", "phoneNumberId"),
  CONSTRAINT "InboxCanalRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
