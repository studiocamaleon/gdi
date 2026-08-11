import {
  armarJobContext,
  RespuestasInvalidasError,
  type FormularioParaJobContext,
} from '../armar-jobcontext';

/**
 * Esta capa existe porque el motor NO valida: descarta claves desconocidas en
 * silencio y una pieza 0×0 lo tumba por OOM. Cada test acá es un modo de fallo
 * real de una IA armando el jobContext.
 */

function formularioBase(): FormularioParaJobContext {
  return {
    producto: { nombre: 'Banner' },
    medidas: {
      instruccion: 'pedir_ancho_alto',
      predefinidas: [],
      default: null,
    },
    cantidad: { minimo: null },
    preguntas: [
      {
        tipo: 'material',
        configPasoId: 'cp-1',
        slotCodigo: 'sustrato_principal',
        requerido: true,
        opciones: [
          { varianteId: 'var-440', etiqueta: 'Lona 440g', esDefault: true },
          { varianteId: 'var-340', etiqueta: 'Lona 340g', esDefault: false },
        ],
        jobContextKey: 'slotMateriales.cp-1_sustrato_principal',
      },
    ],
    multiplicadores: [
      {
        campo: 'caras',
        jobContextKey: 'caras',
        valores: [1, 2],
        default: 1,
        obligatorio: true,
      },
    ],
    adicionales: [
      { id: 'cp-ojales', tipo: 'paso', nombre: 'Ojales' },
      { id: 'cp-cond', tipo: 'paso_condicional', nombre: 'Refuerzo auto' },
    ],
    personalizaciones: [],
  };
}

const medida = { anchoMm: 3000, altoMm: 1500 };

describe('armarJobContext', () => {
  it('caso feliz: piezas, área, perímetro, material default y caras default', () => {
    const jc = armarJobContext(formularioBase(), { cantidad: 2, ...medida });
    expect(jc.cantidad).toBe(2);
    expect(jc.piezas).toEqual([{ cantidad: 2, anchoMm: 3000, altoMm: 1500 }]);
    expect(jc.medidaCustomMm).toEqual({ anchoMm: 3000, altoMm: 1500 });
    expect(jc.piezaAreaTotalM2).toBeCloseTo(9); // 4.5 m² × 2
    expect(jc.piezaPerimetroTotalM).toBeCloseTo(18); // 9 m × 2
    // Material sin respuesta → default del modelador (como el sheet).
    expect(jc.slotMateriales).toEqual({ 'cp-1_sustrato_principal': 'var-440' });
    // Multiplicador sin respuesta → default.
    expect(jc.caras).toBe(1);
  });

  it('piezas: varias medidas de UN trabajo se consolidan (el caso vinilos)', () => {
    const jc = armarJobContext(formularioBase(), {
      piezas: [
        { cantidad: 1, anchoMm: 3500, altoMm: 600 },
        { cantidad: 6, anchoMm: 1000, altoMm: 80 },
      ],
    });
    // cantidad = suma de piezas (como cotizaConPiezas del sheet)
    expect(jc.cantidad).toBe(7);
    expect(jc.piezas).toEqual([
      { cantidad: 1, anchoMm: 3500, altoMm: 600 },
      { cantidad: 6, anchoMm: 1000, altoMm: 80 },
    ]);
    // Con más de una medida no hay medidaCustomMm única.
    expect(jc.medidaCustomMm).toBeUndefined();
    expect(jc.piezaAnchoMaxMm).toBe(3500);
    expect(jc.piezaAreaTotalM2).toBeCloseTo(2.1 + 0.48);
  });

  it('piezas + anchoMm sueltos es ambiguo y se rechaza', () => {
    expect(() =>
      armarJobContext(formularioBase(), {
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
        anchoMm: 2000,
      }),
    ).toThrow(/UNA forma/);
  });

  it('piezas con medida 0 se rechaza (mismo guard anti-OOM)', () => {
    expect(() =>
      armarJobContext(formularioBase(), {
        piezas: [{ cantidad: 1, anchoMm: 0, altoMm: 500 }],
      }),
    ).toThrow(/piezas\[0\]/);
  });

  it('el mínimo BLOQUEAR valida contra la SUMA de piezas', () => {
    const form = formularioBase();
    form.cantidad = {
      minimo: { politica: 'BLOQUEAR', cantidad: 5, base: null },
    };
    expect(() =>
      armarJobContext(form, {
        piezas: [{ cantidad: 2, anchoMm: 1000, altoMm: 500 }],
      }),
    ).toThrow(/mínimo de 5/);
    const jc = armarJobContext(form, {
      piezas: [
        { cantidad: 3, anchoMm: 1000, altoMm: 500 },
        { cantidad: 2, anchoMm: 800, altoMm: 400 },
      ],
    });
    expect(jc.cantidad).toBe(5);
  });

  it('medida en 0 se rechaza ANTES del motor (guard anti-OOM)', () => {
    expect(() =>
      armarJobContext(formularioBase(), { cantidad: 1, anchoMm: 0, altoMm: 1500 }),
    ).toThrow(/mayores a 0/);
  });

  it('producto por medida sin ancho/alto pide los mm', () => {
    expect(() =>
      armarJobContext(formularioBase(), { cantidad: 1 }),
    ).toThrow(/anchoMm.*altoMm.*milímetros/);
  });

  it('cantidad no entera o negativa se rechaza', () => {
    expect(() =>
      armarJobContext(formularioBase(), { cantidad: 2.5, ...medida }),
    ).toThrow(RespuestasInvalidasError);
    expect(() =>
      armarJobContext(formularioBase(), { cantidad: 0, ...medida }),
    ).toThrow(/entero mayor a 0/);
  });

  it('clave desconocida es error explícito, no descarte silencioso', () => {
    expect(() =>
      armarJobContext(formularioBase(), {
        cantidad: 1,
        ...medida,
        respuestas: { colorDeLaLona: 'azul' },
      }),
    ).toThrow(/no es una pregunta de este producto.*Claves válidas/s);
  });

  it('variante fuera de los candidatos del slot se rechaza con opciones', () => {
    expect(() =>
      armarJobContext(formularioBase(), {
        cantidad: 1,
        ...medida,
        respuestas: { 'slotMateriales.cp-1_sustrato_principal': 'var-hackeada' },
      }),
    ).toThrow(/no es una opción.*var-440.*var-340/s);
  });

  it('multiplicador fuera de los valores permitidos se rechaza', () => {
    expect(() =>
      armarJobContext(formularioBase(), {
        cantidad: 1,
        ...medida,
        respuestas: { caras: 3 },
      }),
    ).toThrow(/sólo acepta 1 o 2/);
  });

  it('mínimo comercial BLOQUEAR corta antes de cotizar', () => {
    const form = formularioBase();
    form.cantidad.minimo = {
      politica: 'BLOQUEAR',
      cantidad: 10,
      base: 'cantidad_comercial',
    };
    expect(() => armarJobContext(form, { cantidad: 3, ...medida })).toThrow(
      /mínimo de 10/,
    );
  });

  it('medida predefinida: elige por id y rechaza custom si no corresponde', () => {
    const form = formularioBase();
    form.medidas = {
      instruccion: 'elegir_predefinida',
      predefinidas: [
        { id: 'a5', nombre: 'A5', anchoMm: 148, altoMm: 210, esDefault: true },
        { id: 'a4', nombre: 'A4', anchoMm: 210, altoMm: 297, esDefault: false },
      ],
      default: { anchoMm: 148, altoMm: 210 },
    };
    const jc = armarJobContext(form, {
      cantidad: 500,
      medidaPredefinidaId: 'a4',
    });
    expect(jc.medidaCustomMm).toEqual({ anchoMm: 210, altoMm: 297 });
    // Custom sobre un producto de medidas cerradas: error que lista opciones.
    expect(() =>
      armarJobContext(form, { cantidad: 500, anchoMm: 999, altoMm: 999 }),
    ).toThrow(/no acepta medida libre.*a5.*a4/s);
  });

  it('tiempo manual obligatorio sin valor queda en faltantes', () => {
    const form = formularioBase();
    form.preguntas.push({
      tipo: 'tiempo_manual',
      etiqueta: 'Armado',
      requerido: true,
      sugerido: null,
      min: null,
      max: null,
      jobContextKey: 'tiempoManualMin_cp-2',
    });
    expect(() => armarJobContext(form, { cantidad: 1, ...medida })).toThrow(
      /Faltan respuestas obligatorias.*tiempoManualMin_cp-2/s,
    );
  });

  it('tercerizado: eje validado y cantidad completada por el sistema', () => {
    const form = formularioBase();
    form.preguntas.push({
      tipo: 'tercerizado_eje',
      eje: 'gramaje',
      valores: ['300', '350'],
      requerido: true,
      jobContextKey: 'tercerizado_cp-3.gramaje',
    });
    const jc = armarJobContext(form, {
      cantidad: 100,
      ...medida,
      respuestas: { 'tercerizado_cp-3.gramaje': '300' },
    });
    expect(jc['tercerizado_cp-3']).toEqual({ gramaje: '300', cantidad: 100 });
  });

  it('adicional condicional NO es activable; opcional sí', () => {
    const form = formularioBase();
    const jc = armarJobContext(form, {
      cantidad: 1,
      ...medida,
      adicionales: ['cp-ojales'],
    });
    expect(jc.opcionalesActivados).toEqual({ 'cp-ojales': true });
    expect(() =>
      armarJobContext(form, { cantidad: 1, ...medida, adicionales: ['cp-cond'] }),
    ).toThrow(/no existe en este producto/);
  });

  it('personalizados sin medida propia: piezas sintetizadas desde estampas', () => {
    // El caso taza/remera: el motor cortaba con requires_piezas porque la
    // pieza que se imprime ES la estampa y nadie la declaraba.
    const form = formularioBase();
    form.medidas = { instruccion: 'no_preguntar', predefinidas: [], default: null };
    form.preguntas = [];
    form.multiplicadores = [];
    form.personalizaciones = [
      {
        codigo: 'pers_1',
        nombre: 'Estampa DTF',
        obligatoria: true,
        modoMedida: 'FIJA',
        anchoMm: 120,
        altoMm: 80,
        jobContextKey: 'personalizacion_pers_1',
      },
    ];
    const jc = armarJobContext(form, { cantidad: 20 });
    expect(jc.piezas).toEqual([{ cantidad: 20, anchoMm: 120, altoMm: 80 }]);
    expect(jc.personalizacion_pers_1_areaM2).toBeCloseTo(0.192); // 0.0096 × 20
    expect(jc.medidaCustomMm).toEqual({ anchoMm: 120, altoMm: 80 });
    expect(
      (jc.personalizaciones as Array<{ codigo: string }>)[0].codigo,
    ).toBe('pers_1');
  });

  it('personalización CLIENTE: la medida viene en la respuesta; sin medida es faltante', () => {
    const form = formularioBase();
    form.medidas = { instruccion: 'no_preguntar', predefinidas: [], default: null };
    form.preguntas = [];
    form.multiplicadores = [];
    form.personalizaciones = [
      {
        codigo: 'pers_1',
        nombre: 'Estampa pecho',
        obligatoria: true,
        modoMedida: 'CLIENTE',
        anchoMm: null, // sin sugerencia: la medida es del cliente sí o sí
        altoMm: null,
        jobContextKey: 'personalizacion_pers_1',
      },
    ];
    const jc = armarJobContext(form, {
      cantidad: 100,
      respuestas: { personalizacion_pers_1: { anchoMm: 200, altoMm: 250 } },
    });
    expect(jc.piezas).toEqual([{ cantidad: 100, anchoMm: 200, altoMm: 250 }]);
    expect(jc.personalizacion_pers_1_areaM2).toBeCloseTo(5); // 0.05 × 100
    // Sin respuesta y sin sugerencia: pide la medida, no cotiza mal.
    expect(() => armarJobContext(form, { cantidad: 100 })).toThrow(
      /medida de "Estampa pecho".*anchoMm.*altoMm/s,
    );
  });

  it('personalización opcional no activada no aporta pieza ni área', () => {
    const form = formularioBase();
    form.personalizaciones = [
      {
        codigo: 'pers_2',
        nombre: 'Estampa espalda',
        obligatoria: false,
        modoMedida: 'FIJA',
        anchoMm: 280,
        altoMm: 280,
        jobContextKey: 'personalizacion_pers_2',
      },
    ];
    const jc = armarJobContext(form, { cantidad: 1, ...medida });
    expect(jc.personalizacion_pers_2_areaM2).toBeUndefined();
    // El producto tiene medida propia: piezas salen de la medida, no de estampas.
    expect(jc.piezas).toEqual([{ cantidad: 1, anchoMm: 3000, altoMm: 1500 }]);
  });

  it('param con configPasoRuntime anidado y validación de tipo', () => {
    const form = formularioBase();
    form.preguntas.push({
      tipo: 'param',
      configPasoId: 'cp-4',
      campo: 'sepRefuerzoHcm',
      etiqueta: 'Separación refuerzos H',
      tipoDato: 'number',
      valoresPermitidos: [],
      sugerido: 0,
      requerido: false,
      jobContextKey: 'configPasoRuntime.cp-4.sepRefuerzoHcm',
    });
    const jc = armarJobContext(form, {
      cantidad: 1,
      ...medida,
      respuestas: { 'configPasoRuntime.cp-4.sepRefuerzoHcm': 50 },
    });
    expect(jc.configPasoRuntime).toEqual({ 'cp-4': { sepRefuerzoHcm: 50 } });
    expect(() =>
      armarJobContext(form, {
        cantidad: 1,
        ...medida,
        respuestas: { 'configPasoRuntime.cp-4.sepRefuerzoHcm': 'mucho' },
      }),
    ).toThrow(/debe ser un número/);
  });
});
