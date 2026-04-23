# Síntesis y priorización · Validación 2026-04-23

> Salida final del Paso 5. Reordena los pendientes (P4-debt → P11 + nuevos hallazgos) según el valor de negocio revelado por el ejercicio. Reemplaza al §3 del handoff `modelo-universal-handoff-2026-04-19.md` como **guía operativa** desde hoy.

---

## TL;DR

**El sistema responde correctamente el 35% de las 40 preguntas planteadas, parcialmente el 22,5%, y NO responde el 42,5%.**

**De los 17 gaps consolidados** (G1-G14 + 3 derivados), **el 88% son data faltante en seeds o features menores ya planeadas en P4-debt/P5/P6/P7/P8** — no hay gap arquitectónico fundamental.

**Decisión clave**: NO implementar routings alternativos completos (gap dolor del usuario). El análisis muestra 0 casos reales en Corporearte que lo justifiquen. Detalle en `routings-alternativos-analisis.md`.

**Recomendación de orden de ataque** (próximas 6-8 semanas, 1 dev):
1. **Quick wins de seed** (1 semana) → resuelve 9 gaps con 0 código.
2. **G1 bug material vinilo** (1 día) → desbloquea cotización de vinilo.
3. **P4-debt cerrar** (1 semana) → habilita CONDICIONAL real para talonarios.
4. **P6 sub-productos** (2-3 semanas) → habilita tapa de talonario, productos compuestos.
5. **P7 UI reglas** (2 semanas) → habilita autoría sin SQL.
6. Resto (P5 multi-color, tira+retira, P8 data migration) → según necesidad.

---

## 1. Reordenamiento de pendientes por valor de negocio

Cada frente se evalúa por: cuántas preguntas R/P/N cierra, esfuerzo estimado, y dependencia (qué desbloquea).

| # | Frente | Preguntas que cierra | Esfuerzo | Dependencia | Recomendación |
|---|---|---|---|---|---|
| **W1** | **Quick wins de seed** (cargar 4 perfiles Ricoh + 3 perfiles UV + 2 perfiles Skycut + 2 perfiles Laminadora como `ProcesoOperacionAlternativa`; corregir `aplicaMultiCaras=true` en vinilo; verificar tarifa centro costo Diseño) | T09, T10, V06, V11, G9, G11, G12 — **9 gaps** | 1 sem (data, 0 código) | Ninguna | **Hacer YA**. ROI altísimo. |
| **W2** | **G1 — Bug material declarativo vinilo** (corregir fórmula `por_unidad_productiva` con unidad ambigua, o agregar fórmula `por_m2`) | V05 — **1 gap crítico** | 1 día (1 línea + test) | Ninguna | **Bloqueante** para cotizar vinilo. Hacer en paralelo con W1. |
| **W3** | **G4 — Rehacer ruta seed de talonario** (eliminar la clonada de tarjetas, modelar pasos reales: pre-prensa de imposición → impresión original → impresión copia 1 (CONDICIONAL) → impresión copia 2 (CONDICIONAL) → numeración (opcional) → compaginado → emblocado → perforado (opcional) → embalaje real) | L01, L05, L06, L09 — **4 gaps** | 3-5 días (data + decidir si agregar familia "numeracion") | W1 ideal | Después de W1. **Es el producto más roto del seed**. |
| **P4-debt** | Cerrar consolidación: (1) JsonLogic CONDICIONAL real, (2) `unidadProductivaV2` runtime, (3) editor UI `configNestingV2` | L02, parte de L08 — **2 gaps** | 1 sem (1 sesión según handoff §3) | Ninguna | Habilita talonario multi-copia. **Fundacional.** |
| **P6** | Sub-productos / productos componentes (recursión en super motor + schema relación padre-hijo + UI) | L04 — **1 gap** | 2-3 sem | Ninguna | Habilita tapa de talonario, cartel iluminado, packaging. |
| **P7** | UI de reglas de selección (CRUD `ReglaDeSeleccion` + autoría JsonLogic + wire-up al cotizar) | L07, parte de T09/T10/V06 si se cargan reglas — **3-4 gaps** | 2 sem | Ninguna | Habilita selección automática perfil/material por contexto. |
| **P5 — multi-cara/tira+retira** | Flag `configNestingV2` para impresión doble faz una pasada | T11 — **1 gap** | 1 sem | Ninguna | Importante para tarjetas reales (la mayoría son 2 caras). |
| **P5 — multi-color vinilo** | Iteración por color o sub-producto por color | V07 — **1 gap** | 1-2 sem | P6 si se modela como sub-producto | Solo si Corporearte hace vinilo de corte multi-color con frecuencia. |
| **P5 — vinilo medidas LIBRES** | Motor lee anchoMm/altoMm del request en `modoMedidas=LIBRE` | V04 — **1 gap** | 3-5 días | Ninguna | Bloquea cotización de medidas custom. |
| **P5 — talonario copias** | Parámetro `tipoCopia` + pasos condicionales | L02 — ya cubierto por W3 + P4-debt | (incluido) | P4-debt | Combinar con W3. |
| **G14 — Verificar nesting cambio formato** | Investigar si nesting recalcula piezas/pliego al cambiar variante | T13 — **1 gap** | 1-2 días (debugging) | Ninguna | Bug menor pero importante para confianza del operador. |
| **G13 — Sistema de warnings** | Motor advierte stock bajo, perfil incompatible, cantidad mínima | T15 — **1 gap** | 1 sem | Ninguna | Mejora UX. Posponible. |
| **P8** | Data migration masiva de `ProcesoOperacionMaterial` en todos los productos. Eliminar fallback `material-plantillas.ts` | T07/G10 — **1 gap** + reduce deuda técnica | 2-3 sem (script + verificación) | W1 + W2 hechos | Cleanup importante pero no bloquea negocio. |
| **P9** | Cleanup técnico: desinstalar Three.js, eliminar `material-plantillas.ts` (post-P8), eliminar `inferirFamiliaDesdeTipo`, renombrar `/cotizar-v2` → `/cotizar` | — | 2 días | P8 ideal | Quick wins post P8. |
| **P10** | Tests unitarios + E2E con goldens contra `/cotizar-v2`. **Goldens reales: las 14 preguntas R de la matriz** son una suite golden inicial. | — | 1-2 sem | W1+W2 hechos (para que números no cambien después) | Hacer después de W1+W2. |
| **P11** | Documentación de usuario: cómo crear producto desde cero, ruta simple, ruta compleja, casos por familia | — | 1-2 sem | Sistema estable | Posponible. |
| **B/C — Routings alternativos completos** | — | 0 casos reales hoy | 6-10 sem | — | **NO implementar ahora**. Re-evaluar si aparece caso real. |

---

## 2. Roadmap recomendado (6-8 semanas, 1 dev full-time)

### Sprint 1 (semana 1-2)
- W1: Cargar alternativas seed (todos los perfiles de máquina como `ProcesoOperacionAlternativa`). 1 sem.
- W2: Fix bug material vinilo. 1 día.
- P4-debt: cerrar 3 hilos sueltos. 1 sem (paralelo).

**Salida sprint 1**: 12-13 gaps cerrados. Cotización de vinilo funcional. Talonario multi-copia funcional. Operador puede preguntar "máquina A vs B".

### Sprint 2 (semana 3-4)
- W3: Rehacer ruta seed de talonario. 1 sem.
- P5 — vinilo medidas LIBRES. 3-5 días.
- P5 — tira+retira. 1 sem.

**Salida sprint 2**: Talonarios cotizados como talonarios reales. Vinilo medidas custom. Tarjetas doble faz.

### Sprint 3 (semana 5-6)
- P6: Sub-productos. 2-3 sem.

**Salida sprint 3**: Tapa de talonario. Productos compuestos.

### Sprint 4 (semana 7-8)
- P7: UI reglas de selección. 2 sem.
- (Quedan para después: P5 multi-color, P8 data migration, P9 cleanup, P10 tests, P11 docs).

**Salida sprint 4**: Operador autora reglas sin SQL. Sistema en modo "feature complete" para los 3 productos validados.

---

## 3. Validación final post-Sprint 4

Re-ejecutar la matriz de 40 preguntas de `specifications-by-example.md`. **Objetivo**: pasar de **35% R / 22,5% P / 42,5% N** a **≥85% R / ≤10% P / ≤5% N**.

**Criterio de éxito del proyecto "destrabe"**:
- Tarjetas: 17/18 R (las 4 N actuales pasan a R con W1+P5 tira+retira).
- Vinilo: 9/12 R (3 dependen de P5 multi-color o features Pro fuera de scope).
- Talonarios: 7/10 R (3 dependen de features mayores como sub-productos avanzados).

**Total objetivo**: 33/40 R = 82,5%. Aceptable.

---

## 4. Lo que el ejercicio reveló y NO estaba en el handoff

1. **G1 — Bug crítico material vinilo no calculado**. NO estaba en el handoff §3. Es bug nuevo descubierto al ejecutar el endpoint. Crítico para cotizar vinilo.
2. **G4 — Talonario seed = Tarjetas seed**. NO estaba documentado. Crítico para cualquier cotización de talonario.
3. **G14 — Cambio de formato no afecta costo casi nada** (T13). Sospechoso. Requiere investigar nesting.
4. **G12 — Tarifa centro de costo de Diseño** ($7.834 por 100 tarjetas) — verificar realismo.
5. **El gap dolor "routings alternativos completos" no aplica hoy**. Validado contra 19 casos reales: 0 lo requieren.
6. **El motor está más maduro que el seed**. Trazabilidad excelente. La lista de pendientes es mayormente DATA, no código. Cambia la naturaleza del trabajo: menos refactor, más curaduría.

---

## 5. Acción inmediata (mañana)

1. **Leer este doc y los 4 docs satélite** del directorio `docs/validacion-negocio-2026-04/`.
2. **Confirmar/ajustar el roadmap** del §2 con el usuario.
3. **Arrancar Sprint 1**:
   - W1: SQL/seeds para cargar alternativas faltantes.
   - W2: Branch + 1 commit fix bug vinilo + test.
   - P4-debt: las 3 sub-tareas.
4. **Sesión de 30-45 min con el negocio** (Corporearte) para completar las secciones `[INPUT NEGOCIO]` de los 3 Event Storming.

---

## 6. Update a la memoria del proyecto

Al cerrar este ejercicio, agregar al memo `~/.claude/projects/-Users-lucasgomez-gdi-saas/memory/project_modelo_universal_costeo.md`:

```markdown
## Validación 2026-04-23

Ejercicio Event Storming + specifications by example sobre 3 productos
representativos (Tarjetas, Vinilo, Talonarios). Docs en
`docs/validacion-negocio-2026-04/`. Hallazgos clave:

- Sistema responde 35% R / 22,5% P / 42,5% N de 40 preguntas reales.
- Bug crítico nuevo: material declarativo vinilo no se calcula (G1).
- Bug seed: talonario clona ruta de tarjetas (G4).
- Decisión: NO implementar routings alternativos completos por ahora
  (0 casos reales lo requieren en Corporearte). Detalle en
  `routings-alternativos-analisis.md`.

Roadmap revisado en `sintesis-y-prioridad.md`: 4 sprints, ataca W1
quick wins de seed primero, después P4-debt, después P6, después P7.
Reemplaza al §3 del handoff `modelo-universal-handoff-2026-04-19.md`.
```
