# Anilladora + espirales: encuadernación por anillo como paso costeado

Diseño para modelar la **máquina anilladora** (espiral plástico / Wire-O) y los
**anillos/espirales como material**, y cerrar el **paso de encuadernación
espiral** (`encuadernado_anillado`) que hoy está declarado pero sin usar. Es lo
que destraba el **"Anillado con costo"** del centro de copiado (hoy la terminación
"Anillado" se muestra sin costo — ver
[tpv-centro-copiado-diseno.md](tpv-centro-copiado-diseno.md)).

**Hallazgo principal:** el sistema ya tiene modelado casi todo (plantilla de
máquina ANILLADORA completa, familia de paso `encuadernado_anillado` declarada,
template de material de anillado). Faltan tres cosas puntuales: un **atributo de
capacidad** en el material, un **fix de lectura** en el motor, y **sembrar la
biblioteca** de espirales con sus capacidades. No se parte de cero.

## 1. Investigación del dominio (qué anillo sirve para cuántas hojas)

Hay tres sistemas de encuadernación por anillo; el sistema debe soportar al menos
espiral plástico y Wire-O (el enum ya los tiene: `ESPIRAL_PLASTICO`, `WIRE_O`).

**Espiral plástico (PVC coil), paso 4:1** — el más común en centro de copiado:

| Ø | Hojas (80g) | Ø | Hojas |
|---|---|---|---|
| 6mm | 35 | 18mm | 160 |
| 8mm | 60 | 20mm | 180 |
| 10mm | 80 | 25mm | 230 |
| 12mm | 100 | 32mm | 290 |
| 14mm | 120 | 40mm | 350 |
| 16mm | 140 | 50mm | 440 |

**Wire-O / doble anillo (twin-loop):** paso **3:1** (3/16"–9/16", ~2–125 hojas),
paso **2:1** (5/8"–1¼", ~135–280 hojas).

**Anillado plástico (comb / peine):** 6mm≈25, 12mm≈85, 16mm≈125, 25mm≈200,
51mm≈425 hojas.

**Insight de diseño clave:** la capacidad **no es un número universal** — varía por
fabricante, paso y gramaje. Ejemplo real: una fuente da espiral 6mm = 20 hojas y
otra = 35. Además la capacidad se cotiza a **80g/20lb**; con papel más pesado baja
~15–20%. **Conclusión:** la capacidad tiene que ser un **atributo configurable por
variante**, sembrado con un default representativo, que el tenant ajusta a lo que
compra. (Esto encaja exactamente con la lógica `MENOR_CAPACIDAD_QUE_CUMPLA` que ya
tiene el motor.)

Fuentes: [OnlineSkyline — Plastic Coil chart](https://www.onlineskyline.com/Plastic-Coil-Bind-Size-Chart),
[OnlineSkyline — Comb chart](https://www.onlineskyline.com/Comb-Bind-Size-Chart),
[Binding101 — Wire binding 101](https://www.binding101.com/blog/post/binding/wire-binding-101-everything-you-need-to-know-about-twin-loop-binding),
[ABC Office — Coil guide](https://www.abcoffice.com/office-equipment-news/2010/08/plastic-spiral-coil-binding-capacity-diameter-guide/).

## 2. Estado del sistema (qué existe / qué falta)

| Pieza | Estado | Acción |
|---|---|---|
| (a) Plantilla máquina ANILLADORA + perfiles | **Completa** end-to-end | Ninguna en código; **cargar una máquina real** |
| (b) Espiral como materia prima (variantes) | **Parcial**: template con `diametro`+`material` | Agregar `capacidadMaxHojas` + `tipoAnillo` + `color`; **sembrar biblioteca** |
| (c) Paso `encuadernado_anillado` + selección | **Existe y declarada**; validación OK | **Fix** lectura de `capacidadMaxHojas` en el motor; configurar el slot del producto |

### (a) La máquina ANILLADORA — ya está entera

- Enum `PlantillaMaquinaria.ANILLADORA` (`schema.prisma:121`).
- `Maquina` (`schema.prisma:1227-1280`), `MaquinaPerfilOperativo`
  (`1291-1325`: `productivityValue/Unit`, `setupMin`, `cleanupMin`, `feedReloadMin`,
  `detalleJson`).
- Reglas backend: DTO (`upsert-maquina.dto.ts:29`), geometría `plano`/unidad `hora`
  (`maquinaria.service.ts:145-148`), máquina requiere `anchoUtil` (largo máx
  anillado), `altoUtil` (Ø máx), `tiposAnilloSoportados`
  (`maquinaria-template-machine-rules.ts:104-108`); perfil requiere `tipoAnillo`
  (ESPIRAL_PLASTICO|WIRE_O), `diametrosSoportadosMm`, tipo `fabricacion`
  (`maquinaria-template-profile-rules.ts:187-200`).
- UI: `buildAnilladoraSections()` (`src/lib/maquinaria-templates.ts:572-607`) — 3
  secciones (capacidades físicas, params técnicos, perfiles por tipo de anillo). El
  editor de máquinas es genérico y ya la consume.

**Nada que codear:** solo cargar una anilladora real con su(s) perfil(es).

### (b) Los espirales como materia prima — falta el atributo de capacidad

- Template `anillado_encuadernacion_v1` (`src/lib/materia-prima-templates.ts:723-744`):
  familia `terminacion_editorial`, subfamilia `anillado_encuadernacion`, unidad
  `unidad`. Hoy `camposTecnicos`: `diametro` + `material`.
- Compat del slot ↔ material: `MP.anillo` = `TERMINACION_EDITORIAL` +
  `ANILLADO_ENCUADERNACION` (`familias.ts:106-109`).
- **GAP:** el template **no define `capacidadMaxHojas`**, aunque la familia de paso
  lo exige (`familias.ts:1117,1121`) y el tip del template de máquina lo pide
  explícitamente (`maquinaria-templates.ts:856`: "Cargá variantes de anillo con su
  capacidadMaxHojas"). No hay ningún anillo real sembrado (solo el preset).

### (c) El paso `encuadernado_anillado` — declarado, con un bug de lectura

- Familia (`familias.ts:1086-1125`): categoría `encuadernacion_armado`, `M-1`
  (requiere máquina), `T-2`, slot requerido `anillo` (INSUMO_PASO, compat
  `MP.anillo`), multiplicador `hojasPorLibro`, inputs `[cantidad, hojasPorLibro]`,
  output `libros_anillados`, validación `anillo_soporta_hojas` (COMPARE
  `hojasPorLibro <= capacidadMaxHojas`).
- Selección `MENOR_CAPACIDAD_QUE_CUMPLA` (`motor.service.ts:4579-4598`): filtra las
  variantes con `cap >= hojasPorLibro` y elige la de **menor capacidad que
  alcanza**. Correcto conceptualmente.
- Multiplicador `hojasPorLibro` (`motor.service.ts:6077,6093-6099`): escala el
  tiempo/consumo por las hojas del libro (la anilladora perfora hoja por hoja); el
  consumo del anillo es **1 por libro**.
- **BUG a corregir:** la selección lee `capacidadMaxHojas` como campo **top-level**
  de la variante (`motor.service.ts:4589-4593`), pero `cargarVariantePorId`
  (`4690-4742`) **solo aplana `anchoMm`** (4735); el resto queda en
  `atributosVarianteJson`. ⇒ `capacidadMaxHojas` no se lee ⇒ `cap = 0` ⇒ no
  selecciona nada. (La **validación** COMPARE sí lo lee bien desde
  `atributosVarianteJson`, `4883-4887` — por eso valida pero no auto-selecciona.)
  **Fix:** exponer `capacidadMaxHojas` en el objeto de `cargarVariantePorId` (como
  `anchoMm`), o que la rama MENOR_CAPACIDAD lea de `atributosVarianteJson`.
- El criterio (`MENOR_CAPACIDAD_QUE_CUMPLA`), `criterioInputCampo` (`hojasPorLibro`)
  y `criterioMaterialCampo` (`capacidadMaxHojas`) **se configuran a nivel del slot
  del producto** (`ProductoConfigPasoSlotMaterial`, leídos en
  `motor.service.ts:6619-6621` y `7288-7290`), no en la familia.

## 3. Diseño propuesto

### 3.1 Material: el anillo con su capacidad

Ampliar el template `anillado_encuadernacion_v1` con estos `camposTecnicos`:

| Campo | Tipo | Rol |
|---|---|---|
| `tipoAnillo` | enum ESPIRAL_PLASTICO \| WIRE_O \| COMB | Tipo de sistema (matchea el perfil de la máquina) |
| `diametro` | number (mm) | Ya existe |
| `capacidadMaxHojas` | number, **required** | Eje de selección por cantidad de hojas (a gramaje de ref.) |
| `color` | string | Negro/blanco/transparente/etc. |
| `pasoPerforacion` | enum 4:1 \| 3:1 \| 2:1 | Ya está en atributosIniciales; define perforación |
| `largoMm` *(ver decisión)* | number | Largo del anillo = lado encuadernado del documento |

Cada **variante** = un (tipoAnillo, diámetro, color) con su `capacidadMaxHojas`.
La biblioteca a sembrar sale de las tablas de la §1 (espiral plástico 4:1 6–50mm;
Wire-O 3:1 y 2:1; opcionalmente comb). Capacidades **a 80g de referencia**,
editables por el tenant.

### 3.2 Máquina: la anilladora y su perfil

Cargar una máquina `ANILLADORA` (ya soportada) con:
- Capacidades físicas: `anchoUtil` (largo máx que puede anillar, ej. 320mm para
  A4 apaisado / A3), `altoUtil` (Ø máx del anillo).
- Params técnicos: `tiposAnilloSoportados`, `pasosOrificiosSoportados`.
- **Perfil(es) operativo(s)** por tipo de anillo: `productivityValue/Unit`
  (libros/hora o hojas/hora — la anilladora perfora en tandas de N hojas),
  `setupMin`, `cleanupMin`, `tipoAnillo`, `diametrosSoportadosMm`. Es carga de
  datos, no código.

### 3.3 Paso: cerrar `encuadernado_anillado`

1. **Fix del motor:** exponer `capacidadMaxHojas` en `cargarVariantePorId` para que
   `MENOR_CAPACIDAD_QUE_CUMPLA` la lea (o leer de `atributosVarianteJson`). Es el
   único cambio de código imprescindible del lado motor.
2. **Slot del producto:** en el `ProductoConfigPasoSlotMaterial` del paso `anillo`,
   setear `modoSeleccion: MOTOR_ELIGE_AUTO`, `criterioSeleccion:
   MENOR_CAPACIDAD_QUE_CUMPLA`, `criterioInputCampo: hojasPorLibro`,
   `criterioMaterialCampo: capacidadMaxHojas`. Así el motor elige solo el espiral de
   menor diámetro que aguante las hojas del libro.
3. **Consumo/tiempo:** 1 anillo por libro; el tiempo escala por `hojasPorLibro`
   (perforación) — ya modelado.

### 3.4 Integración con el centro de copiado

La terminación **"Anillado"** del TPV deja de ser cosmética: activa el paso opcional
`encuadernado_anillado` en la ruta de la plantilla. El input `hojasPorLibro` = las
**hojas por juego del tomo** (que el centro de copiado ya calcula, ver
`hojasPorLibro` en el service). El motor:
- Valida que el anillo aguante (COMPARE).
- Elige el espiral por capacidad (MENOR_CAPACIDAD_QUE_CUMPLA).
- Suma el costo del anillo (1/libro × juegos) + el tiempo de la anilladora.

Esto también se alinea con el diseño de terminaciones configurables
([centro-copiado-modulo-configurable-diseno.md](centro-copiado-modulo-configurable-diseno.md)):
la terminación "Anillado" mapea a este paso opcional.

## 4. Decisiones abiertas (para el plan técnico de mañana)

1. **Largo del anillo (2º eje de selección).** El anillo debe cubrir el lado
   encuadernado del documento (A4 vertical = 297mm), no solo la capacidad. Opciones:
   (a) variantes por formato (espiral A4, A5, oficio…), (b) un atributo `largoMm` +
   segundo criterio de selección, (c) v1 asume un largo estándar (A4/carta) y se
   ignora hasta gran formato. **Recomiendo (c) para v1** (centro de copiado es
   A4/A3) y (a)/(b) como refinamiento.
2. **Ajuste por gramaje.** La capacidad es a 80g; papel pesado la baja ~15–20%. v1:
   capacidad fija de referencia (el tenant la ajusta). Futuro: factor por gramaje.
3. **Tipos a soportar en v1.** ¿Solo `ESPIRAL_PLASTICO` (lo más común en copy
   center), o también `WIRE_O`/`COMB`? El enum ya tiene los dos primeros; comb
   habría que agregarlo si se quiere.
4. **Biblioteca sembrada vs carga manual.** ¿Sembramos una biblioteca de espirales
   con capacidades default (como los sellos Trodat), o el tenant carga sus
   variantes? Recomiendo **sembrar una biblioteca representativa** editable.
5. **Capacidad como Ø→hojas fijo, o editable por variante.** Recomiendo editable por
   variante (ya que varía por fabricante), con el default de las tablas §1.

## 4.bis Plan técnico v1 (2026-08-03 — confirmado)

> **ESTADO (2026-08-03): IMPLEMENTADO (Etapas A–E), sin commitear.** Motor +
> selector `MENOR_CAPACIDAD_QUE_CUMPLA` (`seleccion-capacidad.ts`), fix del
> multiplicador de material (`hojasPorLibro` es de TIEMPO, no de material),
> biblioteca `ESPIRAL_PLASTICO` (preset + template), provisionador idempotente
> `asegurarPasoAnilladoCC` (agrega el paso opcional a la ruta de CC + lo mete al
> snapshot, self-heal ante rutaPaso recreado), config CC con anilladora, y el
> tomo suma la línea de anillado por **DELTA** (cotización del andamiaje con y sin
> el paso activado, `cantidad = juegos`) con degradación por motivo si ningún
> espiral cubre las hojas. UI: línea de anillado (Ø + precio) bajo el head del
> tomo. Tests: `seleccion-capacidad.spec` (6), `anillo-biblioteca.spec` (5),
> `anillado-provisionar.spec` (3), `anillado-tomo.spec` (4) — 46 CC en verde,
> motor sin regresión (17 fallos pre-existentes por tarifas del test). Datos dev:
> `prisma/install-anilladora-dev.js` (idempotente). Pendiente: commit.
>
> **Descubrimiento clave (Etapa D original):** `DIRECT_FROM_JOBCONTEXT` lee
> `jobContext.cantidad` compartido, así que impresión (hojas) y anillado (juegos)
> no podían co-cotizarse con distinta cantidad → se resolvió primero con un DELTA.
> Y el motor filtra los configPasos por el `id` del snapshot de la RutaVersion: un
> paso fuera del snapshot se excluye silenciosamente (por eso el provisionador lo
> agrega ahí).
>
> **UNIFICACIÓN modelo `juegos` (2026-08-03, reemplaza el DELTA):** El anillado
> pasó a ser un RENGLÓN PROPIO (tanto en tomo como en documento suelto), no una
> resta del preview. Claves:
> - El paso de anillado toma su cantidad de `jobContext.juegos` (libros) vía
>   `mecanismoCantidad: HEREDAR_DEL_OUTPUT_CANONICO` + `{campoOutput:'juegos'}`. Así
>   impresión (`cantidad`=hojas) y anillado (`juegos`) conviven sin pisarse.
> - El ítem de anillado se cotiza con `cantidad=0` (impresión de andamiaje en 0) +
>   `juegos=N` ⇒ sale PURO anillado. Requirió un fix del motor: **área impresa = 0
>   ⇒ 0 consumibles (no error)**; sólo NaN/negativa es error (motor.service.ts).
> - `armarAnillado()` arma el jobContext una sola vez; lo usan el preview
>   (`cotizarAnilladoGrupo`) y el guardado (`construirAnilladoItem` en
>   `construirItems`), así **preview == lo que se cobra**. Sin delta.
> - Suelto: `juegos = copias` (cada copia = 1 libro). Tomo: `juegos = grupo.juegos`.
>   Subtotales de doc/tomo = impresión sola; el anillado suma en los totales.
> - El renglón de anillado lleva `_centroCopiado.esAnillado`; la rehidratación al
>   editar lo saltea (se re-deriva de la terminación).
>
> **Tiempo = T-3 (productividad del PERFIL), en hojas/h:** el paso quedó en `T-3`,
> NO `T-2`. Con `T-2` el motor lee la productividad de los *params del paso*
> (`productividadPropiaEfectiva`), no del perfil de la máquina → el tiempo salía 0.
> `T-3` (motor.service.ts ~2797) usa `paso.perfil.productivityValue`. El tiempo =
> `juegos × hojasPorLibro / productividad`: la productividad se carga en **hojas/h**
> (hojas perforadas por hora), y el multiplicador `hojasPorLibro` escala los libros
> a hojas totales (un libro grueso tarda más). El provisionador **self-heala** T-2→T-3.
>
> **Paridad `agregarAOrden`:** el renglón de anillado también se persiste en el
> camino eager `agregarAOrden` (no sólo en el staging `construirItems` del modal),
> vía `agregarAnilladoItem` (cotizar-y-guardar). Mismo `armarAnillado()` compartido.
>
> **Perfil de la anilladora = SÓLO tiempo:** el motor no lee `diametrosSoportadosMm`
> ni `tipoAnillo` del perfil (se sacó "Diámetros soportados" del form). La capacidad
> (hojas por Ø) vive en la VARIANTE del espiral (`capacidadMaxHojas`, dimensión de
> variante — antes faltaba en `dimensionesVariante` y no se veía en el editor). El
> provisionador elige el perfil real de la anilladora (`perfilAnilladora`, no la
> heurística de la láser) y **self-heala** máquina/perfil/mecanismo si el paso ya
> existía (cargar el perfil DESPUÉS ya no deja el tiempo en 0).


**Alcance v1 confirmado:** sólo `ESPIRAL_PLASTICO`; biblioteca sembrada y editable;
capacidad de referencia a 80g (sin factor por gramaje); largo estándar A4/carta
(sin 2º eje de selección). Wire-O/comb, factor por gramaje y largo-por-formato =
futuro.

Verificado contra el código actual (2026-08-03): los 4 hallazgos siguen vigentes
(bug del motor, template sin `capacidadMaxHojas`, sin biblioteca, ruta de CC sólo
impresión — provisionar-plantilla.ts).

### Etapa A — Fix del motor (capacidadMaxHojas)
`MENOR_CAPACIDAD_QUE_CUMPLA` (motor.service.ts:4640) lee `v[criterioMaterialCampo]`
top-level, pero `cargarVariantePorId` (:4788) sólo aplana `anchoMm`. **Fix general**
(no anillo-específico): en la rama del criterio, leer el campo de
`v.atributosVarianteJson[campo] ?? v[campo]`. Test unitario: dado un set de
variantes con `capacidadMaxHojas` en `atributosVarianteJson`, elige la de menor
capacidad que cubre `hojasPorLibro`.

### Etapa B — Template de material + biblioteca sembrada
1. Ampliar `anillado_encuadernacion_v1` (materia-prima-templates.ts:724):
   `camposTecnicos` += `capacidadMaxHojas` (number, required) + `tipoAnillo`
   (select ESPIRAL_PLASTICO) + `color` (text). Actualizar `dimensionesVariante` /
   `requiredAtributos`.
2. Seed de biblioteca (patrón sellos Trodat): 1 materia prima "Espiral plástico
   4:1" + variantes 6–50mm de la tabla §1, cada una con `capacidadMaxHojas` (80g),
   `tipoAnillo=ESPIRAL_PLASTICO`, `diametro`, `color`, `pasoPerforacion=4:1`.
   Idempotente, editable por el tenant.

### Etapa C — Ruta de CC: paso `encuadernado_anillado` opcional + anilladora
1. **Config**: agregar `CentroCopiadoConfig.maquinaAnilladoraId` (o resolver la
   única ANILLADORA activa) + selector en la config de CC (como color/BN).
2. **Provisionador** (provisionar-plantilla.ts, dentro de la misma tx): agregar un
   2º `rutaPaso` (`encuadernado_anillado`), incluirlo en el snapshot de
   `rutaVersion`, crear un 2º `productoConfigPaso` con `modoActivacion: OPCIONAL`,
   su candidata de máquina ANILLADORA, y su `ProductoConfigPasoSlotMaterial` `anillo`
   con `modoSeleccion: MOTOR_ELIGE_AUTO`, `criterioSeleccion:
   MENOR_CAPACIDAD_QUE_CUMPLA`, `criterioInputCampo: hojasPorLibro`,
   `criterioMaterialCampo: capacidadMaxHojas`, candidatos = variantes de anillo.
3. Self-healing: el provisionador ya es idempotente/race-safe; agregar el paso a
   plantillas ya provisionadas sin romperlas.

### Etapa D — CC activa el anillado (Tomo-A compuesto)
El anillado es **1 por libro**, no por sub-documento. Se resucita el compuesto
Tomo-A (hoy `agregarTomo`/`construirTomo` ya suman sub-docs + concatenan pasos):
- La terminación "Anillado" del tomo activa el paso: `jobContext.opcionalesActivados
  [configPasoId_anillado] = true` + `hojasPorLibro` (que el service ya calcula) +
  `cantidad = juegos`.
- Como un tomo mezcla papeles, la **impresión** se sigue cotizando por sub-doc; el
  **anillado** se cotiza una vez (segmento representativo con el paso activado) y se
  extrae SÓLO el paso `encuadernado_anillado` + el material anillo, sumándolo al
  compuesto del tomo (costo, pasos, precio). Documento suelto = sin anillado.
- Degradación: sin anilladora cargada o sin anillo que cubra las hojas → aviso del
  motor (COMPARE `anillo_soporta_hojas`); el tomo se cotiza sin la línea de anillado
  y se marca el motivo (no rompe la carga).

### Etapa E — Config/UI + verificación
- Config de CC: selector de anilladora + (la terminación "Anillado" ya existe como
  chip; deja de ser cosmética).
- Verificación: unit del fix (A); spec de seed (B); spec del provisionador con 2
  pasos (C); spec del tomo con anillado — costo = impresión + 1 anillo × juegos +
  tiempo anilladora, y selección del Ø correcto por capacidad (D). tsc front+back,
  jest CC+motor, eslint, css:guard, API restart.

### Orden sugerido
A (fix aislado, testeable ya) → B (datos) → C (ruta) → D (integración, la más
gruesa) → E (UI+verif). A y B se pueden hacer y commitear sin tocar CC.

## 5. Qué NO cambia

El motor de costeo, el modal del centro de copiado y el flujo cotización→OT se
reutilizan tal cual. El paso `encuadernado_anillado` ya está declarado; esto lo
**activa** cargando datos (máquina + biblioteca de anillos) y corrigiendo un bug de
lectura, no reescribiendo el motor.

## 6. Resumen del esfuerzo real

- **Código:** 1 fix en el motor (`capacidadMaxHojas` en `cargarVariantePorId`) + 1
  ampliación del template de material (`capacidadMaxHojas`/`tipoAnillo`/`color`) +
  seed de la biblioteca de anillos + wiring del slot del paso en la ruta de la
  plantilla del centro de copiado.
- **Datos:** cargar una anilladora + su perfil; la biblioteca de espirales.
- **Sin tocar:** enum/plantilla de máquina, editor de máquinas, familia del paso, la
  matemática del motor.
