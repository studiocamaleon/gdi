import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, type InvitacionPlataforma } from '@prisma/client';
import { createHash } from 'node:crypto';

export const hashInvitacionEquipo = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const ERROR_INVITACION_EQUIPO =
  'La invitación no está disponible: venció, fue cancelada o ya se aceptó. Pedí un nuevo enlace al equipo de Grafo.';

export async function invitacionEquipoValida(
  db: Prisma.TransactionClient,
  where: Prisma.InvitacionPlataformaWhereUniqueInput,
) {
  const invitacion = await db.invitacionPlataforma.findUnique({
    where,
    include: { invitador: { select: { activo: true, rolPlataforma: true } } },
  });
  if (
    !invitacion ||
    invitacion.revocadaEl ||
    invitacion.aceptadaEl ||
    invitacion.venceEl <= new Date() ||
    !invitacion.invitador.activo ||
    invitacion.invitador.rolPlataforma !== 'ADMIN'
  )
    throw new BadRequestException(ERROR_INVITACION_EQUIPO);
  return invitacion;
}

/** Invocar con la identidad bloqueada. El UPDATE condicional consume el enlace una sola vez. */
export async function aceptarRolInvitado(
  tx: Prisma.TransactionClient,
  invitacion: InvitacionPlataforma,
  userId: string,
) {
  const vigente = await invitacionEquipoValida(tx, { id: invitacion.id });
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.activo || user.email !== vigente.email || user.rolPlataforma)
    throw new ConflictException(
      'La cuenta ya tiene acceso o cambió. Consultá al administrador de Plataforma.',
    );
  const resultado = await tx.invitacionPlataforma.updateMany({
    where: {
      id: vigente.id,
      aceptadaEl: null,
      revocadaEl: null,
      venceEl: { gt: new Date() },
    },
    data: { aceptadaEl: new Date(), aceptadaPorId: user.id },
  });
  if (resultado.count !== 1)
    throw new BadRequestException(ERROR_INVITACION_EQUIPO);
  const actualizado = await tx.user.update({
    where: { id: user.id },
    data: { rolPlataforma: vigente.rol },
  });
  await tx.plataformaEvento.create({
    data: {
      staffUserId: user.id,
      tipo: 'equipo_invitacion_aceptada',
      descripcion: `${user.email} aceptó la invitación al equipo con rol ${vigente.rol}.`,
      datosJson: {
        invitacionId: vigente.id,
        invitadorId: vigente.invitadorId,
        usuarioId: user.id,
        rol: vigente.rol,
      },
    },
  });
  return actualizado;
}
