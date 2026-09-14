import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TablaCola } from './colas-produccion';
import { configurarFilaCola } from '../../../apps/api/src/produccion/colas/configuracion-cola';
import { fechaCola, gruposVisualesCola, type DatosCola, type TrabajoCola } from '@/lib/colas-produccion';

function item(id: string, modoColor = 'CMYK', ancho = 1370): TrabajoCola {
  return { control: { paso: { id, nombre: 'Impresión', estado: 'pendiente', tipoEjecucion: 'interno', modoRegistro: 'cronometro', duracionEstimadaMin: 10, tiempoAcumuladoMin: 0, tramoAbierto: null }, esActual: true, canManage: true, canSupervise: false, puedeTomarMesa: false }, id, itemId: id, ordenId: 'ot', ordenNumero: 'OT-0054', nombre: 'Impresión', producto: 'Exhibidor', componenteDe: null,
    cliente: 'Cliente QA', lote: { id: 'lote-b', nombre: 'Lote B', cantidad: 50, unidad: 'u', productoNombre: 'Exhibidor', esProductoDelLote: true },
    cantidad: 50, unidad: 'u', fechaEntrega: '2026-09-11', duracionEstimadaMin: 10, responsable: null, archivosCount: 1, estadoCola: 'listos', motivos: [],
    configuracion: { ...configurarFilaCola({ pasoId: id, contexto: null, compartido: null, impresionesEnContexto: 1,
      original: { nestingResult: { modoColor, sustrato: { materialVarianteId: `vinilo-${ancho}`, nombre: 'Vinilo blanco' }, substrates: [{ kind: 'roll', widthMm: ancho }], layoutRegistradoLoteId: 'registro' } } }),
      materiaPrimaId: 'vinilo', materialNestingClave: 'vinilo:brillante' },
  };
}
describe('cola por máquina', () => {
  it('reúne variantes de ancho y color del mismo material en un solo grupo', () => {
    const items = [...Array.from({ length: 10 }, (_, i) => item(String(i))), item('angosto', 'CMYK', 1050), item('blanco', 'CMYK+W')];
    expect(gruposVisualesCola(items).map(g => g.items.length)).toEqual([12]);
    expect(gruposVisualesCola(items)[0].items).toEqual(items);
  });
  it('no fusiona materiales diferentes aunque compartan el nombre', () => {
    const a = item('a'), b = item('b');
    b.configuracion.materiaPrimaId = 'otro-vinilo';
    expect(gruposVisualesCola([a, b])).toHaveLength(2);
  });
  it('muestra el material una vez y conserva ancho, color y perfil en cada fila', () => {
    const a = item('a'), b = item('b', 'CMYK+W', 1520);
    a.configuracion.perfilNombre = 'CMYK - 4 pass';
    b.configuracion.perfilNombre = 'CMYK + blanco - 6 pass';
    const html = renderToStaticMarkup(<TablaCola datos={{ items: [a, b], pages: 1 } as DatosCola} />);
    expect((html.match(/Vinilo blanco/g) ?? []).length).toBe(1);
    for (const texto of ['>Sustrato</th>', 'Rollo · 1,37 m', 'Rollo · 1,52 m', 'CMYK + blanco', 'Perfil: 4 pass', 'Perfil: 6 pass']) expect(html).toContain(texto);
  });
  it('mantiene la fecha comercial y muestra lote, ancho, color y protección del layout', () => {
    const datos = { items: [item('p')], pages: 1 } as DatosCola;
    const html = renderToStaticMarkup(<TablaCola datos={datos} />);
    for (const texto of ['Lote B', '1,37 m', 'CMYK', 'Vinilo blanco', 'Conservar layout', '11/09/2026', '/produccion/tablero?item=p']) expect(html).toContain(texto);
    expect(html).not.toContain('Iniciar tanda');
    expect(fechaCola('2026-09-11')).toBe('11/09/2026');
  });
  it('no confunde todos los materiales faltantes como un grupo compatible', () => {
    const a = item('a'), b = item('b');
    for (const trabajo of [a, b]) Object.assign(trabajo.configuracion, { materialId: null, materiaPrimaId: null, materialNestingClave: null });
    expect(gruposVisualesCola([a, b])).toHaveLength(2);
  });
  it('muestra sólo las piezas a producir, sin medidas del producto ni el falso 1 m2', () => {
    const i = item('lona'); i.producto = 'Lona Backlight'; i.componenteDe = 'Cartel Backlight'; i.cantidad = 1; i.unidad = 'm2';
    Object.assign(i.configuracion, { productoCompuesto: true, layoutConservado: true,
      piezas: [{ cantidad: 1, anchoMm: 1700, altoMm: 1200 }], piezasProducto: [{ cantidad: 1, anchoMm: 1500, altoMm: 1000 }] });
    const html = renderToStaticMarkup(<TablaCola datos={{ items: [i], pages: 1 } as DatosCola} />);
    for (const texto of ['>Medidas</th>', '1 u. × 170 × 120 cm', 'Layout bloqueado']) expect(html).toContain(texto);
    expect(html).not.toContain('150 × 100 cm');
    expect(html).not.toContain('1 m2');
  });
  it('muestra todas las medidas de un conjunto con el formato de la OT', () => {
    const i = item('conjunto');
    i.configuracion.piezas = [{ cantidad: 50, anchoMm: 300, altoMm: 400 }, { cantidad: 200, anchoMm: 100, altoMm: 200 }];
    const html = renderToStaticMarkup(<TablaCola datos={{ items: [i], pages: 1 } as DatosCola} />);
    for (const texto of ['50 u. × 30 × 40 cm', '200 u. × 10 × 20 cm']) expect(html).toContain(texto);
    expect(html).not.toContain('Ver medidas');
  });
  it('muestra cada panel con sus medidas calculadas y no las de la pieza completa', () => {
    const i = item('paneles');
    i.configuracion.panelesPorPiezaMax = 2;
    i.configuracion.piezas = [{ cantidad: 1, anchoMm: 2300, altoMm: 1600 }];
    i.configuracion.paneles = [1, 2].map(panel => ({ panel, paneles: 2, cantidad: 1, anchoMm: 1170, altoMm: 1600 }));
    const html = renderToStaticMarkup(<TablaCola datos={{ items: [i], pages: 1 } as DatosCola} />);
    for (const texto of ['Panel 1/2', 'Panel 2/2', 'Medidas de los paneles para producir']) expect(html).toContain(texto);
    expect((html.match(/1 u\. × 117 × 160 cm/g) ?? []).length).toBe(2);
    expect(html).not.toContain('230 × 160 cm');
    expect(html).not.toContain('hasta 2 paneles');
  });
  it('informa si faltan medidas de paneles sin sustituirlas por el producto entero', () => {
    const i = item('sin-paneles');
    i.configuracion.panelesPorPiezaMax = 2;
    i.configuracion.piezas = [{ cantidad: 1, anchoMm: 2300, altoMm: 1600 }];
    const html = renderToStaticMarkup(<TablaCola datos={{ items: [i], pages: 1 } as DatosCola} />);
    expect(html).toContain('Medidas de paneles no disponibles');
    expect(html).not.toContain('230 × 160 cm');
  });
  it('ofrece selección por página y por trabajo sin controles de tandas', () => {
    const a = item('a'), b = item('b', 'CMYK+W', 1520);
    b.configuracion.familiaCodigo = 'corte_laser'; b.estadoCola = 'en_espera';
    const html = renderToStaticMarkup(<TablaCola datos={{ items: [a, b], pages: 1 } as DatosCola} onAlternar={() => {}} onGrupo={() => {}} />);
    expect(html).toContain('Seleccionar todos los trabajos de esta página');
    expect((html.match(/aria-label="Seleccionar OT-/g) ?? []).length).toBe(2);
    expect(html).not.toContain('Preparar tanda');
    expect(html).not.toContain('Tandas sugeridas');
    expect(html).not.toContain('No disponible para tanda');
  });
  it('ofrece Iniciar únicamente en los trabajos listos cuando el usuario puede operar', () => {
    const items = ['listos', 'en_curso', 'en_espera', 'pausados'].map((estado, i) => { const t = item(String(i)); t.estadoCola = estado as TrabajoCola['estadoCola']; t.control.paso.estado = estado === 'en_curso' ? 'en_curso' : estado === 'pausados' ? 'pausado' : 'pendiente'; t.control.esActual = estado === 'listos'; return t; });
    const datos = { items, pages: 1 } as DatosCola;
    const html = renderToStaticMarkup(<TablaCola datos={datos} onAccion={async () => {}} />);
    expect((html.match(/aria-label="Iniciar OT-/g) ?? []).length).toBe(1);
    expect(html).toContain('Iniciar OT-0054 · Exhibidor · Lote B');
    expect(renderToStaticMarkup(<TablaCola datos={datos} />)).not.toContain('aria-label="Iniciar');
  });
  it('bloquea la acción y muestra el inicio pendiente mientras se guarda', () => {
    const html = renderToStaticMarkup(<TablaCola datos={{ items: [item('a')], pages: 1 } as DatosCola} onAccion={async () => {}} ocupado />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Iniciar/);
    expect(html).toContain('Completar');
    expect(html).toContain('Bloquear');
  });

  it('muestra espera y bloqueo separados y conserva el permiso para desbloquear', () => {
    const esperando = item('espera'); esperando.estadoCola = 'en_espera'; esperando.control.esActual = false; esperando.motivos = ['Espera: Diseño'];
    const bloqueado = item('bloqueado'); bloqueado.estadoCola = 'bloqueados'; bloqueado.control.paso.estado = 'bloqueado'; bloqueado.control.esActual = false; bloqueado.motivos = ['Máquina averiada'];
    const datos = { items: [esperando, bloqueado], pages: 1 } as DatosCola;
    const render = () => renderToStaticMarkup(<TablaCola datos={datos} onAccion={async () => {}} />);
    const html = render();
    for (const texto of ['En espera', 'Bloqueado', 'Espera: Diseño', 'Máquina averiada']) expect(html).toContain(texto);
    expect(html).not.toContain('aria-label="Iniciar');
    expect(html).not.toContain('Desbloquear');
    bloqueado.control.canSupervise = true;
    expect(render()).toContain('Desbloquear');
  });

});
