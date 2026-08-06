# Configurador 3D de cartelería — diseño de integración con el motor

> **Estado**: F1 + F2 IMPLEMENTADAS (2026-08-04, sin commitear) — familias
> `estructura_bastidor` + `iluminacion_led`, input `profundidadMm`, plantillas
> de biblioteca y guards; verificada E2E en dev con el producto
> CARTEL-BACKLIGHT (ver §10) y configurador 3D embebido en el sheet (§11).
> F3 (corpóreas + acrílico) y F4 (SVG libre + ficha técnica) pendientes. Origen: prototipo funcional del
> usuario en claude.ai/design (`signage/`, 14 archivos) + investigación propia
> (`uploads/grafo-motor-carteleria.md`) + relevamiento de gran formato de
> Holdprint (§6 de holdprint-productos-relevamiento.md).
> **Alcance decidido**: Backlight · Frontlight · Corpóreas en capas · Cajas de
> acrílico. **Afuera**: letra impresa 3D (vive en el módulo `letras3d/`
> aparte) y wrapping/toldos/serigrafía (rubros distintos).

---

## 1. La idea en una frase

El comercial configura un cartel en un editor 3D (medidas, estructura, cara,
iluminación, capas), ve el objeto armarse en vivo, y **el precio que se mueve
al lado sale del motor universal** — biblioteca real, tarifas del centro real,
margen real. La ficha técnica con snapshot 3D + BOM se convierte en la OT.

Contra Holdprint: ellos resuelven este rubro con **127 tótems precocinados +
checklist + fórmulas de m²**. Esto lo reemplaza con 4 configuradores
paramétricos. No es paridad: es otra categoría.

## 2. Principio rector — el 3D deriva, el motor cotiza

El `computeBOM()` del prototipo mezcla dos cosas que hay que separar:

| | Se queda (en el configurador) | Se tira (lo hace el motor) |
|---|---|---|
| **Derivación geométrica** | ml de perfil, puntos de soldadura, m² de chapa con desarrollo, m² de lona + costuras, N LEDs, watts, ml de cable, m² por capa | |
| **Precios y tiempos** | | precios mock del catálogo JS, tarifas `LABOR` hardcodeadas, margen 45% suelto |

**Una sola fuente de verdad**: el panel de costo del configurador es un
*render del desglose del motor*, nunca un cálculo propio. El "tiempo real" es
llamar al endpoint de cotización con debounce (ya cotizamos en vivo en el
sheet hoy). Si el motor no responde, el panel muestra "recalculando", no un
número local.

Las fórmulas de horas del prototipo (`horasHerreria = 1.5 + ml×0.10 +
puntos×0.18`, etc.) son **excelentes defaults de configuración del paso**
(productividad T-2/T-3), no constantes de código.

## 3. Inventario — qué existe ya (verificado contra el código)

| Pieza necesaria | Estado | Dónde |
|---|---|---|
| Tiempo por perímetro de corte | ✅ | magnitud `perimetro_piezas_m` (motor.service.ts:5621); mecanizadas Láser/CNC cotizan recorrido÷velocidad con perfiles reales |
| Tiempo por área | ✅ | magnitud `area_piezas_m2` |
| Selección de componente por capacidad (fuente 60/150/350 W) | ✅ | selector `MENOR_CAPACIDAD` (anilladora) |
| Subfamilias eléctricas | ✅ | `MODULO_LED_CARTELERIA`, `FUENTE_ALIMENTACION_LED`, `CABLEADO_CONECTICA`, `CONTROLADOR_LED`, `NEON_FLEX_LED`, `ACCESORIO_NEON_LED` (schema, huérfanas post-poda) |
| Subfamilias estructurales | ✅ | `METAL_ESTRUCTURA` → `CHAPA_METALICA`, `PERFIL_ESTRUCTURAL`; `PINTURA_CARTELERIA` |
| Presets de slots | ✅ | `soldadura` y `electricidad` ya definidos en familias.ts (:162, :171) |
| Capas = pasos múltiples sobre la misma geometría | ✅ | patrón tapa/interior (cada capa un paso con su slot, su proceso y su merma) |
| Nesting de lona contra ancho de rollo | ✅ | shelf-rollo (mejor que el prototipo, que aproxima costuras) |
| Vinilo, laminado, armado, cargos | ✅ | `plotter_corte`, laminado, `ensamble_estructural`, cargos de orden |
| Herramienta visual embebida en el sheet | ✅ precedente | configurador de sellos (editor → JobContext → motor) |
| Ficha técnica PDF | ✅ pipeline | jsPDF (3 PDFs existentes) |

## 4. Lo que falta — dos familias y un input

### 4.1 Familia `estructura_bastidor` (la primitiva "estructura derivada de la medida")

La que faltaba en el análisis de Holdprint (ellos: FRAME +
VERTICAL/HORIZONTAL_REINFORCEMENT con separación máxima). El prototipo trae
las fórmulas listas:

```
bastidor doble (backlight):  ml = 2·(2·(W+H)) + 4·D + refuerzos·2 + conectores·D
bastidor simple (frontlight): ml = 2·(W+H) + refuerzos en un plano
refuerzos verticales = floor((W·100 − 1) / sepV_cm)   (ídem horizontales)
puntos de soldadura = vértices + cruces de refuerzo
cenefa (opcional): m² = perímetro × (D + 2·solapa) × 1.08
pintura (opcional): m² = ml × desarrollo del perfil × 1.1
```

- Slots: `perfil` (PERFIL_ESTRUCTURAL, consumo = ml derivados), `chapa_cenefa`
  (CHAPA_METALICA, opcional), `pintura` (PINTURA_CARTELERIA, opcional).
- Tiempo: T-2/T-3 con productividad sobre `ml_estructura` y
  `puntos_soldadura` (outputs canónicos nuevos).
- M-0 (herrería manual) o M-1 (soldadora, si algún día vuelve la plantilla).
- Params: `tipoBastidor` (simple/doble), `sepRefuerzoVcm`, `sepRefuerzoHcm`,
  `cenefa` (bool + solapaCm), `pintura` (bool).
- Precedente de forma: `colocacion_ojales` (cantidad derivada del perímetro).

### 4.2 Familia `iluminacion_led`

```
por área (backlight, light box):  N = ceil(área_cara_mayor / cobertura_módulo × densidad)
por recorrido (corpóreas):        N = ceil(perímetro / paso_módulo)
watts = N × W_módulo;  fuente = MENOR_CAPACIDAD(watts × 1.3) del slot fuentes
cable ml = perímetro × 1.4 + N × 0.12;  conectores = ceil(N/8) + base
```

- Slots: `modulos_led` (MODULO_LED_CARTELERIA / NEON_FLEX_LED), `fuente`
  (FUENTE_ALIMENTACION_LED, selección MENOR_CAPACIDAD), `cableado`
  (CABLEADO_CONECTICA).
- `cobertura_m2` y `paso_mm` son **atributos de la variante** del módulo LED
  (como pidió tu doc §2.3), no del paso.
- Tiempo: T-2 sobre `modulos_colocados` (output canónico).
- Params: `modoSembrado` (area/recorrido), `densidad` (multiplicador).
- La fuente reusa 1:1 el algoritmo de la anilladora.

### 4.3 JobContext: `profundidadMm` + geometría derivada

- `profundidadMm` — mismo patrón que `paginas` (input nuevo, familia lo
  declara). Las medidas siguen siendo 2D; la profundidad es del paso/producto.
- `areaM2` / `perimetroM` **derivados** — para formas no rectangulares
  (corpóreas), el configurador manda área y perímetro reales (shoelace +
  longitud de path del SVG o preset analítico) y el motor los usa en lugar de
  W×H / 2·(W+H). Override opcional en JobContext; si no viene, se calcula del
  rectángulo como hoy.

## 5. Mapeo configurador → ruta (los 4 productos de catálogo)

**Backlight** — `estructura_bastidor(doble, cenefa, pintura)` →
`impresion_rollo` (lona backlit, nesting shelf-rollo) → `confeccion/lonado`
(costuras HF si ancho > rollo — ya modelable con modificacion_post) →
`iluminacion_led(area)` → `ensamble_estructural` → cargos flete/instalación.

**Frontlight** — igual con `estructura_bastidor(simple)`, sin
`iluminacion_led`, con ojales (`colocacion_ojales`).

**Corpórea en capas** — la ruta tiene un paso por capa (patrón tapa/interior):
`corte` de cada capa (láser/CNC según material, tiempo por
`perimetro_piezas_m` REAL del shape) + `plotter_corte` (vinilo) +
`iluminacion_led(recorrido)` + cuerpo lateral (`m² = perímetro × profundidad`,
es el "desarrollo" — cabe como consumo derivado del slot) +
`ensamble_estructural`. Las capas del configurador se mapean a pasos
OPCIONALES pre-armados en la ruta (frente sí/no, vinilo sí/no, fondo sí/no…),
no a pasos dinámicos.

**Caja de acrílico** — `corte_laser` (5-6 caras, perímetros sumados) →
pegado (slot adhesivo ADHESIVO_LIQUIDO_ESTRUCTURAL, ml = 4·(W+H+D)) →
`plotter_corte` (vinilo por cara) → laminado opcional →
`iluminacion_led(area, cara mayor)` → base (slot SUSTRATO_RIGIDO) →
`ensamble_estructural`.

Los cuatro son **productos de catálogo normales** con su ruta; el
configurador es la herramienta de captura del JobContext. Sin él, el producto
igual se cotiza a mano (campos numéricos) — el 3D es una capa de UX, no una
dependencia.

## 6. Arquitectura UI — herramienta de producto (precedente: sellos)

- Flag en el producto (`atributosComercialesJson.herramientaCarteleria =
  { tipo: 'backlight' | ... }`), como el editor de sello.
- El sheet muestra el botón "Configurar en 3D" → editor a pantalla completa
  (los archivos de `signage/` portados a componentes nuestros; three.js
  bundleado, sin CDN; **.module.css**, no globals).
- El editor edita un `CarteleriaConfig` (JSON) → se traduce a JobContext +
  selecciones de slots → cotización live por el endpoint del motor
  (debounce ~300 ms).
- El panel derecho (BomPanel) renderiza el **desglose del motor** agrupado
  por paso, con el hover 3D↔línea mapeado por `configPasoId`.
- Margen: lee el de `aplicar-precio` (producto/cliente); el slider ajusta el
  override del ítem como ya se puede en el sheet.
- `CarteleriaConfig` se persiste en el ítem (como el sello) → reabrir la OT
  rehidrata el 3D; el snapshot PNG va a los Archivos del ítem (precedente:
  los EPS del sello).
- "Guardar como template" → clona el producto con ese config como default.

## 7. Journeys

**Modelador (una vez por tipo):** crea el producto "Cartel backlight" con la
ruta del §5, activa la herramienta, define defaults (perfil 40×40, módulo LED
estándar, separación de refuerzos 100 cm). Los materiales alternativos son
candidatos del slot como siempre.

**Comercial (por venta):** agrega "Cartel backlight" → "Configurar en 3D" →
ajusta 2,4×1,2×0,18, elige lona, densidad LED, cenefa sí → ve el cartel y el
precio moverse → acepta → el ítem queda con config + precio del motor →
presupuesto PDF + ficha técnica con snapshot.

**Producción:** la OT muestra la ficha técnica (snapshot + BOM del motor +
métricas: ml de perfil, puntos de soldadura, grilla LED, watts, fuente).

## 8. Fases

| Fase | Qué | Resultado |
|---|---|---|
| **F1** | Familias `estructura_bastidor` + `iluminacion_led`, input `profundidadMm`, overrides area/perímetro, poblar biblioteca (perfiles, chapas, módulos, fuentes, lonas backlit) | Backlight/Frontlight cotizables por motor **sin 3D** (campos numéricos) |
| **F2** | Portar el configurador Backlight/Frontlight como herramienta de producto; BomPanel = desglose del motor; persistencia del config + snapshot | El journey completo del §7 para bastidores |
| **F3** | Corpóreas en capas (presets de forma analíticos) + Caja de acrílico | Los 4 tipos operativos |
| **F4** | SVG libre (shoelace + longitud de path), ficha técnica PDF, "guardar como template" | Diferenciador completo |

Nesting irregular de planchas (SVGnest/jagua-rs): fase posterior; mientras
tanto área × (1 + merma del slot), que es lo que hace el prototipo.

## 9. Decisiones tomadas y abiertas

**Tomadas**
- Impresión 3D afuera (módulo `letras3d/` aparte). El modo `construccion:"3d"`
  del prototipo no se porta.
- El 3D deriva, el motor cotiza; BomPanel sin precios propios.
- Capas de corpórea = pasos opcionales pre-armados, no pasos dinámicos.
- `cobertura_m2`/`paso_mm` como atributos de variante del módulo LED.

**Cerradas al implementar F1 (2026-08-04)**
- La cenefa vive DENTRO de `estructura_bastidor` (param + slot opcional).
- El slot `fuente` trae el criterio MENOR_CAPACIDAD de fábrica en el motor
  (defaults por familia); el modelador puede pisarlo.
- `piezaAreaTotalM2` / `piezaPerimetroTotalM` YA existían en el JobContext:
  los overrides de forma libre no requirieron cambios.
- Profundidad en el sheet: input en cm (comercial) → mm (motor); si el paso
  la fija, es el placeholder.

**Abiertas**
1. ¿La `estructura_bastidor` publica también la cenefa o la cenefa es paso
   propio (`plegado_chapa`)? (inclinación: dentro del bastidor, param).
2. ¿El editor 3D vive en el sheet (modal fullscreen) o como página propia
   enlazada desde el sheet? (inclinación: modal fullscreen como el sello).
3. Doble faz del backlight: ¿multiplicador de cara en el paso de impresión
   (existe `caras`) o segundo paso? (inclinación: multiplicador).
4. Instalación/flete: ¿cargos de orden manuales o familia `instalacion` con
   tabla f(altura, complejidad)? (V1: cargos manuales como hoy).


## 10. F1 — qué quedó implementado (2026-08-04)

- Helpers puros con specs: `motor-universal/estructura-bastidor.ts` (7 tests)
  y `motor-universal/iluminacion-led.ts` (9 tests), fórmulas idénticas al
  prototipo (validado el caso 2,40×1,20×0,18: 20,28 ml, 16 soldaduras,
  cenefa 1,71 m², 47 módulos, fuente 60 W).
- Catálogo 30→32 familias; ramas CALCULADO_POR_PASO en `resolverCantidad`;
  cantidades primitivas de slots secundarios (cenefa m², pintura m², fuente 1,
  cable ml) vía `cantidadSlotPrimitivaCarteleria`; watts publicados pre-slots
  (`watts_requeridos_led`) para el selector MENOR_CAPACIDAD de la fuente.
- Outputs canónicos ml_estructura / puntos_soldadura / cenefa_m2 /
  modulos_led / watts_led + aliases de capacidades.
- Guards: `estructura_bastidor_sin_profundidad` (cajón doble sin D cortaba
  en $0 silencioso) e `iluminacion_led_sin_modulo` (variante sin
  coberturaM2/pasoMm).
- Sheet: input "Profundidad del cajón (cm)" cuando la ruta tiene bastidor
  doble sin profundidad fija (patrón `paginas`); spec "Profundidad" en la
  ficha/OT.
- Biblioteca: 5 plantillas nuevas en `materia-prima-templates.ts` (módulo
  LED con coberturaM2/pasoMm/wattsModulo, fuente con capacidadW, cable,
  perfil estructural con desarrolloSeccionM, chapa).
- Dev: MP CART-* sembradas + producto CARTEL-BACKLIGHT (2 pasos, T-2 sobre
  centro manual) cotizando $329.074 con margen 45%; frontlight simple y
  guard verificados.


## 11. F2 — configurador 3D embebido (2026-08-04)

**Componentes** (`src/components/carteleria/`, three.js 0.149 bundleado,
.module.css):
- `geometria.ts` — espejo CLIENT-SIDE de los helpers del motor (bastidor +
  grilla LED) para que el 3D responda a 60 fps. El precio jamás sale de acá.
- `render-helpers.ts` + `grafo-logo.ts` — port tipado del prototipo signage/
  (PBR, entorno PMREM, glow, día/noche, pulso de hover; logo como textura).
- `viewport-3d.tsx` — escena completa: marco simple/doble, refuerzos, lona
  con logo, panel posterior, grilla LED emisiva, fuente, anclajes, cenefa con
  solapas; vista explotada, capas, presets de cámara, día/noche.
- `carteleria-editor-sheet.tsx` — overlay fullscreen de 3 columnas:
  parámetros (medidas, refuerzos, cenefa, pintura, densidad LED) · 3D ·
  panel de precio que renderiza EL DESGLOSE DEL MOTOR (pasos + costo + precio
  con margen), con hover paso↔pieza 3D. "Descartar" restaura el snapshot.

**Integración (sin plomería nueva)** — el editor edita EN VIVO el mismo
`motorConfig` del sheet: medidas → `piezas[0]`, profundidad → `profundidadCm`,
resto → `paramsComercial[configPasoId]`. El debounce de cotización del sheet
re-cotiza solo; el editor muestra `cotizacion` del motor con indicador
"recalculando". El botón "Configurar en 3D" aparece cuando la ruta tiene
`estructura_bastidor` — **la familia ES el flag**, no hay atributo aparte.

**Canal de overrides**: `paramsComercial → configPasoRuntime` ya existía, pero
filtra por `camposEditablesComercial`. Decisión: los campos del configurador
son editables POR DISEÑO de la herramienta →
`CAMPOS_SIEMPRE_EDITABLES_POR_FAMILIA` en el motor (estructura_bastidor:
sepRefuerzos/cenefa/pintura · iluminacion_led: densidad) + merge espejo en
`buildJobContext`. Verificado E2E: refuerzos c/50 → 25,44 ml · densidad 1,5 →
70 módulos · cenefa off → output null y chapa $0.

**Fix de arrastre**: `motorConfigFromItem` no restauraba `paginas`,
`profundidadCm` ni `configPasoRuntime` → reabrir un ítem perdía la config del
3D (y las páginas de la revista). Corregido.

**Deuda conocida de F2**: `coberturaLedM2` del viewport usa el default
0,0625 m² (el motor usa el atributo real de la variante server-side); cuando
el módulo LED sea COMERCIAL_ELIGE conviene leerlo de la variante elegida.


## 12. Decisión de arquitectura (2026-08-04): capa propia + productos del sistema

Al probar F2 en el sheet real quedó a la vista el problema: el sheet genérico
"renderiza de prepo" un producto para el que no fue pensado — medidas
duplicadas (las del sheet y las del 3D), Opcionales vacío, specs genéricas.
El diagnóstico del usuario es el correcto y define F3:

**Cartelería es una CAPA, como el Centro de Copiado.** El patrón ya existe
completo en `apps/api/src/centro-copiado/provisionar-plantilla.ts`:

| Pieza del CC | Equivalente cartelería |
|---|---|
| `sistemaCodigo: 'centro_copiado'` (oculto del catálogo, no editable) | `sistemaCodigo: 'carteleria'` |
| `provisionar-plantilla.ts` (producto+ruta+config del sistema) | `provisionar-carteleria.ts`: SYS-CARTEL-BACKLIGHT, SYS-CARTEL-FRONTLIGHT, … |
| TPV como sheet propio | `CarteleriaSheet`: elegir el cartel abre DIRECTO el editor 3D fullscreen |
| El tenant configura precios/papeles, no la ruta | El tenant pone precios a su biblioteca (perfil, LED, fuentes, lonas) y su margen; la receta es nuestra |

**Consecuencias:**
1. **Productos del sistema**: Grafo desarrolla cada tipo de cartel (receta =
   producto + ruta + params + preset del editor 3D) y los provisiona
   versionados — como las plantillas del CC o la biblioteca Trodat. Con el
   tiempo se agregan tipos nuevos (light box, tótem, corpórea…) sin que el
   tenant modele nada. Se puede vender como feature del plan (flag estilo
   TPV/Paddle features).
2. **Sheet propio**: dentro del editor van cantidad, notas y "Agregar a la
   OT"; desaparecen los campos duplicados y las secciones genéricas. El sheet
   genérico no cambia.
3. **Provisión de biblioteca**: el instalador crea las MP necesarias sin
   precio (patrón portabanners) y el tenant las completa — el motor corta con
   diagnóstico si falta un precio, como siempre.
4. **Item/OT**: las especificaciones se arman desde la config del cartel
   (tipo, medidas×profundidad, refuerzos, cenefa, LEDs+watts+fuente, ml de
   perfil); el snapshot PNG del 3D va a los Archivos del ítem (precedente:
   los EPS del sello); la ficha técnica de la OT muestra snapshot + BOM del
   motor. El "acomodo" de estos pasos no es un grid: su visual ES el 3D.

**F3 re-scopeada**: (a) provisión del sistema + flag, (b) CarteleriaSheet
(editor como flujo completo), (c) specs/OT/snapshot, y recién después
(d) corpóreas en capas + caja acrílico como tipos nuevos provisionados.


## 13. F3b — paneles ricos del prototipo (2026-08-04)

El editor recuperó el ParamsPanel y el BomPanel del prototipo, con la
diferencia de fondo del §2: **los pickers salen de los candidatos de los
slots (biblioteca real) y el listado renderiza el desglose del motor**.

**Panel de parámetros (acordeón)**:
- Medidas: steppers ancho/alto/profundidad.
- Estructura: picker de PERFIL (4 caños de la biblioteca), refuerzos V/H
  segmentados (Sin/80/100/120), pintura, cenefa con picker de CHAPA + solapa
  (1,5/2/3 cm con el desarrollo calculado), CHAPA TRASERA (slot nuevo
  `chapa_fondo`, fondoM2 = W×H×1,1).
- Cara frontal: picker de LONA + doble faz (→ `caras_<pasoImpresión>`=2,
  duplica la tinta).
- Iluminación: picker de MÓDULO/TUBO (7 variantes) + densidad
  Económica/Estándar/Brillante; la línea de info muestra los números DEL
  MOTOR (módulos/watts de outputs canónicos).
- Anclajes: picker del slot nuevo `anclaje` (cantidad = pares cada 80 cm).

**Listado y costo**: secciones por paso con ítems reales del motor
(material · cantidad × unidad · $/unidad = subtotal, línea de tiempo del
paso), hover paso↔pieza 3D, footer con costo, precio con margen y precio/m².

**Cambios de modelo**: slots `chapa_fondo` y `anclaje` en la familia +
param `fondo`; `solapaCenefaCm`/`fondo` en CAMPOS_SIEMPRE_EDITABLES; el
módulo LED de la pre-pasada se resuelve POR CÓDIGO de slot (el orden de
paso.slots no está garantizado — bug real encontrado al abrir los slots).

**E2E verificado**: config completa (fondo + solapa 3 + doble faz +
selecciones) → $572.118 con chapa trasera 3,17 m², 6 anclajes, tinta ×2;
cambiar el módulo a 3W → 16 módulos, 48 W y la fuente sube sola a 100 W.

**Deuda**: doble faz duplica tinta pero no la segunda lona (el cajón doble
faz real lleva dos lonas); flete/instalación siguen como cargos manuales.


## 14. F3c — el sheet propio (2026-08-04)

Decisión del usuario al testear: el sheet genérico "renderiza de prepo" y
duplica conceptos (medidas dos veces, opcionales vacíos, tecnología/luces/
chapas elegidas fuera del configurador). Implementado el §12(b):

**Para un producto de cartelería, el configurador ES el cuerpo del sheet.**
`ApConfigStep` hace early-return con `CarteleriaConfigurador` (inline, ya no
overlay con botón): adentro viven medidas + CANTIDAD, TECNOLOGÍA de impresión
(segmented del selector M-2 → seleccionMaquina), lona, caño, chapas de cenefa
y de fondo, iluminación, densidad, anclajes y NOTAS de producción. El pie del
sheet (precio con impuestos + "Agregar a la OT") sigue siendo el del padre —
mismo buildItem, mismas specs, cero plomería nueva.

Fixes del mismo round: la chapa trasera ahora es real en el 3D (antes el
panel posterior se dibujaba SIEMPRE — por eso el toggle "no hacía nada");
`capaExiste.back` acompaña. El banner superior queda con "Cambiar producto".

**Deuda visible**: los slots de cartelería siguen apareciendo también en la
sección Materiales del flujo genérico… que ya no se renderiza para estos
productos — resuelto de facto por el early-return.


## 15. La ruta REAL y la parametrización del tenant (diseño 2026-08-04)

Pregunta del usuario que redefine F4: las familias de F1 (`estructura_bastidor`
"esconde" cortar + soldar + pintar) pierden parametrización y no reflejan el
taller. La ruta real de un backlight es:

```
1) Cortar los hierros   2) Soldar   3) Pintar la estructura
4) Imprimir la lona     5) Instalar chapa trasera
6) Instalar iluminación 7) Instalar la lona   8) Instalar cenefas
```

### 15.1 La respuesta a "¿cómo parametriza el tenant una ruta del sistema?"

**Estructura bloqueada, parámetros abiertos.** La ruta del sistema es VISIBLE
en el editor de producto normal; el tenant no puede agregar/quitar/reordenar
pasos (eso es de Grafo, versionado por la provisión), pero cada paso expone lo
de siempre: **productividad y su unidad, setup/cleanup, centro de costo,
máquina/perfil, candidatos de materiales y sus precios**. No inventamos una
UI nueva de parametrización: es el editor de pasos que ya existe, con la
estructura en sólo-lectura.

Regla de la provisión: upsert por clave estable (sistemaCodigo + clave de
paso); **actualiza estructura, jamás pisa** productividades/centros/máquinas/
precios que el tenant ya tocó.

### 15.2 La ruta real, paso por paso (todo con familias que YA existen)

La clave: `estructura_bastidor` deja de "hacer todo" y pasa a ser el paso 1
(**Corte de hierros**) que además PUBLICA la geometría derivada como outputs
canónicos; los demás pasos la HEREDAN como driver (mismo patrón pre_prensa →
impresión):

| # | Paso | Familia | Driver del tiempo (unidad de productividad del tenant) | Materiales |
|---|---|---|---|---|
| 1 | Corte de hierros | `estructura_bastidor` (recortada) | `barras_estructura` (cortes/h) o ml/h | perfil (ml derivados) |
| 2 | Soldadura | `trabajo_manual` o familia `soldadura` liviana | hereda `puntos_soldadura` (puntos/h) | electrodo/alambre (slot preset `soldadura` ya existe) |
| 3 | Pintura | `pintura_superficial` (existe) | hereda `pintura_m2` (m²/h) | pintura (litros por rendimiento m²/l de la variante) |
| 4 | Impresión de lona | `impresion_por_area` | ya cubierto (nesting rollo + demasía) | lona + tintas |
| 5 | Chapa trasera | `montaje_sobre_sustrato` (existe, OPCIONAL) | m² montados o por hoja | chapa EN HOJAS con **nesting propio** |
| 6 | Iluminación | `iluminacion_led` | `modulos_led` (módulos/h) + setup fijo (fuente+cableado) | módulos/fuente/cable |
| 7 | Tensado de lona | `trabajo_manual` | `perimetro_piezas_m` (ml/h) — magnitud que ya existe | — |
| 8 | Cenefas | `trabajo_manual` u `hojalateria` | hereda `cenefa_m2` (m²/h) o ml de perímetro | chapa cenefa |

**"¿Y si no alcanza una chapa?"** — eso es exactamente `montaje_sobre_sustrato`:
el sustrato de montaje (chapa en HOJAS de 1,22×2,44 con sus medidas en la
variante) se nestea con la pieza W×H; si la pieza no entra, panela →
**cantidad de hojas + cortes + uniones** salen del nesting (estrategia
`plate-segments` ya existe), y el tiempo del paso corre sobre m² montados u
hojas. La cenefa puede evolucionar igual (hoy m² teóricos; con hojas reales
cuando pasemos este paso a nesting).

**¿De qué depende el tiempo de iluminación?** — de los módulos colocados
(driver ya publicado) + un fijo por el subsistema (fuente + cableado) que es
el `setup` del paso: el tenant pone "40 módulos/h + 20 min de setup".

### 15.3 Toggles del configurador = OPCIONALES de la ruta

Cenefa y chapa trasera dejan de ser params del paso 1 y pasan a ser **pasos
OPCIONALES** (5 y 8): el toggle del configurador activa/desactiva el opcional
(mecanismo `opcionalesActivados` que ya existe, con su arrastre de
dependencias). Beneficio doble: el costo del toggle es el costo REAL del paso
(material + tiempo del tenant), y el tablero/registro de tiempos ven pasos de
verdad.

### 15.4 Qué gana producción

Pasos reales ⇒ el tablero materializa 8 tarjetas (no 2), las **estaciones**
rutean por familia (herrería corta y suelda, pintura pinta, montaje instala),
el **registro de tiempos** mide cada tarea, y "real vs cotizado" por paso deja
de mezclar tres oficios en una línea.

### 15.5 Plan (F4a — refactor de la ruta) — **IMPLEMENTADO 2026-08-04**

Estado: hecho y verificado E2E en dev (los 9 pasos cotizan; soldadura hereda
`puntos_soldadura` a 6 puntos/h → 160 min; pintura hereda `pintura_m2` a
10 m²/h; cenefas y chapa trasera heredan sus m²; tensado corre sobre
`perimetro_piezas_m`; total con todo activo $858.758). Detalles de
implementación:
- `estructura_bastidor` recortada: slots perfil+anclaje, sin toggles; deriva
  SIEMPRE y publica `pintura_m2`/`fondo_m2` nuevos (+ cenefa/puntos/ml).
- `pintura_superficial` ganó HEREDAR_DEL_OUTPUT_CANONICO.
- Los `trabajo_manual` de la ruta se identifican por
  `paramsPasoJson.carteleriaRol` ('soldadura'|'tensado'|'cenefa'|
  'chapa_fondo') — la marca que escribirá la provisión.
- Toggles del configurador → `opcionalesActivados[configPasoId]` (pasos
  OPCIONALES); los pickers de chapa/pintura apuntan a los slots de SUS pasos.
- Herencia declarada por `mecanismoCantidadConfigJson.campoOutput`.

Pendiente de esta fase: chapa trasera con HOJAS reales (montaje_sobre_
sustrato + plate-segments, hoy m² teóricos), diagnóstico cuando falta un
default de opcional, editor estructura-bloqueada + provisión.

Plan original:

1. `estructura_bastidor` publica outputs nuevos (`barras_estructura`,
   `pintura_m2`) y se recorta a corte+derivación (soldadura/pintura salen).
2. Ruta del producto de prueba → 8 pasos con herencias; defaults de
   productividad desde las fórmulas del prototipo (soldadura ≈ 5,5 puntos/h,
   etc.).
3. Configurador: toggles → `opcionalesActivados`; params → paso que
   corresponda; el listado ya agrupa por paso (queda MEJOR: una sección por
   tarea real).
4. Chapa trasera vía `montaje_sobre_sustrato` con hojas reales.
5. Provisión con la regla "estructura sí, parámetros del tenant jamás" +
   editor de producto en modo estructura-bloqueada para `sistemaCodigo`.


## 16. Compra real vs. consumo teórico (2026-08-04)

Pregunta del usuario: los hierros se cotizan por ml y la chapa por m², pero en
la realidad se compran BARRAS y HOJAS enteras (7 ml de hierro en barras de
3 m = 3 barras; a veces con mínimos). Cómo lo maneja el sistema:

| Material | Mecanismo | Estado |
|---|---|---|
| **Chapa en hojas** | nesting de placa + estrategia `plate-segments` (escalón 100% = hoja entera); `montaje_sobre_sustrato` en §15 | ✅ existía |
| **Pintura por lata** | mecanismo CONVERSION (`ceil(cantidad/capacidad)`) | ✅ existía |
| **Rollos (lona)** | `consumed-length` por ml consumidos (estándar del rubro) | ✅ existía |
| **Barras de perfil** | **NUEVO**: despiece + packing 1D | ✅ implementado |

**Barras enteras** (`calcularBarrasNecesarias`, en estructura-bastidor.ts):
el helper ahora publica el DESPIECE (el largo real de cada barra a cortar) y
un first-fit-decreasing lo empaqueta en barras comerciales con kerf de corte.
El redondeo ingenuo miente: 4 tramos de 1,8 m en barras de 3 m son **4
barras** (una por tramo), no ceil(7,2/3)=3 — por eso packing real y no ceil.

Activación por VARIANTE: si el perfil declara `largoBarra` (m) en sus
atributos, el slot cobra barras enteras al precio POR BARRA de la variante;
sin el atributo sigue por ml (compat). Verificado E2E: backlight 2,4×1,2×0,18
→ despiece de 20,28 ml → **4 barras de 6 m × $7.680 = $30.720** (vs $25.958
teóricos: el sobrante se paga, como en la ferretería).

Pendientes anotados: diagnóstico fino cuando un tramo no entra en ninguna
barra (hoy cae a ml); mínimos de compra genéricos (`minimoCompra` en la
variante) para otros rubros; stock de retazos (el sobrante hoy es del taller).


## 17. Giro de rumbo (2026-08-05): derivadores genéricos, 3D a un costado

Análisis con el usuario sobre si cartelería estaba "parchando" el motor.
Conclusión de la auditoría de la ruta real de 9 pasos: el 80% ya es motor
genérico puro; lo exclusivo se concentra en la derivación geométrica y en
defaults/editabilidad por código en vez de por datos. Decisiones:

1. **El objetivo es que un cartel se modele con pasos como cualquier
   producto** (cerrado con solo cantidad, o abierto con elecciones del
   comercial — lo decide el modelador, no la arquitectura).
2. **El configurador 3D queda a un costado, sin usar**, hasta que eso esté:
   es visualización, no dependencia. El early-return del sheet se desactiva.
3. Las piezas hardcodeadas se convierten en primitivas declarables: contrato
   de **derivadores geométricos** (patrón dispatcher de nesting), slots por
   magnitud derivada, criterios de capacidad como datos, editabilidad por
   campo del schema.
4. La capa/provisión SYS-CARTEL-* + vista de Configuración por oficio (§12 y
   conversación posterior) pasa a ser decisión de producto, post-refactor.

Diseño completo y plan por etapas:
[derivadores-geometricos-diseno.md](derivadores-geometricos-diseno.md).
La F4 real es ese refactor; §15.5/§16 quedan como estado alcanzado previo.
