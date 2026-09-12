# F6 — Reprogramación asistida desde Distribuir entregas

Fecha: 10/09/2026. Rama: `codex/f6-entregas-planificacion`.
Estado: implementación local, con pruebas de motor, persistencia e interfaz.

## Recorrido disponible

1. Calcular la distribución de N entregas y N lotes completos, como hasta ahora.
2. **Ver opciones de reprogramación** compara cambios de cola con los tiempos y
   cálculos guardados por cantidad. No vuelve a cotizar ni a ejecutar el nesting.
3. Las opciones se presentan primero conservando compromisos y margen, después
   conservando compromisos con margen reducido, y al final cambiando entregas.
   Se muestran antes/después de operaciones, recursos, productos/lotes, producción
   lista, fecha comprometida y margen hábil restante. Se incluyen los componentes
   del producto al evaluar su finalización.
4. Desmarcar una OT en **Elegir trabajos que se pueden mover** deja pendiente una
   nueva búsqueda. No se permite guardar una alternativa basada en exclusiones
   anteriores.
5. Cambiar una fecha comprometida requiere marcar la aceptación de esa opción.
   El precio comercial y los layouts conservan sus reglas anteriores; el costo
   por fabricar en tandas se sigue mostrando en el resumen.
6. Al crear la OT, la elección queda preparada. El borrador no mueve otras OT.
   Al emitir, o al aplicar sobre una OT pendiente, se publican juntos los lotes,
   los intervalos de producción y las fechas expresamente aceptadas.

La operación requiere `produccion.supervisar`, además de la autorización del
flujo comercial para adoptar la distribución. No avisa automáticamente a clientes.

## Persistencia y ETA

- El ETA compartido por servidor y navegador considera intervalos publicados
  (`planificadoDesde`/`planificadoHasta`) y capacidad concurrente. Un trabajo
  posterior puede usar un hueco libre, pero no ocupar una reserva de otro paso.
- El recurso de máquina usa su identidad física cuando está disponible; dos
  operaciones de esa máquina no corren en paralelo porque sobren puestos.
- La cola habitual sin reservas no recorre listas de reservas inexistentes.
  Las reservas se indexan por estación antes de programar operaciones.
- La alternativa tiene identidad derivada del escenario. Cada revisión conserva
  su elección y cuándo fue aplicada; explorar otra propuesta no borra la elección
  de los lotes ya preparados.
- Publicación con cerrojos por empresa sobre órdenes, pasos y configuración,
  lectura transaccional del contexto y chequeo de versión/vigencia de cinco
  minutos. La búsqueda se realiza fuera de la transacción.
- La emisión de un borrador vuelve a validar el escenario. Un paso iniciado,
  una fuente modificada o un contexto vencido impiden aplicar una agenda vieja.
  Reintentar una publicación aplicada no duplica lotes ni movimientos.
- El historial de las OT afectadas conserva cambios de operación y entrega. El
  cierre global se recalcula como la entrega más lejana; otros ítems conservan
  sus fechas heredadas cuando cambia ese cierre.
- Las fuentes comprimidas se reutilizan desde la revisión anterior sin cargar
  CAD en memoria para buscar opciones. Las respuestas públicas no transportan
  la agenda interna completa ni geometrías.

## Límites de esta primera implementación

La búsqueda es acotada, no demuestra el óptimo ni garantiza encontrar toda
combinación posible. Evalúa trabajos de OT pendientes, primero movimientos de
una OT, luego pares y un conjunto más amplio. No modifica operaciones iniciadas,
tercerizaciones ni trabajos excluidos. Compara hasta 24 OT candidatas, con un
presupuesto de búsqueda de diez segundos y hasta 2.500 pasos pendientes en la
cola. Si no encuentra una opción aplicable, lo informa sin declarar imposible
la fabricación.

Se necesitan tiempos, recursos y calendarios de la cola suficientemente
confirmados. No inventa disponibilidad ni resuelve bloqueos administrativos,
material faltante, horas extras o sustitución de máquinas. Los intervalos son
planificación: la ejecución real posterior y cambios de configuración pueden
modificar las proyecciones. F6 cuantitativa y F11 completa siguen pendientes.

## Validación

- Motor: cuatro entregas completas, margen reducido sin cambiar promesa, atraso
  con fecha propuesta explícita, exclusiones, trabajos iniciados y cola sin
  calendario, agrupación de componentes/lotes y días hábiles con feriados.
- Paridad front/backend: huecos antes de reservas, estaciones con varios puestos,
  ocupación dinámica y una misma máquina física. Regresión del motor ETA y fechas.
- Base de pruebas separada: publicación con 4×50 y 17 operaciones entre dos OT,
  conservación/cambio explícito de compromisos, emisión desde borrador,
  idempotencia, caducidad y rollback ante cambio de estado. Búsqueda crea una
  revisión y conserva las fuentes; verifica versiones y permisos.
- Concurrencia: publicación esperando una operación en otra transacción y
  relectura del estado antes de actualizar su agenda.
- Interfaz real en Chrome con datos ficticios, sin editar OT de desarrollo:
  selección de opciones, aceptación, exclusiones y ancho de 390 px. Las tablas
  desplazan su contenido dentro de la tarjeta y no ensanchan la página.
- TypeScript, compilación de API, ESLint focalizado y guardia de CSS.

Migraciones aditivas: `20260910120000_f6_reprogramacion_asistida` y
`20260910121000_f6_eleccion_agenda`. Aplicadas a las bases locales de desarrollo
y pruebas. No se publicaron cambios remotos ni se realizó commit/push.
