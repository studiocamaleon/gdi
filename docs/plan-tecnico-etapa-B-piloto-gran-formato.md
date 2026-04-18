# Plan técnico — Etapa B: Piloto gran formato sobre el modelo universal

**Duración estimada:** 2–3 meses (1 persona full-time + validaciones del dueño).
**Reversibilidad:** total vía feature flag `ENABLE_WIDE_FORMAT_V2`.
**Prerrequisitos:** Etapa A completa (especialmente A.6 — endpoint `/cotizar-v2` y shape canónica).

**Objetivo de la etapa:** implementar el primer motor productivo sobre el modelo universal, aprovechando que `gran_formato@1` está stub (sin legacy que migrar). Al cerrar esta etapa, un operador interno puede cotizar productos de gran formato con el motor v2 y ver la shape canónica en una UI genérica. Si este piloto no converge con datos reales, se cancela la migración con costo contenido (≤5 meses totales desde el arranque de A).

---

## §0 — Preguntas de arranque

1. **Productos wide-format prioritarios.** ¿Cuáles son los 3–5 productos de gran formato que primero quiere soportar el dueño? (ej. banner de lona, roll-up, vinilo adhesivo impreso, back-light, mesh).
2. **Casos de validación.** 10–15 casos con valores numéricos esperados a los que el motor v2 debe converger (dimensiones + tecnología + opciones → total esperado en rango).
3. **Familias finales involucradas.** Del catálogo de A.2, cuáles se usan: `impresion_por_area`, `corte`, `laminado`, `ojalado` (si se agrega como familia nueva o se modela como `operacion_manual`), `embalaje`.
4. **Datos de máquina disponibles.** ¿Productividad real de las máquinas de gran formato (Mimaki u otras), tarifa del centro de costo, consumo de tinta por m², merma del sustrato? Necesario para instanciar las familias.

---

## §1 — Tareas

### B.1 — Diseño de las rutas de gran formato

**Entregable:** para cada producto wide-format prioritario (§0.1), documento que describe:
- Ruta de pasos (familia + nombre + orden).
- Inputs de cada paso (del Job Context y de pasos previos).
- Outputs que produce.
- Reglas de selección que se aplican.
- Pasos opcionales vs obligatorios.

**Pasos:**
1. Reunión de 2h con el dueño del sistema. Por cada producto priorizado, armar la ruta juntos sobre papel.
2. Transcribir a `docs/plan-tecnico-etapa-B-rutas-wide-format.md` (un nuevo doc hijo de éste).
3. Validar cada ruta con el dueño antes de B.2.

**Éxito:** ≥3 rutas documentadas y aprobadas por el dueño. Incluye ejemplos:
- Banner de lona con ojales: `pre_prensa → impresion_por_area → dobladillado → ojalado → embalaje`.
- Vinilo adhesivo impreso con laminado: `pre_prensa → impresion_por_area → laminado → corte → embalaje`.
- Roll-up: `pre_prensa → impresion_por_area → corte → ensamble_estructural (armado del roll-up) → embalaje`.

---

### B.2 — Implementación del motor `WideFormatMotorModuleV2`

**Entregable:** nuevo archivo `apps/api/src/productos-servicios/motors/wide-format-v2.motor.ts` que implementa `ProductMotorModule` con `quoteVariant` emitiendo shape canónica directa.

**Pasos:**
1. Skeleton del módulo con todos los métodos de `ProductMotorModule`. `quoteVariant` empieza devolviendo shape canónica con `total: 0, pasos: []`.
2. Cargar la ruta de la variante desde `ProcesoDefinicion`/`ProcesoOperacion` usando los campos extendidos de A.3 (`familia`, `leeDelTrabajo`, `produce`, `activacion`).
3. Engine de ejecución de ruta:
   - Topological sort sobre `ProcesoOperacionDependencia` si existe (agregar entidad al schema como parte de B.2 si hace falta), fallback a `orden`.
   - Por cada paso: evaluar activación (con evaluador de A.5 si es condicional).
   - Resolver reglas de selección aplicables al paso (material, centro de costo, parámetros).
   - Calcular tiempo del paso usando la fórmula de la familia + parámetros de config.
   - Calcular consumo de material del paso ídem.
   - Agregar cargos flat si corresponde (viáticos, tercerizaciones).
   - Emitir `PasoCotizado` a la lista del resultado.
4. Registrar en `ProductMotorRegistry` como `gran_formato@2`.

**Pasos concretos de implementación** (pueden necesitar ajuste):
- `apps/api/src/productos-servicios/motors/wide-format-v2.motor.ts` (~300-500 LOC).
- Engine de ruta extraído a `apps/api/src/productos-servicios/engine/route-runner.ts` (reutilizable por Etapa C).
- Resolver de reglas a `apps/api/src/productos-servicios/reglas-seleccion/resolver.ts`.

**Éxito:** motor retorna shape canónica válida para los 3+ productos de §B.1.

---

### B.3 — Validación con casos reales

**Entregable:** los 10–15 casos de §0.2 ejecutados contra el motor v2 con diferencia < 5% respecto del cálculo manual del dueño del sistema.

**Pasos:**
1. Crear fixtures `apps/api/src/productos-servicios/__fixtures__/wide-format-v2/<caso>.input.json` + `.expected.json` (con el total esperado por el dueño).
2. Test `apps/api/src/productos-servicios/wide-format-v2.spec.ts` que corre cada caso y compara.
3. Iteración: si un caso se aparta > 5%, diagnóstico con el dueño → ajustar config de familia / regla / fórmula → re-correr hasta convergencia.
4. Si algún caso es irreductible (requiere una familia o lógica que no existe), documentarlo: puede significar que el modelo necesita ajuste antes de avanzar.

**Éxito:** 100% de casos con diferencia ≤ 5% respecto del esperado manual. Cero casos marcados como "irreductibles".

**Checkpoint crítico:** si después de 2 semanas de iteración no se logra la convergencia en ≥80% de los casos, **detener la etapa** y hacer revisión del modelo universal con el dueño antes de gastar más esfuerzo.

---

### B.4 — UI "Simular costo (v2)" genérica

**Entregable:** componente `ProductoSimularCostoV2Tab` en `src/components/productos-servicios/producto-simular-costo-v2-tab.tsx` que renderiza la shape canónica de forma agnóstica del motor.

**Secciones del componente:**
- Resumen: `total`, `unitario`, 3 buckets (centro de costo, materias primas, cargos flat).
- Lista de pasos con expand/collapse por paso. Cada paso muestra: familia, nombre, centro de costo, tiempo, consumos de material, cargos flat, trazabilidad.
- Si hay sub-productos (componentes), sección con cotización recursiva expandible (implementación parcial — el modelo de productos componentes formal es de Etapa G opcional, pero el componente soporta visualizar si existen).

**Pasos:**
1. Crear el componente.
2. Reemplazar el tab `WideFormatSimularCostoTab` sólo cuando el motor v2 esté activo vía flag (§B.5).
3. Mantener el tab legacy accesible por URL para comparación visual.

**Éxito:** el operador interno puede cotizar un producto wide-format con v2 y ver el desglose completo en la UI genérica.

---

### B.5 — Feature flag de activación

**Entregable:** variable de entorno o config flag `ENABLE_WIDE_FORMAT_V2` que controla si el endpoint `/cotizar` ruta a v1 (stub) o v2 para productos con motor `gran_formato`.

**Pasos:**
1. Agregar a `apps/api/.env.example` con default `false`.
2. Lectura en el dispatcher del controller: si flag activo y motor es `gran_formato`, usar `WideFormatMotorModuleV2`; caso contrario, comportamiento actual (stub o error 501).
3. Endpoint GET `/productos-servicios/motor-status` que expone qué flags hay activos. Útil para el dashboard.

**Éxito:** al apagar el flag, todo vuelve al comportamiento pre-B. Al activarlo, gran formato cotiza con v2.

---

## §2 — Definición de hecho (criterios de cierre de Etapa B)

- [ ] B.1: ≥3 rutas documentadas y aprobadas por el dueño.
- [ ] B.2: `WideFormatMotorModuleV2` implementado, registrado, y retornando shape canónica válida.
- [ ] B.3: 10–15 casos de validación con diferencia ≤ 5% respecto del esperado manual.
- [ ] B.4: UI genérica funcionando para productos wide-format con el flag activo.
- [ ] B.5: Feature flag funcional con rollback probado (apagar flag → comportamiento pre-B).
- [ ] Golden-output suite de Etapa A sigue verde (no hay regresión en motores legacy).
- [ ] Dueño del sistema declara "confianza suficiente para avanzar a Etapa C".

**Checkpoint de decisión go/no-go:** al cerrar §1-B.5, reunión con el dueño para decidir formalmente:
- **GO** a Etapa C si los criterios se cumplen y hay confianza en el modelo.
- **Pause** si faltan convergencias pero se identifican causas manejables (Etapa C puede esperar mientras se refinan).
- **Abort** si el modelo no converge con la realidad operativa. En ese caso, no se cancela Etapa A (valor residual preservado), pero no se avanza con la migración de los 4 motores legacy.

---

## §3 — Riesgos específicos de esta etapa

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Casos de validación no convergen | Media | Iteración con el dueño; checkpoint a las 2 semanas. Si no converge, revisar modelo antes de seguir. |
| Familia faltante detectada (ej. "ojalado" no cae limpio en `operacion_manual`) | Media | Agregar familia al catálogo de A.2. Costo bajo porque es declarativo. |
| Regla de selección requiere lógica no soportada por JsonLogic | Baja | Compuerta de escape a función TS. Documentar para no repetir. |
| La UI genérica de B.4 expone que falta info en la shape canónica (ej. preview de nesting) | Media | La shape es extensible: agregar sección opcional `trazabilidadExtendida` sin romper contrato. |
| Config de gran formato actual (`GranFormatoImposicionConfig`) no mapea 1:1 a la plantilla de `impresion_por_area` | Media | Revisar en B.1; puede requerir ajuste de plantilla o regla de transformación. |

---

## §4 — Output de la etapa para etapas posteriores

Al cerrar B, las etapas siguientes tienen disponible:
- **Engine de ejecución de ruta** (`route-runner.ts`) reutilizable por todos los motores v2 de Etapa C. Gran inversión que se amortiza.
- **Resolver de reglas de selección** (`resolver.ts`) ídem.
- **UI genérica** (`ProductoSimularCostoV2Tab`) que Etapa C aprovecha para cada motor migrado.
- **Patrón de fixtures y tests** (`__fixtures__/wide-format-v2/`) replicable para C.2–C.5.
- **Feature flag pattern** replicable para los motores de Etapa C.
- **Validación del modelo:** el piloto exitoso es la señal que habilita el compromiso con las 7–12 semanas-persona restantes.

**Fin del plan de Etapa B.**
