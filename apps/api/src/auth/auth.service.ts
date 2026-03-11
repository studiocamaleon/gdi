import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Membership, Prisma, RolSistema } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { CurrentAuth, JwtPayload } from './auth.types';

type MembershipWithTenant = Membership & {
  tenant: {
    id: string;
    nombre: string;
    slug: string;
    activo: boolean;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(payload: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email.trim().toLowerCase() },
      include: {
        memberships: {
          where: {
            activa: true,
            tenant: {
              activo: true,
            },
          },
          include: {
            tenant: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!user?.passwordHash || !user.activo) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    const isPasswordValid = await bcrypt.compare(
      payload.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    const membership = user.memberships[0];

    if (!membership) {
      throw new UnauthorizedException('El usuario no tiene empresas activas.');
    }

    return this.createSessionResponse(user.id, user.email, membership);
  }

  async logout(auth: CurrentAuth) {
    await this.prisma.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async getInvitation(token: string) {
    const invitation = await this.findInvitationOrThrow(token);

    return {
      email: invitation.email,
      tenantNombre: invitation.tenant.nombre,
      rol: this.fromPrismaRol(invitation.rol),
      requiresPasswordSetup: !invitation.user?.passwordHash,
    };
  }

  async acceptInvitation(token: string, payload: AcceptInvitationDto) {
    const invitation = await this.findInvitationOrThrow(token);
    const normalizedEmail = invitation.email.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      let user =
        invitation.user ??
        (await tx.user.findUnique({
          where: { email: normalizedEmail },
        }));

      if (!user) {
        if (!payload.password) {
          throw new BadRequestException(
            'Debes definir una clave para activar el acceso.',
          );
        }

        user = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash: await bcrypt.hash(payload.password, 10),
            activo: true,
          },
        });
      } else if (!user.passwordHash) {
        if (!payload.password) {
          throw new BadRequestException(
            'Debes definir una clave para activar el acceso.',
          );
        }

        user = await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await bcrypt.hash(payload.password, 10),
          },
        });
      }

      const membership = await tx.membership.upsert({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId: invitation.tenantId,
          },
        },
        update: {
          rol: invitation.rol,
          activa: true,
        },
        create: {
          userId: user.id,
          tenantId: invitation.tenantId,
          rol: invitation.rol,
          activa: true,
        },
        include: {
          tenant: true,
        },
      });

      if (invitation.empleadoId) {
        await tx.empleado.update({
          where: { id: invitation.empleadoId },
          data: { userId: user.id },
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          userId: user.id,
          acceptedAt: new Date(),
        },
      });

      return this.createSessionResponse(user.id, user.email, membership, tx);
    });
  }

  async getCurrentContext(auth: CurrentAuth) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        memberships: {
          where: {
            activa: true,
            tenant: {
              activo: true,
            },
          },
          include: {
            tenant: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    const currentMembership = user.memberships.find(
      (membership) => membership.id === auth.membershipId,
    );

    if (!currentMembership) {
      throw new UnauthorizedException(
        'La empresa seleccionada ya no esta disponible.',
      );
    }

    return this.buildAuthResponse(
      auth.sessionId,
      user.id,
      user.email,
      currentMembership,
      user.memberships,
      null,
    );
  }

  async switchTenant(auth: CurrentAuth, tenantId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: auth.userId,
          tenantId,
        },
      },
      include: {
        tenant: true,
      },
    });

    if (!membership?.activa || !membership.tenant.activo) {
      throw new NotFoundException('No tienes acceso a esa empresa.');
    }

    await this.prisma.authSession.update({
      where: { id: auth.sessionId },
      data: {
        currentTenantId: membership.tenantId,
        currentMembershipId: membership.id,
      },
    });

    const allMemberships = await this.prisma.membership.findMany({
      where: {
        userId: auth.userId,
        activa: true,
        tenant: {
          activo: true,
        },
      },
      include: {
        tenant: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const token = await this.issueToken({
      sub: auth.userId,
      sessionId: auth.sessionId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.rol,
      email: auth.email,
    });

    return this.buildAuthResponse(
      auth.sessionId,
      auth.userId,
      auth.email,
      membership,
      allMemberships,
      token,
    );
  }

  async provisionEmployeeAccess(
    auth: CurrentAuth,
    empleadoId: string,
    email: string,
    rol: RolSistema,
  ) {
    const empleado = await this.prisma.empleado.findFirst({
      where: {
        id: empleadoId,
        tenantId: auth.tenantId,
      },
    });

    if (!empleado) {
      throw new NotFoundException(`No existe el empleado ${empleadoId}`);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const membership = existingUser
      ? await this.prisma.membership.findUnique({
          where: {
            userId_tenantId: {
              userId: existingUser.id,
              tenantId: auth.tenantId,
            },
          },
        })
      : null;

    if (
      membership?.activa &&
      membership.rol === rol &&
      empleado.userId === existingUser?.id
    ) {
      return {
        invitationState: 'active',
        invitationUrl: null,
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email: normalizedEmail,
            activo: true,
          },
        }));

      await tx.membership.upsert({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId: auth.tenantId,
          },
        },
        update: {
          rol,
          activa: true,
        },
        create: {
          userId: user.id,
          tenantId: auth.tenantId,
          rol,
          activa: true,
        },
      });

      await tx.empleado.update({
        where: { id: empleadoId },
        data: {
          userId: user.id,
        },
      });

      await tx.invitation.updateMany({
        where: {
          tenantId: auth.tenantId,
          empleadoId,
          acceptedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return tx.invitation.create({
        data: {
          tenantId: auth.tenantId,
          userId: user.id,
          empleadoId,
          invitedByMembershipId: auth.membershipId,
          email: normalizedEmail,
          rol,
          tokenHash,
          expiresAt,
        },
      });
    });

    const invitationUrl = `${process.env.FRONTEND_URL?.split(',')[0]?.trim() ?? 'http://localhost:3000'}/aceptar-invitacion?token=${rawToken}`;

    console.info(
      `[gdi-auth] Invitacion creada para ${normalizedEmail} (${invitation.id}): ${invitationUrl}`,
    );

    return {
      invitationState: existingUser?.passwordHash
        ? 'pending_existing_user'
        : 'pending_setup',
      invitationUrl,
    };
  }

  async revokeEmployeeAccess(auth: CurrentAuth, empleadoId: string) {
    const empleado = await this.prisma.empleado.findFirst({
      where: {
        id: empleadoId,
        tenantId: auth.tenantId,
      },
    });

    if (!empleado?.userId) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.updateMany({
        where: {
          userId: empleado.userId!,
          tenantId: auth.tenantId,
        },
        data: {
          activa: false,
        },
      });

      await tx.empleado.update({
        where: { id: empleadoId },
        data: {
          userId: null,
        },
      });

      await tx.invitation.updateMany({
        where: {
          tenantId: auth.tenantId,
          empleadoId,
          acceptedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });
  }

  private async createSessionResponse(
    userId: string,
    email: string,
    membership: MembershipWithTenant,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const session = await db.authSession.create({
      data: {
        userId,
        currentTenantId: membership.tenantId,
        currentMembershipId: membership.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    const memberships = await db.membership.findMany({
      where: {
        userId,
        activa: true,
        tenant: {
          activo: true,
        },
      },
      include: {
        tenant: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const token = await this.issueToken({
      sub: userId,
      sessionId: session.id,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.rol,
      email,
    });

    return this.buildAuthResponse(
      session.id,
      userId,
      email,
      membership,
      memberships,
      token,
    );
  }

  private async issueToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'gdi-dev-secret',
      expiresIn: '7d',
    });
  }

  private async findInvitationOrThrow(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: {
        tokenHash: this.hashToken(token),
      },
      include: {
        tenant: true,
        user: true,
      },
    });

    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new NotFoundException('La invitacion no existe o expiro.');
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException('La invitacion ya fue utilizada.');
    }

    return invitation;
  }

  private buildAuthResponse(
    sessionId: string,
    userId: string,
    email: string,
    currentMembership: MembershipWithTenant,
    memberships: MembershipWithTenant[],
    accessToken: string | null,
  ) {
    return {
      accessToken,
      sessionId,
      currentUser: {
        id: userId,
        email,
        tenantActual: {
          id: currentMembership.tenant.id,
          nombre: currentMembership.tenant.nombre,
          slug: currentMembership.tenant.slug,
          rol: this.fromPrismaRol(currentMembership.rol),
        },
        tenants: memberships.map((membership) => ({
          id: membership.tenant.id,
          nombre: membership.tenant.nombre,
          slug: membership.tenant.slug,
          rol: this.fromPrismaRol(membership.rol),
        })),
      },
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private fromPrismaRol(rol: RolSistema) {
    const mapping: Record<
      RolSistema,
      'administrador' | 'supervisor' | 'operador'
    > = {
      [RolSistema.ADMINISTRADOR]: 'administrador',
      [RolSistema.SUPERVISOR]: 'supervisor',
      [RolSistema.OPERADOR]: 'operador',
    };

    return mapping[rol];
  }
}
