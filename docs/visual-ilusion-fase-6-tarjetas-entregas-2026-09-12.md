# F6: distribución de tarjetas impresas en pliegos

## Incidente

Dos revisiones de una cotización de 500 tarjetas, distribuidas en cinco entregas de 100, fallaron con «hay consumos o costos de material inválidos». El historial conservaba ambos intentos fallidos; no era otro error.

La impresión incluía siete líneas `DESGASTE_MAQUINA` (tambores, rodillos, barras y banda de transferencia). Es válido parametrizarlas directamente en la máquina sin vincular un artículo de inventario, pero el adaptador exigía `materialVarianteId` para todas las líneas. Además, su resumen agrupaba por ese identificador vacío.

Al desbloquear esa validación aparecieron otras dos inconsistencias del recorrido: sólo se admitían placas físicas individualizadas y la recotización del lote conservaba las cantidades de piezas y métricas del pedido completo.

## Corrección

- Materiales y consumibles siguen exigiendo su variante; el desgaste exige máquina y componente. Todas las líneas mantienen las validaciones de cantidades y costos finitos y no negativos. Cada repuesto conserva una identidad independiente en la comparación y el resumen.
- La distribución comercial por entrega admite el acomodo rectangular completo cotizado de pliegos repetidos y rollos. Valida sus sustratos y posiciones; conserva una referencia al lote completo, sin representar una plantilla repetida como piezas físicas individualizadas.
- La recotización y la fuente persistida escalan piezas materiales/visibles, área y perímetro a la cantidad del lote. Medidas, caras y parámetros por unidad se conservan. Las colecciones que no representan unidades enteras se rechazan explícitamente.
- Cada entrega usa los costos, tiempos y acomodos de su propia cotización. No se prorratea el costo ni el tiempo del pedido original.
- La comparación distingue el acomodo completo del lote de las copias físicas de un layout. Un cambio de acomodo requiere la aceptación ya existente antes de elegir la propuesta. La UI dice «pliegos / placas» y «acomodo completo del lote» donde corresponde.

Los límites existentes para nesting vectorial, registro impresión/corte y consolidación entre componentes continúan vigentes. Esta corrección no amplía el piloto que reparte placas físicas a pliegos repetidos.

## Evidencia

Reejecución con el motor real y la misma solicitud del incidente, sin emitir OT ni elegir una distribución:

| Concepto | Pedido de 500 | Cada entrega de 100 |
| --- | ---: | ---: |
| Tarjetas en la demanda | 500 | 100 |
| Pliegos de impresión | 21 de 325 × 475 mm | 10 de 210 × 297 mm |
| Hojas de compra | 21 | 5 |
| Tóner por color | 4,5 g | 0,9 g |
| Laminado | 10,18 m | 2,25 m |
| Costo calculado | 27.729,52823 | 15.525,52333 |

El resultado contiene cinco entregas de 100 y 50 pliegos de impresión. La diferencia entre hojas compradas y pliegos impresos corresponde al corte del sustrato de compra que calcula el motor. Son valores del catálogo de desarrollo, no tiempos calibrados del taller.

Pruebas de regresión: desgaste separado y costos inválidos; cantidades y métricas del lote; pliegos repetidos y laminado en rollo; posiciones fuera del sustrato; conservación de una entrega única y aceptación de acomodos distintos. La integración en base de pruebas verifica solicitud, cálculo, persistencia del contexto de 100 y elección de las cinco entregas, sin afectar órdenes del usuario.

Verificación: 42 pruebas de adaptación/cantidades/layouts, 21 de distribución previa, 4 del worker y 16 del frontend. TypeScript de producción API y frontend, lint focal del frontend y `css:guard`. El chequeo TypeScript global del API también incluye suites antiguas con errores de tipos ajenos a este cambio; el chequeo de producción excluye esos specs y pasa.

Los intentos fallidos previos se conservan. Es necesario volver a calcular la distribución para generar una revisión con la corrección; no se reescribe el historial ni se adopta automáticamente una propuesta.
