const { client, databaseUrl, fail } = require('./target.cjs');

async function main() {
  const { url: appUrl } = databaseUrl('APP_DATABASE_URL');
  const { url: migrateUrl } = databaseUrl('MIGRATE_DATABASE_URL');
  if (appUrl.hostname !== migrateUrl.hostname || appUrl.port !== migrateUrl.port) {
    throw new Error('Para preparar el rol, ambas URLs deben apuntar al mismo endpoint directo.');
  }
  const role = decodeURIComponent(appUrl.username);
  const password = decodeURIComponent(appUrl.password);
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(role) || ['postgres', 'grafo_app'].includes(role)) {
    throw new Error('Elegir un nombre exclusivo, por ejemplo grafoprint_staging_app.');
  }
  if (password.length < 24) throw new Error('La clave del rol requiere al menos 24 caracteres.');
  const prisma = client('MIGRATE_DATABASE_URL');
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7024092401::bigint)`;
      const [current] = await tx.$queryRaw`SELECT current_user AS name`;
      if (current.name === role) throw new Error('Migrador y ejecución deben ser roles distintos.');
      const existing = await tx.$queryRaw`
        SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin
        FROM pg_roles WHERE rolname = ${role}`;
      if (existing.length) {
        const r = existing[0];
        const memberships = await tx.$queryRaw`
          SELECT 1 FROM pg_auth_members WHERE member = (SELECT oid FROM pg_roles WHERE rolname = ${role})`;
        const owns = await tx.$queryRaw`
          SELECT 1 FROM pg_class WHERE relowner = (SELECT oid FROM pg_roles WHERE rolname = ${role})
          UNION ALL SELECT 1 FROM pg_namespace WHERE nspowner = (SELECT oid FROM pg_roles WHERE rolname = ${role})
          UNION ALL SELECT 1 FROM pg_database WHERE datdba = (SELECT oid FROM pg_roles WHERE rolname = ${role})`;
        if (r.rolsuper || r.rolcreatedb || r.rolcreaterole || r.rolbypassrls || !r.rolcanlogin || memberships.length || owns.length) {
          throw new Error('El rol existente tiene propiedad, membresías o privilegios incompatibles.');
        }
      } else {
        const [statement] = await tx.$queryRaw`
          SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS', ${role}::text, ${password}::text) AS sql`;
        await tx.$executeRawUnsafe(statement.sql);
      }
      const [grant] = await tx.$queryRaw`
        SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), ${role}::text) AS sql`;
      await tx.$executeRawUnsafe(grant.sql);
      await tx.$executeRawUnsafe('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
      const statements = [
        `GRANT USAGE ON SCHEMA public TO "${role}"`,
        `REVOKE CREATE ON SCHEMA public FROM "${role}"`,
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`,
        `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`,
        // Sin FOR ROLE postgres: las tablas futuras las crea el migrador real.
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${role}"`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${role}"`,
        `REVOKE ALL ON TABLE public._prisma_migrations FROM "${role}"`,
      ];
      for (const sql of statements) await tx.$executeRawUnsafe(sql);
    }, { timeout: 30000 });
  } finally { await prisma.$disconnect(); }
  const runtime = client('APP_DATABASE_URL');
  try {
    await runtime.$queryRaw`SELECT 1`;
    const [access] = await runtime.$queryRaw`
      SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS ddl,
             has_table_privilege(current_user, 'public."User"', 'INSERT') AS dml`;
    if (access.ddl || !access.dml) throw new Error('Los permisos efectivos no son los esperados.');
  } finally { await runtime.$disconnect(); }
  console.log('Rol de ejecución comprobado: acceso de datos sin creación de tablas.');
}

main().catch(fail);
