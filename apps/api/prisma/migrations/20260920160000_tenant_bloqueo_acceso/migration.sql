-- Conserva todos los estados existentes. Las suspensiones históricas requieren
-- diagnóstico; no se inventa su motivo ni se reactiva ninguna suscripción.
ALTER TABLE "Tenant" ADD COLUMN "bloqueoAccesoMotivo" TEXT,
                     ADD COLUMN "bloqueoAccesoEl" TIMESTAMP(3);
