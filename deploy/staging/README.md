# Preparación de staging de Grafoprint

Este directorio contiene la configuración del staging desplegado de Grafoprint. La web comercial sigue en Vercel desde `main`; la aplicación de trabajo y sus servicios funcionan por separado en Fly. Usar únicamente datos ficticios mientras se completan los ensayos.

## Estado — 25 de septiembre de 2026 (Argentina)

Lucas autorizó activar las cinco máquinas y Neon Launch a 0,25 CU, con una previsión total de **USD 150/mes**, incluido Redis, excluidos Vercel e impuestos, y hasta **USD 5** adicionales de preparación inicial. No es un límite automático de facturación. Consultar antes de aumentar tamaños o contratar extras. Ver [PRESUPUESTO.md](./PRESUPUESTO.md).

- **Fly:** cinco máquinas iniciadas, una por app, todas en `gru`, con los tamaños de la tabla. Backend y web desplegados desde `7efabd87213e` (piloto interno de Cloud API), ambos compilados remotamente. La misma imagen backend se reutiliza en API y ambos workers. Web/API tienen IPv4 compartida e IPv6; workers y Gotenberg sólo red privada. Las credenciales del piloto Meta se cargan sólo en la API; los workers, Next y Gotenberg no las reciben. La conexión del migrador nunca se cargó en Fly. El builder temporal fue eliminado al terminar.
- **Neon:** **Launch activo**, PostgreSQL 16 en AWS São Paulo, base `grafoprint_staging`. Cómputo actual y valor predeterminado del proyecto fijados en **0,25 CU**; suspensión tras cinco minutos, aunque los sondeos de API/workers mantienen la base activa. Ventana de restauración de **un día** y notificación de gasto de **USD 20**. La rama llamada `production` pertenece exclusivamente al proyecto de staging. Se aplicaron **283 migraciones**, incluidas la biblioteca global de 112 materiales y 720 variantes y las 11 categorías/48 subcategorías comerciales, sin seed de desarrollo. Rol de ejecución sin privilegios elevados, DDL ni acceso al historial Prisma. Administrador inicial creado; Lucas eligió su clave, activó MFA y accedió a la consola. Ensayo de restauración pendiente.
- **R2:** bucket `grafoprint-staging-files`, Standard, jurisdicción US, privado. Token de lectura/escritura limitado a ese bucket; CORS para el origen exacto de staging. Subida/descarga firmadas, multipart y rechazo anónimo comprobados desde Fly; objetos sintéticos eliminados.
- **Redis:** Essentials, AWS São Paulo, **USD 36/mes**, 512 MB de datos + 512 MB de réplica en la misma zona, AOF cada segundo, TLS y `no eviction`. Alertas de memoria y conexiones al 80 %. BullMQ con reintento y eventos comprobado desde Fly con certificado TLS validado normalmente; cola sintética eliminada. Carga, failover y recuperación pendientes.
- **DNS/HTTPS:** **`staging.grafoprint.com.ar`** y **`api-staging.grafoprint.com.ar`** tienen certificados Let's Encrypt **activos**, administrados por Fly, emitidos el 25 de septiembre a las 02:55 UTC. Se conservaron las direcciones originales en todos los manifiestos y R2. Durante el diagnóstico se probaron también `pruebas` y `api-pruebas`, que obtuvieron certificados; esos nombres auxiliares no son el acceso de la aplicación. Las discrepancias previas son compatibles con caché negativa; no se demostró qué componente la conservaba. No se importaron certificados ni se cambió la delegación del dominio.

Pasaron las compilaciones con tipos, las pruebas de base/permisos y el login/BFF con cookie y pantalla SSR en GitHub. Contra Fly real pasaron salud, acceso restringido, login/logout, cookie segura, SSR, rechazo de origen ajeno y de cabeceras IP falsificadas; también PostgreSQL, Redis, R2 y un PDF real por red privada. Se repitió el ensayo HTTP con TLS validado en los dominios propios y el preflight CORS de R2. **Primer acceso corregido y desplegado:** login de plataforma → `/backoffice/cambiar-clave` → `/backoffice/seguridad`. El ensayo con una cuenta ficticia comprobó cambio de clave y MFA obligatorio. Chrome permitió ingresar y mostró «Elegí tu clave» tras completar la protección Basic desde la pestaña abierta manualmente. Lucas eligió personalmente su clave, completó MFA y accedió a «Equipo y acceso»; allí se comprobó «MFA activada». Ver [VALIDACION.md](./VALIDACION.md).

Los accesos están fuera de Git, en `~/.config/grafoprint/staging`, con directorio `0700` y archivos privados `0600`. No se reinició Docker ni se compiló la web en esta Mac.

## Servicios y orden

| Servicio | Propuesta | Acceso | Tamaño activo |
| --- | --- | --- | --- |
| Aplicación Next | Fly `grafoprint-staging-web`, São Paulo | `staging.grafoprint.com.ar` | 1 CPU compartida / 1 GB |
| API Nest | Fly `grafoprint-staging-api`, São Paulo | `api-staging.grafoprint.com.ar` y red privada | 1 CPU compartida / 2 GB |
| Worker de cálculos/entregas | Fly `grafoprint-staging-worker`, São Paulo | Redis y red privada | 2 CPU compartidas / 4 GB |
| Worker de documentos | Fly `grafoprint-staging-worker-pdf`, São Paulo | Redis y red privada | 1 CPU compartida / 1 GB |
| Gotenberg | Fly `grafoprint-staging-pdf`, São Paulo | Sólo red privada | 1 CPU compartida / 1 GB |
| PostgreSQL 16 | Neon Launch en São Paulo | TLS, rol de migración separado del rol de ejecución | 0,25 CU fijos; 283 migraciones aplicadas; medición pendiente |
| Redis | Redis Cloud Essentials, AWS São Paulo | TCP/TLS y ensayo sintético BullMQ comprobados desde Fly | 1 GB RAM total: 512 MB de datos y 512 MB de réplica en la misma zona |
| Archivos | R2, bucket exclusivo con jurisdicción US | Bucket privado y URLs firmadas | Consumo |

Hay una máquina activa por servicio; no es alta disponibilidad. Los tamaños deben contrastarse con mediciones antes de ampliar las pruebas. Los workers no se apagan automáticamente: esperan trabajos incluso cuando no hay tráfico web. No configurar escalado automático del worker de geometría sin recalcular el presupuesto compartido del pool.

La comprobación de salud de la API consulta PostgreSQL cada 30 segundos y el worker PDF consulta la base cada dos segundos. Presupuestar Neon activo mientras estos servicios estén encendidos. Upstash de precio fijo se evaluó, pero su plan de 1 GB limita cada solicitud a 10 MB, por debajo de algunos resultados que permite el formato actual de geometría. Ver la medición sintética y las alternativas en [PRESUPUESTO.md](./PRESUPUESTO.md).

## 1. Ensayo local reproducible

Requisitos: Docker con Compose, Node 24. Compilar Linux **amd64**: `compas_nest` ofrece su wheel Linux para esa arquitectura y Python >= 3.12. El contenedor incluye Python 3.12, OpenNest y el lector DXF. PackingSolver queda deshabilitado.

En una Mac ARM hay emulación. Compilar secuencialmente, con los servicios de ensayo detenidos; no lanzar ambos builds juntos en Docker Desktop con sólo 4 GB de RAM. Para el conjunto completo, usar una máquina o runner con memoria suficiente para Docker y el sistema operativo, o ejecutar las pruebas por etapas. No asignar a Docker toda la memoria física de la computadora ni detener contenedores de otros proyectos. En esta Mac de 8 GB, el usuario pidió dejar pendiente la validación completa de la web, sin reiniciar Docker. Ver los resultados y límites en [VALIDACION.md](./VALIDACION.md).

El workflow [staging-validation.yml](../../.github/workflows/staging-validation.yml) ejecuta las dos compilaciones y el ensayo de migraciones/permisos/login en un ejecutor estándar Ubuntu de GitHub. Usa el Compose aislado con PostgreSQL/Redis/S3Mock temporales y claves aleatorias; no recibe credenciales cloud ni despliega. Se activa por cambios relevantes en `codex/staging-infraestructura`, `codex/fix-configuracion-staging` y `codex/meta-cloud-base`; aún no es un control general de todos los PR. No guarda imágenes ni artefactos externos. Si el repositorio deja de ser público, el trabajo se omite hasta revisar el presupuesto. Consultar [facturación de GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

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
3. `node scripts/deploy/bootstrap-admin.cjs`: con `DATABASE_URL` del rol de ejecución y las variables `BOOTSTRAP_ADMIN_*`, crea el primer administrador y el evento de auditoría. Repetir con el mismo administrador activo no cambia sus datos ni su contraseña. No eleva usuarios existentes ni crea un segundo administrador. El primer ingreso por `/backoffice` redirige automáticamente a `/backoffice/cambiar-clave` mientras quede la contraseña provisoria. Después lleva a `/backoffice/seguridad` para activar MFA y guardar los códigos de recuperación. El usuario debe realizar personalmente ambos pasos. La API impide entrar a la consola hasta completarlos; la clave actual se exige para elegir una nueva y las demás sesiones se revocan. Una sesión de plataforma que abra `/cambiar-clave` se deriva a la nueva ruta del backoffice.

La base y los roles son exclusivos de staging. **No crear un rol `grafo_app` antes del historial**: una migración antigua contiene concesiones para `postgres` cuando detecta ese nombre. La preparación nueva usa `grafoprint_staging_app` y mantiene intacto el historial. En Neon, crear ese rol mediante SQL (el script), no con el botón de creación de roles de la consola, que le daría membresía `neon_superuser`.

El bootstrap no inventa planes, precios, empresas ni suscripciones. Después del primer acceso hay que configurar el catálogo y un plan de prueba desde las herramientas existentes de Plataforma, y crear una empresa ficticia para los ensayos funcionales. Verificar el flujo completo antes de invitar usuarios.

`verify-database.cjs` verifica repetición del bootstrap, rechazo de elevación, rechazo de DDL/acceso al historial y permisos sobre nuevas tablas. Sólo admite bases cuyo nombre termine en `_test`; no ejecutarlo contra la base cloud con datos de prueba persistentes.

## 3. Procedimiento cloud y ensayos restantes

1. Confirmar organización y facturación de Fly, plan de Neon, proveedor de Redis y presupuesto total. Redis necesita comandos de BullMQ, scripts Lua, conexiones persistentes, política `noeviction` y recuperación definida. Una API REST de caché no basta. Si se agrega otro proveedor que trate datos de la integración, revisar la declaración de proveedores en Meta.
2. Crear proyecto/base Neon PostgreSQL 16 en São Paulo. Definir retención de restauración. Obtener conexión directa de migrador, aplicar historial, crear rol de ejecución, verificarlo y hacer bootstrap. Usar conexión agrupada para la aplicación y directa para las operaciones de esquema. Presupuestar conexiones por proceso y número de máquinas; la plantilla propone cinco por cliente Prisma como punto de partida.
3. Crear bucket privado exclusivo de staging en R2 con jurisdicción US y token de lectura/escritura limitado a ese bucket. El endpoint US es `https://<ACCOUNT_ID>.us.r2.cloudflarestorage.com`. Configurar CORS para el origen exacto de staging, métodos GET/HEAD/PUT, cabeceras de subida y `ETag` expuesto. Probar subida simple, multipart y descarga. Mantener `r2.dev` y acceso público deshabilitados.
4. Crear Redis y obtener su URL. Separar sus datos y claves de producción. Comprobar latencia desde São Paulo y la persistencia de trabajos antes del despliegue.
5. Crear las cinco apps Fly en la misma organización/red. Revisar nombres, recursos y archivos `fly.*.toml`. Cargar los secretos de `runtime.env.example` en API/workers mediante el almacén de secretos de Fly. El web no necesita claves de PostgreSQL, R2 ni Meta. **No cargar credenciales de migración en procesos permanentes.**
6. Desplegar Gotenberg; luego API y workers; finalmente Next. Las migraciones se ejecutan una sola vez, desde un entorno controlado, antes del cambio de versión. No hay `release_command` que distribuya la clave del migrador a todos los procesos.
7. Solicitar certificados para ambos subdominios y copiar en Donweb exactamente los registros que entregue Fly. Conservar los registros de Vercel y del correo. Verificar HTTPS, cookies y redirecciones.
8. Comprobar IP real desde Fly usando el canal autenticado descrito abajo. La prueba desde Fly ya verificó que las cabeceras falsas del cliente no sustituyen la IP observada. No configurar `TRUST_PROXY` adicional en staging.
9. Verificar el acceso restringido y bloqueo de indexación. Sólo GET/POST exactos de `/api/webhooks/whatsapp` están abiertos para Meta, con verify token y firma HMAC. El cierre general de las demás rutas continúa activo.
10. Completar pruebas cloud: login/MFA, empresa de ensayo, carga/descarga, PDF desde la aplicación, cola de cálculos, eventos SSE, reinicio con trabajo en curso, salud con base caída y restauración de respaldo. Medir memoria/CPU y ajustar máquinas y concurrencia.

Ejemplos de despliegue para la etapa 6, **sólo con las apps, secretos y presupuesto ya preparados**, desde la raíz:

```sh
GRAFO_STAGING_REV=$(git rev-parse --short=12 HEAD)
GRAFO_STAGING_BACKEND_IMAGE="registry.fly.io/grafoprint-staging-api:staging-$GRAFO_STAGING_REV"
fly deploy --config deploy/staging/fly.api.toml --remote-only --depot=false --build-only --push --image-label "staging-$GRAFO_STAGING_REV"
fly deploy --config deploy/staging/fly.pdf.toml --ha=false --no-public-ips
fly deploy --config deploy/staging/fly.api.toml --image "$GRAFO_STAGING_BACKEND_IMAGE" --ha=false
fly deploy --config deploy/staging/fly.worker.toml --image "$GRAFO_STAGING_BACKEND_IMAGE" --ha=false --no-public-ips
fly deploy --config deploy/staging/fly.worker-pdf.toml --image "$GRAFO_STAGING_BACKEND_IMAGE" --ha=false --no-public-ips
fly deploy --config deploy/staging/fly.web.toml --remote-only --depot=false --ha=false
```

Antes de reutilizar la imagen, verificar en la salida del build el tag y digest realmente publicados. Estos ejemplos usan un builder remoto de Fly y una sola compilación backend; contemplar su costo inicial y retirar sólo sus recursos temporales identificados al terminar. Comprobar una máquina por app e IPv4 compartida en las apps públicas, sin comprar direcciones dedicadas. Ver [opciones oficiales de deploy](https://fly.io/docs/flyctl/deploy/).

Si cambia un nombre, actualizar también las URLs `.internal`. Los contenedores terminan con SIGTERM para cerrar conexiones y drenar trabajos; Fly limita la espera a 300 segundos. Configurar los límites de duración y reintentos de los trabajos teniendo en cuenta ese plazo. Probar compatibilidad de la versión anterior antes de revertir una imagen; un rollback de código no deshace migraciones.

## Acceso e IP en staging

`STAGING_PRIVATE=true` está en los manifiestos de API y Next. La web exige una clave HTTP Basic de entrada antes del login normal, incluyendo rutas API, archivos y links públicos. Sólo las lecturas `GET`/`HEAD` de `/api/health`, `/robots.txt` y del ícono estático `/icon.svg` quedan abiertas en Next. El ícono no requiere sesión para que Chrome pueda cargarlo; el resto de páginas y recursos conserva la protección. Las respuestas llevan `X-Robots-Tag: noindex, nofollow, noarchive`; robots impide rastreo. La clave de entrada es exclusiva del ensayo y no crea ni reemplaza un usuario de Grafoprint. Se guarda fuera de Git; compartirla únicamente con quienes deban probar el entorno y rotarla al cambiar ese grupo.

El navegador entra directamente por Fly, sin CDN ni otro proxy delante. Next lee `Fly-Client-IP`, exige una única IP válida y construye dos cabeceras internas para Nest: la IP y una credencial compartida. Aplica tanto al BFF como a las consultas de componentes del servidor. No copia cabeceras internas ni `X-Forwarded-For` enviadas por el navegador; tampoco entrega las claves de entrada a la API o las credenciales internas al navegador. Las solicitudes con `Origin` ajeno al origen configurado se rechazan.

Nest descarta las cabeceras de proxies recibidas, autentica a Next y sólo entonces construye un `X-Forwarded-For` de un salto. Esto permite que `req.ip`, los límites de uso y las restricciones por IP reciban el cliente correcto sin confiar en una cadena arbitraria. `GET`/`HEAD /api` queda abierto para salud. Con `STAGING_META_WEBHOOK_ENABLED=true`, GET/POST exactos de `/api/webhooks/whatsapp` aceptan la verificación y los eventos firmados de Meta. Las rutas restantes, incluidos otros webhooks, rechazan solicitudes sin la credencial interna; los guards normales de usuario siguen vigentes después de este control. Una clave interna ausente o demasiado corta impide iniciar API. Una clave web incompleta bloquea la entrada.

Archivos privados preparados en `~/.config/grafoprint/staging`:

- `runtime.env`: datos/colas/archivos y secretos de la aplicación, para API/workers.
- `api-ingress.env`: credencial adicional del canal Next → API, sólo para API.
- `web.env`: usuario/clave de entrada y credencial del canal interno, sólo para Next.

Las plantillas equivalentes de este directorio no contienen valores reales. Los tres archivos se importaron en las apps correspondientes y sus secretos están activos tras el despliegue. La clave interna se redacta en logs, y Nest la elimina de la petición antes de entrar al resto del sistema.

Compose reproduce estos controles con claves sintéticas generadas por `init-local-env.mjs`. Un `.env` de ensayo creado antes de incorporar el cierre necesita las tres variables `STAGING_ACCESS_USER`, `STAGING_ACCESS_PASSWORD` y `STAGING_WEB_API_TOKEN`: agregarlas con claves ficticias aleatorias, sin reutilizar las cloud. El verificador HTTP proporciona un `Fly-Client-IP` simulado sólo en ese Compose y comprueba rechazo de accesos, cabeceras falsas, login y cierre de sesión.

Desde Fly ya se comprobaron login HTTP, cookies Secure, IP observada, rechazo de cabeceras falsas y descargas firmadas. Quedan el recorrido en navegador, MFA y SSE. Si se incorpora otro proxy público en el futuro, revisar este contrato antes de cambiar DNS. Referencias: [cabeceras de Fly](https://docs.fly.io/networking/request-headers/), [proxies de Express](https://expressjs.com/en/guide/behind-proxies/) y [Proxy de Next](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

## 4. Git, Vercel y WhatsApp

`main` es la base estable y la rama de producción de la web comercial. El trabajo nuevo se propone en una rama `codex/…` y PR. Las previews de Vercel no equivalen al staging de toda la aplicación. No cambiar el proyecto Vercel para ejecutar API o workers. Definir posteriormente el flujo de promoción de imágenes entre staging y producción y ejecutar migraciones como paso explícito, con una sola ejecución a la vez.

El [piloto interno de WhatsApp](../../docs/meta-cloud-piloto.md) ya tiene código y configuración en staging: envío de una plantilla de prueba, webhooks firmados y estados por empresa. El ensayo real desde Grafo llegó a «Entregado», confirmado por webhook de Meta. Embedded Signup, inbox, coexistencia, administración de plantillas y notificaciones automáticas quedan para los bloques siguientes. Las credenciales de WATI u otros servicios reales no se copian automáticamente. El resultado de la revisión de Meta es una condición externa independiente del despliegue.

## Referencias consultadas

- [Next.js: salida standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
- [Fly: configuración y procesos](https://fly.io/docs/reference/configuration/) y [red privada/IPv6](https://fly.io/docs/networking/app-services/).
- [Neon: roles y privilegios](https://neon.com/docs/manage/roles).
- [R2: autenticación, permisos y endpoints por jurisdicción](https://developers.cloudflare.com/r2/api/tokens/).
- [Gotenberg: configuración](https://gotenberg.dev/docs/configuration).
- [S3Mock: emulador para pruebas](https://github.com/adobe/S3Mock).

La evidencia cloud y sus límites se registran en VALIDACION.md; no interpretar un ensayo de componentes como aprobación de todos los flujos funcionales.

### Empresa demo

La empresa `Gráfica Demo — Staging` (`grafica-demo-staging`) está creada y operativa con suscripción Trial manual: 3 usuarios, 50 órdenes mensuales y 2 GB. Lucas activó su administrador ficticio `admin@grafoprint-demo.example.invalid`, eligió personalmente la contraseña e ingresó a la aplicación; se comprobó empresa y rol Administrador en Chrome. No se configuró correo transaccional ni se enviaron mensajes. Quedan los ensayos funcionales de la empresa y la entrada/salida de soporte para staff sin pertenencia a ella.

Para activar el administrador ficticio sin correo, abrir la ficha desde Empresas, pulsar «Reenviar invitación» y desplegar «Compartir el enlace manualmente». «Copiar enlace» copia la URL que acaba de generar el servidor aunque no se haya podido enviar correo. El enlace se conserva en memoria al actualizar esa ficha; al salir o recargar el navegador se descarta y hace falta renovarlo. Cada renovación invalida el anterior. No guardarlo en Git ni en documentación compartida.

Abrir ese enlace lleva a «Activá tu acceso», donde el usuario debe elegir personalmente su clave y aceptar la invitación. Eso habilita el acceso a la empresa con `admin@grafoprint-demo.example.invalid`; la cuenta de Plataforma es independiente. En staging el enlace también exige la protección HTTP Basic. El correo sintético no sirve para recibir recuperaciones de contraseña ni notificaciones.

### Primeros maestros en una empresa vacía

Desde Costos → Maquinaria → Nueva máquina, «Nueva planta» permite dar de alta un taller con nombre y código. Al guardarlo queda seleccionado sin perder el resto del formulario; también está disponible en la ficha de la máquina. Si se cancela la máquina, la planta ya guardada permanece disponible. El plan debe incluir maquinaria o centros de costo y el usuario debe tener permiso de gestión.

La biblioteca global se prepara mediante migraciones y ofrece 112 materiales con 720 variantes. Cada empresa elige cuáles instalar; esta preparación no crea stock ni modifica sus materiales. Nunca usar el seed de desarrollo para completar la biblioteca de staging.

La prueba de interfaz dejó «Taller de prueba — Staging» y «Router de prueba — Staging» (borrador inactivo) en la empresa demo.
