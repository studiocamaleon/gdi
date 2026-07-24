-- Inicio del período de facturación en curso (current_billing_period.starts_at
-- de Paddle). Sin esto sólo se conoce el FIN (proximoCobro) y no hay forma de
-- decir "faltan X de N días" sin inventar el N: asumir 30 mentiría en los
-- planes anuales. Nullable porque las filas existentes se completan solas con
-- el próximo evento de la pasarela.
ALTER TABLE "Suscripcion" ADD COLUMN "periodoDesde" TIMESTAMP(3);
