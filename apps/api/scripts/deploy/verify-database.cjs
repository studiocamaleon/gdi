// Ensayo destructible exclusivamente sobre una base sintética terminada en _test.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { client, databaseUrl, fail } = require('./target.cjs');
const { bootstrapAdmin } = require('./bootstrap-admin.cjs');

async function main() {
  databaseUrl('MIGRATE_DATABASE_URL');
  databaseUrl('APP_DATABASE_URL');
  if (!process.env.DEPLOY_DATABASE_NAME.endsWith('_test')) throw new Error('Sólo bases de ensayo.');
  const migrator = client('MIGRATE_DATABASE_URL');
  const runtime = client('APP_DATABASE_URL');
  const suffix = randomUUID().replaceAll('-', '');
  const table = `deploy_test_${suffix}`;
  const email = `deploy-${suffix}@example.invalid`;
  try {
    // Una instalación nueva necesita el catálogo global, sin datos de empresas demo.
    assert.ok(await runtime.materialPreset.count() >= 112, 'Falta la biblioteca base.');
    assert.ok(await runtime.materialPresetVariante.count() >= 720, 'Faltan variantes del catálogo.');
    const tornillo = await runtime.materialPreset.findUniqueOrThrow({ where: { key: 'TORNILLO_AUTOPERFORANTE_T1' } });
    assert.equal(tornillo.id, 'cc71748e-4804-4147-b6ea-a59dd85ec091');
    assert.equal(tornillo.orden, 901, 'La migración de catálogo no debe sobreescribir el registro existente.');
    for (const key of ['PVC_ESPUMADO', 'PAPEL_OBRA', 'TINTA_UV_CMYK']) {
      const material = await runtime.materialPreset.findUniqueOrThrow({ where: { key }, include: { variantes: true } });
      assert.ok(material.variantes.length > 0, `Sin variantes: ${key}`);
    }
    assert.equal(await runtime.materiaPrima.count(), 0, 'El catálogo no debe instalar materiales en empresas.');
    console.log('OK: biblioteca global completa, referencias existentes conservadas y sin materiales de tenant.');
    const [admin] = await runtime.user.findMany({ where: { rolPlataforma: 'ADMIN', activo: true } });
    assert.ok(admin?.passwordHash, 'Debe haberse ejecutado bootstrap antes del ensayo.');
    assert.equal(await bootstrapAdmin(runtime, {
      email: admin.email, name: 'No reemplazar', password: randomUUID(),
    }), 'sin cambios');
    const unchanged = await runtime.user.findUnique({ where: { id: admin.id } });
    assert.equal(unchanged.passwordHash, admin.passwordHash);
    assert.equal(unchanged.nombreCompleto, admin.nombreCompleto);
    await assert.rejects(bootstrapAdmin(runtime, { email, name: 'Segundo admin', password: randomUUID() }));
    await runtime.user.create({ data: { email, nombreCompleto: 'Ensayo sin privilegios' } });
    await assert.rejects(bootstrapAdmin(runtime, { email, name: 'No elevar', password: randomUUID() }));
    assert.equal((await runtime.user.findUnique({ where: { email } })).rolPlataforma, null);
    await runtime.user.update({ where: { email }, data: { rolPlataforma: 'ADMIN', activo: false } });
    await assert.rejects(bootstrapAdmin(runtime, { email, name: 'No reactivar', password: randomUUID() }));
    assert.equal((await runtime.user.findUnique({ where: { email } })).activo, false);

    const denied = (error) => error?.meta?.code === '42501';
    await assert.rejects(runtime.$executeRawUnsafe(`CREATE TABLE public."${table}" (id int)`), denied);
    await assert.rejects(runtime.$queryRawUnsafe('SELECT id FROM public._prisma_migrations LIMIT 1'), denied);
    await migrator.$executeRawUnsafe(`CREATE TABLE public."${table}" (id serial PRIMARY KEY, value text)`);
    await runtime.$executeRawUnsafe(`INSERT INTO public."${table}" (value) VALUES ('ensayo')`);
    assert.equal((await runtime.$queryRawUnsafe(`SELECT value FROM public."${table}"`))[0].value, 'ensayo');
    await runtime.$executeRawUnsafe(`UPDATE public."${table}" SET value = 'actualizado'`);
    await runtime.$executeRawUnsafe(`DELETE FROM public."${table}"`);
    console.log('OK: bootstrap idempotente, sin elevación; DDL e historial denegados; DML y tablas futuras permitidos.');
  } finally {
    await runtime.user.deleteMany({ where: { email } });
    await migrator.$executeRawUnsafe(`DROP TABLE IF EXISTS public."${table}"`);
    await Promise.all([runtime.$disconnect(), migrator.$disconnect()]);
  }
}

main().catch(fail);
