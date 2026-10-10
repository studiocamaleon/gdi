import { validarLector } from './origen.mjs';

// Aprovisionamiento puntual con el dueño de la base. El ejecutor de copias NO usa este acceso.
// Sólo crea un rol nuevo; no altera credenciales ni permisos de roles existentes.
export async function crearLectorPostgres(client, { database, owner, role, password }) {
  for (const id of [database, owner, role]) {
    if (!/^[a-z][a-z0-9_]{2,62}$/.test(id)) throw new Error('Identificador de base o rol inválido.');
  }
  if (role === owner || !/^[A-Za-z0-9_-]{48,128}$/.test(password)) throw new Error('Credencial nueva inválida.');
  await client.query('BEGIN');
  try {
    const { rows: [actual] } = await client.query('SELECT current_database() AS db, current_user AS usuario');
    if (actual.db !== database || actual.usuario !== owner) throw new Error('La base o el dueño no coincide con el destino esperado.');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`grafoprint-respaldo:${role}`]);
    if ((await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) {
      throw new Error('El rol ya existe; revisar su configuración sin rotar ni ampliar accesos.');
    }
    const { rows: [ajenos] } = await client.query(`SELECT EXISTS (
      SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
      WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
        AND c.relkind IN ('r','p','v','m','f','S') AND (n.nspname <> 'public' OR r.rolname <> $1)) AS hay`, [owner]);
    if (ajenos.hay) throw new Error('Hay objetos de otros esquemas o dueños; revisar los permisos antes de continuar.');
    await client.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3`);
    await client.query(`ALTER ROLE "${role}" SET default_transaction_read_only = on`);
    await client.query(`GRANT CONNECT ON DATABASE "${database}" TO "${role}"`);
    await client.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`);
    await client.query(`GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${owner}" IN SCHEMA public GRANT SELECT ON TABLES TO "${role}"`);
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${owner}" IN SCHEMA public GRANT SELECT ON SEQUENCES TO "${role}"`);
    // PostgreSQL 16 permite crear roles sin poder asumirlos. Autorizar SET sólo
    // durante esta transacción para comprobar privilegios y revocarlo al terminar.
    await client.query(`GRANT "${role}" TO "${owner}" WITH INHERIT FALSE, SET TRUE`);
    await client.query(`SET LOCAL ROLE "${role}"`);
    await validarLector(client);
    await client.query('RESET ROLE');
    await client.query(`REVOKE "${role}" FROM "${owner}"`);
    await client.query('COMMIT');
    return { creado: true, soloLectura: true, tablasFuturas: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}
