import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type CentroCopiadoTarifarioVersion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MONEDA_DEFAULT } from '../../common/monedas';
import { ORDEN_CANALES_VENTA } from '../../ordenes-trabajo/canales-venta';
import { CentroCopiadoAuditoriaService } from '../centro-copiado-auditoria.service';
import { validarContenidoTarifario } from './contenido-tarifario';
import {
  idsTarifariosPolitica,
  mismaReferenciaPolitica,
  politicaPreciosInicial,
  seleccionarPolitica,
  validarCanalCopiado,
  validarPoliticaPrecios,
  type ReferenciaPoliticaPrecios,
} from './politica-precios';
import type { GuardarPoliticaPreciosDto } from './politica-precios.dto';

@Injectable()
export class CentroCopiadoPoliticaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: CentroCopiadoAuditoriaService,
  ) {}

  async obtenerBorrador(
    tenantId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const guardado = await db.centroCopiadoPoliticaBorrador.findUnique({
      where: { tenantId },
    });
    return {
      estado: 'BORRADOR' as const,
      operativa: false as const,
      revision: guardado?.revision ?? 0,
      contenido: guardado
        ? validarPoliticaPrecios(guardado.contenido)
        : politicaPreciosInicial(),
      actualizadoPorId: guardado?.actualizadoPorId ?? null,
      actualizadoEl: guardado?.updatedAt ?? null,
    };
  }

  async guardarBorrador(
    tenantId: string,
    actorUserId: string,
    dto: GuardarPoliticaPreciosDto,
  ) {
    const contenido = validarPoliticaPrecios(dto.contenido);
    const ids = idsTarifariosPolitica(contenido);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const propios = ids.length
          ? await tx.centroCopiadoTarifario.count({
              where: { tenantId, id: { in: ids } },
            })
          : 0;
        if (propios !== ids.length)
          throw new BadRequestException(
            'Seleccioná tarifarios que pertenezcan a esta empresa.',
          );
        if (dto.revision === 0) {
          await tx.centroCopiadoPoliticaBorrador.create({
            data: { tenantId, contenido, actualizadoPorId: actorUserId },
          });
        } else {
          const cambio = await tx.centroCopiadoPoliticaBorrador.updateMany({
            where: { tenantId, revision: dto.revision },
            data: {
              contenido,
              actualizadoPorId: actorUserId,
              revision: { increment: 1 },
            },
          });
          if (cambio.count !== 1)
            throw new ConflictException(
              'La configuración cambió. Recargala antes de guardar.',
            );
        }
        const borrador = await this.obtenerBorrador(tenantId, tx);
        await this.auditoria.registrar(tx, {
          tenantId,
          actorUserId,
          tipo: 'POLITICA_PRECIOS_BORRADOR_GUARDADO',
          descripcion: 'Política general y canales preparados en borrador.',
          datos: { revision: borrador.revision, contenido },
        });
        return borrador;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'La configuración cambió. Recargala antes de guardar.',
        );
      }
      throw error;
    }
  }

  private async cargarContexto(tenantId: string, db: Prisma.TransactionClient) {
    const borrador = await this.obtenerBorrador(tenantId, db);
    const datos = await db.datosEmpresa.findUnique({
      where: { tenantId },
      select: { monedaCodigo: true },
    });
    return { borrador, monedaCodigo: datos?.monedaCodigo ?? MONEDA_DEFAULT };
  }

  private async cargarTarifarios(
    tenantId: string,
    ids: string[],
    ahora: Date,
    db: Prisma.TransactionClient,
  ) {
    const filas = ids.length
      ? await db.centroCopiadoTarifario.findMany({
          where: { tenantId, id: { in: ids } },
          select: {
            id: true,
            versiones: {
              where: { tenantId, vigenteDesde: { lte: ahora } },
              orderBy: [{ vigenteDesde: 'desc' }, { numero: 'desc' }],
              take: 1,
            },
          },
        })
      : [];
    return new Map<string, CentroCopiadoTarifarioVersion | null>(
      filas.map((f) => [f.id, f.versiones[0] ?? null]),
    );
  }

  private resolverSeleccion(
    tenantId: string,
    contexto: Awaited<
      ReturnType<CentroCopiadoPoliticaService['cargarContexto']>
    >,
    seleccion: ReturnType<typeof seleccionarPolitica>,
    tarifarios: Awaited<
      ReturnType<CentroCopiadoPoliticaService['cargarTarifarios']>
    >,
  ) {
    const base = { canalVenta: seleccion.canalVenta, origen: seleccion.origen };
    const referenciaBase = {
      tenantId,
      politicaRevision: contexto.borrador.revision,
      canalVenta: seleccion.canalVenta,
      monedaCodigo: contexto.monedaCodigo,
    };
    if (seleccion.politica.modalidad === 'MOTOR') {
      return {
        ...base,
        estado: 'MOTOR' as const,
        referencia: { ...referenciaBase, modalidad: 'MOTOR' as const },
      };
    }
    const tarifarioId = seleccion.politica.tarifarioId;
    const version = tarifarios.get(tarifarioId);
    if (!version)
      return {
        ...base,
        estado: 'PENDIENTE' as const,
        referencia: null,
        tarifarioId,
        motivo:
          version === null
            ? ('SIN_VERSION_VIGENTE' as const)
            : ('TARIFARIO_NO_DISPONIBLE' as const),
      };
    const contenido = validarContenidoTarifario(version.contenido);
    if (contenido.monedaCodigo !== contexto.monedaCodigo)
      return {
        ...base,
        estado: 'PENDIENTE' as const,
        referencia: null,
        tarifarioId,
        motivo: 'MONEDA_INCOMPATIBLE' as const,
      };
    return {
      ...base,
      estado: 'TARIFARIO' as const,
      referencia: {
        ...referenciaBase,
        modalidad: 'TARIFARIO' as const,
        tarifarioId,
        versionId: version.id,
      },
      version: {
        id: version.id,
        numero: version.numero,
        nombre: version.nombre,
        vigenteDesde: version.vigenteDesde,
        contenido,
      },
    };
  }

  /** Vista previa del borrador; no representa una política activada en pedidos.
   * Una misma lectura de PostgreSQL evita mezclar revisiones entre canales.
   */
  async previsualizar(tenantId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const contexto = await this.cargarContexto(tenantId, tx);
        const evaluadoEl = new Date();
        const tarifas = await this.cargarTarifarios(
          tenantId,
          idsTarifariosPolitica(contexto.borrador.contenido),
          evaluadoEl,
          tx,
        );
        const canales = ORDEN_CANALES_VENTA.map((canal) => {
          const r = this.resolverSeleccion(
            tenantId,
            contexto,
            seleccionarPolitica(contexto.borrador.contenido, canal),
            tarifas,
          );
          if (r.estado !== 'TARIFARIO') return r;
          // La vista de canales necesita la selección, no todas las celdas del tarifario.
          return {
            ...r,
            version: {
              id: r.version.id,
              numero: r.version.numero,
              nombre: r.version.nombre,
              vigenteDesde: r.version.vigenteDesde,
            },
          };
        });
        return { ...contexto, evaluadoEl, canales };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Contrato interno para preparar el cálculo completo de un pedido.
   * El canal se obtiene del pedido en el caller; no se infiere del dispositivo.
   */
  async resolverBorrador(tenantId: string, canal: unknown, ahora = new Date()) {
    const canalVenta = validarCanalCopiado(canal);
    return this.prisma.$transaction(
      async (tx) => {
        const contexto = await this.cargarContexto(tenantId, tx);
        const seleccion = seleccionarPolitica(
          contexto.borrador.contenido,
          canalVenta,
        );
        const ids =
          seleccion.politica.modalidad === 'TARIFARIO'
            ? [seleccion.politica.tarifarioId]
            : [];
        const tarifas = await this.cargarTarifarios(tenantId, ids, ahora, tx);
        return this.resolverSeleccion(tenantId, contexto, seleccion, tarifas);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Comprueba si la selección preparada sigue vigente; no confirma ventas.
   * Al integrar emisión se repetirá dentro de su transacción de guardado.
   */
  async comprobarReferenciaBorrador(
    tenantId: string,
    canal: unknown,
    referencia: ReferenciaPoliticaPrecios,
  ) {
    const actual = await this.resolverBorrador(tenantId, canal);
    if (
      actual.estado === 'PENDIENTE' ||
      !mismaReferenciaPolitica(referencia, actual.referencia)
    ) {
      throw new ConflictException(
        'La política, el canal o los precios cambiaron. Revisá nuevamente el cálculo.',
      );
    }
    return actual;
  }
}
