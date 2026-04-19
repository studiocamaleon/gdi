# Modelo Universal · Handoff 2026-04-19

Documento auto-contenido para retomar el refactor del modelo universal de
costeo en otra sesión sin pérdida de contexto.

> **Rama**: `refactor/modelo-universal` · **Estado**: arquitectura completa,
> UI y adopción pendiente · **Última sesión**: 2026-04-19 · **Punto de corte**:
> commit `d489618d` (previews unificados).

---

## TL;DR

El sistema pasó de **5 motores específicos v1 enredados** (~15k LOC entrelazados
con el service) a un **super motor universal** (`universal@1`) que ejecuta
cualquier producto cotizando declarativamente su ruta de producción, con
**un solo preview visual** (`<NestingPreview>`), **3 utilities de nesting puras**
y **materiales declarativos por paso** en DB. Los motores v1 siguen funcionando
como default seguro. El super motor está listo para ser el default cuando las
rutas estén completas.

**Lo que queda**:
1. UI para crear/editar rutas con materiales (único gap fundamental).
2. Retiro progresivo de motores v2 específicos.
3. Retiro de tabs legacy por motor.
4. Feature parity en casos avanzados (sub-productos, multi-color vinyl, tira+retira).

---

## 1. Arquitectura actual (modelo universal)

### 1.1 Principio fundacional

> Costo de un producto = Σ costo de cada paso de su ruta de producción.

Cada paso tiene los mismos **3 buckets**:
- **Centro de costo**: `tiempo × tarifa del centro` (incluye máquina+operario+amortización)
- **Materias primas**: `Σ (cantidad × precio)` por material consumido
- **Cargos flat**: costos fijos o externos (tercerización, royalties, viáticos, mínimos)

### 1.2 Familias de paso (23)

Definidas en `apps/api/src/productos-servicios/pasos/familias.ts`. Cada familia declara:
- `codigo`, `nombre`, `categoria`
- `modoNesting`: `produce | consume | none`
- `nestingAlgoritmo`: `nesting-rollo | nesting-hoja | nesting-placa-rigida | null`
- `outputsCanonicos`, `formulasDisponibles`, `requiereCentroCosto`

Agrupadas en 6 categorías:
1. **Impresión**: `impresion_por_hoja`, `impresion_por_area`, `impresion_por_pieza`, `aplicacion_transfer`
2. **Corte y formado**: `corte`, `corte_volumetrico`, `grabado`, `plegado`, `perforado`, `troquelado`
3. **Terminaciones**: `laminado`, `acabado_decorativo`, `pintura_superficial`, `encuadernado`
4. **Estructural y montaje**: `soldadura_herreria`, `ensamble_estructural`, `instalacion_electrica`
5. **Servicios pre/post**: `pre_prensa`, `diseno_grafico`, `toma_medidas`, `colocacion_in_situ`
6. **Operaciones manuales y logística**: `operacion_manual`, `insumo_externo_gestion`

### 1.3 Unidades canónicas

Stress-tested con 46 ejemplos de la industria (ver sesión 2026-04-18):

**Unidades productivas** (6):
- `unidad` (pieza, remera, mug, visita, ensamble, arte, módulo)
- `pliego` (de nesting-hoja)
- `placa` (de nesting-placa-rigida)
- `metro_lineal` (rollo, cable, perímetro)
- `m2` (laminado, pintura, vinilo aplicado)
- `hora` (asesoría, servicios por tiempo)

**Unidades de material** (6):
- `unidad`, `m2`, `metro_lineal`, `gramo/kg`, `ml/litro`, `pliego`

### 1.4 Flujo de ejecución del super motor

```
producto.rutaDeProduccion → operaciones activas/seleccionadas
    ↓
    Para cada operación:
    ├── Resolver: centroCosto → tarifa del período
    ├── Resolver: máquina + perfil operativo
    ├── Resolver: familia (desde familiaV2 o inferencia por tipoOperacion)
    ├── Si familia.modoNesting = 'produce':
    │       Ejecutar nesting (rollo | hoja | placa-rigida)
    │       Guardar layout
    ├── Si familia.modoNesting = 'consume':
    │       Heredar layout del último 'produce' upstream
    ├── Calcular tiempo: setup + cleanup + tiempoFijo + productivo
    │       productivo ← evaluateProductividad(op, cantidadObjetivoSalida)
    │       cantidadObjetivoSalida ← unidades del layout (pliegos, m², etc.)
    │       costoCentroCosto ← (tiempo / 60) × tarifa
    ├── Calcular materiales:
    │       Prioridad 1: materiales declarados en ProcesoOperacionMaterial (SM.D)
    │       Prioridad 2: plantilla imperativa por familia (fallback)
    │       Σ (cantidad × precio) = costoMateriasPrimas
    └── Emitir PasoCotizado {centroCosto, materiasPrimas, cargosFlat, trazabilidad}
    ↓
Σ pasos → Cotización canónica {total, unitario, subtotales, pasos, trazabilidad}
```

### 1.5 Componentes clave

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| `FAMILIAS_PASO` | `apps/api/src/productos-servicios/pasos/familias.ts` | Catálogo de 23 familias |
| `nesting-hoja.ts` | `.../nesting/` | Bin-packing en pliego |
| `nesting-rollo.ts` | `.../nesting/` | Mixed-shelf en rollo + panelizado + 4 márgenes |
| `nesting-placa-rigida.ts` | `.../nesting/` | Grid en placa rígida |
| `nesting-runner.ts` | `.../engine/` | Pipeline produce/consume |
| `ruta-validator.ts` | `.../engine/` | Validación R1-R5 de rutas |
| `evaluateProductividad` | `apps/api/src/procesos/proceso-productividad.engine.ts` | Tiempo por paso (FIJA/FORMULA/TABLA) |
| `calcularMaterialesDelPaso` | `.../pasos/material-plantillas.ts` | Plantillas imperativas (fallback) |
| `calcularMaterialesDeclarados` | `.../motors/super-motor.ts` | Fórmulas desde ProcesoOperacionMaterial |
| `SuperMotorModule` | `.../motors/super-motor.ts` | Motor universal que reemplaza v2 específicos |
| `<NestingPreview>` | `src/components/nesting-preview/` | Único preview visual 2D SVG |

### 1.6 Dispatcher de cotización

```
POST /productos-servicios/variantes/:varianteId/cotizar-v2
  ?mode=v2        → forza V2 motor específico (ignora motorPreferido del producto)
  ?motor=universal → usa super motor (bypass del dispatch normal)
  sin flags       → lee producto.motorPreferido:
                      V1     → adapter v1→canonical
                      V2     → motor v2 específico
                      SHADOW → corre ambos, persiste diff en CotizacionShadowLog
```

---

## 2. Estado detallado por etapa

Las etapas se ejecutaron secuencialmente. Todas committeadas en la rama.

### Etapa A — Preparación (completa)
- Red de seguridad (goldens + tests), 23 familias catalogadas, schema
  extendido (`familiaV2`, `unidadProductivaV2`, `configNestingV2`, etc.),
  `ReglaDeSeleccion` entity, evaluador JsonLogic, shape canónica DTO,
  endpoint `/cotizar-v2`.

### Etapa B — Piloto gran_formato@2 (completa)
- `WideFormatMotorModuleV2` registrado con feature flag, tab "Simular
  costo (v2)" agregado, `loadGranFormatoV2Runtime` lee config+materiales.

### Etapa C — Nestings + motores v2 piloto (completa)
- C.1 Shadow infra (`CotizacionShadowLog`, `MotorVersionPreferida`).
- C.2 3 nestings extraídos + runner + validator + gran_formato usa
  `nestOnRoll` real (no el toy).
- C.3-C.6 4 motores v2 piloto: vinilo, digital láser, rígidos, talonario.
- C.7 Dashboard shadow diffs (`/costos/shadow-diffs`).

### Etapa D — Ajustes + super motor (completa arquitectónicamente)
- D.0 `ensureV2ConfigFromV1` auto-crea config v2 desde v1 (o defaults).
- D.1a Digital v2: caras, tipoImpresion, opcionales desde ruta, tarifa+papel reales.
- `<NestingPreview>` 2D SVG unificado con márgenes mecánicos CAD-style.
- Preview digital migrado a `<NestingPreview>`.
- SM.1-SM.4 Super motor universal (core + nesting + UI toggle + materiales).
- SM.5.a Data migration `familiaV2` + `unidadProductivaV2` en ops existentes.
- SM.5.b Benchmark super motor vs v2 (diffs residuales identificados como
  *data* no *arquitectura*).
- Fix super motor: aplica demasía + línea de corte, respeta pliego del paso.
- SM.D Materiales declarativos a nivel paso (`ProcesoOperacionMaterial`).
- Previews vinilo + rígidos + gran formato migrados a `<NestingPreview>`.

### Commits clave de la rama (últimos en orden cronológico)
```
d489618d refactor(imposicion): 3 previews legacy → <NestingPreview>
6b1d1769 feat: SM.D materiales declarativos a nivel paso
b80c4f99 refactor: preview digital migrado a <NestingPreview>
7f3f584c feat(super-motor): demasía + línea de corte
5cd26a5a feat: SM.5.a data migration familiaV2 + unidadProductivaV2
422817e8 test: SM.5.b benchmark super motor vs v2
094c36bf feat(digital-v2): D.1a.2 máquina + perfil + tarifa + papel reales
6b1d1769 feat: SM.D materiales declarativos
15c39edd feat: SM.4 plantillas de materiales por familia
d92ad55d feat: SM.2 nesting pipeline en super motor
9eadccc7 feat: SM.1 super motor core
e37597d2 feat(digital-v2): D.1a.3 pasos opcionales desde la ruta
3d47cd58 feat(digital-v2): D.1a caras + tipoImpresion
54997de5 feat: D.0 auto-creación config v2 desde v1
```

Ver `git log main..HEAD` para el listado completo.

---

## 3. Pendientes priorizados

### P1 · Tab unificado "Ruta de producción" (GRANDE - CRÍTICO)

**Por qué crítico**: hoy editar una ruta requiere SQL directo. Sin UI, el
modelo universal no es utilizable en producción.

**Scope**:
1. **Vista read-only (mínimo)**: lista ordenada de pasos con familia,
   centro costo, máquina, perfil, materiales declarados (SM.D).
2. **Editor de paso**: formulario con:
   - Nombre, código, obligatorio/opcional
   - Familia (dropdown 23 familias)
   - Centro de costo (dropdown)
   - Máquina + perfil (opcional, aparece según familia.modoNesting)
   - Setup/cleanup/tiempoFijo
   - Modo productividad (FIJA/FORMULA/TABLA) + productividadBase
   - `configNestingV2` según algoritmo de la familia (expandible JSON editor)
3. **Editor de materiales por paso** (sección embebida en editor paso):
   - Tabla de ProcesoOperacionMaterial: nombre, variante (optional),
     formula (dropdown), cantidad, unidad, precio manual, aplicaMultiCaras.
   - Add/remove/reorder.
4. **Drag-and-drop reordenar pasos** (React DnD o similar).
5. **Validación al guardar** (reusa `validateRuta` ya existente en `engine/`).

**Archivos a crear/editar**:
- `src/app/(dashboard)/costos/productos/[productoId]/ruta/page.tsx` (nuevo)
- `src/components/productos-servicios/ruta-produccion-editor.tsx` (nuevo)
- `src/components/productos-servicios/paso-editor.tsx` (nuevo)
- `src/components/productos-servicios/materiales-paso-editor.tsx` (nuevo)
- `apps/api/src/productos-servicios/productos-servicios.controller.ts` (nuevos endpoints CRUD de pasos/materiales)
- Registro del tab en `producto-servicio-detail-shell.tsx` y retiro de tabs legacy.

**Estimado**: 2-3 sesiones.

### P2 · Retirar tabs legacy por motor

Cuando el tab "Ruta de producción" esté funcional:
- Eliminar `imposicion` tab de todos los motores (el preview ya no es
  motor-specific).
- Eliminar `simular_costo` tab v1 (el super motor reemplaza a todos).
- Eliminar `tecnologias` tab (gran formato, rígidos) — info pasa a la ruta.
- Eliminar `composicion` tab (talonario).
- Eliminar `equipos_materiales` tab (vinilo).

Resultado esperado: **7 tabs universales** para todos los productos:
General · Variantes · Ruta de producción · Precio · Simular costo · Simular venta.

**Archivos afectados**: `*-motor-ui.tsx` de cada motor.

### P3 · Retirar motores v2 específicos + adapter v1

Cuando (1) el tab ruta esté listo y (2) las rutas de productos en DB
estén completas, el super motor pasa a ser el default:

```ts
// En productos-servicios.service.ts cotizarVarianteV2:
if (producto.motorPreferido === 'V1') {
  // Antes: return cotizarV1Adaptado(...)
  return superMotor.quoteVariant(...);  // Nuevo default
}
```

Borrar `wide-format-v2.motor.ts`, `vinyl-cut-v2.motor.ts`,
`digital-sheet-v2.motor.ts`, `rigid-printed-v2.motor.ts`,
`talonario-v2.motor.ts`. Estimado: ~5.000 LOC eliminadas.

### P4 · Feature parity avanzada del super motor

Lo que NO está cubierto aún:

**Tira+retira** (doble faz en una sola pasada sin cambiar plancha): el
super motor calcula doble faz como 2 corridas separadas. Para tira+retira
agregar una flag en el paso `impresion_por_hoja` que ajuste la fórmula.

**Multi-color en vinyl_cut**: el motor v2 específico itera por color.
El super motor hoy cotiza 1 trabajo; falta soporte para rutas con N
ejecuciones paralelas (una por color), o un sub-producto por color.

**Sub-productos / productos componentes**: la shape canónica ya tiene
`subProductos[]`, pero el super motor no resuelve recursión. Caso
típico: tapa dura de libro cosido (sub-producto con ruta propia). Falta:
- Schema: relación producto-padre-incluye-producto-componente con cantidad.
- Runtime: cuando un paso consume un componente, invocar super motor
  recursivamente para el componente.

**Productividades no lineales**: algunos pasos tienen fórmulas complejas
(diseño gráfico que no escala con cantidad). Usar `ModoProductividadProceso.FORMULA`
y poblar `reglaVelocidadJson` con fórmula JsonLogic.

### P5 · Reglas de selección (ya existe infra, falta UI)

`ReglaDeSeleccion` existe en schema + evaluador JsonLogic funciona. Falta:
- UI para definir reglas (condición + resultado) en un nivel (producto o global).
- Trigger al cotizar: si un paso tiene reglas asociadas, evaluar contra
  el Job Context y aplicar su resultado (elegir material, activar paso, etc.).

Caso de uso: encuadernado espiral → diámetro del espiral según cantidad
de páginas (regla: `páginas <= 50 → espiral 8mm; páginas <= 100 → 12mm; ...`).

### P6 · Data migration masiva (cuando se decida retirar v2)

Para cada producto que usa motor v2 específico:
1. Identificar qué pasos "invisibles" agregaba el v2 (pre-prensa, corte,
   embalaje) y agregarlos a su `ProcesoDefinicion`.
2. Poblar `configNestingV2` en pasos `produce` con `{pliegos: [{anchoMm,
   altoMm, codigo}]}` desde la config actual del producto.
3. Poblar `ProcesoOperacionMaterial` para todos los pasos (hoy solo OP-002
   y OP-006 de digital en el seed demo tienen materiales declarativos).

Recomendación: hacer un script standalone que itere productos y genere
el SQL/INSERTs. Ver `apps/api/prisma/migrations/20260419120000_populate_familia_v2_ops/`
como template.

### P7 · Shadow mode adoption

Cuando el super motor esté estable, activar SHADOW en productos de
producción:
```sql
UPDATE "ProductoServicio" SET "motorPreferido" = 'SHADOW'
  WHERE id IN (...);
```

Monitorear `/costos/shadow-diffs`. Umbrales sugeridos:
- < 1% diff: motor listo para V2.
- 1-10% diff: revisar datos de config (no arquitectura).
- > 10% diff: revisar schema/fórmulas.

### P8 · Cleanup técnico

1. **Desinstalar Three.js** (ya no se usa):
   ```bash
   npm uninstall three @react-three/fiber three-stdlib troika-three-text
   ```
2. **Remover plantillas imperativas** (`material-plantillas.ts`) cuando
   todos los pasos tengan materiales declarativos en DB.
3. **Remover `inferirFamiliaDesdeTipo`** cuando todas las ops tengan
   `familiaV2` seteado.
4. **Remover fallback** a plantillas en super motor.
5. **Consolidar endpoint** a `/cotizar` (sin `-v2`) una vez que V1 no exista.

### P9 · Tests

Los tests actuales son mayormente integration contra DB real. Falta:
- Unit tests del super motor con mocks (más rápidos).
- Tests de `calcularMaterialesDeclarados` cubriendo las 5 fórmulas.
- Tests end-to-end que corran contra `/cotizar-v2?motor=universal` y
  comparen con golden expected.

### P10 · Documentación de usuario

(Fuera de alcance técnico pero crítico para adopción)
- Cómo crear un producto desde cero con el super motor.
- Cómo modelar una ruta simple (tarjetas digital).
- Cómo modelar una ruta compleja (cartel iluminado con sub-productos).
- Casos de ejemplo por familia.

---

## 4. Decisiones arquitectónicas importantes

No re-discutir:

### 4.1 La ruta es la única fuente de verdad
Los motores v2 específicos agregaban pasos "invisibles" hardcodeados
(pre-prensa, corte, embalaje). El super motor respeta la ruta 100%. Si
un paso no está en la ruta, no se cobra.

### 4.2 Los 3 buckets cubren todo
Centro de costo + materias primas + cargos flat cubren CUALQUIER paso
de la industria (46 ejemplos validados). Algunos pasos tienen uno o
dos en $0.

### 4.3 Un solo preview visual
`<NestingPreview>` 2D SVG es el único preview en todo el sistema. No
hay 3D (Three.js removido). Consistencia entre digital, vinilo, rígidos,
gran formato.

### 4.4 Checklist eliminado (reemplazado por ruta opcional)
Los checklists del v1 NO se portan. Su función (preguntas que agregan
pasos/materiales) la cumplen:
- Pasos `esOpcional=true` en la ruta (el cliente los activa al cotizar).
- `ReglaDeSeleccion` para casos que requieren lógica condicional.

### 4.5 Máquinas son opcionales
Solo impresoras y equipos con productividad variable por perfil
(hot-melt, plotter con distintas cuchillas) necesitan `MaquinaPerfilOperativo`.
Pasos manuales (embalaje, soldadura) solo necesitan centro de costo.

### 4.6 Productos componentes son sub-productos recursivos
Una tapa dura de libro es un producto con su propia ruta. El super motor
invocará recursivamente cuando SM-componentes esté implementado (P4).

### 4.7 Shape canónica se mantiene
`CotizacionCanonica { total, unitario, subtotales: {centroCosto,
materiasPrimas, cargosFlat}, pasos[], subProductos[], warnings[] }`.
Esta shape es estable y es el contrato público.

---

## 5. Technical debt conocida

### 5.1 Divergencias super motor vs v2
Los benchmarks muestran diferencias -10% a -70% entre motores en el seed
demo. Causa: los motores v2 usan **defaults hardcodeados**; el super motor
usa **datos reales del tenant**. No es bug. Ver `super-motor.benchmark.spec.ts`.

### 5.2 `inferirFamiliaDesdeTipo`
Función de fallback en super motor que infiere `familia` por
`tipoOperacion + nombre` cuando `op.familiaV2` está null. Legacy —
remover cuando la migration masiva (P6) termine.

### 5.3 Plantillas imperativas `material-plantillas.ts`
Fallback cuando un paso no tiene `ProcesoOperacionMaterial` declarados.
Remover cuando todos los pasos tengan materiales en DB.

### 5.4 Config producto con defaults de precio
Hoy el configProducto tiene `papelPrecioPorPliego`, `embalajePrecioBolsa`,
`impresionCostoClic`, etc. Esos valores deberían vivir en
`ProcesoOperacionMaterial.precioManual` del paso correspondiente, no a
nivel producto. Migración gradual.

### 5.5 Vínculo "variante → papel" no extensible
`ProductoVariante.papelVarianteId` asume siempre papel. Para productos
que no son de papel (vinilo, rígidos, textil) no aplica. Solución:
generalizar a `ProductoVariante.sustratoVariantes[]` o dejar que los
materiales del paso los declaren (enfoque más modelo-universal).

### 5.6 Endpoints `/cotizar` y `/cotizar-v2` coexisten
Eliminar `/cotizar` cuando el retiro P3 termine.

### 5.7 Migrations aplicadas directo a DB
Las migrations `20260419120000_populate_familia_v2_ops` y
`20260419130000_proceso_operacion_material` fueron aplicadas manualmente
(Prisma shadow DB falla). Ver `Prisma migrate dev` issue — workaround
documentado en ROLLBACK_PLAN.md.

---

## 6. Contexto de datos del tenant demo

**Tenant**: `0e7937a0-c093-4cdd-bc5e-fe4de1385ce8` (Grafica Corporearte)
**Admin**: `admin@gdi-demo.local` / `Admin123!`

### Productos seed con motor v2 + ruta:
- **Tarjetas de Visita** (`44e4133f-...`) motor digital_laser, ruta "Digital Estandar" con 6 pasos tras completar.
- **Vinilo adhesivo blanco** (`668f59e6-...`) motor gran_formato, SIN ruta (motor v2 trabaja sin ella).
- **Vinilo de corte** (`43d7d1cd-...`) motor vinilo_de_corte.
- **MDF Impreso** (`14516e74-...`) motor rigidos_impresos, SIN variantes (producto-level).
- **Talonarios emblocados** (`ef0f03ee-...`) motor talonario.

### Productos huérfanos (sin ProductoMotorConfig):
- Folletos rápidos, Señaladores, Tarjetas test.
- El super motor levanta config default del motor para cotizar.

### Ruta digital seed (poblada en esta sesión):
`0e0f3a51-5508-4fa5-a700-d29d4e18dd63` "Impresión Digital Laser (Estandar)":
```
1. OP-001 Diseño Grafico (opcional, tiempoFijo=30min)
2. OP-002 Impresion Laser: Color (obligatorio, perfil 40 pliegos/h, Ricoh)
3. OP-003 Laminado BOPP (opcional)
4. OP-004 Pre-prensa (obligatorio, tiempoFijo=10min)  ← poblado hoy
5. OP-005 Guillotinado (obligatorio, 500 pliegos/h)   ← poblado hoy
6. OP-006 Embalaje (obligatorio, 600 piezas/h)        ← poblado hoy
```

Con materiales declarativos (SM.D):
- OP-002: Papel Opalina 250gr × pliego + Clics CMYK × pliego (aplicaMultiCaras)
- OP-006: Bolsa celofán × pieza

---

## 7. Cómo retomar en la próxima sesión

1. **Contexto**: leer este documento + `memory/` del usuario.
2. **Branch**: `git checkout refactor/modelo-universal && git pull` (o rebasear si main avanzó).
3. **Infra local**:
   ```bash
   docker start gdi-saas-postgres  # si está detenido
   cd apps/api && npm run dev       # API
   cd ../.. && npm run dev          # Frontend
   ```
4. **Verificar que funciona** (smoke test):
   ```bash
   cd apps/api && npx jest productos-servicios/motors
   ```
   Esperado: 111+ tests passing.
5. **Verificar super motor end-to-end**:
   Login → producto Tarjetas de Visita → tab "Simular costo (v2)" →
   checkbox "Usar super motor" → Cotizar. Debería devolver ~$8.500
   con 4 pasos (impresión, pre-prensa, guillotinado, embalaje).
6. **Empezar por P1** (Tab ruta) o el pendiente que acordaste con el
   usuario. El resto son ortogonales.

---

## 8. Ideas fuera de alcance pero vale la pena registrar

- **Optimizador de rutas**: sugerir combinaciones de trabajos similares
  para aprovechar una misma corrida.
- **Versionado de rutas**: snapshot histórico para reproducir
  cotizaciones pasadas cuando la ruta cambia.
- **Multi-tenant catálogo de familias**: permitir que un tenant agregue
  familias custom a las 23 base.
- **Exportar a DXF/PDF**: desde el `<NestingPreview>` actual (ya es SVG).
- **Preview interactivo**: arrastrar piezas manualmente en el layout.

---

*Última actualización*: 2026-04-19 · *Rama*: `refactor/modelo-universal` ·
*Commit HEAD al escribir*: `d489618d` · *Aprox LOC eliminadas totales*:
~12.000.
