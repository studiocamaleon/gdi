import { randomUUID } from 'node:crypto';
import { PrismaClient, RolSistema, TipoCentroCosto } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import { CostosCatalogoService } from '../costos-catalogo.service';
import { CostosConfiguracionPeriodoService } from '../costos-configuracion-periodo.service';
import { CostosMapper } from '../costos.mapper';
import { CostosRepartoService } from '../costos-reparto.service';
import { CostosTarifasService } from '../costos-tarifas.service';
import { CostosValidacionesService } from '../costos-validaciones.service';
import { TipoCentroCostoDto } from '../dto/upsert-centro-costo.dto';
import {
  CentroCostoLineaItemDto,
  SeccionCentroCostoLineaDto,
} from '../dto/replace-centro-lineas.dto';

describe('guardar planilla de centro de costo (PostgreSQL)', () => {
  const db = new PrismaClient();
  const prisma = db as unknown as PrismaService;
  const mapper = new CostosMapper();
  const validaciones = new CostosValidacionesService(prisma);
  const reparto = new CostosRepartoService(prisma, mapper);
  const tarifas = new CostosTarifasService(
    prisma,
    mapper,
    reparto,
    validaciones,
  );
  const configuracion = new CostosConfiguracionPeriodoService(
    prisma,
    mapper,
    validaciones,
    reparto,
    tarifas,
    new CostosCatalogoService(prisma, mapper, validaciones),
  );

  afterAll(() => db.$disconnect());

  it('copia las tres secciones del mes anterior, publica la tarifa y conserva el origen', async () => {
    const tenant = await db.tenant.create({
      data: {
        nombre: 'Prueba planilla',
        slug: `prueba-planilla-${randomUUID()}`,
      },
    });
    const auth: CurrentAuth = {
      tenantId: tenant.id,
      userId: randomUUID(),
      sessionId: randomUUID(),
      membershipId: randomUUID(),
      email: 'prueba-planilla@example.test',
      role: RolSistema.ADMINISTRADOR,
    };
    try {
      const planta = await db.planta.create({
        data: { tenantId: tenant.id, codigo: 'PLT', nombre: 'Taller' },
      });
      const centro = await db.centroCosto.create({
        data: {
          tenantId: tenant.id,
          plantaId: planta.id,
          codigo: 'IMP',
          nombre: 'Impresión',
          tipoCentro: TipoCentroCosto.PRODUCTIVO,
        },
      });
      const estructura = await db.centroCosto.create({
        data: {
          tenantId: tenant.id,
          plantaId: planta.id,
          codigo: 'ADM',
          nombre: 'Administración',
          tipoCentro: TipoCentroCosto.NO_PRODUCTIVO,
        },
      });
      const lineas: CentroCostoLineaItemDto[] = [
        {
          seccion: SeccionCentroCostoLineaDto.gasto_general,
          nombre: 'Energía',
          valorMensual: 200,
        },
        {
          seccion: SeccionCentroCostoLineaDto.empleado,
          nombre: 'Operario',
          salarioMensual: 1000,
          cargasPct: 20,
          dedicacionPct: 50,
        },
        {
          seccion: SeccionCentroCostoLineaDto.activo_fijo,
          nombre: 'Impresora',
          valorActual: 2400,
          valorFinalVida: 0,
          vidaUtilRestanteMeses: 12,
        },
      ];
      await db.centroCostoLinea.createMany({
        data: lineas.map((linea, index) =>
          mapper.buildLineaData(auth, centro.id, '2026-08', linea, index),
        ),
      });
      await db.centroCostoCapacidadPeriodo.create({
        data: {
          tenantId: tenant.id,
          centroCostoId: centro.id,
          periodo: '2026-08',
          horasProductivas: 100,
        },
      });
      await db.centroCostoLinea.create({
        data: mapper.buildLineaData(
          auth,
          estructura.id,
          '2026-09',
          {
            seccion: SeccionCentroCostoLineaDto.gasto_general,
            nombre: 'Alquiler',
            valorMensual: 200,
          },
          0,
        ),
      });

      const anterior = await configuracion.getCentroConfiguracion(
        auth,
        centro.id,
        '2026-08',
      );
      // El navegador copia los valores editables; los IDs del período origen
      // no viajan como identidades de las filas que se van a guardar.
      const copiadas: CentroCostoLineaItemDto[] = anterior.lineas.map(
        (linea) => ({
          seccion: linea.seccion,
          nombre: linea.nombre,
          valorMensual: linea.importeMensual,
          salarioMensual: linea.salarioMensual ?? undefined,
          cargasPct: linea.cargasPct ?? undefined,
          dedicacionPct: linea.dedicacionPct ?? undefined,
          valorActual: linea.valorActual ?? undefined,
          valorFinalVida: linea.valorFinalVida ?? undefined,
          vidaUtilRestanteMeses: linea.vidaUtilRestanteMeses ?? undefined,
        }),
      );
      const payload = {
        id: centro.id,
        periodo: '2026-09',
        centro: {
          codigo: 'IMP',
          nombre: 'Impresión',
          tipoCentro: TipoCentroCostoDto.productivo,
          activo: true,
        },
        lineas: copiadas,
        horasProductivas: anterior.capacidad!.horasProductivas,
        expectedUpdatedAt: anterior.centro.updatedAt,
      };
      const resultado = await configuracion.guardarCentroPlanilla(
        auth,
        payload,
      );
      expect(resultado.publicada).toBe(true);
      expect(resultado.publicacion.centrosPublicados).toBe(1);
      const guardada = await configuracion.getCentroConfiguracion(
        auth,
        centro.id,
        '2026-09',
      );
      expect(guardada.lineas.map((linea) => linea.importeMensual)).toEqual([
        200, 600, 200,
      ]);
      expect(guardada.capacidad?.horasProductivas).toBe(100);
      expect(guardada.tarifaPublicada).toMatchObject({
        costoMensualTotal: 1200,
        tarifaCalculada: 12,
        costoMensualManoObra: 600,
        tarifaManoObra: 6,
      });
      expect(
        guardada.lineas.every(
          (linea) => !anterior.lineas.some((origen) => origen.id === linea.id),
        ),
      ).toBe(true);

      // Volver a guardar no duplica filas ni genera una nueva revisión si
      // los importes publicados no cambiaron.
      await configuracion.guardarCentroPlanilla(auth, {
        ...payload,
        expectedUpdatedAt: resultado.centro.updatedAt,
      });
      expect(
        await db.centroCostoTarifaRevision.count({
          where: { tenantId: tenant.id },
        }),
      ).toBe(1);
      expect(
        await db.centroCostoLinea.count({
          where: { centroCostoId: centro.id, periodo: '2026-09' },
        }),
      ).toBe(3);
      const origenConservado = await configuracion.getCentroConfiguracion(
        auth,
        centro.id,
        '2026-08',
      );
      expect(origenConservado.lineas).toEqual(anterior.lineas);
      expect(origenConservado.capacidad).toEqual(anterior.capacidad);
    } finally {
      // Sólo borra el tenant exclusivo de esta prueba; no depende del seed.
      await db.tenant.delete({ where: { id: tenant.id } });
    }
  }, 30_000);
});
