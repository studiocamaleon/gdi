-- Retiro del look-ahead de pre-prensa: acomoda el paso que imprime.
--
-- Hasta acá `pre_prensa` publicaba la imposición sin conocer papel ni máquina:
-- espiaba el siguiente `impresion_por_hoja`, le tomaba prestados el material y
-- la máquina, corría SU nesting y publicaba `pliegos_calculados`,
-- `poses_por_pliego`, `cortes_calculados`, `imposicion_calculada` y
-- `talonario_pilas`. El paso de impresión heredaba esa cantidad.
--
-- Consecuencia: ningún producto podía imprimirse sin un paso de pre-prensa.
--
-- El código ya no hace ese look-ahead. Esta migración acomoda los datos para
-- que los productos existentes sigan cotizando igual. Es IDEMPOTENTE: cada
-- UPDATE filtra por el estado viejo, así que correrla dos veces no hace nada.

-- 1) El modo de talonarios incompletos se muda de pre-prensa al PRIMER paso
--    de impresión de la misma ruta.
--
--    Es una decisión de negocio, no una mudanza mecánica: el agrupamiento
--    produce las PILAS, y las pilas las consume el abrochado para contar
--    broches. Con tres pasos de impresión (original, duplicado, triplicado)
--    cada uno eligiendo su propio pliego, tres agrupamientos darían tres
--    números distintos y el último pisaría a los anteriores. Manda el
--    original: es el que define cómo se arma el talonario.
WITH origen AS (
  SELECT cp."productoRutaAlternativaId" AS ruta_alt,
         cp."paramsPasoJson"->>'modoTalonarioIncompleto' AS modo
  FROM "ProductoConfigPaso" cp
  JOIN "RutaPaso" rp ON rp.id = cp."rutaPasoId"
  WHERE rp."familiaCodigo" = 'pre_prensa'
    AND cp."paramsPasoJson" ? 'modoTalonarioIncompleto'
),
destino AS (
  SELECT DISTINCT ON (o.ruta_alt) cp.id, o.modo
  FROM origen o
  JOIN "ProductoConfigPaso" cp
    ON cp."productoRutaAlternativaId" = o.ruta_alt
  JOIN "RutaPaso" rp ON rp.id = cp."rutaPasoId"
  WHERE rp."familiaCodigo" = 'impresion_por_hoja'
  ORDER BY o.ruta_alt, rp.orden
)
UPDATE "ProductoConfigPaso" cp
SET "paramsPasoJson" =
      COALESCE(cp."paramsPasoJson", '{}'::jsonb)
      || jsonb_build_object('modoTalonarioIncompleto', d.modo)
FROM destino d
WHERE cp.id = d.id;

-- 2) Pre-prensa deja de declararlo.
--
--    Ojo: una ruta alternativa que tenga pre-prensa pero NINGÚN paso de
--    impresión configurado pierde el parámetro sin destino — no hay dónde
--    ponerlo. Esa ruta ya no podía cotizar (sin impresión no hay imposición),
--    y cuando se complete habrá que declararlo en el paso del original.
UPDATE "ProductoConfigPaso" cp
SET "paramsPasoJson" = cp."paramsPasoJson" - 'modoTalonarioIncompleto'
FROM "RutaPaso" rp
WHERE rp.id = cp."rutaPasoId"
  AND rp."familiaCodigo" = 'pre_prensa'
  AND cp."paramsPasoJson" ? 'modoTalonarioIncompleto';

-- 3) Impresión pasa a acomodar por sí misma en vez de heredar los pliegos.
--
--    Van TODOS los pasos de impresión que heredaban, no sólo los que seguían
--    a un pre-prensa: después de este cambio nadie más publica la imposición,
--    así que un paso de impresión que herede se queda sin fuente. Y heredar
--    los pliegos de OTRO paso de impresión tampoco tendría sentido: cada uno
--    imprime sus propios pliegos sobre su propio pliego elegido.
UPDATE "ProductoConfigPaso" cp
SET "mecanismoCantidad" = 'CALCULADO_POR_PASO'
FROM "RutaPaso" rp
WHERE rp.id = cp."rutaPasoId"
  AND rp."familiaCodigo" = 'impresion_por_hoja'
  AND cp."mecanismoCantidad" = 'HEREDAR_DEL_OUTPUT_CANONICO';
