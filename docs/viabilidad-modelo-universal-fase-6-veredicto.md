# Viabilidad del modelo universal de costeo — Fase 6: Veredicto final

**Fecha:** 2026-04-17
**Fases anteriores:** `fase-1-inventario.md`, `fase-2-mapeo.md`, `fase-3-fricciones.md`, `fase-4-ecosistema.md`, `fase-5-estrategia.md`

Este documento cierra el análisis de viabilidad iniciado el 2026-04-17 sobre la propuesta de migrar el módulo de costeo de productos al **modelo universal de pasos de producción** definido en `/Users/lucasgomez/.claude/plans/quiero-que-hablemos-de-dynamic-parrot.md`.

---

## Resumen ejecutivo

**Veredicto: GO con condiciones.**

La migración es **viable, reversible y ejecutable en etapas**. No hay bloqueos conceptuales; el sistema actual ya tiene la semilla del modelo universal (`ProcesoOperacion` ya modela pasos con setup/run/cleanup/centroCosto; `ProductoAdicionalEfecto` ya implementa los 3 buckets ROUTE/MATERIAL/COST). El blast radius está contenido al módulo de costeo + frontend comercial/propuestas.

El esfuerzo es grande (12–15 meses con 1 persona, 7–9 meses con 2) pero predecible y con rollback en cada etapa. El único prerrequisito duro es **construir una golden-output suite para los motores actuales antes de tocar cualquier código productivo**.

El valor esperado justifica el costo si se cumple al menos una de estas condiciones:
- El negocio planea incorporar **≥2 tecnologías/familias nuevas** en los próximos 2 años (DTF, gran formato UV, CNC, luminaria, herrería, etc.).
- Se quiere reducir el tiempo de onboarding de productos nuevos de **semanas/meses a horas/días**.
- La deuda técnica actual (monolito de 17.632 líneas, tests ausentes, shape divergente frontend) está bloqueando otras iniciativas.

---

## Recomendación

**GO con condiciones**, en el siguiente orden:

1. **Aprobar Etapa A (prerrequisitos, 1–2 meses).** Es inversión auto-contenida que se aprovecha aunque después se decida no avanzar con el resto: golden tests protegen al motor actual, la tabla de familias sirve como documentación viva, las extensiones aditivas a `ProcesoOperacion` no rompen nada.
2. **Decisión de go/no-go antes de Etapa B.** Con Etapa A cerrada, el costo incremental de intentar el piloto gran formato (Etapa B, 2–3 meses) es acotado. Si el piloto no converge, se corta con costo total ≤5 meses.
3. **Compromiso de Etapas C–E sólo después de Etapa B exitosa.** Una vez validado el modelo con datos reales en el piloto, el compromiso a los 4 motores legacy (Etapa C) es una decisión mucho más informada.

---

## Condiciones que tienen que cumplirse antes de arrancar

1. **Un dueño único de migración.** Responsabilidad end-to-end, decisiones de arquitectura, priorización. No funciona con responsables rotativos.
2. **Feature freeze suave en el módulo costeo.** Durante los 12–15 meses, features nuevas se documentan pero se implementan al final sobre v2. Sin esto, drift entre v1 y v2 destruye la estrategia de shadow mode.
3. **Disponibilidad del dueño del sistema (vos) para validar casos.** Especialmente en Etapa B (piloto) y durante los primeros productos de Etapa C. ~1h/semana como tope.
4. **Presupuesto asumido al menos hasta Etapa B completa.** ~3–5 meses con 1 persona. A partir de ahí el compromiso se revisa con más data.
5. **Release branch dedicada.** Como ya decidiste. Merges a `main` al cerrar cada etapa, no por commit.

---

## Riesgos principales y mitigación

| Riesgo | Probabilidad | Impacto | Mitigación principal |
|---|---|---|---|
| Shadow mode detecta diffs sistemáticos en algún motor | Media | Alto (demora etapa C) | Shadow mode duración extendida hasta convergencia; no hay presión de cut-over |
| Monolito de 17K líneas se rompe al extraer un motor | Media | Alto | Feature flag por producto permite rollback inmediato |
| Dueño del sistema no disponible para validar casos | Media | Medio | Golden tests + shadow diff cubren validación objetiva |
| Scope creep por pedidos del negocio | Alta | Alto | Feature freeze suave explícito con el negocio |
| Subestimación del rework comercial (módulo propuestas) | Baja | Medio | Spike de inspección al inicio de Etapa D |
| Cronograma se extiende más de lo previsto | Media | Bajo (todas las etapas entregan valor incremental) | Cronograma orientativo, no compromiso fijo; cada etapa entrega algo aprovechable aunque después se pause |

---

## Costo total

**En esfuerzo de desarrollo:**

| Escenario | Equipo | Duración |
|---|---|---|
| Conservador (1 persona full-time) | 1 dev | 12–15 meses |
| Optimizado (2 personas coordinadas) | 2 devs | 7–9 meses |
| Mínimo hasta decisión go/no-go de piloto | 1 dev | 3–5 meses (Etapas A + B) |

**No incluye:** capacitación de usuarios en el nuevo editor visual, eventual implementación de Etapas F/G/H opcionales (editor grafo avanzado, productos componentes, consolidación total de reglas).

**En deuda técnica resuelta como subproducto** (valor indirecto):
- Dead code `AlgoritmoCosto` / `ProductoVarianteAlgoritmoConfig` eliminado.
- Motores extraídos del servicio monolítico de 17.632 líneas a archivos dedicados.
- Cobertura de tests donde hoy hay cero (en los 4 métodos `quote*Variant`).
- Unificación de 2 shapes divergentes (`CotizacionProductoVariante` vs `GranFormatoCostosResponse`) en un shape canónica.

---

## Valor esperado vs statu quo

### Statu quo sostenido (no migrar)

- Cada tecnología nueva requiere motor dedicado. Estimación conservadora: 4–6 meses-persona por motor nuevo.
- Si el negocio planea DTF textil, DTF UV, gran formato UV, luminaria, cartelería estructural, CNC — son 5+ motores a construir. Total: 20–30 meses-persona en los próximos 2–3 años, sólo en código nuevo.
- La deuda técnica se agranda: cada motor nuevo amplía el monolito y duplica lógica parcialmente común (imposición, consumo de insumos, aplicación de adicionales).
- El módulo comercial/propuestas tendrá que soportar N shapes distintos de cotización cuando hoy soporta 2.
- Onboarding de un producto nuevo sin tecnología nueva sigue siendo configuración manual de motor config JSON sin UI guiada.

### Con modelo universal adoptado

- Tecnología nueva = agregar una familia al catálogo + configurar pasos. Horas/días, no meses.
- Producto nuevo = seleccionar familias + configurar reglas. Sin código.
- Un único shape canónica simplifica el frontend a largo plazo.
- Plataforma escala al negocio: cartelería compuesta, luminaria, herrería, productos multi-componente (tapa dura, cajas de luz con LED+acrílico+estructura), trabajos off-site (colocación de vinilo, instalación en obra) — todos caben sin código nuevo.
- Arquitectura más testeable y razonable (pasos aislados, reglas declarativas, DAG explícito).

### Punto de equilibrio orientativo

- Si el negocio agrega **1 motor/año**: el refactor paga en **~2–3 años** (cuando la inversión inicial iguala al costo acumulado de motores).
- Si agrega **2–3 motores/año**: paga en **~1–1.5 años**.
- Si el negocio queda estable en los 5 motores actuales sin planes de expansión: el refactor **no paga por sí solo** — sólo se justifica si la deuda técnica actual está bloqueando otras iniciativas.

---

## Señales que invalidarían la recomendación

La recomendación GO se mantiene mientras:

- El negocio mantenga el plan de expandirse a tecnologías/rubros nuevos (DTF, UV, CNC, luminaria, herrería).
- El piloto de Etapa B converge con datos reales.
- Haya disponibilidad de un dueño único y un dev a largo plazo.

Se volvería NO-GO si:

- El negocio pivota a un nicho estrecho y ya no planea agregar tecnologías → el ROI no cierra.
- Aparecen prioridades competitivas más urgentes (ej. nuevo producto comercial, obligación regulatoria, outage crítico) que consumen al dev de migración → el riesgo de scope creep se vuelve inmanejable.
- El piloto gran formato en Etapa B no converge con tolerancias aceptables tras iteración → revisar el modelo universal antes de comprometerse con Etapa C.

---

## Resumen de hallazgos por fase

| Fase | Entregable | Hallazgo principal |
|---|---|---|
| 1 | `fase-1-inventario.md` | El sistema ya tiene la semilla del modelo universal en `ProcesoOperacion` y `ProductoAdicionalEfecto` |
| 2 | `fase-2-mapeo.md` | Correspondencia actual→nuevo es más limpia que lo esperado; `AlgoritmoCosto` es dead code |
| 3 | `fase-3-fricciones.md` | 10 fricciones, una bloqueante (tests); ninguna roja. Esfuerzo ~53 semanas-persona |
| 4 | `fase-4-ecosistema.md` | Blast radius backend nulo; frontend incluye módulo comercial/propuestas como acoplamiento sorpresa |
| 5 | `fase-5-estrategia.md` | 5 etapas reversibles; shadow mode como mecanismo central; piloto gran formato (stub) como greenfield ideal |
| 6 | `fase-6-veredicto.md` (este) | **GO con condiciones.** Aprobar Etapa A, decidir Etapa B, comprometerse a C–E sólo tras validación del piloto |

---

## Próximos pasos concretos (si hay decisión GO)

1. Asignar dueño de migración.
2. Agendar una reunión de 2–3h para: (a) revisar este documento en conjunto, (b) validar las 10–12 variantes representativas de cada motor para la golden-output suite, (c) confirmar el feature freeze suave con el negocio.
3. Crear rama `feature/modelo-universal-etapa-a` desde `main`.
4. Arrancar con A.1 — Golden-output suite (es el cuello de botella).
5. Revisión de avance semanal los primeros 2 meses.

Si la decisión es NO-GO o POSTPONE: archivar los 6 documentos en `docs/` como referencia y mantener el modelo universal en `/Users/lucasgomez/.claude/plans/` como norte conceptual, sin compromiso de implementación.

---

## Cierre

Este análisis cubrió las 5 fases planificadas (inventario, mapeo, fricciones, ecosistema, estrategia) y consolida en un veredicto. El documento se archiva como referencia; si la decisión de avanzar llega en los próximos meses, puede retomarse sin re-trabajo. Si llega en más de 6 meses, vale revisar los hallazgos contra el estado del código vigente — los sistemas evolucionan y algunos hechos se pueden quedar obsoletos.

El trabajo de análisis por sí mismo ya entregó valor: documentó implícitamente la arquitectura actual del costeo, reveló dead code, identificó el acoplamiento comercial/propuestas oculto, y fijó un modelo conceptual que la organización puede usar como marco de razonamiento aunque nunca se migre.

---

**Fin del análisis de viabilidad.**
