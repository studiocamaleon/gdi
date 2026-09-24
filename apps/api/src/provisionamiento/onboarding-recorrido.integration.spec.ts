import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { RegistroService } from '../registro/registro.service';
import type { CurrentAuth } from '../auth/auth.types';
import {
  serviciosRecorridoF4,
  ejecutarOrdenF4,
} from '../../test/soporte-recorridos-f4';
import { InventarioBibliotecaService } from '../inventario/inventario-biblioteca.service';
import { ModoDuplicadoMaterialPresetDto } from '../inventario/dto/install-material-preset.dto';
import { normalizedMaterialPrice } from '../inventario/material-units';
import { provisionarPlantillaCentroCopiado } from '../centro-copiado/provisionar-plantilla';
import { ProductosService } from '../productos-servicios/productos.service';
import { ProductoValidacionService } from '../productos-servicios/producto-validacion.service';
import { MotorUniversalService } from '../motor-universal/motor.service';
import { AplicarPrecioService } from '../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { CostosCatalogoService } from '../costos/costos-catalogo.service';
import { CostosMapper } from '../costos/costos.mapper';
import { CostosValidacionesService } from '../costos/costos-validaciones.service';
import { CostosTarifasService } from '../costos/costos-tarifas.service';
import { CostosRepartoService } from '../costos/costos-reparto.service';
import { TipoCentroCostoDto } from '../costos/dto/upsert-centro-costo.dto';
import { EntregaService } from '../ordenes-trabajo/entrega.service';
import { FidelizacionService } from '../fidelizacion/fidelizacion.service';
import { MaquinariaService } from '../maquinaria/maquinaria.service';
import * as M from '../maquinaria/dto/upsert-maquina.dto';

/** Auditoría de onboarding. No usa el catálogo de un tenant demo.
 * Alta y servicios reales sobre PostgreSQL; fixtures técnicas creadas desde cero.
 * No valida formularios HTTP, impresoras, correos ni contratación comercial.
 * El helper de OT aísla comunicaciones y preparación externa de fabricación.
 * Toda escritura (incluyendo plan y actor sintéticos) se revierte al terminar.
 */
const db = new PrismaClient();
beforeAll(async () => {
  const [{ nombre }] = await db.$queryRaw<
    Array<{ nombre: string }>
  >`SELECT current_database() AS nombre`;
  if (!nombre.endsWith('_test'))
    throw new Error('Esta auditoría exige una base terminada en _test.');
});
afterAll(() => db.$disconnect());

async function escenario(
  comprobar: (c: Awaited<ReturnType<typeof preparar>>) => Promise<void>,
  origen: 'registro_publico' | 'plataforma' = 'registro_publico',
) {
  const rollback = new Error('rollback auditoría onboarding');
  await expect(
    db.$transaction(
      async (tx) => {
        await comprobar(await preparar(tx, origen));
        throw rollback;
      },
      { timeout: 60000 },
    ),
  ).rejects.toBe(rollback);
}

async function preparar(
  tx: Prisma.TransactionClient,
  origen: 'registro_publico' | 'plataforma',
) {
  const plan = await tx.plan.create({
    data: {
      codigo: `qa-onboarding-${randomUUID()}`,
      nombre: 'QA sin oferta comercial',
      precioMensual: 0,
      featuresJson: {},
    },
  });
  const alta = await new TenantProvisioningService().provisionarBase(tx, {
    nombre: 'QA onboarding desde cero',
    plan: { id: plan.id, trialDias: 14 },
    origen,
    paisCodigo: 'CL',
    zonaHoraria: 'America/Santiago',
  });
  const actor = await tx.user.create({
    data: {
      email: `qa-${randomUUID()}@example.test`,
      nombreCompleto: 'Implementador de prueba',
      passwordHash: 'no-login',
    },
  });
  const membership = await tx.membership.create({
    data: {
      tenantId: alta.tenantId,
      userId: actor.id,
      rol: 'ADMINISTRADOR',
      rolId: alta.administradorRolId,
    },
  });
  const auth = {
    tenantId: alta.tenantId,
    userId: actor.id,
    email: actor.email,
    role: 'ADMINISTRADOR',
    membershipId: membership.id,
    sessionId: randomUUID(),
    permisos: new Set([
      'produccion.supervisar',
      'comercial.ver',
      'finanzas.ver_margenes',
    ]),
  } as CurrentAuth;
  const servicios = serviciosRecorridoF4(tx);
  const productos = new ProductosService(servicios.prisma as never);
  const validacion = new ProductoValidacionService(productos);
  const motor = new MotorUniversalService(
    servicios.prisma as never,
    new AplicarPrecioService(),
    new PreciosEspecialesClientesService(servicios.prisma as never),
  );
  return { tx, ...servicios, auth, tenantId: alta.tenantId, validacion, motor };
}
type Contexto = Awaited<ReturnType<typeof preparar>>;

async function productoVacio(c: Contexto) {
  const categoria = await c.tx.productoCategoriaComercial.create({
    data: { codigo: randomUUID(), nombre: 'QA' },
  });
  const subcategoria = await c.tx.productoSubcategoriaComercial.create({
    data: {
      categoriaId: categoria.id,
      codigo: randomUUID(),
      nombre: 'QA',
      atributosSchemaJson: {},
    },
  });
  return c.tx.producto.create({
    data: {
      tenantId: c.tenantId,
      codigo: 'QA-PRIMERO',
      nombre: 'Primer producto',
      subcategoriaComercialId: subcategoria.id,
      dimensionesRequeridas: [],
      precioConfigJson: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 40, minimumMarginPct: 25 },
      },
    },
  });
}

async function agregarRuta(
  c: Contexto,
  productoId: string,
  familiaCodigo: string,
) {
  const ruta = await c.tx.ruta.create({
    data: { tenantId: c.tenantId, codigo: 'QA-RUTA', nombre: 'Primera ruta' },
  });
  const paso = await c.tx.rutaPaso.create({
    data: { tenantId: c.tenantId, rutaId: ruta.id, orden: 0, familiaCodigo },
  });
  await c.tx.rutaVersion.create({
    data: {
      tenantId: c.tenantId,
      rutaId: ruta.id,
      version: 1,
      snapshotJson: {
        pasos: [{ id: paso.id, orden: 0, familia: familiaCodigo }],
      },
    },
  });
  const alternativa = await c.tx.productoRutaAlternativa.create({
    data: {
      tenantId: c.tenantId,
      productoId,
      rutaId: ruta.id,
      rutaVersion: 1,
      nombre: 'Principal',
      esPreferida: true,
    },
  });
  const config = await c.tx.productoConfigPaso.create({
    data: {
      tenantId: c.tenantId,
      productoRutaAlternativaId: alternativa.id,
      rutaPasoId: paso.id,
      modoActivacion: 'OBLIGATORIO',
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
    },
  });
  return { config, paso, alternativa };
}

describe('alta sin recursos', () => {
  it.each(['registro_publico', 'plataforma'] as const)(
    '%s: crea acceso y región, sin estructura operativa',
    async (origen) => {
      await escenario(async (c) => {
        const t = await c.tx.tenant.findUniqueOrThrow({
          where: { id: c.tenantId },
        });
        expect(Boolean(t.onboardingCompletadoEl)).toBe(origen === 'plataforma');
        expect(
          await c.tx.datosEmpresa.findUnique({
            where: { tenantId: c.tenantId },
          }),
        ).toMatchObject({
          paisCodigo: 'CL',
          monedaCodigo: 'CLP',
          zonaHoraria: 'America/Santiago',
        });
        expect(
          await c.tx.rol.count({ where: { tenantId: c.tenantId } }),
        ).toBeGreaterThan(0);
        const where = { tenantId: c.tenantId };
        expect(
          await Promise.all([
            c.tx.planta.count({ where }),
            c.tx.maquina.count({ where }),
            c.tx.materiaPrima.count({ where }),
            c.tx.producto.count({ where }),
          ]),
        ).toEqual([0, 0, 0, 0]);
      }, origen);
    },
  );

  it('caracteriza el cierre de bienvenida: hoy permite completarlo sin productos', async () => {
    await escenario(async (c) => {
      const registro = new RegistroService(
        c.prisma as never,
        {} as never,
        new TenantProvisioningService(),
        {} as never,
      );
      await registro.completarOnboarding(c.auth);
      expect(
        (await c.tx.tenant.findUniqueOrThrow({ where: { id: c.tenantId } }))
          .onboardingCompletadoEl,
      ).not.toBeNull();
      expect(
        await c.tx.producto.count({ where: { tenantId: c.tenantId } }),
      ).toBe(0);
    });
  });
});

describe('producción propia: dependencias antes de cotizar', () => {
  it.each(['impresion_por_hoja', 'impresion_por_area'])(
    '%s: producto y ruta solos no completan los recursos',
    async (familia) => {
      await escenario(async (c) => {
        const producto = await productoVacio(c);
        expect(
          (
            await c.validacion.validarProducto(c.tenantId, producto.id)
          ).errores.map((e) => e.codigo),
        ).toContain('sin_rutas_alternativas');
        await agregarRuta(c, producto.id, familia);
        const validacion = await c.validacion.validarProducto(
          c.tenantId,
          producto.id,
        );
        expect(validacion.exitoso).toBe(false);
        expect(validacion.errores.map((e) => e.codigo)).toEqual(
          expect.arrayContaining([
            'maquina_m1_faltante',
            'consumibles_maquina_sin_maquina',
          ]),
        );
      });
    },
  );

  it('digital: la plantilla de centro de copiado no se instala en una cuenta sin impresora', async () => {
    await escenario(async (c) => {
      // Catálogo global: no se copia configuración de otro tenant.
      await c.tx.productoSubcategoriaComercial.findUniqueOrThrow({
        where: { codigo: 'papeleria_comercial' },
      });
      expect(
        await provisionarPlantillaCentroCopiado(c.prisma as never, c.tenantId),
      ).toEqual({ estado: 'omitido', motivo: 'sin IMPRESORA_LASER' });
      expect(
        await c.tx.producto.count({ where: { tenantId: c.tenantId } }),
      ).toBe(0);
    });
  });

  it('reinstalar materiales agrega faltantes sin pisar costos confirmados ni inventar stock', async () => {
    await escenario(async (c) => {
      const preset = await c.tx.materialPreset.findFirstOrThrow({
        where: {
          activo: true,
          subfamilia: 'SUSTRATO_HOJA',
          variantes: { some: { activo: true } },
        },
        include: { variantes: { where: { activo: true }, take: 1 } },
      });
      const biblioteca = new InventarioBibliotecaService(c.prisma as never);
      const payload = {
        codigo: 'QA-PAPEL',
        visibleName: 'Papel de prueba',
        variantPresetIds: [preset.variantes[0].id],
        modoDuplicado: ModoDuplicadoMaterialPresetDto.agregar_faltantes,
      };
      await biblioteca.instalar(c.auth, preset.key, payload);
      const variante = await c.tx.materiaPrimaVariante.findFirstOrThrow({
        where: { tenantId: c.tenantId },
      });
      // La biblioteca técnica no declara de qué unidad es el precio importado.
      expect(variante.unidadPrecio).toBeNull();
      await c.tx.materiaPrimaVariante.update({
        where: { id: variante.id },
        data: { precioReferencia: 123, unidadPrecio: 'HOJA' },
      });
      await biblioteca.instalar(c.auth, preset.key, payload);
      expect(
        await c.tx.materiaPrimaVariante.count({
          where: { tenantId: c.tenantId },
        }),
      ).toBe(1);
      expect(
        Number(
          (
            await c.tx.materiaPrimaVariante.findUniqueOrThrow({
              where: { id: variante.id },
            })
          ).precioReferencia,
        ),
      ).toBe(123);
      expect(
        await c.tx.stockMateriaPrimaVariante.count({
          where: { tenantId: c.tenantId },
        }),
      ).toBe(0);
    });
  });

  it('gran formato: precio por rollo y por litro se convierten a la unidad de uso', async () => {
    await escenario(async (c) => {
      const rollo = await c.tx.materiaPrima.create({
        data: {
          tenantId: c.tenantId,
          codigo: 'ROLLO-QA',
          nombre: 'Rollo sintético',
          familia: 'SUSTRATO',
          subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
          templateId: 'sustrato_rollo_v1',
          tipoTecnico: 'lona',
          unidadStock: 'METRO_LINEAL',
          unidadCompra: 'ROLLO',
          atributosTecnicosJson: {},
        },
      });
      const variante = await c.tx.materiaPrimaVariante.create({
        data: {
          tenantId: c.tenantId,
          materiaPrimaId: rollo.id,
          sku: 'ROLLO-QA',
          atributosVarianteJson: { anchoMm: 1000, largoM: 50 },
          precioReferencia: 50000,
          unidadPrecio: 'ROLLO',
          equivalenciaCompra: 50,
        },
        include: { materiaPrima: true },
      });
      expect(normalizedMaterialPrice(variante)).toBe(1000);
      const tinta = await c.tx.materiaPrima.create({
        data: {
          tenantId: c.tenantId,
          codigo: 'TINTA-QA',
          nombre: 'Tinta sintética',
          familia: 'TINTA_COLORANTE',
          subfamilia: 'TINTA_IMPRESION',
          templateId: 'tinta_v1',
          tipoTecnico: 'tinta',
          unidadStock: 'ML',
          unidadCompra: 'LITRO',
          atributosTecnicosJson: {},
        },
      });
      const color = await c.tx.materiaPrimaVariante.create({
        data: {
          tenantId: c.tenantId,
          materiaPrimaId: tinta.id,
          sku: 'TINTA-QA',
          atributosVarianteJson: {},
          precioReferencia: 30000,
          unidadPrecio: 'LITRO',
        },
        include: { materiaPrima: true },
      });
      expect(normalizedMaterialPrice(color)).toBe(30);
      expect(
        await c.tx.stockMateriaPrimaVariante.count({
          where: { tenantId: c.tenantId },
        }),
      ).toBe(0);
    });
  });

  it('crear centro resuelve la planta, pero publicar tarifa exige capacidad y costos', async () => {
    await escenario(async (c) => {
      const mapper = new CostosMapper();
      const validaciones = new CostosValidacionesService(c.prisma as never);
      const centros = new CostosCatalogoService(
        c.prisma as never,
        mapper,
        validaciones,
      );
      const tarifas = new CostosTarifasService(
        c.prisma as never,
        mapper,
        new CostosRepartoService(c.prisma as never, mapper),
        validaciones,
      );
      const centro = await centros.createCentro(c.auth, {
        codigo: 'QA-IMP',
        nombre: 'Impresión',
        tipoCentro: TipoCentroCostoDto.productivo,
        activo: true,
      });
      expect(await c.tx.planta.count({ where: { tenantId: c.tenantId } })).toBe(
        1,
      );
      await tarifas.recalcularYPublicarPeriodo(c.auth, '2026-09');
      expect(
        await c.tx.centroCostoTarifaPeriodo.count({
          where: { tenantId: c.tenantId, estado: 'PUBLICADA' },
        }),
      ).toBe(0);
      await c.tx.centroCostoCapacidadPeriodo.create({
        data: {
          tenantId: c.tenantId,
          centroCostoId: centro.id,
          periodo: '2026-09',
          horasProductivas: 100,
        },
      });
      await c.tx.centroCostoLinea.create({
        data: {
          tenantId: c.tenantId,
          centroCostoId: centro.id,
          periodo: '2026-09',
          seccion: 'GASTO_GENERAL',
          nombre: 'Gasto sintético',
          importeMensual: 100000,
        },
      });
      await tarifas.recalcularYPublicarPeriodo(c.auth, '2026-09');
      const tarifa = await c.tx.centroCostoTarifaPeriodo.findFirstOrThrow({
        where: { tenantId: c.tenantId, estado: 'PUBLICADA' },
      });
      expect(Number(tarifa.tarifaCalculada)).toBe(1000);
    });
  });
});

it.each(['digital', 'gran-formato', 'mixto'] as const)(
  '%s: recursos nuevos → cotización → OT → entrega',
  async (tipo) => {
    await escenario(async (c) => {
      const digital = tipo !== 'gran-formato';
      const mapper = new CostosMapper();
      const validaciones = new CostosValidacionesService(c.prisma as never);
      const centros = new CostosCatalogoService(
        c.prisma as never,
        mapper,
        validaciones,
      );
      const centro = await centros.createCentro(c.auth, {
        codigo: 'IMP',
        nombre: 'Impresión',
        tipoCentro: TipoCentroCostoDto.productivo,
        activo: true,
      });
      const planta = await c.tx.planta.findFirstOrThrow({
        where: { tenantId: c.tenantId },
      });
      await c.tx.centroCostoCapacidadPeriodo.create({
        data: {
          tenantId: c.tenantId,
          centroCostoId: centro.id,
          periodo: '2026-09',
          horasProductivas: 100,
        },
      });
      await c.tx.centroCostoLinea.create({
        data: {
          tenantId: c.tenantId,
          centroCostoId: centro.id,
          periodo: '2026-09',
          seccion: 'GASTO_GENERAL',
          nombre: 'Gasto sintético',
          importeMensual: 100000,
        },
      });
      await new CostosTarifasService(
        c.prisma as never,
        mapper,
        new CostosRepartoService(c.prisma as never, mapper),
        validaciones,
      ).recalcularYPublicarPeriodo(c.auth, '2026-09');
      const soporte = await c.tx.materiaPrima.create({
        data: {
          tenantId: c.tenantId,
          codigo: 'SOPORTE',
          nombre: digital ? 'Papel obra' : 'Lona',
          familia: 'SUSTRATO',
          subfamilia: digital ? 'SUSTRATO_HOJA' : 'SUSTRATO_ROLLO_FLEXIBLE',
          templateId: digital ? 'papel_hoja_v1' : 'sustrato_rollo_v1',
          tipoTecnico: digital ? 'papel' : 'lona',
          unidadStock: digital ? 'HOJA' : 'METRO_LINEAL',
          unidadCompra: digital ? 'HOJA' : 'METRO_LINEAL',
          atributosTecnicosJson: {},
        },
      });
      const sustrato = await c.tx.materiaPrimaVariante.create({
        data: {
          tenantId: c.tenantId,
          materiaPrimaId: soporte.id,
          sku: 'SOPORTE',
          precioReferencia: digital ? 10 : 1000,
          moneda: 'CLP',
          unidadPrecio: digital ? 'HOJA' : 'METRO_LINEAL',
          atributosVarianteJson: digital
            ? { anchoMm: 210, altoMm: 297, largoMm: 297, gramaje: 80 }
            : { anchoMm: 1000, largoM: 50 },
        },
      });
      const pigmento = await c.tx.materiaPrima.create({
        data: {
          tenantId: c.tenantId,
          codigo: 'NEGRO',
          nombre: 'Pigmento negro',
          familia: 'TINTA_COLORANTE',
          subfamilia: digital ? 'TONER' : 'TINTA_IMPRESION',
          templateId: digital ? 'toner_v1' : 'tinta_v1',
          tipoTecnico: digital ? 'toner' : 'tinta',
          esConsumible: true,
          unidadStock: digital ? 'GRAMO' : 'ML',
          unidadCompra: digital ? 'GRAMO' : 'ML',
          atributosTecnicosJson: {},
        },
      });
      const negro = await c.tx.materiaPrimaVariante.create({
        data: {
          tenantId: c.tenantId,
          materiaPrimaId: pigmento.id,
          sku: 'NEGRO',
          precioReferencia: 30,
          unidadPrecio: digital ? 'GRAMO' : 'ML',
          moneda: 'CLP',
          atributosVarianteJson: { color: 'negro' },
        },
      });
      const perfilId = randomUUID();
      const maquina = await new MaquinariaService(c.prisma as never).create(
        c.auth,
        {
          nombre: `QA ${tipo}`,
          plantilla: digital
            ? M.PlantillaMaquinariaDto.impresora_laser
            : M.PlantillaMaquinariaDto.impresora_gran_formato_por_area,
          plantaId: planta.id,
          centroCostoPrincipalId: centro.id,
          estado: M.EstadoMaquinaDto.activa,
          activo: true,
          geometriaTrabajo: digital
            ? M.GeometriaTrabajoMaquinaDto.pliego
            : M.GeometriaTrabajoMaquinaDto.rollo,
          unidadProduccionPrincipal: digital
            ? M.UnidadProduccionMaquinaDto.ppm
            : M.UnidadProduccionMaquinaDto.m2_h,
          anchoUtil: digital ? 210 : 1000,
          largoUtil: digital ? 297 : undefined,
          parametrosTecnicos: {
            coloresSoportados: ['BN'],
            margenesNoImprimiblesMm: { sup: 0, inf: 0, izq: 0, der: 0 },
            ...(digital
              ? { soporteDobleFaz: false }
              : {
                  tecnologia: 'SOLVENTE',
                  geometria: 'ROLLO',
                  anchoMinRolloMm: 500,
                  anchoMaxRolloMm: 1000,
                }),
          },
          perfilesOperativos: [
            {
              id: perfilId,
              nombre: 'B/N simple',
              tipoPerfil: M.TipoPerfilOperativoMaquinaDto.impresion,
              activo: true,
              productivityValue: 30,
              productivityUnit: digital
                ? M.UnidadProduccionMaquinaDto.ppm
                : M.UnidadProduccionMaquinaDto.m2_h,
              setupMin: 2,
              cleanupMin: 1,
              detalle: digital
                ? { caras: 'SIMPLE_FAZ', colores: ['BN'], gramajeMaxGr: 300 }
                : { colores: ['BN'] },
            },
          ],
          consumibles: [
            {
              nombre: 'Negro',
              materiaPrimaVarianteId: negro.id,
              perfilOperativoId: perfilId,
              tipo: digital
                ? M.TipoConsumibleMaquinaDto.toner
                : M.TipoConsumibleMaquinaDto.tinta,
              unidad: digital
                ? M.UnidadConsumoMaquinaDto.gramo
                : M.UnidadConsumoMaquinaDto.ml,
              consumoBase: 1,
              activo: true,
              detalle: { color: 'negro' },
            },
          ],
          componentesDesgaste: digital
            ? [
                {
                  nombre: 'Drum',
                  tipo: M.TipoComponenteDesgasteMaquinaDto.drum,
                  unidadDesgaste: M.UnidadDesgasteMaquinaDto.copias_a4_equiv,
                  vidaUtilEstimada: 100000,
                  precioUnitario: 50000,
                  activo: true,
                },
              ]
            : [],
        },
      );
      expect(maquina.estadoConfiguracion).toBe('lista');
      const producto = await productoVacio(c);
      const { config, paso, alternativa } = await agregarRuta(
        c,
        producto.id,
        digital ? 'impresion_por_hoja' : 'impresion_por_area',
      );
      await c.tx.productoConfigPaso.update({
        where: { id: config.id },
        data: {
          maquinaM1Id: maquina.id,
          perfilM1Id: maquina.perfilesOperativos[0].id,
          paramsPasoJson: {
            nestingConfig: {
              ...(digital
                ? { pliegoImpresion: { anchoMm: 210, altoMm: 297 } }
                : {}),
              allowRotation: false,
              extraMargins: { topMm: 0, leftMm: 0, rightMm: 0, bottomMm: 0 },
            },
          },
        },
      });
      await c.tx.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId: c.tenantId,
          productoConfigPasoId: config.id,
          slotCodigo: 'sustrato_principal',
          modoSeleccion: 'HARDCODED',
          materialVarianteId: sustrato.id,
          formula: 'por_unidad_productiva',
        },
      });
      if (tipo === 'mixto') {
        const proveedor = await c.tx.proveedor.create({
          data: {
            tenantId: c.tenantId,
            nombre: 'Terminación externa QA',
            emailPrincipal: 'terminacion@example.test',
            telefonoCodigo: '56',
            telefonoNumero: '',
            paisCodigo: 'CL',
          },
        });
        const externo = await c.tx.rutaPaso.create({
          data: {
            tenantId: c.tenantId,
            rutaId: paso.rutaId,
            orden: 1,
            familiaCodigo: 'trabajo_manual',
          },
        });
        await c.tx.productoConfigPaso.create({
          data: {
            tenantId: c.tenantId,
            productoRutaAlternativaId: alternativa.id,
            rutaPasoId: externo.id,
            modoActivacion: 'OBLIGATORIO',
            tercerizado: true,
            proveedorId: proveedor.id,
            fuenteCostoTercerizado: 'fijo',
            tercerizadoConfigJson: { costo: 1000, por: 'trabajo' },
            plazoProveedorDias: 2,
          },
        });
        await c.tx.rutaVersion.updateMany({
          where: { tenantId: c.tenantId, rutaId: paso.rutaId, version: 1 },
          data: {
            snapshotJson: {
              pasos: [paso, externo].map((p) => ({
                id: p.id,
                orden: p.orden,
                familia: p.familiaCodigo,
              })),
            },
          },
        });
      }
      expect(
        (await c.validacion.validarProducto(c.tenantId, producto.id)).errores,
      ).toEqual([]);
      const guardada = await c.motor.cotizarYGuardar({
        tenantId: c.tenantId,
        productoId: producto.id,
        periodo: '2026-09',
        jobContext: {
          cantidad: digital ? 10 : 2,
          medidaCustomMm: {
            anchoMm: digital ? 210 : 400,
            altoMm: digital ? 297 : 600,
          },
          caras: 1,
        },
      });
      expect(guardada.result.errores).toEqual([]);
      expect(guardada.result.cotizacion?.costos.tiempoTotal).toBeGreaterThan(0);
      expect(
        guardada.result.cotizacion?.costos.materialesTotal,
      ).toBeGreaterThan(0);
      expect(guardada.result.cotizacion?.costos.tercerizadoTotal).toBe(
        tipo === 'mixto' ? 1000 : 0,
      );
      expect(guardada.cotizacionItemId).toBeTruthy();
      const cotizado = await c.tx.cotizacionItem.findUniqueOrThrow({
        where: { id: guardada.cotizacionItemId! },
      });
      expect(Number(cotizado.precioTotal)).toBeGreaterThan(0);
      const cliente = await c.tx.cliente.create({
        data: {
          tenantId: c.tenantId,
          nombre: 'Cliente QA',
          paisCodigo: 'CL',
          telefonoCodigo: '56',
          telefonoNumero: '',
        },
      });
      const orden = await c.ordenes.create(c.auth, {
        idempotencyKey: randomUUID(),
        estado: 'pendiente',
        clienteId: cliente.id,
        cotizacionId: guardada.cotizacionId!,
        fechaEntrega: '2099-12-01',
        items: [
          {
            cotizacionItemId: cotizado.id,
            codigo: producto.codigo,
            nombre: producto.nombre,
            familia: tipo,
            cantidad: Number(cotizado.cantidad),
            cantidadUnidad: 'unidad',
            subtotal: 0,
            impuestos: 0,
            total: 0,
          },
        ],
      });
      expect(
        (await ejecutarOrdenF4(c.tx, c.ordenes, c.auth, orden.id)).ejecutados,
      ).toBe(tipo === 'mixto' ? 2 : 1);
      const item = await c.tx.ordenTrabajoItem.findFirstOrThrow({
        where: { ordenId: orden.id },
      });
      await new EntregaService(
        c.prisma as never,
        {} as never,
        new FidelizacionService(c.prisma as never),
      ).entregar(c.auth, orden.id, { itemIds: [item.id] });
      expect(
        (await c.tx.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } }))
          .estado,
      ).toBe('entregada');
      expect(
        await c.tx.stockMateriaPrimaVariante.count({
          where: { tenantId: c.tenantId },
        }),
      ).toBe(0);
    });
  },
);

it('tercerizador: cotiza, emite, recibe y entrega sin máquinas, materiales ni centros propios', async () => {
  await escenario(async (c) => {
    const producto = await productoVacio(c);
    const { config } = await agregarRuta(c, producto.id, 'impresion_por_hoja');
    await c.tx.productoConfigPaso.update({
      where: { id: config.id },
      data: { tercerizado: true },
    });
    const incompleto = await c.validacion.validarProducto(
      c.tenantId,
      producto.id,
    );
    expect(incompleto.errores.map((e) => e.codigo)).toEqual(
      expect.arrayContaining([
        'tercerizado_sin_plazo_proveedor',
        'tercerizado_sin_fuente',
      ]),
    );
    const proveedor = await c.tx.proveedor.create({
      data: {
        tenantId: c.tenantId,
        nombre: 'Proveedor sintético',
        emailPrincipal: 'proveedor@example.test',
        telefonoCodigo: '56',
        telefonoNumero: '',
        paisCodigo: 'CL',
      },
    });
    await c.tx.productoConfigPaso.update({
      where: { id: config.id },
      data: {
        proveedorId: proveedor.id,
        fuenteCostoTercerizado: 'fijo',
        tercerizadoConfigJson: { costo: 12000, por: 'trabajo' },
        plazoProveedorDias: 3,
      },
    });
    expect(
      (await c.validacion.validarProducto(c.tenantId, producto.id)).exitoso,
    ).toBe(true);
    const cotizacion = await c.motor.cotizarYGuardar({
      tenantId: c.tenantId,
      productoId: producto.id,
      periodo: '2026-09',
      jobContext: { cantidad: 100 },
    });
    expect(cotizacion.result.errores).toEqual([]);
    expect(cotizacion.result.cotizacion?.costos.tercerizadoTotal).toBe(12000);
    expect(cotizacion.result.cotizacion?.costos.materialesTotal).toBe(0);
    expect(cotizacion.result.cotizacion?.costos.tiempoTotal).toBe(0);
    expect(cotizacion.cotizacionItemId).toBeTruthy();
    const snapshot = await c.tx.cotizacionItem.findUniqueOrThrow({
      where: { id: cotizacion.cotizacionItemId! },
    });
    expect(Number(snapshot.precioTotal)).toBeGreaterThan(12000);
    const cliente = await c.tx.cliente.create({
      data: {
        tenantId: c.tenantId,
        nombre: 'Cliente sintético',
        paisCodigo: 'CL',
        telefonoCodigo: '56',
        telefonoNumero: '',
      },
    });
    const ot = await c.ordenes.create(c.auth, {
      idempotencyKey: randomUUID(),
      estado: 'pendiente',
      clienteId: cliente.id,
      fechaEntrega: '2099-12-01',
      cotizacionId: cotizacion.cotizacionId!,
      items: [
        {
          cotizacionItemId: snapshot.id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          familia: 'Tercerizado',
          cantidad: 100,
          cantidadUnidad: 'unidad',
          subtotal: 0,
          impuestos: 0,
          total: 0,
        },
      ],
    });
    const item = await c.tx.ordenTrabajoItem.findFirstOrThrow({
      where: { ordenId: ot.id },
    });
    // No se solicita cobro en esta prueba; ese circuito se valida por separado.
    const entrega = new EntregaService(
      c.prisma as never,
      {} as never,
      new FidelizacionService(c.prisma as never),
    );
    await expect(
      entrega.entregar(c.auth, ot.id, { itemIds: [item.id] }),
    ).rejects.toThrow(/producción/);
    const ejecutada = await ejecutarOrdenF4(c.tx, c.ordenes, c.auth, ot.id);
    expect(ejecutada.ejecutados).toBe(1);
    await entrega.entregar(c.auth, ot.id, { itemIds: [item.id] });
    expect(
      (await c.tx.ordenTrabajo.findUniqueOrThrow({ where: { id: ot.id } }))
        .estado,
    ).toBe('entregada');
    expect(await c.tx.maquina.count({ where: { tenantId: c.tenantId } })).toBe(
      0,
    );
    expect(
      await c.tx.materiaPrima.count({ where: { tenantId: c.tenantId } }),
    ).toBe(0);
    expect(
      await c.tx.centroCosto.count({ where: { tenantId: c.tenantId } }),
    ).toBe(0);
  });
});
