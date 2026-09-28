# Redis y presupuesto inicial de staging

Relevamiento del **24 de septiembre de 2026**, en USD, antes de impuestos, conversión de moneda y cargos del medio de pago. Lucas autorizó activar staging con las cinco máquinas Fly, Neon Launch a 0,25 CU y una previsión total de USD 150/mes, incluido Redis, excluidos Vercel e impuestos, más hasta USD 5 de preparación inicial. Las cinco máquinas y Launch ya están activos; R2 y Redis están configurados. Las cifras siguientes son estimaciones, no la factura emitida ni un límite automático. No se cambió producción.

## Propuesta

Usar **Redis Cloud Essentials, RAM de 1 GB total, AWS São Paulo (`sa-east-1`), con réplica en la misma zona y AOF cada segundo: USD 36/mes**, según el formulario de contratación. La memoria se divide en **512 MB para datos y 512 MB para réplica**; no hay 1 GB útil para las colas. Esta cotización sustituye los USD 33 del calculador público consultado inicialmente. TLS y política **no eviction** ya están configurados. Es un servicio administrado; la réplica en la misma zona no protege contra la caída de toda esa zona. El tamaño permite iniciar pruebas controladas, pero su suficiencia aún no está validada con carga real.

Mantener Fly para los cinco servicios, Neon Launch PostgreSQL 16 a 0,25 CU iniciales y R2 Standard privado con jurisdicción US. Reservar **USD 150/mes adicionales a la factura actual de Vercel** para el escenario de pruebas descrito abajo. Es una previsión, no un límite automático de facturación ni una garantía de capacidad.

## Qué necesita el código actual

- BullMQ usa colas de geometría normal e intensiva, cotizaciones y documentos; necesita conexiones Redis persistentes, comandos bloqueantes y scripts Lua. Una API HTTP de caché no sustituye esta conexión. Ver [redis.ts](../../apps/api/src/workers/redis.ts).
- El worker PDF despacha cada dos segundos y consulta PostgreSQL aunque no haya documentos. También consulta Redis. La salud de API consulta PostgreSQL cada 30 segundos. Presupuestamos Neon activo mientras esos procesos funcionen; quitar sólo el health check no permite dormir la base. Ver [documentos-pdf.worker.ts](../../apps/api/src/documentos-pdf/documentos-pdf.worker.ts).
- Los jobs guardan entradas y resultados completos. Geometría admite hasta 10.000 copias y 250.000 puntos de entrada; retiene hasta 1.000 trabajos completados y 5.000 fallidos por cola, con límites de edad. Estas cantidades no son límites en bytes. Ver [validación de geometría](../../apps/api/src/workers/geometria/validar-nesting-opennest.ts) y [productor de trabajos](../../apps/api/src/workers/geometria/geometria-jobs.service.ts).
- Medición sintética realizada sin ejecutar el motor: un contorno de 1.000 puntos y 400 copias pasa el validador de entrada (46.673 bytes); serializar 400 placements con ese contorno da **18.590.596 bytes**. Mide el formato, no latencia, un cálculo real ni consumo Redis. El worker devuelve el resultado completo y el proceso Python admite hasta 32 MiB de salida. Por eso no podemos asegurar que cada escritura de BullMQ quede debajo de 10 MB.
- Antes de cargar trabajos grandes, medir datos/resultados, memoria retenida y tráfico. Un resultado también puede aparecer en el stream de eventos de BullMQ: no calcular memoria sólo con el tamaño del JSON. Revisar retención y, si hace falta, guardar resultados grandes en PostgreSQL/R2 y pasar referencias por Redis. El ensayo anterior de cinco piezas no constituye una prueba de carga.

## Comparación de Redis

| Opción | Precio base consultado | Ventaja | Condición para Grafoprint |
| --- | --- | --- | --- |
| Redis Cloud Essentials 1 GB RAM total, AWS São Paulo, réplica en la misma zona y AOF cada segundo | **USD 36/mes**, consola | 512 MB de datos y 512 MB de réplica; TLS y no eviction configurados | TLS y trabajo sintético BullMQ con reintento/eventos comprobados. Conexión desde Fly comprobada; faltan carga, tamaño de resultados y recuperación. |
| Redis Cloud Essentials 1 GB, sin réplica | Requiere cotización de esa configuración | Más memoria útil con el mismo tamaño total | Quita la réplica; no es la configuración elegida. |
| Redis Cloud Essentials 250 MB totales, con réplica y AOF cada segundo | USD 13/mes, consola | Ensayo pequeño más económico | Sólo 125 MB para datos; poco margen para geometrías y retención. |
| Upstash Fixed 1 GB, una región primaria São Paulo, sin regiones de lectura | USD 20/mes | Persistencia y comandos sin cobro por cantidad | Límite de solicitud 10 MB; 100 GB/mes de tráfico incluido. Requiere resolver/validar los resultados grandes antes de elegirlo. |
| Redis en una sexta máquina propia de Fly: 1 CPU compartida/1 GB, volumen de 10 GB | Aprox. USD 10,70/30 días, más snapshots/tráfico aplicables | Control del servidor y misma región/red | Hay que administrar actualizaciones, AOF, memoria, backups, restauración y fallos. Una sola máquina no tiene failover automático. |

La selección final se verificó en **Redis Cloud Console → Create database → Essentials → AWS → São Paulo**, con réplica en una zona y AOF cada segundo. El plan de USD 36 muestra **2.000 operaciones/s, 1.024 conexiones y 200 GB de transferencia mensual**. Los USD 5 anunciados en la portada no son el precio de esta configuración en Brasil. El [detalle oficial de planes](https://redis.io/docs/latest/operate/rc/subscriptions/view-essentials-subscription/essentials-plan-details/) aclara que el tamaño incluye la réplica cuando corresponde. [Precios Redis](https://redis.io/pricing/).

Upstash documenta compatibilidad con BullMQ y recomienda planes fijos por el sondeo en reposo. El problema encontrado es el límite de solicitud de ese plan frente al formato actual de Grafo, no una incompatibilidad general. Aumentar a 1 GB la capacidad total no aumenta ese límite. [BullMQ en Upstash](https://upstash.com/docs/redis/integrations/bullmq), [límites y precios](https://upstash.com/pricing/redis).

Redis Cloud Free no sirve para este ensayo persistente: carece de TLS y persistencia. En Essentials pago ambos se configuran explícitamente; elegir **no eviction**, porque el valor predeterminado puede expulsar claves. [TLS](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/), [persistencia](https://redis.io/docs/latest/operate/rc/databases/configuration/data-persistence/), [evicción](https://redis.io/docs/latest/operate/rc/databases/configuration/data-eviction-policies/). La guía de [BullMQ para producción](https://docs.bullmq.io/guide/going-to-production) explica los requisitos de persistencia, memoria y reconexión.

## Cuenta mensual reproducible

Supuestos: **30 días / 720 horas**, una máquina por servicio, encendidos todo el mes; sin descuentos anuales ni créditos promocionales. Los tamaños Fly son los cinco manifiestos del PR, aún pendientes de medir con carga real.

| Servicio Fly en `gru` | CPU / RAM | USD por 30 días |
| --- | --- | ---: |
| Aplicación Next | 1 compartida / 1 GB | 9,20 |
| API | 1 compartida / 2 GB | 17,28 |
| Worker geometría/cotizaciones | 2 compartidas / 4 GB | 34,56 |
| Worker PDF | 1 compartida / 1 GB | 9,20 |
| Gotenberg | 1 compartida / 1 GB | 9,20 |
| **Subtotal Fly** | | **79,44** |

Tarifas revalidadas en [Fly Pricing](https://fly.io/pricing/) seleccionando **São Paulo**, el 24 de septiembre. La página muestra USD 3,14/mes para shared-cpu-1x con 256 MB, USD 6,28 para shared-cpu-2x con 512 MB y USD 8,08 por GB/mes de RAM adicional. Por ejemplo, 1 CPU/1 GB = 3,14 + 0,75 × 8,08 = 9,20. Son aproximaciones con los importes redondeados publicados. **Esta cotización sustituye el subtotal anterior de USD 61,78 para Fly y la previsión de USD 130 total**; no asumir que la diferencia demuestra cuándo cambió la tarifa. Fly factura por tiempo; 31 días cuestan algo más. CPU compartida no equivale a CPU dedicada para cálculos sostenidos: si las mediciones exigen cambiar el worker a performance, hay que recalcular el presupuesto antes del cambio.

| Concepto adicional | Supuesto de cálculo | USD/mes |
| --- | --- | ---: |
| Redis Cloud Essentials | 1 GB total: 512 MB de datos + 512 MB de réplica; AOF cada segundo | 36,00 |
| Neon Launch: cómputo | 0,25 CU × 720 h × USD 0,106/CU-h | 19,08 |
| Neon: datos | 1 GB-mes × USD 0,35 | 0,35 |
| Neon: historial de restauración | Ejemplo: 1 GB-mes × USD 0,20; depende de cambios y retención | 0,20 |
| R2 Standard | Hasta 10 GB-mes, 1 millón de operaciones A y 10 millones B, con franquicia disponible en la cuenta | 0,00 |
| **Base, incluidos los cinco servicios Fly** | | **135,07** |
| Ejemplo de salida pública de Fly | 50 GB × USD 0,04/GB | 2,00 |
| **Escenario de ejemplo** | | **137,07** |

Neon Launch es por consumo, sin mínimo mensual. Sus 100 CU-h del plan Free equivalen a 400 horas a 0,25 CU, insuficientes para el mes completo encendido. El proyecto ya está en **Launch**, con cómputo actual y predeterminado fijos en **0,25 CU**, suspensión tras cinco minutos, historial de restauración de un día y notificación de gasto de USD 20. El cálculo de la tabla presupone uso continuo por los sondeos de API/workers. Si requiere **0,5 CU constante**, el cómputo pasa a **USD 38,16/mes** y el escenario sube a **USD 156,15**: supera el margen propuesto y requiere revisar el presupuesto. No dejar un máximo de autoscaling alto por defecto. [Precios Neon](https://neon.com/pricing), [planes y cálculo de CU-h](https://neon.com/docs/introduction/plans).

R2 cobra USD 0,015/GB-mes por almacenamiento Standard sobre la franquicia; las operaciones excedentes se cobran aparte. El ejemplo de USD 0 supone que no se consume la franquicia con otros buckets de la cuenta. La salida de R2 es gratuita, pero la salida de Fly hacia R2, Neon, Redis o Internet puede cobrarse. Los archivos deben usar las URLs firmadas directamente cuando el flujo lo permita. [Precios R2](https://developers.cloudflare.com/r2/pricing/), [transferencia Fly](https://docs.fly.io/about/pricing/#data-transfer-pricing).

El rango de trabajo esperado para ese ensayo es **USD 136–146**, con **USD 150 de previsión**. No incluye la suscripción Vercel existente, dominio/correo, impuestos, mensajes Meta, herramientas de IA, nuevos proveedores de correo/monitorización, soporte pago, máquinas de compilación remota ni recursos duplicados durante despliegues. Prever esos adicionales cuando se habiliten; no interpretar el margen como un tope técnico. No comprar reservas anuales durante esta etapa.

La preparación inicial tiene autorizado un margen de **hasta USD 5, una sola vez**, para compilación remota y recursos temporales de despliegue. Usar un builder de Fly (`--remote-only --depot=false`), acotar el tiempo y retirar sus recursos temporales al terminar. No contratar una suscripción separada de Depot ni comprar reservas. Reutilizar la imagen backend para API y ambos workers. El builder temporal utilizado para las dos imágenes fue eliminado después del despliegue. El importe real debe contrastarse con la factura; no se contrató Depot.

## Controles de gasto y próximos ensayos

1. Lucas autorizó **USD 150/mes** de previsión total y **hasta USD 5 iniciales**, incluido Redis de USD 36/mes. Consultar antes de aumentar tamaños o contratar extras. El alcance es staging con datos ficticios, no producción. La autorización no sustituye la intervención que corresponda para datos de tarjeta o nuevos términos legales.
2. La compilación/arranque de API/Next y el login HTTP directo/BFF ya aprobaron en un ejecutor estándar de GitHub, sin reiniciar Docker de esta Mac; ver [VALIDACION.md](./VALIDACION.md). Los ensayos de componentes desde Fly también aprobaron. Falta el recorrido funcional en navegador, MFA, carga y recuperación. Cualquier nueva compilación remota consume recursos y debe mantenerse dentro del margen autorizado.
3. Preparar acceso a Fly, Neon, Cloudflare y Redis Cloud. Verificar en las consolas el precio/región/replicación del plan antes de su creación; guardar credenciales en los almacenes de secretos, nunca en el PR o el chat.
4. Crear Neon exclusivo de staging en São Paulo, PostgreSQL 16, 0,25 CU iniciales y ventana de restauración definida; aplicar las migraciones y roles de la guía. Activar notificaciones de gasto y medir crecimiento del historial.
5. Crear Redis Essentials **RAM 1 GB total (512 MB útiles para datos)**, AWS `sa-east-1`, réplica en la misma zona, TLS, AOF cada segundo y **no eviction**. Medir el límite de conexiones/throughput con nuestros cuatro consumidores y productores. Usar endpoint Redis TCP/TLS, no REST. Si la CA del endpoint lo requiere, montar el certificado oficial y configurar la confianza de Node; nunca desactivar la validación TLS. No habilitar autenticación mutua sin adaptar todos los clientes.
6. Antes de cargar datos reales, probar trabajos cortos y resultados grandes, scripts de concurrencia/cancelación, reintentos, interrupción y recuperación. Medir tamaño del stream y retención. Preparar avisos de memoria al 60 % y 80 % usando las capacidades disponibles; no resolver falta de memoria activando eviction.
7. Crear R2 privado y los cinco servicios Fly según la [guía](./README.md); confirmar una máquina por servicio. Restringir staging y resolver IP/proxy, DNS y TLS antes de abrirlo a usuarios. Registrar métricas durante las primeras jornadas y revisar presupuesto a los siete días, como paso operativo manual.
8. Evaluar qué información recibida de Meta alcanzará Redis al implementar WhatsApp. Si Redis Cloud la trata, actualizar la declaración de proveedores y documentación correspondiente antes de usar ese flujo con datos reales. La revisión enviada a Meta declaró Fly, Neon y R2; no se modifica esa declaración automáticamente con este PR.

Si se desea ahorrar apagando staging fuera del horario de pruebas, hay que detener coordinadamente API y workers, drenar trabajos y comprobar que ninguna tarea mantiene Neon activo. Detener sólo Next no logra ese ahorro. Ese modo no está automatizado ni incluido en la estimación principal.
