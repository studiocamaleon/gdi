import {
  calcularCuadernilloCaballete,
  resumirPaginas,
  MAX_HOJAS_CABALLETE_DEFAULT,
} from '../cuadernillo-imposicion';

describe('Imposición de cuadernillo a caballete', () => {
  it('el caso canónico del diseño: A5 32 páginas × 200 en SRA3 (K=2) → 800 pliegos', () => {
    const r = calcularCuadernilloCaballete({
      paginas: 32,
      ejemplares: 200,
      paresPorCara: 2,
    });
    expect(r.hojasPorLibro).toBe(8);
    expect(r.paginasBlancas).toBe(0);
    expect(r.librosPorJuego).toBe(2);
    expect(r.juegos).toBe(100);
    expect(r.pliegos).toBe(800);
    expect(r.excedeMaxHojas).toBe(false);
  });

  it('el mapa de imposición de 8 páginas es el clásico', () => {
    const r = calcularCuadernilloCaballete({
      paginas: 8,
      ejemplares: 1,
      paresPorCara: 1,
    });
    expect(r.plan).toEqual([
      { hoja: 1, frente: [8, 1], dorso: [2, 7] },
      { hoja: 2, frente: [6, 3], dorso: [4, 5] },
    ]);
  });

  it('en el plan, cada página aparece exactamente una vez (propiedad, N=64)', () => {
    const r = calcularCuadernilloCaballete({
      paginas: 64,
      ejemplares: 1,
      paresPorCara: 1,
    });
    const vistas = r.plan.flatMap((h) => [...h.frente, ...h.dorso]).sort((a, b) => a - b);
    expect(vistas).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  });

  it('cada hoja suma N+1 en cada cara (invariante del caballete)', () => {
    const r = calcularCuadernilloCaballete({
      paginas: 24,
      ejemplares: 1,
      paresPorCara: 1,
    });
    for (const h of r.plan) {
      expect(h.frente[0] + h.frente[1]).toBe(25);
      expect(h.dorso[0] + h.dorso[1]).toBe(25);
    }
  });

  it('rellena a múltiplo de 4 con blancas al final, sin cortar', () => {
    const r = calcularCuadernilloCaballete({
      paginas: 30,
      ejemplares: 10,
      paresPorCara: 1,
    });
    expect(r.paginasEfectivas).toBe(32);
    expect(r.paginasBlancas).toBe(2);
    expect(r.hojasPorLibro).toBe(8);
    expect(r.pliegos).toBe(80);
  });

  it('ejemplares que no llenan el último juego igual lo pagan completo', () => {
    // 5 libros con K=2 → 3 juegos (el tercero rinde 2 pero se usa 1).
    const r = calcularCuadernilloCaballete({
      paginas: 16,
      ejemplares: 5,
      paresPorCara: 2,
    });
    expect(r.juegos).toBe(3);
    expect(r.pliegos).toBe(12); // 4 hojas × 3 juegos
  });

  it('pasado el tope de hojas avisa (no revienta): el motor corta con diagnóstico', () => {
    const r = calcularCuadernilloCaballete({
      paginas: 200, // 50 hojas
      ejemplares: 1,
      paresPorCara: 1,
    });
    expect(r.hojasPorLibro).toBe(50);
    expect(r.maxHojas).toBe(MAX_HOJAS_CABALLETE_DEFAULT);
    expect(r.excedeMaxHojas).toBe(true);
  });

  it('el tope es configurable por paso', () => {
    const r = calcularCuadernilloCaballete({
      paginas: 48,
      ejemplares: 1,
      paresPorCara: 1,
      maxHojas: 10,
    });
    expect(r.hojasPorLibro).toBe(12);
    expect(r.excedeMaxHojas).toBe(true);
  });

  it('mínimo 4 páginas aunque pidan menos', () => {
    const r = calcularCuadernilloCaballete({
      paginas: 2,
      ejemplares: 1,
      paresPorCara: 1,
    });
    expect(r.paginasEfectivas).toBe(4);
    expect(r.paginasBlancas).toBe(2);
    expect(r.hojasPorLibro).toBe(1);
  });
});

describe('Selección de hojas por paso (tapa / interior)', () => {
  const base = { paginas: 32, ejemplares: 200, paresPorCara: 2 };

  it('la tapa es UNA hoja y lleva las páginas 1, 2, 31 y 32', () => {
    const r = calcularCuadernilloCaballete({ ...base, hojas: { modo: 'tapa' } });
    expect(r.hojasDelPaso).toBe(1);
    expect(r.plan).toEqual([{ hoja: 1, frente: [32, 1], dorso: [2, 31] }]);
    expect(r.paginasDelPaso).toEqual([1, 2, 31, 32]);
    // 1 hoja × 100 juegos
    expect(r.pliegos).toBe(100);
  });

  it('el interior son las hojas 2..H y NO incluye las páginas de la tapa', () => {
    const r = calcularCuadernilloCaballete({
      ...base,
      hojas: { modo: 'interior' },
    });
    expect(r.hojasDelPaso).toBe(7);
    expect(r.pliegos).toBe(700);
    expect(r.paginasDelPaso).not.toContain(1);
    expect(r.paginasDelPaso).not.toContain(32);
    expect(r.paginasDelPaso[0]).toBe(3);
  });

  it('tapa + interior reconstruyen el libro completo (sin huecos ni repetidos)', () => {
    const tapa = calcularCuadernilloCaballete({ ...base, hojas: { modo: 'tapa' } });
    const interior = calcularCuadernilloCaballete({
      ...base,
      hojas: { modo: 'interior' },
    });
    expect(tapa.pliegos + interior.pliegos).toBe(800);
    const todas = [...tapa.paginasDelPaso, ...interior.paginasDelPaso].sort(
      (a, b) => a - b,
    );
    expect(todas).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it('hojasPorLibro sigue siendo del LIBRO aunque el paso imprima sólo la tapa', () => {
    const r = calcularCuadernilloCaballete({ ...base, hojas: { modo: 'tapa' } });
    // El abrochado necesita el espesor real del libro, no el del paso.
    expect(r.hojasPorLibro).toBe(8);
    expect(r.hojasDelPaso).toBe(1);
  });

  it('un rango de hojas arrastra páginas de los dos extremos del documento', () => {
    // El caso que sorprende al comercial: "las primeras 8 páginas a color"
    // son las hojas 1-4, que también llevan las páginas 25-32.
    const r = calcularCuadernilloCaballete({
      ...base,
      hojas: { modo: 'rango', desde: 1, hasta: 4 },
    });
    expect(r.hojasDelPaso).toBe(4);
    expect(resumirPaginas(r.paginasDelPaso)).toBe('1-8, 25-32');
  });

  it('el rango se acota a las hojas que existen', () => {
    const r = calcularCuadernilloCaballete({
      ...base,
      hojas: { modo: 'rango', desde: 6, hasta: 99 },
    });
    expect(r.plan.map((h) => h.hoja)).toEqual([6, 7, 8]);
  });

  it('sin selección imprime todo (retrocompatible)', () => {
    const r = calcularCuadernilloCaballete(base);
    expect(r.hojasDelPaso).toBe(8);
    expect(r.pliegos).toBe(800);
    expect(r.seleccionHojas).toEqual({ modo: 'todas' });
  });

  it('un documento de 4 páginas no tiene interior: 0 hojas para ese paso', () => {
    const r = calcularCuadernilloCaballete({
      paginas: 4,
      ejemplares: 10,
      paresPorCara: 1,
      hojas: { modo: 'interior' },
    });
    expect(r.hojasDelPaso).toBe(0);
    expect(r.pliegos).toBe(0);
  });
});

describe('resumirPaginas', () => {
  it('colapsa correlativas en rangos', () => {
    expect(resumirPaginas([1, 2, 3, 4, 25, 26])).toBe('1-4, 25-26');
  });

  it('deja sueltas las aisladas', () => {
    expect(resumirPaginas([3, 7, 8])).toBe('3, 7-8');
  });

  it('sin páginas devuelve un guion', () => {
    expect(resumirPaginas([])).toBe('—');
  });
});
