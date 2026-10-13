ALTER TABLE "OrdenTrabajoItem"
  ADD COLUMN "listoEnMostrador" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "listoEnMostradorEl" TIMESTAMP(3),
  ADD COLUMN "listoEnMostradorPorNombre" TEXT;
