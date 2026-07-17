-- AlterTable
ALTER TABLE "OrdenTrabajo" ADD COLUMN     "publicToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OrdenTrabajo_publicToken_key" ON "OrdenTrabajo"("publicToken");

