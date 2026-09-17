# Inventario en USD y conversión al cotizar

## Uso

- La ficha de cualquier materia prima y el editor de costos permiten elegir, por variante, **USD o la moneda de la empresa**. Incluye sustratos, tintas, consumibles y repuestos. Cambiar la moneda indica en qué moneda está expresado el número ingresado; no convierte ese número automáticamente.
- El precio conserva su unidad de compra/precio y equivalencias de uso. El motor normaliza primero la unidad y después convierte la moneda, antes de comparar variantes o calcular costos.
- En **Configuración → Empresa → Precios del inventario en USD** se elige Automático o Manual para trabajos nuevos. Argentina utiliza **Oficial · venta** de DolarAPI por defecto.
- En el resumen de una OT o presupuesto, **Cambiar tipo de cambio** permite actualizar la tasa automática o ingresar una manual para ese documento. No modifica la preferencia general ni la cotización de referencia de la barra superior.
- Se captura una tasa por documento al comenzar a cotizar. Todos sus productos, componentes y segmentos del Centro de copiado comparten esa captura.
- Aplicar un cambio recalcula todos los productos en staging: si falla uno, no se reemplaza ninguna línea. En una OT existente requiere modo Edición y los cambios se confirman al guardar.
- Abrir un documento o convertir un presupuesto a OT conserva sus importes y su captura. Las líneas históricas anteriores a esta funcionalidad mantienen sus importes al agregar nuevas líneas; una actualización explícita del cambio recalcula todo.

## Ejemplo

Un insumo de **USD 10/m²**, con consumo material de **1,52 m²** y tipo de cambio **ARS 1.500/USD**, cuesta **ARS 22.800**. Se usa el consumo real del material (incluido el ancho del rollo cuando corresponda), que puede diferir del área comercial de las piezas.

## Trazabilidad y persistencia

- `TipoCambioCotizacion`: registro inmutable, por tenant, con moneda de origen/destino, tasa, modo, fuente/referencia, fecha de la fuente, instante de captura y usuario que la solicitó.
- `Cotizacion.tipoCambioId`: vincula el contenedor al registro. No permite mezclar capturas dentro del mismo contenedor.
- `CotizacionItem.snapshotJson.tipoCambio`: copia de la captura utilizada.
- `CotizacionItem.snapshotJson.costosMaterialesMoneda`: precios originales, monedas, unidades, precio normalizado de uso, factor y costo convertido de las variantes cargadas durante el cálculo. El desglose sólo presenta las utilizadas en el paso; estos costos se ocultan a usuarios sin permiso para ver márgenes.
- Las revisiones por cambio de tasa generan nuevos snapshots y la edición en lote de la OT conserva su vínculo con la cotización de origen, incluso si provino de un presupuesto.
- `DatosEmpresa.tipoCambioConfig` almacena la preferencia para futuras cotizaciones. Cambiar la moneda regional invalida el valor manual anterior y exige recotizar antes de reutilizar una captura con otra moneda de destino.
- Los ingresos de stock sin costo explícito convierten el precio de referencia a moneda local. Un costo de ingreso explícito sigue expresándose en moneda local. Los costos promedio y movimientos históricos no se revalúan con cada actualización del dólar.

## Disponibilidad y límites

- Automático utiliza la cobertura regional ya implementada en DolarAPI. Una empresa fuera de esa cobertura puede cargar una tasa manual; USD → USD usa factor 1.
- Si la fuente no está disponible, tiene otra moneda o la referencia supera 96 horas, no se acepta esa tasa para convertir USD. Los materiales en moneda local pueden seguir cotizándose. El usuario puede actualizar o ingresar una tasa manual.
- No se utiliza una paridad 1:1 implícita para convertir USD a otra moneda. Otras monedas extranjeras distintas de USD requieren ajustar el precio a USD o a la moneda de la empresa.
- Se conservan los importes y monedas existentes. La migración sólo completa monedas vacías con la moneda de la empresa, además de agregar la configuración y la tabla de capturas.

## Validación

- Migración `20260917040000_inventario_moneda_cambio` aplicada en desarrollo y base aislada de pruebas; cliente Prisma regenerado.
- 162 pruebas en la pasada final (tipo de cambio, DolarAPI, OT y persistencia de tomos), además de las suites de motor/inventario ejecutadas durante la implementación.
- Pruebas unitarias de conversión, equivalencias, aislamiento concurrente, fuente automática, override manual, configuración de empresa, monedas regionales, capturas históricas y rechazo de capturas mezcladas.
- Pruebas con motor y PostgreSQL: inventario en USD, persistencia del precio y tasa originales, recotización a otro cambio, Centro de copiado, revisión de OT y compatibilidad con líneas históricas.
- Suites de regresión de inventario, placas/rollos, motor y Centro de copiado.
- TypeScript en frontend y API. ESLint de los archivos nuevos y revisión de las líneas modificadas; permanecen advertencias/errores anteriores en archivos existentes fuera de esta implementación.
- Verificación visual en navegador de selectores de moneda, panel general y cotización manual de un vinilo a ARS 1.500/USD y posterior recálculo a ARS 2.000/USD. No se emitió una OT de prueba ni se cambiaron precios del inventario de desarrollo.

- API y worker de desarrollo reiniciados con la implementación actual. Prueba real a través de Redis/worker completada: captura manual de ARS 2.000/USD aplicada al material USD y devuelta sin emitir ni guardar una OT.
