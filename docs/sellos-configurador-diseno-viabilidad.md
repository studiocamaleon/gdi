# Configurador de sellos (texto → tipografías → EPS) — Análisis de viabilidad

**Fecha:** 2026-07-10
**Estado:** Análisis de viabilidad — sin implementar
**Alcance:** tres capacidades sobre el producto "Sello", encadenadas:
1. inputs de texto por línea según el modelo elegido;
2. previsualización del texto en ~5 tipografías, ajustadas a la medida del sello;
3. generación de archivos `.eps` (positivo para grabado láser + negativo para
   polímero líquido).

**Veredicto corto:** las tres son viables. La #1 es fácil, la #2 es de trabajo de
producto (fuentes + auto-ajuste), la #3 es la más técnica (texto→vectores→EPS) y
es la que define un ingrediente nuevo de dependencias. **Ninguna toca el motor de
costeo** — es una capa de UI/herramienta sobre el producto, en JSON, sin
migraciones.

---

## 1. Qué ya tenemos que habilita esto

- **Datos del modelo en la variante del cuerpo del sello**: cada variante
  (ej. Trodat Printy 4911) ya trae `anchoPolimero`, `altoPolimero`, `lineasTexto`
  y `forma`. Al cotizar, el comercial elige ese cuerpo en un slot del producto,
  así que el sheet **ya sabe cuántas líneas y qué medida** tiene el sello.
- **Patrón de "herramientas por producto"** (`src/lib/producto-herramientas.ts`):
  config opcional guardada en `atributosComercialesJson.herramientas.<x>` con
  `{enabled, ...}`, **extensible sin migración**. Ya existe `medidasDesdeArchivo`.
  El sheet detecta el flag y renderiza UI especial. Es el molde exacto para una
  herramienta `editorSello`.
- **Manipulación de archivos client-side**: la herramienta de medidas ya lee PDFs
  en el browser con `pdf-lib`. Precedente de generar/leer archivos sin backend.
- **Persistencia del jobContext**: lo que cargue el comercial (textos, tipografía
  elegida) viaja en `jobContext`/`especificaciones` (JSON) → snapshot → OT, sin
  cambios de base.
- **Categoría comercial "Sellos"** y la familia de inventario ya creadas.

Faltante relevante para la #3: el **tab "Archivos" de la propuesta hoy es un
placeholder** (no hay almacenamiento de archivos implementado). Persistir el EPS
junto a la OT depende de resolver eso (es la misma "Fase 2" pendiente de la
herramienta de medidas PDF).

---

## 2. Las tres capacidades

### #1 — Inputs de texto por línea según el sello — **FÁCIL / ALTA viabilidad**

Cuando el comercial elige el modelo, el sheet ya conoce `lineasTexto` del cuerpo.
Con eso renderiza N inputs de texto (uno por línea), en un bloque nuevo activado
por la herramienta `editorSello`.

- **Cómo:** un bloque en el sheet (mismo patrón que el input de tiempo manual o
  el override de color por paso) que lee `lineasTexto` de la variante elegida y
  mapea a N `<input>`. Los valores se guardan en `jobContext.textoSello[]` (o
  `especificaciones.texto_grabado`, que ya existe en el schema `sello`).
- **Sin backend, sin migración.** Es UI + estado.
- **Detalle:** si el comercial cambia de modelo (más/menos líneas), el bloque se
  redimensiona conservando el texto que entre. Validación opcional de largo por
  línea (ancho de caja) — nice-to-have.
- **Esfuerzo:** bajo (~1 sesión).

### #2 — Preview en ~5 tipografías ajustadas a la medida — **VIABLE / trabajo de producto**

Renderizar el texto en varias fuentes y escalarlo a la caja `anchoPolimero ×
altoPolimero` es factible client-side con **SVG** (sin librerías nuevas para el
preview). La complejidad no es técnica sino de **fidelidad y layout**:

- **Fuentes:** hay que elegir ~5 tipografías y tener sus archivos (TTF/OTF) con
  **licencia para uso comercial** (los sellos se venden). Hoy el proyecto solo
  carga Inter + Geist Mono vía `next/font`. Habría que sumar las de sellos.
- **Auto-ajuste (fit-to-box):** calcular el tamaño de fuente para que las N
  líneas entren en el alto disponible y la línea más larga no exceda el ancho
  (menos un margen de seguridad del cliché). Es un algoritmo conocido (medir y
  escalar), no trivial pero acotado. Cada preview es un SVG con las N líneas
  centradas.
- **Es una previsualización comercial, aproximada** — sirve para que el cliente
  elija. El arte fino de producción se genera en #3 con las **mismas fuentes**
  (para que "lo que ves es lo que sale").
- **Formas no rectangulares:** los sellos redondos/ovalados necesitan layout
  curvo (texto en arco) — bastante más complejo. Sugerencia: **fase 1 solo
  rectangulares** (la gran mayoría), redondos después.
- **Esfuerzo:** moderado (~1–2 sesiones para rectangulares). El motor de preview
  (SVG + fit-to-box + selector de fuente) es lo nuevo; sin dependencias de
  servidor.

### #3 — Generar `.eps` positivo + negativo — **VIABLE / la más técnica**

Este es el matiz serio. Un EPS para láser **no puede llevar el texto como texto**
(el RIP del láser puede no tener la fuente): las letras tienen que ir como
**contornos vectoriales (paths)**. Eso obliga a **convertir texto → outlines**.

- **Ingrediente nuevo:** `opentype.js` (JS puro, corre en browser o Node) carga
  un TTF/OTF y devuelve los **paths de cada glifo** en coordenadas reales. Es la
  librería estándar para esto y **no está en las deps hoy** — es la única
  dependencia nueva de todo el módulo.
- **Generar el EPS:** con los paths en mm, el EPS es texto plano (PostScript):
  header `%!PS-Adobe-3.0 EPSF-3.0`, `%%BoundingBox` con la medida exacta, y los
  paths con `moveto/lineto/curveto/fill`. Se escribe un generador chico (no hace
  falta una lib pesada). El SVG del preview y el EPS se derivan de los **mismos
  paths**, garantizando fidelidad.
- **Las dos versiones son el mismo arte con distinto fill:**
  - **Positivo** (polímero sólido, grabado láser): fondo claro, letras oscuras —
    convención según cómo quema el láser (calibrar con la máquina real).
  - **Negativo** (polímero líquido / fotopolímero por insolación UV): fondo
    negro, letras blancas. Es invertir el fill una vez que tenés el vectorial.
- **Precisión de producción (crítico, a calibrar con el equipo real):**
  medida exacta en mm, márgenes de seguridad del cliché, posible **espejado**
  (muchos láseres graban espejado), y la convención de color/relleno de cada
  máquina. Esto NO es programación, es calibración de taller.
- **Dónde correrlo:** client-side encaja con el patrón actual (se genera al
  confirmar y se descarga/adjunta). Para **adjuntarlo a la OT** hace falta
  resolver el almacenamiento de archivos (tab "Archivos" hoy vacío).
- **Esfuerzo:** moderado-alto (~2–3 sesiones): opentype.js + generador EPS +
  calibración. Autocontenido, no toca el motor.

---

## 3. El journey integrado (mini-configurador de sello)

Las tres son una sola experiencia dentro del sheet, activada por la herramienta
`editorSello` del producto:

1. Comercial elige el **modelo** → el sheet sabe líneas + medida + forma.
2. Aparecen **N inputs de texto** → carga lo que pide el cliente (#1).
3. **Preview en 5 tipografías** ajustadas a la caja → el cliente elige una (#2).
4. Al confirmar: el sistema **genera los 2 EPS** a la medida exacta y los
   adjunta a la OT / los manda a producción (#3).

El costo del ítem **no cambia** por esto: sale del cuerpo + la goma consumida por
área + los minutos de láser (tiempo manual). El configurador es la capa de
diseño, no de costeo.

---

## 4. Riesgos y decisiones a cerrar

1. **Licencias tipográficas** (bloqueante legal): las ~5 fuentes deben permitir
   uso comercial y **embebido en el archivo de salida**. Definir el set con
   licencia clara antes de codear #2/#3.
2. **Fidelidad preview = salida:** el preview (#2) y el EPS (#3) deben usar las
   mismas fuentes y el mismo fit-to-box para que no haya sorpresas.
3. **Calibración con el láser real:** espejado, márgenes, convención de color.
   Requiere una prueba física antes de dar por bueno el EPS.
4. **Persistencia de archivos:** para adjuntar el EPS a la OT hay que implementar
   el almacenamiento (tab "Archivos"). Alternativa de arranque: **descarga
   directa** del EPS en el momento (sin persistir), y persistencia después.
5. **Formas no rectangulares:** redondos/ovalados (texto en arco) → fase
   posterior. Arrancar con rectangulares.
6. **¿Client-side o server-side?** opentype.js corre en ambos. Client-side es más
   simple y sigue el patrón actual; server-side conviene si se quiere generar sin
   depender del navegador (ej. regenerar desde la OT).

---

## 5. Plan por fases sugerido

- **Fase A — Editor de texto por línea (#1).** Herramienta `editorSello`, bloque
  de N inputs según el modelo, guardado en jobContext. Bajo esfuerzo, valor
  inmediato (producción recibe el texto estructurado).
- **Fase B — Preview tipográfico (#2), solo rectangulares.** 5 fuentes con
  licencia + fit-to-box en SVG + selector. El comercial le muestra opciones al
  cliente en pantalla.
- **Fase C — Generación EPS (#3).** opentype.js (texto→paths) + generador EPS
  positivo/negativo a medida, con descarga directa. Calibrar con el láser.
- **Fase D — Persistencia y OT.** Adjuntar los EPS a la propuesta (resuelve el
  tab "Archivos") y pasarlos a producción. Redondos/ovalados como extensión.

Cada fase entrega valor sola y no bloquea al motor de costeo (que ya funciona
para sellos). El único ingrediente externo nuevo es `opentype.js` (Fase C) y las
fuentes con licencia (Fase B).
