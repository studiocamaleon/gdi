# Tiempo manual por paso — Diseño

**Fecha:** 2026-07-09
**Estado:** IMPLEMENTADO — etapas A (motor), B (editor), C (sheet) y D (ficha)
completas y verificadas E2E el 2026-07-10
**Casos de referencia:** Diseño gráfico (paso habitual) · Corte/grabado láser (paso opcional)

---

## 1. Contexto y objetivo

Hoy el tiempo de un paso sale de la configuración del producto (tiempo fijo,
productividad propia o productividad del perfil de máquina). Eso funciona para
pasos estables, pero hay pasos cuyo tiempo **depende del trabajo puntual** y
solo el comercial puede estimarlo al cotizar:

- **Diseño gráfico**: un cliente pide un ajuste de 10 minutos, otro un diseño
  desde cero de 3 horas. Hoy se costea siempre igual (ej. 5 min fijos).
- **Corte/grabado láser**: el tiempo de máquina depende del dibujo (el RIP lo
  informa). No es lo mismo 1 minuto que 50, y el costo hora de máquina es alto.

**Objetivo:** que el modelador pueda marcar un paso como *"el comercial ingresa
el tiempo al cotizar"*, con default y validaciones opcionales; que el sheet de
Agregar producto muestre ese input; y que el valor viaje por `jobContext` hasta
el costo, el snapshot y la OT — con trazabilidad de que fue una estimación
manual.

---

## 2. Estado actual

### 2.1 Motor (`apps/api/src/motor-universal/motor.service.ts`, `calcularTiempo`)

- `modoTiempo` por paso: **T-1** (fijo), **T-2** (productividad propia /
  manual), **T-3** (productividad del perfil de máquina). `T-4 INPUT_MANUAL`
  existe como concepto en los tipos pero nunca se implementó como modo
  aparte: el comentario del código lo da por cubierto vía T-2.
- **Ya existe el mecanismo de lectura**: en T-2, si
  `paramsPasoJson.campoHorasJobContext = "<clave>"`, el motor lee
  `jobContext[<clave>]` (en **horas**) y lo usa como `runMin` con prioridad
  máxima. Nunca se cableó UI para esto (ni editor ni sheet).
- Jerarquía actual en T-2: `campoHorasJobContext` > `horasEstimadas` (fijo) >
  `batch_time` / `productivityValue`. Setup/cleanup/tiempoFijo se suman aparte
  y el total se redondea con `Math.ceil`.
- En T-1 y T-3 **no hay** ningún camino de override manual en runtime.

### 2.2 Editor de config de pasos (`src/components/productos-servicios/config-pasos-editor-view.tsx`)

- T-2 tiene UI para `horasEstimadas`, productividad y lote ("Ritmo de trabajo
  manual"). **No hay UI** para `campoHorasJobContext`; solo la validación lo
  reconoce (si está seteado, no warnea "Tiempo del paso sin definir").

### 2.3 Sheet Agregar producto (`src/components/comercial/agregar-producto-sheet.tsx`)

- `buildJobContext` arma el contexto desde un set fijo de inputs. **Patrón
  existente de overrides por paso**: color y caras se escriben como claves
  con namespace — `modoColor_${configPasoId}`, `caras_${configPasoId}`.
- `paramsPasoJson` y `modoTiempo` de cada config **ya llegan al front** en el
  detalle del producto (`productos-servicios-api.ts`), así que el sheet puede
  detectar pasos con input manual sin cambios de API.

### 2.4 Persistencia y OT

- `jobContext` se guarda con el ítem (`CotizacionItem.jobContextJson`) →
  re-cotizar/editar un ítem guardado conserva el valor.
- El snapshot del paso (`tiempo: { totalMin, centroCostoNombre, tarifaHora,
  costo, setupMin, runMin, ... }`) alimenta ficha, desglose de costos y OT.
  Hoy no distingue si el tiempo fue calculado o estimado a mano.

---

## 3. Diseño propuesto

### 3.1 Contrato de configuración (por paso, en `paramsPasoJson`)

Sin migraciones: vive dentro del JSON de params existente.

```jsonc
{
  "tiempoManual": {
    "habilitado": true,
    "obligatorio": false,      // true = no se puede cotizar sin ingresar valor
    "unidadInput": "min",      // "min" | "h" — cómo lo ve/carga el comercial
    "defaultMin": 30,          // opcional: valor inicial del input (en minutos)
    "minMin": 1,               // opcional: cota inferior
    "maxMin": 480,             // opcional: cota superior
    "etiqueta": "Tiempo estimado de diseño"  // opcional: label del input
  }
}
```

Decisiones:

- **Minutos como unidad canónica interna** (`defaultMin`, y la clave de
  jobContext en minutos). El comercial piensa en minutos para láser y el motor
  ya trabaja en minutos (`runMin`); `unidadInput: "h"` es solo presentación.
- **No se almacena el nombre de la clave** (a diferencia del legacy
  `campoHorasJobContext`). La clave se **deriva**: evita colisiones, typos y
  el problema de clonar configs con claves duplicadas.

### 3.2 Clave de jobContext y semántica en el motor

- Clave derivada: **`tiempoManualMin_${configPasoId}`** (en minutos). Mismo
  patrón de namespace que `modoColor_*` / `caras_*`.
- Nuevo comportamiento en `calcularTiempo`, **para cualquier `modoTiempo`**
  (generalización a T-1/T-2/T-3): si el paso tiene
  `paramsPasoJson.tiempoManual.habilitado` y
  `jobContext[tiempoManualMin_<configPasoId>]` es un número > 0, entonces
  `runMin = valor` y se saltea el cálculo por productividad/lote/horas.
  - Setup y cleanup **se siguen sumando** (preparar la máquina láser no
    depende del dibujo). `tiempoFijoOverrideMin` se ignora cuando hay valor
    manual (evita doble conteo en pasos hoy modelados T-1 con tiempo fijo).
  - Los **multiplicadores no aplican** sobre el tiempo manual: es una
    estimación absoluta del trabajo completo, no un tiempo por unidad. Si el
    trabajo es doble faz o triplicado, el comercial ya lo consideró al
    estimar.
  - Prioridad final en T-2: `tiempoManual` > `campoHorasJobContext` (legacy,
    se mantiene por compatibilidad) > `horasEstimadas` > lote/productividad.
- Fallback sin valor: el paso se costea **exactamente como hoy** (tiempo fijo,
  productividad, etc.). Esto hace el feature 100% retrocompatible: snapshots
  viejos y productos sin la config no cambian ni un centavo.

### 3.3 Trazabilidad en el snapshot

Agregar al `tiempo` del `PasoEjecutado`:

```ts
tiempo: {
  // ...campos actuales...
  origenTiempo?: "manual_comercial" | "calculado";  // default "calculado"
}
```

Permite que ficha/OT muestren "⏱ estimado por el comercial" junto al paso, y a
futuro comparar estimado vs. real de producción.

### 3.4 Editor de pasos (modelador)

En el bloque de tiempo del paso (junto a "Ritmo de trabajo manual"):

- Switch **"El comercial estima el tiempo al cotizar"** → habilita el grupo:
  unidad del input (min/h), valor sugerido, mínimo/máximo, etiqueta, y el
  check "Obligatorio (no se puede cotizar sin ingresarlo)".
- Validación: si `obligatorio` y no hay `defaultMin`, el editor avisa que la
  cotización quedará bloqueada hasta que el comercial ingrese el valor (es el
  comportamiento deseado para láser, pero debe ser una decisión consciente).
- La validación existente de T-2 ("Tiempo del paso sin definir") acepta
  `tiempoManual.habilitado` como definición válida de tiempo.

### 3.5 Sheet Agregar producto (comercial)

- Detección: pasos ejecutables de la ruta activa (incluidos opcionales
  activados) con `paramsPasoJson.tiempoManual.habilitado`.
- Render: input numérico por paso en la sección de datos del producto, junto a
  los overrides por paso existentes (mismo bloque donde hoy aparece
  "Impresion de original · color"). Label: `etiqueta` o
  `"<nombre del paso> · tiempo estimado"`, con la unidad configurada.
- Valor inicial: `defaultMin` (convertido a la unidad de display). Si el
  comercial lo borra y el paso no es obligatorio, se cotiza con el cálculo
  estándar del paso.
- Escritura: `ctx[`tiempoManualMin_${configPasoId}`] = minutos` en
  `buildJobContext` (conversión h→min si `unidadInput === "h"`).
- Bloqueo por obligatorio: mismo patrón que `minimoComercialStatus` /
  cantidades exactas — el botón "Agregar a la OT" queda deshabilitado con
  mensaje claro ("Ingresá el tiempo estimado de Corte láser") hasta completar.
- Validación en vivo: fuera de `[minMin, maxMin]` → error inline, no se
  cotiza. El impacto en precio se ve en el "DETALLE DEL CÁLCULO" con el
  recálculo automático existente.
- Los inputs de pasos **opcionales** solo se muestran (y solo bloquean) cuando
  el opcional está activado.

### 3.6 Ficha / OT / producción

- Desglose por paso: el tiempo ya se muestra (`formatTiempoPaso`). Se agrega
  el badge de origen cuando `origenTiempo === "manual_comercial"`.
- Edición de un ítem guardado: el sheet rehidrata el input desde el
  `jobContext` guardado (misma mecánica que caras/color por paso).

---

## 4. Casos de referencia

### 4.1 Diseño gráfico — paso habitual con default

**Hoy:** T-1 con 5 min fijos (o T-2 con `horasEstimadas`), centro de costo
"Diseño Gráfico & Pre-prensa".

**Config propuesta:**

```jsonc
{
  "tiempoManual": {
    "habilitado": true,
    "obligatorio": false,
    "unidadInput": "min",
    "defaultMin": 15,
    "minMin": 5,
    "maxMin": 600,
    "etiqueta": "Tiempo estimado de diseño"
  }
}
```

**Comportamiento:** el sheet muestra "Tiempo estimado de diseño: [15] min"
pre-cargado. En el 80% de las ventas el comercial no lo toca (cotiza a 15
min). Cuando el cliente pide algo complejo, lo sube a 120 y el costo del paso
pasa de `15/60 × tarifa` a `120/60 × tarifa` al instante en el detalle.

- Sin valor (input vacío): cae al cálculo actual del paso → retrocompatible.
- El multiplicador por caras/copias no lo toca: 120 min es la estimación del
  trabajo, no "por faz".

### 4.2 Corte/grabado láser — paso opcional, obligatorio, sin default

**Hoy:** el tiempo real lo informa el RIP de la máquina según el dibujo; no
hay productividad estable posible. Paso opcional en la ruta, con máquina M-1 y
centro de costo alto.

**Config propuesta:**

```jsonc
{
  "tiempoManual": {
    "habilitado": true,
    "obligatorio": true,
    "unidadInput": "min",
    "minMin": 1,
    "maxMin": 240,
    "etiqueta": "Minutos de máquina (según RIP)"
  }
}
```

**Comportamiento:** al activar el opcional "Grabado láser" aparece el input
vacío y el botón "Agregar a la OT" se bloquea hasta ingresarlo. El comercial
corre el archivo por el RIP (o estima), carga 35 min, y el paso se costea
`setup + 35 min × tarifa de la máquina`. El setup del perfil se suma solo —
el comercial no tiene que acordarse de incluirlo.

- Si el opcional se desactiva, el input desaparece, la clave queda ignorada y
  no bloquea.
- Nota de modelado: funciona igual con el paso en T-3 (máquina con perfil)
  gracias a la generalización de §3.2 — no hace falta re-modelarlo como T-2.

---

## 5. Journey completo

1. **Modelador** (Catálogo → Config de pasos): activa el switch en el paso,
   define unidad/default/obligatorio. Guarda. Sin migración ni recálculo.
2. **Comercial** (Agregar producto): configura el producto normal; ve el input
   del tiempo (pre-cargado o vacío-obligatorio). Ajusta → recálculo automático
   → ve el impacto en el detalle del cálculo.
3. **Cotización**: `buildJobContext` escribe `tiempoManualMin_<configPasoId>`;
   el motor lo usa como `runMin` y marca `origenTiempo: "manual_comercial"` en
   el snapshot.
4. **Guardado / edición**: el valor persiste en `jobContextJson`; al editar el
   ítem el input se rehidrata con el valor guardado.
5. **OT / producción**: el paso muestra su tiempo con el badge "estimado por
   el comercial"; producción sabe que ese número es una estimación comercial,
   no un cálculo de perfil.

---

## 6. Casos borde y reglas

| Caso | Comportamiento |
|---|---|
| Input vacío, paso no obligatorio | Cae al cálculo estándar del paso (hoy). |
| Input vacío, paso obligatorio | Sheet bloquea "Agregar a la OT" con mensaje. El motor, como defensa en profundidad, emite error `tiempo_manual_requerido` si cotiza sin valor. |
| Valor ≤ 0, no numérico o fuera de [min, max] | Error inline en el sheet; no se envía la cotización. El motor ignora valores no positivos (fallback a cálculo estándar) salvo obligatorio → error. |
| Paso opcional desactivado | El input no se muestra; si la clave quedó en el jobContext de una edición previa, el motor no ejecuta el paso → inocua. |
| Snapshot/ítems guardados antes del feature | Sin clave en jobContext y sin `tiempoManual` en params → comportamiento idéntico al actual. |
| Clonar producto/config de paso | La clave se deriva del nuevo `configPasoId` → sin colisiones. `tiempoManual` en params se clona como cualquier param. |
| Config con `campoHorasJobContext` legacy | Sigue funcionando (T-2, en horas). `tiempoManual` tiene prioridad si ambos existen. Migración natural: el editor, al activar el switch en un paso con legacy, ofrece absorberlo. |
| Multiplicadores (caras, copias, etc.) | **No** aplican sobre tiempo manual (estimación absoluta). |
| `tiempoFijoOverrideMin` del paso | Ignorado cuando hay tiempo manual (evita doble conteo). Setup/cleanup del perfil sí se suman. |
| Tarifa horaria | Sin cambios: centro de costo de la máquina o manual del paso, como hoy. |
| Redondeo | Sin cambios: `Math.ceil` sobre el total del paso. |

---

## 7. Plan técnico por etapas

### Etapa A — Motor (backend, ~1 sesión)
- `tipos.ts`: `origenTiempo` en el tiempo del `PasoEjecutado`; tipo
  `TiempoManualConfig` para params.
- `motor.service.ts` / `calcularTiempo`: lectura de
  `tiempoManualMin_<configPasoId>` para todo modoTiempo, prioridad, reglas de
  §3.2, error `tiempo_manual_requerido`.
- Tests en `__tests__/motor.spec.ts`: T-1/T-2/T-3 con y sin valor, obligatorio
  sin valor, legacy `campoHorasJobContext` conviviendo, multiplicadores no
  aplicados, setup sumado, tiempoFijo ignorado.

### Etapa B — Editor de pasos (~1 sesión)
- UI del switch + campos en el bloque de tiempo (T-1/T-2/T-3).
- Validaciones (`validarBasico`): acepta tiempoManual como definición de
  tiempo; warning de obligatorio-sin-default.

### Etapa C — Sheet comercial (~1 sesión)
- Detección de pasos con `tiempoManual` en `productoDetalle`.
- Input por paso (patrón overrides por paso), estado en `MotorConfigState`,
  escritura en `buildJobContext`, rehidratación al editar ítem.
- Bloqueo de "Agregar a la OT" por obligatorio + validación min/max.

### Etapa D — Ficha/OT + verificación E2E (~0.5 sesión)
- Badge "estimado por el comercial" en desglose por paso y OT.
- E2E manual: diseño gráfico con default ajustado + láser obligatorio, ciclo
  completo cotizar → guardar → editar → OT.

---

## 8. Fuera de alcance (futuro)

- **Estimado vs. real**: cuando producción registre tiempos reales, comparar
  contra `origenTiempo: manual_comercial` para retroalimentar al comercial.
- **Sugerencia asistida**: precargar el input con el promedio histórico del
  paso para ese cliente/producto.
- **Otros inputs manuales por paso** (no-tiempo): cantidad de pasadas,
  metros de fleje, etc. El patrón de clave namespaced + params por paso queda
  sentado para generalizarlo si aparece la necesidad.
