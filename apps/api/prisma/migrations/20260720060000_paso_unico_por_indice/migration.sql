-- Doble materialización de pasos de OT: el backfill perezoso consultaba
-- "items sin pasos" FUERA de la transacción y recién después insertaba, así
-- que emitir una OT mientras el front abría el detalle podía duplicar la ruta
-- entera (caso real: OT-2026-0025, 10 pasos donde iban 5).

-- 1) Limpiar los duplicados que ya existen. Se conserva la fila con avance
--    real (estado distinto de pendiente, o con tramos registrados) y, entre
--    iguales, la más antigua. Las copias descartadas no arrastran nada: los
--    tramos cuelgan del paso con ON DELETE CASCADE.
DELETE FROM "OrdenTrabajoItemPaso" p
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "itemId", "indice"
      ORDER BY
        (SELECT COUNT(*) FROM "OrdenTrabajoPasoTramo" t WHERE t."pasoId" = "OrdenTrabajoItemPaso".id) DESC,
        ("estado" <> 'pendiente') DESC,
        "createdAt" ASC,
        id ASC
    ) AS orden
  FROM "OrdenTrabajoItemPaso"
) dup
WHERE p.id = dup.id AND dup.orden > 1;

-- 2) Garantía dura: una sola fila por posición de la ruta del item.
CREATE UNIQUE INDEX "OrdenTrabajoItemPaso_itemId_indice_key"
  ON "OrdenTrabajoItemPaso"("itemId", "indice");
