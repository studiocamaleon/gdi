-- SM.5.a: Data migration
--
-- Poblar familiaV2 + unidadProductivaV2 en ProcesoOperacion existentes
-- para que el super motor no dependa del fallback `inferirFamiliaDesdeTipo`.
--
-- Mapeo por prioridad:
--   1. maquina.plantilla (si la op tiene máquina asignada) — más confiable.
--   2. tipoOperacion + nombre del paso (fallback).
--
-- Safe: solo actualiza filas donde familiaV2/unidadProductivaV2 IS NULL.
-- Nuevas operaciones deberían declarar explícitamente esos campos al crearse.

UPDATE "ProcesoOperacion" po
SET
  "familiaV2" = sub."familia",
  "unidadProductivaV2" = sub."unidad"
FROM (
  SELECT
    p.id,
    CASE
      -- 1. Primero, por plantilla de máquina (más confiable)
      WHEN m.plantilla = 'IMPRESORA_UV_MESA_EXTENSORA' THEN 'impresion_por_pieza'
      WHEN m.plantilla = 'IMPRESORA_UV_ROLLO' THEN 'impresion_por_area'
      WHEN m.plantilla = 'IMPRESORA_LATEX' THEN 'impresion_por_area'
      WHEN m.plantilla = 'IMPRESORA_SOLVENTE' THEN 'impresion_por_area'
      WHEN m.plantilla = 'IMPRESORA_INYECCION_TINTA' THEN 'impresion_por_area'
      WHEN m.plantilla = 'IMPRESORA_SUBLIMACION_GRAN_FORMATO' THEN 'impresion_por_area'
      WHEN m.plantilla = 'IMPRESORA_LASER' THEN 'impresion_por_hoja'
      WHEN m.plantilla = 'PLOTTER_DE_CORTE' THEN 'corte'
      WHEN m.plantilla = 'GUILLOTINA' THEN 'corte'
      WHEN m.plantilla = 'LAMINADORA_BOPP_ROLLO' THEN 'laminado'
      WHEN m.plantilla = 'PERFORADORA' THEN 'perforado'
      WHEN m.plantilla = 'REDONDEADORA_PUNTAS' THEN 'operacion_manual'
      -- 2. Por tipoOperacion + nombre (fallback)
      WHEN p."tipoOperacion" = 'PREPRENSA' AND LOWER(p.nombre) LIKE '%diseño%' THEN 'diseno_grafico'
      WHEN p."tipoOperacion" = 'PREPRENSA' AND LOWER(p.nombre) LIKE '%design%' THEN 'diseno_grafico'
      WHEN p."tipoOperacion" = 'PREPRENSA' THEN 'pre_prensa'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%lamin%' THEN 'laminado'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%refil%' THEN 'corte'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%corte%' THEN 'corte'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%encuadern%' THEN 'encuadernado'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%anillado%' THEN 'encuadernado'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%espiral%' THEN 'encuadernado'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%troquel%' THEN 'troquelado'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%pleg%' THEN 'plegado'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%perf%' THEN 'perforado'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%foil%' THEN 'acabado_decorativo'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%relieve%' THEN 'acabado_decorativo'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%hot-stamp%' THEN 'acabado_decorativo'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%pintur%' THEN 'pintura_superficial'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%barniz%' THEN 'pintura_superficial'
      WHEN p."tipoOperacion" = 'TERMINACION' THEN 'operacion_manual'
      WHEN p."tipoOperacion" IN ('EMPAQUE', 'LOGISTICA') THEN 'operacion_manual'
      WHEN p."tipoOperacion" = 'IMPRESION' AND LOWER(p.nombre) LIKE '%rollo%' THEN 'impresion_por_area'
      WHEN p."tipoOperacion" = 'IMPRESION' AND LOWER(p.nombre) LIKE '%uv%' THEN 'impresion_por_pieza'
      WHEN p."tipoOperacion" = 'IMPRESION' AND LOWER(p.nombre) LIKE '%plotter%' THEN 'corte'
      WHEN p."tipoOperacion" = 'IMPRESION' THEN 'impresion_por_hoja'
      ELSE 'operacion_manual'
    END AS "familia",
    CASE
      -- Unidad productiva derivada de la familia inferida.
      -- impresion_por_hoja → pliego
      -- impresion_por_area → metro_lineal
      -- impresion_por_pieza → placa
      -- corte / corte_volumetrico → metro_lineal (perímetro)
      -- laminado / pintura_superficial → m2
      -- encuadernado → unidad (libro/talonario)
      -- pre_prensa / diseno_grafico / otros → unidad
      WHEN m.plantilla IN (
        'IMPRESORA_UV_ROLLO', 'IMPRESORA_LATEX', 'IMPRESORA_SOLVENTE',
        'IMPRESORA_INYECCION_TINTA', 'IMPRESORA_SUBLIMACION_GRAN_FORMATO'
      ) THEN 'metro_lineal'
      WHEN m.plantilla = 'IMPRESORA_UV_MESA_EXTENSORA' THEN 'placa'
      WHEN m.plantilla = 'IMPRESORA_LASER' THEN 'pliego'
      WHEN m.plantilla IN ('PLOTTER_DE_CORTE', 'GUILLOTINA') THEN 'metro_lineal'
      WHEN m.plantilla = 'LAMINADORA_BOPP_ROLLO' THEN 'm2'
      WHEN p."tipoOperacion" = 'IMPRESION' AND LOWER(p.nombre) LIKE '%rollo%' THEN 'metro_lineal'
      WHEN p."tipoOperacion" = 'IMPRESION' AND LOWER(p.nombre) LIKE '%uv%' THEN 'placa'
      WHEN p."tipoOperacion" = 'IMPRESION' AND LOWER(p.nombre) LIKE '%plotter%' THEN 'metro_lineal'
      WHEN p."tipoOperacion" = 'IMPRESION' THEN 'pliego'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%lamin%' THEN 'm2'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%pintur%' THEN 'm2'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%barniz%' THEN 'm2'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%refil%' THEN 'pliego'
      WHEN p."tipoOperacion" = 'TERMINACION' AND LOWER(p.nombre) LIKE '%corte%' THEN 'metro_lineal'
      ELSE 'unidad'
    END AS "unidad"
  FROM "ProcesoOperacion" p
  LEFT JOIN "Maquina" m ON m.id = p."maquinaId"
  WHERE p."familiaV2" IS NULL OR p."unidadProductivaV2" IS NULL
) sub
WHERE po.id = sub.id;
