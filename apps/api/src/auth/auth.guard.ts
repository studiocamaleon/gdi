import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { CurrentAuth, JwtPayload } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      auth?: CurrentAuth;
    }>();

    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesion.');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Sesion invalida.');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: true,
        currentTenant: true,
        currentMembership: true,
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.activo ||
      !session.currentTenant.activo ||
      !session.currentMembership.activa ||
      session.userId !== payload.sub ||
      session.currentTenantId !== payload.tenantId ||
      session.currentMembershipId !== payload.membershipId
    ) {
      throw new UnauthorizedException('Sesion expirada o revocada.');
    }

    request.auth = {
      userId: payload.sub,
      sessionId: payload.sessionId,
      tenantId: payload.tenantId,
      membershipId: payload.membershipId,
      role: payload.role,
      email: payload.email,
    };

    return true;
  }

  private extractBearerToken(authorization?: string) {
    if (!authorization) {
      return null;
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
