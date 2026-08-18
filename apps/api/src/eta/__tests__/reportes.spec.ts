import { EtaService } from '../eta.service';
import { parseRango, finExclusivo } from '../../reportes/periodo';

describe('EtaService en Reportes', () => {
  const rango = parseRango('2026-07-01', '2026-07-31');
  const findMany = jest.fn();
  const queryRaw = jest.fn();
  const prisma = {
    etaPromesa: { findMany },
    $queryRaw: queryRaw,
  };
  const service = new EtaService(prisma as never, {} as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filtra la precisión por la cohorte congelada en el rango', async () => {
    findMany.mockResolvedValue([{ errorMin: 30, sinEstimar: false }]);

    const resultado = await service.precisionEnRango('tenant-1', rango);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        finReal: { not: null },
        congeladaEl: { gte: rango.desde, lt: finExclusivo(rango) },
      },
      select: { errorMin: true, sinEstimar: true },
    });
    expect(resultado).toMatchObject({ cerradas: 1, muestras: 1, maeMin: 30 });
  });

  it('limita también la cobertura del modelo al período solicitado', async () => {
    findMany.mockResolvedValue([
      { sinEstimar: false, parcial: false },
      { sinEstimar: true, parcial: true },
    ]);
    queryRaw.mockResolvedValue([]);

    const resultado = await service.saludModelo('tenant-1', rango);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        congeladaEl: { gte: rango.desde, lt: finExclusivo(rango) },
      },
      select: { sinEstimar: true, parcial: true },
    });
    expect(resultado.cobertura).toEqual({
      promesas: 2,
      conEtaPct: 50,
      sinEstimarPct: 50,
      parcialPct: 50,
    });
  });
});
