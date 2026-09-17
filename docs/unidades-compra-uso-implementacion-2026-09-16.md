# Compra, uso y equivalencias: primera implementación

Fecha: 16/09/2026. Rama: `codex/fix`.

Continúa la [investigación de compra y uso](unidades-compra-uso-equivalencias-investigacion-2026-09-16.md). Este documento describe lo implementado; la investigación conserva la fotografía anterior y la propuesta completa.

## Funcionamiento

- **Unidad de compra:** presentación predeterminada del material, con overrides de variante conservados.
- **Unidad de uso:** base para expresar el costo del material. El motor convierte luego a la unidad de consumo del paso cuando corresponde.
- **Precio informado por:** unidad explícita del importe de referencia. Puede ser distinta de compra: por ejemplo, comprar placas e informar el precio por m².
- **Equivalencia de compra:** cantidad de unidades de uso contenida en una unidad de compra. Se calcula por relaciones físicas/medidas o se informa manualmente por variante.

La ficha tiene el tab **Compra y costos**. La fila muestra el importe y su unidad en una sola línea; por defecto, los precios nuevos corresponden a compra. El lápiz permite informar otra unidad cuando el proveedor cotiza de una forma distinta. Si compra y uso coinciden, se omite el resumen redundante. Las equivalencias automáticas se muestran en una línea; el contenido manual se ingresa como «1 caja = [100] unidades». La ficha y el editor de costos usan el mismo componente compacto. Los cambios del editor se guardan junto con los precios.

Ejemplos verificados en la interfaz, como borradores descartados sin modificar los materiales reales:

| Compra y precio | Uso | Resultado |
| --- | --- | --- |
| Rollo de 1,37 × 50 m a $137.000 | m² | 68,5 m² por rollo; $2.000/m² |
| Caja de 100 a $12.000 | Unidad | 100 unidades por caja; $120/unidad |

## Cálculos y validaciones

El resolver puro de `apps/api/src/inventario/material-units.ts`, reexportado para la interfaz, centraliza estas conversiones:

- Relaciones físicas: longitud, superficie, volumen y masa dentro de su dimensión.
- Medidas de placas, hojas, rollos y barras según las unidades declaradas por las plantillas; volumen de envases de tinta/químicos. No infiere metros o milímetros por el tamaño del número.
- Contenido manual positivo cuando no hay una conversión automática. No asigna un factor universal a caja, pack, rollo o resma.
- Rechazo de un factor manual que contradiga una relación física o las medidas.
- Normalización del precio a uso para materiales del motor, candidatos, consumibles y componentes de desgaste, conservando el fix de PVC.
- Costo de referencia de los ingresos de stock convertido a la unidad base. Un costo explícito del ingreso prevalece y no requiere completar el precio de referencia.
- Bloqueo del cambio de unidad de uso cuando existen movimientos o saldo, tanto en la ficha como en el editor masivo.

El precio de referencia conserva hasta seis decimales en ficha, editor masivo y actualización individual; el factor manual se almacena con ocho decimales. Esto no rediseña la precisión de todos los movimientos de stock existentes.

## Migración y datos actuales

Migración `20260917003000_material_compra_uso`, aplicada en desarrollo y en la base aislada de pruebas:

- Agrega `unidadPrecio` y `equivalenciaCompra` a `MateriaPrimaVariante`.
- No modifica importes, órdenes, presupuestos ni sus snapshots.
- Completa automáticamente la unidad del precio únicamente cuando compra y uso efectivos coinciden.
- Cuando compra y uso difieren, conserva el importe y pide confirmar su unidad. Si el motor necesita ese precio, no lo usa hasta que la conversión sea resoluble.
- La configuración incompleta puede guardarse. Si el precio ya está expresado en uso, el costeo puede resolverse aunque todavía falte el contenido de compra.

La auditoría previa encontró **61 variantes activas con compra y uso diferentes, 58 con precio**. La magnitud del precio no prueba su unidad. Las **28 variantes caja → unidad** tampoco tenían contenido declarado: hay que completar ese dato si se quiere convertir un precio por caja. No se inventaron cantidades ni se dividieron precios de forma masiva.

La ficha ahora conserva los overrides de unidades existentes. Cambiar las unidades generales desde la interfaz las aplica a todas las variantes; la API valida el historial antes de permitirlo. En el editor masivo, un contenido manual debe revisarse también si se cambian sus unidades.

## Verificación

- 11 suites de API: 137 pruebas aprobadas de inventario, motor, PVC, consumibles, merma y desgaste.
- Después de incorporar los controles de costo explícito y precisión individual, se repitieron las 7 suites de inventario: **39 pruebas aprobadas**, incluyendo 9 pruebas de persistencia en `gdi_saas_test` con un tenant temporal propio.
- 11 pruebas frontend de coherencia entre las unidades de las plantillas y el resolver.
- TypeScript frontend y compilación de API aprobados.
- ESLint de los archivos de implementación revisados: sin errores; la ficha conserva tres advertencias previas de dependencias de hooks.
- Revisión visual de ficha PVC, rollo y caja; despliegue de equivalencias del editor masivo.

## Alcance pendiente

Esta etapa ofrece **una presentación predeterminada por variante**. Quedan para las siguientes etapas:

- Varias presentaciones del mismo artículo y presentaciones por proveedor.
- Registrar una compra como «2 cajas de 100» conservando cantidad original, unidad y factor histórico. El endpoint de stock sigue recibiendo cantidades en unidad base.
- Versionado de presentaciones, mínimos de compra y redondeo de reposición.
- Extender el contrato a importaciones/biblioteca y otras pantallas auxiliares que aún muestran el precio de referencia sin conversión. No se reemplazaron indiscriminadamente las librerías antiguas de unidades.

No se recalcularon documentos guardados ni se implementó el módulo completo de compras o stock.
