# Desarrollo local

## Acuerdo de trabajo

Desarrollar y probar en esta Mac. Acumular un grupo manejable de cambios relacionados, revisarlo mediante PR y actualizar staging para la prueba final del conjunto. No hacer un despliegue cloud por cada ajuste visual o corrección pequeña. Los commits pueden seguir siendo pequeños e independientes.

Al 25 de septiembre, `codex/entorno-local` parte de la versión corregida de staging (`5b020cf70`). El PR #3 y su dependencia #2 siguen pendientes de integración; esta rama no los fusiona. Al integrar esas bases habrá que actualizar la rama de trabajo.

## Servicios

- Aplicación: `http://localhost:3000` (Next en modo desarrollo con Webpack).
- API: `http://127.0.0.1:3001/api`.
- PostgreSQL: contenedor existente `gdi-saas-postgres`, puerto 5436, base `gdi_saas`. Tiene las 282 migraciones aplicadas, sin ejecutar seed.
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
NODE_ENV=development RESEND_API_KEY= NODE_OPTIONS=--max-old-space-size=1536 GRAFONEST_POOL_ID=local GRAFONEST_POOL_CPU=2 GRAFONEST_POOL_MEMORY_MB=2048 WORKER_GEOMETRY_CONCURRENCY=1 WORKER_GEOMETRY_HEAVY_CONCURRENCY=1 WORKER_QUOTE_CONCURRENCY=1 node --watch --watch-preserve-output -r dotenv/config -r ts-node/register/transpile-only src/workers/worker-main.ts
```

```sh
# Worker de PDF.
NODE_ENV=development RESEND_API_KEY= NODE_OPTIONS=--max-old-space-size=1024 WORKER_PDF_CONCURRENCY=1 WORKER_PDF_GLOBAL_CONCURRENCY=1 node --watch --watch-preserve-output -r dotenv/config -r ts-node/register/transpile-only src/documentos-pdf/documentos-worker-main.ts
```

La ejecución directa del código fuente evita que varios procesos Nest compitan por la misma carpeta `dist`. Los procesos recargan módulos modificados; las comprobaciones de tipos y pruebas se ejecutan por separado antes de proponer el lote. Si se modifican assets que no forman parte del grafo de módulos, reiniciar el proceso correspondiente.

`GRAFO_LOCAL_DISABLE_CRON` sólo tiene efecto con `NODE_ENV=development`. Pausa los barridos automáticos, incluidas notificaciones WhatsApp y reconciliaciones; no desactiva los cálculos que solicita la interfaz. No impide una acción manual contra integraciones externas: no probar envíos, cobros o facturación sin definir antes el destinatario y entorno de prueba. Staging no usa esta opción.

Las variables indicadas en los comandos sólo afectan a esos procesos. No reemplazan los archivos privados `.env`, y no usan secretos de staging.
