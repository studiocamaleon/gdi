/**
 * C.1 — Test end-to-end del dispatcher en modo SHADOW.
 *
 * Usa un producto digital con motor v1 + v2 ambos registrados (C.4 piloto).
 * En SHADOW mode: retorna v1, corre v2 en paralelo y loguea el diff.
 *
 * Flujo validado:
 *   1. Setea motorPreferido=SHADOW para el producto digital.
 *   2. Cotiza → devuelve shape canónica (v1 adaptada).
 *   3. Se persiste una entrada en CotizacionShadowLog con totalV1, totalV2, diff.
 *   4. Revierte a V1 para no dejar estado sucio.
 */
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosServiciosService } from '../productos-servicios.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizacionCanonica } from '../dto/cotizacion-canonica.dto';

const TENANT_ID = '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8';
const PRODUCTO_TARJETAS_ID = '44e4133f-d097-472b-9d20-7bb6084a57b6';
const VARIANTE_TARJETAS_ESTANDAR_ID = '947969f5-442f-4ede-b43b-26df9a3a4e8a';

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'shadow-dispatch-test',
  tenantId: TENANT_ID,
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

describe('Dispatcher cotizarVarianteV2 — modo SHADOW (C.1)', () => {
  let prisma: PrismaService;
  let service: ProductosServiciosService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ProductosServiciosService(prisma);
  });

  afterAll(async () => {
    // Siempre devolver el producto a V1 post-test.
    await prisma.productoServicio.update({
      where: { id: PRODUCTO_TARJETAS_ID },
      data: { motorPreferido: 'V1' },
    });
    await prisma.$disconnect();
  });

  it('en modo SHADOW con v1 real + v2 piloto: devuelve v1, loguea diff v1 vs v2', async () => {
    await prisma.productoServicio.update({
      where: { id: PRODUCTO_TARJETAS_ID },
      data: { motorPreferido: 'SHADOW' },
    });

    const logsAntes = await prisma.cotizacionShadowLog.count({
      where: { tenantId: TENANT_ID, productoServicioId: PRODUCTO_TARJETAS_ID },
    });

    const resultado = (await service.cotizarVarianteV2(
      AUTH,
      VARIANTE_TARJETAS_ESTANDAR_ID,
      {
        cantidad: 500,
        periodo: '2026-04',
        seleccionesBase: [{ dimension: 'caras', valor: 'doble_faz' }],
      } as never,
    )) as CotizacionCanonica;

    // Respuesta: shape canónica (v1 adaptada)
    expect(resultado).toBeDefined();
    expect(resultado.motorCodigo).toContain('adapter:v1');
    expect(resultado.total).toBeGreaterThan(0);
    expect(resultado.subtotales).toBeDefined();

    // Esperar fire-and-forget
    await new Promise((r) => setTimeout(r, 500));

    const logsDespues = await prisma.cotizacionShadowLog.count({
      where: { tenantId: TENANT_ID, productoServicioId: PRODUCTO_TARJETAS_ID },
    });
    expect(logsDespues).toBe(logsAntes + 1);

    const ultimo = await prisma.cotizacionShadowLog.findFirst({
      where: { tenantId: TENANT_ID, productoServicioId: PRODUCTO_TARJETAS_ID },
      orderBy: { createdAt: 'desc' },
    });
    expect(ultimo).not.toBeNull();
    expect(ultimo?.motorCodigo).toBe('impresion_digital_laser');
    expect(Number(ultimo?.totalV1)).toBeGreaterThan(0);
    expect(Number(ultimo?.totalV2)).toBeGreaterThan(0); // v2 piloto ahora produce cotización
    expect(ultimo?.inputHash).toHaveLength(16);

    // El piloto v2 usa fórmulas simplificadas — se espera diff != 0 con v1.
    const anomalias = ultimo?.anomalias as unknown as Array<{ tipo: string; detalle: string }>;
    expect(Array.isArray(anomalias)).toBe(true);
  });

  it('en modo V1 (default): NO persiste log de shadow', async () => {
    await prisma.productoServicio.update({
      where: { id: PRODUCTO_TARJETAS_ID },
      data: { motorPreferido: 'V1' },
    });

    const logsAntes = await prisma.cotizacionShadowLog.count({
      where: { tenantId: TENANT_ID, productoServicioId: PRODUCTO_TARJETAS_ID },
    });

    const resultado = (await service.cotizarVarianteV2(
      AUTH,
      VARIANTE_TARJETAS_ESTANDAR_ID,
      {
        cantidad: 500,
        periodo: '2026-04',
        seleccionesBase: [{ dimension: 'caras', valor: 'doble_faz' }],
      } as never,
    )) as CotizacionCanonica;

    expect(resultado).toBeDefined();
    await new Promise((r) => setTimeout(r, 300));

    const logsDespues = await prisma.cotizacionShadowLog.count({
      where: { tenantId: TENANT_ID, productoServicioId: PRODUCTO_TARJETAS_ID },
    });
    expect(logsDespues).toBe(logsAntes);
  });
});
