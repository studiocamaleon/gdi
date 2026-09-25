# Validación de staging — 24 de septiembre de 2026

Ensayos con el Compose aislado `grafoprint-staging-local`, en la Mac y en un ejecutor temporal de GitHub, y comprobaciones posteriores contra los proveedores de staging. Todos usaron datos sintéticos. Las credenciales cloud sólo se utilizaron desde la Mac y se cargaron en el almacén de secretos de Fly; no se incorporaron al repositorio ni al workflow.

## Comprobaciones locales

Comprobado:

- Compilación Nest con chequeo de tipos en Node 24 del host.
- TypeScript de la aplicación web con `--noEmit --incremental false`.
- ESLint de los archivos TypeScript modificados.
- Siete pruebas existentes del BFF, todas aprobadas.
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

La prueba HTTP no recorre la interfaz en un navegador ni valida cookies, MFA, SSE, proxy/IP o la integración con los proveedores reales. Esas pruebas siguen pendientes.

También quedan pendientes el documento generado desde un flujo funcional de la aplicación, los demás motores de geometría y el recorrido completo en navegador. El ensayo de PDF anterior valida el servicio de renderizado, no toda la cola de documentos.

## Conexiones a proveedores reales desde la Mac

Comprobaciones realizadas el 24 de septiembre de 2026, sin desplegar máquinas Fly:

- **Neon:** base vacía confirmada antes de aplicar las 280 migraciones. Rol SQL `grafoprint_staging_app` sin superusuario, creación de base/roles, `BYPASSRLS` ni permiso `CREATE` en `public`. Conexión agrupada del rol de ejecución validada. Inserción, consulta, actualización y eliminación de un usuario ficticio dentro de una transacción revertida. Lectura del historial Prisma denegada realmente, sin datos de ensayo persistentes. No se ejecutó seed ni bootstrap de administrador.
- **Redis Cloud 8.6.2:** conexión `rediss://` con certificado validado por Node 24, sin desactivar comprobaciones TLS ni agregar una CA privada. Queue, Worker y QueueEvents de BullMQ usaron las funciones de conexión compiladas de Grafoprint. Un trabajo sintético falló deliberadamente una vez, se reintentó y produjo el resultado esperado en el segundo intento. Cola exclusiva temporal eliminada; no se borraron otras claves. Esto no prueba caída de máquina, failover ni restauración.
- **R2:** driver compilado de Grafoprint contra bucket US privado, con token limitado a ese bucket. Subida PUT y descarga mediante firmas, HEAD de tamaño, multipart de dos partes (8 MiB + 1 KiB), exposición de `ETag`, preflight del origen de staging permitido, otro origen sin permiso CORS y descarga sin firma rechazada. Objetos temporales eliminados y su ausencia comprobada. La prueba envía las cabeceras HTTP de CORS; no sustituye el recorrido de la interfaz en navegador.
- **Fly:** cinco apps creadas, todas con lista de máquinas vacía. API y ambos workers tienen nueve variables en estado `Staged`, sin conexión de migrador. Next y Gotenberg tienen lista de secretos vacía. Todavía no se cargaron imágenes ni se asignaron IP/DNS.

Los accesos y el registro local de estas comprobaciones están en un directorio privado fuera de Git. Se cerraron los formularios temporales de captura y sus servidores locales.

Siguen pendientes DNS/HTTPS de la aplicación, IP real y proxies, acceso restringido a staging, cookies/MFA/SSE desde navegador, conectividad desde Fly, carga, recuperación de trabajos y restauración de Neon. El [presupuesto](./PRESUPUESTO.md) distingue Redis contratado de las máquinas Fly y Neon Launch aún propuestos.

La documentación de [TLS de Redis Cloud](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/) incluye autoridades privadas antiguas y una raíz pública GlobalSign. La conexión probada aceptó la cadena con el almacén normal de Node; volver a verificar dentro de la imagen desplegada sin desactivar la validación.
