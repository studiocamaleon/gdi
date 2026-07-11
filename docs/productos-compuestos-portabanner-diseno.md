# Productos compuestos vendidos por unidad — caso Portabanner Roll Up

**Fecha:** 2026-07-10
**Estado:** Diseño / propuesta (investigación completa, ejecución no arrancada)
**Caso de referencia:** "Portabanner Roll Up con Lona impresa" = 1 estructura Roll Up + 1 lona Frontlight 80×200 cm impresa en máquina UV. Se vende por unidad; por debajo tiene ruta de producción como cualquier producto.

---

## 1. Hallazgo central de la investigación

**No hace falta un modelo nuevo de "producto compuesto" (BOM/kit) para este caso.** El modelo universal por pasos ya soporta la composición vía **ruta + slots de material**, y hay un precedente implementado E2E que usa exactamente ese patrón: la familia SELLOS (cuerpo Trodat + goma laserable + montaje). El sello es "un producto comercial cuya composición es su ruta de producción", sin ninguna tabla de receta.

Referencias de estado actual:

- No existe entidad `BOM`/`Kit`/`ComponenteProducto` en el schema. El sustituto es `ProductoConfigPasoSlotMaterial` con roles `SUSTRATO | COMPONENTE | CONSUMIBLE | PACKAGING` (`apps/api/prisma/schema.prisma:1521-1557`).
- Un modelo formal de sub-productos con cotización recursiva está explícitamente diferido: "Etapa G opcional" (`docs/plan-tecnico-etapa-B-piloto-gran-formato.md:92`) y gap **G-M6** del motor (`apps/api/src/motor-universal/motor.service.ts:369`, `docs/motor-por-pasos-analisis/auditoria-gaps-2026-04-25.md`).
- El motor (`MotorUniversalService.cotizar`) suma en un mismo ítem: material por m²/nesting (lona) + material por pieza (estructura) + tiempo de máquina por paso + cargos directos. Fórmulas de slot: `por_m2 | por_metro_lineal | por_pieza | por_unidad_productiva | fijo` (`schema.prisma:1540`, ejecución en `motor.service.ts:2970-3139`).

## 2. Modelado propuesto (sin cambios de motor)

### 2.1 La estructura Roll Up como materia prima

Alta de `MateriaPrima` con `unidadStock = UNIDAD`, familia `POP_EXHIBIDOR` (o `HERRAJE_ACCESORIO`), una `MateriaPrimaVariante` por modelo comercial:

| Variante (ejemplo) | Atributos de variante |
|---|---|
| Roll Up Económico 80 | `anchoLonaMm: 800`, `altoLonaMm: 2000`, `calidad: economico` |
| Roll Up Premium 85 | `anchoLonaMm: 850`, `altoLonaMm: 2000`, `calidad: premium` |
| Roll Up Doble Faz 100 | `anchoLonaMm: 1000`, `altoLonaMm: 2000`, `caras: 2` |

Los atributos `anchoLonaMm`/`altoLonaMm` en `atributosVarianteJson` siguen el patrón sellos (el cuerpo Trodat lleva `anchoPolimero`/`altoPolimero` y de ahí el sistema deriva medidas). Conviene un template `estructura_exhibidor_v1` en `src/lib/materia-prima-templates.ts` para gobernar esos campos.

### 2.2 El producto comercial

`Producto` "Portabanner Roll Up con lona impresa":

- `unidadComercial = 'unidad'` — se vende por unidad; el precio/margen aplica al conjunto.
- `modoMedidas = FIJA` con `medidaDefaultAnchoMm/AltoMm = 800×2000` para la versión simple; o `COMERCIAL_ELIGE` + `medidasPredefinidasJson` si un solo producto cubre varios anchos (ver §3).

### 2.3 La ruta de producción

Ruta reusable "Exhibidor con lona impresa" (sirve también para banners con soporte, marcos, etc.):

1. **`pre_prensa`** — control/armado de archivo (M-0). Opcionalmente la herramienta de medidas desde PDF ya existente.
2. **`impresion_por_area`** — máquina UV (M-1 o M-2 con candidatas), `modoColor` como cualquier gran formato. Slot `SUSTRATO`: variante "Lona Frontlight 13oz", `estrategiaCosto = consumed-length` (rollo) o `m2-exact`, `formula = por_m2`. Las piezas 800×2000 salen del JobContext (medida fija del producto) y el nesting calcula consumo real con desperdicio.
3. **`refilado` / `corte`** — según terminación (ojales/bolsillo si aplica → paso opcional).
4. **`ensamble_estructural`** (`permiteSlotsAdicionales: true`, `familias.ts:1169`) — colocar lona en la estructura. Slot rol `COMPONENTE`: la variante de estructura, `formula = por_pieza` (cantidad = cantidad vendida), `cantidadFactor = 1`. Tiempo T-1 fijo (ej. 10 min) o T-2 por productividad.
5. **(Opcional) `packaging`** — bolso/tubo como slot `PACKAGING` `por_pieza`, o cargo directo.

Con esto el costo del ítem = lona consumida (m² reales con merma de nesting) + minutos de UV a tarifa del centro de costo + estructura por unidad + minutos de ensamble + packaging. El precio se aplica arriba con el método comercial vigente (margen, IVA por fuera, IIBB por dentro). **Todo esto es configuración, no código.**

## 3. Variantes de tamaño/calidad: dos estrategias

**A. Un producto por variante (recomendada para arrancar).** "Portabanner 80×200 Económico", "Portabanner 100×200 Premium", etc. Medida FIJA, slot de estructura `HARDCODED`. Cero ambigüedad, cero riesgo de inconsistencia medida↔estructura. Es lo que se hizo con sellos (un producto por vía, el modelo elegible por slot).

**B. Un producto paramétrico.** `modoMedidas = COMERCIAL_ELIGE` con medidas predefinidas (80/85/100/120 × 200) + slot de estructura `COMERCIAL_ELIGE` con candidatos (`ProductoConfigPasoSlotMaterialCandidato`). Riesgo: el comercial puede elegir medida 100 con estructura de 80. Mitigación futura: `MOTOR_ELIGE_AUTO` con regla que matchee `anchoLonaMm` de la variante contra la medida del JobContext — el mecanismo de selección automática existe, la regla habría que escribirla. No bloquea la fase 1.

## 4. Qué NO cubre este patrón (límites conocidos, aceptados)

1. **Pricing por componente dentro del ítem.** El producto tiene una sola `unidadComercial` y un solo método de precio: no se puede dar margen distinto a la lona vs. la estructura dentro del mismo ítem. Para un producto vendido por unidad esto es correcto (el margen es del conjunto). Si algún día se necesita margen por componente → ese sí es el gap G-M6.
2. **Recursión producto-dentro-de-producto.** La lona del portabanner no es "el producto Lona 80×200" cotizado adentro de otro: es el mismo sustrato consumido por la ruta del portabanner. Se pierde reutilizar la config del producto lona, pero se gana simplicidad y trazabilidad (un solo snapshot). La cotización recursiva queda diferida a Etapa G, solo si aparecen casos donde duplicar configuración de pasos se vuelva insostenible (ej. muchos compuestos que comparten un semi-elaborado complejo).
3. **Combos multi-línea.** Si el cliente quiere "portabanner + lona de repuesto", eso son dos `CotizacionItem` de la misma cotización — ya soportado, no requiere nada.

## 5. Plan de ejecución propuesto

- **Fase 1 — Piloto por configuración (sin código, o casi):**
  1. Template `estructura_exhibidor_v1` en `materia-prima-templates.ts` + presets de estructuras Roll Up en `material-presets.js` (patrón sellos/Trodat).
  2. Seed/alta de subcategoría comercial (ej. `via_publica / exhibidores`).
  3. Crear ruta "Exhibidor con lona impresa" + producto "Portabanner Roll Up 80×200" (estrategia A).
  4. Cotizar E2E desde el sheet comercial y validar desglose (m² lona, minutos UV, estructura, ensamble).
- **Fase 2 — Ergonomía (si el piloto valida):** más medidas/calidades (estrategia A o B), regla de auto-selección estructura↔medida, y eventualmente una "plantilla de producto compuesto" que scaffoldee ruta+slots para acelerar el alta de esta clase de productos.
- **Fase 3 — Solo si aparece necesidad real:** G-M6 / Etapa G (sub-productos con cotización recursiva y pricing por componente). Hoy no lo justifica ningún caso conocido.

## 6. Otros productos que caen en el mismo patrón

Banderas con mástil, marcos snap con impresión, cuadros con bastidor, displays de mostrador, banners con soporte X, chapas con herrajes: todos son "algo impreso por medida + componentes por unidad + ensamble", y se modelan igual: ruta con paso de impresión (slot sustrato) + paso de ensamble (slots componente `por_pieza`).
