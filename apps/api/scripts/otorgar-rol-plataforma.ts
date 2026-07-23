/**
 * Otorga (o revoca) el rol de CONTROL PLANE a un usuario, y deja el rastro en
 * PlataformaEvento. Es el alta del primer admin: no hay UI que otorgue roles
 * hasta que exista un admin que la use (docs/control-plane-diseno.md).
 *
 * Uso:
 *   npx ts-node -T scripts/otorgar-rol-plataforma.ts correo@empresa.com ADMIN
 *   npx ts-node -T scripts/otorgar-rol-plataforma.ts correo@empresa.com SOPORTE
 *   npx ts-node -T scripts/otorgar-rol-plataforma.ts correo@empresa.com --revocar
 */
import { PrismaClient, RolPlataforma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [email, rolArg] = process.argv.slice(2);
  if (!email) {
    console.error('Falta el email. Ver el encabezado del script.');
    process.exit(1);
  }
  const revocar = rolArg === '--revocar';
  const rol = revocar
    ? null
    : rolArg === 'SOPORTE'
      ? RolPlataforma.SOPORTE
      : RolPlataforma.ADMIN;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, rolPlataforma: true },
  });
  if (!user) {
    console.error(`No existe un usuario con email ${email}.`);
    process.exit(1);
  }
  if (user.rolPlataforma === rol) {
    console.log(`Sin cambios: ${email} ya tiene rol ${rol ?? 'ninguno'}.`);
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { rolPlataforma: rol },
    }),
    prisma.plataformaEvento.create({
      data: {
        // El actor es el propio afectado: este script corre por fuera de la
        // consola (bootstrap). Cuando el rol lo otorgue un ADMIN desde la UI,
        // el actor será él.
        staffUserId: user.id,
        tipo: revocar ? 'rol_revocado' : 'rol_otorgado',
        descripcion: revocar
          ? `Rol de plataforma revocado a ${email} (por script).`
          : `Rol ${rol} otorgado a ${email} (por script).`,
        datosJson: { anterior: user.rolPlataforma, nuevo: rol },
      },
    }),
  ]);
  console.log(
    revocar
      ? `Listo: ${email} ya no tiene rol de plataforma.`
      : `Listo: ${email} ahora es ${rol} de la plataforma.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
