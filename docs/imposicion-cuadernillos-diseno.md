# Imposición de cuadernillos — análisis y diseño

> **Estado**: Fase A + plan (B) IMPLEMENTADAS (2026-08-04). Decisiones
> cerradas: caballete solo · blancas con aviso · plan visible desde el día 1 ·
> alcance = producto de catálogo (no TPV) · familia `abrochado_caballete`.
> Origen: relevamiento de productos de Holdprint — el editorial multipágina
> (revista, catálogo, cuaderno) quedó como el único gap real de imprenta.
> Holdprint NO lo resuelve (cotiza por m² solvente + fórmula de productividad);
> acá no hay nada que copiar: hay que pensarlo.

---

## 1. La idea en una frase

Que el sistema entienda productos **multipágina encuadernados** (revista,
catálogo, cuaderno abrochado): dado "32 páginas A5, 200 ejemplares", saber
**cuántos pliegos** salen, **qué pasos** siguen (plegar, abrochar, refilar) y
**en qué orden** van las páginas en cada pliego.

## 2. El insight que hace el problema tratable

"Imposición" mezcla **tres problemas distintos** que conviene separar, porque
tienen dificultad y urgencia muy diferentes:

| # | Problema | Qué es | Dificultad |
|---|---|---|---|
| A | **CUÁNTO** | pliegos, hojas por libro, broches, plegadas, cortes de refile → el costeo | Aritmética simple |
| B | **EN QUÉ ORDEN** | el mapa página→posición de cada pliego → instrucciones de producción | Función pura conocida (~30 líneas) |
| C | **EL PDF IMPUESTO** | generar el archivo listo para imprimir desde el PDF del cliente | Real pero opcional; pdf-lib ya está en el stack |

La trampa clásica es creer que hay que resolver C para tener el producto. No:
**con A ya se cotiza y se vende**; B convierte la OT en instrucciones que
cualquier operario sigue; C es un diferenciador para después (y el centro de
copiado ya guarda los archivos, así que la puerta está abierta).

## 3. Glosario mínimo (para hablar el mismo idioma)

- **Página**: cada cara numerada del documento final (la revista de 32 páginas).
- **Par**: dos páginas enfrentadas impresas juntas — la unidad que se apoya
  sobre el pliego. Un par A5 mide un A4 apaisado.
- **Hoja del libro**: un pliego plegado una vez = **4 páginas** (par al frente,
  par al dorso).
- **Caballete (saddle stitch)**: las hojas se **anidan** una adentro de otra y
  se abrochan al lomo. Folletos, revistas finas. Límite físico: ~15–25 hojas
  según gramaje.
- **Alzado + encolado / cosido**: cuadernillos (signaturas) que se **apilan**
  (no se anidan) y se pegan o cosen al lomo, con tapa. Libros, catálogos
  gruesos.
- **Espiral / anillado**: hojas sueltas apiladas y perforadas. **No necesita
  imposición**: se imprime secuencial doble faz — ya lo tenemos (CC + anilladora).
- **Refile**: los 3 cortes de guillotina finales (frente, cabeza, pie) que
  emparejan los bordes después de plegar.
- **Creep**: en el caballete, las hojas interiores sobresalen unos mm al
  anidarse; la imposición fina lo compensa corriendo márgenes. Sólo importa
  para el problema C.

## 4. Estado actual — todo lo que ya existe y se reusa

| Pieza | Estado | Rol en esto |
|---|---|---|
| Grid 2D de imposición (`impresion_por_hoja`) | ✅ | Calcula **pares por cara** del pliego (la pieza es el par, no la página) |
| `talonario-grouping.ts` | ✅ | **El precedente arquitectónico**: helper puro post-nesting que convierte poses en agrupamiento de producción, con modelo documentado |
| Outputs canónicos + herencia | ✅ | Los pasos de plegado/abrochado/refile heredan lo que publica la impresión |
| `plegado` (familia) | ✅ | Consume `pliegos_calculados`; hoy T-2 manual |
| `corte_guillotina` | ✅ | El refile es exactamente su modelo (cortes × tandas) |
| `encuadernado_anillado` + anilladora | ✅ | Cubre el esquema espiral completo |
| `engomado_emblocado` | ✅ | Base conceptual del encolado (fase 2 del alzado) |
| Centro de copiado: páginas→hojas + archivos | ✅ | Ya convierte páginas/carillas/hojas y guarda los PDF |
| Tiempo manual T-4, params abiertos al comercial | ✅ | Escape hatch para casos raros |

**Lo único que falta es la capa que conecta**: la noción de *páginas* en el
motor, el agrupamiento de cuadernillo, y la familia de abrochado.

## 5. La matemática (problema A y B)

### 5.1 Cuánto — caballete

```
P  = páginas por libro (se rellena a múltiplo de 4 con blancas)
T  = ejemplares
H  = hojas por libro        = P / 4
K  = pares por cara         ← lo da el grid 2D con la pieza "par" (2·ancho × alto)
     (K copias del MISMO pliego por cara: imprimir, cortar al medio, K juegos)
pliegos = H × ceil(T / K)
broches = 2 × T   (config por paso)
plegadas = H × T  (o T si se aprueba plegar el libro armado — decisión de taller)
refile  = 3 cortes × pilas (pilas = ceil(T / librosPorPila))
```

**Ejemplo completo — Revista A5, 32 páginas, 200 ejemplares, SRA3:**
par A5 = 297×210 (A4 apaisado) → en SRA3 útil (~440×310) entran **2 pares por
cara** (rotados) → K=2 · H=8 → pliegos = 8 × ceil(200/2) = **800 SRA3** ·
broches = 400 · verificación: 200 libros × 8 hojas = 1.600 hojas A4 = 800 SRA3 ✓

### 5.2 En qué orden — el mapa del caballete

Para la hoja `i` de `H` (1-indexada), con `N = 4H` páginas:

```
frente: [N − 2i + 2 , 2i − 1]      dorso: [2i , N − 2i + 1]
```

Ejemplo P=8: hoja 1 → frente [8,1] dorso [2,7] · hoja 2 → frente [6,3] dorso [4,5].
Es una función pura, determinística y trivial de testear. Ese mapa **es** el
plan de producción que ve el operario en la OT.

### 5.3 Alzado (fase posterior)

Signaturas de S páginas (8/16), `cuadernillos = ceil(P/S)`, se **apilan** y
encolan/cosen con tapa (la tapa es otro paso de impresión + slot de material).
La imposición interna de una signatura de 16 (octavo, plegado cruzado) es más
compleja — por eso va después y no bloquea el caballete.

## 6. Diseño propuesto

### Fase A — costeo + plan (el corazón)

1. **Input `paginas` en el JobContext** — la familia lo declara en
   `inputsRequeridos`. En el producto puede ir fijo (revista institucional de
   32 páginas) o abierto al comercial (imprenta que cotiza lo que traigan),
   igual que las medidas.

2. **Modo imposición en el paso de impresión**:
   `nestingConfig.imposicion = { esquema: 'caballete', maxHojasCaballete?, rellenarA4? }`.
   El paso de impresión ya conoce máquina + pliego + material (decisión
   post-Etapa A: "acomoda el que imprime"); con este modo, la **pieza** que
   nestea es el **par** (2·ancho × alto de la medida final) y el resultado pasa
   por el helper nuevo.

3. **Helper puro `cuadernillo-imposicion.ts`** (espejo exacto de
   `talonario-grouping.ts`): recibe `{paginas, ejemplares, paresPorCara}` y
   devuelve `{hojasPorLibro, pliegos, paginasBlancas, planImposicion[]}`.
   Todo testeable sin motor.

4. **Outputs canónicos nuevos**: `hojas_por_libro`, `paginas_blancas`,
   `plan_imposicion` (estructurado). `pliegos_calculados` sale como siempre —
   así **plegado, abrochado y guillotina heredan sin tocarse**.

5. **Familia nueva `abrochado_caballete`** (M-0 manual o M-1 abrochadora):
   cantidad heredada (ejemplares), tiempo T-2/T-3 por libro, param
   `brochesPorLibro` (default 2), validaciones: `paginas % 4` (se rellena con
   blancas + warning, no error) y `hojasPorLibro ≤ maxHojas` (corta con
   diagnóstico: "48 hojas no se abrochan a caballete: usá anillado o alzado").

6. **Ruta tipo** del producto "Revista abrochada":
   `diseño → impresión (imposición caballete) → plegado → abrochado_caballete → guillotina (refile)`.

### Fase B — el plan en producción

La OT muestra la tabla del §5.2 ("Pliego 3: frente 28|5, dorso 6|27") y el
tablero hereda los pasos materializados como siempre. Cero motor nuevo: es
render del output `plan_imposicion`.

### Fase C — el PDF impuesto (opcional, diferenciador)

Con el PDF del cliente (el CC ya los guarda), generar el archivo impuesto con
pdf-lib: N páginas → pliegos listos para el dúplex de la impresora, con creep
configurable. También habilita "folleto abrochado" como renglón del TPV del
centro de copiado. Es una feature de producto en sí misma; no arranca hasta
que A+B estén asentadas.

## 7. Qué queda explícitamente afuera (por ahora)

- **Creep** (fase C, cuando generemos PDF).
- **Signaturas cosidas complejas** (octavo/16 páginas con plegado cruzado).
- **Imposiciones mixtas** ("come and go", tira/retira work-and-tumble): el
  K-up de copias idénticas cubre el 95 % del taller digital.
- **Encolado hotmelt con tapa** (alzado): fase posterior sobre la misma base;
  `engomado_emblocado` + tapa como slot ya insinúan el camino.

## 8. Decisiones tomadas (2026-08-04) e implementación

1. **Caballete solo** — espiral ya estaba; alzado/encolado queda para después.
2. **Blancas con aviso** — se rellena a múltiplo de 4, nunca error.
3. **Plan desde el día 1** — la tabla hoja→frente/dorso se renderiza en el
   acomodo del cotizador y llega a la ficha/OT rehidratada.
4. **TPV afuera** — esto modela producto de catálogo; el CC queda como
   consumidor posterior de la Fase C.
5. Nombre: **`abrochado_caballete`**.

### Tapa e interior en papeles (o colores) distintos — 2026-08-04

Un paso de impresión declara **qué hojas del cuadernillo imprime**:
`nestingConfig.imposicion.hojas = 'todas' | 'tapa' | 'interior' | {modo:'rango', desde, hasta}`.
Con eso, tapa e interior son **dos pasos de impresión** sobre el mismo
documento, y cada uno ya trae de fábrica lo suyo: su papel (slot), su modo de
color por paso, su máquina, su perfil y sus consumibles por canal. El mismo
mecanismo resuelve el pliego central a color (un rango de hojas).

Reglas del modelo:
- `hojasPorLibro` sigue siendo del **libro** (el abrochado lo usa para el
  espesor aunque el paso imprima sólo la tapa); `pliegos` es del **paso**.
- Tapa + interior suman exactamente el libro completo, sin huecos ni repetidos
  (hay test de propiedad).
- Un paso sin hojas (ej. "interior" de un documento de 4 páginas) corta con
  diagnóstico propio: `imposicion_paso_sin_hojas`.

**La traducción hojas→páginas** es la parte que evita promesas imposibles: en
caballete cada hoja arrastra dos páginas del principio y dos del final, así que
"las primeras 8 a color" son las hojas 1-4 → **páginas 1-8 y 25-32**. El
sistema lo dice en el editor del modelador (con las páginas por defecto) y en
el acomodo del cotizador (con las reales).

Verificado E2E sobre el producto Revista de prueba: tapa 100 pliegos
(págs 1, 2, 31, 32) + interior 700 pliegos (págs 3-30) = 800.

### Qué se implementó (Fase A + plan)

- `nesting/helpers/cuadernillo-imposicion.ts` — helper puro (fórmula, plan,
  blancas, tope de hojas) + 9 tests, incluida la propiedad "cada página
  aparece exactamente una vez".
- `impresion_por_hoja` acepta `nestingConfig.imposicion = { esquema:
  'caballete', paginasDefault?, maxHojas? }`: la pieza pasa a ser el PAR y el
  dispatcher publica pliegos + `hojas_por_libro`, `paginas_blancas`,
  `libros_por_juego`, `plan_imposicion` (registrados en el Registro de
  Capacidades bajo `imposicion`).
- Familia **`abrochado_caballete`** (M-0, T-2, `brochesPorLibro`, valida
  EXISTS_OUTPUT sobre `hojas_por_libro`). Catálogo: 29 → 30 familias.
- `JobContext.paginas` + guard con diagnóstico en 3 niveles: sin páginas /
  excede tope ("usá anillado o alzado") / el par no entra en el pliego.
- Cotizador: input "Páginas del documento" (aparece cuando la ruta tiene
  imposición), aviso de redondeo, spec `paginas` en la ficha/OT.
- Modelador: control "Imposición de cuadernillo" en la card de nesting del
  paso de impresión (esquema + páginas default + máx hojas).
- Viewer: tabla del plan (hoja | frente | dorso, blancas marcadas `·bl`).
- Tests de integración a nivel dispatcher (7): caso canónico 800 pliegos,
  default de páginas, tope, camino sin imposición intacto.
