import pg from 'pg';
import { S3Client, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { exigir, proceso } from './seguro.mjs';

// Sin permisos DML, DDL, ownership ni membresías que permitan asumir roles de escritura.
export async function validarLector(client) {
  const { rows: [r] } = await client.query(`
    SELECT r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls AS elevado,
      has_database_privilege(current_user, current_database(), 'CREATE') AS crea_base,
      EXISTS (SELECT FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
        AND has_schema_privilege(current_user, n.oid, 'CREATE')) AS crea_esquema,
      EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','f')
        AND (c.relowner=r.oid OR has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
          OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES'))) AS escribe,
      EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind='S'
          AND (c.relowner=r.oid OR has_sequence_privilege(current_user,c.oid,'USAGE,UPDATE'))) AS cambia_secuencia,
      EXISTS (SELECT FROM pg_roles otro WHERE otro.rolname NOT IN (current_user, 'pg_read_all_data')
        AND pg_has_role(current_user,otro.oid,'MEMBER')) AS miembro
    FROM pg_roles r WHERE r.rolname=current_user`);
  exigir(r && Object.values(r).every(v => v === false), 'El usuario de exportación tiene permisos excesivos.');
  // Rutinas SECURITY DEFINER de la aplicación permitirían escribir incluso con rol lector.
  const { rows: [p] } = await client.query(`SELECT EXISTS (
    SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
      AND p.prosecdef AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS ejecuta`);
  exigir(p && !p.ejecuta, 'El lector puede ejecutar funciones con privilegios elevados.');
}

export class OrigenPostgresR2 {
  constructor(config, { crearCliente = c => new pg.Client(c), s3, ejecutarDump = proceso } = {}) {
    this.c = config;
    this.crearCliente = crearCliente; this.ejecutarDump = ejecutarDump;
    exigir(/^https:\/\/[a-f0-9]{32}(?:\.us|\.eu)?\.r2\.cloudflarestorage\.com$/.test(config.r2Endpoint), 'Endpoint R2 inválido.');
    exigir(/^[a-z0-9][a-z0-9.-]+\.neon\.tech$/.test(config.pgHost) && !config.pgHost.includes('-pooler.'), 'Usar el host directo de Neon.');
    exigir(config.pgPort === 5432 && typeof config.pgDatabase === 'string' && typeof config.pgUser === 'string' &&
      typeof config.pgPassword === 'string' && config.pgPassword.length > 0, 'Falta acceso de lectura a PostgreSQL.');
    exigir(typeof config.r2Bucket === 'string' && typeof config.r2KeyId === 'string' && typeof config.r2Key === 'string', 'Falta acceso de lectura a R2.');
    exigir(/^[a-f0-9]{40}$/.test(config.revision) && Array.isArray(config.imagenes) && config.imagenes.length > 0 &&
      config.imagenes.every(v => typeof v === 'string' && /@sha256:[a-f0-9]{64}$/.test(v)) &&
      Array.isArray(config.idsClavesInternas) && config.idsClavesInternas.length > 0 &&
      config.idsClavesInternas.every(v => /^[a-zA-Z0-9._-]{1,100}$/.test(v)), 'Registrar revisión, imágenes inmutables e identificadores de claves bajo custodia.');
    this.s3 = s3 ?? new S3Client({ region: 'auto', endpoint: config.r2Endpoint, maxAttempts: 2,
      credentials: { accessKeyId: config.r2KeyId, secretAccessKey: config.r2Key }, followRegionRedirects: false });
  }
  async send(command, signal) {
    return this.s3.send(command, { abortSignal: AbortSignal.any([AbortSignal.timeout(15 * 60_000), signal]) });
  }
  async iniciar(signal) {
    const c = this.c;
    this.client = this.crearCliente({ host: c.pgHost, port: c.pgPort, database: c.pgDatabase, user: c.pgUser,
      password: c.pgPassword, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15_000,
      statement_timeout: 60_000, query_timeout: 75_000, application_name: 'grafoprint-respaldo' });
    // Evita errores no manejados si se corta la conexión mientras se copia R2.
    this.client.on('error', () => { this.errorConexion = true; });
    const abort = () => { void this.client.end().catch(() => {}); };
    signal.addEventListener('abort', abort, { once: true });
    let cerrado = false;
    const cerrar = async () => {
      if (cerrado) return; cerrado = true; signal.removeEventListener('abort', abort);
      await this.client.end();
    };
    try {
      await this.client.connect(); await validarLector(this.client);
      await this.client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const { rows: [snap] } = await this.client.query(`SELECT pg_export_snapshot() AS id,
        current_setting('server_version') AS version, current_database() AS base, transaction_timestamp() AS instante`);
      exigir(/^[a-fA-F0-9-]+$/.test(snap.id), 'Instantánea PostgreSQL inválida.');
      const { rows: requeridos } = await this.client.query(`
        SELECT key, bytes::text FROM "Archivo" WHERE estado IN ('LISTO','ELIMINADO')
        UNION ALL SELECT 'usuarios/' || id || '/perfil/' || "fotoPerfilVersion" || '.webp', NULL
        FROM "User" WHERE "fotoPerfilVersion" IS NOT NULL`);
      const { rows: estados } = await this.client.query(`SELECT estado, count(*)::text AS cantidad FROM "Archivo" GROUP BY estado`);
      const { rows: migraciones } = await this.client.query(`SELECT migration_name, checksum, finished_at, rolled_back_at
        FROM _prisma_migrations ORDER BY started_at, id`);
      exigir(migraciones.every(m => m.finished_at || m.rolled_back_at), 'Hay una migración incompleta; no publicar una copia completa.');
      const archivos = []; let token;
      const tokens = new Set();
      do {
        const page = await this.send(new ListObjectsV2Command({ Bucket: c.r2Bucket, MaxKeys: 1000, ContinuationToken: token }), signal);
        for (const item of page.Contents ?? []) {
          exigir(archivos.length < 100_000 && typeof item.ETag === 'string' && item.LastModified instanceof Date, 'Inventario R2 incompleto o demasiado grande.');
          archivos.push({ key: item.Key, bytes: item.Size, etag: item.ETag, modificado: item.LastModified.toISOString() });
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
        exigir(!page.IsTruncated || (token && !tokens.has(token)), 'Paginación R2 inválida.'); tokens.add(token);
      } while (token);
      return {
        archivos, requeridos: requeridos.map(r => ({ key: r.key, bytes: r.bytes === null ? null : Number(r.bytes) })), cerrar,
        metadata: { postgres: snap.version, base: snap.base, instante: snap.instante, migraciones, estadosArchivos: estados,
          revision: c.revision, imagenes: c.imagenes, idsClavesInternas: c.idsClavesInternas },
        exportar: async control => {
          exigir(!cerrado && !this.errorConexion, 'Se perdió la instantánea PostgreSQL.');
          const { child, fin } = this.ejecutarDump(c.pgDumpBin, ['--format=custom', '--no-owner', '--no-acl', '--lock-wait-timeout=30s', `--snapshot=${snap.id}`], {
            PGHOST: c.pgHost, PGPORT: String(c.pgPort), PGDATABASE: c.pgDatabase, PGUSER: c.pgUser,
            PGPASSWORD: c.pgPassword, PGSSLMODE: 'verify-full', PGSSLROOTCERT: 'system', PGCONNECT_TIMEOUT: '15',
            PGOPTIONS: '-c default_transaction_read_only=on',
          }, control);
          child.stdin.end();
          return { entrada: child.stdout, fin, cerrar: async () => { child.kill('SIGKILL'); await fin.catch(() => {}); } };
        },
      };
    } catch (error) { await cerrar().catch(() => {}); throw error; }
  }
  async abrir(a, signal) {
    const result = await this.send(new GetObjectCommand({ Bucket: this.c.r2Bucket, Key: a.key, IfMatch: a.etag }), signal);
    if (result.ETag !== a.etag || result.ContentLength !== a.bytes || result.LastModified?.toISOString() !== a.modificado || !result.Body) {
      result.Body?.destroy(); throw new Error('R2 cambió el archivo durante el respaldo.');
    }
    return result.Body;
  }
  async comprobar(a, signal) {
    const head = await this.send(new HeadObjectCommand({ Bucket: this.c.r2Bucket, Key: a.key, IfMatch: a.etag }), signal);
    exigir(head.ETag === a.etag && head.ContentLength === a.bytes && head.LastModified?.toISOString() === a.modificado, 'R2 cambió el archivo durante el respaldo.');
  }
  cerrar() { this.s3.destroy(); }
}
