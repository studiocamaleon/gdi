import {
  clavesPasosOmitidos,
  pasosEfectivos,
  proyectarBomEfectivo,
} from '../bom-efectivo';
import { RecetasProductoService } from '../recetas-producto.service';

const pasos = [
  {
    clave: 'impresion',
    nombre: 'Impresión',
    familiaCodigo: 'impresion_por_area',
    orden: 0,
    configuracion: { modoActivacion: 'OBLIGATORIO' },
    slots: [],
    recurso: {},
  },
  {
    clave: 'pintura',
    nombre: 'Pintura',
    familiaCodigo: 'pintura',
    orden: 1,
    configuracion: { modoActivacion: 'NO_EJECUTAR' },
    slots: [{ slotCodigo: 'pintura' }],
    recurso: {},
  },
  {
    clave: 'pintura:interno:a',
    nombre: 'Preparación',
    familiaCodigo: 'preparacion',
    orden: 2,
    configuracion: { contenedorClave: 'pintura' },
    slots: [],
    recurso: {},
  },
  {
    clave: 'opcional',
    nombre: 'Opcional',
    familiaCodigo: 'diseno',
    orden: 3,
    configuracion: { modoActivacion: 'OPCIONAL' },
    slots: [],
    recurso: {},
  },
];

describe('BOM efectivo de revisiones', () => {
  it('excluye omitidos y operaciones del contenedor omitido, preservando opcionales e historial', () => {
    const revision = {
      snapshotJson: { pasos },
      materiales: [{ pasoClave: 'pintura' }],
      recursos: pasos.map((p) => ({ pasoClave: p.clave })),
      documentos: [
        { pasoClave: null },
        { pasoClave: 'pintura' },
        { pasoClave: 'impresion' },
      ],
    };
    const antes = JSON.stringify(revision);
    const efectivo = proyectarBomEfectivo(revision);
    expect(efectivo.materiales).toEqual([]);
    expect(efectivo.recursos.map((p) => p.pasoClave)).toEqual([
      'impresion',
      'opcional',
    ]);
    expect(efectivo.documentos).toEqual([
      { pasoClave: null },
      { pasoClave: 'impresion' },
    ]);
    expect(JSON.stringify(revision)).toBe(antes);
  });
  it('mantiene revisiones antiguas sin datos de activación y filtra pasos de ruta inactivos', () => {
    expect(clavesPasosOmitidos(null).size).toBe(0);
    expect(
      pasosEfectivos({
        pasos: [
          { clave: 'a', configuracion: {} },
          { clave: 'b', configuracion: { rutaPasoActivo: false } },
        ],
      }).map((p) => p.clave),
    ).toEqual(['a']);
  });
  it('las proyecciones nuevas de materiales y recursos usan la misma selección', () => {
    const servicio = Object.create(RecetasProductoService.prototype) as any;
    const snapshot = { pasos, documentos: [], componentes: [] };
    expect(servicio.materialesDesdeSnapshot(snapshot, new Map())).toEqual([]);
    expect(
      servicio.recursosDesdeSnapshot(snapshot).map((p: any) => p.pasoClave),
    ).toEqual(['impresion', 'opcional']);
  });
});
