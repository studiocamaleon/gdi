# Grafo Hotwire Linker

Motor aislado en TypeScript para convertir el SVG de nesting generado por Grafo en un recorrido continuo de corte y exportarlo como `.tap` para el flujo actual de **VectorLinker + GRBL Control** de la cortadora de polifan de Corporearte.

## Estado de esta versión

La versión `1.0.0` ya incorpora el postprocesador observado en un archivo real generado por VectorLinker (`reference/andina.tap`):

```gcode
G17 G90 G21
G94
G92 X0 Y0 Z0
G54
T08
G00 S0 M03
Z.24
G1 F350 
X0.000000 Y0.000000
X0.000000 Y0.000000
...
X0.000000 Y0.000000
```

También replica:

- origen físico inferior izquierdo;
- eje X hacia la derecha y eje Y hacia arriba;
- coordenadas absolutas en milímetros;
- seis decimales;
- `G1` modal, seguido solamente por líneas `X... Y...`;
- salida Windows `CRLF`;
- ausencia de código final `M30/M5`;
- regreso a `X0 Y0`;
- una línea en blanco al final del archivo.

El formato quedó calibrado contra VectorLinker. **La primera ejecución física de cualquier versión nueva debe hacerse en seco, con el hilo apagado**, para verificar sentido, escala, límites y retorno al origen.

## Qué hace

1. Lee el tamaño real del SVG en milímetros.
2. Importa paths cerrados y aplanados con `M/L/H/V/Z`.
3. Agrupa contornos por pieza.
4. Detecta contornos exteriores, huecos e islas mediante contención.
5. Calcula las uniones interiores necesarias para acceder a los huecos.
6. Calcula conexiones válidas entre piezas sin atravesar material.
7. Selecciona una red mínima sin ciclos y con una sola conexión al origen.
8. Inserta los puntos de unión dentro de cada contorno.
9. Construye un recorrido único y cerrado: cada contorno una vez y cada unión de ida y vuelta.
10. Convierte SVG `Y hacia abajo` a máquina `Y hacia arriba`.
11. Valida que todas las coordenadas estén dentro del área útil de 1250 × 600 mm.
12. Exporta TAP, SVG vinculado, simulador HTML, reporte y ruta JSON.

## Inicio rápido

Requisitos:

- Node.js 20 o superior.
- TypeScript solamente para recompilar. El ZIP ya incluye `dist/` compilado.

```bash
npm install
npm test
npm run convert:sample
```

También puede ejecutarse sin instalar dependencias porque se incluye el JavaScript compilado:

```bash
node dist/index.js samples/puma-logo-placa-1.svg \
  --output output \
  --profile config/corporearte-polifan-1250x600.json
```

## Archivos generados

Para `puma-logo-placa-1.svg` se crean:

```text
output/
├── puma-logo-placa-1.tap
├── puma-logo-placa-1-linked.svg
├── puma-logo-placa-1-preview.html
├── puma-logo-placa-1-report.json
└── puma-logo-placa-1-route.json
```

- `.tap`: archivo listo para cargar en GRBL Control, sujeto a la prueba en seco inicial.
- `-linked.svg`: contornos, uniones, origen y recorrido completo.
- `-preview.html`: simulador autónomo que muestra el cabezal y coordenadas de máquina.
- `-report.json`: validaciones, métricas, límites, piezas, contornos y advertencias.
- `-route.json`: datos completos para incorporar un editor de uniones dentro de Grafo.

## Origen y colocación del nesting

El perfil usa:

```json
{
  "originCorner": "bottom-left",
  "originStrategy": "geometry-bounds",
  "originLeadInMm": 8
}
```

`geometry-bounds` coloca el cero **debajo y a la izquierda del conjunto de piezas**, dejando 8 mm de entrada cuando existe espacio. Esto evita conservar un gran vacío inferior si Grafo acomoda las piezas desde la parte superior del SVG.

Para conservar literalmente la posición del nesting dentro de toda la placa:

```bash
node dist/index.js archivo.svg --origin-strategy plate-corner
```

Para indicar un punto exacto en coordenadas SVG:

```bash
node dist/index.js archivo.svg --origin-svg 2,414.463
```

El punto indicado será convertido a `X0 Y0` mediante `G92`.

## Uso como librería dentro de Grafo

```ts
import {
  CORPOREARTE_POLIFAN_PROFILE,
  generateHotwireJob,
} from "@grafo/hotwire-linker";

const job = generateHotwireJob({
  svg: nestingSvg,
  sourceName: "placa-42.svg",
  profile: CORPOREARTE_POLIFAN_PROFILE,
});

await storage.save("placa-42.tap", job.tap);

console.log(job.metrics);
console.log(job.routeMachine);
console.log(job.report);
```

El resultado principal es:

```ts
{
  parsed,        // piezas y contornos normalizados
  profile,       // perfil efectivo de máquina
  originSvg,     // punto del SVG convertido a X0 Y0
  bridges,       // uniones elegidas
  routeSvg,      // recorrido para dibujar en la UI
  routeMachine,  // recorrido ya convertido a X/Y de máquina
  metrics,
  tap,
  linkedSvg,
  previewHtml,
  report
}
```

La guía de integración más detallada está en [`docs/INTEGRACION_GRAFO.md`](docs/INTEGRACION_GRAFO.md).

## Contrato del SVG generado por Grafo

Formato recomendado:

```xml
<svg width="1200mm" height="600mm" viewBox="0 0 1200 600">
  <g id="corte">
    <path
      id="pieza-6-3-1"
      data-piece-id="pieza-6-3"
      d="M ... L ... Z"
    />
    <path
      id="pieza-6-3-2"
      data-piece-id="pieza-6-3"
      d="M ... L ... Z"
    />
  </g>
</svg>
```

Condiciones actuales:

- ancho y alto en unidades físicas, preferentemente `mm`;
- `viewBox` válido;
- paths cerrados con `Z`;
- paths aplanados con `M`, `L`, `H`, `V` y `Z`;
- sin `transform` en los paths;
- una pieza puede tener varios contornos;
- se recomienda `data-piece-id` en cada path;
- si falta `data-piece-id`, se elimina el último sufijo numérico del `id` para agrupar contornos.

Grafo ya genera el SVG de muestra cumpliendo este contrato.

## Perfil de máquina

El perfil editable está en:

```text
config/corporearte-polifan-1250x600.json
```

Los valores importantes son:

- área útil: `1250 × 600 mm`;
- avance: `F350`;
- Z inicial: `Z.24`;
- precisión: seis decimales;
- encabezado exacto de VectorLinker;
- código final vacío;
- `CRLF`.

Puede sobreescribirse la velocidad desde CLI:

```bash
node dist/index.js archivo.svg --feed 300
```

## Analizador de TAP

El proyecto incluye un analizador para comparar archivos existentes:

```bash
npm run analyze:reference
```

O directamente:

```bash
node dist/tap-analyzer.js reference/andina.tap
```

Reporta encabezado, cantidad de coordenadas, límites, distancia, tiempo, decimales, movimientos nulos y cierre del recorrido.

## Pruebas automatizadas

```bash
npm test
```

Las pruebas verifican:

- el SVG real del Puma: 7 piezas, 11 contornos y 11 uniones;
- una única unión al origen;
- cuatro uniones interiores;
- coordenadas no negativas y dentro de 1250 × 600 mm;
- encabezado, CRLF, seis decimales y cierre del TAP;
- propiedades conocidas de `andina.tap`: 21.407 coordenadas, recorrido cerrado y límites de 1226,961331 × 555,855823 mm.

## Límites actuales

- No interpreta curvas Bézier `C/Q/S/T` ni arcos `A`; Grafo debe entregar paths aplanados.
- No interpreta transformaciones SVG; Grafo debe aplicar las transformaciones antes de exportar.
- La selección de uniones es automática. El `route.json` está preparado para que Grafo agregue después un editor manual de puntos de enlace.
- No envía el trabajo por puerto serie: solamente genera el `.tap` para GRBL Control.
- La optimización prioriza distancia y ausencia de cruces. La decisión estética final puede requerir revisión humana en logos complejos.

## Estructura

```text
src/index.ts                 motor geométrico, generador TAP y CLI
src/tap-analyzer.ts          analizador de archivos TAP
src/tests/                   pruebas automatizadas
config/                      perfil de máquina
samples/                     SVG real de Grafo
reference/                   TAP real de VectorLinker y análisis
output/                      resultado de ejemplo
 docs/                       integración y validación física
```
