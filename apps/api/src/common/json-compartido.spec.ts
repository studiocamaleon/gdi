import {
  compactarJson,
  restaurarJson,
  esJsonCompartido,
  leerPropiedadJson,
} from './json-compartido';

it('lee metadatos escalares sin expandir los planos de un trabajo', () => {
  const codificado = compactarJson({ ...original(), exitoso: true });
  expect(leerPropiedadJson(codificado, 'exitoso')).toBe(true);
  expect(leerPropiedadJson(codificado, 'inexistente')).toBeUndefined();
  expect(leerPropiedadJson({ exitoso: false }, 'exitoso')).toBe(false);
});

const contorno = Array.from({ length: 200 }, (_, i) => ({
  x: i / 7,
  y: i * 1.003,
}));
const original = () => ({
  piezas: Array.from({ length: 120 }, (_, i) => ({
    id: `pieza-${i}`,
    cantidad: i + 1,
    contorno,
    capas: [{ nombre: 'HENDIDO', color: '#e34b18', recorrido: contorno }],
  })),
  datos: {
    nombre: 'Señalización · Ñ',
    vacio: null,
    activo: false,
    cantidad: 0,
  },
});

it('reduce repeticiones sin cambiar ninguna coordenada, capa o cantidad', () => {
  const fuente = original();
  const serializado = JSON.stringify(fuente);
  const compacto = compactarJson(fuente);
  expect(esJsonCompartido(compacto)).toBe(true);
  expect(JSON.stringify(compacto).length).toBeLessThan(serializado.length / 10);
  expect(JSON.stringify(restaurarJson(compacto))).toBe(serializado);
  expect(JSON.stringify(fuente)).toBe(serializado);
});

it('restaura objetos independientes y admite JSON antiguo sin codec', () => {
  const salida = restaurarJson<ReturnType<typeof original>>(
    compactarJson(original()),
  );
  salida.piezas[0].contorno[0].x = -99;
  expect(salida.piezas[1].contorno[0].x).toBe(0);
  expect(salida.piezas[0].capas[0].recorrido[0].x).toBe(0);
  const anterior = { piezas: [1, 2], precio: 50 };
  expect(restaurarJson(anterior)).toBe(anterior);
  expect(compactarJson(anterior)).toBe(anterior);
});

it('mantiene la semántica JSON de fechas, nulos y propiedades opcionales', () => {
  const entrada = {
    ...original(),
    fecha: new Date('2026-09-09'),
    omitido: undefined,
    arreglo: [undefined, NaN, Infinity],
    decimal: { toJSON: () => '1.25' },
  };
  expect(JSON.stringify(restaurarJson(compactarJson(entrada)))).toBe(
    JSON.stringify(entrada),
  );
});

it('no interpreta nombres de propiedades de negocio como referencias', () => {
  const entrada = {
    ...original(),
    r: 1,
    literal: { r: 99 },
    nodos: [],
    raiz: 2,
    especial: JSON.parse('{"__proto__":{"contaminado":true}}'),
  };
  expect(restaurarJson(compactarJson(entrada))).toEqual(entrada);
  expect(({} as Record<string, unknown>).contaminado).toBeUndefined();
});

it('rechaza ciclos y referencias rotas', () => {
  const ciclo: Record<string, unknown> = {};
  ciclo.ciclo = ciclo;
  expect(() => compactarJson(ciclo)).toThrow(/circulares/);
  expect(() =>
    restaurarJson({
      formato: 'grafo-json-dag',
      version: 1,
      raiz: { r: 0 },
      nodos: [[0, [{ r: 0 }]]],
    }),
  ).toThrow(/inválida/);
});
