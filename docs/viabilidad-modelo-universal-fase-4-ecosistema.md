# Viabilidad del modelo universal de costeo — Fase 4: Análisis del ecosistema

**Fecha:** 2026-04-17
**Fases anteriores:** `fase-1-inventario.md`, `fase-2-mapeo.md`, `fase-3-fricciones.md`
**Alcance:** Mapear las dependencias externas al módulo de costeo — módulos que consumen sus salidas, tablas con FK al módulo, jobs asincrónicos, integraciones externas. Objetivo: cuantificar el blast radius real del refactor.

---

## 1. Backend — dependencias cross-module

### 1.1 Imports de código

**Resultado: consumidores externos cero detectados.**

- `ProductosServiciosModule` es importado **únicamente** en `apps/api/src/app.module.ts`.
- Su servicio (`ProductosServiciosService`) no es inyectado en otros módulos del backend (`inventario/`, `costos/`, `procesos/`, `produccion/`, `clientes/`, `comercial/` — este último no existe como módulo backend, es sólo frontend).
- Los motores internos se referencian entre sí dentro del propio módulo (rigid-printed, talonario, vinyl-cut, etc.) pero no hacia afuera.

### 1.2 Relaciones de base de datos (FK externas al módulo)

**Internas al módulo (no cuentan para blast radius):** `ProductoVariante → ProductoServicio`, `GranFormatoVariante → ProductoServicio`, `ProductoChecklist → ProductoServicio`, `ProductoServicioAdicional` (unión), `CotizacionProductoSnapshot → (ProductoServicio, ProductoVariante)`, etc.

**Externas (puentes hacia otros módulos):**

| Relación | Dirección | Impacto en refactor |
|---|---|---|
| `ProductoServicio.procesoDefinicionDefaultId → ProcesoDefinicion` | costeo → procesos | BAJO. Se preserva; el nuevo modelo sigue usando `ProcesoDefinicion`. |
| `ProductoVariante.procesoDefinicionId → ProcesoDefinicion` | costeo → procesos | BAJO. Idem. |
| `ProcesoOperacion.requiresProductoAdicionalId → ProductoAdicionalCatalogo` | procesos → costeo | MEDIO. Control de costeo de aditivos está acoplado entre ambos módulos. Requiere preservarse. |
| `ProductoAdicionalRouteEffectPaso → (CentroCosto, Maquina, MateriaPrimaVariante)` | costeo → maquinaria + costos + inventario | BAJO. FK hacia catálogos estables. No cambian. |
| `GranFormatoVariante → (Maquina, MaquinaPerfilOperativo, MateriaPrimaVariante)` | costeo → maquinaria + inventario | BAJO. FK hacia catálogos estables. |

**Cotizaciones (`CotizacionProductoSnapshot`):** **cero FK externas**. Ninguna tabla de órdenes, facturación o venta referencia snapshots. Las cotizaciones son metadata histórica auto-contenida.

### 1.3 Jobs, cron, integraciones asincrónicas

**Ninguna detectada.** No hay `@Cron`, `ScheduleModule`, `@nestjs/schedule`, Bull, ni colas. La única mención de "queue" en el service es una estructura de datos BFS interna (algoritmo, no cola asíncrona). Costeo es 100% síncrono bajo demanda.

### 1.4 Controllers / endpoints externos

No hay endpoints públicos que expongan cotizaciones a sistemas externos. Todos los endpoints están bajo `/productos-servicios/*` y `/costos/*`, usados sólo por el frontend interno.

### Conclusión backend

**Blast radius backend: BAJO.** El módulo es un subsistema cerrado. Los puentes a otros módulos son FK hacia catálogos estables (`CentroCosto`, `MateriaPrimaVariante`, `Maquina`, `ProcesoDefinicion`) que se preservan 1:1 en el nuevo modelo.

---

## 2. Frontend — dependencias cross-page

### 2.1 Hallazgo crítico no detectado en Fase 1: módulo **comercial / propuestas**

Fase 1 dijo "no hay consumidores externos detectados" pero fue por exploración superficial. Fase 4 encontró un consumidor mayor: el módulo de **propuestas comerciales**.

**Ruta:** `src/app/(dashboard)/comercial/crear-propuesta/page.tsx` → componente `PropuestaFicha`.

**Acoplamiento crítico en types** (`src/lib/propuestas.ts`):
```
PropuestaItem {
  cotizacion: CotizacionProductoVariante       ← anidación directa
  granFormato: {
    costosResponse: GranFormatoCostosResponse  ← anidación directa
  }
}
```

**Componentes impactados (4):**
- `src/components/comercial/agregar-producto-sheet.tsx` — cotiza y agrega ítems a la propuesta (`cotizarProductoVariante`, `cotizarRigidPrintedByProducto`, `previewGranFormatoCostos`, `simularPrecioComercial`).
- `src/components/comercial/propuesta-ficha.tsx` — renderiza desglose de costos con pie charts (`simularPrecioComercial`).
- `src/components/comercial/costos-producto-dialog.tsx` — desglose detallado por ítem (`simularPrecioComercial`).
- `src/components/comercial/gran-formato-nesting-dialog.tsx` — lee `costosResponse.totales.*`.

**Consecuencia:** el refactor del shape de cotización (F10 de Fase 3) **también atraviesa el módulo comercial**. La estimación de Fase 3 para F10 (L, 7–12 semanas) subestima — hay que sumar el rework de propuestas.

### 2.2 Páginas de configuración de maestros (bajo riesgo)

| Página | APIs consumidas | Riesgo |
|---|---|---|
| `/costos/maquinaria` | `getMaquinas`, `getCentrosCosto`, `getPlantas` | Cero. No toca cotización. |
| `/costos/procesos` | `getProcesos`, `getCentrosCosto`, `getMaquinas`, `getProcesoOperacionPlantillas` | Cero. Editor de `ProcesoDefinicion` — se preserva. |
| `/costos/centros-de-costo` | `getCentrosCosto`, `getAreasCosto`, `getPlantas`, `getEmpleados` | Cero. Catálogo transversal estable. |
| `/costos/productos` (listado) | `getProductosServicios`, `getMotoresCostoCatalogo`, `getFamiliasProducto` | Bajo. Refactor de motores cambia catálogo, pero listado es plano. |
| `/costos/productos/familias`, `/costos/productos/impuestos` | Catálogos | Cero. |
| `/inventario/materias-primas` | `getMateriasPrimas` | Cero. Inventario estable. |

### 2.3 Hooks/contexts globales

**No existen.** Patrón del proyecto:
- APIs en `src/lib/productos-servicios-api.ts` y `src/lib/productos-servicios-simulacion.ts` son **funciones async** (no hooks React).
- Se invocan directamente desde `page.tsx` o componentes `"use client"`.
- No hay Provider/Context centralizado para datos de cotización.

Esto es una espada de doble filo: por un lado no hay capa de indirección que haga drift silencioso; por otro, no hay un lugar único donde adaptar el shape — cada consumidor debe tocarse individualmente.

### 2.4 `SimulacionComercialResultado` es consumido por muchos componentes pero agnóstico del motor

Contrato declarado en `src/lib/productos-servicios-simulacion.ts`. Lo consumen:
- `producto-simular-venta-tab.tsx`
- `comercial/agregar-producto-sheet.tsx`
- `comercial/propuesta-ficha.tsx`
- `comercial/costos-producto-dialog.tsx`

Este contrato trabaja sobre `costoTotal` agregado (no sobre el shape interno del resultado del motor). **Sobrevive la migración** sin cambios.

### Conclusión frontend

**Blast radius frontend: MAYOR al estimado en Fase 1.** El módulo comercial/propuestas es un consumidor significativo que F10 (shape unificada) tiene que absorber. Suma ~20–30% al esfuerzo estimado originalmente para F10.

---

## 3. Matriz consolidada de dependencias

| Consumidor | Qué consume | Capa | Acoplamiento | Sobrevive migración |
|---|---|---|---|---|
| `productos-servicios.module` (AppModule) | Wiring del módulo | Backend | Sólo registración | Sí — módulo se preserva |
| `ProcesoOperacion → ProductoAdicionalCatalogo` (FK) | Control de aditivos en procesos | DB | Opcional, preservada | Sí |
| `CentroCosto`, `Maquina`, `MateriaPrimaVariante` (referencias desde adicionales/variantes) | Catálogos transversales | DB | Estable | Sí 1:1 |
| `comercial/crear-propuesta/page.tsx` | Cotizaciones + simulación | Frontend | **Alto** vía `PropuestaItem.cotizacion`, `.costosResponse` | Con rework (F10) |
| `src/lib/propuestas.ts` (type `PropuestaItem`) | Anida tipos de cotización | Frontend | **Alto** | Con rework (F10) |
| `comercial/agregar-producto-sheet.tsx`, `propuesta-ficha.tsx`, `costos-producto-dialog.tsx`, `gran-formato-nesting-dialog.tsx` | Shape de cotización | Frontend | **Alto** | Con rework (F10) |
| `producto-simular-venta-tab.tsx` + precio-tab | `SimulacionComercialResultado` (agnóstico) | Frontend | Bajo | Sí sin cambios |
| Páginas de maestros (maquinaria, procesos, centros, materias primas) | Catálogos | Frontend | Nulo | Sí sin cambios |
| Jobs / colas / integraciones externas | — | — | Inexistentes | N/A |

---

## 4. Datos históricos — qué hay que preservar

Con el blast radius clarificado, se puede dimensionar mejor la migración de datos históricos.

### 4.1 `CotizacionProductoSnapshot`

- **Sin FK externas.** Cada snapshot es auto-contenido: `inputJson`, `resultadoJson`, `motorVersion`, `configVersionBase`, `configVersionOverride`.
- Al introducir el motor v2 (modelo universal), los snapshots existentes (`motorVersion=1`) se preservan como histórico legacy sólo lectura. Los nuevos (`motorVersion=2`) emiten la shape canónica.
- No hay cascada a otras tablas — eliminarlos o reinterpretarlos no rompe referencias.

### 4.2 Propuestas comerciales — **pregunta abierta de Fase 4**

- El módulo comercial usa `PropuestaItem.cotizacion: CotizacionProductoVariante`. ¿Se persiste este JSON en DB, o sólo vive en la sesión/memoria mientras se construye la propuesta?
- Si se persiste (probablemente en alguna tabla `Propuesta` con blob JSON de ítems), entonces existe un segundo tipo de snapshot histórico que también hay que versionar. Esto agrega complejidad a la estrategia de migración.
- **El inventario de Fase 4 no agotó esta pregunta.** Requiere investigación focalizada en Fase 5 (estrategia de migración), junto con el volumen de snapshots que ya quedó pendiente desde Fase 2.

### 4.3 Configs de motor versionadas

- `ProductoMotorConfig.versionConfig` es un entero monotónico. Las configs viejas se mantienen como registros históricos.
- Al migrar, cada producto obtendrá una nueva entrada de config con shape universal. Las viejas siguen referenciables por los snapshots v1.

---

## 5. Blast radius consolidado

| Dimensión | Blast radius | Consecuencia |
|---|---|---|
| Backend código | Bajo | Refactor contenido en `productos-servicios/` + update de wiring |
| Backend DB (FK externas) | Bajo | Catálogos transversales se preservan 1:1 |
| Backend jobs/integraciones | Nulo | Sin impacto |
| Frontend páginas de costeo interno | Medio | Re-skin de tabs (digital, wide-format) — ya contemplado en Fase 3 F10 |
| **Frontend módulo comercial/propuestas** | **Alto** | **Rework adicional no contemplado en Fase 3 F10** |
| Frontend maestros (catálogos) | Nulo | Sin impacto |
| Datos históricos (snapshots cotización) | Bajo | Convivencia v1/v2 via `motorVersion` |
| **Datos históricos (propuestas)** | **A investigar** | **Depende de si las propuestas persisten cotización completa** |

**Veredicto de blast radius:** contenido, pero **con dos puntos ciegos que Fase 3 no había dimensionado**:
1. El módulo comercial/propuestas se acopla fuerte al shape de cotización.
2. El snapshot histórico de propuestas (si existe) es un segundo dataset a versionar.

---

## 6. Impacto sobre el plan de Fase 3

Fase 4 reabre parcialmente el análisis de F10 (shape unificada) de Fase 3:

**Ajuste a F10:**
- **Nuevo alcance:** el endpoint v2 y el shape canónico ahora también tienen que servir al flujo de propuestas (no sólo a la UI de detalle de producto).
- **Nuevo esfuerzo:** L → L+ (posiblemente XL si el refactor de `PropuestaItem` implica migrar propuestas históricas guardadas en DB).
- **Nuevos componentes a tocar:** `src/lib/propuestas.ts` (el type), `agregar-producto-sheet.tsx`, `propuesta-ficha.tsx`, `costos-producto-dialog.tsx`, `gran-formato-nesting-dialog.tsx`.

**Nuevas fricciones derivadas (para agregar a Fase 3 si se materializan):**
- **F11** (nuevo, condicional): migración de propuestas históricas si el shape de cotización se persiste en DB. Severidad y esfuerzo pendientes hasta investigar la persistencia.

**Las otras fricciones (F1–F9) no cambian**: no dependen del módulo comercial.

---

## 7. Veredicto de Fase 4

**Blast radius: CONTENIDO PERO MAYOR AL ESTIMADO.**

- El módulo de costeo es un subsistema sin consumidores internos del backend, lo que confirma la facilidad de extraerlo y refactorizar.
- El único acoplamiento externo real es **frontend**: el módulo comercial/propuestas anida el shape de cotización en sus propios tipos.
- El sistema no tiene jobs, colas, webhooks ni integraciones externas que dependan del costeo — eso simplifica enormemente la estrategia de migración.

**Veredicto de viabilidad: sigue VIABLE.** Las dos sorpresas de Fase 4 (comercial/propuestas y la pregunta abierta sobre persistencia de propuestas) son manejables y no introducen fricciones conceptuales nuevas — sólo aumentan el esfuerzo estimado de F10.

**Dos preguntas abiertas para Fase 5:**
1. ¿Las propuestas comerciales persisten `PropuestaItem.cotizacion` en DB o es ephemeral? Si persisten, hay que diseñar migración.
2. ¿Cuál es el volumen real de `CotizacionProductoSnapshot` en DB viva? (Ya estaba abierta desde Fase 2.)

Ambas se investigan con una query simple a la DB; no obstruyen el avance.

---

## Siguiente paso — Fase 5: Estrategia de migración

Tomar todo lo aprendido (18 familias, 10 fricciones, blast radius, 2 preguntas abiertas) y diseñar la estrategia de migración: **cómo se ejecuta el refactor sin romper producción.**

Temas a cubrir en Fase 5:
- Convivencia motor-v1 / motor-v2 con `motorVersion` como discriminador.
- Shadow mode: correr ambos motores en paralelo para la misma cotización y comparar diferencias.
- Feature flag por producto/variante para migración gradual.
- Elección del piloto: confirmar gran formato (stub, sin legacy) como candidato.
- Construcción de la golden-output suite (F9) como prerrequisito duro.
- Estrategia de migración de datos históricos (snapshots + propuestas).
- Plan de cut-over y decommission de motores legacy.
- Cronograma con hitos medibles.

Salida: `docs/viabilidad-modelo-universal-fase-5-estrategia.md`.
