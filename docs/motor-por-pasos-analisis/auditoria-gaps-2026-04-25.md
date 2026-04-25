# Auditoría comparativa PROMETIDO vs IMPLEMENTADO — Modelo Universal de Costeo

**Fecha**: 2026-04-25
**Branch**: `refactor/modelo-universal`
**Scope**: comparación exhaustiva entre la documentación (Fases A–F) y el código real (`apps/api/src/motor-universal`, `apps/api/src/productos-servicios/pasos`, `apps/api/prisma/schema.prisma`, frontend `src/components/{productos-servicios,comercial}`).

## Changelog

- **2026-04-25 (1)**: documento inicial.
- **2026-04-25 (2)**: ✅ **G-M3 cerrado** (cargos directos a nivel PASO, commit en branch). 3 tests nuevos verde. Actualizado §6 y §8.
- **2026-04-25 (3)**: nota agregada en §8: F.5 debe **eliminar Three.js** explícitamente (no opcional). G-M1 debe entregar **`<NestingViewer>` SVG único** reusable por todos los algoritmos (shelf-rollo, grid-2d-single/multi, talonario-grouping). Reemplaza cualquier vista de nesting basada en WebGL/Three.js que quede.
- **2026-04-25 (5)**: ✅ **G-M1 cerrado** (nesting al motor + viewer SVG único).
  - Backend: nuevo `nesting-dispatcher.ts` que conecta `shelf-rollo` (gran formato) y `grid-2d-single` (digital) al motor cuando `mecanismoCantidad = CALCULADO_POR_PASO`. Devuelve cantidad real con desperdicio.
  - Vinilo (caso real): cotización de 3 paños 2×1m en rollo 1.37m pasa de 60min (m² crudos) a ~98min (8.26 m² reales con desperdicio del rollo). **Sub-cobro silencioso del nesting cerrado.**
  - `PasoEjecutado.nestingResult` propaga substrates + placements + métricas al frontend.
  - Frontend: nuevo `<NestingViewer>` SVG **único reusable** por todos los algoritmos (shelf-rollo, grid-2d-single, grid-2d-multi futuro). Renderiza el sustrato (rollo o pliego) + placements con color por pieceId + labels de medida. Integrado en `cotizador-view.tsx` como sección colapsable "Visualización de nesting".
  - 3 tests nuevos: vinilo end-to-end con shelf-rollo + dispatcher unitario grid-2d-single + dispatcher devuelve null para familia no soportada (mantiene fallback).
  - **Pendiente para G-M2**: tarjetas con `pre_prensa` HEREDAR_DEL_OUTPUT_CANONICO requiere outputs canónicos reales. El dispatcher ya soporta grid-2d-single, falta el wiring desde `pre_prensa` que escriba `pliegos_calculados` al jobContext.
  - 110/110 tests verde.
- **2026-04-25 (4)**: ✅ **F.5 cerrado** (cleanup pre-v2). 5811 LOC eliminadas:
  - `src/components/plotter-simulator.tsx` (huérfano, único consumidor de Three.js).
  - `src/components/vinyl-cut-nesting-workspace.tsx` (276 LOC, viewer legacy reemplazado por el `<NestingViewer>` único de G-M1).
  - `src/components/costos/procesos-panel.tsx` (4471 LOC del modelo viejo de Procesos).
  - `src/lib/{procesos-api,procesos-templates,procesos,proceso-operacion-values}.ts` (1064 LOC del cliente del modelo viejo).
  - Deps `three`, `@react-three/fiber`, `@react-three/drei` desinstaladas (52 paquetes).
  - `apps/api/dist/` destrackeado de git (anti-patrón) + agregado a `.gitignore`.
  - Test seed desfasado arreglado (`schema-crud.spec.ts`: 11 → 12 materias primas).
  Verificación: 108/108 tests verde, typecheck verde (frontend + backend), `npm run build` verde. Tag `v2.0-modelo-universal-implementado` aplicado.

---

## TL;DR

El refactor está **mucho más avanzado de lo que la memoria refleja**, pero hay **8 gaps de implementación reales** entre lo declarado en docs y lo que el motor ejecuta hoy. Ninguno bloquea el flujo end-to-end (tests 105/105 verde, motor cotiza), pero **3 son críticos** porque distorsionan el costo final:

1. **Nesting NO está conectado al motor** (F.2.13 confirmado): los algoritmos existen aislados pero `CALCULADO_POR_PASO` devuelve m² crudos sin descontar desperdicio.
2. **Outputs canónicos no se calculan ni se propagan**: `calcularOutputs()` devuelve `null` para todos. Esto bloquea `HEREDAR_DEL_OUTPUT_CANONICO` real y `EXISTS_OUTPUT`.
3. **Cargos directos a nivel PASO no se aplican** aunque el schema y la UI los soportan: el motor siempre devuelve `cargosDirectosPaso: []`.

Lo que sí está completo y es robusto: 38 familias hardcodeadas, schema Prisma V2 (50 models / 31 enums), motor de 1170 LOC con bucle a–i, evaluador JsonLogic, 3 modos de selección de material con sus 3 criterios, validaciones D.7 (4 de 5 tipos), Tab Precio preservado 100%, frontend de cotización con `piezas[]`/multiplicadores/opcionales/zonaInstalacion, editor de rutas/configs/cargos/máquinas alternativas.

---

## 1. Verificación de la discrepancia "31 vs 38 familias"

| Fuente | Conteo | Veredicto |
|---|---|---|
| Docs (Fase E §8.2 y resumen ejecutivo) | 38 familias en 9 categorías | — |
| `apps/api/src/productos-servicios/pasos/familias.ts` (`grep "^const .*: DefinicionFamilia"`) | **38** | ✅ Coincide |
| Reporte previo del agente | 31 | ❌ Era erróneo (probablemente perdió un bloque del archivo) |

**Las 38 familias verificadas en código** (orden de aparición en `familias.ts`):

`pre_prensa`, `proof`, `impresion_por_hoja`, `impresion_por_area`, `impresion_por_pieza`, `aplicacion_transfer`, `grabado_laser`, `corte_guillotina`, `plotter_corte`, `corte_laser`, `troquelado_digital`, `cnc`, `plegado`, `perforado`, `corte_manual`, `laminado`, `barniz`, `acabado_decorativo`, `pintura_superficial`, `lijado_canteado`, `encuadernado_engrapado`, `encuadernado_anillado`, `engomado_emblocado`, `armado_cajas`, `soldadura`, `ensamble_estructural`, `instalacion_electrica`, `embalaje`, `conteo_manual`, `atado_banding`, `etiquetado_manual`, `control_calidad`, `modificacion_pre`, `modificacion_post`, `envio`, `instalacion_in_situ`, `toma_medidas`, `diseno_grafico`.

Incluye `corte_manual` y `lijado_canteado` (gaps H24/H25 de Fase E ya resueltos).

---

## 2. Schema Prisma — comparación contra plan F.1

| Entidad declarada en plan F.1 | Estado en `schema.prisma` | Notas |
|---|---|---|
| `Ruta` | ✅ línea 1172 | tenant-scoped, codigo único, versión activa |
| `RutaPaso` | ✅ línea 1191 | familia + orden |
| `RutaVersion` | ✅ línea 1209 | versionado opt-in |
| `Producto` | ✅ línea 1227 | con `unidadComercial`, `modoMedidas`, `precioConfigJson` |
| `ProductoRutaAlternativa` | ✅ línea 1255 | con `esPreferida`, `reglaAutoSeleccionJson` (JsonLogic) |
| `ProductoConfigPaso` | ✅ línea 1283 | M-1, modos, multiplicadores, paramsPasoJson |
| `ProductoConfigPasoSlotMaterial` | ✅ línea 1321 | 3 modos selección, 3 criterios MOTOR_ELIGE_AUTO, 5 fórmulas, estrategiaCosto |
| `ProductoConfigPasoMaquinaCandidata` | ✅ línea 1352 | M-2 (alternativas) |
| `ProductoPasoExtra` | ✅ línea 1371 | inline al producto, no reusable |
| `CargoDirectoCatalogo` | ✅ línea 1404 | 3 modoCalculo |
| `ProductoCargoDirectoPaso` | ✅ línea 1428 | nivel PASO |
| `ProductoCargoDirectoCotizacion` | ✅ línea 1445 | nivel COTIZACIÓN |
| `Cotizacion` | ✅ línea 1464 | |
| `CotizacionItem` | ✅ línea 1487 | con campos para snapshot |

**Totales**: 50 models, 31 enums. **Bloque C completo**, sin entidades faltantes respecto al plan F.1.

**Gaps de schema vigentes**:

- **G-S1**: NO existe `ProductoSubProducto` ni `SelectorNode` (DAG topológico declarado en Fase C §4 con 3 tipos de nodo: PASO_SIMPLE / SUB_PRODUCTO / SELECTOR). El motor procesa pasos linealmente.
- **G-S2**: enum `PlantillaMaquinaria` tiene **21 valores** pero **no incluye `SOLDADORA` ni `CABINA_PINTURA`** (declaradas como pendientes en doc §6.15). Tampoco `IMPRESORA_GRAN_FORMATO_POR_AREA` (nombre canónico del doc) — se usan los más específicos `IMPRESORA_LATEX`, `IMPRESORA_UV_*`, etc.
- **G-S3**: NO existe modelo de "warnings" (D.8 explícitamente postergado).

---

## 3. Motor (`motor.service.ts`, 1170 LOC) — gaps por sub-fase F.2

| Sub-fase | Estado | Evidencia | Gap |
|---|---|---|---|
| F.2.1 — Bucle a–i por paso | ✅ Completo | líneas 280–349 | — |
| F.2.2 — Activación (OBLIGATORIO/OPCIONAL/CONDICIONAL con JsonLogic) | ✅ Completo | líneas 351–394 | — |
| F.2.3 — Mecanismo cantidad (4 modos) | 🟡 Parcial | líneas 779–821 | `HEREDAR_DEL_OUTPUT_CANONICO` lee `jobContext.cantidad` directo (placeholder, ver G-M2). `CALCULADO_POR_PASO` solo hace m² crudos (ver G-M1). |
| F.2.4 — Resolución de perfil | 🟡 Parcial | líneas 838–869 | Solo heurística "doble/simple" para `impresion_por_hoja`. Sin regla declarativa por familia (gap del MVP, no documentado). |
| F.2.5 — Materiales (3 modos × 3 criterios) | 🟡 Parcial | líneas 526–593 | `MAYOR_APROVECHAMIENTO` ordena por `anchoMm` desc en vez de correr nesting con cada candidato. `MENOR_COSTO` y `MENOR_CAPACIDAD_QUE_CUMPLA` correctos. Unidad de consumo hardcodeada `'unidad'` (línea 504). |
| F.2.6 — Multiplicadores | ✅ Completo | líneas 986–1002 + integración 426–428 | caras, tipoCopia, hojasPorLibro, dinámicos del JobContext |
| F.2.7 — Cargos directos COTIZACIÓN | ✅ Completo | líneas 880–971 | 3 modoCalculo soportados, zonas, override por producto |
| F.2.7-bis — Cargos directos PASO | ❌ **NO IMPLEMENTADO** | línea 345: `cargosDirectosPaso: []` siempre vacío | Schema y endpoints existen, motor no carga `producto.cargosDirectosPaso`. **Gap G-M3**. |
| F.2.8 — Validaciones D.7 | 🟡 Parcial | líneas 641–737 | 4 de 5 tipos OK (REQUIRES_INPUT, COMPARE, IN_RANGE, ONE_OF). `EXISTS_OUTPUT` retorna `cumple = true` sin chequear (línea 717–721). **Gap G-M4**. |
| F.2.9 — Outputs canónicos | ❌ Placeholder | líneas 1004–1015 | `calcularOutputs` devuelve `{ output: null }` para todos. Bloquea HEREDAR + EXISTS_OUTPUT + cascada entre pasos. **Gap G-M2** (crítico). |
| F.2.10 — Tarifas reales centro de costo | ✅ Completo | líneas 435–443 + `cargarTarifasMap()` | Período publicado, fallback 0 |
| F.2.11 — T-1 (fijo) | ✅ Completo | líneas 414–416 | |
| F.2.11 — T-3 (productividad perfil) | ✅ Completo | líneas 421–431 | |
| F.2.11 — T-2 (productividad propia) | ❌ Placeholder | líneas 417–420: `runMin = 0` | Falta leer `productivityValue` de `paramsPaso`. **Gap G-M5**. |
| F.2.11 — T-4 (input manual comercial) | ⚠️ No verificado | — | No aparece rama explícita en `calcularTiempo`; verificar con CORTE_LASER |
| F.2.12 — Snapshot CotizacionItem | ✅ Implementado | método `cotizarYGuardar` en `motor.service.ts` + columnas snapshot en schema | |
| F.2.13 — Nesting conectado | ❌ **NO CONECTADO** | línea 794–800 con comentario explícito "F.2.13 PENDIENTE" | Algoritmos existen en `productos-servicios/nesting/` (grid-2d-single, grid-2d-multi, shelf-rollo, talonario-grouping) pero el motor no los invoca. **Gap G-M1** (crítico). |
| Sub-productos / SELECTOR (DAG) | ❌ NO IMPLEMENTADO | comentario línea 40: "Sub-productos / selectores" como pendiente | Schema sin tabla, motor procesa lineal. **Gap G-M6**. |

---

## 4. Frontend — comparación contra plan F.4

| Pantalla declarada en plan F.4 | Estado | Archivo |
|---|---|---|
| Editor de rutas (CRUD pasos) | ✅ | `productos-servicios/ruta-form-view.tsx` (415 LOC) |
| Editor de producto + config pasos | ✅ | `productos-servicios/{producto-form-view,config-pasos-editor-view,producto-rutas-editor-view}.tsx` |
| Editor de cargos directos (catálogo + asignación) | ✅ | `productos-servicios/{cargos-directos-manager,producto-cargos-editor-view}.tsx` |
| Tab Precio | ✅ | `productos-servicios/tab-precio-editor.tsx` (preservado) |
| Cotizador comercial dinámico | ✅ | `comercial/cotizador-view.tsx` (658 LOC) |
| Selector de ruta alternativa con `★` preferida | ✅ | línea 258–270 cotizador |
| Multiplicadores (caras, tipoCopia) | ✅ | líneas 288–328 cotizador |
| Lista de piezas multi-medida (gap H7) | ✅ | líneas 330–399 cotizador |
| Activación de pasos opcionales | ✅ | líneas 401+ cotizador |
| Zona de instalación (cargo viático) | ✅ | línea 73 + 148 cotizador |
| Validación de productos | ✅ | `producto-validacion-panel.tsx` |

**Gaps de frontend vigentes**:

- **G-F1**: NO hay UI explícita para gestionar **versionado opt-in con heurística** (decisión patch vs nueva versión al guardar ruta). El schema `RutaVersion` existe pero falta el modal con sugerencias.
- **G-F2**: NO hay UI para **override de máquina/perfil al cotizar** (sub-tema 7 del plan F.4). Hoy el comercial solo elige ruta alternativa, no puede cambiar máquina M-2 candidata desde el cotizador.
- **G-F3**: NO hay UI para **carga masiva de pasos extras inline** desde el editor de producto (schema `ProductoPasoExtra` existe pero el editor de producto no lo expone).

---

## 5. Gaps Fase E (H1–H29) — estado actual

| ID | Gap declarado | Severidad | Estado en código |
|---|---|---|---|
| H4 | `modoMedidas: FIJA \| LIBRE \| COMERCIAL_ELIGE` | MEDIA | ✅ **Resuelto** — campo en `Producto` (línea 1236 schema) + `medidaDefaultAnchoMm/AltoMm` |
| H7 | `JobContext.piezas: [{cantidad, anchoMm, altoMm}]` | ALTA | ✅ **Resuelto** — `PiezaJobContextDto[]` en `cotizar.dto.ts` línea 37 + UI cotizador líneas 330–399 |
| H19 | `paramsPaso` JSON libre por paso producto | MEDIA | ✅ **Resuelto** — `paramsPasoJson Json?` en `ProductoConfigPaso` (línea 1299) y `ProductoPasoExtra` (línea 1385) |
| H21 | Cantidad efectiva ≠ pedida (warning D.8) | BAJA | ❌ Pendiente — D.8 explícitamente postergado, sin modelo de warnings |
| H24 | Familia `corte_manual` | MEDIA | ✅ Resuelto — agregada al catálogo |
| H25 | Familia `lijado_canteado` | BAJA | ✅ Resuelto — agregada al catálogo |

**Resultado**: 5 de 6 gaps de Fase E ya están cubiertos en schema/UI. Solo queda H21 (warnings, postergado).

---

## 6. Lista consolidada de gaps reales (priorizada por impacto)

### CRÍTICOS — distorsionan el costo

| ID | Gap | Donde se ve | Impacto |
|---|---|---|---|
| **G-M1** | Nesting no conectado al motor (F.2.13) | `motor.service.ts:794-800` | `CALCULADO_POR_PASO` devuelve m² crudos, sin desperdicio. Costos de gran formato e impresión por hoja **subestimados** según el formato. |
| **G-M2** | Outputs canónicos placeholder (todos `null`) | `motor.service.ts:1004-1015` | Bloquea `HEREDAR_DEL_OUTPUT_CANONICO`, `EXISTS_OUTPUT`, y la cascada entre pasos (un paso no puede leer `pliegos_calculados` del anterior). |
| ~~**G-M3**~~ | ~~Cargos directos a nivel PASO nunca se aplican~~ | ✅ **CERRADO 2026-04-25** | Implementado en `motor.service.ts` (método `aplicarCargosPaso` + include Prisma). 3 tests nuevos en `motor.spec.ts`: MONTO_FIJO_PLANO OBLIGATORIO, PORCENTAJE_SOBRE_BASE con base = subtotal del paso, OPCIONAL activado/no activado por comercial. |

### ALTOS — afectan correctitud o cobertura

| ID | Gap | Donde se ve | Impacto |
|---|---|---|---|
| **G-M5** | T-2 (productividad propia) no calcula tiempo | `motor.service.ts:417-420` | Pasos M-0 (manuales) con productividad declarada en `paramsPaso` quedan en run = 0. |
| **G-M4** | Validación EXISTS_OUTPUT siempre `true` | `motor.service.ts:717-721` | No detecta pasos sin output requerido por el siguiente. |
| **G-M6** | Sub-productos / SELECTOR (DAG) sin schema ni motor | global | Cartelería estructural con sub-componentes, packaging multi-pieza no se modela. |
| **G-S1** | Schema sin `ProductoSubProducto` | `schema.prisma` | Pre-requisito de G-M6. |

### MEDIOS — features parciales

| ID | Gap | Donde se ve | Impacto |
|---|---|---|---|
| **G-M7** | `MAYOR_APROVECHAMIENTO` solo ordena por anchoMm | `motor.service.ts:566-574` | Para slots con MOTOR_ELIGE_AUTO criterio MAYOR_APROVECHAMIENTO, elige por heurística vs nesting real. Resuelto cuando G-M1 esté listo. |
| **G-M8** | Selección automática de perfil solo soporta heurística "doble faz" | `motor.service.ts:838-869` | Familias distintas a `impresion_por_hoja` no tienen reglas declarativas para elegir perfil. |
| **G-M9** | Unidad de consumo de material hardcodeada `'unidad'` | `motor.service.ts:504` | Trazabilidad muestra unidad incorrecta (no afecta costo numérico). |
| **G-S2** | Plantillas SOLDADORA / CABINA_PINTURA pendientes en enum | `schema.prisma:113-135` | Bloquea modelado de Corporearte si tiene esos workflows. |
| **G-F1** | UI versionado opt-in sin modal heurístico | `ruta-form-view.tsx` | Schema soporta `RutaVersion`, falta UX. |
| **G-F2** | Cotizador no permite override de máquina M-2 | `cotizador-view.tsx` | Comercial solo elige ruta alternativa, no máquina concreta. |
| **G-F3** | Editor producto no expone pasos extras inline | productos-servicios | Schema `ProductoPasoExtra` existe sin UI dedicada. |

### BAJOS — postergados explícitamente

| ID | Gap | Estado |
|---|---|---|
| **G-D8** | D.8 Warnings (incluye H21 cantidad efectiva ≠ pedida) | Postergado en docs |
| **G-T4** | T-4 INPUT_MANUAL_COMERCIAL — no hay rama explícita en `calcularTiempo` | A verificar con producto que use CORTE_LASER |

---

## 7. Lo que NO está en docs pero sí en código (gaps inversos)

| Hallazgo | Detalle |
|---|---|
| Frontend tiene **panel de validación de productos** | `producto-validacion-panel.tsx` no se menciona explícitamente en plan F.3/F.4. Bonus. |
| Schema mantiene `ProductoPrecioEspecialClienteV2` con sufijo V2 | Indica migración no terminada (probablemente queda V1 colgada en otro lugar — ver F.5 cleanup). |
| Enum `PlantillaMaquinaria` incluye **21 plantillas**, mucho más que las 9 documentadas | Doc §6.15 declara 9 modeladas en detalle; el enum del schema acepta 21 valores (incluye REDONDEADORA_PUNTAS, IMPRESORA_3D, IMPRESORA_DTF*, varias UV). Sin definición de perfil/consumibles para la mayoría → en el seed solo 9 están "completas". |
| `evaluador-jsonlogic.ts` tiene su propio módulo + tests | Plan declaraba JsonLogic en evaluador único de 84 LOC; ahora es 75 LOC con su `__tests__/`. |
| `calculador-precio.ts` (194 LOC) ya integra Tab Precio con motor | Confirma F.2.x — Tab Precio integration listo (no estaba claro en docs). |

---

## 8. Roadmap recomendado post-auditoría

Reordenado por **valor de negocio + dependencias técnicas**:

### Sprint inmediato

**Orden ejecución acordado con el usuario (2026-04-25)**: G-M3 → F.5 → G-M1 → G-M2.

1. ~~**G-M3 — Cargos directos a nivel PASO**~~ ✅ **CERRADO 2026-04-25**
   - Reutiliza helpers existentes (`evaluarActivacionCargo`, `calcularMontoCargo`).
   - Base de PORCENTAJE_SOBRE_BASE = subtotal del paso (tiempo + materiales).
   - 3 tests verde: MONTO_FIJO_PLANO OBLIGATORIO, PORCENTAJE 10% sobre subtotal del paso, OPCIONAL con/sin activación.

2. ~~**F.5 — Cleanup + tag v2.0**~~ ✅ **CERRADO 2026-04-25**
   - 5811 LOC legacy eliminadas (procesos-panel, plotter-simulator, vinyl-cut-nesting, lib procesos).
   - Three.js + @react-three/* desinstalados (52 paquetes).
   - `apps/api/dist/` destrackeado y agregado a `.gitignore`.
   - 108/108 tests verde + typecheck + `npm run build` verde.
   - Tag `v2.0-modelo-universal-implementado` aplicado.

3. ~~**G-M1 — Conectar nesting al motor (F.2.13)**~~ ✅ **CERRADO 2026-04-25**
   - Backend: `nesting-dispatcher.ts` conecta shelf-rollo (`impresion_por_area`, `plotter_corte`) y grid-2d-single (`impresion_por_hoja`) al motor.
   - Frontend: `<NestingViewer>` SVG único, reemplaza vinyl-cut-nesting-workspace eliminado en F.5.
   - Vinilo end-to-end con desperdicio real (60min → ~98min para 3 paños 2×1m, **sub-cobro cerrado**).
   - Talonarios + multi-medida rígidos quedan para iteración futura cuando aparezca caso real (talonarios depende de G-M2).

4. **G-M2 — Outputs canónicos reales**
   - Implementar `calcularOutputs` por familia (los 13 outputs canónicos del catálogo).
   - Propagar al `jobContext` mutado entre pasos (acumulador en `cotizar`).
   - Habilitar G-M4 (`EXISTS_OUTPUT` real) y `HEREDAR_DEL_OUTPUT_CANONICO` real (G-M2 ramifica).
   - Esfuerzo: 5–7 días (es el más invasivo).

### Sprint siguiente (2–3 semanas)

4. **G-M5 — T-2 productividad propia** (1 día).
5. **G-M8 — Selección automática de perfil con regla declarativa** por familia (2 días).
6. **G-F2 — Cotizador permite override de máquina M-2** (2–3 días).
7. **G-F1 — UI versionado opt-in con heurística** (3 días).

### Backlog (cuando aparezca caso)

8. **G-M6 + G-S1 — Sub-productos / SELECTOR (DAG)**: requiere caso real de Corporearte con cartelería estructural compuesta. Esfuerzo: 2 semanas (schema + motor + UI).
9. **G-S2 — Agregar SOLDADORA, CABINA_PINTURA al enum** + perfiles + consumibles.
10. **G-D8 — D.8 Warnings**: solo cuando aparezca caso H21 frecuente.
11. **G-M9 — Unidad de consumo real desde MateriaPrima** (medio día).
12. **G-F3 — Editor de pasos extras inline** (2 días).
13. **F.5 — Cleanup**: eliminar V1, dist/, migrations.legacy/, Three.js. (Pendiente declarado.)

---

## 9. Verificación cruzada

**Tests existentes** (ejecutar para sanity):
```bash
cd apps/api && npx jest motor-universal
cd apps/api && npx jest productos-servicios/nesting
cd apps/api && npx jest productos-servicios/reglas-seleccion
```

**Smoke test extremo a extremo** (recomendado antes de empezar Sprint inmediato):
```bash
docker start gdi-saas-postgres
cd apps/api && npm run dev   # API 3001
# Cotizar un producto seed que use impresion_por_area (vinilo)
# Verificar que la trazabilidad reporta m² SIN nesting (G-M1 evidencia).
```

**Criterio de cierre del documento**: el usuario valida la priorización de §8, decide qué entra al primer sprint, y el roadmap de §3 del handoff `modelo-universal-handoff-2026-04-19.md` queda **superado** por este doc.
