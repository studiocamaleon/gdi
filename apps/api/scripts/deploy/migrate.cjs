const { spawnSync } = require('node:child_process');
const { databaseUrl, fail } = require('./target.cjs');

try {
  const { value } = databaseUrl('MIGRATE_DATABASE_URL');
  // Exige la variable explícita; la imagen de despliegue no incluye archivos .env.
  const result = spawnSync(process.execPath, [
    'node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma',
  ], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: value, MIGRATE_DATABASE_URL: value },
  });
  if (result.error || result.signal) throw new Error('El proceso de migración no terminó.');
  process.exitCode = result.status ?? 1;
} catch (error) { fail(error); }
