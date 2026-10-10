import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import pg from 'pg';
import { OrigenPostgresR2, validarLector } from './lib/origen.mjs';
import { DestinoB2 } from './lib/b2.mjs';
import { respaldar, prepararRecuperacion } from './lib/motor.mjs';
import { leerPrivado, proceso } from './lib/seguro.mjs';

// Opt-in: utiliza sólo un PostgreSQL local existente, nunca crea/reinicia contenedores.
// Todos los objetos SQL se crean con prefijo aleatorio y se eliminan en finally.
const habilitado = process.env.ENSAYO_POSTGRES === '1' && process.env.ENSAYO_AGE_BIN && process.env.ENSAYO_AGE_KEYGEN;
test('instantánea PostgreSQL real, rol lector, cifrado y restauración aislada', { skip: !habilitado, timeout: 180_000 }, async t => {
  const suffix = randomBytes(6).toString('hex');
  const source = `qa_backup_${suffix}_origen`; const target = `qa_backup_${suffix}_destino`; const role = `qa_backup_${suffix}_lector`;
  const pass = randomBytes(24).toString('hex');
  const conect = database => new pg.Client({ host: '127.0.0.1', port: 5436, user: 'postgres', password: 'postgres', database });
  const admin = conect('postgres'); await admin.connect();
  const carpeta = await mkdtemp(join(await realpath(tmpdir()), 'grafo-pg-backup-'));
  let db; let restaurada; const creadas = []; let rolCreado = false;
  const objetos = new Map([
    ['t/empresa-a/archivo.pdf', Buffer.from('%PDF-1.4 documento ficticio de empresa A')],
    ['t/empresa-b/archivo.pdf', Buffer.from('%PDF-1.4 documento ficticio de empresa B')],
    ['usuarios/demo/perfil/foto.webp', Buffer.from('imagen ficticia')],
    ['sistema/qr-prueba.png', Buffer.from('QR ficticio fuera de Archivo')],
  ]);
  const head = key => {
    const content = objetos.get(key); assert.ok(content);
    return { Key: key, Size: content.length, ContentLength: content.length,
      ETag: `"${createHash('md5').update(content).digest('hex')}"`, LastModified: new Date('2026-01-01T00:00:00Z') };
  };
  let modificado = false;
  const s3 = { destroy() {}, async send(command) {
    if (command.constructor.name === 'ListObjectsV2Command') {
      // La escritura posterior no debe entrar al dump de la instantánea anterior.
      if (!modificado) { modificado = true; await db.query(`INSERT INTO "Documento" VALUES ('posterior','empresa-a','fuera del punto de recuperación')`); }
      return { Contents: [...objetos.keys()].map(head), IsTruncated: false };
    }
    const h = head(command.input.Key); assert.equal(command.input.IfMatch, h.ETag);
    return { ...h, ...(command.constructor.name === 'GetObjectCommand' ? { Body: Readable.from([objetos.get(command.input.Key)]) } : {}) };
  } };
  try {
    await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${pass}'`); rolCreado = true;
    for (const database of [source, target]) {
      assert.match(database, /^qa_backup_[a-f0-9]{12}_(origen|destino)$/);
      await admin.query(`CREATE DATABASE "${database}"`); creadas.push(database);
    }
    db = conect(source); await db.connect();
    await db.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      CREATE TABLE "Archivo" (key text PRIMARY KEY, bytes bigint, estado text);
      CREATE TABLE "User" (id text PRIMARY KEY, "fotoPerfilVersion" text);
      CREATE TABLE "Documento" (id text PRIMARY KEY, "tenantId" text, contenido text);
      CREATE SEQUENCE secuencia_ficticia;
      CREATE TABLE _prisma_migrations (id text, migration_name text, checksum text, started_at timestamptz, finished_at timestamptz, rolled_back_at timestamptz);
      INSERT INTO "Documento" VALUES ('doc-a','empresa-a','dato ficticio A'),('doc-b','empresa-b','dato ficticio B');
      INSERT INTO "User" VALUES ('demo','foto');
      INSERT INTO _prisma_migrations VALUES ('1','inicial','checksum-ficticio',now(),now(),NULL);
      GRANT USAGE ON SCHEMA public TO "${role}";
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}";`);
    await db.query(`GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
    for (const key of [...objetos.keys()].slice(0, 2)) await db.query('INSERT INTO "Archivo" VALUES ($1,$2,$3)', [key, objetos.get(key).length, 'LISTO']);
    // Privilegios efectivos: rechazo demostrado en PostgreSQL, no sólo con mocks.
    await assert.rejects(validarLector(db), /excesivos/);
    const lector = new pg.Client({ host: '127.0.0.1', port: 5436, user: role, password: pass, database: source });
    await lector.connect();
    try {
      await validarLector(lector);
      await assert.rejects(lector.query(`INSERT INTO "Documento" VALUES ('no','no','no')`), { code: '42501' });
      await db.query(`GRANT UPDATE(contenido) ON "Documento" TO "${role}"`);
      await assert.rejects(validarLector(lector), /excesivos/);
      await db.query(`REVOKE UPDATE(contenido) ON "Documento" FROM "${role}"`);
      await db.query(`GRANT USAGE ON SEQUENCE secuencia_ficticia TO "${role}"`);
      await assert.rejects(validarLector(lector), /excesivos/);
      await db.query(`REVOKE USAGE ON SEQUENCE secuencia_ficticia FROM "${role}"`);
      await db.query(`CREATE FUNCTION public.test_escritura() RETURNS void LANGUAGE sql SECURITY DEFINER AS 'SELECT';`);
      await assert.rejects(validarLector(lector), /funciones/);
      await db.query('DROP FUNCTION public.test_escritura()');
      await validarLector(lector);
    } finally { await lector.end(); }
    const config = { r2Endpoint: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`, r2Bucket: 'ficticio', r2KeyId: 'ficticio', r2Key: 'ficticio',
      pgHost: 'ep-ficticio.us-east-2.aws.neon.tech', pgPort: 5432, pgDatabase: source, pgUser: role, pgPassword: pass,
      pgDumpBin: '/usr/bin/pg_dump', revision: 'a'.repeat(40), imagenes: [`demo@sha256:${'b'.repeat(64)}`], idsClavesInternas: ['ficticia-v1'] };
    const origen = new OrigenPostgresR2(config, { s3,
      crearCliente: () => new pg.Client({ host: '127.0.0.1', port: 5436, user: role, password: pass, database: source }),
      ejecutarDump: (_bin, args, env, signal) => proceso('/usr/local/bin/docker', ['exec', '--env', 'PGPASSWORD', 'gdi-saas-postgres',
        'pg_dump', '-h', '127.0.0.1', '-U', role, '-d', source, ...args], { PGPASSWORD: env.PGPASSWORD, DOCKER_CONFIG: `${process.env.HOME}/.docker` }, signal),
    });
    const ageBin = process.env.ENSAYO_AGE_BIN;
    const identidad = join(carpeta, 'ficticia.agekey');
    execFileSync(process.env.ENSAYO_AGE_KEYGEN, ['-o', identidad], { stdio: 'ignore' });
    const recipient = execFileSync(process.env.ENSAYO_AGE_KEYGEN, ['-y', identidad], { encoding: 'utf8' }).trim();
    // Sin esta variable NO se contacta B2. Si se habilita, sólo se suben estos datos ficticios.
    const remoto = process.env.ENSAYO_B2_CONFIG;
    const blobs = new Map();
    const destino = remoto ? new DestinoB2(await leerPrivado(remoto), { signal: AbortSignal.timeout(150_000) }) : {
      async iniciar() {},
      async subir(path, fileName, h, hasta) { const fileId = randomBytes(16).toString('hex'); blobs.set(fileId, { bytes: await readFile(path), hasta }); return { ...h, fileName, fileId }; },
      async proteger(ref, hasta) { blobs.get(ref.fileId).hasta = hasta; },
      async descargar(ref) { return Readable.from([blobs.get(ref.fileId).bytes]); },
    };
    const opciones = { origen, destino, carpeta, ageBin, recipient, entorno: 'staging', identidadOrigen: source, maxBytes: 1024 * 1024, ensayo: true };
    const primera = await respaldar(opciones);
    assert.equal(primera.cantidadArchivos, 4);
    const segunda = await respaldar(opciones); assert.equal(segunda.reutilizados, 4);
    const restauracion = await prepararRecuperacion({ destino, recibo: primera.recibo, carpeta, ageBin, identidad });
    execFileSync('/usr/local/bin/docker', ['exec', '-i', 'gdi-saas-postgres', 'pg_restore', '-U', 'postgres', '-d', target,
      '--no-owner', '--no-acl', '--exit-on-error'], { input: await readFile(join(restauracion.carpeta, 'base.dump')), stdio: ['pipe', 'pipe', 'pipe'] });
    restaurada = conect(target); await restaurada.connect();
    assert.deepEqual((await restaurada.query('SELECT * FROM "Documento" ORDER BY id')).rows, [
      { id: 'doc-a', tenantId: 'empresa-a', contenido: 'dato ficticio A' }, { id: 'doc-b', tenantId: 'empresa-b', contenido: 'dato ficticio B' },
    ]);
    const mapa = await leerPrivado(join(restauracion.carpeta, 'archivos-verificados.json'));
    for (const m of mapa) assert.deepEqual(await readFile(join(restauracion.carpeta, m.archivo)), objetos.get(m.key));
    assert.equal((await restaurada.query('SELECT count(*)::int AS n FROM _prisma_migrations')).rows[0].n, 1);
    t.diagnostic(JSON.stringify({ baseConsistente: true, empresasFicticias: 2, archivos: 4, migraciones: true, rolLectorProbado: true,
      cifrado: 'age', b2Real: Boolean(remoto), copias: 2, reutilizadosSegundaCopia: 4, copiaStagingReal: false, sistemaCompletoRestaurado: false }));
    origen.cerrar();
  } finally {
    await db?.end(); await restaurada?.end();
    for (const database of creadas) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    if (rolCreado) await admin.query(`DROP ROLE "${role}"`);
    await admin.end(); await rm(carpeta, { recursive: true, force: true });
  }
});
