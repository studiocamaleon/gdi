-- "El PDF del presupuesto X" es UNO, no una colección. Sin esta restricción,
-- dos pedidos simultáneos del PDF de un presupuesto que todavía no lo tenía
-- generaban dos veces y dejaban las dos filas vigentes: cada uno leía "no hay
-- anterior" antes de que el otro insertara. El resultado no se corrompe (se
-- sirve la más nueva) pero quedan objetos y cuota colgados para siempre.
--
-- Se resuelve en la base y no en el código porque es un invariante, no una
-- carrera que se pueda cerrar con cuidado: el service atrapa el P2002 y
-- devuelve la fila que ganó.
--
-- La entidad se identifica con COALESCE sobre las FK: el CHECK
-- Archivo_scope_fk_coherente ya garantiza que hay exactamente una seteada.
-- Ver docs/archivos-r2-diseno.md §5 (F3).

-- Colapsa duplicados previos (deja la más nueva) para poder crear el índice.
UPDATE "Archivo" a SET estado = 'ELIMINADO', "eliminadoEl" = now()
WHERE a.generado AND a.estado = 'LISTO' AND EXISTS (
  SELECT 1 FROM "Archivo" b
  WHERE b.generado AND b.estado = 'LISTO' AND b.scope = a.scope
    AND COALESCE(b."cotizacionId", b."comprobanteId", b."ordenId", b."ordenItemId",
                 b."clienteId", b."cobroId", b."productoId", b."proveedorId")
      = COALESCE(a."cotizacionId", a."comprobanteId", a."ordenId", a."ordenItemId",
                 a."clienteId", a."cobroId", a."productoId", a."proveedorId")
    AND (b."createdAt" > a."createdAt"
         OR (b."createdAt" = a."createdAt" AND b.id > a.id))
);

CREATE UNIQUE INDEX "Archivo_generado_vigente_unico" ON "Archivo" (
  "scope",
  COALESCE("cotizacionId", "comprobanteId", "ordenId", "ordenItemId",
           "clienteId", "cobroId", "productoId", "proveedorId")
) WHERE "generado" AND "estado" = 'LISTO';
