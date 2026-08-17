-- Plotters de corte y cortadoras láser ya no requieren componentes de
-- desgaste para quedar disponibles. Recalcular las fichas que sólo estaban
-- incompletas por esa regla, sin activarlas automáticamente.
UPDATE "Maquina" m
SET "estadoConfiguracion" = 'LISTA'
WHERE m."estadoConfiguracion" = 'INCOMPLETA'
  AND m.plantilla = 'PLOTTER_DE_CORTE'
  AND m."anchoUtil" > 0
  AND jsonb_typeof(m."parametrosTecnicosJson"->'modosOperacionSoportados') = 'array'
  AND jsonb_array_length(m."parametrosTecnicosJson"->'modosOperacionSoportados') > 0
  AND EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND btrim(p.nombre) <> ''
      AND p."tipoPerfil" = 'CORTE'
      AND p."productivityValue" > 0
      AND p."productivityUnit" IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND (
        btrim(p.nombre) = '' OR p."tipoPerfil" <> 'CORTE' OR
        p."productivityValue" IS NULL OR p."productivityValue" <= 0 OR
        p."productivityUnit" IS NULL
      )
  );

UPDATE "Maquina" m
SET "estadoConfiguracion" = 'LISTA'
WHERE m."estadoConfiguracion" = 'INCOMPLETA'
  AND m.plantilla = 'CORTE_LASER'
  AND m."anchoUtil" > 0 AND m."largoUtil" > 0
  AND EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND btrim(p.nombre) <> ''
      AND p."tipoPerfil" IN ('CORTE', 'GRABADO')
      AND COALESCE(p."detalleJson"->>'tipoOperacion', '') <> ''
      AND p."productivityValue" > 0
      AND p."productivityUnit" IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND (
        btrim(p.nombre) = '' OR p."tipoPerfil" NOT IN ('CORTE', 'GRABADO') OR
        COALESCE(p."detalleJson"->>'tipoOperacion', '') = '' OR
        p."productivityValue" IS NULL OR p."productivityValue" <= 0 OR
        p."productivityUnit" IS NULL
      )
  );
