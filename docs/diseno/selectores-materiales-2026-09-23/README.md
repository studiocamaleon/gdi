# Selectores de materiales y parámetros — Grafo

**Fecha:** 23/09/2026. **Estado:** relevamiento completo; implementados los selectores de espesor de rígidos y acabado de laminado film en el cotizador. Sin migraciones ni cambios en los catálogos de tenants. Se pausa la biblioteca de productos para revisar primero esta experiencia.

## 1. Decisión propuesta

Crear una presentación común de opciones basada en las **plantillas y atributos del sistema**, alimentada por los **materiales candidatos y variantes de cada producto/tenant**. Una empresa con PVC de 2 y 6 mm ve esas medidas; otra con 3, 5 y 10 mm ve las suyas con el mismo control. No se crean listas universales de valores vendibles.

La base es un pequeño conjunto de controles reutilizables. Ya están implementados **espesor de rígidos** y **acabado de laminado film**. El siguiente caso es **tipo de papel + gramaje**. El orden permite resolver primero selección simple y después dependencias entre atributos.

## 2. Alcance comprobado

- **45 plantillas de materiales**, correspondientes a 12 familias y 37 subfamilias del registro de plantillas.
- **199 declaraciones de campos**, con **86 claves distintas**. El mismo nombre de campo no garantiza el mismo significado o unidad.
- **34 familias de pasos**, con 45 declaraciones de parámetros de paso. No son todas las opciones del cotizador: color, caras, medidas y otras opciones también tienen configuración propia.
- Inventario completo en [inventario.md](inventario.md) y copia estructurada en [inventario.json](inventario.json).
- Se revisó el registro en código, sus valores iniciales, ejemplos de presets y el selector compartido del cotizador. No se censaron los valores instalados de todas las empresas ni atributos particulares fuera de esos registros.

Fuentes:

- [Plantillas de materiales](../../../src/lib/materia-prima-templates.ts).
- [Familias de pasos](../../../apps/api/src/productos-servicios/pasos/familias.ts).
- [Selector actual y adaptación de candidatos](../../../src/components/comercial/agregar-producto-sheet.tsx).
- [Formato de variantes](../../../src/lib/materias-primas-variantes-display.ts) y [adaptador de materiales](../../../src/lib/materiales-slot-display.ts).
- [Presets de materiales](../../../apps/api/prisma/seed-modulos/material-presets.js).

## 3. Situación encontrada en el relevamiento

1. `getVarianteOptionChips` toma las dimensiones de cada plantilla y devuelve clave, etiqueta y texto con unidad.
2. `getSlotMaterialVariantDisplay` conserva etiqueta y valor, pero descarta la clave del atributo.
3. `mapSlotMaterial` conserva IDs y atributos, pero su modelo de candidato no conserva `templateId`. Calcula campos específicos de espesor, ancho y color con búsquedas de aliases.
4. `describeCandidateVariants` separa valores variables de compartidos comparando las **etiquetas**. El título termina concatenando varios valores; las especificaciones compartidas se repiten en cada fila.
5. `MaterialSelectorCompacto` dibuja filas de radio dentro de una sección desplegable. Los controles de color, caras y tamaños usan otros renderizadores locales en el mismo archivo.

Esto explica las capturas: se mezclan **decisiones comerciales** y **datos de la presentación comprada**. Cambiar solamente una fila por una card conservaría gran parte del ruido.

### Hallazgos a resolver junto a cada incorporación

- **Espesores y unidades:** rígidos declaran mm; pouch usa una etiqueta de micrones sin `unit`; film declara `espesor` en mm con valor inicial 75, mientras sus presets también usan `micrones`. El helper actual busca `espesorMicrones` pero no `micrones`. No convertir ni migrar valores por magnitud: confirmar contrato y datos por plantilla antes de exponer ese eje.
- **Claves con significados diferentes:** `acabado` en vinilo esmerilado representa Blanco/Gris; en laminado, Mate/Brillante. `capacidad` de un objeto no equivale a capacidad de una fuente LED. La semántica requiere plantilla y atributo, no sólo el nombre de la clave.
- **Datos incompletos:** hay cinco dimensiones sin metadatos de campo en dos plantillas editoriales; otras incluyen defaults que no están declarados como campos. Figuran en el inventario. No exponer automáticamente esos defaults.
- **Opciones visualmente idénticas:** dos materiales rígidos pueden agruparse bajo el mismo color y mostrar el mismo espesor. Las claves de agrupación deben conservar material/plantilla; las etiquetas no son identidad.
- **Información truncada:** el formateador del slot limita a seis dimensiones; papel tiene siete. Una nueva composición debe resolver el conjunto completo, sin deducir equivalencia por el texto visible.
- **Estado y selección:** el selector puede mostrar la primera opción como resumen cuando el ID seleccionado no está entre las opciones. El nuevo control distinguirá explícitamente selección válida, pendiente y desactualizada.
- **Predeterminado y recomendado:** hoy una variante predeterminada del candidato se etiqueta “Recomendado”. No implica una recomendación por calidad, costo o compatibilidad. Propuesta: “Predeterminado”, con origen claro y sin varios recomendados aparentes del grupo completo.
- **Teclado:** los botones actuales declaran `role="radio"`, pero no implementan en ese componente la navegación de un grupo de radio. El reemplazo debe usar controles nativos o primitivas accesibles comprobadas.

Estos hallazgos no prueban un fallo de costeo en las capturas. Son requisitos para que el rediseño no cambie o confunda la elección que recibe el motor.

## 4. Familias de selectores propuestas

Las referencias enumeran atributos existentes; su aparición en ventas depende del producto, la modalidad del slot y sus opciones habilitadas.

| Selector | Datos existentes / ejemplos | UI propuesta | Prioridad |
| --- | --- | --- | --- |
| Espesor | `espesor`, aliases por plantilla; PVC, acrílico, MDF, chapa, goma, imán | Mini-card numérica con unidad y perfil esquemático de placa | 1: rígidos en mm |
| Acabado superficial | `acabado`; film, papel, rollos; `variante` de pintura | Cards de Mate/Brillante/etc., con muestra sutil y texto | 2: laminado |
| Tipo de papel o sustrato | Candidato material + `material`; opalina, ilustración, obra | Cards con nombre del material y una característica relevante | 3 |
| Gramaje | `gramaje` en papel, transfer y textil | Mini-cards numéricas; valores de las variantes reales | 3 |
| Color del material | `color`, `colorBase`, `colorCarcasa` | Muestra con nombre; transparente con patrón; texto para colores sin muestra conocida | 4 |
| Modo de impresión | Configuración existente de modo de color | Reutilizar cards actuales con el lenguaje visual común | 4 |
| Caras impresas o tratadas | Configuración del paso/producto | Dos opciones compactas; distinguir imprimir y laminar | 4 |
| Tamaño comercial de la pieza | Medidas predefinidas del producto; personalizado cuando se admite | Cards de formato + ancho × alto; inputs para medida libre | 4 |
| Formato del material | `formatoComercial`, `ancho`, `alto`, `anchoMm`, `altoMm`, `presentacion` | Detalle o selector de formatos cuando hay que distinguir variantes | 4 |
| Ancho de rollo | `ancho`, aliases con unidad declarada | Mini-cards de ancho si es decisión comercial; resultado informativo si lo decide el motor | 4 |
| Terminaciones opcionales | Activación OPCIONAL/CONDICIONAL del paso | Checkbox/tarjeta activable; parámetros dentro sólo al activarla | 4 |
| Tipo de plegado | `tipoPliegue`: simple, ventana, acordeón, cruzado | Cards con esquema del plegado | 5 |
| Tipo de corte | `tipoCorte`: medio, profundo, completo | Cards con sección del material/soporte; significado validado por proceso | 5 |
| Encuadernación | `tipoAnillo`, `diametro`, `capacidadMaxHojas` | Cards de tipo; diámetro/capacidad como elección o resultado según la configuración | 5 |
| Tapas, carpetas y componentes | `tipoComponente`, `material`, dimensiones | Cards de componente/tapa y detalles secundarios | 5 |
| Ojales y perforaciones | `modoDistribucion`, `lados`, `separacionMaxMm`, `diametroInterno` | Esquema por lados con selección múltiple + distancia numérica | 5 |
| Sellos | `forma`, `modelo`, `anchoPolimero`, `altoPolimero`, `lineasTexto`, `colorTinta` | Cards de modelo/huella; muestras de tinta; buscador si hay muchos | 6 |
| Prendas | `tipoPrenda`, `material`, `talle`, `color`, `marca` | Cards de tipo, botones compactos de talle y muestras de color | 6 |
| Objetos promocionales | `tipoObjeto`, `modelo`, `material`, `capacidad`, `color` | Cards de objeto; chips de capacidad; no inventar fotos del modelo | 6 |
| Estructuras y montaje | `tipoPortabanner`, `seccion`, `tipoBastidor`, `montajeLona` | Cards de estructura/sección y medidas; distinguir repuesto de conjunto | 6 |
| Adhesivo, fijación e imanes | `adhesivoTipo`, `adhesivo`, `grado`, `tipoFijacion`, `calibre`, `tipoCabeza`, `tipoPunta` | Opciones compactas si el comercial decide; detalles técnicos cuando no | 6 |
| Luz y electrónica | `colorLuz`, `temperaturaColor`, `tension`, `potencia`, `ip`, `proteccion`, `tipoControlador` | Muestras de luz + texto; datos eléctricos en detalle con compatibilidad validada | 6 |
| Embalaje | `tipoEmbalaje`, `capacidadUnidades`, `material`, dimensiones | Cards por tipo y capacidad cuando sea oferta comercial | 6 |
| Magnitudes libres | Cantidad, horas, separación, relleno, gramos, densidad | Input numérico con unidad y límites; no inventar opciones discretas | Transversal |
| Catálogos largos/desconocidos | Marca/modelo/referencia, claves no reconocidas | Buscador y filas compactas o cards filtradas, con nombre y discriminantes completos | Transversal |

### Qué queda normalmente fuera de las preguntas comerciales

Volumen de envase, unidades por caja/pack, largo de la bobina, vida útil de repuestos, rendimiento ISO, máquinas compatibles y márgenes de proceso suelen pertenecer a inventario/configuración. Se muestran como detalle cuando ayudan a distinguir una variante. Si el producto vende explícitamente esa presentación, pueden ser una elección comercial.

La taxonomía declara familias que no tienen una plantilla específica en este registro, como ciertas de 3D, adhesivos y pintura. No declarar resuelta su UI sólo por existir el enum: usar presentación genérica hasta revisar sus datos reales.

## 5. Tres recorridos iniciales

### Rígido

`Material (si hay varios) → Color (si varía) → Espesor → Variante resuelta`

PVC blanco con 3/5/10 mm muestra tres mini-cards, con el número como protagonista y un dibujo esquemático secundario. Si hay una sola opción de material/color, mostrarla como dato, sin un selector de una opción. Acrílico, MDF u otro nombre particular del tenant no requieren código nuevo si usan la misma plantilla compatible.

### Papel

`Papel → Acabado (si no está ya fijado) → Gramaje → Variante resuelta`

Las opciones de gramaje dependen del papel elegido. Si ilustración sólo tiene 150/250/300 g/m², no se fabrica una variante de 210 g/m² porque opalina sí la tiene. El formato de compra se muestra en “Detalles”; si quedan dos variantes distintas, debe aparecer la elección que las distingue antes de cotizar.

### Laminado

`Tipo de laminado (si hay alternativas) → Acabado → Variante resuelta`

Mate y Brillante son cards. Los 330 mm × 150 m del ejemplo se informan una vez. Si el micraje, adhesivo o ancho distingue opciones con distinto comportamiento/costo, se resuelve con un selector adicional o una regla automática ya declarada y compatible. “Sin laminado” desactiva el paso opcional: no es una variante gratuita del film.

## 6. Reglas de composición Grafo

- Superficies neutras, bordes finos, esquinas moderadas, selección naranja suave y marca de selección visible. Reutilizar tokens de Grafo.
- Dos densidades del mismo componente: cards para el configurador y control compacto para una tabla como Centro de copiado. Mantener semántica y resolución idénticas.
- Mini-cards con número/unidad legibles. La ilustración no debe hacerlas altas ni simular una escala física exacta o prometer prestaciones como “más resistente”.
- Una opción: dato resumido. De 2 a 7: opciones visibles. Para más opciones, primera propuesta: buscar/filtrar y conservar visible la selección; ajustar el umbral tras verificar densidad y nombres reales.
- No depender de fotografías cargadas por cada tenant. Ilustraciones genéricas reutilizables; color con texto y muestras sólo cuando existe una correspondencia conocida. “Color” no equivale a un color específico.
- Etiquetas originales editables, sin deducir tipo de producto por el nombre. Aliases visuales explícitos (por ejemplo Brillo/Brillante) no deben fusionar IDs de materiales o cambiar datos guardados.
- Teclado, lector de pantalla y foco visible; objetivos táctiles de aproximadamente 44 px; reflujo sin scroll horizontal. Grupos de selección única y múltiple con semántica correspondiente.
- La opción elegida y los errores persisten al plegar secciones, al editar una cotización y después de recalcular.

## 7. Contrato técnico propuesto

Agregar metadatos de presentación junto a la definición de plantilla o un registro central asociado a ella: eje comercial, etiqueta, orden, unidad, representación visual y rol (elección, detalle, dato técnico). La clave es **plantilla + atributo**, con herencia explícita por tipo semántico cuando corresponde.

El adaptador conserva `templateId`, identidad de material/variante, claves y valores tipados completos, unidades y estados. El renderer no interpreta números desde las etiquetas ni nombres del producto.

Una faceta visual puede agrupar varias variantes. El grupo no se convierte en una variante nueva. El resolver trabaja sobre las combinaciones existentes:

1. Opciones desde candidatos configurados, activación del paso y alcance del tenant.
2. Aplicar facetas elegidas y restricciones conocidas.
3. Una coincidencia: devolver el `variantId` existente.
4. Varias coincidencias: pedir el discriminante restante o usar una política automática existente y explícita. Si no la hay, selección pendiente.
5. Ninguna: informar qué elección debe revisarse. Mantener elecciones anteriores compatibles y no sustituir silenciosamente material, papel o precio.
6. Validar de nuevo en el backend al cotizar. Una card no acredita compatibilidad sólo por compartir espesor.

Respetar modos `COMERCIAL_ELIGE`, fijo, heredado y automático. No transformar todos los insumos de una ruta en preguntas. No vincular de nuevo consumibles de máquina desde esta UI. Mantener `configPasoId + slotCodigo` como ámbito: tapa/interior y pasos repetidos no comparten estado por accidente.

### Estados que deben seguir siendo diferentes

- Elegido / predeterminado / pendiente / selección anterior no disponible.
- Sin costo configurado / no compatible / sin datos suficientes.
- Sin stock físico: no equivale a no poder cotizar. Conservar el circuito de abastecimiento y fecha estimada existente.
- Paso opcional inactivo: no confundir con variante faltante.

## 8. Implementación progresiva y verificación

1. **Base común + espesor de rígidos:** incluir material/color cuando haga falta y el discriminante de formato si quedan duplicados. Fallback actual mejorado para plantillas no cubiertas.
2. **Acabado de laminado:** revisar metadatos de unidades y alias sin una migración automática de valores. Mismo componente de elección, otra representación.
3. **Papel + gramaje:** resolver combinaciones existentes, formatos múltiples y conservación de selección al editar.
4. **Extensión gradual:** color de material, tamaño, anillado y tipos de terminación; después dominios especializados. Centro de copiado usa la variante compacta.

Pruebas necesarias al implementar:

- Dos tenants con nombres/IDs/espesores diferentes producen los mismos controles y conservan su propio catálogo.
- Dos materiales de igual color/espesor o dos pliegos del mismo papel no se fusionan.
- Claves con mm/micrones y datos faltantes nunca se convierten por heurística.
- Cambio de papel no deja un gramaje inválido, ni el precio anterior vigente con una selección pendiente.
- Cambiar presentación conserva ID, consumo, nesting y costos esperados; comparación con cotizaciones antes del cambio.
- IDs obsoletos al editar, costos ausentes, cero opciones, una opción, muchas opciones y pasos opcionales/heredados.
- Teclado, móvil y lectura de estados. Una selección no cambia el alto completo de la pantalla innecesariamente.

La muestra interactiva ilustra los tres casos de las capturas con opciones de ejemplo. No está conectada al motor ni representa validación de compatibilidad o costo. El inventario y esta propuesta quedan como base de la primera implementación.

## 9. Primera etapa implementada — 23/09/2026

- El adaptador del cotizador conserva `templateId` y `nombreVariante`. Los slots comerciales donde todos los candidatos usan `sustrato_rigido_v1` (o su alias explícito `rigido_placa`) muestran el nuevo selector. Los demás conservan su presentación actual.
- La primera versión presenta **una card por variante real**, agrupada por ID de material y color. No hay selecciones parciales ni un resolver nuevo: pulsar una card continúa enviando su `variantId` a `seleccionMaterial[configPasoId_slotCodigo]`.
- Se muestra espesor en mm con un esquema de placa ilustrativo. El formato común aparece una vez; formatos distintos se muestran en cada card. Si espesor y formato se repiten, se muestra la referencia para distinguir variantes.
- Valores provenientes del catálogo, orden numérico, indicador de predeterminado, advertencia de precio faltante, selección anterior no disponible y búsqueda para más de siete opciones. La selección actual permanece visible al buscar. Una única opción ya resuelta se presenta como resumen.
- Las unidades se interpretan por claves conocidas de la plantilla y aliases explícitos; no por magnitud numérica ni por el nombre del material. Los datos faltantes nunca se presentan como 0 mm.
- Componente común de cards con HeroUI, CSS Modules y tokens de Grafo. Flechas para mover el foco y Espacio para elegir; selección única controlada. No se modificaron fórmulas, costos, stock ni reglas de producción.

Implementación:

- [Modelo de opciones de rígidos](../../../src/lib/selector-rigidos.ts).
- [Control visual reutilizable](../../../src/components/design-system/choice-cards.tsx).
- [Selector de rígidos](../../../src/components/comercial/material-selector-rigido.tsx).
- [Integración en el cotizador](../../../src/components/comercial/agregar-producto-sheet.tsx).

Verificación: pruebas de identidad de variante entre catálogos, formato, unidades, defaults obsoletos, búsqueda, teclado y selección controlada; TypeScript, ESLint y guardia CSS. Revisión visual en Chrome con la sesión del usuario sobre Acrílico y PVC Espumado; elección de espesor y recálculo de una pieza de acrílico de 30 × 40 cm, sin emitir la OT. Se corrigió una regla heredada que reducía las ilustraciones dentro del cotizador.

## 10. Segunda etapa implementada — acabado de laminado film

- Slots comerciales de `laminado_film_v1` y su alias explícito `film_laminado` usan cards de acabado. Se conserva el nombre registrado; Brillo/Brillante y otras variantes reconocidas comparten sólo la ilustración, nunca su ID.
- Mate, Brillante, Soft touch y Satinado tienen esquemas visuales. Cualquier acabado personalizado conserva su texto y una ilustración neutra. La presentación no promete resistencia ni otras propiedades físicas.
- Ancho, largo y micraje comunes se informan una sola vez por material. Si difieren, aparecen en las cards. También se distinguen adhesivo, color y referencias cuando hace falta. Dos variantes iguales visualmente siguen siendo dos opciones identificables.
- Las medidas del rollo respetan el contrato mm/m y sus aliases explícitos. `micrones`/`espesorMicrones` y claves explícitas en mm se presentan en µm. Si los valores se contradicen, se informa el conflicto. El campo histórico `espesor` de film tiene un contrato inconsistente entre plantilla y presets: se conserva como valor registrado con unidad pendiente de confirmar, sin migración ni reinterpretación por magnitud. Esta deuda queda localizada en los datos/plantilla de film, no se traslada al cálculo.
- Activar o quitar el laminado sigue siendo responsabilidad del paso opcional existente. El selector no agrega una variante ficticia «Sin laminado». Pouch conserva su presentación anterior, porque su elección es formato/micraje y su plantilla no declara el acabado como eje.
- Rígidos y laminados comparten [MaterialSelectorVisual](../../../src/components/comercial/material-selector-visual.tsx), estilos, búsqueda, estados, control de selección y [ChoiceCards](../../../src/components/design-system/choice-cards.tsx). Los adaptadores de cada familia conservan su semántica y las unidades correspondientes.

Implementación específica: [opciones de laminado](../../../src/lib/selector-laminados.ts) y [presentación del acabado](../../../src/components/comercial/material-selector-laminado.tsx).

Verificación: **25 pruebas** de ambos selectores; TypeScript, ESLint, `git diff --check` y guardia CSS. En Chrome, con la sesión del usuario, se activó Laminado Polipropileno en Tarjetas de visita y se cambió de Brillante a Mate: selección visible y recálculo funcionando con el material real (330 mm × 150 m, 32 µm). Revisión visual de cards, ilustraciones y detalle compartido. No se emitió ni guardó una OT durante la prueba.

## 11. Tercera etapa implementada — papel y gramaje

- Los slots comerciales de `sustrato_hoja_v1` y su alias `papel_hoja` presentan **Tipo de papel → Gramaje y formato**, usando las mismas cards de Grafo. Los candidatos y variantes vienen de la ruta del producto; no se agregan combinaciones ficticias.
- Cada card final identifica una variante real. Un mismo gramaje en A4 y en 22 × 34 cm sigue siendo dos opciones. Acabado, color y tipo de material aparecen en el detalle común si coinciden, o en cada variante cuando difieren. Referencias distinguen opciones duplicadas. Las medidas canónicas de papel se leen en centímetros, respetando su plantilla.
- Al cambiar de papel se usa únicamente su predeterminado explícito permitido, o la variante única. Si hay varias opciones sin predeterminado, se pide elegir gramaje/formato. El vacío explícito no recupera el papel anterior: se cancela el cálculo en curso, se oculta el precio anterior y se bloquea cotizar/agregar hasta completar la elección.
- El bloqueo se aplica a slots comerciales activos, respetando condiciones, opcionales, rutas y separación de tapa/interior. Papeles fijos o automáticos conservan su resolución existente. Al editar se restaura la variante guardada; un ID obsoleto pide revisión.
- Búsqueda de papel para catálogos largos, búsqueda de gramaje/acabado/formato dentro del papel, información de precio faltante, navegación con teclado y opciones únicas resumidas. No se impide cotizar por falta de stock.
- Se corrigió la alineación vertical de las cards compartidas cuando sus textos tienen distinto largo.

Implementación: [modelo de papeles](../../../src/lib/selector-papeles.ts), [selector de papel](../../../src/components/comercial/material-selector-papel.tsx) e [integración en cotizador](../../../src/components/comercial/agregar-producto-sheet.tsx).

Verificación: **46 pruebas** entre los tres selectores, el bloqueo de papel y las pruebas existentes de cantidades del cotizador; TypeScript, ESLint, guardia CSS y revisión del diff. Revisión visual y funcional en Chrome con la sesión del usuario: Folletos / flyers (Papel obra A4 y 22 × 34 cm) y Postales / Tarjetones (Opalina 180/210 g/m² e Ilustración 150/250/300 g/m²), con selección de variantes y recálculo. No se guardó ni emitió una orden durante la prueba. El estado pendiente sin default se verificó en pruebas automatizadas; los candidatos de esos productos reales tienen predeterminados.

Pendiente de próximas etapas: pouch y selectores del resto del inventario; variante compacta del Centro de copiado. El acabado del papel se distingue actualmente en cada variante; una faceta independiente para acabado sigue pendiente si la cantidad de opciones la justifica.

**Verificación de la propuesta:** comprobados los tres recorridos, cambio de papel con gramaje pendiente, navegación por flechas en espesor, ausencia de desbordes a 320/736/1024 px, modos claro/oscuro y ausencia de errores JavaScript. Revisadas capturas del resultado. Validada la integridad de conteos e identificadores del inventario y los enlaces locales. No se ejecutaron pruebas del motor porque no se modificó código de producción.

## 12. Cuarta etapa implementada — color

- Registro explícito de **18 plantillas** y el atributo que representa su color. Se distinguen color de material/papel/vinilo/prenda/objeto, carcasa, tinta y luz. En esmerilado el color se guarda en `acabado`; esa excepción se declara sólo para esa plantilla, sin reinterpretar acabados de laminado.
- Muestras reutilizables para colores básicos, HEX válido, transparente/cristal, metalizados y categorías multicolor. El nombre original se conserva siempre. Colores personalizados, referencias Pantone/RAL y temperaturas de luz sin equivalencia registrada usan una muestra neutral, sin convertirlos a un tono inventado. Las muestras son orientativas.
- Selección **Color → variante existente**: sólo se ofrecen espesores, talles, anchos, acabados y formatos de ese grupo de material/color. Un grupo con una sola variante o con predeterminado permitido se resuelve al elegirlo. En cualquier otro caso pide la variante; la selección parcial cancela la cotización anterior y bloquea el guardado.
- El registro se aplica a slots `COMERCIAL_ELIGE`, también en la entrada por metros lineales. Materiales automáticos, fijos y heredados conservan su comportamiento. Rígidos de un único color mantienen el selector de espesor; papel agrega la elección de color dentro del tipo de papel cuando hay alternativas.
- Los detalles y unidades provienen de la plantilla. Se preservan variantes duplicadas, referencias, precios faltantes y atributos que distinguen presentaciones; no se transforman costos, stock ni datos guardados. Talles habituales en orden XS/S/M/L/XL/XXL/XXXL, con nombres personalizados conservados.
- Búsqueda cuando hay muchos colores, selección visible al filtrar, restauración al editar, navegación por teclado e ilustraciones que no sustituyen el nombre accesible. Se corrigió además la recuperación de una variante obsoleta cuando queda un único papel/color disponible.

Implementación: [registro y modelo de colores](../../../src/lib/selector-colores.ts), [muestra visual](../../../src/components/design-system/material-color-swatch.tsx), [selector de color](../../../src/components/comercial/material-selector-color.tsx) y [cotizador](../../../src/components/comercial/agregar-producto-sheet.tsx).

Verificación: **62 pruebas**, TypeScript, ESLint, guardia CSS y revisión del diff. En la sesión de Chrome del usuario: Polyfan blanco/negro, selección pendiente al cambiar de color y resolución de un espesor; remera con color/talle y advertencias de variantes sin costo; acrílico de un único color conserva sus cards de espesor. Vinilo de corte actualmente no expone un slot comercial de material, por lo que su configuración no se convirtió en una pregunta nueva. Los casos de vinilo comercial, unidades, papel con varios colores, muestras especiales, colores personalizados y catálogos de distintos tenants se cubren con pruebas automatizadas. No se guardó ni emitió una orden. Las pruebas de estos productos no incluyen producción física; Polyfan necesita su vector y la remera requiere completar su personalización para cotizar.

Quedan fuera de esta etapa: editar una paleta de tonos por tenant, conversión Pantone/RAL, colores de plantillas sin contrato completo (por ejemplo tapa de encuadernación con `colorBase` sólo en defaults) y la variante compacta del Centro de copiado.

### Corrección: el color conserva la ilustración de espesor

- La faceta Color mantiene su muestra rectangular; al elegirlo, los rígidos reutilizan el selector de espesor y su esquema de placa. La placa se tiñe con el color del catálogo, usando la misma paleta orientativa, transparencia y tonos metalizados. Los colores sin equivalencia siguen identificados por su nombre y usan una placa neutra.
- «Espesor» aparece como encabezado y las cards muestran «20 mm», «30 mm», etc., sin repetir el prefijo. Los formatos y referencias que distinguen variantes se conservan, incluso si todas tienen el mismo espesor. La ilustración compartida también se usa en rígidos de un único color.
- Verificado en Chrome con la sesión del usuario: Polyfan blanco → negro → 30 mm, sin guardar la orden. **64 pruebas** de selectores/cantidades, TypeScript, ESLint y guardia CSS aprobados. Regresiones específicas para placa blanca, negra, roja, HEX y transparente, texto compacto y dos formatos del mismo espesor con IDs diferentes.

## 13. Revisión de Remera algodón — clasificación y título de hilado

- El preset y el material instalado ya tienen `SUSTRATO / TEXTIL_INDUMENTARIA`, con `esProductoBase: true` y unidades por prenda. La ficha tenía una lista local de subfamilias que omitía `textil_indumentaria` y `vinilo_corte`. Se comparte ahora el catálogo tipado de subfamilias entre listado y ficha; una prueba verifica que todas las plantillas tienen opciones visibles de familia/subfamilia.
- `textil_indumentaria_v1` agrega **Título del hilado** (`tituloHilado`) como texto opcional de variante. Acepta referencias como 16/1, 20/1, 24/1 y otras del proveedor, sin tratarlas como decimales ni unidades de superficie. El selector comercial distingue variantes con distinto hilado y conserva sus IDs.
- `gramaje` sigue siendo un número opcional en g/m², ahora rotulado **Gramaje de la tela**, con ayuda que lo diferencia del título. Son datos independientes: [Tejidos del Sol](https://tejidosdelsol.com/single-jersey-polialgodon.html) publica ambos en una misma ficha; [CottonWorks](https://cottonworks.com/encyclopedia-item/english-cotton-count/) explica la numeración inglesa del hilado.
- Los 150 g/m² de Remera algodón provienen del preset existente. No se confirmaron con un proveedor ni se reinterpretaron como título. Se conserva ese dato guardado y el título queda vacío hasta que se conozca; no se modificaron precios, unidades, stock ni fórmulas.
- Verificación: ficha real en Chrome (familia/subfamilia visibles, nuevo campo y gramaje separado), 26 pruebas de plantilla/selección, TypeScript y ESLint sin errores. La ficha mantiene tres advertencias previas de dependencias de hooks. No se guardaron cambios de inventario durante la revisión.
