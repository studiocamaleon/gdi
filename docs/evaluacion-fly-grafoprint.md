# Fly.io para Grafoprint

Evaluación al 24/09/2026, basada en el repositorio y documentación oficial.
Decisión confirmada por el titular: Vercel para marketing; Fly.io para aplicación
Next.js, API y workers; Neon para PostgreSQL y Cloudflare R2 para archivos.
Se propone São Paulo para Fly y Neon, y Neon Launch para producción; planes,
recursos, Redis y presupuesto siguen pendientes de dimensionamiento y contratación.
No se creó infraestructura. Orden de ejecución:
[despliegue-paso-a-paso.md](despliegue-paso-a-paso.md).

## Por qué encaja

Grafoprint tiene una API Nest, trabajos BullMQ, herramientas Python y
generación de PDF con Gotenberg. Necesita procesos persistentes y recursos
distintos para HTTP y cálculo. Fly ofrece
[grupos de procesos en máquinas separadas](https://fly.io/docs/launch/processes/)
y [región `gru`, São Paulo](https://fly.io/docs/reference/regions/), también
disponible para Managed Postgres. Para usuarios en Argentina, la región es una
ventaja probable de latencia, a medir con la aplicación real. Render no lista
una región sudamericana en su [oferta actual](https://render.com/docs/regions).

## Distribución acordada y componentes complementarios

| Componente | Destino propuesto | Validación pendiente |
| --- | --- | --- |
| Marketing + Grafo3D | Vercel, proyecto independiente | Dominio confirmado: grafoprint.com.ar; revisión operativa de legales y preview pendientes |
| Aplicación Next.js | Fly.io, confirmado; región `gru` propuesta | SSE prolongado, archivos grandes, tiempos y costo |
| API Nest | Fly, proceso HTTP siempre activo | Health check `/api`, CORS, proxy, apagado ordenado y crons |
| Worker general | Máquina aparte con Node y Python | CAD/nesting/cotización/planificación con carga real |
| Worker PDF | Máquina aparte | Cola, reintentos, concurrencia y apagado ordenado |
| Gotenberg | Servicio HTTP privado | Render de PDF, límites y aislamiento de red |
| PostgreSQL | Neon confirmado; Launch en São Paulo propuesto | Migraciones, roles, restauración, conexiones y costo bajo carga |
| Redis para BullMQ | Upstash vía Fly, propuesto; tarifa fija, misma región | Confirmar plan; eviction desactivada, conexiones y límites |
| Archivos | Cloudflare R2, buckets por entorno | URLs firmadas, CORS y ciclo de vida |

La aplicación Next vivirá en Fly y marketing en Vercel. La app podrá compartir
región y red privada con la API. El BFF actual tiene SSE y algunas respuestas
se almacenan completas en memoria: el despliegue debe validar duración y consumo.
Los archivos mediante URLs firmadas evitan atravesar ese BFF.

Mantener API y workers activos. El
[autostop de Fly Proxy](https://fly.io/docs/launch/autostop-autostart/) observa
tráfico HTTP, no el trabajo de BullMQ ni los cron internos. Dimensionar CPU y
memoria con mediciones: la configuración lógica del motor de geometría no
reserva memoria real en el proveedor. No empezar en varias regiones.

## Antecedentes de la elección de PostgreSQL

El titular ya eligió Neon. Se conserva la comparación siguiente como antecedente;
no implica que aún haya que decidir entre estos proveedores para empezar la web.

Preferir administración real de base y recuperación probada. El producto
[Managed Postgres](https://fly.io/docs/mpg/) anuncia backups y alta disponibilidad,
pero su documentación consultada todavía enumera parches de seguridad,
actualizaciones de versión y alertas al cliente entre funciones en desarrollo.
Antes de elegirlo para producción, confirmar con el proveedor el alcance
vigente, quién aplica parches y los tiempos de recuperación. Esta observación
describe lo documentado; no demuestra que las instancias estén sin parches.

No confundirlo con el
[Postgres autogestionado de Fly](https://fly.io/docs/postgres/getting-started/what-you-should-know/),
cuyo mantenimiento recae en nosotros. Si Managed Postgres no cubre las
necesidades, elegir otra base administrada con región cercana y conexión TLS;
eso no obliga a descartar Fly para los procesos de la aplicación.

## Comparación de alternativas administradas

Comparación consultada el 24/09/2026. La web de prelanzamiento no necesita
contratar una base. Los planes finales del sistema se validarán en staging.

### Proveedor elegido: Neon; Launch en São Paulo como plan propuesto

Neon permite elegir [AWS São Paulo, `aws-sa-east-1`](https://neon.com/docs/introduction/regions).
Admite [Prisma, incluido Prisma 6](https://neon.com/docs/guides/prisma), y
[`pg_trgm`](https://neon.com/docs/extensions/pg-extensions), requerido por las
migraciones de Grafoprint. La integración puede conservar Nest, Prisma,
autenticación y R2: se usa la conexión PostgreSQL desde API y workers.

Su documentación de [actualizaciones](https://neon.com/docs/manage/updates)
incluye parches de seguridad y versiones menores, con ventana configurable en
planes pagos y reinicios breves. Los computes con máximo superior a 8 CU tienen
un procedimiento distinto: no reciben esas actualizaciones automáticamente.
Hay que probar reconexión y reintentos de la aplicación durante mantenimiento.

El [precio de Launch](https://neon.com/pricing) es por consumo: USD 0,106 por
CU-hora, USD 0,35 por GB-mes de almacenamiento y USD 0,20 por GB-mes de historial
de restauración; permite una ventana de historial de hasta 7 días. Las
instantáneas tienen su propio cargo. No equivale a recuperación gratuita.

Ejemplo de cálculo, no dimensionamiento del sistema: mantener 0,25 CU durante
730 horas cuesta aproximadamente USD 19,35 de cómputo, antes de almacenamiento,
historial, transferencia facturable, otros servicios e impuestos. Con carga y
autoscaling el importe cambia. Configurar un máximo de cómputo y alertas.
Los crons, workers y el sondeo de eventos de Grafoprint pueden mantener la base
activa: no presupuestar producción suponiendo que duerme casi todo el día.

### Alternativa: Supabase Pro usando sólo PostgreSQL

Tiene [región específica São Paulo, `sa-east-1`](https://supabase.com/docs/guides/platform/regions).
Seleccionarla explícitamente: la región general Americas no equivale a Brasil.
Podemos conservar el sistema actual y conectarlo con Prisma, sin migrar login,
archivos ni lógica a sus otros servicios.

[Pro parte de USD 25 mensuales](https://supabase.com/pricing), con un proyecto
Micro cubierto por el crédito de cómputo y backups diarios conservados 7 días.
Instancias mayores, proyectos adicionales y excesos se cobran aparte. La
[recuperación a un instante concreto](https://supabase.com/docs/guides/platform/backups)
es un adicional de aproximadamente USD 100 mensuales para 7 días de historial,
además del plan y los requisitos de cómputo. Un backup diario por sí solo no
ofrece recuperación de todos los cambios entre dos backups.

Supabase documenta [conexiones directas desde Fly](https://supabase.com/docs/guides/database/connecting-to-postgres).
Elegir conexión directa o pooler de sesión según red y límites, usar TLS con
verificación de certificado y reservar conexión directa para migraciones.
Desactivar la [Data API](https://supabase.com/docs/guides/database/prisma) al
usar exclusivamente Prisma. Conservar roles separados; no copiar privilegios
amplios de un ejemplo de inicio rápido al usuario de ejecución de Grafoprint.

### Alternativa con más infraestructura: Amazon RDS for PostgreSQL

AWS tiene [RDS en São Paulo](https://docs.aws.amazon.com/general/latest/gr/rds-service.html).
Ofrece [backups automatizados y recuperación temporal](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html)
y opciones Multi-AZ. Es una alternativa si se busca controlar más la red y
disponibilidad; introduce configuración de VPC, acceso desde Fly y operación
de AWS. Su [precio](https://aws.amazon.com/rds/postgresql/pricing/) depende de
instancia, almacenamiento, región y disponibilidad; requiere una cotización
concreta. No se presupuestó ni se seleccionó una instancia.

### Prueba necesaria antes de producción

Crear sólo cuando se autorice un entorno de staging, aplicar las migraciones,
configurar `grafo_app` con permisos acotados y conservar `MIGRATE_DATABASE_URL`
para el rol de migración. Ajustar el pool por API y worker, probar carga,
reconexión y restauración. No hace falta actualizar Prisma 6 para evaluar el
proveedor. La compatibilidad documentada no sustituye esta prueba del esquema
y los procesos completos de Grafoprint.

La migración `20260722100000_rol_app_sin_superusuario` supone `postgres` como
migrador al asignar privilegios predeterminados. Neon puede usar otro rol;
resolver el provisionado y ensayarlo desde cero antes de ejecutar el historial.
Si `grafo_app` no existe, la migración omite los GRANT. No trasladar literalmente
los comandos del PostgreSQL Docker local al proveedor ni modificar a ciegas una
migración histórica ya aplicada.

## Colas y costos

Fly recomienda [Upstash con tarifa fija para BullMQ](https://fly.io/docs/upstash/redis/)
por su sondeo frecuente. Mantener eviction desactivada para no descartar claves
de trabajos; vigilar memoria y límites. No tomar una base por comando como
equivalente a un servidor Redis de precio fijo.

Fly exige gestionar imágenes, máquinas, recursos y despliegues. Esa carga
operativa es parte de la elección; no debe asumirse que siempre cuesta menos
que Render. Presupuestar por separado frontend, API, workers, Gotenberg, base,
Redis, almacenamiento, tráfico, backups y staging. Usar los
[precios vigentes de Fly](https://fly.io/docs/about/pricing/) después de medir
consumo y acordar disponibilidad; una sola instancia no aporta alta disponibilidad.

## Preparación posterior, antes del primer staging

1. Construir contenedores reproducibles desde la raíz del repo: API necesita
   `grafo-hotwire-linker-v1`; incluir assets de Nest y las dependencias Python.
   Verificar compatibilidad Linux y los motores de geometría usados.
2. Preparar inventario de variables por proceso. La base usa `DATABASE_URL` y
   `MIGRATE_DATABASE_URL`; esta última está en Prisma y falta en el ejemplo
   actual. Usar roles separados de ejecución y migración.
3. Aplicar migraciones a una base vacía de staging, comprobar `pg_trgm` y
   preparar un bootstrap de administrador y catálogo. **No ejecutar el seed
   de demostración en producción: borra datos.**
4. Probar trabajos generales y PDF con sus colas y R2; después activar el PDF
   asíncrono. Arrancar Gotenberg sólo en red privada. Los archivos temporales
   son descartables; los documentos finales deben persistir fuera de la máquina.
5. Probar login, aislamiento por empresa, eventos con reconexión, cargas y
   descargas, crons, reinicios durante trabajos, backup/restauración y rollback.
6. Dimensionar máquinas y presupuesto, configurar métricas/alertas y recién
   entonces preparar producción. Los manifiestos y estas pruebas siguen pendientes.

La extensión de WhatsApp y QZ Tray dependen del equipo del usuario. Subir el
backend no los convierte en servicios cloud, y tampoco completa la integración
directa con Meta necesaria para el proyecto de Tech Provider.
