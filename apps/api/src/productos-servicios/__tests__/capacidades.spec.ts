/**
 * B.3.1 — El Registro de Capacidades es datos puros: estos tests protegen
 * la COBERTURA (toda key que el catálogo declara tiene lugar en el
 * registro) y las invariantes de la derivación por forma. Sin DB.
 */
import { FAMILIAS } from '../pasos/familias';
import {
  ALIAS_LEGACY,
  CAPACIDADES,
  KEYS_INTERNAS,
  KEYS_PODADAS,
  capacidadesDeForma,
  capacidadesDeclaradas,
  capacidadesEmitidas,
  resolverAliasLegacy,
} from '../pasos/capacidades';
import { derivarOutputsTenant } from '../pasos/familia-tenant-validacion';

describe('Registro de Capacidades (B.3.1)', () => {
  const keysDelCatalogo = new Set<string>();
  for (const familia of Object.values(FAMILIAS)) {
    for (const key of familia.outputsCanonicos ?? []) keysDelCatalogo.add(key);
  }

  it('toda key declarada por el catálogo está en el registro (alias, interna o podada)', () => {
    const sinLugar = [...keysDelCatalogo].filter(
      (key) =>
        !ALIAS_LEGACY[key] && !KEYS_INTERNAS.has(key) && !KEYS_PODADAS.has(key),
    );
    expect(sinLugar).toEqual([]);
  });

  it('ningún alias apunta a una capacidad inexistente', () => {
    for (const [key, alias] of Object.entries(ALIAS_LEGACY)) {
      expect(CAPACIDADES[alias.capacidad]).toBeDefined();
      expect(alias.etiqueta.trim().length).toBeGreaterThan(0);
      // La key del alias existe de verdad en el catálogo: el mapa no
      // acumula entradas fantasma cuando una familia cambia su declaración.
      expect(keysDelCatalogo.has(key)).toBe(true);
    }
  });

  it('internas y podadas no se pisan con los alias', () => {
    for (const key of [...KEYS_INTERNAS, ...KEYS_PODADAS]) {
      expect(ALIAS_LEGACY[key]).toBeUndefined();
    }
  });

  it('una key desconocida cae al conteo de unidades con etiqueta humanizada', () => {
    // "piezas_estampadas" existe en datos de tenant (Etapa C) sin alias
    // explícito: el fallback la vuelve utilizable igual.
    expect(resolverAliasLegacy('piezas_estampadas')).toEqual({
      capacidad: 'unidades_procesadas',
      etiqueta: 'piezas estampadas',
    });
  });

  it('todo paso emite unidades y minutos; la superficie suma su set', () => {
    expect(capacidadesDeForma({})).toEqual([
      'unidades_procesadas',
      'minutos_reales',
    ]);
    expect(capacidadesDeForma({ superficie: 'pliego' })).toEqual(
      expect.arrayContaining(['pliegos', 'imposicion', 'aprovechamiento_pct']),
    );
    expect(capacidadesDeForma({ superficie: 'rollo' })).toEqual(
      expect.arrayContaining([
        'm2_consumidos',
        'metros_lineales',
        'aprovechamiento_pct',
      ]),
    );
    // Rollo no emite pliegos ni viceversa.
    expect(capacidadesDeForma({ superficie: 'rollo' })).not.toContain('pliegos');
    expect(capacidadesDeForma({ superficie: 'pliego' })).not.toContain(
      'm2_consumidos',
    );
  });

  it('agrupar y consumir material lineal suman sin duplicar', () => {
    expect(capacidadesDeForma({ agrupa: true })).toContain('grupos');
    const conFilmYRollo = capacidadesDeForma({
      superficie: 'rollo',
      consumeMaterialLineal: true,
    });
    expect(
      conFilmYRollo.filter((c) => c === 'metros_lineales'),
    ).toHaveLength(1);
  });

  it('capacidadesDeclaradas: alias-mapea, deduplica y excluye internas/podadas', () => {
    // Los 5 cortes del catálogo comparten piezas_cortadas → una sola capacidad.
    expect(capacidadesDeclaradas(['piezas_cortadas', 'tiempo_real_corte'])).toEqual([
      'unidades_procesadas',
      'minutos_reales',
    ]);
    expect(capacidadesDeclaradas(['proof_aprobado'])).toEqual([]);
    expect(capacidadesDeclaradas(['metros_lineales_union', 'mutacion_aplicada'])).toEqual([
      'metros_lineales',
    ]);
  });

  it('capacidadesEmitidas: alias-mapea, salta atributos/podadas y agrega universales sin duplicar', () => {
    const emitidas = capacidadesEmitidas({
      outputsCanonicos: {
        piezas_cortadas: 500,
        pliego_impresion_ancho_mm: 320, // atributo → no emite entrada propia
        proof_aprobado: true, // podada
        imposicion_calculada: { algo: true }, // objeto → no numérico
      },
      cantidadEfectiva: 500,
      totalMin: 45,
    });
    expect(emitidas).toEqual([
      // piezas_cortadas cubre unidades: la universal NO duplica.
      { capacidad: 'unidades_procesadas', etiqueta: 'piezas cortadas', valor: 500 },
      { capacidad: 'minutos_reales', etiqueta: 'minutos de trabajo', valor: 45 },
    ]);
  });

  it('capacidadesEmitidas: las keys del propio registro se representan a sí mismas, sin duplicar', () => {
    // Bug cazado en el E2E de B.3.2: minutos_reales caía al fallback
    // (→ unidades) y encima la universal lo re-agregaba.
    const emitidas = capacidadesEmitidas({
      outputsCanonicos: { unidades_procesadas: 100, minutos_reales: 75 },
      cantidadEfectiva: 100,
      totalMin: 75,
    });
    expect(emitidas).toEqual([
      { capacidad: 'unidades_procesadas', etiqueta: 'unidades procesadas', valor: 100 },
      { capacidad: 'minutos_reales', etiqueta: 'minutos de trabajo', valor: 75 },
    ]);
  });

  it('capacidadesEmitidas: un paso tenant sin outputs declara igual sus universales', () => {
    expect(
      capacidadesEmitidas({ outputsCanonicos: {}, cantidadEfectiva: 100, totalMin: 100 }),
    ).toEqual([
      { capacidad: 'unidades_procesadas', etiqueta: 'unidades procesadas', valor: 100 },
      { capacidad: 'minutos_reales', etiqueta: 'minutos de trabajo', valor: 100 },
    ]);
  });

  it('derivarOutputsTenant: unidades+minutos siempre; CONVERSION suma grupos', () => {
    expect(derivarOutputsTenant({ mecanismosCantidad: ['DIRECT_FROM_JOBCONTEXT'] })).toEqual([
      'unidades_procesadas',
      'minutos_reales',
    ]);
    expect(
      derivarOutputsTenant({ mecanismosCantidad: ['DIRECT_FROM_JOBCONTEXT', 'CONVERSION'] }),
    ).toContain('grupos');
  });

  it('las 42 familias del sistema se proyectan al registro sin sorpresas', () => {
    for (const familia of Object.values(FAMILIAS)) {
      const capacidades = capacidadesDeclaradas(familia.outputsCanonicos);
      // Toda familia con outputs no-podados proyecta al menos una capacidad,
      // y ninguna proyecta algo fuera del registro.
      for (const cap of capacidades) {
        expect(CAPACIDADES[cap]).toBeDefined();
      }
      const noPodados = (familia.outputsCanonicos ?? []).filter(
        (k) => !KEYS_PODADAS.has(k) && !KEYS_INTERNAS.has(k),
      );
      if (noPodados.length > 0) {
        expect(capacidades.length).toBeGreaterThan(0);
      }
    }
  });
});
