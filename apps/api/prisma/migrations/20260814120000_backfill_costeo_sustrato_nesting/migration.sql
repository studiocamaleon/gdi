-- Backfill: el costeo del sustrato pasa a vivir SÓLO en
-- `paramsPasoJson.nestingConfig.costing` (fuente única). El resolver del motor
-- (`resolverEstrategiaCosteoNesting`) dejó de leer `slot.estrategiaCosto`.
--
-- Para no mover las cotizaciones de pasos donde la estrategia vivía en el SLOT
-- (no-`simple`) y el nesting no la tenía, se copia la del sustrato al nesting.
-- Idempotente: sólo actúa donde el nesting aún no define `strategy`.
--
-- Los tres `jsonb_set` anidados crean `nestingConfig` y `costing` si faltan
-- (jsonb_set con create_missing NO crea padres intermedios; el COALESCE de cada
-- nivel los materializa). Los `segmentSteps` quedan en su default del motor
-- ([25,50,75,100]) — cuando la estrategia vivía sólo en el slot, nunca hubo
-- escalones custom (se cargan junto con la estrategia en Acomodado).
--
-- Ver docs/editor-pasos-preguntas-orden.md §10.5 y nesting-abstraccion §3.3.
UPDATE "ProductoConfigPaso" p
SET "paramsPasoJson" = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(p."paramsPasoJson", '{}'::jsonb),
          '{nestingConfig}',
          COALESCE(p."paramsPasoJson" -> 'nestingConfig', '{}'::jsonb),
          true
        ),
        '{nestingConfig,costing}',
        COALESCE(p."paramsPasoJson" -> 'nestingConfig' -> 'costing', '{}'::jsonb),
        true
      ),
      '{nestingConfig,costing,strategy}',
      to_jsonb(s."estrategiaCosto"),
      true
    )
FROM "ProductoConfigPasoSlotMaterial" s
WHERE s."productoConfigPasoId" = p."id"
  AND (s."slotRol" = 'SUSTRATO' OR s."slotCodigo" = 'sustrato_principal')
  AND s."estrategiaCosto" IS NOT NULL
  AND s."estrategiaCosto" <> 'simple'
  AND (p."paramsPasoJson" -> 'nestingConfig' -> 'costing' ->> 'strategy') IS NULL;
