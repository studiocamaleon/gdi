-- Remove product detail tabs/costing scaffolding to restart from a clean base
DROP TABLE IF EXISTS "CostoSnapshotItem" CASCADE;
DROP TABLE IF EXISTS "ProductoTercerizadoVersion" CASCADE;
DROP TABLE IF EXISTS "ProductoMaterialVersion" CASCADE;
DROP TABLE IF EXISTS "ProductoRutaPasoVersion" CASCADE;
DROP TABLE IF EXISTS "ProductoVersion" CASCADE;
DROP TABLE IF EXISTS "ReglaConversionFormatoTenant" CASCADE;

DROP TYPE IF EXISTS "EstadoProductoVersion";
DROP TYPE IF EXISTS "PoliticaCostoMaterial";
