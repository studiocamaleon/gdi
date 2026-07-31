# Comisiones — modelo (diseño)

> Estado: Fase A (librito + alcance TENANT) y Fase B (reconciliación del margen
> real vs la comisión de pasarela real) **implementadas**, más el ajuste del Tab
> Precio (tilda sólo vendedor; la pasarela se aplica sola). Rama
> `feat/impuestos-comisiones`. Hermano de `docs/impuestos-modelo-latam-diseno.md`.
> Fecha: 2026-07-31.

## 1. Objetivo

Ordenar las comisiones como su propio dominio. Dos disparadores del usuario:

1. Hay **tipos** distintos de comisión (pasarela de pago vs vendedor) que se
   comportan distinto y hoy se mezclan.
2. La **comisión de pasarela** se cotiza fija ("8% por las dudas") para no tener
   un precio por forma de pago, pero **el margen real no se entera** de cómo
   pagó el cliente: si pagó en efectivo, ese 8% no existió y el margen quedó
   subestimado. Se quiere **reconciliar el margen real** de la OT contra lo que
   realmente salió en los cobros.

## 2. Estado actual (lo que hay)

- **Modelo:** `ProductoComisionCatalogo` (catálogo del tenant) +
  `ProductoComisionAplicada` (pivot **por producto**). Campos: `porcentaje`,
  `baseCalculo` (NETO | BRUTO_COBRADO). **No tiene `alcance`** (a diferencia de
  impuestos).
- **Motor** (`aplicar-precio.service.ts`): ya distingue por base —
  `comisionesNetoPct` (base NETO) y `comisionesBrutoPct` (base BRUTO_COBRADO)—,
  y las embebe en el precio vía gross-up. La matemática ya trata distinto a los
  dos tipos.
- **Cobros:** `MetodoPago` tiene `comisionPct` / `ivaComisionPct`. Cada `Cobro`
  guarda `metodoPagoId`, `comisionPctAplicada`, `comisionMonto`,
  `comisionIvaMonto` y `ordenId`. **La comisión REAL de cada pago ya se captura.**
- **OT:** el tab **Costos → "Real vs. cotizado"** (`costos-orden-tab.tsx`,
  `cruzarRealVsCotizado`) ya reconcilia el **tiempo** de taller y muestra el
  Margen. Todavía **no** toca la comisión real de los cobros.
- **UI de config:** comisiones usa el `PrecioCatalogoManager` genérico (el mismo
  catálogo crudo que impuestos tenía antes de su librito).

## 3. Los dos tipos + el hallazgo del alcance

| Tipo | Base | ¿De qué depende? | Alcance natural |
|---|---|---|---|
| **Pasarela de pago** | BRUTO_COBRADO | De **cómo te pagan** (tarjeta, MP…) | **TENANT** — aplica a toda venta |
| **Vendedor** | NETO | De **quién/qué se vende** | **Producto** (o vendedor) |

**El hallazgo:** la comisión de pasarela **no es del producto** — es de la forma
de cobro, y aplica a *todas* las ventas. Es el mismo caso que "Ingresos Brutos"
en impuestos, que resolvimos con `alcance: TENANT`. Como comisiones **no tiene
`alcance`**, hoy la pasarela hay que tildarla producto por producto (el mismo
dolor que ya sacamos en impuestos). Ese es el cambio de modelo de la Fase A.

## 4. Framework propuesto

- **Pasarela** = comisión **tenant** (base bruto). Se declara una vez (el "8% por
  las dudas") y el motor la aplica a todo, sin tildar por producto.
- **Vendedor** = comisión **por producto** (base neto). Se mantiene el pivot
  actual. (A futuro: por vendedor/empleado vía `detalleJson`.)
- El motor mergea las comisiones TENANT igual que ya hace con los impuestos
  TENANT (dedupe por catálogo). Cambio chico y neutral.

## 5. Reconciliación del margen real (la idea del usuario)

**Clave: nunca se toca el precio al cliente.** Es un ajuste de **margen real**,
no de facturación → riesgo bajo.

- **Estimado:** la comisión que se cotizó (está en el snapshot de la OT).
- **Real:** la suma de `comisionMonto` de los cobros de esa OT (efectivo = 0,
  tarjeta = lo que salió). Ya está en la base.
- **El trabajo:** que el tab "Real vs. cotizado" reemplace la comisión estimada
  por la real (de los cobros) al calcular el margen real, y muestre el delta.

Ejemplo: se cotizó 8% de pasarela; el cliente pagó en efectivo → comisión real
$0 → aparece margen "encontrado". Precio al cliente: idéntico.

**Detalles a resolver:** pagos parciales (la comisión real se acumula; queda
definitiva cuando la OT está saldada), varios métodos por OT (se suman), y si el
IVA de la comisión (`comisionIvaMonto`) entra en el margen o no (coherente con
cómo se modeló el estimado, base BRUTO_COBRADO).

## 6. Fases

- **Fase A — el "librito" de comisiones (arranca ahora):**
  1. `alcance` en `ProductoComisionCatalogo` (default PRODUCTO; migración neutral).
  2. Motor: mergear comisiones TENANT (espejo de impuestos) — neutral al centavo
     para lo existente.
  3. Vista propia (como el librito de impuestos): **Pasarela** (tenant, "cómo te
     pagan") + **Vendedor** (por producto). Jerga técnica escondida.
  4. Reubicación ya hecha (vive en Configuración desde la Fase 1 de impuestos).

- **Fase B — reconciliación real vs estimada:** enchufar la comisión real de los
  cobros al tab "Real vs. cotizado" de la OT. Se apoya en datos que ya existen.

## 7. Decisiones abiertas

1. ¿La comisión de **vendedor** queda por producto (como hoy) o se modela por
   vendedor/empleado? Recomendación: por producto ahora; por vendedor, futuro.
2. Fase B: ¿la comisión real "definitiva" se congela al saldar la OT, o se
   recalcula viva con cada cobro? Recomendación: viva + marca "definitiva" al
   saldar.
3. ¿El IVA de la comisión de pasarela entra en el margen real? (Coherencia con
   el estimado.)
