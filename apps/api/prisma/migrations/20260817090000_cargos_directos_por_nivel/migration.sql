ALTER TABLE "ProductoCargoDirectoPaso"
ADD COLUMN "nivelCodigo" TEXT;

DROP INDEX "ProductoCargoDirectoPaso_tenantId_productoConfigPasoId_cargoDirectoCatalogoId_key";

-- Un costo general sólo puede aparecer una vez en el paso.
CREATE UNIQUE INDEX "ProductoCargoDirectoPaso_general_key"
ON "ProductoCargoDirectoPaso"("tenantId", "productoConfigPasoId", "cargoDirectoCatalogoId")
WHERE "nivelCodigo" IS NULL;

-- El mismo costo puede configurarse de manera independiente en cada nivel.
CREATE UNIQUE INDEX "ProductoCargoDirectoPaso_nivel_key"
ON "ProductoCargoDirectoPaso"("tenantId", "productoConfigPasoId", "cargoDirectoCatalogoId", "nivelCodigo")
WHERE "nivelCodigo" IS NOT NULL;
