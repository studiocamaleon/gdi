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
