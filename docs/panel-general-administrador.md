# Panel general · Administrador

Implementación del 13/09/2026 basada en la referencia visual enviada ese día.
Sólo cambia la vista propia de usuarios cuyo rol real es Administrador. Las
previsualizaciones de otros roles conservan su presentación. Agenda queda fuera
de esta fase. El sidebar original permanece; la cabecera superior de OT se
reutiliza únicamente en esta vista, con búsqueda de secciones y apariencia local.

## Composición visual

- HeroUI 3 con `data-ui="heroui"`, tema compartido y portales con `useDesignScope`.
- Botones C/S2 ya aprobados, tarjetas HeroUI, selector por lista, chips y tooltips.
- KPIs, Focus hoy y dos columnas: entregas/atención y taller/actividad.
- TanStack Table compone las seis columnas de entregas sin recalcular importes
  ni progreso. Mantiene la explicación del avance ponderado y el detalle de
  los productos. Sólo carga las primeras seis órdenes próximas del endpoint.
- La geometría responde al ancho disponible, descontando el sidebar. En móvil
  se apilan bloques y sólo la tabla desplaza sus columnas horizontalmente.
- `page.tsx` resuelve datos y rol en servidor. `PanelGeneralView` conserva el
  refresco cada 30 segundos y descarta respuestas anteriores a la última consulta.
  Presentación, tabla y paginación de actividad están en archivos separados.

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
CSS Module compartido por roles, que sigue siendo necesario para las otras vistas.
Se retiraron 30 líneas del indicador antiguo `.dash-head h1 .live` y su animación
`dash-pulse`, sin consumidores bajo esa cabecera. Las clases `.dash-*` y `.d-*`
restantes se conservan porque Reportes y Producción aún las usan. Los `.live` de
Tracking y Plataforma pertenecen a otros contenedores y conservan sus reglas.

La importación selectiva de Card sigue aislada por PostCSS. Sus aliases de color
apuntan a los tokens compartidos; no se importa el reset o tema global de HeroUI.

## Validación

57 pruebas de API (alcance, cursor, métricas y confirmación de archivos) y nueve
de presentación/aislamiento CSS aprobadas. TypeScript del frontend y de la API
sin errores en la configuración de build, lint focalizado y `css:guard` aprobados.
La configuración general de tests TypeScript de API conserva errores anteriores
en suites ajenas; el chequeo de build excluye esos specs.

En navegador: datos reales, historial, selector y previsualización de Operario
con el diseño anterior, y pantallas de 1920, 1366 y 390 px sin desborde de página.
No se emitieron ni modificaron órdenes para esta validación.
