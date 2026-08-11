# Cómo un paso decide su CANTIDAD — nesting, derivadores y herencia

> Doc explicativo (2026-08-11). Fuentes: `familias.ts` (declaraciones),
> `motor.service.ts` (resolverCantidad ~L5510, dispatcher de nesting),
> `nesting-dispatcher.ts`, `derivadores/index.ts`. Nada de lo que sigue está
> hardcodeado por rubro: todo es declaración de la familia + configuración
> del paso.

## 1. La respuesta corta

La "cantidad" de un paso sale de **UNO de cuatro mecanismos**, que el paso
declara en `mecanismoCantidad`. El **nesting** y los **derivadores** no
compiten: son dos proveedores distintos del mismo mecanismo
(`CALCULADO_POR_PASO`) — el nesting acomoda piezas en un sustrato; el
derivador calcula geometría.

**Precisión importante** (pregunta del usuario, 2026-08-11): esa cantidad es
el **ANCLA default** del paso, no la única magnitud. El TIEMPO puede elegir
otra (la cantidad operativa del ritmo, las `magnitudesTiempo` del derivador,
una primitiva como la de guillotina, o el perfil T-3) y **cada slot de
material** elige la suya (fórmula, base × factor, magnitud derivada,
cantidad fija). Ejemplos reales del desacople: la chapa trasera consume
1 HOJA pero su tiempo corre por 2 PIEZAS MONTADAS; el bastidor cotiza ml,
compra BARRAS y puede medir tiempo por CORTES o por SOLDADURAS; la
impresión por hoja produce PLIEGOS, compra HOJAS (÷2), gasta tinta por
M²×COBERTURA y clicks por PASADAS (×caras). Tiempo y materiales dependen de
la cantidad sólo cuando nadie declara algo mejor.

## 2. Los cuatro mecanismos

| Mecanismo | En criollo | Ejemplo real |
|---|---|---|
| **DIRECTO** (`DIRECT_FROM_JOBCONTEXT`) | "Hago lo que el pedido dice": cantidad = la del trabajo | Troquelado digital: le llegan 500 pliegos, troquela 500 |
| **HEREDA** (`HEREDAR_DEL_OUTPUT_CANONICO`) | "Hago lo que el paso anterior produjo": lee un output publicado | Guillotina corta los `pliegos_impresos` que publicó la impresión; Soldadura suelda los `puntos_soldadura` que publicó la estructura |
| **CALCULA** (`CALCULADO_POR_PASO`) | "Yo calculo lo mío": nesting o geometría | Impresión por área calcula cuántos metros de rollo consume; el bastidor calcula sus ml de caño |
| **CONV** (`CONVERSION`) | "Convierto por capacidad de empaque" | Embalaje: 500 piezas ÷ 50 por caja = 10 cajas |

El editor guiado muestra esto en el eje **"Cantidad"** del paso; qué
mecanismos ofrece cada familia lo declara `mecanismosCantidadSoportados`.

## 3. Dentro de CALCULA: la cascada

Cuando el paso es `CALCULADO_POR_PASO`, el motor prueba proveedores EN ORDEN
y usa el primero que responde:

```
1. NESTING       la familia declara nestingConfig y el dispatcher dio layout
                 → cantidad = lo acomodado (pliegos, m lineales, hojas)
2. PRIMITIVA     la familia declara una cantidadPropia (código puro registrado)
                 → ej. ojales: el layout por lados
3. DERIVADOR     la familia declara derivador
                 → cantidad = su magnitud principal (ml del bastidor, módulos LED)
4. FALLBACK      lo que la familia declare (m² crudos) o la cantidad pedida
```

Por eso una familia con nesting no necesita derivador y viceversa: son ramas
de la misma cascada.

## 4. El nesting: quién lo tiene y de qué tipo

Lo declara la familia en `nestingConfig`. El dispatcher rutea SOLO por esta
declaración (cero ifs de familia):

| Declaración | Qué hace | Familias |
|---|---|---|
| `estrategia: pliego_digital` | Poses en el pliego de impresión (imposición, caballete, talonarios) | Impresión por hoja |
| `estrategia: corte_rollo` | Shelf sobre rollo sin panelizado (en modo HOJAS no acomoda) | Plotter de corte |
| `estrategia: laminado_rollo` | Film sobre los pliegos ya impresos | Laminado |
| `estrategia: pouch` | Formato finito del pouch | Plastificado pouch |
| `estrategia: montaje` | Piezas sobre el sustrato de montaje; rollo u hoja según el material; con panelizado parte en paños | Montado sobre material |
| `superficie: segun_material` | Rollo → shelf · placa → grilla 2D, decidido en runtime por el material elegido | Impresión por área |
| *(sin nestingConfig)* | No hay nesting: sigue la cascada | todas las demás |

## 5. Los derivadores: quién los tiene

Geometría pura registrada en `derivadores/index.ts` (funciones con specs);
la familia la referencia por código. Escalan por **unidades del trabajo**
(2 carteles = doble) y publican magnitudes que otros pasos heredan:

| Derivador | Familia | Magnitud principal | Publica además |
|---|---|---|---|
| `bastidor_rectangular` | Estructura de bastidor | ml de perfil (→ barras enteras) | uniones/soldaduras, cenefa m², pintura m², anclajes, despiece |
| `sembrado_led` | Iluminación LED | módulos (grilla por `paso`) | watts, watts requeridos (por cartel), cable ml |
| `layout_ojales` | Colocación de ojales | ojales (reparto por lado) | posiciones para el visor |

Los **slots** de estas familias consumen esas magnitudes como *default* — y
desde 2026-08-11 el modelador puede pisarlas con su propia regla base ×
factor (regla 2, carteleria-pasos-revision.md §8).

## 6. Censo completo (generado de `familias.ts`, 2026-08-11)

| Familia | Mecanismos | Nesting | Derivador | Hereda por default |
|---|---|---|---|---|
| Pre-prensa | DIRECTO | — | — | — |
| Impresión por hoja | HEREDA+CALCULA | pliego_digital | — | pliegos_calculados |
| Impresión por área | CALCULA | segun_material | — | — |
| Impresión por pieza | DIRECTO+HEREDA | — | — | — |
| Impresión 3D | DIRECTO | — | — | — |
| Transfer manual / textil | DIRECTO+HEREDA | — | — | — |
| Grabado láser · Corte láser · CNC | DIRECTO | — | — | — |
| Corte con guillotina | HEREDA | — | — | pliegos_impresos |
| Plotter de corte | CALCULA | corte_rollo | — | — |
| Troquelado digital | DIRECTO | — | — | pliegos_impresos |
| Plegado manual | HEREDA | — | — | pliegos_impresos |
| Refilado manual | DIRECTO+HEREDA | — | — | pliegos_impresos |
| Laminado | HEREDA+DIRECTO | laminado_rollo | — | pliegos_impresos |
| Plastificado pouch | CALCULA | pouch | — | — |
| Pintura superficial | DIRECTO+HEREDA | — | — | — |
| Abrochado · Anillado · Engomado | DIRECTO | — | — | (anillado/engomado: pliegos_impresos) |
| Ensamble estructural | DIRECTO | — | — | — |
| Estructura de bastidor | CALCULA | — | bastidor_rectangular | — |
| Iluminación LED | CALCULA | — | sembrado_led | — |
| Montado sobre material | CALCULA | montaje | — | — |
| Embalaje | CONV+DIRECTO | — | — | — |
| Trabajo manual | DIRECTO+HEREDA+CONV | — | — | — |
| Modificación post-producción | DIRECTO+HEREDA | — | — | piezas_cortadas |
| Colocación de ojales | CALCULA+DIRECTO | — | layout_ojales | — |
| Instalación en sitio · Diseño gráfico | DIRECTO | — | — | — |

("Hereda por default" = el output que toma si el paso elige HEREDA sin
señalar origen; el modelador puede apuntar a otro con `campoOutput`.)

## 7. Tres trabajos de punta a punta

**500 folletos 10×15 (imprenta)**
1. Impresión por hoja → CALCULA con `pliego_digital`: 24 poses por SRA3 →
   21 pliegos; publica `pliegos_impresos`.
2. Laminado → HEREDA los 21 pliegos, nesting de film por encima.
3. Guillotina → HEREDA los 21 pliegos, pero su tiempo NO es una
   productividad: es la primitiva del guillotinero —
   `tandas × cortes por tanda × segundos por corte + recargas`, donde las
   **tandas** = pliegos ÷ pliegosMaxPorTanda (del perfil, por escalón de
   gramaje) y los **cortes por tanda** vienen del plan de imposición
   (`cortes_calculados`, que publicó la impresión junto con los pliegos).

**Vinilo impreso, 6 medidas distintas (gran formato)**
1. Impresión por área → CALCULA con `segun_material`: el material elegido es
   ROLLO → shelf consolida las 12 piezas en el ancho → 5,97 m lineales.
2. Refilado → HEREDA/DIRECTO según config.
3. Colocación → DIRECTO (por m² del trabajo).

**Cartel backlight 2,40×1,20×0,18**
1. Estructura → CALCULA con **derivador**: 17,12 ml → 3 barras; publica
   uniones, cenefa m², pintura m².
2. Soldadura → HEREDA `puntos_soldadura` (16).
3. Pintura → HEREDA `pintura_m2` (2,9 + pérdida configurable).
4. Impresión de lona → CALCULA (rollo, con la demasía de tensado mutada).
5. Chapa trasera → CALCULA con **nesting `montaje`**: la pieza terminada en
   hojas de 1,22×2,44, en paños si no entra.
6. Iluminación → CALCULA con **derivador**: grilla por paso del módulo;
   fuente 1 por cartel elegida por watts.
7. Tensado → DIRECTO (por unidad).
8. Cenefas → HEREDA `cenefa_m2`.

El mismo producto usa los tres proveedores de CALCULA (derivador en 1 y 6,
nesting en 4 y 5) más HEREDA y DIRECTO — esa es la gracia del modelo: cada
paso elige su idioma y el motor los compone.


## 8. Tres aclaraciones (2026-08-11, preguntas del usuario)

**¿El mecanismo se define por familia o por paso?** POR PASO: `mecanismoCantidad`
vive en la config del paso y el modelador lo elige. La familia sólo declara el
MENÚ (`mecanismosCantidadSoportados`) — qué opciones tienen sentido para ese
oficio. El guiado no lo quitó: lo fusionó en **"¿Sobre cuántas piezas
trabaja?"** (eje Cuánto tarda, componente cantidad-unificada), y cuando el
ritmo es productividad se muestra inline junto al ritmo ("6 puntos de
soldadura por hora"). Sólo se oculta si la familia soporta un único mecanismo
(no hay nada que elegir).

**La guillotina de verdad** (primitiva `guillotina_por_cortes`): no usa
productividad. `tandas = ⌈pliegos ÷ pliegosMaxPorTanda⌉` (el perfil por
escalón de gramaje decide cuántos pliegos entran por bajada) ·
`tiempo = tandas × cortesPorTanda × segundosPorCorte + (tandas−1) × recarga`.
Los pliegos los HEREDA de la impresión; los cortes por tanda salen del plan
de imposición (`cortes_calculados`). Cantidad de cortes Y cantidad de tandas,
como corta el guillotinero.

**`pliegos_calculados` vs `pliegos_impresos`**: hoy casi siempre valen lo
mismo, pero tienen roles distintos. *Calculados* = el PLAN de la imposición
(cuántos pliegos dice el nesting que hacen falta; null si el nesting no
corrió — eso alimenta el guard "guillotina sin plan"). *Impresos* = lo que el
paso de impresión declara haber PRODUCIDO (su cantidad efectiva — que puede
venir de su propio nesting, y entonces coincide, o de una herencia). Los
pasos siguientes heredan IMPRESOS; calculados queda como plan + fallback.
El doble nombre es herencia de cuando pre-prensa publicaba el plan y la
impresión el hecho; hoy ambos viven en `impresion_por_hoja`. Consolidarlos
en uno es posible pero exige alias de lectura (herencias guardadas los
referencian) — anotado como limpieza futura, no urgente.

**Pre-prensa quedó DIRECTO puro**: `CALCULADO_POR_PASO` en sus soportados era
letra muerta del look-ahead retirado (la imposición vive en el paso que
imprime). Cero configs lo usaban; se quitó del menú.
