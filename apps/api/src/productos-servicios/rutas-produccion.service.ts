import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ActualizarRutaDto,
  CrearRutaDto,
  DuplicarRutaDto,
} from './dto/ruta.dto';
import { FamiliasPasosService } from './familias-pasos.service';
import {
  leerWorkflowRuta,
  pasosDesdeWorkflow,
  remapearPasosWorkflow,
  validarWorkflowRuta,
  workflowLinealDesdePasos,
  type RutaWorkflow,
} from './ruta-workflow';

@Injectable()
export class RutasProduccionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familias: FamiliasPasosService,
  ) {}

  async listarRutas(tenantId: string, incluirInactivas = false) {
    const rutas = await this.prisma.ruta.findMany({
      // Las rutas de sistema (plantilla del centro de copiado) no se listan.
      where: {
        tenantId,
        sistemaCodigo: null,
        ...(incluirInactivas ? {} : { activo: true }),
      },
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { productosAlternativas: true } },
      },
    });

    if (rutas.length === 0) return [];

    // Traer SOLO los pasos de la versión actual de cada ruta (antes se cargaban
    // los pasos de TODAS las versiones y se filtraba en memoria, creciendo sin
    // límite con cada versión guardada).
    const [pasos, versiones] = await Promise.all([
      this.prisma.rutaPaso.findMany({
        where: {
          tenantId,
          OR: rutas.map((ruta) => ({
            rutaId: ruta.id,
            version: ruta.versionActual,
          })),
        },
        orderBy: { orden: 'asc' },
        select: {
          id: true,
          rutaId: true,
          version: true,
          orden: true,
          familiaCodigo: true,
          nombreVisible: true,
          icono: true,
        },
      }),
      this.prisma.rutaVersion.findMany({
        where: {
          tenantId,
          OR: rutas.map((ruta) => ({
            rutaId: ruta.id,
            version: ruta.versionActual,
          })),
        },
        select: { rutaId: true, snapshotJson: true },
      }),
    ]);

    const pasosPorRuta = new Map<string, typeof pasos>();
    for (const paso of pasos) {
      const lista = pasosPorRuta.get(paso.rutaId) ?? [];
      lista.push(paso);
      pasosPorRuta.set(paso.rutaId, lista);
    }

    const snapshotPorRuta = new Map(
      versiones.map((version) => [version.rutaId, version.snapshotJson]),
    );
    return rutas.map((ruta) => {
      const pasosRuta = pasosPorRuta.get(ruta.id) ?? [];
      return {
        ...ruta,
        pasos: pasosRuta.map(({ rutaId, ...paso }) => {
          void rutaId;
          return paso;
        }),
        workflow: leerWorkflowRuta(snapshotPorRuta.get(ruta.id), pasosRuta),
      };
    });
  }

  async crearRuta(tenantId: string, dto: CrearRutaDto) {
    const workflowEntrada = await this.prepararWorkflowEntrada(
      tenantId,
      dto.workflow,
      dto.pasos,
    );
    const pasosEntrada = pasosDesdeWorkflow(workflowEntrada);
    this.validarOrdenPasos(pasosEntrada);
    await this.familias.validarFamiliasDePasos(tenantId, pasosEntrada);
    const nombre = dto.nombre.trim();
    if (!nombre)
      throw new BadRequestException('El nombre de la ruta es obligatorio.');
    const baseCodigo = dto.codigo?.trim() || this.codigoFromNombre(nombre);
    const codigo = await this.nextCopyCode(tenantId, baseCodigo);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const ruta = await tx.ruta.create({
          data: {
            tenantId,
            codigo,
            nombre,
            descripcion: dto.descripcion?.trim() || null,
            versionActual: 1,
            activo: true,
            pasos: {
              create: pasosEntrada.map((p) => ({
                tenantId,
                version: 1,
                orden: p.orden,
                familiaCodigo: p.familiaCodigo,
                nombreVisible: p.nombreVisible?.trim() || null,
                icono: p.icono ?? 'Layout',
                activo: true,
              })),
            },
          },
          include: { pasos: true },
        });
        const workflow = remapearPasosWorkflow(workflowEntrada, ruta.pasos);
        await tx.rutaVersion.create({
          data: {
            tenantId,
            rutaId: ruta.id,
            version: 1,
            snapshotJson: this.buildRutaSnapshot(ruta.pasos, workflow),
            cambios: 'Versión inicial',
          },
        });
        return { ...ruta, workflow };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Ya existe una ruta con código "${codigo}"`,
        );
      }
      throw err;
    }
  }

  async duplicarRuta(tenantId: string, id: string, dto: DuplicarRutaDto = {}) {
    const origen = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: {
        pasos: { orderBy: { orden: 'asc' } },
      },
    });
    if (!origen) throw new NotFoundException(`Ruta ${id} no encontrada`);

    const pasosActuales = origen.pasos.filter(
      (paso) => paso.version === origen.versionActual,
    );
    if (pasosActuales.length === 0) {
      throw new BadRequestException(
        `Ruta "${origen.nombre}" no tiene pasos para duplicar.`,
      );
    }
    const versionOrigen = await this.prisma.rutaVersion.findFirst({
      where: {
        tenantId,
        rutaId: origen.id,
        version: origen.versionActual,
      },
      select: { snapshotJson: true },
    });
    const workflowOrigen = leerWorkflowRuta(
      versionOrigen?.snapshotJson,
      pasosActuales,
    );

    const nombre = dto.nombre?.trim() || `${origen.nombre} copia`;
    const baseCodigo = dto.codigo?.trim() || this.codigoFromNombre(nombre);
    const codigo = await this.nextCopyCode(tenantId, baseCodigo);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const rutaDuplicada = await tx.ruta.create({
          data: {
            tenantId,
            codigo,
            nombre,
            descripcion: origen.descripcion,
            versionActual: 1,
            activo: dto.activo ?? true,
            pasos: {
              create: pasosActuales.map((paso) => ({
                tenantId,
                version: 1,
                orden: paso.orden,
                familiaCodigo: paso.familiaCodigo,
                nombreVisible: paso.nombreVisible,
                icono: paso.icono,
                activo: paso.activo,
              })),
            },
          },
          include: { pasos: true },
        });

        const workflow = remapearPasosWorkflow(
          workflowOrigen,
          rutaDuplicada.pasos,
        );
        await tx.rutaVersion.create({
          data: {
            tenantId,
            rutaId: rutaDuplicada.id,
            version: 1,
            snapshotJson: this.buildRutaSnapshot(rutaDuplicada.pasos, workflow),
            cambios: 'Versión inicial',
          },
        });

        return { ...rutaDuplicada, workflow };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Ya existe una ruta con código "${codigo}"`,
        );
      }
      throw err;
    }
  }

  async actualizarRuta(tenantId: string, id: string, dto: ActualizarRutaDto) {
    const existente = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: {
        pasos: { orderBy: { orden: 'asc' } },
        productosAlternativas: true,
      },
    });
    if (!existente) throw new NotFoundException(`Ruta ${id} no encontrada`);
    if (existente.sistemaCodigo) {
      throw new BadRequestException(
        'Esta ruta la gestiona un módulo del sistema y no se edita desde acá.',
      );
    }

    const cambiaWorkflow = Boolean(dto.workflow || dto.pasos);
    const workflowEntrada = cambiaWorkflow
      ? await this.prepararWorkflowEntrada(tenantId, dto.workflow, dto.pasos)
      : null;
    const pasosEntrada = workflowEntrada
      ? pasosDesdeWorkflow(workflowEntrada)
      : null;
    if (pasosEntrada) {
      this.validarOrdenPasos(pasosEntrada);
      await this.familias.validarFamiliasDePasos(tenantId, pasosEntrada);
    }
    if (dto.nombre !== undefined && !dto.nombre.trim()) {
      throw new BadRequestException('El nombre de la ruta es obligatorio.');
    }

    return this.prisma.$transaction(async (tx) => {
      const dataBase: Prisma.RutaUpdateInput = {};
      if (dto.nombre !== undefined) dataBase.nombre = dto.nombre.trim();
      if (dto.descripcion !== undefined) {
        dataBase.descripcion = dto.descripcion.trim() || null;
      }
      if (dto.activo !== undefined) dataBase.activo = dto.activo;

      if (workflowEntrada && pasosEntrada) {
        if (existente.productosAlternativas.length > 0) {
          const maxVersion = await tx.rutaPaso.aggregate({
            where: { tenantId, rutaId: id },
            _max: { version: true },
          });
          const nuevaVersion =
            Math.max(
              existente.versionActual,
              maxVersion._max.version ?? existente.versionActual,
            ) + 1;
          dataBase.versionActual = nuevaVersion;
          await tx.rutaPaso.createMany({
            data: pasosEntrada.map((p) => ({
              tenantId,
              rutaId: id,
              version: nuevaVersion,
              orden: p.orden,
              familiaCodigo: p.familiaCodigo,
              nombreVisible: p.nombreVisible?.trim() || null,
              icono: p.icono ?? 'Layout',
              activo: true,
            })),
          });
          const nuevosPasos = await tx.rutaPaso.findMany({
            where: { tenantId, rutaId: id, version: nuevaVersion },
            orderBy: { orden: 'asc' },
          });
          const workflow = remapearPasosWorkflow(workflowEntrada, nuevosPasos);
          await tx.rutaVersion.create({
            data: {
              tenantId,
              rutaId: id,
              version: nuevaVersion,
              snapshotJson: this.buildRutaSnapshot(nuevosPasos, workflow),
              cambios: dto.cambios ?? 'Actualización del Workflow',
            },
          });
        } else {
          const version = existente.versionActual;
          await this.reconciliarPasosVersionInPlace(tx, {
            tenantId,
            rutaId: id,
            version,
            pasos: pasosEntrada,
          });
          const pasosActualizados = await tx.rutaPaso.findMany({
            where: { tenantId, rutaId: id, version },
            orderBy: { orden: 'asc' },
          });
          const workflow = remapearPasosWorkflow(
            workflowEntrada,
            pasosActualizados,
          );
          const snapshotJson = this.buildRutaSnapshot(
            pasosActualizados,
            workflow,
          );
          await tx.rutaVersion.upsert({
            where: {
              tenantId_rutaId_version: {
                tenantId,
                rutaId: id,
                version,
              },
            },
            create: {
              tenantId,
              rutaId: id,
              version,
              snapshotJson,
              cambios: dto.cambios ?? 'Actualización del Workflow',
            },
            update: {
              snapshotJson,
              cambios: dto.cambios ?? 'Actualización del Workflow',
            },
          });
        }
      }

      const ruta = await tx.ruta.update({
        where: { id },
        data: dataBase,
        include: { pasos: { orderBy: { orden: 'asc' } } },
      });
      const pasosActuales = ruta.pasos.filter(
        (paso) => paso.version === ruta.versionActual,
      );
      const versionActual = await tx.rutaVersion.findFirst({
        where: {
          tenantId,
          rutaId: ruta.id,
          version: ruta.versionActual,
        },
        select: { snapshotJson: true },
      });
      return {
        ...ruta,
        pasos: pasosActuales,
        workflow: leerWorkflowRuta(versionActual?.snapshotJson, pasosActuales),
      };
    });
  }

  private async reconciliarPasosVersionInPlace(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      rutaId: string;
      version: number;
      pasos: Array<{
        orden: number;
        familiaCodigo: string;
        nombreVisible?: string | null;
        icono?: string;
      }>;
    },
  ) {
    const actuales = await tx.rutaPaso.findMany({
      where: {
        tenantId: args.tenantId,
        rutaId: args.rutaId,
        version: args.version,
      },
      orderBy: { orden: 'asc' },
    });
    const usados = new Set<string>();
    const matches = args.pasos.map((paso) => {
      const sameFamily = actuales
        .filter(
          (actual) =>
            !usados.has(actual.id) &&
            actual.familiaCodigo === paso.familiaCodigo,
        )
        .sort(
          (a, b) =>
            Math.abs(a.orden - paso.orden) - Math.abs(b.orden - paso.orden),
        )[0];
      const fallbackSameOrder = actuales.find(
        (actual) => !usados.has(actual.id) && actual.orden === paso.orden,
      );
      const actual = sameFamily ?? fallbackSameOrder ?? null;
      if (actual) usados.add(actual.id);
      return { paso, actual };
    });

    for (const actual of actuales) {
      if (usados.has(actual.id)) continue;
      await tx.productoConfigPaso.deleteMany({
        where: { tenantId: args.tenantId, rutaPasoId: actual.id },
      });
      await tx.rutaPaso.delete({ where: { id: actual.id } });
    }

    for (const [index, match] of matches.entries()) {
      if (!match.actual) continue;
      if (match.actual.familiaCodigo !== match.paso.familiaCodigo) {
        await tx.productoConfigPaso.deleteMany({
          where: { tenantId: args.tenantId, rutaPasoId: match.actual.id },
        });
      }
      await tx.rutaPaso.update({
        where: { id: match.actual.id },
        data: { orden: -10_000 - index },
      });
    }

    for (const match of matches) {
      if (match.actual) {
        await tx.rutaPaso.update({
          where: { id: match.actual.id },
          data: {
            orden: match.paso.orden,
            familiaCodigo: match.paso.familiaCodigo,
            nombreVisible: match.paso.nombreVisible?.trim() || null,
            icono: match.paso.icono ?? match.actual.icono,
            activo: true,
          },
        });
        continue;
      }

      await tx.rutaPaso.create({
        data: {
          tenantId: args.tenantId,
          rutaId: args.rutaId,
          version: args.version,
          orden: match.paso.orden,
          familiaCodigo: match.paso.familiaCodigo,
          nombreVisible: match.paso.nombreVisible?.trim() || null,
          icono: match.paso.icono ?? 'Layout',
          activo: true,
        },
      });
    }
  }

  async migrarProductosAVersionActual(
    tenantId: string,
    rutaId: string,
    rutaAlternativaIds: string[],
  ) {
    const ids = [...new Set(rutaAlternativaIds)];
    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, tenantId },
      include: { pasos: { orderBy: { orden: 'asc' } } },
    });
    if (!ruta) throw new NotFoundException(`Ruta ${rutaId} no encontrada`);

    const pasosDestino = ruta.pasos.filter(
      (paso) => paso.version === ruta.versionActual && paso.activo,
    );
    if (pasosDestino.length === 0) {
      throw new BadRequestException(
        'La versión actual de la ruta no tiene pasos.',
      );
    }

    const alternativas = await this.prisma.productoRutaAlternativa.findMany({
      where: { tenantId, rutaId, id: { in: ids } },
    });
    if (alternativas.length !== ids.length) {
      throw new BadRequestException(
        'Una o más asociaciones de producto no pertenecen a esta ruta.',
      );
    }

    const versionesOrigen = [
      ...new Set(alternativas.map((a) => a.rutaVersion)),
    ];
    const pasosOrigen = await this.prisma.rutaPaso.findMany({
      where: { tenantId, rutaId, version: { in: versionesOrigen } },
      orderBy: { orden: 'asc' },
    });

    return this.prisma.$transaction(async (tx) => {
      let migradas = 0;
      let requierenConfiguracion = 0;

      for (const alternativa of alternativas) {
        if (alternativa.rutaVersion === ruta.versionActual) continue;
        const origen = pasosOrigen.filter(
          (paso) => paso.version === alternativa.rutaVersion,
        );
        const destinosUsados = new Set<string>();
        const destinoPorOrigen = new Map<
          string,
          (typeof pasosDestino)[number]
        >();

        for (const pasoOrigen of origen) {
          const destino = pasosDestino
            .filter(
              (paso) =>
                !destinosUsados.has(paso.id) &&
                paso.familiaCodigo === pasoOrigen.familiaCodigo,
            )
            .sort(
              (a, b) =>
                Math.abs(a.orden - pasoOrigen.orden) -
                Math.abs(b.orden - pasoOrigen.orden),
            )[0];
          if (!destino) continue;
          destinosUsados.add(destino.id);
          destinoPorOrigen.set(pasoOrigen.id, destino);
        }

        const configs = await tx.productoConfigPaso.findMany({
          where: {
            tenantId,
            productoRutaAlternativaId: alternativa.id,
          },
        });
        const destinosConConfig = new Set<string>();
        for (const config of configs) {
          const destino = destinoPorOrigen.get(config.rutaPasoId);
          if (!destino) {
            await tx.productoConfigPaso.delete({ where: { id: config.id } });
            continue;
          }
          destinosConConfig.add(destino.id);
          const pasoOrigen = origen.find(
            (paso) => paso.id === config.rutaPasoId,
          );
          const nombreEraDefaultDeRuta =
            !config.nombreVisible?.trim() ||
            config.nombreVisible.trim() === pasoOrigen?.nombreVisible?.trim();
          await tx.productoConfigPaso.update({
            where: { id: config.id },
            data: {
              rutaPasoId: destino.id,
              nombreVisible:
                (nombreEraDefaultDeRuta
                  ? destino.nombreVisible?.trim()
                  : config.nombreVisible?.trim()) || null,
              requiereRutaPasoIds: config.requiereRutaPasoIds
                .map((id) => destinoPorOrigen.get(id)?.id)
                .filter((id): id is string => Boolean(id)),
            },
          });
        }

        const pasosNuevosSinConfig = pasosDestino.filter(
          (paso) => !destinosConConfig.has(paso.id),
        );
        if (pasosNuevosSinConfig.length > 0) requierenConfiguracion += 1;
        for (const paso of pasosNuevosSinConfig) {
          if (!paso.nombreVisible?.trim()) continue;
          await tx.productoConfigPaso.create({
            data: {
              tenantId,
              productoRutaAlternativaId: alternativa.id,
              rutaPasoId: paso.id,
              nombreVisible: paso.nombreVisible.trim(),
            },
          });
        }

        for (const [origenId, destino] of destinoPorOrigen) {
          await tx.productoPasoExtra.updateMany({
            where: {
              tenantId,
              rutaAlternativaId: alternativa.id,
              insertarDespuesDeRutaPasoId: origenId,
            },
            data: { insertarDespuesDeRutaPasoId: destino.id },
          });
        }
        await tx.productoPasoExtra.updateMany({
          where: {
            tenantId,
            rutaAlternativaId: alternativa.id,
            insertarDespuesDeRutaPasoId: {
              in: origen
                .filter((paso) => !destinoPorOrigen.has(paso.id))
                .map((paso) => paso.id),
            },
          },
          data: { insertarDespuesDeRutaPasoId: null },
        });

        await tx.productoRutaAlternativa.update({
          where: { id: alternativa.id },
          data: { rutaVersion: ruta.versionActual },
        });
        migradas += 1;
      }

      return { migradas, requierenConfiguracion };
    });
  }

  async eliminarRuta(tenantId: string, id: string) {
    const existente = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { productosAlternativas: true } } },
    });
    if (!existente) throw new NotFoundException(`Ruta ${id} no encontrada`);
    if (existente.sistemaCodigo) {
      throw new BadRequestException(
        'Esta ruta la gestiona un módulo del sistema y no se borra desde acá.',
      );
    }

    if (existente._count.productosAlternativas > 0) {
      throw new BadRequestException(
        `Ruta "${existente.nombre}" está siendo usada por ${existente._count.productosAlternativas} producto(s). Marcala como inactiva en vez de eliminarla.`,
      );
    }

    return this.prisma.ruta.delete({ where: { id } });
  }

  private async nextCopyCode(tenantId: string, codigoBase: string) {
    const base = codigoBase.slice(0, 100);
    for (let index = 1; index < 1000; index += 1) {
      const suffix = `-${index}`;
      const candidate =
        index === 1 ? base : `${base.slice(0, 100 - suffix.length)}${suffix}`;
      const exists = await this.prisma.ruta.findFirst({
        where: { tenantId, codigo: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new BadRequestException(
      'No se pudo generar un código de copia único.',
    );
  }

  private validarOrdenPasos(pasos: Array<{ orden: number }>) {
    const ordenes = pasos.map((paso) => paso.orden).sort((a, b) => a - b);
    if (ordenes.some((orden, index) => orden !== index + 1)) {
      throw new BadRequestException(
        'Los pasos deben tener un orden único y consecutivo desde 1.',
      );
    }
  }

  private codigoFromNombre(nombre: string) {
    const codigo = nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .toUpperCase();
    return codigo || 'RUTA-COPIA';
  }

  async obtenerRuta(tenantId: string, id: string) {
    const ruta = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: {
        pasos: { orderBy: { orden: 'asc' } },
        versiones: { orderBy: { version: 'desc' }, take: 5 },
        productosAlternativas: {
          include: {
            producto: { select: { id: true, codigo: true, nombre: true } },
          },
        },
      },
    });
    if (!ruta) throw new NotFoundException(`Ruta ${id} no encontrada`);
    const pasosActuales = ruta.pasos.filter(
      (paso) => paso.version === ruta.versionActual,
    );
    const versionActual = ruta.versiones.find(
      (version) => version.version === ruta.versionActual,
    );
    return {
      ...ruta,
      pasos: pasosActuales,
      workflow: leerWorkflowRuta(versionActual?.snapshotJson, pasosActuales),
    };
  }

  buildRutaSnapshot(
    pasos: Array<{
      id: string;
      orden: number;
      familiaCodigo: string;
      nombreVisible?: string | null;
      icono?: string;
      version?: number;
      activo?: boolean;
    }>,
    workflow?: RutaWorkflow,
  ): Prisma.InputJsonObject {
    const workflowNormalizado = workflow
      ? validarWorkflowRuta(workflow)
      : workflowLinealDesdePasos(pasos);
    return {
      contractVersion: 1,
      topologia: workflowNormalizado.topologia,
      workflow: JSON.parse(
        JSON.stringify(workflowNormalizado),
      ) as Prisma.InputJsonObject,
      pasos: pasos
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((paso) => ({
          id: paso.id,
          orden: paso.orden,
          familiaCodigo: paso.familiaCodigo,
          familia: paso.familiaCodigo,
          nombreVisible: paso.nombreVisible?.trim() || null,
          icono: paso.icono ?? 'Layout',
          version: paso.version ?? 1,
          activo: paso.activo ?? true,
        })),
    };
  }

  private async prepararWorkflowEntrada(
    tenantId: string,
    workflowDto: CrearRutaDto['workflow'] | ActualizarRutaDto['workflow'],
    pasosDto: CrearRutaDto['pasos'] | ActualizarRutaDto['pasos'],
  ): Promise<RutaWorkflow> {
    if (!workflowDto) {
      if (!pasosDto?.length) {
        throw new BadRequestException(
          'La ruta debe contener al menos un Paso, Etapa o Componente.',
        );
      }
      this.validarOrdenPasos(pasosDto);
      return workflowLinealDesdePasos(
        pasosDto.map((paso) => ({
          id: `nuevo-${paso.orden}`,
          ...paso,
        })),
      );
    }

    let workflow: RutaWorkflow;
    try {
      workflow = validarWorkflowRuta({
        contractVersion: 1,
        topologia: workflowDto.topologia ?? 'DAG',
        nodos: workflowDto.nodos,
        aristas: workflowDto.aristas,
      } as unknown as RutaWorkflow);
    } catch (error: unknown) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'El Workflow de la ruta no es válido.',
      );
    }

    const componentes = workflow.nodos.filter(
      (nodo) => nodo.tipo === 'COMPONENTE',
    );
    const idsComponentes = [
      ...new Set(componentes.map((nodo) => nodo.productoComponenteId)),
    ];
    const productos = idsComponentes.length
      ? await this.prisma.producto.findMany({
          where: { tenantId, id: { in: idsComponentes } },
          select: { id: true, codigo: true, nombre: true, activo: true },
        })
      : [];
    const productoPorId = new Map(productos.map((item) => [item.id, item]));
    for (const id of idsComponentes) {
      const producto = productoPorId.get(id);
      if (!producto) {
        throw new BadRequestException(
          'Uno de los componentes no pertenece al catálogo de la empresa.',
        );
      }
      if (!producto.activo) {
        throw new BadRequestException(
          `El componente "${producto.nombre}" está inactivo.`,
        );
      }
    }

    const codigosTenant = workflow.nodos
      .filter((nodo) => nodo.tipo !== 'COMPONENTE')
      .map((nodo) => nodo.familiaCodigo)
      .filter((codigo) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          codigo,
        ),
      );
    const pasosTenant = codigosTenant.length
      ? await this.prisma.pasoTenant.findMany({
          where: { tenantId, id: { in: codigosTenant } },
          select: { id: true, tipoPaso: true },
        })
      : [];
    const tipoPorFamilia = new Map(
      pasosTenant.map((paso) => [
        paso.id,
        paso.tipoPaso === 'COMPUESTO' ? ('ETAPA' as const) : ('PASO' as const),
      ]),
    );

    try {
      return validarWorkflowRuta({
        ...workflow,
        nodos: workflow.nodos.map((nodo) => {
          if (nodo.tipo === 'COMPONENTE') {
            const producto = productoPorId.get(nodo.productoComponenteId)!;
            return {
              ...nodo,
              codigo: nodo.codigo || producto.codigo,
              nombre: producto.nombre,
            };
          }
          return {
            ...nodo,
            tipo: tipoPorFamilia.get(nodo.familiaCodigo) ?? 'PASO',
          };
        }),
      });
    } catch (error: unknown) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'El Workflow de la ruta no es válido.',
      );
    }
  }
}
