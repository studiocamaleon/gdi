-- AlterTable
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN     "estadoCompra" TEXT,
ADD COLUMN     "plazoProveedorDias" INTEGER,
ADD COLUMN     "proveedorId" UUID,
ADD COLUMN     "proveedorNombre" TEXT,
ADD COLUMN     "tipoEjecucion" TEXT NOT NULL DEFAULT 'interno';

