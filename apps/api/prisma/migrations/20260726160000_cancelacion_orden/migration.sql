-- Cancelación de órdenes de trabajo.
--
-- Hasta acá el ciclo sólo avanzaba y no había forma de cerrar una orden que se
-- cae: quedaba viva en el tablero, en la capacidad del taller y contando como
-- venta en todos los reportes. El propio sistema ya prometía la función en el
-- error de quitar el último item ("...o anulá la orden").
--
-- `cancelada` NO es una etapa más adelante en la secuencia: es una salida
-- lateral y terminal. Por eso el estado se acompaña de la etapa en la que
-- estaba al cancelarse — sin eso se pierde la diferencia entre una orden que
-- murió en borrador y una que se cortó con el taller a mitad de camino.
ALTER TABLE "OrdenTrabajo"
  ADD COLUMN "canceladaEl"             TIMESTAMP(3),
  ADD COLUMN "estadoAlCancelar"        TEXT,
  ADD COLUMN "motivoCancelacion"       TEXT,
  ADD COLUMN "canceladaPorId"          UUID,
  ADD COLUMN "canceladaPorNombre"      TEXT,
  -- Foto del avance al cancelar: es lo que permite decidir si se le cobra algo
  -- al cliente. Los pasos siguen vivos, pero su avance se sigue moviendo si
  -- alguien reabre, así que el número se congela acá.
  ADD COLUMN "pasosHechosAlCancelar"   INTEGER,
  ADD COLUMN "pasosTotalAlCancelar"    INTEGER,
  ADD COLUMN "minutosRealesAlCancelar" INTEGER;

-- Los reportes del eje comercial excluyen las canceladas, y el listado filtra
-- por estado: conviene que el índice cubra el caso.
CREATE INDEX "OrdenTrabajo_tenantId_canceladaEl_idx"
  ON "OrdenTrabajo" ("tenantId", "canceladaEl")
  WHERE "canceladaEl" IS NOT NULL;
