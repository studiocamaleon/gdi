# Cobertura de tóner por nivel — Diseño

**Fecha:** 2026-08-03
**Estado:** Fases 1, 2 y 3 IMPLEMENTADAS (2026-08-03, sin commitear). Cobertura es un
default **por paso** y **exclusivo de láser** (corrección 2026-08-03; ver §4.2). El TPV
de centro de copiado usa un selector de **cobertura por documento** (default Alta) y se
retiró el andamiaje de *perfil* (`perfilesJson` + `Producto.coberturaDefault` dropeadas,
migración 20260803050000).
**Caso de referencia:** impresora láser color (Ricoh Pro C8003), pero el modelo
es sistémico: aplica a cualquier familia que imprima tóner/tinta.

---

## 1. Contexto y objetivo

El consumo de tóner de una impresión depende de **cuánta tinta pone en la hoja**
— su *cobertura*. Una hoja de texto al borrador gasta una fracción del tóner de
un folleto full-color. Hoy el motor no modela eso: cada perfil declara **un solo**
`consumoBase` en g/m² por canal (N/C/M/Y), y la cobertura queda *implícita y
congelada* dentro de ese número.

La única forma de variar la cobertura hoy es tener **perfiles distintos**. Eso es
lo que hizo el TPV de centro de copiado (un selector de perfil por documento), y
es justo el modelo equivocado: duplica perfiles y rompe la resolución automática.

**Objetivo:** que la cobertura sea una dimensión **ortogonal** al perfil. El
perfil se sigue resolviendo **automático** en todo el sistema (color·caras·
gramaje); la cobertura es un eje aparte, elegible en catálogo y en centro de
copiado, que modula el consumo de tóner sin tocar la selección de perfil.

---

## 2. Por qué cobertura ≠ perfil

El perfil operativo ya discrimina **color · caras · gramaje** (`detalleJson`), y
el motor lo auto-resuelve encadenando esos tres filtros
(`seleccionarPerfilOperativo`, motor.service.ts). Meter la cobertura como "otro
perfil" haría explotar la combinatoria (3 coberturas × N perfiles) y volvería
inalcanzable la auto-resolución.

La cobertura es **cuánta tinta**, no **cómo imprime**. Es una decisión comercial
del trabajo (borrador interno vs. folleto de venta), no una config de máquina.
Por eso va como eje propio: el perfil queda automático, la cobertura se elige.

### 2.1. Corolario: el "perfil default" del producto es vestigial para impresión

En el editor de producto se elige máquina(s) + un perfil default (`perfilM1Id`).
Para familias de **impresión**, el motor **re-resuelve el perfil solo** y el
default es apenas un fallback (`if (elegido.id === paso.perfilM1Id) return null`).
Es decir: el perfil elegido por producto de impresión casi nunca gana.

⇒ Lo que el producto de impresión debería declarar no es un *perfil* sino una
**cobertura default** (Alta). El selector de máquina/perfil se mantiene
para familias donde el perfil SÍ es una decisión real (corte: tipoCorte,
factorComplejidad); para impresión se muestra cobertura y el perfil queda
automático.

---

## 3. Los tres niveles

Enum **fijo del sistema** (iguales columnas y selectores en toda la app):

| Nivel    | Código     | Uso típico                        |
|----------|------------|-----------------------------------|
| Borrador | `borrador` | Texto, pruebas, interno           |
| Normal   | `normal`   | Documento normal, mixto           |
| Alta     | `alta`     | Folletería, fotos, alta cobertura |

Fijos por simplicidad: la alternativa (niveles configurables por tenant)
complica UI (columnas dinámicas) y motor sin valor claro en v1.

---

## 4. Modelo de datos

### 4.1. Consumo por nivel en el consumible

Hoy `MaquinaConsumible` (scoped a `perfilOperativoId` + canal) tiene un
`consumoBase` (Decimal, g/m²). Se agrega un JSON con el consumo de los 3 niveles:

```
MaquinaConsumible.consumoPorCoberturaJson  Json?
  = { borrador: number, normal: number, alta: number }   // g/m² por nivel
```

- `consumoBase` se conserva como **compatibilidad** = columna Normal.
- Lectura del motor: `consumoPorCobertura[nivel] ?? consumoBase`.
- Migración (zero-regression): backfill `{ borrador: c, normal: c, alta: c }`
  con `c = consumoBase` actual → el costo no cambia hasta que el taller
  diferencie las columnas a mano.

### 4.2. Cobertura default por PASO (láser)

La cobertura es una propiedad del **paso de impresión**, no del producto ni de la
máquina/perfil. Se guarda en la config del paso, sin columna nueva:

```
ProductoConfigPaso.paramsPasoJson.coberturaDefault   // 'borrador' | 'normal' | 'alta'
```

Se edita en el panel **MÁQUINA Y PERFIL** del editor de pasos, **sólo si el paso usa
una impresora láser** (gran formato/tinta no tiene cobertura). Se persiste con el
mismo "Guardar paso". Default de UI = **`alta`**.

> Nota: `Producto.coberturaDefault` existió en un intento previo (per-producto) y
> quedó como **columna inerte**; se retira junto con `perfilesJson` en la limpieza.

### 4.3. jobContext

Clave de entrada que el motor lee al costear consumo:

```
jobContext.cobertura                 // 'borrador' | 'normal' | 'alta' (override global)
jobContext.cobertura_<configPasoId>  // override por paso (opcional)
```

Resolución del nivel efectivo (en la cotización):
`override del comercial (jobContext)  ??  paramsPasoJson.coberturaDefault del paso  ??  'normal'`.

---

## 5. Motor

Único cambio en el cálculo de consumibles (motor.service.ts ~4234):

```
// hoy:
cantidad = consumoBase × áreaImpresa_m² × caras
// nuevo:
const gm2 = consumoPorCobertura(consumible, nivelCobertura) ?? consumoBase
cantidad = gm2 × áreaImpresa_m² × caras
```

- `nivelCobertura` se resuelve como los demás discriminantes (helper análogo a
  `resolverModoColorComercial`): lee `jobContext.cobertura` (o la clave por paso).
- Fallback: sin nivel, o sin JSON, o columna vacía → `consumoBase` (= Normal) →
  comportamiento actual. **Cero regresión.**
- El **desgaste/click NO cambia**: sigue sin depender de la cobertura
  (docs/costo-por-click-desgaste-diseno.md §2). Sólo el tóner/tinta se modula.
- El perfil se sigue resolviendo automático: **este modelo no toca
  `seleccionarPerfilOperativo`.**

---

## 6. Calculadora de tóner de 3 columnas

Hoy `CalculadoraTonerGm2` (consumibles-editor.tsx) convierte rendimiento del
fabricante (páginas a cobertura ISO ~5%) a g/m² a una cobertura objetivo y aplica
**ese único valor** a los 4 canales CMYK (`onApply(gm2)`).

Cambios:

1. La tabla de tóner del perfil pasa de la columna única "Consumo (g/m²)" a
   **3 columnas**: Borrador · Normal · Alta (por canal). **Sólo para láser**: gran
   formato/plotter mantienen la columna única "Consumo".
2. La calculadora computa el g/m² para una cobertura objetivo y aplica a la
   **columna elegida** (el "indicar qué estamos calculando"): "Usar en columna
   **Alta** (4 canales CMYK)". Se corren hasta 3 veces (una por columna) o
   se cargan las columnas a mano.
3. Sugerencia de mapeo del % de la calculadora → columna: baja/ISO (~5%) →
   Borrador/Normal; full-color (~40%) → Alta. No obligatorio: el usuario elige el
   destino.

---

## 7. Dónde se elige la cobertura (journey)

- **Ficha de máquina › perfil › tóner:** define el g/m² de cada nivel por canal
  (fuente de verdad del consumo).
- **Editor de pasos (catálogo):** en el panel MÁQUINA Y PERFIL del paso de impresión
  láser se elige la "Cobertura de tóner por defecto" (Borrador/Normal/Alta) — no se
  pide un perfil (que es automático). Gran formato no muestra el control. Override
  por cotización = fase futura.
- **Centro de copiado:** el selector por documento pasa de **"Perfil" a
  "Cobertura"** (Borrador/Normal/Alta) — más claro para el operador. Default a
  definir (probablemente Normal o Borrador, por el mix del centro).

---

## 8. Qué se pliega de lo ya hecho (centro de copiado)

El TPV de centro de copiado había introducido un selector de **perfil** por
documento (`CentroCopiadoConfig.perfilesJson`, adaptador `perfilSeleccionado_…`,
selector en el sheet). Ese trabajo está **sin commitear** y se **reemplaza**:

- El selector de fila pasa de "Perfil" a "Cobertura" (los 3 niveles fijos).
- El adaptador inyecta `jobContext.cobertura` en vez de `perfilSeleccionado_…`.
- `perfilesJson` (curar perfiles + label) se **retira**: los niveles son fijos y
  del sistema, no hay nada que curar. (La infra de máquina color/BN de la config
  de CC queda intacta.)

La migración `perfilesJson` ya aplicada es aditiva e inofensiva; se puede dejar
la columna sin uso o quitarla en una migración de limpieza.

---

## 9. Compatibilidad y migración

1. `consumoPorCoberturaJson` backfill = `{ borrador, normal, alta } = consumoBase`
   (sin cambio de costo).
2. `Producto.coberturaDefault` = `alta` para productos de impresión de catálogo;
   null (= normal) para el resto. Como todas las columnas arrancan iguales, el
   default no cambia costos hasta que se diferencien.
3. Sin `jobContext.cobertura` → normal → `consumoBase`. Todo lo cotizado no se
   mueve.

---

## 10. Alcance por fases

- **Fase 1 — Datos + motor + calculadora:** schema (`consumoPorCoberturaJson`,
  `Producto.coberturaDefault`), migración + backfill, resolución de nivel en el
  motor, tabla de 3 columnas + calculadora con destino de columna.
- **Fase 2 — Catálogo:** `coberturaDefault` en el editor de producto (para
  impresión: cobertura en vez de perfil), seed Alta en productos existentes, el
  cotizador siembra `jobContext.cobertura`.
- **Fase 3 — Centro de copiado:** reemplazar el selector de perfil por el de
  cobertura; retirar `perfilesJson`.
- **Fase 4 (futuro):** override de cobertura por cotización en catálogo;
  factor/consumo por canal más fino si hace falta; niveles configurables.

---

## 11. Decisiones abiertas

1. **Override por paso** (`cobertura_<configPasoId>`): se deja la puerta abierta
   en el motor pero no se expone en UI en v1.

> **Decisiones cerradas (2026-08-03):**
> - Niveles: **Borrador · Normal · Alta**.
> - Default de cobertura en **centro de copiado = Alta** (igual que catálogo).
> - `perfilesJson` de CC: **se retira en Fase 3** (con el reemplazo del selector de
>   perfil por el de cobertura); hasta entonces queda como columna inerte.

---

## 12. Relación con otros módulos

- [[costo-por-click-desgaste-diseno]] — el desgaste NO se modula por cobertura;
  este modelo sólo toca el tóner/tinta.
- TPV de centro de copiado — este modelo reemplaza su selector de perfil.
- Modelo universal de costeo — la cobertura es un discriminante nuevo del consumo,
  del mismo tipo que modoColor/caras/gramaje.

---

## 13. Plan técnico — Fase 1 (datos + motor + calculadora)

Objetivo: cargar g/m² por nivel, que el motor lo lea, y la calculadora/tabla de 3
columnas. **Sin cablear catálogo ni centro de copiado** (fases 2 y 3). Cero
regresión garantizada por backfill.

### A. Schema + migración
1. `schema.prisma`:
   - `MaquinaConsumible.consumoPorCoberturaJson Json?` — `{borrador,normal,alta}` g/m².
   - `Producto.coberturaDefault String?` — `'borrador'|'normal'|'alta'`; null=normal.
     (Se agrega la columna ahora; **se cablea en Fase 2**.)
2. Migración create-only → revisar → deploy dev + test (patrón seguro; test con
   `postgres:postgres`, y si falla por owner: `migrate resolve --rolled-back` +
   redeploy). Backfill en la MISMA migración:
   ```sql
   UPDATE "MaquinaConsumible"
   SET "consumoPorCoberturaJson" = jsonb_build_object(
     'borrador', "consumoBase", 'normal', "consumoBase", 'alta', "consumoBase")
   WHERE "consumoBase" IS NOT NULL;
   ```

### B. Motor (apps/api/src/motor-universal)
3. Helper `resolverCoberturaComercial(paso, jobContext)` espejando
   `resolverModoColorComercial` (motor.service.ts:5593): lee
   `cobertura_<configPasoId>` / `cobertura_<rutaPasoId>` / `coberturaPorPaso[id]` /
   global `cobertura`; normaliza a `borrador|normal|alta`; default null.
4. En `calcularConsumiblesMaquina` (~4204): `const nivel = resolver(...) ?? 'normal';`
   `const gm2 = consumoPorCobertura?.[nivel] ?? Number(consumible.consumoBase ?? 0)`.
   La validación `>0` y la fórmula (4234) operan sobre `gm2`. **Sólo toca el tóner;
   el desgaste/click no se toca.**
5. `ConsumibleMaquinaCargado` (tipos.ts:849) += `consumoPorCoberturaJson?: unknown`;
   `toConsumibleCargado` (6159) mapea el campo. Las queries usan `include` (p.ej.
   6808) ⇒ el scalar ya viene, no hay que tocar cada `select`.

### C. Persistencia maquinaria (apps/api/src/maquinaria)
6. `upsert-maquina.dto.ts` (231): += `consumoPorCobertura?` (objeto opcional validado).
7. `maquinaria.service.ts`: build consumible (810) += `consumoPorCoberturaJson:
   this.toNullableJson(payload.consumoPorCobertura)`; read-back (1494) += el campo.

### D. Frontend tipos + editor
8. `maquinaria.ts`: `MaquinaConsumible` (517) y write payload (625) +=
   `consumoPorCobertura`. Const compartida `NIVELES_COBERTURA` (borrador/normal/alta).
   `maquinaria-api.ts` (18) ya pasa el resto por spread.
9. `consumibles-editor.tsx`: la tabla de tóner pasa de 1 columna a **3** (Borrador ·
   Normal · Alta) por canal; `upsert` escribe `consumoPorCobertura[nivel]` y
   mantiene `consumoBase = normal` (compat + fallback).
10. `CalculadoraTonerGm2`: `onApply(gm2, nivel)` — elegir a qué columna aplica
    (Borrador/Normal/Alta) el resultado en los 4 canales CMYK. Sugerir mapeo
    (baja/ISO→Borrador/Normal, full-color→Alta) sin forzar.

### E. Verificación
11. Test motor: misma cotización con `cobertura:'borrador'` < `'alta'` cuando las
    columnas difieren; sin cobertura == `consumoBase` (regresión).
12. tsc front+back · jest (motor + maquinaria + centro-copiado, runInBand) · eslint ·
    css:guard · reiniciar API.

**Fuera de Fase 1:** seed `coberturaDefault='alta'`, opción en cotizador de catálogo,
y el reemplazo del selector de CC (fases 2 y 3).
