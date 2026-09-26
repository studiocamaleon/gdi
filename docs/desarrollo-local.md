# Desarrollo local

## Acuerdo de trabajo

Desarrollar y probar en esta Mac. Acumular un grupo manejable de cambios relacionados, revisarlo mediante PR y actualizar staging para la prueba final del conjunto. No hacer un despliegue cloud por cada ajuste visual o corrección pequeña. Los commits pueden seguir siendo pequeños e independientes.

Al 25 de septiembre, `codex/entorno-local` parte de la versión corregida de staging (`5b020cf70`). El PR #3 y su dependencia #2 siguen pendientes de integración; esta rama no los fusiona. Al integrar esas bases habrá que actualizar la rama de trabajo.

## Servicios

- Aplicación: `http://localhost:3000` (Next en modo desarrollo con Webpack).
- API: `http://127.0.0.1:3001/api`.
- PostgreSQL: contenedor existente `gdi-saas-postgres`, puerto 5436, base `gdi_saas`. Tiene las 290 migraciones aplicadas al 26/09, sin ejecutar seed.
- Redis: contenedor existente `gdi-saas-redis`, puerto 6379.
- PDF: contenedor existente `gdi-saas-pdf-renderer`, puerto 3002.
- Workers: procesos locales de cálculos/entregas y documentos PDF.
- Archivos: la configuración de desarrollo existente usa el bucket R2 `grafo-archivos-dev`, distinto del de staging. No se cambiaron claves ni se movieron archivos.

Los datos y los usuarios de local no son los de staging. Una sesión local antigua puede pedir volver a iniciar sesión. Los contenedores conservan sus datos al reiniciar; no usar `docker compose down -v` ni `prisma migrate reset`.

## Arranque de desarrollo

Usar Node 24. Las dependencias ya están instaladas. Ejecutar cada proceso en una terminal distinta y detenerlo con Ctrl+C. No duplicarlos si el puerto o el proceso ya están activos.

Web, desde la raíz:

```sh
NODE_OPTIONS=--max-old-space-size=2048 API_URL=http://127.0.0.1:3001/api NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api npm run dev:webpack -- --hostname 127.0.0.1
```

Los siguientes comandos se ejecutan desde `apps/api`:

```sh
# API: sin tareas programadas ni envío de correos durante el desarrollo local.
NODE_ENV=development GRAFO_LOCAL_DISABLE_CRON=true RESEND_API_KEY= HOST=127.0.0.1 LOG_LEVEL=warn NODE_OPTIONS=--max-old-space-size=2048 node --watch --watch-preserve-output -r dotenv/config -r ts-node/register/transpile-only src/main.ts
```

```sh
# Worker de cálculos y entregas.
NODE_ENV=development GRAFO_LOCAL_DISABLE_CRON=true RESEND_API_KEY= NODE_OPTIONS=--max-old-space-size=1536 GRAFONEST_POOL_ID=local GRAFONEST_POOL_CPU=2 GRAFONEST_POOL_MEMORY_MB=2048 WORKER_GEOMETRY_CONCURRENCY=1 WORKER_GEOMETRY_HEAVY_CONCURRENCY=1 WORKER_QUOTE_CONCURRENCY=1 node --watch --watch-preserve-output -r dotenv/config -r ts-node/register/transpile-only src/workers/worker-main.ts
```

```sh
# Worker de PDF.
NODE_ENV=development GRAFO_LOCAL_DISABLE_CRON=true RESEND_API_KEY= NODE_OPTIONS=--max-old-space-size=1024 WORKER_PDF_CONCURRENCY=1 WORKER_PDF_GLOBAL_CONCURRENCY=1 node --watch --watch-preserve-output -r dotenv/config -r ts-node/register/transpile-only src/documentos-pdf/documentos-worker-main.ts
```

La ejecución directa del código fuente evita que varios procesos Nest compitan por la misma carpeta `dist`. Los procesos recargan módulos modificados; las comprobaciones de tipos y pruebas se ejecutan por separado antes de proponer el lote. Si se modifican assets que no forman parte del grafo de módulos, reiniciar el proceso correspondiente.

`GRAFO_LOCAL_DISABLE_CRON` sólo tiene efecto con `NODE_ENV=development`. Pausa los barridos automáticos, incluidas notificaciones WhatsApp y reconciliaciones; no desactiva los cálculos que solicita la interfaz. No impide una acción manual contra integraciones externas: no probar envíos, cobros o facturación sin definir antes el destinatario y entorno de prueba. Staging no usa esta opción.

Las variables indicadas en los comandos sólo afectan a esos procesos. No reemplazan los archivos privados `.env`, y no usan secretos de staging.

## Arranque comprobado el 26/09/2026

La app, la API y ambos workers se levantaron desde el worktree de `codex/inbox-lectura`, con la versión `4ef6fe97c`. El checkout principal sigue en `codex/entorno-local`: editar allí no actualiza los procesos de este arranque. Antes de cambiar de rama o levantar otra instancia, comprobar la carpeta y los puertos de los procesos activos.

El worktree usa la configuración **local** existente: `.env.local` es un enlace al archivo local del checkout principal; la API y los workers cargan su `.env` mediante `DOTENV_CONFIG_PATH`. No se copiaron secretos de staging. Se mantuvieron `GRAFO_LOCAL_DISABLE_CRON=true`, `RESEND_API_KEY=` y el piloto de Meta desactivado.

Se aplicaron únicamente `20260925210000_meta_cloud_piloto` y `20260925223000_meta_recepcion_piloto`. Son cambios aditivos, sin seed ni reset. Se comprobaron los permisos del rol de ejecución sobre la tabla nueva.

Comprobaciones: API en `http://127.0.0.1:3001/api` con base disponible, página principal con sesión local, workers de cálculos y PDF iniciados, enlace Inbox visible en el sidebar y bienvenida real de `/inbox` en otra pestaña. La muestra aislada del puerto 3015 se detuvo para liberar recursos; ahora se utiliza la aplicación completa en `http://localhost:3000`.

Ampliación del 26/09: aplicada también `20260926040000_inbox_revision`, con permisos del rol de ejecución comprobados. La [base de tiempo real](inbox-tiempo-real.md) usa Redis local. El piloto real sigue desactivado: las pruebas de mensajes y reconexión utilizan empresas sintéticas en `gdi_saas_test`, no los datos de la empresa local ni Meta.

Segundo bloque del 26/09: mismo worktree, ahora en `codex/meta-conexion-empresas`, partiendo de `9eb99f37a`. Aplicada `20260926100000_meta_conexion_empresas` en desarrollo y tests, con permisos de `grafo_app` comprobados. La [base de autorización por empresa](meta-conexion-empresas.md) se prueba sin exposición HTTP y sin llamadas reales a Meta. Los servicios siguen en sus puertos; cron e integración real siguen apagados. Al regenerar Prisma fue necesario reiniciar únicamente el proceso local de la API, cuyo cierre estaba esperando conexiones persistentes; no se reinició Docker.

Tercer bloque del 26/09: mismo worktree en `codex/meta-historial-recepcion`, desde `29ca9b958`. Aplicada `20260926110000_meta_inbox_recepcion` en desarrollo y tests. La [recepción general](meta-inbox-recepcion.md) conserva trabajos en PostgreSQL y reutiliza el worker existente. `META_INBOX_RECEPCION_ENABLED` permanece apagada; no se solicitaron historiales ni se alteró Meta. Los servicios locales se recargaron con los cambios, sin reiniciar Docker.

Cuarto bloque del 26/09: mismo worktree en `codex/meta-alta-sincronizacion`, desde `ebdd5fcc1`. Aplicada `20260926140000_meta_alta_sincronizacion` en desarrollo y tests. El [recorrido de conexión](meta-conexion-empresas.md) agrega pantalla, endpoints y trabajo persistente de suscripción/contactos/historial. Los modos reales permanecen apagados y no se reclamó ningún sandbox en Meta. La bienvenida de `/inbox` se comprobó en Chrome con su sesión local y botón deshabilitado. La lectura del chat y su stream siguen limitados al piloto hasta el siguiente bloque.

Quinto bloque del 26/09: mismo worktree en `codex/inbox-conversaciones-generales`, desde `562b0d112`. Se inició Docker Desktop, que estaba apagado, y se levantaron API, web y ambos workers; no se reinició Docker ni se modificaron recursos de otros proyectos. Sin nuevas migraciones. La [lectura general y su vista local](meta-inbox-lectura-general.md) están implementadas. La API corre con `META_INBOX_LECTURA_ENABLED=false`, `META_INBOX_RECEPCION_ENABLED=false`, `META_WHATSAPP_PILOT_ENABLED=false`, `META_CONEXION_MODO=` y cron apagado; los workers también conservan Meta y cron apagados. Durante la recarga fue necesario finalizar únicamente el hijo de la API que esperaba una conexión persistente; el supervisor lo recuperó. No se alteraron secretos, staging ni producción.

Sexto bloque del 26/09: mismo worktree en `codex/inbox-importacion-reconexion`, desde `6e6909a4b`. Aplicada `20260926170000_meta_ciclo_cuenta` sólo en desarrollo y tests: **289 migraciones**. Agrega [estado de importación y reconexión](meta-importacion-reconexion.md). Los servicios continúan locales, sin reiniciar Docker, con cron y Meta reales deshabilitados. La demo del Inbox permite abrir el panel Conexión con datos ficticios.

Séptimo bloque del 26/09: mismo worktree en `codex/inbox-adjuntos-bienvenida`, desde `80c1347c8`. Aplicada `20260926190000_inbox_adjuntos` sólo en desarrollo y tests: **290 migraciones**, con permisos del rol local comprobados. Agrega [adjuntos privados y bienvenida de Grafo](meta-inbox-adjuntos.md). No se cambiaron secretos ni flags reales. Durante la recarga se finalizó únicamente el hijo local de la API que esperaba conexiones; su supervisor lo recuperó. No se reinició Docker ni se operó staging.

Octavo bloque del 26/09: mismo worktree en `codex/inbox-respuestas`, desde `03c1117fb`. Aplicada `20260926210000_inbox_envios` sólo en desarrollo y tests: **291 migraciones**, con permisos locales comprobados. Agrega [editor y respuestas de texto](meta-inbox-respuestas.md), protección de duplicados y ventana de atención. La demo simula respuestas sin Meta ni base. `META_INBOX_ENVIOS_ENABLED` queda apagado por defecto; no se cambiaron los flags ni secretos de los procesos reales, y cron sigue desactivado. Sin cambios en staging/producción ni reinicio de Docker.

Noveno bloque del 26/09: mismo worktree en `codex/inbox-plantillas`, desde `07af2d4c3`. Aplicada `20260926230000_inbox_plantillas` sólo en desarrollo y tests: **292 migraciones**, sin seed ni reset. Agrega [selector, vista previa y envío de plantillas](meta-inbox-plantillas.md). La demo permite probarlas incluso con la conversación de Clara fuera de las 24 horas. Los envíos reales y cron siguen apagados; no se alteraron secretos, staging, producción ni Docker.
