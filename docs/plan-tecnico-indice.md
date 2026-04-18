# Planes técnicos de migración al modelo universal — Índice

**Fecha de escritura:** 2026-04-17
**Contexto completo:** ver documentos de viabilidad en `docs/viabilidad-modelo-universal-fase-*.md` (6 fases).
**Modelo conceptual de referencia:** `/Users/lucasgomez/.claude/plans/quiero-que-hablemos-de-dynamic-parrot.md`

Este índice organiza los 5 planes técnicos de ejecución de la migración al modelo universal de costeo. Cada plan es **self-contained**: si entrás en una sesión nueva podés ejecutar una etapa leyendo su plan y los documentos de viabilidad, sin necesidad de re-construir todo el razonamiento.

El veredicto del análisis (`fase-6-veredicto.md`) es **GO con condiciones**. Los planes asumen que las 5 condiciones previas ya se cumplen (dueño de migración asignado, feature freeze suave, disponibilidad del dueño del sistema para validaciones, presupuesto hasta Etapa B, release branch dedicada). Si al retomar alguna de esas condiciones no se cumple, revisá Fase 6 antes de arrancar.

---

## Roadmap

| Etapa | Plan técnico | Duración | Bloqueante de | Reversible |
|---|---|---|---|---|
| A | [plan-tecnico-etapa-A-prerrequisitos.md](plan-tecnico-etapa-A-prerrequisitos.md) | 1–2 meses | B, C, D, E | Sí, cada paso |
| B | [plan-tecnico-etapa-B-piloto-gran-formato.md](plan-tecnico-etapa-B-piloto-gran-formato.md) | 2–3 meses | C, D, E | Sí (feature flag) |
| C | [plan-tecnico-etapa-C-migracion-shadow-mode.md](plan-tecnico-etapa-C-migracion-shadow-mode.md) | 4–8 meses | D parcialmente, E | Sí (shadow + flag por producto) |
| D | [plan-tecnico-etapa-D-unificacion-frontend.md](plan-tecnico-etapa-D-unificacion-frontend.md) | 2–3 meses | E | Sí (componentes nuevos conviven con viejos) |
| E | [plan-tecnico-etapa-E-decommission.md](plan-tecnico-etapa-E-decommission.md) | 1–2 meses | — | **No** (deletes de código legacy) |

Cronograma orientativo: 12–15 meses con 1 persona, 7–9 meses con 2 personas.

---

## Principios de ejecución (aplicables a todas las etapas)

1. **Estrategia de branching y rollback.** Ver §B más abajo. Una rama de integración larga + ramas por etapa; tag y DB dump antes de arrancar.
2. **Reversibilidad por paso.** Cada tarea del plan debe poder desactivarse si rompe algo. Feature flags, endpoints v2 en paralelo, convivencia.
3. **Validación objetiva primero.** Antes de declarar "terminado", cada entregable pasa por golden tests, shadow diff o criterio medible. Nada depende de "parece que funciona".
4. **No limpiar hasta Etapa E.** Código legacy, flags, entidades temporales se mantienen hasta el final. La Etapa E es la única que borra.
5. **Dueño del sistema valida casos clave.** Especialmente en Etapa B y primeros productos de C. Agendar 1h/semana.

---

## §B — Estrategia de branching y rollback

El usuario ya estableció un patrón para refactors grandes (ver memoria `project_refactor_arquitectonico_mayor.md` del 2026-04-10): **tag estable + DB dump + ROLLBACK_PLAN**. Esta migración se apoya en el mismo patrón, adaptado a su duración (12–15 meses) y a que son 5 etapas.

### Safety net (se crea una sola vez, antes de arrancar Etapa A)

1. **Tag git.** `git tag v1.1-stable-pre-modelo-universal` apuntando al commit estable de `main` el día que arranca la migración. Es el punto de restore "descarte total" si la migración se vuelve inviable.
2. **Dump de DB de producción.** `backups/gdi_saas_pre_modelo_universal_<fecha>.sql`. Restore completo si algún dato queda inconsistente tras una migración Prisma y no se puede recuperar con un revert simple.
3. **ROLLBACK_PLAN.md.** Nuevo doc en raíz: qué pasos seguir si se decide abortar en cada etapa. Detalla cómo revertir cada migración Prisma aplicada, cómo apagar cada feature flag, cómo cerrar el endpoint `/cotizar-v2`.

### Modelo de ramas durante la migración

```
main ───────────────────────────────────────────────────────────────●  (producción estable; cero cambios del refactor hasta cerrar todo)
       │
       └── refactor/modelo-universal ────●───●───●───●───●────────●  (rama de integración larga; cada ● es un merge de etapa)
              │                          │   │   │   │   │
              ├── feature/mu-etapa-A ────┘   │   │   │   │          
              ├── feature/mu-etapa-B ────────┘   │   │   │          
              ├── feature/mu-etapa-C ────────────┘   │   │          (Etapa C es larga: sub-ramas por motor)
              │   ├── feature/mu-etapa-C-vinyl      │   │
              │   ├── feature/mu-etapa-C-digital    │   │
              │   ├── feature/mu-etapa-C-rigid      │   │
              │   └── feature/mu-etapa-C-talonario  │   │
              ├── feature/mu-etapa-D ────────────────┘   │          
              └── feature/mu-etapa-E ────────────────────┘          (último merge → main al cierre del proyecto)
```

### Cómo se usa

**Una sola rama larga de integración** (`refactor/modelo-universal`) que acumula el trabajo de las 5 etapas. Vive meses. Sólo se merge a `main` al completar Etapa E.

**Ramas cortas por etapa** (`feature/mu-etapa-X`) que salen de `refactor/modelo-universal`, reciben los commits del trabajo de esa etapa, y se mergean de vuelta a `refactor/modelo-universal` al cerrar la etapa.

**Etapa C tiene sub-ramas por motor** (`feature/mu-etapa-C-vinyl`, etc.) porque migrar 4 motores en una sola rama acumula demasiados cambios. Cada motor migrado se mergea a `feature/mu-etapa-C`, y al final C cierra con merge a la rama de integración.

**Sincronización con main:** mensualmente se hace `git merge main` hacia `refactor/modelo-universal` para absorber bug-fixes y features ajenas al módulo costeo. Los conflictos que aparecen son oportunidad de validar el feature freeze suave (si hay conflicto en el módulo costeo = alguien lo tocó, hay que hablarlo).

### Rollback por nivel

La estrategia soporta 4 niveles de rollback, del menos al más drástico:

| Nivel | Cuándo se usa | Qué hace |
|---|---|---|
| 1. Feature flag | Un producto migrado a v2 tiene un bug detectado en producción | `ProductoServicio.motorPreferido = 'v1'` → vuelve a cotizar con legacy en segundos |
| 2. Revert de commit | Un cambio específico rompe la rama de integración | `git revert <sha>` en `feature/mu-etapa-X`; si ya se mergeó, revert del merge |
| 3. Abandonar una etapa | Etapa X no converge; decide no avanzar | No se mergea `feature/mu-etapa-X` a la rama de integración; trabajo queda archivado |
| 4. Descarte total | Se aborta toda la migración | `git branch -D refactor/modelo-universal` + restore de DB desde el dump del safety net + reset a tag `v1.1-stable-pre-modelo-universal` si hubo cambios en main |

El nivel 4 es el escenario "catastrófico" para el que existe el safety net. El objetivo es que nunca haga falta, pero tenerlo permite asumir el refactor con confianza.

### Qué se mergea a main entre Etapa A y E

**Nada del refactor.** `main` mantiene el código legacy corriendo durante los 12–15 meses. La única excepción son fixes urgentes de bugs ajenos al módulo costeo (estándar); esos van a `main` directo y después se sincronizan hacia `refactor/modelo-universal`.

Esto implica que **producción corre sobre v1 hasta el merge final**. El trabajo v2 se prueba sólo en staging (con DB separada). El shadow mode de Etapa C corre en staging contra datos de prueba, no en prod.

### Compatibilidad con el refactor previo (`refactor-plan.md`)

La memoria indica que hay un refactor arquitectónico en flight desde 2026-04-10 (`tag v1.0-stable-pre-refactor`, 8 fases). Antes de arrancar la migración al modelo universal, validar con el usuario:

- ¿El refactor previo sigue activo, pausado, o superseded?
- Si sigue activo: ¿las dos iniciativas conviven en la misma rama o en ramas paralelas? ¿Se hace primero uno, después el otro?
- Si está pausado: confirmar que la rama/trabajo está archivado o descartado antes de que comience el nuevo.

Hasta resolver esto, no se crea `refactor/modelo-universal` ni el nuevo tag.

---

## Puntos de decisión críticos

Checkpoints donde vale parar y decidir antes de seguir:

- **Fin de Etapa A → antes de B.** ¿Golden-output suite cubre lo suficiente? ¿Catálogo de familias está bien? Si el dueño del sistema no está convencido, se refina acá antes de invertir en piloto.
- **Fin de Etapa B → antes de C.** ¿El piloto gran formato cotiza correctamente los 10–15 casos reales? Si no converge, se revisa el modelo universal antes de comprometerse con los 4 motores legacy.
- **Durante Etapa C, por cada motor migrado.** ¿Shadow diff converge < 0.01% sostenido ≥1 semana? Si no, no se hace flip.
- **Fin de Etapa D.** ¿100% de productos activos en v2? ¿Componentes comerciales refactorizados sin regresión? Sólo con esto confirmado se avanza a decommission.

---

## Preguntas que se resuelven al arrancar cada etapa

Algunas decisiones se dejaron abiertas en la Fase 5 de análisis porque dependen de realidad operativa del momento. Cada plan técnico tiene un "**§0 preguntas de arranque**" que hay que responder con el dueño antes de ejecutar la primera tarea:

- **Etapa A**: ¿qué 8–12 casos golden por motor son suficientemente representativos? ¿JsonLogic o DSL propio para expresiones?
- **Etapa B**: ¿qué 10–15 casos de gran formato se usan para validar? ¿qué productos wide-format son prioritarios?
- **Etapa C**: ¿cuál es el volumen real de `CotizacionProductoSnapshot` en DB viva? ¿qué orden de productos migrar dentro de cada motor?
- **Etapa D**: ¿hay cambios en módulo comercial/propuestas desde 2026-04-17 que invaliden el análisis?
- **Etapa E**: ¿alguien consume snapshots históricos v1 todavía? ¿adapter lazy alcanza o hay que migrar?

---

## Contexto que NO se repite en los planes

Para evitar duplicación, los planes técnicos **no** repiten:
- La explicación del modelo universal → ver `quiero-que-hablemos-de-dynamic-parrot.md`.
- El inventario actual → ver `fase-1-inventario.md`.
- La tabla de correspondencia actual→universal → ver `fase-2-mapeo.md`.
- La lista de 10 fricciones F1–F10 → ver `fase-3-fricciones.md`.
- El blast radius y hallazgos del ecosistema → ver `fase-4-ecosistema.md`.

Cada plan referencia esos docs por sección. Si al arrancar una etapa algún hecho cambió, actualizar el doc de fase correspondiente antes de ejecutar.

---

## Cómo usar estos planes en una sesión futura

**Escenario:** entrás en una sesión nueva para ejecutar Etapa X.

1. Leé `plan-tecnico-etapa-X-*.md` completo (5–15 min).
2. Leé los docs de fase que el plan referencia, sólo las secciones citadas (10–20 min).
3. Respondé las preguntas de §0 del plan con el dueño del sistema.
4. Arrancá por la primera tarea (§1.1). Marcá TodoWrite con las sub-tareas del plan.
5. Al cerrar la etapa, actualizá el estado en `project_modelo_universal_costeo.md` (memoria) con la fecha y el resumen de qué quedó listo.

Cada plan termina con una sección "**Definición de hecho**" que lista los criterios para declarar la etapa completa.

---

**Fin del índice. Procedé al plan de la etapa que corresponda.**
