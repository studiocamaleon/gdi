ALTER TABLE "CargoDirectoCatalogo"
ADD COLUMN "aplicaMargen" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ProductoCargoDirectoPaso"
ADD COLUMN "aplicaMargenOverride" BOOLEAN;

ALTER TABLE "ProductoCargoDirectoCotizacion"
ADD COLUMN "aplicaMargenOverride" BOOLEAN;
