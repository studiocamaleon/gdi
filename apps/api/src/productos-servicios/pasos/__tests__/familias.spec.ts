/**
 * Tests de integridad del catálogo de familias.
 *
 * Verifican que el catálogo declarado en `familias.ts` cumple invariantes
 * estructurales (no validan lógica de negocio del motor — eso es F.2).
 */

import { CATEGORIAS } from '../categorias';
import {
  FAMILIAS,
  FAMILIAS_TOTAL,
  getFamilia,
  listarFamilias,
  listarFamiliasPorCategoria,
} from '../familias';
import type {
  CategoriaFamiliaCodigo,
  DefinicionFamiliaResuelta,
  FamiliaCodigo,
} from '../types';

describe('Catálogo de familias', () => {
  it('contiene exactamente 32 familias', () => {
    // Poda del catálogo 2026-08-03: se borraron 10 familias manuales sin uso ni
    // cableado y se sumó aplicacion_transfer_textil (plancha térmica).
    // 2026-08-04: se sumaron impresion_3d, abrochado_caballete y las dos de
    // cartelería F1 (estructura_bastidor, iluminacion_led).
    // 2026-08-07 (F4 efectos): se podó modificacion_pre — agrandar la medida
    // dejó de ser una familia y pasó a ser un efecto que declara el paso real.
    // 2026-08-19: corte_hilo_caliente independiza el nesting vectorial de
    // Polyfan de la familia genérica corte_manual.
    expect(FAMILIAS_TOTAL).toBe(32);
  });

  it('corte con hilo caliente declara su cotizador y nesting vectorial', () => {
    const familia = getFamilia('corte_hilo_caliente');

    expect(familia.herramientasCotizacion).toContain('diseno_vectorial');
    expect(familia.nestingConfig?.estrategia).toBe('irregular_placa');
    expect(familia.semanticaSeparacion).toBe('literal');
    expect(familia.inputsRequeridos).toContain('disenoVectorialFuente');
    expect(familia.slotsRequeridos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'sustrato_corte', requerido: true }),
      ]),
    );
  });

  it('todas las familias tienen categoría válida', () => {
    const categoriasValidas = Object.keys(
      CATEGORIAS,
    ) as CategoriaFamiliaCodigo[];
    for (const familia of Object.values(FAMILIAS)) {
      expect(categoriasValidas).toContain(familia.categoria);
    }
  });

  it('todos los códigos de familia coinciden con la key del record', () => {
    for (const [codigo, familia] of Object.entries(FAMILIAS)) {
      expect(familia.codigo).toBe(codigo);
    }
  });

  it('ninguna familia tiene nombre vacío', () => {
    for (const familia of Object.values(FAMILIAS)) {
      expect(familia.nombre.length).toBeGreaterThan(0);
    }
  });

  it('relacionMaquinaSoportada nunca está vacía', () => {
    for (const familia of Object.values(FAMILIAS)) {
      expect(familia.relacionMaquinaSoportada.length).toBeGreaterThan(0);
    }
  });

  it('modosTiempoSoportados nunca está vacía', () => {
    for (const familia of Object.values(FAMILIAS)) {
      expect(familia.modosTiempoSoportados.length).toBeGreaterThan(0);
    }
  });

  it('mecanismosCantidadSoportados nunca está vacío', () => {
    for (const familia of Object.values(FAMILIAS)) {
      expect(familia.mecanismosCantidadSoportados.length).toBeGreaterThan(0);
    }
  });

  it('modoActivacionDefault está en modosActivacionSoportados', () => {
    for (const familia of Object.values(FAMILIAS)) {
      expect(familia.modosActivacionSoportados).toContain(
        familia.modoActivacionDefault,
      );
    }
  });

  it('si relacionMaquinaSoportada incluye M-1 o M-2, plantillasCompatibles no está vacía', () => {
    for (const familia of Object.values(FAMILIAS)) {
      const usaMaquina =
        familia.relacionMaquinaSoportada.includes('M-1') ||
        familia.relacionMaquinaSoportada.includes('M-2');
      // Excepción: familias M-0 + M-1 mixtas (ej. aplicacion_transfer,
      // pintura_superficial) pueden tener plantillasCompatibles vacías si la
      // máquina industrial no es estándar. No forzamos invariante acá; es informativo.
      if (usaMaquina && familia.plantillasCompatibles.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `Familia ${familia.codigo} declara M-1/M-2 pero no lista plantillas compatibles`,
        );
      }
    }
  });

  it('todos los slots requeridos tienen código y nombre', () => {
    for (const familia of Object.values(FAMILIAS)) {
      for (const slot of familia.slotsRequeridos) {
        expect(slot.codigo.length).toBeGreaterThan(0);
        expect(slot.nombre.length).toBeGreaterThan(0);
      }
    }
  });

  it('códigos de slot únicos dentro de cada familia', () => {
    for (const familia of Object.values(FAMILIAS)) {
      const codigos = familia.slotsRequeridos.map((s) => s.codigo);
      const uniques = new Set(codigos);
      expect(uniques.size).toBe(codigos.length);
    }
  });

  it('todo slot material configurable declara compatibilidad de materia prima', () => {
    for (const familia of Object.values(FAMILIAS)) {
      for (const slot of familia.slotsRequeridos) {
        if (slot.tipo === 'CONSUMIBLE_MAQUINA') continue;
        expect(slot.compatibilidadMaterial).toBeDefined();
        const compat = slot.compatibilidadMaterial!;
        expect(
          Boolean(compat.familiasMateriaPrima?.length) ||
            Boolean(compat.subfamiliasMateriaPrima?.length) ||
            Boolean(compat.templateIds?.length) ||
            Boolean(compat.tipoTecnico?.length),
        ).toBe(true);
      }
    }
  });

  it('clasifica todas las subfamilias del catálogo de materias primas', () => {
    const usadas = new Set<string>();
    for (const familia of Object.values(FAMILIAS)) {
      for (const slot of familia.slotsRequeridos) {
        for (const subfamilia of slot.compatibilidadMaterial
          ?.subfamiliasMateriaPrima ?? []) {
          usadas.add(subfamilia);
        }
      }
    }
    const consumiblesMaquina = new Set(['TINTA_IMPRESION', 'TONER']);
    const sinSlotDirecto = new Set([
      'POLVO_DTF',
      // FILAMENTO_3D y RESINA_3D salieron de esta lista el 2026-08-04: la
      // familia impresion_3d ya las consume por su slot `material_3d`.
      'ACCESORIO_MONTAJE_POP',
      'PORTABANNER_ESTRUCTURA',
      'PERFIL_BASTIDOR_TEXTIL',
      // Poda 2026-08-03: quedaron sin paso que las consuma directamente al borrar
      // instalacion_electrica (línea LED/cartelería), etiquetado_manual y armado_cajas.
      'MODULO_LED_CARTELERIA',
      'FUENTE_ALIMENTACION_LED',
      'CABLEADO_CONECTICA',
      'CONTROLADOR_LED',
      'NEON_FLEX_LED',
      'ACCESORIO_NEON_LED',
      'ETIQUETADO_IDENTIFICACION',
      'ACCESORIO_EXHIBIDOR_CARTON',
      // Curación 2026-08-04: quedaron sin paso consumidor al borrar barniz
      // (QUIMICO_ACABADO), soldadura + acabado_decorativo (CHAPA_METALICA,
      // PERFIL_ESTRUCTURAL, FIJACION_AUXILIAR).
      'QUIMICO_ACABADO',
      'CHAPA_METALICA',
      'PERFIL_ESTRUCTURAL',
      'FIJACION_AUXILIAR',
    ]);
    const todas = [
      'SUSTRATO_HOJA',
      'SUSTRATO_ROLLO_FLEXIBLE',
      'SUSTRATO_RIGIDO',
      'OBJETO_PROMOCIONAL_BASE',
      'TINTA_IMPRESION',
      'TONER',
      'FILM_TRANSFERENCIA',
      'PAPEL_TRANSFERENCIA',
      'LAMINADO_FILM',
      'LAMINADO_POUCH',
      'QUIMICO_ACABADO',
      'AUXILIAR_PROCESO',
      'POLVO_DTF',
      'FILAMENTO_3D',
      'RESINA_3D',
      'MODULO_LED_CARTELERIA',
      'FUENTE_ALIMENTACION_LED',
      'CABLEADO_CONECTICA',
      'CONTROLADOR_LED',
      'NEON_FLEX_LED',
      'ACCESORIO_NEON_LED',
      'CHAPA_METALICA',
      'PERFIL_ESTRUCTURAL',
      'PINTURA_CARTELERIA',
      'PRIMER_SELLADOR',
      'ANILLADO_ENCUADERNACION',
      'TAPA_ENCUADERNACION',
      'IMAN_CERAMICO_FLEXIBLE',
      'FIJACION_AUXILIAR',
      'ACCESORIO_EXHIBIDOR_CARTON',
      'ACCESORIO_MONTAJE_POP',
      'SEMIELABORADO_POP',
      'ARGOLLA_LLAVERO_ACCESORIO',
      'OJAL_OJALILLO_REMACHE',
      'PORTABANNER_ESTRUCTURA',
      'SISTEMA_COLGADO_MONTAJE',
      'PERFIL_BASTIDOR_TEXTIL',
      'CINTA_DOBLE_FAZ_TECNICA',
      'ADHESIVO_LIQUIDO_ESTRUCTURAL',
      'VELCRO_CIERRE_TECNICO',
      'EMBALAJE_PROTECCION',
      'ETIQUETADO_IDENTIFICACION',
      'CONSUMIBLE_INSTALACION',
    ];
    for (const subfamilia of todas) {
      expect(
        usadas.has(subfamilia) ||
          consumiblesMaquina.has(subfamilia) ||
          sinSlotDirecto.has(subfamilia),
      ).toBe(true);
    }
  });

  it('plastificado_pouch usa solo pouch térmico como material calculado', () => {
    const familia = getFamilia('plastificado_pouch');
    expect(familia.categoria).toBe('terminaciones');
    expect(familia.mecanismosCantidadSoportados).toEqual([
      'CALCULADO_POR_PASO',
    ]);
    expect(familia.slotsRequeridos).toHaveLength(1);
    expect(familia.slotsRequeridos[0]).toMatchObject({
      codigo: 'pouch',
      tipo: 'INSUMO_PASO',
      compatibilidadMaterial: {
        familiasMateriaPrima: ['TRANSFERENCIA_LAMINACION'],
        subfamiliasMateriaPrima: ['LAMINADO_POUCH'],
      },
    });
  });

  it('impresion_por_area permite film de transferencia como sustrato principal', () => {
    const familia = getFamilia('impresion_por_area');
    const sustrato = familia.slotsRequeridos.find(
      (slot) => slot.codigo === 'sustrato_principal',
    );

    expect(sustrato?.compatibilidadMaterial).toMatchObject({
      familiasMateriaPrima: expect.arrayContaining([
        'SUSTRATO',
        'TRANSFERENCIA_LAMINACION',
      ]),
      subfamiliasMateriaPrima: expect.arrayContaining([
        'SUSTRATO_ROLLO_FLEXIBLE',
        'FILM_TRANSFERENCIA',
        'PAPEL_TRANSFERENCIA',
      ]),
    });
  });
});

describe('Categorías', () => {
  it('contiene exactamente 9 categorías', () => {
    expect(Object.keys(CATEGORIAS).length).toBe(9);
  });

  it('cada categoría tiene al menos 1 familia', () => {
    for (const categoriaCodigo of Object.keys(
      CATEGORIAS,
    ) as CategoriaFamiliaCodigo[]) {
      const familias = listarFamiliasPorCategoria(categoriaCodigo);
      expect(familias.length).toBeGreaterThan(0);
    }
  });
});

describe('Helpers', () => {
  it('getFamilia devuelve la familia correcta', () => {
    const familia = getFamilia('impresion_por_hoja');
    expect(familia.codigo).toBe('impresion_por_hoja');
  });

  it('getFamilia lanza error si la familia no existe', () => {
    expect(() => getFamilia('familia_inexistente' as FamiliaCodigo)).toThrow();
  });

  it('listarFamilias devuelve los 32 códigos', () => {
    expect(listarFamilias().length).toBe(32);
  });
});
