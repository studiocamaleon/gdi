# Primer bloque de Cloud API — piloto interno

25/09/2026. Rama `codex/meta-cloud-base`, basada en `codex/entorno-local`. [PR #4 en borrador](https://github.com/studiocamaleon/gdi/pull/4), con base en la rama del PR #3; no fusiona los PR previos.

## Qué permite

En Configuración → Integraciones, el administrador de la empresa designada ve una tarjeta de ensayo. Envía solamente `hello_world` en `en_US` al único destinatario autorizado en el servidor. No admite introducir otro teléfono ni credenciales en el navegador. Permite actualizar y consultar los últimos 20 intentos y sus estados: aceptado, enviado, entregado, leído, fallido o sin confirmar.

Sigue pendiente conectar empresas por Embedded Signup, automatizar sus notificaciones, administrar plantillas, implementar inbox/coexistencia y publicar la app tras las aprobaciones. Este piloto no migra WATI ni activa avisos automáticos.

## Controles y almacenamiento

- Piloto apagado por defecto y limitado a un tenant por entorno, con rol administrador, permiso de gestionar configuración y sin impersonación. El envío exige capacidad `whatsapp_automatico` y acceso operativo.
- El token de prueba y el secreto de la app viven sólo en el servidor/secretos de Fly. No llegan a web, workers, logs ni Git. Cada entorno usa sus propias variables; no copiar los secretos de staging a local.
- El teléfono autorizado debe incluir `+` y código de país. El servidor utiliza ese valor exactamente; no infiere ni modifica el destinatario.
- Cada intención de envío tiene una clave única. Dos pedidos simultáneos o un reintento con esa clave producen un solo POST a Meta. Ante timeout/5xx/respuesta incompleta se conserva la incertidumbre: no se reenvía automáticamente.
- El `biz_opaque_callback_data` contiene sólo el UUID del intento para correlacionar un webhook temprano o recuperar un envío cuya respuesta se perdió. Se exige además la empresa y el número de origen correctos.
- Los webhooks se autentican sobre el cuerpo original con HMAC-SHA256. La verificación GET exige su propio secreto. Se excluye la query de esa ruta de los logs.
- Se preservan cuenta y número, se separan los elementos de lotes mixtos y se deduplica cada evento completo. `sent`, `delivered` y `read` del mismo mensaje son eventos distintos. Los estados no retroceden por llegar fuera de orden.
- Los eventos sin asociación inequívoca se conservan sin tenant y no actualizan mensajes. La recepción y el procesamiento se confirman en la misma transacción; si falla, Meta recibe error para reintentar.
- Los mensajes del piloto se guardan en PostgreSQL. Este bloque no manda sus datos a Redis ni R2. El historial crudo aún requiere la política de retención y los procesadores del futuro inbox; no habilitar recepción masiva de cuentas clientes en esta etapa.

## Activación en staging, en orden

1. Completar validación de tipos/build y tests. Aplicar la migración aditiva `20260925210000_meta_cloud_piloto` con el rol migrador. Volver a verificar permisos de ejecución. No seed ni reset.
2. Desplegar API y web del mismo commit. La API y los workers comparten esquema: actualizar su imagen conjuntamente según el procedimiento de staging.
3. Verificar que la empresa de ensayo tenga WhatsApp habilitado en su plan, mediante las herramientas normales de Plataforma.
4. Preparar en un archivo privado fuera de Git las variables documentadas en `deploy/staging/runtime.env.example`. Importarlas sólo a la API. Obtener un token válido para el número de prueba; los tokens temporales caducan. No reutilizar credenciales locales.
5. Activar `STAGING_META_WEBHOOK_ENABLED=true` únicamente con ambos secretos configurados. Abre exactamente GET/POST de `https://api-staging.grafoprint.com.ar/api/webhooks/whatsapp`. Las otras rutas, otros métodos, sufijos y otros webhooks siguen requiriendo la credencial interna. La protección de la web de staging permanece.
6. En Meta configurar esa URL y el mismo verify token; suscribir `messages` en la app y verificar la suscripción a la cuenta correspondiente. No cambiar la solicitud de App Review ni publicar la app para esta prueba.
7. Entrar como administrador de la empresa de ensayo, revisar el destinatario mostrado y realizar una prueba autorizada. Comprobar el mensaje en WhatsApp y luego actualizar estados en Grafo. La respuesta HTTP de envío sólo prueba aceptación; exigir el webhook `delivered` para dar por validada la entrega.
8. Registrar commit, imágenes, migración y resultados reales en `deploy/staging/VALIDACION.md`. Si falta token o acceso a Meta, dejar explícitamente pendiente el ensayo real.

Para apagar el piloto: desactivar `META_WHATSAPP_PILOT_ENABLED`; para cerrar nuevamente la excepción de red, desactivar `STAGING_META_WEBHOOK_ENABLED`. Los registros se conservan. Un rollback de código no revierte la migración aditiva.

## Validación reproducible

- Tests unitarios y HTTP de `integraciones/meta`, `webhooks-whatsapp` y `common/staging-ingress`.
- `scripts/deploy/verify-meta.cjs`: exige una base cuyo nombre termine en `_test` y coincida con `DEPLOY_DATABASE_NAME`. Usa PostgreSQL real y Meta simulado. Prueba concurrencia, idempotencia, estados fuera de orden, aislamiento y webhook anterior a la respuesta del POST. Sólo elimina sus propias filas sintéticas.
- CI de staging compila API/web, aplica el historial y ejecuta el ensayo PostgreSQL. No usa credenciales ni envía mensajes a Meta.

## Resultados del primer bloque

- 32 pruebas específicas del cliente, servicio, receptor HTTP y entrada privada aprobadas.
- PostgreSQL 16 local: 283 migraciones aplicadas a una base nueva y desechable. El ensayo real comprobó un único envío con pedidos simultáneos, estados fuera de orden, duplicados, aislamiento, webhook temprano y recuperación de respuesta incierta. Meta fue simulado; no hubo mensajes reales.
- Regresión de integraciones: 210 de 211 pruebas pasaron en la primera ejecución. El ensayo existente de seis emisores simultáneos agotó la espera con el pool de prueba limitado a dos conexiones. Repetida únicamente esa suite con ocho conexiones: 10/10 aprobadas. No se cambiaron los límites de local ni staging.
- Tipos de frontend comprobados localmente. La compilación completa de API se trasladó al runner de GitHub por la memoria disponible de la Mac; no se reinició Docker ni se detuvieron los servicios existentes.
- Compilación y arranque de contenedores: [ejecución de GitHub](https://github.com/studiocamaleon/gdi/actions/runs/36189193191), sobre `ee67367cc8f0`; consultar su resultado antes de desplegar.
- La base de desarrollo y Neon staging no recibieron esta migración. El piloto no está activo. Faltan la revisión visual en la aplicación, el despliegue, los secretos de Meta, la suscripción del webhook y el ensayo real de entrega.

## Fuentes consultadas

- [API de mensajes](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api).
- [Envíos y estados](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages).
- [Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview): próxima fase en v4; v2/v3 se retiran el 15/10/2026.
