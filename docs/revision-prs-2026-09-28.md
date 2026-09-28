# Revisión e integración de PR — 28/09/2026

> Seguimiento: los PR #2–#7 ya se integraron en `main`; el #7 quedó en `7e58b0735`. Este documento conserva el relevamiento anterior. La recuperación del Inbox está en el PR #8 y su verificación actual en [VALIDACION.md](../deploy/staging/VALIDACION.md).


Los PR #5, #4 y #3 se reunieron en #2 mediante merges que conservan los commits. La base se actualizó con `main`, incluida la corrección de Grafo3D del #6. No hay diferencias frente a `main` en `apps/marketing` ni en `apps/forma-studio`.

Esta integración reúne infraestructura, correcciones y piloto inicial (284 migraciones). **No representa la versión más reciente desplegada en staging**: staging ya contiene el código del Inbox `d2677ff2a7ba`, con 298 migraciones, documentado en el PR #7 y validado por [CI 36385216857](https://github.com/studiocamaleon/gdi/actions/runs/36385216857). No desplegar esta base más antigua sobre staging ni intentar revertir su base de datos.

## Verificaciones de esta revisión

- Las compilaciones remotas históricas de cada bloque finalizaron correctamente; sus enlaces están en los PR actualizados.
- Sobre el conjunto reunido con `main` pasaron **63 pruebas de interfaz/acceso** (8 archivos) y **117 de API** (11 suites). Se usaron las dependencias ya instaladas, sin regenerarlas ni modificar las bases de datos o los servidores locales.
- Se agregó validación de contenedores para los PR hacia `main` que afectan código o despliegue. Usa datos desechables en GitHub; no tiene secretos de Fly, Neon, Redis o R2.
- La compilación y el ensayo remoto del conjunto deben aprobar antes del merge final de #2. Consultar sus checks para el resultado y el commit exacto; este documento no los da por aprobados por anticipado.

## Qué queda abierto

El PR #7 permanece en borrador: revisión del Inbox, prueba real de envío/recepción con acceso vigente, adjuntos y trabajo entre dos usuarios. Su descripción contiene los criterios de cierre. La aprobación de Meta y el alta/coexistencia real tienen una validación posterior propia; llamadas, presencia real y reportes se desarrollarán en PR separados.

Este trabajo organiza GitHub. No cambia las imágenes ni la base de datos de staging, no habilita producción de la aplicación y no cambia las ramas de las carpetas que tienen procesos locales activos.
