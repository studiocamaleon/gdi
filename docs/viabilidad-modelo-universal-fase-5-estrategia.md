# Viabilidad del modelo universal de costeo — Fase 5: Estrategia de migración

**Fecha:** 2026-04-17
**Fases anteriores:** `fase-1-inventario.md`, `fase-2-mapeo.md`, `fase-3-fricciones.md`, `fase-4-ecosistema.md`
**Alcance:** Diseñar cómo ejecutar el refactor sin romper producción. No es un plan de implementación aprobado — es la estrategia que se aplicaría cuando se decida avanzar.

---

## 1. Preguntas abiertas de fases anteriores, resueltas

**¿Las propuestas comerciales persisten la cotización en DB?**
**No.** El archivo `src/lib/propuestas.ts` usa mocks (`MOCK_CLIENTES`, `MOCK_VENDEDOR`, etc.). No existe modelo Prisma `Propuesta`, no hay servicio ni controller backend de propuestas. El módulo comercial/propuestas es **UI mock-only hoy**. Cuando se persistan a futuro (probable), será greenfield y podrán adoptar directamente el shape v2.

**Consecuencia:** el blast radius del frontend comercial sigue siendo real (componentes acoplados al shape), pero **no hay migración de datos históricos de propuestas**. Un problema menos.

**¿Volumen real de `CotizacionProductoSnapshot` en DB viva?**
**Pendiente.** Requiere query a la DB de producción. No obstructivo: la estrategia se diseña para cualquier volumen (convivencia v1/v2 vía `motorVersion`).

---

## 2. Principios rectores

La estrategia se apoya en 5 principios que ordenan las decisiones cuando hay tensión:

1. **Reversibilidad.** Cualquier cambio que hacemos tiene que poder desactivarse rápido. Feature flags, endpoints v2 en paralelo a v1, convivencia de datos.
2. **Convivencia antes que cut-over.** Los motores v1 siguen corriendo sin cambios mientras se construye v2 al lado. Nada se apaga hasta que lo nuevo esté validado.
3. **Validación objetiva antes que subjetiva.** Golden-output snapshots comparan v1 vs v2 número por número. Nada depende de "parece que funciona".
4. **Migración producto por producto.** No se migran motores enteros de golpe — se migra una variante a la vez, con rollback por fila.
5. **Decommission es la última fase.** El código legacy se apaga sólo cuando 0 productos lo usan y los snapshots históricos siguen leyéndose sin él (vía adaptador o archivado).

---

## 3. Etapas de la migración

### Etapa A — Prerrequisitos (bloqueante, secuencial antes de todo)

**Duración estimada:** 1–2 meses (1 persona).

**A.1 — Golden-output suite (F9 de Fase 3).** Sin esto no se puede empezar.
- Para cada motor activo (digital, rigid-printed, talonario, vinyl-cut): seleccionar 8–12 casos representativos cubriendo cantidades típicas, opciones de checklist, adicionales activados, múltiples variantes.
- Total: 32–48 casos golden.
- Invocar `quote*Variant` con cada caso → serializar `resultado` a JSON → commitear como snapshot.
- Test Jest con `toMatchSnapshot()`. Cualquier diff requiere review en PR.
- Auditar no-determinismo (ej. `Date.now()`) y fijarlo con mocks.

**A.2 — Catálogo de familias de paso (F1).** Archivo declarativo en `apps/api/src/productos-servicios/pasos/familias.ts` con las 18 familias. Schema por familia (JSON Schema para validar config). No usado todavía por nadie.

**A.3 — Extensiones aditivas a `ProcesoOperacion` (F2, F3, F4).**
- Migración Prisma aditiva (no breaking): agregar campos `familia: String?`, `leeDelTrabajo: String[]?`, `leeDePasos: String[]?`, `produce: String[]?`, `unidadProductiva: String?`, `activacion: EnumActivacion?`, `condicion: Json?`.
- Todos nullable por default. Los motores legacy los ignoran.
- Catálogo de outputs semánticos canónicos (`outputs-canonicos.ts`).

**A.4 — Entidad `ReglaDeSeleccion` (F7).** Nueva tabla, construida en paralelo a `ProductoChecklistRegla` (no reemplaza). Sin consumidores todavía.

**A.5 — Evaluador de expresiones (JsonLogic o equivalente).** Función pura `evaluarCondicion(expr, context) → boolean`. Usable desde `ReglaDeSeleccion.condicion` y `ProcesoOperacion.condicion`.

**A.6 — Endpoint `/cotizar-v2` con shape canónica (F10, parte 1).**
- DTO de salida según §7 del modelo universal: `total, unitario, subtotales: {centroCosto, materiasPrimas, cargosFlat}, pasos[], subProductos[]`.
- Sin implementación de motor: el endpoint devuelve 501 hasta que algún motor emita v2.
- Adapter `v1 → v2` para motores legacy: dado un `resultado` v1, mapearlo al shape canónico usando la tabla de correspondencia de Fase 2 §2.2.

**Salida de Etapa A:** sistema sigue funcionando idéntico a hoy. Se agregaron campos inofensivos en DB, catálogos sin consumidores y un endpoint vacío. **Cero riesgo de regresión.**

---

### Etapa B — Piloto: gran formato sobre el modelo universal

**Duración estimada:** 2–3 meses (1 persona).

Gran formato (`gran_formato@1`) está stub. Cero código legacy que migrar, cero cotizaciones históricas. **Pilot ideal.**

**B.1 — Implementar `WideFormatMotorModule` v2 nativo.**
- `quoteVariant()` del módulo v2 construye una ruta de pasos usando familias: `impresion_por_area`, opcionalmente `corte`, `laminado`, `ojalado` (según checklist).
- Cada paso lee del Job Context (medidas, panelizado, tecnología, checklist) y emite outputs semánticos (`m2Impresos`, `panelesGenerados`, etc.).
- El resultado se emite directamente en shape v2.

**B.2 — Validación por casos reales.**
- El dueño del sistema genera 10–15 casos de prueba con expectativas manuales (qué tiempo de máquina, qué consumo de tinta, qué desperdicio de sustrato esperaría).
- Se comparan contra el output del motor v2. Iteración hasta convergencia.

**B.3 — UI "Simular costo (v2)" genérica.**
- Componente agnóstico del motor que renderiza un resultado en shape canónica: lista de pasos, desglose por bucket, trazabilidad.
- Consume `/cotizar-v2`.
- Reemplaza `wide-format-simular-costo-tab.tsx` sólo para productos wide-format. Los otros motores siguen con sus tabs actuales.

**B.4 — Exposición controlada por feature flag.**
- Variable `ENABLE_WIDE_FORMAT_V2` (env o config). Default: false.
- Operador interno prueba el flujo end-to-end en staging con el flag activo.

**Salida de Etapa B:** un motor productivo (gran formato) sobre el modelo universal, probado de punta a punta. Valida la arquitectura con datos reales, no sólo teoría.

**Criterio de éxito para avanzar a Etapa C:** los 10–15 casos de prueba producen resultados que el dueño del sistema considera correctos. Sin correcciones pendientes.

---

### Etapa C — Migración gradual de motores legacy via shadow mode

**Duración estimada:** 4–8 meses (1–2 personas, en paralelo al ritmo de aprobación del dueño).

Uno a uno, los 4 motores legacy (digital, rigid-printed, talonario, vinyl-cut) se migran al modelo v2 con la misma mecánica. **No se apagan los v1 todavía.**

**C.1 — Orden sugerido de migración** (simple → complejo):

1. **Vinilo de corte** (más simple, ruta corta: ploteo + laminado opcional).
2. **Digital / láser** (motor más usado, validación amplia).
3. **Rigid-printed** (más complejo por las 3 estrategias de costeo).
4. **Talonario** (el más particular, composición multi-copia).

**C.2 — Por cada motor, rutina repetible:**

- **C.2.a** Diseñar la ruta v2 equivalente: qué pasos, qué familias, qué reglas de selección (usando las tablas de correspondencia de Fase 2).
- **C.2.b** Implementar `Motor*V2` con `quoteVariant()` que emita shape canónica directa.
- **C.2.c** Poblar `ProcesoOperacion` nueva con los campos v2 (familia, inputs, outputs, etc.) para el producto piloto del motor.
- **C.2.d** Activar **shadow mode** para ese producto: cada vez que alguien cotiza, el sistema corre v1 **y** v2 en paralelo, retorna el resultado v1 al cliente, y **loguea el diff** entre `v1.total` y `v2.total` (y subtotales).
- **C.2.e** Correr shadow mode por semana o dos, monitoreando el dashboard de diffs. Esperado: diff < 0.01% en casos estables. Divergencias se diagnostican y corrigen en v2.
- **C.2.f** Cuando los diffs son sistemáticamente < 0.01%, **flip** del producto: a partir de ahí sirve v2 como respuesta oficial, v1 sigue calculando en background por otra semana (rollback seguro).
- **C.2.g** Después de una semana estable, se desactiva v1 **sólo para ese producto** (feature flag por producto/variante).
- **C.2.h** Se repite para el siguiente producto del mismo motor, y así hasta migrar todos los productos. Después se pasa al motor siguiente.

**C.3 — Feature flags por producto.**
- Tabla `ProductoServicio.motorPreferido: 'v1' | 'v2' | 'shadow'`. El endpoint `/cotizar` ruta según el flag.
- Permite rollback instantáneo de un producto problemático sin afectar los demás.

**C.4 — Infraestructura de shadow mode.**
- Tabla `CotizacionShadowLog` con `(snapshotV1Id, snapshotV2Id, diffTotal, diffSubtotales, contexto)`.
- Dashboard de admin: "¿Qué productos tienen diffs > X%?". Permite priorizar debugging.
- Los snapshots v2 se persisten con `motorVersion=2` en la misma tabla `CotizacionProductoSnapshot`. Los snapshots v1 quedan como histórico.

**Salida de Etapa C:** 100% de productos activos cotizando en v2, con snapshots v2 generándose, v1 todavía corriendo "sin consumidores" por seguridad de rollback.

**Criterios de pasaje por producto**: shadow mode durante ≥1 semana, diff total < 0.01%, sin anomalías detectadas por el dueño del sistema.

---

### Etapa D — Unificación del shape en el frontend

**Duración estimada:** 2–3 meses (1 persona, en paralelo a las últimas migraciones de C).

Esto es donde se ejecuta F10 completa, incluyendo el blast radius del módulo comercial identificado en Fase 4.

**D.1 — Tabs `simular-costo` genéricos para los 5 motores.**
- Se construye un único `ProductoSimularCostoTab` agnóstico que consume shape canónica.
- Los tabs específicos (`digital-simular-costo-tab.tsx`, `wide-format-simular-costo-tab.tsx`, …) se reemplazan gradualmente.

**D.2 — Rework del módulo comercial/propuestas.**
- `src/lib/propuestas.ts`: refactor del tipo `PropuestaItem`. En lugar de anidar `CotizacionProductoVariante` y `GranFormatoCostosResponse` por separado, anida una única `cotizacion: CotizacionCanonica`.
- Componentes consumidores (`agregar-producto-sheet`, `propuesta-ficha`, `costos-producto-dialog`, `gran-formato-nesting-dialog`) se migran a leer la shape canónica.
- Dado que propuestas es UI mock (Fase 4), **no hay migración de datos** — sólo rework de tipos y componentes.

**D.3 — Decommission del endpoint `/cotizar` v1 (opcional).**
- Si a esta altura ningún consumidor llama a `/cotizar` v1, el endpoint se marca como deprecated. El código queda pero se quita del router.
- Si algún consumer olvidado sale a flote, se vuelve a encender temporalmente.

**Salida de Etapa D:** frontend unificado, sin casos especiales por motor en la UI de costeo ni en propuestas.

---

### Etapa E — Decommission de motores legacy

**Duración estimada:** 1–2 meses (1 persona).

**E.1 — Limpieza de código.**
- Se borran los 4 métodos `quote*Variant` v1 del servicio monolítico. Junto con ellos, sus helpers (`rigid-printed.calculations.ts`, la porción legacy de `productos-servicios.service.ts`).
- Se borra `AlgoritmoCosto` y `ProductoVarianteAlgoritmoConfig` (dead code confirmado en Fase 2).
- Se borran tabs de frontend v1 si D.1 ya los reemplazó.

**E.2 — Estrategia para snapshots históricos v1.**
Dos opciones:
- **Opción conservadora (recomendada):** mantener los snapshots v1 tal cual, sólo lectura, accesibles por su `motorVersion=1`. Un adapter pequeño (`snapshotV1ToCanonical`) los convierte al vuelo al shape canónica si algún consumidor (auditoría, reporte histórico) los pide. Sin rework de datos.
- **Opción agresiva:** re-snapshottear todos los históricos en background invocando un motor v1 simulado congelado. Riesgo alto (la lógica v1 ya está descartada); poco valor.
→ Recomiendo la conservadora.

**E.3 — Limpieza de feature flags.**
- Se elimina `ProductoServicio.motorPreferido` y tabla `CotizacionShadowLog`.
- El código queda limpio, una sola línea de ejecución.

**Salida de Etapa E:** sistema corriendo 100% sobre el modelo universal, motores v1 eliminados, deuda técnica pre-refactor cerrada.

---

## 4. Cronograma orientativo

Asumiendo **1 persona full-time + backup ocasional del dueño del sistema para validación**:

| Etapa | Duración | Mes relativo |
|---|---|---|
| A — Prerrequisitos | 1–2 meses | 0–2 |
| B — Piloto gran formato | 2–3 meses | 2–5 |
| C — Migración shadow mode de 4 motores legacy | 4–8 meses | 5–13 |
| D — Unificación frontend + rework comercial | 2–3 meses | 10–13 (paralelo a C tardía) |
| E — Decommission | 1–2 meses | 13–15 |

**Total orientativo: 12–15 meses con 1 persona full-time.** Con 2 personas coordinadas: 7–9 meses.

Esto se alinea con la estimación gruesa de Fase 3 (~12–14 meses solo, ~7–8 con 2 personas), validando internamente la consistencia del análisis.

---

## 5. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Golden-output suite incompleta → motores v2 divergen en casos raros sin detectarse | Media | Alto | Shadow mode en C detecta divergencias no previstas por la suite; diff logueado obliga a investigar |
| Service monolítico de 17K líneas se rompe al extraer un motor | Media | Alto | Extracción por motor uno a la vez; feature flag por producto; snapshots v1 siguen disponibles |
| Dueño del sistema no disponible para validar casos | Media | Medio | Golden tests + shadow diff cubren validación objetiva; validación subjetiva del dueño sólo para piloto (Etapa B) |
| DSL de condiciones (JsonLogic) se queda corto | Baja | Medio | Compuerta híbrida del modelo: escape a código TypeScript para reglas complejas |
| Editor visual de grafo (F8) toma más tiempo que lo estimado | Alta | Bajo | No es bloqueante — Etapa D puede entregar con vista lista; visual queda para Etapa F opcional |
| Componentes comercial/propuestas tienen lógica oculta que F10 no previó | Baja | Medio | Spike de inspección al inicio de D; estimación revisada si aparece |
| Cotizaciones históricas v1 consultadas frecuentemente → rendimiento del adapter | Baja | Bajo | Medir en E.2 antes de decidir; si duele, cachear convert |
| "Scope creep" por pedidos de features durante la migración | Alta | Alto | Política: nada nuevo durante la migración salvo bug-fixes críticos; funcionalidades nuevas se agregan sobre v2 después de Etapa C |

---

## 6. Decisiones de gobierno sugeridas

Para que la migración funcione sin interrupciones:

- **Un único "dueño de migración"** responsable end-to-end. La dispersión de decisiones es el mayor riesgo operativo.
- **Review semanal de diffs** durante Etapa C. Dashboard visible para el dueño.
- **Un release-branch dedicado al refactor** (como ya se decidió). Merges a `main` al terminar cada etapa, no por commit.
- **Feature freeze suave** en el módulo costeo durante la migración: features nuevas se documentan pero se implementan al final sobre v2.

---

## 7. Fases opcionales posteriores

Cosas que quedan fuera del scope mínimo pero valen agregar al roadmap:

- **Etapa F (opcional)** — Editor visual de grafo (F8). Requiere Etapa C completa.
- **Etapa G (opcional)** — Productos componentes (F6). Implementación recursiva. Requiere un caso de negocio real que lo justifique.
- **Etapa H (opcional)** — Consolidación de reglas: mover todos los casos de `ProductoChecklistRegla` a `ReglaDeSeleccion` para tener un único motor de reglas. No urgente.

---

## 8. Veredicto de Fase 5

La estrategia es **ejecutable y reversible en cada etapa**. Ningún paso es irreversible hasta Etapa E (decommission), y Etapa E sólo ocurre cuando ya no hay consumidores v1.

El cronograma orientativo (12–15 meses solo, 7–9 meses con 2 personas) es largo pero predecible. El piloto de gran formato en Etapa B es el hito que valida o invalida el modelo con datos reales; si falla ahí, se puede abortar con costo contenido (las inversiones de Etapa A son en tooling y catálogos que se aprovechan igual).

No hay bloqueos conceptuales. Las dos preguntas abiertas heredadas de fases previas se resolvieron (propuestas ephemeral, volumen de snapshots no obstructivo).

**Conclusión de estrategia: viable, con ruta clara y rollback en cada etapa.**

---

## Siguiente paso — Fase 6: Documento de viabilidad final

Consolidar las 5 fases en un único documento de decisión con:
- Resumen ejecutivo (veredicto en 1 página).
- Recomendación (GO / NO-GO / GO-con-condiciones).
- Costo total y plazo con sensibilidades.
- Condiciones que tienen que cumplirse antes de arrancar.
- Valor esperado vs statu quo.

Salida: `docs/viabilidad-modelo-universal-fase-6-veredicto.md`.
