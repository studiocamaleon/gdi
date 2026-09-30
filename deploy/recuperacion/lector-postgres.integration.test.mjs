import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { crearLectorPostgres } from './lib/lector-postgres.mjs';
import { validarLector } from './lib/origen.mjs';

test('aprovisionar lector: sólo lectura presente y futura, sin rotación ni permisos heredados',
  { skip: process.env.ENSAYO_POSTGRES !== '1', timeout: 60_000 }, async () => {
    const prefijo = `qa_backup_${randomBytes(6).toString('hex')}`;
    const database = `${prefijo}_lector`, role = `${prefijo}_rol`, owner = `${prefijo}_owner`, pass = randomBytes(48).toString('base64url');
    const cfg = { host: '127.0.0.1', port: 5436, user: 'postgres', password: 'postgres', connectionTimeoutMillis: 5000 };
    const admin = new pg.Client({ ...cfg, database: 'postgres' });
    let db, lector, dbCreada = false, ownerCreado = false;
    await admin.connect();
    try {
      await admin.query(`CREATE ROLE "${owner}" LOGIN CREATEROLE PASSWORD '${pass}'`); ownerCreado = true;
      await admin.query(`CREATE DATABASE "${database}" OWNER "${owner}"`); dbCreada = true;
      db = new pg.Client({ ...cfg, database, user: owner, password: pass }); await db.connect();
      await db.query('CREATE TABLE ejemplo (id int, contenido text); INSERT INTO ejemplo VALUES (1,\'ficticio\'); CREATE SEQUENCE secuencia');
      const config = { database, owner, role, password: pass };
      await assert.rejects(crearLectorPostgres(db, { ...config, database: 'otro_destino' }), /destino esperado/);
      await assert.rejects(crearLectorPostgres(db, { ...config, role: 'mal\"rol' }), /inválido/);
      // Un CREATE heredado de PUBLIC debe abortar todo, sin modificar PUBLIC ni dejar un rol a medias.
      await db.query('GRANT CREATE ON SCHEMA public TO PUBLIC');
      await assert.rejects(crearLectorPostgres(db, config), /permisos excesivos/);
      assert.equal((await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount, 0);
      await db.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
      assert.deepEqual(await crearLectorPostgres(db, config), { creado: true, soloLectura: true, tablasFuturas: true });
      assert.equal((await db.query("SELECT pg_has_role(current_user,$1,'SET') AS permitido", [role])).rows[0].permitido, false);
      await assert.rejects(crearLectorPostgres(db, { ...config, password: randomBytes(48).toString('base64url') }), /ya existe/);
      lector = new pg.Client({ ...cfg, database, user: role, password: pass }); await lector.connect();
      assert.equal((await lector.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only, 'on');
      await validarLector(lector);
      assert.equal((await lector.query('SELECT contenido FROM ejemplo')).rows[0].contenido, 'ficticio');
      // Incluso quitando la preferencia READ ONLY, los permisos reales deben impedir escritura.
      await lector.query('SET default_transaction_read_only = off');
      for (const sql of ["INSERT INTO ejemplo VALUES (2,'no')", "UPDATE ejemplo SET contenido='no'", 'DELETE FROM ejemplo',
        'TRUNCATE ejemplo', 'CREATE TABLE public.no_permitida (id int)', "SELECT nextval('secuencia')"]) {
        await assert.rejects(lector.query(sql), { code: '42501' });
      }
      await db.query('CREATE TABLE futura (id int); INSERT INTO futura VALUES (7); CREATE SEQUENCE futura_secuencia');
      assert.equal((await lector.query('SELECT id FROM futura')).rows[0].id, 7);
      await lector.query('SELECT last_value FROM futura_secuencia');
      await assert.rejects(lector.query("SELECT nextval('futura_secuencia')"), { code: '42501' });
      await validarLector(lector);
    } finally {
      await lector?.end().catch(() => {}); await db?.end().catch(() => {});
      if (dbCreada) await admin.query(`DROP DATABASE "${database}"`);
      await admin.query(`DROP ROLE IF EXISTS "${role}"`);
      if (ownerCreado) await admin.query(`DROP ROLE "${owner}"`);
      await admin.end();
    }
  });
