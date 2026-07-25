-- La nómina se muda al legajo. Ver docs/legajos-nomina-diseno.md
--
-- Hasta acá el sueldo de cada persona se re-tipeaba en CADA centro de costo
-- donde trabajaba, y ya había divergido: la misma persona con dos sueldos base
-- distintos en centros distintos, sin nada que lo detectara. El vínculo con el
-- empleado existía sólo dentro de `detalleJson`, que es como decir que no
-- existía — no se puede consultar, indexar ni proteger con FK.

-- ── 1. La remuneración, con vigencia ────────────────────────────────────────
CREATE TABLE "EmpleadoRemuneracion" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"       UUID NOT NULL,
    "empleadoId"     UUID NOT NULL,
    "vigenteDesde"   TEXT NOT NULL,
    "vigenteHasta"   TEXT,
    "sueldoNeto"     DECIMAL(14,2) NOT NULL,
    "cargasSociales" DECIMAL(14,2) NOT NULL,
    "sueldosPorAnio" INTEGER NOT NULL DEFAULT 13,
    "motivo"         TEXT,
    "notas"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmpleadoRemuneracion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmpleadoRemuneracion_tenantId_empleadoId_vigenteDesde_idx"
    ON "EmpleadoRemuneracion"("tenantId", "empleadoId", "vigenteDesde");
CREATE INDEX "EmpleadoRemuneracion_tenantId_vigenteDesde_idx"
    ON "EmpleadoRemuneracion"("tenantId", "vigenteDesde");

ALTER TABLE "EmpleadoRemuneracion"
    ADD CONSTRAINT "EmpleadoRemuneracion_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmpleadoRemuneracion"
    ADD CONSTRAINT "EmpleadoRemuneracion_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. El componente de costo apunta a la persona de verdad ─────────────────
ALTER TABLE "CentroCostoComponenteCostoPeriodo" ADD COLUMN "empleadoId" UUID;

CREATE INDEX "CentroCostoComponenteCostoPeriodo_tenantId_empleadoId_perio_idx"
    ON "CentroCostoComponenteCostoPeriodo"("tenantId", "empleadoId", "periodo");

ALTER TABLE "CentroCostoComponenteCostoPeriodo"
    ADD CONSTRAINT "CentroCostoComponenteCostoPeriodo_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sacar el empleadoId de donde ya estaba: adentro del JSON.
UPDATE "CentroCostoComponenteCostoPeriodo" c
SET "empleadoId" = (c."detalleJson" ->> 'empleadoId')::UUID
WHERE c."categoria" IN ('SUELDOS', 'CARGAS')
  AND c."detalleJson" ->> 'empleadoId' IS NOT NULL
  -- Sólo si apunta a un empleado que existe: un JSON viejo con un id borrado
  -- rompería la FK y tumbaría la migración entera.
  AND EXISTS (
      SELECT 1 FROM "Empleado" e
      WHERE e."id" = (c."detalleJson" ->> 'empleadoId')::UUID
        AND e."tenantId" = c."tenantId"
  );

-- ── 3. Reconstruir la nómina desde lo que ya estaba cargado ────────────────
--
-- Una fila por (empleado, período) con sueldo declarado. Cuando la misma
-- persona tenía valores DISTINTOS en centros distintos —que es el problema que
-- motivó todo esto— se toma el más frecuente y, si empatan, el mayor; y se
-- deja dicho en `notas` que hubo conflicto. No se elige en silencio: el
-- usuario revisa y ajusta a mano en el legajo.
--
-- OJO con la forma del JSON: cada componente guarda SÓLO SU MITAD. La fila
-- SUELDOS trae `sueldoNeto` y `cargasSociales: 0`; la fila CARGAS al revés. Hay
-- que juntar las dos por centro antes de comparar entre centros, o las cargas
-- quedan en cero para todo el mundo.
--
-- `sueldosPorAnio` queda en 13 (con aguinaldo) para todos, que es el caso
-- normal; el que no corresponda se corrige en el legajo.
WITH por_centro AS (
    SELECT
        c."tenantId",
        c."empleadoId",
        c."periodo",
        c."centroCostoId",
        MAX(CASE WHEN c."categoria" = 'SUELDOS'
                 THEN COALESCE((c."detalleJson" ->> 'sueldoNeto')::NUMERIC, 0)
            END) AS neto,
        MAX(CASE WHEN c."categoria" = 'CARGAS'
                 THEN COALESCE((c."detalleJson" ->> 'cargasSociales')::NUMERIC, 0)
            END) AS cargas
    FROM "CentroCostoComponenteCostoPeriodo" c
    WHERE c."categoria" IN ('SUELDOS', 'CARGAS')
      AND c."empleadoId" IS NOT NULL
    GROUP BY c."tenantId", c."empleadoId", c."periodo", c."centroCostoId"
),
declarado AS (
    SELECT "tenantId", "empleadoId", "periodo", neto, COALESCE(cargas, 0) AS cargas
    FROM por_centro
    WHERE COALESCE(neto, 0) > 0
),
ranked AS (
    SELECT
        "tenantId", "empleadoId", "periodo", neto, cargas,
        COUNT(*) OVER (PARTITION BY "tenantId", "empleadoId", "periodo") AS variantes,
        ROW_NUMBER() OVER (
            PARTITION BY "tenantId", "empleadoId", "periodo"
            ORDER BY COUNT(*) DESC, neto DESC
        ) AS puesto
    FROM declarado
    GROUP BY "tenantId", "empleadoId", "periodo", neto, cargas
)
INSERT INTO "EmpleadoRemuneracion" (
    "tenantId", "empleadoId", "vigenteDesde", "sueldoNeto", "cargasSociales",
    "sueldosPorAnio", "motivo", "notas", "updatedAt"
)
SELECT
    "tenantId",
    "empleadoId",
    "periodo",
    neto,
    cargas,
    13,
    'correccion',
    CASE
        WHEN variantes > 1 THEN
            'Reconstruido de los centros de costo al mudar la nómina al legajo. '
            || 'OJO: había ' || variantes || ' sueldos distintos para esta persona '
            || 'en centros distintos; se tomó el más frecuente. Confirmar.'
        ELSE
            'Reconstruido de los centros de costo al mudar la nómina al legajo. Confirmar.'
    END,
    CURRENT_TIMESTAMP
FROM ranked
WHERE puesto = 1;

-- Cerrar las vigencias: cada fila vale hasta el mes anterior a la siguiente de
-- la misma persona. La última queda abierta (`vigenteHasta` null).
UPDATE "EmpleadoRemuneracion" r
SET "vigenteHasta" = siguiente."limite"
FROM (
    SELECT
        "id",
        TO_CHAR(
            TO_DATE(
                LEAD("vigenteDesde") OVER (
                    PARTITION BY "tenantId", "empleadoId" ORDER BY "vigenteDesde"
                ) || '-01',
                'YYYY-MM-DD'
            ) - INTERVAL '1 month',
            'YYYY-MM'
        ) AS "limite"
    FROM "EmpleadoRemuneracion"
) AS siguiente
WHERE r."id" = siguiente."id"
  AND siguiente."limite" IS NOT NULL;

-- ── 4. Permiso nuevo: ver los sueldos ──────────────────────────────────────
--
-- Registros es un módulo abierto (el Vendedor tiene `registros.gestionar`
-- porque carga clientes), así que la remuneración pide permiso propio. De
-- fábrica, sólo el Administrador.
UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['registros.ver_remuneraciones']::TEXT[]
WHERE "codigo" = 'administrador'
  AND "esDelSistema" = true
  AND NOT ('registros.ver_remuneraciones' = ANY("permisos"));
