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

## Identidad de Grafo · Panel general único (15/09)

El rediseño aprobado del Panel general adopta la identidad de la web mediante
`design-system/brand-theme.module.css`, que compone el tema base. Papel cálido
`#f3f2ee`, superficie `#fbfaf7`, grafito `#101214`, naranja `#ff7546`, Geist y
Geist Mono. El primario de esta superficie usa texto grafito y radio de 7 px;
se resuelve con tokens de `ActionButton`, sin duplicar la primitiva.

Aplicar este tema explícitamente al Panel general de todos los roles y sus
propios portales. Las otras pantallas del sistema mantienen su tema anterior.
Se retiraron las variantes del Panel por rol, el selector y el botón Actualizar;
las consultas conservan los permisos efectivos y el refresco automático. La geometría del panel
vive en su CSS Module: resumen grafito unificado, pestañas T2 con grupos reales
de entrega, alertas/estado de planta y actividad a ancho completo. Detalle y
validación en [Panel general · Administrador](panel-general-administrador.md).

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
- El sidebar compartido conserva el ancho de 262 px (66 px colapsado), buscador,
  grupos, rutas y permisos de `navPara`. El pedido del 15/09 de alinearlo con la
  web reemplaza su presentación anterior: ver «Identidad del sidebar» debajo.
- Corrección aprobada el 15/09/2026: `DashboardTopbar` usa en todas las rutas
  la barra original de Tablero de producción (52 px, colapso de menú,
  notificaciones y cierre de sesión). Se retiró la variante del piloto que
  aparecía en Panel general, Crear orden y ficha OT, junto con su búsqueda y
  cambio de apariencia locales. Perfil, empresa y búsqueda conservan sus
  accesos en el sidebar. El ajuste posterior del 15/09 aplica a la barra el
  fondo claro `--canvas-background` de `brand-theme.module.css`, con apariencia
  clara explícita, texto e iconos oscuros y hover suave. El sidebar sigue grafito.
  Cerrar sesión usa un botón secundario compacto con borde, flecha diagonal de Grafo y
  acento cálido; conserva la acción existente y muestra su estado de carga.
  Se mantiene la regla de ocultarla al imprimir facturas.

Adaptaciones funcionales: “Desde un presupuesto” abre el listado
existente, donde se selecciona y convierte un presupuesto. Guardar y emitir
conservan sus condiciones de habilitación. Los detalles técnicos y sheets
operativos siguen funcionando; H1/H2 permanecen como muestras pendientes de
selección. No se agregaron estilos a `globals.css`.

### Identidad del sidebar · 15/09/2026

Primer paso pedido por el usuario para alinear la app con la web comercial.
`GrafoprintBrand` reproduce sus tres nodos, proporciones, Geist y punto naranja;
la variante de carga anterior mantiene su animación independiente.
`navigation-theme.module.css` concentra grafito `#101214`, papel `#f3f2ee`,
naranja `#ff7546`, superficies, separadores y radio de 7 px de la navegación.
El alcance de estos tokens es exclusivamente el sidebar: no modifica el tema
de los formularios, páginas HeroUI, perfil ni centro de notificaciones.

El menú usa secciones en Geist Mono, botones compactos, submenús con una guía
vertical, selección cálida y foco de teclado naranja. El grupo de la ruta
actual conserva su señal al colapsar. El plan y los días siguen proviniendo de
la suscripción real; se mantienen el perfil, el cambio de empresa, los permisos
y los alias del buscador. En móvil hay cierre explícito y controles más amplios;
el listado desplaza su contenido y mantiene disponibles sus accesos inferiores.
Las transiciones respetan la preferencia de movimiento reducido.

Verificado en Chrome a 1920 y 390 px: selección, búsqueda por nombre y alias de
configuración, vacío, Escape, colapso y apertura de grupos, perfil y notificaciones,
cierre móvil explícito y al navegar. La barra y el sidebar comparten el mismo
fondo; el perfil y las notificaciones conservan su superficie clara. TypeScript,
lint focalizado, las 12 pruebas de navegación/permisos y `css:guard` pasan.
La advertencia de hidratación del texto relativo «Actualizado ahora»/«hace 16 s»
observada durante esta revisión se corrigió en el posterior rediseño del Panel
del 15/09: el reloj inicial parte de la fecha de generación del servidor.

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

## Panel general · Administrador · 13/09, actualizado el 15/09/2026

Segunda superficie migrada, ahora con el diseño de Administrador para todos los
roles. La revisión del 15/09 usa el tema de marca y el marco global de Grafo. Sustituye
Focus hoy por accesos compactos y la tabla de entregas por filas con pestañas
Hoy/Atrasadas/Próximas. La columna derecha reúne atención y estado de planta;
la actividad pasa al ancho inferior. Sin Agenda en esta fase.

La composición vive en `panel-general/panel-admin-*`; los datos se obtienen en
servidor y la actividad pagina mediante un hook independiente. Se retiraron las
vistas por rol y su CSS Module, el selector y el botón de refresco manual. Los
permisos y alcances de datos siguen vigentes. La retirada anterior de 30 líneas
globales se conserva; las familias compartidas con Reportes/Producción permanecen.
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

> Actualización: el listado de tareas descrito en esta primera unificación fue
> sustituido por Lista filtrada por estación; ver «Tareas de estaciones en Lista» más abajo.

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


## Tareas de estaciones en Lista — 14/09/2026

«Ver tareas» en cada card de Estaciones abre
`/produccion/tablero?estacion=<id>&vista=lista`. El acceso fuerza Lista sin
modificar la preferencia guardada de Lista/Kanban. El filtro permanece visible,
se conserva al recargar y la URL se actualiza al cambiarlo o limpiarlo. También
se admiten los grupos «Sin estación» y «Proveedor tercerizado». Los enlaces a
estaciones inactivas o eliminadas mantienen su selección explícita y no
muestran todos los trabajos por error.

Lista conserva una fila por trabajo y elige su próximo paso dentro del ámbito
seleccionado: muestra los futuros como En espera y cambia de paso cuando el
anterior termina. Búsqueda, personal y Asignadas a mí se combinan con estación.
Las cards conservan sus métricas de pasos actuales y carga en camino. Tanto la
carga inicial como el refresco de Estaciones consultan sólo trabajos pendientes;
los terminados se consultan bajo demanda desde el Tablero.

La celda Personal asignado ofrece Asignarme para un paso interno libre y en la
frontera de su ruta, sólo con permisos y estación habilitada. No reemplaza una
asignación automática ni una mesa ajena. Devolver libera únicamente la mesa
propia, incluso después de que la planificación proyecte esa asignación manual.
Se reutiliza la mutación canónica con actualización optimista, reversión ante
error y bloqueo de envíos simultáneos. Abrir la tarea mantiene el detalle y las
acciones compartidas de producción.

Estaciones conserva alta, edición, personal, máquinas, pasos y calendario. Se
retiraron `estacion-tareas.tsx`, el estado de navegación interna hacia su detalle,
el portal duplicado del ítem y más de 300 líneas de CSS exclusivas de esa vista.
No se modificaron contratos, permisos de servidor ni cálculos de planificación.

Verificación: 63 pruebas de navegación, filtros, permisos de asignación,
presentación y carga de Estaciones; TypeScript, lint focalizado y CSS guard.
En navegador se comprobó el acceso desde la card, selección y recarga de
Proveedor tercerizado, el estado vacío de Sin estación, limpieza persistente del
filtro, apertura del detalle y regreso a Estaciones. El sheet de configuración
se abrió y canceló conservando recursos, personal y horarios. Sin errores de
consola; no se ejecutaron tareas ni se guardaron cambios de configuración reales.


## Lista: monitor de producción en vivo — 14/09/2026

La cabecera del Tablero usa un monitor compacto con reloj HH:mm:ss, fecha y
zona horaria del taller, señal de conexión y hora de la última lectura correcta.
El reloj se actualiza cada segundo en su propio componente y no dispara
consultas ni vuelve a renderizar toda la tabla. En vivo requiere SSE conectado
y una lectura reciente; al fallar la lectura o superar 45 segundos sin datos se
muestra Datos sin actualizar. La conexión de respaldo se identifica como
Actualización automática. La cabecera de Planificación conserva su presentación.

Los datos siguen el canal compartido de eventos y el respaldo cada 15 segundos.
El sincronizador evita consultas superpuestas, reúne eventos recibidos durante
una lectura y descarta respuestas anteriores a una mutación local. Tras una
acción, al recuperar foco o conexión, y al terminar un arrastre, consulta el
estado vigente. Las pestañas ocultas suspenden el trabajo. Los terminados siguen
consultándose únicamente bajo demanda.

La Lista recalcula estimaciones, cumplimiento y agrupación al recibir datos y
al avanzar cada minuto, con la precisión visible de sus columnas. Previsto
conserva la referencia persistida; no se desplaza con el reloj. La simulación
mantiene las reglas y los calendarios existentes. Los avatares con iniciales
se sustituyen por el mismo icono compacto de persona usado en En espera.

El fondo naranja de Listo para iniciar depende de que Cumplimiento sea Demorado,
en cualquier sección. Ambas celdas comparten el mismo resultado calculado;
la sección Con retraso ya no determina ese color.

Al cambiar contenido visible, sólo el contenido de las celdas afectadas
desaparece en 120 ms y reaparece en 180 ms. Los fondos, bordes y campos iguales
permanecen estables. Cada columna compara su propia representación; avanzar
Real no anima Previsto ni Personal asignado, y Estado sólo cambia si varía su
texto, responsables visibles o color. Las altas, bajas y cambios de sección no
animan toda la fila. Se conservan claves, foco, grupos plegados y desplazamiento.
Los filtros se aplican sin esperar la transición. Cambios sólo en segundos o
reservas que no aparecen en la UI no generan parpadeos. Se respeta
prefers-reduced-motion. Verificado con 59 pruebas de Lista/tiempos, TypeScript,
ESLint y CSS guard para el ajuste por celdas.

La revisión en navegador detectó que el interceptor de JSON compartido intentaba
modificar las cabeceras después de abrir SSE (`ERR_HTTP_HEADERS_SENT`). Ahora
omite las rutas SSE, que conservan su transporte de eventos. El inicio y los
latidos usan el cursor real; al reconectar se confirma el canal y se recuperan
los eventos posteriores sin adelantar ese cursor artificialmente.

Verificación: 97 pruebas frontend y 8 de API, TypeScript, build de API y CSS
guard. En Chrome se comprobó el reloj avanzando, la actualización de fechas y
de la hora de sincronización, el estado En vivo y los iconos compactos de
personal. No se ejecutaron pasos ni se modificaron órdenes reales para validar.

### Asignar y reasignar desde Lista · 14/09/2026

La celda Personal asignado incorpora un icono compacto de persona/edición para
supervisión, sin aumentar la altura de la fila. Abre `AsignacionPersonalSheet`
con `FormSheet`, botones, inputs y selección de HeroUI bajo el tema de Grafo,
incluido el portal y la cobertura del sidebar. El listado de personal y el de
impactos tienen altura limitada. Seleccionar no guarda: primero se revisa el
impacto y después se confirma; cambiar la dotación invalida la revisión.
La animación sigue limitada a las celdas cuyo contenido visible cambió.

Verificado visualmente en Chrome con una simulación de Corte láser, sin
confirmar cambios sobre las órdenes reales. Confirmaciones, permisos, capacidad,
concurrencia, auditoría y persistencia se verifican con datos aislados de test.

### Inventario · Materiales y ficha · 14/09/2026

El catálogo y la ficha de materia prima usan el tema de Grafo y el ancho y los
márgenes de `list-page.module.css`. Encabezado, buscador, estados, acciones y
tablas se presentan con el mismo patrón de las vistas comerciales. La creación
se abre con `FormDialog`, con el portal tematizado y el fondo sobre el sidebar.

La ficha conserva sus cinco pestañas y usa `NavigationTabList`, inputs,
selectores, switches y tooltips HeroUI. Variantes, precios e inventario conservan
el desplazamiento horizontal de las tablas; el formulario y las métricas se
adaptan a pantallas pequeñas. Los atributos con varias máquinas o plantillas
usan `MaterialMultiSelect`; las opciones simples usan `SelectField`.

Se mantienen los cálculos, conversiones, validaciones, payloads, consultas y
acciones existentes. `MoneyInput` conserva la máscara monetaria compartida con
presentación local. Los estilos viven en `materiales.module.css`; no se agregan
globales ni se retiran selectores compartidos que todavía tienen consumidores.

Verificado en Chrome: catálogo, búsqueda y vacío, modal, navegación entre fichas,
cinco pestañas, precios, stock y selección de formato con sus dimensiones. Se
revisaron anchos de 1920, 1024 y 390 px sin guardar cambios sobre los materiales.
TypeScript, cuatro pruebas de plantillas/unidades y CSS guard pasan. ESLint sin
errores; conserva las tres advertencias de dependencias de hooks preexistentes.

### Inventario · Biblioteca y edición de costos · 14/09/2026

La Biblioteca de Materiales usa el mismo ancho, márgenes, encabezado y tema de
Grafo. Buscador, selectores de familia/categoría, filtros de instalación, tarjetas
y estados utilizan HeroUI y las primitivas compartidas. Se retiran los controles
decorativos que no tenían acción y los estilos locales reemplazados.

El asistente de instalación utiliza `FormSheet`, con cobertura del sidebar,
foco y cierre compartidos. Sus cuatro pasos usan `NavigationTabList`; nombre,
alias y variantes usan inputs, botones y checkboxes HeroUI. La revisión conserva
el detalle de las variantes elegidas y limita el alto de su listado. Se mantienen
los modos de completar el material existente o instalar una copia, las variantes
ya instaladas y el payload original de instalación.

Editar Costos conserva los borradores, filtros, unidades, cálculo de diferencias
y guardado conjunto. Se actualizan encabezado, buscador, switch, selectores,
precios y agrupación de la tabla. En anchos pequeños la tabla se desplaza
horizontalmente; el mensaje sin resultados queda fuera de ese desplazamiento.
Los estilos quedan en módulos locales, sin agregar reglas a `globals.css`.

Verificado en Chrome: búsqueda de la biblioteca, apertura y cierre del sheet,
selección de variantes y revisión; precios y unidades en borrador, contador de
cambios, búsqueda y filtro de consumibles. Se revisaron diseños de escritorio,
1024 y 390 px. No se instalaron materiales ni se guardaron precios reales.
TypeScript, ESLint de los archivos modificados, las cuatro pruebas de
plantillas/unidades y CSS guard pasan.

### Indicador de navegación · 14/09/2026

La carga entre vistas reemplaza la tarjeta, el spinner y la barra por el
isologo de Grafoprint centrado sobre un velo suave. `GrafoprintIsologo` comparte
la geometría original de nodos con el sidebar, cuya apariencia permanece igual.
`NavigationLoading` anima un pulso de escala, halos tenues y acentos naranjas
en los nodos, usando los tokens del tema y CSS local. El aviso accesible dice
«Cargando vista…»; `prefers-reduced-motion` muestra el logo estático.

Se conservan los tiempos de aparición y cierre del proveedor de navegación.
Vista previa persistente sólo en desarrollo: `/dev/diseno/carga`. Verificado en
escritorio y móvil, y en una navegación real de Tablero a Planificación: aparece
durante la espera y se retira al llegar. TypeScript, ESLint y CSS guard pasan.

### Indicadores de carga unificados · 14/09/2026

Actualización 15/09: `ModulePageSkeleton` y `NavigationLoading` usan el tema de
marca claro, con el mismo `--canvas-background` (#f3f2ee) de las vistas migradas.
El fallback deja de mostrar el fondo frío anterior al completar la carga.
Se conservan el retardo de aparición y la transparencia del aviso global.

El indicador de página se reduce de 120 a 56 px y elimina el texto visible,
halos, resplandor y zoom. Usa el isologo de tres nodos de la web, con conexiones
quietas y un pulso naranja secuencial de 2,4 segundos. El texto permanece oculto
visualmente para lectores de pantalla. Con movimiento reducido, el símbolo es
estático y conserva un nodo naranja. Los indicadores de botones mantienen sus
16 px y heredan el color del control. La geometría compartida también alinea el
símbolo de acceso/registro con el de la web.

`ModulePageSkeleton` reemplaza los bloques grises y registra su montaje en
`NavigationFeedbackProvider`. El proveedor mantiene un único indicador fijo en
el centro de la ventana hasta que finalizan tanto la navegación como todos los
fallbacks de módulo. Cambiar la URL no implica que los datos ya estén listos.
El registro se hace antes de pintar, con limpieza al desmontarse: evita que el
aviso global sea reemplazado por otro logo centrado dentro del contenido. Esto
también cubre acceso directo y fallbacks simultáneos. Reportes utiliza el mismo
fallback; fuera del proveedor, el laboratorio conserva su indicador local.

Verificación 15/09: cuatro pruebas de coordinación de estados y una transición
controlada en navegador con Suspense real. El cambio de URL durante la espera
mantiene un solo logo de 56 px en la misma posición; tampoco se desplaza al
cambiar el ancho del menú, y desaparece cuando el módulo termina. TypeScript y
ESLint focalizado pasan.

`GdiSpinner` y `Spinner` conservan sus interfaces y ahora muestran el mismo
isologo pulsante en formato compacto. Se reemplazan los spinners circulares y
los iconos de actualización que giraban en los controles del sistema. El formato
compacto hereda el color del botón; la carga de página usa el acento naranja en
los nodos. Las condiciones, consultas y acciones siguen siendo las mismas.
Los estilos de giro sin consumidores se retiran de los módulos y de `globals.css`.

Verificado el fallback real del Tablero, una navegación a Planificación con un
solo indicador y su desaparición al finalizar, además de los botones primario y
secundario y el diseño a 390 px. TypeScript y CSS guard pasan; ESLint sin errores,
con dos advertencias preexistentes en productos y diseño vectorial.

### CRM · Clientes y ficha · 14/09/2026

Clientes utiliza el ancho y los márgenes de `list-page.module.css`, con el fondo
compartido del sidebar. Cabecera, buscador, selector de inhabilitados, selección,
menú de acciones, estados y paginación utilizan HeroUI y las primitivas de Grafo.
Los enlaces conservan la navegación a la ficha; importar, exportar, habilitar y
eliminar mantienen sus callbacks y permisos. La confirmación de eliminación usa
`FormDialog` y conserva el aviso y la confirmación explícita antes de ejecutar.

El alta y la ficha comparten los nuevos controles. Datos generales se ordena en
Identificación, Facturación y cuenta corriente, y Contacto principal. Contactos y
Direcciones conservan sus pestañas, selección del principal, eliminación local
y Deshacer. `SelectField` mantiene los valores originales y respeta el modo de
consulta. Los enlaces siguen comprobando si hay cambios sin guardar.

Ficha, Fidelización e Historial utilizan `NavigationTabList`. El panel de ficha
se conserva montado, pero se oculta mediante `data-inert` cuando está inactivo.
Fidelización y su modal de ajuste comparten el tema y la cobertura completa del
sidebar, sin modificar cálculos, movimientos ni autorización para ajustar puntos.

Los estilos específicos viven en `clientes.module.css`; los estilos de dropdown
y menu-item del proveedor se importan dentro de la capa aislada de HeroUI. No se
añaden reglas a `globals.css`: esta superficie no tenía selectores exclusivos
que pudieran retirarse, y los componentes anteriores siguen teniendo consumidores.

Verificado en Chrome a 1920, 1024 y 390 px: búsqueda, selección, menú y cancelación
de eliminación; ficha, pestañas, modal de fidelización, alta en borrador,
contactos, direcciones, selectores, plazo/límite de crédito y foco de validación.
No se guardaron clientes ni se alteraron puntos reales. TypeScript, ESLint, las
cinco pruebas existentes de importación y aislamiento CSS, y CSS guard pasan.

### CRM · Cupones

Cupones adopta el ancho, los márgenes y el fondo de `list-page.module.css`,
con métricas `ListMetric`, buscador HeroUI, `SelectField` para estados y acciones
de Grafo. Se conserva la composición del cupón: cuerpo, talón con QR, muescas
circulares, línea punteada, importe, alcance, vigencia y contador de usos.
El troquel mantiene su máscara, radios y ancho del talón, también en móvil.

Alta, edición, historial, QR y confirmación de eliminación usan `FormDialog`.
Los portales reciben el tema aislado y el fondo cubre también el sidebar.
El alcance utiliza `Autocomplete` con los mismos grupos y búsqueda por palabras
sin acentos; se conservan los catálogos, validaciones, permisos, callbacks y
payloads. Los botones de guardar y eliminar se deshabilitan mientras se procesa
su acción. El QR conserva el código plano y la descarga PNG.

Los estilos quedan en `cupones-view.module.css`, eliminando los selectores
locales reemplazados de cabecera, métricas y modales. No se agregan globales
ni se eliminan estilos compartidos que siguen teniendo consumidores.

Verificado en Chrome a 1920, 1024 y 390 px: listado, formularios, búsqueda de
alcance agrupada, edición con código protegido, historial, QR y cancelación de
eliminación. No se guardaron, pausaron ni eliminaron cupones. TypeScript,
ESLint, CSS guard y las cinco pruebas existentes de cupones y aislamiento
de estilos pasan.

### CRM · Fidelización

La vista general utiliza el ancho, fondo y márgenes de `list-page.module.css`,
con indicadores `ListMetric`, tarjetas HeroUI, estados `Chip`, campos `Input`
y `Switch` para la acumulación. La configuración sigue dentro de la pantalla;
Reglas del programa y Economía de puntos comparten una tarjeta adaptable.
El aviso de equivalencia protegida permanece visible también en móvil.
La tabla conserva los movimientos, fechas, tipos y puntos, con el mismo código
de color positivo/negativo y desplazamiento horizontal acotado a la tabla.

Se mantienen los formatos, los cálculos, el permiso `crm.configurar_fidelizacion`,
los campos protegidos por `conversionBloqueada` y el payload de guardado.
Los estilos locales anteriores se reemplazan en `fidelizacion-view.module.css`;
no se agregan globales y no había selectores globales exclusivos para retirar.

Verificado en Chrome a 1920, 1024 y 390 px: distribución, estados de acumulación,
edición del porcentaje, resumen y bloqueo de la equivalencia. Se restauró el
borrador sin guardar cambios ni alterar puntos. TypeScript, ESLint, CSS guard
y la prueba existente de aislamiento HeroUI pasan.

### Registros · Proveedores

El listado y la ficha utilizan el ancho, fondo y márgenes compartidos de
`list-page.module.css`. Búsqueda, selección, estados, acciones y confirmación de
eliminación usan HeroUI con el tema de Grafo; el modal cubre también el sidebar.
La ficha organiza los datos en identificación, información fiscal y de pago,
contacto principal, contactos adicionales, direcciones e historial. Los campos
usan `Input` y `SelectField`, y las pestañas de contactos y direcciones comparten
`NavigationTabList`.

Se conservan permisos, búsqueda paginada, importación/exportación, validaciones,
payloads, control de versión al guardar y protección de cambios sin guardar.
Los estilos están aislados en `proveedores.module.css`; no se agregan globales.
Los estilos anteriores pertenecen a componentes compartidos con consumidores
vigentes, por lo que no se retiran de `globals.css`.

Verificado en Chrome en escritorio y a 1024 y 390 px: listado, selección,
cancelación de eliminación, ficha, alta en borrador, contactos, direcciones,
selectores y validación del nombre obligatorio. No se guardaron, inhabilitaron
ni eliminaron proveedores. TypeScript, ESLint, CSS guard y las cinco pruebas
existentes de importación y aislamiento CSS pasan.

### Registros · Empleados

Listado y ficha adoptan el ancho, fondo y márgenes de `list-page.module.css`.
El listado utiliza búsqueda HeroUI, selección con estado parcial, avatares de
Grafo, estados `Chip` y acciones compartidas. La confirmación de baja usa
`FormDialog` y su transparencia cubre también el sidebar.

La ficha usa tarjetas, campos y selectores HeroUI para datos personales y
laborales, `NavigationTabList` para direcciones y un editor adaptable para
comisiones. Acceso al sistema mantiene su carácter informativo y la navegación
a Configuración → Usuarios. Se conservan los permisos de consulta de comisiones,
las restricciones de edición de legajos dados de baja, los controladores,
validaciones, límites de campos y payloads originales.

Los estilos viven en `empleados.module.css`; no había selectores globales
exclusivos de esta superficie para retirar. Los campos de texto no aplican
su geometría a los inputs internos de los interruptores.

Verificado en Chrome en escritorio y a 1024 y 390 px: listado, búsqueda,
selección, cancelación de baja, ficha, direcciones, activación de comisiones,
selector de tipo y validación del alta vacía. Sólo se editaron borradores;
no se guardaron legajos, accesos ni comisiones. TypeScript, ESLint, CSS guard
y las tres pruebas existentes de importación y aislamiento HeroUI pasan.

### Costos · Centros de costo

El listado adopta el ancho, fondo y márgenes de `list-page.module.css`, con
búsqueda y período HeroUI, acciones compartidas y una tabla con importes
alineados. En móvil la tabla desplaza sus columnas horizontalmente sin que
las acciones fijas tapen el nombre del centro.

La ficha utiliza `Drawer`, tarjetas, campos y selectores HeroUI. Conserva sus
pestañas de datos generales, gastos, ajustes e historial, con encabezado y
pie fijos. Las planillas de gastos generales, empleados y activos fijos tienen
encabezados, filas y subtotales propios; los importes calculados se distinguen
de los campos editables. Las confirmaciones de eliminación y cambios sin
guardar usan `FormDialog` y cubren también el sidebar.

Se mantienen cálculos de dedicación, cargas, depreciación, valor hora y
prorrateo, permisos, períodos, historial, publicación y payloads de guardado.
Los estilos quedan aislados en `centros-costo.module.css`. Se retiran 564
líneas y 14 clases globales exclusivas, además de las reglas antiguas de
esta ficha en el módulo de configuración; se conservan los selectores que
todavía utilizan Maquinaria y Gastos fijos.

Verificado en Chrome a 1920, 1024 y 390 px: listado, búsqueda y totales
filtrados, ficha, categorías, ajustes, historial, validación del alta vacía,
recálculo de un gasto en borrador y confirmaciones. Se descartó el borrador;
no se guardaron, publicaron, inactivaron ni eliminaron centros. TypeScript,
ESLint, CSS guard y las dos pruebas existentes de período y aislamiento
HeroUI pasan. La consola del navegador no presenta errores ni advertencias.

### Costos · Maquinaria

El listado utiliza el ancho, fondo y márgenes compartidos, con búsqueda,
filtros, estados y acciones HeroUI. La ficha conserva sus pestañas Descripción,
Ajustes e Historial, con encabezado y pie fijos, tarjetas y campos adaptables.
Se actualizan los editores de perfiles, tintas, repuestos, herramientas y
operación de máquina, junto con el alta y las confirmaciones. Los modales
cubren también el sidebar y permiten desplazar su contenido sin perder las
acciones. El buscador de materiales usa ComboBox con búsqueda y selección
acumulativa; su CSS de HeroUI se importa dentro del scope existente.

Se conservan permisos, valores, validaciones, cálculos, filtros paginados,
payloads y protección de cambios sin guardar. Los estilos específicos quedan
en `maquinaria.module.css` y los módulos de los editores; se retiran 1.032
líneas y 36 clases globales exclusivas de Maquinaria, además de sus reglas
anteriores en el módulo de configuración. Se mantienen los estilos que aún
usan Gastos fijos y el selector de corte utilizado en Productos.

Verificado en Chrome a 1920, 1024 y 390 px: listado, filtros, ficha, alta en
borrador, edición de tintas, perfiles de corte, búsqueda de materiales,
interruptores, validación de campos y descarte de cambios. No se guardaron
ni desactivaron máquinas. TypeScript, ESLint, CSS guard y las 18 pruebas
existentes de tóner, tecnologías, operación y aislamiento CSS pasan.

### Costos · Nodos de producción

El listado de Nodos comparte ancho, fondo y márgenes con las otras vistas
migradas. Usa pestañas detalladas, tarjetas, búsqueda, filtro de categoría,
estados y acciones HeroUI. El alta y la confirmación de eliminación usan
FormDialog con portal que cubre también el sidebar. Se conservan las plantillas,
los permisos y las reglas de alta, activación y eliminación.

Las fichas simples usan los controles Grafo para campos, selectores, opciones,
interruptores, ayudas y acciones. `NodosVisualProvider` activa esa presentación
sólo desde la ficha de Nodos: el editor compartido y sus campos conservan sus
primitivas anteriores cuando se abren desde Productos. Los nodos compuestos
ordenan sus operaciones internas en filas adaptables con los mismos campos,
obligatoriedad y acciones. No cambian los cálculos, validaciones ni payloads.

Los estilos quedan en los módulos de Nodos y se retiran las reglas exclusivas
`nodeEditor` del módulo de configuración y los estilos locales obsoletos del
listado/alta. La familia global `pasos-editor-root` se conserva porque sigue
siendo utilizada por el editor de Productos; no se agregan estilos globales.

Verificado en Chrome a 1920 y 390 px: listado y pestañas, alta simple/compuesta,
búsqueda y selección de plantilla, ficha simple, operaciones de un compuesto,
centros productivos, buscador de máquinas y tiempos extra. Los borradores de
prueba se descartaron sin guardar datos. La carga final no presenta errores
ni advertencias en consola. TypeScript, CSS guard, ESLint de las superficies
nuevas y 49 pruebas existentes del editor, reglas y aislamiento CSS pasan.
El lint del editor compartido conserva un error previo de memoización en
`paso-tercerizado-panel.tsx`, confirmado contra su versión anterior; no se
modificó ese cálculo para resolver una migración de presentación.

### Costos · Flujos de producción

El listado, la creación y la ficha utilizan el ancho, fondo y márgenes
compartidos con las otras vistas Grafo. Búsqueda, filtro de estado, vista previa
del recorrido, acciones, campos y estado activo usan HeroUI. El editor visual
conserva sus columnas, secuencias, paralelismos, zoom y arrastre; incorpora
controles Grafo, tarjetas más compactas y colores del tema. El área del diagrama
mantiene su desplazamiento horizontal en pantallas pequeñas.

Los modales de incorporación y nombre de nodo, duplicación, migración de
versiones y eliminación usan FormDialog con el mismo fondo que cubre el sidebar.
La eliminación mantiene la confirmación escrita del nombre. Se conservan las
consultas, permisos, payloads, cálculos de cambios y versionado; los 42 auxiliares
y controladores sin JSX conservan sus cuerpos frente a la versión anterior.

Se retiran 119 líneas y seis clases globales exclusivas de la ficha y su
historial, junto con las reglas de Flujos del módulo antiguo de configuración.
Los estilos propios quedan en `flujos.module.css`, `ruta-form-view.module.css`
y `ruta-workflow-editor.module.css`.

Verificado en Chrome a 1920 y 390 px: listado, búsqueda, estados, alta, ficha,
incorporación y movimiento de nodos, cambio de nombre, aviso de nueva versión
y confirmaciones de copia/eliminación. Los borradores se descartaron sin guardar
datos. La copia sin nombre y la eliminación sin confirmación permanecen
deshabilitadas. La carga final no presenta errores ni advertencias en consola.
TypeScript, ESLint de los tres componentes, CSS guard y las 19 pruebas existentes
de disposición productiva, ocurrencias de componentes y aislamiento CSS pasan.

### Costos · Catálogo de productos: listado, categorías y alta

El alcance aprobado incluye el listado, el explorador de categorías y
subcategorías y el alta; la ficha de productos existentes queda para otra etapa.
Se aplica el ancho completo, fondo y márgenes de `list-page`, con indicadores
`ListMetric`, navegación por tipo, búsqueda y selectores HeroUI. Las tarjetas
conservan sus imágenes y el recorrido categoría → subcategoría → productos.
La duplicación usa `FormDialog`, cubre el sidebar y mantiene la validación del
nombre y el guardado como borrador.

El modo creación del wizard usa `producto-alta-ui.tsx` y `producto-alta.module.css`
para sus tarjetas, controles y ayudas. El modo edición conserva las primitivas
y estilos anteriores. Las medidas tienen campos adaptables, unidades visibles
y acciones agrupadas. Se conservan los valores, conversiones, consultas,
permisos y payloads: los 33 auxiliares y controladores sin JSX mantienen sus
cuerpos respecto de la versión anterior.

Se sustituye el módulo CSS del listado; no se añaden reglas globales. Las reglas
compartidas de modales y del wizard siguen teniendo consumidores en edición.
Verificado en Chrome a 1920 y 390 px: filtros, búsqueda, categorías,
subcategorías, duplicación sin nombre, alta, geometría 3D, medidas múltiples,
selección de predeterminada, eliminación local y producto sin medidas.
Los borradores de prueba se descartaron sin guardar productos. Pasan TypeScript,
ESLint de los componentes modificados, CSS guard y ocho pruebas existentes de
selectores, consultas del catálogo y aislamiento CSS.


### Ficha de producto

La ficha usa el ancho y fondo de los listados de Grafo, navegación HeroUI con enlaces y tarjetas y controles para Identidad, Comercial, Producción, Herramientas y Precio. El menú de rutas, los formularios de creación y renombrado, el estado de publicación y las confirmaciones mantienen sus acciones con superficies HeroUI y portales tematizados que cubren también el sidebar.

`producto-ui.tsx` activa los adaptadores únicamente dentro de `ProductoVisualProvider`. Los componentes de precio, archivos vectoriales y recetas que se comparten con otros editores conservan su presentación fuera de ese contexto. `ProductoEdicion` propaga el modo de solo lectura a los controles HeroUI, incluidos selectores y diálogos. La composición BOM conserva su árbol y el diagrama productivo su disposición y navegación.

Los estilos quedan en módulos CSS. Se quitaron del módulo de la ficha las reglas antiguas sin consumidores y las dependencias de clases globales para los formularios principales; las clases compartidas por otros editores permanecen. No hay cambios de API, fórmulas, reglas de precio ni publicación.

Verificación: TypeScript, ESLint, CSS Guard y pruebas existentes de geometrías, pricing compuesto, SelectField y aislamiento HeroUI. Se revisaron Identidad y Producción con datos reales y los diálogos de rutas; Precio y el modo de solo lectura también se comprobaron con una muestra temporal, luego retirada. La comprobación completa con datos reales quedó limitada por la pérdida de conexión de la API con PostgreSQL local durante la revisión.


## Crear orden · Identidad de marca clara · 15/09/2026

La dirección final mantiene el sidebar oscuro y usa superficies claras en el
módulo, incluido su resumen. `PropuestaFicha` activa `DesignSystemProvider`
con `theme="brand" appearance="light"`. El tema de marca existente sigue siendo
la fuente de colores; `brand-workspace-theme.module.css` adapta sus tokens a los
controles anteriores que conviven con HeroUI. Los portales resuelven la variante
desde el contexto; sin esa selección explícita conservan el tema previo.

Se actualizan cabecera, Datos, resumen financiero, tabla y detalle de productos,
catálogo y configuradores, copiado, cargos/descuento/cupón, Pagos, Costos y vacíos.
El título usa peso 500 y punto naranja; las estimaciones se distinguen de la fecha
editable; los avatares comparten iniciales. La tabla distribuye sus datos en fichas
cuando hay menos de 850 px de contenido, conservando ordenamiento, semántica,
importes y acciones. No se modifican cálculos, permisos, endpoints ni persistencia.

Validación: 79 pruebas de cálculos, entregas, acciones y contexto de tema;
TypeScript, ESLint focal y CSS guard. Revisión visual a 1920, 1366 y 390 px con
catálogo real y un producto incorporado sólo a memoria; formularios financieros
y copiado inspeccionados sin guardar ni emitir operaciones. Las geometrías
especializadas se conservan y no se probaron todas sus combinaciones.
Ver `docs/crear-orden-rediseno-plan.md`.

Comprobación adicional: selector compartido (`SelectField`) e aislamiento de CSS HeroUI aprobados. Cartel Backlight conserva el error de medidas incompletas y bloquea su incorporación hasta completar los datos.


### Refinamiento de Crear orden

La barra de secciones utiliza la variante óptica `tone="graphite"` de
`NavigationTabList`; el resto del módulo permanece claro. Iconos, contadores,
selección naranja y foco son legibles sobre el grafito de marca. Las acciones
de Productos usan primario naranja y secundario de contorno, con tamaños
adaptados al móvil. El estado vacío incorpora una ilustración SVG propia de
paquete abierto, con movimiento reducido respetado. Sin nuevas dependencias
ni cambios en los flujos de negocio.

### Sheet Agregar producto · catálogo y configuración

El catálogo de OT usa `producto-catalogo.module.css`, ilustraciones SVG semánticas
por forma de cobro y cabecera de marca clara con pasos Producto/Configuración.
Búsqueda, categorías y acciones de pie comparten `ActionButton`; se preservan
las condiciones para agregar, agregar otro y editar. Los controles de familias
mantienen su lógica, con tokens optativos para selección y espaciado en
`orden-configurador.module.css`. En móvil las medidas se disponen con rótulos
propios y la cabecera deja de ser fija. Sin cambios en `globals.css` ni en el tema
por defecto de otros módulos o Centro de copiado. Detalle y verificación en
`docs/crear-orden-rediseno-plan.md`, sección 13.

Las ilustraciones del catálogo se asignan por **códigos comerciales estables**
mediante `producto-catalogo-ilustracion.ts`: 39 símbolos, cobertura de las 48
subcategorías y alternativa automática para categorías nuevas. Producto a
medida conserva una imagen neutra según estructura/cobro; compuesto mantiene
su indicador aunque use la imagen de una familia específica. No asociar estas
imágenes a coincidencias del nombre, a IDs individuales ni a reglas de precio.

### Detalle de un ítem de OT

`NavigationTabList variant="inset"` incorpora una navegación secundaria clara con
selección grafito e icono naranja; respeta foco, teclado y movimiento reducido.
Se utiliza con HeroUI Tabs en `OrdenProductoDetalle`, sin cambiar la barra
principal `tone="graphite"`. La fila reutiliza las ilustraciones comerciales.

Los módulos locales del detalle, costos, componentes y brief aplican papel,
monoespaciada y acentos de marca. Los visores técnicos conservan su contenido y
semántica. Los diálogos ampliados y el editor de paneles usan
`useLegacyDesignScope`; el ampliado neutraliza también `translate`, además de
`transform`, para permanecer dentro del viewport con Tailwind 4.

Verificación visual de producto simple y compuesto, escritorio y 390 px,
acciones de edición/descuento, navegación por teclado y vistas ampliadas.
75 pruebas aprobadas; TypeScript, ESLint y CSS guard sin errores. Más detalle
en la sección 15 de `docs/crear-orden-rediseno-plan.md`.

### OT creada: paneles y visor técnico

La OT persistida activa `orden-issued.module.css` además del workspace claro.
`OrdenSectionHeading` unifica los títulos de los paneles operativos. Cobros,
comprobantes, archivos, costos, producción e historial conservan funciones y
permisos; los ajustes legacy están limitados al scope de esa ficha.

`NavigationTabList` adapta más de seis pestañas: iconos sobre el nombre en
notebook y grilla de tres columnas en móvil. No cambia la navegación de creación.
`DocumentosLiberadosOtTab` usa tokens claros de marca y estados semánticos.

Nesting usa `useLegacyDesignScope` en el visor y sus selectores, con fallback al
tema anterior fuera de la marca. `nesting-palette.ts` comparte colores explícitos
entre SVG y leyenda, para preservar exportaciones autocontenidas. Las cotas y
el tamaño visual no modifican la geometría ni las cantidades del resultado.

Validación y límites de QA en la sección 16 de `docs/crear-orden-rediseno-plan.md`.

### Listado de órdenes · marca clara

`OrdenesTrabajoView` activa `DesignSystemProvider appearance="light" theme="brand"`.
Reutiliza `ListMetric` y `list-page.module.css`: la nueva geometría de cabecera e
indicadores es optativa mediante `data-visual="brand"`, sin cambiar la apariencia
de Presupuestos o Campañas. Los colores provienen de los tokens de marca; no se
agregan reglas a `globals.css`.

La búsqueda y el contador de resultados quedan en una franja clara; los estados
usan grafito, iconos, contadores y selección naranja. Los filtros aplicados se
resumen debajo y pueden limpiarse juntos. La tabla es HTML semántico con
encabezados y enlaces nativos por número de OT. Conserva las siete columnas,
con desplazamiento horizontal acotado en pantallas pequeñas. Tabla es la única
presentación: se retiraron la vista Tarjetas, su selector y sus estilos exclusivos
por decisión del usuario.

Se mantienen consultas, indicadores globales, exportación CSV, permisos,
paginación y cálculos existentes. El estado sin coincidencias permite limpiar
filtros; un error de carga conserva su mensaje y acción de reintento. El contexto
de marca también llega al tooltip de avance, accesible por teclado.

QA del rediseño inicial: 1920, 1366 y 390 px; búsqueda de OT 0060 dentro de
Pendiente; limpieza de búsqueda; apertura de la OT 60 y regreso; Producción
(2 órdenes), Entregada (sin resultados) y Atrasadas (7). CSV verificado con las
2 órdenes de Producción y sus 8 columnas. Sin cambios en datos de órdenes.
9 pruebas de tema/avance aprobadas; TypeScript, ESLint focal y CSS guard sin
errores. La muestra disponible tiene 16 órdenes y una sola página: no se
simularon datos para probar una segunda página ni fallos del servidor.

### Presupuestos · listado y detalle de marca (15/09/2026)

El listado y la ficha dedicada activan `DesignSystemProvider` con
`appearance="light" theme="brand"`, también en sus portales. El listado reutiliza
`ListMetric` y la variante de marca de `list-page.module.css`. Búsqueda y contador
quedan sobre papel; los ocho estados se muestran en grafito, con iconos y
contadores. Los filtros vacíos se distinguen de un catálogo sin presupuestos y
pueden limpiarse. La tabla conserva siete columnas y agrega enlaces nativos en
el número para teclado y apertura en otra pestaña. No hay vista de tarjetas.

La ficha usa exclusivamente su CSS Module: cabecera con estado y señal de visto,
ciclo comercial, cinco campos de contexto y la acción disponible según el estado.
`NavigationTabList` con tono grafito y HeroUI Tabs maneja Productos, Conversión e
Historial, incluidos teclado y paneles accesibles. Cuando hay hasta tres pestañas,
la variante detallada mantiene esas columnas en notebook para evitar una celda
vacía. Las navegaciones con más secciones mantienen su distribución anterior.

Productos conserva cantidades, especificaciones, adicionales, descuentos y
valores del snapshot en bloques claros. Su ilustración reutiliza el fallback de
`ProductoCatalogoGlyph` según unidad; este snapshot no incluye la clasificación
comercial necesaria para elegir una subcategoría específica. El resumen financiero
permanece al costado al recorrer los paneles; en móvil pasa debajo. Se conservan
observaciones, fidelización, seña sugerida e importes del backend. La conversión
usa Checkbox de HeroUI y mantiene disponibilidad por aprobación y por ítem ya
convertido. Historial presenta los eventos reales en una lista cronológica.

Rechazo y devolución usan `FormDialog`, `TextArea`, `SelectField` y `ActionButton`;
los motivos, valores enviados y condiciones por rol no cambian. Configuración
conserva sus campos y reglas en un Drawer claro de marca, con cuerpo desplazable
y pie fijo. Los enlaces al PDF y a la vista pública desactivan la precarga para
que no se soliciten antes de una acción explícita del usuario.

QA: listado y ficha a 1920, 1366 y 390 px, búsqueda de PRES-2026-0005, filtro sin
resultados y limpieza, apertura desde tabla, tres pestañas, teclado, importes,
configuración y formulario de rechazo/selector (cerrados sin guardar). Durante
la revisión PRES-2026-0005 pasó a figurar como visto; se desactivó la precarga del
nuevo enlace público. Conserva el estado Enviado, sus 500 unidades y el total
$49.945. No se enviaron, aprobaron, rechazaron ni convirtieron presupuestos.

13 pruebas aprobadas: permisos de aprobación, acciones por estado, conversión
sin pendientes, referencias a varias OT, snapshot/descuentos, tema y formatos.
TypeScript, ESLint focal y CSS guard aprobados. La muestra real tiene un solo
presupuesto enviado; el resto de los estados se verificó con pruebas de render,
sin crear datos reales ni probar una segunda página. La página pública y el PDF
conservan su diseño. No se modificó `globals.css` ni el contrato de la API.

## Campañas · identidad de marca clara · 15/09/2026

El listado y la ficha adoptan `DesignSystemProvider appearance="light"
theme="brand"`, igual que Órdenes y Presupuestos. El alcance incluye los
formularios de alta, edición, hitos, equipo, vínculos y Desarrollo documental;
el sidebar conserva su tema independiente. No se modificó `globals.css`.

- Listado: título con punto naranja, encabezados monoespaciados, indicadores
  compartidos, tabla con enlaces y estados legibles, filtros y contador de
  resultados. Los filtros siguen aplicándose con Enter o Aplicar; se conserva
  el límite y la consulta existentes.
- Ficha: encabezado y acciones separados del ciclo de estado, cuatro importes
  comerciales y seis pestañas grafito: Resumen, Órdenes, Presupuestos, Archivos,
  Desarrollo y Actividad. Resumen es la entrada inicial y reúne avance, hitos
  y observaciones. Actividad conserva los últimos veinte eventos y su orden.
- Coordinación mantiene responsable, fechas y equipo en una columna lateral;
  ahora presenta también la función de cada integrante. Materiales y
  rentabilidad conservan sus mensajes de disponibilidad y los datos de la API.
- Desarrollo mantiene revisiones, aprobaciones, liberación y requisitos de
  producción. Sus tarjetas, estadísticas y formularios comparten la nueva
  identidad. Se quitó la referencia interna «Fase 2» del encabezado.
- El uploader conserva sus funciones y se adapta mediante selectores locales
  de `campanas.module.css`, sin cambiar otros consumidores. No se eliminaron
  estilos compartidos de archivos ni de progreso.
- En notebook los cuatro indicadores siguen en una fila; en móvil pasan a dos
  columnas. Las seis pestañas se distribuyen en dos columnas en anchos pequeños.
  Las tablas desplazan sólo su propio contenedor y los modales conservan pie fijo.

Verificación realizada en CAM-2026-0001, con dos archivos, un documento
controlado, dos revisiones y un hito: listado, búsqueda sin resultados,
recuperación con Enter, filtro de estado, seis pestañas y apertura/cancelación
de formularios. Inspección visual a 1920, 1366 y 390 px. La campaña de muestra
no tiene OTs ni presupuestos vinculados: esas pestañas se verificaron vacías.
No se guardaron registros ni se ejecutaron transiciones, vínculos o aprobaciones.

Los dieciséis controladores async de las tres vistas se compararon mediante
el AST de TypeScript con el código previo: no cambiaron sus payloads, permisos,
confirmaciones ni mutaciones. Se conservaron también el refresco en vivo y las
consultas. TypeScript, ESLint focalizado y doce pruebas existentes de apariencia,
SelectField y progreso aprobados. CSS guard conserva 34.122 líneas y 1.158
clases globales.


## Archivos unificados · campañas y órdenes · 15/09/2026

Primera etapa de unificación de la navegación, sin migraciones ni cambios en
las reglas de aprobación o producción:

- Campañas tiene cinco pestañas: Resumen, Órdenes, Presupuestos, Archivos y
  Actividad. Archivos incorpora **Versiones y aprobaciones** y **Adjuntos
  generales**. Cada grupo muestra la revisión liberada con acceso directo y
  el historial desplegable; las solicitudes pendientes lo abren inicialmente.
- Las revisiones conservan los mismos archivos físicos. Los adjuntos que ya
  pertenecen a revisiones se muestran en el historial y no se repiten en el
  uploader. `actualizarAdjuntosGenerales` conserva esas referencias cuando el
  uploader informa una subida, edición o eliminación. La API sigue siendo la
  autoridad sobre el almacenamiento y las restricciones de borrado.
- El panel de versiones comunica los cambios a la ficha inmediatamente y
  pausa el refresco en vivo durante sus formularios/acciones. El selector de
  nueva revisión ofrece adjuntos aún sin versionar y no generados; sin
  candidatos, el envío queda deshabilitado y se indica dónde subir el archivo.
- Las OTs eliminan la pestaña Documentos. `ArchivosOrdenTab` integra
  `archivos/archivos-produccion-panel` encima de los adjuntos generales y por
  producto. Los controles incumplidos conservan su aviso y se señalan también
  en la pestaña Archivos. Si no hay controles, no se agrega una sección vacía.
  Una consulta fallida se muestra explícitamente, sin declararla cumplida.
- El contador de OT deduplica por archivo físico: una revisión referenciada
  por varios controles cuenta una vez. La carga de adjuntos es independiente
  del panel de controles para que un error no oculte requisitos productivos.
- Se conserva el tema claro de marca y la navegación grafito. En móvil la
  última pestaña de campaña ocupa la fila completa. Sólo CSS Modules; sin
  cambios en `globals.css` ni aumento de sus 34.122 líneas / 1.158 clases.

Verificación: TypeScript, ESLint focalizado, seis tests de conservación de
archivos, conteo y estados de controles, y CSS guard. En navegador: campaña
CAM-2026-0001 con V1 liberada y V2 obsoleta, historial/aprobaciones existentes,
apertura y cancelación de formularios, y OT-2026-0060 con adjuntos generales y
por producto. La OT revisada no tiene controles; los casos pendientes y errores
se verificaron con fixtures de componentes. Revisión visual de campaña a
1920 y 390 px, sin desbordamiento horizontal. No se subieron archivos ni se
crearon, aprobaron o liberaron registros para comprobar la UI.

Alcance pendiente de una etapa posterior: crear grupos/versiones en OTs sin
campaña. El modelo `ArchivoMaestro` continúa requiriendo campaña; no se simuló
esa capacidad ni se cambió el esquema de datos.


## OT · consulta y edición explícitas · 15/09/2026

La ficha existente abre en consulta. `puedeEditarOrden` centraliza el modo;
no sustituye permisos del usuario ni validaciones del estado de la OT.

- Archivos recibe `soloLectura`: no hay input ni zona de subida, eliminación,
  cambio de visibilidad ni restauración desde papelera. Las descargas permanecen.
  El uploader verifica también el modo en sus handlers, cancela subidas pendientes
  al pasar a consulta y descarta el diálogo de borrado.
- El tratamiento fiscal requiere edición tanto por icono como por tecla X.
  El resumen no muestra un lápiz fuera de edición; Datos permanece consultable.
- Pagos y Comprobantes bloquean sus accesos a cobros, facturación, notas de crédito
  y anulación. Compras/Tercerizados permite consultar los estados sin avanzarlos.
  Los componentes compartidos conservan su comportamiento en otros módulos.
- Cancelar OT, emitir un borrador y entregar requieren edición. El aviso de una
  OT recién convertida ofrece «Revisar y emitir», que entra en edición antes de
  confirmar desde la cabecera. No se cancelan ni emiten órdenes con staging
  comercial pendiente; deben guardarse primero.
- Distribuir entregas requiere edición y ausencia de staging. Tras guardar su
  propio formulario se rehidrata el detalle actualizado. Preparación de corte
  se monta sólo al editar: su GET puede generar revisiones persistentes. Los
  gráficos de aprovechamiento y el resto de consultas siguen disponibles.
- Los formularios operativos se cierran al volver a consulta. La ficha permite
  «Finalizar edición» sin cambios comerciales; no ejecuta un guardado vacío.
  Finalizadas/entregadas permiten entrar al modo para las acciones todavía
  admitidas, sin reabrir sus campos comerciales. Canceladas permanecen en consulta.

El guardado de datos/productos sigue siendo staging atómico. Subir archivos,
operaciones fiscales y otros formularios operativos conservan su persistencia
propia; este cambio exige el modo Edición para iniciarlos, no introduce un
sistema de deshacer esas operaciones desde Cancelar edición.

Validación: diez tests de render sobre los seis estados de OT, uploader de
lectura/edición y accesos a cobros de Pagos/Comprobantes; TypeScript y ESLint
focalizado. Navegador en OT-2026-0060: archivos existentes consultables, ausencia
de controles de modificación y tecla X sin cambios, habilitación al editar y
bloqueo al finalizar/cancelar; cobros de Comprobantes sólo dentro de edición.
No se modificaron archivos, importes, comprobantes ni estados durante la QA.
CSS guard conserva la base global, sin cambios de estilo.


## Tablero de producción · identidad de Grafo (15/09)

La ruta `/produccion/tablero` aplica `DesignSystemProvider theme="brand"
appearance="light"`. Reutiliza los tokens de marca del Panel general y de las
OTs: papel cálido, tipografía Geist, códigos monoespaciados, grafito y naranja.
La cabecera conserva el monitor real (reloj por segundo, conexión y última
sincronización), con el punto naranja del título y el reloj en una placa grafito.
Lista/Kanban mantienen selección, flechas de teclado y menú de vista predeterminada;
se presentan en una barra oscura con iconos y descripciones.

Los ocho indicadores, filtros, agrupaciones y todas las columnas se conservan.
Lista usa filas con más espacio, encabezados técnicos y estados suaves con texto;
Kanban conserva las siete columnas, su desplazamiento horizontal y la carga
progresiva. La consulta de terminados sigue siendo bajo demanda. Los selectores,
tooltips y el formulario de personal heredan la marca también en sus portales.

La ficha lateral conserva Ruta, Materiales, Archivos y Actividad según el alcance
del usuario. Se ajustaron tipografía, metadatos, pasos y tabs; los botones de acción
usan `renderAccion` del componente operativo existente. El alcance CSS es local al
Tablero: no modifica el detalle de Planificación ni el de Colas. No cambian el
motor de producción, cálculos, datos, permisos, asignaciones ni sincronización.

Verificación: 109 pruebas existentes de filtros, agrupación, navegación, permisos,
acciones, monitor y sincronización; TypeScript, lint focal y CSS guard. QA de consulta en
Lista y Kanban, búsqueda de OT60, ficha de producto, apertura/cancelación del
formulario de personal y consulta de terminados, sin ejecutar acciones productivas.
Comprobado en escritorio y a 390 px: sin desborde de página, con desplazamiento
propio en tablas/Kanban y pestañas del detalle siempre accesibles en móvil.

## Planificación · identidad de Grafo (15/09)

La ruta `/produccion/planificacion` extiende la marca clara al Gantt y sus dos
paneles con `DesignSystemProvider theme="brand" appearance="light"`. Conserva el
título accesible sin añadir una cabecera visible que quite espacio al calendario.
Los indicadores usan la variante compartida de marca y el primero destaca en
grafito. `SegmentedControl tone="graphite"` es optativo y mantiene su interacción
de radio; los demás consumidores conservan su presentación predeterminada.

El calendario combina cabecera grafito, grilla clara y metadatos monoespaciados.
Operario/atención de máquina usa naranja, operación autónoma verde y esperas
trama; selección y dependencias se destacan sin alterar anchuras ni duración.
Los paneles Trabajo/Fechas/Recurso/Dependencias y Estado de la planificación usan
superficies claras, separación por tarjetas y acciones visibles al pie. El tema y
el alcance HeroUI acompañan los portales; las ayudas del Gantt tienen contraste
explícito para conservar texto claro sobre grafito.

No cambian el controlador, el worker, los cálculos, calendarios laborales, riesgos,
agrupaciones ni selección. Se conservan alturas y offsets del Gantt, anchuras de
columna, zoom proporcional, recorrido y apertura explícita de detalle.

Verificación: 67 pruebas existentes de geometría, vista, entregas, eje laboral y
controlador. QA en escritorio, 1366 px y 390 px: recursos/órdenes, búsqueda OT60,
estado vacío, selección, recorrido, zoom por teclado, desplegar/plegar filas,
período de dos semanas y ambos paneles; sin modificar registros productivos.
El desplazamiento horizontal queda dentro del calendario. TypeScript, lint focal
y CSS guard completan la validación.

## Colas de trabajo · identidad de Grafo (15/09)

La ruta `/produccion/colas` usa `DesignSystemProvider theme="brand"
appearance="light"` en la vista y sus portales. Reutiliza papel cálido, Geist,
metadatos monoespaciados y acentos naranja, con CSS Modules locales. Máquinas
se presentan como tarjetas claras, con selección cálida y una línea naranja;
el contador de la máquina activa ocupa una placa grafito. Los estados usan
`NavigationTabList variant="detailed" tone="graphite"`, con iconos y contadores.
La búsqueda queda debajo de la navegación; la selección muestra su alcance
en una franja que destaca sólo cuando hay trabajos seleccionados.

La tabla conserva todas sus columnas y grupos por material, paneles, modos de
color, fechas, responsables, motivos y acciones. En pantallas pequeñas mantiene
su desplazamiento propio y la selección de máquina pasa al control existente.
No cambian filtros, paginación, URL, sincronización, agrupación, permisos ni
transiciones; tampoco la restricción de layouts bloqueados o materiales mixtos.

El simulador conserva cálculo, recomendación, dibujo proporcional y descarga.
Su presentación combina cabecera y pie persistentes, contenido desplazable,
métricas claras con el primer indicador grafito y detalle en tarjetas. Los
botones usan `ActionButton`; el alcance de marca acompaña el portal. Los
formularios operativos de motivos y tiempos comparten
`produccion-dialog-brand.module.css` bajo el contexto de marca, también desde
Tablero; sus consumidores sin ese contexto conservan el tema anterior.

Verificación: 57 pruebas existentes de Colas, selección, acciones, simulación
y dibujo, más TypeScript, lint focal y CSS guard. QA a 1920, 1366 y 390 px:
navegación entre máquinas, búsqueda OT60, estado vacío, selección por material,
restricción de nesting con selección mixta, simulación de cuatro piezas,
cambio de ancho y consulta de márgenes. Apertura/cancelación del formulario de
bloqueo, sin guardar ni ejecutar acciones productivas. Cabecera y cierre del
simulador accesibles en móvil, con desplazamiento interno del contenido.

## Estaciones · identidad de Grafo (15/09)

`/produccion/estaciones` aplica `DesignSystemProvider theme="brand"
appearance="light"` a la vista y sus portales. Usa la base de listados de marca:
papel cálido, título con punto naranja, tipografía Geist, etiquetas técnicas
monoespaciadas y primer indicador grafito. Las etapas separan los grupos con
icono y línea; las tarjetas conservan todos sus datos y la alineación mediante
subgrid. Carga y tiempos tienen mayor jerarquía; urgencias y bloqueos conservan
sus colores semánticos, y la carga en camino se representa con trama y acento
cálido. «Ver tareas» usa la flecha diagonal de Grafo y mantiene su ruta a Lista.

La configuración de estación y el calendario del taller se presentan en
secciones numeradas sobre fondo claro, con encabezado y acciones fijas. Los
recursos conservan buscador, avisos de pertenencia, listas desplazables y
acciones de quitar. `EstacionAsignacionSelect` obtiene el tema del contexto
también en su portal. El diálogo de horario personal mantiene días, franjas,
copia de horarios y validaciones; su presentación acompaña al formulario.
`FormSheet` y `FormDialog` aceptan `className` optativo en el panel, sin alterar
la presentación de sus demás consumidores.

No cambian cálculos, ruteo, permisos, consultas, sincronización, filtros o
asignaciones. La estación y los horarios personales continúan como borrador
hasta guardar; los ajustes del calendario del taller siguen siendo inmediatos.
Todos los cambios de estilo son locales, sin editar `globals.css`.

Validación: 87 pruebas existentes de permisos de ruta, presentación operativa,
colas, flujo y navegación; TypeScript y ESLint focalizado. QA a 1920, 1366 y
390 px: búsqueda, filtros, estado vacío, tarjetas, apertura y cancelación de
alta/configuración, menú de máquinas, horario personal y calendario del taller.
Se conservaron los registros: no se guardaron estaciones, horarios ni ajustes
del calendario durante la revisión. CSS guard y revisión de diff sin errores.

### Inventario · Identidad Grafo en Materiales · 15/09/2026

Materiales, la ficha, Biblioteca y Editor de costos reciben
`DesignSystemProvider theme="brand" appearance="light"` en sus rutas. El tema
acompaña selectores, tooltips, Nueva materia prima y el asistente de instalación.
No se cambia el shell ni se extiende el alcance a Movimientos o Centro stock.

- Catálogo: encabezado Geist con punto naranja, indicadores de materiales activos,
  variantes y familias, tabla clara y acceso a la ficha con flecha diagonal. El
  estado vacío queda fuera de la tabla para ser legible también en móvil.
- Ficha: cinco pestañas grafito, estado del material junto a Guardar y datos
  generales en secciones de identidad, clasificación/unidades y disponibilidad.
  En escritorio se distribuyen en dos columnas; las tablas conservan su scroll.
  Se actualizan variantes, precios, indicadores de inventario e historial.
- Biblioteca: indicadores, filtros grafito, tarjetas con ilustraciones ampliadas,
  superficies cálidas y acceso diagonal. Su asistente conserva nombres, alias,
  selección de variantes, completar/copia y revisión. Header y footer permanecen
  fuera del contenido desplazable, y los pasos se adaptan al ancho del sheet.
- Editor de costos: grupos de material, unidades y precios con la nueva marca,
  más un indicador de cambios pendientes conectado al contador existente.
- Nueva materia prima: formulario claro en dos secciones numeradas, con la misma
  selección de plantilla y resumen técnico. Crear continúa abriendo la ficha.

Se conservan consultas, validaciones, payloads, conversiones, selección y guardado.
Sólo se agregan indicadores de presentación derivados de los datos ya cargados.
Los cambios están en CSS Modules locales; `globals.css` permanece intacto.

Verificación en Chrome a 1920, 1024 y 390 px: búsqueda y vacío del catálogo,
plantillas del alta, cinco pestañas de la ficha, tablas, filtro de Biblioteca,
asistente hasta revisión, filtro de consumibles y borrador de precio (restaurado
sin guardar). Sin instalaciones, altas ni cambios persistidos durante QA.
TypeScript, cuatro pruebas de plantillas/unidades, CSS guard y diff check pasan.
ESLint no presenta errores y conserva tres advertencias de hooks preexistentes
en la ficha. Sin errores ni advertencias en la consola de la revisión final.

### Inventario · Historial de movimientos · 15/09/2026

La ruta de Movimientos aplica la marca clara de Grafo con su propio proveedor.
Se reutilizan la base de listados, la tipografía y la tabla de Materiales, con
estilos específicos en `movimientos-kardex.module.css`.

Encabezado con punto naranja y acceso a Materiales, sección de registro,
selector HeroUI con búsqueda sin distinción de tildes y contador de resultados.
Se conserva Consultar, la consulta por UUID, el límite de 200 registros y el
refresco automático cada 15 segundos y al recuperar foco/visibilidad. La búsqueda
filtra opciones sin cambiar la variante consultada hasta elegir una.

El historial vacío explica la futura consulta de cantidades, saldos y costos,
con iconografía naranja/grafito y los tipos de movimientos. La variante filtrada
ofrece volver a todas. Se diferencian carga, error inicial y resultado vacío;
se retira la invitación a registrar stock desde Centro de stock.

La tabla mantiene fecha, variante, tipo, origen, cantidad, saldo, costo promedio
y referencia. Incorpora jerarquía de fecha/hora, indicadores semánticos de entrada
y salida, números monoespaciados y desplazamiento horizontal. La API y las reglas
de stock permanecen sin cambios. No se agregan registros ni datos de ejemplo.

Verificado en Chrome a 1920 y 390 px: estado vacío, búsqueda sin tildes y sin
resultados, selección de variante con nombre largo, consulta manual y vuelta a
todas. La tabla con registros queda preparada por código; no había movimientos
reales para su revisión visual. TypeScript, ESLint, CSS guard y diff check pasan.

### CRM y Registros · Clientes, Proveedores y fichas · 15/09/2026

Listados, altas y fichas aplican `DesignSystemProvider theme="brand"
appearance="light"` por ruta, incluidos selectores, menús y confirmaciones.
La presentación común vive en `crm/contactos-workspace.module.css`; cada módulo
conserva sus consultas, formularios y reglas de negocio.

Los directorios adoptan cabecera con punto naranja, acceso diagonal al alta,
indicadores y tablas claras con iconos compactos, tipografía técnica y estados
semánticos. El total corresponde al filtro actual; los indicadores de email y
ubicación se calculan sólo sobre la página cargada y lo indican explícitamente.
Búsqueda, selección, inhabilitados, importación, exportación, eliminación y
paginación conservan sus callbacks y permisos. Vacíos con la primitiva `Empty`.

Las fichas se encabezan con el nombre guardado y un resumen de razón social,
email y cantidad de contactos/direcciones. Datos generales se distribuye en
identificación, fiscalidad y contacto principal con secciones numeradas.
Contactos y direcciones aparecen en paralelo cuando el ancho lo permite y se
apilan en móvil. Las altas reutilizan la misma composición y todos sus campos.

Clientes mantiene Ficha, Fidelización e Historial. Proveedores separa Ficha e
Historial, conservando montado el formulario al cambiar de pestaña. Ambas barras
usan grafito y conservan su número de columnas en móvil. Fidelización presenta
el saldo en grafito y su diálogo con la marca clara. El historial se presenta
como una secuencia de eventos. Se mantienen validaciones, versión de guardado,
protección de borradores y condiciones de sólo lectura.

Verificado en Chrome en escritorio y a 390 px: ambos directorios, búsquedas sin
resultados, filtro de inhabilitados, selección y cancelación de eliminación,
fichas, fidelización y su diálogo, historial, altas y selector fiscal. Un borrador
de nombre de proveedor se conservó al cambiar de pestaña y se restauró sin guardar.
No se crearon, eliminaron ni modificaron registros persistidos o puntos.
TypeScript, ESLint, cuatro pruebas existentes de importación, CSS guard y diff
check pasan. Sin cambios en `globals.css`, la API ni los payloads.

### CRM · Cuenta corriente de clientes · 15/09/2026

La ruta aplica marca clara con `DesignSystemProvider`; la composición se concentra
en `administracion/cuenta-corriente.module.css`. Cabecera con punto naranja,
identidad del cliente, PDF y registro de cobro. Saldo en grafito, órdenes sin cobrar
y condiciones de crédito forman un resumen adaptable al ancho disponible.
Se distinguen saldo deudor, saldo a favor del cliente y cuenta saldada sin cambiar
signos, importes ni precisión monetaria.

El historial conserva Fecha, Concepto, Debe, Haber y Saldo. Usa números técnicos,
estados de cobro y detalle de aplicaciones comerciales/fiscales con un botón
accesible por teclado. Se mantienen los porcentajes facturados y montos sin aplicar.
El diálogo Antigüedad del saldo reutiliza `FormDialog` y muestra los mismos cinco
tramos y valores, con barras proporcionales. El límite conserva su porcentaje,
aviso de exceso, plazo y acceso a la ficha. El estado vacío tiene presentación propia.

Verificado en Chrome en escritorio y a 390 px, con dos cuentas reales, apertura
y cierre por teclado de imputaciones y adaptación móvil. Para deuda vencida,
límite excedido y cuenta vacía se usó una ruta temporal con datos locales, retirada
al finalizar. No se registraron cobros ni se modificaron datos persistidos.
TypeScript, ESLint, las 13 pruebas existentes de moneda, CSS guard y diff check
pasan. Sin cambios en `globals.css`, la API ni los cálculos financieros.

### CRM · Cupones · Marca de Grafo · 15/09/2026

La ruta de Cupones aplica marca clara explícita, incluidas las ventanas de alta,
edición, historial, QR y eliminación. El selector de alcance recibe el tema mediante
`useDesignTheme`. Se conservan la base de listados y sus cinco métricas, con el
descuento mensual destacado en grafito, cabecera con punto naranja y acción diagonal.

Los tickets mantienen las muescas, la separación del talón y el código QR original.
El cuerpo usa papel claro, acento naranja y descuento destacado; el talón grafito
reúne QR y disponibilidad de usos. Código copiable, estados, alcance, fechas y
acciones conservan sus datos y callbacks. El QR mantiene blanco y negro, código
plano y descarga PNG. Los resultados vacíos usan la primitiva `Empty`.

El formulario agrupa sus mismos campos en tres secciones: El descuento, Dónde
aplica y Vigencia y disponibilidad. El resumen de regla usa grafito, los campos
siguen claros y el pie de acciones queda visible al desplazar el contenido.
Historial reúne usos/reservas y cambios con iconografía y eventos legibles.

Verificado en Chrome en escritorio y móvil: ticket, alta sin guardar, monto fijo,
subcategorías agrupadas y búsqueda sin tildes, edición con código bloqueado,
historial real, QR, búsqueda sin resultados, filtro de estado y cancelación de
eliminación. Sin crear, editar, pausar, redimir ni eliminar cupones persistidos.
TypeScript, ESLint, ocho pruebas existentes de cupones/tema, CSS guard y diff check
pasan. Se mantienen permisos, reglas, consultas, paginación y payloads; sin cambios
en `globals.css` ni en la API.

### CRM · Fidelización · Marca de Grafo · 15/09/2026

La vista aplica marca clara con proveedor de ruta y `useDesignTheme`. Cabecera con
punto naranja, estado de acumulación y acción diagonal para guardar cambios.
Los cuatro indicadores mantienen sus valores, con puntos vigentes destacados en
grafito. Se corrige el singular de cliente en el indicador de canjes.

Reglas del programa y Economía de puntos conservan una tarjeta común adaptable.
La introducción explica margen → puntos → beneficio con iconos y el resumen de
configuración. Los controles mantienen superficies claras, estado cálido para
acumulación activa y una explicación visible de la equivalencia protegida. Se
conservan los cuatro campos, su guardado explícito, permisos y bloqueo de conversión.

Movimientos mantiene las fechas, clientes, tipos y variación de puntos. Incorpora
iconos compactos de cliente, cifras monoespaciadas, unidades y un encabezado
adaptado a móvil. El desplazamiento horizontal queda dentro de la tabla; el estado
sin movimientos usa `Empty` con la misma marca.

Verificado en Chrome a 1920, 1024 y 390 px: composición, acumulación activa/pausada,
edición del porcentaje y actualización del resumen, campos protegidos, movimientos
reales y desplazamiento horizontal. El borrador se restauró sin guardar ni alterar
puntos persistidos. TypeScript, ESLint, cinco pruebas de cálculo de fidelización,
cuatro pruebas de tema, CSS guard y diff check pasan. Consola sin errores ni
advertencias. Sin cambios en reglas, formatos monetarios, API o `globals.css`.

### Registros · Empleados · Marca de Grafo · 15/09/2026

El layout de Empleados aplica `DesignSystemProvider theme="brand" appearance="light"`
al listado, alta y ficha. Sus controles y portales leen `useDesignTheme` y
`useDesignScope`. Se reutilizan la base de listados y las piezas visuales de
`crm/contactos-workspace.module.css`, manteniendo el controlador propio.

El directorio incorpora cabecera con punto naranja, acción diagonal, indicadores
de legajos, sectores y cuentas vinculadas; estos últimos dos cuentan únicamente
la página cargada. La tabla conserva todas sus columnas, selección, búsqueda,
paginación, importación/exportación y bajas. Los nombres usan iconos compactos,
las cabeceras usan tipografía mono y el primer indicador se destaca en grafito.

La ficha muestra el nombre guardado y un resumen de estado, sector e ingreso.
Legajo agrupa datos principales e información laboral en dos columnas, direcciones
y acceso al sistema. Comisiones conserva su permiso y todas sus reglas; Historial
muestra fecha completa, hora y responsable. Las pestañas usan grafito y sus paneles
de edición permanecen montados para conservar borradores. Alta utiliza las mismas
secciones, sin Historial. Se mantienen lectura por baja/permisos, restricciones de
campos, control de versión y guardado explícito. La fecha de ingreso se presenta
como día de calendario; el acceso sigue administrándose en Configuración → Usuarios.

Verificado en navegador a 1920, 1024 y 390 px: listado, búsqueda sin resultados,
selección y cancelación de baja, ficha, alta, comisiones activadas en borrador,
historial y direcciones. Los borradores se conservan al cambiar de pestaña y se
descartaron sin guardar datos. Comparación de los 19 controles confirma los mismos
valores, handlers y restricciones; payload, validación y guardado permanecen iguales.
Pasan TypeScript, ESLint focalizado, seis pruebas de importación/tema, CSS guard y
diff check. No se modifica la API ni `globals.css`.


### Costos · Centros de costo · Marca de Grafo · 15/09/2026

La ruta aplica `DesignSystemProvider theme="brand" appearance="light"`, con tema
y alcance heredados en los portales. El listado reutiliza la base de directorios:
cabecera con punto naranja, acción diagonal, indicadores de gastos propios,
centros en período y estructura repartida sobre las filas visibles. Se conservan
todas las columnas, totales, comprobación del reparto y acciones de configuración,
inactivación y eliminación. Los centros usan iconos según tipo y el valor hora
se destaca con acento cálido. El vacío queda fuera de la tabla para mantenerse
visible en móvil; los importes de los indicadores usan una columna en ancho pequeño.

La ficha usa papel claro, pestañas grafito y un resumen de seis valores con el
valor hora destacado. Conserva Datos generales, Gastos, Ajustes e Historial. Las
planillas distinguen entradas editables, importes calculados y subtotales. Alta,
vacíos, confirmaciones y el pie con estado del borrador comparten el estilo.
Los gastos generales, empleados y depreciación siguen siendo carga manual;
no hay vínculo nuevo con nómina ni maquinaria. No cambian los cálculos, precisión,
prorrateo, copias de período, permisos, publicaciones ni snapshots de las órdenes.

Verificado a 1920, 1024 y 390 px: listado, cuatro pestañas, alta, vacíos, búsqueda
y confirmación de salida. En un borrador, aumentar un gasto en $ 1.000 incrementó
el total en $ 1.000 y el valor hora en $ 6,25 para 160 horas; el importe se conservó
al cambiar de pestaña y se descartó sin guardar. Los totales y las tarifas
publicadas conservan sus valores. La comparación de funciones y controles con la
versión anterior confirma el mismo funcionamiento. TypeScript, ESLint focalizado,
cinco pruebas de período/tema, CSS guard y diff check pasan. Sin cambios en API ni
`globals.css`.

### Costos · Maquinaria · Marca de Grafo · 16/09/2026

El layout propio de Maquinaria aplica `DesignSystemProvider theme="brand"
appearance="light"` a listado, alta y ficha. Los portales de consumibles, perfiles,
materiales y ayudas leen el mismo tema. Se reutiliza la base de directorios con
cabecera, punto naranja, acción diagonal, iconos compactos y nombres de los equipos.
Los códigos internos de máquina no se muestran en listados, fichas ni selectores.
El listado reemplaza el engranaje de cada fila por `MaquinariaPlantillaGlyph`:
14 dibujos SVG por plantilla, con volumen, naranja, grafito y papel como en el
sheet de productos. Se asignan por plantilla, tienen alternativa genérica y
son decorativos; nombre y tipo siguen identificando cada equipo. Las miniaturas
ocupan 56 px con dibujos de 50 px y espaciado de fila ajustado para conservar densidad.
Máquinas usa el total filtrado del servidor; Activas y Por completar cuentan sólo
la página cargada. La búsqueda vacía se presenta fuera de la tabla para que sea
visible también en móvil. Se conservan filtros, páginas, estados y permisos.

Descripción, Ajustes e Historial usan pestañas grafito y superficies claras.
La ficha muestra estado, centro y cantidad de perfiles, mantiene la identidad
guardada en su encabezado y destaca la tarifa publicada del centro como consulta.
Operación, capacidades, parámetros, perfiles y desgaste usan tarjetas y planillas
con encabezados técnicos. Herramientas de corte se estiliza localmente, sin cambiar
el módulo compartido que también consume Productos. Los modales de alta, tóner,
tintas y perfiles comparten cabecera, cuerpo desplazable y acciones visibles.

No se modifican plantillas, conversiones, cálculos, payloads, reglas de activación
ni el guardado explícito. Se compararon 31 controles y nueve funciones con la
versión anterior: mismos valores, restricciones y callbacks. La confirmación de
salida se monta fuera de `Tabs`: su colección montaba también una copia del portal,
generando dos diálogos y una salida que no completaba la navegación. Se verificó
un único diálogo y el regreso al listado al descartar, sin guardar datos.

Revisión en navegador a 1920, 1024 y 390 px: listado, filtros, ficha de impresora
láser y corte, pestañas, alta, consumibles, perfil por herramienta y búsqueda de
materiales. Se conservó una edición entre pestañas y se descartaron los borradores
de prueba. TypeScript, ESLint focalizado, 22 pruebas de tóner, tecnologías, operación,
aislamiento y tema, CSS guard y diff check pasan. Sin cambios en API ni globals.css.

### Costos · Nodos de producción · Marca de Grafo · 16/09/2026

El layout de `productos-servicios/pasos` aplica marca clara al listado, alta y
configuración predeterminada. Los controles y portales heredan tema y alcance.
El listado conserva búsqueda, categorías, acciones y permisos; incorpora cabecera
con punto naranja, indicadores del catálogo completo, pestañas grafito, iconos por
categoría y vacíos adaptados a móvil. Personalizadas cuenta plantillas del sistema
con configuración base guardada; Nodos propios incluye simples y compuestos.

`NodoConfiguracionHeader` unifica el regreso al catálogo, identidad y estado.
En configuración base de un nodo simple reemplaza la columna lateral redundante
y libera el ancho para los formularios. Se alinean información básica, ejecución,
condiciones, máquinas, materiales/consumo, nesting, efectos, tercerización, tiempos
y niveles, junto con las acciones de guardado. Los compuestos conservan la lista
editable de operaciones internas con familias, nombres y obligatoriedad.
Las reglas se apilan en móvil y los campos mantienen espacio para sus etiquetas.

El editor sigue compartido con Productos y Flujos: las clases de marca tienen
activación explícita mediante `NodosVisualProvider`; la ruta de producto se incorpora
en la segunda pasada documentada más abajo. `configuracionBase` conserva su función
de comportamiento. Los tokens de consumo usan fallbacks al estilo anterior fuera
de este alcance. No cambian API, payloads,
cálculos, herencias, validaciones ni persistencia. Se compararon 495 atributos de
comportamiento con la versión anterior: se conservan; sólo se agregaron los valores
de los tres indicadores informativos. No se modificó `globals.css`.

Revisión en navegador a 1920, 1024 y 390 px: listado y búsqueda vacía, alta,
compuesto existente, impresión por hoja, corte láser y trabajo manual. Se revisaron
selectores, materiales, condiciones, nesting, tercerización, tiempos extra y niveles
sin guardar datos. Consola sin errores/advertencias. Pasan TypeScript, 72 pruebas
existentes de schema, tiempos, pendientes, reglas y tema, CSS guard y diff check.
ESLint sin errores; conserva 12 advertencias previas del editor compartido.

### Costos · Flujos de producción · Marca de Grafo · 16/09/2026

El layout de `productos-servicios/rutas` aplica marca clara al listado, alta,
ficha y portales. El listado incorpora cabecera con punto naranja, indicadores
del catálogo completo, filtro grafito, iconos de recorrido y flechas diagonales.
En uso cuenta flujos vinculados a productos. La vista previa muestra una secuencia
numerada y distingue nodos simples, compuestos y componentes.

La identidad ocupa una tarjeta superior y el editor recibe el ancho completo.
El diagrama usa fondo claro punteado, conexiones entre momentos, cabeceras grafito
y tarjetas de nodo con acciones agrupadas. Los paralelos mantienen su contador;
una leyenda identifica los tipos de nodo. El resumen de versión, el historial y
la migración comparten la misma paleta. Selección de nodos, edición de nombres,
duplicación, migración y eliminación usan diálogos claros de marca. Las descripciones
de nodos simples reutilizan `descripcionPasoParaUsuario` sólo al mostrarse.

Se conservan los 86 atributos de comportamiento originales; sólo se agregan los
tres valores informativos de los indicadores. No cambian API, payloads, permisos,
estructura del flujo, guardado, detección de cambios, versiones ni migraciones.
Los estilos permanecen en los tres CSS Modules de Flujos; no se modifica globals.css.

Revisión en navegador a 1920, 1024 y 390 px: listado, búsqueda vacía, vista previa
con teclado, alta, ficha, duplicación, cambio de nombre, movimiento con flechas,
incorporación de simples, compuestos y componentes en paralelo, aviso de nueva
versión, zoom y diálogo de migración. Se descartaron todos los borradores sin
guardar, duplicar ni migrar datos. El arrastre conserva sus handlers originales;
la simulación de arrastre en navegador no llegó a producir un movimiento.
Pasan TypeScript, ESLint focalizado, 85 pruebas existentes de flujos, disposición
productiva, componentes, descripciones y tema, CSS guard y diff check.

### Costos · Catálogo de productos · Marca de Grafo · 16/09/2026

Listado, alta y ficha adoptan marca clara con proveedores acotados a sus rutas.
La tabla incorpora las ilustraciones del selector de productos, resueltas por
categoría/subcategoría y con su fallback automático. El explorador conserva las
fotografías y la navegación por categorías. Encabezados con punto naranja, cuatro
indicadores, filtros grafito, controles claros y acciones con flecha diagonal.
Resultados sigue contando el filtro y Vista actual la página cargada.

La ficha conserva sus cinco secciones, con etiquetas visibles Producción y Precio
para los ids existentes `produccion` y `pricing`. Se alinean identidad, geometría,
nestings guardados, herramientas, métodos de precio, impuestos, comisiones, precios
por cliente y diálogos. Los diagramas de consulta y edición usan fondo punteado,
cabeceras grafito y tarjetas claras. La configuración operativa de un nodo conserva
su estructura y usa el tema claro dentro de `data-producto-editor`; no se activa el
modo de configuración base. El pie portado del configurador recibe su tema propio.

Se compararon 269 atributos de comportamiento con HEAD: handlers, valores, destinos
y restricciones permanecen intactos. No cambian API, cálculos, payloads, clasificación,
permisos ni reglas de revisión/publicación. CSS local, sin cambios en globals.css.

Pasan TypeScript, ESLint focalizado y 49 pruebas existentes de ilustraciones,
geometrías, disposición productiva, nesting/precio compuesto, polling, selectores,
apariencia y aislamiento CSS. Revisión en navegador de tabla, categorías,
subcategorías, duplicación, alta, cinco pestañas de ficha, ruta y configuración de
impresión; se recorren opciones sin crear ni guardar datos de prueba.
Revisión adaptable a 1920, 1024 y 390 px: las pestañas pasan a tres o dos columnas
según el ancho disponible y el alta conserva sus acciones visibles. Se comprobó
búsqueda vacía y recuperación de resultados. CSS guard y diff check pasan;
la consola no registró errores durante la revisión.

#### Segunda pasada · Precio

Se simplifica la regla base en método y parámetros, eliminando marcos anidados.
Los tramos muestran etiquetas, unidades y acciones consistentes; el IVA queda
debajo de los valores. Se corrigen la alineación de las opciones fiscales y del
total de comisiones, y se ajustan el formulario por cliente y el precio compuesto.
Un único componente aprovecha todo el ancho. Los estilos se limitan a CSS Modules.

Se corrige también Checkbox en `producto-ui`: faltaba `HeroCheckbox.Content`, por
lo que la casilla se dibujaba sin el control interactivo. Ahora responde a clic y
teclado y sigue bloqueada mediante `ProductoEdicion` en consulta; dos pruebas de
regresión comprueban el control, su estado y la restricción de edición.

Se recorrieron los siete métodos, alta de excepción sin guardar y estrategia mixta
con regla específica de un componente. Revisión visual a 1920, 1024 y 390 px, sin
guardar datos de prueba. Se conservan handlers, valores, restricciones y destinos
de los tres editores; no cambian cálculos ni payloads. Pasan TypeScript, ESLint,
12 pruebas focalizadas, CSS Guard y diff check. Sin errores de consola en la revisión.

#### Segunda pasada · Configuración de pasos de una ruta

El editor de la ruta activa `NodosVisualProvider` para compartir los controles y
la presentación de la configuración predeterminada de Nodos. El alcance visual
`data-node-editor` es independiente de `configuracionBase`: no cambia el destino
del guardado ni convierte la configuración del producto en configuración base.
La cabecera conserva el regreso a la ruta, incorpora el punto naranja y aprovecha
el ancho disponible. Los bloques, campos, selectores grafito y pie de guardado
siguen la misma jerarquía visual que Nodos.

Nesting organiza rotación y panelizado en tarjetas con descripciones completas,
parámetros en columnas adaptables, unidades integradas y márgenes que se apilan
según el espacio disponible. Costos directos usa una tarjeta y un sheet claros,
con encabezado y acciones visibles; el selector de margen conserva sus tres
valores. `brandClassName` en `nodos-sheet` permite variantes explícitas sin trasladar
las clases del sheet legado a HeroUI. Fuera del proveedor se conserva la interfaz
anterior.

Se revisaron con datos existentes impresión por área y diseño gráfico: ejecución,
condiciones, maquinaria, materiales, nesting, tiempos, niveles y costos. Revisión
visual en escritorio y a 390 px, sin guardar datos de prueba; sin desborde horizontal
en móvil ni errores de consola. Se conservan los 442 atributos de comportamiento
comparados con el inicio de esta pasada; sólo se agregan valor y cambio equivalentes
para el selector de margen. No cambian API, cálculos, herencias ni payloads.
Pasan TypeScript, 76 pruebas existentes, CSS Guard y diff check. ESLint sin errores,
con las 12 advertencias previas del editor compartido. Sin cambios en globals.css.

#### Máquinas y selección de materiales · 16/09/2026

Las máquinas candidatas se agrupan en tarjetas adaptables, con hasta dos columnas
según el ancho disponible. Cada una reúne identidad, tecnología, modos habilitados
y perfiles. Reutilizan `MaquinariaPlantillaGlyph`, normalizando únicamente para el
dibujo la plantilla del lookup (enum en mayúsculas). La preferida se distingue con
borde e indicador naranja; sigue siendo sólo el valor propuesto por defecto.
El selector para agregar equipos se ubica junto al conteo de máquinas habilitadas.
Los selectores de perfil tienen nombres accesibles por máquina y modo.

Las opciones de «Quién elige el material» forman una banda continua de columnas
iguales, sin espacios intermedios, con el estado elegido en naranja. Pasan a dos
columnas y luego a una lista unida en pantallas pequeñas. Conservan descripciones,
valores y callbacks, y comunican su estado mediante `aria-pressed`.

La presentación está limitada a `data-node-editor`/`NodosVisualProvider`, tanto en
Nodos como en rutas de producto. Se compararon los 404 atributos de comportamiento
del editor con el inicio de esta pasada: permanecen idénticos. Verificación con
datos reales a 1920, 1024 y 390 px; cambio de preferida, perfil y selección comercial
sin guardar los borradores de prueba. Pasan TypeScript, 47 pruebas existentes,
CSS Guard y diff check. ESLint sin errores, con las 12 advertencias previas.

#### Configuración de componentes · 16/09/2026

La configuración de uso de un componente adopta `ProductoVisualProvider` y la
variante optativa `brand` del shell compartido. Cabecera con punto naranja,
acciones con flecha diagonal, identidad y colección de piezas en una tarjeta
unida. Los ajustes de flujo y grupos adicionales se agrupan en paneles claros;
los parámetros compartidos conservan sus orígenes y fórmulas en filas adaptables.

Las piezas vectoriales muestran miniaturas más grandes, datos técnicos legibles,
cantidades y botones alineados. La banda grafito resume diseños y piezas por
producto. Los campos y acciones usan los adaptadores del catálogo; las piezas
rectangulares comparten la presentación mediante `data-component-config`.
La revisión de capas recibe también los controles y el diálogo claros del catálogo.
El shell conserva su variante anterior para los demás consumidores.

Se compararon 123 atributos de comportamiento con el inicio de esta pasada:
handlers, valores y restricciones permanecen iguales. Se preservan la herencia,
las conversiones de unidades, los límites, las cantidades y el guardado explícito.
Revisión con el componente Piezas de corrugado a 1920, 1024 y 390 px: piezas,
fórmulas, grupos adicionales y diálogo vectorial, sin guardar datos de prueba.
Sin desborde horizontal en móvil ni errores de consola durante la revisión.
Pasan TypeScript, ESLint focalizado, 19 pruebas existentes, CSS Guard y diff check.
Sin cambios en globals.css ni dependencias nuevas.

### Centro de análisis · Portada y Resumen ejecutivo · 16/09/2026

La portada adopta el papel cálido, el punto naranja y las tarjetas de Grafo. El
Resumen ejecutivo se destaca en grafito; las categorías y los nueve destinos
conservan sus permisos. El layout aplica el tema de marca claro, también a fechas,
ayudas y menú de reportes. El período sigue en la URL; cambiar de reporte conserva
el rango personalizado. Las otras ocho vistas mantienen su contenido actual.

El Resumen ejecutivo se separa del archivo compartido y retira su render anterior.
Los cinco indicadores conservan sus datos; ventas se destaca en grafito. Evolución
y equilibrio ocupan el primer nivel, seguidos por clientes, productos y alertas.
Los estados vacíos y la falta de comparativa se distinguen de valores iguales a
cero. El avance puede superar el 100%; sólo se limita el recorrido del anillo.
El margen de cada punto conserva el signo, en vez de ocultar pérdidas con un cero.
No cambian consultas, endpoints, permisos ni cálculos de negocio del backend.

`panel/charts/tremor-charts.tsx` adapta BarChart y SparkAreaChart v1.0.0 de Tremor
(copy-and-paste, Apache-2.0), con la licencia completa junto al componente.
Reutiliza Recharts 2.15 existente: barras apiladas con dominio negativo, cuadrícula,
formatos regionales, leyendas, valores emergentes y navegación por teclado. No se
agregan dependencias ni un nuevo sistema de controles. CSS Modules y tokens de
marca; no se edita globals.css. Las miniáreas son decorativas y no añaden datos.

«Ver datos de la evolución» permite consultar la serie con la precisión de la
moneda. El CSV reconoce atributos semánticos `data-reporte-*` además de las clases
previas, e incluye el período y la evolución aun plegada. Los nombres de clientes
se exportan sin la decoración del ranking. Se conserva el escape CSV existente.

Verificación: escritorio, 1024 y 390 px; controles de fechas y rechazo de rango
invertido, navegación a Comercial manteniendo fechas, gráficos por teclado y CSV
descargado e inspeccionado. Sin desborde horizontal en móvil ni errores de consola
del reporte. Pruebas focalizadas cubren pérdidas, precisión, vacíos, fechas,
avances superiores al 100%, permisos, rangos y compatibilidad de exportación.


### Centro de análisis · Comercial · 16/09/2026

Comercial adopta la misma base clara del Resumen ejecutivo. Los cinco indicadores
mantienen sus importes y conteos, con ventas en grafito. Evolución de ventas y
ticket ocupan la columna principal; categoría y tecnología, la lateral. El mapa
mensual tiene ancho propio y los rankings incluyen órdenes, ticket y ventas con
precisión monetaria. Clientes dormidos conserva su tabla y su estado vacío.

`reportes-ui.tsx` y `reportes.module.css` reúnen las primitivas compartidas con
Resumen ejecutivo, cuya presentación se conserva. Se retiran TabComercial y sus
helpers exclusivos del archivo anterior. Las demás vistas continúan su migración
por separado. No cambian endpoints, permisos, rangos ni cálculos del negocio.

Se suma la adaptación local de AreaChart v1.0.0 de Tremor, con dos series sin
apilar para promedio/mediana, línea discontinua y leyenda explícita. Conserva
negativos, ceros, formatos regionales y un punto aislado cuando sólo hay una fecha.
Los SVG se montan tras la hidratación en un marco con altura reservada: Recharts
mide los textos con el DOM y puede producir ejes distintos al renderizar en servidor.
Esta corrección se aplica también a las barras y miniáreas compartidas.

«Ver datos» permite consultar y exportar las dos series con valores exactos,
incluso plegadas. Los mixes, rankings y mapa mensual son tablas exportables.
Los contadores de clientes nuevos y dormidos dejan de presentarse como porcentajes
de variación; la comparación anual de ventas se conserva cuando existe. Se aclara
«Órdenes históricas» en la tabla de dormidos. La única modificación de API es el
texto de una aclaración: nuevos depende de la primera compra en el rango, mientras
que dormidos describe la situación actual. Las consultas quedan intactas.

Verificación: 36 pruebas focalizadas, TypeScript, ESLint, compilación de API,
CSS Guard y diff check. Revisión con datos reales en 1920, 1024 y 390 px, sin
desborde horizontal de la página. Se verificaron gráficos por teclado, ticket
promedio/mediana, un único mes, períodos vacíos, CSV descargado y Resumen ejecutivo
tras compartir componentes. La carga final no registra errores de hidratación.
La app y la API quedan levantadas; la web de marketing continúa apagada.
