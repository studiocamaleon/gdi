# El TIEMPO de un paso — análisis, taxonomía nueva y plan de implementación

> **Estado**: ANÁLISIS CERRADO (2026-08-11) · **F1+F2+F3 parcial
> IMPLEMENTADAS el mismo día** (re-skin del guiado: árbol ①②③+⑤, paneles
> máquina/primitiva, capa comercial 3 estados, pendiente de "Puede" sin
> número; goldens 7/7 y 152/152 idénticos). Decisiones F0 tomadas con
> defaults reversibles: F0.1 "Lo definís vos/Lo dice la máquina" · F0.2 sí
> · F0.3 sí (escritura normaliza a T-1 donde el menú lo permite) · F0.4 el
> base es la sugerencia (defaultMin queda como override visible) · F0.5
> pseudo-batch se muestra honesto con equivalencia "(≈ N/h)" en el
> resumen. F4 (motor) sigue SIN implementar, gated.
> Método: inventario verificado línea por línea contra
> `motor.service.ts` (calcularTiempo L2927+, resolverTiempoManualMin) — sin
> supuestos. Contexto hermano: [cantidad-pasos-mecanismos.md](cantidad-pasos-mecanismos.md).

## 1. El modelo de costos del paso (el marco)

```
costo del paso = COSTO DE TIEMPO + COSTO DE MATERIALES + cargos opcionales
costo de tiempo = (setup + run + cleanup + recargas) × tarifa del centro
                  × (dotación de operarios, SÓLO si no hay máquina)
```

Los "4 mecanismos de cantidad" (Directo/Hereda/Calcula/Convierte) producen
la cantidad del paso, que es **el ancla default de la magnitud del run** —
no la única (ver §3.④).

## 2. Inventario verificado del RUN — las 8 vías reales

Precedencia en `calcularTiempo`:

| # | Vía | Fórmula / fuente | Etiqueta actual |
|---|---|---|---|
| 0 | **Tiempo manual del comercial** | `tiempoManualMin_<paso>` del contexto; config `tiempoManual{habilitado,obligatorio}`; **gana sobre CUALQUIER modo**; anula el fijo, suma setup/cleanup | transversal ("T-4") |
| 1 | Tiempo fijo | `tiempoFijoOverrideMin` (paso) → `tiempoFijoMin` (familia) | T-1 |
| 2 | Horas estimadas | `params.horasEstimadas` × 60 — **absoluto, no productividad** | T-2 (¡mal ubicada!) |
| 3 | Horas de un campo del contexto | `jobContext[params.campoHorasJobContext]` — override runtime | T-2 (avanzada) |
| 4 | Ritmo por tandas | `batchTimeMin × ⌈cantidad ÷ batchSize⌉` | T-2 `batch_time` |
| 5 | Ritmo por unidad | `magnitud operativa ÷ productividad/h` | T-2 `productivity` |
| 6 | Perfil de máquina | productividad del perfil sobre SU unidad (ppm→pliegos con factor A4-equiv; m²/h→m² del nesting) + `feedReloadMin` | T-3 |
| 7 | Primitiva del oficio | código registrado que reemplaza la fórmula (guillotina: `tandas × cortesPorTanda × seg/corte + recargas`) | T-3 (`primitivas.tiempoRun`) |

**La magnitud operativa** (vías 4-5) se elige entre: la cantidad del
mecanismo · una magnitud del derivador (cortes, soldaduras) · el
`magnitudTiempoDefault` de la familia (montaje: piezas montadas) · una
magnitud heredada. UI actual: "¿Sobre cuántas piezas trabaja?" / inline con
el ritmo.

**Transversales**: setup/cleanup (override paso → perfil → familia;
omitibles por decisión comercial) · multiplicadores (caras) sobre la
magnitud · dotación (multiplica el costo SÓLO sin máquina — coherente con
"la MO no se cobra sobre runtime de máquina").

**Precisión verificada al implementar (L2959-2967)**: `tiempoFijoMin` es
**ADITIVO en TODOS los modos** — en T-1 es el único término (runMin = 0),
pero bajo T-2/T-3 también se suma al run. Consecuencia práctica: al pasar
un paso de Fijo a Ritmo hay que limpiar `tiempoFijoOverrideMin`, o cuenta
doble (la UI nueva lo hace). También habilita el combo legítimo "fijo de
familia + ritmo" vía defaults.

## 3. El hallazgo: 4 etiquetas, 2 ejes mezclados

Las anomalías que el desglose dejó a la vista:

1. **T-4 no existe como rama** — es una etiqueta del enum cuya maquinaria
   real es el override transversal `tiempoManual`. El enum sólo se usa en un
   gate de validación (no exigir centro).
2. **`horasEstimadas` es un tiempo ABSOLUTO escondido dentro de
   "productividad"** — semánticamente es T-1 con otro nombre.
3. **"Lo dice el comercial" existe tres veces**: etiqueta T-4, config
   `tiempoManual`, y `campoHorasJobContext`.
4. **La primitiva (plan de trabajo) vive bajo "máquina"** aunque el reloj lo
   define el plan, no la velocidad del fierro.

Los ejes reales son **¿quién define el reloj?** (modelador / máquina, con el
comercial como CAPA) × **¿tiempo dicho o ritmo calculado?**.

## 4. La taxonomía nueva (validada con el usuario)

```
① ¿De dónde sale el tiempo base?
   ├─ Lo declaro yo (el taller)
   │    └─ ② ¿Tiempo fijo o variable?
   │         ├─ FIJO     → "tarda [N] [min|horas]"     (absorbe T-1 + horasEstimadas)
   │         └─ VARIABLE → ③ LA REGLA, una oración horizontal:
   │              "[N] [magnitud ▾] cada [T] [min|h ▾]" — SIEMPRE proporcional
   │              exacto (decisión del usuario, 3ª iteración: nada de
   │              tandas/bloques; la regla ES cómo escala el tiempo).
   │              (2ª iteración: "Productividad por hora" y "Tiempo por lote"
   │               eran la MISMA oración — el tipo de ritmo sobró. El selector
   │               de magnitud UNIFICA los dos menús viejos: elegir "cantidad
   │               pedida/heredada/calculada" resuelve el mecanismo; elegir
   │               "m²/perímetro" deja el mecanismo aparte, que reaparece abajo
   │               como "La cantidad del paso" sólo en ese caso — respuesta a
   │               "¿'El ritmo cuenta' y 'se multiplica por' no es lo mismo?":
   │               no, pero la UI las duplicaba cuando la magnitud era la
   │               cantidad.)
   │              Storage: SIEMPRE productivity (N×60÷Tmin, se re-expresa por
   │              hora). Las configs legacy en batch_time se LEEN tal cual
   │              (el motor les sigue redondeando a tandas) y se normalizan a
   │              proporcional al primer edit. PENDIENTE (decisión aparte,
   │              cambia centavos + re-baseline de goldens): migrar los
   │              batch_time guardados a productivity y retirar la vía del
   │              motor.
   └─ Lo dice la máquina (su perfil)
        └─ sin perillas: panel informativo (perfil + su unidad);
           con primitiva → panel que EXPLICA el plan (guillotina)

⑤ CAPA (no rama): ¿el comercial puede ajustarlo al cotizar?
   ○ No   ○ Puede (el base queda de sugerencia)   ○ Debe (sin su tiempo no cotiza)
```

Regla de diseño transversal (misma que materiales/geometría): **perilla sólo
donde el modelador decide; donde decide otro (máquina, plan, geometría), un
panel que explica**.

**Cards del eje (4ª iteración con el usuario, 2026-08-11)**: "Dónde se
hace" (centro productivo + operarios que ejecutan el paso) es CARD PROPIA —
define quién/dónde ejecuta y la tarifa, no el reloj. El eje de tiempo pasó a
llamarse **"Tiempo que consume"**, simétrico con "Materiales que consume"
(el modelo de dos costos del paso, §1). Los **operarios se OCULTAN en pasos
con máquina** (elegida o candidatas): la perilla es inerte en el motor —
`tarifa × (tieneMáquina ? 1 : dotación)` — y mostrarla en pasos dominados
por máquina era inconsistente (5ª iteración). En "Qué paso es", "Quién lo
hace" pasó a ser "¿Es un paso tercerizado a otro proveedor?" con No/Sí.

**Paso comandado por máquina (6ª iteración)**: "Tiempo que consume" muestra
SOLO el panel informativo + preparación/limpieza. Se ocultan "Sobre qué
cantidad se aplica" y la capa comercial (lo define la máquina; la capa
legacy con tiempoManual guardado sigue visible para apagarla — ojo: si el
caso láser-RIP vuelve a necesitar tiempo del comercial en un paso T-3,
habrá que reabrir esta decisión). El panel NO nombra el perfil ni su
velocidad: el perfil del paso es un default y el motor suele elegir otro
compatible según material/modo de color — nombrarlo lo hacía parecer fijo.
Arrastre ("Enciende también estos pasos"): sólo ofrece destinos
opcionales/condicionales (un OBLIGATORIO corre igual; un NO_EJECUTAR
nunca); sin candidatos, la sección se oculta; sin selecciones, sin
contador "ninguno".

**Derivado del análisis del perfil (2026-08-11): perfil default POR MODO de
color** — hallazgo del usuario: un solo "Perfil por defecto" con varios
modos habilitados deja a los modos no-default sin desempate (caían a
`candidatos[0]`, orden de carga — el mismo pozo del fix CMYK, a medias
tapado). Implementado ADITIVO: columna `perfilDefaultPorModoJson` en la
candidata (migración 20260811231925), DTO+persistencia con saneo, el mapa
viaja con la máquina activa (`resolverMaquinaM2`) y gana en el desempate de
`resolverPerfil` (antes del default global; sin mapa, cadena idéntica —
goldens 7/7 y 152/152 intactos; spec seleccion-perfil-por-modo 6/6). UI:
selects "Perfil para <modo>" en la candidata sólo cuando hay ≥2 modos
habilitados y el modo tiene ≥2 perfiles. Nota del mismo análisis: en
familias con primitiva de selección (impresión por hoja: cadena
caras→gramaje; guillotina: escalón) el perfil es AUTOMÁTICO y el default es
sólo respaldo — el mapa no aplica ahí (la primitiva decide antes).

**7ª iteración — principio "sólo lo que el modelador configura"**: la card
"Dónde se hace" DESAPARECE entera en pasos con máquina (el centro lo pone
la máquina, los operarios no aplican). El arrastre sólo se ofrece cuando la
activación de ESTE paso es condicional (OPCIONAL/CONDICIONAL) — en un paso
"Siempre", arrastrar equivale a poner los destinos en "Siempre" (revierte
H-7 como decisión de producto; el motor sigue arrastrando desde
obligatorios legacy, y esas selecciones se muestran para limpiarlas).
"¿Es un paso tercerizado…?" se acortó a "Es tercerizado" (No/Sí, No
default).

### El journey por casos reales

- **Diseño gráfico**: Yo → Fijo → "2 horas" (hoy: dos formas duplicadas).
- **Soldadura**: Yo → Ritmo por unidad → "6 *puntos de soldadura* /h".
- **Anilladora**: Yo → Ritmo por tanda → "5 min por tanda de 10".
- **Impresión UV**: Máquina → panel: "Perfil CMYK 4-pass · 7 m²/h sobre los
  m² del acomodo".
- **Guillotina**: Máquina → panel del plan: "tandas (pliegos ÷ 250 por
  tanda según gramaje) × cortes del plan × 3 seg + recarga".
- **Corte láser complejo**: Máquina (o Fijo de referencia) + capa **Debe** →
  el sheet exige el tiempo del comercial.

## 5. Validación contra productos reales (2026-08-11)

Se leyó la config vigente (alternativa preferida, versión de ruta actual) de
seis productos del tenant demo y se tradujo cada paso al árbol. **Los 29
pasos entran en las tres preguntas + capa, sin excepciones.** Lectura
condensada (⏱ tiempo · ⑤ capa comercial):

| Producto · paso | Lectura con el árbol |
|---|---|
| Tarjetas · Diseño | Yo → FIJO 30 min · ⑤ PUEDE (sugerencia 15, 5–600) ⚠ dos defaults |
| Tarjetas · Pre-prensa | Yo → FIJO 10 min |
| Tarjetas/Folletos/Imanes · Impresión | Máquina → ppm del perfil sobre pliegos del acomodo |
| Tarjetas/Imanes · Laminado | Máquina → perfil sobre film acomodado (shelf-rollo) |
| Tarjetas/Folletos · Guillotina | Máquina → PLAN (primitiva): tandas × cortes × seg |
| Folletos · Diseño | Yo → FIJO 30 · ⑤ NO (sin tiempoManual) |
| Folletos · Laminado | NO_EJECUTAR → el árbol ni aparece (gate ejecutable) |
| Imanes · Montaje sobre imán | Yo → TANDA: 1 min por tanda de 3 pliegos montados — batch GENUINO |
| Imanes · Corte manual | Yo → TANDA: 5 min por tanda de 2 |
| Backlight · Estructura (tercerizada) | Yo → RITMO 14 unid/h sobre CORTES (magnitud del derivador) |
| Backlight · Soldadura | Yo → RITMO 6 piezas/h sobre puntos heredados |
| Backlight · Pintura | Yo → RITMO 10 piezas/h |
| Backlight · Impresión lona | Máquina (m²/h) |
| Backlight · Chapa trasera | Yo → RITMO 2 unid/h sobre piezas montadas |
| Backlight · Iluminación LED | Yo → RITMO 40 piezas/h sobre módulos (derivada) |
| Backlight · Tensado | Yo → RITMO 30 ml/h sobre perímetro de lados con demasía |
| Backlight · Cenefas | Yo → RITMO 4 piezas/h |
| PVC/DTF · Refilado | Yo → "TANDA: 1 min por tanda de 1" sobre metros de perímetro ⚠⚠ |
| DTF · Impresión | Máquina + setup pisado a 3 min |

### Hallazgos que sólo los datos reales mostraron

1. **El pseudo-batch del refilado** (`batchSize: 1, batchTimeMin: 1` sobre
   `perimetro_piezas_m`, repetido en ~17 configs de la ruta compartida): el
   modelador quería "60 ml/h" (ritmo por unidad) y lo disfrazó de tanda
   porque era la perilla disponible. La taxonomía confusa YA genera configs
   confusas en producción. Ojo al migrar la lectura: batch(1,1) redondea la
   magnitud hacia arriba (⌈18,3⌉ = 19 min) y el ritmo puro no (18,3 min) —
   no es 100% equivalente, ver F0.5.
2. **Doble default en Diseño de Tarjetas**: FIJO 30 min conviviendo con
   `tiempoManual.defaultMin: 15`. Dos números compitiendo por ser "la
   sugerencia" → decisión F0.4.
3. **Tres relojes apilados** en un paso hermano de la ruta PVC/DTF
   ("Grabado Láser" de otro producto): `batch_time` + `horasEstimadas: 6` +
   `tiempoManual obligatorio` a la vez. Gana el manual, el batch es
   fallback, las 6 h son letra muerta. Ilegible sin conocer las
   precedencias → la escritura nueva debe impedir apilar (F1).
4. El gate `esConfigPasoEjecutable` (NO_EJECUTAR) funciona como se diseñó:
   ni config ni árbol.
5. La prueba en vivo de la Regla 2 quedó guardada: slot `anclaje` del
   Backlight con "4 × cantidad pedida" pisando la geometría (revisar si
   era sólo un test).

## 6. Plan de implementación técnica (para otra sesión)

**Principio rector: re-skin del guiado; `calcularTiempo` NO se toca** (salvo
F4, que requiere decisión). Todo lo nuevo es mapping de lectura/escritura
sobre los campos existentes → golden cartelería 7/7 y genérico 152/152
deben quedar IDÉNTICOS.

### F0 — Decisiones previas (con el usuario)
1. Naming de ① : "Lo declaro yo / Lo dice la máquina" vs otro fraseo.
2. ¿La capa ⑤ "Puede" muestra el tiempo base como sugerencia editable en el
   sheet? (hoy tiempoManual no-obligatorio ya lo permite — es sólo UI).
3. ¿Deprecamos la ESCRITURA de `horasEstimadas` (la lectura queda por
   compat) normalizando a T-1 + `tiempoFijoOverrideMin`?
4. **Doble default de la capa "Puede"** (caso real: Diseño de Tarjetas,
   fijo 30 + defaultMin 15): la sugerencia que ve el comercial debe ser EL
   tiempo base (un solo número). ¿`defaultMin` se deprecia o se mantiene
   como override explícito de la sugerencia?
5. **Pseudo-batch** (caso real: Refilado, batch 1×1 min ≈ 60 ml/h): ¿la UI
   los muestra tal cual ("1 min por tanda de 1") u ofrece conversión a
   ritmo con un click? No convertir en silencio: batch redondea la magnitud
   a tandas enteras (⌈18,3⌉=19 min) y el ritmo no — cambia centavos.

### F1 — Re-skin del eje "Cuánto tarda" en el guiado
- Archivo: `src/lib/editor-paso/schema.ts` (sección tiempo, preguntas
  `tiempo.*`) + componentes en `config-pasos-editor-view.tsx`.
- Pregunta ① nueva (bifurcación estilo "Quién lo hace"): deriva de
  `modoTiempo`: T-3 → "máquina"; T-1/T-2 → "yo". Escribe `modoTiempo`.
- Pregunta ② (si "yo"): Fijo ↔ Ritmo. LECTURA: T-1 → fijo; T-2 con
  `horasEstimadas` → **fijo** (mostrando horas; origen "config");
  T-2 resto → ritmo. ESCRITURA: fijo → `modoTiempo: T-1` +
  `tiempoFijoOverrideMin` (convertir horas→min); ritmo → `T-2`.
- Pregunta ③: `timeCalculationMode` productivity ↔ batch (controles
  actuales `ritmo-productividad` / `ritmo-batch` se reusan).
- ④: el selector de magnitud existente (inline) se mantiene tal cual.
- Capa ⑤: control nuevo de 3 estados que escribe
  `paramsPasoJson.tiempoManual = {habilitado, obligatorio}` (No = borrar la
  config). LECTURA legacy: `modoTiempo === 'T-4'` se muestra como capa
  "Debe" con base fija (y ya no se ofrece T-4 como modo).
- **La escritura nueva no permite apilar relojes** (caso real "Grabado
  Láser"): al guardar un camino del árbol se LIMPIAN los campos de los
  otros (`horasEstimadas` si el modo es ritmo, `batchTimeMin/batchSize` si
  es fijo, etc.). La lectura de configs viejas apiladas muestra el reloj
  que gana según la precedencia real y un aviso de config ambigua.
- `campoHorasJobContext`: se muestra sólo si ya está seteado o bajo un
  "avanzado" colapsado.

### F2 — Paneles informativos (patrón `consumo-formula`)
- "Máquina": panel read-only con perfil default + unidad de productividad +
  setup/recargas del perfil; link a Maquinaria.
- Familia con `primitivas.tiempoRun` (guillotina): panel que narra la
  fórmula con los valores del perfil (`pliegosMaxPorTanda`,
  `tiempoPorCorteSeg`) — cero perillas.
- Componente nuevo (id p.ej. `tiempo-origen`) registrado en el switch de
  `renderComponente` como los existentes.

### F3 — Consistencia y limpieza declarativa
- `modosTiempoSoportados` por familia: auditar como hicimos con
  pintura/montaje/pre-prensa (¿quién soporta de verdad T-1?; T-4 sale de
  los menús — la capa lo reemplaza).
- `pendientes-paso.ts`: los pendientes de ritmo/tiempo_fijo se re-frasean
  con el árbol nuevo (mismos triggers).

### F4 — (Opcional, decisión aparte) Normalización del motor
- Unificar la lectura de `horasEstimadas` dentro de T-1 y deprecar la vía 2;
  eliminar `'T-4'` del enum (migración de datos: los T-4 existentes →
  T-1/T-2 + tiempoManual obligatorio). SOLO si se acepta tocar
  `calcularTiempo`; el re-skin NO lo necesita.

### Verificación (obligatoria en cada fase)
- Golden cartelería + genérico ANTES/DESPUÉS: idénticos al centavo (es
  re-skin). Si algo se mueve, hay un bug de mapping.
- `npx vitest run src/lib` (schema.test cubre resúmenes del eje tiempo —
  actualizar expectativas de texto).
- E2E de escritura: guardar un paso por cada camino del árbol y releer
  (round-trip sin pérdida); un paso legacy con `horasEstimadas` y uno T-4
  se muestran correctos sin re-guardar.

### Fuera de alcance de este plan
- Materiales (análisis hermano en curso, mismo lente).
- Tocar precedencias de `calcularTiempo` (F4 es la única excepción, gated).

## 7. Preguntas abiertas
1. F0.1-F0.5 (arriba).
2. ¿La dotación merece perilla visible en el árbol (hoy vive aparte) o queda
   donde está?
3. ¿"Por tanda" merece ejemplos por familia (anilladora vs horno) en la
   ayuda?
