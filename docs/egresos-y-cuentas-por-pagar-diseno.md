# Egresos y Cuentas por pagar — diseño

Estado: **F1 y F2 implementadas** (falta la orden de pago imprimible y los adjuntos).
Diseñado 2026-07-26.

Módulo para registrar **todo lo que sale de la caja**: pago de servicios, alquiler,
sueldos, proveedores, combustible, multas, adelantos. Y como consecuencia —no como
módulo aparte— las **cuentas por pagar**: lo que se debe y cuándo vence.

---

## 1. Estado actual (verificado en el código, no supuesto)

**No existe ningún documento de compra.** Grep vacío para factura/orden de compra.
`Comprobante` es exclusivamente de venta (nuestro CAE, nuestro punto de venta).

**El maestro de proveedores está vacío para esto.** `Proveedor` tiene nombre, razón
social, email, teléfono, país, contactos y direcciones. **Cero campos fiscales o de
pago**: sin CUIT, sin condición de IVA, sin plazo, sin CBU. `Cliente` sí tiene `cuit`
y `limiteCredito`. Esa asimetría retrata que las compras nunca se modelaron.

**Pero hay más infraestructura anticipada de lo esperable:**

| Ya existe | Estado |
|---|---|
| `MovimientoFondos.origenTipo` contempla `'pago'` | el único que escribe `'salida'` es la transferencia entre cuentas |
| `Valor` con `origen: 'propio'` y `proveedorId` (cheque emitido), estados `cartera → debitado` | modelado, no lo emite nadie |
| `RetencionPercepcion.direccion` contempla `'practicada'` ("retenemos al pagar") | marcado F2, sin implementar |
| `ArchivoScope.PROVEEDOR` | existe |

**Tres poblaciones de deuda con naturalezas distintas:**

1. **Tercerizado por trabajo.** `OrdenTrabajoItemPaso` sabe proveedor, plazo y
   `estadoCompra`. **No tiene campo de importe**: el costo que se usa es el *cotizado*.
2. **Materiales.** El ingreso de stock existe con `origen: COMPRA` y `costoUnitario`,
   y calcula costo promedio móvil. Pero **nadie escribe `COMPRA`** (mismo agujero que
   `CONSUMO_PRODUCCION`) y el movimiento no tiene proveedor ni documento.
3. **Estructura.** `GastoFijoEstructura` (alquiler, servicios, amortización…) es
   recurrente con vigencia, pero es **insumo de costeo, no obligación**: no genera
   vencimientos ni pagos. Igual `EmpleadoRemuneracion`.

**No hay contabilidad.** Sin plan de cuentas ni asientos. Esto es CxP **de gestión**.

---

## 2. Las dos preguntas que ordenan el diseño

### 2.1 ¿Por qué no puede ser "una tabla de gastos con un flag pagado"?

Tres casos lo rompen, y ninguno es raro:

1. **Un pago que cubre varias facturas.** "Le transferí $500.000 a Papelera por tres
   facturas." Con un flag no se representa.
2. **Pago parcial.**
3. **Retenciones.** Se practican **al pagar**, no cuando nace el gasto: son atributo
   del pago, no del gasto.

Por eso hay **dos entidades** — `Egreso` (la obligación) y `Pago` (el acto) — con
imputación N:M entre ellas. Pero la UI las **colapsa en un solo gesto** cuando
coinciden, que es el 80% de los casos.

> Holdprint resuelve esto exigiendo `Fecha de vencimiento` siempre y sin checkbox de
> "ya pagado": todo nace como cuenta por pagar y pagar es un segundo acto
> (`Asentarse`). Es correcto pero pesa para la nafta. Nosotros mantenemos los dos
> registros y unificamos el gesto.

### 2.2 ¿La simetría con Cuentas por cobrar es real?

**No.** Nuestras CxC nacen de la **OT finalizada** porque nosotros ponemos el precio.
En CxP **el importe lo declara el proveedor**: generar la obligación desde nuestro
costo cotizado sería inventar un pasivo con un número que no es el real.

---

## 3. Framework: cuatro ejes ortogonales

Un egreso se describe por cuatro atributos independientes. Confundirlos es el origen
de todos los errores de diseño en este módulo.

| Eje | Valores | Qué decide |
|---|---|---|
| **Momento** | contado / diferido | si entra en Cuentas por pagar |
| **Naturaleza** | costo de producción / gasto de estructura / inversión / retiro de socios / no incide en resultado | dónde suma en los reportes |
| **Imputación** | a un centro de costo · a un gasto fijo · a un empleado · a nada | qué análisis habilita |
| **Origen** | manual / recurrente | quién lo creó |

La lista original del usuario se acomoda entera:

| Ejemplo | Momento | Naturaleza | Imputación |
|---|---|---|---|
| Pago de alquiler | diferido o contado | estructura | gasto fijo |
| Pago de servicios / internet | diferido | estructura | gasto fijo |
| Servicio de limpieza | contado | estructura | — |
| Pago de sueldos | contado | estructura (personal) | — |
| **Adelanto de sueldo** | contado | **no incide en resultado** | empleado |
| Pago de proveedores (material) | diferido | costo de producción | — |
| Pago a tercerizador | diferido | costo de producción | — |
| Combustible | contado | estructura (vehículo) | — |
| **Multas** | contado | estructura, **nunca costo** | — |
| Compra de una máquina | diferido | **inversión** | — |

---

## 4. Modelo de datos

### 4.1 `CategoriaEgreso` — el árbol curado y editable

```
CategoriaEgreso
  id, tenantId
  codigo            slug estable ('alquiler', 'combustible')
  nombre            editable por el tenant
  naturaleza        enum NaturalezaEgreso
  padreId?          dos niveles y no más
  esSistema         true = vino del seed; se puede renombrar y desactivar, no borrar
  activo, orden
  @@unique([tenantId, codigo])
```

```prisma
enum NaturalezaEgreso {
  COSTO_PRODUCCION   // material, tercerizado, consumibles, repuestos de máquina
  GASTO_ESTRUCTURA   // no varía con el trabajo: alquiler, sueldos, servicios
  INVERSION          // capex: una máquina, una obra. No es gasto del período
  RETIRO_SOCIOS      // distribución de utilidades, no es gasto
  NO_RESULTADO       // adelantos, préstamos, ajustes: mueve caja, no resultado
}
```

**Curado y editable** significa: se siembra al crear el tenant, se puede renombrar,
reordenar, desactivar y agregar categorías propias. Las de sistema **no se borran**
—hay historia colgada— y borrar cualquiera con egresos se rechaza.

Dos niveles a propósito. El plan de cuentas de Holdprint tiene tres y 80+ hojas
(`2.01.0012 Mantenimiento de Equipos Administrativos`); nadie mantiene eso, y encima
el suyo es brasileño (INSS, FGTS, IPTU, IPVA, IOF, Simples Nacional, Pro-Labore).

### 4.2 El árbol semilla (Argentina)

```
COSTO_PRODUCCION
  Materiales e insumos productivos
  Tercerización / trabajos a terceros
  Consumibles de máquina (tintas, tóner, planchas)
  Repuestos y mantenimiento de máquinas
  Fletes de compra y de entrega

GASTO_ESTRUCTURA
  Alquiler
  Servicios (luz, gas, agua, internet, telefonía)
  Limpieza y mantenimiento del local
  Insumos de oficina
  Honorarios profesionales (contable, legal)
  Software y licencias
  Seguros
  Publicidad y marketing
  Gastos bancarios y financieros
  Impuestos y tasas
  Multas y recargos
  Vehículo (combustible, patente, seguro, mantenimiento)
  Sueldos y jornales
  Cargas sociales y ART
  Aguinaldo (SAC)
  Vacaciones
  Indemnizaciones
  Ropa de trabajo y seguridad
  Capacitación
  Otros gastos

INVERSION
  Maquinaria y equipos
  Instalaciones y obra
  Rodados
  Software y activos intangibles

RETIRO_SOCIOS
  Retiro de socios
  Distribución de utilidades

NO_RESULTADO
  Adelantos de sueldo
  Préstamos otorgados
  Devoluciones a proveedores
  Ajustes de caja
```

**Lo que NO va en el árbol: amortización.** `CategoriaGastoFijo` la tiene
(`AMORTIZACION`) porque ahí sirve para costear. Pero la amortización **no es un
egreso**: no sale plata. Si aparece acá, la caja miente. Se queda sólo en
`GastoFijoEstructura`.

### 4.3 `Egreso` — la obligación

```
Egreso
  id, tenantId
  numero              EGR-AAAA-NNNN
  descripcion
  categoriaEgresoId
  proveedorId?        null = egreso sin proveedor (multa, adelanto, flete sin factura)
  beneficiarioNombre  snapshot congelado; texto libre si no hay proveedor

  -- las tres fechas --
  fechaCompetencia    a qué mes PERTENECE el gasto (devengado)
  fechaVencimiento?   null = contado; con valor entra en Cuentas por pagar
  -- la fecha de pago la ponen los Pago

  -- importes --
  moneda              default la del tenant
  neto, iva, otrosImpuestos, total
  pagadoTotal         denormalizado (patrón facturadoTotal/cobradoTotal de OrdenTrabajo)

  -- documento del proveedor --
  tipoComprobante?    'FA'|'FB'|'FC'|'ND'|'NC'|'TICKET'|'RECIBO'|'SIN_DOCUMENTO'
  puntoVenta?, numeroComprobante?

  estado              'pendiente' | 'parcial' | 'pagado' | 'anulado'
  origen              'manual' | 'recurrente'

  -- imputación (opcionales e independientes) --
  centroCostoId?            para el análisis por centro
  gastoFijoEstructuraId?    habilita "presupuestado vs real" (F3)
  gastoRecurrenteId?        quién lo generó (F3)
  empleadoId?               adelantos de sueldo

  anuladoEl?, motivoAnulacion?
  registradoPorNombre       congelado
  notas
  @@unique([tenantId, numero])
  @@unique([tenantId, proveedorId, tipoComprobante, puntoVenta, numeroComprobante])
```

Ese último único es **el antiduplicado**: la misma factura del mismo proveedor no se
carga dos veces. Es el error más común de carga manual y el más caro. Funciona porque
en Postgres los NULL no colisionan: los gastos sin documento no se estorban entre sí.

`neto` / `iva` separados desde el día uno: es lo que habilita el **Libro IVA Compras**
más adelante sin migrar nada, y el crédito fiscal es plata real.

**No hay `ordenId` ni `ordenItemPasoId`.** Ver §11: la vinculación con la orden queda
fuera de alcance por decisión explícita.

### 4.4 `Pago` — el acto, espejo de `Cobro`

```
Pago
  id, tenantId
  numero              OP-AAAA-NNNN (orden de pago)
  fecha
  metodoPagoId, cuentaOrigenId
  montoBruto          lo que se imputa a los egresos
  retencionesTotal    practicadas (F2)
  montoNeto           lo que efectivamente sale de la cuenta
  moneda, tipoCambio? mismo patrón que la transferencia entre monedas
  proveedorId?
  referencia          nro de transferencia / cupón
  valorId?            cheque propio emitido (F2)
  anuladoEl?, motivoAnulacion?, registradoPorNombre
```

```
PagoImputacion       espejo exacto de CobroImputacion
  pagoId, egresoId, monto
  @@unique([pagoId, egresoId])
```

Un pago imputado a N egresos resuelve el "le pagué todo junto". `montoBruto − Σ
retenciones = montoNeto` sale de la cuenta y genera **un** `MovimientoFondos` de
salida con `origenTipo: 'pago'` — el campo ya existe.

### 4.5 `GastoRecurrente` — la plantilla que emite egresos (F3)

```
GastoRecurrente
  id, tenantId, descripcion
  categoriaEgresoId, proveedorId?
  monto, moneda, metodoPagoId?
  frecuencia          'mensual'|'bimestral'|'trimestral'|'semestral'|'anual'
  diaVencimiento      1-31, con clamp a fin de mes corto
  vigenteDesde, vigenteHasta?
  gastoFijoEstructuraId?   ← el puente con el costeo
  activo
  ultimoPeriodoGenerado    'YYYY-MM', idempotencia
```

Un cron diario genera los egresos del período, reusando `CronLock`. La idempotencia va
doble: `ultimoPeriodoGenerado` y un único `(gastoRecurrenteId, periodoCompetencia)`.

**El importe es una sugerencia, no una verdad.** La luz no viene igual todos los
meses: el egreso se genera con el monto de la plantilla y en estado pendiente, y quien
lo paga lo corrige. Sin esto la herramienta miente con precisión.

### 4.6 Cambios en modelos existentes

- **`Proveedor`**: `cuit`, `condicionIva`, `condicionPagoDias`, `cbuAlias`.
- **`ArchivoScope`**: agregar `EGRESO`.
- **`MovimientoFondos`**: agregar `pagoId?` (hoy tiene `cobroId`).
- **`RetencionPercepcion`**: agregar `pagoId?` (F2).

---

## 5. La relación con el costeo: la trampa del doble conteo

Es el riesgo más grande del módulo y merece una regla explícita:

> **El egreso NO alimenta el costeo.** El motor sigue costeando por consumo y tarifas.
> El egreso es un libro de obligaciones y de caja.

| Categoría del egreso | El costeo ya lo tiene vía | Si además sumáramos el egreso |
|---|---|---|
| Materiales | consumo por trabajo (snapshot del motor) | el material se contaría dos veces |
| Sueldos y cargas | tarifa de MO del centro de costo | la mano de obra, dos veces |
| Alquiler, servicios | `GastoFijoEstructura` → punto de equilibrio | la estructura, dos veces |
| Comisiones | ya están en la cascada del precio | la comisión, dos veces |
| Multas, intereses | **nada** — y está bien | entrarían a la tarifa cosas que no son costo |
| Amortización | `GastoFijoEstructura` | **no es egreso**: no sale plata |

**No hay excepciones en este alcance.** El costo real del tercerizado *sería* la
excepción legítima, pero queda fuera (§11).

**El subproducto valioso (F3):** `GastoFijoEstructura` es el **presupuestado**
($800.000/mes de estructura); el egreso es el **real** ($870.000 pagados). Es el mismo
patrón "cotizado vs. real" que ya construimos para las órdenes, aplicado a la
estructura. El puente es `Egreso.gastoFijoEstructuraId`.

---

## 6. Journeys

Tres personas: **Silvina** (administrativa), **Martín** (taller), **Lucas** (dueño).

### 6.1 Arranque

**A1 · El primer día.** Silvina entra a Egresos por primera vez. Está vacío, pero el
árbol de categorías ya está cargado. Carga su primer gasto en treinta segundos.
→ *el árbol viene sembrado, no vacío.*

**A2 · Adaptar el árbol.** Renombra "Publicidad y marketing" a "Marketing", agrega
"Guardería de vehículos", intenta borrar "Seguros": no la deja borrarla pero sí
desactivarla, y deja de aparecer en el selector.
→ *las de sistema se desactivan, no se borran.*

**A3 · Un proveedor nuevo.** Va a cargar una factura y el proveedor no tiene CUIT ni
condición de pago. Los completa sin salir del formulario. La próxima factura de ese
proveedor ya propone el vencimiento sola.

### 6.2 Registrar lo que sale

**B1 · La nafta (el caso más común).** Martín vuelve con el ticket. "Nafta camioneta",
$45.000, *Vehículo*. El switch **"Ya está pagado"** viene encendido, así que sólo pide
la cuenta: *Efectivo caja*. Foto del ticket, guardar. En Tesorería el saldo bajó. En
Cuentas por pagar no aparece nada, porque nunca hubo nada que deber.

**B2 · La factura a 30 días.** A-0001-00012345 de Papelera, $320.000 + IVA. Silvina
**apaga** el switch: el formulario pide vencimiento, ya propuesto a 30 días por la
condición del proveedor. Neto e IVA por separado, adjunta el PDF. Aparece en Cuentas
por pagar.

**B3 · Un gasto sin factura ni proveedor.** $8.000 a un flete que no dio comprobante.
Beneficiario escrito a mano, sin proveedor, tipo *Sin documento*.
→ *el proveedor es opcional, o la caja chica queda afuera del sistema.*

**B4 · La multa.** $60.000, categoría *Multas y recargos*. Silvina no piensa en nada
más, pero el sistema sabe que esa categoría es estructura y nunca costo, así que no le
ensucia la tarifa de ninguna máquina.
→ *la naturaleza trabaja sola, sin que el usuario la entienda.*

**B5 · El alquiler todos los meses (F3).** Gasto recurrente: $900.000, mensual, vence
el 10. Aparece solo cada mes. En noviembre sube: edita el egreso del mes y la
plantilla.

**B6 · La luz, que nunca es igual (F3).** Mismo mecanismo, pero el monto de la
plantilla es casi siempre incorrecto: es una referencia que se corrige al pagar.

**B7 · Los sueldos del mes.** **Un** egreso: "Sueldos julio", $4.200.000, competencia
julio, pagado por transferencia. No catorce.

**B8 · El adelanto de sueldo.** Martín pide $100.000 a cuenta. Categoría *Adelantos de
sueldo*. La plata sale y se ve en Tesorería, pero cuando Lucas mira en qué se le va la
plata **el adelanto no aparece como gasto** — porque no lo es. Si apareciera, el costo
laboral del mes se contaría dos veces.
→ *el journey que justifica la naturaleza `NO_RESULTADO`.*

**B9 · La guillotina nueva.** $3.500.000, *Maquinaria y equipos*, **inversión**. Sale
de la caja pero no es gasto del mes: si lo fuera, julio parecería catastrófico.

**B10 · Lucas se lleva plata.** Retiro de socios, $500.000. Sale de la caja, no es
gasto, no es costo.
→ *B9 y B10 muestran que "salió plata" y "fue un gasto" son cosas distintas.*

**B11 · Compró en tres cuotas.** Se cargan **tres egresos hermanados**, cada uno con su
vencimiento (ver §12.3).

**B12 · Le paga al tercerizador.** Matricería López factura $96.000 por un troquelado.
Se carga como cualquier otra factura de proveedor, categoría *Tercerización*. Lo que
**no** pasa —por decisión— es que ese costo real vuelva al margen de la orden.

### 6.3 Pagar

**C1 · Una factura sola.** Vence mañana, *Registrar pago*, transferencia, número de
operación. Pagada.

**C2 · Todo junto a un proveedor.** Papelera tiene tres facturas vencidas. Silvina
**tilda las tres**, el sistema propone $780.000. Una transferencia, tres facturas
cerradas, y una **orden de pago OP-2026-0043** para mandarle al proveedor.
→ *el journey que hace imposible el modelo de "una tabla con un flag".*

**C3 · Pago parcial.** $500.000 de $780.000. La factura queda **parcial** y sigue en
Cuentas por pagar por el saldo.

**C4 · Pago con retención (F2).** Pago de $320.000 con retención de Ganancias de
$9.600: de la cuenta salen **$310.400**, la factura queda saldada por $320.000, y la
retención queda para el contador.
→ *la retención pertenece al pago, no al gasto: la razón de que sean dos entidades.*

**C5 · Cheque propio (F2).** Diferido a 60 días. La factura queda pagada pero la plata
todavía no salió: el cheque está en cartera hasta que se debita.

**C6 · Mitad efectivo, mitad transferencia.** Dos pagos contra la misma factura, cada
uno de su cuenta.

**C7 · Pagar en dólares.** Desde la cuenta en dólares es directo. Desde la cuenta en
pesos, el sistema pide declarar cuánto salió y guarda el tipo de cambio.

### 6.4 Cuando algo sale mal

**D1 · Cargó la factura dos veces.** El sistema la rechaza y le muestra la que ya
existe.
→ *restricción de base, no validación de UI.*

**D2 · Se equivocó en el importe.** Si no está pagada, la edita. Si ya está pagada,
primero anula el pago.

**D3 · Se rechazó la transferencia.** Anula el pago con motivo: la factura vuelve a
pendiente y en Tesorería aparece un **contramovimiento**. El pago queda en el
historial: se intentó y falló.

**D4 · Le rebotó el cheque propio (F2).** Se marca rechazado, la factura vuelve a deber.

**D5 · Nota de crédito del proveedor.** Se carga como egreso de tipo *NC* con importe
negativo (ver §12.1).

**D6 · Categoría equivocada.** Reclasifica y los reportes se corrigen solos.

### 6.5 Mirar y decidir

**E1 · ¿Qué tengo que pagar esta semana?** ← *el journey principal.* Lunes a la mañana,
Cuentas por pagar muestra sin filtrar nada **lo que vence en siete días**, ordenado por
fecha, lo vencido arriba y en rojo. Total $1.240.000; el saldo de las cuentas,
$890.000. Ésa es la pantalla que justifica el módulo entero.

**E2 · ¿Cuánto le debo a Papelera?** Saldo del proveedor, facturas abiertas y
antigüedad. Espejo de la cuenta corriente del cliente.

**E3 · ¿En qué se me va la plata?** El mes por categoría, y el corte por naturaleza. La
guillotina de B9, el retiro de B10 y el adelanto de B8 **no están** en el gasto del mes.

**E4 · Presupuestado vs. real de la estructura (F3).** $800.000 presupuestados contra
$870.000 pagados.

**E5 · El contador pide los gastos de julio.** Se exporta por **competencia**, no por
fecha de pago: la luz de julio pagada en agosto va en julio.

**E6 · ¿Cuánto IVA tengo a favor? (F4).** Libro IVA Compras. Sale casi gratis porque
cada factura guarda neto e IVA separados desde el día uno.

---

## 7. Reglas duras

1. **Un egreso anulado no se borra.** `anuladoEl` + motivo, patrón `Cobro`/
   `Comprobante`. Si tiene pagos, primero se anulan los pagos.
2. **Anular un pago revierte el movimiento de fondos**, nunca lo borra: contramovimiento.
3. **`Σ PagoImputacion.monto ≤ Egreso.total`.** Validado en transacción, con
   `pagadoTotal` denormalizado en la misma transacción (patrón `cobradoTotal`).
4. **Contado ⇒ pagado.** Un egreso sin `fechaVencimiento` nace con su pago o no nace.
5. **Cuentas por pagar es un filtro**, no una tabla: egresos con `fechaVencimiento`
   no nula y `estado ∈ {pendiente, parcial}`.
6. **El aging usa `fechaVencimiento`.** (Nota: el aging de CxC usa `fechaFinalizada`
   porque no hay plazos de pago del lado de ventas, y ahí el tramo "a vencer" está
   siempre vacío. En CxP no: con vencimiento real, "a vencer" es la columna más útil.)
7. **`NO_RESULTADO` no entra en ningún reporte de resultado**, sólo en caja.
8. **Multi-moneda**: si la cuenta de pago tiene otra moneda que el egreso, hay que
   declarar cuánto salió y se guarda el `tipoCambio` — patrón de la transferencia.

---

## 8. Permisos — no hace falta ninguno nuevo

| Acción | Permiso |
|---|---|
| Ver egresos y cuentas por pagar | `administracion.ver` |
| Registrar egresos y pagar | `administracion.gestionar` |
| Anular egresos y pagos | `administracion.anular` |
| Editar el árbol de categorías | `administracion.configurar` |

El **Vendedor** queda afuera: tiene `administracion.cobrar` pero **no**
`administracion.ver`, así que no ve lo que le pagamos a los proveedores. Correcto — es
información de compra, y `precioCompra`/`costoProveedor` ya están en `CAMPOS_DE_PLATA`.

---

## 9. Navegación

Bajo **Administración**, un solo ítem: **Egresos**. Con filtros: *pendientes /
pagados*, por categoría, por proveedor, por período.

**"Cuentas por pagar" no es una pantalla aparte**: es el filtro de pendientes con
vencimiento, ordenado por fecha, con el aging. Igual que Cuentas por cobrar es una
lente sobre órdenes terminadas.

---

## 10. Fases

**F1 — El registro (en implementación).** `CategoriaEgreso` + seed, `Egreso`, `Pago`,
`PagoImputacion`, contadores, los campos nuevos de `Proveedor`, el movimiento de
fondos. Vista de Egresos con el gesto único para contado, pago simple y anulación.
**Con esto ya sirve.**

**F1.1 — Los huecos que molestaban ya (hecho).** Datos de pago del proveedor
(CUIT, condición IVA, plazo, CBU) escribibles desde su ficha, con la precarga del
vencimiento funcionando de verdad; reclasificar un egreso pagado (el pago bloquea
los importes, no la categoría); y el tab **Análisis**: "¿en qué se me va la plata?"
por categoría y naturaleza, agrupado por competencia, separando el gasto del
período de lo que sólo movió caja.

**F2 — Cuentas por pagar completo (hecho, salvo la orden de pago imprimible).**
Retenciones practicadas (reducen lo que SALE sin reducir lo que se salda), cheque
propio (la factura se salda y la plata no sale hasta que el banco lo debite), cuotas
como N egresos hermanados, y el **saldo por proveedor con aging** — donde, a
diferencia de CxC, el tramo "a vencer" sí se llena, porque del lado de compras hay
vencimientos reales.

Queda para F2.1: la **orden de pago imprimible** (PDF con jsPDF, como los otros tres
documentos) y los **adjuntos** del egreso — el scope `ArchivoScope.EGRESO` y el FK ya
están en la base, falta la UI.

**F3 — Recurrentes.** `GastoRecurrente` + cron de generación + el puente con
`GastoFijoEstructura` y el reporte presupuestado vs. real.

**F4 — Fiscal.** Libro IVA Compras por período.

---

## 11. Fuera de alcance (decidido)

- **Vinculación del egreso con la orden de trabajo.** Decisión explícita del usuario
  2026-07-26: *"lo que no haría de todo esto es la vinculación de la factura de
  tercerizados con la orden y demás, eso quiero pensarlo bien más adelante"*. Por eso
  `Egreso` **no** tiene `ordenId` ni `ordenItemPasoId`, y la Fase 3 de
  `costos-consolidados-ot-diseno.md` **sigue abierta**: el costo del tercerizado en el
  tab Costos sigue siendo el cotizado. Cuando se retome, es agregar el FK y que el
  cruce lea el egreso.
- **Orden de compra formal y conciliación a tres vías.** Es el corazón del control en
  una fábrica de 200 personas; en una imprenta donde el que compra es el dueño, es
  burocracia.
- **Circuito de aprobación por monto.**
- **Asientos contables y plan de cuentas contable.** No hay contabilidad; el árbol de
  categorías es de gestión, no un plan de cuentas.
- **Compra de material con recepción a stock.** Arrastra el circuito de inventario
  completo (`origen: COMPRA` que nadie escribe, promedio móvil, y el
  `CONSUMO_PRODUCCION` que tampoco). El egreso puede imputarse a *Materiales* sin mover
  stock.
- **Constatación de comprobantes contra ARCA.**

---

## 12. Decisiones tomadas sobre las dudas del journey

**12.1 Notas de crédito de proveedor (D5).** Dos caminos posibles: un egreso en
negativo, o un "crédito a favor" que se aplica al próximo pago. El segundo es más
correcto, el primero es mucho más simple. **Decisión: egreso en negativo**, y se
revisa si molesta en el uso real.

**12.2 Sueldos: ¿uno o catorce? (B7).** Por liquidación es mucho menos trabajo; por
empleado habilita el costo real por persona pero es carga manual pesada todos los
meses. **Decisión: por liquidación**, con `empleadoId` opcional para quien quiera
detalle.

**12.3 Cuotas (B11): ¿un egreso con tres vencimientos, o tres egresos?** Tres es más
simple de programar y de leer en el listado; uno con cuotas es más fiel a que hay una
sola factura. **Decisión: tres egresos hermanados** (F2).

---

## Relacionado

- `costos-consolidados-ot-diseno.md` — su Fase 3 queda abierta (ver §11)
- `facturacion-ordenes-deuda-comercial-diseno.md` — el eje espejo, y por qué no es simétrico
- `usuarios-roles-permisos-diseno.md` — los permisos reusados
