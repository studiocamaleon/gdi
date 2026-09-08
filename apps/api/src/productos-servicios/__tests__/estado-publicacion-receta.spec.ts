import { motivosCambioEntreSnapshots } from '../estado-publicacion-receta';

describe('diagnóstico de publicación de recetas', () => {
  const base = {
    contractVersion: 1,
    producto: { id: 'producto-1', unidadComercial: 'unidad' },
    ruta: { alternativaId: 'ruta-1', rutaVersion: 1 },
    pasos: [
      {
        clave: 'paso-1',
        nombre: 'Impresión',
        familiaCodigo: 'IMPRESION',
        orden: 0,
        configuracion: { modoTiempo: 'POR_CANTIDAD' },
        slots: [{ slotCodigo: 'sustrato', materialVarianteId: 'vinilo-1' }],
        recurso: { maquina: { id: 'maquina-1' } },
      },
    ],
    cargosCotizacion: [],
    grafoProduccion: { aristas: [] },
    documentos: [],
    componentes: [],
    pasosCompuestos: [],
  };

  it('explica cambios de materiales y recursos por separado', () => {
    const actual = structuredClone(base);
    actual.pasos[0].slots[0].materialVarianteId = 'vinilo-2';
    actual.pasos[0].recurso = { maquina: { id: 'maquina-2' } };

    expect(motivosCambioEntreSnapshots(base, actual)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'MATERIALES' }),
        expect.objectContaining({ codigo: 'RECURSOS' }),
      ]),
    );
  });

  it('identifica cambios de componentes y no reporta motivos duplicados', () => {
    const actual = {
      ...base,
      componentes: [
        {
          codigo: 'FRENTE',
          recetaRevisionId: 'revision-hija-2',
          recetaVersion: 2,
        },
      ],
    };

    const motivos = motivosCambioEntreSnapshots(base, actual);
    expect(
      motivos.filter((motivo) => motivo.codigo === 'COMPONENTES'),
    ).toHaveLength(1);
  });

  it('no informa cambios cuando ambos snapshots son equivalentes', () => {
    expect(motivosCambioEntreSnapshots(base, structuredClone(base))).toEqual(
      [],
    );
  });
});
