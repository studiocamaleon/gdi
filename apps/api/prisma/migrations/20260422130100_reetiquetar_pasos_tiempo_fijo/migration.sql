-- Re-etiquetar pasos y plantillas existentes a TIEMPO_FIJO.
-- Patrón: "Fija (tiempo total)" guardó modoProductividad = FIJA + tiempoFijoMin > 0
-- + productividadBase IS NULL (porque la biblioteca limpiaba productividadBase
-- cuando se elegía "Fija"). El motor lo cotizaba mal. Este UPDATE arregla
-- retroactivamente esos registros para que el nuevo motor los respete.

UPDATE "ProcesoOperacionPlantilla"
SET "modoProductividad" = 'TIEMPO_FIJO'
WHERE "modoProductividad" = 'FIJA'
  AND "tiempoFijoMin" IS NOT NULL
  AND "tiempoFijoMin" > 0
  AND "productividadBase" IS NULL;

UPDATE "ProcesoOperacion"
SET "modoProductividad" = 'TIEMPO_FIJO'
WHERE "modoProductividad" = 'FIJA'
  AND "tiempoFijoMin" IS NOT NULL
  AND "tiempoFijoMin" > 0
  AND "productividadBase" IS NULL;
