# Planes: continuidad de impresión

Actualizado: 22/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Comportamiento

- Encolar documentos, preparar un envío y liberar un lote revalidan `impresion_directa` y `colas_impresion` dentro de su transacción. Toman primero el lock de empresa, luego el de OT/destino; comparten la serialización con los cambios de contrato.
- La firma se genera después de esa revalidación y de comprobar turno, revisión del perfil e idempotencia. La preparación del PDF sigue fuera de la transacción. Una operación que leyó el contrato anterior antes del cambio ya no puede entregar una firma después de que se confirmó la retirada.
- Un cambio de plan pendiente en `enviando`, `checkout` o `verificar` que retire esas funciones impide nuevos envíos y nuevas intenciones. El vencimiento de la revisión no equivale a cancelar el pago. No concede funciones del destino antes de aplicar el contrato.
- Retirar la impresión conserva la consulta y la verificación humana de lo ya enviado, con los permisos personales correspondientes. Confirmar o registrar estados revalida que la empresa pueda operar. Una suscripción dada de baja conserva lectura, pero no puede escribir confirmaciones ni estados.

## Historial desde la OT

La cabecera ofrece **Historial de impresión** sólo cuando existen solicitudes o envíos registrados. El servidor comprueba esa existencia independientemente del plan y del límite de 200 eventos del historial general.

El diálogo consulta páginas de hasta 50 envíos; no carga QZ, no consulta perfiles actuales ni vuelve a enviar documentos. Muestra documento, impresora, estado, eventos y verificación humana. Permite seleccionar varias salidas vigentes y registrar su revisión en un segundo paso explícito. Los envíos sustituidos por una reimpresión no se pueden confirmar. El servidor revalida las versiones al guardar.

Las solicitudes que nunca llegaron a enviarse se informan por separado. Los archivos se conservan en la OT para operación manual o para retomar el asistente si vuelve a habilitarse. Abrir el historial no transforma una solicitud pendiente en una impresión realizada.

Los controles permanecen debajo del área de scroll; no cubren las últimas filas. Un fallo al cambiar de página descarta la selección anterior, muestra el error y permite volver a consultar.

## Evidencia

Pruebas sobre `gdi_saas_test`, sin impresoras físicas ni cambios comerciales en empresas de desarrollo:

- Documentos: 49 pruebas, incluidas tres variantes de contratación pendiente que bloquean creación y permiten confirmar envíos existentes.
- Cola e historial: 10 pruebas con PostgreSQL real. Dos enfrentan un cambio de contrato con preparar/encolar en conexiones independientes y verifican la espera efectiva mediante `pg_blocking_pids`; tras confirmar el cambio, no queda firma ni evento nuevo. Incluye aislamiento por empresa, paginación, reimpresión, consulta sin capacidad y sólo lectura tras la baja.
- HTTP: ocho pruebas del guard de impresión y permisos personales. La ruta histórica no necesita contratar impresión, pero leer no concede permiso para confirmar. Parámetros inválidos se rechazan y las respuestas llevan `no-store`. La identidad de sesión está simulada en estas pruebas; no sustituyen los tests de autenticación.
- Recorridos de planes: 20 pruebas. La nueva verifica que una impresión anterior a los últimos 200 eventos sigue habilitando el botón incluso con Esencial asignado y sin impresión conectada.
- Web: 18 pruebas entre el diálogo histórico y los providers. Incluye selección múltiple, error al confirmar, permisos de lectura y ausencia de carga del transporte QZ en el historial. El provider de impresión sigue desmontado cuando no corresponde al plan.

Revisión visual en Chrome de OT-2026-0071: seis envíos históricos cargados, estados y verificaciones previas conservados, scroll interno y pie visible al final. No se registraron confirmaciones nuevas ni se enviaron archivos a impresoras durante esta revisión.

Resultado: **87 pruebas API y 18 web aprobadas**. Tipos de producción API/web y de los tests focales, lint de los archivos de impresión, `git diff --check` y guard de CSS sin errores. API de desarrollo reiniciada y respuesta HTTP 200 en `/api`.

## Límites y siguientes pasos

- Un trabajo aceptado por QZ/Windows antes del cambio no se cancela por cambiar el plan. El estado del spooler tampoco demuestra que la copia física salió correctamente.
- El diálogo histórico no administra la cola ni permite descartar solicitudes o reimprimir. La preparación y el envío siguen en el asistente contratado.
- El diagnóstico incorpora los conteos descritos abajo; sigue exigiendo revisar los equipos porque Grafo no conoce la salida física ni los trabajos enviados por otras aplicaciones.
- Las pruebas de concurrencia cubren preparar y encolar. Liberación de lotes y resultados usan el mismo control transaccional, pero todavía no tienen una carrera independiente para cada variante. Tampoco se da por cerrada toda la configuración de impresoras y etiquetas directas bajo cambios concurrentes.
- Impresión continúa como piloto. Este incremento no activa esa función en Esencial, Pro ni Avanzado, no cambia precios y no repite la prueba de Paddle.

## Diagnóstico de retirada de impresión · segundo incremento del 22/09

Al retirar impresión conectada o colas, tanto la asignación administrativa como la contratación comercial muestran dos cantidades separadas:

- **Trabajos sin enviar:** solicitudes persistidas cuyo ítem sigue existiendo y que no tienen ningún envío del mismo documento/página. Un envío antiguo sin vínculo a la cola también cuenta como enviado. No se duplican solicitudes por retirar ambas funciones juntas.
- **Salidas sin verificar:** último envío de cada documento o página CAD, sin confirmación humana. Incluye estados terminados de Windows, errores y resultados inciertos. Una reimpresión sustituye al intento anterior para este conteo. Una OT entregada puede conservar salidas sin verificar.

Se excluyen borradores, órdenes canceladas y datos de otras empresas. La consulta sólo usa registros de Grafo; no consulta QZ, perfiles ni archivos. Si el cambio no retira estas funciones, no ejecuta la consulta de impresión.

Estos pendientes permiten continuar **después de aceptar cada aviso**: las solicitudes conservan sus archivos para la vía manual y las salidas conservan el historial y su verificación desde la OT. Cambiar el contrato no imprime, cancela, borra ni confirma trabajos. El resto de compromisos mantiene su política de bloqueo previo. Siempre se solicita además revisar las colas físicas con los operarios.

La huella del diagnóstico incorpora los identificadores de los pendientes, además de las cantidades. Cambiar un pendiente por otro, aunque el total sea idéntico, invalida la aceptación anterior. El servidor vuelve a comprobarla antes de asignar y antes de solicitar el cobro.

### Evidencia de este incremento

- Cinco pruebas de la consulta con PostgreSQL real: separación de grupos, reimpresiones, páginas CAD, datos históricos, aislamiento, estados de OT y reemplazo con igual cantidad.
- Asignación y contratación: rechazo de aceptación incompleta y de revisiones obsoletas, continuidad tras aceptar y conservación exacta de eventos. La contratación usa el servicio real y transporte Paddle simulado; no repite el pago externo.
- Dos carreras nuevas entre los servicios reales de asignación y solicitud de impresión, con conexiones independientes y `pg_blocking_pids`: si se encola primero, la asignación exige revisar; si se asigna primero, el nuevo encolado se rechaza sin crear una solicitud.
- Regresión de los bloqueos de Compras, Reservas, Finanzas y Proyectos dentro de la suite concurrente compartida, además de comparación, diagnóstico y contratación.
- Dos pruebas nuevas de interfaz verifican cantidades visibles y aceptación de cada aviso antes de asignar o pedir un cobro.

Resultado: **74 pruebas API en seis suites y 15 web en dos suites aprobadas**, sobre la base de pruebas y sin impresoras físicas. Tipos API/web y de los tests focales, lint focal y guard de CSS verificados. No hay migración nueva en este incremento.
