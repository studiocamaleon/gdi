import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type MfaChallenge, type UserMfa } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Secret, TOTP } from 'otpauth';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import {
  SecretosService,
  type SecretoCifrado,
} from '../integraciones/cripto/secretos.service';
import { SessionCacheService } from './session-cache.service';
import type { CurrentAuth } from './auth.types';

const CINCO_MINUTOS = 5 * 60_000;
const ERROR_CODIGO =
  'Código incorrecto, vencido o ya utilizado. Probá con un código nuevo.';
const hash = (valor: string) =>
  createHash('sha256').update(valor).digest('hex');
export const huellaPassword = (passwordHash: string | null) =>
  hash(passwordHash ?? '');

/** Lock común a alta/baja de MFA y emisión de sesiones: evita carreras entre ambos. */
export async function bloquearIdentidad(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
}

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretos: SecretosService,
    private readonly cache: SessionCacheService,
  ) {}

  private propio(auth: CurrentAuth) {
    if (auth.impersonacion || auth.mcp)
      throw new ForbiddenException('Esta acción requiere tu sesión personal.');
  }

  async estado(auth: CurrentAuth) {
    this.propio(auth);
    const config = await this.prisma.userMfa.findUnique({
      where: { userId: auth.userId },
    });
    return {
      activo: !!config?.activatedAt,
      activadoEl: config?.activatedAt?.toISOString() ?? null,
      codigosRestantes: config?.recoveryHashes.length ?? 0,
      disponible: this.secretos.disponible,
    };
  }

  private async exigirPassword(
    tx: Prisma.TransactionClient,
    userId: string,
    password: string,
  ) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (
      !user?.activo ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }
    return user;
  }

  private totp(secret: string, email = '') {
    return new TOTP({
      issuer: 'Grafo',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
  }

  async iniciar(auth: CurrentAuth, password: string) {
    this.propio(auth);
    if (!this.secretos.disponible)
      throw new ServiceUnavailableException(
        'MFA todavía no está disponible en este entorno.',
      );
    return this.prisma.$transaction(async (tx) => {
      await bloquearIdentidad(tx, auth.userId);
      const user = await this.exigirPassword(tx, auth.userId, password);
      const actual = await tx.userMfa.findUnique({
        where: { userId: user.id },
      });
      if (actual?.activatedAt)
        throw new BadRequestException('La protección MFA ya está activa.');
      const secret = new Secret({ size: 20 }).base32;
      const setupId = randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      const pending = {
        pendingId: setupId,
        pendingSecret: this.secretos.cifrar(secret),
        pendingSessionId: auth.sessionId,
        pendingExpiresAt: expiresAt,
      };
      await tx.userMfa.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...pending },
        update: pending,
      });
      return {
        setupId,
        secret,
        expiresAt: expiresAt.toISOString(),
        qrDataUrl: await QRCode.toDataURL(
          this.totp(secret, user.email).toString(),
          { width: 224, margin: 2 },
        ),
      };
    });
  }

  private codigos() {
    const codigos = Array.from({ length: 10 }, () =>
      randomBytes(10).toString('hex').toUpperCase().match(/.{4}/g)!.join('-'),
    );
    return { codigos, hashes: codigos.map((c) => hash(c.replaceAll('-', ''))) };
  }

  private paso(
    secret: Prisma.JsonValue,
    codigo: string,
    lastUsed: number | null,
  ) {
    if (!/^\d{6}$/.test(codigo)) return null;
    const ahora = Date.now();
    const delta = this.totp(
      this.secretos.descifrar(secret as unknown as SecretoCifrado),
    ).validate({ token: codigo, window: 1, timestamp: ahora });
    if (delta === null) return null;
    const step = Math.floor(ahora / 30_000) + delta;
    return lastUsed !== null && step <= lastUsed ? null : step;
  }

  private bloqueado(config: UserMfa) {
    return !!config.lockedUntil && config.lockedUntil > new Date();
  }

  private async fallo(tx: Prisma.TransactionClient, config: UserMfa) {
    const intentos =
      config.lockedUntil && config.lockedUntil <= new Date()
        ? 1
        : config.failedAttempts + 1;
    await tx.userMfa.update({
      where: { userId: config.userId },
      data: {
        failedAttempts: intentos,
        lockedUntil:
          intentos >= 5 ? new Date(Date.now() + CINCO_MINUTOS) : null,
      },
    });
  }

  private async revocarOtras(tx: Prisma.TransactionClient, auth: CurrentAuth) {
    await tx.authSession.updateMany({
      where: {
        userId: auth.userId,
        id: { not: auth.sessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await tx.mfaChallenge.deleteMany({ where: { userId: auth.userId } });
  }

  async confirmar(auth: CurrentAuth, setupId: string, codigo: string) {
    this.propio(auth);
    const resultado = await this.prisma.$transaction(async (tx) => {
      await bloquearIdentidad(tx, auth.userId);
      const config = await tx.userMfa.findUnique({
        where: { userId: auth.userId },
      });
      if (
        !config ||
        config.activatedAt ||
        !config.pendingSecret ||
        config.pendingId !== setupId ||
        config.pendingSessionId !== auth.sessionId ||
        !config.pendingExpiresAt ||
        config.pendingExpiresAt <= new Date()
      ) {
        throw new BadRequestException(
          'La configuración venció. Volvé a iniciar la activación.',
        );
      }
      if (this.bloqueado(config)) return null;
      const step = this.paso(config.pendingSecret, codigo, null);
      if (step === null) {
        await this.fallo(tx, config);
        return null;
      }
      const recovery = this.codigos();
      await tx.userMfa.update({
        where: { userId: auth.userId },
        data: {
          secret: config.pendingSecret as Prisma.InputJsonValue,
          activatedAt: new Date(),
          lastUsedStep: step,
          recoveryHashes: recovery.hashes,
          pendingSecret: Prisma.DbNull,
          pendingId: null,
          pendingSessionId: null,
          pendingExpiresAt: null,
          failedAttempts: 0,
          lockedUntil: null,
          version: { increment: 1 },
        },
      });
      await this.revocarOtras(tx, auth);
      return { codigosRecuperacion: recovery.codigos };
    });
    // No lanzar dentro de la transacción por un código errado: desharía el contador.
    if (!resultado) throw new BadRequestException(ERROR_CODIGO);
    this.cache.invalidarUsuario(auth.userId);
    return resultado;
  }

  async cancelar(auth: CurrentAuth) {
    this.propio(auth);
    await this.prisma.userMfa.updateMany({
      where: {
        userId: auth.userId,
        activatedAt: null,
        pendingSessionId: auth.sessionId,
      },
      data: {
        pendingSecret: Prisma.DbNull,
        pendingId: null,
        pendingSessionId: null,
        pendingExpiresAt: null,
      },
    });
    return { ok: true };
  }

  /** Consume el paso TOTP o el código de recuperación bajo el lock de User. */
  private async consumir(
    tx: Prisma.TransactionClient,
    config: UserMfa,
    codigo: string,
  ) {
    if (!config.activatedAt || !config.secret || this.bloqueado(config))
      return false;
    const step = this.paso(config.secret, codigo, config.lastUsedStep);
    const limpio = codigo.replaceAll('-', '').replaceAll(' ', '').toUpperCase();
    const recoveryHash = /^[A-F0-9]{20}$/.test(limpio) ? hash(limpio) : null;
    const esRecovery =
      !!recoveryHash && config.recoveryHashes.includes(recoveryHash);
    if (step === null && !esRecovery) {
      await this.fallo(tx, config);
      return false;
    }
    await tx.userMfa.update({
      where: { userId: config.userId },
      data: {
        ...(step !== null
          ? { lastUsedStep: step }
          : {
              recoveryHashes: config.recoveryHashes.filter(
                (h) => h !== recoveryHash,
              ),
            }),
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    return true;
  }

  async gestionar(
    auth: CurrentAuth,
    password: string,
    codigo: string,
    accion: 'desactivar' | 'regenerar',
  ) {
    this.propio(auth);
    const result = await this.prisma.$transaction(async (tx) => {
      await bloquearIdentidad(tx, auth.userId);
      await this.exigirPassword(tx, auth.userId, password);
      const config = await tx.userMfa.findUnique({
        where: { userId: auth.userId },
      });
      if (!config || !(await this.consumir(tx, config, codigo))) return null;
      const recovery = this.codigos();
      await tx.userMfa.update({
        where: { userId: auth.userId },
        data:
          accion === 'desactivar'
            ? {
                secret: Prisma.DbNull,
                activatedAt: null,
                recoveryHashes: [],
                lastUsedStep: null,
                version: { increment: 1 },
                failedAttempts: 0,
                lockedUntil: null,
              }
            : { recoveryHashes: recovery.hashes, version: { increment: 1 } },
      });
      await this.revocarOtras(tx, auth);
      return {
        codigosRecuperacion: accion === 'regenerar' ? recovery.codigos : [],
      };
    });
    if (!result) throw new BadRequestException(ERROR_CODIGO);
    this.cache.invalidarUsuario(auth.userId);
    return result;
  }

  /** Invocar dentro de la transacción de login con la identidad bloqueada. */
  async desafiar(
    tx: Prisma.TransactionClient,
    userId: string,
    passwordHash: string | null,
    destination: 'tenant' | 'plataforma',
    membershipId?: string,
  ) {
    const config = await tx.userMfa.findUnique({ where: { userId } });
    if (!config?.activatedAt) return null;
    if (this.bloqueado(config))
      throw new UnauthorizedException(
        'Demasiados intentos. Esperá cinco minutos antes de volver a ingresar.',
      );
    const challengeToken = randomBytes(32).toString('hex');
    await tx.mfaChallenge.create({
      data: {
        tokenHash: hash(challengeToken),
        userId,
        destination,
        membershipId,
        passwordStamp: huellaPassword(passwordHash),
        mfaVersion: config.version,
        expiresAt: new Date(Date.now() + CINCO_MINUTOS),
      },
    });
    return {
      requiereMfa: true as const,
      challengeToken,
      expiresIn: 300,
      accessToken: null,
    };
  }

  async verificarDesafio<T>(
    token: string,
    codigo: string,
    completar: (
      challenge: MfaChallenge,
      tx: Prisma.TransactionClient,
    ) => Promise<T>,
  ): Promise<T> {
    const tokenHash = hash(token);
    // La reserva de intento queda confirmada aun si luego falla la transacción.
    const intento = await this.prisma.mfaChallenge.updateMany({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
      data: { attempts: { increment: 1 } },
    });
    if (!intento.count)
      throw new UnauthorizedException(
        'La verificación venció o agotó sus intentos. Volvé a iniciar sesión.',
      );
    const resultado = await this.prisma.$transaction(async (tx) => {
      const challenge = await tx.mfaChallenge.findUnique({
        where: { tokenHash },
      });
      if (!challenge) return null;
      await bloquearIdentidad(tx, challenge.userId);
      const [vigente, user, config] = await Promise.all([
        tx.mfaChallenge.findUnique({ where: { tokenHash } }),
        tx.user.findUnique({ where: { id: challenge.userId } }),
        tx.userMfa.findUnique({ where: { userId: challenge.userId } }),
      ]);
      if (
        !vigente ||
        vigente.usedAt ||
        vigente.expiresAt <= new Date() ||
        !user?.activo ||
        !config?.activatedAt ||
        config.version !== challenge.mfaVersion ||
        huellaPassword(user.passwordHash) !== challenge.passwordStamp
      )
        return null;
      if (!(await this.consumir(tx, config, codigo))) return null;
      await tx.mfaChallenge.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      });
      return { value: await completar(challenge, tx) };
    });
    if (!resultado) throw new UnauthorizedException(ERROR_CODIGO);
    return resultado.value;
  }
}
