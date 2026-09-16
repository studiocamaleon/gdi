# gdi-saas

Notas para quien (o lo que) trabaje en este repo. Sólo va acá lo que no se
deduce leyendo el código y que, si se ignora, rompe algo.

## Estilos: no escribir en `globals.css`

La dirección de las próximas migraciones está en
[docs/sistema-visual-heroui.md](docs/sistema-visual-heroui.md): HeroUI 3,
utilidades Tailwind 4, componentes de servidor para datos y TanStack Table para
el estado de tablas. Orden de trabajo es el primer piloto, pendiente de la
aprobación visual del usuario. Las superficies migradas se registran en ese documento.

Las primitivas nuevas usan HeroUI dentro de `data-ui="heroui"` y el tema de
`src/components/design-system/theme.module.css`. Aplicar ambos también a los
portales (el hook `useDesignScope` mantiene el alcance y la apariencia). El CSS
del proveedor se importa selectivamente en `src/styles/heroui.css` y se aísla
con el plugin PostCSS; no importar su reset o tema global.
El tema incluye `--z-index-overlay: 100000`, que HeroUI necesita para cubrir
también el sidebar y coincide con los popovers de React Aria. No redefinirlo
por vista: los portales se superponen según el orden de apertura.

Botones aprobados: **C · Degradado cálido · Suave · Compacto**. Usar
`design-system/action-button` (HeroUI): primario con letras blancas, radio de
10 px y tamaño `sm` de 32 px por defecto. Tokens `--action-*` en el tema;
no copiar el degradado por pantalla. Secundarios **S2** con `variant="outline"`
(`tertiary` conserva compatibilidad); `secondary` mantiene selección cálida.
Referencia: `/dev/diseno/botones`.

Componentes aprobados: **T2 · A3 · S2 · G4 · C2**. Reutilizar
`NavigationTabList`, `IdentityAvatar`, `ActionButton`, `SegmentedControl` e
`IconChoiceGroup` en `design-system/`. El catálogo `/dev/diseno/componentes`
inicia con esta combinación y usa las mismas primitivas que OT. Mantener las
alternativas no aprobadas aisladas en `design-system/preview/`. No mover permisos o reglas de negocio a estas primitivas. La referencia OT
del 12/09 a las 21:30 amplía la base: `NavigationTabList variant="detailed"`,
Datos como pestaña y resumen a la derecha. El ajuste del 13/09 compacta título
y tabs (sin scroll horizontal), fija la cabecera al desplazarse y usa el primario
C de 32 px para Emitir OT. Productos no lleva título, buscador ni categorías.
Editar/Cancelar también van en la cabecera; el resumen termina en el total,
sin ajustes ni aviso azul. Los controles financieros son iconos debajo del
vendedor en el resumen. Al crear, Datos es la pestaña inicial: tipo y vendedor,
cliente y campaña, canal de venta y subsección Entrega con cuatro columnas
adaptables. Emitir requiere cliente; Guardar borrador permite no asignarlo.
El sidebar global adopta la identidad de la web de Grafo (15/09): logo
`GrafoprintBrand` de tres nodos con punto naranja, grafito y tipografía Geist.
Usa los tokens locales de `navigation-theme.module.css`;
mantener rutas, permisos, búsqueda, acordeón, suscripción y perfil existentes.
No extender esta paleta a las pantallas ni a los portales por herencia.
La barra superior compartida usa la versión de Tablero de producción en todas
las rutas: colapso del menú, notificaciones y cierre de sesión, con el papel claro
`--canvas-background` del tema de marca y `data-appearance="light"` explícito.
No variar el encabezado por ruta, rol o
migración a HeroUI; perfil y búsqueda permanecen en el sidebar.

La carga del dashboard tiene un solo indicador global: `ModulePageSkeleton`
registra su montaje en `NavigationFeedbackProvider` antes de pintar y lo libera
al desmontarse. El cambio de URL termina sólo la espera de navegación, no los
fallbacks pendientes. No volver a dibujar el logo dentro del contenido cuando
termina la navegación: provoca un salto de centro. Mantener `useSearchParams`
aislado en el Suspense del observador para preservar los ids de hidratación.

Panel general tiene una única presentación para todos los roles y usuarios:
el diseño de Administrador aprobado el 15/09, con HeroUI y
`design-system/brand-theme.module.css` (papel cálido, grafito y primario naranja).
Aplicar el tema también a sus portales. Las variantes por rol, sus previsualizaciones,
el selector y el botón Actualizar se eliminaron; no reintroducirlos. La API usa
siempre los permisos efectivos del usuario y conserva los alcances de datos.
Las entregas Hoy/Atrasadas/Próximas se separan antes del límite de seis y se
exponen como `entregas`; sin acceso al resumen, ese bloque no se muestra.
El refresco sigue siendo automático cada 30 segundos y al volver a la pestaña.
La actividad lee historiales de dominio más EventoSistema, con su autorización
existente; no usar las notificaciones personales como feed empresarial.
Ver [docs/panel-general-administrador.md](docs/panel-general-administrador.md).

Crear orden adopta la marca del Panel general con **tema claro explícito**, incluido
el resumen y los portales, aunque el sidebar sea oscuro. `DesignSystemProvider`
recibe `theme="brand" appearance="light"`; `useDesignTheme` y
`useLegacyDesignScope` propagan esa decisión a controles de ambas generaciones.
El modo por defecto del resto de las vistas no cambia. Se conservan todos los
campos y reglas de la ficha; los datos calculados se muestran como consulta.
Ver [docs/crear-orden-rediseno-plan.md](docs/crear-orden-rediseno-plan.md).

Los listados de Órdenes de trabajo, Presupuestos y Campañas comparten
`design-system/list-page.module.css` y `ListMetric`: ancho completo, márgenes
24/20/16 px, cabecera, indicadores y controles. Reutilizar esta base al migrar
listados; conservar consultas, permisos y cálculos en sus controladores.
Presupuestos adopta también la marca clara en listado y detalle (15/09): tres
secciones, resumen financiero lateral y formularios HeroUI. Los enlaces al PDF
y a la vista pública llevan `prefetch={false}` para no registrar vistas anticipadas.
Campañas adopta la misma marca clara en listado, ficha y formularios, incluido
versiones y aprobaciones. La ficha reúne cinco pestañas grafito: Resumen (avance e
hitos), Órdenes, Presupuestos, Archivos y Actividad; coordinación y recursos
quedan al costado. Archivos integra adjuntos generales y grupos con versiones;
las OTs integran sus revisiones liberadas/controles dentro de la misma pestaña,
sin una pestaña Documentos. Conservar revisiones, aprobaciones y gates del backend.
`archivos-presentacion.ts` separa adjuntos sin perder archivos versionados y cuenta
cada archivo físico una sola vez. El versionado sigue limitado a campañas en el
modelo actual. Conservar el filtro explícito por Enter/Aplicar. `SelectField` conserva los valores originales de `FormData` y el
vacío opcional; `CampanaDialog` limita el portal y mantiene visibles las acciones
cuando el formulario desplaza su contenido. No retirar todavía los estilos del
uploader o de progreso: son componentes compartidos con otras vistas.

La ficha de una OT persistida abre en **consulta**: toda acción que modifique
la orden requiere entrar explícitamente en «Editar orden», además de los permisos
y límites por estado existentes. Propagar `soloLectura` a Archivos (incluida
papelera), Pagos, Comprobantes y Compras/Tercerizados. El icono fiscal y el atajo
X, cancelación, emisión de borradores, entregas y preparación de corte respetan
la misma puerta. No montar la preparación de corte fuera de edición: su consulta
puede materializar revisiones. Los datos comerciales y productos siguen en staging;
los formularios operativos conservan sus confirmaciones propias. Si no hay staging,
«Finalizar edición» vuelve a consulta sin escribir. En finalizadas/entregadas se
puede entrar para las acciones todavía admitidas, sin habilitar sus datos cerrados.

Los formularios comerciales comparten `design-system/form-dialog` (HeroUI);
`CampanaDialog` mantiene el alias de compatibilidad. Cargos y Descuento de OT
usan componentes propios y `orden-financial-forms.module.css`. Cupones abre
`OrdenCuponField` debajo de los iconos: Validar aplica el plan del backend,
sin mezclar el cupón con el modal manual ni redimirlo antes de emitir.

Tablero de producción adopta la marca clara de Grafo en Lista, Kanban, filtros,
monitor y consulta de terminados. Su ruta aplica `DesignSystemProvider` con
`theme="brand" appearance="light"`; los controles y portales usan `useDesignTheme`.
El CSS de la ficha lateral compartida se acota a `tablero-brand.module.css` y
sólo al Tablero. Conservar agrupación, métricas, URL/preferencia de vista, reloj,
SSE, filtros, permisos y acciones canónicas. Planificación tiene su propio
alcance de marca, independiente de `tablero-brand.module.css`.

Planificación aplica `DesignSystemProvider theme="brand" appearance="light"`
a indicadores, controles, Gantt y sus dos paneles. Usar CSS Modules locales,
`SegmentedControl tone="graphite"` y propagar tema/alcance a los portales.
Conservar la geometría proporcional, alturas y offsets sticky, zoom, recorrido,
calendarios, dependencias y cálculos; el título sigue sólo para lectores de pantalla.
Colas de trabajo aplica la misma marca clara en máquinas, filtros, selección,
estados y simulación de nesting. Reutilizar `NavigationTabList tone="graphite"`
y el tema de marca en los portales. Los formularios operativos compartidos usan
`produccion-dialog-brand.module.css` sólo bajo ese contexto; otros consumidores
conservan su presentación anterior. `PasoAccionesProduccion.renderAccion` permite
componer los botones de Colas sin duplicar transiciones. Conservar selección,
agrupación por material, layout bloqueado, cálculos, tiempos y permisos.
Ver el alcance en el documento HeroUI.

Materiales, su ficha, Biblioteca y Editor de costos aplican la marca clara con
proveedores por ruta, incluidos Nueva materia prima y el asistente de instalación.
Los portales usan `useDesignTheme` y `useDesignScope`. Reutilizar `ListMetric`,
la base de listados y las pestañas grafito; los estilos permanecen en los módulos
locales de inventario. Conservar plantillas, variantes, conversiones, borradores,
consultas y payloads. No extender esta paleta a Movimientos o Centro stock por herencia.
Movimientos aplica la misma marca mediante su propio proveedor de ruta. Conserva
la consulta de historial y el refresco automático; el selector de variantes es
buscable con HeroUI. Distinguir carga, error inicial e historial vacío. Su estado
vacío explica qué aparecerá al registrar stock sin invitar a usar funciones pendientes.

Clientes y Proveedores aplican marca clara en listado, ficha y alta mediante
proveedores de ruta. Comparten la presentación de `crm/contactos-workspace.module.css`,
sin unificar sus controladores ni reglas. Los indicadores de email y ubicación
se refieren a la página cargada, no al total del directorio. Las fichas muestran
el nombre guardado, resumen y pestañas grafito; Proveedores separa Ficha e Historial.
Mantener montado el panel de datos al cambiar de pestaña para conservar borradores.
Conservar fiscalidad, fidelización, condiciones de pago, permisos, importación,
control de versión y advertencias de cambios sin guardar. Portales con el mismo tema.

Empleados aplica marca clara en su layout, incluido alta, ficha y portales.
Reutiliza la base visual de directorios; Sectores y Con acceso cuentan sólo la
página cargada. La ficha separa Legajo, Comisiones (según permiso) e Historial
(sólo al editar). Mantener montados los paneles con borradores. Conservar bajas,
lectura, importación, validaciones, versión y guardado explícito; el acceso se
administra únicamente en Configuración → Usuarios. La fecha de ingreso es un
día de calendario: usar `fechaConDia`, sin convertirla a la zona horaria.

Centros de costo aplica marca clara sólo en su ruta, incluido el portal de la
ficha. Conserva la planilla manual de gastos generales, empleados y activos;
no vincularla automáticamente con nómina o maquinaria. Los indicadores suman
las filas visibles del período. La ficha separa Datos generales, Gastos, Ajustes
e Historial, con valor hora destacado y borradores conservados entre pestañas.
Mantener cálculos, prorrateo, redondeos, copia del período anterior, permisos y
guardado/publicación explícitos. No cambiar los snapshots históricos ni extender
el tema por herencia a otras rutas de Costos.

Maquinaria aplica marca clara en su propio layout: listado, alta, ficha y portales
(tintas, perfiles, materiales y ayuda). Mantener las plantillas inmutables, los
campos condicionales, las conversiones, el modo de operación y los cálculos en
`useMaquinaEditor`/helpers. Los indicadores Activas y Por completar cuentan la
página cargada. Descripción, Ajustes e Historial conservan el borrador en el
controlador padre y requieren guardado explícito. La tarifa es de consulta y
proviene del centro de costo; las máquinas incompletas siguen sin poder activarse.
Los estilos de herramientas se acotan a Maquinaria para no alterar Productos.
Los códigos de máquina son internos: no mostrarlos en listados, fichas ni selectores.
El listado usa `MaquinariaPlantillaGlyph`: una ilustración vectorial por plantilla,
con la paleta del sheet de productos. La asignación depende de la plantilla, no del nombre.
En impresoras láser se retiraron «Modo doble faz» y «Origen PPM» del editor;
la API tolera sus valores históricos, pero no se generan ni editan desde la UI.

Nodos de producción aplica marca clara en el layout de `productos-servicios/pasos`,
incluidos alta, configuración predeterminada y portales. El editor se comparte con
Productos: `NodosVisualProvider` habilita la presentación y `configuracionBase`
controla el comportamiento del catálogo; no usar este último para aplicar estilos.
La configuración base reemplaza la columna lateral por una cabecera. La ruta de
producto activa explícitamente el mismo proveedor y comparte controles y bloques
con `data-node-editor`, conservando su cabecera, navegación y guardado propios.
Los tokens `--node-*` de consumo tienen fallback al estilo anterior; no extender
el proveedor a otros consumidores del editor compartido ni al layout general.
Conservar campos, cálculos, herencias, validación y guardado explícito de nodos
simples y operaciones internas de compuestos.

La configuración de componentes de una ruta activa `ProductoVisualProvider` y
la variante explícita `brand` de `ModeloProductivoConfigShell`. El alcance
`data-component-config` limita los estilos de piezas, miniaturas y formularios a
este configurador; el pie portado recibe su propio tema. Conservar el fallback
del shell para incorporaciones, y no cambiar contratos de herencia, geometría,
cantidades ni repetición para reutilizar estilos. Aplicar configuración actualiza
el editor; Guardar modelo sigue siendo la persistencia explícita de la ruta.

Flujos de producción aplica marca clara en el layout de `productos-servicios/rutas`,
incluidos alta, ficha y portales. El editor ocupa el ancho completo debajo de los
datos del flujo; los momentos usan cabecera grafito y nodos claros diferenciados
por tipo. Conservar zoom, desplazamiento, arrastre, movimientos y paralelos,
identidades de componentes, permisos y guardado explícito. Los indicadores cuentan
el catálogo recibido; En uso cuenta flujos, no asociaciones de productos.
Mantener el versionado obligatorio para cambios en flujos utilizados y la migración
explícita de asociaciones; el rediseño no altera productos ni versiones existentes.

Catálogo de productos aplica marca clara por separado en listado, alta y el layout
de `[productoId]`. No mover ese proveedor al layout general de productos-servicios:
también contiene módulos con alcances propios. Tabla y ficha reutilizan
`ProductoCatalogoGlyph`, resuelto por códigos de clasificación; el explorador de
categorías conserva sus fotografías. Las pestañas visibles son Identidad, Comercial,
Producción, Herramientas y Precio; conservar los ids de URL existentes.
El editor profundo usa `data-producto-editor` y el puente de tema legado, sin activar
`configuracionBase` ni alterar la configuración de nodos. Mantener cámara, arrastre,
geometrías, precios, permisos, revisión/publicación y guardado explícito. Los portales
heredan la marca, incluido el pie portado del configurador. Los indicadores conservan
su alcance: Resultados según filtros y Vista actual según página cargada.

Precio organiza método y parámetros en columnas adaptables, con unidades junto a
los tramos, impuestos y comisiones alineados y excepciones por cliente con el mismo
editor. El adaptador Checkbox de producto debe incluir `HeroCheckbox.Content`
alrededor de Control/Indicator: es el elemento interactivo de HeroUI v3, necesario
para clic, teclado y estado deshabilitado. Conservar el guardado explícito y las
políticas versionadas de precio compuesto.

La cuenta corriente de clientes usa marca clara por ruta y estilos en
`administracion/cuenta-corriente.module.css`. Saldo destacado en grafito, condiciones
de crédito y movimientos con aplicaciones comerciales/fiscales desplegables por
botón accesible. Antigüedad del saldo usa `FormDialog` con el mismo tema. Conservar
precisión monetaria, orden de movimientos y destinos de cobro/PDF. El resumen
muestra **Saldo total** (neto del extracto) y **Saldo vencido** (suma de los cuatro
tramos vencidos, excluyendo «A vencer»). UI y PDF muestran deuda negativa y
saldo a favor positivo. Los cargos nacen al emitir la OT; el vencimiento se fija
al finalizar. No reintroducir filas de reserva; ver `docs/anticipos-y-cuenta-corriente.md`.

Cupones aplica marca clara por ruta y en sus portales. Conservar el ticket
troquelado y el QR original, con talón grafito; formularios agrupados en descuento,
alcance y vigencia. Historial, QR, edición y eliminación usan `FormDialog`.
Mantener permisos, búsqueda diferida, paginación, versiones, reservas y reglas;
el código sigue protegido al editar porque puede tener QRs impresos.

Fidelización aplica marca clara por ruta, indicadores con saldo destacado,
reglas y economía de puntos en una tarjeta adaptable, y movimientos con números
monoespaciados. Conservar el guardado explícito de los cuatro campos, el permiso
`crm.configurar_fidelizacion`, `conversionBloqueada` y los cálculos del backend.
El recorrido margen → puntos → beneficio es explicativo; no simula nuevos importes.

Centro de análisis aplica marca clara en su layout y portales. La portada y la
cabecera de los nueve reportes comparten período, navegación y exportación; los
permisos y rangos de URL se conservan. Resumen ejecutivo, Comercial, Finanzas,
Producción, Salud del ETA, Equipo, Ventas y producto, Clientes y Embudo tienen
vistas propias (`resumen-ejecutivo.tsx` y `reporte-*.tsx`); comparten tarjetas,
indicadores y estados vacíos en `reportes-ui.tsx`/`reportes.module.css`. Se retiró
el antiguo `panel/panel-general.tsx`, ya sin consumidores. Los gráficos
de barras, áreas y miniáreas son adaptaciones locales
de Tremor sobre Recharts, con licencia en `panel/charts/TREMOR-LICENSE`, sin
agregar el paquete completo ni estilos globales. Mantener márgenes negativos,
precisión monetaria, fechas calendario y estados sin datos. Exportación reconoce
atributos `data-reporte-*` y conserva el fallback de clases para reportes previos;
el detalle de evolución se exporta aunque su tabla esté plegada. No cambiar las
consultas ni los cálculos del backend para adaptar una visualización.
Comercial conserva promedio y mediana como series independientes, clientes nuevos
como conteo de primeras compras en el rango y dormidos como situación actual.
La estacionalidad conserva hasta ocho categorías y meses con actividad de los
últimos doce meses. Recharts se monta después de hidratar dentro de un marco
de altura estable: no renderizar sus ejes medidos por DOM en el servidor.
Finanzas compara totales del rango con barras agrupadas; no tiene serie temporal
de costos. Gastos fijos están prorrateados al rango, y deuda/deudores son una foto
actual. Mantener el gate `finanzas.ver_margenes` en la página y API, los valores
no calculables como tales y los importes exactos en tablas/exportación.
Producción usa barras por día con registros, sin interpolar días ausentes. Cola
y bloqueos son actuales; ahorros separa período e histórico. Tiempo de ciclo
llega al fin de producción y el cociente real/cotizado mayor a 100% significa
más tiempo. Conservar medianas, muestra, decimales y utilización superior a 100%.
Salud del ETA consume la respuesta nueva de cada navegación, sin copiar sus props
a estado local. Las promesas son por ítem; separar cobertura de cerradas de la
cobertura de todas las promesas del rango. Sesgo conserva signo y unidad de tiempo,
sin deltas porcentuales ficticios. Las franjas y los supuestos se superponen:
no apilarlos como partes excluyentes. Las duraciones sugeridas son sólo lectura.
Equipo conserva orden alfabético, desvíos individuales sólo con la muestra mínima
de la API y tiempos fraccionarios. La matriz muestra toda la cobertura observada
con minutos/pasos y nombres completos; no certifica habilidades. Registro y series
semanales tienen tablas exportables aun plegadas. Respetar por separado
`margenesVisibles` y `comisionesVisibles`, también en el CSV.
Ventas y producto usa barras de Tremor, con hasta seis series y resto agrupado
sólo en el gráfico; el detalle conserva cada nombre/fecha/importe. El selector
consulta la categoría con el mismo rango; cada categoría/rango tiene su propio
estado de carga para no mostrar datos anteriores. Conservar límites de la API
(20 productos, 12 para adicionales, 8 para medidas), sin recortes extra en UI.
Consumos son teóricos, con unidad, formato y centésimos; margen/contribución/costo
siguen `margenesVisibles`. El ticket con/sin adicionales compara grupos distintos,
no ingreso atribuible al adicional. Los porcentajes de adicionales se superponen.
Clientes separa actividad del período de cartera actual e historial completo.
Recompra es mediana histórica con cinco intervalos mínimos; conservar decimales.
La serie nuevos/recurrentes clasifica ventas según el primer día/semana/mes de
compra, mientras que el KPI cuenta clientes únicos nuevos en todo el rango.
Segmentos conserva seis reglas con `diasActivo` configurable; “Nuevos” del
segmento significa una sola orden reciente. Concentración usa el denominador
completo aunque muestre hasta diez clientes; el acumulado no siempre llega a
100%. Riesgo muestra hasta ocho filas y el total real del segmento; vacío no
implica ausencia de perdidos. Margen respeta `margenesVisibles`, importes negativos
y costos faltantes tanto en pantalla como en CSV.
Embudo conserva la cohorte de presupuestos enviados y etapas alcanzadas,
con selector Cantidad/Importe y exportación de ambas medidas aun con detalle
plegado. Las barras de importe usan el máximo de la serie para no recortar OT
con ajustes mayores al presupuesto; ratios superiores al 100% permanecen visibles.
Sin denominador no hay tasa calculable; una cohorte con monto cero sigue visible.
Los presupuestos abiertos de hoy son independientes del filtro. “En gestión”
no es una pérdida. La velocidad usa emisión/finalización de OT, no timestamps de
entrega física: las etiquetas reflejan esas referencias y los tramos no se suman.

Usar utilidades para composición y CSS Modules para geometría compleja. No
copiar reglas del proveedor, añadir colores por vista ni convertir la ficha
en otro componente universal. La lógica de negocio vive fuera de los controles.

`globals.css` es deuda de compatibilidad. Al migrar una superficie, retirar sus
selectores sólo después de comprobar que no tienen consumidores, incluidos los
nombres construidos dinámicamente. Las familias compartidas siguen hasta migrar
su último consumidor; no basta mover el archivo gigante a otro nombre.

Antes de cerrar un cambio de UI:

```bash
npm run css:guard
```

Falla si aparece una clase global nueva **o crecen las líneas**. `--update` sólo
puede bajar el límite. Metodología y mediciones: [docs/css-convenciones.md](docs/css-convenciones.md).

**Turbopack congela globals.css** (probado 2026-08-08): tras el primer compile,
el bundle CSS no se reconstruye más — ediciones posteriores de globals.css no
llegan al navegador por más reload que se haga (los `.tsx` y los `.module.css`
sí reflejan). Para trabajar CSS global usar `npm run dev:webpack` (HMR aplica en
vivo). El fix de fondo es este mismo plan de migración: achicar globals.css.

Para desarrollar la API usar `npm run api:dev` (Nest en modo watch). Compilar
con `api:build` no actualiza un proceso Node ya iniciado desde `dist`.
Al cambiar DTOs, comprobar que la instancia que escucha en 3001 se haya
reiniciado: el 14/09 una instancia anterior rechazaba campos nuevos aunque
la compilación y las pruebas pasaban.

## El proxy va en `src/`

`src/proxy.ts` (era `middleware.ts` hasta Next 16). Con estructura `src/`, Next
**sólo** lo ejecuta desde ahí: en la raíz del proyecto no corre y no avisa. Ya
pasó — estuvo meses muerto y lo tapaban los layouts y los 401 del API.

Para comprobar que corre, el dev server loguea `proxy.ts: Xms` en cada request.

## Documentación

`docs/` tiene ~96 documentos de diseño, uno por módulo o decisión. Antes de
rediseñar algo, buscar si ya está pensado ahí.

## Estaciones: superficie única

`/produccion/estaciones` conserva las cards de carga, configuración, personal
asignado y calendario del taller. «Ver tareas» navega a
`/produccion/tablero?estacion=<id>&vista=lista`, también para «Sin estación» y
«Proveedor tercerizado». Lista es la única vista de tareas por estación;
no reintroducir el detalle antiguo con «Mi mesa». El Tablero conserva
Lista/Kanban y «Asignadas a mí». Consultar requiere
`produccion.ver`; editar configuración mantiene `produccion.configurar`, y
las acciones de tareas respetan el alcance/estaciones habilitadas por API.
La asignación voluntaria de pasos sin personal y la devolución de la propia
mesa viven en Personal asignado de Lista. Las asignaciones automáticas se conservan.
Reutilizar `use-produccion-operativa`, los modelos de presentación y el detalle
de ítem compartido; no duplicar mutaciones. La ruta aplica marca clara de Grafo
con `DesignSystemProvider theme="brand" appearance="light"`, también en los
selectores y portales. Tarjetas agrupadas por etapa, indicadores, configuración,
horarios personales y calendario usan CSS Modules locales; FormSheet/FormDialog
aceptan una clase optativa para esta composición. Conservar el guardado inmediato
del calendario del taller y el borrador de configuración/horarios personales.
Registro: `docs/sistema-visual-heroui.md`.


## Capacidad personal de estaciones

La concurrencia manual se obtiene de empleados disponibles y dotación por paso,
sin límite físico de puestos. Horario único por empleado; reservas por ID entre
estaciones, con intersección del calendario operativo y los cierres del taller.
No reintroducir el editor de Equipos ni el selector de puestos en la UI.
Los datos anteriores conservan el modo previo hasta configurar empleados;
la referencia del equipo se retiene sólo para coordinar esa transición.
Ver `docs/produccion-empleados-horarios-2026-09-14.md` antes de cambiar el motor,
la migración o las agendas. No inferir empleados ni horarios de cantidades de equipo.

## Tesorería con identidad de Grafo

`/administracion/tesoreria` y `acreditaciones` tienen un layout de marca claro
acotado a esas rutas. `tesoreria-view.module.css` cubre ambas vistas y
`TesoreriaDialog` compone `FormDialog` para sus operaciones. Conservar los
permisos separados de gestionar/anular y los payloads/idempotencia del circuito.
Mostrar importes con los decimales propios de cada moneda (incluidos centavos
al arquear); nunca sumar posiciones de distintas monedas. Referencia y QA:
`docs/sistema-visual-heroui.md`.

## Facturación en lote con identidad de Grafo

`/administracion/facturacion` usa marca clara, tabla y panel de preparación;
`FacturacionResultado` presenta el resultado parcial en `FormDialog`. Mantener
la confirmación previa con `FacturacionConfirmacion`: sólo «Confirmar y emitir»
envía el lote revisado; cancelar conserva la selección y el envío bloquea cierres
y solicitudes duplicadas. Conservar la selección fuera del filtro (la cabecera
selecciona sólo visibles), agrupar
únicamente órdenes del mismo cliente y respetar `administracion.gestionar`.
Los importes sin facturar son fiscales, independientes de lo cobrado. Mantener
los decimales de la moneda del tenant y no convertir un error de carga en vacío.
No modificar emisión, matching o numeración desde la capa visual. Referencia y
QA en `docs/sistema-visual-heroui.md`.


## Cuentas por pagar con identidad de Grafo

`/administracion/cuentas-por-pagar` usa marca clara local y presenta sus datos
con `CuentasPagarWorkspace`; `EgresosView` sigue siendo el controlador compartido
con Egresos. `EgresosBrand` adapta alta, pago y detalle mediante `EgresoDialog`
sin modificar la presentación del modo Egresos. Mantener permisos, payloads,
idempotencia, cuotas y la distinción entre gestión y anulación. Los selectores
HeroUI usan filtrado externo de `filtrarOpciones` y portales con tema explícito.
No redondear los importes a enteros. Los registros `DEMO-CXP-20260916` son datos
de prueba autorizados, no fixtures automáticas; el script se limita a la base
local. Referencia y QA en `docs/sistema-visual-heroui.md`.

## Gastos fijos con identidad de Grafo

`/administracion/gastos-fijos` usa marca clara y `FormSheet` con pestañas grafito.
Los helpers de formulario están en `src/components/costos/gastos-fijos-form.ts`.
Conservar la moneda del tenant al editar importes y enviar el estado `activo`
actual: el backend aplica `true` si se omite. El resumen mensual considera
activos dentro de su vigencia inclusiva; no representa vencimientos ni pagos.
Los catálogos se cargan al abrir la ficha. No confundir este presupuesto con
Egresos/Recurrentes. Ver `docs/sistema-visual-heroui.md` para presentación y QA.

## Comprobantes con identidad de Grafo

`/administracion/comprobantes` usa marca clara local en listado, alta, ficha y
vista imprimible. Estados y fechas de presentación se centralizan en
`src/lib/comprobantes-presentacion.ts`; no llamar cobrado a un documento anulado,
borrador o rechazado. Importes con centavos en la moneda del comprobante;
métricas del listado en ARS según cotización guardada, con el límite de consulta
existente. Conservar permisos de gestión, letras/IVA, payloads, numeración,
emisión y CAE. El PDF fiscal mantiene su contenido y generación. Referencia y QA:
`docs/sistema-visual-heroui.md`.
