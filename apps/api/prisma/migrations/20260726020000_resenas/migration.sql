-- Pedido de reseña: ancla temporal + cuántos días esperar.
-- Ver docs/datos-de-empresa-diseno.md (fase C).
ALTER TABLE "OrdenTrabajo" ADD COLUMN "fechaEntregada" TIMESTAMP(3);

ALTER TABLE "ConfiguracionNotificaciones"
  ADD COLUMN "resenaDiasDespues" INTEGER NOT NULL DEFAULT 3;

-- Las órdenes ya entregadas quedan SIN fecha a propósito: si se backfilleara,
-- encender la función mandaría un WhatsApp por cada orden del historial.
-- El pedido de reseña arranca con las entregas de acá en adelante.
