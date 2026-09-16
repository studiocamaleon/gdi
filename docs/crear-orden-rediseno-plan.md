# Crear orden · Auditoría y plan de rediseño

**Fecha:** 15/09/2026. **Estado:** primera implementación aplicada sobre la vista real; tema claro solicitado por el usuario.

## 1. Objetivo

Trasladar la identidad aprobada de la web, el sidebar y el Panel general al recorrido completo de Crear orden. Mantener la velocidad de carga, los cálculos, los permisos y las reglas comerciales actuales.

La dirección recomendada combina un área de trabajo clara, cálida y precisa con un resumen también claro. La identidad aparece en la tipografía, las proporciones, el naranja y la calidad de las interacciones. La representación 3D se conserva donde ayuda a configurar o comprender un producto real.

## 2. Revisión realizada

### Navegador

Se revisó una pestaña independiente autenticada de `/comercial/crear-propuesta`, comparándola con el Panel general aprobado:

- Datos iniciales y estado con un producto; composición de escritorio a 1920 px y Datos a 390 px.
- Productos vacío, catálogo, configuración de Tarjetas de visita, fila incorporada y detalle expandido.
- Configuración de Cartel Backlight sin medidas: error de datos incompletos y confirmación bloqueada.
- Centro de copiado en su estado inicial.
- Modal de cargo, modal de descuento y despliegue del cupón, sin aplicar ajustes.
- Pagos, apertura y cancelación de su formulario, Costos consolidado y estados previos a emisión de Producción y Archivos.

El producto de impresión se incorporó únicamente al estado local de la pestaña para revisar sus componentes. No se guardaron ni emitieron órdenes, presupuestos o cobros; no se validaron cupones ni se subieron archivos.

### Código y documentación

Se revisaron la página de carga, el controlador compartido, composición, tabla, resumen, selectores, acciones financieras, configuradores y contratos relevantes de persistencia. Se contrastó con `CLAUDE.md`, `docs/sistema-visual-heroui.md` y `docs/sheets-producto-heroui.md`.

La revisión visual cubre los casos indicados, no todas las combinaciones de las familias de producto ni todos los roles. Las variantes complejas y órdenes persistidas deberán entrar en la validación de implementación. No se ejecutaron pruebas de emisión o persistencia en esta auditoría.

## 3. Diagnóstico

1. **El área central conserva la identidad anterior.** El fondo frío, el acento rojizo y el título de 23 px/peso 700 difieren del papel cálido, naranja y títulos de peso moderado del Panel general.
2. **Hay demasiados contenedores superpuestos.** En Productos aparecen panel, tabla redondeada, fila coloreada y varios bloques internos con bordes. Reducir esa acumulación mejora la lectura sin quitar información.
3. **Los datos calculados parecen campos editables.** Producción estimada, entrega sugerida y margen se presentan con un tratamiento parecido a un input. La entrega global también puede pasar a ser derivada de los productos: hace falta distinguir ambos estados.
4. **Existen varios lenguajes visuales dentro del mismo recorrido.** Datos y tabla usan HeroUI; detalles técnicos mezclan componentes anteriores; Pagos y Costos conservan clases globales heredadas. Los configuradores tienen su propia composición.
5. **Los productos ya contienen trabajo de marca valioso.** `ProductoSheetHeaderConstelacion` aproxima el configurador al login/web. Debe evolucionarse, no sustituirse por los prototipos H1/H2 sin evaluar la implementación real.
6. **La identidad del vendedor es inconsistente.** Datos muestra iniciales `LU` en un avatar y el resumen `LG` con otra forma. Unificar la derivación de iniciales y el tratamiento visual.
7. **El móvil necesita una decisión específica para Productos.** La tabla tiene un ancho mínimo de 820 px. Datos se apila correctamente, pero los importes y acciones de una fila requieren desplazamiento horizontal en pantallas pequeñas.
8. **Hay detalles de accesibilidad a resolver al migrar.** En el configurador, la etapa de selección tiene título accesible y la etapa de configuración queda como diálogo sin nombre en el árbol inspeccionado: el contenedor referencia `ap-title`, mientras la nueva cabecera no recibe ese ID. Los botones de incremento/decremento de Cantidad también aparecen sin nombre. Incluir labels y asociaciones en el trabajo del configurador.

## 4. Dirección visual

Usar `src/components/design-system/brand-theme.module.css` como fuente de tokens, con apariencia clara explícita para este módulo. No crear otra paleta global.

| Elemento | Propuesta |
| --- | --- |
| Fondo | Papel cálido `#f3f2ee`; superficies `#fbfaf7`; oscuro según los tokens existentes |
| Contraste | Texto grafito `#101214` sobre superficies claras; sidebar oscuro como marco |
| Acento | Naranja `#ff7546`; texto grafito en el CTA principal; evitar teñir todos los controles |
| Título | Geist, aproximadamente 30–32 px en escritorio y 23–24 px en móvil, peso 400–500, espaciado compacto |
| Texto de trabajo | 13–14 px; etiquetas legibles; no usar mayúsculas monoespaciadas en cada campo |
| Datos técnicos | Geist Mono para códigos y referencias; cifras tabulares para importes alineados |
| Formas | Bordes finos, radios de 7–9 px y sombra reservada a ventanas superpuestas |
| Espaciado | Escala de 8/12/16/24 px; separar grupos por espacio y divisores, reducir cajas anidadas |
| Botones | Emitir como acción principal naranja; borrador con contorno; acciones locales de menor énfasis; mantener 32 px en cabecera de escritorio |
| Interacción | Transiciones breves de selección, foco y expansión; conservar preferencias de movimiento reducido |

El encabezado permanece compacto y fijo. La marca completa sigue en el sidebar; no repetir un segundo logo ni introducir una sección promocional dentro de la orden.

## 5. Plan componente por componente

| Área / componentes | Tratamiento propuesto | Funcionamiento que debe conservarse |
| --- | --- | --- |
| `CrearPropuestaPage` / carga inicial | Skeleton y aviso de carga parcial con la misma composición final | Cargas independientes con `Promise.allSettled`, recuperación de errores y catálogos reales |
| `OrdenWorkspace` | Papel cálido, mejor proporción entre contenido y resumen de 300–320 px, título liviano, menos marcos | Cabecera fija, altura calculada para el resumen y foco al volver a Datos |
| `OrdenSaveActions` | Naranja pleno para emitir; borrador secundario; estado ocupado claro | Producto necesario; cliente para emitir; borrador sin cliente; bloqueo durante operaciones pendientes |
| `OrdenTabs` / `NavigationTabList` | Mantener T2 detallada; afinar bordes, línea activa naranja, contadores y descripciones | Datos inicial en creación; navegación libre; advertencia de cliente; teclado; pestañas condicionadas por permiso/estado |
| `OrdenDatosSections` | Mantener tipo/vendedor, cliente/campaña, canal y Entrega; jerarquizar secciones con menos encabezados redundantes | Mismo orden de carga y comportamiento dependiente de los campos |
| `OrdenSegmented` | Segmentado compacto, selección grafito con señal naranja | Orden y presupuesto conservan sus destinos y acciones reales; no es un cambio cosmético de texto |
| Vendedor / avatares | Una misma identidad, iniciales coherentes y menor énfasis que Cliente | Es un dato del usuario/orden, no un nuevo selector para reasignar vendedor |
| `ClienteLista` | Campo de buen contraste; lista con nombre dominante y datos secundarios; búsqueda y estados legibles | Búsqueda remota/cache, selección por teclado, clientes incorporados desde escaneo y recotización por cliente |
| `CampanaSelectorOrden` | Mismo campo y menú que Cliente; estado opcional claro | Depende del cliente; se limpia al cambiar a un cliente incompatible; no inventar alta de campaña en esta vista |
| `CanalVentaSelector` | Conservar iconos compactos y etiqueta de la opción seleccionada; foco y error inequívocos | Canal requerido para guardar, valores históricos y recuperación de foco al validar |
| Entrega global / ETA | Fecha editable con campo; estimaciones en pares etiqueta/valor, con origen comprensible | Fecha final derivada de productos, días hábiles, zona horaria, margen y estados sin estimación/parcial |
| `OrdenSummaryDetails` / `ResumenBar` | Resumen en papel cálido con información completa y total de mayor jerarquía; separadores finos | Cliente/campaña/fecha/vendedor, cifras reales, moneda configurada y total como último elemento |
| `OrdenFinancialActions` / `OrdenCuponField` | Iconos coherentes bajo vendedor, buen contraste; cupón desplegable en el mismo lugar | Cargos, tratamiento fiscal, descuento y cupón separados; ayudas accesibles; mismos bloqueos |
| `CargoOrdenDialog` / `DescuentoOrdenDialog` / avisos de cupón | Cabecera, campos, resumen y pie alineados con la marca también en portales | Modos de cargo, monto/porcentaje, prorrateo, recotización, alertas de margen y validación de cupón sin redimir anticipadamente |
| `OrdenProductosTable` / `OrdenCargosList` | Filas más editoriales: nombre destacado, familia secundaria, cantidades/importes alineados; una única superficie principal | Ordenamiento local, expansión, edición, eliminación local, cargos, estado de recotización, tomos y precios especiales |
| Productos vacío | Composición compacta y cuidada, mismo llamado a agregar el primer producto | Sólo los accesos actuales; sin reincorporar título, buscador ni categorías a esta pestaña |
| `OrdenProductoDetalle` | Resumen técnico limpio, tabs internas discretas, opcionales y entrega sin repetir marcos | Especificaciones, costos, flujo, aprovechamiento, permisos, edición y descuentos por ítem |
| `PlanificacionEntregas` | Fechas y cantidades legibles, relación con el producto siempre visible | Distribuciones y lotes, validación de cantidades, fechas por producto y recotización asociada |
| `AgregarProductoSheet` / catálogo | Lista clara con búsqueda y familias dentro del panel; carga y sin resultados de la misma familia visual | Catálogo real, teclado, filtro y vuelta de configuración a selección |
| Configurador / `ProductoSheetHeaderConstelacion` | Conservar la constelación discreta; unificar campos, selecciones, errores y pie; reducir bloques vacíos sobredimensionados | Familias, reglas condicionales, medidas, unidades, materiales, rutas, perfiles, opcionales y cálculo automático |
| Herramientas técnicas anidadas | Alinear cabeceras y controles, dar espacio a la previsualización real | Nesting, vectores, paneles manuales, bastidores/3D, sellos, planos, brief y archivos; no sustituirlos por imágenes decorativas |
| `CentroCopiadoSheet` / configuración / precios | Misma tipografía, campos, selección y pie; separar con claridad documentos y tomos | Lectura de documentos, páginas/carillas/hojas, agrupación, anillado, precios y edición de una carga completa |
| `PagosStagingTab` / `CobroFormulario` | Indicadores compactos, formulario ordenado y aviso de cobros pendientes de registro con menor ruido | Métodos, cuentas, comisiones, acreditación, retenciones, valores y registro sólo al emitir |
| `CostosOrdenTab` | Gráficos y tablas sobre superficies cálidas, color por significado; mostrar jerarquía costo → precio → margen | Consolidado real, costos por producto/centro, permisos, estado incompleto y diferencia entre cotizado y realizado |
| Producción / Archivos durante creación | Estados previos a emisión concisos y visualmente integrados | Producción real aparece al confirmar; adjuntos de orden requieren persistencia. Los archivos temporales propios de algunos productos siguen su circuito actual |
| Confirmaciones / `EmitOverlay` | Misma familia de ventanas, estados de envío claros y número de orden real al finalizar | Cambios sin guardar, borrador con cobros, idempotencia, fallo parcial de adjuntos y navegación posterior |

### Responsive

- Escritorio: contenido flexible más resumen estable; título y acciones siguen compactos.
- Ancho intermedio: decidir el apilado por espacio útil, considerando el sidebar abierto. Evitar una tabla comprimida sólo para conservar el resumen lateral.
- Móvil: Datos en una columna; tabs en filas; resumen debajo del contenido. Mantener las acciones accesibles en la cabecera sin duplicarlas en otra barra.
- Productos en móvil: proponer una presentación compacta por ítem con nombre, cantidad, total y expansión; dentro del detalle, conservar subtotal, impuestos, unitario y todas las acciones. Compartir los mismos valores y callbacks con la tabla de escritorio.
- Sheets: pantalla completa en móvil, cabecera/pie accesibles y desplazamiento del cuerpo; probar teclado virtual y selectores abiertos.

## 6. Reglas de negocio que no deben cambiar

1. No agregar un asistente obligatorio por pasos. Las pestañas siguen disponibles con sus reglas actuales.
2. Guardar borrador exige productos y canal; admite ausencia de cliente. Emitir exige productos, cliente y canal.
3. Presupuesto usa su propia persistencia y envío/aprobación. No tratarlo como una OT renombrada.
4. No recalcular importes desde componentes de presentación. Reutilizar `calcularResumenOrden`, `getItemOrderVisibleAmounts`, las funciones de costos y el motor actual.
5. El descuento ya afecta los importes por línea; el desglose no debe restarlo dos veces. Tampoco duplicar los cargos de paso al mostrar cargos de orden.
6. Respetar tratamiento fiscal, impuestos, canje de puntos, moneda y decimales; no exponer márgenes sin permiso.
7. Los cupones se validan por su circuito real y no se redimen antes de la emisión. Descuento manual sigue separado.
8. La fecha final respeta las entregas de los productos. No mostrar una estimación inexistente como fecha confirmada.
9. Los cobros cargados en creación se registran al emitir. Guardar borrador conserva el aviso de que esos cobros no se guardan.
10. No anunciar autoguardado: los cambios de creación viven en memoria hasta guardar o emitir. Mantener avisos al salir.
11. Preservar atajos P/C, escaneo de DNI/códigos y sus condiciones. No activarlos mientras se escribe o fuera de edición permitida.
12. No ampliar permisos o campos editables al compartir estilos con una orden existente.

## 7. Estrategia técnica

### Alcance del tema y portales

La auditoría encontró que `PropuestaFicha` aplicaba el tema base de HeroUI. Cambiar sólo esa clase no cubría el recorrido: `ClienteLista`, `FormDialog`, selectores y tooltips montan portales con su propio tema. El contexto ahora transmite apariencia y variante de marca; `useDesignTheme` resuelve la clase de los portales HeroUI y `useLegacyDesignScope` adapta los controles anteriores.

Implementado: variante de tema opcional en el contexto de diseño, con el tema actual como valor por defecto. Usar una función/hook común para resolver scope y clase en los componentes portaleados afectados. Activar la variante de marca explícitamente en el workspace de orden. No reemplazar el tema base para todas las vistas.

La dirección final del usuario exige que el resumen también sea claro. La vista y sus portales usan `appearance="light"`, independientemente del modo del shell.

### Compartidos y CSS heredado

- `PropuestaFicha` sirve tanto para creación como para `/produccion/ordenes/[ordenId]`. Encapsular las piezas visuales sin mover la lógica de persistencia ni hacer una reescritura general del controlador.
- `AgregarProductoSheet` conserva un puente `.ot-v1`; Pagos/Costos y algunas vistas técnicas también dependen de clases anteriores. Migrar el estilo por componente y retirar puentes únicamente cuando todos sus consumidores estén cubiertos.
- Los prototipos H1/H2 de `/dev/diseno/sheets` contienen datos ficticios. Son referencias, no reemplazos operativos listos para producción.
- No editar `src/app/globals.css`, no modificar la barra global ni el sidebar por esta tarea, y no añadir nuevas librerías para conseguir esta dirección visual.
- Mantener por ahora los anchos/comportamientos especializados de cartelería y herramientas técnicas; validarlos individualmente antes de homogeneizarlos.

## 8. Implementación propuesta por entregas

### A · Base, Datos y resumen

1. Resolver variante de marca y propagación a portales con valor por defecto compatible.
2. Migrar composición, cabecera, tabs, Datos, resumen y acciones financieras.
3. Alinear Cliente/Campaña, cargos/descuento/cupón y estados de carga/validación.
4. Comprobar escritorio, móvil, oscuro, foco y coherencia con el Panel general.

**Salida:** el ingreso y las condiciones comerciales forman una experiencia coherente.

### B · Productos y configuración

1. Migrar tabla, detalle, cargos y distribución de entregas.
2. Adaptar catálogo, pie y campos del configurador conservando la cabecera de constelación.
3. Migrar familias por grupos: impresión/piezas; cartelería/compuestos; variantes especiales y copiado.
4. Incluir estados de cálculo, error, producto sin precio y opciones dependientes.
5. Resolver asociaciones accesibles del diálogo y botones de cantidad.

**Salida:** el recorrido principal Datos → Productos → revisión de total tiene el nuevo estilo completo.

### C · Resto del recorrido y regresión

1. Alinear Pagos, Costos, estados previos a emisión y confirmaciones.
2. Verificar los componentes compartidos en borrador y OT existente, sin alterar sus funciones.
3. Probar los escenarios críticos de regresión y documentar el alcance finalmente implementado.

**Salida:** ninguna ventana o pestaña habitual de Crear orden vuelve al estilo anterior.

Estas entregas son divisiones de implementación. A y B deberían formar el primer conjunto visual que se revise como experiencia completa; una actualización únicamente de la pantalla inicial dejaría el salto estético al agregar el primer producto.

## 9. Verificación de implementación

### Escenarios necesarios

| Escenario | Resultado esperado |
| --- | --- |
| Orden vacía | Datos inicial, total cero y acciones bloqueadas según las reglas actuales |
| Producto sin cliente | Borrador posible con canal; emisión bloqueada; aviso y foco coherentes |
| Cliente/canal completos | Cotización por cliente, campaña compatible y emisión con el mismo contrato |
| Cambio de tipo | Acciones y destino correctos de presupuesto; sin pérdida silenciosa de configuración |
| Cargo/descuento/cupón | Totales y prorrateo iguales antes/después; no doble descuento ni doble cargo |
| Tratamiento fiscal / canje | Total y desglose consistentes en tabla, resumen y Pagos |
| Entregas múltiples | Suma de cantidades y fecha final intactas; sin sobrescribir fechas por producto |
| Error o cálculo en curso | Mensaje accionable; no incorporar cotización desactualizada |
| Copiado y producto compuesto | Misma cantidad comercial, agrupación, materiales y archivos que antes |
| Borrador con cobros | Advertencia actual; no presentar cobros locales como ya registrados |
| Navegación con cambios | Confirmación y opciones actuales; sin falso autoguardado |
| OT existente | Estado, permisos, edición y pestañas adicionales conservados |
| Usuario sin márgenes | Costos/importes restringidos no reaparecen por la nueva presentación |
| Teclado / móvil / oscuro | Foco visible, diálogo con nombre, Escape/retorno de foco, sin acciones inaccesibles |

Tomar 390, 768, 1366 y 1920 px como tamaños de revisión, con sidebar abierto/cerrado cuando corresponda. Incluir nombres largos, importes grandes y estados vacíos.

### Comprobaciones técnicas

- TypeScript, lint focal y `npm run css:guard` para los cambios que se implementen.
- Ejecutar las pruebas existentes pertinentes: `orden-save-actions`, `orden-productos-presentacion`, `costos-orden`, `cargos-orden`, `cupones-orden`, `canales-venta`, `planificacion-entregas` y pruebas de cotización/familias afectadas.
- Agregar pruebas sólo si aparece comportamiento nuevo que las existentes no cubran, especialmente propagación del tema a portales o una presentación móvil con interacciones propias.
- Validar guardado/emisión en pruebas con fixtures o un entorno de datos de prueba; no generar documentos comerciales reales para comprobar estilos.

## 10. Recomendación

Avanzar con **workspace cálido + resumen claro + naranja de marca**, conservando la estructura de pestañas y la lógica actual. La primera implementación debe priorizar Datos, resumen y el recorrido completo de incorporación de productos. Pagos, Costos y confirmaciones forman parte del cierre del rediseño, no de una revisión indefinida posterior.

La maqueta de conversación acompaña esta propuesta de composición. Usa datos e importes ilustrativos, no cotiza ni define funcionalidades nuevas. Este documento es el inventario y plan de implementación; la app todavía no se modificó por este pedido.


## 11. Primera implementación aplicada

- `PropuestaFicha`: tema de marca claro, cabecera liviana con punto naranja, Datos y resumen en papel cálido; preserva todos los estados y callbacks.
- Datos: mismo avatar e iniciales del vendedor en ambas columnas; estimaciones de consulta diferenciadas de la fecha editable.
- Productos: un único marco de tabla; a menos de 850 px de contenido, cada fila distribuye sus datos en una ficha, conservando importes, ordenamiento y acciones.
- Portales: variante opcional propagada a HeroUI y puente de tokens para diálogos, selectores, popovers y tooltips anteriores. Sin provider de marca conservan su estilo previo.
- Catálogo, configuradores, Centro de copiado y consulta de precios: tema explícito; se conservan constelación, campos, archivos y geometrías especializadas. Título accesible en el paso de configuración y nombres para aumentar/disminuir cantidad.
- Pagos, Costos y estados vacíos: adaptación local de superficies, títulos, indicadores y botones. Sin cambios en cálculos, permisos ni persistencia.

Validación automatizada: 75 pruebas existentes de importes, cargos, cupones, canales, entregas y acciones de emisión; 4 pruebas del contexto de tema. ESLint focal y control de CSS aprobados. No se modificó `globals.css` ni se agregaron dependencias.

La validación visual usa órdenes temporales en una pestaña independiente; no emite ni guarda operaciones. Las variantes técnicas de todas las familias y órdenes persistidas no constituyen una matriz exhaustiva de QA.

Comprobación adicional: selector compartido (`SelectField`) e aislamiento de CSS HeroUI aprobados. Cartel Backlight conserva el error de medidas incompletas y bloquea su incorporación hasta completar los datos.


## 12. Ajuste de ilustración, acciones y navegación

La barra de secciones adopta `NavigationTabList tone="graphite"`: fondo del
sidebar, iconos enmarcados, indicador naranja, contadores y foco visible. El
contenido del módulo y el resumen continúan claros. Se conservan selección,
permisos, avisos y navegación por teclado; las demás barras mantienen su tono.

El paquete del estado vacío se reemplaza por una ilustración SVG de una caja
abierta con pieza gráfica, caras grafito y solapas naranjas. La animación leve
se desactiva con `prefers-reduced-motion`. Es decorativa para accesibilidad.
Agregar producto pasa a primario naranja e Impresiones rápidas usa contorno
fino e icono cálido; ambos mantienen sus callbacks y atajos actuales.

Revisado en escritorio y a 390 px: navegación con flechas y apertura/cierre del
catálogo y Centro de copiado, sin persistir datos. TypeScript, ESLint focal y
CSS guard aprobados.

## 13. Restyling del sheet Agregar producto

- Catálogo en papel cálido con tipografía Geist, título con punto naranja y la
  constelación existente. Los dos pasos comparten la variante optativa `stage`
  de `ProductoSheetHeaderConstelacion`; Centro de copiado conserva su cabecera.
- `producto-catalogo.module.css` sustituye los selectores anteriores del catálogo.
  Tarjetas con símbolos SVG de superficies, piezas, rollos y componentes; no son
  fotografías del producto. Familia, descripción, unidad de cobro y precios de
  referencia siguen disponibles, con descripción completa en la configuración.
- Búsqueda por nombre/código y filtro por familia conservados. El buscador expone
  el resultado activo a lectores de pantalla; limpiar o elegir una categoría
  devuelve el foco al buscador. Se puede seguir eligiendo con flechas y Enter.
- Configuración: campos, opciones, materiales y cantidades mantienen sus controles
  y cálculos; selecciones naranjas y cabeceras de papel mediante tokens locales.
  Las medidas muestran rótulos individuales en móvil; el encabezado se desplaza
  para dejar lugar a los campos. Las geometrías especializadas siguen presentes.
- Pie con total separado de acciones, `ActionButton` y los mismos bloqueos de
  cotización, mínimos, tiempos manuales y brief. No cambia guardado ni emisión.

TypeScript, ESLint focal y 16 pruebas existentes de cantidades y piezas aprobados.
CSS guard mantiene 34.122 líneas y 1.158 clases globales. Sin dependencias nuevas.

Revisión visual en escritorio y 390 px: catálogo, categorías, búsqueda con varias
palabras, vacío y limpieza de filtros; resultado activo y flechas/Enter; regreso
y Escape. Vinilo Vehicular impreso con 20 × 30 cm y CMYK calculó el total y
habilitó las acciones. No se agregó el producto ni se guardó o emitió una orden.
No es una verificación exhaustiva de todas las familias del catálogo.

## 14. Ilustraciones automáticas por clasificación comercial

La biblioteca crece a 39 símbolos SVG para las 48 subcategorías comerciales
(incluye la alternativa neutra de Producto a medida). La selección se centraliza
en `src/lib/producto-catalogo-ilustracion.ts` y usa los códigos estables de
subcategoría/categoría, sin inferir a partir del nombre del producto.

Prioridad: subcategoría reconocida → categoría reconocida → compuesto → forma
de cobro → piezas genéricas. Producto a medida omite la categoría Servicios y
usa directamente el tramo genérico. La ilustración de una familia reconocida
tiene prioridad incluso si el producto es compuesto; su indicador de componentes
sigue visible en la tarjeta. Un producto nuevo hereda la imagen de su familia,
y las categorías desconocidas siempre tienen una alternativa.

Incluye sellos automáticos/manuales, indumentaria, tarjetas, papelería, editorial,
vinilos, lonas, displays, rígidos, corpóreos, packaging, personalización, acabados,
instalación, diseño y logística. Se conservan los colores, tamaño y presentación
del catálogo. No cambia ningún dato comercial, precio o regla de cotización.

Verificación: 8 pruebas del resolver (cobertura contra el seed de API, prioridad,
subcategorías nuevas y producto a medida), TypeScript, ESLint y CSS guard.
Revisión visual de los 39 símbolos y de su asignación en productos reales del
sheet. No se crearon productos ni órdenes para probar la asignación.

## 15. Fila y detalle del producto agregado a la orden

La fila reutiliza `ProductoCatalogoGlyph` con los códigos comerciales del ítem.
El nombre, la categoría en monoespaciada y el total tienen jerarquías distintas;
la expansión se indica con una línea naranja y un fondo cálido tenue.

El detalle utiliza HeroUI Tabs y la nueva variante optativa `inset` de
`NavigationTabList`: base clara, selección grafito e icono naranja. En ancho
reducido las cuatro pestañas se distribuyen en dos filas. Editar especificaciones
y Descuento utilizan `ActionButton` y conservan sus callbacks y condiciones.

- **Especificaciones:** rótulos con iconos, bloques claros, valores completos,
  CMYK y faz originales, opcionales cálidos, vacío discreto y entrega con fecha
  editable separada de la estimación. Se mantiene la planificación por lotes.
- **Componentes y brief:** jerarquía tipográfica y colores de marca, conservando
  expansión recursiva, piezas, medidas, cantidades, indicadores y contenido.
- **Costos:** composición del precio, contribución destacada y tabla técnica
  por paso. Se reutilizan los cálculos y el tratamiento fiscal existentes.
- **Producción:** operaciones sobre una cuadrícula sutil, etapas y nodos claros.
- **Aprovechamiento:** contenedor de marca para los visores actuales, conservando
  selección de proceso, bastidor, piezas, archivos y edición de paneles.

Los diálogos ampliados y el editor de paneles heredan el tema del contexto. Se
corrigió el desplazamiento fuera de pantalla de la vista ampliada: `translate:
none` neutraliza la traslación individual de Tailwind además de `transform`.
No se modificó `globals.css`, la lógica comercial ni la persistencia de órdenes.

**Verificación:** TypeScript, ESLint focal, CSS guard y `git diff --check`.
75 pruebas existentes aprobadas en 8 archivos: importes de orden, costos,
especificaciones, componentes, ilustraciones, workflow, brief y visor de nesting.
QA en una orden temporal sin guardar ni emitir: Vinilo Vehicular 190 × 90 cm
CMYK (total $100.174), cuatro pestañas, apertura de edición con datos recuperados,
descuento, ampliación de producción y aprovechamiento; Kit de Vinilos con árbol
de componentes, 3 piezas, CMYK + Blanco y acceso a distribución de entregas.
Escritorio y 390 × 844 px, navegación por teclado y diálogos dentro del viewport.
Sin errores en consola durante la revisión. No se ejecutaron todas las variantes
especializadas ni se guardaron distribuciones, descuentos u órdenes.

## 16. OT creada: paneles operativos y nesting (15/09/2026)

Se revisó la OT-2026-0060 y se extendió el lenguaje claro de marca a sus nueve
secciones. El controlador, permisos y datos persistidos se conservan.

- Navegación: nueve pestañas con iconos compactos en notebook y grilla de tres
  columnas en móvil. La variante de seis pestañas de creación conserva su diseño.
- Cabecera: cliente y cantidad de productos junto al número y estado de la OT.
- Pagos y Comprobantes: indicadores consistentes, saldos jerarquizados, acciones
  y estados vacíos alineados con los tokens de marca.
- Archivos: tarjeta general de la orden y tarjetas por producto; se mantienen
  destinos, permisos, visibilidad pública y recuperación de papelera.
- Documentos: revisiones, controles pendientes y estados vacíos sobre papel
  claro. Se reemplaza la palabra interna «gate» por «control» en la interfaz.
- Costos: tarjetas más legibles y tablas con scroll contenido en pantallas chicas.
- Historial: lista cronológica con icono, fecha y autor; conserva eventos y límite.
- Producción: lienzo compacto, superficies heredadas de la marca y nodos más
  legibles. Se corrige una colisión de CSS entre nodos de cotización y de OT que
  comprimía el contenido del flujo resumido. Ramas y precedencias no cambian.
- Productos: las ilustraciones de órdenes rehidratadas recuperan códigos de
  categoría desde el catálogo por ID, sólo como fallback visual. No se actualizan
  nombres históricos, precios ni snapshots de la orden.
- Nesting: paleta compartida con la leyenda, papel claro, márgenes tramados,
  líneas de cota, indicador de aprovechamiento y mayor escala visual del rollo.
  Se mantienen medidas, proporciones, giros, algoritmos y cálculos. Los colores
  explícitos en SVG permiten exportar sin depender del CSS de la aplicación.

Implementación local en `orden-issued.module.css`, `OrdenSectionHeading`,
`NavigationTabList`, `DocumentosLiberadosOtTab` y los módulos del visor compartido.
El visor hereda el tema de marca también en el diálogo ampliado. Sin nuevas
clases en `globals.css`.

Validación: 81 pruebas existentes aprobadas (costos, importes, workflow,
ilustraciones, visor, overlays y exportación SVG/vectorial). Tras ajustar la
escala del rollo se repitieron las 36 pruebas de nesting y exportación, aprobadas.
TypeScript, ESLint focal, CSS guard y `git diff --check` sin errores.
Revisión de las nueve pestañas en OT 60, flujos completo y resumido, escritorio,
notebook de 1366 px y móvil de 390 px. Se revisaron vinilo en rollo con máquina,
tarjetas de 24 piezas por pliego, layouts, inspección y vista ampliada.
La OT de referencia mantiene su total de $144.503,25 y los cinco eventos previos;
no se guardaron operaciones comerciales o productivas durante la revisión.
La orden no tiene cobros, comprobantes ni controles documentales: sus estados
con datos no se ejercitaron mediante nuevas transacciones.
