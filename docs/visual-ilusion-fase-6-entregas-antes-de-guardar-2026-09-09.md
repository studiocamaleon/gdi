# F6 — Entregas durante la creación de la OT

La distribución puede prepararse antes de guardar la orden por primera vez.
No requiere emitir una OT y modificarla después. Es una propuesta de producción;
la adopción de lotes/rutas y la reserva concurrente de capacidad siguen pendientes.

## Recorrido

1. En Crear orden, agregar **200 exhibidores**.
2. Abrir el producto → Especificaciones → **Distribuir entregas**.
3. Ingresar la cantidad de entregas y pulsar **Generar entregas**: por ejemplo,
   cuatro entregas reparte las 200 unidades en 50 por fila. El formulario nuevo
   comienza sin filas. Ajustar las cantidades y fechas solicitadas, o dejar las
   fechas vacías para que las sugiera el sistema.
4. Calcular la propuesta; revisar fechas, condiciones y costos adicionales.
   Las alternativas aparecen de menor a mayor costo adicional. **Usar esta
   alternativa** conserva la preferencia y cierra el modal al confirmarse el
   guardado; ante un error permanece abierto con los datos ingresados.
5. Guardar borrador o emitir: la OT nace vinculada a esa distribución y revisión.

El cálculo continúa si se cierra el modal. Mientras está en curso se puede seguir
armando la orden, pero hay que esperar su resultado antes del guardado. Cambiar
datos del producto, cantidades, período o descuento invalida la
cotización preparatoria y requiere revisar la distribución. Cambiar únicamente
el cliente conserva la distribución: al guardar se prepara el snapshot comercial
del cliente actual y el servidor comprueba que la fabricación siga siendo la misma.
Los nombres y fechas
descriptivas fuera de esos inputs no vuelven a cotizar el producto.

Cerrar el modal conserva sus ediciones locales. Si hay fechas o cantidades sin
calcular, no se guarda silenciosamente una distribución anterior. En la ficha,
una tabla compacta muestra **Lote A / unidades / fecha**, **Lote B**, etc. Usa la
fecha solicitada; si no existe, muestra la sugerida de la alternativa elegida
con una aclaración. Sin elección no toma fechas de otra alternativa.

**Editar distribución** abre la distribución existente. **Eliminar distribución**
vive dentro del modal y permite continuar sin incorporarla a la OT. En una OT
guardada exige la versión actual y que no se haya iniciado la producción.

La fecha final de la OT es la última entrega entre todos sus ítems comerciales.
No queda retenida por una fecha global anterior: al adelantar o eliminar el
último lote vuelve a calcularse. Una alternativa elegida usa sus fechas
solicitadas o sugeridas; una distribución sin fecha completa conserva el respaldo
del ítem. Estas fechas siguen siendo previstas: no certifican capacidad reservada.

`OrdenTrabajoItem.fechaEntrega` conserva la fecha del producto sin distribución,
para recuperarla al eliminar el reparto. La migración
`20260909230000_f6_fechas_por_item` agrega el campo DATE y respalda los renglones
históricos con su fecha global existente. Al reabrir la OT, la API devuelve las
fechas individuales y un resumen de la distribución sin costos ni geometrías.

**Redistribuir cantidades** permite cambiar el número de entregas y volver a
repartir el total, conservando las fechas de las filas que continúan. Mientras
esa nueva cantidad no se aplique, el cálculo y la elección quedan deshabilitados.
El cuerpo del modal tiene scroll; las secciones no se comprimen ni recortan sus
fechas y detalles. El encabezado y las acciones permanecen visibles.

## Persistencia y concurrencia

- `PlanEntregaItem` admite origen `cotizacionItemId` antes de existir
  `ordenItemId`. Al crear la OT conserva ambos vínculos y la misma revisión.
  Una restricción exige al menos un origen.
- Los endpoints `/cotizaciones/items/:itemId/planificacion-entregas` usan el mismo
  servicio, adaptador, outbox y worker que los planes de OT existentes. Exigen
  gestión comercial y conservan el filtrado de costos por permisos.
- El navegador prepara un snapshot con el motor real. Reutiliza esa cotización
  en el guardado, evitando generar otro origen después de planificar. Guarda una
  huella SHA-256 de los inputs para comprobar cambios, sin conservar otro CAD.
- La transacción de creación valida empresa, cliente, origen de cotización,
  cantidades, revisión y versión. Bloquea empresa → plan → cotización antes de
  insertar relaciones. No permite reutilizar el plan en dos ítems u OTs.
- Al cambiar el cliente puede vincular la misma revisión a un nuevo snapshot
  comercial, sólo si coinciden receta, entradas, piezas, layouts, recursos,
  tiempos y costos productivos. No reutiliza precios del cliente anterior ni
  elimina la comprobación de vigencia/carga del ETA. En una OT existente, editar
  sólo el cliente conserva la validez del origen sin renovar la fecha de cálculo.
- El vínculo y la actualización de su huella de origen ocurren dentro de la misma
  transacción que crea y numera la OT. Un fallo revierte todo. Las entregas,
  mediciones y la elección permanecen; el cambio de origen no las recalcula.
- Las solicitudes de cálculo y creación mantienen idempotencia. Dos reintentos
  simultáneos de una misma OT devuelven la misma orden, aun si el conflicto se
  detecta al vincular el plan antes de llegar al índice de idempotencia.
- El cálculo pendiente/fallido no se transforma en una propuesta lista. Vincular
  una propuesta ya calculada tampoco reserva capacidad ni renueva su vigencia;
  al revisarla después se sigue comprobando hora, carga y configuración.

## Validación

Migración `20260909220000_f6_planificacion_previa_ot` aplicada primero en la base
de pruebas y luego en desarrollo. Empresas, usuarios y categorías de tests se
crean y eliminan de forma aislada.

- 14 pruebas de integración específicas: cálculo antes de OT, selección,
  primer guardado en borrador, emisión directa, rollback después del vínculo,
  origen/cliente/revisión/versión cambiados, espera de cálculo, aislamiento y
  dos escenarios de concurrencia, conservación de fechas al crear/eliminar y
  fecha final entre varios ítems. Se usa el `create` real de OT y PostgreSQL;
  las respuestas enriquecidas, notificaciones, fidelización y servicios
  posteriores tienen dobles. La emisión usa un snapshot mínimo: esta prueba
  verifica el vínculo, no vuelve a certificar fabricación del exhibidor completo.
- Regresión de persistencia previa, outbox/Redis/worker, adaptador, selector,
  orquestación y fechas: 80 pruebas backend en total, incluyendo las anteriores.
- 28 pruebas frontend de distribución, conservación de cantidades/fechas,
  regeneración de filas sin claves repetidas, orden por costo sin modificar la
  respuesta original, cambios de inputs/versión, fechas y previsión del grafo
  compuesto.
- TypeScript, build API, lint de los archivos nuevos y guard CSS.
- Chrome: desde Crear orden, cotizar 200 exhibidores, abrir la distribución,
  cambiar una entrega a 60 y comprobar el bloqueo por suma 210, cerrar/reabrir
  conservando la edición, restaurar 4 × 50, calcular seis alternativas y guardar
  una preferencia. No se emitió una OT real durante la prueba visual.
- Ajuste del formulario: Chrome con 200 exhibidores, inicio sin filas,
  generación de tres entregas (67/67/66), redistribución a cuatro (50 cada una),
  cálculo real de las seis alternativas ordenadas por costo y acceso con scroll
  a todas las fechas y al desglose de operaciones de otra alternativa.
- Resumen y acciones: 200 exhibidores en 2 × 100 para el 5 y el 9 de octubre;
  elegir cierra el modal, la tabla muestra Lote A/B y el cierre global pasa al
  9 de octubre. Reabrir conserva todo; eliminar dentro del modal restaura
  «Distribuir entregas» y la fecha del ítem (2 de octubre en ese escenario).

El caso real sigue mostrando condiciones por ensamble sin estación/tiempo
calibrado y por incertidumbres de la cola. No se certificó cumplimiento de fechas
ni carga de cientos de usuarios.

Antes del primer guardado, la composición de la orden permanece en el formulario:
recargar o abandonar la página no tiene recuperación automática de ese borrador.
Los cálculos solicitados sí quedan guardados en el servidor; no se implementó
un listado de recuperación de cotizaciones preparatorias abandonadas.

### Ajuste posterior: una tanda por entrega

El selector de alternativas fue reemplazado por una propuesta única de fabricación por entrega. Se verificó en navegador el exhibidor de 200 unidades: cuatro tandas de 50, 32 placas cada una, conservación de layouts, espera de los recursos ya ocupados, guardado que cierra el modal y cuatro fechas visibles; la fecha global toma la última. No se emitió una OT real durante la prueba.

Regresiones verificadas: 81 pruebas de backend en los módulos de planificación y 13 de frontend en sus helpers (incluye los casos existentes), con casos nuevos de copias exactas, cambios de layout/capas, impresión/corte vinculados, aceptación obligatoria y su reinicio al recalcular, bloqueo de los candidatos anteriores, y selección sin aceptación cuando el original se conserva. Build de API, TypeScript, lint de archivos afectados y CSS guard sin errores. Alcance y límites actualizados en la sección 13 del diseño de F6.
