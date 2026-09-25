# Cómo trabajar en Grafoprint

## Comunicación y alcance

- Responder y hacer preguntas en español. Lucas hace vibecoding: explicar resultado, impacto y próximo paso en lenguaje sencillo.
- Leer este archivo y las instrucciones más específicas del área antes de modificarla. La guía humana está en `docs/manual-desarrollo-grafoprint.md`.
- Resolver la tarea autorizada completa, con cambios acotados. No convertir una corrección en una refactorización o actualización general de dependencias.
- Avanzar con tareas locales reversibles. Respetar las autorizaciones explícitas de la conversación y no pedirlas otra vez; pedir información sólo cuando falte una decisión necesaria.
- No activar cobros, enviar mensajes a clientes, publicar producción, modificar accesos sensibles ni contratar/ampliar recursos sin autorización aplicable. Preparar primero un resultado concreto y revisable.

## Mapa del proyecto

- `src/`: aplicación de trabajo Next.js. `apps/marketing/`: web comercial independiente en Vercel.
- `apps/api/`: API Nest, datos, reglas de negocio y procesos de fondo.
- `apps/api/src/workers/`: cálculos/geometría y otros trabajos en cola. `apps/api/src/documentos-pdf/`: documentos y worker PDF. Gotenberg es el servicio privado que renderiza PDF.
- `apps/api/prisma/migrations/`: historial de cambios de PostgreSQL. `grafo-hotwire-linker-v1/`: biblioteca compartida de geometría; revisar consumidores antes de cambiarla.
- `deploy/staging/`: operación de staging. Leer `README.md` y la evidencia más reciente de `VALIDACION.md` antes de desplegar. Ante una diferencia entre notas antiguas y estado real, verificar y actualizar la documentación.

## Ramas y trabajo en equipo

- Antes de editar, comprobar rama, estado de Git y cambios ajenos. No descartar trabajo del usuario ni de otro agente.
- Una tarea independiente por rama `codex/<descripcion>`. No desarrollar directamente en `main` ni reutilizar ramas de tareas ya integradas.
- Transición actual: el PR #2 de `codex/staging-infraestructura` a `main` sigue abierto. Hasta consolidarlo, los cambios que dependan de esa infraestructura parten de esa rama y documentan su dependencia; su PR puede apuntar a esa base. No fusionar el PR #2 como efecto secundario de otra tarea.
- Después de integrar esa base, partir normalmente de `main` actualizado. Si una tarea depende de otra rama, explicitar base, orden de integración y qué debe volver a probarse.
- Para tareas simultáneas, usar checkouts o worktrees independientes, con puertos y datos de desarrollo separados cuando haga falta. Un worktree sólo separa archivos de trabajo; no crea otra base, Redis ni nube.
- Commits pequeños con propósito claro; PR por cambio coherente. Describir problema, comportamiento final, pruebas y efecto sobre datos. Un PR en borrador sirve para trabajo incompleto; nunca equivale a autorización de despliegue.
- No hacer force push en ramas compartidas, borrar ramas ajenas ni resolver conflictos descartando lógica sin revisarla. Probar otra vez las partes afectadas al integrar conflictos.
- No iniciar trabajo paralelo de subagentes por iniciativa propia; hacerlo sólo cuando la tarea o instrucciones aplicables lo pidan.

## Datos y aislamiento

- Confirmar entorno y base de destino antes de una operación de datos. Local, staging y producción usan recursos y secretos distintos.
- Staging usa datos ficticios. No copiar datos de clientes reales para probar sin un procedimiento autorizado de anonimización y acceso.
- Toda operación de empresa debe validar su pertenencia, permisos y plan desde la API. Una empresa de prueba es un tenant, no otro entorno aislado. Verificar que un cambio no exponga información entre empresas.
- Crear migraciones nuevas; no reescribir migraciones aplicadas. Ensayarlas en una base descartable y mantener compatibilidad con la versión anterior cuando se despliegan antes del código.
- El seed de desarrollo `apps/api/prisma/seed.js` elimina datos: no ejecutarlo en staging ni producción. Tampoco ejecutar `migrate reset`, borrados masivos o `docker compose down -v` sobre datos que deban conservarse.
- En cloud usar el procedimiento de `apps/api/scripts/deploy/migrate.cjs`, con destino explícito y credencial de migrador separada. `verify-database.cjs` es un ensayo destructible exclusivo de bases `_test`, no de Neon staging persistente.
- Git guarda código, no respalda Neon, R2 ni Redis. Revertir una imagen no revierte datos o migraciones; decidir la recuperación según el cambio y conservar evidencia.

## Secretos y proveedores

- No poner claves, tokens, conexiones completas, enlaces privados de invitación ni datos de tarjetas en Git, capturas, logs, PR o manuales. Usar plantillas sin valores y almacenes de secretos.
- Los accesos de esta Mac a staging están fuera de Git en `~/.config/grafoprint/staging`; no imprimir sus valores. No copiar ese directorio a otro entorno o colaborador como mecanismo de onboarding.
- La aplicación usa un rol limitado de PostgreSQL. No dar a API/workers la credencial de migración. R2 permanece privado; los permisos y URLs temporales deben estar limitados al uso previsto.
- Respetar el acceso privado de staging, HTTPS, permisos y MFA. No desactivar protecciones para hacer pasar una prueba. Preparar un acceso autorizado cuando un control impida el ensayo.

## Desarrollo y validación

- Comprobar scripts y versiones existentes antes de ejecutar comandos. El despliegue está validado con Node 24; conservar los archivos de bloqueo y usar `npm ci` donde corresponda.
- Reutilizar componentes y estilos del proyecto. Para UI, revisar en navegador el recorrido que cambió; no dar por corregida una pantalla sólo por aprobar TypeScript.
- Probar comportamiento relevante: caso normal, error, permisos y separación entre empresas cuando estén afectados. Para UI simple, priorizar comprobación visual; no escribir pruebas que sólo repitan clases CSS o implementación.
- Ejecutar las pruebas y chequeos de tipos/lint adecuados. El script lint de API aplica `--fix`: revisar su alcance y evitar cambios ajenos. Una compilación aprobada no prueba todos los recorridos del producto.
- En esta Mac hay 8 GB de RAM y Docker tiene 4 GB compartidos. No reiniciar Docker, aumentar memoria ni detener contenedores de otros proyectos sin autorización. No compilar la web de producción localmente; usar el proceso remoto validado.
- Desarrollo local y ensayo de contenedores son distintos. El Compose raíz sirve a desarrollo; `deploy/staging/compose.yaml` es un ensayo aislado, usado también por CI.
- El PostgreSQL del Compose raíz se publica en 5436. Marketing y Gotenberg local usan 3002 por defecto: verificar puertos y elegir uno libre para marketing, sin detener servicios ajenos. No suponer que cambiar de rama cambia una base de datos.

## Staging y producción

- Estado de referencia al 25/09/2026: marketing publicado desde `main`; SaaS sólo en staging. Fly tiene cinco apps en `gru`; Neon, Redis y R2 son recursos de staging. La etiqueta `production` de una rama de Neon no convierte ese proyecto en producción del SaaS.
- El workflow actual de GitHub se dispara por ciertos archivos en `codex/staging-infraestructura`. Declara `workflow_dispatch`, pero aún no está en `main`: verificar la disponibilidad de ejecución manual y que la corrida realmente se inicie para la rama elegida. No hay validación general automática de PR ni despliegue automático a Fly. Antes de confiar en un resultado, comprobar que corresponda al commit y tarea reales.
- Documentar exactamente la revisión probada. Para desplegar, partir de código registrado y un checkout limpio; compilar remotamente los servicios afectados, registrar imágenes/digests y ensayar migraciones antes de aplicarlas al destino correcto.
- Desplegar migraciones compatibles una sola vez; después API/workers con la misma imagen backend cuando se actualizan juntos, y web. Gotenberg sólo se actualiza si la tarea lo requiere. Verificar salud y recorrido real, y registrar el resultado en `VALIDACION.md`.
- Staging es compartido: coordinar quién despliega y qué versión se prueba. No reemplazar una versión en ensayo sin avisar. No usar una preview de marketing como prueba del SaaS completo.
- Mantener recursos y presupuesto autorizados. La previsión de USD 150/mes de staging no es un tope automático. Consultar antes de aumentar tamaños o contratar extras. Retirar únicamente el builder temporal identificado de la operación cuando deje de ser necesario.
- Producción del SaaS aún no está creada. No inventar manifiestos, secretos, automatizaciones o protecciones ya activas. Configurar y validar recursos separados, restauración, seguimiento de errores y aprobación de publicación antes de abrirla.
- `main` marca integración; la versión publicada del SaaS debe registrarse aparte. Fusionar a `main` puede publicar la web comercial en Vercel: revisar su impacto y preview antes de integrar.
- Esta guía no configura protecciones de GitHub. La API de GitHub marcaba `main` como no protegida al redactarla; generalizar CI y exigir PR/revisión son pasos pendientes, no garantías existentes.

## Entrega

- Explicar en español qué cambió, por qué, cómo se comprobó y qué queda pendiente. Diferenciar archivos preparados, cambios subidos a GitHub y versión desplegada.
- Identificar entorno, revisión e imágenes sólo cuando ayuden a operar o revisar. Entregar enlaces útiles sin secretos.
- Actualizar el manual y los documentos operativos cuando cambien arquitectura, dominios, flujo de ramas, validación o despliegue. Conservar editables y PDF sincronizados al regenerarlo.
