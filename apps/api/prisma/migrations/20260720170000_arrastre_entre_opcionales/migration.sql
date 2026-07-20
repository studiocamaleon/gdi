-- Arrastre entre opcionales: un paso puede requerir que otros se ejecuten.
-- Ej: colocar ojales enciende el refuerzo perimetral aunque sea OPCIONAL.
-- Es una implicación, no un modo de activación: el paso requerido sigue
-- pudiendo activarse por su cuenta.
-- Ver docs/modificaciones-fisicas-lona-diseno.md
ALTER TABLE "ProductoConfigPaso"
  ADD COLUMN "requiereRutaPasoIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
