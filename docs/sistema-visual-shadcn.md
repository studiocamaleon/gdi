# Sistema visual de la aplicación · evolución con Shadcn

**Decisión aprobada:** 11/09/2026. **Primera referencia:** Producción → Colas de trabajo.

El usuario aprobó esta pantalla como dirección para renovar gradualmente la aplicación. Este documento conserva el contrato de Colas y sus superficies actuales. Desde el 12/09/2026, las próximas migraciones siguen el [piloto HeroUI de Orden de trabajo](sistema-visual-heroui.md); su aspecto todavía debe ser validado por el usuario. El [lenguaje Visual Ilusión anterior](visual-ilusion-lenguaje-visual.md) conserva valor histórico, pero no obliga a reproducir la estética de Tesorería o de la OT en una vista renovada.

> **Actualización 14/09/2026:** la vista principal de Colas adopta
> [HeroUI](sistema-visual-heroui.md#colas-de-trabajo-vista-principal--14092026).
> Este documento conserva el antecedente visual y el contrato operativo.
> El simulador y los formularios compartidos de producción mantienen su tema
> anterior hasta su migración específica.

## Dirección

Una aplicación de trabajo sobria, con jerarquía clara, superficies neutras, bordes finos y acciones fáciles de encontrar. Las referencias de Vercel, Linear y dashboards Shadcn orientan la composición; no se copia su marca ni se agregan métricas decorativas.

- Una superficie principal para cada tarea. En maestro/detalle, lista y contenido comparten un panel con divisor.
- La selección debe reconocerse inmediatamente: máquina activa con `Button default`, las demás con `ghost`.
- El color semántico acompaña un texto y un icono. El naranja de marca no se impone a todas las acciones.
- Tipografía sans existente (Geist), títulos compactos y números tabulares para comparar fechas y cantidades. No usar monoespaciada en todos los datos por defecto.
- Información operativa primero: OT, producto, lote, configuración, fecha y estado. El detalle secundario tiene menos peso, sin desaparecer.
- Los gráficos o indicadores sólo se agregan si ayudan a una decisión real.

## Fuentes de verdad

| Capa | Ubicación y responsabilidad |
| --- | --- |
| Primitivas | `src/components/ui/`: Button, Badge, Tabs, Table, Dialog, Field, Checkbox, InputGroup, ScrollArea, etc. Semántica, teclado, foco y variantes. |
| Tema de superficies renovadas | `src/components/ui/workspace-theme.module.css`: una clase optativa, con tokens neutros derivados del tema existente. También se aplica al contenido de overlays renderizados en portal. |
| Composición reutilizable | `src/components/ui/workspace-ui.module.css`: título de sección y densidad de tablas compartidos entre Colas y Preparar tanda. No cambia los defaults globales de las primitivas. |
| Composición de la vista | `src/components/produccion/colas-produccion.module.css`: distribución, densidad, anchos, scroll y responsive de Colas. |
| Contrato operativo | [Colas y tandas v1](produccion-colas-tandas-v1-2026-09-11.md): qué hacen los controles. La apariencia no habilita transiciones inexistentes. |
| Higiene de CSS | [Convenciones CSS](css-convenciones.md) y `npm run css:guard`. |

No copiar todo el CSS de Colas para crear otra vista. Reutilizar primitivas y tema, y escribir sólo su composición. Extraer un componente compartido cuando exista una segunda necesidad concreta; evitar un componente universal lleno de excepciones.

## Valores de la primera referencia

Son decisiones de composición para pantallas operativas, no nuevos defaults globales de Shadcn.

| Elemento | Referencia |
| --- | --- |
| Título de página | 23 px, peso 650, tracking −.035 em; 21 px en móvil |
| Título del recurso | 21 px, peso 600; 18 px en móvil |
| Nombre del trabajo | 13 px, peso 550, interlineado 1.45 |
| Datos y controles secundarios | 11–12 px; controles conservan las variantes de Shadcn |
| Superficie principal | Radio 14 px, borde 1 px, sombra muy leve |
| Separación de bloques | 12, 16, 20 y 24 px según jerarquía |
| Lista lateral | 264 px; 238 px en escritorio compacto; selector bajo 760 px |
| Fila de máquina | Alto mínimo 70 px; crece con el nombre |
| Tabla | 18 px de padding vertical; grupos 10 px; cabecera de 42 px |

Los valores de color no se repiten como hexadecimales en cada pantalla. El tema optativo deriva `border`, `muted`, `secondary`, `accent` e `input` de `foreground` y `card`, de modo que siga el tema activo. Los iconos de estado usan tokens semánticos del workspace.

## Patrones de interacción

- **Búsqueda:** InputGroup + InputGroupInput + addon de icono. Etiqueta accesible aunque sólo se vea el placeholder.
- **Filtros de estado:** Tabs dentro de TabsList. En poco ancho se desplazan horizontalmente desde el primer filtro; el scroll no debe recortar el texto ni impedir el foco.
- **Tablas:** identidad y acceso al trabajo juntos. Configuración en columnas comparables; grupos identificados sin confundirlos con una tanda ya iniciada.
- **Medidas en Colas:** columna propia después de Trabajo, con el formato de la OT: `N u. × ancho × alto cm`, una línea por medida. Mostrar únicamente piezas a producir; no agregar medidas del producto padre ni de terminación. En panelizados, mostrar cada panel identificado (`Panel 1/2`, `Panel 2/2`) con sus dimensiones calculadas, incluidos los solapes, en lugar de las dimensiones de la pieza completa. Mantener el ancho del material en su columna independiente. Los componentes de productos compuestos muestran `Layout bloqueado`, con explicación visible al seleccionar para simular; sus acciones de producción siguen disponibles.
- **Sustrato en Colas:** columna independiente de Medidas: tipo y formato de producción (`Rollo · 1,37 m`, `Placa · 860 × 564 mm`, `Pliego (hoja) · 330 × 483 mm`). El rollo muestra su ancho; placas y pliegos, ancho × alto. Diferenciar placas y pliegos por la clasificación del material, no por el tamaño ni por la máquina. Sin clasificación suficiente, usar `Formato plano` antes que inventar un tipo. Conservar la referencia al formato cotizado si cambió.
- **Datos ausentes:** “Sin dato” o un motivo específico. No inferir material por el nombre de un producto.
- **Selección múltiple:** Checkbox con nombre accesible. Mostrar cuántos trabajos se seleccionaron y qué impide seleccionar otro; nunca mezclar silenciosamente configuraciones.
- **Revisión:** Dialog/Sheet con título, descripción, cuerpo desplazable y acciones siempre alcanzables. Usar el mismo tema optativo dentro del portal. Compartir colores no alcanza: el título usa la jerarquía del recurso (21/18 px), el contexto va encima en 12 px y los trabajos conservan la densidad de tabla de la pantalla de origen. Resumen sin tarjetas decorativas; fechas y cantidades en columnas. En pantallas angostas la tabla se desplaza dentro del cuerpo, sin ocultar las acciones.
- **Configuración de trabajos:** Colas agrupa únicamente por material; `ConfiguracionGrupoCola` muestra su nombre, cantidad de trabajos y acción de selección. Los anchos distintos comparten encabezado. Formato, color, detalle del perfil y caras pertenecen a cada fila, sin repetir allí el nombre del material. Si el nombre del perfil comienza exactamente con el mismo color, sólo ese prefijo redundante se omite y se muestra `Perfil: 4 pass`; el nombre original se conserva en los datos y en el título del texto. Un perfil con otro color o nombre arbitrario se muestra completo. La abreviación nunca cambia IDs ni reglas de compatibilidad.
- **Errores:** Alert junto a la acción afectada. Un error de actualización no borra datos correctos sin motivo.
- **Carga:** Skeleton para la carga inicial. En refrescos conservar las filas; no hacer parpadear toda la página.
- **Iconos:** Lucide, tamaño a cargo de la primitiva, tooltip y nombre accesible en acciones sin texto.
- **Responsive:** no reducir toda la interfaz hasta hacer ilegibles los textos. Cambiar la navegación y mantener desplazable la tabla. No aumentar artificialmente el ancho de elementos que representan magnitudes.

## Migración y retiro de estilos viejos

Se migra **una vista a la vez**. La próxima se elige cuando se cierre el recorrido de Colas; no se inicia una renovación masiva del sidebar o del sistema durante ese trabajo.

1. Inventariar componente, CSS Module, clases globales y componentes compartidos que usa la vista.
2. Sustituir su composición usando primitivas existentes y el tema optativo. No agregar clases de página a `globals.css`.
3. Buscar consumidores de cada familia vieja en todo el repositorio, incluidas plantillas, `cn()`, estados y nombres construidos dinámicamente.
4. Retirar CSS y markup reemplazados en el mismo cambio **si no conservan consumidores**. Una búsqueda literal vacía por sí sola no demuestra que una clase esté muerta.
5. Si una regla sigue sirviendo a otra pantalla, conservarla y registrar dónde. No eliminar reglas globales como `th`/`tr` sólo porque se neutralizan en Colas.
6. Revisar el borde de los bloques borrados, temas, vecinos, overlays y responsive; ejecutar tests pertinentes y `css:guard`.
7. Registrar la vista terminada, estilos retirados y deuda residual. Bajar la línea base del guard únicamente tras un retiro revisado, nunca para aceptar crecimiento involuntario.

### Registro inicial

| Vista | Situación | Retiro / deuda |
| --- | --- | --- |
| Colas de trabajo | Dirección visual aprobada; consulta validada con datos reales y a 1280/390 px | El CSS anterior de la misma vista se reemplazó, no se duplicó. Sin familia global propia que retirar. Se neutralizan localmente tipografía/fondo de `th` y borde de `tr` heredados; esas reglas globales tienen otros consumidores. |
| Preparación de tanda | Comparte tema, jerarquía de títulos, densidad de tabla y encabezado de configuración con Colas | Se reemplazó la lista de tarjetas por tabla. Se retiraron estilos de secuencia/lista/configuración antiguos; los estilos comunes se extrajeron de Colas, sin dejar copias. No recuperar CSS de simuladores retirados. |
| Resto de la aplicación | Pendiente de elección y migración por pantalla | Mantiene su estilo actual hasta intervenirla. |

## Criterio de aceptación

La herramienta **Simular nesting** de Colas (12/09/2026) mantiene el tema y las tablas compartidas. Usa un modal de consulta con cuerpo desplazable, cierre visible, selector de ancho y dibujo proporcional horizontal. La composición está aislada en `simular-nesting-cola.module.css`, sin estilos globales nuevos. Contrato: [simulación manual de rollos](produccion-simulacion-manual-rollos-2026-09-12.md).

- Flujo real, estados vacíos, carga, errores, selección, teclado y foco revisados.
- Datos de OT/lotes legibles; tooltips no son la única forma de acceder a información esencial.
- Escritorio y ancho pequeño sin controles inaccesibles ni scroll de página accidental.
- Revisar tema oscuro antes de declarar una vista validada en ese tema. Heredar tokens no equivale a haberlo probado.
- TypeScript, pruebas del comportamiento afectado, lint focalizado y `npm run css:guard` pasan.
- Estilos sustituidos retirados o deuda residual identificada. No medir la migración sólo por líneas borradas.

Las nuevas decisiones visuales se incorporan aquí con su pantalla de referencia. La fuente de valores implementados continúa siendo el código, y una captura no reemplaza el contrato de comportamiento.

## Colas simplificada (11/09/2026)

La vista conserva el estilo aprobado, pero se retiran las tarjetas de recomendación y el modal Preparar tanda, junto con sus CSS Modules exclusivos. La selección es una acción de tabla: casilla por trabajo, casilla de página con estado parcial visible y barra contextual con cantidad, Limpiar y Completar seleccionados. No exige compatibilidad entre los seleccionados. Los filtros y contadores permanecen visibles; el resultado se comunica con toast y los errores mediante Alert. Ver [contrato vigente](produccion-colas-completar-seleccion-2026-09-11.md).

La barra de selección conserva su espacio también sin selección, con sus acciones deshabilitadas. El contador y la explicación ocupan líneas estables; el texto largo conserva su contenido completo en el título y la descripción accesible. En contenedores angostos las acciones pasan a una fila propia. Seleccionar o limpiar no desplaza la tabla.

Los controles junto al estado usan el componente compartido `PasoAccionesProduccion`: Button outline pequeño con iconos y acciones según el estado y modo de registro. Colas usa Dialog para motivos y tiempo; Kanban conserva el formulario dentro de su panel. Ambos reutilizan Field, Input y ToggleGroup. Los errores conservan el formulario y su contenido; el envío bloquea acciones concurrentes. La revisión de tiempos del completado múltiple usa el mismo formulario. Se retiraron las reglas globales de los antiguos formularios de acciones; se conserva `ds-chip`, todavía utilizado por Salud ETA.

## Visor de nesting unificado (12/09/2026)

La OT y el Plan de fabricación usan `NestingViewer`: cabecera compacta, navegación
Shadcn fija **Layouts / Detalle / Balance de piezas / Archivos** y dibujo
compartido. Layouts aparece cuando el resultado permite agrupar superficies;
Archivos, sólo cuando el proceso aporta descargas. Inspeccionar un layout cambia
a Detalle y selecciona su sustrato, sin abrir otro modal. Se conserva la selección
al volver a una pestaña; un resultado nuevo reinicia la navegación.

La vista inicial depende del contenido, no del algoritmo ni de la pantalla de
origen: varias superficies agrupables abren Layouts; una superficie, rollos,
talonarios e imposición de cuadernillos abren Detalle. Un dibujo que representa
varias hojas indica explícitamente el rango y la cantidad de repeticiones.

`nesting-canvas.tsx` concentra geometría, paleta, márgenes, capas de fabricación,
solapes e imposición. Galería, detalle y simulación manual de Colas reutilizan ese
componente. La simulación conserva su selector de anchos y tabla de piezas; su
rollo ahora sigue la misma orientación vertical y escala por ancho del visor OT,
con desplazamiento para rollos largos. Esto reemplaza la presentación horizontal
anterior. La conversión de Colas sólo adapta el resultado calculado al dibujo.

Los datos de cálculo y configuración quedan plegados en Detalle. Las instrucciones
de imposición, talonarios y carga especial permanecen visibles. El balance cuenta
las repeticiones y muestra también las demandas sin colocaciones.

Los estilos son CSS Modules (`nesting-explorer`, `nesting-canvas` y
`nesting-viewer`) con el tema compartido. Se retiraron las reglas globales del
visor anterior, la paleta y el SVG propios de la galería, el SVG independiente de
Colas y los estilos de navegación/ampliación anteriores del plan. El selector de
sustratos monta su desplegable dentro del visor para respetar el diálogo padre.
Los archivos de fabricación conservan sus exportadores de geometría real; no se
exportan los adornos de la UI como instrucciones de corte.

## Ficha de OT: datos laterales (prueba, 12/09/2026)

La ficha de creación y el detalle de OT prueban una columna izquierda interna,
independiente del menú de la aplicación. Reúne identidad, estado, fecha de
creación/emisión, acciones rápidas, recorrido de estados, cliente, campaña,
vendedor, canal y entrega/ETA. Las pestañas comienzan arriba del área de trabajo.

- `OrdenWorkspace` organiza dos áreas con scroll independiente. El botón
  **Datos** pliega la columna sin desmontar sus campos en escritorio.
- Bajo 1024 px, los datos se abren en un Sheet izquierdo, con título, cierre,
  foco y contenido conservado al cerrar. El ancho de escritorio es 272 px
  (244 px entre 1024 y 1279 px).
- La campaña tiene etiqueta y nombre visibles, en lugar de un icono aislado.
- El resumen financiero permanece al pie del contenido. Sus container queries
  consideran el ancho restante después de ambos laterales: ocultan el desglose
  secundario cuando no cabe y pasan las acciones a otra fila en móvil.
- Composición en `orden-workspace.module.css`; no se modifica el menú global.
  Los campos conservan los handlers, permisos y cálculos de la ficha.
- Se retiran la familia global `orden-meta` y los estilos de campaña exclusivos
  del botón cuadrado. `orden-head`, `orden-form` y `ofield` siguen atendiendo
  PresupuestoDetalle; no se borran sus estilos compartidos.

Esta distribución queda como prueba visual para evaluar con el usuario, sin
convertirla todavía en el patrón obligatorio del resto de las pantallas.

### Canal de venta: elección explícita (12/09/2026)

En el lateral, `CanalVentaSelector` reemplaza al desplegable: ToggleGroup de
selección única con cinco iconos, tooltips, navegación por teclado y nombre
seleccionado siempre visible. Usa las primitivas y el tema del workspace;
`canal-venta-selector.module.css` sólo distribuye los botones.

- Opciones: WhatsApp, Presencial, Correo electrónico, Web y Aplicación móvil.
  Describen por dónde llegó el pedido; no el dispositivo usado por el vendedor.
- Una ficha nueva empieza sin canal. Guardar borrador, emitir OT y emitir
  presupuesto exigen la elección antes de persistir snapshots o crear registros.
  El error abre los datos, enfoca el selector y aparece junto al campo.
- El canal elegido no se desmarca por tocar nuevamente el mismo icono.
  Sí puede cambiarse por cualquiera de los otros canales.
- Se conserva `mostrador` como identificador de Presencial. `telefono` y
  `vendedor_externo` siguen visibles en históricos y pueden conservarse al
  editar; no son opciones para nuevas asignaciones. Un canal ausente se muestra
  como **Sin indicar**, nunca como Presencial.
- La API exige un canal activo en altas. En PATCH, omitirlo conserva el dato;
  mandarlo vacío o nulo se rechaza. Las OT en estado comercial sin canal deben
  completarlo para guardar o emitir. En producción se conservan los permisos
  existentes: no se obliga a modificar un campo que ya no es editable.
- La conversión interna de un presupuesto histórico conserva su snapshot,
  incluso si no tenía canal. La OT resultante queda en borrador y exige
  completar el dato antes de emitirse.
- Retiro: se elimina `CanalVentaSelect` y su CSS exclusivo del desplegable.
  Los estilos del buscador de clientes conservan consumidores y permanecen.

Validado con OT temporal en el navegador (sin guardarla), campo vacío,
plegado del lateral, móvil a 390 px, selección única y teclado. Contrato de
validación, históricos, edición y emisión cubierto por las pruebas de canales
del frontend y de la API.

## Desglose de ítems de OT (12/09/2026)

Las cuatro pestañas del ítem usan Tabs de Shadcn y el tema del workspace:
**Especificaciones / Costos / Flujo de producción / Aprovechamiento**. Ocupan todo el
ancho del renglón, sin la sangría anterior de 72 px. Las acciones Editar y
Descuento acompañan la navegación y pasan de fila cuando falta ancho.

- Especificaciones: grilla adaptable, etiquetas secundarias, datos completos
  con salto de línea y componentes plegados inicialmente. Se mantienen medidas,
  materiales, opcionales, brief y planificación de entregas.
- Costos: composición del precio y margen de contribución en paralelo cuando
  caben; explicación del margen plegable. Tablas con tipografía sans, cifras
  tabulares, bordes sutiles y detalle de operaciones expandible.
- Producción: ruta, tiempos y notas del taller. El gráfico crece con sus nodos,
  sin altura mínima de 330 px ni cuadrícula decorativa.
- Aprovechamiento: visor compartido de layouts, detalle, balance y archivos;
  selector de proceso/componente, panelizado, bastidor 3D y preparación de
  archivos de corte. El acomodo de pliegos en la hoja de compra también se
  consulta aquí. Costos conserva sus importes y consumos, sin otro visor.
- La selección de lote se comparte entre Producción y Aprovechamiento. Se carga
  únicamente su snapshot al abrir la vista; los lotes mantienen paneles de
  consulta y sus cantidades propias, sin editar el layout del ítem raíz.
- Ampliación, hoja de compra y editor de paneles usan Dialog y el tema del
  workspace dentro del portal. Cálculos, permisos y recotización se mantienen.

Composición en `orden-item-detalle.module.css` y `orden-item-costos.module.css`.
Se migraron también los módulos de componentes, lotes y hoja de compra. Se
retiraron las familias globales exclusivas de subpestañas, especificaciones,
extras, flujo, notas, nesting y editor de paneles. La cascada de precios y tabla
principal globales siguen atendiendo **Costos de la OT**; se conservan hasta
migrar esa vista. No se crean clases globales nuevas.

Validación de esta migración: OT de vinilo, panelizado de 2 piezas, producto
compuesto con 4 lotes, cambio de lote entre pestañas, ampliación, acceso a SVG/DXF
y pantallas de 1440 y 390 px. El resumen de costos mantiene su ancho en móvil;
la tabla extensa desplaza sólo su propio contenido. Se consultaron las órdenes
sin guardar cambios. Pasan 27 pruebas de workflow, visor, pliegos, componentes y
entregas, TypeScript, lint focalizado y CSS guard. Tema oscuro pendiente de
comprobación visual específica.

### Ajustes de la ficha (12/09/2026)

Se retira la frase de ayuda de la nueva OT y el mensaje del canal sin seleccionar.
`OrdenCampoLabel` comparte icono, tamaño y color entre Cliente, Vendedor, Canal
y los demás datos laterales. El canal continúa sin valor inicial y conserva su
validación al guardar. La selección se reconoce por el icono, borde y fondo
suave con los tokens `signal` / `signal-bg`, sin repetir el nombre debajo.
Los cinco botones tienen cursor de mano, tooltip y estado accesible
`aria-pressed`. Los errores y la aclaración de canales históricos se conservan.

La ficha nueva omite «Creado hoy». En una orden guardada, la fecha de emisión
(o de creación si sigue siendo borrador) queda al pie del lateral, después de
todos los datos. El lateral conserva su desplazamiento independiente.

**Agregar cargo** se concentra en la barra financiera como acción de icono con
tooltip, junto a las acciones de descuento y cupón. Se retiran los accesos
duplicados de la cabecera y del listado de cargos. **Impresiones** reemplaza el
nombre Carga rápida; mantiene el rayo, el atajo C y la apertura del cotizador.

**Fechas del lateral:** la etiqueta del compromiso siempre es «Entrega prevista
de OT», sin la frase «Última entrega de todos los ítems de la orden». Debajo,
una sección separada muestra **Producción estimada**, **Entrega sugerida** y
**Margen de producción**, cada uno con icono, etiqueta de 12 px y caja de consulta
del mismo alto que los campos anteriores. Las cajas de consulta no son controles
editables ni tienen hover de botón. Las fechas se muestran como DD/MM/AAAA, sin
hora, usando el día del taller; el margen muestra N día(s) hábil(es). La ETA
incompleta se informa como «Sin estimación completa». Se conservan los motivos y
advertencias de margen/atraso, y la edición de la fecha comprometida mantiene
sus reglas existentes. Los horarios completos siguen disponibles en las vistas
de producción y planificación.

El avance general de la OT se muestra únicamente en la pestaña **Producción**
de la orden, mediante `ProduccionOrdenTab`. Se elimina su duplicación debajo de
Productos. La pestaña interna del ítem se llama **Flujo de producción**, para
distinguirla del seguimiento operativo de la orden.
