import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Membership, Prisma, RolPlataforma, RolSistema } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { CurrentAuth, JwtPayload } from './auth.types';
import { SessionCacheService } from './session-cache.service';

// Hash dummy para igualar el tiempo de respuesta del login cuando el usuario
// no existe (evita enumeración de usuarios por timing). Se calcula una vez.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('gdi-timing-guard', 10);

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
    private readonly sessionCache: SessionCacheService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

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
      // Comparación dummy: mismo costo que un login válido, para no revelar
      // por timing si el email está registrado.
      await bcrypt.compare(payload.password, DUMMY_PASSWORD_HASH);
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

    return this.createSessionResponse(
      user.id,
      user.email,
      membership,
      this.prisma,
      user.nombreCompleto ?? null,
      user.rolPlataforma ?? null,
    );
  }

  /**
   * Login del BACKOFFICE (opción A): autentica al staff de plataforma sin
   * exigirle una empresa. Emite una sesión de plataforma —sin tenant— que el
   * AuthGuard sólo deja usar en las rutas del control plane.
   *
   * Misma tabla User y mismas credenciales que el login de tenant: una persona
   * de Grupo Idea puede entrar por acá para operar la plataforma y por el login
   * normal para operar su imprenta. Ver docs/control-plane-diseno.md
   */
  async loginPlataforma(payload: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        nombreCompleto: true,
        activo: true,
        passwordHash: true,
        rolPlataforma: true,
      },
    });

    if (!user?.passwordHash || !user.activo) {
      await bcrypt.compare(payload.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Credenciales invalidas.');
    }
    const ok = await bcrypt.compare(payload.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales invalidas.');

    // El corte del backoffice: sin rol de plataforma no se entra, aunque las
    // credenciales sean válidas (es un usuario de tenant común).
    if (!user.rolPlataforma) {
      throw new UnauthorizedException(
        'Esta cuenta no tiene acceso al equipo de Grafo.',
      );
    }

    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        currentTenantId: null,
        currentMembershipId: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });
    const accessToken = await this.issueToken({
      sub: user.id,
      sessionId: session.id,
      tenantId: '',
      membershipId: '',
      role: RolSistema.ADMINISTRADOR,
      email: user.email,
      plat: true,
    });
    return {
      accessToken,
      sessionId: session.id,
      staff: {
        id: user.id,
        email: user.email,
        nombreCompleto: user.nombreCompleto,
        rolPlataforma: user.rolPlataforma,
      },
    };
  }

  async logout(auth: CurrentAuth) {
    await this.prisma.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });
    this.sessionCache.invalidate(auth.sessionId);
  }

  /**
   * Emite el token de una sesión de impersonación ya creada. Vive acá porque
   * AuthService es el dueño de los tokens y de AuthSession — el control plane
   * crea la SesionImpersonacion y delega la emisión.
   *
   * La AuthSession lleva `impersonacionId` (sin membership) y expira JUNTO con
   * la impersonación, no a los 7 días: el token no puede sobrevivir a la
   * sesión que lo justifica. El staff opera con rol ADMINISTRADOR del tenant.
   * Ver docs/control-plane-diseno.md
   */
  async emitirTokenImpersonacion(params: {
    tenantId: string;
    sesionImpersonacionId: string;
    expiraEl: Date;
    actorUserId: string;
    actorNombre: string;
  }): Promise<string> {
    const session = await this.prisma.authSession.create({
      data: {
        userId: params.actorUserId,
        currentTenantId: params.tenantId,
        currentMembershipId: null,
        impersonacionId: params.sesionImpersonacionId,
        expiresAt: params.expiraEl,
      },
    });
    return this.issueToken({
      sub: params.actorUserId,
      sessionId: session.id,
      tenantId: params.tenantId,
      membershipId: '',
      role: RolSistema.ADMINISTRADOR,
      email: 'impersonacion@grafo',
      imp: {
        sesionId: params.sesionImpersonacionId,
        actorUserId: params.actorUserId,
        actorNombre: params.actorNombre,
      },
    });
  }

  /**
   * Cierra la impersonación y devuelve al staff a SU cuenta: re-emite un token
   * de su primera membership activa. Corre con el token de impersonación (que
   * prueba que es el staff), así que no necesita password. Si el staff no
   * tiene ninguna empresa, se queda sin sesión (el front lo manda a /login).
   */
  async salirDeImpersonacion(auth: CurrentAuth): Promise<{
    accessToken: string | null;
  }> {
    if (!auth.impersonacion) {
      throw new BadRequestException('No hay una impersonación en curso.');
    }
    // Revoca la sesión de impersonación actual (defensa; el control plane ya
    // la cerró al pedir salir, pero el token podría reusarse).
    await this.prisma.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: auth.impersonacion.actorUserId,
        activa: true,
        tenant: { activo: true },
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) return { accessToken: null };

    const user = await this.prisma.user.findUnique({
      where: { id: auth.impersonacion.actorUserId },
      select: { email: true },
    });
    const resp = await this.createSessionResponse(
      membership.userId,
      user!.email,
      membership,
    );
    return { accessToken: resp.accessToken };
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
      // Consumo atómico de la invitación (single-use). Si otra request en
      // paralelo ya la aceptó, este updateMany afecta 0 filas y abortamos,
      // evitando crear membership/sesión duplicadas por doble submit o replay.
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('La invitacion ya fue utilizada.');
      }

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
        },
      });

      return this.createSessionResponse(
        user.id,
        user.email,
        membership,
        tx,
        user.nombreCompleto ?? null,
        user.rolPlataforma ?? null,
      );
    });
  }

  async getCurrentContext(auth: CurrentAuth) {
    // Impersonación: el staff no tiene membership en este tenant, así que la
    // respuesta se arma aparte, con el tenant impersonado y el flag que la
    // app usa para mostrar el banner "estás dentro de X".
    if (auth.impersonacion) {
      const [tenant, sesion] = await Promise.all([
        this.prisma.tenant.findUnique({
          where: { id: auth.tenantId },
          select: { id: true, nombre: true, slug: true },
        }),
        this.prisma.sesionImpersonacion.findUnique({
          where: { id: auth.impersonacion.sesionId },
          select: { expiraEl: true },
        }),
      ]);
      if (!tenant || !sesion) {
        throw new UnauthorizedException('La sesión de impersonación terminó.');
      }
      const tenantActual = {
        id: tenant.id,
        nombre: tenant.nombre,
        slug: tenant.slug,
        rol: 'administrador' as const,
      };
      return {
        accessToken: null,
        sessionId: auth.sessionId,
        currentUser: {
          id: auth.impersonacion.actorUserId,
          email: auth.email,
          nombreCompleto: auth.impersonacion.actorNombre,
          rolPlataforma: null,
          impersonacion: {
            actorNombre: auth.impersonacion.actorNombre,
            expiraEl: sesion.expiraEl.toISOString(),
          },
          tenantActual,
          tenants: [tenantActual],
        },
      };
    }

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
      user.nombreCompleto ?? null,
      currentMembership,
      user.memberships,
      null,
      user.rolPlataforma ?? null,
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
    // El token nuevo reusa el sessionId con otro tenant/membership: invalidar
    // el cache para que la próxima request revalide contra la DB.
    this.sessionCache.invalidate(auth.sessionId);

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

    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { nombreCompleto: true, rolPlataforma: true },
    });

    return this.buildAuthResponse(
      auth.sessionId,
      auth.userId,
      auth.email,
      user?.nombreCompleto ?? null,
      membership,
      allMemberships,
      token,
      user?.rolPlataforma ?? null,
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

    // No logueamos la URL/token en claro (cualquiera con acceso a logs podría
    // aceptar la invitación). Solo id + email; el enlace se entrega por retorno.
    this.logger.log(
      `Invitacion creada para ${normalizedEmail} (${invitation.id})`,
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
    nombreCompleto: string | null = null,
    rolPlataforma: RolPlataforma | null = null,
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
      nombreCompleto,
      membership,
      memberships,
      token,
      rolPlataforma,
    );
  }

  private async issueToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      // Configurable por entorno; la sesión se re-valida contra la DB en cada
      // request, así que un TTL corto es seguro de acortar en producción.
      expiresIn: (process.env.JWT_EXPIRES_IN ??
        '7d') as JwtSignOptions['expiresIn'],
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
    nombreCompleto: string | null,
    currentMembership: MembershipWithTenant,
    memberships: MembershipWithTenant[],
    accessToken: string | null,
    rolPlataforma: RolPlataforma | null = null,
  ) {
    return {
      accessToken,
      sessionId,
      currentUser: {
        id: userId,
        email,
        nombreCompleto,
        // Sólo para que la UI muestre (o no) el acceso a /plataforma. La
        // autorización real la hace PlataformaGuard contra la base.
        rolPlataforma,
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
