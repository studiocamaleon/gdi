/* Operador de staging. No inicia Nest/cron ni envía mensajes. Cargar secretos
 * desde un archivo privado o el almacén de Fly; nunca pasarlos como argumentos. */
require('reflect-metadata');
async function main() {
  const u = new URL(process.env.DATABASE_URL || 'postgresql://localhost/no-configurada');
  const base = decodeURIComponent(u.pathname.slice(1));
  if (process.env.GRAFO_DEPLOY_ENV !== 'staging' ||
      base !== process.env.DEPLOY_DATABASE_NAME || base !== 'grafoprint_staging' ||
      ['localhost', '127.0.0.1', '::1'].includes(u.hostname))
    throw new Error('Este comando sólo admite la base de staging identificada explícitamente.');
  if (process.argv.length !== 3 || process.argv[2] !== '--activar')
    throw new Error('Para activar o renovar la generación usar --activar. No se envían mensajes.');
  const source = process.env.META_PRUEBA_SOURCE === 'true' ? '../../src' : '../../dist/src';
  const { PrismaService } = require(`${source}/prisma/prisma.service`);
  const { SecretosService } = require(`${source}/integraciones/cripto/secretos.service`);
  const { MetaConexionClient } = require(`${source}/integraciones/meta/meta-conexion.client`);
  const { MetaPruebaService } = require(`${source}/integraciones/meta/meta-prueba.service`);
  const { CapacidadesEmpresaService } = require(`${source}/suscripciones/capacidades-empresa.service`);
  const db = new PrismaService(), secretos = new SecretosService();
  try {
    secretos.onModuleInit();
    const resultado = await new MetaPruebaService(db, secretos, new MetaConexionClient(),
      new CapacidadesEmpresaService(db)).activar(process.env.META_INBOX_PRUEBA_ACCESS_TOKEN || '');
    console.log(JSON.stringify({ tipo: resultado.tipo, venceEl: resultado.venceEl, estado: 'ACTIVADO' }));
  } finally { await db.$disconnect(); }
}
main().catch(() => {
  // Prisma y fetch pueden incluir parámetros o URLs en sus errores. No imprimirlos.
  console.error('No se activó el canal. Revisar entorno, migraciones, plan, activos, vencimiento y envíos pendientes.');
  process.exitCode = 1;
});
