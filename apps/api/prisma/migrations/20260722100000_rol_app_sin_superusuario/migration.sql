-- Privilegios del rol de APLICACIÓN.
--
-- Hasta acá la API se conectaba como `postgres`, superusuario. Eso significa
-- que el aislamiento entre tenants dependía enteramente de la extensión de
-- Prisma, sin ninguna posibilidad de red a nivel base: un superusuario saltea
-- RLS por definición, así que aunque mañana se agreguen políticas no se
-- aplicarían y el trabajo sería invisible.
--
-- Reparto de roles:
--   grafo_app  → runtime de la API. DML, nada de DDL. Se conecta con
--                DATABASE_URL.
--   postgres   → migraciones. Se conecta con MIGRATE_DATABASE_URL (el
--                `directUrl` del datasource).
--
-- La CREACIÓN del rol no va acá: es una operación de cluster, no de base, y
-- lleva una contraseña que no puede vivir en el repo. Va documentada en
-- docs/rol-base-sin-superusuario.md. Esta migración sólo reparte privilegios,
-- y no hace nada si el rol todavía no existe — así un entorno que aún no
-- creó el rol no se rompe al desplegar.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafo_app') THEN
    RAISE NOTICE 'El rol grafo_app no existe todavía: se saltean los GRANT.';
    RETURN;
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO grafo_app', current_database());
  GRANT USAGE ON SCHEMA public TO grafo_app;

  -- DML sobre lo que ya existe. Sin TRUNCATE ni REFERENCES: la app no tiene
  -- por qué vaciar una tabla entera.
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grafo_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grafo_app;

  -- Y sobre lo que cree el migrador de acá en adelante: sin esto, cada tabla
  -- nueva quedaría invisible para la app hasta correr los GRANT a mano.
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grafo_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO grafo_app;

  -- Explícito, aunque sea el default: la app no crea ni altera tablas.
  REVOKE CREATE ON SCHEMA public FROM grafo_app;
END $$;
