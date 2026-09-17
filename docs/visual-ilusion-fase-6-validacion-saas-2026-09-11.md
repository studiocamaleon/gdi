# F6 — Validación de carga, recuperación y rendimiento SaaS

Fecha: 11/09/2026. Rama: `codex/f6-entregas-planificacion`.

**Resultado:** el alcance acordado de Distribuir entregas, reprogramación y
Planificación supera los ensayos funcionales y de carga descritos aquí. Se
corrigieron cuellos de botella del ETA y de recuperación. No se cambiaron
cantidades, tiempos cotizados, calendarios del usuario ni calidad del nesting.

Esta validación complementa el [recorrido integral](visual-ilusion-fase-6-validacion-integral-2026-09-11.md).
Los parámetros actuales son ejemplos de desarrollo; calibrarlos con el taller
real no es un requisito de este cierre funcional.

## 1. Entorno y alcance de la medición

- Apple M3, 8 núcleos, 8 GB de RAM. Servicios y generador de carga locales.
- PostgreSQL real, base exclusiva `gdi_saas_f6_saas_20260911`.
- Redis 7.2.10 independiente en 6391, con persistencia AOF; no se interrumpió el Redis del usuario.
- API real en 3011, autenticación, permisos y límite de solicitudes activos.
  Pool de PostgreSQL de ocho conexiones para la API del ensayo.
- 20 empresas, 200 cuentas: 19 colas de 100 operaciones y una de 1.000.
  Rutas con precedencias, estaciones manuales, máquinas, equipos compartidos y jornadas partidas.
- Gantt probado en navegador con 1.000 operaciones, tanto en desarrollo como
  con el build de producción de Next.js 16.1.6/Turbopack.
- Cron y notificaciones externas deshabilitados exclusivamente en la API QA.

Son mediciones locales reproducibles, no una certificación de infraestructura
cloud, latencia de internet o 200 nestings geométricos simultáneos. El rendimiento
medido del motor corresponde a **planificar operaciones**, no a resolver un nuevo
nesting irregular. La carga de propuestas usa cotizaciones controladas para
separar la coordinación del costo variable del solver geométrico.

## 2. Optimización del ETA sin cambiar decisiones

Se eliminaron conversiones de fecha repetidas, preparación repetida de la misma
operación y cálculos equivalentes de disponibilidad dentro de una decisión.
Las reutilizaciones se invalidan al reservar capacidad. Los casos con agenda
publicada conservan el tratamiento específico de sus reservas.

Las cachés de fechas están limitadas a 16.384 entradas y guardan funciones puras
por instante/zona. Devuelven copias, no objetos mutables compartidos. No almacenan
configuración ni información comercial de una empresa.

Mediana de tres ejecuciones, en milisegundos:

| Operaciones | Antes | Después | Presupuesto local de aceptación |
|---:|---:|---:|---:|
| 100 | 735,96 | 36,55 | < 100 |
| 500 | 24.233,24 | 188,10 | < 500 |
| 1.000 | Sin medición completa de referencia | 585,52 | < 1.200 |
| 2.500 | Sin medición completa de referencia | 2.983,22 | < 4.500 |
| 5.000 | Sin medición completa de referencia | 11.393,19 | < 15.000 |

El caso de 500 operaciones mejora aproximadamente 129 veces. Es una medición
sobre este escenario, no un factor garantizado para cualquier taller.

**Calidad:** 83 escenarios comparados contra la fuente anterior con igualdad
completa de resultados, fechas, reservas y traza. Incluyen calendarios,
prioridades, capacidad compartida y agendas publicadas. Las corridas grandes
verifican precedencias, ausencia de solapamiento de máquinas y ausencia de
sobreasignación humana. Las pruebas de zonas contrastan cinco zonas y 370 días
contra `Intl`, incluidas transiciones de horario estacional.

## 3. Lecturas concurrentes y cálculos pesados

| Ensayo HTTP | Solicitudes | Concurrencia | p95 | Errores inesperados |
|---|---:|---:|---:|---:|
| Contexto ETA | 600 | 20 | 228 ms | 0 |
| Contexto ETA | 600 | 50 | 367 ms | 0 |
| Contexto ETA | 600 | 100 | 633 ms | 0 |
| Contexto ETA | 600 | 200 | 1.261 ms | 0 |
| Tablero | 200 | 100 | 998 ms | 0 |

Además, 200 intentos de consultar planes de otra empresa fueron rechazados.
El presupuesto local fue p95 menor a dos segundos. Las respuestas de este
harness se midieron sin la compresión HTTP que configura el arranque habitual.

La búsqueda de reprogramaciones ahora corre en threads separados del hilo HTTP:

- Dos cálculos activos y hasta ocho en espera por proceso API.
- Una búsqueda por empresa en ese proceso; no puede ocupar varias plazas.
- Espera máxima de 15 segundos y ejecución máxima de 45 segundos.
- Cada thread tiene un límite de heap de 256 MB; no equivale a un límite de
  memoria total del proceso o del contenedor.
- Saturación o interrupción producen un error recuperable. La distribución
  previamente guardada se conserva y no se mueven trabajos.
- Al publicar, se vuelven a verificar versión, cotización y contexto de cola.
  También se bloquea la configuración del equipo compartido durante la transacción.

**Ensayo mixto:** 13 solicitudes de cálculo para 12 empresas, incluida una
repetida. Diez completaron; tres recibieron el rechazo esperado por cupo o
repetición. Mientras se calculaba, 400 lecturas HTTP respondieron con p95 de
**186 ms** y máximo de 380 ms. El ensayo usa un endpoint de carga exclusivo del
script QA; ese endpoint no existe en el producto. Ejecuta el mismo componente
de cálculo y conserva los guards reales.

Los límites de threads son por proceso. La concurrencia de los workers de
propuestas por empresa sigue coordinada entre procesos mediante Redis.
La búsqueda asistida conserva sus límites: 2.500 operaciones pendientes,
24 órdenes candidatas y diez segundos de exploración entre simulaciones.
No promete un óptimo global ni una búsqueda exhaustiva de todas las agendas.

## 4. Gantt y actualización de resultados

Con más de 200 operaciones, el mismo motor se ejecuta en un Web Worker. El
render inicial muestra que está calculando; no presenta cero operaciones o
fechas ficticias. Una actualización mantiene juntos los datos y resultados de
la última consulta completa. Un cambio de entrada cancela el worker anterior;
los resultados tardíos no reemplazan la consulta vigente. Un error permite
volver a actualizar.

En navegador se verificaron 1.000/1.000 operaciones, filtro por OT, zoom, ambas
agrupaciones, selección, detalle y dependencias. Los tiempos de operario y
operación autónoma se conservan. Se verificó el worker emitido en el build de
producción, además del servidor de desarrollo.

## 5. Recuperación con fallos reales

| Interrupción | Comprobación | Resultado |
|---|---|---|
| Worker terminado con `SIGKILL` durante una cotización | Retoma de la solicitud persistida sin borrar su lease | LISTA en 94,95 s; una fuente y cuatro entregas, sin publicación de pasos |
| Redis detenido al encolar | La solicitud queda en PostgreSQL; reinicio del Redis con AOF y nuevo despacho | LISTA, sin duplicados |
| PostgreSQL desconectado tras insertar el primer lote, antes del COMMIT | No se observa ninguna escritura parcial; reintento de publicación | Cero lotes/pasos tras el fallo; luego cuatro lotes, 16 pasos y 12 dependencias |
| Worker que continúa después de vencer su revisión | El token de ejecución impide que publique o renueve la revisión ajena | Cubierto con prueba de integración |
| Cambio de dotación durante publicación | El bloqueo de EquipoProduccion impide una agenda basada en capacidad que cambia a mitad de guardar | Cubierto con PostgreSQL real |

La lease de un cálculo se redujo de diez minutos a **90 segundos**, renovada
cada 30 segundos. Un pulso en PostgreSQL permite distinguir un cálculo largo
vivo de uno abandonado. Dos minutos sin pulso dejan la revisión fallida y
reintentable; esto no reduce los 45 minutos de presupuesto del cálculo.

La primera exploración detectó la lease antigua de diez minutos. Se liberó
manualmente únicamente esa lease de QA para continuar el diagnóstico. La corrida
final de 94,95 segundos **no** usa esa intervención: el script exige una lease
menor o igual a 90 segundos y espera su recuperación natural.

**Cola concurrente:** cuatro procesos worker completaron 20 propuestas de 20
empresas en 16,26 segundos; la primera quedó lista a los 2,43 segundos. Se
verificaron 80 solicitudes de entrega, 20 fuentes por cantidad/revisión y ningún
paso publicado durante el cálculo. Este ensayo prueba coordinación, persistencia
y aislamiento; sus cotizaciones son controladas y no mide 20 nestings nuevos.

## 6. Regresión, tipado y compilación

| Comprobación | Resultado |
|---|---|
| API completa | 2.654 aprobadas; diez snapshots; 12 optativas omitidas en esa ejecución |
| Ejecución optativa separada | 13 aprobadas: incluye las 12 omitidas y una prueba de geometría ya contada |
| Interfaz | 891 aprobadas |
| Procesos Python | 31 aprobadas |
| Total único automatizado | **3.588 aprobadas** |
| Paridad adicional del scheduler | 83 escenarios con igualdad completa |
| TypeScript de producción API | Aprobado |
| TypeScript de F6, ETA y estaciones/equipos relacionados | Aprobado, incluyendo sus pruebas |
| Build web de producción y su TypeScript | Aprobado |
| Lint focalizado, CSS guard y diff check | Aprobados |
| Presupuestos locales sobre la evidencia | Aprobados |

**Chequeo global de tipos de todas las pruebas de la API:** sigue informando
98 diagnósticos en 40 archivos anteriores, fuera de la selección de F6 validada.
Son contratos desactualizados de fixtures y mocks. Se corrigieron los casos
relacionados con planificación y estaciones; no se silenciaron errores ni se
excluyeron archivos del chequeo general. Este chequeo global **no está aprobado**,
aunque el build del producto y todas las suites ejecutadas sí pasan. Su limpieza
es una deuda de la batería general y no debe confundirse con un fallo del ETA.

## 7. Evidencia y reproducción

Carpeta: `output/f6-saas-2026-09-11/`. Contiene métricas JSON, logs, perfiles CPU
y la captura de la fuente anterior usada para comparar el scheduler.

Scripts bajo `apps/api/test/benchmarks/`:

- `f6-saas-motor.cjs`: medición e invariantes del motor, sin servicios externos.
- `f6-saas-paridad.cjs`: comparación con la fuente anterior indicada como argumento.
- `f6-saas-seed.cjs` y `f6-saas-api.cjs`: entorno aislado, cuentas y API de carga.
- `f6-saas-http.cjs`: sesiones, lecturas y aislamiento entre empresas.
- `f6-saas-cpu-http.cjs`: cálculo concurrente, presión de cola y continuidad HTTP.
- `f6-saas-recovery.cjs`: caída del worker/Redis; modo `carga` para 20 propuestas.
- `f6-saas-publicacion.cjs`: interrupción de la transacción PostgreSQL y reintento.
- `f6-saas-verificar.cjs`: exige los presupuestos sobre una corrida completa.

Los scripts que modifican datos exigen la base exclusiva de este ensayo.
Las pruebas de recuperación requieren el Redis local 6391 y las rutas del
servidor/cliente Redis indicadas en el script; no deben apuntarse a servicios de
usuarios. No se versionan credenciales ni se envían mensajes externos.

Al finalizar se detuvieron la API 3011, la web 3012 y Redis 6391 de QA, y se
cerró su pestaña. Se conserva la base de pruebas y la evidencia. API y worker de
desarrollo quedaron reiniciados con el build validado, sin modificar el servidor
web del usuario. Persiste la limitación de control de Docker/Redis QA 6387 del
informe anterior; no se reinició Docker ni se tocaron sus otros servicios.

El alcance cuantitativo postergado por el usuario —buenas/rechazadas, transferencias,
genealogía y despachos con saldos— sigue postergado. Esta validación tampoco
implementa F5 ni completa F11. Para fijar capacidad y SLO contractuales del SaaS
resta repetir la carga sobre el despliegue elegido y observar tráfico real.
