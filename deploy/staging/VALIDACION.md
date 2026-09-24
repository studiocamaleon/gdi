# Validación local — 24 de septiembre de 2026

Entorno aislado `grafoprint-staging-local`, sin datos reales, conexiones a servicios comerciales ni despliegues cloud.

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

**Pendiente por indicación del usuario:** compilación y arranque de la imagen web, y prueba de autenticación completa a través de Next/BFF. Los intentos de compilación local no se completaron; no se reinició Docker ni se aumentó su memoria. La Mac dispone de 8 GB físicos y Docker de 4 GB, compartidos con otros proyectos. Reanudar esa validación en un entorno con recursos suficientes antes del despliegue. Los chequeos TypeScript de la web y las siete pruebas unitarias del BFF sí aprobaron.

También quedan pendientes el documento generado desde un flujo funcional de la aplicación, los demás motores de geometría y el recorrido completo en navegador. El ensayo de PDF anterior valida el servicio de renderizado, no toda la cola de documentos.

Las pruebas de DNS, TLS, IP real, SSE, CORS y firmas contra R2, recuperación de trabajos y restauración de Neon se ejecutarán en el entorno cloud. El proveedor/plan de Redis y los tamaños/costos de Fly siguen pendientes de cierre.
