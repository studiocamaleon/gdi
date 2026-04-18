# NestingPreview — visualización canónica de nesting

Componente 2D SVG reutilizable para renderizar el resultado de cualquier nesting
(rollo, pliego o placa) del modelo universal.

## Contrato

```ts
type NestingContainer =
  | { type: 'rollo'; printableWidthMm: number; consumedLengthMm: number; rolloAnchoTotalMm?: number; marginLeftMm?: number; marginStartMm?: number; marginEndMm?: number }
  | { type: 'pliego'; anchoMm: number; altoMm: number; margenMm?: number }
  | { type: 'placa'; anchoMm: number; altoMm: number; margenMm?: number };

type NestingPlacement = {
  x: number;         // offset desde esquina sup-izq del contenedor, en mm
  y: number;
  anchoMm: number;
  altoMm: number;
  rotada?: boolean;
  label?: string;    // opcional: texto a mostrar en la pieza
  colorKey?: string; // opcional: id para agrupar piezas por color (ej. multi-medida)
};

type NestingPreviewProps = {
  container: NestingContainer;
  placements: NestingPlacement[];
  /** Altura máxima en px del componente. Default 400. */
  maxHeightPx?: number;
  /** Mostrar dimensiones y escala del contenedor. Default true. */
  showDimensions?: boolean;
  /** Mostrar grid sutil de fondo tipo CAD. Default true. */
  showGrid?: boolean;
  /** Paleta de colores por colorKey. Default paleta canónica. */
  colorPalette?: Record<string, string>;
};
```

## Decisiones de diseño

- **2D SVG puro**, sin Canvas ni Three.js. Razón: la industria (SigmaNEST,
  CutRite, Kongsberg, Caldera) usa 2D top-down para nesting porque
  maximiza la densidad de información.
- **Proporciones reales**: el SVG mantiene la relación de aspecto del
  contenedor. Se escala al ancho del padre conservando legibilidad.
- **Las dimensiones están en mm**: todo el cálculo y rendering usa mm; el
  SVG resuelve el scaling interno vía viewBox.
- **Los 3 contenedores tienen convenciones visuales distintas**:
  - `rollo`: horizontal, con "dirección de avance" implícita (y crece hacia
    abajo = material saliendo de la impresora). Muestra zona no-imprimible
    lateral si hay márgenes.
  - `pliego`: rectángulo cerrado, márgenes perimetrales sombreados.
  - `placa`: idem pliego pero con tratamiento visual de "rígido" (bordes
    más gruesos, color de material).
- **Colores de piezas**: por defecto asigna un color por `colorKey` (o por
  dimensiones únicas si no hay key). Paleta canónica pensada para alto
  contraste con el fondo, accesible en modo claro y oscuro.
- **Sin dependencias**: solo React + utility classes (tailwind). Nada de
  libs de dibujo ni animación.

## Integración

Los 5 motores v2 (gran_formato, vinilo_de_corte, impresion_digital_laser,
rigidos_impresos, talonario) emiten en la trazabilidad de cada paso
`produce`:

```
paso.trazabilidad.nesting = {
  algoritmo: 'nesting-rollo' | 'nesting-hoja' | 'nesting-placa-rigida',
  placements: NestingPlacement[],
  ...resto específico
}
```

El componente consume estos `placements` + datos del contenedor (que
vienen del material/máquina elegido por el motor).

## No hace

- No calcula nesting (eso está en `apps/api/src/productos-servicios/nesting/`).
- No modela interacción (drag para mover piezas) — solo visualización.
- No exporta a DXF/PDF (future work: vía el mismo SVG).
