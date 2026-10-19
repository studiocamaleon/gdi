import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { expandir, permisosDeRolBase } from '../auth/permisos';
import { ipPermitida } from '../auth/ip';
import { VincularPantallaDto } from './pantallas-produccion.dto';
import {
  diaEnZona,
  entregasParaPantalla,
  seleccionOrdenPantalla,
} from './entregas-pantalla';

const hash = (valor: string) =>
  createHash('sha256').update(valor).digest('hex');
const MINUTOS_CODIGO = 10;
export const DIAS_PANTALLA = 180;
const seleccionGestion = {
  id: true,
  nombre: true,
  intervaloSegundos: true,
  vinculadaEl: true,
  revocadaEl: true,
  expiraEl: true,
  ultimaConexionEl: true,
} as const;

function secretoDe(authorization?: string) {
  const secreto = /^Bearer (grafo_tv_[a-f0-9]{64})$/.exec(
    authorization ?? '',
  )?.[1];
  if (!secreto)
    throw new UnauthorizedException(
      'Esta pantalla necesita vincularse nuevamente.',
    );
  return secreto;
}
function codigoDe(secreto: string) {
  const bytes = createHash('sha256').update(`codigo:${secreto}`).digest();
  const alfabeto = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  // 8 caracteres = 40 bits. El código no permite reconstruir la credencial de 256 bits.
  return Array.from(bytes.subarray(0, 8), (b) => alfabeto[b & 31]).join('');
}

@Injectable()
export class PantallasProduccionService {
  constructor(private readonly prisma: PrismaService) {}

  private gestionar(auth: CurrentAuth) {
    if (
      !auth.tenantId ||
      !auth.membershipId ||
      auth.mcp ||
      auth.impersonacion ||
      auth.esPlataforma ||
      !auth.permisos?.has('produccion.configurar') ||
      !auth.permisos?.has('produccion.tablero.ver')
    ) {
      throw new ForbiddenException(
        'Necesitás acceso al tablero y permiso para configurar producción.',
      );
    }
  }

  async iniciar(authorization?: string) {
    const secreto = secretoDe(authorization);
    const tokenHash = hash(secreto);
    if (
      await this.prisma.pantallaProduccion.findUnique({
        where: { tokenHash },
        select: { id: true },
      })
    ) {
      throw new BadRequestException(
        'La solicitud ya fue creada. Consultá su estado.',
      );
    }
    const codigo = codigoDe(secreto);
    const venceCodigoEl = new Date(Date.now() + MINUTOS_CODIGO * 60_000);
    await this.prisma.pantallaProduccion.deleteMany({
      where: {
        tenantId: null,
        expiraEl: { lt: new Date(Date.now() - 86_400_000) },
      },
    });
    await this.prisma.pantallaProduccion.create({
      data: {
        tokenHash,
        codigoHash: hash(codigo),
        venceCodigoEl,
        expiraEl: venceCodigoEl,
      },
    });
    return { estado: 'pendiente', codigo, venceCodigoEl };
  }

  private async autenticar(
    authorization: string | undefined,
    ip: string,
    permitirPendiente = false,
  ) {
    const secreto = secretoDe(authorization);
    const pantalla = await this.prisma.pantallaProduccion.findUnique({
      where: { tokenHash: hash(secreto) },
      include: {
        membership: {
          include: {
            rolDelTenant: true,
            user: { select: { activo: true, debeCambiarPassword: true } },
            tenant: {
              select: {
                activo: true,
                nombre: true,
                datosEmpresa: { select: { zonaHoraria: true } },
              },
            },
          },
        },
      },
    });
    if (!pantalla || pantalla.revocadaEl || pantalla.expiraEl <= new Date()) {
      throw new UnauthorizedException(
        'El acceso venció o fue revocado. Volvé a vincular la pantalla.',
      );
    }
    if (!pantalla.tenantId && permitirPendiente)
      return { pantalla, codigo: codigoDe(secreto) };
    const miembro = pantalla.membership;
    const permisos = miembro
      ? expandir(
          miembro.rolDelTenant?.permisos ?? permisosDeRolBase(miembro.rol),
        )
      : new Set<string>();
    if (
      !pantalla.tenantId ||
      !miembro ||
      miembro.tenantId !== pantalla.tenantId ||
      !miembro.activa ||
      !miembro.user.activo ||
      miembro.user.debeCambiarPassword ||
      !miembro.tenant.activo ||
      (miembro.rolDelTenant &&
        miembro.rolDelTenant.tenantId !== pantalla.tenantId) ||
      !permisos.has('produccion.configurar') ||
      !permisos.has('produccion.tablero.ver') ||
      !ipPermitida(ip, miembro.ipsPermitidas)
    ) {
      throw new UnauthorizedException(
        'La autorización de esta pantalla ya no está disponible.',
      );
    }
    return { pantalla, codigo: null };
  }

  async estado(authorization: string | undefined, ip: string) {
    const { pantalla, codigo } = await this.autenticar(authorization, ip, true);
    return codigo
      ? { estado: 'pendiente', codigo, venceCodigoEl: pantalla.venceCodigoEl }
      : { estado: 'vinculada', nombre: pantalla.nombre };
  }

  async datos(authorization: string | undefined, ip: string) {
    const { pantalla } = await this.autenticar(authorization, ip);
    const tenantId = pantalla.tenantId!;
    const empresa = pantalla.membership!.tenant;
    const zona =
      empresa.datosEmpresa?.zonaHoraria ?? 'America/Argentina/Buenos_Aires';
    const actualizadoEl = new Date();
    const hoy = diaEnZona(actualizadoEl, zona);
    const hasta = new Date(`${hoy}T00:00:00Z`);
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: {
        tenantId,
        estado: { in: ['pendiente', 'produccion', 'finalizada'] },
        OR: [
          { fechaEntrega: { lte: hasta } },
          { items: { some: { tenantId, fechaEntrega: { lte: hasta } } } },
        ],
      },
      select: seleccionOrdenPantalla,
    });
    // El heartbeat no modifica órdenes ni dispara reconciliaciones de producción.
    if (
      !pantalla.ultimaConexionEl ||
      actualizadoEl.getTime() - pantalla.ultimaConexionEl.getTime() >= 60_000
    ) {
      await this.prisma.pantallaProduccion.updateMany({
        where: { id: pantalla.id, tenantId, revocadaEl: null },
        data: { ultimaConexionEl: actualizadoEl },
      });
    }
    return {
      empresa: empresa.nombre,
      pantalla: pantalla.nombre,
      zona,
      hoy,
      actualizadoEl,
      intervaloSegundos: pantalla.intervaloSegundos,
      ...entregasParaPantalla(ordenes, hoy),
    };
  }

  listar(auth: CurrentAuth) {
    this.gestionar(auth);
    return this.prisma.pantallaProduccion.findMany({
      where: { tenantId: auth.tenantId },
      select: seleccionGestion,
      orderBy: { creadaEl: 'desc' },
    });
  }

  async vincular(auth: CurrentAuth, dto: VincularPantallaDto) {
    this.gestionar(auth);
    const ahora = new Date();
    const resultado = await this.prisma.pantallaProduccion.updateMany({
      where: {
        codigoHash: hash(dto.codigo),
        tenantId: null,
        revocadaEl: null,
        venceCodigoEl: { gt: ahora },
      },
      data: {
        tenantId: auth.tenantId,
        membershipId: auth.membershipId,
        nombre: dto.nombre,
        intervaloSegundos: dto.intervaloSegundos,
        vinculadaEl: ahora,
        codigoHash: null,
        expiraEl: new Date(ahora.getTime() + DIAS_PANTALLA * 86_400_000),
      },
    });
    if (resultado.count !== 1)
      throw new BadRequestException(
        'El código venció, ya se usó o es incorrecto. Revisá el que muestra el televisor.',
      );
    return { vinculada: true };
  }

  async revocar(auth: CurrentAuth, id: string) {
    this.gestionar(auth);
    const resultado = await this.prisma.pantallaProduccion.updateMany({
      where: { id, tenantId: auth.tenantId },
      data: { revocadaEl: new Date() },
    });
    if (!resultado.count)
      throw new NotFoundException('Pantalla no encontrada.');
    return { revocada: true };
  }
}
