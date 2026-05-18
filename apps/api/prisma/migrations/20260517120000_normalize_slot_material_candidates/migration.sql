-- Normaliza candidatos de materiales por slot:
-- de JSON plano de variantes a materia prima principal + variantes habilitadas.

CREATE TABLE "ProductoConfigPasoSlotMaterialCandidato" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "slotMaterialId" UUID NOT NULL,
    "materiaPrimaId" UUID NOT NULL,
    "defaultVarianteId" UUID,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoConfigPasoSlotMaterialCandidato_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductoConfigPasoSlotMaterialCandidatoVariante" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "candidatoId" UUID NOT NULL,
    "varianteId" UUID NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoConfigPasoSlotMaterialCandidatoVariante_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlotMaterialCand_tenant_slot_materia_key"
    ON "ProductoConfigPasoSlotMaterialCandidato"("tenantId", "slotMaterialId", "materiaPrimaId");
CREATE INDEX "SlotMaterialCand_tenant_slot_idx"
    ON "ProductoConfigPasoSlotMaterialCandidato"("tenantId", "slotMaterialId");
CREATE INDEX "SlotMaterialCand_tenant_materia_idx"
    ON "ProductoConfigPasoSlotMaterialCandidato"("tenantId", "materiaPrimaId");

CREATE UNIQUE INDEX "SlotMaterialCandVar_tenant_candidate_variant_key"
    ON "ProductoConfigPasoSlotMaterialCandidatoVariante"("tenantId", "candidatoId", "varianteId");
CREATE INDEX "SlotMaterialCandVar_tenant_candidate_idx"
    ON "ProductoConfigPasoSlotMaterialCandidatoVariante"("tenantId", "candidatoId");
CREATE INDEX "SlotMaterialCandVar_tenant_variant_idx"
    ON "ProductoConfigPasoSlotMaterialCandidatoVariante"("tenantId", "varianteId");

ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato"
    ADD CONSTRAINT "SlotMaterialCand_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato"
    ADD CONSTRAINT "SlotMaterialCand_slot_fkey"
    FOREIGN KEY ("slotMaterialId") REFERENCES "ProductoConfigPasoSlotMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato"
    ADD CONSTRAINT "SlotMaterialCand_materia_fkey"
    FOREIGN KEY ("materiaPrimaId") REFERENCES "MateriaPrima"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato"
    ADD CONSTRAINT "SlotMaterialCand_default_variant_fkey"
    FOREIGN KEY ("defaultVarianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductoConfigPasoSlotMaterialCandidatoVariante"
    ADD CONSTRAINT "SlotMaterialCandVar_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidatoVariante"
    ADD CONSTRAINT "SlotMaterialCandVar_candidate_fkey"
    FOREIGN KEY ("candidatoId") REFERENCES "ProductoConfigPasoSlotMaterialCandidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidatoVariante"
    ADD CONSTRAINT "SlotMaterialCandVar_variant_fkey"
    FOREIGN KEY ("varianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH legacy AS (
    SELECT
        s.id AS "slotMaterialId",
        s."tenantId",
        v."materiaPrimaId",
        v.id AS "varianteId",
        MIN((item.ordinality - 1)::int) AS orden,
        BOOL_OR(COALESCE((item.value ->> 'default')::boolean, false)) AS es_default
    FROM "ProductoConfigPasoSlotMaterial" s
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(s."materialesCandidatosJson"::jsonb) = 'array'
                THEN s."materialesCandidatosJson"::jsonb
            ELSE '[]'::jsonb
        END
    )
        WITH ORDINALITY AS item(value, ordinality)
    JOIN "MateriaPrimaVariante" v
        ON v.id = COALESCE(item.value ->> 'variantId', item.value ->> 'materialVarianteId')::uuid
    GROUP BY s.id, s."tenantId", v."materiaPrimaId", v.id
),
candidatos AS (
    INSERT INTO "ProductoConfigPasoSlotMaterialCandidato" (
        "tenantId",
        "slotMaterialId",
        "materiaPrimaId",
        "defaultVarianteId",
        "orden",
        "updatedAt"
    )
    SELECT
        l."tenantId",
        l."slotMaterialId",
        l."materiaPrimaId",
        (
            SELECT l2."varianteId"
            FROM legacy l2
            WHERE l2."slotMaterialId" = l."slotMaterialId"
              AND l2."materiaPrimaId" = l."materiaPrimaId"
              AND l2.es_default
            ORDER BY l2.orden ASC
            LIMIT 1
        ) AS "defaultVarianteId",
        MIN(l.orden) AS orden,
        CURRENT_TIMESTAMP
    FROM legacy l
    GROUP BY l."tenantId", l."slotMaterialId", l."materiaPrimaId"
    RETURNING id, "tenantId", "slotMaterialId", "materiaPrimaId"
)
INSERT INTO "ProductoConfigPasoSlotMaterialCandidatoVariante" (
    "tenantId",
    "candidatoId",
    "varianteId",
    "orden"
)
SELECT
    c."tenantId",
    c.id,
    l."varianteId",
    l.orden
FROM candidatos c
JOIN legacy l
  ON l."slotMaterialId" = c."slotMaterialId"
 AND l."materiaPrimaId" = c."materiaPrimaId";

ALTER TABLE "ProductoConfigPasoSlotMaterial" DROP COLUMN "materialesCandidatosJson";
