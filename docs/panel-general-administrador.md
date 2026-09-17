# Panel general único · Diseño de Administrador

El diseño aprobado el 15/09/2026 se aplica a todos los roles y usuarios con
acceso al Panel general. Se eliminaron las variantes de Jefe de producción,
Vendedor, Administrativo y Operario, la previsualización por URL, el selector y
el botón Actualizar. El sidebar y la barra superior mantienen su composición.
Compartir la presentación no cambia los permisos ni el alcance de datos.

## Composición visual

- Papel cálido, grafito, naranja `#ff7546`, Geist y detalles en Geist Mono.
  `design-system/brand-theme.module.css` compone la base HeroUI con estos tokens
  y su variante oscura. Se aplica explícitamente a esta vista y sus portales;
  no modifica las otras pantallas ni la base anterior de botones.
- Franja grafito unificada para los KPIs, números grandes y separadores finos.
  Crear orden es la acción principal; las otras acciones son accesos compactos.
- Entregas a la izquierda; Requieren atención y Estado de planta a la derecha.
  Actividad reciente ocupa el ancho inferior, con cuatro movimientos reales.
- `ActionButton` conserva su comportamiento; dentro del tema de marca tiene
  primario naranja con texto grafito y radio de 7 px. Pestañas T2,
  tooltips y modales mantienen las primitivas HeroUI y `useDesignScope`.
- Las entregas se presentan en filas con orden, producto/cliente, fecha, etapa
  y avance ponderado. Se conservan las explicaciones de progreso y el detalle
  de cada producto. Un trabajo sin avance calculable no se anuncia como listo.
- Adaptación por ancho disponible: dos columnas en escritorio, bloques apilados
  en móvil. No hay tabla horizontal. Respeta movimiento reducido y foco visible.
- `page.tsx` conserva la carga de servidor; `PanelGeneralView` refresca cada
  30 segundos y al volver a la pestaña, sin botón manual; descarta respuestas antiguas. El reloj inicial usa `generadoEl`
  para que servidor y cliente produzcan el mismo texto durante la hidratación.

## Entregas por fecha

`GET /panel-general` entrega un único contrato sin `vistaActual`,
`vistasDisponibles` ni `previsualizando`. El controlador y la página ignoran
cualquier antiguo `?vista=...`; no hay sustitución de permisos por otro rol.

`entregas` divide las órdenes autorizadas en `hoy`, `atrasada` y `proxima`
**antes** del límite: cada grupo devuelve hasta seis órdenes y su total. Una
cola de atrasadas no oculta las entregas de hoy. Se conservan tenant, permisos,
alcance comercial, zona horaria y fechas de la consulta existente. Próximas
abarca desde mañana hasta siete días inclusive. Sin acceso a ese resumen, la
API devuelve `entregas: null` y la vista no ofrece el bloque ni sus enlaces.
Se retiraron el resumen de entregas anterior y los campos exclusivos de las
vistas eliminadas (`trabajoPersonal`, resumen administrativo duplicado y metadatos
de selección). Los accesos a Producción/Mi mesa siguen siendo acciones existentes,
no variantes del Panel.

El pie explicita cuántas órdenes se muestran. «Ver órdenes» abre el listado
completo, que también contiene las finalizadas pendientes de entrega; el filtro
heredado `urgencia=atrasadas` del listado sólo contempla pendiente/producción y
no representa todo este grupo de entregas. Los enlaces existentes de KPIs y
alertas se conservan.

## Qué mide cada bloque

Se mantienen los cinco KPIs existentes. “Ítems activos” conserva la unidad real
del tablero; no se renombra como órdenes. “Pasos completados hoy” cuenta pasos
`hecho`, por `completadoEl` dentro del día local del tenant, excluyendo los
participantes de nesting. Registrar egreso sigue siendo un gasto administrativo.
Ver bloqueos abre el tablero con el filtro `estado=blocked`.

Documentación pendiente cuenta **órdenes**, no archivos: una orden pendiente o
en producción tiene requisitos activos sin revisión liberada o sin aprobación
del tipo exigido para esa revisión. Usa el mismo criterio del módulo documental.
La alerta sólo aparece cuando hay casos y abre las primeras 20 órdenes afectadas,
con el total explícito si se supera ese límite. No se considera incompleta una
orden sólo por no tener adjuntos.

## Actividad reciente

`PanelActividadService` reúne registros autoritativos en una consulta acotada:

| Fuente | Actividad incluida |
| --- | --- |
| `OrdenTrabajoEvento` | Emisión, cambios, cancelación, productos, estados, pasos y requisitos operativos |
| `ClienteEvento` | Alta, edición, habilitación e inhabilitación |
| `EventoSistema` | Campañas, decisiones/versiones documentales y nuevas subidas confirmadas |

Se reutiliza el historial existente sin copiarlo a otra tabla ni generar
notificaciones personales. Los eventos centrales de producción se excluyen
porque esa acción ya está registrada en `OrdenTrabajoEvento`. Los cambios de
paso y de estado de la orden siguen siendo sucesos distintos.

`GET /panel-general/actividad` exige rol Administrador, `panel.ver` y alcance
general. Respeta los perfiles personalizados de alcance propio: no les habilita
una lectura global. Cada fuente se filtra por sus permisos de módulo y todas
las tablas/relaciones por tenant explícito. La consulta SQL es parametrizada.
El resumen trae cuatro movimientos; Ver toda pagina hasta 30 por petición con
cursor de fecha e identidad estable, incluso si varios eventos comparten fecha.
El cursor del historial abierto no cambia con el polling del resumen.

Las subidas de archivos de orden, ítem, cliente y campaña generan un evento
central al confirmar el objeto en almacenamiento. Estado LISTO, bytes del tenant
y evento se guardan en la misma transacción. La transición condicional evita
repetir bytes/eventos al reintentar o confirmar concurrentemente. No notifica a
otras personas. Las subidas antiguas sin evento de confirmación no se inventan
usando `createdAt` o `updatedAt`; sólo las nuevas quedan registradas con su fecha
correcta. Los documentos que ya tenían historial conservan ese historial.

## Retirada de CSS

No se añadieron reglas a `globals.css`. El Panel general operativo ya tenía un
CSS Module compartido por las variantes retiradas; se eliminó completo
(`panel-general-view.module.css`) al quedar sin consumidores.
Se retiraron 30 líneas del indicador antiguo `.dash-head h1 .live` y su animación
`dash-pulse`, sin consumidores bajo esa cabecera. Las clases `.dash-*` y `.d-*`
restantes se conservan porque Reportes y Producción aún las usan. Los `.live` de
Tracking y Plataforma pertenecen a otros contenedores y conservan sus reglas.

La importación selectiva de Card sigue aislada por PostCSS. Sus aliases de color
apuntan a los tokens compartidos; no se importa el reset o tema global de HeroUI.

## Validación de la unificación

- 46 pruebas de API y permisos: modelo común para los tres roles base,
  conservación de alcances, grupos de entrega y retirada de previsualización.
- Nueve pruebas de presentación: diseño único, controles eliminados, acciones
  autorizadas, estados de carga/vacío, entregas y reloj estable.
- TypeScript de frontend y build de API, lint focalizado, `git diff --check`
  y `css:guard` (sin nuevas reglas globales; un CSS Module retirado).
- Navegador con sesión real: una URL antigua `?vista=operario` muestra el Panel
  único, sin selector ni botón Actualizar. Se mantienen entregas agrupadas y
  actualización automática. Escritorio y móvil sin desborde horizontal.
