-- Desde qué IPs puede entrar cada persona a cada empresa.
--
-- Default de array vacío = sin restricción. Que "vacío" signifique "desde
-- cualquier lado" y no "desde ninguno" es la decisión importante: al revés,
-- esta migración habría dejado a todos los usuarios del sistema sin poder
-- entrar en el momento del deploy.
--
-- Ver docs/usuarios-roles-permisos-diseno.md
ALTER TABLE "Membership" ADD COLUMN "ipsPermitidas" TEXT[] DEFAULT ARRAY[]::TEXT[];
