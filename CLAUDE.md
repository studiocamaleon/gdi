# gdi-saas

Notas para quien (o lo que) trabaje en este repo. Sólo va acá lo que no se
deduce leyendo el código y que, si se ignora, rompe algo.

## Estilos: no escribir en `globals.css`

`src/app/globals.css` mide ~38k líneas y entra entero en todas las páginas. CSS
no tiene módulos, así que **toda clase sin ancestro es una variable global de la
app** — hoy hay ~1.600.

**Una vista nueva nace con su propio módulo, no con reglas en `globals.css`:**

```
mi-vista.module.css          import s from "./mi-vista.module.css";
.wrap { ... }                <div className={s.wrap}>
```

En `globals.css` sólo van tokens, reset, tipografía, tema oscuro y el sistema
compartido de verdad (`.btn`, `.tbl`, `.tag`, `.field`, `.page-head`).

Lo viejo se migra al tocarlo, no de una. Antes de cerrar un cambio de UI:

```bash
npm run css:guard
```

Falla si apareció una clase global nueva. Detalle completo, cómo migrar una
vista y qué cuenta como global: [docs/css-convenciones.md](docs/css-convenciones.md).

**Turbopack congela globals.css** (probado 2026-08-08): tras el primer compile,
el bundle CSS no se reconstruye más — ediciones posteriores de globals.css no
llegan al navegador por más reload que se haga (los `.tsx` y los `.module.css`
sí reflejan). Para trabajar CSS global usar `npm run dev:webpack` (HMR aplica en
vivo). El fix de fondo es este mismo plan de migración: achicar globals.css.

## El proxy va en `src/`

`src/proxy.ts` (era `middleware.ts` hasta Next 16). Con estructura `src/`, Next
**sólo** lo ejecuta desde ahí: en la raíz del proyecto no corre y no avisa. Ya
pasó — estuvo meses muerto y lo tapaban los layouts y los 401 del API.

Para comprobar que corre, el dev server loguea `proxy.ts: Xms` en cada request.

## Documentación

`docs/` tiene ~96 documentos de diseño, uno por módulo o decisión. Antes de
rediseñar algo, buscar si ya está pensado ahí.
