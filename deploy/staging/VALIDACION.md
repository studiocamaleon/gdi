# Validación de staging — 24 de septiembre de 2026

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

**HTTPS por los dominios propios sigue pendiente.** No se desactivó la validación TLS ni se enviaron credenciales por HTTP. La discrepancia de resolución está documentada; aún no se demostró si corresponde sólo a propagación/caché o a otro problema de DNS. Evitar eliminar/recrear solicitudes repetidamente.

Neon Launch quedó a 0,25 CU fijos tanto en el cómputo actual como en los valores predeterminados; historial de restauración de un día y notificación de gasto de USD 20. El administrador inicial existe y el login HTTP fue probado, pero Lucas todavía debe elegir su contraseña y completar MFA. El acceso privado y sus credenciales iniciales están en un archivo local fuera de Git.

Orden de continuación:

1. Verificar que Fly emita los dos certificados y repetir el ensayo HTTP por el dominio propio.
2. Recorrer el acceso en Chrome. Cambiar personalmente la clave del administrador en `/cambiar-clave` y completar MFA en `/backoffice/seguridad`.
3. Preparar catálogo/plan de pruebas y una empresa ficticia; verificar archivos, PDF desde la aplicación, cálculos y eventos SSE.
4. Medir carga, memoria, conexiones y resultados grandes; probar interrupción y recuperación de trabajos y restauración de Neon antes de usar datos reales.
5. Al implementar WhatsApp, revisar la declaración de Redis como proveedor si recibe datos de Meta. Staging todavía no incorpora la integración directa de WhatsApp.

Las pruebas actuales validan el despliegue y componentes básicos; no acreditan disponibilidad de producción, capacidad por tenant ni recuperación ante desastres.
