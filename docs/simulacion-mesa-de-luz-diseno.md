# Mesa de luz — visualizar la simulación del motor de ETA

Documento de diseño para la vista que muestra **qué decidió el motor de ETA y
por qué**. Estado: **IMPLEMENTADO** como cuarto tab del Tablero de producción.

- Motor: `simularFlujo` devuelve `traza` — [`src/lib/flujo-produccion.ts`](../src/lib/flujo-produccion.ts)
- Eje: [`src/lib/eje-laboral.ts`](../src/lib/eje-laboral.ts)
- Vista: [`src/components/produccion/simulacion-view.tsx`](../src/components/produccion/simulacion-view.tsx)
- Diseño de origen: `mesa-luz-propuesta-clara.html` (Claude Design, proyecto Grafo V2)
- Prototipo previo: artifact `96075f68` y [`mesa-de-luz-prototipo.html`](mesa-de-luz-prototipo.html)

**Se actualiza sola.** El tablero ya polleaba cada 15 s y `simularFlujo` está
memoizado sobre `items`: cuando un operario completa un paso, el plan se
recalcula y la vista se redibuja. No hizo falta infraestructura de tiempo real.

---

## 1. Por qué es barato

El motor **ya calcula todo lo que hay que dibujar y lo tira a la basura**.
En [`src/lib/flujo-produccion.ts`](../src/lib/flujo-produccion.ts), el bloque de
commit del list-scheduling:

```ts
const { sim, est, duracion, start } = mejor;
const fin = sumarMinutosLaborales(est.calendario, start, duracion, noLaborables);
ocupar(est, fin);
```

En ese punto están, para un paso concreto: el item, la estación, el inicio
exacto, el fin exacto, la duración y si hubo supuestos. Nada de eso se guarda —
sólo sobrevive `sim.readyAt` para encadenar, y al final un `finEstimado` por
item.

**El trabajo de backend es anotar, no calcular.** Un array de traza y un `push`
en ese commit. Además `simularFlujo` es pura y determinista (recibe `ahora` como
parámetro), así que registrar no tiene efectos secundarios y la simulación se
reproduce idéntica.

---

## 2. Contrato de datos

### 2.1 Bloque (una decisión del scheduler)

Un registro por paso colocado. El orden del array **es el orden en que el
algoritmo tomó las decisiones**, que no es cronológico — es la clave del replay.

| campo | tipo | origen | notas |
|---|---|---|---|
| `i` | int | índice en la traza | orden de decisión |
| `itemId` | uuid | `sim.data.id` | agrupa la ruta de un item |
| `ordenNumero` | string | `sim.data.ordenNumero` | `OT-2026-0025` |
| `itemNombre` | string | | `Carpetas con solapa` |
| `cliente` | string | | |
| `pasoId` / `pasoIndice` | uuid / int | `paso.id`, `paso.indice` | posición en la ruta |
| `pasoNombre` | string | | `Laminado` |
| `familia` | string | `paso.familiaCodigo` | `impresion_por_hoja` |
| `estacionKey` | string | `est.key` | o `__sin_estacion__` / `__proveedor__` |
| `estacionNombre` | string | | |
| `start` / `fin` | ISO | `start`, `fin` del commit | **hora local del taller** |
| `duracionMin` | number\|null | `duracion` | null en tercerizados |
| `plazoDias` | int\|null | `plazoProveedorDias` | sólo tercerizados |
| `esperaMin` | number | `start - sim.readyAt` | **cuánto esperó puesto libre** |
| `parcial` | bool | `est.parcial` | calendario asumido / sin estación |
| `tercerizado` | bool | | |
| `enCurso` | bool | paso frontera `en_curso` | arranca en `ahora` |
| `competidores` | int | candidatos evaluados en ese turno | para el "por qué" |

### 2.2 Resultado por item

Lo que hoy ya devuelve `porItem`, más lo derivado: `finEstimado`, `sinEstimar`,
`parcial`, `asumeDesbloqueo`, `fechaEntrega`, y `tarde` (= `finEstimado >
fechaEntrega`).

### 2.3 Carriles

Por estación simulada: `key`, `nombre`, `puestos` (`capacidadConcurrente`,
`null` = sin límite), `calendario`, `parcial`. Más los dos sintéticos:
`__sin_estacion__` y `__proveedor__`.

---

## 3. Las tres decisiones de diseño que importan

### 3.1 El eje NO es tiempo lineal — son minutos laborales

Sin esto la vista es ilegible, y no es una preferencia estética: el horizonte
real medido es de **15 jornadas (9.000 min laborales)** con una **mediana de
bloque de 10 min**. En tiempo lineal, tres semanas incluyen ~340 h de noches y
fines de semana donde no pasa nada, y un paso de 10 min ocupa 0,05 % del ancho.

El eje colapsa noches y fines de semana: `x` = minutos laborales acumulados
desde el arranque, jornada L–V 08:00–18:00. Las marcas de día quedan
equiespaciadas y el detalle intradiario se vuelve legible.

> Consecuencia: `x` hay que **precalcularlo en el servidor**, no en el navegador.
> Si se calcula en el cliente, la vista cambia según la zona horaria de quien
> mire. El prototipo ya lo hace así.

### 3.2 Ancho mínimo de bloque, y el artefacto que genera

Rango real de duraciones: **0 a 500 min**, mediana 10. Con proporción fiel, la
mitad de los bloques desaparece. Con ancho mínimo (~12 px), dos pasos
encadenados cortos **se solapan en pantalla**.

Ese solape rompe el hilo de recorrido: dibuja hacia atrás en el tiempo y parece
un bug. Solución adoptada: cuando el siguiente paso arranca antes de que el
anterior termine *visualmente*, el hilo usa un **conector vertical** en lugar de
una curva. Dice la verdad (la posta pasa de un carril a otro) sin mentir sobre
la dirección del tiempo.

Es una tensión inherente, no un defecto a corregir: no se puede tener a la vez
proporción fiel y visibilidad de los bloques cortos.

### 3.3 Empaquetado en sub-filas

Cada carril reparte sus bloques en sub-filas por solape (greedy por `x0`).
Validación cruzada útil: **las filas necesarias nunca superan los puestos
reales** (Corte 2/2, Impresión 1/1, Pre-prensa 2/2) — o sea el motor respeta la
capacidad. La excepción es `__sin_estacion__`, que necesitó 4 filas porque tiene
capacidad infinita: el desvío se ve solo.

---

## 4. Lo que la vista revela sobre el taller

Con los datos actuales, la vista **no es decorativa**: expone tres problemas
reales que hoy no se ven en ninguna pantalla.

- **76 % del trabajo programado (22,8 h de 29,7 h) cae en "Sin estación
  asignada"** — familias como `trabajo_manual` no están asignadas a ninguna
  estación, así que el motor las programa con capacidad infinita. Esa parte del
  plan es optimista y nadie lo sabe.
- **Gran formato UV acumula esperas de 27 h.** El cuello de botella es
  visible de un vistazo, con nombre y horario.
- **3 items no llegan a su fecha comprometida.** Hoy eso sólo se sabe item por
  item; acá se ve el conjunto.

---

## 5. Dirección visual

**Anclaje:** la **mesa de luz** de una imprenta — donde se superponen
transparencias para verificar registro. Un Gantt de trabajos solapados *es* eso.
Justifica una estética luminosa sin caer en el "control room" de neón genérico.

**Paleta categórica: tintas de proceso.** Cian, magenta, amarillo + violeta,
teal, naranja. Es el vocabulario cromático del propio oficio y resuelve la
necesidad de ~18 colores distinguibles para las OTs.

| token | dark | rol |
|---|---|---|
| `--ink` | `#070B14` | fondo, tinta, sesgo azul (no gris) |
| `--film` | `#0E1626` | panel |
| `--cyan` | `#22D3EE` | la voz del sistema: línea "ahora", activo |
| `--hot` | `#FF3D8B` | no llega a la fecha |
| `--amber` | `#FFB020` | supuesto / sin estación real |
| `--good` | `#2DD4A7` | en fecha |

Tema claro = la mesa apagada: pliego de papel con los mismos pigmentos. No es
una inversión automática.

**Tipografía:** monoespaciada como *display*, no sólo para datos. Es la
vernácula del instrumento y evita el Inter/Space-Grotesk por defecto. Grotesca
de sistema sólo para prosa del inspector. `tabular-nums` en todo lo numérico.

---

## 6. Interacciones

1. **Replay en orden de decisión** (la tesis). El scrubber recorre las 45
   decisiones en el orden en que el algoritmo las tomó. Se ve al scheduler
   saltando en el tiempo llenando huecos — eso es, literalmente, lo que piensa.
   Cada paso narra en castellano: *"Decisión 20 — coloca OT-2026-0011 · Corte
   guillotina en Corte y terminación, arranca lun 20/07 09:20, 9 min (12
   candidatos en juego)"*.
2. **Hover → hilo del recorrido.** Ilumina los bloques de esa OT y enhebra los
   pasos **de cada item** cruzando carriles. Ojo: una OT puede tener varios
   items con secuencias independientes — un solo hilo los mezcla y retrocede.
   Un hilo por item.
3. **Click → inspector.** El *por qué* de esa decisión: cuánto esperó y por qué,
   cuántos candidatos había, si la estación es asumida, si el item llega.
4. **Zoom** mes / semana / día / hora, y filtro "sólo los que no llegan".

---

## 7. Resuelto al implementar

- **Calendarios heterogéneos.** El eje ya no asume L–V 08:00–18:00: toma la
  **unión de las franjas de las estaciones activas** y salta los días en que no
  trabaja ninguna, más los feriados del taller. En el taller real esto cambió
  el resultado — *Corte y terminación trabaja los sábados 09:00–13:00*, así que
  el sábado aparece en el eje (el prototipo lo escondía).
- **`ahora` real.** La vista recalcula con cada poll del tablero. El replay
  se re-ancla solo si el plan cambia de tamaño mientras se está mirando.
- **Tipografías.** Space Grotesk + IBM Plex Mono entran por `next/font`
  (auto-hospedadas), no por el `<link>` a Google Fonts del prototipo.

## 8. Pendiente

- **Escala.** 45 bloques en DOM andan bien. Con 500+ conviene canvas o
  virtualización por ventana visible.
- **Ítems sin ETA.** Hoy no hay ninguno (se corrigió el bug de duración 0), pero
  la traza corta ahí. Deben dibujarse **truncados y señalados**, no omitidos, o
  el gráfico miente por omisión.
- **Casos silenciosos.** Horizonte de 120 días agotado o guardia del loop:
  `finEstimado` queda null sin `sinEstimar`. En la vista tienen que verse.
- **Franjas muertas por carril.** El eje da a cada día la jornada completa de
  la unión; una estación que cierra antes (el sábado de Corte, 09–13 sobre una
  jornada de 09–18) muestra espacio vacío que no se distingue de "ocioso".
  Sombrear el fuera-de-franja **por carril** lo resolvería.
