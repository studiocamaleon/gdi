# Compra, stock, consumo y equivalencias por variante

## Funcionamiento

Cada material tiene tres unidades independientes. Las variantes pueden heredar esas unidades o conservar sus valores particulares:

- **Compra:** presentación habitual del proveedor.
- **Stock:** unidad en la que se registran existencias y saldos.
- **Consumo:** base del costo que recibe el motor de cotización.

El precio conserva su moneda y su unidad explícita. Al cambiar la unidad general de compra en la ficha o el editor de costos, se actualiza también la unidad del precio de todas las variantes, conservando el importe. Después se puede ajustar la unidad junto al precio de una variante si el proveedor cotiza de otra manera. Los cambios de stock o consumo no modifican la unidad del precio.

El editor de costos mantiene el mismo orden que la ficha: **Compra · Stock · Consumo**. Cada variante muestra la unidad efectiva, incluida la heredada del material. Una selección general reemplaza las excepciones de ese rol y se guarda incluso si se vuelve a la unidad original del material; abrir el editor no modifica las excepciones existentes.

Los borradores del editor se agrupan por material y variante. Al editar se actualizan sólo las filas afectadas, y las conversiones/opciones se reutilizan hasta que cambien las unidades, medidas o coeficientes. El guardado sigue tomando todos los cambios pendientes, incluidos los materiales ocultos por la búsqueda; no se retrasa la captura de importes ni coeficientes. La búsqueda permite escribir mientras se actualiza el listado.

**Hoja y Placa** están disponibles como opciones distintas y representan la misma unidad física (1 a 1). Se conserva el término elegido en el catálogo y los desgloses. Ambas convierten a m² con ancho × alto y a kg mediante las equivalencias propias de la variante; no se presume el peso.

En **Compra y costos** (también en el editor de costos) aparecen únicamente los coeficientes necesarios para conectar compra, stock y consumo. Las unidades vienen fijas de la configuración; sólo se edita el número, con coma o punto decimal. Ejemplos:

- `10 cajas por pallet`; `10 unidades por caja`. Un pallet de USD 500 equivale a USD 50/caja y USD 5/unidad.
- PAI: `1,1 kg por m²`. A USD 4,16/kg corresponde USD 4,576/m² (se muestra USD 4,58/m²). Una placa de 1 × 2 m cuesta USD 9,152.

Para PAI con compra en kg, stock en placas y consumo en m², se pide un único coeficiente kg/m²: la superficie de la placa se obtiene de sus medidas. Para pallet/caja/unidad se piden cajas por pallet y unidades por caja. Cuando todo se resuelve por medidas o conversiones físicas no se pide ningún coeficiente. Si la unidad del precio es diferente y no está conectada, se pide únicamente su factor adicional.

Internamente se conserva `1 origen = factor destino`: la unidad después de «por» es el origen. Al abrir la ficha, las relaciones anteriores se expresan en las unidades de los nuevos campos sin modificar los datos ni redondear el cálculo. Una relación anterior `1 kg = 1,1 m²` se muestra como `0,909090… kg por m²` y conserva el costo USD 3,78/m² a USD 4,16/kg. Al editar se reemplazan relaciones inversas o redundantes de la cadena principal y se conservan otras presentaciones, sin introducir ciclos contradictorios. No hay botones para agregar o quitar relaciones ni selectores libres de unidades.

Las conversiones se recorren en ambos sentidos y se encadenan. Las relaciones físicas —litro/ml, kg/g— y las medidas declaradas en las plantillas siguen resolviéndose automáticamente. No se presume contenido universal de cajas, pallets, resmas ni peso universal de una placa. Se rechazan factores inválidos y relaciones contradictorias, incluidos ciclos y contradicciones con medidas.

## Cotización y trazabilidad

El motor normaliza primero el precio a la unidad de consumo y después aplica el cambio de moneda del documento. Los materiales y consumibles de máquinas usan esa misma base. Para elegir por menor costo, los candidatos se comparan en una unidad común: USD 50/caja de 10 unidades es menor que USD 6/unidad. Las estrategias de nesting conservan su criterio de desperdicio: una conversión de unidades no cambia qué superficie o fracción de placa se cobra.

El snapshot del costo conserva precio/moneda originales, unidad del precio, compra, stock, consumo, equivalencias, recorrido de conversión y tipo de cambio. Cambiar el catálogo afecta cotizaciones futuras; no reescribe las guardadas.

## Movimientos de inventario

En ingresos y egresos se puede elegir la unidad de la cantidad. El servidor convierte a stock y muestra la equivalencia antes de registrar:

- Ingresar 2 pallets suma 20 cajas.
- Consumir 3 unidades descuenta 0,3 cajas.
- Un costo explícito de ingreso se informa **por la unidad seleccionada, en moneda local**. Si se omite, se toma el precio de referencia con sus equivalencias y cambio de moneda.
- Para recibir por kg/g un material stockeado en hojas, placas o unidades, se puede indicar además la cantidad realmente recibida. Ej.: 24 kg y 12 placas producen un coeficiente de 0,5 placas/kg sólo para ese ingreso. No se modifica el catálogo.
- Las transferencias siguen expresándose en la unidad de stock.

Cada ingreso/egreso guarda cantidad y unidad originales, cantidad en stock, factor, pasos utilizados y origen de la conversión. El historial muestra ambas cantidades cuando difieren. Los saldos admiten ocho decimales y el costo promedio conserva seis. Los movimientos simultáneos de una variante se serializan para no perder saldos.

La unidad de stock no puede cambiarse cuando existen saldos o movimientos: eso reinterpretaría el historial. Se permite alternar Hoja ↔ Placa porque sólo cambia el nombre: cantidades y costos son idénticos, y los snapshots históricos permanecen intactos. La unidad de consumo puede cambiar sin modificar existencias.

Este trabajo integra el centro de stock y el motor existentes. No incorpora un módulo de órdenes de compra ni activa descuentos automáticos de stock por finalizar una OT.

## Compatibilidad y migración

Migración: `20260917140000_material_equivalencias_cadena`.

- Agrega `PALLET`, unidad de consumo, equivalencias y snapshot de movimientos.
- Inicializa consumo con la unidad de stock existente, también en overrides de variantes.
- Conserva los factores de compra anteriores. Una lista nueva, incluso vacía, reemplaza el factor legado.
- No convierte saldos, modifica precios ni recalcula presupuestos históricos.

Migración `20260917150000_unidad_material_placa`: agrega `PLACA` al enum de inventario, sin reemplazar las unidades elegidas en materiales existentes.

## Validación

Pruebas sobre `gdi_saas_test`, aislada de desarrollo: cadenas, geometría, ciclos, persistencia, recepción real por peso, USD, salidas parciales, transferencias, concurrencia y conservación de snapshots. Regresiones del motor, PVC/placas y rollos. Comprobaciones TypeScript y lint de las interfaces modificadas. Verificación visual de los selectores y de la edición de una equivalencia en la ficha, sin guardar coeficientes ficticios en materiales existentes.
