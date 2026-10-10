import { validarPerfilesNiveles } from '../validar-perfiles-niveles';
const config = {
  maquinaM1Id: 'plotter',
  paramsPasoJson: {
    niveles: {
      opciones: [
        {
          codigo: 'a',
          nombre: 'Simple',
          overrides: { perfilesPorMaquina: { plotter: 'simple' } },
        },
        {
          codigo: 'b',
          nombre: 'Complejo',
          overrides: { perfilesPorMaquina: { plotter: 'complejo' } },
        },
      ],
    },
  },
};
function prisma(perfiles: Array<Record<string, unknown>>) {
  return {
    maquina: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'plotter', perfilesOperativos: perfiles }]),
    },
  };
}
it('consulta sólo máquinas activas de la empresa y perfiles activos', async () => {
  const db = prisma([
    { id: 'simple', tipoPerfil: 'CORTE' },
    { id: 'complejo', tipoPerfil: 'CORTE' },
  ]);
  await validarPerfilesNiveles(
    db as never,
    'empresa-demo',
    'plotter_corte',
    config,
  );
  expect(db.maquina.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'empresa-demo',
        id: { in: ['plotter'] },
      }),
      select: expect.objectContaining({
        perfilesOperativos: expect.objectContaining({
          where: { activo: true },
        }),
      }),
    }),
  );
});
it.each(['ausente', 'incompatible'])(
  'impide guardar perfil %s',
  async (caso) => {
    const db = prisma([
      { id: 'simple', tipoPerfil: 'CORTE' },
      ...(caso === 'ausente'
        ? []
        : [{ id: 'complejo', tipoPerfil: 'IMPRESION' }]),
    ]);
    await expect(
      validarPerfilesNiveles(
        db as never,
        'empresa-demo',
        'plotter_corte',
        config,
      ),
    ).rejects.toThrow('Complejo');
  },
);
it('configuraciones anteriores sin niveles no requieren consultas nuevas', async () => {
  const db = prisma([]);
  await validarPerfilesNiveles(db as never, 'empresa-demo', 'plotter_corte', {
    maquinaM1Id: 'plotter',
  });
  expect(db.maquina.findMany).not.toHaveBeenCalled();
});
it('ignora mapas de una máquina retirada y los valida si se vuelve a agregar', async () => {
  const db = prisma([]);
  await validarPerfilesNiveles(db as never, 'empresa-demo', 'plotter_corte', {
    ...config,
    maquinaM1Id: 'nueva',
  });
  expect(db.maquina.findMany).not.toHaveBeenCalled();
  await expect(
    validarPerfilesNiveles(db as never, 'empresa-demo', 'plotter_corte', {
      ...config,
      maquinaM1Id: 'nueva',
      maquinasCandidatas: [{ maquinaId: 'plotter' }],
    }),
  ).rejects.toThrow('Simple');
});
it('rechaza la mezcla con perfiles por operación antes de guardar', async () => {
  const db = prisma([]);
  await expect(
    validarPerfilesNiveles(db as never, 'empresa-demo', 'plotter_corte', {
      ...config,
      paramsPasoJson: {
        ...config.paramsPasoJson,
        cotizarOperacionesVectoriales: true,
      },
    }),
  ).rejects.toThrow('operación vectorial');
  expect(db.maquina.findMany).not.toHaveBeenCalled();
});
