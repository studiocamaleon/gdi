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
