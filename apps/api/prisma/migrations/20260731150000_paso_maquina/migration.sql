-- Fase A del rediseño de estaciones: el paso materializado recuerda su MÁQUINA.
--
-- Hoy el paso sólo guarda el centro de costo (proxy de costeo). Para rutear a
-- estaciones por máquina/tecnología (la señal real del piso de taller) el paso
-- necesita saber con qué máquina se hizo. El motor ya la elige al cotizar; acá
-- se persiste. Ver docs/estaciones-reglas-diseno.md.
--
-- Nullable, sin backfill: pasos sin máquina y órdenes viejas quedan NULL —
-- exactamente "sin máquina conocida". Cero cambio de comportamiento actual.

ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "maquinaId" UUID;

CREATE INDEX "OrdenTrabajoItemPaso_tenantId_maquinaId_idx"
  ON "OrdenTrabajoItemPaso" ("tenantId", "maquinaId");
