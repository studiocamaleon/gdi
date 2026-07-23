-- El consentimiento pasa de booleano a tres estados.
--
--   null  = nunca se preguntó  → recibe transaccionales, no marketing
--   true  = aceptó             → recibe todo
--   false = pidió no recibir   → no recibe nada
--
-- Arrancar todo en false dejaba el módulo mudo hasta juntar consentimientos
-- uno por uno. Las filas actuales están en false por el default anterior y
-- nadie eligió eso, así que vuelven a null: nunca se les preguntó.
ALTER TABLE "Cliente" ALTER COLUMN "aceptaWhatsapp" DROP NOT NULL;
ALTER TABLE "Cliente" ALTER COLUMN "aceptaWhatsapp" DROP DEFAULT;
UPDATE "Cliente" SET "aceptaWhatsapp" = NULL WHERE "aceptaWhatsapp" = false;
