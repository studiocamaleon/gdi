# Viabilidad del modelo universal de costeo — Fase 2: Mapeo al modelo objetivo

**Fecha:** 2026-04-17
**Fase anterior:** `docs/viabilidad-modelo-universal-fase-1-inventario.md`
**Alcance:** Resolver los 6 huecos de información de Fase 1 y producir la tabla de correspondencia entre el sistema actual y el modelo universal definido en `/Users/lucasgomez/.claude/plans/quiero-que-hablemos-de-dynamic-parrot.md`.

---

## 1. Resolución de los huecos de Fase 1

### 1.1 `AlgoritmoCosto` — **DEAD CODE**

- Modelos `AlgoritmoCosto` y `ProductoVarianteAlgoritmoConfig` existen en `prisma/schema.prisma` (~line 1962 y ~line 1978) **pero no tienen ningún consumidor** en el código: cero referencias en services, controllers, DTOs, seed, frontend.
- Candidato para cleanup al final de la migración. No afecta la viabilidad.

### 1.2 Método vigente de cotización digital — **ÚNICA IMPLEMENTACIÓN**

- Existen 4 métodos `quote*Variant` activos en `productos-servicios.service.ts`:
  - `quoteRigidPrintedVariant` (~line 639)
  - `quoteTalonarioVariant` (~line 1821)
  - `quoteDigitalVariant` (~line 5958) — **único método digital**
  - `quoteVinylCutVariant` (~line 7874)
- No hay duplicación ni dead paths. La zona 7758 que había mencionado el agente de Fase 1 fue un malentendido.
- Wide-format no tiene método propio; el motor está registrado pero es stub (`hasProductConfig: true` solamente).

### 1.3 Tests automatizados — **COBERTURA PARCIAL, GAP CRÍTICO**

- Backend: 48 tests en `apps/api/src/productos-servicios/productos-servicios.service.spec.ts` + `apps/api/src/procesos/proceso-productividad.engine.spec.ts`. Cubren cálculos auxiliares (consumibles, timing, redondeadora, perforadora, efectos de adicionales) y productividad.
- **Los métodos `quote*Variant` no están cubiertos por tests unitarios.** Hoy la única verificación de la cotización completa es manual.
- Frontend: **cero tests**. No hay config Jest/Vitest en `src/`.
- Consecuencia para la viabilidad: **antes de migrar cualquier motor, hay que construir una suite de regresión sobre los métodos actuales** (golden outputs sobre variantes reales). Es un esfuerzo de Fase 5 (estrategia de migración) no opcional.

### 1.4 Estrategia de costeo en rigid-printed — **Config JSON editable**

- Campo: `ProductoMotorConfig.parametrosJson.imposicion.estrategiaCosteo`.
- Valores: `m2_exacto` | `largo_consumido` | `segmentos_placa`.
- Default hardcoded: `segmentos_placa` (línea 708 del service).
- Editable desde el frontend vía formulario JSON genérico (no hay UI dedicada). El dueño del sistema la elige al configurar el producto.
- En el modelo universal encaja como parametrización del tipo de paso `impresion_por_pieza` (elección de fórmula de costeo dentro de la plantilla).

### 1.5 Volumen de snapshots — **Write-only, todas v1**

- `CotizacionProductoSnapshot` se persiste en 6 lugares distintos del service (siempre vía `create`, nunca `delete`/`update`).
- Lectura: `getVarianteCotizacionesBase()` (~line 8219) y `getCotizacionById()` (~line 8245).
- Índices en `(tenantId, productoServicioId, createdAt)` y `(tenantId, motorCodigo, motorVersion, createdAt)`.
- `motorVersion = 1` para todos los motores; no conviven múltiples versiones.
- Migración `20260325103000_add_producto_servicio_snapshot_for_wide_format` añadió columna `productoServicioId` (nullable) pero no cambió el shape de `resultadoJson`.
- Volumen real requiere query en DB viva (no resoluble read-only sobre código). Conservar este dato como pendiente para Fase 5.

### 1.6 Relación procesos/ ↔ motores — **ProcesoOperacion es fuente única de verdad**

**Hallazgo más importante para la viabilidad.**

- Los motores leen `ProcesoOperacion` directamente vía Prisma — no construyen equivalentes JSON propios.
- Extraen campos ya canónicos: `setupMin`, `runMin`, `cleanupMin`, `tiempoFijoMin`, `multiplicadorDobleFaz` (líneas ~1332–1333 del service).
- Invocan `evaluateProductividad()` de `apps/api/src/procesos/proceso-productividad.engine.ts` (líneas 89–109 del engine) pasando `op.productividadBase`, `op.reglaVelocidadJson`, `op.reglaMermaJson`, `op.runMin`.
- Ruta de datos: `ProductoVariante.procesoDefinicionId` → `ProcesoDefinicion.operaciones[]` → motor consume directamente.
- No hay resolver ni matcher: la integración es por ID, no por JSON intermedio.

**Implicación:** el modelo canónico de paso del sistema universal ya existe como `ProcesoOperacion`. El mayor rediseño estructural no es "inventar el paso" sino "enriquecer el paso con inputs/outputs/unidad productiva/activación/cargos flat".

---

## 2. Tabla de correspondencia — actual → modelo universal

### 2.1 Motores → familias de paso

| Motor actual | Familias universales equivalentes | Observaciones |
|---|---|---|
| `impresion_digital_laser@1` | `impresion_por_hoja` | Un único paso principal + posibles acabados (si la ruta del producto los incluye). |
| `rigidos_impresos@1` | `impresion_por_pieza` + `corte` | El nesting es parámetro del paso de impresión. El troquelado es un paso siguiente. |
| `talonario@1` | `impresion_por_hoja` + `corte` + `encuadernado` + `operacion_manual` | Modela una ruta completa con múltiples pasos que hoy están amalgamados en un único método. |
| `vinilo_de_corte@1` | `corte` | Ploteo de corte es una instancia de la familia `corte` con config específica. La pre-prensa y la selección de material son reglas de selección. |
| `gran_formato@1` (stub) | `impresion_por_area` | No hay código legacy que migrar. **Piloto ideal** para implementar directamente sobre el modelo nuevo. |

### 2.2 Subtotales actuales → buckets del modelo universal

| Subtotal actual | Bucket universal | Vía |
|---|---|---|
| `procesos` | `centroCosto` | Directo: es tiempo × tarifa del centro de costo del paso |
| `papel`, `material`, `toner`, `tinta`, `desgaste`, `consumiblesTerminacion` | `materiasPrimas` | Todos son consumos de material del paso de impresión. Se agregan al bucket de materias primas del paso correspondiente. |
| `adicionalesMateriales` | `materiasPrimas` | Vía `ProductoAdicionalEfecto.MATERIAL_EFFECT` que dispara `ProductoAdicionalMaterialEffect`. Se atribuye al paso opcional que lo genera. |
| `adicionalesCostEffects` | `cargosFlat` | Vía `ProductoAdicionalEfecto.COST_EFFECT` que dispara `ProductoAdicionalCostEffect`. Monto monetario flat atribuido al paso opcional. |
| (implícito: setup machine time) | `centroCosto.setup` | Ya existe como `ProcesoOperacion.setupMin`. |
| (implícito: cleanup/desmontaje) | `centroCosto.cleanup` | Ya existe como `ProcesoOperacion.cleanupMin`. |

**Hallazgo clave:** los 3 tipos de `ProductoAdicionalEfecto` (ROUTE_EFFECT, MATERIAL_EFFECT, COST_EFFECT) **corresponden 1:1** con los 3 buckets del modelo universal (centroCosto, materiasPrimas, cargosFlat). La traducción es lossless.

### 2.3 Reglas hardcoded → reglas de selección

| Regla actual | Ubicación | Encaja como regla de selección |
|---|---|---|
| Matching `tipoImpresion + caras → máquina/perfil` (digital) | `quoteDigitalVariant`, hardcoded + `configuracionesImpresion` | Sí: dominio=centroCosto, inputs=(tipoImpresion, caras) |
| `pliegos = ceil(cantidad/piezasPorPliego)` | Todos los motores de impresión | No es regla: es parámetro del paso (fórmula en la plantilla) |
| Merma adicional por tipo de papel | `quoteDigitalVariant` | Sí: dominio=parametro `merma`, inputs=(tipoPapel) |
| Nesting rectangular grid (rigid-printed) | `rigid-printed.calculations.ts` | No es regla: es cálculo interno del paso (imposición como parámetro) |
| 3 estrategias de costeo (rigid-printed) | `productoMotorConfig.parametrosJson.imposicion.estrategiaCosteo` | Ya es parametrización (no regla). En modelo universal sigue como parámetro del tipo de paso. |
| Rotación automática (rigid-printed) | `nestRectangularGrid()` | No es regla: es optimización interna del cálculo de imposición |
| Definiciones de copias (talonario) | Config + hardcoded en motor | Sí: dominio=composicion, inputs=(tipoCopia) → capas, papeles, numeración |
| Modo talonario incompleto (`aprovechar_pliego` vs `pose_completa`) | Motor talonario | Sí: dominio=parametro `modoAprovechamiento`, inputs=(cantidad, piezasPorPliego) |
| Selección `material+plotter` por menor costo (vinyl-cut) | `quoteVinylCutVariant` | Sí: dominio=(centroCosto + material), inputs=(medidas, colores) → evalúa candidatos y elige el más barato |
| Fallback `estrategiaCosteo = 'segmentos_placa'` | Línea 708 service | Es default de regla, no regla en sí |

**Patrón que emerge:** la mayoría de las "reglas hardcoded" hoy son una mezcla de **parametrización del paso** (fórmulas fijas con parámetros configurables) y **selección dinámica** (elegir máquina/material según inputs). El modelo universal las separa limpiamente: la parametrización queda en la plantilla de familia, la selección dinámica se declara como Regla de Selección.

### 2.4 Entidades Prisma → entidades del modelo universal

| Entidad actual | Entidad universal | Acción de migración |
|---|---|---|
| `ProductoServicio` | Producto | Reutilizar (agregar flag `esComponente` si se implementa producto anidado) |
| `ProductoVariante` | Variante de producto | Reutilizar |
| `GranFormatoVariante` | Variante de producto (sin subtipo) | Consolidar en `ProductoVariante` + config del motor |
| `ProductoRutaPolicy` | Política de ruta (variantes comparten vs divergen) | Reutilizar con ajustes |
| `ProcesoDefinicion` | Ruta de producción (DAG en el futuro) | Reutilizar; agregar soporte de dependencias explícitas entre `ProcesoOperacion` para habilitar DAG |
| **`ProcesoOperacion`** | **Paso** | **Reutilizar como núcleo.** Agregar: `leeDelTrabajo`, `leeDePasos`, `produce`, `unidadProductiva`, `activacion` (opcional/condicional), referencia a familia |
| `ProductoMotorConfig` | Config de producto por familia | Transformar: de JSON con shape por motor a JSON con shape por familia |
| `ProductoVarianteMotorOverride` | Override de variante | Idem |
| `ProductoAdicionalCatalogo` | Paso opcional | Ya tiene `metodoCosto`, `centroCostoId`. Reutilizar; ahora cada adicional es un paso con `activacion: opcional` |
| `ProductoAdicionalMaterial` | Consumo de material de paso opcional | Reutilizable |
| `ProductoAdicionalEfecto` (ROUTE/MATERIAL/COST) | Efecto atómico sobre bucket del paso | **Ya es 1:1 con los 3 buckets.** Se preserva directo. |
| `ProductoAdicionalRouteEffectPaso` | Operación activada por paso opcional | Reutilizable (apunta a `ProcesoOperacion`) |
| `ProductoAdicionalCostEffect` | Cargo flat del paso opcional | Reutilizable |
| `ProductoAdicionalMaterialEffect` | Consumo material del paso opcional | Reutilizable |
| `ProductoChecklist` + `ProductoChecklistPregunta` | UI de configuración guiada | Reutilizable como "entrada del Job Context" (decisiones del cliente) |
| `ProductoChecklistRegla` + `ProductoChecklistReglaNivel` | **Regla de Selección** | Refactor: generalizar la estructura (hoy es tabla-driven con niveles, el modelo universal pide dominio/inputs/casos) |
| `CotizacionProductoSnapshot` | Snapshot de cotización | Reutilizable; el `resultadoJson` nuevo será la salida canónica del §7 del modelo. Los snapshots viejos quedan como "motorVersion=1 legacy" sólo lectura. |
| `CotizacionChecklistRespuestaSnapshot` | Snapshot de entradas del Job Context | Reutilizable |
| `CentroCosto`, `CentroCostoRecurso`, `CentroCostoTarifaPeriodo` | Catálogo de centros de costo + tarifado | **Reutilizable 1:1** |
| `MateriaPrima`, `MateriaPrimaVariante` | Catálogo de materias primas | **Reutilizable 1:1** |
| `AlgoritmoCosto`, `ProductoVarianteAlgoritmoConfig` | — | **Descartar** (dead code) |
| (no existe) | Familia de paso | Nueva entidad o catálogo enum |
| (no existe) | Regla de Selección generalizada | Nueva entidad (puede derivarse de `ProductoChecklistRegla` extendida) |
| (no existe) | Producto componente (flag o relación) | Nueva relación |
| (no existe) | Dependencias entre pasos (DAG) | Nueva relación en `ProcesoOperacion` |

### 2.5 Job Context — de dónde sale cada variable hoy

| Variable del Job Context | De dónde viene hoy | Comentario |
|---|---|---|
| `cantidad` | Payload de cotización (`CotizarProductoVarianteDto`) | Directo |
| `colores`, `caras`, `tipoImpresion` | `seleccionesBase` del payload o `checklistRespuestas` | Depende del motor |
| `medidas` (ancho, alto) | `ProductoVariante` o payload | Variante o override |
| `tipoCopia` (talonario) | `productoMotorConfig.tipoCopiaDefiniciones` + payload | Config + selección |
| `checklistRespuestas` | Payload | Entradas del cliente vía UI guiada |
| `opcionalesSeleccionados`, `nivelesSeleccionados` | Payload (adicionales) | Activación de pasos opcionales |
| `periodo` | Payload | Determina tarifa aplicable |

**Implicación:** el Job Context del modelo universal ya existe de facto — está disperso entre `variante`, `payload de cotización` y `checklistRespuestas`. Consolidarlo es reshuffle, no creación.

---

## 3. Lo que el sistema actual ya tiene listo para el modelo universal

Resumen de hallazgos positivos (bajo riesgo / esfuerzo contenido):

1. **Contrato del paso:** `ProcesoOperacion` tiene setup/run/cleanup/productividad/merma/centroCosto. Sólo falta enriquecer con inputs/outputs/unidadProductiva/activación.
2. **3 buckets:** `ProductoAdicionalEfecto` con ROUTE/MATERIAL/COST ya hace la distinción. Los motores ya emiten subtotales separados.
3. **Contrato de motor:** `ProductMotorModule` + `ProductMotorRegistry` ya son interfaz estándar. Falta unificar el shape del resultado.
4. **Snapshot histórico:** `CotizacionProductoSnapshot` con `motorVersion` permite convivencia de motor-viejo y modelo-nuevo (v1 y v2 coexisten en la misma tabla).
5. **Reglas declarativas básicas:** `ProductoChecklistRegla` + `ReglaNivel` implementan decisiones tabulares. Extenderlas a Regla de Selección general es posible sin crear entidad nueva.
6. **Catálogos transversales:** centros de costo, materias primas, tarifas por período son independientes del motor y se reutilizan 1:1.
7. **Motor gran formato (stub):** permite implementar directo sobre el modelo nuevo sin migrar legacy.
8. **Blast radius contenido:** sin consumidores externos al módulo productos-servicios.

---

## 4. Lo que no tiene correspondencia directa (fricciones para Fase 3)

Lista de cosas del modelo universal que no existen en el sistema actual y van a requerir diseño en Fase 3:

1. **Familia de paso como entidad/catálogo:** hoy los tipos están implícitos en los motores. Hay que decidir si es tabla, enum, o config declarativa.
2. **Inputs/outputs semánticos del paso:** hoy los pasos consumen "lo que haya en el contexto del motor" sin declaración formal. Hay que diseñar el contrato `leeDelTrabajo`, `leeDePasos`, `produce`.
3. **Unidad productiva por paso:** no existe — cada motor implícitamente asume cantidad = cantidad del trabajo. Hay que introducirla.
4. **Activación condicional:** hoy los pasos son "en la ruta = activo"; los opcionales vienen sólo de adicionales. Hay que generalizar activación.
5. **Ruta como DAG:** hoy `ProcesoOperacion.orden` presupone lista lineal. Hay que agregar dependencias explícitas.
6. **Productos componentes:** no existen. Decisión: ¿self-reference en `ProductoServicio` con flag `esComponente`?
7. **Regla de Selección generalizada:** hoy está acoplada al flujo de checklist. Hay que extraerla como primitiva independiente que pueda decidir material/máquina/activación/parámetro.
8. **Editor visual de grafo:** no existe; hoy la configuración es por lista + formularios por tab. Requiere spike técnico (React Flow / Rete.js).
9. **Cobertura de tests:** los `quote*Variant` no tienen tests. Migrar sin red de seguridad es inviable → construir golden-output suite antes.
10. **Dos shapes de resultado divergentes (digital-like vs gran-formato):** `CotizacionProductoVariante` vs `GranFormatoCostosResponse`. Unificar es el mayor rework de frontend.

Estas 10 fricciones son el input de Fase 3.

---

## 5. Veredicto preliminar de viabilidad (provisorio)

**Señales verdes fuertes:**
- Modelo canónico de paso ya implementado (`ProcesoOperacion`).
- 3 buckets ya traducen 1:1 vía `ProductoAdicionalEfecto`.
- Blast radius contenido al módulo.
- Motor gran formato stub como piloto natural sin deuda.
- Snapshots versionados permiten convivencia.

**Señales amarillas que condicionan la viabilidad:**
- **Tests ausentes en los `quote*Variant`** → migración a ciegas es inviable; construir suite golden es prerrequisito.
- **Frontend con 2 shapes divergentes** → rework material de UI en `digital-simular-costo-tab`, `wide-format-simular-costo-tab` y helpers (cc. 500 LOC).
- **Service monolítico de 17.632 líneas** → extracciones por motor son quirúrgicas; riesgo de tocar lógica ajena.
- **Volumen de snapshots desconocido** → impacta la estrategia (compatibilidad lectura vs re-snapshotting).

**Señales rojas:** ninguna detectada hasta ahora. Las fricciones son de diseño / rework, no bloqueantes.

**Conclusión preliminar:** **Viable**. La migración es grande pero la arquitectura actual no opone resistencia fundamental; de hecho, la mayor parte del modelo canónico ya está presente. Los riesgos principales son operativos (tests, monolito de 17K líneas) no conceptuales.

Este veredicto es provisorio. Se confirma o ajusta en la Fase 6 tras cerrar Fase 3 (fricciones detalladas), Fase 4 (ecosistema y dependencias) y Fase 5 (estrategia de migración).

---

## 6. Siguiente paso — Fase 3: Análisis de fricción

Tomar las 10 fricciones de §4 y desarrollarlas: para cada una, severidad (menor / mayor / bloqueante), esfuerzo estimado (talla camisa), estrategia tentativa, y dependencias con otras fricciones.

Salida: `docs/viabilidad-modelo-universal-fase-3-fricciones.md`.
