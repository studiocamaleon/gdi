const assert = require('node:assert/strict');
const { mkdtemp, realpath, writeFile, rm } = require('node:fs/promises');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');

// Resolver la dependencia que usa Prisma, incluso si npm deja varias versiones.
// El override puntual de @prisma/config evita GHSA-ggr8-5vv4-36mx sin cambiar
// de versión mayor de Prisma. Repetir estos casos y el ensayo de migraciones
// cuando Prisma incorpore la corrección y se pueda retirar el override.
// Effect 3.22.1 corrige GHSA-7589-6fvf-x4pw; el subproceso acota la regresión.
const prismaRequire = createRequire(require.resolve('prisma/package.json'));
const configPath = prismaRequire.resolve('@prisma/config');
const configRequire = createRequire(configPath);
const { deepmerge, deepmergeInto } = configRequire('deepmerge-ts');
const { loadConfigFromFile } = require(configPath);

test('una plantilla de Effect rechaza texto ambiguo sin bloquear el proceso', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const S = createRequire(process.argv[1])('effect/Schema');
    const acepta = S.is(S.TemplateLiteral(S.String, ':', S.String, ':', S.String, 'X'));
    assert.equal(acepta('empresa:ficticia:pruebaX'), true);
    assert.equal(acepta(':'.repeat(5000)), false);
  `, configPath], { timeout: 3000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('la mezcla de configuración admite ciclos sin agotar la pila', () => {
  const left = { left: true };
  const right = { right: true };
  left.self = left;
  right.self = right;
  const result = deepmerge(left, right);
  assert.equal(result.left, true);
  assert.equal(result.right, true);
  assert.equal(result.self, result);
});

test('la mezcla sobre un destino admite ciclos sin agotar la pila', () => {
  const target = { left: true };
  const source = { right: true };
  target.self = target;
  source.self = source;
  assert.doesNotThrow(() => deepmergeInto(target, source));
  assert.equal(target.right, true);
});

test('la configuración ordinaria conserva rutas, opciones y entradas sin mutarlas', () => {
  const left = { schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' } };
  const right = { migrations: { seed: 'node prisma/seed.js' }, tables: { external: ['audit'] } };
  const before = structuredClone([left, right]);
  assert.deepEqual(deepmerge(left, right), {
    schema: 'prisma/schema.prisma',
    migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.js' },
    tables: { external: ['audit'] },
  });
  assert.deepEqual([left, right], before);
});

test('Prisma puede cargar su configuración con la dependencia actualizada', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'grafo-prisma-config-')));
  try {
    await writeFile(join(directory, 'prisma.config.js'),
      "module.exports = { schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.js' } };\n");
    const result = await loadConfigFromFile({ configRoot: directory });
    assert.equal(result.error, undefined);
    assert.equal(result.config.schema, join(directory, 'prisma/schema.prisma'));
    assert.equal(result.config.migrations.path, join(directory, 'prisma/migrations'));
    assert.equal(result.config.migrations.seed, 'node prisma/seed.js');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
