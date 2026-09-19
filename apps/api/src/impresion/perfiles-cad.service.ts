import { CatalogoCadService } from '../centro-copiado/catalogo-cad.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MotorUniversalService } from '../motor-universal/motor.service';
import type { CurrentAuth } from '../auth/auth.types';
import { PerfilesImpresionService } from './perfiles-impresion.service';
import { esConfiguracionCad, planPruebaCad } from './cad.domain';
import { PerfilCadDto, SimularPerfilCadDto } from './perfiles-cad.dto';
import { enlacePerfilCad } from './perfiles-cad.domain';

@Injectable()
export class PerfilesCadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perfiles: PerfilesImpresionService,
    private readonly motor: MotorUniversalService,
    private readonly catalogo: CatalogoCadService,
  ) {}

  private async destino(
    tenantId: string,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const d = await db.impresionDestino.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Impresora no encontrada.');
    if (!esConfiguracionCad(d.cad))
      throw new BadRequestException(
        'Configurá primero el ancho y origen del rollo CAD.',
      );
    const maquina = await db.maquina.findFirst({
      where: {
        id: d.maquinaId,
        tenantId,
        activo: true,
        plantilla: 'PLOTTER_CAD',
      },
    });
    if (!maquina)
      throw new BadRequestException(
        'El destino debe estar vinculado a un plotter CAD activo.',
      );
    return { ...d, cad: d.cad };
  }

  async opciones(
    tenantId: string,
    destinoId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const d = await this.destino(tenantId, destinoId, db);
    const resultado = await this.catalogo.opcionesMaquina(
      tenantId,
      d.maquinaId,
      d.cad.anchoRolloMm,
      db,
    );
    return {
      opciones: resultado.opciones.map(({ revisionBase, ...opcion }) => {
        void revisionBase;
        return opcion;
      }),
    };
  }

  async guardar(auth: CurrentAuth, dto: PerfilCadDto, id?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ImpresionDestino" WHERE id = ${dto.destinoId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const d = await this.destino(auth.tenantId, dto.destinoId, tx);
      if (d.version !== dto.versionDestino)
        throw new ConflictException(
          'Cambió el rollo o la impresora. Actualizá antes de guardar.',
        );
      const { opciones } = await this.opciones(auth.tenantId, d.id, tx);
      const opcion = opciones.find(
        (o) =>
          o.rutaAlternativaId === dto.rutaAlternativaId &&
          o.materialVarianteId === dto.materialVarianteId &&
          o.colores.includes(dto.color),
      );
      if (!opcion)
        throw new BadRequestException(
          'La ruta, el material o el color ya no son compatibles con este rollo y plotter.',
        );
      if (opcion.gramaje != null && opcion.gramaje !== dto.gramaje)
        throw new BadRequestException(
          'El gramaje debe coincidir con el material de la receta.',
        );
      const nombre = dto.nombre.trim();
      if (!nombre)
        throw new BadRequestException('Completá el nombre del perfil.');
      const anterior = id
        ? await tx.impresionPerfil.findFirst({
            where: {
              id,
              tenantId: auth.tenantId,
              tamano: 'CAD',
              bandeja: { destinoId: d.id },
            },
          })
        : null;
      if (id && !anterior)
        throw new NotFoundException('Perfil CAD no encontrado.');
      if (anterior && anterior.version !== dto.version)
        throw new ConflictException(
          'El perfil cambió. Actualizá antes de guardar.',
        );
      const codigo = d.cad.usarOrigenPredeterminado
        ? '__CAD_DEFAULT__'
        : d.cad.origenPapel;
      const bandeja = await tx.impresionBandeja.upsert({
        where: { destinoId_codigo: { destinoId: d.id, codigo } },
        create: {
          tenantId: auth.tenantId,
          destinoId: d.id,
          codigo,
          nombre: 'Rollo CAD',
        },
        update: {},
      });
      const cad = {
        rutaAlternativaId: opcion.rutaAlternativaId,
        materialVarianteId: opcion.materialVarianteId,
      };
      const previo = enlacePerfilCad(anterior?.cad);
      const cambia =
        anterior &&
        (anterior.bandejaId !== bandeja.id ||
          anterior.color !== dto.color ||
          anterior.gramaje !== dto.gramaje ||
          previo?.rutaAlternativaId !== cad.rutaAlternativaId ||
          previo?.materialVarianteId !== cad.materialVarianteId);
      const data = {
        nombre,
        bandejaId: bandeja.id,
        papelMateriaPrimaId: opcion.papelMateriaPrimaId,
        gramaje: dto.gramaje,
        color: dto.color,
        tamano: 'CAD',
        cad,
        faz: 1,
        modo: dto.modo,
        activo: dto.activo,
        probado: cambia ? false : dto.probado,
        prioridad: dto.prioridad,
        actualizadoPor: auth.email,
      };
      return anterior
        ? tx.impresionPerfil.update({
            where: { id: anterior.id },
            data: { ...data, version: { increment: 1 } },
          })
        : tx.impresionPerfil.create({
            data: { ...data, tenantId: auth.tenantId },
          });
    });
  }

  async resolverPerfil(
    tenantId: string,
    id: string,
    dto: Pick<SimularPerfilCadDto, 'version' | 'versionDestino'>,
  ) {
    const p = await this.prisma.impresionPerfil.findFirst({
      where: { id, tenantId: tenantId, tamano: 'CAD' },
      include: { bandeja: { include: { destino: true } } },
    });
    if (!p) throw new NotFoundException('Perfil CAD no encontrado.');
    const d = await this.destino(tenantId, p.bandeja.destinoId);
    if (!p.activo || !d.activo)
      throw new BadRequestException(
        'Activá el perfil y la impresora para continuar.',
      );
    if (p.version !== dto.version || d.version !== dto.versionDestino)
      throw new ConflictException(
        'El perfil o la impresora cambiaron. Actualizá la configuración.',
      );
    const enlace = enlacePerfilCad(p.cad);
    const { opciones } = await this.opciones(tenantId, d.id);
    const opcion = opciones.find(
      (o) =>
        o.rutaAlternativaId === enlace?.rutaAlternativaId &&
        o.materialVarianteId === enlace?.materialVarianteId &&
        o.colores.includes(p.color as 'BN' | 'COLOR'),
    );
    if (
      !opcion ||
      p.papelMateriaPrimaId !== opcion.papelMateriaPrimaId ||
      (opcion.gramaje != null && opcion.gramaje !== p.gramaje)
    )
      throw new BadRequestException(
        'La receta o el rollo cambiaron. Revisá el perfil CAD.',
      );
    return { p, d, opcion };
  }

  async prueba(auth: CurrentAuth, id: string, dto: SimularPerfilCadDto) {
    const { p, d } = await this.resolverPerfil(auth.tenantId, id, dto);
    return this.perfiles.pruebaCad(
      auth,
      d.id,
      {
        version: d.version,
        formato: dto.formato,
        color: p.color as 'BN' | 'COLOR',
      },
      { id: p.id, version: p.version },
    );
  }

  /** Ejercita el precio existente sin crear OT ni enviar papel. */
  async cotizarMuestra(
    auth: CurrentAuth,
    id: string,
    dto: SimularPerfilCadDto,
  ) {
    const { p, d, opcion } = await this.resolverPerfil(auth.tenantId, id, dto);
    const plan = planPruebaCad(d.cad, dto.formato);
    const jobContext = {
      cantidad: 1,
      caras: 1 as const,
      modoColor: p.color === 'BN' ? 'BN' : 'CMYK',
      piezas: [
        {
          cantidad: 1,
          anchoMm: plan.original.anchoMm,
          altoMm: plan.original.altoMm,
        },
      ],
      [`maquinaSeleccionada_${opcion.configPasoId}`]: d.maquinaId,
      slotMateriales: {
        [`${opcion.configPasoId}_sustrato_principal`]:
          opcion.materialVarianteId,
      },
    };
    const r = await this.motor.cotizar({
      tenantId: auth.tenantId,
      usuarioId: auth.userId,
      productoId: opcion.productoId,
      rutaAlternativaId: opcion.rutaAlternativaId,
      jobContext,
    });
    if (!r.exitoso || !r.cotizacion)
      throw new BadRequestException(
        [r.errores?.[0]?.mensaje, r.errores?.[0]?.sugerencia]
          .filter(Boolean)
          .join(' ') || 'No se pudo calcular el precio de esta receta.',
      );
    const c = r.cotizacion;
    const subtotal =
      c.desglosePrecio?.precioNetoTotal ?? c.precio?.precioTotal ?? 0;
    const total = c.desglosePrecio?.precioBrutoTotal ?? subtotal;
    return {
      productoNombre: opcion.productoNombre,
      materialNombre: opcion.materialNombre,
      color: p.color,
      formato: dto.formato,
      subtotal,
      impuestos: Math.max(0, total - subtotal),
      total,
      plan,
    };
  }
}
