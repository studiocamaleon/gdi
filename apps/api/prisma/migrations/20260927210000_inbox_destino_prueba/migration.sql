-- El identificador de WhatsApp y el destino registrado en la lista de prueba
-- pueden diferir. No transformar identidades ni cambiar envíos existentes.
ALTER TABLE "MetaVinculo" ADD COLUMN "pruebaDestinoE164" TEXT;
UPDATE "MetaVinculo" SET "pruebaDestinoE164" = '+' || "pruebaDestinatarioWaId"
WHERE "tipo" = 'PRUEBA';
ALTER TABLE "MetaVinculo" ADD CONSTRAINT "MetaVinculo_destino_prueba_check" CHECK (
  ("tipo" = 'COEXISTENCIA' AND "pruebaDestinoE164" IS NULL)
  OR ("tipo" = 'PRUEBA' AND "pruebaDestinoE164" IS NOT NULL
      AND "pruebaDestinoE164" ~ '^\+[1-9][0-9]{7,14}$')
);
