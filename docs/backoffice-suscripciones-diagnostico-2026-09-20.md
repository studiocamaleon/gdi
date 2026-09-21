# Plataforma: suscripciones y diagnóstico de cobros

**Fecha:** 20 de septiembre de 2026.  
**Rama:** `codex/rediseno-backoffice-plataforma`.  
**Alcance:** diagnóstico operativo y consulta auditada del estado de Paddle.

## Recorrido

1. Entrar a **Plataforma → Suscripciones**. Buscar empresa o referencia y filtrar por proveedor, pago pendiente, prueba, bloqueo o consulta pendiente. El listado se pagina en el servidor.
2. Abrir una empresa para ver su plan, estado comercial, acceso efectivo y fechas. También se llega desde **Empresas → Suscripción → Ver diagnóstico e historial de cobros**.
3. Revisar **Eventos de Paddle**: qué ocurrió, cuándo llegó y si Grafo lo aplicó, lo conservó como información, descartó un estado anterior o encontró un fallo. Los detalles técnicos están plegados.
4. Administración puede elegir **Consultar Paddle**, indicar un motivo y recuperar el estado actual. El resultado permanece abierto hasta cerrarlo; luego se actualiza la ficha. Soporte puede leer el diagnóstico e historial.
5. El historial conserva responsable, motivo, resultado y estado anterior/posterior, incluso al cerrar la página o perder la respuesta del navegador.

## Qué significa cada estado

- **Paddle:** situación comercial informada por el proveedor.
- **Grafo:** estado de la suscripción aplicado por las reglas existentes de mora y gracia.
- **Acceso efectivo:** considera también el bloqueo administrativo. Un pago regularizado no elimina un bloqueo del equipo.
- **Prueba:** la fecha local para suscripciones manuales; para Paddle `trialing`, el próximo cobro. Esto no recrea un trial local sobre un contrato Paddle.
- **Consulta pendiente:** no hubo una consulta exitosa a la API o pasaron más de 30 minutos. Es una señal de antigüedad; los webhooks pueden seguir actualizando la suscripción.
- **API/firma configurada:** indica configuración disponible, no una prueba de conectividad ni salud del proveedor.

El listado y los detalles leen datos guardados en Grafo. **Actualizar vista** recarga esos datos; **Consultar Paddle** sí consulta el proveedor. La sincronización automática existente continúa cada diez minutos.

## Consulta auditada

La nueva acción usa solamente `GET` remoto y actualiza el estado local. No realiza cobros, devoluciones, cancelaciones ni cambios de contrato en Paddle.

- Requiere sesión personal de Administración con MFA verificada. Se revalida el permiso antes y después de la llamada externa.
- Motivo obligatorio y UUID de solicitud. Reintentar una respuesta incierta recupera la misma operación y no dispara otra consulta. Para efectuar una nueva consulta después de un resultado final, cerrar y abrir la acción nuevamente.
- Una consulta en curso por suscripción; espera remota máxima de 20 segundos. Las operaciones abandonadas quedan identificadas y se permite otra después de dos minutos.
- La llamada HTTP ocurre fuera de la transacción. Estado, resultado y auditoría se confirman juntos en la transacción final.
- Se comprueba que referencia, empresa y suscripción sigan vinculadas. Un fallo no aplica la respuesta del proveedor.
- Si el precio remoto no corresponde a un plan conocido, se conserva el plan anterior y el resultado pide **Revisar plan**.
- El diagnóstico no devuelve payloads ni excepciones crudas de Paddle, claves o secretos de configuración.

## Orden y duplicados de eventos

Las consultas manuales, la reconciliación automática y los webhooks comparten la aplicación del estado. Se guarda `actualizadoProveedorEl`, derivado de `updated_at` remoto; para eventos antiguos sin ese campo se usa `occurred_at`.

La aplicación se serializa por referencia y empresa. Una respuesta antigua no puede reemplazar el estado más reciente. El webhook bloquea su propio registro y confirma procesamiento y estado en la misma transacción: reentregas concurrentes no aplican dos veces el evento.

Los nuevos eventos tienen un resultado explícito: aplicado, informativo, sin aplicar o fallido. Para los históricos, la pantalla infiere el resultado de los campos existentes; no es una reconstrucción de cada intento pasado. Se recupera la referencia de suscripción desde los payloads existentes cuando está disponible.

Referencias primarias: [consultar una suscripción en Paddle](https://developer.paddle.com/api-reference/subscriptions/get-subscription/) y [recepción y respuesta a webhooks](https://developer.paddle.com/webhooks/about/respond-to-webhooks/).

## Datos y puesta en marcha

Migración `20260920200000_plataforma_suscripciones_diagnostico`: versión remota en `Suscripcion`, referencia/resultado en `EventoCobro` y registro global `SincronizacionPaddle` con índices. Aplicada en desarrollo y en la base aislada de pruebas; cliente Prisma regenerado y API reiniciada.

Endpoints bajo `/api/plataforma/suscripciones`: listado, detalle, eventos, historial y `POST /:id/sincronizar`. Lecturas paginadas y respuestas `no-store`. La escritura tiene límite de solicitudes y guard de Administración.

## Límites de esta entrega

- El historial de consultas registra las intervenciones manuales nuevas. Del proceso automático se muestra la última consulta exitosa, no una bitácora completa de ejecuciones.
- Se consulta la suscripción vinculada actualmente. Los eventos sin referencia y las referencias anteriores requieren una futura bandeja global de integración.
- El filtro **Requieren atención** cubre estado, mora, prueba, bloqueo y antigüedad. No es una bandeja global de todos los errores de webhooks ni de consultas históricas.
- No incluye importes cobrados, recibos, reembolsos, reenvío de eventos desde Paddle ni conciliación bancaria. Son ampliaciones posteriores del módulo.
- La reconciliación automática conserva su recorrido actual. Dividirla en lotes con concurrencia acotada y medir atraso queda para la etapa de operación.

## Verificación

- **136 pruebas de API aprobadas** en 15 suites de Plataforma, cobros, suscripciones y aislamiento entre empresas.
- **8 pruebas de interfaz aprobadas** en Suscripciones y Empresas.
- TypeScript de la aplicación web y de la API con su configuración de compilación, ESLint de los archivos intervenidos, control de CSS y whitespace sin errores. La comprobación TypeScript global que incluye todos los tests del repositorio sigue reportando errores ajenos a este incremento en fixtures de otros módulos; la configuración de compilación excluye esos tests.

Pruebas de API con PostgreSQL aislado y Paddle simulado: autorización, filtros, prueba remota, idempotencia, concurrencia, pérdida de permisos durante la consulta, referencia incorrecta, respuesta antigua, eventos duplicados, precio desconocido, errores saneados y recuperación de operaciones abandonadas.

Pruebas de interfaz: paginación conservando filtros, estados de cobro/acceso separados, respuestas demoradas, lectura de Soporte, motivo obligatorio, doble envío, resultado persistente y reintento con la misma solicitud.

La revisión visual de las nuevas pantallas con la cuenta local está pendiente del enrolamiento MFA del titular. La sesión disponible permanece en **Protegé tu acceso**; no se modificó su autenticador. No se ejecutaron intervenciones sobre suscripciones reales de Paddle durante estas pruebas.
