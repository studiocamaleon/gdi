# Grafoprint

Sistema para empresas gráficas. Este repositorio contiene la aplicación de trabajo, su API y procesos de fondo, y la web comercial independiente.

## Empezar por acá

- [Manual de trabajo seguro](docs/manual-desarrollo-grafoprint.md): guía sencilla para Lucas y colaboradores, desde una idea hasta su publicación.
- [AGENTS.md](AGENTS.md): instrucciones para los agentes que trabajan en el proyecto.
- [Operación de staging](deploy/staging/README.md): servicios, validación y procedimiento de despliegue.
- [Evidencia de validación](deploy/staging/VALIDACION.md): qué se probó, qué versión se publicó y qué sigue pendiente.

## Qué vive en cada lugar

| Carpeta | Función |
| --- | --- |
| `src/` | Aplicación Next.js donde trabajan las empresas y el equipo de Plataforma. |
| `apps/api/` | API Nest, reglas de negocio, acceso a datos y workers. |
| `apps/marketing/` | Web comercial de Grafoprint, desplegada en Vercel. |
| `apps/api/prisma/migrations/` | Cambios versionados de la base de datos. |
| `deploy/staging/` | Configuración y operación del entorno de pruebas. |

Al 25/09/2026, la web comercial está publicada desde `main`; el SaaS funciona en staging sobre Fly, Neon, Redis y R2. La producción del SaaS todavía no está creada. El PR #2 de infraestructura continúa abierto: revisar esa transición en el manual antes de elegir la base de una tarea.

## Desarrollo y documentación

Antes de iniciar servicios, comprobar rama, cambios pendientes, entorno y puertos siguiendo `AGENTS.md`. El Compose raíz es para desarrollo; el de `deploy/staging` es un ensayo descartable distinto del staging cloud. No usar el seed de desarrollo contra datos que deban conservarse.

El manual editable está en `docs/manual-desarrollo-grafoprint.md`. Para regenerar su PDF, usar Python con ReportLab y ejecutar:

```sh
python3 scripts/docs/generar-manual-desarrollo.py
```

El archivo se genera en `output/pdf/manual-desarrollo-grafoprint.pdf` (excluido de Git). Revisar visualmente sus diez páginas antes de compartir una nueva edición. El generador admite fuentes Arial del sistema o la ruta `--font-dir` con `DejaVuSans.ttf`, `DejaVuSans-Bold.ttf`, `DejaVuSans-Oblique.ttf` y `DejaVuSans-BoldOblique.ttf`.
