# Grafoprint

Grafo reúne la aplicación de gestión, su API y workers, la web comercial y Grafo3D. Cada entorno tiene sus propios datos y accesos.

## Antes de trabajar

Leer [AGENTS.md](AGENTS.md), [desarrollo local](docs/desarrollo-local.md) y [ramas y pull requests](docs/flujo-pull-requests.md). Desarrollar primero en local, agrupar cambios y comprobarlos antes de actualizar staging. Una rama o un PR no publica producción por sí solo.

Este proyecto usa **npm y los archivos `package-lock.json`** de cada aplicación. Para una instalación reproducible, ejecutar `npm ci` en la carpeta correspondiente siguiendo su guía. No mezclar gestores ni generar un segundo lockfile. El antiguo `pnpm-lock.yaml` fue retirado porque ya no coincidía con las dependencias comprobadas. La compilación de Fly y la web comercial de Vercel también usan npm.

No volver a instalar dependencias ni cambiar la rama de una carpeta que tenga procesos activos sin revisar antes el impacto. Los accesos locales se preparan fuera de Git; nunca se copian desde staging para levantar desarrollo.

## Dónde está cada parte

| Parte | Carpeta | Función |
| --- | --- | --- |
| Aplicación | `src/` | Pantallas de gestión e Inbox; usa la API. |
| API y workers | `apps/api/` | Reglas de negocio, datos y tareas de fondo. |
| Web comercial | `apps/marketing/` | Sitio público en Vercel. |
| Grafo3D | `apps/forma-studio/` | Diseños y modelos accesibles desde la web comercial. |
| Despliegue | `deploy/` | Contenedores y configuración para Fly. |
| Recuperación | `deploy/recuperacion/` | Copias cifradas, verificación y recuperación. |

## Guías de operación

- [Arrancar y trabajar en local](docs/desarrollo-local.md).
- [Revisar e integrar cambios mediante PR](docs/flujo-pull-requests.md).
- [Operar staging](deploy/staging/README.md) y consultar su [validación y versión vigente](deploy/staging/VALIDACION.md).
- [Operar y recuperar backups](deploy/recuperacion/OPERACION.md).
- [Web comercial y Grafo3D](apps/marketing/README.md).

No ejecutar seeds, resets ni borrados sobre entornos con datos para actualizarlos. Las pruebas con base utilizan `gdi_saas_test` y datos ficticios. Los informes privados de seguridad, archivos de clientes, respaldos y secretos deben permanecer fuera de este repositorio.
