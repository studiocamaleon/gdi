# Forma de trabajar en Grafoprint

- Responder y preguntar siempre en español, con explicaciones simples: Lucas desarrolla mediante vibecoding.
- Desarrollar y comprobar los cambios en local primero. Agrupar cambios coherentes antes de actualizar staging; evitar un despliegue por cada corrección, salvo pedido explícito del usuario.
- Usar ramas `codex/…` para el trabajo nuevo y commits pequeños. El PR permite revisar el conjunto; abrirlo o actualizarlo no implica fusionarlo ni desplegar producción.
- Crear cada trabajo independiente desde `origin/main` actualizado y dirigir su PR a `main`. Si necesita un PR sin integrar, declarar esa dependencia y ajustar la base al resolverla. Seguir `docs/flujo-pull-requests.md`; no sumar funcionalidades ajenas a un PR ya listo para revisión.
- Antes de cambiar de rama, comprobar cambios pendientes y procesos locales: la API, la web y los workers pueden estar siguiendo los archivos de esa carpeta.
- Staging y local tienen bases y accesos distintos. No copiar credenciales de staging a local ni ejecutar seeds, resets o borrados para actualizar un entorno con datos.
- La Mac tiene 8 GB y Docker 4 GB compartidos con otros proyectos. No reiniciar Docker, aumentar su memoria ni parar otros proyectos. Compilar contenedores y web de producción en remoto.
- Para operar staging, consultar `deploy/staging/README.md` y registrar versión y verificación en `deploy/staging/VALIDACION.md`. No fusionar los PR pendientes ni modificar producción incidentalmente.
- Para levantar el desarrollo local, consultar `docs/desarrollo-local.md`. La configuración local anterior contiene integraciones externas; mantener desactivadas las tareas programadas durante este recorrido de desarrollo.
- En tests, ejemplos y documentación pública usar datos ficticios. Nunca copiar teléfonos personales, credenciales ni identificadores privados de la conversación a archivos versionados. Revisar el diff antes de publicar.
- No versionar respaldos de bases, archivos de clientes, secretos ni informes con vulnerabilidades sin corregir. El historial de Git también conserva los archivos borrados; los respaldos deben ir a almacenamiento privado independiente.
- Cada corrección de seguridad debe tener una prueba que reproduzca el fallo y luego confirme el rechazo, usando identidades y empresas ficticias. No hacer pruebas destructivas sobre staging o producción.
- Una copia de seguridad se considera comprobada después de restaurarla en un entorno aislado y validar datos, archivos y claves de descifrado. Nunca reactivar envíos, cobros o tareas externas automáticamente después de una restauración.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
