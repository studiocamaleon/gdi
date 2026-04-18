# Plan técnico — Etapa E: Decommission del código legacy

**Duración estimada:** 1–2 meses (1 persona).
**Reversibilidad:** **baja** — esta etapa borra código legacy. La decisión de arrancar E implica asumir el riesgo de no poder volver atrás trivialmente.
**Prerrequisitos:** Etapa D completa + 2 semanas adicionales sin regresiones detectadas.

**Objetivo de la etapa:** eliminar el código v1 que ya no tiene consumidores, limpiar feature flags, infra de shadow mode y tablas temporales. Al cerrar esta etapa, el sistema corre 100% sobre el modelo universal; el código legacy queda sólo en git history. La deuda técnica pre-refactor se cierra.

---

## §0 — Preguntas de arranque

1. **Consumidores de snapshots históricos v1.** Query de producción: ¿alguien está leyendo `CotizacionProductoSnapshot` con `motorVersion=1` en los últimos 30 días? Si sí, decidir adapter lazy vs migración explícita. Si no, el adapter alcanza y no requiere datos nuevos.
2. **Backup final pre-delete.** ¿Se tomó snapshot de DB y tag git del estado pre-E? Sin esto, no se arranca. Asumo que sí (la decisión de avanzar a E implica confianza pero también prudencia).
3. **Ventana operativa.** Decommission es mejor ejecutarla cuando el negocio no está en pico (ej. evitar temporada alta). Coordinar con el dueño.

---

## §1 — Tareas

### E.1 — Adapter lazy para snapshots históricos v1

**Entregable:** función `adaptCotizacionV1ToCanonical(snapshot): CotizacionCanonica` disponible en runtime para cualquier consumer que todavía pida shape canónica de un snapshot viejo.

**Pasos:**
1. Si el adapter de A.6 (`v1-to-canonical.ts`) ya se usa en producción (lo usa Etapa C para convertir al vuelo cuando se lee un snapshot viejo), está listo. Reubicarlo como service público:
   - `apps/api/src/productos-servicios/adapters/v1-to-canonical.service.ts`
   - Expuesto via DI, reutilizable.
2. Endpoint público que toma un `snapshotId` y devuelve shape canónica, independiente del `motorVersion`:
   - `GET /productos-servicios/cotizaciones/:snapshotId/canonical`
   - Si `motorVersion=2` → devuelve `resultadoJson` directo.
   - Si `motorVersion=1` → pasa por adapter.
3. Consumidores futuros (reportes, auditoría, UI histórica) siempre usan el endpoint canónica, no leen snapshots crudos.

**Éxito:** cualquier snapshot histórico se puede leer en shape canónica sin tocar datos.

**Decisión de producto:** si alguien quisiera forzar migración de datos (rewrite de `resultadoJson` v1 al shape canónica), es posible pero no recomendado: el adapter lazy cubre el caso y preserva fidelidad del v1 original.

### E.2 — Eliminación de código legacy del service monolítico

**Entregable:** `apps/api/src/productos-servicios/productos-servicios.service.ts` reducido en ≥50% de líneas.

**Pasos:**
1. Identificar y borrar los 4 métodos legacy:
   - `quoteRigidPrintedVariant` (~line 639)
   - `quoteTalonarioVariant` (~line 1821)
   - `quoteDigitalVariant` (~line 5958)
   - `quoteVinylCutVariant` (~line 7874)
2. Borrar helpers que sólo servían a esos métodos:
   - `apps/api/src/productos-servicios/motors/rigid-printed.calculations.ts`
   - `apps/api/src/productos-servicios/motors/talonario.calculations.ts` (revisar: si talonario v2 lo reutiliza, preservar; si es lógica legacy, borrar)
   - Similarmente para digital y vinyl-cut
3. Borrar wrappers legacy `motors/*.motor.ts` si los v2 viven en otros archivos (`motors/*-v2.motor.ts`). Alternativamente renombrar v2 → sin sufijo ahora que son los únicos.
4. Borrar el motor stub de gran formato `motors/wide-format.motor.ts` (reemplazado por `wide-format-v2.motor.ts` renombrado).

**Éxito:** `npm run build` en `apps/api/` pasa; tests regresión de A.1 (goldens v1) ya no existen porque sus motores desaparecieron (se pueden **archivar** como read-only en un directorio `legacy-goldens/` si hay valor histórico; alternativamente borrar).

### E.3 — Eliminación de `AlgoritmoCosto` (dead code histórico)

**Entregable:** tablas Prisma `AlgoritmoCosto` y `ProductoVarianteAlgoritmoConfig` eliminadas.

**Pasos:**
1. Migración Prisma: `DROP TABLE`.
2. Borrar referencias del schema.
3. `npx prisma migrate dev --name remove_algoritmocosto_deadcode`.

**Éxito:** schema más chico; sin impacto funcional (era dead code).

### E.4 — Eliminación de tabs v1 del frontend

**Entregable:** los archivos de tabs motor-específicos desactivados en Etapa D se eliminan del repo.

**Archivos a borrar (lista preliminar, confirmar al ejecutar):**
- `src/components/productos-servicios/motors/digital-simular-costo-tab.tsx`
- `src/components/productos-servicios/motors/wide-format-simular-costo-tab.tsx`
- `src/components/productos-servicios/motors/wide-format-nesting.helpers.ts` (si no se reutiliza)
- `src/components/productos-servicios/motors/digital-imposicion-tab.tsx` (si hay equivalente canónico en v2)
- Otros tabs v1 motor-específicos no migrados

**Preservar:**
- Tabs de configuración motor-específica que no tienen versión genérica (ej. `digital-variantes-tab.tsx`, `digital-ruta-base-tab.tsx` si sirven para UI de configuración, no para cotización).

**Pasos:**
1. Audit grep: buscar imports residuales de los archivos a borrar.
2. Si encuentra imports fantasma, remover.
3. Borrar los archivos.
4. Build del frontend para confirmar cero referencias rotas.

**Éxito:** frontend compila sin los archivos; el registry de motor UI ya no los menciona (ya se quitó en Etapa D).

### E.5 — Limpieza de feature flags e infraestructura temporal

**Entregable:** flags y tablas de convivencia eliminadas.

**Pasos:**
1. Eliminar `ProductoServicio.motorPreferido` (migración Prisma).
2. Eliminar tabla `CotizacionShadowLog` (opción: archivar a tabla `_archive` en otra DB en vez de drop).
3. Quitar variables de entorno `ENABLE_WIDE_FORMAT_V2`, `ENABLE_UNIFIED_COST_TAB` del `.env.example` y de la lógica del dispatcher.
4. Simplificar `productos-servicios.controller.ts` dispatcher: ya no hay ramas "v1/v2/shadow", sólo "llama al motor v2 registrado".

**Éxito:** schema Prisma + controller + env más simples; cero paths de ejecución condicionales por versión.

### E.6 — Documentación de cierre

**Entregable:** actualización de docs/ para marcar el cierre del proyecto.

**Pasos:**
1. Update de `docs/viabilidad-modelo-universal-fase-6-veredicto.md` con sección final "Ejecución completada" + fecha + resumen de lo entregado.
2. Update de memoria `project_modelo_universal_costeo.md` con el estado "completado".
3. Archivar los planes técnicos de Etapas A–E en `docs/historico/` si ya no son referencia activa.
4. Un doc nuevo `docs/arquitectura-costeo-modelo-universal.md` que documenta **el sistema final** (no la migración): qué son las familias, cómo se arma una ruta, cómo se escribe una regla, cómo se agrega un motor. Es el manual del dueño del sistema para operar y extender.

**Éxito:** documentación refleja el estado final; nadie necesita leer los 11 documentos de la migración para entender el sistema.

---

## §2 — Definición de hecho (criterios de cierre de Etapa E)

- [ ] E.1: Adapter lazy v1→canonical disponible como service reutilizable; endpoint expuesto.
- [ ] E.2: Motores v1 eliminados; `productos-servicios.service.ts` reducido ≥50% LOC.
- [ ] E.3: `AlgoritmoCosto` y relacionados eliminados del schema.
- [ ] E.4: Tabs v1 del frontend borrados; build pasa.
- [ ] E.5: Feature flags y tabla `CotizacionShadowLog` eliminados; dispatcher simplificado.
- [ ] E.6: Doc del sistema final publicado; referencias históricas archivadas.
- [ ] 2 semanas post-E sin incidentes de producción atribuibles al refactor.
- [ ] Auditoría final: grep de "motor v1", "legacy", "shadow", "motorPreferido" — cero resultados accidentales.

---

## §3 — Riesgos específicos de esta etapa

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Algún código ignoto todavía llamaba a `quote*Variant` v1 directamente | Baja | Grep exhaustivo antes de E.2; tag git pre-E como rollback |
| Reportes históricos consultan `resultadoJson` con shape v1 y se rompen | Baja | E.1 (adapter lazy) los cubre si pasan por el endpoint canónica; si leían crudo, advertirles antes |
| Alguna herramienta externa (backup, monitoring) esperaba tablas que se borran | Muy baja | Revisar con infra antes de ejecutar E.3 y E.5 |
| El dueño del sistema cambió de opinión y quiere mantener algún motor legacy | Baja | Reunión previa a E.2; si pasa, pausar y documentar |

---

## §4 — Cierre del proyecto

Al cerrar E, el sistema cumple con los objetivos del modelo universal:
- Un único shape canónica de cotización.
- Pasos declarativos con inputs/outputs semánticos.
- Reglas de selección externalizadas.
- Un motor productivo por familia en vez de uno por tipo de producto.
- Cero dead code, cero deuda de motor heredado.
- Documentación viva del sistema, no de la migración.

**Output:** arquitectura lista para que agregar un producto nuevo (incluyendo tecnologías nuevas) sea una tarea de configuración, no de desarrollo.

**Fin del plan de Etapa E. Fin de la migración.**
