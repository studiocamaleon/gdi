# PDFs de presupuestos: generación y operación

## Comportamiento

El botón **PDF** de la ficha abre el documento guardado. Si aún se está generando, muestra **Preparando PDF** y abre el archivo automáticamente cuando termina. Consulta cada 2 segundos, como máximo durante 90 segundos; después permite volver a consultar. Cerrar la pestaña no cancela el trabajo. Ante un fallo definitivo se puede reintentar desde esa pantalla.

Con `PRESUPUESTO_PDF_ASYNC=true`, el envío guarda en una misma transacción su estado comercial y un `DocumentoPdf` pendiente con todos los datos necesarios para imprimir. La API no espera a Chromium ni necesita Redis para registrar el pedido. Un worker independiente recoge los pendientes desde PostgreSQL y usa BullMQ para ejecutar la conversión HTML/CSS en Gotenberg.

- **Revisión 1:** primera descarga antes del envío; se identifica como borrador.
- **Revisión 2:** versión definitiva capturada al enviar; tiene su propio archivo.
- Cada snapshot incluye importes, especificaciones, moneda, condiciones, fechas, datos de empresa y logo embebido. El PDF no vuelve a cotizar ni consulta precios actuales.
- Los snapshots y el hash del PDF terminado son inmutables, también por restricciones de base de datos. Reenviar, reintentar o descargar no reemplaza la versión ya guardada.
- Los PDFs históricos siguen descargándose sin cambios. Un presupuesto antiguo que nunca tuvo PDF se captura cuando se pide por primera vez: sus importes guardados se conservan, pero la marca y condiciones sólo pueden capturarse con los datos disponibles en ese momento.
- El almacenamiento usa el driver existente (R2 en producción), URL firmada de corta duración y cómputo de cuota. Los bytes de descarga no atraviesan la API ni el BFF.
- La plantilla `presupuesto-marca-v1` usa Geist, logo del tenant, grafito y naranja; tablas paginadas, totales y condiciones de la prueba piloto. Los restantes tipos de documento conservan sus generadores actuales.

## Límites y recuperación

| Control | Valor inicial |
| --- | --- |
| Trabajos en Redis esperando/en curso | 100 como máximo por cola |
| Trabajos en cola por empresa | 4 |
| Generaciones globales simultáneas | 2 (`WORKER_PDF_GLOBAL_CONCURRENCY`) |
| Generaciones por proceso | 2 (`WORKER_PDF_CONCURRENCY`) |
| Generaciones simultáneas por empresa | 1 (`WORKER_TENANT_PDF_CONCURRENCY`, distribuido en Redis) |
| Intentos automáticos | 3, con pausas de 5 y 10 segundos |
| Lease del documento | 120 segundos; se renueva cada 40 segundos |
| Timeout de render | 35 segundos en el worker; 30 en Gotenberg |
| Tamaño del documento | 500 productos, 4 MiB de snapshot, 16 MiB de PDF |
| Historial de BullMQ | Terminados: 1 día / 1.000; fallidos: 7 días / 2.000 |

Los pendientes restantes permanecen en PostgreSQL, sin cargar todo el lote en memoria ni Redis. El despachador se ejecuta cada 2 segundos y toma un lease compartido para coordinar réplicas. Alterna candidatos por empresa y respeta el cupo por tenant.

Si Redis pierde sus datos, los pendientes se reencolan desde PostgreSQL. Si el proceso muere, otro worker recupera los documentos cuyo lease venció. Un token de publicación impide que un worker anterior publique después de perder su trabajo. Reintentar manualmente una falla abre una nueva ronda sobre **el mismo snapshot**.

La subida se registra como `Archivo.PENDIENTE` antes de hacer el PUT. Sólo cuando la publicación y el incremento atómico de cuota se confirman juntos pasa a `LISTO`. Un fallo deja una clave rastreable; el barrido existente de archivos pendientes limpia esos objetos después de 24 horas. Los reintentos no duplican cuota ni sobrescriben el archivo ganador.

No hay fallback silencioso a un diseño distinto ante una caída del renderer. La versión de plantilla debe existir en el worker: antes de cambiarla, conservar el renderer anterior para sus pendientes o drenar la cola. Un hash alterado o versión no soportada se detiene con error.

## Arranque local

Desde la raíz:

```sh
docker compose --profile pdf up -d redis pdf-renderer
```

Desde `apps/api`, aplicar la migración `20260917220000_documentos_pdf_durables`, configurar `.env` y reiniciar la API:

```dotenv
PRESUPUESTO_PDF_ASYNC=true
PRESUPUESTO_PDF_PILOTO=false
PDF_RENDER_URL=http://127.0.0.1:3002
WORKER_PDF_CONCURRENCY=2
WORKER_PDF_GLOBAL_CONCURRENCY=2
WORKER_TENANT_PDF_CONCURRENCY=1
```

En otro proceso, también desde `apps/api`:

```sh
npm run worker:pdf:dev
```

`worker:pdf:dev` ejecuta TypeScript sin recompilar/borrar el `dist` usado por el servidor de desarrollo. Reiniciar este proceso después de modificar su código. No iniciar otro `nest build` mientras el watcher de la API está activo.

## Despliegue

1. Hacer backup y aplicar las migraciones con `npm run prisma:migrate:deploy`.
2. Desplegar la misma revisión de código para API y worker. Compilar una vez con `npm run build`; las fuentes `.ttf` se copian mediante `nest-cli.json`.
3. Levantar Redis con persistencia y Gotenberg en red privada. Compose fija Gotenberg 8.37.0 por digest; deshabilita JavaScript, recursos de red externos/internos, descarga remota, webhooks y rutas ajenas a Chromium. No publicar el puerto del renderer en Internet.
4. Ejecutar un servicio independiente con `npm run worker:pdf:prod` desde el directorio de la API. Requiere la misma base, credenciales de storage, `REDIS_URL` y `PDF_RENDER_URL`. No inicia HTTP ni schedulers de facturación/notificaciones.
5. Mantener inicialmente 2 conversiones globales y 1 por tenant. Aumentar capacidad junto con réplicas/recursos de Gotenberg y después de medir CPU, memoria y tiempo de espera; no sólo aumentar la concurrencia de Node.
6. Activar `PRESUPUESTO_PDF_ASYNC=true` en la API y verificar un presupuesto nuevo de prueba. `.env.example` mantiene la activación deshabilitada para evitar pedidos pendientes en despliegues que todavía no tienen worker.

El proceso escucha SIGTERM/SIGINT y drena los trabajos antes de cerrar Prisma/Redis. Darle tiempo de apagado suficiente (al menos 120 segundos); ante un corte forzado, la recuperación por lease mantiene la durabilidad.

### Reversión

Desactivar `PRESUPUESTO_PDF_ASYNC` detiene el alta de nuevos pedidos asíncronos y conserva el generador previo para presupuestos futuros. Mantener el worker hasta procesar los pendientes. Los documentos ya registrados siguen usando su snapshot y archivo; nunca se borran sus tablas ni se regeneran históricos para revertir el despliegue. El endpoint interno de comparación `pdf-piloto` queda apagado y ya no aparece como acción en la ficha.

## Observación

Los logs `pdf_completed` registran documento/tenant/revisión, versión de plantilla, intentos, bytes, espera, tiempo de render y almacenamiento, y memoria RSS. No registran el contenido del snapshot ni las URLs firmadas. `pdf_dispatch_unavailable`, `pdf_job_failed` y errores de renovación indican problemas operativos.

Consultas de diagnóstico (sin datos comerciales):

```sql
SELECT estado, count(*), min("createdAt") AS mas_antiguo
FROM "DocumentoPdf" GROUP BY estado;

SELECT id, "tenantId", estado, intentos, "errorCodigo", "leaseHasta"
FROM "DocumentoPdf"
WHERE estado = 'FALLIDO'
   OR (estado = 'PROCESANDO' AND "leaseHasta" < now())
   OR (estado = 'PENDIENTE' AND "createdAt" < now() - interval '5 minutes');
```

Alertar ante pendientes de más de 5 minutos, aumento de fallidos, Redis sin persistencia o renderer sin salud (`GET /health`). El histórico de tiempos del [piloto](pdf-presupuesto-piloto.md) mide el render local, no la capacidad final de producción ni la latencia de R2.

## Verificación realizada

- Base de test dedicada: unicidad concurrente, snapshot inmutable, duplicados de worker, borrador/final separados, reintentos, cuota concurrente, fallos de storage, token vencido, Redis no disponible, aislamiento entre tenants, preservación histórica y rollback de envío/outbox.
- Frontend: polling cancelable/acotado, error recuperable y una única acción PDF.
- Prueba local completa: API → PostgreSQL → Redis/BullMQ → Gotenberg → R2 → navegador. Worker detenido y reanudado durante la preparación, con apertura automática del PDF.
- Migración aplicada en desarrollo y test. Producción requiere el despliegue descrito arriba; no se desplegó desde esta tarea.
