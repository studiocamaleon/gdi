# Viabilidad del modelo universal de costeo — Fase 3: Análisis de fricción

**Fecha:** 2026-04-17
**Fases anteriores:** `fase-1-inventario.md`, `fase-2-mapeo.md`
**Alcance:** Desarrollar las 10 fricciones identificadas en Fase 2 §4. Para cada una: severidad, esfuerzo (talla camisa), estrategia tentativa, dependencias con otras fricciones, riesgos residuales.

---

## Convenciones

**Severidad:**
- **bloqueante** — sin resolverla, la migración no puede empezar.
- **mayor** — requiere diseño nuevo y/o refactor visible.
- **menor** — adición acotada, compatible con lo existente.

**Esfuerzo (talla camisa, semanas-persona):**
- **S** = 1–2 semanas
- **M** = 3–6 semanas
- **L** = 7–12 semanas
- **XL** = 13+ semanas

---

## F1 — Familia de paso como entidad/catálogo

**Qué falta:** Hoy los "tipos" de paso están implícitos en cada motor (no hay enum ni tabla que enumere las 18 familias del modelo universal). El frontend tiene un `productUiRegistry` similar, pero sólo para UI, no para lógica.

**Severidad:** menor.
**Esfuerzo:** S.

**Estrategia tentativa:**
- Catálogo declarativo en código (`apps/api/src/productos-servicios/pasos/familias.ts`) con una entrada por familia. Cada entrada define: `codigo`, `nombre`, `plantillaConfig` (schema JSON), `formulasTiempo` (functions o nombres de formulas predeclaradas), `formulasMaterial`, `preseleccionesDefault`.
- Sumar enum Prisma `PasoFamilia` si queremos validación a nivel DB en `ProcesoOperacion.familia`.
- No hace falta tabla Prisma: es metadata estática, versionada con el código.

**Dependencias:** ninguna.

**Riesgos:**
- Discusión de producto: el listado de 18 familias del modelo universal es provisorio; va a haber presión para añadir/fusionar familias. Mitigación: política de gobernanza (quién aprueba agregar familia).

---

## F2 — Inputs/outputs semánticos del paso

**Qué falta:** Hoy los motores consumen "lo que haya en el contexto" sin declaración formal de qué variables lee cada paso ni qué valores emite. El modelo universal exige declaración explícita (`leeDelTrabajo`, `leeDePasos`, `produce`).

**Severidad:** mayor.
**Esfuerzo:** M.

**Estrategia tentativa:**
- Extender `ProcesoOperacion` (o su JSON de config) con tres campos: `leeDelTrabajo: string[]`, `leeDePasos: string[]`, `produce: string[]`.
- Catálogo de "nombres semánticos canónicos" (ej. `piezasPorPlaca`, `hojasImpresas`, `planchasNecesarias`, `metrosLinealesCortados`) — archivo `apps/api/src/productos-servicios/pasos/outputs-canonicos.ts`. Evita que cada paso invente nombres propios.
- Runtime de paso: el motor expone sólo las variables declaradas al cálculo del paso. Esto obliga a declarar todo lo que se usa y permite validación estática (paso declara `leeDePasos: ['hojasImpresas']` pero ningún paso previo produce ese output → error antes de cotizar).
- Migración gradual: los motores legacy siguen consumiendo contexto libre; los pasos en el modelo nuevo declaran. Validador corre en modo warning primero.

**Dependencias:** habilita F5 (DAG) y F7 (reglas).

**Riesgos:**
- Proliferación de outputs semánticos si no hay curaduría. Mitigación: lista canónica revisada en PR.
- El refactor del runtime para que "sólo exponga lo declarado" puede romper motores existentes si leen variables no declaradas. Mitigación: correr en shadow mode primero.

---

## F3 — Unidad productiva por paso

**Qué falta:** El modelo universal requiere que cada paso declare su unidad productiva (un paso puede operar sobre N letras, M módulos LED, o 1 estructura — no siempre sobre la cantidad pedida).

**Severidad:** menor.
**Esfuerzo:** S.

**Estrategia tentativa:**
- Agregar `unidadProductiva: string` a `ProcesoOperacion` + una fórmula opcional `derivacionUnidad` que calcula la cantidad (por defecto: `trabajo.cantidad`).
- Para pasos de talonario / productos multi-componente, la fórmula puede leer outputs de pasos previos (ej. `hojasImpresas`).

**Dependencias:** ninguna.

**Riesgos:** ninguno significativo.

---

## F4 — Activación (opcional / condicional)

**Qué falta:** Hoy los pasos son "en la ruta = activos siempre". Opcionales existen sólo vía adicionales. No hay condicional puro ("si caras===2 → ejecutar paso X").

**Severidad:** menor.
**Esfuerzo:** S–M.

**Estrategia tentativa:**
- Campo `activacion: 'obligatoria' | 'opcional' | 'condicional'` en `ProcesoOperacion`.
- Si `condicional`: campo `condicion: ExpresionJSON` evaluada por el engine contra Job Context + outputs previos.
- Mini-DSL de expresiones (JsonLogic o similar) — compuerta híbrida como la que ya acordamos en el modelo (F5 de modelo universal).
- Los adicionales ya modelan `opcional` vía `ProductoAdicionalCatalogo` → `ProductoAdicionalRouteEffectPaso`. Se unifica bajo el mismo campo `activacion`.

**Dependencias:** F2 (inputs) — la condición lee inputs semánticos.

**Riesgos:**
- Elección del DSL de expresiones es decisión de producto (quedó abierta en el modelo universal). Recomendación: arrancar con JsonLogic porque es JSON, es debuggeable, y hay libs maduras; evaluar si se queda corto después.

---

## F5 — Ruta como DAG

**Qué falta:** Hoy `ProcesoOperacion.orden` presupone lista lineal. El modelo universal requiere grafo acíclico dirigido para soportar pasos paralelos que convergen (cartelería iluminada, wrap vehicular, DTF textil).

**Severidad:** mayor (cambio de modelo mental + UI).
**Esfuerzo:** L (incluye UI editor).

**Estrategia tentativa:**
- Tabla nueva `ProcesoOperacionDependencia` con `(operacionId, dependeDeOperacionId, outputEsperado)`. Aditiva, no rompe.
- Mantener `orden` para compatibilidad: si una ruta no tiene dependencias declaradas, el engine resuelve por `orden` (lineal). Si tiene dependencias, resuelve por topological sort.
- Convivencia indefinida: rutas simples siguen usando `orden`; rutas con bifurcación usan deps.
- UI editor: ver F8 (spike separado).

**Dependencias:** F2 (outputs semánticos para declarar qué espera cada dependencia).

**Riesgos:**
- Validación de aciclicidad: cualquier ciclo accidental rompe el sort. Mitigación: validador en upsert que rechace ciclos.
- UI/UX de ruta bifurcada es compleja para operadores acostumbrados a lista. Mitigación: mantener vista lista como default, habilitar vista grafo sólo cuando la ruta lo requiere (F8).

---

## F6 — Productos componentes

**Qué falta:** No existe la noción de que un material consumido por un paso sea una instancia de otro producto con su propia ruta. Caso canónico: tapa dura de un libro.

**Severidad:** mayor (concepto nuevo).
**Esfuerzo:** M.

**Estrategia tentativa:**
- Flag booleano `esComponente: boolean` en `ProductoServicio`. Por defecto `false`.
- Un producto con `esComponente=true` puede ser consumido como material desde un paso. Se modela como variante especial de `ProcesoOperacionConsumoMaterial` que apunta a `ProductoServicioId` en vez de `MateriaPrimaVarianteId`.
- Al cotizar: cuando un paso consume un producto componente, el engine invoca recursivamente `quoteProducto` para obtener el costo de la instancia. El total resultante se agrega al bucket `materiasPrimas` del paso padre, con trazabilidad del sub-producto.
- Validación: prohibir ciclos (un componente no puede contener un producto que lo contiene). Es el mismo validador de aciclicidad que F5.

**Dependencias:** F5 (el cálculo recursivo del sub-producto asume DAG y outputs).

**Riesgos:**
- Performance: cotizar un producto con 3 niveles de componentes puede costar 3× más. Mitigación: cache memoizada por snapshot.
- UI para navegar productos padre ↔ componentes. Decisión de producto — no urgente en F3.

---

## F7 — Regla de Selección generalizada

**Qué falta:** Hoy existe `ProductoChecklistRegla` + `ProductoChecklistReglaNivel`, pero acopladas al flujo del checklist. El modelo universal requiere que las reglas puedan decidir sobre material, centro de costo, activación de paso, valor de parámetro — y que sean independientes del checklist.

**Severidad:** mayor (concepto central del modelo).
**Esfuerzo:** M–L.

**Estrategia tentativa:**
- Entidad nueva `ReglaDeSeleccion` con columnas: `dominio` (enum: `material`, `centroCosto`, `variante`, `activacion`, `parametro`), `targetRef` (id de la cosa sobre la que decide), `inputs: string[]` (variables del Job Context/outputs previos), `casos: Array<{condicion, decision}>`, `default`.
- Construir en paralelo a `ProductoChecklistRegla` (no reemplazar). Las dos conviven; `ProductoChecklistRegla` se mantiene para el flujo de checklist existente y se migra caso por caso a `ReglaDeSeleccion` si hace falta independizar.
- Evaluador de reglas unificado: `evaluarRegla(regla, jobContext, outputsPrevios) → decision`. Reutiliza el mini-DSL de F4.
- UI de autoría: tabla editable (dominio + inputs + casos). Puede ser básica al principio; iterar según uso real.

**Dependencias:** F2 (inputs semánticos para que las reglas puedan referenciarlos).

**Riesgos:**
- Duplicación temporal de reglas (ChecklistRegla + ReglaDeSeleccion). Mitigación: política explícita de cuándo usar una u otra; eventualmente unificar en una tercera fase.
- Performance de evaluación masiva (muchas reglas × muchas cotizaciones). Mitigación: cachear evaluaciones deterministas.

---

## F8 — Editor visual de grafo

**Qué falta:** UI para armar ruta como DAG arrastrando y conectando pasos. Hoy la config es lista + formularios por tab.

**Severidad:** menor técnicamente / mayor UX.
**Esfuerzo:** L (spike + iteración).

**Estrategia tentativa:**
- Spike técnico con **React Flow / XyFlow** (mainstream, MIT, activo). Alternativa: Rete.js (más orientado a node-based engines, curva más pronunciada).
- Página dedicada "Editor de ruta (nuevo)" que coexiste con el editor lista actual. Primero read-only (visualiza rutas existentes como grafo), después editable.
- Output: serialización a las mismas entidades Prisma (`ProcesoOperacion` + `ProcesoOperacionDependencia`). No introduce datos nuevos — sólo nueva forma de editarlos.
- Mantener la vista lista como default inicial; activar vista grafo para productos que usen DAG.

**Dependencias:** F5 (DAG) es prerrequisito de dato.

**Riesgos:**
- Subestimar el trabajo de UX (zoom, pan, snapping, validación visual de dependencias, edición inline de paso). Mitigación: fase 1 es read-only para limitar scope.

---

## F9 — Cobertura de tests (golden-output suite)

**Qué falta:** Los 4 métodos activos `quote*Variant` (digital, rigid-printed, talonario, vinyl-cut) **no tienen tests unitarios**. Sin red de seguridad, migrar motores a ciegas es inviable.

**Severidad:** **bloqueante**.
**Esfuerzo:** M (grande pero acotado).

**Estrategia tentativa:**
- Por cada motor activo, seleccionar 5–10 variantes representativas (producto real + variante + cantidad + opciones). Total ~20–40 casos.
- Correr el motor actual contra cada caso → guardar `resultado.json` como golden snapshot.
- Agregar test que fija el snapshot: `expect(quoteDigitalVariant(input)).toMatchSnapshot(goldenFile)`.
- Cualquier cambio al motor debe regenerar snapshots con diff visible (revisado en PR).
- Herramientas: Jest ya está configurado en `apps/api/package.json`; snapshots nativos de Jest alcanzan.
- Incluir casos borde: cantidades pequeñas/grandes, adicionales activados, checklist con y sin respuestas, múltiples variantes.

**Dependencias:** ninguna crítica; se construye **antes** de tocar cualquier motor.

**Riesgos:**
- Elegir casos no representativos → falsa seguridad. Mitigación: el dueño del sistema (vos) valida la selección de casos con conocimiento del negocio.
- Snapshots flaky si hay `Date.now()` o randomness. Mitigación: auditar motores para detectar no-determinismo.

---

## F10 — Dos shapes de resultado divergentes (unificación de salida)

**Qué falta:** El frontend hoy consume dos contratos incompatibles:
- `CotizacionProductoVariante` (digital, talonario, rigid-printed, vinyl-cut) — bloques + subtotales
- `GranFormatoCostosResponse` (wide-format) — resumenTecnico + gruposTrabajo + nestingPreview + candidatos + mutacionesAplicadas

El modelo universal unifica en la salida canónica (§7 del modelo).

**Severidad:** mayor.
**Esfuerzo:** L (rework de UI + introducción de nuevo endpoint).

**Estrategia tentativa:**
- Nuevo endpoint `POST /productos-servicios/variantes/:id/cotizar-v2` que emite la shape canónica (`total`, `unitario`, `subtotales: {centroCosto, materiasPrimas, cargosFlat}`, `pasos[]`, `subProductos[]`). Los motores v1 siguen respondiendo por `/cotizar`.
- Nueva UI "Simular costo (v2)" agnóstica del motor, que consume v2. Convive con los tabs legacy (`digital-simular-costo-tab`, `wide-format-simular-costo-tab`) hasta que la migración pase cada motor a v2.
- Los consumers comerciales (`producto-simular-venta-tab.tsx`) que ya leen `costoTotal` agregado sobreviven sin cambios.
- Adapter de compatibilidad: para productos no migrados aún, un motor puede exponer tanto v1 como v2 (v2 calcula a partir de v1 por mapeo inverso de Fase 2 §2.2).

**Dependencias:** F1, F2, F5, F7 (todos los cimientos del modelo universal deben estar presentes para emitir la shape canónica correcta).

**Riesgos:**
- Mantener dos UIs en paralelo genera drift. Mitigación: política de "no features nuevos en UI v1"; todos los cambios van a v2.
- Los consumidores de `CotizacionProductoSnapshot.resultadoJson` leyendo snapshots v1 vs v2 mezclados. Mitigación: el campo `motorVersion` discrimina; v1 se lee con adapter legacy, v2 directo.

---

## Matriz resumen de fricciones

| # | Fricción | Severidad | Esfuerzo | Dependencias de | Habilita |
|---|---|---|---|---|---|
| F9 | Tests (golden suite) | **bloqueante** | M | — | todas las demás |
| F1 | Familia de paso | menor | S | — | F10 |
| F3 | Unidad productiva | menor | S | — | F2 parcialmente |
| F2 | Inputs/outputs semánticos | mayor | M | — | F4, F5, F7 |
| F4 | Activación condicional | menor | S–M | F2 | F7 |
| F5 | Ruta como DAG | mayor | L | F2 | F6, F8, F10 |
| F7 | Regla de Selección generalizada | mayor | M–L | F2 | F10 |
| F6 | Productos componentes | mayor | M | F5 | F10 |
| F8 | Editor visual de grafo | menor técnico / mayor UX | L | F5 | — |
| F10 | Shape de resultado unificada | mayor | L | F1, F2, F5, F7 | — |

### Orden natural de ataque (derivado de dependencias)

```
Nivel 0 (sin deps, paralelizable):
  F9 Tests  │  F1 Familia  │  F3 Unidad productiva

Nivel 1 (apoya en F2):
  F2 Inputs/outputs semánticos

Nivel 2 (apoya en F2):
  F4 Activación  │  F5 DAG  │  F7 Reglas de selección

Nivel 3 (apoya en F5 y/o F7):
  F6 Productos componentes  │  F8 Editor visual

Nivel 4 (cierra el bucle):
  F10 Shape de resultado unificada

```

---

## Estimación gruesa de esfuerzo total

Sumando tallas con puntos medios (S=1.5, M=4.5, L=9.5):

- F1 (S) + F3 (S) = 3
- F9 (M) + F2 (M) + F4 (S-M, 3) + F6 (M) + F7 (M-L, 7) = 22
- F5 (L) + F8 (L) + F10 (L) = 28.5

**Total: ~53 semanas-persona de esfuerzo directo**, con paralelización posible en los niveles 0 y 2, más los sub-proyectos de cada nivel. Traducido a cronograma con 1 persona full-time: ~12–14 meses. Con 2 personas coordinadas: ~7–8 meses.

Esto es estimación gruesa y no incluye: (a) migración de datos históricos, (b) capacitación/onboarding de usuarios al nuevo editor, (c) cutover y decommission de motores legacy. Esos se cuantifican en Fase 5.

---

## Veredicto actualizado

**No aparecieron fricciones rojas.** Todas tienen estrategia razonable y dependencias manejables. Las dos más pesadas (F5 DAG y F10 shape unificada) son rework programado, no problemas conceptuales.

**Lo único que realmente condiciona arrancar:** F9 (tests). Sin ella no se puede validar que la migración preserva el comportamiento actual. Es el primer entregable del roadmap.

**Confirmo veredicto preliminar:** VIABLE, con F9 como prerrequisito duro y F5/F10 como los hitos más costosos.

---

## Siguiente paso — Fase 4: Análisis del ecosistema

La Fase 3 analizó el módulo de costeo en sí. Fase 4 analiza su **entorno**: qué módulos dependen de las salidas de cotización (órdenes, facturación, inventario, reportes), qué datos históricos hay que preservar, qué integraciones externas. Cambios de blast radius que Fase 1 descartó sin evidencia exhaustiva.

Salida: `docs/viabilidad-modelo-universal-fase-4-ecosistema.md`.
