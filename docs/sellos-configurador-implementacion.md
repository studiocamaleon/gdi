# Configurador de sello — estado de implementación

**Fecha:** 2026-07-10
**Decisiones (confirmadas por el usuario):**
- EPS **vectorial fiel** (texto → contornos con opentype.js, mismas fuentes que el
  preview) — no `show` con fuentes PostScript.
- Fase 1 = **editor + preview + descarga EPS** (sin persistencia en Archivos aún).
- El editor va como **modal/sheet separado** ("botón Diseñar"), no embebido en el
  sheet de cotización.
- Un **arte por ítem** (N sellos iguales); N sellos distintos = N ítems.

Base de UI: HTML standalone que armó el usuario (fit-to-box, inputs por línea con
B/I, alineación, 5 tipografías, EPS pos/neg). Se reutiliza el markup/estilos; la
lógica de EPS se reemplaza por el motor vectorial.

## Hecho y verificado (2026-07-10)

1. **opentype.js@2.0.0** instalado. Lee TTF/OTF/WOFF (no woff2 → usamos TTF).
2. **5 fuentes** OFL/Apache en `public/fonts/sellos/` (Archivo, Playfair Display,
   Oswald, Dancing Script, Roboto Slab) — libres para uso comercial + embedding.
3. **Motor puro** `src/lib/sello-arte/engine.ts`:
   - `layoutSello()` — fit-to-box unificado (posiciones/tamaños en mm).
   - `svgSello()` — preview SVG con los mismos paths.
   - `epsSello()` — EPS vectorial positivo/negativo (texto→contornos; convierte
     cuadráticas a curveto vía proc `qcurveto`; y-up; BoundingBox a medida).
   - Glifo a glifo (evita el shaping ccmp que rompe en variable fonts).
   - Verificado: EPS de Trodat 4911 (38×14mm) → BoundingBox 108×40 pt exacto,
     645 curveto, cero `show`; negativo con rectfill+letras blancas. Preview SVG
     de 3 tipografías + negativo renderizado en el navegador: distintas y
     ajustadas, acentos y "·" correctos.

## Pendiente

- **Loader de fuentes browser** `src/lib/sello-arte/fonts.ts`: import dinámico de
  opentype + fetch de los TTF de `/fonts/sellos`, cache. (Node test ya usa su
  propio loader.)
- **Bold/italic reales por línea**: hoy se carga una instancia por familia
  (variable default). Para bold/italic fieles: cargar las instancias o instanciar
  el eje `wght`. El motor ya recibe `bold/italic` en el resolver.
- **Componente editor** (React) portando el HTML: modal/sheet, inputs por línea
  desde el cuerpo elegido, 5 tipografías (preview con el motor), alineación,
  descarga de los 2 EPS. Obviar notas de producción y cantidad.
- **Herramienta `editorSello`** en `producto-herramientas.ts` + botón "Diseñar"
  en el sheet cuando el producto la tiene y hay cuerpo elegido.
- **Guardar el diseño** (textos, estilos, fuente, alineación) en el jobContext
  del ítem — fuente de verdad; el EPS es derivado.
- **Fase 2** (aparte): persistir los EPS en "Archivos" de la orden (requiere el
  sistema de adjuntos, hoy inexistente) y sellos redondos/ovalados (texto en arco).
