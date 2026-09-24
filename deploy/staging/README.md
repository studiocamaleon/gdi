# Preparación de staging de Grafoprint

Este directorio prepara el despliegue; sus archivos no crean recursos ni publican la aplicación. La web comercial sigue en Vercel desde `main`. La aplicación de trabajo y sus servicios se desplegarán por separado. No usar datos de clientes en el ensayo.

## Servicios y orden

| Servicio | Propuesta | Acceso | Tamaño inicial a presupuestar |
| --- | --- | --- | --- |
| Aplicación Next | Fly `grafoprint-staging-web`, São Paulo | `staging.grafoprint.com.ar` | 1 CPU compartida / 1 GB |
| API Nest | Fly `grafoprint-staging-api`, São Paulo | `api-staging.grafoprint.com.ar` y red privada | 1 CPU compartida / 2 GB |
| Worker de cálculos/entregas | Fly `grafoprint-staging-worker`, São Paulo | Redis y red privada | 2 CPU compartidas / 4 GB |
| Worker de documentos | Fly `grafoprint-staging-worker-pdf`, São Paulo | Redis y red privada | 1 CPU compartida / 1 GB |
| Gotenberg | Fly `grafoprint-staging-pdf`, São Paulo | Sólo red privada | 1 CPU compartida / 1 GB |
| PostgreSQL 16 | Neon, São Paulo | TLS, credencial por función | Plan pendiente |
| Redis | Proveedor pendiente | Conexión Redis compatible con BullMQ | Plan/ubicación pendientes |
| Archivos | R2, bucket exclusivo con jurisdicción US | Bucket privado y URLs firmadas | Consumo |

Los nombres de Fly aún no están reservados. Una sola máquina por servicio alcanza para el ensayo inicial; no es alta disponibilidad. Los tamaños son propuestas que se deben contrastar con mediciones y presupuesto antes de crear recursos. Los workers no se apagan automáticamente: esperan trabajos incluso cuando no hay tráfico web. No configurar escalado automático del worker de geometría sin recalcular el presupuesto compartido del pool.

La comprobación de salud de la API consulta PostgreSQL cada 30 segundos. Esto mantiene actividad en Neon aunque no haya usuarios; calcular el presupuesto con ese comportamiento y revisar también las tareas programadas antes de estimar ahorro por suspensión. Si se evalúa Upstash, [Fly recomienda un plan de precio fijo para BullMQ](https://fly.io/docs/upstash/redis/) por el sondeo de las colas; además hay que comprobar límites de tamaño de mensajes, memoria y comandos Lua con los trabajos de geometría.

## 1. Ensayo local reproducible

Requisitos: Docker con Compose, Node 24. Compilar Linux **amd64**: `compas_nest` ofrece su wheel Linux para esa arquitectura y Python >= 3.12. El contenedor incluye Python 3.12, OpenNest y el lector DXF. PackingSolver queda deshabilitado.

En una Mac ARM hay emulación. Compilar secuencialmente, con los servicios de ensayo detenidos; no lanzar ambos builds juntos en Docker Desktop con sólo 4 GB de RAM. Para el conjunto completo, usar una máquina o runner con memoria suficiente para Docker y el sistema operativo, o ejecutar las pruebas por etapas. No asignar a Docker toda la memoria física de la computadora ni detener contenedores de otros proyectos. En esta Mac de 8 GB, el usuario pidió dejar pendiente la validación completa de la web, sin reiniciar Docker. Ver los resultados y límites en [VALIDACION.md](./VALIDACION.md).

El build comprueba tipos por defecto. En una máquina con poca memoria se puede ejecutar primero `npm --prefix apps/api run build` y `npx tsc --noEmit --incremental false` en el host (con las dependencias instaladas), y **sólo si ambos pasan** agregar `--build-arg SKIP_TYPECHECK=true` a los dos comandos Docker. Esto omite el chequeo duplicado dentro del contenedor; no cambia la lógica de la aplicación. Los manifiestos Fly no habilitan esa opción.

Desde la raíz del repositorio:

```sh
node deploy/staging/init-local-env.mjs
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml config --quiet
docker build --platform linux/amd64 --target backend -f deploy/Dockerfile -t grafoprint-staging-api:local .
docker build --platform linux/amd64 --target web -f deploy/Dockerfile -t grafoprint-staging-web:local .
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml up -d postgres redis
```

El inicializador crea `deploy/staging/.env` con claves aleatorias, permisos `0600`, y un administrador ficticio `admin@staging.example.invalid`. No sobrescribe un archivo existente. Git y el contexto Docker excluyen los secretos. No ejecutar `docker compose config` sin `--quiet` en una salida compartida: expande las claves.

En una base local recién creada, crear el dueño sin superusuario antes de migrar:

```sh
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml exec -T postgres psql -U staging_local_admin -d grafoprint_staging_test -v ON_ERROR_STOP=1 < deploy/staging/prepare-local-postgres.sql
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml run --rm database-tools
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml run --rm database-tools node scripts/deploy/runtime-role.cjs
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml run --rm bootstrap
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml run --rm database-tools node scripts/deploy/verify-database.cjs
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml up -d api worker worker-pdf web
```

El SQL puede repetirse sin cambiar la clave existente. `staging_local_admin` es el superusuario del contenedor local; no se crea en Neon ni se entrega a la aplicación. PostgreSQL no publica ningún puerto al host.

Abrir `http://localhost:3100` para la aplicación y `http://localhost:3101/api` para salud de la API. El generador PDF y el emulador S3 se levantan como dependencias. No hay credenciales ni llamadas a servicios comerciales en este ensayo. S3Mock permite probar la API de almacenamiento, pero no sustituye las pruebas posteriores de CORS, TLS y firmas contra R2 real.

```sh
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml exec -T -e DEPLOY_DATABASE_NAME=grafoprint_staging_test worker node scripts/deploy/verify-worker.cjs
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml run --rm bootstrap node scripts/deploy/verify-http.cjs
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml exec -T api node scripts/deploy/verify-storage-pdf.cjs
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml ps
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml down
```

`down` conserva los volúmenes de ensayo. No usar `down -v` si se quiere conservar esa base. Ninguno de estos comandos usa el Compose de desarrollo de la raíz.

Para comprobar sólo la API cuando la imagen web todavía no está disponible, ejecutar `docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yaml run --rm -e VERIFY_API_ONLY=true bootstrap node scripts/deploy/verify-http.cjs`. Esto no valida Next/BFF ni sustituye el ensayo completo.

## 2. Base vacía y administrador

**No ejecutar `prisma db seed` en staging**: el seed de desarrollo elimina datos. Usar los tres comandos preparados:

1. `node scripts/deploy/migrate.cjs`: aplica el historial existente, sin editar migraciones ni ejecutar seed. Exige `DEPLOY_DATABASE_NAME` y `MIGRATE_DATABASE_URL`; verifica el nombre y esquema de destino.
2. `node scripts/deploy/runtime-role.cjs`: después de las migraciones, crea y comprueba un rol exclusivo de ejecución. Exige además `APP_DATABASE_URL`. Otorga acceso de datos, sin crear tablas ni leer el historial Prisma. Configura los permisos de tablas futuras para el migrador que ejecuta el comando. Repetirlo no rota contraseñas. Si encuentra un rol con privilegios elevados, membresías o propiedad de objetos, se detiene.
3. `node scripts/deploy/bootstrap-admin.cjs`: con `DATABASE_URL` del rol de ejecución y las variables `BOOTSTRAP_ADMIN_*`, crea el primer administrador y el evento de auditoría. Repetir con el mismo administrador activo no cambia sus datos ni su contraseña. No eleva usuarios existentes ni crea un segundo administrador. La contraseña inicial debe cambiarse y el enrolamiento MFA se completa desde Plataforma.

La base y los roles son exclusivos de staging. **No crear un rol `grafo_app` antes del historial**: una migración antigua contiene concesiones para `postgres` cuando detecta ese nombre. La preparación nueva usa `grafoprint_staging_app` y mantiene intacto el historial. En Neon, crear ese rol mediante SQL (el script), no con el botón de creación de roles de la consola, que le daría membresía `neon_superuser`.

El bootstrap no inventa planes, precios, empresas ni suscripciones. Después del primer acceso hay que configurar el catálogo y un plan de prueba desde las herramientas existentes de Plataforma, y crear una empresa ficticia para los ensayos funcionales. Verificar el flujo completo antes de invitar usuarios.

`verify-database.cjs` verifica repetición del bootstrap, rechazo de elevación, rechazo de DDL/acceso al historial y permisos sobre nuevas tablas. Sólo admite bases cuyo nombre termine en `_test`; no ejecutarlo contra la base cloud con datos de prueba persistentes.

## 3. Crear recursos cloud, después de cerrar planes y costos

1. Confirmar organización y facturación de Fly, plan de Neon, proveedor de Redis y presupuesto total. Redis necesita comandos de BullMQ, scripts Lua, conexiones persistentes, política `noeviction` y recuperación definida. Una API REST de caché no basta. Si se agrega otro proveedor que trate datos de la integración, revisar la declaración de proveedores en Meta.
2. Crear proyecto/base Neon PostgreSQL 16 en São Paulo. Definir retención de restauración. Obtener conexión directa de migrador, aplicar historial, crear rol de ejecución, verificarlo y hacer bootstrap. Usar conexión agrupada para la aplicación y directa para las operaciones de esquema. Presupuestar conexiones por proceso y número de máquinas; la plantilla propone cinco por cliente Prisma como punto de partida.
3. Crear bucket privado exclusivo de staging en R2 con jurisdicción US y token de lectura/escritura limitado a ese bucket. El endpoint US es `https://<ACCOUNT_ID>.us.r2.cloudflarestorage.com`. Configurar CORS para el origen exacto de staging, métodos GET/HEAD/PUT, cabeceras de subida y `ETag` expuesto. Probar subida simple, multipart y descarga. Mantener `r2.dev` y acceso público deshabilitados.
4. Crear Redis y obtener su URL. Separar sus datos y claves de producción. Comprobar latencia desde São Paulo y la persistencia de trabajos antes del despliegue.
5. Crear las cinco apps Fly en la misma organización/red. Revisar nombres, recursos y archivos `fly.*.toml`. Cargar los secretos de `runtime.env.example` en API/workers mediante el almacén de secretos de Fly. El web no necesita claves de PostgreSQL, R2 ni Meta. **No cargar credenciales de migración en procesos permanentes.**
6. Desplegar Gotenberg; luego API y workers; finalmente Next. Las migraciones se ejecutan una sola vez, desde un entorno controlado, antes del cambio de versión. No hay `release_command` que distribuya la clave del migrador a todos los procesos.
7. Solicitar certificados para ambos subdominios y copiar en Donweb exactamente los registros que entregue Fly. Conservar los registros de Vercel y del correo. Verificar HTTPS, cookies y redirecciones.
8. Comprobar IP real y cadena de proxies: navegador → Fly → Next/BFF → API, y acceso directo a API/webhooks. El BFF actual no reenvía IP de cliente. Resolver ese recorrido y probar cabeceras falsificadas antes de definir `TRUST_PROXY` y abrir staging a usuarios. No usar ciegamente un número de saltos.
9. Añadir bloqueo de indexación y acceso restringido a las pruebas; el registro público ya está apagado, pero eso por sí solo no vuelve privada una URL. Mantener accesibles los callbacks de Meta que se habiliten más adelante.
10. Completar pruebas cloud: login/MFA, empresa de ensayo, carga/descarga, PDF desde la aplicación, cola de cálculos, eventos SSE, reinicio con trabajo en curso, salud con base caída y restauración de respaldo. Medir memoria/CPU y ajustar máquinas y concurrencia.

Ejemplos de despliegue para la etapa 6, **sólo con las apps, secretos y presupuesto ya preparados**, desde la raíz:

```sh
fly deploy --config deploy/staging/fly.pdf.toml --ha=false
fly deploy --config deploy/staging/fly.api.toml --ha=false
fly deploy --config deploy/staging/fly.worker.toml --ha=false
fly deploy --config deploy/staging/fly.worker-pdf.toml --ha=false
fly deploy --config deploy/staging/fly.web.toml --ha=false
```

Si cambia un nombre, actualizar también las URLs `.internal`. Los contenedores terminan con SIGTERM para cerrar conexiones y drenar trabajos; Fly limita la espera a 300 segundos. Configurar los límites de duración y reintentos de los trabajos teniendo en cuenta ese plazo. Probar compatibilidad de la versión anterior antes de revertir una imagen; un rollback de código no deshace migraciones.

## 4. Git, Vercel y WhatsApp

`main` es la base estable y la rama de producción de la web comercial. El trabajo nuevo se propone en una rama `codex/…` y PR. Las previews de Vercel no equivalen al staging de toda la aplicación. No cambiar el proyecto Vercel para ejecutar API o workers. Definir posteriormente el flujo de promoción de imágenes entre staging y producción y ejecutar migraciones como paso explícito, con una sola ejecución a la vez.

La integración directa de WhatsApp se implementa y prueba después de tener este entorno: conexión de Meta, webhooks firmados, persistencia por empresa, inbox, plantillas y notificaciones. Los contenedores no agregan esa integración. Las credenciales de WATI u otros servicios reales no se copian automáticamente. El resultado de la revisión de Meta es una condición externa independiente del despliegue.

## Referencias consultadas

- [Next.js: salida standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
- [Fly: configuración y procesos](https://fly.io/docs/reference/configuration/) y [red privada/IPv6](https://fly.io/docs/networking/app-services/).
- [Neon: roles y privilegios](https://neon.com/docs/manage/roles).
- [R2: autenticación, permisos y endpoints por jurisdicción](https://developers.cloudflare.com/r2/api/tokens/).
- [Gotenberg: configuración](https://gotenberg.dev/docs/configuration).
- [S3Mock: emulador para pruebas](https://github.com/adobe/S3Mock).

Las comprobaciones locales no validan por sí solas nombres disponibles, costos, IAM de Neon, DNS, proxy de Fly ni permisos reales de R2. Esos puntos se verifican al crear el entorno cloud.
