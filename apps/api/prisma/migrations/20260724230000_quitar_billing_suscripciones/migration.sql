-- Se retira el billing de suscripciones del control plane.
-- Con Paddle como Merchant of Record, el comprobante al tenant lo emite Paddle;
-- Grupo Idea le factura a PADDLE (Factura E), y eso se hace a mano fuera del
-- sistema por decisión del negocio. La tabla nunca tuvo datos.
-- Ver docs/suscripciones-cobro-diseno.md
DROP TABLE IF EXISTS "FacturaSuscripcion";
