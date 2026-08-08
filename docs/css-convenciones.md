# CSS — convenciones y el trinquete

Cómo se escriben estilos nuevos, por qué `globals.css` llegó a 38k líneas y qué
se hace al respecto sin frenar el desarrollo.

## El problema

`globals.css` mide 38.093 líneas y entra **entero en todas las páginas**: lo
importa `src/app/layout.tsx` una sola vez, para toda la app.

CSS no tiene módulos. Toda clase que se escribe sin ancestro es, literalmente,
una variable global de la aplicación. Es el equivalente a que en JavaScript no
existiera `import` y hubiera que llamar a las funciones `gf_calcularTotal` y
`otd_calcularTotal` para que no se pisen.

Eso es exactamente lo que se venía haciendo, y bastante bien:

```css
.gf { ... }                     /* gastos fijos: el "namespace" */
.gf .wrap { max-width:1600px }  /* hijo genérico, protegido por el padre */
.gf .mono { ... }
```

Hay **74 prefijos** de vista con este patrón. No es caos: es un sistema de
módulos hecho a mano. El problema es que depende de que la persona se acuerde,
siempre, para siempre.

### La medición

Sobre los 6.966 selectores de la hoja:

| | |
|---|---|
| Protegidos por ancestro (`.gf .wrap`) | 4.437 |
| Protegidos por clase hermana o tag (`.maq-btn.activo`) | 324 |
| **Clase sola, o sea global de verdad** | **2.053 selectores / 1.637 clases** |

Correr `npm run css:guard -- --list` para verlas con su número de línea.

### Qué duele de verdad

No es el peso del archivo. Son tres cosas:

1. **No se puede borrar nada.** Si aparece `.card` a mitad del archivo, ¿quién
   la usa? ¿Una vista, doce? Como averiguarlo cuesta más que dejarla, nadie
   borra nunca. El CSS muerto se acumula de por vida.
2. **Peaje en cada cambio.** Cada clase nueva obliga a frenar y verificar que el
   nombre esté libre — el padre y también los hijos.
3. **Turbopack.** Una hoja de este tamaño no siempre recompila; ver
   `feedback_turbopack_css_recompile` en la memoria del proyecto.

### Lo que NO es el problema

Buena parte de esas 1.637 globales son el **sistema compartido a propósito**:
`.btn`, `.btn-primary`, `.tbl`, `.tag`, `.field`, `.search`, `.icon-btn`,
`.page-head`, `.card-head`, `.stat`. Esas están bien donde están: son la API
pública de la hoja.

También hay un grupo de utilidades que creció sin que nadie decidiera que era
una librería — `.code`, `.name`, `.desc`, `.right`, escritas como
`.tbl .code, .code {}`. Están **en uso** (`className="code mono"`), así que no
se borran; quedan anotadas como deuda conocida.

## Triage: cuáles de las 1.637 importan

No todas pesan igual. Una global con prefijo de vista (`.maq-perfiles-tabla`) es
fea pero **no choca con nadie**: el nombre ya es único. La peligrosa es la de
nombre común sin prefijo, porque cualquiera la reinventa mañana en otra vista y
la pisa sin enterarse.

| | |
|---|---|
| Con prefijo de vista — feas, no chocan | 1.512 |
| **Sin prefijo — superficie real de colisión** | **125** |

O sea que el problema accionable es **125 clases, no 1.637**. De esas, las que
más vistas usan son las que de hecho ya son el sistema compartido:

```
btn (50 archivos)   right (21)   page-head (12)   desc (11)   name (8)
content (7)   card (7)   code (7)   tbl (6)   tag (6)   field (5)
```

Las de 1–2 usos son las candidatas naturales a irse a un módulo cuando se toque
la vista: `ohead`, `oprow-head`, `rbcol`, `cfgnav`, `topbar`, `user-pill`,
`eta-sugerida`, `resumen-bar`…

### Sobre "CSS muerto": cuidado

Un detector de uso por texto **no es confiable acá**. Las clases se aplican de
formas que un grep no ve:

```tsx
className={`side${collapsed ? " collapsed" : ""}`}   // plantilla
className={cn("selb", abierto && "abierto")}         // helper
```

`.side` y `.selb` aparecen como "sin uso" y sin embargo se usan. Antes de borrar
cualquier cosa hay que mirarla a mano.

### Primer caso resuelto: `.gf` estaba muerto (borrado)

El namespace `.gf` tenía **98 reglas** en dos bloques no contiguos, más el
`@keyframes gfRowIn`. No lo aplicaba nadie: la vista de gastos fijos usa
`gfijo-*` desde que el módulo se reconstruyó estilo Holdprint, y esta era la
hoja de la versión anterior.

Se borró: **−164 líneas** y una clase global menos.

Lo que hizo confiable la decisión, y sirve de receta para el próximo:

1. Búsqueda en **todo el repo** de `class`/`className` con el token suelto —no
   sólo en `src`— incluyendo plantillas y `cn()`.
2. Mirar qué clases usa de verdad el componente que debería aplicarlo
   (`gfijo-*`, no `.gf`).
3. Después de borrar, probar los **vecinos de cada costura** con estilo
   computado sobre elementos reales, no a ojo: `.prodtab`, `.dash-scroll`,
   `.egr-adj-x`, `.mod-body .form-grid`.
4. Ojo con las variables: `.gf` declaraba `--bg`, `--border-strong` y demás,
   pero eran los mismos valores que ya vienen de `:root`. Un `div` sin clase
   computaba idéntico, así que no se perdió nada. Conviene comprobarlo antes de
   dar por muerta cualquier declaración de tokens.

### Buscar familias muertas, no clases muertas

Preguntar "¿se usa `.card`?" no sirve: la respuesta es poco confiable. Pero
preguntar "¿se usa **alguna** clase de la familia `tpl-*`?" sí, porque una
familia entera sin una sola referencia en 5.361 archivos no es un falso
negativo, es un módulo que quedó atrás.

Con ese criterio salieron **siete familias muertas, 135 reglas, −701 líneas**,
todas del mismo origen: la vista de Integraciones se reescribió con nombres
prefijados (`int-msg-*`, `int-tpl-*`) y la generación anterior —`msg-*`,
`tpl-*`, `ev-*`, `we-*`, `event-*`— se quedó. Mismo patrón que `.gf` → `gfijo-*`.

Dos trampas que costaron encontrar:

**1. Las clases construidas en runtime.** `.span-3` … `.span-12` figuraban como
muertas y están vivísimas:

```tsx
<div className={`d-card span-${span}`}>   // panel-general.tsx
```

Antes de borrar una familia hay que buscar `` `prefijo-${ `` además del nombre
literal. Es el único chequeo que separa a `.span-*` de las que sí estaban
muertas.

**2. Las que no son globales.** `.st-*` (60 reglas) y `.now-*` viven anidadas
bajo `.tablero-produccion`, que está muy viva. La regla
`.tablero-produccion .st-col` sólo puede aplicar sobre un elemento que ya no
existe, así que se va igual — pero un borrador que sólo mire el primer selector
no las ve. El criterio correcto es: **se borra la regla si TODOS sus selectores
contienen una clase de familia muerta en cualquier posición.**

### Cómo verificar un borrado grande

Que el resultado sea un **subconjunto** del original, comparando líneas con
contenido:

```bash
comm -13 <(grep -vE '^\s*$' viejo.css | sort -u) <(grep -vE '^\s*$' nuevo.css | sort -u)
```

Si eso da vacío, no se agregó ni se modificó nada: sólo se borró. Vale la pena
porque `git diff` reporta "inserciones" que son puro emparejamiento — en este
borrado marcó 78 y eran cero. Después, llaves balanceadas y los vecinos de cada
costura probados con estilo computado.

## La regla

> **Una vista nueva no escribe en `globals.css`. Nace con su propio módulo.**

```
mi-vista.module.css              import s from "./mi-vista.module.css";
.wrap { ... }                    <div className={s.wrap}>
.card { ... }                    <div className={s.card}>
```

Next lo soporta nativo, sin dependencias. El compilador renombra `.card` a algo
único por archivo, así que **el aislamiento deja de ser disciplina y pasa a ser
garantía de la herramienta** — que es toda la diferencia.

Adentro de un módulo los nombres pueden ser cortos y obvios. Nada de prefijos a
mano. Y cuando la vista muera, su CSS muere con ella.

### Qué sigue yendo en `globals.css`

- Los tokens (las ~317 variables CSS).
- El reset y la tipografía.
- El tema oscuro (`.dark`).
- El sistema compartido de verdad, el que usan muchas vistas.

Objetivo a largo plazo: entre 1.000 y 2.000 líneas. Eso es un archivo global
sano — lo que de verdad es de todos.

## Migrar una vista existente

No hay plan de migración masiva y no hace falta. **Se migra al tocar.**

Hay un script que hace la parte mecánica —
`node scripts/migrar-familia-css.mjs <prefijo> <desde> <hasta> <módulo> <tsx…> [--dry]` —
extrae el bloque, camelCasea las clases de la familia, envuelve en `:global()`
los hijos genéricos y los estados hermanos (así sus strings en el TSX no se
tocan y la cascada queda idéntica), y reescribe los `className`. Lo que NO
hace solo: las clases construidas en runtime (`` `acp-e-${clave}` ``) — avisa
y las deja literales para resolver a mano con un mapa estático. Antes de
correrlo, verificar que ningún token genérico del bloque sea global de verdad
(compararlos contra `scripts/css-guard-baseline.json`).

El archivo ya viene pre-cortado por los 74 prefijos, así que es mecánico:

1. Buscar el bloque de la vista (`.gf`, `.otd-page`, `.est-sheet`…).
2. Mover esas reglas a `<vista>.module.css`.
3. Sacarles el prefijo a los hijos: `.gf .wrap` → `.wrap`.
4. En el `.tsx`, `className="gf-algo"` → `className={s.algo}`.
5. `npm run css:guard -- --update` para bajar el listón.

Si se quiere progreso deliberado en vez de oportunista, el bloque más grande de
la hoja por lejos es `.tablero-produccion`: **840 reglas**.

## El trinquete

```bash
npm run css:guard
```

No arregla lo viejo. Impide que empeore:

- **Clase global nueva** que no está en la línea de base → error, con la línea y
  las tres salidas posibles.
- **El archivo creció** → aviso, no corta (a veces hay que tocar tokens).
- **Una global desapareció** → felicita y pide bajar el listón.

La línea de base vive en `scripts/css-guard-baseline.json` y no se edita a mano:

```bash
npm run css:guard -- --update
```

Los números de ese archivo **sólo deberían bajar**. Si suben, que sea una
decisión consciente y no un descuido.

### Qué cuenta como global

```css
.code {}             /* GLOBAL — le pega a cualquier `code` de la app */
.gf .wrap {}         /* no: la protege el ancestro */
.maq-btn.activo {}   /* no: la protege la clase hermana */
button.foo {}        /* no: la acota el tag */
.btn:hover {}        /* GLOBAL — la pseudo-clase no protege nada */
```
