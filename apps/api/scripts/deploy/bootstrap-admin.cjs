const bcrypt = require('bcryptjs');
const { client, fail } = require('./target.cjs');

async function bootstrapAdmin(prisma, { email, name, password }) {
  email = email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name?.trim() ||
      typeof password !== 'string' || password.length < 16 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Se requieren email, nombre y clave de al menos 16 caracteres y hasta 72 bytes.');
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7024092402::bigint)`;
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.rolPlataforma !== 'ADMIN' || !existing.activo) {
        throw new Error('No se eleva ni reactiva un usuario existente mediante bootstrap.');
      }
      return 'sin cambios';
    }
    if (await tx.user.count({ where: { rolPlataforma: 'ADMIN' } })) {
      throw new Error('Ya existe un administrador: gestionar otros usuarios desde Plataforma.');
    }
    const user = await tx.user.create({ data: {
      email, nombreCompleto: name.trim(), passwordHash: await bcrypt.hash(password, 12),
      rolPlataforma: 'ADMIN', activo: true, debeCambiarPassword: true,
    } });
    await tx.plataformaEvento.create({ data: {
      staffUserId: user.id, tipo: 'rol_otorgado',
      descripcion: 'Administrador inicial creado mediante bootstrap de despliegue.',
      datosJson: { origen: 'bootstrap', nuevo: 'ADMIN' },
    } });
    return 'creado';
  }, { timeout: 15000 });
}

async function main() {
  const prisma = client('DATABASE_URL');
  try {
    const result = await bootstrapAdmin(prisma, {
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      name: process.env.BOOTSTRAP_ADMIN_NAME,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    });
    console.log(`Administrador inicial: ${result}. No se modificaron planes, empresas ni contraseñas existentes.`);
  } finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch(fail);
module.exports = { bootstrapAdmin };
