# Vista consolidada de costos de una OT (tab Costos)

Estado: **implementado** (Fases 1 y 2), 2026-07-26.

El tab existía desde el diseño original de la ficha pero mostraba un `EmptyTab`
con el texto "Vista consolidada de costos". Ahora muestra el costo de la orden
entera y compara lo cotizado contra lo que registró el taller.

## 1. Por qué existe (qué da que no daba ninguna otra pantalla)

El desglose por producto ya existía (tab Productos › Costos, `CostosItemView`):
cascada del precio, contribución y desglose por paso. Lo que faltaba es lo que
sólo se ve a nivel ORDEN:

1. **Consolidar entre items.** Con 6 productos había que abrir uno por uno y
   sumar de cabeza.
2. **Imputar los cargos de ORDEN.** El flete y el viático se cargan a la orden,
   no a un producto, así que no aparecen en el costo de ningún item: el margen
   por producto está inflado respecto del margen real de la orden. Este tab es
   el único lugar donde el margen de la OT es correcto.
3. **Costo por centro de costo cruzando todos los productos** — "qué máquina se
   comió esta orden", que no se puede deducir mirando producto por producto.
4. **Real vs. cotizado de ESTA orden.** Reportes ya compara minutos reales
   contra estimados, pero agregado a nivel tenant. Nadie podía preguntar "¿este
   trabajo costó lo que dijimos?".

## 2. Una sola implementación de la matemática

`src/lib/costos-orden.ts` concentra la cuenta. `CostosItemView` (por producto) y
`CostosOrdenTab` (consolidado) la consumen; el componente por producto se
refactorizó para que llame a `calcularCostoItem` en vez de recalcular.

No es prolijidad: la cascada tiene sutilezas —impuestos por dentro con base NETO
o BRUTO_COBRADO, el residuo de redondeo que absorbe el último impuesto, qué
cuenta como costo variable— y tenerlas escritas dos veces garantizaba que un día
dieran distinto en dos pantallas que el usuario compara lado a lado.

`consolidarCostosOrden` suma los desgloses por item y agrega los cargos de orden.
Dos decisiones que no son obvias:

- El **margen de la orden NO es la suma de los márgenes de los items**: hay que
  restarle los cargos de orden, que ningún item cargó. Igual la contribución
  (los cargos de orden son variables: se gastan por este trabajo).
- Los cargos de orden entran por su **neto**. El impuesto del cargo es del eje
  del precio, no del costo; sumarlo contaría el IVA como si fuera costo.

Snapshots viejos guardan el costo total del item pero no sus buckets. La
composición expone el faltante como **"Sin desglosar"** en vez de repartirlo: la
barra tiene que sumar el costo real, y un bucket inventado es peor que un hueco
explícito.

## 3. Real vs. cotizado

### Emparejamiento
`cruzarRealVsCotizado` cruza el paso materializado (`OrdenTrabajoItemPaso`, que
tiene el tiempo real) con el paso del snapshot de costeo (que tiene la tarifa y
el costo). La clave es **`rutaPasoId`**, que la materialización ya copiaba de la
trazabilidad pero no viajaba al front: se agregó a la proyección del tablero
(`toTableroItem`). Cuando falta (órdenes viejas) cae al **índice entre los pasos
activados**, que es exactamente el orden que usó la materialización — un
fallback fiel, no una adivinanza. Lo que no se puede cruzar se cuenta y se
informa (`pasosSinEmparejar`), no se descarta en silencio.

### Valuación
El costo real se calcula con la **tarifa congelada al cotizar**, no con la
vigente. Así el desvío que se ve es el del TIEMPO y no una mezcla de tiempo con
un cambio de tarifa entre el día que se cotizó y hoy. No hizo falta tocar el
backend para esto: el snapshot del paso ya guarda `tarifaHora` y
`tarifaManoObra`.

Se reescala **sólo la máquina**. La mano de obra se paga sobre setup/cleanup y el
cronómetro mide el paso entero, así que reescalarla con el tiempo total la
inflaría (ver `hora-hombre-setup-cleanup-diseno.md`).

### Qué NO se compara, y por qué importa
Un paso en modo `solo_completar` asienta como tiempo real una **copia del
estimado** (D3 de registro-tiempos): nadie lo midió. Contarlo como medido es el
error silencioso más fácil de cometer acá — mete un desvío cero garantizado en
el numerador y el denominador. En la OT-2026-0030 real eso hacía decir
"cobertura 100%, desvío +5,2%" cuando lo honesto era **"cobertura 66,7%, desvío
+25,1%"**. `tiempoFueMedido` acepta sólo `medido`, `medido_lote` y `declarado`.

También quedan afuera los tiempos **atípicos** (>8 h, o >5× el estimado), con el
mismo criterio que usa el Panel (`reportes/produccion.service.ts`).

La cobertura se expresa sobre los pasos **hechos**, no sobre todos: los
pendientes no tienen tiempo porque todavía no se trabajaron, y meterlos en el
denominador haría ver como falta de registro lo que es trabajo por hacer.

Todo lo excluido se declara en la nota al pie. Un desvío sin su cobertura al
lado es un número que miente por omisión.

## 4. Permiso

El tab ya estaba gateado por `finanzas.ver_margenes` (y el API poda los campos
de plata vía `@OcultaMargenes` + `podarPlata`), así que no hubo que agregar nada.

## 5. Qué falta (Fase 3, no implementada)

El costo de **materiales y de proveedor es siempre el cotizado**, nunca el real:

- **Consumo real de material**: el enum `CONSUMO_PRODUCCION` existe en el schema
  pero nadie lo escribe — producción no descuenta stock. Cerrarlo es escribir
  `MovimientoStockMateriaPrima` al completar los pasos que consumen material.
- **Factura real del proveedor**: `OrdenTrabajoItemPaso` guarda proveedor, plazo
  y `estadoCompra`, pero no hay campo para lo que el proveedor terminó
  facturando.

Con esas dos, el tab pasa de "desvío de tiempos" a costeo real completo. Tocan
inventario y compras, así que son un módulo aparte.

Aparte: **`AhorroConsolidacion` no tiene `ordenId`**, así que el ahorro por
consolidar no se puede atribuir a una orden.

## 6. Hallazgos al pasar (no corregidos)

- Los **cargos de orden se rehidratan agregados** en una sola línea "Cargos
  directos de la orden" (`propuesta-ficha.tsx`, `rehidratarOrdenItem`): en una
  OT emitida se perdió el detalle de qué cargo era. El consolidado muestra el
  total correcto pero no puede desglosarlo.
- **`tarifaHora` y `tarifaManoObra` no están en `CAMPOS_DE_PLATA`**
  (`auth/margenes.ts`), así que viajan en el snapshot incluso a quien no tiene
  `finanzas.ver_margenes` — que sí recibe los `costo*` podados. Es una fuga
  chica y consistente en todo el sistema, no de este tab.
- **`--muted-bg` no está definida en ninguna parte** y varias reglas de
  `globals.css` la usan como `background`: resuelven a transparente.
