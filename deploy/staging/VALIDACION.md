# Validación de staging — 24 y 25 de septiembre de 2026

Ensayos con el Compose aislado `grafoprint-staging-local`, en la Mac y en un ejecutor temporal de GitHub, y comprobaciones posteriores contra los proveedores de staging. Todos usaron datos sintéticos. Las credenciales cloud se usaron desde la Mac y desde las máquinas Fly a través de su almacén de secretos; no se incorporaron al repositorio ni al workflow.

## Comprobaciones locales

Comprobado:

- Compilación Nest con chequeo de tipos en Node 24 del host.
- TypeScript de la aplicación web con `--noEmit --incremental false`.
- ESLint de los archivos TypeScript modificados.
- En la preparación inicial: siete pruebas existentes del BFF, todas aprobadas. La ampliación de acceso privado se detalla debajo.
- Sintaxis de los cinco manifiestos TOML y de Docker Compose.
- Las **280 migraciones** aplicadas desde cero en PostgreSQL 16, como dueño de base sin superusuario.
- Rol de ejecución sin superusuario, creación de roles ni `BYPASSRLS`; permisos de DML sobre tablas actuales y futuras.
- Rechazo de creación de tablas y lectura de `_prisma_migrations` con el rol de ejecución.
- Bootstrap repetible sin cambiar contraseña/nombre; rechazo de un segundo administrador, elevación de usuarios y reactivación de usuarios inactivos.
- Bootstrap ejecutado sin entregar la variable de conexión del migrador.
- Rechazo de nombre de base/esquema distintos del destino explícito y exclusión de los archivos de secretos de Git.
- Imagen de backend Linux amd64 construida; carga de Node, Prisma, sharp y el módulo ESM de geometría comprobada dentro del contenedor.
- Python 3.12, compas_nest, SciPy y ezdxf importados correctamente en esa imagen.
- Repetición de migraciones (sin pendientes), creación/verificación del rol, bootstrap y ensayo de permisos también ejecutados dentro de la imagen Linux.
- API iniciada en modo producción: salud, autenticación directa del administrador, cierre de sesión y rechazo del registro público.
- Worker de geometría: trabajo de cinco piezas procesado con el motor `collision`, sin solapamientos y respetando la separación. No equivale a validar todos los motores de geometría.
- Worker PDF iniciado y conectado; Gotenberg produjo un PDF real con Chromium a partir de HTML sintético.
- Subida y descarga mediante URLs firmadas del driver R2 contra S3Mock, con eliminación del archivo de ensayo.

La imagen backend se construyó con `SKIP_TYPECHECK=true` después de los chequeos nativos anteriores, por el límite de 4 GB de Docker Desktop. El build habitual y los manifiestos Fly mantienen el chequeo de tipos habilitado.

Los intentos de compilación web en la Mac no se completaron; por indicación del usuario no se reinició Docker ni se aumentó su memoria. La Mac dispone de 8 GB físicos y Docker de 4 GB, compartidos con otros proyectos. La compilación y el ensayo HTTP pendientes se completaron posteriormente en GitHub, como se detalla abajo.

## Validación remota de contenedores

El workflow [staging-validation.yml](../../.github/workflows/staging-validation.yml) **aprobó** sobre el commit `231132d98079ac2a8ead5870763ec25a1a59ce9b`: [ejecución de GitHub Actions](https://github.com/studiocamaleon/gdi/actions/runs/36078608771).

- Backend Linux amd64 compilado con chequeo de tipos habilitado.
- Imagen Next standalone compilada con chequeo de tipos habilitado. La primera ejecución detectó que faltaba `scripts/postcss-heroui-scope.cjs` en el contexto y en la imagen de build; se incluyó específicamente ese archivo y la segunda ejecución aprobó.
- Base temporal PostgreSQL 16: migraciones, rol de ejecución, bootstrap y comprobaciones de permisos aprobados.
- Contenedores API y Next iniciados y saludables; `/login` respondió correctamente.
- Autenticación del administrador por HTTP directa y mediante Next/BFF, cierre de sesión y registro público cerrado: aprobados.
- Servicios temporales detenidos al terminar; no se cargaron claves cloud, publicaron imágenes ni desplegaron aplicaciones Fly.

La prueba HTTP inicial no recorría la interfaz en un navegador ni validaba cookies, MFA, SSE, proxy/IP o la integración con los proveedores reales.

La ampliación del acceso privado aprobó sobre el commit `4f0cfa25c76f727a985e09122888a0e5f435e4d7`: [ejecución de GitHub Actions](https://github.com/studiocamaleon/gdi/actions/runs/36082768460). Repitió ambas compilaciones con chequeo de tipos, las migraciones/roles y el arranque HTTP. Comprobó rechazo del acceso anónimo a páginas, archivos y BFF; `noindex` y robots; rechazo del acceso directo a la API sin la credencial interna; login interno/BFF con IP de Fly simulada y cabeceras falsas del cliente; logout y registro público cerrado.

Además aprobaron **42 pruebas unitarias web y 28 de API** del acceso de staging, BFF, ruteo y tratamiento de IP. TypeScript de la web y ESLint de los archivos modificados aprobaron localmente. El intento adicional de TypeScript de API en el host agotó el heap; no se amplió Docker ni se repitió allí: el build de API con chequeo de tipos en GitHub sí aprobó.

El ensayo de Compose simula `Fly-Client-IP`; la verificación posterior del proxy real se detalla debajo. El recorrido en navegador, MFA y SSE siguen pendientes.

La validación final de contenedores aprobó sobre el commit desplegado `9e2a67c2881f66346b9290f57271e7859fc8e848`: [GitHub Actions 36083820597](https://github.com/studiocamaleon/gdi/actions/runs/36083820597). Repitió ambas compilaciones con tipos, migraciones, roles y login/BFF. Agregó creación de cookie `Secure`, `HttpOnly`, `SameSite=Lax`, renderizado SSR de `/backoffice/seguridad` y eliminación de la cookie al salir.

También quedan pendientes el documento generado desde un flujo funcional de la aplicación, los demás motores de geometría y el recorrido completo en navegador. El ensayo de PDF anterior valida el servicio de renderizado, no toda la cola de documentos.

### Corrección del primer acceso del administrador

El commit `2f1d05b79a8efe20717db121e1bbe00fec8958eb` aprobó [GitHub Actions 36090326663](https://github.com/studiocamaleon/gdi/actions/runs/36090326663): ambas imágenes compiladas con tipos, 280 migraciones, rol limitado, bootstrap y ensayo HTTP en una base temporal con usuario ficticio.

El ensayo adicional comprobó la pantalla SSR `/backoffice/cambiar-clave`, las redirecciones desde `/cambiar-clave`, `/plataforma` y `/backoffice/seguridad`, el rechazo de una clave actual incorrecta y de reutilizar la provisoria, el cambio válido, el rechazo de login con la contraseña anterior y el reingreso con la nueva. Después del cambio, MFA siguió siendo obligatorio y la consola respondió `403`. La clave del administrador cloud no se cambió en estos ensayos.

También aprobaron 28 pruebas de proxy/acceso de staging y 13 del guard de plataforma/autenticación, TypeScript web y ESLint de los archivos modificados. El caso con MFA ya completa verifica que una clave provisoria siga bloqueando la consola; al cambiarla se vuelve a consultar el estado vigente del usuario. Las sesiones de plataforma siguen sin acceder a rutas de tenant.

## Conexiones a proveedores reales desde la Mac

Comprobaciones iniciales realizadas el 24 de septiembre de 2026, antes del despliegue Fly:

- **Neon:** base vacía confirmada antes de aplicar las 280 migraciones. Rol SQL `grafoprint_staging_app` sin superusuario, creación de base/roles, `BYPASSRLS` ni permiso `CREATE` en `public`. Conexión agrupada del rol de ejecución validada. Inserción, consulta, actualización y eliminación de un usuario ficticio dentro de una transacción revertida. Lectura del historial Prisma denegada realmente, sin datos de ensayo persistentes. No se ejecutó seed. Después se creó el administrador inicial con el rol de ejecución, sin entregar la conexión del migrador al bootstrap. Se comprobó que está activo, con rol `ADMIN` y cambio obligatorio de contraseña. Contraseña inicial guardada sólo en el directorio privado; primer ingreso, cambio de clave y MFA pendientes.
- **Redis Cloud 8.6.2:** conexión `rediss://` con certificado validado por Node 24, sin desactivar comprobaciones TLS ni agregar una CA privada. Queue, Worker y QueueEvents de BullMQ usaron las funciones de conexión compiladas de Grafoprint. Un trabajo sintético falló deliberadamente una vez, se reintentó y produjo el resultado esperado en el segundo intento. Cola exclusiva temporal eliminada; no se borraron otras claves. Esto no prueba caída de máquina, failover ni restauración.
- **R2:** driver compilado de Grafoprint contra bucket US privado, con token limitado a ese bucket. Subida PUT y descarga mediante firmas, HEAD de tamaño, multipart de dos partes (8 MiB + 1 KiB), exposición de `ETag`, preflight del origen de staging permitido, otro origen sin permiso CORS y descarga sin firma rechazada. Objetos temporales eliminados y su ausencia comprobada. La prueba envía las cabeceras HTTP de CORS; no sustituye el recorrido de la interfaz en navegador.
- **Fly:** cinco apps creadas, todas con lista de máquinas vacía. API tiene diez variables en estado `Staged`, ambos workers nueve cada uno y Next las tres variables de acceso privado. Gotenberg no recibe claves; ninguna app recibe la conexión del migrador. Todavía no se cargaron imágenes ni se asignaron IP/DNS.

Los accesos y el registro local de estas comprobaciones están en un directorio privado fuera de Git. Se cerraron los formularios temporales de captura y sus servidores locales.

La etapa cloud posterior activó las cinco máquinas Fly y Neon Launch con el [presupuesto autorizado](./PRESUPUESTO.md). No tomar el estado inicial anterior como inventario actual.

La documentación de [TLS de Redis Cloud](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/) incluye autoridades privadas antiguas y una raíz pública GlobalSign. La conexión probada aceptó la cadena con el almacén normal de Node; esa validación también aprobó posteriormente dentro de la imagen desplegada.

## Despliegue y pruebas desde Fly

Completados el 24 de septiembre de 2026 en Argentina (25 de septiembre en los registros UTC). Una máquina iniciada por app, región `gru`, sin escalado adicional:

| App | Máquina | CPU compartida / RAM |
| --- | --- | --- |
| grafoprint-staging-web | `683d195da310e8` | 1 / 1 GB |
| grafoprint-staging-api | `2863067f3ee498` | 1 / 2 GB |
| grafoprint-staging-worker | `811d35db955998` | 2 / 4 GB |
| grafoprint-staging-worker-pdf | `2874693f49d068` | 1 / 1 GB |
| grafoprint-staging-pdf | `080e9dddcd2608` | 1 / 1 GB |

Imágenes de backend y Next compiladas por un builder remoto Fly con chequeo de tipos habilitado, sin Depot ni Docker local. El contexto de compilación se acotó a los archivos necesarios y excluyó secretos y dependencias del host. El builder temporal `fly-builder-unfurling-raindrop-8617` fue eliminado al finalizar.

- Backend desplegado: `registry.fly.io/grafoprint-staging-api@sha256:9deac1ad0ea89d2fa3748cf0a96edefef1b276c0a12b8733f33b63c02025dccf`. Reutilizado en API y ambos workers.
- Web desplegada: `registry.fly.io/grafoprint-staging-web@sha256:277c5f31b2094e3acc8209bd5f121769c03fe00a2a2fca99aa61c0854b5154e7`.
- Gotenberg fijado por digest en su manifiesto. Su configuración no acepta las formas `::`/`[::]` ensayadas; se corrigió a `API_BIND_IP=0.0.0.0`, que permite el acceso probado por la red privada de Fly. `TINI_SUBREAPER=1` evita el aviso de recolección de procesos. Health check HTTP `/health` aprobado; no hay IP ni servicio público de PDF.

Resultados desde la máquina API usando sus secretos de ejecución, sin clave de migrador:

- **PostgreSQL:** conexión agrupada con TLS, DML sintético en transacción revertida y denegación de DDL/historial Prisma.
- **Redis:** TLS validado normalmente; Queue, Worker y QueueEvents de BullMQ completaron un trabajo sintético con fallo deliberado inicial, reintento y resultado esperado. Cola exclusiva eliminada.
- **R2:** PUT/GET firmados, HEAD, multipart de dos partes, CORS del origen permitido, rechazo de otro origen y de acceso anónimo; objetos sintéticos eliminados.
- **Gotenberg:** PDF real por dirección `.internal`, encabezado `%PDF-` y 14.868 bytes. No equivale a probar el flujo completo de documentos de Grafoprint.

Resultados HTTP contra las apps `.fly.dev` con certificados válidos:

- Salud web/API `200`; páginas, archivos y BFF sin Basic `401`, con `noindex`; rutas privadas de API sin credencial interna `403`.
- Login del administrador por BFF `201`, cookie `Secure`/`HttpOnly`/`SameSite=Lax`, pantalla SSR de seguridad `200`, contexto de plataforma `200` y logout con eliminación de cookie.
- Solicitud con origen ajeno rechazada `403`.
- Intentos de inyectar `Fly-Client-IP`, `X-Forwarded-For` y cabeceras internas con una IP ficticia no sustituyeron la IP observada por la API. Comprobación del registro correspondiente por identificador de solicitud: IP válida y diferente de la falsa, token interno eliminado y autorización redactada. No se publicó la IP real ni claves.

## DNS, acceso inicial y límites pendientes

Configuración actual en Donweb, TTL 900:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| A | pruebas.grafoprint.com.ar | 66.241.125.194 |
| AAAA | pruebas.grafoprint.com.ar | 2a09:8280:1::19a:e4e7:0 |
| CNAME | api-pruebas.grafoprint.com.ar | rknkl93.grafoprint-staging-api.fly.dev. |
| A | staging.grafoprint.com.ar | 66.241.125.194 |
| AAAA | staging.grafoprint.com.ar | 2a09:8280:1::19a:e4e7:0 |
| CNAME | api-staging.grafoprint.com.ar | rknkl93.grafoprint-staging-api.fly.dev. |
| TXT | _fly-ownership.staging.grafoprint.com.ar | app-kjwj93o |
| TXT | _fly-ownership.api-staging.grafoprint.com.ar | app-rknkl93 |
| CNAME | _acme-challenge.staging.grafoprint.com.ar | staging.grafoprint.com.ar.kjwj93o.flydns.net. |
| CNAME | _acme-challenge.api-staging.grafoprint.com.ar | api-staging.grafoprint.com.ar.rknkl93.flydns.net. |

El CNAME inicial de la web se sustituyó por A/AAAA directos, modalidad recomendada por [Fly para conexión directa](https://docs.fly.io/networking/custom-domain/). No se cambiaron los registros de la web comercial, correo ni delegación del dominio.

Comprobaciones adicionales del 24 de septiembre, aproximadamente 23:25–23:40 de Argentina:

- Consultas directas a los DNS de Donweb/Hostmar respondieron con los registros actuales; también consultas con mayúsculas y minúsculas. Hubo algunos tiempos de espera TCP entre las consultas, sin respuestas con datos incorrectos.
- La delegación consultada en `e.dns.ar` apunta a `ns1.donweb.com` y `ns2.donweb.com`. Esos nombres resuelven a las mismas direcciones que `ns3.hostmar.com` y `ns4.hostmar.com`, que figuran en la zona. No se cambió la delegación por esa diferencia de nombres.
- Desde la máquina API, consultas explícitas a los dos DNS autoritativos y a Google devolvieron CNAME/TXT/ACME correctos. Una consulta CNAME a `1.1.1.1` dio `ENOTFOUND`, mientras otras consultas respondían correctamente. Se solicitó refresco en la herramienta pública de caché de Cloudflare para A, AAAA, CNAME, TXT de propiedad y ACME de ambos subdominios. Después, consultas DNS sobre HTTPS desde Fly devolvieron A/AAAA/CNAME correctos.
- El validador Fly reconoció la web como `configured=true`/`Awaiting certificates` y luego volvió a informar ausencia de registros. También se observó `http_configured=true` después de pasar a A/AAAA. No hay aún certificado emitido. La consulta `check` puede variar entre validadores o cachés; el resultado positivo aislado no demuestra que HTTPS esté listo.
- El diagnóstico externo recomendado por Fly, Let's Debug, informó `NoRecords` tanto antes como después del ajuste. [Resultado de la última consulta](https://letsdebug.net/staging.grafoprint.com.ar/3173274). Esta diferencia con los DNS consultados impide atribuir el problema exclusivamente a Fly o afirmar una causa definitiva.

### HTTPS resuelto en los dominios originales

**`staging.grafoprint.com.ar` y `api-staging.grafoprint.com.ar` quedaron Ready/active**, con certificados RSA/ECDSA de Let's Encrypt emitidos el 25 de septiembre a las 02:55 UTC y vencimiento el 24 de diciembre de 2026. Fly administra su renovación automática mientras se mantengan los DNS y la validación.

Como diagnóstico se publicaron primero los DNS de `pruebas.grafoprint.com.ar` y `api-pruebas.grafoprint.com.ar`, se comprobó su resolución y sólo después se agregaron a Fly. También obtuvieron certificados. Se ensayó temporalmente el acceso con esos nombres; al confirmar la emisión para los originales, se restauraron las URLs originales en web, API, workers y CORS de R2. Los registros/certificados auxiliares permanecen como evidencia de diagnóstico; no son las direcciones de acceso.

El dominio raíz pasó [Let's Debug](https://letsdebug.net/grafoprint.com.ar/3173295); el [nombre nuevo](https://letsdebug.net/pruebas.grafoprint.com.ar/3173301) resolvió sus direcciones en ese mismo servicio antes de emitirse el certificado, a diferencia del `NoRecords` de `staging`. El diagnóstico HTTP de ese instante todavía fallaba porque no había certificado; después se verificó HTTPS directamente con la validación TLS normal. La resolución de `staging` también se observó correcta desde múltiples países en What's My DNS.

Estos resultados son compatibles con caché negativa de los nombres originales; no prueban cuál de los componentes la conservaba ni que crear los nombres auxiliares haya causado su desbloqueo. No fue necesario migrar el DNS global ni comprar/importar un certificado. Según [Fly](https://docs.fly.io/networking/custom-domain/#use-your-own-certificate), la importación también exige validar propiedad.

Los ajustes temporales y la restauración reutilizaron las imágenes existentes y las mismas cuatro máquinas, sin compilar ni aumentar capacidad. Gotenberg conserva su configuración. R2 mantiene el bucket privado y sólo permite el origen original de staging.

Pruebas HTTP en los dominios auxiliares y repetidas en los originales después de restaurar la configuración, con TLS validado:

- Salud web/API `200`; acceso web/BFF sin Basic `401`; API sin credencial interna `403`.
- Login de plataforma `201`, cookie `Secure`/`HttpOnly`/`SameSite=Lax`, pantalla de seguridad SSR `200`, contexto de plataforma `200`, logout y eliminación de cookie correctos.
- Origen ajeno rechazado `403`.
- Preflight de R2 con el origen exacto devuelto y origen ajeno rechazado; el origen auxiliar se eliminó al restaurar la configuración. Este chequeo no repitió multipart ni el flujo de archivos completo desde el navegador.
- **Incidencia de primer acceso observada antes de la corrección descrita debajo:** `/cambiar-clave` con sesión de plataforma responde `307` a `/plataforma`. `src/proxy.ts` limita esas sesiones al backoffice/plataforma; la pantalla de seguridad ofrece MFA pero no cambio de contraseña. El verificador inicial falló esa aserción; el diagnóstico posterior conservó la limitación y completó los demás chequeos. No se cambió la contraseña ni se da por aprobado ese recorrido.
- **Bloqueo de Chrome observado antes del acceso descrito debajo:** la apertura del login devolvió `ERR_BLOCKED_BY_CLIENT`, incluso tras recargar. Ocurrió también al abrir `/api/health` en el dominio original, que responde `200` sin Basic en el ensayo HTTP; no se identificó la causa del bloqueo del navegador. No se desactivaron extensiones ni protecciones. Los ensayos HTTP anteriores sí usaron autenticación válida por HTTPS.

### Primer acceso corregido y comprobado en staging

El código `2f1d05b79a8e` se compiló remotamente con chequeo de tipos y se desplegó después de aprobar el ensayo de GitHub. Se mantuvieron las cinco máquinas, sus identificadores, región y tamaños. API y ambos workers usan el mismo backend; Gotenberg no se modificó. El builder temporal `fly-builder-noble-tree-8917` fue eliminado al terminar.

Imágenes del arreglo de primer acceso (la web fue actualizada posteriormente; ver última sección):

- Backend: `registry.fly.io/grafoprint-staging-api@sha256:5513e09cd1be961b5ae7497d245015f70a9a690f0faf19450b0137d9e5bd71d4`.
- Web: `registry.fly.io/grafoprint-staging-web@sha256:db1eb97acfefc52624c0ac597a41e77bd336beda989ca24d85cc3ba7a0257ee7`.

El verificador HTTP por los dominios originales aprobó salud, acceso privado, login de plataforma, cookie segura, pantalla de cambio de clave `200`, redirección de las tres entradas al cambio de clave, contexto con clave/MFA pendientes, consola `403`, rechazo de origen ajeno y logout con eliminación de cookie. Usó TLS normal y la clave inicial existente; no eligió una nueva contraseña para el usuario.

En Chrome, Lucas abrió manualmente la página y confirmó que aparecía el diálogo de usuario/contraseña. Tras completar HTTP Basic se vio el login de Grafoprint. Con la versión nueva se ingresó con la cuenta inicial y la pantalla «Elegí tu clave» apareció en `/backoffice/cambiar-clave`. Se dejó la clave provisoria cargada y se entregó el control a Lucas antes de introducir la nueva. No fue necesario desactivar extensiones ni protecciones del navegador. El fallo de automatización se superó; no se atribuye a una extensión específica.

Lucas confirmó que guardó su contraseña personal y la pantalla cambió a «Protegé tu acceso»; se verificó esa pantalla en Chrome. Luego Lucas completó MFA y accedió a la consola; se comprobó la fila del administrador con «MFA activada» y una sesión activa. Su nueva contraseña, QR y códigos de recuperación no fueron solicitados ni almacenados por el agente.

No se desactivó la validación TLS, no se enviaron credenciales por HTTP y no se cambiaron registros de la web comercial o correo.

Neon Launch quedó a 0,25 CU fijos tanto en el cómputo actual como en los valores predeterminados; historial de restauración de un día y notificación de gasto de USD 20. El administrador inicial existe; login HTTP y llegada al formulario de cambio de clave en Chrome comprobados. Lucas ya eligió su contraseña y completó MFA. El acceso privado y sus credenciales iniciales están en un archivo local fuera de Git.

Orden de continuación:

1. Con la empresa ficticia creada, verificar archivos, PDF desde la aplicación, cálculos y eventos SSE; el administrador ficticio todavía no está activado.
2. Medir carga, memoria, conexiones y resultados grandes; probar interrupción y recuperación de trabajos y restauración de Neon antes de usar datos reales.
3. Al implementar WhatsApp, revisar la declaración de Redis como proveedor si recibe datos de Meta. Staging todavía no incorpora la integración directa de WhatsApp.

Las pruebas actuales validan el despliegue y componentes básicos; no acreditan disponibilidad de producción, capacidad por tenant ni recuperación ante desastres.

## Empresa ficticia de staging

Se creó desde la interfaz autenticada «Gráfica Demo — Staging», slug `grafica-demo-staging`, ID `222fd65a-7234-4d86-9c20-be1cd646853d`. El directorio confirmó acceso operativo, plan Trial, suscripción activa/manual y cero usuarios habilitados. La ficha confirmó 3 usuarios, 50 órdenes al mes y 2 GB; facturación electrónica, WhatsApp, centro de copiado e impresión directa no incluidos. El correo elegido es sintético (`admin@grafoprint-demo.example.invalid`); la invitación está pendiente y no hay `RESEND_API_KEY` configurada en la API de staging, por lo que no se enviaron correos. No se conectó ningún medio de pago. El alta utilizó el aprovisionamiento normal y dejó la auditoría correspondiente.

La empresa ya existe; no repetir el alta ante el aviso de correo sin confirmar. El staff puede iniciar un acceso de soporte desde Plataforma. El ingreso con usuario propio del tenant requiere activar su invitación; todavía no se verificaron los flujos funcionales de esa empresa.

## Contraste, ícono e identificación del entorno

El commit `66dd4fb3e714e37673a78ca37a520fc5973f4ea8` aprobó [GitHub Actions 36091947240](https://github.com/studiocamaleon/gdi/actions/runs/36091947240), con ambas compilaciones, tipos, migraciones, permisos y ensayo HTTP. Localmente aprobaron 33 pruebas del proxy/acceso de staging, TypeScript web y ESLint de los archivos cambiados.

Se corrigió la tarjeta «Tu acceso a Grafo» mediante los tokens de superficie/borde del panel: el fondo compartido ya no puede sobreescribir el grafito por orden de carga del CSS. El rótulo de ambiente toma `STAGING_PRIVATE` y muestra Staging, aunque Next se ejecute en modo de producción. El SVG de marca existente se sirve en su ruta exacta `/icon.svg` con GET/HEAD sin redirección de sesión ni desafío Basic; las rutas parecidas, POST y el resto del entorno siguen protegidos.

La nueva web se desplegó en la misma máquina `683d195da310e8`, sin cambiar capacidad, con la imagen `registry.fly.io/grafoprint-staging-web@sha256:12d6bee6768edf85732854c76b993f2696b2587548ca9c1a0b43ecad256f6dd7`. Backend/workers conservan la imagen del arreglo de primer acceso. El builder temporal `fly-builder-withered-valley-3413` se eliminó al finalizar.

Después del despliegue aprobaron salud web y las peticiones GET/HEAD al ícono: `200`, SVG válido y sin redirección. POST al ícono, rutas con sufijos, backoffice y BFF sin Basic respondieron `401`. En Chrome se conservó la sesión MFA y se verificó la etiqueta Staging y la tarjeta corregida: fondo `rgb(16,18,20)`, título/botón `rgb(243,242,238)` y texto secundario `rgb(185,189,190)`, con captura visual. El control del navegador superpone temporalmente su propio indicador al favicon; no se modificó ese indicador. La ficha de Gráfica Demo se mantuvo disponible tras la actualización.
