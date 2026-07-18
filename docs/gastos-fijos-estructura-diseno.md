# Gastos fijos de estructura — diseño

> Fuente única y explícita de los **costos fijos** que el **punto de equilibrio**
> debe cubrir. Desacopla la *planificación de la empresa* (break-even, nivel
> compañía) del *costeo de producto* (centros de costo → tarifas, por trabajo).

## 1. Estado actual (el problema)

El punto de equilibrio (`RentabilidadService.periodo`) lee los costos fijos de
`CentroCostoComponenteCostoPeriodo`. En el tenant real solo hay cargado ahí
**SUELDOS + CARGAS = $18.937.500/mes**. Pero:

- La **maquinaria/amortización (~$5,56M), activos fijos (~$1,33M) y gastos
  generales (~$0,32M)** viven en la config de máquinas y se pliegan a la
  **tarifa** (`CentroCostoTarifaPeriodo.resumenJson`), no en la tabla de
  componentes. Aparecen en el margen bruto (vía `tiempo.costoMaquina`) pero
  **no** en el pool fijo del break-even.
- Los costos fijos **de empresa que no son de un centro productivo** (alquiler
  del local, contador, seguros, software, cuotas/leasing, impuestos fijos,
  marketing) **no tienen dónde entrar**.

**Consecuencia:** el PE ($25,1M) cubre solo la nómina. El PE real sobre la
estructura completa (~$26M) estaría cerca de **~$34M**. Hoy es optimista.

**Causa raíz:** se reusan los centros de costo (cuyo propósito es armar
*tarifas*, con reparto y capacidad) como pool del break-even. Son dos conceptos
distintos y deben tener fuentes distintas.

## 2. Framework conceptual

| | Costeo de producto | Planificación de estructura |
|---|---|---|
| Pregunta | ¿Cuánto cuesta este trabajo? | ¿Cuánto tengo que facturar este mes para cubrir mi estructura? |
| Nivel | Por trabajo / por hora | Empresa / mensual |
| Fuente | `CentroCosto` + componentes + tarifa | **`GastoFijoEstructura`** (nuevo) |
| Consumidor | Motor de costeo | Punto de equilibrio (Panel) |

Regla de oro: **el punto de equilibrio lee SOLO de `GastoFijoEstructura`.** Los
centros de costo quedan intactos para las tarifas. Como son consumidores
distintos, cargar sueldos en ambos lugares **no** genera doble conteo (cada uno
se usa para su cálculo). Esto se documenta en la UI para evitar confusión.

## 3. Modelo de datos

Modelo **recurrente con vigencia**: se carga un gasto una vez y aplica todos los
meses desde `vigenteDesde` hasta `vigenteHasta` (null = indefinido). Granularidad
mensual `YYYY-MM`, consistente con `periodo` de los componentes de centro y con
el prorrateo del panel (`mesesDelRango` / `fraccionMesEnRango`).

```prisma
enum CategoriaGastoFijo {
  ALQUILER
  SUELDOS
  SERVICIOS        // luz, agua, internet, teléfono
  AMORTIZACION     // depreciación de máquinas/equipos
  FINANCIEROS      // intereses, cuotas, leasing
  IMPUESTOS        // fijos (no IVA/IIBB que ya se costean por venta)
  MARKETING
  OTROS
}

model GastoFijoEstructura {
  id             String             @id @default(uuid()) @db.Uuid
  tenantId       String             @db.Uuid
  nombre         String
  categoria      CategoriaGastoFijo
  importeMensual Decimal            @db.Decimal(14, 2)
  vigenteDesde   String             // 'YYYY-MM'
  vigenteHasta   String?            // 'YYYY-MM' | null (indefinido)
  activo         Boolean            @default(true)
  notas          String?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  tenant         Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}
```

Un gasto **aplica al mes `M`** si `activo` ∧ `vigenteDesde <= M` ∧
(`vigenteHasta` es null ∨ `M <= vigenteHasta`). Comparación de strings `YYYY-MM`
(ordenable lexicográficamente).

## 4. Cálculo del punto de equilibrio (nuevo)

En `RentabilidadService.periodo`, reemplazar la lectura de
`CentroCostoComponenteCostoPeriodo` por `GastoFijoEstructura`:

1. Traer los gastos `activos` cuya vigencia solapa algún mes de
   `mesesDelRango(rango)`.
2. Para cada mes `M` del rango, sumar `importeMensual` de los gastos vigentes
   en `M`, multiplicado por `fraccionMesEnRango(M, rango)` (prorrateo de rangos
   parciales, idéntico a hoy).
3. `costosFijos` = Σ. `puntoEquilibrio = costosFijos / contribFrac`. Sin cambios
   en la fórmula de contribución (material + consumibles) — **eso ya está bien**.

El donut de Finanzas pasa de **"Gasto por centro de costo"** a **"Gasto por
categoría de estructura"** (`gastoPorCategoria` en vez de `gastoPorCentro`).

## 5. Casos borde

- **Sin gastos cargados** → `costosFijos = 0` → sin PE (ya lo maneja `limites`:
  "Costos fijos no cargados en el período").
- **Gasto dado de baja** (`vigenteHasta` en el pasado) → no aplica.
- **Rango que cruza una baja/alta** → solo cuentan los meses vigentes de cada
  gasto (el prorrateo se aplica por mes).
- **`vigenteHasta < vigenteDesde`** → rechazar en el DTO.
- **Doble carga sueldos (centro + gasto fijo)** → esperado y válido; no se
  suman entre sí. Nota aclaratoria en la UI.
- **Contribución no positiva** → PE indefinido (ya manejado).

## 6. Journey del usuario

1. Costos → **Gastos fijos**.
2. Ve la lista de gastos vigentes agrupada por categoría, con **total mensual**
   y comparación contra el break-even.
3. **Agrega** un gasto: nombre, categoría, importe mensual, vigente desde
   (default mes actual), vigente hasta (opcional).
4. El punto de equilibrio del Panel usa el total automáticamente.
5. **Da de baja** (setea `vigenteHasta`) o **desactiva**/elimina.
6. **Importar desde tarifas** (acción una sola vez, guardada si la lista está
   vacía): precarga sueldos + maquinaria + activos + gastos generales desde
   `CentroCostoTarifaPeriodo` publicadas (~$26M), para arrancar con la
   estructura completa y editar desde ahí.

## 7. Alcance de implementación

1. Schema: `GastoFijoEstructura` + enum `CategoriaGastoFijo` + back-relation en
   `Tenant` + migración.
2. Backend: `GastosFijosModule` (service CRUD + controller) bajo `costos` o
   módulo propio; DTOs con validación; mapper Decimal→number.
3. `RentabilidadService`: cambiar la fuente del pool fijo + `gastoPorCategoria`.
4. Endpoint `POST /gastos-fijos/importar-desde-tarifas` (guardado si vacío).
5. Front: página Costos → Gastos fijos (lista + form + baja con
   `ConfirmacionDestructiva`), `src/lib/gastos-fijos-api.ts`, link en sidebar.
6. Panel: adaptar el donut de Finanzas a `gastoPorCategoria`.

Contribución = material + consumibles: **no se toca** (verificado correcto).
