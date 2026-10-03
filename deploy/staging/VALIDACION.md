# Validación de staging — historial

## Primer ingreso e impresión rígida con corte — 01/10/2026, 16:20 UTC

- Publicación conjunta autorizada. API y ambos workers ejecutan `b378ae41ead10c5a6ad08b0432aabecb660a5859`, imagen `registry.fly.io/grafoprint-staging-api@sha256:f4171c0f2035177c75d8794a52a0cbfc526687f1b9897726a9e57088ab8e0319`. Web conserva `c42d6d506`; PDF y copiador conservan sus imágenes. Mismas máquinas y tamaños; sin nuevas migraciones, seeds, resets ni cambios de DNS.
- Primer acceso: una clave provisoria puede consultar `/tenants/current` para mostrar «Elegí tu clave». La excepción está limitada a ese método; las operaciones de empresa continúan bloqueadas hasta cambiar la contraseña. El alta de Usuarios continúa entregando clave provisoria al administrador, sin envío automático de correo.
- Impresión rígida: considera el área de los cortes posteriores activos sobre el mismo material antes del acomodo. Conserva placa física, posiciones compartidas y consumo impreso; mantiene las optimizaciones existentes si el corte no agrega restricciones.
- Validación local del conjunto: 207 casos aprobados en diez suites. La revisión ejecutable aprobó [permisos HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36889386716) y [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36889386717). Compilación remota con tipos; no se compiló en Docker de la Mac.
- Ensayo HTTPS con una empresa y operador ficticios: login, cookie segura, contexto de sesión y página SSR de cambio de clave, rechazo de operaciones con clave provisoria, cambio personal, revocación de cookie anterior, conservación del rol, rechazo de la clave anterior y reingreso con la nueva. Sólo se retiraron los fixtures creados por el ensayo; sin correo ni proveedores externos.
- Motor compilado en Fly: nueve piezas de 400 × 400 mm, dos placas físicas de 1220 × 1220 mm y área de corte de 1300 × 1000 mm; impresión y corte conservan las mismas posiciones y no exceden el área accesible. Cálculo en memoria, sin guardar presupuestos ni órdenes.
- Fuentes cifradas y retenidas en B2; inventario del copiador actualizado. Copia posterior `b053ccf7-9461-40ab-b25c-fd24be4b2514`, completada a las 16:16:59 UTC: firma y descifrado del manifiesto aprobados, 301 migraciones, 13 archivos y fuentes/imágenes correctas. No se repitió la restauración SQL. Constructor y túnel temporales retirados al finalizar.
- [PR #13](https://github.com/studiocamaleon/gdi/pull/13), dependiente de #12, sin fusionar. La misma imagen se promovió a producción; ver [su registro](../produccion/VALIDACION.md).

## Medios de pago y liquidaciones reales — 01/10/2026, 10:32 UTC

- API y ambos workers ejecutan `c0aa8cf46cf31a00c942afd9d99dc7f952475690`, imagen `registry.fly.io/grafoprint-staging-api@sha256:338ce43559d5d91558f32f52587d93cd8200206aa71b9175071b41157e3b2b0e`. La web ejecuta `c42d6d5063ce9cea23ae037475443edc0b6a6156`, imagen `registry.fly.io/grafoprint-staging-web@sha256:839e3c369a7c1a4643ce8bb8c876dd249cbbf223f1793d9cdbd5fdc77b9e827b`. PDF y copiador conservan las imágenes anteriores. Mismos tamaños, sin cambios de DNS ni credenciales de aplicación.
- Se aplicaron las migraciones aditivas pendientes, incluidas ARCA de Plataforma y `20261001100000_medios_pago_retenciones`: 301 completas. Sin seeds ni resets. Se conservaron los recuentos de empresa, clientes, cobros, métodos y movimientos; el rol de aplicación puede usar los nuevos campos y sigue sin DDL.
- Pasaron 50 pruebas de cálculo/vistas y 41 de integración con PostgreSQL en una base local exclusiva. Incluyen centavos, fechas y feriados, vigencias, duplicados, no duplicación del costo IIBB, histórico, permisos, aislamiento y confirmación concurrente con un único movimiento. Tipos y lint dirigidos correctos. La revisión web final pasó [HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36847103416), [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36847103408) y Vercel Preview en GitHub.
- Ensayo en la API compilada de Fly y PostgreSQL de staging: una empresa temporal verificó estimación, confirmación con importe real, concurrencia, conservación del histórico y rechazo de referencias ajenas. Proveedores externos reemplazados, sin correos, facturas ni mensajes; sólo los datos sintéticos del ensayo se retiraron al terminar.
- HTTPS de API/web devuelve 200. Chrome accedió a la empresa de staging y mostró calendario bancario, fechas adicionales y reglas con régimen, agente, jurisdicción, alícuota, base y vigencia. El formulario se cerró sin guardar. Los porcentajes del ensayo no se configuraron en empresas reales.
- Las fuentes de ambas revisiones quedaron cifradas y retenidas en B2. La copia posterior `de393966-b363-476e-a46b-e97a4249e93f`, completada a las 10:30:47 UTC, pasó firma y descifrado del manifiesto: 301 migraciones, 13 archivos, imágenes y fuentes exactas. **Esta comprobación no repitió la restauración SQL.** El constructor remoto de esta tarea y su túnel se retiraron; Docker local no se reinició.
- [PR #12](https://github.com/studiocamaleon/gdi/pull/12), dependiente de #11, sin fusionar. Guía de uso y límites: [medios de pago](../../docs/medios-pago-retenciones.md). El calendario incorporado cubre Argentina 2026; otros años/países advierten su cobertura parcial. No acredita una liquidación fiscal automática ni reglas particulares de todos los agentes.

## Límites de soporte y lectura DXF — 01/10/2026, 00:10 UTC

API y los dos workers ejecutan `f992d30c5ed18931596e4f8ef899e7b7f4fad01d`, imagen `registry.fly.io/grafoprint-staging-api@sha256:1ba9851de529095532fc10b23333c2cd02bae22c591d0d076bc16844a23d24af`. Web/PDF conservan `5cb1a5248` y el copiador `6d2c51a15`. Las seis máquinas están activas, conservan sus tamaños y API/web responden 200. Se retiró el builder temporal. No se modificó producción.

- Las sesiones de soporte pueden diagnosticar integraciones, pero no ejecutar nueve acciones de configuración/envío de notificaciones y WhatsApp. Pasaron 24 casos nuevos en 19 rutas con sesiones, guards, plan y SQL reales; 137 casos en ocho suites de regresión. Los proveedores de mensajería se sustituyeron: no hubo envíos reales.
- El lector DXF comprueba tamaño y complejidad antes de expandir bloques o interpolar curvas. Los ensayos aislados reprodujeron referencias circulares y trabajo excesivo; después se rechazan sin expandir. Pasaron 37 casos nuevos dentro de 80 en seis suites, tipos y lint. Se conservaron medidas y fabricación de dibujos válidos. El primer lote de fabricación necesitó seleccionar el intérprete CAD local existente; luego aprobó sin cambiar aserciones.
- La imagen final con Node 24.21.0 pasó tres rechazos DXF, un SVG válido y comprobación de las nueve protecciones de soporte en un proceso sin red. CI de esa revisión aprobó [HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36793251602), [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36793251591), [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36793251470), [CodeQL](https://github.com/studiocamaleon/gdi/actions/runs/36793246880) y Vercel Preview. Los intentos iniciales de construcción clásica no resolvieron la arquitectura; la compilación correcta usó BuildKit remoto.
- El postflight de sólo lectura conservó los mismos IDs/recuentos en las seis tablas comprobadas, las 299 migraciones y cero cruces en 270 relaciones entre empresas. Sin migraciones nuevas.
- La configuración del copiador registra las cuatro imágenes activas y tres fuentes exactas. La copia `49d8c66f-a1eb-40c2-a2fb-ab1be65da336`, completada a las 00:08:48 UTC, pasó firma, descifrado e integridad de base, 13 archivos y fuentes a las 00:10:43 UTC. El monitor recibió el éxito real. También terminó la copia horaria de las 00:00 UTC.

Esta comprobación de la nueva copia no repitió su importación SQL: la última restauración funcional completa sigue siendo la del 30/09 a las 21:12 UTC. Continúan la cobertura restante, el correo de recuperación y las condiciones del futuro entorno de producción. No acredita auditoría integral, resistencia a toda carga ni conmutación completa entre proveedores. PR #10 en borrador, sin fusionar #8/#9/#10.

## Copiador seguro, versiones custodiadas y copia comprobada — 30/09/2026, 23:14 UTC

El refuerzo del arranque `6d2c51a15f58e42743af38d056642df28efe1636` está desplegado en el copiador. API, dos workers, web y PDF mantienen `5cb1a52488d8a8918c70ebb2182a44cdc7f3292b`. Se conservaron las seis máquinas y sus tamaños; el servidor temporal de compilación fue retirado. No hubo migraciones ni cambios en producción.

- La imagen real del copiador pasó el arranque con UID 10001, carpetas privadas, bloqueo exclusivo, siete rechazos de rutas manipuladas y conservación del estado/inode entre reinicios. En Fly se comprobaron padre root sin escritura para el usuario, estado/configuración privados y bloqueo retenido. Los seis servicios pasaron el control de utilidades sin elevación; un PDF real y salud de API/web también aprobaron.
- El postflight de sólo lectura conserva las 299 migraciones y los mismos IDs/recuentos de empresa, usuarios, conversación, mensajes, envíos y archivos. No hay cruces entre empresas en las 270 relaciones comprobadas.
- CI de `6d2c51a15` aprobó [HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36789058688), [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36789058722), [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36789058806) y [CodeQL](https://github.com/studiocamaleon/gdi/actions/runs/36789058658), incluido el check de resultados. Vercel Preview también aprobó. Esto corresponde a esa revisión ejecutable, no a futuros commits documentales.
- Copia `2ff47abd-0019-402a-86f1-6efeee0593aa`: inició 23:11:50 y terminó 23:12:42 UTC. El copiador notificó éxito real al monitor. Con el material de custodia del titular se verificaron firma, descifrado e integridad de la base, los 13 archivos y las dos fuentes exactas que contienen los cuatro componentes. El manifiesto coincide con las cuatro imágenes desplegadas; verificación terminada a las 23:14:08 UTC. La retención sigue siendo de al menos 30 días.

| Componente | Imagen fijada |
| --- | --- |
| API y workers | `registry.fly.io/grafoprint-staging-api@sha256:5cf57fa2289707cecb8ce7bf5eca6c28df832a0535a8a9337ad61593c9e79118` |
| Web | `registry.fly.io/grafoprint-staging-web@sha256:df56b9ba00fc70b7b3a0af725bb774945d3446834cf852c6d3f55a3092a8213e` |
| PDF | `registry.fly.io/grafoprint-staging-pdf@sha256:c04d34a4ee5612eb085dde7183d683248f08eaeced025b70b16fe5a2c9aca4c8` |
| Copiador | `registry.fly.io/grafoprint-staging-respaldo@sha256:766e1ba841ffc48c6ca2425ae02c385a2fbded3942083aed3abcf1a30107b2b4` |

La descarga de esta nueva copia no repite su importación SQL ni el recorrido funcional completo. La última restauración SQL/API comprobada sigue siendo la de las 21:12 UTC descrita debajo. Continúan la revisión restante de seguridad, el correo de recuperación deshabilitado, la resolución de dependencias entre PR y los ensayos del futuro entorno de producción. El PR #10 permanece en borrador.

## Imágenes reforzadas y preparación segura del copiador — 30/09/2026

Las seis máquinas ejecutan `5cb1a52488d8a8918c70ebb2182a44cdc7f3292b`. Se comprobaron sus usuarios sin root y la ausencia de setuid/setgid en las utilidades de consola revisadas. API/web responden 200; la API generó un PDF ficticio válido por la red privada. Se conservan máquinas, regiones, tamaños y las 299 migraciones. El postflight de sólo lectura conserva IDs y cantidades de seis tablas y no encuentra cruces en las 270 relaciones con empresa en ambos extremos. Todos los controles de CI de esta revisión aprobaron.

Se añade una protección de arranque del copiador: la raíz del volumen queda controlada por root, las carpetas de trabajo siguen privadas para UID 10001 y el bloqueo conserva su inode. Un ensayo aislado reprodujo antes el seguimiento de un enlace; después se rechazan siete variantes de rutas manipuladas y pasan dos arranques con estado existente. El ensayo se incorpora a CI; esta protección adicional todavía no está desplegada al escribir esta entrada. La regresión del copiador aprobó 97 pruebas, con 20 pruebas que necesitan herramientas/SQL adicionales omitidas en esa ejecución. No equivale a repetir la restauración integral ya documentada.


## Impresión: accesos y separación entre empresas — 30/09/2026

Sin nuevo despliegue. Se incorporan once casos HTTP con sesiones, permisos, servicios, plan persistido y PostgreSQL reales. Cubren el acceso a las 32 rutas de impresión/perfiles CAD, listados aislados, referencias ajenas, campos internos, documentos/historial, estados de envío, versiones de bandejas, entradas de firma y pérdida de capacidad del plan. Los rechazos conservan los datos originales; las operaciones propias autorizadas funcionan. Storage y motor rechazan llamadas no previstas: no hay certificados QZ, impresoras ni proveedores reales en el ensayo.

Pasaron **131 casos en once suites** de impresión, además de tipos y lint dirigidos del test nuevo. El control HTTP de PR incorpora la nueva suite. Quedan fuera de este ensayo la firma con certificado real, impresión física, carga máxima y los recorridos externos; no se identificó una nueva brecha en los casos comprobados.

## Permisos de utilidades en las imágenes — 30/09/2026

Preparado un refuerzo de las cuatro imágenes: retirar setuid/setgid de utilidades de consola en `/usr/bin`, `/usr/sbin` y `/usr/local/bin`. Se conservan los permisos ordinarios, el usuario de cada servicio y el helper de aislamiento de Chromium. El respaldo sigue preparando su volumen como root y baja a `respaldo` antes de ejecutar el servicio; `gosu` no depende del bit setuid de un archivo.

El verificador nuevo rechazó las cuatro imágenes vigentes por esos atributos; no se ejecutó un ataque ni se demostró escalada de privilegios. Sintaxis de los dos ensayos y diff local comprobados. CI ahora compila también el copiador y exige usuario sin root, ausencia de esos atributos y arranque del respaldo con directorios privados y bloqueo exclusivo, sin red. En `83160c948`, [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36783340329), [HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36783340324) y [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36783340319) aprobaron. Las cuatro imágenes nuevas y el recorrido funcional remoto pasaron; todavía pendiente desplegar en Fly. La instalación vigente no cambia por este registro.

## Archivos locales y tipos de cambio — 30/09/2026

Sin nuevo despliegue: API/workers siguen en `119db9792`, web en `a93268414`, PDF y copiador conservan sus versiones custodiadas. El cambio `af2b1ca9c` afecta al almacenamiento de desarrollo: exige un objeto relativo dentro de su raíz, sin aceptar la propia carpeta ni reinterpretar rutas absolutas. Cuatro casos fallaron antes; las 14 pruebas de archivos, tipos y lint pasaron después. GitHub marcó como **Fixed** las cinco alertas del PR y su control de resultados CodeQL pasó, sin descartarlas ni desactivar reglas. Esto no elimina automáticamente las alertas históricas de `main` ni certifica todo el sistema.

Se agregan siete casos HTTP de tipos de cambio con sesiones, permisos, servicios y PostgreSQL reales: acceso en las cinco rutas, lecturas simultáneas aisladas, identificador ajeno denegado, configuración sólo para gestores, autor y empresa fijados por el servidor, entradas inválidas sin persistencia y destino externo fijo. Pasaron 67 casos de tres suites, tipos y lint. Sólo la lectura de suscripción y la respuesta de DolarAPI son fixtures; no hubo llamadas a proveedores ni cambios en staging. El control obligatorio del PR incorpora estas pruebas y las de archivos. Su resultado remoto debe comprobarse sobre la nueva revisión.

## Protección de main y recuperación de respaldos — 30/09/2026, 21:12 UTC

Los dos bloqueos operativos quedaron resueltos. GitHub confirma la regla activa de `main`: PR obligatorio, check `http` de GitHub Actions, rama al día, conversaciones resueltas y prohibición de borrado/force-push, sin bypass. No se fusionaron PR ni se cambió producción. Los cuatro workflows de `eea7e351` aprobaron: [HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36715486634), [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36715486703), [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36715486660) y [CodeQL](https://github.com/studiocamaleon/gdi/actions/runs/36715481015). Sus comentarios de análisis requieren revisión independiente del resultado de ejecución.

- Backblaze confirmó agotamiento del límite gratuito de 1 GB diario de descarga. El titular registró su medio de pago y se fijaron topes de USD 0,10/día para almacenamiento y USD 0,10/día para descargas, con alertas de 75 % y 100 %. Son límites por categoría, no un cargo fijo ni el presupuesto total de infraestructura. La retención sigue siendo de al menos 30 días; no se borraron versiones.
- Se custodió el código exacto de API/workers `119db9792`, web `a93268414`, PDF `28c94c673` y copiador `4d921268`. Se actualizó exclusivamente la configuración del copiador con las cuatro fuentes e imágenes vigentes. Las aplicaciones y tamaños no cambiaron.
- Nueva copia `77c9a668-cdad-4241-8e10-a4f58e707919`: iniciada a las 21:08:53.849 y completa a las 21:09:46.004 UTC. Trece archivos reutilizados; comprobante remoto firmado, descifrado y huellas de datos y cuatro fuentes verificados con el material de las notas del titular.
- Restauración en una base aislada: **216 tablas, 299 migraciones/checksums y 1.591 filas**. Se comprobó el descifrado de la clave MFA. La API de la fuente vigente pasó ingreso con MFA, consulta y alta de cliente, 401 sin sesión y denegación entre dos empresas. Un adjunto pasó por su ruta autenticada y los 13 objetos por el almacenamiento recuperado, con huellas correctas. Red externa denegada por el sistema operativo; sin cron, workers ni envíos. Al terminar se sellaron los roles SQL y se detuvieron sólo la API y Redis exclusivos del ensayo.
- El primer intento funcional encontró Redis de ensayo apagado y devolvió 503. Se corrigió el usuario del contenedor temporal; el recorrido pasó sin modificar la aplicación ni debilitar aserciones. No se reinició Docker ni se afectaron otros proyectos.
- Healthchecks volvió a **UP** por la señal real del copiador a las 21:09 UTC. Mantiene una hora de período, 30 minutos de gracia y correo activo. Entre copias completas hubo **10 h 27 min 19 s** sin un punto nuevo de recuperación. La nueva copia no reconstruye los puntos horarios que faltaron durante ese intervalo.

El incidente operativo de B2 queda cerrado. El PR #10 conserva su borrador y pendientes de revisión/dependencias; producción continúa pendiente. Este ensayo acredita recuperación aislada de datos y API, no interfaz web, workers, conmutación completa a otra nube ni un RTO garantizado. Los apartados siguientes son el historial y sus bloqueos anteriores no sustituyen este estado.

## Lote de entradas desplegado y comprobado — 30/09/2026, 12:32 UTC

API y ambos workers ejecutan `119db9792a47cae8d688b8d8ea49fbf6e9fee355`, imagen `registry.fly.io/grafoprint-staging-api@sha256:c93f4535bf689c261950726e3b24414c762ec4889c26a728f5d01e01254d280c`. Compilación remota con tipos aprobada. Web conserva `a93268414`; PDF y ejecutor de respaldos no cambiaron. Se conservaron las seis máquinas y sus tamaños, sin migraciones nuevas ni cambios de producción.

- Pasaron los 312 casos de las 16 suites del control local y remoto; los 12 casos del motor vectorial también aprobaron. Los cuatro controles de esta revisión terminaron correctamente: [HTTP y parsers](https://github.com/studiocamaleon/gdi/actions/runs/36714403949), [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36714403873), [contenedores/login/BFF](https://github.com/studiocamaleon/gdi/actions/runs/36714403980) y [CodeQL](https://github.com/studiocamaleon/gdi/actions/runs/36714397780).
- El código compilado de la API en Fly rechazó claves reservadas, consultas con tipos incorrectos y atributos SVG inválidos; los controles positivos de cotización, filtros y escala decimal pasaron. Se ejecutaron en un proceso separado, con consultas sustituidas: no se usó la base real ni se llamaron proveedores externos en ese ensayo. No equivale a probar esos casos por HTTP en cloud.
- API y web responden 200 a salud; controles disponibles aprobados y workers iniciados. El control de sólo lectura de PostgreSQL conservó los mismos IDs/recuentos originales: una empresa, tres usuarios, una conversación, 31 mensajes, 16 envíos y 13 archivos. Las 299 migraciones coinciden; 270 relaciones con empresa en ambos extremos no tienen cruces. El usuario de ejecución continúa sin privilegios de superusuario, creación de roles/bases ni bypass de RLS.

**Pendientes:** guardar la protección de main después del segundo factor de GitHub y normalizar el límite de Backblaze para comprobar una copia nueva y la custodia de las fuentes vigentes. La última copia completa verificada sigue siendo la de las 10:42 UTC; no se declara protegido este lote en B2. El PR #10 continúa en borrador, con descripción actualizada. No se considera habilitado el despliegue a producción.

## Validaciones de entradas y motor vectorial — 30/09/2026

Lote preparado localmente, todavía sin nuevo despliegue al escribir esta entrada. Se rechazan claves reservadas en respuestas de cotización, tipos inesperados y fechas inexistentes en filtros, y cursores con campos que no sean texto. El parser del motor vectorial evita repetir búsquedas costosas ante atributos y longitudes malformados. Las pruebas de cada corrección reprodujeron antes el problema y comprobaron después su resolución.

Resultados locales: MCP 24 casos; consultas y regresión de egresos/panel 79; motor vectorial 12; controles existentes de Meta/archivos/recorridos/órdenes 50. Tipos dirigidos aprobados. El lint de las pruebas nuevas aprueba; el módulo MCP conserva doce avisos de tipos preexistentes fuera del cambio. CI incorpora los nuevos casos y el ensayo del motor. Se retira el lockfile de pnpm obsoleto; las instalaciones y despliegues siguen usando npm y sus package-lock.

La revisión previa `e156b208fd310ef62237702a3cfea22a20f9906c` aprobó los cuatro controles remotos: [HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36712110378), [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36712110327), [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36712110360) y [CodeQL](https://github.com/studiocamaleon/gdi/actions/runs/36712106451). CodeQL quedó activo para JavaScript/TypeScript, Python y GitHub Actions; un análisis completado no significa ausencia de alertas.

La protección de `main` continúa pendiente de guardar por la verificación personal de GitHub. Los respaldos conservan el incidente operativo descrito debajo. No se modifica producción ni se considera habilitada.

## Previsiones y controles automáticos de GitHub — 30/09/2026

Sin cambios ejecutables ni despliegue: API/web siguen en `a93268414c03b26013c181fe25e28281fad674b3`. Se añadieron nueve casos HTTP de ETA con sesiones, permisos, servicios y PostgreSQL reales: las cinco rutas exigen sus accesos correspondientes, separan contexto/colas/precisión/salud entre dos empresas y sólo permiten al supervisor publicar registros propios sin duplicarlos. Se usaron datos ficticios; únicamente la lectura del plan está sustituida. No se acredita carga máxima ni todas las entradas de negocio. Regresión dirigida de cuatro suites: 20 casos aprobados; tipos y lint aprobados. El lote de trece suites HTTP aprobó 273 casos localmente.

El check `http` ahora corre en todos los PR hacia `main`, sin filtros por archivos. La versión previa de ese cambio, `ca618cb6f415c79b2e811ae7b04f8144b2d6cfc6`, aprobó [fronteras HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36710587669), [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36710587715) y [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36710587735). El resultado remoto de la incorporación de ETA se registra por separado.

Se activaron en GitHub el grafo de dependencias, las alertas de vulnerabilidades y las alertas de paquetes maliciosos. La protección de secretos y de pushes con claves ya estaba activa. Se solicitó la configuración inicial de CodeQL para JavaScript/TypeScript, Python y GitHub Actions; sus resultados deben comprobarse por rama y revisión. No equivale a una certificación de seguridad.

El incidente de respaldos continúa abierto; estas comprobaciones no normalizan las copias ni habilitan producción.

## Fronteras de producción y productos — 30/09/2026, 11:35 UTC

Sin cambios de código ejecutable ni nuevo despliegue: API/web conservan la fuente `a93268414c03b26013c181fe25e28281fad674b3`. Se añadieron 26 casos HTTP con PostgreSQL y dos empresas ficticias, usando sesiones, permisos, validación y servicios reales.

- Producción: listados aislados, recursos, familias, días y configuración; rechazo de edición/borrado ajeno y referencias a equipos, empleados, horarios, máquinas y pasos ajenos. Se comprobaron datos sin cambios después del rechazo, altas propias y concurrencia al asignar un paso a estaciones. Trece casos nuevos aprobados; tipos y lint aprobados.
- Productos: lectura, edición, duplicación y borrado; referencias cruzadas entre producto/ruta/alternativa/paso, migración mixta y campos internos rechazados sin escrituras parciales. Trece casos nuevos aprobados, con el interceptor real de publicación. Regresión dirigida: 33 casos en seis suites aprobados; tipos y lint aprobados. El plan y la entrega externa de eventos se sustituyen; no se ensayaron proveedores ni todos los tipos de configuración productiva.
- Planificación y producción: otras cuatro suites existentes, 42 casos aprobados. No equivalen a un ensayo completo de todo el taller.
- Se preparó un control de PR con PostgreSQL efímero, migraciones y doce suites HTTP explícitas, sin seeds ni accesos cloud. Su lote local aprobó 264 casos. El primer resultado de este workflow nuevo en GitHub se registrará al terminar; no se deduce del resultado local.
- Sobre el commit anterior `a1380019facc9c037a3d48af8ebcffbdf6f472dc` aprobaron [contenedores y HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36707647368) y [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36707647337).

El incidente de respaldos descrito debajo sigue abierto. Estas pruebas no normalizan las copias ni habilitan producción.

## Contratación vinculada y estado de respaldos — 30/09/2026, 11:08 UTC

API, ambos workers y web ejecutan la fuente `a93268414c03b26013c181fe25e28281fad674b3`. Backend: `registry.fly.io/grafoprint-staging-api@sha256:27859e1f7345e7232cb37fd2b61a07293af08cb6f9707420b9cd5a73b02c4fa6`; web: `registry.fly.io/grafoprint-staging-web@sha256:e974960a90585f7e4b6083143cee28b2d92c3778f6fb7c6b64aac4a3897e3026`. PDF y copiador conservan sus imágenes. Seis máquinas iniciadas y controles de salud disponibles aprobados. Sin nuevas migraciones, tamaños, fusiones ni cambios de producción.

- Las nuevas contrataciones usan la transacción preparada por el servidor. Los planes históricos conservan la gestión de suscripciones ya vinculadas y no ofrecen nuevas altas. Una notificación del proveedor no puede crear una suscripción histórica usando sólo los datos personalizados del navegador.
- Pasaron 62 casos API y ocho web, tipos/lint dirigidos y ambas compilaciones remotas. La API compilada en staging comprobó alta rechazada, renovación vinculada y catálogo limitado dentro de una transacción revertida. No se consultó Paddle ni se efectuaron pagos reales. El webhook firmado se ensayó localmente; no se declara validada una compra real.
- Postflight: 299 migraciones/checksums, mismos IDs y cantidades originales; 270 relaciones entre tablas de empresa sin cruces. Los datos del ensayo se revirtieron.
- **Respaldo pendiente de normalización:** la copia horaria de las 11:00 UTC falló y el monitor externo lo detectó. La última copia completa verificada sigue siendo la de las 10:42 UTC, detallada debajo. La custodia y copia posterior de esta nueva fuente aún no están verificadas. No considerar cerrado este control ni habilitar producción; el diagnóstico operativo permanece en el registro privado.
- El lote anterior `51ae83ba0d79def1a9fc42aa33a37eb9a5509d94` aprobó [contenedores y HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36704410307) y [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36704410632). Los resultados de este nuevo commit deben registrarse por separado.

Comprobaciones locales posteriores, sin nuevo despliegue: nueve casos HTTP con PostgreSQL y dos empresas para enlaces de presupuestos y órdenes. Se verificaron alcance del token, adjuntos públicos/privados/pendientes/ajenos, cabeceras, logos, campos internos, doble aprobación, revocación, caducidad y reemisión. Regresión de cuatro suites: 47 casos aprobados; tipos y lint del nuevo test aprobados. Firma de almacenamiento, notificaciones y lectura de plan sustituidas; no hubo proveedores externos. Otros diez casos existentes de aprobación de arte y concurrencia pasaron: incluyen revocación durante una decisión y cambios de capacidad entre lectura y escritura. No se acredita por estos ensayos el circuito completo de recibos/facturas ni la interfaz pública desplegada.

## Actualización de runtime y reportes — 30/09/2026, 10:44 UTC

API y ambos workers ejecutan la fuente `cf04d5773a52133e8d3479e6d7b4c20f6d8792c4`, imagen `registry.fly.io/grafoprint-staging-api@sha256:aab68158d8e357dc58f39963ef3231c698adfac4cea0f41dc71d4ec7db11f609`. La web usa `7a632da5bfbb83f059128153fd9755d783ee771a`, imagen `registry.fly.io/grafoprint-staging-web@sha256:241257c6d112c44c08fccb92e84b745944a708d5dc346ff4787a77ab96cb4a20`. PDF y copiador conservan sus imágenes. Se comprobaron las seis máquinas iniciadas, sus identidades/tamaños y controles de salud disponibles. Sin cambios de producción ni nuevas migraciones.

- Node 24.21.0 fijado por digest; compilaciones remotas con tipos aprobadas. Es una actualización del runtime, no una declaración de que desaparecieron todos los avisos nativos. Pasaron 73 pruebas locales dirigidas de configuración, accesos, sesiones, archivos y seguridad web. En la API desplegada se comprobó la versión real y conversión de audio con rechazo de formatos inválidos.
- Ensayo HTTP de staging repetido sobre la pareja nueva API/web: perímetro, origen, login, cookie protegida, aislamiento de empresas, permisos vigentes, MFA, rotación de contraseña y cierre de SSE tras revocación. Se retiraron únicamente los datos temporales del ensayo. Postflight: mismos IDs y cantidades originales, 299 migraciones/checksums y 270 relaciones sin referencias entre empresas.
- Reportes: 13 casos aprobados de planes/permisos, incluidos doce reportes de una empresa y un control positivo de otra, con nombres y montos distintos. Servicios, planes, permisos y SQL reales; identidad inyectada como fixture, sin acreditar nuevamente AuthGuard/JWT en esta suite. Tipos y lint dirigidos aprobados. Se corrigió el nombre de un rol de prueba sin cambiar código ejecutable.
- Copia posterior `d298d3c6-18c6-4ab3-8df7-aa5f9e7e2dc2`, completa a las 10:42:27 UTC: cuatro fuentes exactas y 13 archivos. Descarga, firma, descifrado y huellas aprobados. No se volvió a importar esta copia a PostgreSQL; el ensayo SQL/funcional completo sigue siendo el de las 09:17 UTC.
- El lote anterior `cab2aba197221dbf743d80ec74694b5b7fb22ab5` aprobó [contenedores y HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36702014840) y [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36702014768). El resultado de GitHub para esta actualización se registra por separado cuando concluya.


## Procesamiento de archivos y tesorería — 30/09/2026, 10:23 UTC

API y ambos workers ejecutan la fuente `45bf112cc9254403fc20ad2142715e92d525c547`, imagen `registry.fly.io/grafoprint-staging-api@sha256:1a51bda900534d3c6e6fcb77a0a07b2a6c9ada8da0809a0f3b840b408e4735aa`. Web, PDF y ejecutor de copias conservan sus versiones. Se verificaron las seis máquinas iniciadas, mismos tamaños y controles de salud disponibles aprobados. Sin migraciones nuevas ni cambios de producción. Los apartados inferiores conservan el estado histórico de cada ensayo.

- OpenNest, lector DXF y herramientas de audio reciben únicamente variables necesarias para su trabajo. Tres pruebas con secretos ficticios fallaron antes de la corrección; después pasaron 23 casos en cinco suites, incluidos procesos reales, cancelación, conversión AAC/Opus y DXF. Tipos y lint dirigidos aprobados. La compilación remota pasó con tipos y comprobación de audio como usuario sin privilegios.
- En la imagen desplegada se comprobó la lista permitida y un hijo real sin la variable secreta ficticia; también pasó conversión multimedia real y rechazo de archivos no válidos. Esto reduce la exposición por herencia de configuración, pero **no constituye un aislamiento del sistema operativo**: los hijos conservan UID y permisos de archivos del proceso padre.
- Copia posterior completa a las 10:16:01 UTC: cuatro fuentes exactas, 299 migraciones y 13 archivos. Descarga, firma, descifrado y huellas aprobados. Se conserva como ensayo SQL/funcional completo el de las 09:17 UTC detallado debajo; no se presenta esta descarga posterior como una nueva restauración SQL.
- Tesorería: diez casos nuevos y 37 solicitudes HTTP con PostgreSQL, sesiones y servicios reales. Se probaron permisos, cuentas/métodos/puntos de venta ajenos, transferencias entre empresas en ambos sentidos, imputaciones cruzadas y rechazo sin modificaciones parciales. La transferencia propia repetida conserva exactamente dos movimientos; la imputación propia y su reversión funcionan. Se sustituye la lectura del plan y las dependencias externas no utilizadas; no hubo emisión fiscal, correo ni llamadas a proveedores. Lint y tipos dirigidos aprobados.
- El commit anterior `ca8f45e1178e4ef6e3ddc6f1d32d1370b40b95e3` aprobó [contenedores y recorrido HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36699649192) y [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36699649179). La ejecución de GitHub sobre este lote nuevo se registra al finalizar; no se infiere de esos resultados anteriores.

## Permisos de Centro de Copiado y comprobaciones adicionales — 30/09/2026, 09:44 UTC

API y ambos workers ejecutan ahora la fuente `a949ba30571a7532c83c1f4a9087f6d3c3df79c7`, imagen `registry.fly.io/grafoprint-staging-api@sha256:4b4883f533a94cb8a3204f8420ce4d68b141bf19b255423361a65781831997d6`. Web y PDF mantienen las versiones de la tabla del apartado anterior. Mismos recursos y máquinas; builder temporal retirado al terminar. Sin nuevas migraciones, cambios de producción ni fusiones.

- Las dos operaciones de guardado de Centro de Copiado exigen `comercial.gestionar`; las vistas previas siguen disponibles con lectura. Reproducción local antes del cambio: cinco rechazos esperados fallaron. Después: 13 pruebas HTTP aprobadas con sesiones y roles reales. Los servicios de cálculo/guardado se sustituyen en esos tests; no acreditan el cálculo de una cotización completa.
- En staging, dos usuarios ficticios temporales probaron ambos guardados: lector 403, gestor 400 al alcanzar la validación de un cuerpo deliberadamente incompleto. No se guardaron cotizaciones. Las identidades temporales se eliminaron; postflight aprobó mismos datos históricos, 299 migraciones/checksums y 270 relaciones sin referencias entre empresas.
- Regresión Centro de Copiado: 73 pruebas aprobadas y una excedió cinco segundos; al repetir sólo su archivo, las cuatro pruebas pasaron sin cambiar código, timeout ni aserciones. Lint dirigido aprobado.
- Campañas, cupones, fidelización y desarrollo documental: 11 casos nuevos, 36 solicitudes HTTP con base y servicios reales; permisos, lecturas y referencias ajenas, rechazo sin escrituras parciales y altas propias comprobados. La lectura del plan se sustituye por un plan de prueba. Esto no cubre todos los recorridos ni acredita interacciones externas.
- CI anterior: dependencias aprobadas; contenedores compilaron y pasaron tipos, pero el ensayo HTTP conservaba una cookie anterior al cambio de contraseña. Se corrigió el ensayo para exigir revocación de la anterior y usar la cookie rotada, y se agregó arranque/espera explícitos del PDF. Sobre `170d04765ad52764f9b174a58c92031c7023a4b3` aprobaron [contenedores, tipos, migraciones y HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36698485609) y [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36698485608). No se omitieron controles.
- Respaldo posterior: copia completa a las 09:48:01 UTC con las cuatro fuentes vigentes, 299 migraciones y 13 archivos. Descarga, firma, descifrado y huellas comprobados. Esta copia no se volvió a importar a PostgreSQL: el ensayo SQL y funcional del mismo esquema se realizó con la copia anterior, como se detalla debajo.
- Inventario: 16 casos nuevos y 44 solicitudes HTTP con PostgreSQL, sesiones y servicios reales. Se comprobaron lectura por empresa, 14 operaciones denegadas al lector, rechazo de proveedor/variante/ubicación ajenos, lote mixto de precios sin escritura parcial y movimiento propio autorizado. Plan sustituido por un fixture; sin consultas de cambio ni modificaciones del inventario existente. Lint y tipos dirigidos aprobados. El intento de tipos de todos los tests juntos agotó la memoria disponible; no se aumentó la memoria de la Mac/Docker ni se cuenta ese intento como aprobado.

## Lote de seguridad y recuperación — 30/09/2026

**Estado actual:** API, web, ambos workers y generador PDF desplegados y saludables, en las mismas cinco máquinas y con los mismos recursos. No se modificó producción ni se fusionaron PR. Se conservan las mejoras del Inbox del PR #8 y la redirección del PR #9.

| Componente | Fuente | Imagen exacta |
| --- | --- | --- |
| API y ambos workers | `f78273ffa66fdb9d1216bf37bfe8309964b69a78` | `registry.fly.io/grafoprint-staging-api@sha256:4ff66704884319007798bb58a7140d75b72cb604f7cbed946ac8bde36cec8859` |
| Web | `6552177322633140bf5e5b53cc026f697b2d965b` | `registry.fly.io/grafoprint-staging-web@sha256:e29ab48c5e856e2056203714b9df34a67fa37ef75731463a464779133689a93d` |
| Generador PDF | `28c94c67381a69de85c94dfa12c176c67941004c` | `registry.fly.io/grafoprint-staging-pdf@sha256:db32ce06062ac320ce2b11b15e5b5b8ad2382455ec2462987a75e2d82cb87d75` |

- **Base:** migración aditiva `20260930020000_recuperacion_identidad`, total 299. Historial anterior y checksums conservados, cero migraciones pendientes. Se reaplicaron las concesiones del rol de ejecución y se verificó que el lector de respaldos puede leer las tres tablas nuevas sin escribir. No hubo seeds ni reinicio de datos. IDs y cantidades originales de empresas, usuarios, conversaciones, mensajes, envíos y archivos conservados después de limpiar los ensayos. Se verificaron 270 relaciones con empresa en ambos extremos, sin referencias cruzadas en los datos existentes.
- **Prueba HTTP real:** con dos empresas/usuarios ficticios temporales pasaron login, cookie Secure/HttpOnly/SameSite, rechazo de origen ajeno, perímetro de API, otra empresa rechazada, cabecera de empresa falsificada ignorada y permisos quitados efectivos de inmediato. Pasaron activación de MFA, revocación de sesiones anteriores, rotación al cambiar contraseña, nuevo login con segundo factor/código de recuperación y cierre del canal SSE al revocar su sesión. Datos temporales eliminados al finalizar.
- **Archivos reales:** después de vencer las firmas anteriores, la API emitió una subida de PDF con condición de creación única. Carga y confirmación 201 aprobadas, segundo confirmar sin duplicar cuota, reemplazo de bytes 412 y escritura con rol de sólo lectura 403. El driver también pasó multipart, hash de descarga, CORS exacto y rechazo sin firma. Se eliminaron únicamente los objetos y filas del ensayo.
- **Componentes:** FFmpeg 9.0.2 construido desde fuente verificada, con protocolos y formatos limitados; conversión AAC → Opus y rechazos de formatos no permitidos aprobados como usuario sin privilegios. pip 26.2.1 e importaciones de los motores verificadas. Etiqueta con texto/QR comprobada en la imagen final. PDF con Gotenberg 8.37.0 y Chromium 154.0.8037.57, actualizaciones de Debian aplicadas; documento real generado por red privada y solicitudes a URLs públicas/privadas rechazadas con 403. No tiene servicio público.
- **Dependencias:** auditorías de dependencias npm de producción sin avisos en los siete proyectos revisados. Se prepararon revisiones de Dependabot y un check de PR sin secretos, sin instalación de paquetes del PR ni fusión automática. Se activarán al integrar los archivos a `main`; todavía no acreditan una ejecución de GitHub. Esto no significa que todo aviso del sistema operativo haya desaparecido.
- **Interfaz:** sesión existente conservada y panel de la empresa demo cargado en Chrome tras recargar. Inbox muestra correctamente el vencimiento del acceso de prueba de Meta; no se enviaron mensajes ni se afirma haber repetido un intercambio real con ese token vencido.
- **Compilación:** tipos y builds remotos aprobados. Un primer push de la web falló en el registro después de compilar; el reintento final terminó correctamente. No se compilaron contenedores en la Mac ni se reinició Docker.

El ejecutor de copias se actualizó con las tres imágenes desplegadas y cuatro fuentes exactas (API, web, PDF y ejecutor). La copia posterior al cambio terminó; se descargó y descifró con firma válida, 299 migraciones, 13 archivos y cuatro archivos de fuentes con huellas correctas. Restauración SQL en base nueva aislada: 216 tablas y 1.591 filas, con dueño sin superusuario y sin login al terminar. La API del lote nuevo arrancó con esa base restaurada: login con MFA recuperada, lectura/alta de cliente, rechazo de otra empresa y de acceso sin sesión, y apertura de los 13 objetos con hash correcto. La red externa se bloqueó desde el sistema operativo; no se habilitaron cron, workers ni envíos. El rol del ensayo se dejó sin login. Healthchecks confirmó el cierre real. El builder temporal se retiró tras terminar las compilaciones.

**Límites:** estas verificaciones son evidencia de los recorridos indicados, no una certificación de las 675 rutas inventariadas ni garantía frente a cualquier ataque. Recuperación de cuenta por correo permanece deshabilitada hasta configurar y ensayar un transporte real. Coexistencia de Meta, carga sostenida, cambio completo a infraestructura de reemplazo y recuperación ante pérdida del teléfono requieren sus ensayos específicos. Los hallazgos y la cobertura detallada permanecen en el informe privado.


## Activación del respaldo y recuperación de la copia operativa — 30/09/2026

- El titular detectó que la nota larga de recuperación había sido recortada. Se invalidó aquella confirmación y se prepararon cuatro notas de 144–233 caracteres, con marcas de final. El titular confirmó las cuatro completas después de guardarlas. La llave privada de descifrado y la clave interna de Grafo permanecen fuera del ejecutor.
- Se activó un único ejecutor de 512 MB y una CPU compartida, región `iad`, volumen cifrado de 10 GB, red privada separada y sin servicios ni IP públicos. Imagen `registry.fly.io/grafoprint-staging-respaldo@sha256:c368bb3396bd49ef4f5a96228132a878c7e448cd40a551a773d198b43c099245`, código `4d9212683`. Proceso sin privilegios, configuración 0600, bloqueo exclusivo del volumen y reinicio `always`. No se ampliaron los cinco servicios de la aplicación.
- El primer intento no terminó y notificó fallo. Las comprobaciones de lectura a los tres proveedores y el siguiente intento completo aprobaron sin cambiar accesos; no se determinó la causa del primer fallo. Reiniciar el ejecutor produjo copias completas y reutilizó los 13 objetos sin cambios. No se publicaron éxitos manuales en el monitor.
- Interrupción controlada sólo del copiador a las 06:41:49 UTC, con respaldo y temporales en curso. Fly detectó `SIGKILL`, reinició automáticamente y completó otra copia a las 06:42:47, reutilizando los 13 archivos. No se reinició Docker ni ningún servicio de Grafo. El ensayo comprueba recuperación de ese proceso; no una pérdida del proveedor o del volumen.
- Se recuperó un comprobante operativo desde B2 con el lector y la firma pública reconstruidos de las notas. Descarga, firma, descifrado y huellas aprobados para el dump, los 13 archivos y las tres fuentes custodiadas. Restauración SQL nueva y aislada: 213 tablas, 298 migraciones/checksums, 1.588 filas. La descarga y restauración SQL del conjunto pequeño tomó unos 24 segundos; no representa el tiempo total de recuperación del servicio.
- Contra esa nueva copia, la API exacta desplegada pasó ingreso con MFA, ingreso de una segunda empresa, consulta/alta de cliente, rechazo entre empresas y acceso sin sesión denegado. Un adjunto se abrió por su ruta autenticada y los 13 archivos por el almacenamiento aislado con huellas correctas. Sin conexión externa, cron ni workers; accesos SQL del ensayo sellados y su Redis detenido al terminar. No se ensayó la interfaz web ni un proveedor cloud sustituto.
- Monitor externo activo: una hora de período y 30 minutos de gracia, correo habilitado y señales reales de fallo/éxito observadas. El ensayo previo de ausencia registró entrega del aviso por el proveedor; no se acredita lectura humana del correo.
- Horario observado sin intervención: inicio `2026-09-30T07:00:00.453Z`, cierre `07:00:49.761Z` y confirmación del monitor a las 07:00:50. Trece archivos reutilizados. Comprobante obtenido del catálogo B2 con lector separado y firma pública de las notas; descarga/descifrado verificados del dump, 13 archivos y las tres fuentes, incluida la revisión exacta del ejecutor `4d9212683`. Las fuentes se listaron sin extraer ni ejecutar. Se acredita este disparo horario; no es una garantía de que nunca fallen ejecuciones futuras.
- La configuración de reinicio pasó la validación de Fly. Continúan vigentes las 117 pruebas del paquete de recuperación; no se modificó su algoritmo en esta activación. Sin migraciones ni cambios de datos de staging, sin despliegue de la aplicación ni cambios en producción. La revisión integral de seguridad y el ensayo de recuperación completa en infraestructura sustituta siguen siendo trabajos separados.

## Preparación del ejecutor y ensayo funcional de recuperación — 30/09/2026

- API ensayada: `ce4e06fca19779ae4f7551f35a3e21e27734c523`, contra la copia restaurada de 213 tablas y 298 migraciones. Ingreso con MFA, consulta/alta de cliente y denegación entre dos empresas correctos. Identidades QA creadas únicamente en la recuperación; no se cambiaron claves de staging. Sandbox sin salida externa, cron y workers desactivados.
- Trece objetos recuperados abiertos y verificados por hash en el almacenamiento aislado; un adjunto de cliente comprobado además por su endpoint autenticado. Sin ensayo de interfaz web ni reconexión de Meta. Runtime SQL del ensayo sellado sin login al terminar.
- Código de backend y de web (`250b8643ab0ca6269c4d0e58a2d1ef45cf602d8e`) archivado, cifrado, protegido en B2 y recuperado con hashes correctos.
- Comprobante de ensayo firmado y protegido en B2; recuperación con lector separado y firma pública verificada. No se depende del recibo local para futuras copias.
- Aviso externo de ausencia ensayado: Healthchecks informó correo entregado. Umbral normal restituido a 90 minutos. La cuenta es gratuita; no recibe datos de clientes ni logs.
- Se crearon la app exclusiva de backups y su volumen de 10 GB dentro del presupuesto de backups acordado. Red privada separada, sin servicio HTTP público. Imagen construida en remoto; todavía **sin máquina operativa ni horario activado**. Falta confirmar la actualización de la firma pública en la custodia del titular y verificar arranque/ejecución programada.
- 117 pruebas del paquete de recuperación aprobadas, sin omisiones. Sin cambios al código, imágenes o tamaños de los cinco servicios habituales de staging ni a producción. Evidencia sensible y configuraciones fuera de Git.

## Recuperación del Inbox — validación local, 28/09/2026

Rama `codex/inbox-recuperacion`, basada en `main` después de integrar el PR #7 (`7e58b0735`). Este apartado no acredita todavía un despliegue nuevo.

- Una apertura durante una caída de la API muestra una pantalla de reconexión con la estética de Grafo. Espera hasta diez segundos por la sesión y vuelve a consultar automáticamente; conserva el control de acceso normal.
- Una interrupción con el Inbox abierto conserva en memoria el chat elegido, los filtros y los borradores. No reenvía mensajes automáticamente. Si el usuario reintenta un envío incierto, conserva su clave para evitar duplicados. Una revocación real de sesión/permisos descarta los borradores privados.
- Al apagar Nest se completan tanto los canales del Inbox como los de notificaciones generales. Se evita que sus conexiones HTTP impidan cerrar el servidor. Esto no convierte una única máquina en alta disponibilidad.
- Pruebas locales: 83 comprobaciones web (vista, editor, reconexión, ruta y transporte) y 34 de API/notificaciones; incluyen dos streams HTTP reales abiertos durante el cierre de Nest. ESLint de los archivos modificados y control de CSS. En Chrome, con la API local apagada apareció la pantalla de recuperación; al iniciar la API la misma pestaña volvió al Inbox autenticado sin recarga manual. Las integraciones y las tareas programadas locales permanecieron desactivadas.
- Los borradores sobreviven a la interrupción dentro de la pestaña; no se guardan en almacenamiento persistente del navegador. Cerrar o recargar completamente esa pestaña no está cubierto. No hubo envíos reales a Meta, migraciones ni cambios de recursos.

**Despliegue completado y comprobado a las 19:14 UTC / 16:14 Argentina.** La comprobación remota [CI 36468124321](https://github.com/studiocamaleon/gdi/actions/runs/36468124321) aprobó sobre `c64b203f776868808d2999450cebc77417a06574`: backend/web con tipos, migraciones, permisos y acceso HTTP en servicios desechables. El segundo commit agrega el manejo de un corte durante la lectura de la respuesta HTTP; no cambia el backend.

- Backend, API y ambos workers: código `ce4e06fca19779ae4f7551f35a3e21e27734c523`, imagen `registry.fly.io/grafoprint-staging-api@sha256:ec9736bf77cfda7795832df026cb0ce1731322cdfa2a4259c9e1889f8e6d135c`.
- Aplicación: código `c64b203f776868808d2999450cebc77417a06574`, imagen `registry.fly.io/grafoprint-staging-web@sha256:246e62ad433f32751838e5d148cec4e67775fd22b5b5ea2f2185731d1e1a132e`.
- Se publicó primero la aplicación para comprobar la pantalla de recuperación durante el reemplazo de la API anterior. En Chrome apareció el aviso; al terminar el despliegue la misma pestaña volvió a la sesión autenticada sin recarga ni login. La versión anterior aún demoró su cierre durante ese reemplazo.
- Con la versión corregida instalada, una segunda interrupción controlada envió `SIGTERM` manteniendo el límite de 120 segundos. La orden de detención terminó en **3,53 segundos**; el registro muestra salida por `SIGTERM`, sin `SIGKILL`. Se mantuvo apagada 25 segundos deliberadamente y el comando de arranque terminó en 3,30 segundos. Estas duraciones de comandos no son una garantía de disponibilidad. La pestaña mostró el aviso y volvió automáticamente otra vez.
- Los cinco servicios quedaron iniciados, con los mismos IDs, región y recursos; controles de salud aprobados e imágenes esperadas. Gotenberg no cambió. Salud web/API/base, protección Basic, restricción de la API directa, página de login y rechazo de webhook sin firma aprobaron.
- Comparación de base en transacciones de sólo lectura: **298 migraciones** y sus checksums intactos, ninguna pendiente, mismos IDs/cantidades de empresas, usuarios, conversaciones, mensajes, envíos y archivos. No se aplicaron migraciones ni seeds y no se renovaron secretos.
- El token temporal de Meta ya había vencido a las 15:00 Argentina. La recuperación en staging se acreditó hasta la vista autenticada con el aviso de vencimiento; no se presenta como una nueva prueba de envío ni de chat activo. Borradores y reintento sin duplicados se acreditan con las pruebas locales; los ensayos reales previos del PR #7 siguen documentados abajo.
- Builder temporal `fly-builder-graceful-haze-5428` retirado después de publicar ambas imágenes. No se aumentaron recursos ni se desplegó producción. El [PR #8](https://github.com/studiocamaleon/gdi/pull/8) conserva el arreglo separado; el [plan de producción](../../docs/preparacion-produccion.md) registra el siguiente orden de trabajo.


## Ensayo con dos operadores distintos — 28/09/2026

Continúa el lote funcional `d2677ff2a7bafcff648ee70d5258d3fb5c0692e1`, con las mismas imágenes, 298 migraciones y tamaños contratados. Se usaron dos sesiones independientes de Chrome (normal e incógnita), no dos pestañas de un único usuario.

- **Accesos:** el titular eligió personalmente la clave del segundo usuario ficticio. Su rol contiene únicamente `inbox.atender`: puede entrar al Inbox, pero el panel general y el contexto comercial están restringidos y no aparece el control para administrar la conexión. El administrador conserva sus permisos.
- **Responsables:** transferencia del administrador al operador reflejada en ambas vistas sin recargar, con evento privado que identifica origen, destino y autor. Al finalizar, el operador transfirió la conversación de vuelta al administrador. Responder con otra cuenta no cambió al responsable.
- **Autoría y entrega:** con el operador a cargo, el administrador respondió a las 17:06:42 UTC; luego respondió el operador a las 17:06:55 UTC. Ambos envíos fueron `ACEPTADO` y `DELIVERED`, con autores distintos conservados en los mensajes y visibles internamente. No se agregó una firma al texto enviado al cliente.
- **Notas privadas:** una nota del operador apareció automáticamente en la sesión del administrador, conservó su autor y no creó un envío a Meta ni cambió la fecha del último mensaje de la bandeja.
- **Lectura compartida:** con los chats desplazados hacia mensajes anteriores, una entrada real apareció en el filtro Sin leer del administrador. Al desplazarse el operador hasta los mensajes nuevos, ese filtro quedó vacío también para el administrador, sin recargar. Las revisiones persistidas de entrada y lectura coincidieron al finalizar. No se enviaron confirmaciones de lectura a WhatsApp como parte de esta acción interna.
- **Filtros:** Mías quedó vacío para el administrador después de transferir, aunque había respondido; Participé mantuvo la conversación. El operador combinó Mías + Activas y luego Sin responder. Resolverla desde el operador la quitó de Activas y la mostró en Resueltas en la otra sesión. Una nueva entrada real a las 17:08:38 UTC la reabrió, conservó al responsable y actualizó ambas listas. Sin responder incluyó esa última consulta. La transferencia de vuelta quitó la conversación de Mías del operador. Se limpiaron los filtros de ambas cuentas al finalizar.
- **Credencial de prueba:** el primer intento del operador, a las 16:56:29 UTC, fue rechazado por Meta con `131005`, antes del vencimiento informado de las 17:00 UTC. No se lo reintentó ni se lo presentó como entregado. El titular generó otro token, Graph confirmó aplicación/permisos/perfil y se activó para el mismo canal; vence a las 18:00 UTC / 15:00 Argentina. Tras una nueva entrada real, los dos nuevos envíos mencionados arriba fueron entregados. Renovar resolvió este ensayo; no demuestra la causa exacta ni una solución permanente del rechazo de Meta.
- **Reinicio observado:** al cargar el secreto, Fly demoró unos dos minutos en reemplazar la máquina API. Durante ese intervalo una apertura del Inbox mostró una excepción de servidor y las vistas anteriores cerraron el acceso al vencer/cambiar el canal. Recargar con la API y la nueva autorización activas recuperó ambas sesiones sin volver a ingresar ni perder historial. Mejorar esa pantalla transitoria y el drenaje del reinicio queda como seguimiento operativo; no se amplió infraestructura.
- **Revisión final focalizada:** se revisaron autorización de operadores, aislamiento por empresa/canal, autores, transferencia y conflictos, notas sin envío, lectura por revisión, consultas de filtros, entrega de archivos privados y propagación de eventos. No se identificó un bloqueo nuevo en esos recorridos. La revisión no equivale a auditar todos los endpoints de Meta ni a probar coexistencia. El diff no modifica la web comercial/Grafo3D/Vercel; se retiró de una nota histórica un identificador privado de la empresa de prueba. No se editaron migraciones aplicadas.

Los checks funcionales sobre `0b016d534a7939d1d91b182424735aeba1430fe6` aprobaron, incluidos contenedores, tipos, migraciones y login; los cambios de este ensayo son documentación. Se conserva como antecedente el aviso de espacio en blanco al final de una migración ya aplicada, sin alterar su checksum. Las pruebas reales de archivos del apartado siguiente siguen vigentes. La grabación con micrófono y formatos/navegadores adicionales requieren ensayos separados. No se fusionó el PR ni se modificó producción durante esta comprobación.

## Ensayo real previo al cierre del PR #7 — 28/09/2026

Mismo lote funcional desplegado `d2677ff2a7bafcff648ee70d5258d3fb5c0692e1`, 298 migraciones. No se recompilaron ni desplegaron imágenes, se cambiaron tamaños o se modificó producción durante este ensayo.

- **Acceso:** token temporal renovado personalmente por el titular, verificado con Graph (aplicación, permisos, número, suscripción y perfil HTTP 200), importado únicamente en la API y activado cifrado para la misma empresa/destinatario de prueba. Vence el 28/09 a las 17:00 UTC / 14:00 Argentina. El reinicio de API quedó saludable; se conservó el historial. No se copiaron secretos a la aplicación local ni a Git.
- **Texto:** entrada real desde WhatsApp de escritorio y respuesta desde el editor del Inbox a las 15:21 UTC. Meta aceptó y confirmó `DELIVERED`. El rechazo anterior `131005` no se reprodujo con esta credencial. La primera respuesta aceptada asignó automáticamente la conversación al autor y dejó el evento interno correspondiente.
- **Archivos salientes:** PDF, PNG, audio M4A de tres segundos, video MP4 de tres segundos y sticker WebP sintéticos, cargados y enviados desde la interfaz de Grafo. Los cinco llegaron al WhatsApp receptor, con `DELIVERED` acreditado y copias privadas en estado `LISTO`, sin error. Junto al texto hubo seis envíos aceptados, sin duplicados ni reintentos.
- **Archivos entrantes:** imagen, audio, video y sticker devueltos desde el mismo chat de WhatsApp, más el PDF adjuntado desde el equipo. Los cinco aparecieron sin recargar el Inbox y terminaron `LISTO` con archivo privado. La imagen reenviada llegó como JPEG; se conservó el formato recibido. No se usaron webhooks fabricados.
- **Visores y reproducción:** imagen saliente de 640 × 360 abierta dentro de Grafo; ambos stickers cargados a 512 × 512; audio entrante reproducido hasta el final (tres segundos, sin error); video entrante cargado y reproducción iniciada. PDF entrante de una página renderizado por el visor incrustado. Su descarga desde Grafo mide 1176 bytes y coincide por SHA-256 con el original. El observador automatizado de descarga venció, pero el archivo efectivamente guardado en Descargas acredita la descarga.
- **Validación de entrada:** archivo de texto inerte con extensión no admitida rechazado por el selector de documentos antes de abrir la revisión/envío. No se envió ese archivo a WhatsApp.
- **Notas y estados:** `/nota` guardó una nota privada con autor; no creó un envío a Meta ni cambió el último mensaje de la lista. Cerrar como Resuelta y recibir una nueva entrada real reabrió la conversación automáticamente, conservó al responsable y dejó historial interno. La lectura observada sigue siendo del único usuario existente; no se presenta como prueba entre operadores distintos.
- **Infraestructura:** salud web/API y base correctas, protección privada requerida, API directa restringida y webhook sin firma rechazado. Se mantuvieron los recursos contratados y las cinco aplicaciones.
- **Segundo operador:** tras la autorización del titular, se crearon desde Configuración un rol con sólo `inbox.atender` y un usuario ficticio de la empresa de prueba. El acceso habitual del administrador se conserva; la segunda sesión se preparó en una ventana incógnita y llegó al cambio obligatorio de clave, que debe completar el titular. Todavía no acredita transferencias ni lectura entre usuarios distintos.
- **CI con base actualizada:** `main` se incorporó sin conflictos a la rama; las comprobaciones del PR y del push sobre `0b016d534a7939d1d91b182424735aeba1430fe6` terminaron correctamente ([PR CI](https://github.com/studiocamaleon/gdi/actions/runs/36444669821), [push CI](https://github.com/studiocamaleon/gdi/actions/runs/36444655286)). El diff contra `main` no incluye cambios de la web comercial, Grafo3D ni configuración de Vercel. Esto no modifica la versión funcional instalada en staging.
- **Pendiente para cerrar:** ensayo en dos sesiones con usuarios distintos y revisión final del diff. La grabación con micrófono real y la matriz completa de navegadores/formatos no se acreditan con los archivos sintéticos. No se marcó el PR listo ni se fusionó.
- **Límites de Meta:** el receptor conserva desactivadas sus confirmaciones de lectura; no se infiere `read` de una respuesta. La aprobación/alta pública, coexistencia e importación real de historial siguen siendo ensayos separados. El aviso de facturación de la cuenta de prueba continúa; no impidió estos mensajes dentro de la ventana de atención y no se cambió facturación.

Evidencia detallada, archivos de prueba, claves y capturas permanecen fuera del repositorio. Se omiten números e identificadores privados.

## Diagnóstico de rechazo de envío — 28/09/2026

Mismo código desplegado `d2677ff2a7bafcff648ee70d5258d3fb5c0692e1`, sin cambios de imágenes, migraciones, recursos ni producción.

- **Incidente:** la entrada real de las 07:26:55 UTC se recibió y abrió la ventana de atención. Dos respuestas del usuario fueron rechazadas por Meta con `131005`, sin WAMID. Una única prueba técnica directa expresamente autorizada reprodujo HTTP 403 / `131005`, con detalle de problema de token o permisos. No fue aceptada ni entregada; no se reintentó automáticamente.
- **Autorización anterior:** Graph declaraba token vigente, aplicación correcta, ambos permisos de WhatsApp concedidos, usuario administrador, número perteneciente a la cuenta y app suscripta. La cuenta tenía revisión `APPROVED` y el panel no exigía acciones por restricciones. Sin embargo, la consulta de perfil del mismo número devolvía código `10` (falta de permiso). No se identificó por qué Meta rechazaba esa credencial pese a declararla válida.
- **Credencial nueva:** el nuevo token disponible en el panel conserva aplicación y permisos y permite consultar el perfil (HTTP 200). Se activó a las **07:47:20 UTC**, cifrado en la misma base, conservando el historial; vence a las **09:00 UTC / 06:00 Argentina**. Se actualizó sólo el secreto del operador de API. El reinicio temporal de su única máquina interrumpió la conexión del Inbox; Fly confirmó recuperación saludable. No se copiaron secretos a la configuración de la aplicación local.
- **Pantalla:** después de recargar muestra la nueva vigencia y conserva los mensajes. La renovación abre una generación nueva y exige otra entrada para habilitar respuesta libre; no se modificaron fechas para forzar la ventana. Los intentos rechazados se conservan en la base, sin ofrecerse como envíos de la nueva generación.
- **Verificación HTTP a las 07:47 UTC:** salud web/API y base disponibles; Basic requerido, API directa restringida, login accesible y webhook sin firma rechazado.
- **Aviso separado:** `health_status` informa `141006` de facturación para conversaciones iniciadas por la empresa en la WABA de prueba, tanto con el token anterior como con el nuevo. Eso no acredita la causa de `131005`; no se agregó un medio de pago ni se cambió facturación, publicación o revisión de la app.
- **Pendiente al registrar:** nueva entrada del destinatario y respuesta desde el Inbox, con aceptación y entrega acreditadas por Meta. La consulta de perfil exitosa no demuestra por sí sola que el envío esté resuelto. Resultados crudos y credenciales permanecen fuera de Git; se omiten teléfonos e identificadores privados.

Referencia consultada: [códigos de error y autorización de Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes).

## Lote de Inbox, equipo y medios — 28/09/2026

Código `d2677ff2a7bafcff648ee70d5258d3fb5c0692e1`, [CI completo aprobado](https://github.com/studiocamaleon/gdi/actions/runs/36385216857), [PR #7 en borrador](https://github.com/studiocamaleon/gdi/pull/7), sobre el #5. No se fusionaron PR ni se modificó producción.

- **Alcance del lote:** apertura automática de medios privados, visor PDF e imágenes, audio/video/stickers compactos, grabación con cancelar/enviar, menú de adjuntos y revisión previa; orden por último mensaje, responsables y autoría, notas internas con `/nota`, estados Activa/Resuelta y lectura compartida. Filtros colapsados inicialmente, exclusivos por responsable/estado, combinables entre categorías y limpieza sin desplegarlos. Inbox independiente, sin cabecera duplicada ni botón de actualización manual.
- **Base de datos:** de 295 a **298 migraciones**: `20260928120000_inbox_cargas`, `20260928180000_inbox_equipo` y `20260928200000_inbox_estados_lectura`. Checksums históricos íntegros; migrador separado; permisos de datos de las nuevas tablas/columnas verificados sin DDL, privilegios elevados ni acceso al historial Prisma para el rol de ejecución. Sin seed/reset. Se conservaron los identificadores del tenant, 2 usuarios, 1 conversación, 12 mensajes, 5 envíos y 3 archivos existentes.
- **Backend instalado:** `registry.fly.io/grafoprint-staging-api@sha256:09236f6e89c37a886c42b2625ab1dbb4d306b9c07fb01972d84bde4415433496`, reutilizado por API y ambos workers. Los tres despliegues terminaron correctamente. Gotenberg no cambió.
- **Validación remota:** CI compiló backend y Next con tipos, comprobó las 298 migraciones y el rol limitado en una base desechable, pruebas Meta simuladas y login/BFF. En la API real de Fly se convirtió un audio sintético M4A a OGG Opus mono con el servicio de medios (11296 bytes). No se envió ese archivo a Meta ni se guardó como archivo de la empresa.
- **Canal de prueba:** token renovado personalmente por Lucas, verificado con Graph y activado como nueva generación conservando el historial. Vence el **28/09/2026 a las 08:00 UTC / 05:00 Argentina**. Se actualizó el secreto del operador de API y la credencial cifrada; no se copiaron credenciales de staging a la aplicación local. Esta publicación no envió mensajes nuevos a WhatsApp.
- **Web instalada:** `registry.fly.io/grafoprint-staging-web@sha256:1e756f53b4ddcc8eb9d21a2e4ad6ce5397e789020e5e15bb886c3d602790988f`. Compilación remota con tipos, instalación y controles de Fly aprobados. Las cinco máquinas conservan identificadores, región `gru` y recursos; las imágenes coinciden con el lote y todas están iniciadas con sus comprobaciones de salud aprobadas.
- **HTTP final (07:15 UTC):** web/API saludables, base conectada, Basic obligatorio en rutas privadas, API directa restringida, login accesible con la protección correcta y webhook sin firma rechazado. Se mantuvieron los accesos existentes de la empresa en Chrome.
- **Chrome real:** filtros inicialmente colapsados y sin criterios; responsabilidad y estado exclusivos; combinación Sin asignar + Activas + Sin responder aplicada y colapsada; × limpia sin abrir el panel. Autores históricos visibles para el equipo. Selector de responsables sin modal y presencia neutral, sin estados simulados en staging. `/nota` abre el editor interno y se puede salir sin guardar.
- **Visores:** PDF ficticio existente de una página renderizado dentro de Grafo desde un `blob:` privado, sin descargarlo al disco ni renovar manualmente. PNG histórico recibido como documento cargado automáticamente y ampliado en el visor, resolución comprobada de 1501 × 861. Capturas guardadas fuera de Git. No se subieron ni enviaron archivos nuevos durante esta verificación.
- **Actualización en vivo:** dos pestañas con la misma sesión real de la empresa. Resolver y reabrir cambió el estado en ambas sin recargar y agregó los dos eventos internos con autor y fecha. Se dejó la conversación Activa, sin responsable y sin filtros. La fecha de la lista siguió indicando el último mensaje de WhatsApp, no los eventos internos. Esta prueba no equivale a un ensayo con dos operadores distintos; la lectura compartida y los conflictos entre operadores se comprobaron en integración local.
- **Recuperación del build:** las primeras transferencias fallaron y el fallback HTTPS devolvió 500 de `h2c`. Recrear el builder durante los reintentos perdió la caché. El intento final conservó el builder, usó `--https-failover=false` y completó compilación y transferencia. No se demostró una causa única de las interrupciones. El diagnóstico de conexión de Fly aprobó; no se modificaron el código, TLS ni los recursos para sortearlas.
- **Cierre operativo:** builder temporal `fly-builder-solitary-hollow-7145` eliminado; el inventario final contiene sólo las cinco apps de staging y ningún builder. No se reinició Docker, no se compilaron contenedores en la Mac ni se ampliaron servidores.
- **Límites pendientes:** esta publicación no acredita un intercambio nuevo de audio/video, PDF entrante, grabación desde cada navegador, carga concurrente, Embedded Signup con número de cliente, coexistencia ni importación de historial. La presencia real de operadores, firma visible al cliente, llamadas y reportes son trabajo posterior. Después de renovar el canal, un mensaje entrante nuevo del destinatario habilitado permite probar respuesta libre y adjuntos; no se forzó artificialmente la ventana de atención.

## Adjuntos recibidos y tarjetas compactas — 27/09/2026

Interfaz y corrección de recepción `6e0ac9129402bae0f707aa7ff0f74fee9dde622e`, [CI aprobado](https://github.com/studiocamaleon/gdi/actions/runs/36368110136). Continúa en el [PR #7 en borrador](https://github.com/studiocamaleon/gdi/pull/7), sobre el #5. No se fusionaron PR ni se modificó producción.

- **Recepción:** el archivo real llegaba con tipo de mensaje `document` y MIME `image/png`; la comparación estricta lo enviaba a revisión con `FORMATO`. Ahora se admiten imágenes, audio y video de los formatos conocidos cuando WhatsApp los entrega como documentos. Se conservan tamaño por MIME, firma binaria, hash y descarga autenticada. No se habilitan formatos arbitrarios.
- **Recuperación real:** después de renovar el token y desplegar el worker, se reencoló exclusivamente el PNG afectado, comprobando empresa, canal, destinatario, formato y ausencia de archivo. Se conservó el contador de intentos y se registró en privado el estado anterior y la nueva generación autorizada. Terminó `LISTO`, `image/png`, **105081 bytes**, privado, y la cuota aumentó exactamente ese tamaño una sola vez. La conversación cambió a disponible sin recargar. Chrome abrió la copia de R2: imagen completa de **1501 × 861**.
- **Interfaz:** tarjeta de 300 px, icono, nombre limitado a dos líneas, formato/tamaño y acción en una fila; la vista previa aparece al abrir. También reconoce la imagen cuando el mensaje original es un documento. Revisión visual local con PDF/JPEG ficticios y en staging con el PNG real.
- **Validación local:** 29 pruebas unitarias de media, 15 integradas de adjuntos y 28 de interfaz aprobadas. ESLint y control de CSS aprobados. El chequeo completo de tipos local alcanzó el límite de memoria; las compilaciones remotas de API/web y CI aprobaron sin omitirlo. No se reinició Docker ni se ampliaron recursos.
- **Plantilla PDF:** el catálogo real y el MCP de Meta informan `APPROVED`. El primer intento desde Grafo se detuvo con `409` antes de reservar un envío: dos consultas reales devolvían distinta URL en `components[0].example.header_handle[0]`. La corrección excluye las muestras de la versión, conservando formato, texto, estado, categoría y acciones. Sus 17 pruebas unitarias pasan, y las dos respuestas reales ahora producen la misma versión. La corrección quedó desplegada en API y ambos workers desde `44cf17135fed87a0d61e4e7b1256190ff4c4ee2e`, con [CI completo aprobado](https://github.com/studiocamaleon/gdi/actions/runs/36369051527).

- **PDF real desde el Inbox:** el operador preparó un archivo ficticio de 1176 bytes mediante el servicio normal de archivos, asociado al cliente de prueba y privado; no se subió desde la ficha de cliente. En Chrome se eligió la plantilla aprobada, sus dos valores y ese archivo. Hubo un único envío efectivo: `sent` a las **02:22:12 UTC del 28/09** y `delivered` a las **02:22:13 UTC**, ambos correlacionados y procesados. La interfaz pasó a Entregado sin recargar. La copia saliente del Inbox quedó `LISTO` en R2, con SHA-256 idéntico al original. Lucas confirmó apertura correcta en el celular.
- **Apertura desde Grafo:** Chrome descargó el PDF desde la tarjeta del Inbox: 1176 bytes, idéntico al original por SHA-256. La descarga ocurrió aunque el observador automatizado no capturó el evento; se comprobó en Descargas y en los archivos guardados. La imagen tiene vista previa en el chat; el PDF se descarga, no tiene visor incrustado. Una nueva entrada real del destinatario apareció y abrió la ventana de respuesta. La muestra local de diseño se cerró para dejar a Lucas en el Inbox real de staging.
- **Versiones finales:** backend `registry.fly.io/grafoprint-staging-api@sha256:7a75429b65683ca4fdd62960fe7f6433951cac8eb8cfb435a91e53dedb69e343` (API y ambos workers, código `44cf17135`); web `registry.fly.io/grafoprint-staging-web@sha256:e3d649dfff8882879828d2a20ed47de5412eafeb4a72ed576b67a2aa326e19ab` (código `6e0ac9129`; el cambio posterior sólo afecta al backend). Salud web/API aprobada. Mismas máquinas, región y tamaños; 295 migraciones, sin cambios de esquema. Gotenberg y producción no se modificaron. Builder temporal `fly-builder-wistful-grass-5617` eliminado.
- **Credenciales:** token renovado por Lucas, guardado cifrado para la nueva generación y actualizado en el secreto del operador de API. Vencimiento **28/09/2026 03:00 UTC / 00:00 Argentina**. No se copiaron credenciales reales al entorno de la aplicación local. No se modificó la revisión de Meta.
- **Alcance:** se probaron PNG entrante como documento y PDF saliente por plantilla. Audio/video, PDF entrante nuevo, carga concurrente, coexistencia e historial necesitan sus propios ensayos. El usuario indicó que sus confirmaciones de lectura están apagadas; no se inventó un estado `read`. La carga manual de archivos en la ficha del cliente todavía no tiene interfaz; el selector sí acepta archivos preparados por el servicio y PDF comerciales emitidos. No se valida esa carga manual mediante la preparación de la muestra.

La referencia de [media de Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media) se consultó el 27/09 (actualización indicada: 16/06/2026). La combinación `document`/PNG se comprobó en el webhook y la descarga reales; no se deduce de la lista de formatos de envío.


## Ensayo de texto anterior — 27/09/2026

Código desplegado `246bf36b5203de4004ae8b007bfcbff47c649c9a`, [CI aprobado](https://github.com/studiocamaleon/gdi/actions/runs/36346485240), [PR #7 en borrador](https://github.com/studiocamaleon/gdi/pull/7), dependiente del #5. API, web y ambos workers corresponden al mismo lote. No se fusionaron PR ni se modificó producción.

- **Neon:** 295 migraciones; última `20260927210000_inbox_destino_prueba`. Aplicación aditiva, permisos del rol de ejecución comprobados, sin seed/reset. Se conservan conversaciones e intentos anteriores.
- **Backend:** `registry.fly.io/grafoprint-staging-api@sha256:8e90fad026a371c46fb85acdcd4242a5b54ce88f868c19006b93c5e43dc3826f` (API y ambos workers).
- **Web:** `registry.fly.io/grafoprint-staging-web@sha256:8cea2d18892299621041c9b9c108249627aa0cfe24aac73be3f7557a7dc002e6`.
- Las cinco máquinas conservan tamaños/región; Gotenberg sin cambios. Salud HTTPS de web/API aprobada y máquinas actualizadas iniciadas. El builder temporal fue eliminado al terminar. El primer build web en Fly falló en `next/font`; la repetición del mismo código aprobó, al igual que GitHub, sin omitir tipos.
- Corrección local: **119 pruebas API** entre la corrida y la repetición del spec ajustado; **30 pruebas web**, TypeScript API/web y ESLint aprobados. Comprueba destino explícito distinto del identificador, recepción/estados canónicos, cambios de configuración antes del POST, renovación y datos inválidos. No hace llamadas reales a Meta desde los tests.
- Token renovado personalmente por Lucas y comprobado con Graph. Canal PRUEBA activado, vencimiento **27/09/2026 22:00 UTC (19:00 Argentina)**. El aviso muestra la hora en formato de 24 horas. La relación exacta entre destino de envío e identidad del contacto queda sólo en configuración privada.
- **Ensayo real DEMO-0004 desde Chrome:** una plantilla de texto aceptada, `sent` y `delivered` recibidos por webhook. La entrada real del destinatario apareció en las dos pestañas sin recargar y abrió la ventana de 24 horas. Una respuesta libre desde Grafo también fue aceptada y entregada; ambas pestañas actualizaron el contenido y los checks automáticamente. Al recargar una de las pestañas se recuperaron los mensajes y estados conservados, sin reenviar.
- Los estados se verificaron por el WAMID y correlación del intento, cuenta, número y destinatario exactos; trabajos completados. El intento DEMO-0003 rechazado con 131030 se conserva en el registro: no se borró ni reintentó automáticamente. Al renovar la generación, los intentos de la generación anterior ya no se ofrecen como envíos actuales en la pantalla.
- **No se recibió `read` al cierre del ensayo:** no se infiere lectura de una respuesta. Los crudos de esta cuenta se revisaron también sin filtrar por empresa: cuatro estados `sent`/`delivered` para los dos envíos del ensayo, sin `read`, sin estados descartados ni errores de procesamiento. El soporte de `READ` está validado en local; para comprobarlo realmente hace falta un receptor que comparta confirmaciones de lectura. Ver [referencia de estados de Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status) y [privacidad de las confirmaciones](https://faq.whatsapp.com/665923838265756/). La plantilla PDF sigue `PENDING`, consultada también mediante el MCP oficial. Quedan aparte el ensayo de archivos, la conexión real por Embedded Signup, coexistencia y sincronización de historial con un número elegible.

Los apartados siguientes son registros históricos y pueden describir versiones o pendientes ya superados por este resultado.

## Inbox desplegado y primer ensayo — 27/09/2026

Versión `ca59f3a242d32d417cfc122791f4b40744a255b1`, [PR #7 en borrador](https://github.com/studiocamaleon/gdi/pull/7), dependiente del #5. [CI remoto aprobado](https://github.com/studiocamaleon/gdi/actions/runs/36344054206): backend/Next con tipos, migraciones, permisos y login/BFF. No se fusionaron PR ni se cambió producción.

- Neon: de 283 a **294 migraciones**, comprobados los checksums existentes y los permisos del rol de ejecución. Sin seed/reset.
- API y ambos workers: `registry.fly.io/grafoprint-staging-api@sha256:db1fa0efb94805cdb24e1bf294cba65bede09643837c335901a92df2f7ac26e1`.
- Web: `registry.fly.io/grafoprint-staging-web@sha256:d359fe6dafbf3f4771b968c3daa43f4cbadca16168ad5642083c91c233ff0977`.
- Las cinco máquinas conservan identificadores, región y tamaños; Gotenberg no cambió. Builder temporal eliminado. Salud web/API aprobada, Inbox abierto en Chrome con sesión real de la empresa demo.
- Canal PRUEBA activado tras verificar token, activos y suscripción en Graph; credencial cifrada y clave de cifrado concordante entre API/worker. No se crearon autorizaciones Embedded Signup, altas ni historiales ficticios. Piloto anterior apagado.
- Envío de plantilla de texto desde el Inbox: **rechazado, código Meta 131030, sin WAMID ni entrega**. El intento aparece en otra pestaña sin recargar. Se conserva el registro y no se reintenta automáticamente.
- Diagnóstico: Meta recibe en el webhook una identidad distinta del formato que aceptó en el envío anterior desde su lista de destinatarios de prueba. La corrección separa ambos campos sólo en PRUEBA, sin reglas globales por país ni cambios en la identidad de la conversación.
- **Pendiente:** desplegar la corrección y repetir el ensayo real. El token inicial vence el 27/09 a las 20:00 UTC; renovarlo antes del ensayo. Entrega, lectura y respuesta desde este Inbox todavía no están acreditadas. La plantilla con PDF sigue pendiente de aprobación.

Las secciones anteriores en el tiempo que siguen describen el estado de cada momento, no el despliegue actual.

## Lote Inbox y canal de prueba — local, 27/09/2026

Backend del canal `a248d97c6`, rama `codex/inbox-canal-pruebas`. Implementación y límites en [meta-inbox-canal-prueba.md](../../docs/meta-inbox-canal-prueba.md). **No desplegado ni activado todavía:** Fly conserva el piloto y Neon conserva las 283 migraciones registradas abajo.

- Desarrollo y tests: 294 migraciones, sin seed/reset; comprobados lectura y permisos de escritura de las columnas nuevas con el rol de ejecución local.
- Meta API: 464 pruebas aprobadas entre la corrida general y la repetición de los archivos ajustados. Incluye 19 pruebas nuevas del canal y un caso nuevo de adjuntos con destinatario permitido/ajeno. Graph simulado, PostgreSQL/Redis locales.
- Interfaz: 69 pruebas, TypeScript API/web, ESLint de los archivos modificados y control de CSS aprobados. Revisión en Chrome en temas claro y oscuro con datos ficticios; API y web locales saludables.
- Firma, cola, deduplicación, ventana de 24 horas, plantillas, entrega/lectura, dos suscripciones SSE con buses separados, vencimiento, permisos, aislamiento y renovación comprobados localmente.
- Falta compilación de contenedores en remoto y recorrido real completo en staging. El workflow se habilitó para esta rama; no recibe secretos cloud ni despliega. No confundir esta evidencia local con la prueba real del piloto documentada en [meta-prueba-plantillas.md](../../docs/meta-prueba-plantillas.md).

## Lote local posterior: recepción Meta (sin desplegar)

`codex/meta-recepcion-piloto` prepara la bandeja de recepción interna. La migración `20260925223000_meta_recepcion_piloto` se probó sólo en una base local desechable con 284 migraciones. Neon conserva las 283 migraciones y Fly conserva `7efabd87213e`; no se importó el interruptor de recepción. Ver pruebas y procedimiento de activación en [meta-recepcion-piloto.md](../../docs/meta-recepcion-piloto.md). El [CI remoto 36195604016](https://github.com/studiocamaleon/gdi/actions/runs/36195604016) aprobó API/Next con tipos, migraciones y permisos, ensayos Meta y login/BFF sobre `715c7084346cad30addc149fe0856bdb815a1b7d`. También pasaron 60 pruebas API, 4 de interfaz, TypeScript frontend y revisión visual local con datos ficticios. El código está en el [PR #5 en borrador](https://github.com/studiocamaleon/gdi/pull/5), dependiente del #4. Esta nota no acredita recepción real ni coexistencia.

Ensayos con el Compose aislado `grafoprint-staging-local`, en la Mac y en un ejecutor temporal de GitHub, y comprobaciones posteriores contra los proveedores de staging. Todos usaron datos sintéticos. Las credenciales cloud se usaron desde la Mac y desde las máquinas Fly a través de su almacén de secretos; no se incorporaron al repositorio ni al workflow.

## Comprobaciones locales

Comprobado:

- Compilación Nest con chequeo de tipos en Node 24 del host.
- TypeScript de la aplicación web con `--noEmit --incremental false`.
- ESLint de los archivos TypeScript modificados.
- En la preparación inicial: siete pruebas existentes del BFF, todas aprobadas. La ampliación de acceso privado se detalla debajo.
- Sintaxis de los cinco manifiestos TOML y de Docker Compose.
- Las **280 migraciones** aplicadas desde cero en PostgreSQL 16, como dueño de base sin superusuario.
- Rol de ejecución sin superusuario, creación de roles ni `BYPASSRLS`; permisos de DML sobre tablas actuales y futuras.
- Rechazo de creación de tablas y lectura de `_prisma_migrations` con el rol de ejecución.
- Bootstrap repetible sin cambiar contraseña/nombre; rechazo de un segundo administrador, elevación de usuarios y reactivación de usuarios inactivos.
- Bootstrap ejecutado sin entregar la variable de conexión del migrador.
- Rechazo de nombre de base/esquema distintos del destino explícito y exclusión de los archivos de secretos de Git.
- Imagen de backend Linux amd64 construida; carga de Node, Prisma, sharp y el módulo ESM de geometría comprobada dentro del contenedor.
- Python 3.12, compas_nest, SciPy y ezdxf importados correctamente en esa imagen.
- Repetición de migraciones (sin pendientes), creación/verificación del rol, bootstrap y ensayo de permisos también ejecutados dentro de la imagen Linux.
- API iniciada en modo producción: salud, autenticación directa del administrador, cierre de sesión y rechazo del registro público.
- Worker de geometría: trabajo de cinco piezas procesado con el motor `collision`, sin solapamientos y respetando la separación. No equivale a validar todos los motores de geometría.
- Worker PDF iniciado y conectado; Gotenberg produjo un PDF real con Chromium a partir de HTML sintético.
- Subida y descarga mediante URLs firmadas del driver R2 contra S3Mock, con eliminación del archivo de ensayo.

La imagen backend se construyó con `SKIP_TYPECHECK=true` después de los chequeos nativos anteriores, por el límite de 4 GB de Docker Desktop. El build habitual y los manifiestos Fly mantienen el chequeo de tipos habilitado.

Los intentos de compilación web en la Mac no se completaron; por indicación del usuario no se reinició Docker ni se aumentó su memoria. La Mac dispone de 8 GB físicos y Docker de 4 GB, compartidos con otros proyectos. La compilación y el ensayo HTTP pendientes se completaron posteriormente en GitHub, como se detalla abajo.

## Validación remota de contenedores

El workflow [staging-validation.yml](../../.github/workflows/staging-validation.yml) **aprobó** sobre el commit `231132d98079ac2a8ead5870763ec25a1a59ce9b`: [ejecución de GitHub Actions](https://github.com/studiocamaleon/gdi/actions/runs/36078608771).

- Backend Linux amd64 compilado con chequeo de tipos habilitado.
- Imagen Next standalone compilada con chequeo de tipos habilitado. La primera ejecución detectó que faltaba `scripts/postcss-heroui-scope.cjs` en el contexto y en la imagen de build; se incluyó específicamente ese archivo y la segunda ejecución aprobó.
- Base temporal PostgreSQL 16: migraciones, rol de ejecución, bootstrap y comprobaciones de permisos aprobados.
- Contenedores API y Next iniciados y saludables; `/login` respondió correctamente.
- Autenticación del administrador por HTTP directa y mediante Next/BFF, cierre de sesión y registro público cerrado: aprobados.
- Servicios temporales detenidos al terminar; no se cargaron claves cloud, publicaron imágenes ni desplegaron aplicaciones Fly.

La prueba HTTP inicial no recorría la interfaz en un navegador ni validaba cookies, MFA, SSE, proxy/IP o la integración con los proveedores reales.

La ampliación del acceso privado aprobó sobre el commit `4f0cfa25c76f727a985e09122888a0e5f435e4d7`: [ejecución de GitHub Actions](https://github.com/studiocamaleon/gdi/actions/runs/36082768460). Repitió ambas compilaciones con chequeo de tipos, las migraciones/roles y el arranque HTTP. Comprobó rechazo del acceso anónimo a páginas, archivos y BFF; `noindex` y robots; rechazo del acceso directo a la API sin la credencial interna; login interno/BFF con IP de Fly simulada y cabeceras falsas del cliente; logout y registro público cerrado.

Además aprobaron **42 pruebas unitarias web y 28 de API** del acceso de staging, BFF, ruteo y tratamiento de IP. TypeScript de la web y ESLint de los archivos modificados aprobaron localmente. El intento adicional de TypeScript de API en el host agotó el heap; no se amplió Docker ni se repitió allí: el build de API con chequeo de tipos en GitHub sí aprobó.

El ensayo de Compose simula `Fly-Client-IP`; la verificación posterior del proxy real se detalla debajo. El recorrido en navegador, MFA y SSE siguen pendientes.

La validación final de contenedores aprobó sobre el commit desplegado `9e2a67c2881f66346b9290f57271e7859fc8e848`: [GitHub Actions 36083820597](https://github.com/studiocamaleon/gdi/actions/runs/36083820597). Repitió ambas compilaciones con tipos, migraciones, roles y login/BFF. Agregó creación de cookie `Secure`, `HttpOnly`, `SameSite=Lax`, renderizado SSR de `/backoffice/seguridad` y eliminación de la cookie al salir.

También quedan pendientes el documento generado desde un flujo funcional de la aplicación, los demás motores de geometría y el recorrido completo en navegador. El ensayo de PDF anterior valida el servicio de renderizado, no toda la cola de documentos.

### Corrección del primer acceso del administrador

El commit `2f1d05b79a8efe20717db121e1bbe00fec8958eb` aprobó [GitHub Actions 36090326663](https://github.com/studiocamaleon/gdi/actions/runs/36090326663): ambas imágenes compiladas con tipos, 280 migraciones, rol limitado, bootstrap y ensayo HTTP en una base temporal con usuario ficticio.

El ensayo adicional comprobó la pantalla SSR `/backoffice/cambiar-clave`, las redirecciones desde `/cambiar-clave`, `/plataforma` y `/backoffice/seguridad`, el rechazo de una clave actual incorrecta y de reutilizar la provisoria, el cambio válido, el rechazo de login con la contraseña anterior y el reingreso con la nueva. Después del cambio, MFA siguió siendo obligatorio y la consola respondió `403`. La clave del administrador cloud no se cambió en estos ensayos.

También aprobaron 28 pruebas de proxy/acceso de staging y 13 del guard de plataforma/autenticación, TypeScript web y ESLint de los archivos modificados. El caso con MFA ya completa verifica que una clave provisoria siga bloqueando la consola; al cambiarla se vuelve a consultar el estado vigente del usuario. Las sesiones de plataforma siguen sin acceder a rutas de tenant.

## Conexiones a proveedores reales desde la Mac

Comprobaciones iniciales realizadas el 24 de septiembre de 2026, antes del despliegue Fly:

- **Neon:** base vacía confirmada antes de aplicar las 280 migraciones. Rol SQL `grafoprint_staging_app` sin superusuario, creación de base/roles, `BYPASSRLS` ni permiso `CREATE` en `public`. Conexión agrupada del rol de ejecución validada. Inserción, consulta, actualización y eliminación de un usuario ficticio dentro de una transacción revertida. Lectura del historial Prisma denegada realmente, sin datos de ensayo persistentes. No se ejecutó seed. Después se creó el administrador inicial con el rol de ejecución, sin entregar la conexión del migrador al bootstrap. Se comprobó que está activo, con rol `ADMIN` y cambio obligatorio de contraseña. Contraseña inicial guardada sólo en el directorio privado; primer ingreso, cambio de clave y MFA pendientes.
- **Redis Cloud 8.6.2:** conexión `rediss://` con certificado validado por Node 24, sin desactivar comprobaciones TLS ni agregar una CA privada. Queue, Worker y QueueEvents de BullMQ usaron las funciones de conexión compiladas de Grafoprint. Un trabajo sintético falló deliberadamente una vez, se reintentó y produjo el resultado esperado en el segundo intento. Cola exclusiva temporal eliminada; no se borraron otras claves. Esto no prueba caída de máquina, failover ni restauración.
- **R2:** driver compilado de Grafoprint contra bucket US privado, con token limitado a ese bucket. Subida PUT y descarga mediante firmas, HEAD de tamaño, multipart de dos partes (8 MiB + 1 KiB), exposición de `ETag`, preflight del origen de staging permitido, otro origen sin permiso CORS y descarga sin firma rechazada. Objetos temporales eliminados y su ausencia comprobada. La prueba envía las cabeceras HTTP de CORS; no sustituye el recorrido de la interfaz en navegador.
- **Fly:** cinco apps creadas, todas con lista de máquinas vacía. API tiene diez variables en estado `Staged`, ambos workers nueve cada uno y Next las tres variables de acceso privado. Gotenberg no recibe claves; ninguna app recibe la conexión del migrador. Todavía no se cargaron imágenes ni se asignaron IP/DNS.

Los accesos y el registro local de estas comprobaciones están en un directorio privado fuera de Git. Se cerraron los formularios temporales de captura y sus servidores locales.

La etapa cloud posterior activó las cinco máquinas Fly y Neon Launch con el [presupuesto autorizado](./PRESUPUESTO.md). No tomar el estado inicial anterior como inventario actual.

La documentación de [TLS de Redis Cloud](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/) incluye autoridades privadas antiguas y una raíz pública GlobalSign. La conexión probada aceptó la cadena con el almacén normal de Node; esa validación también aprobó posteriormente dentro de la imagen desplegada.

## Despliegue y pruebas desde Fly

Completados el 24 de septiembre de 2026 en Argentina (25 de septiembre en los registros UTC). Una máquina iniciada por app, región `gru`, sin escalado adicional:

| App | Máquina | CPU compartida / RAM |
| --- | --- | --- |
| grafoprint-staging-web | `683d195da310e8` | 1 / 1 GB |
| grafoprint-staging-api | `2863067f3ee498` | 1 / 2 GB |
| grafoprint-staging-worker | `811d35db955998` | 2 / 4 GB |
| grafoprint-staging-worker-pdf | `2874693f49d068` | 1 / 1 GB |
| grafoprint-staging-pdf | `080e9dddcd2608` | 1 / 1 GB |

Imágenes de backend y Next compiladas por un builder remoto Fly con chequeo de tipos habilitado, sin Depot ni Docker local. El contexto de compilación se acotó a los archivos necesarios y excluyó secretos y dependencias del host. El builder temporal `fly-builder-unfurling-raindrop-8617` fue eliminado al finalizar.

- Backend desplegado: `registry.fly.io/grafoprint-staging-api@sha256:9deac1ad0ea89d2fa3748cf0a96edefef1b276c0a12b8733f33b63c02025dccf`. Reutilizado en API y ambos workers.
- Web desplegada: `registry.fly.io/grafoprint-staging-web@sha256:277c5f31b2094e3acc8209bd5f121769c03fe00a2a2fca99aa61c0854b5154e7`.
- Gotenberg fijado por digest en su manifiesto. Su configuración no acepta las formas `::`/`[::]` ensayadas; se corrigió a `API_BIND_IP=0.0.0.0`, que permite el acceso probado por la red privada de Fly. `TINI_SUBREAPER=1` evita el aviso de recolección de procesos. Health check HTTP `/health` aprobado; no hay IP ni servicio público de PDF.

Resultados desde la máquina API usando sus secretos de ejecución, sin clave de migrador:

- **PostgreSQL:** conexión agrupada con TLS, DML sintético en transacción revertida y denegación de DDL/historial Prisma.
- **Redis:** TLS validado normalmente; Queue, Worker y QueueEvents de BullMQ completaron un trabajo sintético con fallo deliberado inicial, reintento y resultado esperado. Cola exclusiva eliminada.
- **R2:** PUT/GET firmados, HEAD, multipart de dos partes, CORS del origen permitido, rechazo de otro origen y de acceso anónimo; objetos sintéticos eliminados.
- **Gotenberg:** PDF real por dirección `.internal`, encabezado `%PDF-` y 14.868 bytes. No equivale a probar el flujo completo de documentos de Grafoprint.

Resultados HTTP contra las apps `.fly.dev` con certificados válidos:

- Salud web/API `200`; páginas, archivos y BFF sin Basic `401`, con `noindex`; rutas privadas de API sin credencial interna `403`.
- Login del administrador por BFF `201`, cookie `Secure`/`HttpOnly`/`SameSite=Lax`, pantalla SSR de seguridad `200`, contexto de plataforma `200` y logout con eliminación de cookie.
- Solicitud con origen ajeno rechazada `403`.
- Intentos de inyectar `Fly-Client-IP`, `X-Forwarded-For` y cabeceras internas con una IP ficticia no sustituyeron la IP observada por la API. Comprobación del registro correspondiente por identificador de solicitud: IP válida y diferente de la falsa, token interno eliminado y autorización redactada. No se publicó la IP real ni claves.

## DNS, acceso inicial y límites pendientes

Configuración actual en Donweb, TTL 900:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| A | pruebas.grafoprint.com.ar | 66.241.125.194 |
| AAAA | pruebas.grafoprint.com.ar | 2a09:8280:1::19a:e4e7:0 |
| CNAME | api-pruebas.grafoprint.com.ar | rknkl93.grafoprint-staging-api.fly.dev. |
| A | staging.grafoprint.com.ar | 66.241.125.194 |
| AAAA | staging.grafoprint.com.ar | 2a09:8280:1::19a:e4e7:0 |
| CNAME | api-staging.grafoprint.com.ar | rknkl93.grafoprint-staging-api.fly.dev. |
| TXT | _fly-ownership.staging.grafoprint.com.ar | app-kjwj93o |
| TXT | _fly-ownership.api-staging.grafoprint.com.ar | app-rknkl93 |
| CNAME | _acme-challenge.staging.grafoprint.com.ar | staging.grafoprint.com.ar.kjwj93o.flydns.net. |
| CNAME | _acme-challenge.api-staging.grafoprint.com.ar | api-staging.grafoprint.com.ar.rknkl93.flydns.net. |

El CNAME inicial de la web se sustituyó por A/AAAA directos, modalidad recomendada por [Fly para conexión directa](https://docs.fly.io/networking/custom-domain/). No se cambiaron los registros de la web comercial, correo ni delegación del dominio.

Comprobaciones adicionales del 24 de septiembre, aproximadamente 23:25–23:40 de Argentina:

- Consultas directas a los DNS de Donweb/Hostmar respondieron con los registros actuales; también consultas con mayúsculas y minúsculas. Hubo algunos tiempos de espera TCP entre las consultas, sin respuestas con datos incorrectos.
- La delegación consultada en `e.dns.ar` apunta a `ns1.donweb.com` y `ns2.donweb.com`. Esos nombres resuelven a las mismas direcciones que `ns3.hostmar.com` y `ns4.hostmar.com`, que figuran en la zona. No se cambió la delegación por esa diferencia de nombres.
- Desde la máquina API, consultas explícitas a los dos DNS autoritativos y a Google devolvieron CNAME/TXT/ACME correctos. Una consulta CNAME a `1.1.1.1` dio `ENOTFOUND`, mientras otras consultas respondían correctamente. Se solicitó refresco en la herramienta pública de caché de Cloudflare para A, AAAA, CNAME, TXT de propiedad y ACME de ambos subdominios. Después, consultas DNS sobre HTTPS desde Fly devolvieron A/AAAA/CNAME correctos.
- El validador Fly reconoció la web como `configured=true`/`Awaiting certificates` y luego volvió a informar ausencia de registros. También se observó `http_configured=true` después de pasar a A/AAAA. No hay aún certificado emitido. La consulta `check` puede variar entre validadores o cachés; el resultado positivo aislado no demuestra que HTTPS esté listo.
- El diagnóstico externo recomendado por Fly, Let's Debug, informó `NoRecords` tanto antes como después del ajuste. [Resultado de la última consulta](https://letsdebug.net/staging.grafoprint.com.ar/3173274). Esta diferencia con los DNS consultados impide atribuir el problema exclusivamente a Fly o afirmar una causa definitiva.

### HTTPS resuelto en los dominios originales

**`staging.grafoprint.com.ar` y `api-staging.grafoprint.com.ar` quedaron Ready/active**, con certificados RSA/ECDSA de Let's Encrypt emitidos el 25 de septiembre a las 02:55 UTC y vencimiento el 24 de diciembre de 2026. Fly administra su renovación automática mientras se mantengan los DNS y la validación.

Como diagnóstico se publicaron primero los DNS de `pruebas.grafoprint.com.ar` y `api-pruebas.grafoprint.com.ar`, se comprobó su resolución y sólo después se agregaron a Fly. También obtuvieron certificados. Se ensayó temporalmente el acceso con esos nombres; al confirmar la emisión para los originales, se restauraron las URLs originales en web, API, workers y CORS de R2. Los registros/certificados auxiliares permanecen como evidencia de diagnóstico; no son las direcciones de acceso.

El dominio raíz pasó [Let's Debug](https://letsdebug.net/grafoprint.com.ar/3173295); el [nombre nuevo](https://letsdebug.net/pruebas.grafoprint.com.ar/3173301) resolvió sus direcciones en ese mismo servicio antes de emitirse el certificado, a diferencia del `NoRecords` de `staging`. El diagnóstico HTTP de ese instante todavía fallaba porque no había certificado; después se verificó HTTPS directamente con la validación TLS normal. La resolución de `staging` también se observó correcta desde múltiples países en What's My DNS.

Estos resultados son compatibles con caché negativa de los nombres originales; no prueban cuál de los componentes la conservaba ni que crear los nombres auxiliares haya causado su desbloqueo. No fue necesario migrar el DNS global ni comprar/importar un certificado. Según [Fly](https://docs.fly.io/networking/custom-domain/#use-your-own-certificate), la importación también exige validar propiedad.

Los ajustes temporales y la restauración reutilizaron las imágenes existentes y las mismas cuatro máquinas, sin compilar ni aumentar capacidad. Gotenberg conserva su configuración. R2 mantiene el bucket privado y sólo permite el origen original de staging.

Pruebas HTTP en los dominios auxiliares y repetidas en los originales después de restaurar la configuración, con TLS validado:

- Salud web/API `200`; acceso web/BFF sin Basic `401`; API sin credencial interna `403`.
- Login de plataforma `201`, cookie `Secure`/`HttpOnly`/`SameSite=Lax`, pantalla de seguridad SSR `200`, contexto de plataforma `200`, logout y eliminación de cookie correctos.
- Origen ajeno rechazado `403`.
- Preflight de R2 con el origen exacto devuelto y origen ajeno rechazado; el origen auxiliar se eliminó al restaurar la configuración. Este chequeo no repitió multipart ni el flujo de archivos completo desde el navegador.
- **Incidencia de primer acceso observada antes de la corrección descrita debajo:** `/cambiar-clave` con sesión de plataforma responde `307` a `/plataforma`. `src/proxy.ts` limita esas sesiones al backoffice/plataforma; la pantalla de seguridad ofrece MFA pero no cambio de contraseña. El verificador inicial falló esa aserción; el diagnóstico posterior conservó la limitación y completó los demás chequeos. No se cambió la contraseña ni se da por aprobado ese recorrido.
- **Bloqueo de Chrome observado antes del acceso descrito debajo:** la apertura del login devolvió `ERR_BLOCKED_BY_CLIENT`, incluso tras recargar. Ocurrió también al abrir `/api/health` en el dominio original, que responde `200` sin Basic en el ensayo HTTP; no se identificó la causa del bloqueo del navegador. No se desactivaron extensiones ni protecciones. Los ensayos HTTP anteriores sí usaron autenticación válida por HTTPS.

### Primer acceso corregido y comprobado en staging

El código `2f1d05b79a8e` se compiló remotamente con chequeo de tipos y se desplegó después de aprobar el ensayo de GitHub. Se mantuvieron las cinco máquinas, sus identificadores, región y tamaños. API y ambos workers usan el mismo backend; Gotenberg no se modificó. El builder temporal `fly-builder-noble-tree-8917` fue eliminado al terminar.

Imágenes del arreglo de primer acceso (la web fue actualizada posteriormente; ver última sección):

- Backend: `registry.fly.io/grafoprint-staging-api@sha256:5513e09cd1be961b5ae7497d245015f70a9a690f0faf19450b0137d9e5bd71d4`.
- Web: `registry.fly.io/grafoprint-staging-web@sha256:db1eb97acfefc52624c0ac597a41e77bd336beda989ca24d85cc3ba7a0257ee7`.

El verificador HTTP por los dominios originales aprobó salud, acceso privado, login de plataforma, cookie segura, pantalla de cambio de clave `200`, redirección de las tres entradas al cambio de clave, contexto con clave/MFA pendientes, consola `403`, rechazo de origen ajeno y logout con eliminación de cookie. Usó TLS normal y la clave inicial existente; no eligió una nueva contraseña para el usuario.

En Chrome, Lucas abrió manualmente la página y confirmó que aparecía el diálogo de usuario/contraseña. Tras completar HTTP Basic se vio el login de Grafoprint. Con la versión nueva se ingresó con la cuenta inicial y la pantalla «Elegí tu clave» apareció en `/backoffice/cambiar-clave`. Se dejó la clave provisoria cargada y se entregó el control a Lucas antes de introducir la nueva. No fue necesario desactivar extensiones ni protecciones del navegador. El fallo de automatización se superó; no se atribuye a una extensión específica.

Lucas confirmó que guardó su contraseña personal y la pantalla cambió a «Protegé tu acceso»; se verificó esa pantalla en Chrome. Luego Lucas completó MFA y accedió a la consola; se comprobó la fila del administrador con «MFA activada» y una sesión activa. Su nueva contraseña, QR y códigos de recuperación no fueron solicitados ni almacenados por el agente.

No se desactivó la validación TLS, no se enviaron credenciales por HTTP y no se cambiaron registros de la web comercial o correo.

Neon Launch quedó a 0,25 CU fijos tanto en el cómputo actual como en los valores predeterminados; historial de restauración de un día y notificación de gasto de USD 20. El administrador inicial existe; login HTTP y llegada al formulario de cambio de clave en Chrome comprobados. Lucas ya eligió su contraseña y completó MFA. El acceso privado y sus credenciales iniciales están en un archivo local fuera de Git.

Orden de continuación:

1. Con la empresa ficticia y su administrador activados, verificar archivos, PDF desde la aplicación, cálculos y eventos SSE.
2. Medir carga, memoria, conexiones y resultados grandes; probar interrupción y recuperación de trabajos y restauración de Neon antes de usar datos reales.
3. Al implementar WhatsApp, revisar la declaración de Redis como proveedor si recibe datos de Meta. Staging todavía no incorpora la integración directa de WhatsApp.

Las pruebas actuales validan el despliegue y componentes básicos; no acreditan disponibilidad de producción, capacidad por tenant ni recuperación ante desastres.

## Empresa ficticia de staging

Se creó desde la interfaz autenticada «Gráfica Demo — Staging», slug `grafica-demo-staging`. El directorio confirmó acceso operativo, plan Trial, suscripción activa/manual y cero usuarios habilitados. La ficha confirmó 3 usuarios, 50 órdenes al mes y 2 GB; facturación electrónica, WhatsApp, centro de copiado e impresión directa no incluidos. El correo elegido es sintético (`admin@grafoprint-demo.example.invalid`); la invitación está pendiente y no hay `RESEND_API_KEY` configurada en la API de staging, por lo que no se enviaron correos. No se conectó ningún medio de pago. El alta utilizó el aprovisionamiento normal y dejó la auditoría correspondiente.

La empresa ya existe; no repetir el alta ante el aviso de correo sin confirmar. El staff puede iniciar un acceso de soporte desde Plataforma. La activación del administrador ficticio se completó posteriormente mediante enlace manual, como se documenta en la última sección; todavía no se verificaron los flujos funcionales de esa empresa.

## Contraste, ícono e identificación del entorno

El commit `66dd4fb3e714e37673a78ca37a520fc5973f4ea8` aprobó [GitHub Actions 36091947240](https://github.com/studiocamaleon/gdi/actions/runs/36091947240), con ambas compilaciones, tipos, migraciones, permisos y ensayo HTTP. Localmente aprobaron 33 pruebas del proxy/acceso de staging, TypeScript web y ESLint de los archivos cambiados.

Se corrigió la tarjeta «Tu acceso a Grafo» mediante los tokens de superficie/borde del panel: el fondo compartido ya no puede sobreescribir el grafito por orden de carga del CSS. El rótulo de ambiente toma `STAGING_PRIVATE` y muestra Staging, aunque Next se ejecute en modo de producción. El SVG de marca existente se sirve en su ruta exacta `/icon.svg` con GET/HEAD sin redirección de sesión ni desafío Basic; las rutas parecidas, POST y el resto del entorno siguen protegidos.

La nueva web se desplegó en la misma máquina `683d195da310e8`, sin cambiar capacidad, con la imagen `registry.fly.io/grafoprint-staging-web@sha256:12d6bee6768edf85732854c76b993f2696b2587548ca9c1a0b43ecad256f6dd7`. Backend/workers conservan la imagen del arreglo de primer acceso. El builder temporal `fly-builder-withered-valley-3413` se eliminó al finalizar.

Después del despliegue aprobaron salud web y las peticiones GET/HEAD al ícono: `200`, SVG válido y sin redirección. POST al ícono, rutas con sufijos, backoffice y BFF sin Basic respondieron `401`. En Chrome se conservó la sesión MFA y se verificó la etiqueta Staging y la tarjeta corregida: fondo `rgb(16,18,20)`, título/botón `rgb(243,242,238)` y texto secundario `rgb(185,189,190)`, con captura visual. El control del navegador superpone temporalmente su propio indicador al favicon; no se modificó ese indicador. La ficha de Gráfica Demo se mantuvo disponible tras la actualización.

## Enlace manual de invitación

El commit `75493454a` corrige la ficha de empresa: al reenviar la invitación, conserva la URL devuelta por la API y la entrega al panel existente para mostrarla/copiarla. Antes sólo recargaba el detalle, que deliberadamente no contiene tokens, y perdía la URL. No cambia el servidor ni los permisos. El enlace sólo vive en memoria, se limita a la empresa actual y deja de mostrarse si el detalle identifica una renovación distinta, si el servidor no devuelve una URL vigente o si el usuario no puede gestionar la invitación.

Pasaron ocho pruebas de empresas/invitaciones, TypeScript web y ESLint. La regresión comprueba copia del enlace con correo fallido, conservación al actualizar la ficha, reemplazo al renovar, descarte al detectar otra renovación y aislamiento entre empresas/roles. La API de staging sigue sin `RESEND_API_KEY`; no se contrataron ni configuraron servicios de correo.

[GitHub Actions 36135335379](https://github.com/studiocamaleon/gdi/actions/runs/36135335379) aprobó sobre el mismo commit las dos compilaciones con tipos, migraciones, permisos y el ensayo HTTP completo.

La web se compiló remotamente con tipos y se desplegó en la misma máquina `683d195da310e8`, con la imagen `registry.fly.io/grafoprint-staging-web@sha256:31ffa14299e1d369b2f973be9f97c56aaa382dd2c6980a03df4c3709fd8de373`. Los controles de Fly aprobaron y `/api/health` respondió `200` con `status: ok`. No se modificaron API, workers, base de datos ni tamaños. Se eliminó el builder temporal `fly-builder-lilac-sound-6923` después del despliegue.

En Chrome se renovó una vez la invitación de Gráfica Demo y apareció «Compartir el enlace manualmente». El botón notificó «Enlace copiado» y, al pulsar «Actualizar» en la ficha, la opción se conservó. Abrir la URL mostrada llevó a «Activá tu acceso», con empresa, rol administrador y correo ficticio correctos, comprobados también visualmente. Lucas eligió y envió personalmente la contraseña, y confirmó su ingreso. Se verificó en la aplicación `admin@grafoprint-demo.example.invalid`, «Gráfica Demo — Staging · Administrador» y Trial; la pantalla de suscripción mostró activa y cobro no configurado. No se solicitó ni guardó su contraseña, no se registró el token en estos documentos y no se envió correo.

## Correcciones de la primera prueba funcional de empresa — 25 de septiembre

El commit `5c388e01234f` agrega el alta de plantas desde Nueva máquina y desde la ficha de maquinaria, completa la biblioteca global y corrige la disposición de Cuentas de cobro. El alta de planta conserva los campos de máquina, selecciona la planta creada y acepta planes con maquinaria o centros de costo; sigue exigiendo permiso de gestión.

La migración `20260925143000_completar_biblioteca_materiales` contiene un snapshot de los 112 materiales y 720 variantes del catálogo existente. Agrega sólo claves/SKU faltantes, preserva los IDs y ajustes existentes y no instala materiales ni stock en empresas. No usa el seed destructivo de desarrollo. El ensayo remoto comprueba también que se conserve el tornillo creado por una migración anterior.

Validación local aprobada: cinco pruebas de interacción del alta de planta (selección, conservación de datos, Enter sin envío del formulario padre, doble envío, conflicto y permisos), 32 pruebas de capacidades de API, TypeScript web y ESLint de los componentes modificados. Snapshot comparado con el catálogo fuente sin diferencias ni claves duplicadas. Antes del despliegue, Neon tenía 2 materiales globales, 7 variantes y la empresa demo no tenía plantas, máquinas ni materiales propios.

[GitHub Actions 36152318800](https://github.com/studiocamaleon/gdi/actions/runs/36152318800) aprobó sobre `5c388e01234f`: compilaciones de backend y web con tipos, 281 migraciones, catálogo global completo con referencias existentes intactas, permisos de ejecución y ensayo de acceso HTTP. La migración se aplicó luego en Neon; lectura con el rol de aplicación confirmó 112 materiales y 720 variantes, sin crear plantas, máquinas ni materiales de la empresa demo.

La API y los workers usan la imagen backend `registry.fly.io/grafoprint-staging-api@sha256:8b401da85ba89bbea1caaed14ec70f5258f553aa70a331756cb35e429b75ce19`. En Chrome se comprobó el contador de 112 materiales y el configurador del PVC espumado con sus 8 variantes; se canceló sin instalar material en la empresa.

La web se compiló con chequeo de tipos en el mismo builder remoto. La primera subida falló por un error de transporte de Fly; el reintento reutilizó íntegramente la caché y publicó la imagen `registry.fly.io/grafoprint-staging-web@sha256:ecc9349b08cf9545b462a83fd61ec0b6e03db189c54c3bdb68c6ea68e348153a`. No se reinició Docker ni se aumentó memoria o tamaños.

Web desplegada y saludable. Chrome confirmó el alta de `Taller de prueba — Staging` (`PLT-001`) desde Nueva máquina, selección automática y conservación del nombre y tipo ya completados. Se guardó `Router de prueba — Staging` como borrador inactivo y su ficha mostró la planta persistida; faltan los datos normales de configuración para activarla. Ambos registros sintéticos se conservaron para continuar las pruebas.

Se verificó visualmente Cuentas de cobro en escritorio: texto legible a la izquierda y botón Agregar cuenta a la derecha, sin la columna vacía previa. El botón abrió Nueva cuenta y se canceló sin guardar cuentas ni saldos. No se ensayó el guardado financiero ni un viewport móvil.

API, ambos workers y web conservaron una máquina cada uno, región gru y tamaños acordados. Gotenberg no se modificó. El builder temporal `fly-builder-thrumming-field-7164` se eliminó tras publicar las imágenes. No se fusionó el PR a main ni se cambiaron servicios de producción.


## Categorías comerciales, alta de centros y selector de egresos — 25 de septiembre

Corrección `311cbcd274bac7fff819c584eb9a66197ba33f63`, rama `codex/fix-configuracion-staging`, propuesta en [PR #3](https://github.com/studiocamaleon/gdi/pull/3) sobre `codex/staging-infraestructura`. El PR #2 sigue sin integrar a `main`.

- **Catálogo comercial:** la base tenía cero categorías y subcategorías. La migración `20260925190000_completar_catalogo_comercial` agrega las 11 categorías y 48 subcategorías de la fuente existente con sus atributos. Sólo inserta códigos faltantes; conserva IDs, configuraciones e inactivos existentes. No ejecuta seed ni crea productos de empresas.
- **Centro de costo:** alta y edición comparten Datos generales, Gastos, Ajustes e Historial. Las horas productivas se pueden cargar antes del primer guardado. Se conserva el comportamiento existente de guardar y publicar cuando hay datos válidos; no cambian reglas ni permisos de API.
- **Egresos:** las 35 categorías ya existían, pero la lista excedía su contenedor y se recortaba. Ahora tiene altura limitada y desplazamiento propio, con el buscador visible.

Validación local: ocho pruebas aprobadas (tres del formulario de centro y cinco de categorías de egresos), TypeScript web, ESLint y sintaxis del verificador. Las pruebas del alta cubren conservación entre pestañas, envío conjunto de gastos/horas, centro no productivo y error de API sin perder el formulario. El snapshot JSON coincide con su fuente.

[GitHub Actions 36166757028](https://github.com/studiocamaleon/gdi/actions/runs/36166757028) aprobó sobre ese commit: backend y web compilados con tipos, 282 migraciones sobre PostgreSQL temporal, permisos y acceso HTTP. El ensayo del catálogo modifica registros dentro de una transacción descartable y reaplica el snapshot, comprobando que conserva sus IDs y configuraciones. Este verificador no se ejecutó contra Neon persistente.

Después se ejecutó `migrate.cjs` con la credencial separada de migración y destino explícito `grafoprint_staging`. Salida cero; consulta posterior confirmó 282 migraciones terminadas, 11 categorías y 48 subcategorías accesibles con el rol de aplicación.

La web se compiló remotamente con tipos y se desplegó en la misma máquina `683d195da310e8`, región `gru`, 1 CPU compartida y 1 GB. Imagen: `registry.fly.io/grafoprint-staging-web@sha256:2aca392f9fcacf23d979c15ece3d43cc5855d3613ca76c1c9dc4166721d4d8b6`. Fly sufrió un timeout transitorio al cerrar el registro de la compilación; la imagen ya estaba subida y el despliegue posterior por digest terminó correctamente. Los controles de Fly y `/api/health` aprobaron. Se retiró el builder temporal `fly-builder-willow-tide-2612`.

API y workers mantienen la imagen `registry.fly.io/grafoprint-staging-api@sha256:8b401da85ba89bbea1caaed14ec70f5258f553aa70a331756cb35e429b75ce19`: no hubo cambios de lógica de backend. Gotenberg, tamaños y secretos no cambiaron. No se reinició Docker ni se compiló la web localmente.

Comprobación en Chrome con Gráfica Demo — Staging:

1. **Nuevo producto:** las 48 opciones comerciales aparecen; se seleccionó Impresión comercial en hoja · Tarjetas. No se guardó ningún producto.
2. **Nuevo centro:** las cuatro pestañas aparecen desde el alta. Se creó `QA — Alta completa — Staging` (`QA-ALTA-0925`) para `2026-10`, con un gasto sintético de $20.000 y 100 horas. El resumen mostró $200/hora antes de guardar. Un único guardado creó la tarifa; al consultar después el historial figuró `v1`, `publicada`, $20.000, 100 horas y $200/hora. No se necesitó completar datos ni publicar de nuevo. El registro se conserva identificado para pruebas; la planilla de septiembre del centro preexistente mantuvo $1.800.000, 120 horas y $15.000/hora.
3. **Registrar egreso:** scroll real hasta el final de las 35 categorías, selección de Ajustes de caja y búsqueda de Alquiler comprobados. El buscador permaneció visible. Se descartó el formulario sin crear egresos (registro sigue en cero).

La verificación visual se hizo en escritorio; no se ensayó un viewport móvil. No se fusionaron PR ni se cambió producción.

## Tarifa publicada del centro en maquinaria — 25 de septiembre

Corrección `e209c74d46ff2c38f42856ac962655b1d3785ca3`, incorporada al mismo [PR #3](https://github.com/studiocamaleon/gdi/pull/3). La ficha leía `ultimaTarifaTotal`, que puede pertenecer a un borrador, aunque el campo se describe como la última planilla publicada. Ahora utiliza `ultimaTarifaPublicada` y conserva «Sin tarifa publicada» cuando no existe publicación.

La lectura de staging confirmó que el centro de Impresión gran formato UV tenía una tarifa publicada de septiembre de $15.000/hora y un borrador de octubre de $0/hora. El recálculo del período al crear el centro QA de la prueba anterior había generado ese borrador. La máquina Impresora Hibrida UV conservaba el vínculo correcto con su centro: no guarda una copia de la tarifa y no había sobrescrito la publicación. El problema estaba en el importe mostrado. No se cambiaron datos, reglas de cálculo, API ni migraciones para corregirlo.

Pasaron cuatro pruebas del componente real: publicación de $15.000 frente a borrador posterior en cero, borrador sin publicación, máquina sin centro asignado y publicación válida de cero. También aprobaron TypeScript web y ESLint. [GitHub Actions 36170770793](https://github.com/studiocamaleon/gdi/actions/runs/36170770793) aprobó sobre ese commit las compilaciones con tipos, 282 migraciones, permisos y acceso HTTP en el entorno temporal.

La web se compiló remotamente con tipos y se desplegó por digest en la misma máquina `683d195da310e8`, con los mismos recursos. Imagen: `registry.fly.io/grafoprint-staging-web@sha256:d12ca9fe457c7b1266a952eab0f0ef1ad5b921960e9c1930861956ef285f769b`. Los controles de Fly aprobaron y `/api/health` respondió `200` con `status: ok`. API, workers, Gotenberg, secretos y migraciones permanecieron sin cambios. El builder temporal `fly-builder-russet-star-6762` se eliminó al terminar.

En Chrome se recargó la ficha guardada de Impresora Hibrida UV, sin cambios pendientes. Se confirmó visualmente el centro Impresion gran formato UV y «Tarifa / hora: $15.000,00», manteniendo «Sin cambios pendientes» y Guardar deshabilitado. No se volvió a guardar ni se modificó la configuración de la máquina. No se fusionaron PR ni se publicó el SaaS en producción.

## Nombre del vendedor y tipografía de etiquetas — 25 de septiembre

Correcciones `958e42012` y `0dc67c499`, incorporadas al [PR #3](https://github.com/studiocamaleon/gdi/pull/3).

- La OT de la empresa demo no tiene un empleado vendedor asignado. La ficha usa entonces a quien la emitió, cuya firma histórica era el correo aunque el perfil actual ya tenía nombre. El detalle ahora completa ese correo con el nombre actual del usuario asociado al evento. Conserva la prioridad del vendedor asignado, las firmas de soporte/sistema y el historial original. La primera emisión se lee fuera del límite de 200 eventos; no se asigna al lector actual como vendedor ni se modifican registros.
- La vista previa de la etiqueta mostraba cuadrados en todos los textos. El contenedor backend no tenía archivos de fuentes ni configuración Fontconfig. Se incluyen `fontconfig` y `fonts-dejavu-core`, y se elige DejaVu Sans en el SVG rasterizado. La vista previa, el PDF descargado y el raster TSPL comparten este generador. El tamaño sigue siendo 100 × 150 mm y no cambia el contenido del QR.

Validación local: 12 pruebas nuevas del detalle de vendedor, 97 pruebas existentes del ciclo de la OT y 20 de impresión aprobadas; compilación backend con tipos y ESLint del nuevo spec aprobados. El ensayo `verify-label.cjs` usa datos sintéticos, sin base ni red, y comprueba texto visible con anchuras de glifos distintas y QR conservado. Ejecutado contra el servidor anterior reproduce el fallo «Falta una fuente proporcional legible en las etiquetas». Se agrega al workflow para ejecutarlo dentro de la imagen Linux final, donde ocurre el problema; en macOS las fuentes instaladas podían ocultarlo.

Referencias de paquetes: [DejaVu en Debian](https://packages.debian.org/bookworm/fonts-dejavu-core) y [Fontconfig](https://packages.debian.org/bookworm/fontconfig).

[GitHub Actions 36180731864](https://github.com/studiocamaleon/gdi/actions/runs/36180731864) aprobó sobre `0dc67c49983574263d063cb0ef0dab9ec2a18233`: compilaciones backend/web con tipos, prueba del raster dentro de Linux, 282 migraciones en la base temporal, permisos y ensayo HTTP completo. La imagen backend se compiló remotamente con tipos y se publicó con digest `sha256:5604c934b96cf09a53613683fae86d2738573a8dbe97e05bdf29769c23ec9f5d`. El builder `fly-builder-sunlit-woodland-5964` se eliminó al finalizar la compilación.

API, worker de cálculos y worker PDF desplegados con esa misma imagen por digest en sus máquinas existentes, sin cambiar tamaños ni regiones. Fly aprobó los controles de los tres procesos. Salud API y web respondió `200`, con base disponible; el ensayo de tipografía también aprobó en la API real de Fly. La web conserva su imagen anterior, ya que ambas correcciones se resuelven en el servidor. No se cambiaron secretos, Gotenberg ni migraciones cloud.

Chrome confirmó en `OT-2026-0001` el vendedor «Lucas German», avatar LG y los cinco eventos originales. La vista previa de etiqueta pasó de cuadrados vacíos a texto legible. Se descargó el PDF desde la aplicación y se renderizó con Poppler: una página de 100 × 150 mm, con nombre de empresa y acento en «Gráfica», identificación interna, número de orden, cliente, fecha, producto, cantidad `4,04 m²` y pie legibles, sin superposiciones ni recortes. La impresión física no se ensayó. La orden siguió pendiente, con su mismo importe y fecha; no se guardó ni reemitió.

Por indicación de Lucas, materiales, reservas y fechas mantienen su comportamiento. No se fusionaron PR ni se cambió producción.


## Piloto interno de WhatsApp Cloud API — 25 de septiembre

Despliegue del código `7efabd87213e` del [PR #4](https://github.com/studiocamaleon/gdi/pull/4). Las compilaciones remotas conservaron el chequeo de tipos. Backend compartido por API y ambos workers: `registry.fly.io/grafoprint-staging-api@sha256:ccf65db71c98a649b36793aed49a4a264b39d81bf1902a0ac678f0dc0ccae4e0`. Web: `registry.fly.io/grafoprint-staging-web@sha256:f455af59fea4fa0ae76de41fa4e77b0ce898c4fc42e8cec323e997140c2cf97d`. Se mantuvieron las máquinas y tamaños; Gotenberg no cambió. El builder temporal `fly-builder-humming-bush-589` se eliminó al terminar.

Se aplicó en Neon `20260925210000_meta_cloud_piloto`: total 283 migraciones. Se verificaron las siete columnas nuevas y los permisos del rol de ejecución, sin DDL ni acceso a `_prisma_migrations`. No hubo seed, reset ni cambios en la base local.

El reemplazo de la única máquina API produjo una interrupción temporal del acceso mientras concluía su cierre. Fly terminó correctamente, y salud y las pruebas HTTP posteriores aprobaron. La arquitectura de una sola máquina no garantiza despliegues sin interrupción; no se contrataron réplicas adicionales.

Token, secreto y configuración del piloto se cargaron sólo en los secretos de la API. Meta confirmó el webhook de `api-staging` y la suscripción `messages`; la cuenta de prueba incluye Grafoprint entre sus apps suscriptas. El token temporal y los identificadores privados no se guardan en este documento.

Controles HTTP reales aprobados: salud 200; API general 403 sin credencial interna; backoffice web 401 sin Basic; ruta de webhook con sufijo 403; verificación incorrecta 403; POST sin firma 401; challenge correcto 200 con el texto exacto; POST con firma válida y lote vacío 200. No se crearon mensajes mediante ese lote sintético.

Gráfica Demo quedó en Founder mediante la acción normal de Plataforma, con motivo de auditoría; suscripción manual/activa sin cobros. La plantilla de prueba `hello_world` figura aprobada en Meta.

Lucas completó el ingreso normal a la empresa demo. Desde Configuración → Integraciones se envió una sola prueba a su destinatario previamente autorizado: registro creado a las 21:33:55 UTC, webhook real `delivered` a las 21:33:59 UTC, un intento y ningún error. La interfaz mostró primero «Aceptado por Meta» y, al actualizar, «Entregado · Confirmado por Meta». Se verificaron los datos persistidos y la presentación visual. No hubo reenvío ni se sustituyó la entrega por un webhook simulado.

Chrome repitió el desafío Basic durante el acceso manual. El ensayo HTTP con las credenciales privadas vigentes respondió 200; se recordó que la puerta usa `grafoprint`, distinto de los usuarios de empresa/Plataforma, y se dejó un archivo privado local para copiar la clave. Lucas confirmó después su ingreso. No se rotaron contraseñas ni se desactivó la protección.

La inspección del token informó vencimiento a las 23:00 UTC del 25/09 (20:00 de Argentina). Renovarlo antes de continuar pruebas posteriores. La app sigue sin publicar y no se cambiaron sus solicitudes de revisión. El ensayo verifica el número oficial de prueba, no onboarding de clientes, coexistencia ni inbox.

## Renovación del piloto y preparación de plantilla PDF — 26 de septiembre

El catálogo real rechazó el token anterior por vencimiento. Lucas renovó el identificador desde Meta. Se actualizó únicamente `META_PILOT_ACCESS_TOKEN` en los secretos de `grafoprint-staging-api`; la importación terminó correctamente y generó la release 9. La máquina existente volvió a `started`, con el control HTTP `passing`, mismos recursos y misma imagen `sha256:ccf65db71c98a649b36793aed49a4a264b39d81bf1902a0ac678f0dc0ccae4e0` del código `7efabd87213e`. No se desplegaron cambios de código ni migraciones. Los workers y la web no recibieron el token.

Comprobaciones posteriores: salud web `200`, salud API `200` con `database: up`; acceso anónimo a otra ruta de API rechazado. Graph confirmó que el número pertenece a la WABA configurada y que la app está suscripta. El webhook respondió correctamente al challenge privado. Las credenciales permanecen fuera de Git y no se copiaron al entorno de la aplicación local.

El cliente actual de Grafo consultó el catálogo real y reconoció texto, imagen y el carrusel no compatible. Al faltar una plantilla de PDF, se presentó `grafoprint_documento_pedido_v1`, `es_AR`, `UTILITY`, encabezado documental y dos variables. Meta devolvió `PENDING`; la consulta de las 22:29 UTC conservó ese estado. La muestra subida a Meta contiene únicamente datos ficticios y la indicación de que no tiene validez comercial. **No se envió ningún mensaje en este ensayo** mientras la plantilla está pendiente.

Procedimiento y límites en [meta-prueba-plantillas.md](../../docs/meta-prueba-plantillas.md). El ensayo preparado reutiliza el cliente de Meta en un proceso de operador independiente; no equivale a haber publicado ni validado el nuevo Inbox en staging. No se modificó la revisión de la aplicación, producción, tamaños ni presupuesto.

## Plantilla aprobada: entrega y respuesta reales — 27 de septiembre

Lucas renovó nuevamente el token temporal. Con el cliente de Grafo se comprobó el catálogo real: `grafoprint_pedido_listo_v1`, `es_AR`, continuaba aprobada y la plantilla de PDF seguía `PENDING`. También se verificaron pertenencia del número a la WABA, app suscripta y challenge del webhook. El nuevo token se guardó en los archivos privados existentes; no se copió a la configuración de la aplicación local.

Se envió **una sola plantilla de texto**, con nombre ficticio `Prueba Grafo` y pedido `DEMO-0002`, al destinatario ya autorizado. El intento privado quedó registrado antes del POST. Meta aceptó la solicitud y los webhooks de staging registraron `sent` a las 18:29:42 UTC y `delivered` a las 18:29:43 UTC, sin errores y con WAMID/canal/correlación coincidentes. Meta devolvió el identificador del destinatario con `549`, frente al `54` configurado en el piloto; se verificó esa correspondencia exacta, sin fusionar números ni cambiar reglas de la aplicación.

Lucas abrió el mensaje y respondió `PRUEBA GRAFO DEMO-0002`. Se comprobó en Neon, mediante una transacción de sólo lectura, el evento entrante de las 18:34:46 UTC, del mismo contacto y canal. No incluía referencia de respuesta citada. La consulta de las 18:37 UTC todavía no tenía evento `read`; sólo se acredita entrega. El normalizador del Inbox actual interpretó los dos estados y el texto entrante sin avisos. No se ejecutaron proyecciones ni se simularon webhooks.

Se importó exclusivamente `META_PILOT_ACCESS_TOKEN` en `grafoprint-staging-api`, release **10**, conservando la imagen del piloto `7efabd87213e` (`sha256:ccf65db71c98a649b36793aed49a4a264b39d81bf1902a0ac678f0dc0ccae4e0`). El reemplazo de la única máquina produjo una interrupción temporal observable; Fly terminó correctamente con control saludable. Comprobación final: API `200`, `database: up`, y web `200`. No cambiaron máquinas, recursos, workers, migraciones ni la versión del Inbox publicada.

El recorrido desde la interfaz nueva, sus checks en vivo y el PDF siguen pendientes. El [plan concreto del siguiente lote](../../docs/meta-prueba-plantillas.md#preparación-del-recorrido-completo-en-staging) identifica la necesidad de un canal de prueba explícito y las diez migraciones acumuladas. No se fusionaron ramas ni se modificó producción.
# Lectores de respaldo y primer ensayo de recuperación — 30/09/2026

Se creó un rol separado de sólo lectura en Neon, con acceso a las 213 tablas y a las tablas/secuencias futuras creadas por el dueño actual. La creación se probó primero en una base local ficticia, incluido el caso de dueño sin superusuario de PostgreSQL 16. Se verificó la conexión TLS y ausencia de escritura/DDL/funciones privilegiadas; no hubo migraciones, seeds ni cambios en datos de staging.

Se creó un token R2 con `Object Read only`, limitado al bucket de staging. Listado/descarga aprobaron; subir o borrar un objeto sintético fue rechazado con 403. Se creó un lector B2 independiente, limitado al bucket y prefijo de staging, con permisos exactos de lectura/verificación de retención. El acceso amplio temporal utilizado para aprovisionarlo fue revocado y eliminado del archivo local.

La primera copia real de ensayo quedó cifrada y protegida por la retención de 30 días. Se descargaron y verificaron los 13 archivos y el dump; restauración SQL en una base nueva aislada: 213 tablas, 298 migraciones/checksums y 1.588 filas. Los dos valores internos cifrados presentes pudieron descifrarse con la clave de staging. No se iniciaron servicios ni tareas externas; el dueño local de restauración quedó sin login. No se alteró la base de desarrollo. El titular confirmó el kit completo en una nota segura del teléfono. Ensayo de aplicación completa y dos empresas, programación/alertas y custodia automática de futuros comprobantes siguen pendientes; no se acredita recuperación total ni cierre de seguridad.

Versiones observadas durante el ensayo: backend `ce4e06fca19779ae4f7551f35a3e21e27734c523`, digest `sha256:ec9736bf77cfda7795832df026cb0ce1731322cdfa2a4259c9e1889f8e6d135c` en API y ambos workers; web `250b8643ab0ca6269c4d0e58a2d1ef45cf602d8e`, digest `sha256:5e2c1bf5640e2fab26cf5e5ff769bacdbb82bc5cb1a3345b6da5ef4460ae3ab6`. Las cinco máquinas siguieron iniciadas con los mismos recursos. No se desplegaron imágenes, no se fusionaron PR ni se modificó producción. Los cambios de seguridad de esta rama aún no están publicados.

El ejecutor corrigió una incompatibilidad de precisión entre fechas de ListObjectsV2 y GET/HEAD de R2, manteniendo ETag/tamaño exactos. La tentativa anterior abortó sin cierre válido. Pasaron 106 pruebas locales del respaldo; evidencias privadas fuera de Git. Ver detalles y límites en [recuperación](../recuperacion/README.md).

## 01/10/2026 — Permisos por vista, cajas asignadas y recorrido publicado

Revisión **`2fee017048b1ba529f579dc5820878f9cf1ce066`**, PR #14 sobre #13, sin fusionar los PR. Lucas autorizó comprobar local, publicar en staging y promover a producción sólo después del ensayo. API, ambos workers, web y generador PDF usan este lote.

| Servicio | Imagen inmutable |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-staging-api@sha256:47db777a89768d5f989dd8443532e52ea73f8d0ab1bf1937bf7036e5a5e48674` |
| Web | `registry.fly.io/grafoprint-staging-web@sha256:eb5699889ae1629f57e9a37eeaeaa11e2af118c3b808b2154d38583f435d2271` |
| PDF | `registry.fly.io/grafoprint-staging-pdf@sha256:a86ea4b8aae6a9e4c45b5594840e216ce66847d232a8aab649694470ed4f547d` |

302 migraciones terminadas. `20261001220000_permisos_cuentas_usuario` agrega asignaciones de cuentas y claves de idempotencia de arqueos; no ejecuta seeds ni modifica roles existentes. El rol de aplicación pudo leer las nuevas columnas y sigue sin DDL. Una máquina por servicio, mismos tamaños; copiador conserva su imagen y recibió únicamente la configuración con las fuentes e imágenes nuevas.

### Comprobaciones

- Las 500 pruebas de API y 57 de interfaz previas del lote habían pasado. La corrección encontrada en el recorrido agregó siete regresiones; las cuatro suites focalizadas terminaron con 32 pruebas aprobadas. Revisión local de tipos sin errores y compilaciones completas remotas.
- CI del código desplegado: [HTTP y aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/36918285844) y [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36918285859), ambos aprobados.
- Recorrido local con API completa, Next, sesión real y PostgreSQL exclusivo de tests. Vendedor con órdenes y caja limitada: creación de orden, cobro, arqueo exacto persistido, transferencia y repetición sin duplicado. Rechazo de cajas no asignadas y destinos no autorizados. Navegador confirmó que sólo se muestra Mostrador y que Fuerte sólo aparece como destino, sin saldo.
- Se corrigió el fallo detectado en Pagos de la OT: consultar pagos de una orden requiere acceso a esa vista; omitir `ordenId` no abre el listado general de Cobrar. El recibo del vendedor exige permiso de cobro, acceso a órdenes y cuenta operable.
- En staging pasaron **46 comprobaciones HTTP** con administrador, vendedor, sólo presupuestos y sólo informe comercial. Después de publicar la web se repitieron los accesos permitidos y rechazados. Un cobro ficticio adicional produjo un PDF nuevo de 22.510 bytes a través del generador actualizado, accesible al vendedor. No se emitieron comprobantes fiscales ni mensajes a clientes.
- Revisión de navegador en staging: Usuarios, lugares del equipo y editor con Comercial e informes independientes. Revisión en producción: sesión del administrador, Usuarios, cajas y métodos de pago. Los formularios se cerraron sin guardar cambios de clientes reales.
- Las empresas y usuarios sintéticos, sus órdenes, cobros y archivos fueron retirados de local y staging. Los conteos finales de staging coinciden con los previos. En producción se conservaron los conteos de clientes, medios, cobros y movimientos; no se importó el catálogo local.
- Salud web 200; controles Fly de API y PDF aprobados. API directa protegida 403 y BFF sin sesión 401 en producción. Doce máquinas activas entre los dos entornos, sin aumentar tamaño.

### Respaldo y límites

Copia previa válida de **2026-10-01T19:00:50.902Z**. Fuentes exactas cifradas y custodiadas en B2 con 31 días de protección. Copia posterior **`65dac61e-ffa8-44ef-9a07-119e3869aac4`**, completada **2026-10-01T20:17:16.027Z**, con 302 migraciones, 13 archivos y las imágenes de la tabla: firma y descifrado del manifiesto comprobados. No se repitió una restauración SQL completa en esta publicación.

El copiador no cerró correctamente dos intentos durante esta ventana; no se contaron como copias válidas. Se verificó el origen (13 archivos requeridos presentes), se repitió el ciclo tras retirar los datos de ensayo y se confirmó el comprobante nuevo firmado indicado arriba. Una lectura de B2 también agotó el plazo de conexión y pasó al repetirla; no se desactivaron los controles de integridad.

El recorrido usa una cotización y producto sintéticos de importe conocido; no reemplaza la validación industrial del catálogo a migrar. Centro de Copiado informa los requisitos faltantes: todavía debe incorporarse y verificar maquinaria/papel. Las restricciones de cuentas son opt-in por usuario. **No revertir a la API anterior después de asignar restricciones:** la versión vieja ignoraría las columnas nuevas; evaluar primero una corrección hacia adelante. El resto del plan de carga, recuperación cloud completa y facturación legítima mantiene los límites documentados anteriormente.


## 01/10/2026, 21:35 UTC — Cotizador y scroll de selectores (PR #15)

La API ejecuta **`fd7c20b88028d0445273ed310ab2edb5957854a0`** y la web **`5e6cffbab2bad64f6f8c4c5a2318c78d3186931b`**. PR #15 dependiente del #14; ninguno se fusionó durante esta corrección. Se comprobó local, luego staging y se promovieron las mismas imágenes por digest a producción.

| Servicio | Imagen vigente |
| --- | --- |
| API | `registry.fly.io/grafoprint-staging-api@sha256:f4e5e6df330da2c742415933afb064efe4be06bcc963aa77d0df7fb6979e8895` |
| Web | `registry.fly.io/grafoprint-staging-web@sha256:4d211c03e12cdca75ec1c468d6155b0390a9002d425ce401cb99bb2edb030da1` |

Los workers y PDF mantienen `2fee01704` y las imágenes de la entrada anterior. Permanecen **302 migraciones**, una máquina por servicio y los mismos tamaños. No hubo migraciones de esquema, seeds, cambios de permisos ni de secretos de acceso.

- Crear propuesta caía en el render del selector porque la proyección comercial omitía `atributosSchemaJson`. La API conserva ese esquema pasando por el filtro de datos económicos privados. La regresión reproduce el render real del selector; no se oculta el error con un catálogo vacío.
- El CSS optimizado aplanaba los selectores de HeroUI y el aislamiento de estilos anclaba incorrectamente toda la cadena a `:scope`. Los descendientes del portal perdían `max-height`, `min-height` y `overflow-y`. Se conserva la raíz y sus combinadores mediante el parser de selectores, incluyendo pseudo-elementos, sin ampliar estilos a las pantallas anteriores.
- El buscador de asignaciones no tenía la función de filtrado conectada. Ahora filtra por nombre/grupo con comparación de mayúsculas y acentos. Se mantienen las opciones bloqueadas y los avisos de traslado.
- Nueve pruebas focalizadas aprobadas (cinco API, dos de contrato API/interfaz y dos de aislamiento CSS), con fallos reproducidos antes de corregirlos. Tipos de web y compilaciones remotas completas sin omitir la validación. CI del código: [HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36927855712), [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36927855707) y [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36927855697), aprobados.
- Navegador local con componente real dentro de FormSheet, 35 opciones y CSS optimizado: lista de 320 px, desplazamiento hasta el final, selección de la última opción, teclado, búsqueda y ausencia de resultados comprobados. En staging se alcanzó el final del listado de pasos; en producción también el de máquinas. El cotizador abre el catálogo y la configuración del producto en ambos entornos. Formularios cerrados sin guardar asignaciones ni emitir órdenes.
- Controles de salud de Fly aprobados. Builder temporal retirado; no se reinició Docker ni se modificaron los servidores locales existentes.

### Recuperación de esta publicación

Fuentes de ambas revisiones cifradas y custodiadas con 31 días de protección. El inventario de recuperación conserva tanto la imagen de API nueva como la anterior que siguen usando los workers, además de la web, PDF y copiador. Copia posterior **`827677f1-2320-4806-9125-ac0fb26b7b4c`**, completada **2026-10-01T21:32:06.561Z**, con 13 archivos: firma, huella, descifrado del manifiesto y presencia de las fuentes/imágenes activas comprobados. Esta verificación de código no repitió la restauración SQL. Evidencia detallada privada fuera de Git.


## 02/10/2026, 18:15 UTC — Inicio sin stock y atajos comerciales (PR #16)

Revisión **`debada9153ce43ad2e4a00e8c043b5982d8e2fdf`**, dependiente de PR #15. Publicación autorizada por Lucas: primero staging, recorrido aprobado y promoción de las mismas imágenes inmutables a producción. Sin fusionar PR anteriores ni modificar la web comercial.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-staging-api@sha256:8acc4b8db24ee0a3ea9b7c01329ebe4dfc354a3241bbef430046c9a4cdfeca8f` |
| Web | `registry.fly.io/grafoprint-staging-web@sha256:8fd868a4a16a68afa9bda97027e0bd0b7f3bcee0692522d60ecf391da2030b03` |

PDF conserva `2fee01704` y el digest `a86ea4b8aae6a9e4c45b5594840e216ce66847d232a8aab649694470ed4f547d`. Copiador conserva su imagen y recibe el inventario actualizado de código e imágenes. **303 migraciones**; `20261001223000_inicio_inventario` agrega indicadores de empresa y OT inicialmente falsos, sin seeds ni cambios de existencias. Rol de aplicación comprobado sin DDL. Una máquina por servicio, mismos tamaños; builder temporal retirado.

### Comprobaciones

- 124 pruebas API y 41 de interfaz/reglas locales aprobadas. [CI HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36937251818) y [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36937251834) de la revisión publicada aprobados; compilaciones completas con tipos, incluido Next.
- Staging: **28 comprobaciones HTTP** por BFF y sesiones reales en dos empresas sintéticas. Activación/desactivación, versión concurrente, vendedor sin facultad de cambiar el modo, aislamiento, previsión, emisión directa y desde borrador, repetición idempotente, conservación de necesidades de una OT anterior y marcas históricas. No se crearon existencias, reservas ni consumos en las nuevas OTs de inicio.
- El paso de producción sintético mantuvo el bloqueo de calidad; al resolverlo permitió finalizar sin exigir material ni generar movimientos. Las cotizaciones de emisión y el paso de ejecución fueron fixtures de importe conocido: este ensayo no equivale a probar todas las rutas industriales.
- El primer intento de emisión con fecha de entrega 2099 se guardó, pero la respuesta excedió 120 segundos. Se comprobó el guardado y se retiró sólo esa fixture. La repetición con fecha próxima completó las 28 comprobaciones. La causa de aquella demora no quedó aislada y no se atribuye a una corrección del motor.
- Navegador en ambos entornos: botón en Inventario → Stock, diálogo con alcance y estado desactivado; escribir **C** en el selector de clientes conserva la búsqueda sin abrir Centro de Copiado. No se guardaron formularios comerciales reales.
- Fixtures y usuarios temporales retirados de staging; conteos originales recuperados. En producción se conservaron los conteos de empresas, clientes, cobros, medios y movimientos de fondos; sin facturación ni comunicaciones de prueba. Modo de inicio apagado, sin OTs marcadas en producción al cerrar la verificación.
- Salud web/API 200, API directa protegida 403 y BFF sin sesión 401. La interrupción del build web durante la pausa y el posterior fallo de conexión de Fly se resolvieron reutilizando la compilación remota; no se reinició Docker ni se tocaron los servidores locales de desarrollo.

### Respaldo y uso

Copia posterior **`2559694d-8a79-4f96-9b60-fcfcf1343312`**, completada **2026-10-02T18:08:21.060Z**: 303 migraciones, 13 archivos, fuente exacta cifrada con protección de 31 días e imágenes vigentes. Firma, huella y descifrado del manifiesto comprobados. No se repitió una restauración SQL completa en esta publicación. Evidencia detallada y accesos fuera de Git.

El modo queda **apagado por defecto**. Lo activa quien tenga Gestionar stock desde Inventario → Stock → Modo de inicio. Las nuevas órdenes no controlan ni consumen stock; conservan cantidades, costos y demás requisitos. Las anteriores mantienen su control y apagar el modo no provoca consumo retroactivo. Ver [guía](../../docs/inicio-sin-stock.md). **No revertir a código que ignore las marcas después de emitir OTs en este modo**; evaluar una corrección hacia adelante conservando columnas e historial.


## 02/10/2026, 22:00 UTC — Recorridos con permisos por vista (PR #17)

Código de ejecución **`088f92576ceb7bcbb4fbc73c53198c5f92ded19f`**. Rama dependiente del PR #16, sin fusionar la cadena. Primero se comprobó local y staging; después se promovieron a producción las mismas imágenes por digest. Los commits posteriores que registran esta evidencia no cambian el código desplegado.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-staging-api@sha256:95f8b868c6b99b8bcb76d83308bd1b242d9c8f69647b1e7c9790a6d347748899` |
| Web | `registry.fly.io/grafoprint-staging-web@sha256:4067b9f5df484360ed938cd98e10177763501ba17110703dfcd141a5c74ca8e8` |

PDF conserva `2fee01704` y su digest `a86ea4b8aae6a9e4c45b5594840e216ce66847d232a8aab649694470ed4f547d`. El copiador conserva imagen y recibe inventario actualizado. Una máquina por servicio, mismos tamaños; builder temporal retirado.

### Cambios y pruebas

- Cotizaciones y OTs aceptan la respuesta sin costos/márgenes. El diseño SVG/DXF se guarda como archivo privado del trabajo, sin requerir modificar el catálogo. Las consultas auxiliares y los controles de gestión respetan el permiso de cada vista.
- La prueba del navegador encontró además una consulta de receta que aún exigía acceso al catálogo: se sustituyó por una proyección de componentes publicados, sin borradores, historial ni reglas privadas de precios.
- Dos migraciones aditivas: `20261002160000_diseno_cotizacion` y `20261002160100_diseno_cotizacion_vinculo`. **305 migraciones**, rol de aplicación sin DDL; sin seeds, resets ni cambios de roles reales.
- 443 pruebas API en 22 suites y 71 de aplicación en 11 archivos, sin contar repeticiones. Matriz de 50 vistas y 124 consultas principales/auxiliares. Chequeo global de tests históricos de API: 142 diagnósticos previos, sin nuevos; no se declara ese chequeo aprobado.
- Compilaciones remotas completas con tipos. [CI HTTP y aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37066078130) y [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37066077984) del código desplegado aprobados.
- 79 comprobaciones HTTP tanto en local como en staging con seis perfiles ficticios: administración, vendedor equivalente al reportado, sólo presupuestos, lectura, producción y caja limitada. Cotización/guardado/reapertura, SVG/DXF, recetas publicadas y rechazos de acciones/datos ajenos.
- Chrome local: cotización simple, SVG, guardado, reapertura y reemplazo por DXF. Chrome staging: SVG de 100 × 80 mm a $1.500, agregar a OT, guardar, recargar y editar especificaciones. Geometría y precio conservados, sin costos visibles ni error de permisos.
- Datos sintéticos retirados de local y staging; conteos originales recuperados. Producción: formulario y catálogo cargan; sin guardar órdenes, emitir comprobantes ni enviar comunicaciones reales. Se conservaron los conteos de empresas, clientes, cobros, medios y movimientos entre verificaciones; el modo de inicio existente no se modificó.
- Salud web/API 200; API directa protegida 403 y BFF sin sesión 401. Los servicios locales ajenos al ensayo y Docker permanecieron intactos. Falló la conexión de Fly al terminar de subir la web; se recuperó la imagen ya compilada y se promovió sin reconstruirla.

### Respaldo y límites

Copia posterior **`db5916c9-21b1-442e-b513-2e4aa7a22116`**, completada **2026-10-02T21:59:14.784Z**: 305 migraciones, 13 archivos y fuentes exactas cifradas con protección de 31 días. Firma, huella, descifrado del manifiesto y presencia de las imágenes vigentes comprobados. No se repitió una restauración SQL completa. Evidencia detallada y secretos fuera de Git.

El primer ciclo posterior de staging no completó; se repitió y se verificó el comprobante nuevo indicado arriba. La primera lectura posterior desde la Mac también falló al contactar B2 y pasó al reintentar; no se relajaron controles de seguridad ni se contó el intento fallido como respaldo válido.

Esta cobertura no asegura todas las combinaciones posibles de permisos, planes o rutas industriales. Ver [alcance detallado](../../docs/permisos-recorridos-validacion.md). Para revertir la interfaz, conservar las migraciones y archivos creados; la API debe seguir reconociendo `DISENO_COTIZACION`. No eliminar valores del enum ni diseños para revertir código.

## 02/10/2026 (Argentina) — Tomos PDF y avisos de la OT (PR #18)

Código de ejecución **`e11e431b368353fb12fd52fb6768c2ffbfa661b2`**, dependiente del PR #17. Publicación solicitada por Lucas, primero en staging y después en producción con las mismas imágenes por digest. Sin fusionar la cadena de PR ni cambiar la web comercial.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-staging-api@sha256:bc61b4374bc023f0660554ba52936468e05e93b3db32fbfc940977da7036d6a6` |
| Web | `registry.fly.io/grafoprint-staging-web@sha256:5e4c38bf4eb45b2cb4b845e66bf05a48ac02c99384970a612b11c8ec3e6eb971` |

PDF conserva `2fee01704` y su imagen anterior. **305 migraciones, sin cambios de esquema**; una máquina por servicio, mismos tamaños. Fuentes de ejecución cifradas con 31 días de protección y referencias anteriores conservadas para recuperación. No se recalculan cotizaciones históricas.

### Comprobaciones del lote

- 72 pruebas de API y 32 de interfaz/lógica, sin contar repeticiones. [CI de contenedores y tipos](https://github.com/studiocamaleon/gdi/actions/runs/37076522073) y [CI HTTP y aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37076521960) aprobados para la revisión exacta publicada. Compilaciones remotas completas; Docker y otros proyectos locales intactos.
- Ensayo HTTP en staging con una empresa y un operador ficticios, máquina láser, papel y tóner de importes conocidos. Dos PDF de cinco páginas, rangos `1,3,5` y `2`, doble faz, diez juegos. El motor mantiene 40 carillas y 30 hojas; preparación de 10 a 5 minutos, precio de $2.339,10 a $1.505,70. Sueltos conservan dos preparaciones. Vista previa y guardado devuelven el mismo precio.
- Cotización, creación de borrador, subida privada de ambos originales y reapertura mediante los endpoints normales. Chrome abre **Ver PDF del tomo** desde Archivos de la OT guardada: **6 páginas y 2 reversos en blanco**; originales agrupados y conservados. No se imprimió físicamente ni se emitió una OT real.
- Chrome: nueva orden sin aviso superior ni widget del Asistente; aviso de inicio visible al abrir Materiales, con estilo Grafo. El modo sólo se activó para la empresa ficticia.
- Datos, usuario y objetos ficticios retirados de staging; recuentos iniciales recuperados. Evidencia detallada y capturas fuera de Git. No hay datos ni credenciales privados en este registro.

### Uso y reversión

Ver [guía de tomos](../../docs/tomos-pdf-y-avisos.md). Crear el tomo, ordenar originales, indicar rangos y juegos, y pulsar **Ver PDF del tomo**. Los juegos se indican al imprimir: el PDF contiene uno. Papel/color/tamaño distintos pueden requerir preparaciones separadas; no se unifican simple y doble faz en un mismo archivo.

La reversión de código puede usar los digests del registro anterior, conservando los originales y cotizaciones guardadas. Volver a cotizar con la versión anterior recupera su regla de preparación por documento; evitar hacerlo sin evaluar ese cambio de precio. No hace falta revertir migraciones.

### Cierre de la publicación

Salud web/API 200, API directa protegida 403 y BFF sin sesión 401; seis máquinas iniciadas y tamaños conservados. Builder temporal retirado. Copia posterior **`1d96303b-6208-45a0-9237-cc19d4478672`**, completada **2026-10-03T00:01:12.874Z**, con 305 migraciones y 13 archivos: firma, huellas, descifrado de manifiesto, código exacto e imágenes desplegadas comprobados. El copiador terminó el ciclo automático y notificó éxito. No se repitió una restauración SQL completa en esta publicación.

Los intentos automáticos de las 23:01, 23:34, 23:42 y 23:54 UTC fallaron. Hubo además consultas B2 intermitentes que vencieron desde la Mac; no se demostró que todos los intentos tuvieran la misma causa. Una copia aislada a las 23:46 UTC fue verificada antes del despliegue. El ciclo horario de las 00:00 UTC volvió a completar con el servicio normal y el inventario actualizado, después de retirar las fixtures. No se redujeron retención, validación TLS ni controles de origen. Diagnóstico temporal retirado.
