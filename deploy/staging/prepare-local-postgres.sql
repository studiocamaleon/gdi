-- Sólo PostgreSQL desechable de compose.yaml. Nunca ejecutar en Neon.
-- Separar el superusuario inicial (OID 10, que no admite NOSUPERUSER) del
-- dueño que ejecutará las migraciones, como ocurre en una base administrada.
DO $$
BEGIN
  IF current_database() <> 'grafoprint_staging_test' THEN
    RAISE EXCEPTION 'Este script sólo admite la base de ensayo local';
  END IF;
END $$;
\getenv migrator_password POSTGRES_PASSWORD
SELECT format('CREATE ROLE grafoprint_migrator LOGIN PASSWORD %L NOSUPERUSER CREATEROLE CREATEDB NOBYPASSRLS NOREPLICATION', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafoprint_migrator')
\gexec
ALTER DATABASE grafoprint_staging_test OWNER TO grafoprint_migrator;
ALTER SCHEMA public OWNER TO grafoprint_migrator;
