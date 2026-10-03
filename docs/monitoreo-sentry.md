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
3. Compilar con `--build-arg GRAFO_RELEASE=<commit completo>`. El entorno se resuelve al ejecutar: `STAGING_PRIVATE=true` para staging, `GRAFO_DEPLOY_ENV=production` para producción. El navegador recibe sólo la configuración pública de su entorno desde `/api/observabilidad/config`, sin caché. Esto permite promover una misma imagen sin mezclar los entornos.
4. Probar primero en staging: fallo de vista, respuesta 500, trabajo fallido y reinicio. Comprobar que cada evento aparece una sola vez por origen esperado, sin datos privados, con versión y empresa correctas; verificar también el aviso por correo.
5. Publicar a producción únicamente después de ese recorrido. Confirmar salud, consumo, copias y posibilidad de desactivar el monitor con `SENTRY_ENABLED=false`. Un fallo del monitor no debe bloquear las operaciones del sistema.

## Estado de la primera implementación

Cuenta creada mediante GitHub, proyectos web/API creados y filtros de privacidad configurados. Se comprobó la recepción real de un error **ficticio** mediante el código nuevo de backend, ejecutado aisladamente desde la Mac; esto no equivale a una prueba del despliegue cloud. No se contrató un plan pago.

Pruebas locales: eliminación de datos sensibles en el evento, rechazo de destinos de telemetría ajenos, separación entre empresas concurrentes usando el SDK real con transporte simulado, y clasificación HTTP 4xx/5xx en el filtro del API. La integración está separada de la publicación de «Deshacer tomo» y permanece sin activar en los servicios desplegados.

Pendiente antes de activación: compilación global remota, recorrido cloud completo, recepción efectiva del correo, elección/verificación de la dirección operativa de avisos y vista de incidentes en Plataforma. El alta con GitHub heredó el correo de esa cuenta; no asumir que los avisos llegan al correo de soporte.

Los mapas de código fuente están desactivados en esta primera etapa. Para que Sentry traduzca las líneas compiladas del navegador a los archivos originales, preparar una credencial de compilación limitada, subir los mapas en el builder y retirarlos de la imagen pública. Esa credencial no debe quedar en variables del navegador, argumentos de Docker ni secretos de ejecución. También faltan el ensayo de alertas por aumento de errores, los trabajos de integraciones que manejan errores internamente y las métricas de disponibilidad/latencia.

## Cuando llegue un aviso

1. Revisar entorno, versión, área y empresas afectadas. Distinguir una prueba marcada `operacion=prueba` de un incidente real.
2. Reproducir con datos ficticios, preparar la corrección en una rama y agregar una prueba del problema.
3. Probar localmente y en staging; publicar el conjunto comprobado y observar si el incidente reaparece.
4. Resolver el incidente una vez comprobada la corrección. Una regresión debe volver a avisar. No pegar datos personales ni registros sin filtrar en comentarios de Sentry.

Referencias: [SDK Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/), [SDK NestJS](https://docs.sentry.io/platforms/javascript/guides/nestjs/). Revisado con SDK 11.4.0; no copiar configuraciones antiguas de recopilación de datos porque los valores predeterminados cambiaron.
