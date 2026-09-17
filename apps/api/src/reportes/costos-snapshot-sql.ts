/** Fragmentos internos, sin texto del usuario. El árbol económico se recorre
 * desde cada raíz comercial: nunca se suman además los hijos de la OT ni los
 * totales de lote, cuyo costo ya está repartido entre los participantes. */
export const PASOS_ECONOMICOS_SQL = `
  WITH RECURSIVE arbol(nodo) AS (
    SELECT COALESCE(ci."trazabilidadJson", '{}'::jsonb)
    UNION ALL
    SELECT hijo FROM arbol
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(nodo->'componentesFabricados') = 'array' THEN nodo->'componentesFabricados'
           WHEN jsonb_typeof(nodo->'componentes') = 'array' THEN nodo->'componentes'
           ELSE '[]'::jsonb END
    ) hijo
  )
  SELECT paso FROM arbol
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(nodo->'pasos') = 'array' THEN nodo->'pasos' ELSE '[]'::jsonb END
  ) paso
  WHERE paso->>'activado' IS DISTINCT FROM 'false'
`;

// Las operaciones internas ya están agregadas en los materiales del nodo.
// La mano de obra de incorporación pertenece al costo de tiempo/estructura.
// La tercerización sí es variable; sus materiales propios se cuentan una vez.
// Las revisiones anteriores al subtotal agregado lo conservan únicamente en
// operacionesInternas. El motor anterior no guardaba su flag tercerizado:
// las operaciones activas compradas son las que no tienen bloque de tiempo
// interno. Recuperar su costo neto no vuelve a sumar sus materiales.
export const COSTO_VARIABLE_PASO_SQL = `
  COALESCE((SELECT SUM((mat->>'costoTotal')::numeric)
    FROM jsonb_array_elements(COALESCE(NULLIF(paso->'materiales', 'null'::jsonb), '[]'::jsonb)) mat
    WHERE mat->>'tipoLineaCosto' IN ('MATERIAL', 'CONSUMIBLE_MAQUINA', 'DESGASTE_MAQUINA')), 0)
  + CASE WHEN paso->>'costoTercerizado' IS NOT NULL THEN (paso->>'costoTercerizado')::numeric
         WHEN paso->>'tercerizado' = 'true' THEN
           COALESCE((paso->>'costoTotal')::numeric, 0) - COALESCE((SELECT SUM((mat->>'costoTotal')::numeric)
             FROM jsonb_array_elements(COALESCE(NULLIF(paso->'materiales', 'null'::jsonb), '[]'::jsonb)) mat), 0)
         ELSE COALESCE((SELECT SUM(
           CASE WHEN interna->>'costoTercerizado' IS NOT NULL THEN (interna->>'costoTercerizado')::numeric
                WHEN interna->>'tercerizado' = 'true' OR (interna->>'tercerizado' IS NULL AND NULLIF(interna->'tiempo', 'null'::jsonb) IS NULL) THEN
                  COALESCE((interna->>'costoTotal')::numeric, 0) - COALESCE((SELECT SUM((mat->>'costoTotal')::numeric)
                    FROM jsonb_array_elements(COALESCE(NULLIF(interna->'materiales', 'null'::jsonb), '[]'::jsonb)) mat), 0)
                ELSE 0 END)
           FROM jsonb_array_elements(COALESCE(NULLIF(paso->'operacionesInternas', 'null'::jsonb), '[]'::jsonb)) interna
           WHERE interna->>'activada' IS DISTINCT FROM 'false'), 0) END
`;
