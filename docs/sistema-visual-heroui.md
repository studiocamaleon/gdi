# Sistema visual · HeroUI y utilidades

**12/09/2026 · Piloto implementado en la ficha de Orden de trabajo.** Enfoque
autorizado y bases aprobadas: **botón C · Degradado cálido · Suave · Compacto**,
**T2 · A3 · S2 · G4 · C2**. La referencia de OT enviada a las 21:30 actualiza su composición según el registro siguiente.

## Dirección visual

Una interfaz de trabajo sobria: fondo neutro, superficies blancas, bordes finos,
naranja de Grafoprint en selección y acción principal. El naranja se toma del token existente `--side-accent` (`#ff6a2b`); las acciones principales usan el degradado cálido aprobado con letras blancas. Las selecciones suaves usan una variante naranja más oscura en tema claro. El color de estado siempre
acompaña texto. La tipografía sigue siendo Geist y los importes usan cifras
tabulares. El tema tiene variante clara y oscura.

| Elemento | Convención inicial |
| --- | --- |
| Tema | `src/components/design-system/theme.module.css`; una fuente de tokens |
| Colores | `background`, `surface`, `foreground`, `muted-foreground`, `border`, `accent`, `success`, `warning`, `danger` |
| Espaciado | Escala Tailwind: 4, 8, 12, 16, 20, 24 y 32 px |
| Tipografía | OT: título 30 px, secciones 20 px; contenido 13–14 px; ayuda 11–12 px |
| Superficies | OT: borde de 1 px, paneles de 9 px y estado vacío de 12 px; campos de 10 px |
| Botones | `ActionButton`: C cálido, suave y compacto por defecto; variantes nativas de HeroUI |
| Navegación y selección | `NavigationTabList` T2, `SegmentedControl` G4 e `IconChoiceGroup` C2 |
| Identidad | `IdentityAvatar` A3: iniciales blancas sobre degradado cálido |
| Información financiera | Resumen separado del scroll de productos; desglose visible también en móvil |
| Responsive de OT | Resumen derecho de 250 px, debajo del contenido hasta 899 px; Datos es una pestaña y la navegación tiene scroll horizontal |

No repetir hexadecimales en vistas. Las excepciones de geometría van en un CSS
Module pequeño, con un propósito concreto. Preferir clases semánticas como
`bg-surface`, `text-muted-foreground` y `border-border`.

## Responsabilidades

| Capa | Responsabilidad y ubicación del piloto |
| --- | --- |
| Servidor | Las páginas `comercial/crear-propuesta` y `produccion/ordenes/[ordenId]` mantienen carga inicial, sesión y permisos. |
| Dominio | Cálculos y snapshots en `src/lib/`. `orden-productos-presentacion.ts` concentra el formato monetario extraído sin cambiar las fórmulas. |
| Controlador comercial | `propuesta-ficha.tsx` mantiene edición, recotización, guardado, emisión, permisos y orquestación. Aún es grande y debe seguir dividiéndose por casos de uso. |
| Estado de consultas | `use-clientes-orden.ts`: búsqueda remota, demora de 220 ms, resultados vigentes y caché por ID. |
| Estado de tabla | `use-orden-productos-table.ts`: ordenamiento, visibilidad de columnas e identidad de filas. |
| Composición | `OrdenWorkspace`, `OrdenTabs`, `FieldCard`, `ClienteLista` y `CampanaSelectorOrden`, `OrdenProductosTable` y `ResumenBar`. Reciben datos y callbacks; no habilitan permisos propios. |
| Primitivas | HeroUI 3.2.5. `ActionButton` aplica la base aprobada y el tooltip con tema, preservando la API del proveedor. |
| Estilos | Tailwind 4 para composición, tokens compartidos y CSS Modules para grid, tabla y resumen. |

Los Server Components no eliminan la necesidad de componentes cliente:
selección, formularios y tablas interactivas conservan una frontera cliente
explícita. No trasladar autorización al navegador ni hacer fetch desde una
celda para suplir datos ausentes.

## Botones: base aprobada

El usuario eligió **C · Degradado cálido · Suave · Compacto** el 12/09/2026.
`theme.module.css` concentra los tokens `--action-*` y
`action-button.module.css` aplica su presentación. No copiar el degradado ni
crear clases de botón específicas de cada pantalla.

| Propiedad | Contrato |
| --- | --- |
| Acción principal | `variant="primary"`, degradado de `#c8440d` a `#a83208`, 115°, texto blanco |
| Forma | Radio de 10 px para todas las variantes |
| Tamaño predeterminado | `size="sm"`: alto 32 px, padding horizontal 12 px, texto 13 px, peso 600 |
| Tamaños explícitos | `md`: 38 px y `lg`: 44 px; usar sólo cuando la superficie lo requiera |
| Acciones secundarias | S2: `variant="outline"`, fondo transparente, borde neutro de 1 px y texto de primer plano; `tertiary` mantiene compatibilidad con esta misma presentación |
| Otras jerarquías | `secondary` conserva la selección cálida (por ejemplo, condición fiscal); `ghost` mantiene acciones discretas |
| Acciones destructivas | `danger` / `danger-soft`; conservar su semántica de color |
| Foco | Un solo contorno continuo de 2 px, sin separación ni doble anillo |
| Interacción | Desplazamiento sutil del degradado en hover/press; estados de HeroUI y movimiento reducido preservados |

La primitiva conserva callbacks, refs, `isDisabled`, `isPending` y `className`
dinámico de HeroUI. La ficha de OT y su catálogo comparten este botón: agregar
producto (también en vacío), emitir, guardar cambios y editar usan la acción
principal. La referencia posterior agrega `tone="neutral"` para Emitir OT y Agregar producto de cabecera, con tokens compartidos `--action-neutral-*`. El CTA inicial conserva C cálido; Guardar borrador usa contorno y tamaño `lg`.
Las siguientes migraciones adoptan esta misma base; las superficies heredadas
se sustituyen dentro del alcance de cada migración.

## Componentes: base aprobada T2 · A3 · S2 · G4 · C2

El usuario confirmó esta combinación el 12/09/2026. La ficha operativa y la
muestra de `/dev` reutilizan las mismas primitivas; no duplicar su CSS en vistas.

| Código | Presentación | Primitiva compartida |
| --- | --- | --- |
| T2 | Pestañas sin cápsula, texto naranja activo y línea inferior de 2 px | `NavigationTabList` dentro de `Tabs` de HeroUI |
| A3 | Avatar de 32 px, radio de 10 px, degradado cálido e iniciales blancas | `IdentityAvatar` |
| S2 | Botón secundario con contorno neutro, fondo transparente y geometría compacta | `ActionButton variant="outline"` |
| G4 | Base gris con segmentos suaves; seleccionado con degradado y texto blanco | `SegmentedControl` |
| C2 | Iconos de 32 px con contorno y radio de 10 px; selección naranja tenue | `IconChoiceGroup` |

Los tokens `--action-*` concentran el degradado y las medidas compartidas.
Cada primitiva tiene un CSS Module acotado a sus slots y usa la interacción
nativa de HeroUI. Las pestañas y opciones tienen un único foco interior de 2 px.
Los tooltips conservan alcance y apariencia mediante `useDesignScope`.

`OrdenTabs` conserva permisos y contadores; `OrdenSegmented` limita los valores
válidos del documento; `CanalVentaSelector` conserva las claves de dominio,
validación y canales históricos. Esas reglas no pasan al sistema visual.
Cuando se reutiliza un único `Tabs.Panel` para la sección activa, usar `key`
e `id` con la clave seleccionada para mantener el vínculo `aria-controls`.

Verificación de esta adopción: ficha operativa en escritorio y combinación en
claro/oscuro; catálogo de 390 px sin desborde horizontal; selección con teclado,
pestañas con panel accesible y controles deshabilitados. TypeScript, lint y
las pruebas de presentación/aislamiento CSS pasan. El guard mantiene 40.456
líneas y 1.311 clases globales; no se añadieron estilos a `globals.css`.

## Tablas y volumen

TanStack Table 8.21.3 administra el modelo; el marcado semántico de la tabla y
HeroUI presentan las celdas y controles. No se superponen dos administradores
de selección, filtrado o paginación.

En una OT se necesita la colección completa para cotizar. El ordenamiento y el filtro son locales y sólo cambian la vista. La referencia más reciente reincorpora el título “Productos de la orden” y el buscador. Con la orden vacía, Enter abre el catálogo con la consulta; con ítems, filtra la tabla. Los filtros se memorizan por consulta: no pasar arrays nuevos por render a TanStack, porque su reset de paginación puede provocar recálculos continuos. Los totales, el guardado y la
recotización reciben siempre los ítems originales. Las filas se identifican
por `item.id`; al ordenar, el detalle, las acciones y el tomo siguen asociados
al producto correcto. El total se ordena por el importe que se está mostrando,
incluido el modo sin comprobante.

Este piloto **no incorpora virtualización** ni carga masiva de todo el sistema.
Para listados grandes, medir primero con datos representativos y aplicar
paginación, búsqueda y ordenamiento en servidor. Agregar TanStack Virtual
cuando el costo sea el DOM, después de medir; Table por sí solo no virtualiza.
Mantener una única fuente de verdad para esos estados y las URL de consulta.

## Coexistencia y portales

La raíz migrada lleva `data-ui="heroui"` y `theme.theme`. Los componentes del
proveedor se importan por necesidad en `src/styles/heroui.css`, dentro de
`layer(components.heroui)`. No importar `@heroui/styles` completo: su reset y
su tema global pueden afectar pantallas que todavía usan estilos anteriores.

`scripts/postcss-heroui-scope.cjs` limita esa capa con `@scope`. Contempla tanto
descendientes como raíces de portales y preserva las animaciones del paquete.
Esta integración requiere navegadores con soporte de CSS `@scope`.

Cada modal, popover o tooltip portaleado recibe también la clase de tema y
`useDesignScope()`. Por defecto se hereda `.dark` del shell; `DesignSystemProvider`
permite aislar la apariencia de un catálogo, manteniéndola incluso en portales. Este proveedor también fija `es-AR` para los anuncios accesibles de React Aria.
Al añadir una primitiva, revisar sus dependencias CSS (por ejemplo, las pestañas
requieren `scroll-shadow.css`). Verificar el portal, no sólo su disparador.

El tema define `--z-index-overlay: 100000`: es la capa que HeroUI normalmente
aporta en su base global, que aquí no importamos. Modal y Drawer deben compartir
ese valor con los popovers de React Aria; el orden de montaje deja los selectores
sobre el modal que los abrió. No poner valores distintos por vista. Así la
transparencia cubre todo el viewport, incluido el sidebar y las cabeceras. Esta
corrección aplica a Campañas, Panel general, búsqueda y sheets HeroUI sin cambiar
el diseño del sidebar ni agregar reglas a `globals.css`.

Shadcn y los módulos existentes siguen sosteniendo las superficies no migradas.
El [contrato de Colas](sistema-visual-shadcn.md) conserva sus reglas operativas;
la vista principal migra a HeroUI el 14/09/2026, como se registra más abajo.
Los detalles de producto conservan su propio tema de compatibilidad hasta que
se migren; no modificar defaults globales para hacerlos coincidir.

## Método para cada migración

1. Delimitar la superficie y anotar sus estados, permisos y consumidores CSS.
2. Mantener la carga de servidor y extraer la presentación a componentes con
   props concretas. Separar consultas y estado de tabla de la vista.
3. Reutilizar tema y primitivas. Extraer patrones compartidos cuando exista
   una segunda necesidad real; evitar componentes universales con excepciones.
4. Revisar claro/oscuro, escritorio/móvil, vacío, error, carga, teclado, foco y
   portales. Verificar las reglas de negocio afectadas por cualquier extracción.
5. Retirar los selectores sustituidos después de buscar consumidores en todo
   el repositorio, incluidas clases dinámicas. Las familias compartidas esperan
   al último consumidor. No trasladar bloques muertos a otro archivo.
6. Ejecutar TypeScript, lint relevante, pruebas de invariantes y `css:guard`.
   Bajar la base con `npm run css:guard -- --update`; el comando rechaza aumentos
   de líneas o clases globales nuevas. Registrar resultado y deuda restante.

## Registro del piloto OT

| Superficie | Estado |
| --- | --- |
| Cabecera, datos, selector de tipo, canal y pestañas | Migrados a composición común y HeroUI |
| Selector de cliente y campaña | Listas HeroUI; búsqueda de cliente dentro del desplegable y consulta extraída del monolito. El valor cerrado no es editable. |
| Productos | TanStack Table, ordenamiento, filas expandibles, acciones y estado vacío |
| Resumen financiero | Componente separado, controles HeroUI, desglose responsive; fórmulas conservadas |
| Datos de servidor y mutaciones | Se mantienen las rutas, APIs y reglas existentes |
| Progreso de OT, detalle técnico, costos, pagos, archivos, comprobantes e historial | Conservan componentes de negocio y parte del CSS previo; próximas migraciones específicas |
| `globals.css` | De 41.168 a 40.456 líneas (conteo del guard): **−712 líneas netas**, 100 selectores exclusivos retirados |
| Monolito `propuesta-ficha.tsx` | De 10.172 a 9.041 líneas; todavía requiere extracción de controladores por caso de uso |

Se retiraron los selectores exclusivos de la tabla, el selector de tipo, las
acciones anteriores y `cliente-combobox`/`cliente-option`. Permanecen familias
compartidas como `orden-tabs`, `ofield` y `otd-*` mientras tengan consumidores.
La base anterior del guard estaba desactualizada; su descenso total no debe
atribuirse entero a este piloto.


## Referencia de OT · 12/09/2026, 21:30

El usuario pidió reproducir la imagen `ChatGPT Image Sep 12, 2026, 09_30_47 PM.png`.
La referencia amplía T2 a pestañas con descripción. Los ajustes del 13/09
compactan esa composición y vuelven a eliminar el título y el buscador de
productos. No cambia las reglas comerciales.

- `OrdenWorkspace`: cabecera fija al desplazarse, título de 23 px (20 px en móvil),
  navegación a todo el ancho, contenido y resumen derecho de 300 px (280 px en
  pantallas intermedias). Al crear una orden inicia en Datos; las existentes
  conservan Productos como pestaña inicial. `OrdenDatosSections` compone tipo
  y vendedor en la primera fila, cliente y campaña debajo, y canal de venta.
  La subsección Entrega muestra entrega prevista, producción estimada, entrega
  sugerida y margen de producción en cuatro columnas (dos o una según el
  espacio disponible). No inventa fechas cuando falta una estimación y respeta
  las entregas definidas por producto.
  La altura real de la cabecera define el desplazamiento del resumen fijo.
- `NavigationTabList variant="detailed"`: alto de 56 px con icono y descripción;
  a 1200 px de ancho disponible pasa a 36 px con título y contador. A 950 px
  se distribuye en dos filas, y por debajo de 560 px en tres columnas (dos si
  hay menos de 320 px). No usa scroll horizontal. Conserva la línea naranja,
  selección y teclado
  de HeroUI; los permisos y secciones adicionales de órdenes emitidas se conservan.
  Datos muestra un icono de advertencia mientras falta el cliente, también
  cuando otra pestaña está activa y en pantallas pequeñas. Desaparece al
  seleccionarlo; su ayuda y nombre accesible indican “Falta seleccionar
  un cliente”. El controlador determina el aviso y `NavigationTabList` lo presenta.
- `OrdenSummaryDetails`: cliente, campaña, entrega y vendedor; avatar circular
  en este resumen según la imagen. Los accesos llevan a Datos. A3 sigue como
  base del resto del catálogo hasta una decisión posterior.
- `ResumenBar layout="sidebar"`: un único cálculo, desglose vertical y total
  con los decimales de la moneda configurada. El resumen termina en el total:
  sin “Ajustes de la orden” ni aviso azul. El rótulo es siempre “Total”; el
  resumen no incluye enlaces de cliente/campaña y sólo muestra Campaña cuando
  hay una seleccionada. La selección se mantiene en la pestaña Datos. El
  tratamiento fiscal sigue afectando los importes. `OrdenFinancialActions`
  muestra cargos, tratamiento fiscal, descuentos y cupones como iconos de
  32 px debajo del vendedor y antes de los importes, con etiquetas accesibles
  y ayuda al pasar el cursor. Conserva las condiciones de permisos y estado.
  Cupón despliega el código y el botón Validar debajo de los iconos; Descuento
  abre sólo el ajuste manual. La fila de descuento se destaca con `--danger`.
  Editar/Cancelar y Guardar/Cancelar edición se ubican en la cabecera fija,
  con las mismas condiciones de permisos y estado. Guardar cambios permanece
  deshabilitado mientras se guarda o no hay cambios pendientes frente a la OT
  persistida; usa el mismo contador que el guardado y el aviso de navegación.
  `OrdenSaveActions` usa botones `sm` de 32 px en la
  cabecera fija: emisión con el degradado cálido C y guardado con el secundario S2.
  Emitir permanece deshabilitado si falta el cliente, tanto en creación como
  en borradores existentes. Guardar borrador admite productos sin cliente.
- Productos: sin título redundante, buscador ni contador de resultados. La tabla
  conserva ordenamiento, detalles e importes. El estado vacío sólo ofrece
  “Agregar primer producto” y “Desde un presupuesto”; sin categorías ni
  “Explorar catálogo”. El sheet mantiene su propio buscador.
  Los botones y atajos P (producto) / C (impresiones) comparten la misma
  condición: en una OT existente sólo funcionan dentro de “Editar orden”,
  en estado borrador o pendiente y mientras no se está guardando. Los sheets
  vuelven a validar esa condición al incorporar productos, incluso si una
  cotización termina después de salir de edición. En una orden nueva se
  conservan los atajos; C requiere que el módulo de copiado esté activo.
- El sidebar compartido conserva su diseño original en todas las rutas, incluida
  Crear orden: marca, ancho de 262 px, buscador, grupos, iconos y permisos de
  `navPara`. Sólo comparte el fondo claro de Crear propuesta (`#f8f9fc`),
  definido una vez en `theme.module.css` mediante `--canvas-background`.
  El pie del menú es transparente para mantener ese mismo fondo.
- `DashboardTopbar` adopta la cabecera de la imagen sólo en la ficha OT y Crear
  orden. El buscador superior abre una búsqueda de **secciones** (también con ⌘/Ctrl K),
  no un buscador remoto de registros. Perfil y notificaciones usan sus flujos
  actuales; el cambio de apariencia es local a la sesión del piloto.

Adaptaciones funcionales: “Desde un presupuesto” abre el listado
existente, donde se selecciona y convierte un presupuesto. Guardar y emitir
conservan sus condiciones de habilitación. Los detalles técnicos y sheets
operativos siguen funcionando; H1/H2 permanecen como muestras pendientes de
selección. No se agregaron estilos a `globals.css`.

## Catálogo y validación

`/dev/diseno/sheets` compara **H1 · Continuo** y **H2 · Por secciones**, pendientes
de elección. Incluye 11 casos de producto, buscador, configuración, archivos,
producción y estados de cotización. Ver [cobertura y límites de los sheets](sheets-producto-heroui.md).
El sheet operativo recupera su contenedor de compatibilidad `.ot-v1` mientras
se elige y migra la propuesta.

`/dev/diseno/componentes` reúne **20 muestras HeroUI**, con la base aprobada marcada:

| Familia | Códigos | Alternativas |
| --- | --- | --- |
| Pestañas | T1–T4 | Cápsula neutra, línea naranja, selección cálida, pestañas separadas |
| Avatares | A1–A4 | Círculo suave, cuadrado suave, degradado, contorno discreto |
| Botones secundarios | S1–S4 | Neutro sólido, contorno neutro, naranja tenue, texto e icono |
| Segmentados | G1–G4 | Unido cálido, selección blanca, contorno, selección con degradado |
| Canales de venta | C1–C4 | Iconos circulares, contorno, barra de iconos, icono y nombre |

Cada familia se compara en el mismo estado de selección, con tema claro/oscuro,
teclado y deshabilitado. Los canales incluyen etiquetas y tooltips portaleados
con el tema. Los avatares muestran iniciales y alternativa sin nombre. Una OT
de muestra reúne la combinación elegida y permite copiar sus cinco códigos.
Los códigos C1–C4 se refieren a canales, no al botón principal C ya aprobado.
El catálogo inicia con **T2 / A3 / S2 / G4 / C2**. Las opciones aprobadas usan
las primitivas operativas; las demás mantienen sus estilos y renderizadores
aisladamente en `design-system/preview/`. Todo el estado vive en memoria, sin
APIs ni mutaciones de negocio. Probar otra combinación no modifica la base
aprobada ni incorpora variantes adicionales al sistema.

`/dev/diseno/botones` es un laboratorio exclusivo de desarrollo para elegir el
estilo de los botones. Ofrece seis propuestas: A naranja original con texto oscuro,
B naranja profundo con blanco, C degradado cálido, D degradado coral, E contorno
y F fondo suave. Los blancos usan tonos más profundos de la familia naranja.
Permite comparar tres formas, tres tamaños, tema claro/oscuro y estados de
interacción, carga y deshabilitado, además de las acciones de una OT de muestra.
El catálogo abre con **C / Suave / Compacto**, la base aprobada, y la muestra C
reutiliza `ActionButton` del sistema. Las alternativas A, B, D, E y F permanecen
como exploración en `design-system/preview/`. Cambiar la selección del catálogo
sólo cambia la vista en memoria; no aprueba otras opciones ni guarda órdenes.
No añadir las seis alternativas como variantes permanentes del sistema.

En desarrollo, `/dev/diseno/orden` permite comparar tema claro/oscuro, vacío,
selección de cliente y campaña, ordenamiento, expansión y panel de datos con los componentes reales.
Usa datos explícitamente ficticios y acciones locales. Fuera de desarrollo
devuelve 404; no cambia las reglas de autenticación ni consulta tenants.

Las pruebas del piloto cubren importes sin desglose, impuestos internos y
externos ocultos, descuentos, cargos, unidades decimales y el aislamiento del
CSS del proveedor. PostgreSQL local y el API fueron recuperados; esta revisión visual no emite
ni guarda órdenes reales.

Referencias oficiales: [HeroUI](https://www.heroui.com/docs/react/getting-started),
[TanStack Table v8](https://tanstack.com/table/v8/docs/introduction) y
[Tailwind CSS](https://tailwindcss.com/docs/styling-with-utility-classes).

Revisión anterior a la referencia de las 21:30: naranja de Grafoprint como primario y cliente/campaña como listas. La decisión anterior de ocultar título y buscador queda reemplazada por la imagen más reciente. Verificado en el catálogo: selección por teclado, cancelación de búsquedas de clientes sin perder el valor, cambio de campaña, claro/oscuro y panel móvil sin desborde horizontal.

Foco de los selectores: usar `field-focus.module.css` en el disparador para mostrar
un único borde naranja de 2 px hacia dentro, sin anillo exterior separado ni cambio
de tamaño. Cliente y Campaña comparten este patrón; el foco de teclado sigue visible.

Verificación de la referencia: TypeScript y lint focalizados sin errores, 14 pruebas
de importes/cantidades/aislamiento aprobadas, `css:guard` sin crecimiento. En el
navegador: cambio a Datos desde el resumen, selección por lista y atajo de Stickers
con consulta “vinilo” en el sheet; en `/dev`, filtro y ordenamiento con total
completo conservado, expansión del detalle y tema oscuro a 390 px sin desborde
horizontal de la página. No se guardaron ni emitieron órdenes para estas pruebas.

## Panel general · Administrador · 13/09/2026

Segunda superficie migrada: sólo la vista propia del Administrador. Reutiliza el
marco de OT y los botones C/S2, suma Card de HeroUI con importación scoped y conserva
el sidebar original. Indicadores con iconos, Focus hoy, entregas con TanStack y
columnas de taller/actividad. Sin Agenda en esta fase.

La composición vive en `panel-general/panel-admin-*`; los datos se obtienen en
servidor y la actividad pagina mediante un hook independiente. Los demás roles y
previsualizaciones mantienen su vista. Se retiraron 30 líneas globales sin
consumidores; las familias compartidas con Reportes/Producción permanecen.
Ver [alcance, fuentes y contrato de actividad](panel-general-administrador.md).

## Listado de Órdenes de trabajo · 13/09/2026

Migración exclusivamente visual de `/produccion/ordenes`. El listado ocupa todo
el espacio del contenido, sin el límite anterior de 1.360 px. Comparte con Crear
OT los márgenes laterales de 24 px, 20 px hasta 1.199 y 16 px hasta 639. El título
es de 23 px (20 en móvil), con acciones compactas de 32 px. Sidebar y cabecera
global conservan su implementación.

- Card y Chip de HeroUI presentan indicadores, estados y tarjetas. La tabla
  adopta las superficies, bordes, tipografía y espaciado de Productos de la OT.
- `ActionButton` C/S2, `IdentityAvatar` A3 y `SegmentedControl` G4 reutilizan las
  bases aprobadas. `ActionLink` comparte los estilos de botón de HeroUI y de
  `ActionButton`, conservando el enlace de Next para Nueva orden.
- Los filtros mantienen su semántica de botones y reutilizan los slots visuales
  T2; se acomodan en varias filas cuando falta ancho. La búsqueda usa SearchField
  con el foco de un único borde. La tabla conserva sus siete columnas y contiene
  el desplazamiento horizontal en su propio panel.
- Consultas, debounce, estados, contadores, permisos, paginación en servidor,
  exportación CSV y apertura de órdenes mantienen el controlador existente.
  No se agregó otro motor de filtrado ni ordenamiento.

La presentación auxiliar vive en `ordenes-trabajo-presentacion.tsx`; la geometría
en `ordenes-trabajo-view.module.css`, con utilidades para la composición simple.
Se retiraron **373 líneas y 20 clases globales** sin consumidores. Quedan las
familias `otl-*` compartidas con Presupuestos y el badge utilizado en las fichas.
Base CSS: **40.053 líneas, 1.291 clases globales**.

Verificado en navegador a 1.920, 1.180 y 390 px: tabla, tarjetas, búsqueda,
filtros de estado/atrasadas, vacío y apertura de una OT con teclado. A 1.180 px
entran las siete columnas; en móvil el scroll queda dentro de la tabla, sin
desbordar la página. La ficha y el listado tienen idénticos ancho y márgenes.
TypeScript, lint focalizado, prueba de aislamiento HeroUI y `css:guard` pasan.
La revisión no guardó ni modificó órdenes.

## Listado de Presupuestos · 13/09/2026

`/comercial/presupuestos` adopta la misma presentación que Órdenes de trabajo:
ancho completo, márgenes 24/20/16 px, título compacto, botones C/S2, filtros con
slots T2, SearchField, estados Chip y vendedor con avatar A3. Las cuatro métricas
se distribuyen en todo el ancho disponible. La tabla mantiene sus siete columnas,
la señal de visto y la referencia a la OT convertida.

Para esta segunda adopción se extrajeron `design-system/list-page.module.css` y
`ListMetric` desde el listado de OT, conservando sus valores visuales. Ambos
listados comparten ahora la cabecera, superficies, indicadores, filtros, búsqueda,
estado vacío y paginador. La geometría de columnas y los estados específicos
permanecen en cada módulo. `presupuestos-table.tsx` recibe datos y un callback;
no consulta ni filtra por su cuenta.

El panel de configuración usa Drawer, Input, TextArea y Checkbox de HeroUI,
con tema aplicado al portal. Conserva carga, tipos de campos, límites, valores
por defecto, validaciones y guardado. El cuerpo desplaza su contenido y las
acciones de Cancelar/Guardar permanecen visibles al pie.

No cambian las consultas, permisos por rol, búsqueda con demora de 250 ms,
paginación de 50 registros, refresco cada 15 segundos con la pestaña visible,
cálculos de indicadores ni rutas. La ficha individual y la página pública
permanecen fuera de esta migración.

Se retiraron **449 líneas y 19 clases globales** sin consumidores: la antigua
cabecera/filtros compartidos `otl-*`, el drawer de configuración `pp-dw-*` y las
variantes de badge exclusivas del listado. Se mantienen `otl-inner`, `otl-badge`,
la base `pp-badge` y el timeline utilizados por las fichas. Nueva base:
**39.604 líneas, 1.272 clases globales**.

La revisión visual cubre escritorio, notebook y móvil, vacío, filtros y el panel
de configuración. Como el entorno no tenía presupuestos cargados, la tabla se
verificó con datos ficticios en una ruta temporal eliminada al finalizar, sin
crear registros ni guardar configuración real.

## Campañas · listado y detalle · 14/09/2026

`/comercial/campanas` y `/comercial/campanas/[campanaId]` comparten el ancho
completo, márgenes 24/20/16 px y título compacto de los listados anteriores.
Reutilizan `ListMetric`, Card, botones C/S2, enlaces de acción y avatares A3.
El detalle presenta importes en indicadores claros, hitos, coordinación y
actividad; las pestañas T2 de documentos se acomodan en filas en móvil.

Los formularios de creación, edición, equipo, hitos y vinculación usan Modal,
Input, TextArea, Select y Checkbox de HeroUI. `CampanaDialog` comparte únicamente
el marco visual y el alcance del portal; cada vista conserva su estado y envío.
El cuerpo tiene scroll independiente y las acciones quedan visibles al pie.
`SelectField` entrega al formulario los identificadores originales, conserva
la opción vacía y la validación nativa de campos obligatorios. Su CSS Module
aísla la colisión con la clase `.select` legada sin modificar esa clase global.

Desarrollo documental sólo tiene un consumidor, el detalle de campaña; sus
documentos, revisiones, aprobaciones y formularios adoptan el mismo tema. Su
geometría vive en `desarrollo-documental-panel.module.css`; los formularios
comparten `campana-form.module.css`. Se retiraron del módulo anterior los
indicadores oscuros, botones propios, paleta duplicada y estilos sin consumidores.
El uploader y las explicaciones de progreso siguen usando sus componentes
compartidos: su CSS no se puede eliminar hasta migrar el último consumidor.

Se conservan las consultas, filtros explícitos por Enter/Aplicar, permisos,
estados y transiciones, cálculos, validaciones, payloads, confirmaciones,
vinculación de documentos y refresco en vivo. Las funciones de los tres
controladores se compararon con la versión previa a la migración, sin cambios.
No se incorporó otro motor de tabla, filtrado ni paginación.

Campañas ya utilizaba CSS Modules: esta migración no deja un bloque global
exclusivo que se pueda retirar. `globals.css` permanece en **39.604 líneas y
1.272 clases**, sin crecimiento. La verificación incluye escritorio y móvil,
filtros, formularios, selección y cancelación sin guardar registros, validación
de Cliente/Nombre obligatorios y pruebas del contrato de `SelectField`.

## Acciones comerciales de OT · 14/09/2026

- **Cargos:** `CargoOrdenDialog` reemplaza el sheet heredado por un modal HeroUI.
  Usa `SelectField`, Input, TextArea y `ActionButton`, con importes de neto,
  impuestos y total. Conserva monto fijo, zonas, porcentaje y cantidad por
  precio unitario. `OrdenCargosList` presenta los cargos agregados y su acción
  de quitar con la misma base visual. Los cálculos existentes se extraen sin
  cambios a `src/lib/cargos-orden.ts`.
- **Descuento:** `DescuentoOrdenDialog` contiene únicamente el descuento manual,
  por porcentaje o monto, para el producto o la orden según dónde se abrió.
  Usa el segmentado G4, muestra el neto antes/después y permite quitar el ajuste.
  La recotización, el prorrateo, los avisos de margen y las aprobaciones siguen
  en el controlador de la ficha.
- **Cupones:** el icono despliega `OrdenCuponField` debajo de las acciones del
  resumen. El botón Validar o Enter verifica el código y aplica el plan devuelto
  por `/cupones/validar`. Se comparte ese flujo con el lector global; éste se
  suspende mientras se escribe en el campo. La validación no redime el cupón.
  Se bloquean envíos duplicados y se descartan respuestas si cambió el cliente
  o el carrito durante la consulta. La emisión/guardado espera a que termine.
- **Modales:** `FormDialog` centraliza el contenedor aprobado, el cierre, el
  tema y el backdrop completo. Campañas conserva su API mediante un alias.
  Los avisos de cupón también usan esta base y conservan su cierre automático.
- **Resumen:** el rótulo y el importe de Descuento usan el token semántico rojo;
  no se modifican sus cálculos ni los impuestos.

Se retiraron 218 renglones exclusivos del formulario y listado de cargos de
`globals.css` y el módulo del modal de descuento anterior, ya sin consumidores. La base global
queda en **39.386 líneas / 1.268 clases**, sin estilos globales nuevos.

Verificación: TypeScript, lint focalizado y 20 pruebas de cargos, validación de
cupones, importes, emisión y aislamiento CSS. Revisión visual de los cuatro
modos de cargo, descuento manual, cupón por Enter/botón y modales en 390 px.
Los envíos de formularios se probaron con datos aislados, sin emitir órdenes ni
redimir cupones reales; Crear OT se revisó con su catálogo real sin guardar.

## Planificación: indicadores y controles — 14/09/2026

La cabecera de `/produccion/planificacion` reutiliza `ListMetric`, el segmentado
G4 para Por recursos/Por órdenes, `SelectField`, `SearchField` y `ActionButton`.
Dependencias y Zoom usan Switch y Slider de HeroUI, con sus estilos importados
selectivamente y acotados como el resto del proveedor. Se conserva la cabecera
sin título visible para dejar espacio al calendario.

El tema se aplica sólo a indicadores, agrupación/período y herramientas. El
Gantt, su leyenda y sus paneles de detalle conservan sus estilos y componentes;
no heredan el tema nuevo. Los filtros, fechas, selección, dependencias,
actualización y cálculos permanecen en el controlador existente. El zoom
conserva el rango 25–400 %, pasos de 5 y saltos de 25 con Page Up/Page Down.

`planificacion-header.module.css` contiene sólo la composición del encabezado.
Se retiraron sus reglas anteriores del módulo de la vista; esta superficie ya
no dependía de selectores exclusivos de `globals.css`. No se añadieron globales.
Los márgenes siguen la base de 24/20/16 px. En móvil, los controles se acomodan
en varias filas y la página desplaza verticalmente, conservando un área propia
para recorrer el calendario.

Verificación: 55 pruebas de presentación, geometría, eje laboral, carga y
aislamiento CSS; TypeScript, lint y `css:guard`. Revisión en navegador de
agrupación, búsqueda, períodos, dependencias, filas y zoom con teclado; tamaños
de escritorio, 1280 px y 390 px sin desbordamiento horizontal de la página.


## Colas de trabajo: vista principal — 14/09/2026

La ruta `/produccion/colas` adopta el tema HeroUI y la cabecera/ancho de
`list-page.module.css`, con márgenes de 24/20/16 px. Usa Card para la superficie
principal, Button para elegir máquina, SearchField para ambas búsquedas,
SelectField en móvil y NavigationTabList T2 para estados con sus contadores.
Las pestañas se distribuyen en filas cuando el ancho no alcanza.

La selección de máquina y de filas usa el acento cálido; Chip distingue estados
con texto e icono. ActionButton/ActionLink conservan el diseño compacto aprobado
para actualizar, navegar, seleccionar grupos, limpiar, simular, completar y
paginar. `PasoAccionesProduccion.renderAccion` cambia sólo la presentación de
los botones en Colas; la disponibilidad de acciones y la apertura de sus
formularios siguen en el controlador compartido. El resto de sus consumidores
mantiene la presentación previa.

Se conservan los grupos por material, columnas, medidas de paneles/piezas,
formatos, perfiles, fechas y motivos. La tabla mantiene HTML semántico y
selección controlada; el cambio no agrega ordenamiento, filtros ni nuevas
reglas de compatibilidad. Los tres niveles de selección (trabajo, grupo y
página) mantienen su contrato, incluido el estado parcial y el bloqueo durante
un envío. La barra de selección conserva su espacio al seleccionar o limpiar.
El encabezado de columnas usa la superficie blanca, texto de mayor peso y un
separador inferior para distinguirse de la barra de selección y los grupos
grises. Estado conserva el indicador, responsable y motivos; Acciones ocupa
una columna propia con botones secundarios de 144 × 32 px, apilados y alineados.

El simulador de nesting y los formularios compartidos para tiempos y motivos
conservan su composición y tema en sus portales. Los estados de error, vacío
y carga usan primitivas anteriores con su alcance visual explícito. No se
modifica el gráfico, cálculo, descarga ni ejecución de trabajos.

`colas-produccion.module.css` reemplaza la composición previa sin añadir una
segunda hoja para la misma vista. `workspace-ui.module.css` y el tema anterior
se conservan porque todavía los usan el simulador y otros componentes. No hay
selectores globales exclusivos que retirar; `globals.css` mantiene 39.386
líneas y 1.268 clases, sin crecimiento.

Verificación: pruebas existentes de la cola, medidas, selección, permisos,
acciones, simulación y aislamiento CSS; TypeScript, lint focalizado y CSS guard.
En navegador se revisaron selección, búsquedas, cambio de máquina, filtros y
estados vacíos en escritorio y móvil, sin ejecutar ni completar trabajos reales.

## Estaciones: operación y configuración unificadas — 14/09/2026

`/produccion/estaciones` reúne la grilla operativa que estaba en «Por estación»,
sus tareas y «Mi mesa», la creación/configuración de estaciones, los equipos
compartidos y el calendario del taller. El Tablero conserva «Por items» y
«Kanban»; una preferencia anterior `estacion` se resuelve a `items`.

La vista usa el ancho y los márgenes comunes de `list-page.module.css`, Card,
SearchField, SelectField, Chip y ActionButton con el acento Grafo. La grilla se
agrupa por etapa y permite buscar y consultar estaciones activas, inactivas y
con trabajo. Las estaciones vacías siguen visibles. Cada tarjeta y su detalle
ofrecen un icono de configuración a quienes tienen permiso.

Las tarjetas separan los indicadores Pendientes, Urgentes y En camino en tres
bloques con icono, etiqueta y conteo, visibles también en cero. Los valores
positivos de urgencia y carga futura usan los tokens warning e info; los
bloqueos mantienen su indicador danger. La capacidad y los tiempos se alinean
como etiqueta/valor; máquinas, empleados, equipo y horarios forman otro grupo
con iconos. La próxima entrega tiene una superficie suave que resalta atrasos.
Las tarjetas de una misma fila comparten los renglones inferiores mediante
CSS subgrid: el separador, recursos, equipo, horarios, próxima entrega y
acciones quedan alineados aunque cambie el contenido superior o se envuelva
un texto. Una estación sin entrega conserva el espacio de esa fila, sin
mostrar fechas inventadas. En una sola columna la altura se adapta al contenido.
Este ajuste sólo cambia la presentación, no los cálculos ni los filtros.

`FormSheet` centraliza los formularios laterales con Drawer de HeroUI, alcance
de tema en el portal, fondo que cubre también el sidebar y acciones fijas.
En Equipos, el listado usa un contenedor sin marco exterior: sólo cada equipo
conserva su borde, evitando bordes superpuestos alrededor de la grilla.
Estaciones y equipos conservan sus campos de identidad, asignaciones,
capacidad, disponibilidad y franjas horarias. Los selectores de asignación
usan Autocomplete y mantienen las opciones deshabilitadas y los avisos de
máquinas asignadas a otra estación. `EstacionAsignaciones` reúne el patrón
buscador primero y selección debajo para pasos sin máquina, máquinas y empleados:
un panel con título, contador y filas con icono, nombre, detalle y acción
específica para quitar. Los campos ocupan el ancho disponible; las listas largas
tienen desplazamiento propio, con una altura máxima de 224 px (aproximadamente
cuatro filas) o 32 dvh en pantallas bajas. El buscador y el encabezado quedan
fuera del área desplazable. El mismo límite se aplica a pasos, máquinas y
empleados; se comprobó con cinco pasos en un borrador cancelado.
Las selecciones son borradores hasta guardar y
quedan bloqueadas durante el envío. Se retiraron los estilos locales de chips
anteriores. Los empleados habilitados controlan ejecución y toma de tareas para
operarios con usuario activo vinculado y permiso de ejecución; supervisar exime
de esa asignación. La capacidad humana y el horario se definen en Equipos
compartidos. El formulario explica esta distinción.

El calendario conserva margen, traslado,
corte de jornada, feriados y cierres; sus ajustes mantienen el guardado
inmediato. Un fallo de carga no se reemplaza por valores inventados.

La ruta y el menú requieren `produccion.ver`. La configuración requiere
`produccion.configurar`; la ejecución y «Mi mesa» conservan los permisos y
las estaciones habilitadas por la API. Los recursos de configuración se cargan
sólo para quien puede editar; si la carga inicial queda incompleta, la edición
se deshabilita con aviso. Guardar configuración refresca estaciones, equipos,
calendario y las proyecciones operativas.

`use-produccion-operativa.ts` comparte refresco, notificaciones y acciones entre
Tablero y Estaciones. `produccion-item-view.ts` y `estaciones-operacion.ts`
contienen los modelos de presentación extraídos del tablero, preservando el
ruteo por máquina/paso manual, los trabajos tercerizados y sin asignación, las
colas actuales y futuras y la identidad de la mesa. El detalle de un ítem
continúa reutilizando `ItemDetailSheet`, con su tema previo en un portal propio;
no se rediseñan aquí su ruta ni sus formularios de ejecución. No hay cambios de
base de datos ni de contratos de la API.

Se eliminaron la pantalla de configuración duplicada y su sheet anterior. Las
reglas exclusivas `sta-*`, `est-*`, `cal-*`, `feriados-*` y `load-bar` dejaron de
vivir en `globals.css`: la composición necesaria reside en módulos acotados.
El CSS global baja de 39.386 a 36.748 líneas y de 1.268 a 1.220 clases. Las
familias compartidas por otros consumidores se conservan.

Verificación: 60 pruebas de modelos, permisos de ruta, presentación operativa,
acciones de producción, cola y aislamiento CSS; TypeScript, lint focalizado y
CSS guard. En navegador: grilla, estaciones vacías, tareas/detalle, selectores,
alta y edición canceladas, calendario y equipos. El control de disponibilidad
se comprobó sobre un borrador que luego se canceló. Revisión en escritorio y
390 px: grilla y formularios sin desbordamiento de página. No se guardaron
estaciones/equipos ni se ejecutaron tareas reales durante la comprobación.


### Estaciones: horarios por empleado (14/09/2026)

El formulario concentra la capacidad humana en Empleados de la estación.
Cada fila ofrece un botón de calendario, con `HorarioEmpleadoDialog` y el
`CalendarioEditor` compartido dentro de `FormDialog` HeroUI. El modal avisa
que el horario aplica a todas sus estaciones, conserva acciones visibles y
permite copiar y adaptar un horario existente en el borrador.
Se retiran Equipos, su sheet y su CSS local sin consumidores, el selector de
equipo y Puestos manuales. El calendario operativo y Tiempo entre pasos siguen.
El motor usa empleados y dotaciones; alcance, transición y pruebas en
[Horarios personales](produccion-empleados-horarios-2026-09-14.md).
