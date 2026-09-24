# Biblioteca de productos de Grafo — Relevamiento de ImprentaOnline.net

**Consulta:** 22/09/2026. **Estado:** referencia comercial y propuesta para revisar con Lucas. No se instalaron productos ni se modificaron categorías.

## 1. Resultado y alcance

El sitio es una referencia útil para construir fichas de productos editables. Permite identificar qué se vende, cómo se presenta y qué opciones conviene relevar. La ruta productiva de Grafo se definirá con Lucas y se vinculará a los recursos de cada tenant.

Se revisaron **38 páginas de catálogo, familias y fichas**, además de la portada. El [índice general](https://www.imprentaonline.net/landings/productos/) contiene **291 apariciones en 12 secciones y 268 URLs distintas**. Hay productos repetidos, páginas de familias, variantes y agrupaciones de regalos: **268 no es la cantidad de plantillas ni el total de SKU del sitio**.

Se prepararon **131 candidatos comerciales**, organizados en 14 familias de revisión, con opciones por definir, encaje actual en Grafo, propuesta de clasificación y espacio para acordar la ruta. Algunos candidatos agrupan artículos de merchandising. Otros podrán compartir una receta o consolidarse después de la revisión.

La consulta de sólo lectura al catálogo local de Grafo encontró **11 categorías y 48 subcategorías activas**, coincidentes en códigos con el catálogo base del repositorio. Esto describe la clasificación comercial; no certifica la existencia de productos ni la capacidad del motor para fabricar cada candidato.

### Archivos de trabajo

- [Listado de candidatos por familia](plantillas-candidatas.md): lectura rápida con enlaces a las fuentes.
- [Referencias completas del índice público](referencias-imprentaonline.md): 268 destinos, conservando los nombres y secciones donde aparecen.
- [Candidatos estructurados](plantillas-candidatas.json): propuesta de Grafo, con rutas y notas todavía vacías.
- [Catálogo comercial actual de Grafo](categorias-grafo-relevadas.json): nombres, códigos y campos descriptivos, sin IDs de empresas.
- [Registro de fuentes y límites](fuentes-consultadas.json).
- Planilla editable entregada como `Grafo-biblioteca-productos.xlsx`, con hojas Productos, Categorías, Grafo actual y Referencias.

La planilla es para revisar contenido y rutas, no para importarla directamente a producción. Los JSON de propuesta permanecen en el repositorio como base versionable.

### Límites de cobertura

- Se relevó completo el índice general disponible. Se profundizó en las doce familias principales y en subfamilias relevantes para Grafo.
- Las páginas 2–5 de expositores y la página 2 de calendarios devolvieron error al intentar consultarlas. El índice general no incluye necesariamente todos los artículos de esas páginas.
- No se inspeccionó cada modelo individual de merchandising ni cada combinación dinámica de los configuradores. Algunos resultados consultados proceden de caché del buscador; no se verificó disponibilidad de compra.
- Precios, cantidades mínimas, plazos y procesos internos de esa empresa no se trasladan como defaults de Grafo. Las opciones propuestas en las fichas requieren validación.
- No se copiaron imágenes, diseños descargables ni descripciones promocionales para reutilizarlas como contenido de Grafo. Se conservaron nombres de referencia, clasificación y enlaces.

## 2. Cómo está organizado el catálogo de referencia

Los conteos siguientes son apariciones en el índice, no productos únicos. Un enlace puede estar en varias secciones. [Fuente: catálogo general](https://www.imprentaonline.net/landings/productos/).

| Sección del sitio | Apariciones | Qué aporta al relevamiento |
| --- | ---: | --- |
| Tarjetas | 13 | Presentación, invitaciones, PVC, credenciales y accesorios. |
| Flyers y folletos | 15 | Piezas simples, plegadas y con forma; complementos de exhibición. |
| Papelería de empresa | 10 | Sobres, hojas, carpetas, formularios, blocks y sellos. |
| Revistas, catálogos y libros | 8 | Publicaciones y distintos tipos de encuadernación. |
| Carteles y señalización | 12 | Papel, adhesivos, rígidos, luminosos y soportes. |
| Pegatinas, etiquetas y vinilos | 12 | Diferentes presentaciones y usos de adhesivos, además de artículos relacionados. |
| Gran formato | 5 | Acceso a familias de vinilos, lonas, telas y placas. |
| Expositores y displays | 16 | Estructuras, gráficas textiles y exhibidores de cartón. |
| Eventos | 25 | Acceso, identificación, ambientación y piezas para gastronomía. |
| Packaging y embalaje | 20 | Cajas, bolsas, etiquetas, cintas y papeles. |
| Calendarios y agendas | 20 | Variantes de armado, uso y presentación anual. |
| Regalos publicitarios | 135 | Familias de objetos, prendas, bolsos, tecnología y accesorios. |
| **Total de apariciones** | **291** | **268 destinos distintos.** |

El menú principal y el índice no tienen exactamente el mismo detalle. Las páginas interiores también agregan productos que no tienen tarjeta propia en ese índice, como variantes de vinilo, placas, carpetas y las carpas. Por eso los candidatos de Grafo se construyeron con ambas fuentes.

## 3. Hallazgos que cambian cómo debemos diseñar la biblioteca

### Un producto puede tener muchas opciones

La familia de [tarjetas](https://www.imprentaonline.net/tarjetas-de-visita) presenta formas, papeles y acabados. Para Grafo, tamaño, gramaje o laminado pueden ser opciones de una misma plantilla; plegado, soporte plástico o funcionalidades especiales pueden justificar otra base o alternativa. La decisión depende de cómo cambie la configuración, no del número de páginas comerciales del competidor.

En [etiquetas en rollo](https://www.imprentaonline.net/etiquetas-rollo) se distingue forma, aplicación, material y uso. Conviene guardar esas dimensiones por separado. “Para botellas” no define por sí solo una receta; “en bobina para aplicación automática” sí agrega requisitos sobre presentación y salida.

### La presentación de entrega es parte del producto

Una etiqueta suelta, una plancha y un rollo no deberían confundirse aunque compartan impresión. De igual forma, un block se vende por blocks y contiene hojas, mientras un talonario contiene juegos y cada juego puede tener copias. La ficha debe dejar explícitas estas cantidades. [Adhesivos](https://www.imprentaonline.net/pegatinas-personalizadas), [talonarios](https://www.imprentaonline.net/talonarios-copiativos).

### Muchos artículos son conjuntos de componentes

Las [banderas](https://www.imprentaonline.net/banderas) se ofrecen completas y también como tela, bases o mástiles. En [expositores](https://www.imprentaonline.net/expositores-y-displays) aparece la misma necesidad de distinguir estructura y gráfica. En Grafo debemos acordar si cada ficha representa el conjunto, el repuesto o ambas opciones, y qué partes compra o fabrica el tenant.

### El material puede cambiar la ruta, aunque el producto se parezca

Los [soportes rígidos](https://www.imprentaonline.net/soportes-rigidos) incluyen foamboard, PVC, acrílico, aluminio compuesto y otros soportes. Es útil ofrecer fichas reconocibles, pero no afirmar que todas comparten impresión, corte o consumos. Lucas debe definir los procesos y alternativas adecuados.

### Editorial necesita describir piezas separadas

Las familias de [libros](https://www.imprentaonline.net/libros), [revistas](https://www.imprentaonline.net/revistas) y [manuales](https://www.imprentaonline.net/manuales) distinguen cubiertas, interiores y encuadernación. El relevamiento comercial permite preparar esos campos, mientras que su cálculo y unión requieren validación productiva propia.

### Un sector de venta no es necesariamente una categoría principal

[Eventos](https://www.imprentaonline.net/eventos) reúne productos fabricados de formas muy diferentes. La propuesta para Grafo es una colección o etiqueta que permita encontrar entradas, credenciales, banderas y vasos sin duplicarlos. Lo mismo vale para gastronomía, inmobiliarias y regalos empresariales. El mecanismo de colecciones es una propuesta, no una capacidad comprobada del catálogo actual.

### Las fichas externas no son especificaciones de fabricación

La página de [talonarios](https://www.imprentaonline.net/talonarios-copiativos) menciona 60 g en una descripción inicial y 80 g en otra sección. Esta discrepancia muestra por qué debemos validar parámetros. No resuelve cuál es el material efectivamente ofertado en una combinación del configurador.

Tampoco se puede deducir una ruta real sólo del nombre de un acabado. Una plantilla marcará “ruta pendiente” hasta que acordemos sus pasos y reglas; no generará una cotización con supuestos ocultos.

## 4. Comparación con la clasificación actual de Grafo

La base de Grafo ya cubre buena parte de las grandes familias. **Recomiendo ampliar primero subcategorías concretas y mejorar sus campos**, conservando la identidad de las categorías existentes.

### Ocho ampliaciones recomendadas para revisar

| Subcategoría propuesta | Categoría existente donde encajaría | Situación actual |
| --- | --- | --- |
| Afiches y carteles en papel | Impresión comercial en hoja | Sólo encaje amplio en Volantes y folletos; conviene distinguirlos de carteles rígidos. |
| Libros y catálogos encuadernados | Editorial, formularios y encuadernación | Revistas y cuadernillos resulta demasiado amplio para ciertos libros. |
| Cuadernos y agendas | Editorial, formularios y encuadernación | Quedan repartidos entre Blocks y formularios y Anillados. |
| Calendarios | Editorial, formularios y encuadernación | No existe una subcategoría explícita; los modelos quedan dispersos. |
| Telas y banderas impresas | Gran formato flexible | Lonas/banners y Merchandising ofrecen un encaje amplio, no específico. |
| Etiquetas en bobina | Packaging, troquelado y POP | Etiquetas de packaging existe, pero no distingue la presentación productiva. |
| Bolsas y envases flexibles | Packaging, troquelado y POP | Cajas y packaging no describe bien bolsas o doypack. |
| Papeles y cintas de embalaje | Packaging, troquelado y POP | Sin subcategoría específica para envoltorios y cintas. |

Fuentes de demanda comercial: [carteles](https://www.imprentaonline.net/carteles), [encuadernados](https://www.imprentaonline.net/encuadernados), [calendarios](https://www.imprentaonline.net/calendarios), [telas](https://www.imprentaonline.net/telas-personalizadas), [embalajes](https://www.imprentaonline.net/embalajes). Existencia/ausencia en Grafo: [snapshot local](categorias-grafo-relevadas.json) y [catálogo base](../../../apps/api/prisma/seed-modulos/catalogo-comercial.js).

### Otros ajustes para evaluar según el catálogo que decidamos ofrecer

- **Credenciales y tarjetas plásticas:** separarlas si incorporamos esas plantillas; revisar si el nombre “Impresión comercial en hoja” sigue describiendo bien su categoría.
- **Carpetas y archivadores:** hoy Papelería comercial es válida. Separar ayuda si el catálogo crece, no es un bloqueo.
- **Periódicos:** subcategoría específica sólo si se incorpora ese circuito editorial.
- **Magnéticos impresos:** distinguir el soporte magnético del vinilo adhesivo, aunque al inicio puedan agruparse comercialmente con otros objetos.
- **Parches textiles:** un parche bordado no pertenece a DTF por defecto. Revisar su ubicación y separar el producto del servicio de bordado.
- **Carpas y estructuras promocionales:** pueden empezar dentro de displays; evaluar una subcategoría cuando se definan los conjuntos y repuestos.

Estas propuestas no implican migrar automáticamente productos ya clasificados ni renombrar códigos en uso.

### También faltan campos específicos, no sólo nombres

En el catálogo base, las subcategorías editoriales comparten un esquema descriptivo que incluye “Hojas por talonario/block” y “Numeración”. Para un libro interesan también interior, cubierta y encuadernación. Las etiquetas en bobina necesitan describir presentación, núcleo y salida; las carpas, estructura y partes impresas.

Esto es un hallazgo sobre los **campos descriptivos comerciales**. No demuestra que el motor carezca de esas funciones. El soporte técnico se debe revisar al definir cada ruta.

Mantendría igualmente las familias que Grafo tiene y este sitio no representa del mismo modo: servicios de diseño, terminaciones vendidas por separado, montaje, instalación, logística y corte/grabado como servicio. La web de una imprenta no define por completo el alcance de un MIS para muchos tipos de empresa.

## 5. Cómo convertir el listado en valor antes de tener todas las rutas

### Nivel 1: ficha comercial preparada

Nombre propio de Grafo, descripción original, categoría, alias de búsqueda, unidad comercial, medidas y opciones sugeridas. El tenant la instala como borrador editable y ahorra la carga repetitiva.

Sin una ruta o modalidad de cálculo válida, esa ficha no se publica automáticamente como cotizable. La preparación comercial ya tiene valor por sí misma.

### Nivel 2: ruta acordada

Con Lucas definimos operaciones, alternativas, dependencias, cómo se cuentan cantidades y qué se compra o fabrica. Una misma base de ruta puede servir a varios productos comerciales.

### Nivel 3: producto adaptado al tenant

Se vincula a materiales, máquinas, perfiles, centros y costos propios. Se confirman restricciones y condiciones comerciales. El tenant puede editarlo; la plantilla conserva su procedencia y no sobrescribe sus ajustes.

Este orden amplía la propuesta técnica inicial de [biblioteca de productos y rutas](../../biblioteca-productos-rutas-diseno.md): ya no es necesario completar todas las recetas antes de que la biblioteca ayude a cargar el catálogo.

## 6. Orden de revisión propuesto con Lucas

Los 23 candidatos marcados **Primero** constituyen un lote comercial propuesto, no una orden de implementar 23 rutas simultáneamente ni un ranking de ventas comprobado:

1. **Hoja simple:** tarjetas, postales/invitaciones, flyers, señaladores, membretes y afiches.
2. **Plegado y armado sencillo:** dípticos, trípticos, sobres y carpetas.
3. **Blocks y publicaciones:** blocks, talonarios y cuadernillos abrochados.
4. **Adhesivos:** stickers individuales y en plancha, vinilo impreso y de corte.
5. **Gran formato:** lona, roll-up, PVC, acrílico y foamboard.
6. **Sellos automáticos.**

Para cada producto resolveremos:

- Qué vende el comercial y qué unidad/cantidad ingresa.
- Opciones que cambian la ruta frente a opciones que sólo cambian un parámetro.
- Pasos obligatorios, opcionales y dependencias.
- Entrada y salida de cada paso: piezas, pliegos, juegos, metros, área o tiempo.
- Material consumido y material heredado de otro paso para no duplicar costos.
- Operaciones propias, compras y posibles tercerizaciones.
- Qué regla puede compartir toda la biblioteca y qué debe confirmar cada tenant.
- Un ejemplo concreto de trabajo para comprobar el resultado.

**Primera conversación sugerida:** tarjetas de presentación, luego flyers. El propósito es acordar una ficha y una receta modelo que nos permitan avanzar por familias, manteniendo editable la comercialización de cada empresa.

## 7. Comprobaciones realizadas

- Extracción de los 291 enlaces comerciales del índice y deduplicación por URL a 268 referencias.
- Conservación de todas las secciones y alias cuando el mismo destino aparece repetido.
- 131 candidatos con identificador único y subcategoría actual existente en el catálogo leído.
- Fuentes de cada candidato limitadas a URLs observadas en el índice o en páginas consultadas.
- Datos particulares de rutas y notas de Lucas vacíos; propuestas identificadas como tales.
- Comparación con categorías en código y consulta local de sólo lectura; sin cambios a la base.
- Planilla con filtros, encabezados fijos, campos editables y validación de prioridades/estado. Revisión visual y conteos del archivo exportado.

No se ejecutaron pruebas del motor: este entregable releva contenido y clasificación, no implementa nuevas recetas.
