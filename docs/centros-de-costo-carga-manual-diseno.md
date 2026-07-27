# Centros de costo: carga manual, desacoplada del sistema

Fecha: 2026-07-27
Rama: `feat/centros-costo-refactor`
Estado: diseño cerrado, implementación no arrancada

## 1. El problema

El centro de costo hoy es un grafo: para saber cuánto vale la hora, el sistema
sale a buscar el sueldo en el legajo del empleado, la amortización en la ficha
de la máquina, la energía en la potencia nominal por el factor de carga por la
tarifa de kWh, y las horas en una fórmula de días por horas menos un porcentaje
no productivo. Seis tablas y cuatro orígenes de dato para producir un número que
el dueño de la imprenta ya tiene en la cabeza.

El costo de eso no es la complejidad en sí, es el acople: el módulo no se puede
tocar sin tocar Legajos y Maquinaria, y el usuario no puede corregir un número
que le parece mal sin entender de dónde salió.

**El objetivo es que el centro de costo vuelva a ser una planilla.** Se carga a
mano, no depende de ningún otro dato del sistema, y el usuario ve exactamente lo
que escribió.

Lo que **no** cambia: qué se hace con el valor hora una vez calculado. El motor
de costeo, el ETA y los reportes siguen leyendo `CentroCostoTarifaPeriodo` igual
que hoy. Cambia quién llena esa tabla, no quién la lee.

## 2. El modelo de referencia (Holdprint)

Se tomó Holdprint como referencia explícita. La aritmética se verificó contra
sus propias capturas y cierra al centavo:

```
Costo propio del centro = Σ gastos generales
                        + Σ (salario × (1 + cargos%))
                        + Σ depreciación mensual

  ejemplo "Acabado y Montaje":  750 + (1.900 × 1,40) + 75 = 3.485,00  ✓

Depreciación mensual    = (valor actual − valor al final de la vida)
                          / vida útil restante en meses

  ejemplo:  (5.000 − 500) / 60 = 75,00  ✓

Absorbido               = costo de los centros no productivos, repartido entre
                          los productivos ∝ al gasto propio de cada uno

  ejemplo:  3.485 / 62.901,25 × 13.900 = 770,12  ✓
  (los 13 absorbidos del listado suman 13.900,00 exacto = el gasto de Administrativo)

Valor de la hora        = (gasto propio + absorbido) / horas productivas

  ejemplo:  4.255,12 / 176 = 24,18  ✓
  (verificado también en Corte Láser, Impresión UV Híbrida y Design y Arte)
```

Lo decisivo del modelo no es la fórmula — es que **no hay una sola clave
foránea**. El empleado es `nombre + ocupación` escritos a mano. El activo fijo
es `nombre + tipo` escritos a mano. Si querés cargar la energía, es una línea de
gasto que dice "Energía Eléctrica" y un importe; nadie calcula kilovatios.

## 3. Decisiones cerradas

| # | Decisión | Resuelto |
|---|---|---|
| 1 | El empleado del centro pasa a **texto libre**. Sin FK a `Empleado`. | Sí |
| 2 | El activo fijo pasa a **4 campos con depreciación lineal**, igual que Holdprint. La ficha de máquina deja de ser fuente de costo. | Sí |
| 3 | Las horas productivas son un **campo manual**. Se retira la fórmula días × horas − % no productivo. | Sí |
| 4 | El prorrateo pasa a ser **∝ gasto propio** (hoy es ∝ capacidad práctica). | Sí |
| 5 | Se mantienen **dos tarifas**: `tarifaManoObra` = Σ gastos de empleados / horas; `tarifaCalculada` = gasto total / horas. La hora hombre se sigue cobrando sólo en setup/cleanup. | Sí |
| 6 | Se **conserva el congelado por período** (BORRADOR / PUBLICADA), aunque la carga sea manual: es lo que impide que una orden vieja cambie de costo. Se esconde de la UI detrás del tab Historial. | Sí |
| 7 | El **reporte de costo laboral se elimina** del sistema. No se reemplaza. | Sí |
| 8 | Las cargas se cargan y se guardan **como porcentaje**, nunca como monto. La UI las muestra con 2 decimales; el campo guarda 6 para que el total no derive. El `importeMensual` se redondea a 2 decimales. | Sí |

Sobre la 5, una precisión que no estaba en la pregunta y hay que fijar: **el
absorbido entra en `tarifaCalculada` pero no en `tarifaManoObra`**. Lo que baja
de Administrativo es estructura, no mano de obra del centro; sumarlo a la tarifa
de MO haría que el setup pague dos veces la administración.

## 4. Modelo de datos objetivo

### 4.1 Lo que se retira

| Tabla / campo | Por qué |
|---|---|
| `CentroCostoRecurso` | Es el que tiene los FK a `Empleado` y `Maquina`. Su contenido pasa a ser líneas de texto. |
| `CentroCostoRecursoMaquinaPeriodo` | Las 15 columnas del costeo de máquina (kW, factor de carga, disponibilidad, eficiencia, seguros…) se reemplazan por 4 campos de depreciación + líneas de gasto. |
| `ComponenteCostoPeriodo.empleadoId` | El vínculo con la persona. |
| `ComponenteCostoPeriodo.origen` | Ya no hay `SUGERIDO`: todo es manual. |
| `CentroCosto.areaCostoId` | Verificado por grep: no lo consume nadie fuera del propio módulo de Costos. |
| `CentroCosto.categoriaGrafica` | Ídem. |
| `CentroCosto.responsableEmpleadoId` | Ídem, y además es otro FK a `Empleado`. |
| `CapacidadPeriodo.{diasPorMes, horasPorDia, porcentajeNoProductivo, capacidadTeorica}` | La fórmula que reemplaza el campo manual. |

Al caer `areaCostoId` hay que verificar si `AreaCosto` queda huérfana. Si lo
queda, se retira en una limpieza aparte, no en esta.

### 4.2 Lo que se queda intacto

- **`CentroCostoTarifaPeriodo`**: sin un solo cambio. Es el contrato con el
  motor, el ETA y los reportes. Incluye `capacidadPractica`, que se conserva con
  ese nombre aunque adentro del módulo pase a llamarse horas productivas —
  renombrarlo obligaría a tocar `motor-universal` sin ganar nada.
- **`CentroCosto.unidadBaseFutura`**: es el equivalente al selector "Hora:
  Hombre / Máquina" de Holdprint, y sí sale del módulo (lo leen el motor y
  productos-servicios para decidir si el paso se cobra por hora máquina, hora
  hombre o m²).
- **`CentroCosto.tipoCentro` e `imputacionPreferida`**: los usa el reparto.
- **`Egreso.centroCostoId`**, `ProductoConfigPaso` y `ProductoPasoExtra`
  apuntando a centros: sin cambios.

### 4.3 La tabla nueva

`CentroCostoLinea` reemplaza a `CentroCostoRecurso`,
`CentroCostoRecursoMaquinaPeriodo` y `CentroCostoComponenteCostoPeriodo`. Una
sola planilla, tres secciones:

```prisma
model CentroCostoLinea {
  id                    String                @id @default(uuid()) @db.Uuid
  tenantId              String                @db.Uuid
  centroCostoId         String                @db.Uuid
  periodo               String
  seccion               SeccionCentroCostoLinea   // GASTO_GENERAL | EMPLEADO | ACTIVO_FIJO
  nombre                String                // texto libre en las tres secciones
  categoria             CategoriaComponenteCostoCentro?  // "Tipo de gasto" / "Tipo de activo fijo"

  // sólo EMPLEADO
  ocupacion             String?
  horasMes              Decimal?              @db.Decimal(10, 2)
  salarioMensual        Decimal?              @db.Decimal(14, 2)
  /// El porcentaje se guarda con 6 decimales aunque la UI muestre 2. Con 2
  /// decimales, cargas de $786,55 sobre un sueldo de $1.900 dan 41,3974% que se
  /// almacenaría como 41,40 y reconstruiría un total de $2.686,60 en vez de
  /// $2.686,55: cinco centavos de deriva por línea, que en la migración se leen
  /// como un centro que cambió de tarifa.
  cargasPct             Decimal?              @db.Decimal(9, 6)

  // sólo ACTIVO_FIJO
  vidaUtilRestanteMeses Int?
  valorActual           Decimal?              @db.Decimal(14, 2)
  valorFinalVida        Decimal?              @db.Decimal(14, 2)

  // las tres
  importeMensual        Decimal               @db.Decimal(14, 2)  // calculado y persistido
  orden                 Int                   @default(0)
  notas                 String?
  ...
  @@index([tenantId, centroCostoId, periodo])
}
```

`importeMensual` se calcula al guardar y se persiste, para que la suma no
dependa de recorrer ramas por sección:

| Sección | `importeMensual` |
|---|---|
| `GASTO_GENERAL` | el valor cargado |
| `EMPLEADO` | `salarioMensual × (1 + cargasPct / 100) × (dedicacionPct / 100)` |
| `ACTIVO_FIJO` | `(valorActual − valorFinalVida) / vidaUtilRestanteMeses` |

**El centro absorbe la parte del costo de la persona que le corresponde, no el
sueldo entero.** Es la única forma de que la suma de los centros dé lo que la
empresa gasta de verdad: con los datos reales, Ivan Sanz está en cuatro centros y
Hector Alence en dos, así que sin repartir la nómina pasaría de $16,5M a más de
$30M y todas las tarifas —y todos los presupuestos— saldrían casi al doble.

`dedicacionPct` ausente significa **100%**, no 0%: una fila a la que todavía no
se le cargó la dedicación cuesta lo que costaba, en vez de desaparecer del costo
del centro sin que nadie lo note.

En las tres, `importeMensual` se redondea a 2 decimales. El porcentaje de cargas
se **carga y se guarda como porcentaje** — nunca como monto — y la UI lo muestra
con 2 decimales; los otros 4 existen sólo para que el total reconstruido no
derive (ver el comentario del modelo).

La dedicación de cada persona se carga como **porcentaje**, no como horas, y la
ficha muestra al lado las horas que salen de aplicarlo a las del centro: pensar
"20% acá, 80% allá" es más natural que calcular 35,2 horas a mano. Se guarda el
porcentaje y no las horas para que sigan solas si el centro cambia su
declaración.

Es **informativo**: no escala el costo de la línea, que vale el sueldo con sus
cargas, y tampoco alimenta las horas productivas del centro, que se cargan
aparte (decisión 3).

### 4.4 Capacidad

`CentroCostoCapacidadPeriodo` se reduce a un campo manual:

```prisma
model CentroCostoCapacidadPeriodo {
  ...
  unidadBase        UnidadBaseCentroCosto
  horasProductivas  Decimal  @db.Decimal(12, 2)   // el "PNH" del listado
  ...
}
```

Sigue siendo por período, porque el mes que la planta trabaja menos la hora sale
más cara y eso hay que poder decirlo.

## 5. Qué pasa con el motor de tarifa

`buildTarifaSnapshot` hoy suma cuatro orígenes distintos
([costos-tarifas.service.ts:191](../apps/api/src/costos/costos-tarifas.service.ts)):
componentes, recursos de maquinaria, recursos de gasto general y recursos de
activo fijo. Después de esto suma **uno**:

```ts
const costoMensualTotal   = Σ lineas.importeMensual
const costoMensualManoObra = Σ lineas.filter(seccion === EMPLEADO).importeMensual
const costoMensualTotalConReparto = costoMensualTotal + absorbido
const tarifaCalculada  = costoMensualTotalConReparto / horasProductivas
const tarifaManoObra   = costoMensualManoObra        / horasProductivas
```

La detección de mano de obra deja de ser `categoria ∈ {SUELDOS, CARGAS}` y pasa
a ser `seccion === EMPLEADO`, que es más honesto: hoy depende de que la nómina
haya etiquetado bien la categoría.

En `costos-reparto.service.ts` cambia una sola cosa: la base del peso pasa de
`capacidadPractica` a `costoMensualDirecto` (decisión 4). El resto del
algoritmo — incluido el ajuste del último target para que la suma cierre exacta —
queda igual.

## 6. UI

Se copia la estructura y la interacción de Holdprint. La piel usa nuestros
tokens: calcar también el gris-Bootstrap dejaría el módulo pareciendo de otro
sistema al lado del resto de la app.

Prefijo de clases: `.ccosto-`, **incluidas las hijas** (`.ccosto-seccion`,
`.ccosto-fila`, `.ccosto-total`), por la regla de `globals.css`.

### 6.1 Listado

Columnas, en este orden: **Nombre · Horas productivas · Gastos · Absorbido ·
Prorrateado · Gasto total · Valor de la hora**. Búsqueda arriba a la izquierda,
"Añadir centro de costo" arriba a la derecha.

Los centros no productivos (Administrativo) muestran guion en horas y en valor
de la hora, y su costo aparece en la columna **Prorrateado**; los productivos
muestran en **Absorbido** lo que reciben. La suma de la columna Absorbido tiene
que dar exactamente la de Prorrateado — es la verificación visual de que el
reparto no perdió plata.

### 6.2 Alta (modal)

Cinco bloques verticales, en este orden:

1. **Introduzca el nombre y el tipo** — nombre, tipo.
2. **Ingrese los gastos mensuales de rutina** — filas `nombre · tipo · valor`.
3. **Añadir empleado** — filas `nombre · ocupación · horas mes · salario+benef · cargos % · costo total` (la última calculada, deshabilitada).
4. **Ingrese los activos fijos** — filas `nombre · tipo · vida útil restante · valor actual · valor al final de la vida · depreciación mensual` (la última calculada, deshabilitada).
5. **Resumen** — empleados, gasto principal.

Cada fila tiene `+` para agregar y `×` para borrar. Cada sección cierra con un
`= $X` vivo al pie. Todo recalcula al tipear, sin guardar.

### 6.3 Ficha (tabs)

- **Datos generales** — nombre, tipo, hora (hombre/máquina) + bloque Resumen con
  los cinco números: empleados, horas productivas, gasto principal, total
  prorrateado, gasto total, valor de la hora.
- **Gastos** — las tres secciones editables de 6.2.
- **Ajustes** — horas productivas del período, imputación y participación en el
  prorrateo.
- **Historial** — las tarifas por período con su estado (decisión 6).

Nada de diálogos nativos: el borrado de filas y el descarte de cambios usan
`ConfirmacionDestructiva` / `ConfirmacionSalida`.

## 7. Consecuencias en otros módulos

| Módulo | Qué le pasa |
|---|---|
| **Maquinaria** | La máquina sigue viva y sigue siendo indispensable: rutea, filtra pasos por estación y alimenta el ETA con velocidades y formatos. Lo que pierde es el **bloque de costos**. Propuesta: sacarlo de la UI y del costeo en esta fase y dejar las columnas en la tabla; retirarlas en una limpieza posterior, cuando esté confirmado que ninguna migración las necesita. |
| **Legajos y nómina** | Deja de escribir en centros: se retiran `NominaCostosService` y `scripts/resincronizar-nomina-centros.ts`. Legajos sigue existiendo para RRHH y para Gastos fijos. **Corrección al diseño original**: se había anotado que `conciliacion-nomina-card.tsx` perdía sentido, y es falso — vive en Gastos fijos y compara Legajos contra gastos declarados, sin tocar centros. Se queda. |
| **Reporte costo laboral** | **Se elimina del sistema** (decisión 7). Se construía enteramente sobre `CentroCostoRecurso.empleadoId`, `ComponenteCostoPeriodo.empleadoId` y `porcentajeAsignacion`; sin esos FK no hay reporte, y no se reemplaza. Se retiran el servicio, el endpoint, la ruta, la tarjeta del panel y el ítem del shell de Reportes. |
| **Gastos fijos de estructura** | Sin cambios: ya estaba desacoplado de centros por diseño. |
| **Egresos** | Sin cambios. La imputación a centro sigue igual y el egreso sigue sin alimentar el costeo. |
| **Motor universal, ETA, productos, reportes de producción** | Sin cambios. Leen tarifas publicadas. |

## 8. Migración de datos

La regla de oro: **ningún centro puede cambiar de tarifa por efecto de la
migración**. Se convierte la carga, no el resultado.

| Origen | Destino |
|---|---|
| `ComponenteCostoPeriodo` categoría SUELDOS/CARGAS | línea `EMPLEADO`, consolidando las dos líneas de la misma persona en una sola con `salarioMensual` = SUELDOS y `cargasPct` = CARGAS / SUELDOS × 100 |
| `ComponenteCostoPeriodo` resto de categorías | línea `GASTO_GENERAL` |
| `CentroCostoRecurso` tipo GASTO_GENERAL | línea `GASTO_GENERAL` |
| `CentroCostoRecurso` tipo ACTIVO_FIJO | línea `ACTIVO_FIJO` |
| `CentroCostoRecurso` tipo MAQUINARIA | línea `ACTIVO_FIJO` (valor compra → valor actual, residual → valor final, vida útil) **más** líneas `GASTO_GENERAL` por energía, mantenimiento, seguros y otros fijos, para no perder el importe |
| `CentroCostoRecurso` tipo EMPLEADO | se descarta: hoy no suma al costo total (verificado en el servicio de tarifas) |
| `CapacidadPeriodo.capacidadPractica` | `horasProductivas` tal cual (incluido el override manual si estaba puesto) |

El nombre de las líneas que venían de un FK se congela como texto: se copia el
nombre del empleado o de la máquina al momento de migrar.

**Test de aceptación de la migración**: para cada centro y período con tarifa
publicada, recalcular con el motor nuevo y comparar contra la tarifa publicada
previa. Salvo por el cambio deliberado de base del prorrateo (decisión 4), tiene
que dar lo mismo. El delta del prorrateo se reporta explícitamente, centro por
centro, para que se vea qué se movió y por qué.

## 9. Plan de implementación

La propiedad que ordena todo el plan: **las tablas viejas siguen vivas hasta que
el motor nuevo esté probado**. Nada se borra antes de F7. Eso permite recalcular
con los dos modelos en paralelo y comparar, en vez de migrar a ciegas.

### F0 — Baseline de verificación ✅

`apps/api/scripts/centros-costo-baseline.js`, con el mismo patrón
`baseline` / `compare` que el golden-master del motor. De sólo lectura.

Es lo primero porque sin esto la migración no es verificable: después del
refactor no hay forma de reconstruir qué decía el sistema antes, ya que las
tablas de origen desaparecen.

Captura, por centro y período: el **contrato** (los cinco números persistidos
que leen el motor y el ETA), el **resumen** con el desglose del reparto, los
**insumos** crudos (componentes por categoría, recursos por tipo, capacidad) y
un bloque **derivado** con lo que sale de esos insumos.

**El gate compara `derivado`, no el snapshot congelado**, y la razón apareció al
capturar: 7 snapshots de 2026-06 ya estaban desactualizados respecto de sus
propios componentes — les cambiaron los sueldos después de publicar y nadie
recalculó (Producción & Taller guardó $7.328.333 cuando sus insumos suman
$7.828.333). Medir contra el snapshot haría fallar a F2 por una deuda anterior
a la migración. Los tres números del gate son `costoMensualSinReparto`,
`costoMensualManoObra` y `horasProductivas`; el absorbido queda afuera y se
informa aparte, porque cambia de base por decisión de diseño.

Estado de la captura: 10 centros, 37 entradas — 27 reales con resumen completo,
2 con resumen parcial de una versión vieja del motor, 8 filas de test que
quedaron en dev y se marcan para que no ensucien el veredicto.

### F1 — Schema y migración de datos ✅

Migración `20260727190000_centros_costo_lineas`, generada con `migrate diff` y
aplicada con `migrate deploy` para no arriesgar el reset que ofrece
`migrate dev`. Puramente aditiva: no se borró ninguna tabla ni columna.

Script: `apps/api/scripts/migrar-centros-costo-lineas.js`, con `--aplicar` e
idempotente (borra las líneas del período que va a rehacer). Los importes se
copian de los valores ya calculados (`amortizacionMensualCalc`,
`depreciacionMensualCalc`) en vez de recalcularse con la fórmula nueva, aunque
en los datos actuales coincidan: lo que se convierte es la forma de cargar el
costo, no el resultado.

Resultado: **71 líneas** — 22 de empleado, 31 de activo fijo, 18 de gasto
general — y 16 capacidades con `horasProductivas`. Los 15 pares centro/período
cierran al centavo contra el `derivado` que había calculado el script de F0, que
es una verificación independiente porque son dos implementaciones distintas.

**Dos hallazgos del camino**, ambos por chequear la reconstrucción línea por
línea y no sólo el total del centro:

1. En 2026-03 los componentes de sueldos no tienen `empleadoId` y se llaman
   distinto que los de cargas ("Sueldos del equipo" contra "Cargas y aportes").
   Aparearlos por nombre partía a la persona en dos líneas rotas —una con sueldo
   y sin cargas, otra con cargas y sueldo cero— y **el total del centro cerraba
   igual**, así que el invariante de suma no lo veía. Los huérfanos de un
   período van ahora a un solo bucket consolidado.
2. Queda un centavo de deriva al reconstruir el total de una persona desde el
   porcentaje de cargas. Es inherente a guardar un porcentaje y es la razón de
   los 6 decimales; la verificación por línea tolera 5 centavos, que alcanza
   para distinguir el redondeo de una línea estructuralmente rota.

### F2 — Motor de tarifa sobre el modelo nuevo ✅

`buildTarifaSnapshot` pasó de sumar cuatro orígenes a sumar uno, y la mano de
obra se detecta por `seccion === EMPLEADO` en vez de por categoría. En
`costos-reparto.service.ts`, `computeCostoMensualDirectoCentro` quedó en cuatro
líneas y la base del peso pasó a ser el gasto propio del destino. Las horas se
leen de `horasProductivas` con fallback a la capacidad vieja mientras convivan
los dos modelos.

**Gate**: el `compare` del script de F0 ahora calcula el modelo nuevo —incluido
el reparto— con una **segunda implementación** de la misma aritmética, y lo
enfrenta al derivado del modelo viejo. Es a propósito que no llame al servicio:
un golden-master que invoca el código que quiere verificar no verifica nada; si
dos implementaciones distintas coinciden, es porque el resultado es correcto y
no porque compartan el error.

Resultado: costo, mano de obra y horas sobreviven en los 27 centros/período
reales. El prorrateo se movió en 21, que es el cambio buscado, y en la dirección
correcta: los centros caros absorben más (Producción & Taller +$294.903, Híbrida
UV +$223.196) y los baratos menos (Grabado/Corte Láser −$108.213).

Se agregó además una **verificación de conservación**: lo que sale de los centros
de estructura tiene que entrar íntegro a los productivos. Cubre $3,79M en 2026-06
y $2,44M en 2026-07. El primer intento la medía sobre las filas de tarifa y daba
un falso positivo, porque la fila PUBLICADA de Administración en 2026-06 es de
test y quedaba fuera del origen mientras sus destinos sí contaban; se mide sobre
el reparto mismo.

Tests: 8 en el módulo (dos nuevos: que la mano de obra sale de las líneas de
empleado y **no** absorbe el reparto, y que el prorrateo es proporcional al
gasto y no a las horas) y 1.184 en toda la API, todos en verde.

**Estado intermedio a tener presente**: el camino de escritura todavía apunta a
las tablas viejas mientras el de cálculo ya lee las líneas, así que editar un
centro desde la UI actual no mueve su tarifa. Lo cierra F3. Lo único que se
cableó por adelantado es `horasProductivas` en los cuatro puntos donde se
persiste la capacidad, porque era una línea y evitaba que un cambio de horas se
perdiera en silencio.

### F3 — API ✅

`PUT centros-costo/:id/lineas?periodo=` reemplaza la planilla entera del
período. Es una sola operación y no un CRUD fila por fila porque eso es lo que
hace el usuario: abre el centro, toca lo que sea de las tres secciones y aprieta
Guardar una vez. El GET de configuración devuelve `lineas`.

**El importe mensual no viaja en el contrato**: lo calcula el servidor en
`computeImporteLinea`. Si el total lo mandara el cliente, la planilla podría
mostrar una cosa y costear otra. El `ValidationPipe` global corre con
`whitelist` y `forbidNonWhitelisted`, así que mandarlo da 400 — verificado
contra la ruta real, no sólo en el DTO.

`ReplaceCentroLineasDto` valida por sección con `ValidateIf`. Lo que el DTO no
puede ver —relaciones entre campos— vive en `validateLineas`: el valor al final
de la vida no puede superar al actual (amortizar hacia arriba abarataría el
centro), y no puede haber dos líneas con el mismo nombre en la misma sección
(casi siempre es un doble click, y duplica el costo en silencio).

De la cabecera, `areaCostoId` y `categoriaGrafica` pasaron a **opcionales** en
vez de desaparecer: las columnas siguen siendo obligatorias en la base hasta F7.
Si no vienen, se resuelve la primera área de la planta o se crea una general, y
en el update ausente significa "no lo toques", no "ponelo en null". Así la ficha
nueva puede dejar de pedirlos sin romper nada.

**Verificación end-to-end contra la API corriendo**: round-trip idempotente de
la planilla de Grabado/Corte Láser (los tres importes vuelven idénticos, o sea
que la aritmética del mapper coincide con lo que dejó la migración) y, sobre
todo, **el hueco que dejó F2 quedó cerrado**: subir $60.000 el mantenimiento
movió el costo del centro de $539.148,03 a $607.181,11, y restaurarlo lo devolvió
exacto. Los $8.033 de diferencia sobre los $60.000 son la porción extra de
estructura que el centro absorbe por gastar más — confirmación de que el
prorrateo nuevo también está vivo.

Tests: 14 en el módulo, 1.190 en la API.

### F4 — UI: listado ✅

Backend primero: el listado viejo derivaba todo del **último snapshot de
tarifa**, que es agnóstico del período y puede haber quedado viejo respecto de
su propia planilla — pasó de hecho con siete centros de 2026-06. Un listado que
muestre eso miente sobre el estado actual, así que se agregó
`GET centros-costo/resumen?periodo=`, que calcula los números vivos: gasto
propio, absorbido, prorrateado, total y valor hora.

Dos detalles se ajustaron mirando el modelo de referencia:

1. **El gasto total no le resta lo prorrateado.** "Prorrateado" es informativo
   —cuánto mandó a los productivos— y el total sigue siendo lo que el centro
   cuesta. En Holdprint, Administrativo muestra 13.900 en las tres columnas.
2. **Un centro que reparte su costo entero no tiene valor hora**: muestra guion,
   como en el modelo. Lo que cuesta ya se cobra dentro de los productivos que lo
   absorbieron, y mostrarle una tarifa invitaría a cobrarlo dos veces.

`computeRepartoPeriodo` ahora devuelve también `distribuidoByCentroId`, que es
la columna Prorrateado, y usa lo efectivamente asignado y no el costo de la
fuente: si algún monto se hubiera recortado a cero, el total del listado seguiría
cuadrando.

En el frontend, la tabla quedó con las columnas de §6.1 más búsqueda y selector
de período. Los totales se recalculan **sobre las filas visibles** y no se toman
del backend: con una búsqueda activa tienen que hablar de lo que se está viendo.
Sin filtro, absorbido y prorrateado dan igual, y una fila al pie lo dice en
palabras — es la verificación a ojo de que el reparto no perdió plata.

Prefijo `.ccosto-` en las seis clases nuevas, hijas incluidas. **Turbopack sirvió
CSS viejo**, tal como estaba anotado: el bundle traía `centros-costo-table-card`
pero cero `ccosto-`. Se resolvió forzando un cambio de contenido y verificando el
bundle servido antes de dar la fase por buena.

**Verificado en el navegador**, contra la sesión real: la tabla renderiza las
siete columnas, Administración muestra guion en horas y valor hora, el pie da
$23.677.222 + $2.437.500 = $26.114.722 y la fila de cuadre confirma el reparto.
La búsqueda filtra y recalcula los totales sobre lo visible; con el filtro puesto
la fila de cuadre desaparece, porque excluido el centro de estructura afirmar que
cuadra sería falso. Sin errores de consola, tampoco tras recargar — que es donde
saltaría una hidratación rota por el período en el `useState`.

Cambiar el período a junio deja a la vista para qué sirve el endpoint nuevo:
Administración aparece con **$3.791.667**, la suma viva de su planilla, mientras
el snapshot congelado de ese mes dice $3.500.000.

### F5 — UI: alta y ficha ✅

`centro-costo-ficha.tsx` (≈900 líneas) reemplaza a
`centro-costo-configurator.tsx` (3.359). Un solo componente sirve para el alta
—los cinco bloques en una vista— y para la edición —cuatro solapas—, porque las
tres secciones son las mismas en los dos casos.

El formulario de alta del panel, con planta, área, categoría gráfica y
responsable, se retiró entero: ahora hay un botón "Añadir centro de costo". Al
sacarlo quedó código muerto que el lint destapó, incluido un detalle que
importaba: **el botón "Editar" de la tabla llenaba un formulario que ya no
existía**. Se unificó con "Configurar", que abre la ficha.

También se agregó `horasProductivas` al DTO de capacidad: la decisión 3 dice que
las horas se cargan a mano, pero el endpoint todavía exigía días y horas por día.
Cuando viene, manda sobre la fórmula.

Tres cosas se corrigieron mirando la pantalla, no el código:

1. El Sheet trae `sm:max-w-sm` en su propia clase y le ganaba a la hoja global;
   el ancho se fuerza desde el componente, donde compite en el mismo terreno.
2. Base UI renderiza el valor crudo del `Select` salvo que se le pase una
   función: el trigger decía "hora_maquina" en vez de "Hora máquina".
3. En este scope `--accent` es un gris casi blanco (`#f1efeb`), así que el valor
   de la hora salía ilegible. Se usa el naranja de marca explícito.

Y un bug de layout real: el cuerpo es un flex column y las secciones se
encogían; como tienen `overflow: hidden`, **el pie con "Agregar" y el subtotal se
cortaba** en ventanas bajas, y el bloque parecía incompleto. Se resolvió con
`flex: 0 0 auto`.

**Verificado en el navegador**: la ficha de Grabado/Corte Láser abre con las tres
secciones pobladas por la migración (Hector Alence 162.500 + 50% → $243.750;
Cortadora 60 meses, 15M − 3M → $200.000), los subtotales viven al pie, cambiar
las cargas a 60% recalcula el costo total a $260.000 mientras se tipea, y salir
con cambios sin guardar dispara `ConfirmacionSalida`. El alta muestra los cinco
bloques vacíos. Sin errores de consola.

Turbopack volvió a servir CSS viejo dos veces más; misma receta.

### F6 — Desacople de los módulos vecinos ✅

**Nómina.** `NominaCostosService` desaparece entero: sus dos métodos estaban
construidos sobre `CentroCostoRecurso`, la tabla que se retira. Con él se van sus
dos llamadas desde Costos, las tres desde `remuneraciones.service.ts`, el
`forwardRef` que existía sólo para cortar el ciclo entre ambos, su spec y
`scripts/resincronizar-nomina-centros.ts`.

El test que verificaba "cargar un sueldo recalcula los centros donde la persona
trabaja" se reemplazó por su inverso: **cargar un sueldo no toca ninguna tabla de
Costos**. Es el contrato nuevo, y conviene que esté afirmado y no sólo ausente.

**Maquinaria.** No hubo nada que sacar: la `Maquina` no tiene un solo campo de
costo — todos vivían en `CentroCostoRecursoMaquinaPeriodo`, que es tabla de
centros. El editor de costos de máquina estaba dentro del configurador que se
retiró en F5.

**Configurador huérfano.** `centro-costo-configurator.tsx` (3.359 líneas) había
quedado sin importadores desde F5. Se borra, y con él quedan muertas cinco
funciones del cliente (`replaceCentroCostoRecursos`,
`replaceCentroCostoComponentes`, las dos de recursos-maquinaria y
`upsertCentroCostoConfiguracionPeriodo`) y sus tipos.

**Costo laboral**, eliminado en sus siete puntos como estaba previsto. El corte
en `lib/panel-api.ts` se hizo mal la primera vez —se llevó 125 líneas en vez de
48, incluidos los clientes de resumen, alertas y finanzas— y se rehízo por
límites de línea exactos después de restaurar el archivo.

**Corrección al diseño**: se había anotado que `conciliacion-nomina-card.tsx`
perdía sentido. Es falso: vive en Gastos fijos y compara Legajos contra gastos
declarados, sin tocar centros. Se queda.

Balance: **1.470 líneas agregadas, 5.288 borradas**. Suite completa en verde
(1.184 tests), gate en verde, y Reportes verificado en el navegador sin el tab de
costo laboral y sin errores de consola.

### F7 — Limpieza del schema ✅

Antes de tocar nada, `pg_dump` de las seis tablas afectadas —154 filas— en
`scripts/backup-pre-f7-centros.sql`. Es lo único que preserva lo que decían.

Dos migraciones, separadas a propósito:

- `20260727200000_centros_costo_retiro_modelo_derivado`: caen las tres tablas
  (`CentroCostoRecurso`, `CentroCostoRecursoMaquinaPeriodo`,
  `CentroCostoComponenteCostoPeriodo`), los cuatro enums que sólo servían al
  modelo derivado, los tres campos de cabecera y los cinco de la fórmula de
  capacidad. `horasProductivas` pasa a NOT NULL (verificado: cero filas en null).
- `20260727210000_retiro_area_costo`: `AreaCosto`, que quedó huérfana. Se retiró
  entera con su CRUD y su pestaña en el panel: mantener el ABM de una entidad que
  ya nadie referencia es justamente el peso muerto que este refactor saca.

El módulo pasó de **siete tablas a cuatro**: `CentroCosto`, `CentroCostoLinea`,
`CentroCostoCapacidadPeriodo` y `CentroCostoTarifaPeriodo`.

**Dos consumidores fuera de Costos había que resolver, no borrar:**

1. `gastos-fijos.service.importarDesdeTarifas` leía los componentes del centro.
   Se reescribió sobre `CentroCostoLinea`, que es la misma información sin la
   capa intermedia. De paso se retiró el bloque que sumaba maquinaria y activos
   desde el `resumenJson`: ahora esas líneas ya vienen en la planilla y sumarlas
   otra vez habría duplicado el importe.
2. `reportes/produccion.service` calculaba la capacidad diaria como
   `Σ capacidadPractica / diasPorMes`. Ese campo era parte de la fórmula
   retirada. **Cambio de comportamiento a tener presente**: ahora reparte las
   horas del mes sobre una constante de 22 días hábiles, lo que se nota en meses
   cortos o con feriados. El dato fino vive en el calendario del módulo de
   Capacidad de estaciones; conectarlo queda como mejora aparte.

`migrar-centros-costo-lineas.js` se conserva aunque en dev ya no pueda correr:
cualquier otro entorno que siga en el modelo viejo lo necesita para migrar. Queda
anotado en su encabezado.

**Balance del refactor completo: 1.399 líneas agregadas, 7.953 borradas**, 11
archivos eliminados. Suite en verde (1.181 tests), gate en verde, y el listado
verificado en el navegador con los mismos números que antes del drop.

## 10. Puntos abiertos

1. **`AreaCosto`** — verificado: queda huérfana. Sus únicas referencias en el
   schema son los contenedores (`Tenant.areasCosto`, `Planta.areasCosto`) y el
   `areaCostoId` que estamos sacando. Se puede retirar, pero conviene hacerlo en
   una migración aparte de esta.
2. **Columnas de costo en `Maquina`** — cuándo se retiran del schema.
