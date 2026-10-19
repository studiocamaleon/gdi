# Desarrollo local

## Lote local: pantalla TV, cobros y edición de OT — 19/10/2026

Estado local actual: web en `localhost:3000` y API en `127.0.0.1:3001` desde el worktree `lote-local-produccion`, rama `codex/lote-local-produccion`. Reúne localmente el PR #106 (pantalla TV, `d75750a03`) y el PR #107 (cobros bancarios y edición de OT, `c73cefbb1`) en `8030e1c95`. Los PR mantienen su base en `main`; esta rama de prueba no se publica ni modifica `main`.

Se reemplazaron únicamente los procesos web/API anteriores de `produccion-tv`. Continúan Node 24, Turbopack y límite de 2 GB por proceso; cron, correo, Meta y telemetría externa desactivados. No se iniciaron workers ni se modificó Docker. Se reutilizan exclusivamente las configuraciones privadas locales existentes. No hubo nuevas migraciones, seeds ni resets: se conserva la migración de pantallas ya aplicada y las bases anteriores.

Las [correcciones de cobros y edición](cobros-y-edicion-ot.md) pasaron 245 pruebas de API y 58 de interfaz. Sobre el lote combinado pasaron nuevamente 98 pruebas de API, incluidas vinculación de pantallas, aislamiento entre empresas, permisos bancarios y edición de productos en producción. API comprobada con base disponible; el detalle de validación de la pantalla anterior se conserva abajo.

Pendiente publicar el conjunto en staging cuando Lucas termine de definir los otros cambios. No se desplegó staging ni producción.

### Ensayo visible de cobros y edición — 19/10/2026

En el mismo lote se completó el recorrido con una empresa ficticia y el rol Vendedor estándar, restringido a una sola caja de efectivo. Se registró una transferencia de $5.000 en Banco, recibo `REC-2026-0001`; la caja quedó en cero. En `OT-PRUEBA-001` se reemplazó el vinilo pendiente por PVC de 3 mm desde Editar especificaciones → Cambiar. Después de guardar y recargar: estado producción, total $40.000, cobrado $5.000 y saldo $35.000; el otro producto mantuvo el mismo paso iniciado y su fecha de inicio. La muestra queda disponible para continuar la revisión; no se modificaron las empresas existentes.

El ensayo encontró una restricción global incorrecta del número de recibo. Se incorporó el commit `b05c0e36c` del PR #107 y se aplicó `20261019160000_recibos_numero_por_empresa` sólo a local/test: 318 migraciones junto con TV. Conserva registros y números existentes. La regresión falló antes de la migración y pasó después; además pasaron 38 pruebas de cobros/permisos y 66 de cobros/edición sobre el lote (con solapamiento).

Las dependencias de API también se clonaron con APFS dentro del worktree: Turbopack no admite el enlace fuera de su raíz al compilar la ficha de OT. La API de este ensayo arranca con `R2_ACCOUNT_ID= R2_ACCESS_KEY_ID= R2_SECRET_ACCESS_KEY= R2_BUCKET=` para usar almacenamiento en disco `.storage/`, conservando los `.env` privados intactos. Los archivos anteriores de R2 no se alteraron. Web y API fueron los únicos procesos reiniciados; cron, correo y Meta siguen apagados. Sin staging ni producción.

## Producción en tiempo real — 19/10/2026

Estado del ensayo inicial (reemplazado por el lote descrito arriba): web en `localhost:3000` y API en `127.0.0.1:3001`, desde el worktree `produccion-tv`, rama `codex/produccion-tv` basada en `origin/main`. Node 24, Turbopack y límite de 2 GB por proceso; cron, correo y piloto de Meta permanecen desactivados. No se iniciaron workers ni se modificaron los otros proyectos de Docker.

Aplicada la migración aditiva `20261019120000_pantallas_produccion` a desarrollo y tests: 317 migraciones, con permisos locales verificados. Se comprobó [la vista para televisores y la vinculación por código](produccion-en-tiempo-real.md) mediante pruebas HTTP, del BFF y navegador, con una empresa ficticia retirada al terminar. Las bases existentes se conservaron, sin seed ni reset. El chequeo de tipos de los módulos afectados pasó; la compilación completa queda para CI remoto por el límite de memoria de la Mac.

No se desplegó staging ni producción. El usuario pidió reunir más cambios antes de publicar el lote en staging.

## Papel derivado de Centro de copiado — 13/10/2026

La web, API y workers locales ejecutan `codex/copiado-papel-derivado` desde el checkout principal. Se mantienen Node 24, Turbopack, los límites de memoria del arranque habitual y las tareas programadas desactivadas. Esta rama depende del PR #76; no se publicó en staging ni producción.

Se comprobaron 1, 5 y 10 A4 derivados de opalina de 650 × 950 mm y de SRA3 de 325 × 475 mm. Las pruebas de inventario usan empresas ficticias en `gdi_saas_test`: retiro de pliegos completos, ingreso y reutilización de hojas sobrantes, consumos parciales y concurrentes, reintentos y reversión ante cambios de medidas. La simulación de Tarifarios y el cálculo comercial de la OT coinciden con setup desactivado. La comprobación de tipos de los 14 archivos de API afectados pasó; la revisión global agotó el límite local de memoria y queda para CI. También pasaron las pruebas y lint de la interfaz afectada. No se compilaron contenedores en esta Mac.

Los costos y precios se revisan sin reemplazar las matrices publicadas. El detalle de materiales informa los pliegos necesarios, las hojas usadas y el sobrante que ingresará al registrar el consumo. Ver [el comportamiento y sus límites](centro-copiado-contribucion.md#papel-comprado-en-otro-formato).

## Impresión rígida y corte — comprobación local del 01/10/2026

La comprobación local descrita abajo se publicó posteriormente junto con el arreglo de primer ingreso en `b378ae41e`, desde `codex/acceso-clave-provisoria` y el PR #13. Staging y producción quedaron verificados; consultar los [resultados del despliegue](../deploy/produccion/VALIDACION.md). La compilación completa con tipos pasó en remoto. El worktree local conserva su rama y configuración de desarrollo.

- Rama de desarrollo: `codex/layout-impresion-laser`, basada en `b7d4842e2`. Conserva la base de seguridad ya desplegada; depende del PR #12 todavía sin integrar. Un futuro PR debe declarar esa dependencia y ajustar su base cuando se integre.
- La API del worktree `meta-cloud-base` ejecuta la corrección en `codex/local-layout-impresion-laser`, manteniendo su configuración local. Sin cambios de migraciones, datos maestros, credenciales, workers ni tareas programadas. Sin despliegue en staging o producción.
- La impresión sobre placa considera antes del acomodo los cortes activos que usan el mismo material, incluidos extras y selección comercial de máquina. Mantiene las dimensiones físicas de la placa, las posiciones compartidas y el costeo del tramo realmente impreso.
- Cuando estos límites cambian el acomodo, se conserva el cálculo individual de los componentes: la consolidación no puede volver a acomodar solamente la impresión. Si el corte no agrega restricciones, siguen vigentes las optimizaciones anteriores.
- Comprobación: 128 pruebas en siete suites y revisión de tipos de los seis archivos modificados. La verificación global de tipos excedió el límite de memoria local; completarla en CI antes de desplegar. No se aumentó memoria de Docker ni se reinició.
- Prueba visible: acrílico de 3 mm, nueve piezas de 400 × 400 mm, impresión CMYK y láser con área 1300 × 1000 mm y salida abierta en Y. Cotiza y muestra dos placas completas de 1220 × 1220 mm, seis piezas y tres piezas, conservando 220 mm sin cortes. Quedó en el formulario local, sin guardar ni emitir una OT.

## Acuerdo de trabajo

Desarrollar y probar en esta Mac. Acumular un grupo manejable de cambios relacionados, revisarlo mediante PR y actualizar staging para la prueba final del conjunto. No hacer un despliegue cloud por cada ajuste visual o corrección pequeña. Los commits pueden seguir siendo pequeños e independientes.

Al 25 de septiembre, `codex/entorno-local` parte de la versión corregida de staging (`5b020cf70`). El PR #3 y su dependencia #2 siguen pendientes de integración; esta rama no los fusiona. Al integrar esas bases habrá que actualizar la rama de trabajo.

## Servicios

- Aplicación: `http://localhost:3000` (Next en modo desarrollo con Turbopack).
- API: `http://127.0.0.1:3001/api`.
- PostgreSQL: contenedor existente `gdi-saas-postgres`, puerto 5436, base `gdi_saas`. Tiene las 295 migraciones aplicadas al 27/09, sin ejecutar seed.
- Redis: contenedor existente `gdi-saas-redis`, puerto 6379.
- PDF: contenedor existente `gdi-saas-pdf-renderer`, puerto 3002.
- Workers: procesos locales de cálculos/entregas y documentos PDF.
- Archivos: la configuración de desarrollo existente usa el bucket R2 `grafo-archivos-dev`, distinto del de staging. No se cambiaron claves ni se movieron archivos.

Los datos y los usuarios de local no son los de staging. Una sesión local antigua puede pedir volver a iniciar sesión. Los contenedores conservan sus datos al reiniciar; no usar `docker compose down -v` ni `prisma migrate reset`.

## Arranque de desarrollo

Usar Node 24. Las dependencias ya están instaladas. Ejecutar cada proceso en una terminal distinta y detenerlo con Ctrl+C. No duplicarlos si el puerto o el proceso ya están activos.

Web, desde la raíz:

```sh
NODE_OPTIONS=--max-old-space-size=2048 API_URL=http://127.0.0.1:3001/api NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api npm run dev -- --hostname 127.0.0.1
```

La web usa Turbopack y libera la memoria de su caché después de guardarla en
el disco. Mantener el límite de Node en 2 GB: Webpack compilando la ficha de OT
puede agotarlo y dejar el puerto 3000 sin servicio. `dev:webpack` queda disponible
para diagnósticos puntuales, no como arranque habitual de esta Mac.

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

Décimo bloque del 26/09: mismo worktree en `codex/inbox-plantillas-archivos`, desde `cf835ff8a`. Aplicada `20260927010000_inbox_plantillas_archivos` sólo en desarrollo y tests: **293 migraciones**, sin seed ni reset; permisos de `grafo_app` comprobados. Agrega [plantillas con PDF e imágenes de la ficha del cliente](meta-inbox-plantillas.md). Reutiliza almacenamiento privado y el worker de adjuntos, con pruebas de Meta y storage simulados. Los envíos reales, sus flags y cron siguen apagados; no se reinició Docker ni se operó staging o producción. La API local respondió con base disponible después de la recarga.

Undécimo bloque del 26/09: mismo worktree en `codex/inbox-documentos-comerciales`, desde `9510b2a04`. Agrega [presupuestos y comprobantes emitidos al selector de plantillas](meta-inbox-plantillas.md), con permisos propios de cada módulo y revisión privada ligada a la conversación. **Sin nuevas migraciones: siguen siendo 293**. La demo incluye documentos ficticios; las pruebas usan únicamente `gdi_saas_test` y clientes de Meta/almacenamiento simulados. El listado no genera PDF, no cambia estados ni consulta ARCA. Se conservaron cron y envíos reales apagados, sin staging, producción ni reinicio de Docker. API local comprobada con base disponible.

## Canal de prueba — 27/09/2026

El mismo worktree está en `codex/inbox-canal-pruebas`, desde `393096f32`. Se agregó `20260927200000_inbox_canal_prueba` en desarrollo y tests: **294 migraciones**, sin seed ni reset. La [guía del canal](meta-inbox-canal-prueba.md) separa lo comprobado en local del ensayo real pendiente.

Después del reinicio del equipo se levantaron nuevamente web, API y ambos workers. Usan las conexiones locales anteriores, `GRAFO_DEPLOY_ENV=local`, `GRAFO_LOCAL_DISABLE_CRON=true`, correo vacío y todos los interruptores `META_INBOX_*`/piloto apagados; `META_CONEXION_MODO` vacío. El canal de prueba real sólo se habilita en staging. La muestra `/dev/diseno/inbox/prueba` usa datos ficticios en memoria y no necesita claves de Meta. No copiar las claves de staging para activarla. Los tests emplean `gdi_saas_test` con Graph simulado y Redis local.

Corrección del ensayo real del 27/09: aplicada `20260927210000_inbox_destino_prueba` sólo por migración aditiva, **295 migraciones** en desarrollo y tests. La identidad del contacto se conserva; el destino explícito sólo existe para el canal de prueba de staging. Los procesos locales conservan Meta y cron desactivados.


## Archivos y audio del Inbox — 28/09/2026

Mismo worktree y rama `codex/inbox-canal-pruebas`. Aplicada únicamente la migración aditiva `20260928120000_inbox_cargas` a desarrollo/tests: **296 migraciones**, con SELECT/INSERT/UPDATE/DELETE del rol local `grafo_app` comprobados en `InboxCarga`. Sin seed/reset. FFmpeg y FFprobe 9.0.1 están disponibles localmente en `/opt/homebrew/bin`; sirven para validar códecs y convertir las notas de voz a OGG/Opus mono. La imagen de API incorpora el paquete `ffmpeg`; se compila en remoto cuando se despliegue el lote. No se reinició Docker ni se cambiaron tamaños de infraestructura.

La muestra de Diana incluye audio entrante/saliente, video, sticker y texto; los envíos son simulados y los archivos se conservan sólo en memoria de esa vista. El editor permite adjuntar y grabar; enviar una grabación no abre vista previa. Las llamadas reales de Meta y los cron de desarrollo siguen apagados. Las [capacidades y pendientes](meta-inbox-capacidades.md) distinguen la implementación local del ensayo real aún necesario.

## Equipo del Inbox — 28/09

En el mismo worktree y rama `codex/inbox-canal-pruebas`, se aplicó la migración aditiva `20260928180000_inbox_equipo` sólo a desarrollo/tests: **297 migraciones**. Registra autores, responsables, transferencias y notas privadas; incorpora filtros y el permiso independiente de atención. Se otorgó al rol local `grafo_app` SELECT/INSERT/UPDATE/DELETE sobre la nueva tabla `InboxEventoInterno`. Sin seed/reset, cambios de credenciales, reinicio de Docker ni despliegue a staging/producción. Ver [funcionamiento y alcance](meta-inbox-equipo.md).


## Lectura y estados compartidos — 28/09

Aplicada la migración aditiva `20260928200000_inbox_estados_lectura` sólo a desarrollo y tests: **298 migraciones**. Agrega lectura compartida por el equipo y estados Activa/Resuelta, sin tablas nuevas ni cambios de credenciales. Prisma regenerado, con Meta y cron reales apagados. No se ejecutaron seeds/reset ni se desplegó staging/producción. Presencia simulada únicamente en la demo; el indicador real permanece neutral hasta implementar sus señales de conexión.


## Facturación por lote

La API registra el lote y devuelve `202`. El worker de cálculos existente también
procesa facturación, con una cola durable en PostgreSQL (`FacturacionLote` y sus
items): Redis no interviene en la admisión ni en la recuperación del lote. Los
PDF se generan en el proceso worker; cada aviso conserva la cola WhatsApp actual.

Para aislar únicamente facturación en una terminal local, sin servidor HTTP ni
cron, existe `npm --prefix apps/api run worker:facturacion:dev`. Usar Node 24 y
las variables de desarrollo indicadas arriba. No levantarlo adicionalmente al
worker general salvo que se esté comprobando la exclusión entre procesos.
El lease de PostgreSQL admite un turno por empresa; cada turno procesa una
factura o un paso de publicación. Un resultado fiscal incierto se consulta y,
si no se confirma en tres minutos, detiene el resto del lote para revisión.

Las pruebas HTTP usan la base **local de test** y un proveedor fiscal ficticio.
No arrancar workers reales contra esa base durante las pruebas. El avance y la
campanita se verifican con avisos ficticios: `pendiente` y `wati_aceptada` no se
consideran enviados. La notificación personal de finalización se confirma en
la misma transacción que cierra el lote y enlaza a su detalle.

Para un despliegue posterior: aplicar la migración, actualizar el worker general
y luego API y web. No hace falta crear otra máquina. El contrato POST ahora
requiere `claveSolicitud` UUID; la web conserva esa clave al reintentar una
solicitud sin respuesta. Una pestaña anterior debe actualizarse antes de iniciar
un lote. Ni este cambio ni las pruebas locales verifican por sí solos la
estabilidad de Redis en producción: ese incidente requiere correlacionar
latencias, recursos y errores del entorno remoto.

## Centro de copiado — entorno preparado el 10/10/2026

La aplicación, API y workers de cálculos/entregas y PDF están ejecutándose desde
el checkout principal, en `codex/centro-copiado-tarifarios`, revisión `55ecd2faa`.
No se cambiaron ramas de otros worktrees ni se reinició Docker.

- Web: `http://localhost:3000`; configuración en
  `http://localhost:3000/configuracion/centro-copiado`.
- API: `http://127.0.0.1:3001/api`, comprobada con `status: ok` y base disponible.
- Se aplicaron las cuatro migraciones pendientes mediante `migrate deploy`:
  `20261008210000_facturacion_lotes_durables`, `20261010120000_copiado_tarifarios`,
  `20261010140000_copiado_politica_borrador` y
  `20261011100000_copiado_pedidos_margenes`. La base local suma 315 migraciones.
- Sin seeds, resets ni borrados. Los conteos de empresas, usuarios, productos,
  cotizaciones y órdenes se mantuvieron iguales antes y después de migrar.
  Prisma regenerado y permisos SELECT/INSERT/UPDATE/DELETE de `grafo_app`
  comprobados sobre las seis tablas nuevas.
- Se usaron exclusivamente las conexiones locales existentes. Cron y Meta
  permanecen desactivados; correo transaccional y telemetría externa están
  deshabilitados en estos procesos. Las acciones manuales de integraciones
  conservan su configuración anterior: esta prueba no envió mensajes, cobró
  ni facturó. Los archivos mantienen el almacenamiento de desarrollo existente.
- Node 24, web con Webpack en modo desarrollo, API y workers con recarga de
  código fuente. Concurrencia de cotización/geometría/PDF limitada a uno; no
  se compiló una imagen de producción ni se modificó memoria de Docker.
- Los procesos quedaron independientes de la terminal de arranque. Sus PID y
  logs privados están en `.tmp/local-copiado/` (ignorada por Git). La carpeta
  contiene el lanzador utilizado; no volver a ejecutarlo si el servicio ya está
  activo. Los comandos del apartado «Arranque de desarrollo» siguen vigentes.

La pantalla de ingreso respondió HTTP 200 y el endpoint de tarifarios HTTP 401
sin sesión, como corresponde. API y ambos workers iniciaron sin errores. El
navegador de comprobación no tenía sesión local: no se alteraron usuarios ni
contraseñas para ingresar. La verificación funcional autenticada se realiza con
el usuario local habitual.

Recorrido inicial: Configuración → Centro de copiado → Tarifarios; crear y
cargar la matriz, definir el margen y publicar. Luego asignar el tarifario en
Canales y activar la asignación. En un pedido borrador, cargar los trabajos y
usar «Actualizar precios de copiado» antes de emitir. No se activó ninguna
política ni se cargaron precios de prueba en las empresas existentes.
