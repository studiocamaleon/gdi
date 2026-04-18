# Plan técnico — Etapa D: Unificación del frontend

**Duración estimada:** 2–3 meses (1 persona; puede arrancar en paralelo a las últimas migraciones de Etapa C).
**Reversibilidad:** total — los componentes nuevos conviven con los viejos hasta declarar la migración completa.
**Prerrequisitos:** Etapa C avanzada (al menos 2 motores migrados con diff estable).

**Objetivo de la etapa:** colapsar los 2 shapes divergentes del frontend (`CotizacionProductoVariante` digital-like + `GranFormatoCostosResponse`) en una sola shape canónica consumida por UI genérica. Rework del módulo comercial/propuestas que quedó como deuda de Fase 4. Al cerrar esta etapa, el frontend no tiene lógica condicional por motor y las propuestas usan la shape canónica.

---

## §0 — Preguntas de arranque

1. **Cambios en módulo comercial desde 2026-04-17.** Revisar git log de `src/app/(dashboard)/comercial/` y `src/lib/propuestas.ts` desde la fecha del análisis. Si hubo evolución, releer Fase 4 y ajustar el scope de D.2.
2. **Propuestas persistidas en backend.** En el momento del análisis propuestas era UI mock-only. ¿Sigue siendo así o se agregó backend? Si se agregó, diseñar la migración de datos históricos de propuestas como D.X extra.
3. **Nuevos componentes comerciales.** Desde el análisis, ¿hay nuevos `costos-producto-dialog`, `gran-formato-nesting-dialog`, o similares que dependan del shape actual?
4. **Deprecación de tabs v1.** ¿Los tabs v1 (`digital-simular-costo-tab.tsx`, `wide-format-simular-costo-tab.tsx`, etc.) pueden eliminarse al cerrar D, o hay algún flujo de usuario que aún los requiera?

---

## §1 — Tareas

### D.1 — Componente `ProductoSimularCostoTab` genérico definitivo

El componente creado en B.4 como `ProductoSimularCostoV2Tab` se consolida como el único tab de simulación.

**Pasos:**
1. Renombrar `ProductoSimularCostoV2Tab` → `ProductoSimularCostoTab`.
2. Ubicación definitiva: `src/components/productos-servicios/producto-simular-costo-tab.tsx`.
3. Robustecerlo para cubrir todos los motores migrados (incorporar secciones de trazabilidad que aparecieron durante Etapa C: nesting, imposición, composición multi-copia del talonario, reglas aplicadas).
4. Update del `productUiRegistry` en `producto-servicio-detail-shell.tsx`: todos los motores ahora apuntan al mismo tab (no motor-específico).
5. Eliminar del registry los tabs legacy: `DigitalSimularCostoTab`, `WideFormatSimularCostoTab`, `TalonarioSimularCostoTab` (si existe), `RigidPrintedSimularCostoTab` (si existe), `VinylCutSimularCostoTab` (si existe). **No los borres todavía** (Etapa E) — sólo desactivarlos del registry.
6. Feature flag `ENABLE_UNIFIED_COST_TAB` para activación gradual.

**Éxito:** cotizar cualquier producto (de los 5 motores) muestra la misma UI. Shadow mode de Etapa C sigue activo: si la UI v2 rompe por algún case-corner, se desactiva el flag sin rollback de código.

### D.2 — Refactor del tipo `PropuestaItem` y `src/lib/propuestas.ts`

**Entregable:** `PropuestaItem` anida una única `cotizacion: CotizacionCanonica` en vez de las dos variantes actuales.

**Pasos:**
1. Actualizar tipo `PropuestaItem`:
   ```ts
   // Antes
   type PropuestaItem = {
     cotizacion: CotizacionProductoVariante | null;
     granFormato?: { costosResponse: GranFormatoCostosResponse };
     rigidosPrinted?: { cotizacionResult: Record<string, unknown> };
     viniloCut?: { costosResponse: Record<string, unknown> };
     // ...
   };
   
   // Después
   type PropuestaItem = {
     cotizacion: CotizacionCanonica | null;
     // campos específicos de motor que la UI de agregar-producto todavía necesite
     motorCodigo: string;
     // ...
   };
   ```
2. La info específica de motor (medidas wide-format, tipo impresión rigid, colores vinyl) que hoy vive en los nested objects se mueve a la `trazabilidad` de la cotización canónica, que ya es extensible.
3. Eliminar imports de `CotizacionProductoVariante` y `GranFormatoCostosResponse` del archivo.

**Éxito:** `PropuestaItem` es agnóstico del motor; todos los items de una propuesta tienen la misma shape.

### D.3 — Migración de componentes comerciales

Los 4 componentes del módulo comercial listados en Fase 4 se refactorizan para consumir la shape canónica.

**Componentes a migrar:**
- `src/components/comercial/agregar-producto-sheet.tsx` — flujo de "agregar producto a propuesta". Cambia: leer `CotizacionCanonica` en vez de branching por motor.
- `src/components/comercial/propuesta-ficha.tsx` — rendering del desglose con pie charts. Los 3 buckets canónicos simplifican el pie chart (siempre 3 slices, no N motor-específicos).
- `src/components/comercial/costos-producto-dialog.tsx` — desglose detallado. Usa el mismo desglose por paso que `ProductoSimularCostoTab`.
- `src/components/comercial/gran-formato-nesting-dialog.tsx` — este podría mantenerse como especialización si el nesting sigue siendo relevante; alternativamente integrarlo a `ProductoSimularCostoTab` como sección "trazabilidad visual".

**Pasos:**
1. Por cada componente, refactor incremental: cambiar imports, actualizar props, ajustar rendering.
2. Para cada uno, un test de render básico (Testing Library) que verifica que renderiza sin crash con una `CotizacionCanonica` mock.
3. Testing manual del flujo completo "crear propuesta → agregar producto → ver ficha → editar" en staging.

**Éxito:** flujo comercial end-to-end funciona con la shape canónica; los componentes no importan tipos motor-específicos.

### D.4 — Deprecación del endpoint `/cotizar` v1

**Entregable:** endpoint `/cotizar` v1 marcado como deprecated; todos los consumidores ahora llaman `/cotizar-v2`.

**Pasos:**
1. Audit final: grep en `src/lib/productos-servicios-api.ts` de usos de los endpoints v1. Deberían ser cero tras D.1–D.3.
2. En el controller, agregar warning log + response header `Deprecation: true` al endpoint v1.
3. Monitorear logs durante 2 semanas. Si no hay uso detectable → sacarlo del router (pero **no borrar el método** hasta Etapa E).

**Éxito:** `/cotizar` v1 no recibe tráfico durante 2 semanas consecutivas.

### D.5 — Validación end-to-end

**Entregable:** suite de tests E2E que ejerce el flujo completo.

**Pasos:**
1. Elegir 5 escenarios representativos: propuesta con 1 producto simple, propuesta multi-producto mezclando motores, propuesta con adicionales, propuesta de gran formato con nesting, propuesta con producto talonario.
2. Tests manuales documentados (paso a paso) ejecutados por el dueño.
3. Opcionalmente (stretch) tests Playwright automatizados si el frontend tiene infra para ello.

**Éxito:** los 5 escenarios pasan sin regresión comparada con el comportamiento pre-D.

---

## §2 — Definición de hecho (criterios de cierre de Etapa D)

- [ ] D.1: `ProductoSimularCostoTab` unificado es el único tab en el registry para los 5 motores.
- [ ] D.2: `PropuestaItem` usa `CotizacionCanonica` sin branching por motor.
- [ ] D.3: Los 4 componentes comerciales refactorizados y probados.
- [ ] D.4: Endpoint `/cotizar` v1 sin tráfico durante 2 semanas.
- [ ] D.5: Validación E2E de 5 escenarios pasa sin regresión.
- [ ] Golden-output suite (A) y shadow logs (C) sin anomalías nuevas durante la etapa.
- [ ] Cero imports de `CotizacionProductoVariante`, `GranFormatoCostosResponse` fuera de código de adapter / compatibilidad legacy.

---

## §3 — Riesgos específicos de esta etapa

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Componentes comerciales tienen lógica escondida que el análisis de Fase 4 no vio | Media | Spike de inspección al inicio de D.3; estimación revisada si aparece |
| UX del pie chart unificado (3 buckets) es menos informativa que la vista motor-específica actual | Baja | Feedback con el dueño; si es problema, agregar drill-down por paso dentro del pie |
| Tipos específicos de motor son usados en reports/exports que no se detectaron | Baja | Audit de imports antes de cerrar D.4 |
| `gran-formato-nesting-dialog` no tiene equivalente en shape canónica | Media | Mantener como especialización opcional; la nesting preview es un bloque de trazabilidad, no un concepto nuevo |

---

## §4 — Output de la etapa para etapas posteriores

Al cerrar D, Etapa E (decommission) tiene disponible:
- Frontend con cero dependencia del shape legacy → puede borrar tipos legacy.
- Endpoint `/cotizar` v1 sin tráfico → puede borrar.
- Componentes motor-específicos desactivados del registry → pueden borrar sus archivos.
- Sistema funcionando 100% sobre modelo universal, validado extremo a extremo.

**Fin del plan de Etapa D.**
