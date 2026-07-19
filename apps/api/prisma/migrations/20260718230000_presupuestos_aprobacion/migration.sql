-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "aprobacionMotivosJson" JSONB,
ADD COLUMN     "aprobacionResueltaEl" TIMESTAMP(3),
ADD COLUMN     "aprobacionResueltaPorId" UUID,
ADD COLUMN     "aprobacionResueltaPorNombre" TEXT,
ADD COLUMN     "aprobacionSolicitadaEl" TIMESTAMP(3);
