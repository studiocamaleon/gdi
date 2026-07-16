-- AlterTable
ALTER TABLE "OrdenTrabajoEvento" ADD COLUMN     "datosJson" JSONB,
ADD COLUMN     "origen" TEXT NOT NULL DEFAULT 'usuario',
ADD COLUMN     "usuarioId" UUID;

-- AddForeignKey
ALTER TABLE "OrdenTrabajoEvento" ADD CONSTRAINT "OrdenTrabajoEvento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
