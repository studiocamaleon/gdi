-- Sesión de plataforma (backoffice, opción A): el staff se autentica sin
-- estar parado en ningún tenant. Ver docs/control-plane-diseno.md
ALTER TABLE "AuthSession" ALTER COLUMN "currentTenantId" DROP NOT NULL;
