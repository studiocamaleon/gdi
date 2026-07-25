-- Roles por tenant con sus permisos, y el vínculo desde Membership.
--
-- El enum RolSistema NO se toca: sigue siendo el rol base durante la transición
-- (viaja en el JWT y lo leen los endpoints con @Roles). `rolId` es nullable a
-- propósito — el backfill de abajo lo completa, pero una membership sin rol
-- todavía funciona cayendo a los permisos del enum.
--
-- Ver docs/usuarios-roles-permisos-diseno.md

CREATE TABLE "Rol" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esDelSistema" BOOLEAN NOT NULL DEFAULT false,
    "permisos" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Rol_tenantId_codigo_key" ON "Rol"("tenantId", "codigo");
CREATE INDEX "Rol_tenantId_nombre_idx" ON "Rol"("tenantId", "nombre");

ALTER TABLE "Rol" ADD CONSTRAINT "Rol_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD COLUMN "rolId" UUID;
CREATE INDEX "Membership_rolId_idx" ON "Membership"("rolId");
-- SET NULL y no CASCADE: borrar un rol no puede borrar a la persona. La
-- membership queda sin rol y cae a los permisos del enum hasta que se le
-- asigne otro.
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_rolId_fkey"
    FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invitation" ADD COLUMN "rolId" UUID;

-- ── Seed: los cinco predefinidos en cada tenant existente ────────────────
--
-- Los permisos van escritos acá y no leídos del catálogo de TypeScript: una
-- migración tiene que dar el mismo resultado hoy y dentro de un año, y el
-- catálogo va a cambiar. Si mañana se agrega un módulo, el service que
-- sincroniza los predefinidos lo suma; esto es sólo el punto de partida.

INSERT INTO "Rol" ("id", "tenantId", "codigo", "nombre", "descripcion", "esDelSistema", "permisos", "updatedAt")
SELECT
    gen_random_uuid(), t."id", 'administrador', 'Administrador',
    'Acceso total, incluida la configuración y la facturación.',
    true,
    ARRAY[
        'panel.ver','panel.gestionar','comercial.ver','comercial.gestionar',
        'registros.ver','registros.gestionar','costos.ver','costos.gestionar',
        'produccion.ver','produccion.gestionar','administracion.ver','administracion.gestionar',
        'inventario.ver','inventario.gestionar','configuracion.ver','configuracion.gestionar',
        'finanzas.ver_margenes'
    ]::TEXT[],
    CURRENT_TIMESTAMP
FROM "Tenant" t;

INSERT INTO "Rol" ("id", "tenantId", "codigo", "nombre", "descripcion", "esDelSistema", "permisos", "updatedAt")
SELECT
    gen_random_uuid(), t."id", 'jefe_produccion', 'Jefe de producción',
    'Maneja el taller de punta a punta y ve los costos, sin tocar administración ni configuración.',
    true,
    ARRAY[
        'panel.ver','comercial.ver','registros.ver','costos.ver',
        'produccion.gestionar','inventario.gestionar','finanzas.ver_margenes'
    ]::TEXT[],
    CURRENT_TIMESTAMP
FROM "Tenant" t;

INSERT INTO "Rol" ("id", "tenantId", "codigo", "nombre", "descripcion", "esDelSistema", "permisos", "updatedAt")
SELECT
    gen_random_uuid(), t."id", 'vendedor', 'Vendedor',
    'Cotiza y sigue sus trabajos. NO ve costos ni márgenes: cotiza sobre el precio, no sobre la ganancia.',
    true,
    ARRAY[
        'panel.ver','comercial.gestionar','registros.gestionar','produccion.ver'
    ]::TEXT[],
    CURRENT_TIMESTAMP
FROM "Tenant" t;

INSERT INTO "Rol" ("id", "tenantId", "codigo", "nombre", "descripcion", "esDelSistema", "permisos", "updatedAt")
SELECT
    gen_random_uuid(), t."id", 'administrativo', 'Administrativo',
    'Cobros, comprobantes y cuentas corrientes. Ve lo comercial pero no lo edita.',
    true,
    ARRAY[
        'panel.ver','comercial.ver','registros.ver','administracion.gestionar',
        'finanzas.ver_margenes'
    ]::TEXT[],
    CURRENT_TIMESTAMP
FROM "Tenant" t;

INSERT INTO "Rol" ("id", "tenantId", "codigo", "nombre", "descripcion", "esDelSistema", "permisos", "updatedAt")
SELECT
    gen_random_uuid(), t."id", 'operario', 'Operario',
    'La mesa de trabajo y su propio desempeño. No ve precios, costos ni clientes.',
    true,
    -- gestionar y no ver: el operario EJECUTA la producción (reclama pasos en
    -- la mesa, los completa). Lo acota el tablero, que sólo le deja el activo.
    ARRAY['produccion.gestionar']::TEXT[],
    CURRENT_TIMESTAMP
FROM "Tenant" t;

-- ── Backfill: cada membership al predefinido que corresponde a su enum ────
--
-- SUPERVISOR → jefe_produccion y no vendedor: es el que más se parece a lo que
-- un supervisor podía hacer hasta ahora (todo menos administración), así que
-- nadie pierde acceso que ya tenía. Si en realidad era un vendedor, el admin
-- lo cambia en un click; al revés —dejarlo sin ver costos de un día para el
-- otro— sería una sorpresa.
UPDATE "Membership" m
SET "rolId" = r."id"
FROM "Rol" r
WHERE r."tenantId" = m."tenantId"
  AND r."codigo" = CASE m."rol"
        WHEN 'ADMINISTRADOR' THEN 'administrador'
        WHEN 'SUPERVISOR'    THEN 'jefe_produccion'
        ELSE 'operario'
      END;
