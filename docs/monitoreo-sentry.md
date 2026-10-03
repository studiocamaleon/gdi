# Monitoreo de errores de Grafoprint

Sentry agrupa fallos similares, muestra cuándo empezaron y envía avisos. No reemplaza las pruebas, la salud de los servicios ni los avisos de backups. Un formulario inválido o un permiso denegado no equivale, por sí solo, a una falla del sistema.

## Primera etapa

- Proyecto `grafoprint-web`: errores del navegador, límites de error de React, fallos de solicitudes de 500 en adelante y errores de renderizado del servidor Next.
- Proyecto `grafoprint-api`: excepciones HTTP de 500 en adelante, errores no controlados y fallos de las colas de cotización, geometría, planificación y PDF. API y workers se distinguen por la etiqueta `servicio`.
- En los errores HTTP y trabajos de backend se adjunta sólo el identificador interno de empresa disponible. No se adjuntan nombre, CUIT, correo o teléfono. Las tareas concurrentes usan contextos separados.
- Sentry se inicia sólo con habilitación explícita y entorno cloud reconocido. El desarrollo local habitual no envía eventos.

Los eventos guardan categoría, ubicaciones técnicas permitidas, área, servicio, versión, entorno y, cuando corresponde, referencia de solicitud y empresa. El mensaje original se omite porque puede contener SQL, datos de clientes o respuestas de proveedores. Se reconstruye el evento desde una lista permitida; no se envían formularios, cabeceras, cookies, archivos, conversaciones, variables locales ni navegación. No se habilitan Replay, profiling, logs ni métricas de aplicación. Se descartan spans y transacciones.

## Configuración y publicación

1. Mantener separados los proyectos web/API; activar el filtrado de datos sensibles y la prevención de almacenamiento de IP en ambos. Limitar el proyecto web a los orígenes de staging y producción. No habilitar extracción de código fuente desde sitios externos.
2. Guardar `SENTRY_DSN` y `SENTRY_ENABLED=true` en cada servicio que se vaya a observar. Web usa el proyecto web; API y ambos workers usan el proyecto API. Un DSN permite enviar eventos, **no** leer ni administrar la cuenta. No requiere entregar credenciales administrativas a la aplicación.
3. Compilar con `--build-arg GRAFO_RELEASE=<commit completo>`. El entorno se resuelve al ejecutar: `GRAFO_DEPLOY_ENV=staging` (o `STAGING_PRIVATE=true`) para staging, `GRAFO_DEPLOY_ENV=production` para producción. Los workers también necesitan la marca de entorno aunque no tengan servicio HTTP. El navegador recibe sólo la configuración pública de su entorno desde `/api/observabilidad/config`, sin caché. Esto permite promover una misma imagen sin mezclar los entornos.
4. Probar primero en staging: fallo de vista, respuesta 500, trabajo fallido y reinicio. Comprobar que cada evento aparece una sola vez por origen esperado, sin datos privados, con versión y empresa correctas; verificar también el aviso por correo.
5. Publicar a producción únicamente después de ese recorrido. Confirmar salud, consumo, copias y posibilidad de desactivar el monitor con `SENTRY_ENABLED=false`. Un fallo del monitor no debe bloquear las operaciones del sistema.

## Estado al 03/10/2026

**Activo en staging y producción**, revisión de ejecución `b030b6ab7a471bf41e55ff6f460a928c4b808b63` (PR #20, dependiente del #19). Los dos proyectos reciben eventos con entorno, servicio y versión. Plataforma muestra los incidentes usando una credencial limitada a `event:read`, guardada sólo en la API. No se contrató un plan pago.

Pruebas locales: eliminación de datos sensibles, rechazo de destinos de telemetría ajenos, separación entre empresas concurrentes con el SDK real, clasificación HTTP 4xx/5xx, filtros, caché y permisos HTTP de Plataforma. Las 36 pruebas enfocadas pasaron (28 de backend y 8 de interfaz); también tipos y lint de los archivos modificados. [CI de contenedores y tipos](https://github.com/studiocamaleon/gdi/actions/runs/37096268431) y [CI de permisos y separación](https://github.com/studiocamaleon/gdi/actions/runs/37096268425) aprobados para el código publicado.

En ambos entornos se pulsó **Probar monitoreo** desde Chrome: API y navegador emitieron eventos ficticios y el panel incorporó los nuevos incidentes sin recargar. Se verificó por separado el transporte desde los contenedores de ambos workers y el servidor Next, con recepción HTTP 200, entorno y versión correctos. Estos ensayos no provocaron una caída de las colas ni de procesos de producción. En Sentry se comprobó la ocultación de IP y la ausencia de URL y datos personales en el detalle mostrado. El ensayo del servidor también confirmó que el texto y extras ficticios privados se eliminan antes de enviar.

La dirección operativa para avisos fue verificada por el titular y elegida explícitamente para ambos proyectos. Las reglas avisan cuando Sentry clasifica un incidente nuevo o existente como de alta prioridad; el destinatario es un miembro fijo, sin depender de su actividad reciente. El panel permite consultar también los incidentes de otras prioridades. La recepción de las notificaciones de prueba se registra en la validación del despliegue. El correo principal de la cuenta y la dirección de entrega por proyecto son configuraciones distintas.

Los mapas de código fuente están desactivados en esta primera etapa. Para que Sentry traduzca las líneas compiladas del navegador a los archivos originales, preparar una credencial de compilación limitada, subir los mapas en el builder y retirarlos de la imagen pública. Esa credencial no debe quedar en variables del navegador, argumentos de Docker ni secretos de ejecución. También faltan el ensayo de alertas por aumento de errores, los trabajos de integraciones que manejan errores internamente y las métricas de disponibilidad/latencia.

## Cuando llegue un aviso

### Panel en Plataforma

**Plataforma → Errores del sistema** consulta los incidentes con actualización automática cada minuto mientras la pestaña está visible. Permite elegir entorno, período, estado e inclusión de ensayos. Muestra hasta 50 incidentes recientes, prioridad, repeticiones del período cuando Sentry las proporciona y acceso al detalle. Una consulta fallida se indica como tal, conservando la última lectura disponible; nunca se interpreta como cero errores.

Si Sentry no proporciona el conteo filtrado, se muestra «—»: no se sustituye por el total histórico de otros entornos o períodos. Las pruebas están excluidas por defecto; elegir **Incluir pruebas** permite comprobar el circuito. El botón de ensayo puede tardar hasta un ciclo de actualización en aparecer en el listado.

La API necesita `SENTRY_READ_TOKEN` con permiso `event:read` y `SENTRY_ORG=grafoprint`. Este token sólo va en el almacén privado y en los secretos de **API**, nunca en Next, el navegador, los workers ni los argumentos de compilación. La consulta usa un destino fijo de Sentry US, dos proyectos conocidos, tiempo límite y caché de 30 segundos. Las respuestas se reconstruyen para no reenviar asignaciones, correos ni contenido arbitrario del proveedor.

La lectura exige sesión personal de Plataforma, usuario activo y MFA completo. El rol de empresa no habilita el monitor. **Probar monitoreo** requiere administrador de Plataforma y admite un envío por minuto: genera errores ficticios en API y navegador, sin provocar una caída ni modificar datos. Se distingue la solicitud enviada de la recepción confirmada en el listado. Los ensayos quedan fuera de la vista normal.

Pruebas locales del panel: validación de filtros, proyección sin datos privados, separación de entornos, caché, falla del proveedor, estados visibles y recorrido HTTP de permisos. La activación y sus evidencias cloud se registran por entorno en los documentos de validación.

1. Revisar entorno, versión, área y empresas afectadas. Distinguir una prueba marcada `operacion=prueba` de un incidente real.
2. Reproducir con datos ficticios, preparar la corrección en una rama y agregar una prueba del problema.
3. Probar localmente y en staging; publicar el conjunto comprobado y observar si el incidente reaparece.
4. Resolver el incidente una vez comprobada la corrección. Una regresión debe volver a avisar. No pegar datos personales ni registros sin filtrar en comentarios de Sentry.

Referencias: [SDK Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/), [SDK NestJS](https://docs.sentry.io/platforms/javascript/guides/nestjs/). Revisado con SDK 11.4.0; no copiar configuraciones antiguas de recopilación de datos porque los valores predeterminados cambiaron.
