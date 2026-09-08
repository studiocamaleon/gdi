# Fase 4.3 — Pricing composicional para productos compuestos

**Estado:** COMPLETA · QA FUNCIONAL, DESKTOP Y RESPONSIVE APROBADO

**Rama propuesta:** `visual-ilusion/fase-4-3-pricing-compuestos`

**Dependencias:** Fase 4.2 cerrada y validada. No depende de Fase 5.

## 0. Punto de partida validado

El 2 de septiembre de 2026 se fijó en la prueba de integración del motor el
comportamiento `GENERAL` previo a modificar el contrato. El escenario usa un
producto compuesto con una regla de margen del 25 % en el padre y una regla
del 35 % en el producto hijo, y verifica que:

- el precio consolidado usa exclusivamente la regla del padre;
- el componente fabricado aporta costo, pero no expone un precio propio;
- el snapshot del ítem cotizado conserva la regla general efectiva;
- una nueva revisión productiva del hijo sigue invalidando al padre hasta que
  se publique nuevamente.

Esta prueba es el golden master de compatibilidad: cuando se introduzcan
`POR_COMPONENTE` y `MIXTO`, la estrategia `GENERAL` deberá seguir produciendo
el mismo contrato y resultado.

Evidencia ejecutada:

- 9 suites focalizadas de Fase 4.2: 84 pruebas aprobadas;
- suite completa de integración del motor: 87 pruebas aprobadas;
- golden master focalizado de Fase 4.3: aprobado;
- contrato base de estrategia y política BOM: 10 pruebas aprobadas y build de
  API aprobado.

Segundo incremento implementado:

- `USAR_PRODUCTO_HIJO` congela la regla vigente del hijo al guardar el
  borrador y vuelve a verificarla al publicar;
- `OVERRIDE` congela la regla contextual de la relación BOM;
- una revisión publicada conserva ese snapshot aunque luego cambie el pricing
  del producto hijo;
- el motor expone la política congelada y una asignación reconciliada de costos
  entre el bloque general y los bloques propios de componentes;
- `GENERAL` conserva el algoritmo anterior sin desvíos.

Tercer incremento implementado:

- `MIXTO` y `POR_COMPONENTE` calculan el bloque general con la regla efectiva
  del padre y cada bloque propio con su snapshot congelado;
- los métodos escalonados usan la cantidad comercial natural del componente,
  no la cantidad del producto padre;
- impuestos internos, comisiones e IVA se consolidan sobre una única línea;
- el descuento se calcula una sola vez sobre el neto agregado y se prorratea
  sólo para explicar el margen de cada bloque;
- el redondeo monetario visible ocurre al consolidar la línea, manteniendo alta
  precisión en los cálculos intermedios;
- costos declarados sin margen conservan esa condición dentro de su bloque;
- el desglose calculado y los snapshots se guardan en la trazabilidad del ítem
  cotizado.

Validación acumulada del corte: 55 pruebas del aplicador de precios, 10 del
contrato compuesto, 4 de validación de receta y 87 de integración completa del
motor aprobadas.

## 1. Problema que resuelve

El motor ya costea cada componente fabricado mediante su receta y `JobContext`
aislado, pero el precio comercial del producto compuesto se calcula hoy una
sola vez sobre el costo agregado y con la regla del producto padre. La regla de
pricing del hijo no participa del precio vendido por el padre.

Ese comportamiento es correcto para un kit cerrado con margen homogéneo, pero
no alcanza cuando el compuesto combina bloques con lógicas comerciales
distintas, por ejemplo:

- impresión propia con margen por cantidad;
- estructura comprada trasladada con margen reducido;
- electrónica con margen específico;
- tercerización trasladada sin margen;
- ensamblaje e instalación con margen general del producto padre.

La fase agrega pricing por componente sin perder el modo general actual ni
convertir los componentes internos en líneas comerciales independientes.

## 2. Decisión de dominio

El producto compuesto elegirá una estrategia versionada:

```ts
type EstrategiaPricingCompuesto =
  | "GENERAL"
  | "POR_COMPONENTE"
  | "MIXTO";
```

- `GENERAL`: conserva exactamente el comportamiento actual. El costo completo
  recibe una única regla del producto padre.
- `POR_COMPONENTE`: cada relación BOM define cómo valorizar su costo y los
  costos directos del padre usan la regla general del padre.
- `MIXTO`: sólo los componentes marcados usan una regla propia; los demás se
  incorporan al bloque general.

`GENERAL` será el valor por defecto y la migración de todos los productos
existentes. Activar una estrategia nueva será una decisión explícita.

El contrato se almacena como metadata `compuesto` dentro de
`Producto.precioConfigJson`. Esto mantiene junta la decisión comercial con la
regla general vigente y evita una migración destructiva. La lectura de un JSON
histórico sin esa metadata devuelve siempre `GENERAL`.

## 3. La política pertenece a la relación BOM

La misma receta hija puede utilizarse en productos padres con posicionamientos
comerciales diferentes. Por eso la política efectiva no puede vivir solamente
en el producto hijo.

Cada ocurrencia del componente en la revisión de receta declarará:

```ts
type PoliticaPricingComponente = {
  modo: "HEREDAR_PADRE" | "USAR_PRODUCTO_HIJO" | "OVERRIDE";
  precioConfigOverride?: TabPrecioConfig;
};
```

- `HEREDAR_PADRE`: su costo entra al bloque general del padre.
- `USAR_PRODUCTO_HIJO`: toma como referencia la configuración vigente del hijo
  al publicar la revisión y la congela en el snapshot del padre.
- `OVERRIDE`: usa una regla específica de esta relación BOM.

La política se persiste en `ProductoRecetaComponente.configuracionJson.pricing`.
Una relación histórica sin esa propiedad se interpreta como
`HEREDAR_PADRE`; una decisión explícita inválida se rechaza al guardar el
borrador.

Una revisión publicada nunca seguirá cambios futuros del hijo de manera
silenciosa. Publicar una nueva regla o una nueva versión del hijo exige una
nueva revisión del padre.

## 4. Orden correcto del cálculo

No se sumarán precios brutos finales de componentes. Eso duplicaría impuestos,
comisiones, descuentos y redondeos.

El cálculo será:

1. costear cada componente y el trabajo propio del padre;
2. separar los costos en bloques según su política;
3. aplicar a cada bloque su regla de margen o precio para obtener importes
   netos antes de cargas comerciales comunes;
4. sumar los bloques netos;
5. aplicar una sola vez impuestos, comisiones, descuento y redondeo de la línea
   comercial del producto compuesto;
6. calcular el margen efectivo consolidado y por bloque.

La implementación conserva dos límites explícitos: primero asigna y reconcilia
costos; después aplica las reglas congeladas y consolida la única línea
comercial. Ambos límites están disponibles en backend y el editor permite
configurar y anticipar la estructura efectiva de bloques antes de cotizar.

Los cargos marcados `sin margen` conservan su semántica. No pueden adquirir
margen accidentalmente al pasar por una regla de componente.

## 5. Contrato de salida y trazabilidad

La cotización conservará un desglose similar a:

```ts
type DesglosePricingCompuesto = {
  estrategia: EstrategiaPricingCompuesto;
  bloqueGeneral: BloquePricing;
  componentes: Array<{
    codigo: string;
    productoId: string;
    politica: PoliticaPricingComponente;
    costoTotal: number;
    netoAntesDeCargas: number;
    margenEfectivoPct: number;
    precioConfigSnapshot: TabPrecioConfig | null;
  }>;
  netoListaTotal: number;
  impuestosTotal: number;
  comisionesTotal: number;
  descuentoTotal: number;
  brutoTotal: number;
};
```

El cliente continúa viendo una única línea salvo que otra capacidad comercial
decida desglosarla. El detalle interno requiere permisos de costos/márgenes y
no debe filtrarse a documentos públicos.

## 6. Interfaz

En `Pricing` de un producto compuesto se implementó:

- selector `Pricing general | Por componente | Mixto`;
- resumen del costo y regla efectiva de cada componente;
- acción para heredar del padre, usar la regla del producto hijo o establecer
  un override contextual;
- previsualización estructural del bloque general, los bloques propios y su
  regla efectiva; los importes se calculan al cotizar con medidas y cantidades
  reales;
- advertencias por componentes sin regla, márgenes negativos o configuraciones
  incompatibles con la unidad comercial del padre;
- comparación funcional contra el modo general en el contrato de cotización y
  su snapshot trazable.

La edición seguirá ocurriendo en el producto padre. Abrir la ficha del hijo
será una navegación auxiliar, no un requisito para completar el compuesto.

## 7. Invariantes

- `GENERAL` produce el mismo resultado que antes de esta fase.
- Impuestos, comisiones, descuentos y redondeo se aplican una sola vez.
- Una regla del hijo no se consulta en vivo después de publicar la revisión del
  padre.
- La suma de bloques de costo coincide con el costo total del motor.
- Ningún costo aparece simultáneamente en el bloque general y en un componente.
- Un componente omitido o condicional inactivo no aporta costo ni precio.
- Los permisos de margen se respetan en API, UI, snapshots y exportaciones.
- Recotizar explica qué regla produjo cada importe.

Cuarto incremento implementado (interfaz):

- Pricing del producto padre permite elegir `GENERAL`, `MIXTO` o
  `POR_COMPONENTE`.
- Cada relación BOM puede heredar, usar la regla congelada del producto hijo o
  definir un override contextual con el mismo editor de reglas existente.
- La vista previa estructural muestra bloque general, bloques propios y regla
  efectiva antes de cotizar.
- Guardar actualiza la configuración comercial y crea o modifica el borrador
  de receta correspondiente; la interfaz advierte que esa revisión debe
  publicarse desde Routing.
- Las relaciones históricas sin configuración operativa reciben un binding de
  cantidad equivalente al multiplicador legacy antes de incorporar su
  política de pricing.
- Contrato UI cubierto con 5 pruebas focalizadas y chequeo TypeScript.
- QA visual desktop aprobado sobre un compuesto publicado con dos componentes:
  se validaron estados `GENERAL`, `MIXTO`, override contextual, preview de
  bloques y avisos de borrador sin persistir datos de prueba.
- La pestaña completa adopta el lenguaje visual de Grafoprint: secuencia por
  capas, encabezados con marca, regla base en dos planos, cargas comerciales
  agrupadas y excepciones con editor contextual. Se validó también el estado
  mixto y el alta de precio especial sin persistir datos de prueba.

Quinto incremento y cierre funcional:

- La prueba de integración usa cuatro ocurrencias del mismo producto hijo y
  cubre `HEREDAR_PADRE`, `USAR_PRODUCTO_HIJO`, `OVERRIDE` y un componente
  opcional omitido.
- La misma cotización se valida en `GENERAL`, `MIXTO` y `POR_COMPONENTE`, con
  una única línea comercial, costos sin duplicación y snapshots persistidos.
- El componente omitido no participa del costo, del precio ni del desglose; la
  regla publicada del hijo permanece congelada aunque su configuración viva
  cambie.
- Los residuos de redondeo por bloque se absorben de forma determinista para
  que cada suma visible reconcilie exactamente con los totales consolidados.
- QA responsive aprobado en Chrome real a 390 × 844 y 768 × 1024: no hay
  desborde horizontal de página y la tabla conserva su scroll local.
- Regresión final aprobada: API 206 suites/1.997 pruebas, frontend 62
  archivos/588 pruebas, 10 snapshots y ambos builds de producción.

## 8. Migración y compatibilidad

- No se cambia el resultado de productos simples.
- Los compuestos existentes migran implícitamente a `GENERAL`; no hace falta
  backfill destructivo.
- Los snapshots históricos conservan su resultado y se interpretan como
  pricing general.
- Las nuevas propiedades se incorporan con lectura tolerante para revisiones
  anteriores.

## 9. Criterios de salida

- Un compuesto en `GENERAL` conserva precio y margen de la versión anterior.
- Un compuesto con impresión, estructura y ensamblaje aplica tres políticas
  distintas y produce una sola línea comercial.
- El total no duplica IVA, comisiones ni redondeos.
- Cambiar el pricing del producto hijo no altera una revisión publicada del
  padre.
- Un componente condicional omitido desaparece también del desglose de precio.
- El snapshot permite reconstruir costo, neto, margen, cargas y total de cada
  bloque.
- Pruebas unitarias, integración, regresión del cotizador y QA visual desktop y
  mobile aprobadas.

## 10. Fuera de alcance, con destino

- Mostrar componentes como renglones comerciales editables: fase comercial
  futura, si el negocio lo requiere.
- Descuentos distintos por componente visibles al cliente: evaluar junto con
  matrices comerciales.
- Optimización de material entre componentes: Fase 4.4.
- Consolidación de nesting entre órdenes diferentes y edición de planes: Fase
  5.
