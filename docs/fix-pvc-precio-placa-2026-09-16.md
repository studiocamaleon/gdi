# Precio por m² en el costeo de placas

## Caso reproducido

Producto `PVC Espumado`, variante blanca de 3 mm:

- Precio de referencia: 8264,462810 por m²; compra y uso configurados en M2.
- Placa: 1220 × 2440 mm = 2,9768 m².
- Pieza: 500 × 500 mm, una unidad, impresión CMYK.
- Estrategia de la ruta: tramos de 15, 30, 45, 60, 75, 90 y 100 %.
- El nesting selecciona el tramo de 30 %.

El motor pasaba el precio por m² al argumento `unitPrice` del costeo de
nesting, cuyo contrato exige precio por placa. El resultado era 2479,34,
con un unitario de 8264,46 etiquetado como hoja. No era un error exclusivo
de presentación: afectaba el costo y el precio de venta calculado sobre él.

## Corrección

Antes de aplicar cualquiera de las cuatro estrategias de placa, el motor
convierte un precio de referencia M2 a precio de placa usando el área física
del sustrato del nesting. Si el precio ya corresponde a una hoja/unidad,
no lo vuelve a multiplicar por el área.

- Precio de placa: 8264,462810 × 2,9768 = 24601,652892808.
- Tramo de 30 %: **7380,50**.
- Placa completa: **24601,65** al mostrar dos decimales.
- Área exacta de esa pieza: 0,25 m² × 8264,462810 = **2066,12**.

La línea usa precio por placa y cantidad de placas en los modos por tramos,
largo utilizado y placa completa. Área exacta informa siempre m² y precio
por m², incluso si el catálogo tiene el precio por hoja. El desglose del
nesting conserva ambos precios para el detalle y la consolidación de lotes.

No se cambian las medidas, los tramos ni los precios guardados del catálogo.
En la cotización real comparada, las cuatro tintas siguen consumiendo 1,25 ml
y los tiempos mantienen sus importes. La corrección aplica también a otros
materiales en placas con precio M2 que usan este camino de costeo.

Las cotizaciones/órdenes existentes conservan sus snapshots. El resultado
corregido se obtiene al recalcular; no hay actualización masiva de históricos.

## Validación

- Reproducción con el producto y material de desarrollo, antes y después,
  mediante `cotizar` (sin emitir ni guardar una orden).
- 10 pruebas nuevas: caso PVC, equivalencia de precio M2/hoja en las cuatro
  estrategias, unidades del área exacta, placa completa, merma y rollos.
- 99 pruebas aprobadas entre regresión, estrategias, dispatcher,
  consolidación y consumibles; otras 87 del motor completo aprobadas.
- TypeScript de producción y build del API aprobados.
- Verificación en Crear orden, producto PVC Espumado, una pieza de 50 × 50 cm
  CMYK: el detalle muestra **0,30 hojas × $24.601,65/hoja** y **$7.381**
  (la tabla presenta el subtotal sin decimales; el cálculo es 7380,50).
  No se emitió ni guardó una OT de prueba.
- ESLint del test nuevo sin errores. El motor conserva los mismos 84
  diagnósticos previos de formato/aserciones de tipos que su versión en HEAD;
  ninguno corresponde a los bloques modificados.

## Siguiente etapa: compra y uso

Queda separada la definición de equivalencias manuales por material/variante
(rollo → m², caja → unidades, etc.). Hoy el catálogo distingue unidad de
compra y de stock/uso, con conversiones canónicas y algunas derivaciones
geométricas para rollos, pero no tiene un contrato general de equivalencias
configurables. Este fix no agrega factores arbitrarios ni cambia esa interfaz.
