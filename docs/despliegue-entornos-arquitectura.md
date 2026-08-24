# Despliegue y entornos de Grafo SaaS

Estado: propuesta de arquitectura, 2026-08-24. Este documento no implica que
la infraestructura ya exista. Describe cómo llevar el repositorio actual desde
el desarrollo local a staging y producción sin cambiar su arquitectura de
negocio.

## Objetivo

Mantener tres entornos aislados:

1. **Local**: desarrollo rápido en la computadora, sin servicios pagos
   obligatorios.
2. **DEV / staging**: una instalación real, estable y persistente para QA,
   demostraciones e integraciones en sandbox/homologación.
3. **Producción**: alta disponibilidad, backups, observabilidad y despliegues
   controlados.

La arquitectura recomendada conserva el monolito modular. No hace falta dividir
los dominios de Administración, Producción, Comercial o Inventario en
microservicios. La única separación prevista es el procesamiento intensivo de
CPU —principalmente nesting vectorial— cuando la concurrencia lo justifique.

## Arquitectura actual

```text
Navegador
   │
   ▼
Next.js 16 / React 19
Frontend + Server Components + BFF /api/backend
   │  adjunta el JWT leído desde una cookie httpOnly
   ▼
NestJS 11 / Node.js
API modular + motor universal + integraciones + crons
   ├── PostgreSQL 16 mediante Prisma 6
   ├── Cloudflare R2 en producción / disco local en desarrollo
   ├── @grafo/hotwire-linker para SVG → TAP
   └── ARCA/AFIP, Paddle, WATI/Meta y MCP
```

El navegador usa el BFF de Next y no conoce el JWT. Los archivos grandes se
suben y descargan directamente contra URLs firmadas del storage, sin atravesar
completos por Next o Nest.

El repositorio contiene tres unidades construibles:

- raíz: frontend Next.js;
- `apps/api`: API NestJS y schema/migraciones Prisma;
- `grafo-hotwire-linker-v1`: paquete TypeScript local consumido por el API.

No es todavía un workspace formal de npm/Turborepo/Nx. Al contener una
dependencia `file:`, la imagen del API debe construirse con el repositorio como
contexto y compilar primero el paquete hotwire.

## Topología recomendada

Para usuarios mayoritariamente argentinos, la API y PostgreSQL deben convivir
en São Paulo. La distancia entre esas dos piezas perjudica cada consulta del
sistema y no se compensa con una CDN.

| Pieza                    | Servicio recomendado          | Ubicación                     |
| ------------------------ | ----------------------------- | ----------------------------- |
| DNS, TLS y WAF           | Cloudflare                    | red global                    |
| Frontend Next.js         | Vercel Pro                    | funciones `gru1`, São Paulo   |
| API NestJS               | AWS ECS Fargate detrás de ALB | `sa-east-1`, São Paulo        |
| Base de datos            | AWS RDS PostgreSQL            | misma región y VPC que el API |
| Pool administrado futuro | AWS RDS Proxy                 | misma VPC                     |
| Archivos                 | Cloudflare R2, bucket privado | red de Cloudflare             |
| Cola/caché futura        | AWS ElastiCache Redis         | misma VPC                     |
| Secretos del API         | AWS Secrets Manager           | por entorno                   |
| Logs y métricas          | CloudWatch + Sentry           | por entorno                   |
| Automatización           | GitHub Actions                | environments separados        |

### Por qué esta distribución

- Vercel es la ruta de menor fricción y mejor soporte para App Router, Server
  Components, Route Handlers y el BFF de Next. Las funciones deben fijarse en
  `gru1`; dejarlas en la región predeterminada de Estados Unidos agregaría una
  ida y vuelta innecesaria hasta el API de São Paulo.
- Nest permanece como proceso Node persistente. Tiene crons, cálculos
  geométricos, generación de archivos y caches en memoria; no conviene
  fragmentarlo inicialmente en funciones serverless.
- RDS PostgreSQL encaja directamente con Prisma, transacciones y el modelo
  relacional actual. Aurora no es un requisito inicial.
- R2 ya está implementado y evita que archivos de clientes dependan del disco
  efímero de un contenedor.

Una alternativa de menor complejidad operativa es desplegar API y PostgreSQL en
Render, Fly.io o Railway, siempre en la misma región. Es válida para una primera
salida, pero AWS en São Paulo ofrece más control para alta disponibilidad y
crecimiento.

## Entorno local

```text
http://localhost:3000  Next.js
http://localhost:3001  NestJS
localhost:5436         PostgreSQL 16 en Docker
apps/api/.storage      archivos locales
```

Características:

- `NODE_ENV=development`;
- PostgreSQL levantado con `docker compose`;
- driver local de archivos;
- Paddle sandbox;
- ARCA/AFIP en homologación;
- tokens de Meta/WATI de prueba o integración desactivada;
- seeds reproducibles para datos de demostración;
- Redis local en Docker sólo cuando se implemente la cola de workers.

El desarrollo local debe continuar funcionando aunque R2, Redis y proveedores
externos no estén configurados.

## Entorno DEV / staging

Dominios sugeridos:

```text
dev.grafo.app
api-dev.grafo.app
```

Recursos totalmente independientes:

- proyecto Vercel de staging;
- servicio ECS de staging con una réplica;
- base PostgreSQL exclusiva de staging;
- bucket R2 exclusivo;
- secretos exclusivos;
- Paddle sandbox;
- ARCA/AFIP homologación;
- webhooks con URLs de staging;
- dataset de QA sin información productiva.

Staging no debe compartir la base, un schema, el bucket ni credenciales con
producción. Debe poder resetearse sin riesgo para clientes reales.

## Entorno de producción

Dominios sugeridos:

```text
app.grafo.app
api.grafo.app
```

Configuración inicial recomendada:

- frontend Vercel en `gru1`;
- ALB con TLS y health checks;
- dos tareas ECS como mínimo, en zonas de disponibilidad diferentes;
- autoscaling del API por CPU, memoria y latencia;
- RDS PostgreSQL Multi-AZ;
- backups automáticos y recuperación a un punto en el tiempo;
- bucket R2 privado con CORS limitado al frontend productivo;
- logs JSON centralizados;
- alertas de errores, latencia, disponibilidad, base y crons;
- integraciones productivas de Paddle, ARCA y mensajería;
- `TRUST_PROXY` configurado según la cadena real de proxies;
- usuario PostgreSQL de runtime sin superusuario ni DDL;
- usuario distinto para migraciones.

## Configuración por ambiente

Cada entorno debe mantener su propio juego de variables. Como mínimo:

- `NODE_ENV`;
- `FRONTEND_URL`, `API_URL` y URL pública del API;
- `DATABASE_URL` de runtime;
- `MIGRATE_DATABASE_URL` con permisos DDL;
- `JWT_SECRET` distinto por entorno;
- `TRUST_PROXY`;
- credenciales y bucket R2;
- clave de cifrado de integraciones;
- credenciales y ambiente de Paddle;
- credenciales y ambiente de ARCA/AFIP;
- credenciales de Meta/WATI;
- límites de body y archivos;
- nivel de logging.

Debe existir validación tipada al iniciar. Producción tiene que fallar de forma
explícita si falta un secreto obligatorio, en lugar de arrancar parcialmente.

## Contenedores y artefactos

Faltan Dockerfiles reproducibles para frontend y API. La implementación debe:

1. fijar una versión de Node compatible (20 o superior);
2. instalar con `npm ci` usando los lockfiles;
3. compilar `grafo-hotwire-linker-v1` antes del API;
4. ejecutar `prisma generate`;
5. producir imágenes multi-stage sin dependencias de desarrollo;
6. ejecutar con un usuario sin privilegios;
7. incluir solamente artefactos necesarios;
8. etiquetar las imágenes con commit SHA y versión;
9. permitir rollback al artefacto anterior.

Las migraciones no deben ejecutarse al arrancar cada réplica. Se lanzan una sola
vez como tarea previa al despliegue mediante `prisma migrate deploy` y
`MIGRATE_DATABASE_URL`.

## CI/CD propuesto

```text
feature/cambio
   │
   ├── Pull request: lint + tests + builds + preview frontend
   │
develop
   └── deploy automático a staging + migraciones staging + smoke tests

main
   └── aprobación manual
       ├── backup/snapshot cuando corresponda
       ├── migraciones producción, una sola vez
       ├── despliegue API rolling
       ├── despliegue frontend
       └── smoke tests y monitoreo
```

Checks mínimos:

- lint frontend/API;
- pruebas frontend;
- pruebas API;
- pruebas y build de hotwire;
- build Next;
- build Nest;
- comprobación de migraciones;
- análisis de vulnerabilidades de dependencias e imagen;
- smoke test del health endpoint y autenticación;
- validación de que frontend y API corresponden a la misma versión compatible.

Los secretos se asocian a GitHub Environments `staging` y `production`.
Producción requiere aprobación y sólo acepta la rama protegida.

## Salud, apagado y observabilidad

El API ya expone un health check que consulta PostgreSQL. Antes de producción
conviene separarlo en:

- **liveness**: el proceso sigue vivo;
- **readiness**: puede atender y llegar a PostgreSQL;
- chequeos secundarios visibles en observabilidad, sin sacar una réplica por la
  caída de un proveedor externo.

También falta habilitar graceful shutdown para que ECS retire una tarea sin
cortar peticiones o transacciones en curso.

Métricas mínimas:

- requests por endpoint, estado y tenant anonimizado;
- p50, p95 y p99 de latencia;
- errores 4xx/5xx;
- CPU, memoria y reinicios del API;
- conexiones, CPU, almacenamiento y consultas lentas de PostgreSQL;
- fallos y duración de crons;
- tamaño y errores de R2;
- duración, complejidad y tasa de caché de cada algoritmo de nesting;
- cotizaciones exitosas/fallidas sin registrar precios ni datos sensibles en
  los logs.

## Escalado del motor de precios y nesting

El costeo normal y los nestings rectangulares pueden continuar dentro del API.
El nesting vectorial irregular es CPU-bound y hoy corre de manera sincrónica en
el hilo principal de Node. Varias solicitudes complejas simultáneas pueden
degradar las demás pantallas aunque existan muchos tenants con poca actividad.

La evolución prevista es:

```text
API web
  ├── cotización y nesting simple → respuesta inmediata
  └── nesting pesado → Redis/BullMQ → workers de geometría
                                      ├── resultado/caché
                                      └── SVG, TAP y exportaciones a R2
```

Principios de esa implementación futura:

- worker separado y escalable independientemente;
- caché compartida por hash del SVG, medidas, sustrato, márgenes, encastres,
  cantidad y versión de algoritmo;
- resultado definitivo persistido/snapshoteado en cotización y OT;
- límites de concurrencia globales y por tenant;
- cola justa para que un tenant no monopolice la CPU;
- estados `pendiente`, `procesando`, `completado`, `fallido` y `cancelado`;
- cancelación de trabajos obsoletos cuando el usuario cambia los parámetros;
- timeout, reintentos controlados e idempotencia;
- progreso visible en la interfaz;
- modo directo local para no exigir infraestructura externa al desarrollar;
- benchmarks antes y después, separados por nesting simple y vectorial.

La caché vectorial actual es local por réplica, conserva hasta 100 entradas por
15 minutos y está aislada por tenant. Es útil para el flujo inmediato, pero no
reemplaza Redis ni una cola distribuida.

## Base de datos y recuperación

- RDS de staging y producción separados.
- Backups automáticos de producción con retención definida.
- Snapshots previos a migraciones de riesgo.
- Restauración ensayada periódicamente en una base aislada.
- Métricas y alarmas por almacenamiento, conexiones, CPU y réplica.
- RDS Proxy o PgBouncer cuando el número de réplicas/conexiones lo justifique.
- Réplicas de lectura sólo cuando reportes o analítica muestren una necesidad
  medida.
- Evaluar rollups/materialización para analítica cross-tenant antes de que sus
  scans crezcan con todo el histórico.

## Archivos y retención

- un bucket R2 por entorno;
- nunca reutilizar claves productivas en staging;
- credenciales limitadas al bucket correspondiente;
- CORS explícito por dominio;
- lifecycle para archivos temporales y multipart abandonados;
- política de retención/borrado coherente con el contrato comercial;
- inventario y restauración probada de metadatos; un objeto sin su fila de base
  o una fila sin su objeto deben detectarse;
- no servir SVG de clientes inline cuando pueda ejecutar contenido activo.

## Estado de preparación actual

| Área                                 | Estado                                        |
| ------------------------------------ | --------------------------------------------- |
| Separación frontend/API              | preparada                                     |
| PostgreSQL y migraciones             | preparada en aplicación                       |
| Multi-tenant                         | preparada, requiere configuración DB correcta |
| Storage R2                           | implementado                                  |
| Health básico                        | implementado                                  |
| Logging estructurado                 | implementado                                  |
| Crons con coordinación multi-réplica | implementado                                  |
| Dockerfiles                          | pendiente                                     |
| CI/CD                                | pendiente                                     |
| Infraestructura como código          | pendiente                                     |
| Validación integral de variables     | parcial                                       |
| Observabilidad centralizada          | parcial                                       |
| Backups/restauración operados        | pendiente                                     |
| Graceful shutdown                    | pendiente                                     |
| Workers/cola de nesting              | pendiente                                     |
| Pruebas de carga                     | pendiente                                     |

## Orden recomendado de implementación

1. Normalizar variables y documentación de secretos.
2. Dockerfiles y builds reproducibles.
3. CI con todos los checks.
4. Staging completo y aislado.
5. Observabilidad, readiness y graceful shutdown.
6. Pipeline de migraciones y estrategia de rollback.
7. Producción con RDS Multi-AZ, dos réplicas API y R2.
8. Pruebas de carga con tráfico representativo.
9. Extraer nesting pesado a workers cuando las mediciones definan umbrales.
10. Ajustar autoscaling, pooling y rollups según métricas reales.

La arquitectura objetivo no exige una reescritura: formaliza el empaquetado,
los entornos y la operación de las piezas que ya existen.
