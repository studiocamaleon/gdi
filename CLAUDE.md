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
El sidebar global conserva su diseño original en todas
las rutas, incluida Crear orden; sólo comparte su fondo claro mediante el token
`--canvas-background`. Ver el registro de esa referencia en el documento HeroUI.

Panel general usa la misma base sólo en la vista propia del Administrador.
Conservar las otras vistas y el sidebar. La actividad lee historiales de dominio
más EventoSistema; no usar las notificaciones personales como feed empresarial.
Ver [docs/panel-general-administrador.md](docs/panel-general-administrador.md).

Los listados de Órdenes de trabajo, Presupuestos y Campañas comparten
`design-system/list-page.module.css` y `ListMetric`: ancho completo, márgenes
24/20/16 px, cabecera, indicadores y controles. Reutilizar esta base al migrar
listados; conservar consultas, permisos y cálculos en sus controladores.
Campañas también migra el detalle y sus formularios, incluido Desarrollo
documental. `SelectField` conserva los valores originales de `FormData` y el
vacío opcional; `CampanaDialog` limita el portal y mantiene visibles las acciones
cuando el formulario desplaza su contenido. No retirar todavía los estilos del
uploader o de progreso: son componentes compartidos con otras vistas.

Los formularios comerciales comparten `design-system/form-dialog` (HeroUI);
`CampanaDialog` mantiene el alias de compatibilidad. Cargos y Descuento de OT
usan componentes propios y `orden-financial-forms.module.css`. Cupones abre
`OrdenCuponField` debajo de los iconos: Validar aplica el plan del backend,
sin mezclar el cupón con el modal manual ni redimirlo antes de emitir.

Planificación usa HeroUI sólo en indicadores y controles del encabezado.
Mantener el tema acotado a esas superficies: el Gantt y sus paneles de detalle
conservan su geometría y estilos actuales. Colas de trabajo usa HeroUI en la
vista principal: máquinas, filtros, selección, estados y botones. Su simulador y
los formularios de producción compartidos conservan el tema anterior en sus
portales. `PasoAccionesProduccion.renderAccion` permite componer los botones de
Colas sin duplicar transiciones ni cambiar otras vistas. Ver el alcance en el
documento HeroUI.

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
de ítem compartido; no duplicar mutaciones. Formularios nuevos con FormSheet
HeroUI y CSS local. Registro: `docs/sistema-visual-heroui.md`.


## Capacidad personal de estaciones

La concurrencia manual se obtiene de empleados disponibles y dotación por paso,
sin límite físico de puestos. Horario único por empleado; reservas por ID entre
estaciones, con intersección del calendario operativo y los cierres del taller.
No reintroducir el editor de Equipos ni el selector de puestos en la UI.
Los datos anteriores conservan el modo previo hasta configurar empleados;
la referencia del equipo se retiene sólo para coordinar esa transición.
Ver `docs/produccion-empleados-horarios-2026-09-14.md` antes de cambiar el motor,
la migración o las agendas. No inferir empleados ni horarios de cantidades de equipo.
