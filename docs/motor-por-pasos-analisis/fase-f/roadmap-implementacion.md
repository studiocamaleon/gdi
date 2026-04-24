# Roadmap de implementación del modelo universal

> **Fase F** — Plan de ejecución del Big Bang.
> **Sesión**: 2026-04-24. **Estrategia**: Big Bang + safety net (tag `v1.4` + DB dump).
> **Esfuerzo total estimado**: 7-12 semanas (1 dev full-time).

## Estrategia: Big Bang con safety net

Decisión del usuario (2026-04-24): no hay migración gradual ni shadow mode. Se rehace todo el módulo de productos-servicios desde cero según el modelo conceptual. Si fracasa, se restaura del tag `v1.4-pre-implementacion-modelo-universal` + DB dump (`backups/README-rollback.md` documenta el procedimiento).

Lo único que se preserva:
- Nesting (`apps/api/src/productos-servicios/nesting/`) — ya extraído.
- Costing parcial (`load-tarifas`, `operation-cost`) — ya extraído.
- **Tab Precio completo** (capa comercial) — ver `tab-precio-analysis.md`.

Lo que se rehace:
- 5 motores legacy → 1 motor universal.
- Schema Prisma del módulo productos-servicios.
- UI admin (catálogo de productos, rutas, máquinas, materiales).
- UI cotizador comercial (formulario dinámico).
- Endpoints (`/cotizar`, `/cotizar-v2` se unifican).

## Las 5 fases

### F.1 — Schema nuevo + seed mínimo (1-2 semanas)

**Salida**: Schema Prisma del modelo conceptual cargado en DB. Seed inicial con los 4 productos validados (Tarjetas, Vinilo, Talonarios, Rígidos) cargados en el nuevo modelo (sin lógica de motor todavía).

**Tareas grandes**:
1. Diseñar entidades Prisma:
   - Plantilla / Máquina / Perfil / Consumible / Componente desgaste
   - Material (con variantes)
   - Ruta de producción + Pasos
   - Producto + RutaAlternativa (M:N) + ConfigPaso (slots, modos, paramsPaso)
   - Cargo directo (catálogo + instancia)
2. Familias: ¿hardcodeadas en código (`familias.ts`) o tabla en DB? — DECISIÓN PENDIENTE para F.1.
3. Migration Prisma + reset DB (DB nueva).
4. Seed data: cargar las 9 plantillas de máquinas modeladas en `06-maquinas-y-perfiles.md` + materiales típicos + 4 productos validados.
5. Smoke test del schema (queries Prisma básicas).

**Criterio de cierre**:
- El schema soporta TODO el modelo conceptual de Fase A-E.
- Los 4 productos validados están cargados en seed.
- Queries Prisma básicas (CRUD) funcionan.

**Riesgos**:
- Modelo conceptual revela campos que no se anticiparon → decisión de diseño on-the-fly.
- El gap H7 (`piezas: [...]` en JobContext) afecta cómo se modelan las medidas — se resuelve en F.1.

### F.2 — Motor universal backend (2-3 semanas)

**Salida**: Servicio `MotorUniversalService` que recibe `(productoId, JobContext)` y devuelve `(costo, trazabilidad)`. Sin UI todavía. Tests goldens contra los 4 productos validados.

**Tareas grandes**:
1. Implementar el bucle a-i (Fase C):
   - Iteración por DAG topológico
   - 3 tipos de nodo (PASO_SIMPLE, SUB_PRODUCTO, SELECTOR)
   - Sub-tareas: activación → máquina/perfil → cantidad → tiempo → materiales → cargos → mutar JobContext
2. Implementar resoluciones D.1-D.6 + D.7 (validaciones).
3. Conectar el módulo de nesting existente (cuando familia lo requiera).
4. Sistema de errores tipados (Tipo B + C).
5. Tests unitarios por sub-tarea + tests integración por producto.
6. Goldens: snapshots de cotización para los 4 productos validados (smoke test ~$8.500 para tarjetas, etc.).

**Criterio de cierre**:
- Los 4 productos cotizan correctamente vía endpoint nuevo.
- Tests verde (unitarios + goldens).
- Trazabilidad completa devuelta.

**Riesgos**:
- Algún caso real de los productos no se cubre con el modelo y aparece gap nuevo (Fase E debería haberlos detectado, pero implementar es donde se ven los detalles).
- Performance: el motor universal podría ser más lento que los motores legacy especializados.

### F.3 — UI admin nueva (2-3 semanas)

**Salida**: Pantallas de admin para que el modelador (vos) pueda cargar/editar productos, rutas, materiales, máquinas/perfiles desde la UI. Reemplaza la UI legacy.

**Tareas grandes**:
1. Pantallas CRUD:
   - Plantillas / Máquinas / Perfiles / Consumibles / Componentes desgaste
   - Materiales (con variantes)
   - Rutas de producción (editor visual de pasos)
   - Productos (referencia a ruta, configuración de modos, slots, máquinas, cargos)
2. UX combinada para "crear ruta + producto" en 1 sola pantalla (sub-tema 07).
3. Versionado opt-in con heurística (modelador decide patch vs nueva versión).
4. Validaciones de Journey 1 (al guardar ruta o producto).

**Criterio de cierre**:
- Vos podés cargar/editar productos sin tocar SQL ni código.
- Versionado de rutas funciona.
- Validaciones impiden guardar productos rotos.

**Riesgos**:
- UX de configuración de paso del producto puede ser compleja (slots, modos, paramsPaso). Diseño UX importante.
- Editor de rutas con drag-and-drop puede ser trabajo extra.

### F.4 — UI cotizador comercial (1-2 semanas)

**Salida**: Pantalla del comercial al cotizar. Formulario dinámico según producto + ruta seleccionada. Aplica el motor universal + Tab Precio para devolver precio final.

**Tareas grandes**:
1. Formulario dinámico que se adapta al producto:
   - Inputs según JobContext que el producto requiere
   - Selección de ruta alternativa (si producto tiene N)
   - Activación de opcionales
   - Configuración de parámetros de paso al cotizar (esquinas, profundidad de corte, etc.)
   - Carga de listas de piezas (gap H7)
   - Override manual de máquinas/perfiles si aplica
2. Llamada al motor universal + Tab Precio existente.
3. Vista de cotización con desglose (trazabilidad).
4. Snapshot completo al cerrar cotización formal (sub-tema 07 §7).

**Criterio de cierre**:
- El comercial cotiza los 4 productos validados sin ayuda técnica.
- Snapshot funciona y la cotización se puede re-abrir años después.

**Riesgos**:
- UX del formulario dinámico puede ser confusa si hay muchas decisiones simultáneas.

### F.5 — Cleanup (3-5 días)

**Salida**: Código limpio. Solo motor universal vivo. Sin deuda transición.

**Tareas grandes**:
1. Eliminar 5 motores legacy:
   - `digital-sheet.motor.ts`
   - `rigid-printed.motor.ts`
   - `talonario.motor.ts`
   - `vinyl-cut.motor.ts`
   - `wide-format.motor.ts`
2. Eliminar UI legacy de productos (tabs por motor, simular-costo viejo, etc.).
3. Renombrar endpoints v2 → v1 (si hace falta).
4. Eliminar dependencias y tipos no usados.
5. Verificar tests siguen verde.

**Criterio de cierre**:
- Branch lista para mergear a main.
- Tag de éxito: `v2.0-modelo-universal-implementado`.

## Total estimado

**7-12 semanas (1 dev full-time)**.

Bajo a 1 dev part-time (50%): **14-24 semanas**.

## Decisiones pendientes para F.1 (próxima sesión)

1. **Familias: hardcodeadas en código (`familias.ts`) vs tabla en DB**.
   - Hardcoded: simple, performance, control de versiones del catálogo.
   - DB: configurable por tenant, agregar familia sin deploy.
   - Mi recomendación: hardcoded (estamos hablando de un catálogo de 31 conceptos estables, no datos cambiantes).
2. **Plantillas de máquinas: hardcodeadas vs DB**.
   - Mismo dilema. Más argumentos a favor de DB porque cada tenant las usa distinto y modela máquinas reales.
3. **`paramsPaso`: JSON libre vs tablas tipadas**.
   - JSON libre (decidido en H19): simple, flexible. La validación viene de la familia.
4. **Migración de datos viejos**.
   - Decidido: NO migrar. DB nueva, seed manual con info real como referencia.
5. **Modelo de tenants**.
   - Multi-tenant ya existe. Mantener mismo modelo (`tenantId` en cada entidad).

## Próximos pasos concretos (en orden)

1. **Esta sesión**: commit del roadmap + análisis Tab Precio. Cerrar Fase F a nivel plan.
2. **Próxima sesión**: armar plan técnico DETALLADO de F.1:
   - Diseño del schema Prisma (todas las entidades + relaciones)
   - Decidir: familias hardcoded vs DB
   - Lista de tareas de F.1 con dimensionamiento
   - Primer ticket de implementación
3. **Después de F.1 detallado**: arrancar a tocar código.
