# Viabilidad del modelo universal de costeo — Fase 1: Inventario del estado actual

**Fecha:** 2026-04-17
**Alcance:** Mapeo read-only de lo implementado hoy en el sistema, como insumo para evaluar la viabilidad de migrar al modelo universal definido en `/Users/lucasgomez/.claude/plans/quiero-que-hablemos-de-dynamic-parrot.md`.
**Método:** Tres agentes de exploración en paralelo (backend de motores, frontend consumidor, datos + APIs). Este documento consolida sus hallazgos.

---

## 1. Backend — motores de costeo

El sistema tiene hoy **5 motores registrados** en `ProductMotorRegistry`, 4 completos y 1 stub.

| Motor | Código | Archivo wrapper | Método principal | Estado |
|---|---|---|---|---|
| Digital / Láser | `impresion_digital_laser@1` | `apps/api/src/productos-servicios/motors/digital-sheet.motor.ts` | `quoteDigitalVariant` (en service ~line 5958) | Completo |
| Rígidos impresos | `rigidos_impresos@1` | `motors/rigid-printed.motor.ts` | `quoteRigidPrintedVariant` (~line 639) | Completo |
| Talonario | `talonario@1` | `motors/talonario.motor.ts` | `quoteTalonarioVariant` (~line 1821) | Completo |
| Vinilo de corte | `vinilo_de_corte@1` | `motors/vinyl-cut.motor.ts` | `quoteVinylCutVariant` (~line 7874) | Completo |
| Gran formato | `gran_formato@1` | `motors/wide-format.motor.ts` | — | **Stub** (sólo `hasProductConfig`) |

### 1.1 Matriz de motores × 7 dimensiones del contrato del paso

**Leyenda:** en la columna "outputs" agrupo los subtotales que emite cada motor — muestran la heterogeneidad actual, que es el costo de migración más visible.

| Dimensión | Digital | Rígidos impresos | Talonario | Vinilo corte |
|---|---|---|---|---|
| **Productos** | hojas digitales (A4/A3/SRA3), cartulinas | PVC, MDF, composite, sintra | talonarios (simple/duplicado/triplicado/cuadruplicado) | vinilos adhesivos de corte mono/multicolor |
| **Pasos implícitos** | pre-prensa, impresión, corte, acabados (troquelado/plegado/encuad.) | pre-prensa, impresión UV o flexible montado, nesting/troquelado, acabados | pre-prensa, impresión, corte, numeración, encuadernación, puntillado | pre-prensa (selección material+plotter), ploteo/corte, laminado opcional |
| **Inputs del trabajo** | `cantidad, colores, caras, tipoImpresion, anchoMm, altoMm, checklistRespuestas` | `cantidad, anchoMm, altoMm, placaVarianteId, tipoImpresion, caras`, imposición | `cantidad, tipoCopia, anchoMm, altoMm, encuadernacion, puntillado, numeracion, materialesExtra` | `cantidad, medidas[] {ancho, alto, cantidad, rotacionPermitida}, colores, unidadComercial` |
| **Outputs / subtotales** | `procesos, papel, toner, desgaste, consumiblesTerminacion, adicionalesMateriales, adicionalesCostEffects` | `procesos, material, toner, desgaste, consumiblesTerminacion, adicionalesMateriales, adicionalesCostEffects` | `procesos, papel, toner, tinta, desgaste, adicionalesMateriales, adicionalesCostEffects` | `procesos, papel, toner, desgaste, consumiblesTerminacion, adicionalesMateriales, adicionalesCostEffects` |
| **Reglas hardcoded** | matching `tipoImpresion+caras → máquina`, `pliegos = ceil(cantidad/piezasPorPliego)`, merma por tipo de papel, conversión g/m² | nesting rectangular grid, 3 estrategias de costeo (`m2_exacto` / `largo_consumido` / `segmentos_placa`), rotación automática, consumibles por m² | definiciones de copias (capas, papeles por tipo), modo incompleto (`aprovechar_pliego` vs `pose_completa`), distribución de numeración, consumo de grapas | selección `material+plotter` por menor costo total, cálculo por color (cada color = rollo/pliego), conversión unitario por ml/m² |
| **Configs externas** | `configuracionesImpresion[] (nuevo modelo)`, fallback `detalleJson.matchingBase/pasosFijos`, `ProductoChecklist`, `tarifasRevisionCentroCostoPeriodo` | `productoMotorConfig.parametrosJson {tiposImpresion, imposicion, materiales, variantesCompatibles}` | `productoMotorConfig {tamanoPliegoImpresion, tipoCopiaDefiniciones, encuadernacion, puntillado, numeracion}` + `productoVarianteMotorOverride` | `productoMotorConfig {materialBaseId, plottersCompatibles, perfilesCompatibles, medidas, criterioSeleccionMaterial}` |
| **Trazabilidad emitida** | `imposicion {piezasPorPliego, pliegosNecesarios}, conversionPapel, matchingBaseAplicado` | `estrategiaCosteo, costeoDetalle, resumenTecnico {placasNecesarias, aprovechamientoPct, piezasPorPlaca, rotada}` | `imposicion {piezasPorPliego, cols, rows}, composicion {tipoCopia, capas, papeles}, numeracionBloques` | `resumenTecnico {largoConsumidoMl, areaConsumidaM2, totalPiezas}, coloresResumen, nestingPreview` |

### 1.2 Infraestructura compartida entre motores

- **Contrato:** `apps/api/src/productos-servicios/motors/product-motor.contract.ts` (`ProductMotorModule`). Métodos: `getProductConfig`, `upsertProductConfig`, `getVariantOverride`, `upsertVariantOverride`, `quoteVariant`, `previewVariant`. **Esta es ya la semilla del contrato universal** — sólo falta que el resultado sea unificado.
- **Registro:** `motors/product-motor.registry.ts`. Mapeo código → módulo. Agregar un motor nuevo es barato.
- **Cálculo de adicionales:** checklist-driven. `ProductoChecklist` + `checklistRespuestas` + `ProductoChecklistRegla` con `TipoAccion` que dispara pasos, costos o materiales. Los subtotales `adicionalesMateriales` y `adicionalesCostEffects` ya existen como categorías separadas en todos los motores.

---

## 2. Frontend — consumidores y configuradores

### 2.1 Consumidores directos de cotización

| Componente | Archivo | Contrato consumido | Acoplamiento |
|---|---|---|---|
| Simular costo digital | `src/components/productos-servicios/motors/digital-simular-costo-tab.tsx` | `CotizacionProductoVariante` (bloques.procesos, bloques.materiales, subtotales con nombres exactos, trazabilidad) | **ALTO** — itera directamente `bloques.procesos[]` |
| Simular costo gran formato | `src/components/productos-servicios/motors/wide-format-simular-costo-tab.tsx` | `GranFormatoCostosResponse` (resumenTecnico, gruposTrabajo, materiasPrimas, centrosCosto, nestingPreview, mutacionesAplicadas, candidatos) | **ALTO** — 200+ líneas asumiendo shape gran-formato |
| Simular venta (comercial) | `src/components/productos-servicios/producto-simular-venta-tab.tsx` | `simularPrecioComercial({precio, costoTotal, cantidad}) → SimulacionComercialResultado` | **BAJO** — agnóstico del motor; lee `costoTotal` agregado |
| Precio (configurador) | `src/components/productos-servicios/producto-precio-tab.tsx` | `ProductoPrecioConfig` (no consume resultado de cotización) | **NULO** (agnóstico) |

### 2.2 Configuradores por motor (tabs específicos)

- **Variantes:** digital (`motors/digital-variantes-tab.tsx`), talonario (`motors/talonario-variantes-tab.tsx`); el resto hereda tab base.
- **Ruta base:** digital (`motors/digital-ruta-base-tab.tsx`), wide-format (`motors/wide-format-ruta-base-tab.tsx`), y un **genérico universal** (`producto-ruta-base-tab.tsx`) que sirve como fallback — éste último ya abstrae sobre los motores y absorbe ruta base sin asumir pasos específicos.
- **Imposición:** motor-específica en cada caso (`motors/digital-imposicion-tab.tsx`, `motors/wide-format-imposicion-tab.tsx`, `motors/rigid-printed-imposicion-tab.tsx`).
- **Checklist:** genérico universal (`producto-servicio-checklist.tsx`) + especializaciones según motor.

### 2.3 Registry de motor UI

- `productUiRegistry` en `producto-servicio-detail-shell.tsx` mapea `motorCodigo@version → ProductMotorUiContract` (lista de tabs + props).
- Motores registrados: digital, wide-format, vinyl-cut, talonario, rigid-printed.
- **Agregar un motor nuevo al frontend es barato** (registry extensible). El costo real está en el shape del resultado de cotización que cada tab asume.

### 2.4 Types centrales

Archivo: `src/lib/productos-servicios.ts` (~1183 líneas).
- `CotizacionProductoVariante` (~line 677): estructura fija de bloques/subtotales usada por digital, talonario, rigid-printed, vinyl-cut.
- `GranFormatoCostosResponse` (~line 1094): estructura radicalmente distinta, 40+ campos, anidaciones profundas. Es la mayor divergencia del ecosistema.
- `SimulacionComercialResultado` (en `productos-servicios-simulacion.ts`): contrato comercial agnóstico, ya sobrevive cualquier motor.

---

## 3. Datos y APIs

### 3.1 Modelos Prisma relacionados con costeo

**Productos / variantes:**
- `ProductoServicio` (motorCodigo, motorVersion, `detalleJson`)
- `ProductoVariante` (dimensiones, tipoImpresion, caras, referencia a `ProcesoDefinicion`)
- `GranFormatoVariante` (subtipo especializado, con máquina y perfil operativo)

**Motores / configs versionadas:**
- `ProductoMotorConfig` (parametrosJson + versionConfig monotónico; unique por tenantId × productoServicioId × motorCodigo × motorVersion × versionConfig)
- `ProductoVarianteMotorOverride` (override a nivel variante)
- `AlgoritmoCosto` + `ProductoVarianteAlgoritmoConfig` (algoritmos reutilizables con schemaJson — abstracción más fina que motor, poco usada pero existe)

**Cotizaciones históricas (crítico):**
- `CotizacionProductoSnapshot`: `inputJson`, `resultadoJson`, `total`, `periodoTarifa`, `configVersionBase`, `configVersionOverride`. **Sin schema versionado persistente**: cambios futuros de shape rompen la reproducibilidad de cálculos históricos.
- `CotizacionChecklistRespuestaSnapshot`: respuestas de checklist vinculadas a la cotización, con referencia a `ProductoChecklistReglaNivel`.

**Procesos y rutas (¡ya existe una abstracción universal incipiente!):**
- `ProcesoDefinicion` (ruta con versionado, estados borrador/publicado).
- `ProcesoOperacion` (paso individual con `setupMin, runMin, cleanupMin`, productividad FIJA/VARIABLE, merma, reglas de velocidad/merma en JSON).
- `ProcesoVersion` (snapshot histórico en `dataJson`).

> **Hallazgo clave:** `ProcesoOperacion` ya tiene los tres tramos de tiempo del contrato del paso (setup/run/cleanup). La estructura conceptual universal que diseñamos ya está parcialmente implementada en la DB — los motores simplemente no la usan de forma uniforme.

**Adicionales (ya alineados con los 3 buckets):**
- `ProductoAdicionalCatalogo` (método costo: TIME_ONLY, FIXED, etc., centroCostoId).
- `ProductoAdicionalMaterial` (consumo material: POR_UNIDAD, etc., factor, merma).
- `ProductoAdicionalEfecto` con tipos **ROUTE_EFFECT, COST_EFFECT, MATERIAL_EFFECT**.
- `ProductoAdicionalRouteEffectPaso` / `ProductoAdicionalCostEffect` / `ProductoAdicionalMaterialEffect`.

> **Hallazgo clave:** los 3 tipos de efectos de adicionales (ROUTE / COST / MATERIAL) corresponden casi 1:1 con los 3 buckets del modelo universal (centroCosto / cargosFlat / materiasPrimas). El modelo de datos ya traduce a la nueva abstracción.

**Checklists dinámicos:**
- `ProductoChecklist` + `ProductoChecklistPregunta` (encadenamiento vía `preguntaSiguienteId`).
- `ProductoChecklistRespuesta` (respuestas con código).
- `ProductoChecklistRegla` (acción: AGREGAR_COSTO, AGREGAR_OPERACION, etc., con `usaNiveles` booleano).
- `ProductoChecklistReglaNivel` (niveles jerárquicos de costo/tiempo).

**Catálogos transversales:**
- `AreaCosto`, `CentroCosto`, `CentroCostoRecurso`, `CentroCostoRecursoMaquinaPeriodo`, `CentroCostoComponenteCostoPeriodo`, `CentroCostoCapacidadPeriodo`, `CentroCostoTarifaPeriodo`.
- `MateriaPrima`, `MateriaPrimaVariante`, `Maquina`, `Empleado`.

### 3.2 Endpoints clave

**Cotización (cálculo):**
- `POST /productos-servicios/:id/rigidos-impresos/cotizar`
- `POST /productos-servicios/variantes/:varianteId/cotizar` (genérico por motor)
- `POST /productos-servicios/:id/gran-formato-costos/preview` (preview sin persistir)
- `POST /productos-servicios/variantes/:varianteId/imposicion-preview`

**Config de motor:**
- `GET/PUT /productos-servicios/:id/motor-config`
- `GET/PUT /productos-servicios/variantes/:varianteId/motor-override`

**Lectura histórica:**
- `GET /productos-servicios/:id/cotizaciones`
- `GET /productos-servicios/variantes/:varianteId/cotizaciones`
- `GET /productos-servicios/cotizaciones/:snapshotId`

**Costos / centros (catálogos):**
- CRUD de plantas, áreas, centros de costo.
- Configuración periodo-específica: recursos, componentes-costo, capacidad, recursos-maquinaria.
- Cálculo y publicación de tarifas: `POST centros-costo/:id/calcular-tarifa?periodo=X`, `POST centros-costo/:id/publicar-tarifa?periodo=X`.

### 3.3 Consumidores externos

**No se detectaron** consumidores del API de cotización en módulos de órdenes, facturación, reportes o inventario en la exploración read-only. Hay módulo `inventario` presente pero sin referencias cruzadas visibles al costeo.

> Esto significa que el "blast radius" de cambiar el shape de cotización está **contenido al propio módulo de productos-servicios + frontend de costeo** — dato favorable para la viabilidad.

---

## 4. Hallazgos consolidados

Ordeno de más estructural a más táctico:

**H1. El modelo conceptual universal ya tiene semilla en el sistema actual.**
- `ProcesoDefinicion` + `ProcesoOperacion` ya modelan pasos con `setupMin/runMin/cleanupMin`, productividad, merma y centro de costo asociado. Es casi isomorfo al contrato del paso del modelo universal.
- Los motores lo usan parcialmente o lo ignoran, construyendo su propia versión en JSON.

**H2. Los 3 buckets del modelo universal ya existen en los efectos de adicionales.**
`ROUTE_EFFECT → centroCosto`, `COST_EFFECT → cargosFlat`, `MATERIAL_EFFECT → materiasPrimas`. El modelo de datos ya traduce.

**H3. El `ProductMotorModule` contract es casi el contrato universal.**
Todos los motores implementan la misma interfaz (`quoteVariant`, `previewVariant`, `getProductConfig`, …). Lo que varía es la **shape interna del resultado**. Si unificamos la shape del resultado, el contrato ya está.

**H4. La persistencia histórica es frágil.**
`CotizacionProductoSnapshot.resultadoJson` no tiene schema versionado. Migrar a un nuevo modelo exige:
- Una de dos: (a) mantener los snapshots viejos como "cálculo legacy no reproducible" sólo lectura, (b) exportar y re-snapshottear con el nuevo formato.
- La versión del motor (`motorVersion`) permitiría discriminar pero requiere política explícita.

**H5. El frontend tiene 2 contratos divergentes (`CotizacionProductoVariante` vs `GranFormatoCostosResponse`).**
Unificarlos es el mayor rework de frontend. Los componentes universales (`producto-simular-venta-tab`, `producto-precio-tab`, `producto-ruta-base-tab` genérico) sobrevivirán la migración sin cambios.

**H6. Gran formato es stub.**
Hay una oportunidad: implementar directamente sobre el nuevo modelo, sin migrar código legacy. Puede ser el **piloto natural** de la Fase 5 (estrategia de migración).

**H7. Los consumidores del API de cotización están contenidos.**
No hay cross-module coupling detectado con órdenes/facturación/inventario/reportes. Blast radius del refactor es local al módulo de productos-servicios.

**H8. El checklist con reglas es un motor de "selección" primitivo.**
`ProductoChecklistRegla` + `ProductoChecklistReglaNivel` ya implementan decisiones por respuesta, con soporte de niveles/tiers. Es la semilla de las Reglas de Selección del modelo universal — sólo está acoplado al flujo de checklist y no generalizado.

**H9. Hay un contrato de algoritmos aparte (`AlgoritmoCosto`).**
Existe una abstracción adicional (`AlgoritmoCosto` + `ProductoVarianteAlgoritmoConfig`) con `schemaJson` versionado, poco usada, que sugiere que ya hubo un intento previo de generalizar. Conviene revisar por qué no se consolidó antes de proponer una tercera abstracción.

**H10. Tres estrategias de costeo en rígidos (`m2_exacto`, `largo_consumido`, `segmentos_placa`) son reglas hardcoded con config numérica.**
Equivalente a "fórmula seleccionable" — encaja perfecto en el modelo híbrido (config parametrizable con fórmulas predeclaradas del tipo de paso).

---

## 5. Huecos de información para la Fase 2

Cosas que no quedaron claras en el inventario read-only y que la Fase 2 necesita resolver antes de avanzar:

- **Nivel de uso real de `AlgoritmoCosto`**: ¿está activo en producción o es legacy? Leer código consumidor.
- **Volumen de snapshots históricos**: cuántos registros hay en `CotizacionProductoSnapshot`, cuán viejos, cuántos se consultan activamente. Decide la estrategia de migración de datos.
- **Regla de unicidad en rigid-printed de las 3 estrategias de costeo**: ¿dónde se decide cuál aplica? Config, checklist, variante.
- **Código real de `quoteDigitalVariant` (~line 7758 en service)**: el agente leyó la zona 7758 antes y la 5958 ahora. Aclarar cuál es el método vigente para digital vs tal vez uno legacy.
- **Existencia de tests automatizados** de cotización: el agente no los mapeó. Crítico para migración segura (regression tests).
- **Relación con el módulo de procesos** (`apps/api/src/procesos/`): aparece en git status y hay recent commits. Probablemente es donde vive `ProcesoDefinicion`/`ProcesoOperacion`. Entender cómo se articula con los motores.

---

## Siguiente paso: Fase 2 — Mapeo al modelo objetivo

Tomar la matriz de §1.1 y las tablas de §2 y §3, y producir una tabla de correspondencia:
- Cada motor actual → qué familias del modelo universal lo cubren.
- Cada subtotal actual → qué bucket del modelo universal (centroCosto / materiasPrimas / cargosFlat).
- Cada regla hardcoded → qué regla de selección declarativa.
- Cada config JSON actual → qué plantilla de familia + qué reglas.
- Cada entidad Prisma → qué entidad del modelo universal (reutilizable, transformable, a descartar).

La Fase 2 produce el documento `docs/viabilidad-modelo-universal-fase-2-mapeo.md`.
