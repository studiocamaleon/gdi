# Modelo Universal · Handoff 2026-04-19 (rev. 2)

Documento auto-contenido para retomar el refactor del modelo universal de
costeo en otra sesión sin pérdida de contexto. Esta revisión refleja el
estado tras completar P1→P4 y la consolidación de alternativas.

> **Rama**: `refactor/modelo-universal` · **Estado**: super motor único
> en producción, UI unificada completa, consolidación data model terminada ·
> **HEAD**: `8442bfd9` · **LOC neto vs main**: +12.820 / −25.668.

---

## TL;DR

El sistema pasó de **5 motores específicos v1+v2 enredados** (~15k LOC
entrelazados con el service) a un **super motor universal único**
(`universal@1`) que ejecuta cualquier producto cotizando declarativamente
su ruta. Los motores v1, v2 específicos, shadow mode y adapter
desaparecieron (−25k LOC). La UI se unificó en 7 tabs para todos los
productos. Niveles y alternativas se consolidaron en una sola entidad
con campos de override.

**Lo que queda**:
1. Deuda de consolidación P4 (evaluador JsonLogic real, `unidadProductivaV2`
   al runtime, editor UI de `configNestingV2`).
2. Feature parity avanzada (tira+retira, multi-color vinyl, sub-productos,
   productividades no lineales).
3. UI de `ReglaDeSeleccion` (infra existe, falta autoría + wire-up).
4. Cleanup técnico (Three.js, `material-plantillas.ts` fallback,
   `inferirFamiliaDesdeTipo`, `/cotizar-v2` → `/cotizar`).
5. Data migration masiva de materiales declarativos (hoy solo 2 pasos demo
   tienen `ProcesoOperacionMaterial`).
6. Tests unitarios + docs de usuario.

---

## 1. Arquitectura actual (modelo universal)

### 1.1 Principio fundacional

> Costo de un producto = Σ costo de cada paso de su ruta de producción.

Cada paso tiene los mismos **3 buckets**:
- **Centro de costo**: `tiempo × tarifa del centro` (máquina+operario+amortización)
- **Materias primas**: `Σ (cantidad × precio)` por material consumido
- **Cargos flat**: fijos o externos (tercerización, royalties, viáticos, mínimos)

### 1.2 Familias de paso (23)

Definidas en `apps/api/src/productos-servicios/pasos/familias.ts`. Cada
familia declara `codigo`, `nombre`, `categoria`, `modoNesting`
(`produce | consume | none`), `nestingAlgoritmo`, `outputsCanonicos`,
`formulasDisponibles`, `requiereCentroCosto`.

6 categorías: impresión · corte y formado · terminaciones · estructural y
montaje · servicios pre/post · operaciones manuales.

### 1.3 Unidades canónicas

**Productivas** (6): `unidad`, `pliego`, `placa`, `metro_lineal`, `m2`, `hora`.
**De material** (6): `unidad`, `m2`, `metro_lineal`, `gramo/kg`, `ml/litro`, `pliego`.

El paso declara `unidadProductivaV2` (hoy solo metadata — ver deuda §4.2).

### 1.4 Entidades clave de la ruta

- `ProcesoDefinicion` — cabecera de ruta (producto opcional, familia, estado).
- `ProcesoOperacion` — paso dentro de la ruta. Tiene `familiaV2`,
  `unidadProductivaV2`, `configNestingV2`, `activacionV2`
  (`OBLIGATORIO | OPCIONAL | CONDICIONAL`), `condicionActivacionV2` (JsonLogic).
- `ProcesoOperacionAlternativa` — variante del paso (antes "niveles" +
  "alternativas" separadas; unificadas en P4). Override fields:
  `setupMin`, `cleanupMin`, `tiempoFijoMin`, `productividadBase`,
  `configNestingV2`, `maquinaId`, `perfilOperativoId`.
- `ProcesoOperacionMaterial` — consumo declarativo de material por paso.
  Fórmulas: fija, por pliego, por m², por pieza, por metro lineal, con
  flag `aplicaMultiCaras`.

### 1.5 Flujo de ejecución del super motor

```
producto.rutaDeProduccion → operaciones activas/seleccionadas
    ↓
    Para cada operación:
    ├── Si activacionV2 = CONDICIONAL: evaluar condicionActivacionV2 (hoy gate pasa-todo, ver §4.1)
    ├── Si se eligió alternativa: aplicar overrides (tiempos, productividad, nesting, máquina)
    ├── Resolver centroCosto → tarifa del período
    ├── Resolver máquina + perfil operativo (si familia.modoNesting ≠ none)
    ├── Resolver familia (familiaV2 o inferencia por tipoOperacion — legacy, §4.3)
    ├── Si familia.modoNesting = 'produce': ejecutar nesting, guardar layout
    ├── Si familia.modoNesting = 'consume': heredar layout del último 'produce' upstream
    ├── Tiempo: setup + cleanup + tiempoFijo + productivo
    │       productivo ← evaluateProductividad(op, cantidadObjetivoSalida)
    │       costoCentroCosto ← (tiempo / 60) × tarifa
    ├── Materiales: ProcesoOperacionMaterial (prioridad) o material-plantillas.ts (fallback, §4.4)
    └── Emitir PasoCotizado {centroCosto, materiasPrimas, cargosFlat, trazabilidad}
    ↓
Σ pasos → Cotización canónica {total, unitario, subtotales, pasos, trazabilidad}
```

### 1.6 Componentes clave

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| `FAMILIAS_PASO` | `apps/api/src/productos-servicios/pasos/familias.ts` | Catálogo 23 familias |
| `nesting-hoja.ts` | `.../nesting/` | Bin-packing en pliego |
| `nesting-rollo.ts` | `.../nesting/` | Mixed-shelf en rollo + panelizado |
| `nesting-placa-rigida.ts` | `.../nesting/` | Grid en placa rígida |
| `nesting-runner.ts` | `.../engine/` | Pipeline produce/consume |
| `ruta-validator.ts` | `.../engine/` | Validación R1-R5 de rutas |
| `evaluateProductividad` | `apps/api/src/procesos/proceso-productividad.engine.ts` | Tiempo por paso |
| `SuperMotor` | `.../motors/super-motor.ts` | **Único motor** (713 LOC) |
| `<NestingPreview>` | `src/components/nesting-preview/` | Único preview visual 2D SVG |

Registry (`product-motor.registry.ts`) aún existe, pero solo registra
`universal@1`. Se puede eliminar cuando se consolide `/cotizar-v2` → `/cotizar`.

### 1.7 Endpoint de cotización

```
POST /productos-servicios/variantes/:varianteId/cotizar-v2
  body: { cantidad, opcionesSeleccionadas?: [{operacionId, alternativaId}] }
```

Sin flags de motor ni `motorPreferido` (ambos eliminados en P3.b.5).

---

## 2. Estado detallado del refactor

### Etapas A-D (arquitectura) — completa
Preparación, piloto gran_formato, nestings extraídos, motores v2 piloto,
super motor core + nesting + materiales declarativos, previews unificados.

### P1 — Tab "Ruta de producción" — completa
- P1.2 vista read-only
- P1.3 alternativas (schema, CRUD, UI, selector en cotización, motor las consume)
- P1.4 materiales por paso (CRUD + editor UI)
- P1.5 editor de paso + reorden
- P1.6 asignar/cambiar ruta

### P2 — Retirar tabs legacy — completa
−1.431 LOC. Los 7 tabs universales son: General · Variantes · Ruta de
producción · Imposición · Precio · Simular costo · Simular venta.

### P3 — Erradicar motores v1 + v2 específicos — completa
- P3.a.1 biblioteca de pasos alineada
- P3.a.2 `modoMedidas` first-class (`ESTANDAR | LIBRE`) en `ProductoServicio`
- P3.a.3 suite de paridad super motor vs v1 (obsoleta post-erradicación,
  pero documenta gaps conocidos — ver §3.2)
- P3.b.1 motores v2 específicos borrados (−3k)
- P3.b.2 motores v1 + métodos inline borrados (−5k)
- P3.b.3 tabs estándar (−14.191 LOC)
- P3.b.4 tab Imposición unificado con `<NestingPreview>`
- P3.b.5 cleanup: shadow infra, `motorPreferido`, specs legacy (−17.919 LOC)

### P4 — Consolidar niveles + alternativas — completa
Antes: dos conceptos paralelos (`niveles` por paso + `alternativas` UI-only).
Ahora: `ProcesoOperacionAlternativa` con override fields cubre ambos casos.
- P4.1 data model unificado (−2.8k LOC de código niveles)
- P4.2 super motor consume overrides + gate `activacionV2` + `unidadProductivaV2`
  en trazabilidad
- P4.3a UI elimina editor de niveles (biblioteca + checklist)
- P4.3b UI "Opciones del paso" con overrides + labels title case

### Extras de UX (esta sesión)
- Sheets anchos (1120px xl) con padding consistente
- Selector Materia Prima → Variante de 2 pasos
- `unidadProductivaV2` como Select en editor de paso (consistente con biblioteca)
- Selector "Motor de costo" removido de General tab y Crear producto sheet
- Fix `getProductoMotorConfig` lee DB directo (evita "Motor no soportado")

---

## 3. Pendientes priorizados

### P4-debt · Consolidación alternativas (chica) — más urgente

Tres hilos sueltos del P4:

1. **`CONDICIONAL` con JsonLogic real**. El motor tiene la compuerta
   (`activacionV2 === 'CONDICIONAL'`) pero evalúa siempre true. Falta
   leer `condicionActivacionV2` del paso y ejecutar el evaluador
   JsonLogic existente contra Job Context + outputs upstream.
2. **`unidadProductivaV2` cableada al runtime**. Hoy es metadata. El
   motor hardcodea la unidad desde `familiaV2`. Deberia leer
   `op.unidadProductivaV2` y solo fallback a familia si está en null.
3. **Editor UI de `configNestingV2` en "Opciones del paso"**. El override
   persiste y el motor lo consume, pero no hay editor — el usuario no
   puede setearlo sin SQL.

**Estimado**: 1 sesión.

### P5 · Feature parity avanzada del super motor

Gaps conocidos (identificados en suite P3.a.3 antes de borrarla):

- **Tira+retira**. Super motor calcula doble faz como 2 corridas.
  Agregar flag en `configNestingV2` para impresión una-pasada doble-faz.
- **Multi-color en vinilo de corte**. V2 específico iteraba por color.
  Solución: ruta con N ejecuciones paralelas o sub-producto por color.
- **Vinyl medidas libres**. Super motor no lee `anchoMm/altoMm` de
  parámetros del trabajo cuando el producto es `modoMedidas=LIBRE`.
- **Talonario copias**. No modela N copias por original (carbónico).
- **Rígidos flexibles por producto**. No soporta cotizar sin variante.
- **Digital materiales declarativos**. Algunas rutas solo parcial (solo
  OP-002 y OP-006 tienen materiales; el resto usa fallback imperativo).
- **Productividades no lineales**. Usar `ModoProductividadProceso.FORMULA`
  con JsonLogic en `reglaVelocidadJson`. Infra existe, falta poblar casos.

### P6 · Sub-productos / productos componentes

Shape canónica ya tiene `subProductos[]` pero el super motor no resuelve
recursión. Falta:
- Schema: relación producto-padre-incluye-producto-componente con cantidad.
- Runtime: al consumir un componente, invocar super motor recursivamente.

Caso típico: tapa dura de libro cosido.

### P7 · Reglas de selección (UI)

`ReglaDeSeleccion` existe en schema y el evaluador JsonLogic funciona.
Falta:
- UI de autoría de reglas (condición + resultado).
- Trigger al cotizar: si un paso tiene reglas asociadas, evaluar contra
  Job Context y aplicar resultado (elegir material, activar paso, etc.).

Caso de uso: espiral según páginas (`páginas ≤ 50 → 8mm`, etc.).

### P8 · Data migration masiva

Poblar `ProcesoOperacionMaterial` en todos los productos de producción.
Hoy solo el seed digital (OP-002, OP-006) tiene materiales declarativos;
el resto depende del fallback imperativo `material-plantillas.ts`.

Script standalone iterando productos. Template:
`apps/api/prisma/migrations/20260419120000_populate_familia_v2_ops/`.

### P9 · Cleanup técnico (quick wins)

1. **Desinstalar Three.js** — no está usado en ningún archivo (grepeado):
   ```bash
   npm uninstall three @react-three/fiber @react-three/drei three-stdlib troika-three-text
   ```
2. **Eliminar `material-plantillas.ts`** (253 LOC) cuando P8 termine.
3. **Eliminar `inferirFamiliaDesdeTipo`** en super motor (§4.3) cuando
   todas las ops tengan `familiaV2` seteado. SM.5.a ya migró la mayoría;
   validar con `SELECT COUNT(*) FROM "ProcesoOperacion" WHERE "familiaV2" IS NULL;`.
4. **Renombrar endpoint** `/cotizar-v2` → `/cotizar` (V1 ya no existe).
5. **Eliminar registry** de motores (`product-motor.registry.ts`) — solo
   registra `universal@1`; el controller puede invocar `SuperMotor` directo.

### P10 · Tests

Hoy son mayormente integration contra DB real. Falta:
- Unit tests del super motor con mocks (más rápidos).
- Tests de `calcularMaterialesDeclarados` cubriendo las 5 fórmulas.
- Tests E2E contra `/cotizar-v2` comparando con golden expected.

### P11 · Documentación de usuario

- Cómo crear un producto desde cero con el super motor.
- Cómo modelar una ruta simple (tarjetas digital).
- Cómo modelar una ruta compleja (cartel iluminado con sub-productos).
- Casos de ejemplo por familia.

---

## 4. Deuda técnica conocida

### 4.1 `CONDICIONAL` sin evaluador
Super motor tiene la compuerta pero no evalúa `condicionActivacionV2`.
Hoy todo paso `CONDICIONAL` se ejecuta. Fix en P4-debt.

### 4.2 `unidadProductivaV2` solo metadata
El motor infiere la unidad desde `familiaV2` ignorando la del paso. El
campo se persiste y se muestra en UI pero no afecta el cálculo. Fix en
P4-debt.

### 4.3 `inferirFamiliaDesdeTipo`
Fallback que infiere `familia` por `tipoOperacion + nombre` cuando
`op.familiaV2` está null. Remover cuando P8 termine.

### 4.4 `material-plantillas.ts` (fallback imperativo)
253 LOC con plantillas por familia (cuántas placas, cuántos ml de tinta,
etc.). Se usa cuando un paso no tiene `ProcesoOperacionMaterial`. Remover
cuando P8 termine.

### 4.5 Config producto con defaults de precio
El `configProducto` tiene `papelPrecioPorPliego`, `embalajePrecioBolsa`,
`impresionCostoClic`. Esos valores deberían vivir en
`ProcesoOperacionMaterial.precioManual`. Migración gradual.

### 4.6 Variante → papel no extensible
`ProductoVariante.papelVarianteId` asume papel. Para vinilo, rígidos,
textil no aplica. Solución: generalizar a `sustratoVariantes[]` o que los
materiales del paso lo declaren.

### 4.7 Endpoint `/cotizar-v2` con sufijo legacy
V1 ya no existe, pero el sufijo quedó. Renombrar a `/cotizar`.

### 4.8 Migrations aplicadas directo
`20260419120000_populate_familia_v2_ops` y
`20260419130000_proceso_operacion_material` se aplicaron manualmente
(Prisma shadow DB falla). Workaround: `npx prisma db execute --stdin`.
Ver `ROLLBACK_PLAN.md`.

### 4.9 Three.js instalado sin uso
5 paquetes (`three`, `@react-three/fiber`, `@react-three/drei`,
`three-stdlib`, `troika-three-text`) sin imports en el código. Quick win.

---

## 5. Decisiones arquitectónicas importantes

No re-discutir:

### 5.1 La ruta es la única fuente de verdad
Si un paso no está en la ruta, no se cobra. Los motores v2 específicos
agregaban pasos "invisibles" hardcodeados; el super motor no.

### 5.2 Los 3 buckets cubren todo
Centro de costo + materias primas + cargos flat cubren cualquier paso
de la industria (46 ejemplos validados).

### 5.3 Un solo preview visual
`<NestingPreview>` 2D SVG es el único preview. Sin 3D.

### 5.4 Checklist eliminado (reemplazado por ruta + alternativas)
Pasos `opcional` + `ProcesoOperacionAlternativa` + `ReglaDeSeleccion`
cubren la funcionalidad del checklist v1.

### 5.5 Máquinas opcionales
Solo pasos con productividad variable por perfil necesitan
`MaquinaPerfilOperativo`. Manuales (embalaje, soldadura) solo centro
de costo.

### 5.6 Niveles + alternativas → una sola entidad
`ProcesoOperacionAlternativa` con override fields (P4).

### 5.7 Shape canónica estable
`CotizacionCanonica { total, unitario, subtotales: {centroCosto,
materiasPrimas, cargosFlat}, pasos[], subProductos[], warnings[] }`.
Contrato público.

### 5.8 `modoMedidas` first-class
`ProductoServicio.modoMedidas: ESTANDAR | LIBRE` (P3.a.2). En modo
`LIBRE` el tab "Variantes" se oculta y las cotizaciones piden medidas
al cliente.

---

## 6. Contexto de datos del tenant demo

**Tenant**: `0e7937a0-c093-4cdd-bc5e-fe4de1385ce8` (Grafica Corporearte)
**Admin**: `admin@gdi-demo.local` / `Admin123!`

### Productos seed con ruta:
- **Tarjetas de Visita** (`44e4133f-...`) ruta "Digital Estandar" 6 pasos.
- **Vinilo adhesivo blanco** (`668f59e6-...`).
- **Vinilo de corte** (`43d7d1cd-...`).
- **MDF Impreso** (`14516e74-...`) `modoMedidas=LIBRE`.
- **Talonarios emblocados** (`ef0f03ee-...`).

### Ruta digital seed:
`0e0f3a51-5508-4fa5-a700-d29d4e18dd63` "Impresión Digital Laser (Estandar)":
```
1. OP-001 Diseño Grafico (opcional, tiempoFijo=30min)
2. OP-002 Impresion Laser: Color (obligatorio, perfil 40 pliegos/h, Ricoh)
3. OP-003 Laminado BOPP (opcional)
4. OP-004 Pre-prensa (obligatorio, tiempoFijo=10min)
5. OP-005 Guillotinado (obligatorio, 500 pliegos/h)
6. OP-006 Embalaje (obligatorio, 600 piezas/h)
```

Materiales declarativos (SM.D):
- OP-002: Papel Opalina 250gr × pliego + Clics CMYK × pliego (aplicaMultiCaras)
- OP-006: Bolsa celofán × pieza

---

## 7. Cómo retomar en la próxima sesión

1. **Contexto**: leer este documento + `memory/` del usuario.
2. **Branch**: `git checkout refactor/modelo-universal && git pull`.
3. **Infra local**:
   ```bash
   docker start gdi-saas-postgres
   cd apps/api && npm run dev       # API 3001
   cd ../.. && npm run dev          # Frontend 3000
   ```
4. **Smoke test**:
   ```bash
   cd apps/api && npx jest productos-servicios/motors
   ```
5. **E2E super motor**:
   Login → Tarjetas de Visita → tab "Simular costo (v2)" → Cotizar.
   Debería devolver ~$8.500 con 4 pasos activos.
6. **Siguiente foco sugerido**: **P4-debt** (los tres hilos sueltos de
   consolidación) porque cierra el capítulo de P4. Después **P9 cleanup**
   como quick win. P5-P11 son frentes grandes independientes.

---

## 8. Ideas fuera de alcance pero vale registrar

- **Optimizador de rutas**: combinar trabajos similares en una corrida.
- **Versionado de rutas**: snapshot para reproducir cotizaciones pasadas.
- **Familias custom por tenant**.
- **Exportar DXF/PDF** desde `<NestingPreview>` (ya es SVG).
- **Preview interactivo** (arrastrar piezas en layout).

---

*Última actualización*: 2026-04-19 (rev. 2) · *Rama*:
`refactor/modelo-universal` · *Commit HEAD*: `8442bfd9` ·
*LOC neto vs main*: +12.820 / −25.668.
