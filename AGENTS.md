# Forma de trabajar en Grafoprint

- Responder y preguntar siempre en español, con explicaciones simples: Lucas desarrolla mediante vibecoding.
- Desarrollar y comprobar los cambios en local primero. Agrupar cambios coherentes antes de actualizar staging; evitar un despliegue por cada corrección, salvo pedido explícito del usuario.
- Usar ramas `codex/…` para el trabajo nuevo y commits pequeños. El PR permite revisar el conjunto; abrirlo o actualizarlo no implica fusionarlo ni desplegar producción.
- Antes de cambiar de rama, comprobar cambios pendientes y procesos locales: la API, la web y los workers pueden estar siguiendo los archivos de esa carpeta.
- Staging y local tienen bases y accesos distintos. No copiar credenciales de staging a local ni ejecutar seeds, resets o borrados para actualizar un entorno con datos.
- La Mac tiene 8 GB y Docker 4 GB compartidos con otros proyectos. No reiniciar Docker, aumentar su memoria ni parar otros proyectos. Compilar contenedores y web de producción en remoto.
- Para operar staging, consultar `deploy/staging/README.md` y registrar versión y verificación en `deploy/staging/VALIDACION.md`. No fusionar los PR pendientes ni modificar producción incidentalmente.
- Para levantar el desarrollo local, consultar `docs/desarrollo-local.md`. La configuración local anterior contiene integraciones externas; mantener desactivadas las tareas programadas durante este recorrido de desarrollo.
- En tests, ejemplos y documentación pública usar datos ficticios. Nunca copiar teléfonos personales, credenciales ni identificadores privados de la conversación a archivos versionados. Revisar el diff antes de publicar.
