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
import {
  MFA_DISPOSITIVO_MAX_AGE,
  type AlcanceMfa,
} from './mfa-dispositivo-cookie';

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
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { rolPlataforma: true, passwordHash: true },
    });
    return {
      dispositivosRecordados: config?.activatedAt
        ? await this.prisma.mfaDispositivo.count({
            where: {
              userId: auth.userId,
              revocadoEl: null,
              venceEl: { gt: new Date() },
              mfaVersion: config.version,
              passwordStamp: huellaPassword(user?.passwordHash ?? null),
            },
          })
        : 0,
      activo: !!config?.activatedAt,
      activadoEl: config?.activatedAt?.toISOString() ?? null,
      codigosRestantes: config?.recoveryHashes.length ?? 0,
      disponible: this.secretos.disponible,
      requiereMfa: !!user?.rolPlataforma,
      recuperacionConfirmada: !!config?.recuperacionConfirmadaEl,
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
      return this.prepararAlta(tx, auth, user.email);
    });
  }

  private async prepararAlta(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    email: string,
  ) {
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
      where: { userId: auth.userId },
      create: { userId: auth.userId, ...pending },
      update: pending,
    });
    return {
      setupId,
      secret,
      expiresAt: expiresAt.toISOString(),
      qrDataUrl: await QRCode.toDataURL(this.totp(secret, email).toString(), {
        width: 224,
        margin: 2,
      }),
    };
  }

  async reemplazar(auth: CurrentAuth, password: string, codigo: string) {
    this.propio(auth);
    if (!this.secretos.disponible)
      throw new ServiceUnavailableException(
        'MFA no está disponible en este entorno.',
      );
    const alta = await this.prisma.$transaction(async (tx) => {
      await bloquearIdentidad(tx, auth.userId);
      const user = await this.exigirPassword(tx, auth.userId, password);
      const config = await tx.userMfa.findUnique({
        where: { userId: user.id },
      });
      if (!config || !(await this.consumir(tx, config, codigo))) return null;
      return this.prepararAlta(tx, auth, user.email);
    });
    if (!alta) throw new BadRequestException(ERROR_CODIGO);
    return alta;
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
    await tx.mfaDispositivo.updateMany({
      where: { userId: auth.userId, revocadoEl: null },
      data: { revocadoEl: new Date() },
    });
  }

  private async auditarStaff(
    tx: Prisma.TransactionClient,
    userId: string,
    accion:
      | 'activada'
      | 'desactivada'
      | 'codigos_renovados'
      | 'reemplazada'
      | 'recuperacion_confirmada',
  ) {
    const usuario = await tx.user.findUnique({
      where: { id: userId },
      select: { rolPlataforma: true },
    });
    if (!usuario?.rolPlataforma) return;
    const descripcion = {
      activada: 'Activó MFA en su cuenta.',
      desactivada:
        'Desactivó MFA en su cuenta después de validar su identidad.',
      codigos_renovados: 'Renovó sus códigos de recuperación MFA.',
      reemplazada:
        'Reemplazó su autenticador MFA después de validar su identidad.',
      recuperacion_confirmada:
        'Confirmó el guardado de sus códigos de recuperación MFA.',
    }[accion];
    await tx.plataformaEvento.create({
      data: { staffUserId: userId, tipo: `mfa_${accion}`, descripcion },
    });
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
          recuperacionConfirmadaEl: null,
          recoveryPendingSessionId: auth.sessionId,
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
      await tx.authSession.update({
        where: { id: auth.sessionId },
        data: { mfaVerificadoEl: new Date() },
      });
      await this.auditarStaff(
        tx,
        auth.userId,
        config.activatedAt ? 'reemplazada' : 'activada',
      );
      return {
        codigosRecuperacion: recovery.codigos,
        versionRecuperacion: config.version + 1,
      };
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
      const user = await this.exigirPassword(tx, auth.userId, password);
      if (accion === 'desactivar' && user.rolPlataforma)
        throw new ForbiddenException(
          'MFA es obligatoria para el equipo de Plataforma. Podés renovar tus códigos de recuperación.',
        );
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
                recuperacionConfirmadaEl: null,
                recoveryPendingSessionId: null,
                lastUsedStep: null,
                version: { increment: 1 },
                failedAttempts: 0,
                lockedUntil: null,
              }
            : {
                recoveryHashes: recovery.hashes,
                version: { increment: 1 },
                recuperacionConfirmadaEl: null,
                recoveryPendingSessionId: auth.sessionId,
              },
      });
      await this.revocarOtras(tx, auth);
      await tx.authSession.update({
        where: { id: auth.sessionId },
        data: { mfaVerificadoEl: accion === 'regenerar' ? new Date() : null },
      });
      await this.auditarStaff(
        tx,
        auth.userId,
        accion === 'desactivar' ? 'desactivada' : 'codigos_renovados',
      );
      return {
        codigosRecuperacion: accion === 'regenerar' ? recovery.codigos : [],
        versionRecuperacion: config.version + 1,
      };
    });
    if (!result) throw new BadRequestException(ERROR_CODIGO);
    this.cache.invalidarUsuario(auth.userId);
    return result;
  }

  /** Invocar dentro de la transacción de login con la identidad bloqueada. */
  async confirmarRecuperacion(auth: CurrentAuth, version: number) {
    this.propio(auth);
    return this.prisma.$transaction(async (tx) => {
      await bloquearIdentidad(tx, auth.userId);
      const config = await tx.userMfa.findUnique({
        where: { userId: auth.userId },
      });
      if (
        config?.activatedAt &&
        config.version === version &&
        config.recuperacionConfirmadaEl
      )
        return { ok: true };
      if (
        !config?.activatedAt ||
        config.version !== version ||
        config.recoveryPendingSessionId !== auth.sessionId
      ) {
        throw new BadRequestException(
          'Estos códigos ya no corresponden a esta sesión. Generá nuevos códigos y guardalos.',
        );
      }
      await tx.userMfa.update({
        where: { userId: auth.userId },
        data: {
          recuperacionConfirmadaEl: new Date(),
          recoveryPendingSessionId: null,
        },
      });
      await this.auditarStaff(tx, auth.userId, 'recuperacion_confirmada');
      return { ok: true };
    });
  }

  /** Sólo se emite tras consumir un segundo factor y dentro de la misma transacción. */
  async recordar(
    tx: Prisma.TransactionClient,
    challenge: MfaChallenge,
    anterior?: string,
  ) {
    const alcance: AlcanceMfa =
      challenge.destination === 'tenant' ? 'tenant' : 'plataforma';
    if (anterior)
      await tx.mfaDispositivo.updateMany({
        where: {
          userId: challenge.userId,
          alcance,
          tokenHash: hash(anterior),
          revocadoEl: null,
        },
        data: { revocadoEl: new Date() },
      });
    const token = randomBytes(32).toString('hex');
    await tx.mfaDispositivo.create({
      data: {
        userId: challenge.userId,
        alcance,
        tokenHash: hash(token),
        passwordStamp: challenge.passwordStamp,
        mfaVersion: challenge.mfaVersion,
        venceEl: new Date(Date.now() + MFA_DISPOSITIVO_MAX_AGE * 1000),
      },
    });
    return { token, alcance };
  }

  /** La contraseña, el usuario y el destino ya fueron validados. No renueva el plazo. */
  async dispositivoValido(
    tx: Prisma.TransactionClient,
    userId: string,
    passwordHash: string | null,
    alcance: AlcanceMfa,
    token?: string,
  ) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const config = await tx.userMfa.findUnique({ where: { userId } });
    if (!config?.activatedAt || this.bloqueado(config)) return null;
    if (alcance === 'plataforma' && !config.recuperacionConfirmadaEl)
      return null;
    const dispositivo = await tx.mfaDispositivo.findFirst({
      where: {
        tokenHash: hash(token),
        userId,
        alcance,
        revocadoEl: null,
        venceEl: { gt: new Date() },
        mfaVersion: config.version,
        passwordStamp: huellaPassword(passwordHash),
      },
    });
    if (!dispositivo) return null;
    await tx.mfaDispositivo.update({
      where: { id: dispositivo.id },
      data: { ultimoUsoEl: new Date() },
    });
    return dispositivo;
  }

  async olvidarDispositivos(auth: CurrentAuth) {
    this.propio(auth);
    const resultado = await this.prisma.$transaction(async (tx) => {
      await bloquearIdentidad(tx, auth.userId);
      await tx.mfaDispositivo.updateMany({
        where: { userId: auth.userId, revocadoEl: null },
        data: { revocadoEl: new Date() },
      });
      // Una sesión obtenida gracias al recuerdo deja de autorizar al revocarlo.
      const actual = await tx.authSession.findFirst({
        where: { id: auth.sessionId, userId: auth.userId },
        select: { mfaDispositivoId: true },
      });
      await tx.authSession.updateMany({
        where: {
          userId: auth.userId,
          mfaDispositivoId: { not: null },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      return { ok: true, requiereLogin: !!actual?.mfaDispositivoId };
    });
    this.cache.invalidarUsuario(auth.userId);
    return resultado;
  }

  /** Invocar dentro de la transacción de login con la identidad bloqueada. */
  async desafiar(
    tx: Prisma.TransactionClient,
    userId: string,
    passwordHash: string | null,
    destination: 'tenant' | 'plataforma' | 'invitacion_plataforma',
    membershipId?: string,
    invitacionPlataformaId?: string,
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
        invitacionPlataformaId,
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
