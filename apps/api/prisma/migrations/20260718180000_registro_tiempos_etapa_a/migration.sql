-- Registro de tiempos de producción — etapa A.
-- Tramos de trabajo por paso, modo de registro, tiempo real con fuente,
-- atribución de operador y corte de jornada del tenant.
-- Ver docs/registro-tiempos-produccion-diseno.md

-- ── Paso: modo de registro, tiempo con fuente y atribución (D1/D3/D5) ────
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "modoRegistro" TEXT NOT NULL DEFAULT 'cronometro';
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "tiempoRealMin" DECIMAL(10,2);
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "tiempoFuente" TEXT;
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "iniciadoPorId" UUID;
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "iniciadoPorNombre" TEXT;
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "completadoPorId" UUID;
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "completadoPorNombre" TEXT;

ALTER TABLE "OrdenTrabajoItemPaso" ADD CONSTRAINT "OrdenTrabajoItemPaso_iniciadoPorId_fkey" FOREIGN KEY ("iniciadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrdenTrabajoItemPaso" ADD CONSTRAINT "OrdenTrabajoItemPaso_completadoPorId_fkey" FOREIGN KEY ("completadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Tramos de trabajo (D2) ───────────────────────────────────────────────
CREATE TABLE "OrdenTrabajoPasoTramo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "pasoId" UUID NOT NULL,
    "usuarioId" UUID,
    "usuarioNombre" TEXT NOT NULL,
    "inicioEl" TIMESTAMP(3) NOT NULL,
    "finEl" TIMESTAMP(3),
    "motivoFin" TEXT,
    "motivoDetalle" VARCHAR(300),
    "origen" TEXT NOT NULL DEFAULT 'usuario',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenTrabajoPasoTramo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrdenTrabajoPasoTramo_tenantId_pasoId_idx" ON "OrdenTrabajoPasoTramo"("tenantId", "pasoId");
CREATE INDEX "OrdenTrabajoPasoTramo_tenantId_finEl_idx" ON "OrdenTrabajoPasoTramo"("tenantId", "finEl");
CREATE INDEX "OrdenTrabajoPasoTramo_tenantId_usuarioId_finEl_idx" ON "OrdenTrabajoPasoTramo"("tenantId", "usuarioId", "finEl");

ALTER TABLE "OrdenTrabajoPasoTramo" ADD CONSTRAINT "OrdenTrabajoPasoTramo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrdenTrabajoPasoTramo" ADD CONSTRAINT "OrdenTrabajoPasoTramo_pasoId_fkey" FOREIGN KEY ("pasoId") REFERENCES "OrdenTrabajoItemPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrdenTrabajoPasoTramo" ADD CONSTRAINT "OrdenTrabajoPasoTramo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Corte de jornada del tenant (D9) ─────────────────────────────────────
ALTER TABLE "ConfiguracionProduccion" ADD COLUMN "corteJornada" TEXT NOT NULL DEFAULT '20:00';

-- ── Backfill ─────────────────────────────────────────────────────────────

-- Modo de registro según la familia (catálogo cerrado en TS): las familias
-- de categoría produccion_impresion pasan a solo_completar; el resto queda
-- en el default 'cronometro'.
UPDATE "OrdenTrabajoItemPaso"
SET "modoRegistro" = 'solo_completar'
WHERE "familiaCodigo" IN (
  'impresion_por_hoja', 'impresion_por_area', 'impresion_por_pieza',
  'aplicacion_transfer', 'grabado_laser'
);

-- Atribución histórica: el último evento 'paso' con accion=completar de
-- cada paso hecho nombra a quien lo completó.
UPDATE "OrdenTrabajoItemPaso" p
SET "completadoPorId" = ev."usuarioId",
    "completadoPorNombre" = ev."usuarioNombre"
FROM (
  SELECT DISTINCT ON (e."datosJson"->>'pasoId')
         e."datosJson"->>'pasoId' AS paso_id,
         e."usuarioId",
         e."usuarioNombre"
  FROM "OrdenTrabajoEvento" e
  WHERE e."tipo" = 'paso'
    AND e."datosJson"->>'accion' = 'completar'
  ORDER BY e."datosJson"->>'pasoId', e."fecha" DESC
) ev
WHERE p."estado" = 'hecho'
  AND ev.paso_id = p."id"::text;

-- Pasos hechos con duración real medible: un tramo sintético + tiempo
-- 'medido'. Los de duración 0 (completar-directo histórico) quedan sin
-- tramo: 'estimado' si su modo nuevo es solo_completar y hay estimado,
-- si no 'invalido'.
INSERT INTO "OrdenTrabajoPasoTramo"
  ("id", "tenantId", "pasoId", "usuarioId", "usuarioNombre", "inicioEl",
   "finEl", "motivoFin", "origen")
SELECT gen_random_uuid(), p."tenantId", p."id", p."completadoPorId",
       COALESCE(p."completadoPorNombre", 'Sistema'), p."iniciadoEl",
       p."completadoEl", 'migracion', 'sistema'
FROM "OrdenTrabajoItemPaso" p
WHERE p."estado" = 'hecho'
  AND p."iniciadoEl" IS NOT NULL
  AND p."completadoEl" IS NOT NULL
  AND p."completadoEl" > p."iniciadoEl";

UPDATE "OrdenTrabajoItemPaso"
SET "tiempoRealMin" = ROUND(EXTRACT(EPOCH FROM ("completadoEl" - "iniciadoEl"))::numeric / 60.0, 2),
    "tiempoFuente" = 'medido'
WHERE "estado" = 'hecho'
  AND "iniciadoEl" IS NOT NULL
  AND "completadoEl" IS NOT NULL
  AND "completadoEl" > "iniciadoEl";

UPDATE "OrdenTrabajoItemPaso"
SET "tiempoRealMin" = CASE
      WHEN "modoRegistro" = 'solo_completar' THEN "duracionEstimadaMin"
      ELSE NULL
    END,
    "tiempoFuente" = CASE
      WHEN "modoRegistro" = 'solo_completar' AND "duracionEstimadaMin" IS NOT NULL
        THEN 'estimado'
      ELSE 'invalido'
    END
WHERE "estado" = 'hecho'
  AND ("iniciadoEl" IS NULL OR "completadoEl" IS NULL OR "completadoEl" <= "iniciadoEl");
