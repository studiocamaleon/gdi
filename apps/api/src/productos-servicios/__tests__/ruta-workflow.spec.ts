import {
  leerWorkflowRuta,
  remapearPasosWorkflow,
  validarWorkflowRuta,
  workflowLinealDesdePasos,
  type RutaWorkflow,
} from '../ruta-workflow';

function workflowBacklight(): RutaWorkflow {
  return {
    contractVersion: 1,
    topologia: 'DAG',
    nodos: [
      {
        clave: 'componente:bastidor',
        tipo: 'COMPONENTE',
        orden: 0,
        productoComponenteId: '11111111-1111-4111-8111-111111111111',
        codigo: 'BASTIDOR',
        nombre: 'Bastidor Backlight',
        requerido: true,
      },
      {
        clave: 'componente:lona',
        tipo: 'COMPONENTE',
        orden: 1,
        productoComponenteId: '22222222-2222-4222-8222-222222222222',
        codigo: 'LONA',
        nombre: 'Lona Backlight',
        requerido: true,
      },
      {
        clave: 'borrador:ensamble',
        tipo: 'ETAPA',
        orden: 2,
        familiaCodigo: '33333333-3333-4333-8333-333333333333',
        nombreVisible: 'Ensamblaje final',
        icono: 'Layers',
      },
      {
        clave: 'borrador:control',
        tipo: 'PASO',
        orden: 3,
        familiaCodigo: 'control_calidad',
        nombreVisible: 'Control final',
        icono: 'Shield',
      },
    ],
    aristas: [
      {
        desdeClave: 'componente:bastidor',
        haciaClave: 'borrador:ensamble',
      },
      {
        desdeClave: 'componente:lona',
        haciaClave: 'borrador:ensamble',
      },
      {
        desdeClave: 'borrador:ensamble',
        haciaClave: 'borrador:control',
      },
    ],
  };
}

describe('Workflow de rutas de producción reutilizables', () => {
  it('proyecta las rutas históricas de pasos como un Workflow lineal', () => {
    const workflow = workflowLinealDesdePasos([
      {
        id: 'paso-1',
        orden: 1,
        familiaCodigo: 'impresion_por_area',
        nombreVisible: 'Impresión',
      },
      {
        id: 'paso-2',
        orden: 2,
        familiaCodigo: 'refilado',
        nombreVisible: 'Refilado',
      },
    ]);

    expect(workflow.topologia).toBe('LINEAL');
    expect(workflow.nodos.map((nodo) => nodo.clave)).toEqual([
      'ruta:paso-1',
      'ruta:paso-2',
    ]);
    expect(workflow.aristas).toEqual([
      { desdeClave: 'ruta:paso-1', haciaClave: 'ruta:paso-2' },
    ]);
  });

  it('acepta componentes paralelos que convergen en una etapa y luego un paso', () => {
    const workflow = validarWorkflowRuta(workflowBacklight());

    expect(workflow.topologia).toBe('DAG');
    expect(workflow.nodos).toHaveLength(4);
    expect(
      workflow.nodos.filter((nodo) => nodo.tipo === 'COMPONENTE'),
    ).toHaveLength(2);
  });

  it('rechaza ciclos antes de versionar la ruta', () => {
    const workflow = workflowBacklight();
    workflow.aristas.push({
      desdeClave: 'borrador:control',
      haciaClave: 'borrador:ensamble',
    });

    expect(() => validarWorkflowRuta(workflow)).toThrow();
  });

  it('rechaza un componente sin un único punto de incorporación', () => {
    const workflow = workflowBacklight();
    workflow.aristas = workflow.aristas.filter(
      (arista) => arista.desdeClave !== 'componente:lona',
    );

    expect(() => validarWorkflowRuta(workflow)).toThrow(
      'debe converger en un único Paso o Etapa',
    );
  });

  it('permite dos ocurrencias del mismo producto con identidades distintas', () => {
    const workflow = workflowBacklight();
    const lona = workflow.nodos.find(
      (nodo) => nodo.tipo === 'COMPONENTE' && nodo.codigo === 'LONA',
    );
    if (!lona || lona.tipo !== 'COMPONENTE') {
      throw new Error('Fixture de componente inválido');
    }
    lona.productoComponenteId = '11111111-1111-4111-8111-111111111111';

    const validado = validarWorkflowRuta(workflow);
    expect(
      validado.nodos
        .filter((nodo) => nodo.tipo === 'COMPONENTE')
        .map((nodo) => ({
          productoId: nodo.productoComponenteId,
          codigo: nodo.codigo,
        })),
    ).toEqual(
      expect.arrayContaining([
        {
          productoId: '11111111-1111-4111-8111-111111111111',
          codigo: 'BASTIDOR',
        },
        {
          productoId: '11111111-1111-4111-8111-111111111111',
          codigo: 'LONA',
        },
      ]),
    );
  });

  it('sigue rechazando dos ocurrencias con el mismo código interno', () => {
    const workflow = workflowBacklight();
    const lona = workflow.nodos.find(
      (nodo) => nodo.tipo === 'COMPONENTE' && nodo.codigo === 'LONA',
    );
    if (!lona || lona.tipo !== 'COMPONENTE') {
      throw new Error('Fixture de componente inválido');
    }
    lona.codigo = 'BASTIDOR';

    expect(() => validarWorkflowRuta(workflow)).toThrow(
      'está repetido en la ruta',
    );
  });

  it('remapea los nodos operativos a los IDs persistidos sin perder el DAG', () => {
    const remapeado = remapearPasosWorkflow(workflowBacklight(), [
      {
        id: 'paso-persistido-1',
        orden: 1,
        familiaCodigo: '33333333-3333-4333-8333-333333333333',
        nombreVisible: 'Ensamblaje final',
        icono: 'Layers',
      },
      {
        id: 'paso-persistido-2',
        orden: 2,
        familiaCodigo: 'control_calidad',
        nombreVisible: 'Control final',
        icono: 'Shield',
      },
    ]);

    expect(remapeado.nodos.map((nodo) => nodo.clave)).toEqual(
      expect.arrayContaining([
        'ruta:paso-persistido-1',
        'ruta:paso-persistido-2',
        'componente:bastidor',
        'componente:lona',
      ]),
    );
    expect(remapeado.aristas).toContainEqual({
      desdeClave: 'ruta:paso-persistido-1',
      haciaClave: 'ruta:paso-persistido-2',
    });
  });

  it('lee snapshots anteriores con el fallback lineal', () => {
    const workflow = leerWorkflowRuta(
      { pasos: [{ orden: 1, familiaCodigo: 'impresion_por_hoja' }] },
      [
        {
          id: 'legacy-1',
          orden: 1,
          familiaCodigo: 'impresion_por_hoja',
        },
      ],
    );

    expect(workflow.topologia).toBe('LINEAL');
    expect(workflow.nodos[0].clave).toBe('ruta:legacy-1');
  });
});
