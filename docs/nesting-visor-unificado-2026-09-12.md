# Navegación y dibujo del nesting

Implementación del criterio compartido entre la ficha de OT y el Plan de
fabricación. No cambia motores, cálculos de cotización, ETA ni layouts guardados.

## Recorrido

1. Abrir el resultado desde cualquier entrada. La cabecera informa superficies,
   layouts, piezas y aprovechamiento.
2. En **Layouts**, consultar el dibujo y las piezas por sustrato, con el
   multiplicador de cada layout. Seleccionar una pieza la destaca en la galería.
3. **Inspeccionar** abre **Detalle** en el primer sustrato de ese layout. El
   selector y las flechas recorren las superficies existentes. Una entrada con
   `count > 1` conserva una sola representación y explica qué hojas representa.
4. **Balance de piezas** presenta totales con repeticiones, demandas, faltantes y
   excedentes cuando existen demandas publicadas. Sin demanda no se inventa un
   objetivo. **Archivos** sólo aparece si la operación aporta descargas.
5. Al cambiar de pestaña se conserva el sustrato seleccionado. Al cambiar el
   resultado se descarta la selección anterior.

Las hojas de cuadernillos conservan su plan de páginas y la aclaración de que el
canvas representa la primera hoja del paso. Los talonarios mantienen agrupación
y copias. No se generan miles de canvas para un pliego repetido miles de veces.

## Base compartida

- `src/lib/nesting-vista.ts`: navegación, relación layout/sustratos y balance.
- `src/components/nesting/nesting-viewer.tsx`: contenedor único, instrucciones y
  datos de cálculo.
- `src/components/nesting/nesting-patrones-view.tsx`: galería y balance sin
  navegación ni renderer propios.
- `src/components/nesting/nesting-canvas.tsx`: renderer SVG extraído del visor
  detallado; conserva contornos, capas, márgenes, área útil, separación, solapes,
  demasías, ojales, imposición, costeo y líneas comunes de corte.
- `src/lib/nesting-cola-vista.ts`: adaptación de la simulación al mismo renderer,
  sin recalcular, alterar coordenadas o decidir el algoritmo.

La simulación de Colas mantiene los solapes que informa su contrato y su tabla.
Ese contrato no informa el eje del panel: el adaptador no inventa una franja de
solape en el dibujo. En la OT sí se dibuja cuando viene el eje en el resultado.

El plan de compra de pliegos sigue siendo una herramienta distinta: distribuye
pliegos de impresión dentro de una hoja de compra, no piezas de producto.

## Validación

Pruebas de navegación para pliegos únicos y repetidos, correspondencia de layouts,
rollos y cuadernillos; balance con faltantes y multiplicadores; paridad gráfica
entre miniatura y detalle; preservación de coordenadas, proporciones, solapes,
giros y capas; regresiones de agrupación, exportación y planes de fabricación.

Verificación realizada: 63 pruebas aprobadas; TypeScript y lint focalizado sin
errores; `css:guard` aprobado. En Chrome se recorrió la OT 0054, Lote A: galería,
selección del layout B y su placa 26, selector de placas, balance (450 piezas),
archivos del proceso de corte y visor ampliado. Se comprobó el selector dentro
del modal. En Colas se simuló 0050 + 0059: anchos 1,52 y 1,37 m, referencias de
ambos paneles y desplazamiento a escala legible del rollo largo. No se registró
ninguna acción de producción sobre esas órdenes. Tema oscuro y dispositivo móvil
no forman parte de esta comprobación visual.
