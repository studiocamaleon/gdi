# Plan: Refactor Arquitectónico Mayor — Módulos Transversales + Cobertura Completa

## Context

El sistema GDI tiene 5 motores de producto (`digital_sheet`, `gran_formato`, `vinilo_corte`, `talonario`, `rigidos_impresos`) que fueron diseñados para cubrir casos puntuales, pero:

1. **Solo cubren 8 de las 21 plantillas de maquinaria** del enum. Quedan huérfanas: DTF, DTF UV, UV cilíndrica, sublimación, 3D, router CNC, corte láser, plotter CAD, mesa de corte, e incluso IMPRESORA_INYECCION_TINTA como caso independiente.
2. **No cubren categorías enteras** de una gráfica real: bordado, serigrafía, tampografía, encuadernación, sublimación de objetos, fine art enmarcado, letreros corpóreos, productos compuestos (rollup, caja de luz, tótem), servicios profesionales, instalación, logística.
3. **La biblioteca `ProcesoOperacionPlantilla` es plana**: mezcla pasos de impresión con acabados, servicios y hardware sin semántica propia por dominio.
4. **No existe concepto de BOM** ni composición jerárquica de productos.
5. **Los motores están siloed**: cada acabado (laminado, corte, redondeado) debe volver a cablearse en cada motor aunque conceptualmente sea el mismo.

Queremos refactorizar el sistema hacia una arquitectura de **motores de impresión enfocados** + **módulos transversales** (terminaciones, servicios profesionales, componentes BOM, instalación, logística). Esto es un cambio grande, arriesgado, y es mejor hacerlo con una estrategia de safety que permita volver al sistema estable actual si el refactor falla a mitad de camino.

---

## Parte 0 — Beneficios y Journey (no técnico)

### Para quien cotiza día a día

**Hoy**: cada cotización es un producto único. Si el cliente pide rollup con diseño + instalación + envío urgente, hay que inventar un producto ficticio o cotizar a mano. Diseño, flete e instalación no existen formalmente en el sistema — se suman de memoria al final.

**Mañana**: la cotización se arma como Lego. En una sola pantalla se combinan impresos, terminaciones, servicios profesionales, componentes físicos, instalación y logística. Cada línea discriminada, cada monto automático. Buscás "rollup", aparece el preset con todo compuesto (lona + mecanismo + bolso). Agregás "instalación en local" desde el módulo correspondiente, "diseño nivel medio 3 hs" desde servicios, "envío urgente" desde logística. Todo en una cotización profesional.

### Para terminaciones (laminado, corte, ojetes, encuadernación)

**Hoy**: cada motor maneja sus terminaciones por separado. Cambiar el precio del laminado BOPP requiere tocarlo en 4 lugares. Agregar una máquina nueva obliga a re-cablear todas las terminaciones desde cero.

**Mañana**: UN catálogo transversal de Terminaciones, organizado por tipo (Laminados, Cortes, Bordes, Perforados, Ojetes, Encuadernación, Barniz, Hot Stamping). Cada terminación con su propio modelo de precio (por m², por pieza, por perímetro, por ojete). Cambio de precio se propaga automáticamente a todos los motores. Una nueva terminación se agrega una sola vez y queda disponible para todo.

### Para servicios profesionales (diseño, retoque, proof)

**Hoy**: no existen en el sistema. Se cobran por afuera o como "adicionales truchos". No hay visibilidad de cuánto representan en la facturación.

**Mañana**: catálogo de Servicios con niveles (simple/medio/complejo), tarifas por hora o por proyecto. Se agregan como ítems en cualquier cotización. Al fin de mes hay un reporte claro: "facturamos X horas de diseño, Y horas de retoque, Z proofs".

### Para productos compuestos (rollup, caja de luz, tótem, letras corpóreas)

**Hoy**: son el 30% del catálogo comercial real de una gráfica y el sistema no los soporta. Se pierden ventas o se cotiza a ojo.

**Mañana**: se definen una vez como "productos compuestos" con su bill of materials (BOM). Un rollup = impresión + mecanismo + bolso. Una caja de luz = tela backlit + marco aluminio + LED + fuente + servicio de ensamblado. Cambios de precio de proveedor se actualizan en un solo lugar y se reflejan en todas las cotizaciones futuras.

### Para el dueño del negocio

**Hoy**: no hay visibilidad de cuánto se factura por categoría (impresión vs acabados vs servicios vs instalación). Los márgenes se pierden en cosas que no se cobran (flete, preparación de archivos, horas de diseño).

**Mañana**: dashboard con breakdown por módulo. Ajustes de precio granulares. Agregar una máquina nueva (ej: DTF, bordado, sublimación) solo requiere agregar el motor — todo lo transversal ya está y se comparte. El sistema no deja escapar ningún costo.

### El beneficio en una frase

> Hoy el sistema es un molde rígido: "acá hay un producto, cotizá eso".
>
> Mañana el sistema es Lego: "armá la cotización que describe el trabajo real".

Una gráfica real no vende "un producto impreso". Vende soluciones que combinan impresión + acabado + servicio + hardware + instalación. El refactor hace que el software refleje esa realidad.

---

## Parte 1 — Inventario: cobertura actual vs. necesaria

### 1.1 Plantillas de maquinaria y su estado

| # | Plantilla | Motor actual | Categoría | Brecha |
|---|---|---|---|---|
| 1 | `IMPRESORA_LASER` | digital_sheet ✅ | Impresión hoja | Cubierto |
| 2 | `IMPRESORA_INYECCION_TINTA` | gran_formato ⚠️ | Impresión oficina/fine art | Mal ubicado: no es gran formato en muchos casos |
| 3 | `IMPRESORA_UV_FLATBED` | rigidos_impresos ✅ | Impresión rígidos | Cubierto |
| 4 | `IMPRESORA_UV_ROLLO` | gran_formato ✅ | Impresión rollo | Cubierto |
| 5 | `IMPRESORA_UV_MESA_EXTENSORA` | rigidos_impresos ✅ | Impresión híbrida | Cubierto (pero forzado a "rígidos") |
| 6 | `IMPRESORA_UV_CILINDRICA` | ❌ huérfana | Impresión cilíndrica 360° | No hay motor |
| 7 | `IMPRESORA_SOLVENTE` | gran_formato ✅ | Impresión rollo ecosolvente | Cubierto |
| 8 | `IMPRESORA_LATEX` | gran_formato ✅ | Impresión rollo latex | Cubierto |
| 9 | `IMPRESORA_SUBLIMACION_GRAN_FORMATO` | ❌ huérfana | Sublimación textil | No hay motor |
| 10 | `IMPRESORA_DTF` | ❌ huérfana | Transferencia textil | No hay motor |
| 11 | `IMPRESORA_DTF_UV` | ❌ huérfana | Transferencia rígidos UV | No hay motor |
| 12 | `IMPRESORA_3D` | ❌ huérfana | Fabricación aditiva | No hay motor |
| 13 | `GUILLOTINA` | 4 motores (como terminación) | Acabado | Debería ser módulo transversal |
| 14 | `PLOTTER_DE_CORTE` | vinilo_corte ✅ + digital_sheet (troquelado) ✅ | Corte contorno | Cubierto parcialmente |
| 15 | `PLOTTER_CAD` | ❌ huérfana | Plano técnico | No hay motor |
| 16 | `MESA_DE_CORTE` | ❌ huérfana | Corte flatbed | No hay motor |
| 17 | `ROUTER_CNC` | ❌ huérfana | Mecanizado rígidos | No hay motor |
| 18 | `CORTE_LASER` | ❌ huérfana | Corte láser CO2/fibra | No hay motor |
| 19 | `LAMINADORA_BOPP_ROLLO` | 4 motores (como terminación) | Acabado | Debería ser módulo transversal |
| 20 | `REDONDEADORA_PUNTAS` | 4 motores (como terminación) | Acabado | Debería ser módulo transversal |
| 21 | `PERFORADORA` | 4 motores (como terminación) | Acabado | Debería ser módulo transversal |

**Resultado**: 8 plantillas con motor propio, 9 huérfanas, 4 usadas como "terminación" dentro de motores (pero deberían ser módulos).

### 1.2 Categorías que no tienen ningún tipo de cobertura (ni motor ni plantilla)

- **Bordado computarizado** (falta plantilla MAQUINA_BORDADO + motor)
- **Serigrafía textil/industrial** (falta plantilla SERIGRAFIA + motor)
- **Tampografía** (falta plantilla TAMPOGRAFIA + motor)
- **Estampado Flex/Flock HTV** (se puede hacer con plotter + plancha, pero no hay flujo)
- **Sublimación de objetos rígidos** (tazas, puzzles, phone cases — requiere plantilla PRENSA_TRANSFERENCIA + motor)
- **Hot stamping / foil stamping** (requiere plantilla ESTAMPADORA_CALOR)
- **Encuadernación** (falta plantilla ENCUADERNADORA en varias modalidades)
- **Corte y confección textil** (falta MAQUINA_COSER, MAQUINA_OVERLOCK, TERMOSELLADORA)
- **Calandra textil** (sublimación textil necesita CALANDRA_TEXTIL)

### 1.3 Módulos transversales necesarios

| Módulo | Propósito | Estado actual |
|---|---|---|
| **Terminaciones** | Catálogo de acabados con modelo de costeo propio por tipo (m², m lineal, pieza, perímetro, ojete, cliché) | ❌ mezclado en ProcesoOperacionPlantilla |
| **Servicios Profesionales** | Diseño, retoque, vectorización, proof, digitalización bordado, etc. Por hora o por proyecto | ❌ no existe |
| **Componentes (BOM)** | SKUs físicos que se compran y revenden (mecanismos rollup, perfiles, LED, bastidores, bases) | ❌ no existe |
| **Instalación** | Servicios en obra con variables de zona, altura, tipo de superficie, sobrecargos | ❌ no existe |
| **Logística** | Envíos, mensajería, seguro, embalaje especial | ❌ no existe |
| **Productos Compuestos / Kits** | Composición jerárquica: producto final = N impresiones + N componentes + N terminaciones + servicios + instalación | ❌ no existe |

---

## Parte 2 — Arquitectura propuesta

### 2.1 Visión general de capas

```
┌─────────────────────────────────────────────────────────────┐
│ CAPA DE COTIZACIÓN (multi-ítem)                             │
│ Cotización = N productos + N servicios + N componentes +   │
│              N instalaciones + N logística                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────┬──────────────────────────────────────────────┐
│ PRODUCTOS    │ MÓDULOS TRANSVERSALES                        │
│ IMPRESOS     ├──────────────────────────────────────────────┤
│              │ • Terminaciones (catálogo con tipos propios) │
│ Motores      │ • Servicios Profesionales (por hora/proyecto)│
│ agrupados    │ • Componentes BOM (SKUs físicos)             │
│ por dominio: │ • Instalación (por zona/superficie/altura)   │
│              │ • Logística (envíos/seguro/embalaje)         │
│ - hoja/pliego│ • Productos Compuestos (composición BOM)     │
│ - rollo/planar│                                             │
│ - objeto     ├──────────────────────────────────────────────┤
│ - transferen.│ CATÁLOGOS (compartidos)                      │
│ - textil     │ • Materias Primas + Variantes                │
│ - 3D         │ • Máquinas + Perfiles operativos             │
│ - corte      │ • Centros de Costo + Tarifas por período     │
│              │ • Consumibles + Desgastes                    │
└──────────────┴──────────────────────────────────────────────┘
```

### 2.2 Motores agrupados por dominio (propuesta)

En vez de 5 motores ad-hoc, proponemos **7 motores por dominio físico/tecnológico**:

| Motor nuevo | Reemplaza | Plantillas que cubre |
|---|---|---|
| **`imp_hoja@1`** | digital_sheet, talonario | IMPRESORA_LASER, IMPRESORA_INYECCION_TINTA (hoja), + talonarios |
| **`imp_planar@1`** | gran_formato + rigidos_impresos unificados | IMPRESORA_UV_FLATBED, UV_MESA_EXTENSORA, UV_ROLLO, SOLVENTE, LATEX, SUBLIMACION, INYECCION_TINTA (fine art) |
| **`imp_objeto@1`** | — nuevo | IMPRESORA_UV_CILINDRICA + jigs flatbed para objetos |
| **`imp_transfer@1`** | — nuevo | IMPRESORA_DTF, IMPRESORA_DTF_UV, sublimación de objetos |
| **`imp_textil@1`** | — nuevo | Serigrafía textil, bordado, vinyl textil (HTV) |
| **`fab_3d@1`** | — nuevo | IMPRESORA_3D (FDM/SLA/SLS) |
| **`corte@1`** | vinilo_corte + troquelado digital_sheet | PLOTTER_DE_CORTE, MESA_DE_CORTE, CORTE_LASER, ROUTER_CNC, PLOTTER_CAD |

**Razón del agrupamiento**: cada motor agrupa tecnologías que comparten modelo de cálculo (ej: todos los rollos/planares cotizan por m², todos los objetos cotizan por pieza + jig, todos los transfers tienen blanco obligatorio + cobertura, etc).

### 2.3 Módulos transversales — modelo de datos

Cada módulo tendría su propio conjunto de tablas Prisma, su propia UI y su propio cálculo de costos. **El motor del producto NO los conoce**; la cotización los compone.

#### `modulo_terminaciones`
```
TerminacionCatalogo (id, codigo, nombre, tipo, unidadCostoBase, pasoOperacionPlantillaId?)
  tipos: 'corte' | 'laminado' | 'borde' | 'perforado' | 'redondeado' |
         'ojete' | 'costura' | 'dobladillo' | 'velcro' | 'barniz_spot' |
         'hot_stamping' | 'embossing' | 'encuadernacion'

TerminacionCatalogoRegla (id, terminacionId, variable, modelo)
  variables: 'area_m2' | 'perimetro_ml' | 'unidades' | 'ciclos' | 'setup_fijo'

TerminacionCatalogoCompatibilidad (terminacionId, motorCode, subfamiliaSustrato)
  — define qué terminaciones aplican a qué producto/sustrato
```

#### `modulo_servicios_profesionales`
```
ServicioCatalogo (id, codigo, nombre, tipo, unidadCotizacion, tarifaBase)
  tipos: 'diseno' | 'retoque' | 'vectorizacion' | 'proof' | 'digitalizacion_bordado' | 'consultoria' | 'preflight' | 'adaptacion'

ServicioCatalogoNivel (id, servicioId, nivel, tarifa, minHoras, maxHoras)
  — permite "diseño simple/medio/complejo" con tarifas distintas
```

#### `modulo_componentes_bom`
```
ComponenteCatalogo (id, codigo, nombre, materiaPrimaVarianteId, tipo)
  tipos: 'mecanismo' | 'estructura' | 'iluminacion' | 'fijacion' | 'embalaje' | 'accesorio'

ProductoCompuesto (id, nombre, items: ProductoCompuestoItem[])
ProductoCompuestoItem (compuestoId, tipo, referenciaId, cantidad, metodoCosteo)
  tipos: 'impreso' (ref: ProductoServicio) | 'componente' (ref: Componente) |
         'servicio' (ref: Servicio) | 'terminacion' (ref: Terminacion)
```

#### `modulo_instalacion`
```
InstalacionCatalogo (id, codigo, nombre, tipoSuperficie, unidad, tarifaBase)
  superficies: 'pared' | 'vidrio' | 'vehiculo' | 'piso' | 'techo' | 'rigidos_montaje'

InstalacionSobrecargo (id, tipo, porcentaje, condicion)
  tipos: 'altura' | 'nocturno' | 'feriado' | 'retiro_previo' | 'preparacion_superficie'

InstalacionZona (id, nombre, tarifaViaje, radio)
```

#### `modulo_logistica`
```
LogisticaCatalogo (id, codigo, nombre, tipo, unidadBase)
  tipos: 'mensajeria' | 'transporte_especial' | 'urgente' | 'seguro' | 'embalaje_especial'

LogisticaZona (id, nombre, tarifaBase, modificadorPeso, modificadorDimensiones)
LogisticaPaquete (id, nombre, tipoEmbalaje, costoBase)
```

### 2.4 Cotización multi-ítem

El modelo de cotización debe cambiar de "1 cotización = 1 producto" a "1 cotización = N ítems heterogéneos":

```
Cotizacion (id, clienteId, fechaEmision, validez, ...)
CotizacionItem (id, cotizacionId, orden, tipo, referenciaId, cantidad, metadata)
  tipos:
    'producto_impreso' → ref a ProductoServicio + snapshot de motor
    'producto_compuesto' → ref a ProductoCompuesto (BOM)
    'terminacion' → ref a TerminacionCatalogo
    'servicio' → ref a ServicioCatalogo
    'componente' → ref a ComponenteCatalogo
    'instalacion' → ref a InstalacionCatalogo
    'logistica' → ref a LogisticaCatalogo
```

Cada ítem tiene su propio modelo de costeo, y la cotización los suma + aplica IVA/descuentos.

---

## Parte 3 — Validación de cobertura: ¿la nueva arquitectura soporta todo?

Repasé los 30 productos compuestos de la investigación y los 21 tipos de maquinaria. La propuesta los cubre así:

| Producto real | Cómo se modela |
|---|---|
| Tarjeta personal | 1 ítem `producto_impreso` (motor `imp_hoja`) + 1 ítem `terminacion` (redondeo) |
| Flyer laminado | 1 ítem `producto_impreso` + 1 ítem `terminacion` (laminado BOPP) |
| Lona con ojetes + bolsillo | 1 ítem `producto_impreso` (motor `imp_planar`) + 1 ítem `terminacion` (ojetes por unidad) + 1 ítem `terminacion` (bolsillo por ml) |
| **Rollup 85×200** | 1 ítem `producto_compuesto` que contiene: 1 impreso (motor `imp_planar`) + 1 componente (mecanismo rollup) + 1 componente (bolso) + 1 servicio (ensamblado) |
| **Caja de luz SEG** | 1 `producto_compuesto` = 1 impreso (tela backlit, motor `imp_planar`) + 1 componente (marco aluminio) + 1 componente (módulos LED) + 1 componente (fuente) + 1 servicio (ensamblado) + opcional 1 instalación |
| **Vinilado local 40m²** | N ítems `producto_impreso` (motor `imp_planar`) + 1 ítem `terminacion` (laminado) + 1 ítem `terminacion` (corte contorno) + 1 ítem `instalacion` (vidrio × m²) + 1 ítem `logistica` (transporte) |
| **Remera DTF** | 1 ítem `producto_impreso` (motor `imp_transfer`, DTF) + 1 componente (prenda blank) + 1 servicio (prensado) |
| **Taza sublimada** | 1 componente (taza blank) + 1 ítem `producto_impreso` (motor `imp_transfer` sublimación de objeto) |
| **Taza impresa UV cilíndrica** | 1 componente (taza blank) + 1 ítem `producto_impreso` (motor `imp_objeto` UV cilíndrica) |
| **Bandera sublimada** | 1 ítem `producto_impreso` (motor `imp_planar` sublimación textil) + 1 servicio (corte y confección) + 1 componente (mástil) + 1 componente (base) |
| **Letra corpórea iluminada** | 1 ítem `producto_impreso` (router CNC, motor `corte`) + 1 componente (LED) + 1 componente (fuente) + 1 servicio (ensamblado) + 1 instalación (altura) |
| **Cartel acrílico con standoffs** | 1 ítem `producto_impreso` (motor `imp_planar` UV flatbed) + 1 ítem `corte` (corte láser o mesa) + 4 componentes (standoffs) + 1 instalación |
| **Libro tapa dura 200 pp** | 1 ítem `producto_impreso` (motor `imp_hoja`, 200 pp) + 1 ítem `terminacion` (encuadernación cosido hilo + tapa dura) |
| **Figura 3D souvenir** | 1 ítem `producto_impreso` (motor `fab_3d`) + 1 servicio (postproceso) + 1 embalaje |
| **Car wrap full** | N ítems `producto_impreso` (motor `imp_planar` latex/solvent) + N ítems `terminacion` (laminado + corte contorno) + 1 ítem `instalacion` (vehículo full wrap por zona) |

**Conclusión**: la arquitectura cubre todos los casos de la investigación.

---

## Parte 4 — Estrategia de safety / rollback

### 4.1 Estado actual de git (snapshot)

- Branch actual: `feature-troquelados` (1 commit adelante de `main`)
- Main branch: `main` (último commit `69753746`)
- NO hay CI/CD configurado
- NO hay hooks pre-commit (ni husky)
- 40 migraciones Prisma en histórico
- 4 archivos de tests (jest)
- Tests NO se corren automáticamente
- Repo sin tags de releases

### 4.2 Estrategia propuesta: **Tag de anchoring + branch dedicado + DB snapshot**

#### Paso 1 — Mergear lo que ya está estable a `main`
```bash
# Mergeamos feature-troquelados a main (es estable y testeado manualmente)
git checkout main
git merge --no-ff feature-troquelados -m "feat: troquelado en motor digital laser (estable)"
git push origin main
```

#### Paso 2 — Crear tag de anchoring (punto de restauración garantizado)
```bash
git tag -a v1.0-stable-pre-refactor main \
  -m "Sistema estable antes del refactor de módulos transversales.

  Estado: 5 motores funcionales (digital_sheet, gran_formato, vinilo_corte, talonario, rigidos_impresos)
  + troquelado en digital_sheet. 40 migraciones Prisma. Funcionando en producción.

  Para restaurar: git checkout v1.0-stable-pre-refactor"

git push origin v1.0-stable-pre-refactor
```

#### Paso 3 — Snapshot de base de datos
```bash
# Hacer dump de la DB para poder restaurarla si las migraciones del refactor rompen datos
pg_dump -h localhost -p 5436 -U postgres gdi_saas > \
  backups/gdi_saas_pre_refactor_$(date +%Y%m%d_%H%M).sql

# Marcar la última migración estable
ls apps/api/prisma/migrations/ | tail -1 > backups/last_stable_migration.txt
```

#### Paso 4 — Crear branch de refactor dedicado
```bash
git checkout -b refactor/modulos-transversales main
# Todo el trabajo del refactor vive acá
```

#### Paso 5 — Estrategia de checkpoints dentro del refactor
Dentro del branch, crear sub-tags de checkpoint para cada fase mayor:
```bash
git tag refactor-checkpoint-1-motores-unificados
git tag refactor-checkpoint-2-modulo-terminaciones
git tag refactor-checkpoint-3-modulo-servicios
# etc.
```
Cada checkpoint debe dejar el sistema en estado compilable y con los tests verdes.

#### Paso 6 — Documentar el plan de rollback
Crear `ROLLBACK_PLAN.md` en la raíz con:
- Cómo volver al tag estable
- Cómo restaurar la DB desde el dump
- Cómo marcar migraciones como revertidas en Prisma
- Lista de archivos que NO deben tocarse durante el refactor (para poder hacer cherry-pick de hotfixes a main)

### 4.3 Si el refactor se vuelve inviable

**Plan A — Descartar todo y volver al tag estable**:
```bash
git checkout main
git reset --hard v1.0-stable-pre-refactor
# Restaurar DB desde backup
psql -h localhost -p 5436 -U postgres gdi_saas < backups/gdi_saas_pre_refactor_XXXXX.sql
# Borrar branch de refactor
git branch -D refactor/modulos-transversales
```

**Plan B — Rescatar partes funcionales del refactor**:
```bash
git checkout main
# Cherry-pick solo los commits del refactor que sean estables e independientes
git cherry-pick <commit-hash>
```

---

## Parte 5 — Plan de implementación del refactor (alto nivel)

**NO** tocaríamos en este plan las máquinas/plantillas huérfanas todavía. La prioridad es la **estructura**. Los motores nuevos vienen después.

### Fase 0 — Preparación (1-2 días)
- Mergear feature-troquelados a main
- Crear tag v1.0-stable-pre-refactor
- Dump de DB
- Crear ROLLBACK_PLAN.md
- Crear branch refactor/modulos-transversales

### Fase 1 — Módulo de Terminaciones (1-2 semanas)
**Objetivo**: mover guillotina/laminado/redondeado/perforado de los motores a un módulo dedicado.
- Schema: `TerminacionCatalogo`, `TerminacionRegla`, `TerminacionCompatibilidad`
- Migración de datos: los 4 `TERMINACION_PLANTILLAS_SOPORTADAS` actuales pasan a registros del catálogo
- UI: nuevo módulo /terminaciones con CRUD
- Integración: los motores actuales leen del nuevo catálogo en vez de tener la lógica hardcodeada
- **Checkpoint**: el sistema sigue funcionando idéntico con los 4 acabados actuales, pero el camino de los datos cambió

### Fase 2 — Módulo de Componentes BOM (1-2 semanas)
**Objetivo**: habilitar Tipo B del documento Gran Formato (productos con mecanismo/estructura).
- Schema: `ComponenteCatalogo`, `ProductoCompuesto`, `ProductoCompuestoItem`
- UI: catálogo de componentes (rollup mechanism, bastidor, perfil LED, etc.)
- UI: editor de productos compuestos
- Integración en cotización: nuevo tipo de ítem `producto_compuesto`
- **Checkpoint**: poder cotizar un rollup real

### Fase 3 — Módulo de Servicios Profesionales (1 semana)
- Schema: `ServicioCatalogo`, `ServicioCatalogoNivel`
- UI: catálogo de servicios por hora/proyecto
- Integración en cotización: nuevo tipo de ítem `servicio`
- **Checkpoint**: cotizar "diseño + impresión" como 2 ítems separados

### Fase 4 — Módulos de Instalación + Logística (1-2 semanas)
- Schema: `InstalacionCatalogo`, `InstalacionSobrecargo`, `InstalacionZona`, `LogisticaCatalogo`, `LogisticaZona`
- UI: catálogos + calculadoras
- Integración en cotización
- **Checkpoint**: cotizar Tipo C del documento Gran Formato (vinilado local con instalación)

### Fase 5 — Refactor de Cotización multi-ítem (1-2 semanas)
**Objetivo**: reemplazar "1 cotización = 1 producto" por "1 cotización = N ítems heterogéneos".
- Schema: nuevo `CotizacionItem` con campo `tipo` discriminador
- Migración de cotizaciones existentes a nuevos ítems
- UI: rediseño del editor de cotización
- **Checkpoint**: todas las cotizaciones viejas siguen funcionando + las nuevas pueden mezclar ítems

### Fase 6 — Reagrupación de motores (2-3 semanas)
**Objetivo**: unificar motores por dominio en vez de ad-hoc.
- `imp_hoja@1` = digital_sheet + talonario
- `imp_planar@1` = gran_formato + rigidos_impresos
- `corte@1` = vinilo_corte + troquelado
- Compatibilidad: los motores viejos siguen funcionando via alias durante un período de gracia
- **Checkpoint**: todos los productos existentes migrados al nuevo motor equivalente sin perder data

### Fase 7 — Motores nuevos (iterativo, post-refactor)
Recién acá agregamos los motores nuevos para cubrir las plantillas huérfanas:
- `imp_objeto@1` (UV cilíndrica + jigs)
- `imp_transfer@1` (DTF, DTF UV, sublimación objetos)
- `imp_textil@1` (serigrafía, bordado, HTV)
- `fab_3d@1` (3D)

Cada uno es un mini-proyecto con su propia investigación, UI, cálculo. Se pueden hacer en cualquier orden según prioridad comercial.

### Fase 8 — Plantillas de producto compuesto (continuo)
Crear "presets" de productos compuestos típicos: rollup, caja de luz, bastidor, letra corpórea, etc. Cada preset es un `ProductoCompuesto` con sus items predefinidos.

---

## Parte 6 — Archivos críticos a modificar/crear

### Nuevos (refactor)
```
apps/api/prisma/schema.prisma
  + TerminacionCatalogo, TerminacionRegla, TerminacionCompatibilidad
  + ServicioCatalogo, ServicioCatalogoNivel
  + ComponenteCatalogo
  + ProductoCompuesto, ProductoCompuestoItem
  + InstalacionCatalogo, InstalacionSobrecargo, InstalacionZona
  + LogisticaCatalogo, LogisticaZona, LogisticaPaquete
  + CotizacionItem (con discriminador tipo)

apps/api/src/terminaciones/  (nuevo módulo NestJS)
apps/api/src/servicios-profesionales/  (nuevo)
apps/api/src/componentes-bom/  (nuevo)
apps/api/src/instalacion/  (nuevo)
apps/api/src/logistica/  (nuevo)

src/app/(dashboard)/terminaciones/
src/app/(dashboard)/servicios/
src/app/(dashboard)/componentes/
src/app/(dashboard)/instalacion/
src/app/(dashboard)/logistica/

src/components/cotizacion/multi-item-editor.tsx  (nuevo editor de cotización)
```

### Archivos críticos actuales (a modificar con cuidado)
```
apps/api/src/productos-servicios/productos-servicios.service.ts
  — 15000+ líneas, NO refactorizar todo de una. Ir extrayendo módulos uno por uno.

apps/api/src/productos-servicios/motors/*.ts
  — Los motores viejos siguen existiendo hasta la Fase 6. Luego se reagrupan.

src/components/productos-servicios/motors/*.tsx
  — UI tabs se modifican gradualmente para leer del nuevo módulo de terminaciones.

apps/api/prisma/schema.prisma
  — Cada fase agrega tablas nuevas. NO borrar las viejas hasta la Fase 6+.
```

### Archivos de safety a crear
```
ROLLBACK_PLAN.md  — en raíz del repo
backups/gdi_saas_pre_refactor_YYYYMMDD.sql  — dump de DB
backups/last_stable_migration.txt
docs/refactor-plan.md  — copia de este plan en el repo
```

---

## Parte 7 — Criterios de éxito y verificación

Cada fase se considera exitosa si:

1. **Compila sin errores** (`npx tsc --noEmit`)
2. **Los tests existentes pasan** (`npm --prefix apps/api run test`)
3. **El sistema arranca** (frontend + backend levantan sin errores)
4. **Los productos existentes se siguen cotizando igual** (no se rompe nada para atrás)
5. **Una cotización manual de testing** del caso de uso de la fase funciona end-to-end

Al final del refactor, el criterio global es:
- Todas las cotizaciones históricas siguen accesibles y re-cotizables
- Los 30 productos reales de la investigación se pueden modelar en el nuevo sistema
- Los 21 tipos de máquinas tienen un motor que los soporta (aunque algunos motores sean nuevos y se agreguen post-refactor)
- La UI permite crear un producto compuesto tipo rollup en menos de 5 minutos

---

## Parte 8 — Lo que NO vamos a hacer en este refactor

Para mantener el scope acotado:
- ❌ No vamos a tocar autenticación, tenants, permisos
- ❌ No vamos a tocar el sistema de materias primas base (familias/subfamilias). Solo lo vamos a cablear mejor a los módulos nuevos.
- ❌ No vamos a tocar el editor de procesos ni los centros de costo
- ❌ No vamos a tocar el módulo de máquinas/perfiles operativos
- ❌ No vamos a agregar los motores nuevos de huérfanas dentro del refactor (eso es Fase 7+, post-refactor)
- ❌ No vamos a implementar integración con contabilidad, facturación, stock real
- ❌ No vamos a migrar a microservicios ni cambiar el stack

El refactor es sobre la **capa de productos/cotización**. Todo lo demás sigue igual.

---

## Decisiones tomadas

1. ✅ **Mergear `feature-troquelados` → `main` primero** y comenzar el refactor desde main limpio. El trabajo de troquelado digital láser queda como parte de la base estable v1.0.
2. ✅ **Plan A — rollback completo si falla**: tag `v1.0-stable-pre-refactor` + dump de base de datos + documento `ROLLBACK_PLAN.md`. Si el refactor se vuelve inviable, volvemos al tag y restauramos la DB desde el dump. Descarte completo sin miedo.
3. ✅ **Ir directo a Fase 1 (Terminaciones) end-to-end**, sin hacer una Fase 0.5 con todos los schemas vacíos primero. Razón: schemas vacíos sin uso envejecen rápido y generan deuda. Preferimos aprender de la primera implementación completa antes de definir los modelos de datos de los otros módulos. El schema de cada módulo se define cuando se va a usar.
4. ✅ **Guardar el plan como `docs/refactor-plan.md`** en el repo para tenerlo versionado junto al código.

---

## Referencias

- Documento fuente: `/Users/lucasgomez/Downloads/GDI_Procesos_Gran_Formato.docx`
- Docs internos: `docs/materia-prima-modelo-familias-subfamilias.md`, `docs/materia-prima-analisis-funcional-tecnico-por-plantilla.md`, `docs/procesos-template-functional-catalog.md`
- Investigación web: 60+ fuentes consultadas (DTF, UV cilíndrica, sublimación, 3D, CNC, láser, bordado, serigrafía, encuadernación, fine art, productos compuestos, car wrap, letreros corpóreos, etc.)
