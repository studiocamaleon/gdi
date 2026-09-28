const { PrismaClient } = require('@prisma/client');

function databaseUrl(variable) {
  const expected = process.env.DEPLOY_DATABASE_NAME;
  const value = process.env[variable];
  if (!expected || !value) throw new Error(`Faltan DEPLOY_DATABASE_NAME o ${variable}.`);
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Protocolo de base inválido.');
  if (decodeURIComponent(url.pathname.slice(1)) !== expected) {
    throw new Error('La base de la conexión no coincide con DEPLOY_DATABASE_NAME.');
  }
  if ((url.searchParams.get('schema') || 'public') !== 'public') {
    throw new Error('Estos comandos requieren el esquema public.');
  }
  return { value, url };
}

function client(variable) {
  return new PrismaClient({ datasources: { db: { url: databaseUrl(variable).value } } });
}

// Evitar imprimir consultas, credenciales o URLs que Prisma incluya en un error.
function fail(error) {
  const code = typeof error?.code === 'string' ? error.code : 'configuración/operación';
  console.error(`No se completó la operación (${code}). Revisar destino, permisos y variables requeridas.`);
  process.exitCode = 1;
}

module.exports = { databaseUrl, client, fail };
