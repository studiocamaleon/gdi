ALTER TABLE "Invitation"
  ADD COLUMN "correoEstado" TEXT,
  ADD COLUMN "correoIntentoEl" TIMESTAMP(3),
  ADD COLUMN "correoEnviadoEl" TIMESTAMP(3),
  ADD COLUMN "correoProveedorId" TEXT;
