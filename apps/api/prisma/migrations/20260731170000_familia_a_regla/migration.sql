-- Fase D del rediseño "estaciones por reglas" (docs/estaciones-reglas-diseno.md
-- §7/§9): la regla "por familia" pasa a vivir en EstacionRegla (tipo='familia'),
-- unificada con tecnología/paso. Copia 1:1 las asignaciones de EstacionFamilia
-- (neutral: el ruteo por familia sigue igual). EstacionFamilia queda como
-- respaldo — ya no se lee ni se escribe; se puede dropear en una limpieza futura.
-- Idempotente: ON CONFLICT no duplica si se re-corre.

INSERT INTO "EstacionRegla" ("id", "tenantId", "estacionId", "tipo", "valor", "createdAt")
SELECT gen_random_uuid(), ef."tenantId", ef."estacionId", 'familia', ef."familiaCodigo", CURRENT_TIMESTAMP
FROM "EstacionFamilia" ef
ON CONFLICT ("estacionId", "tipo", "valor") DO NOTHING;
