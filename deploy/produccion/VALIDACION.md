# Validación de producción

## Retenciones y acreditaciones — 01/10/2026, 10:35 UTC

- Despliegue expresamente autorizado después de probar en local y staging. Backend `c0aa8cf46cf31a00c942afd9d99dc7f952475690` y web `c42d6d5063ce9cea23ae037475443edc0b6a6156`; imágenes promovidas sin recompilar desde los artefactos probados de staging. Los cuatro servicios terminaron saludables y conservan sus tamaños. PDF, copiador, DNS e integraciones fiscales no cambiaron.
- API y ambos workers: `registry.fly.io/grafoprint-production-api@sha256:338ce43559d5d91558f32f52587d93cd8200206aa71b9175071b41157e3b2b0e`. Web: `registry.fly.io/grafoprint-production-web@sha256:839e3c369a7c1a4643ce8bb8c876dd249cbbf223f1793d9cdbd5fdc77b9e827b`.
- Respaldo previo firmado de las 10:00 UTC comprobado antes de migrar. Migración aditiva `20261001100000_medios_pago_retenciones`: 300 → 301, sin seeds ni resets. Los recuentos de empresas, clientes, cobros, métodos y movimientos no variaron. Rol de aplicación verificado sobre los nuevos campos, sin permiso DDL. No se aplicaron tasas fiscales supuestas ni se generaron cobros/facturas de prueba en producción.
- Las 91 pruebas locales dirigidas y el ensayo de servicios compilados sobre PostgreSQL de staging están detallados en [su registro](../staging/VALIDACION.md). HTTP y contenedores de GitHub aprobaron la revisión ejecutable final; ambas imágenes se compilaron con comprobación de tipos.
- Después del despliegue, HTTPS de API/web devuelve 200 y la base está disponible. El proxy sin sesión devuelve 401 y la API directa protegida 403. Chrome mostró los nueve métodos existentes y permitió abrir el formulario con calendario, fechas adicionales y reglas de retención. Se dejó una pestaña nueva para configurar; no se guardó ni se recargó el formulario anterior del usuario.
- Fuentes exactas cifradas y retenidas en B2; inventario del copiador actualizado. La copia posterior `e86d3286-66ee-4e7a-b334-11e8c74c0608`, completada a las 10:35:08 UTC, pasó firma y descifrado del manifiesto con 301 migraciones, archivo e imágenes/fuentes correctas. **No se repitió la restauración SQL en esta actualización.** Constructor remoto y túnel retirados; Docker de la Mac no se reinició.
- El calendario incluido cubre Argentina 2026; otros años/países muestran advertencia de cobertura parcial. Los cobros electrónicos requieren confirmar importes, fecha real y referencia desde Tesorería; el vencimiento previsto ya no crea ingresos automáticos. Efectivo/transferencias inmediatas sin agente bancario conservan su circuito; cheques siguen en cartera. Ver [guía y límites](../../docs/medios-pago-retenciones.md).
- [PR #12](https://github.com/studiocamaleon/gdi/pull/12), dependiente de #11, sin fusionar. Una reversión al backend anterior reactivaría el planificador antiguo de acreditaciones: revisar pendientes antes de revertir. El recorrido comercial completo y el primer comprobante fiscal legítimo siguen siendo verificaciones independientes.

## Activación fiscal y aviso de ambiente — 01/10/2026, 06:35–06:52 UTC

- El titular completó los datos fiscales y el punto de venta de webservices de la primera empresa. Se verificó la autorización mediante consulta WSFE y, con su confirmación expresa, se activó la integración. La interfaz confirmó `Conectada` y ambiente `Producción`. No se emitieron facturas en esta revisión.
- El aviso de homologación en Datos fiscales era un texto fijo incorrecto. La página ahora consulta el ambiente a la API: distingue producción, homologación, modalidad manual y ambiente no confirmado. No deduce el ambiente fiscal de `NODE_ENV`.
- Web actualizada a `d9e255a3f8fe2fde6049c860ff13de9b84885d7e`, imagen `registry.fly.io/grafoprint-production-web@sha256:5960f782e6d8fa734edae518bb0b44b83f099955c4dfc6f28851658b6eb606db`. API, ambos workers, PDF y copiador conservan las imágenes del despliegue inicial. Sin migraciones ni cambio de tamaños.
- Validación: 13 pruebas dirigidas, lint, compilación remota con tipos y comprobación de privilegios del contenedor aprobados. GitHub confirmó `http`, `containers` y `npm`. Tras desplegar, HTTPS de web/API y base correctos; Chrome mostró `ARCA · Producción`, proveedor automático y PV activo, con los datos guardados intactos.
- Fuentes cifradas de la revisión web bajo custodia B2; se actualizó el inventario del copiador con la imagen exacta y las fuentes de web/backend. El constructor remoto temporal se retiró al terminar. Docker local y los otros proyectos no se reiniciaron.
- Copia posterior completada a las 06:50:59 UTC: comprobante remoto auténtico y manifiesto descifrado con la llave custodiada; se comprobaron la nueva imagen, ambas revisiones fuente y un archivo respaldado. Esta comprobación no repitió la restauración SQL; el último ensayo SQL es el de las 06:00 descrito abajo.
- Continúa pendiente el recorrido funcional de negocio y la comprobación del primer comprobante comercial legítimo cuando corresponda. La activación fiscal y estas consultas no equivalen a emitir y validar un comprobante.

## Alta inicial y acceso definitivo — 01/10/2026, 06:17–06:22 UTC

**Registro histórico; la configuración y activación fiscal se completaron en la sección superior.**

- El titular ingresó a Plataforma en `app.grafoprint.com.ar` con su cuenta y MFA. Se creó la primera empresa desde la interfaz normal: plan Founder, suscripción activa/manual, sin importar datos locales.
- Se envió una única invitación al correo autorizado. La aplicación confirmó aceptación por el proveedor y Resend confirmó `Delivered`; el titular la aceptó y eligió personalmente su contraseña. No se copiaron el enlace de activación ni la contraseña al registro público.
- Se comprobó en Chrome el acceso del administrador de la empresa, el nombre correcto, Founder en el menú y el panel inicial sin órdenes ni actividad. La ficha de Plataforma confirmó la suscripción. Esta comprobación no sustituye el recorrido de cotización, orden, inventario y caja.
- Falta completar los datos fiscales confirmados por el titular, registrar el PV de webservices y verificar/activar la integración de esa empresa. La comprobación previa de WSFE con el certificado de Plataforma no equivale a esa configuración por empresa. No se emitieron facturas ni se creó historial sintético de negocio en producción.
- No se cambiaron imágenes, tamaños, credenciales ni DNS durante esta alta. Inbox continúa sin habilitación operativa y Paddle live permanece pendiente por separado.

## Despliegue inicial — 01/10/2026, 05:34 UTC

**Registro de la fase previa al alta; para el estado vigente, consultar la sección superior.** En esta fase no se importaron datos locales, no se había creado la primera empresa ni se habían enviado invitaciones. El administrador de Plataforma cambió su clave y activó MFA; el certificado fiscal se cargó mediante esa sesión.

### Versión y servicios

- Revisión desplegada: `4dc345b472a180542e2b1036a804e8eb3f02d63a`. GitHub aprobó `http`, `containers` y `npm` para esa revisión. Los contenedores Linux se compilaron en remoto, incluidos los tipos de TypeScript. Docker de la Mac y los procesos locales del usuario no se reiniciaron.
- Una máquina por servicio, en los tamaños previstos: web 1 GB; API 2 GB; worker 4 GB; worker PDF 1 GB; generador PDF 1 GB, todos en São Paulo. Copiador 512 MB en Virginia, red propia y volumen de 10 GB.
- API y web: salud correcta; conexión con PostgreSQL confirmada. Workers de cotización, geometría, planificación y PDF iniciados. API → generador PDF por red privada devuelve estado correcto. API directa sin credencial del canal responde 403; proxy web sin sesión responde 401.
- Inbox y registro público siguen deshabilitados. El planificador general sí está activo en producción: se revisaron mantenimiento de sesiones/archivos, vencimientos de trial, acreditaciones, gastos recurrentes, asignación de producción, instantáneas ETA y despacho de correos pendientes. `GRAFO_LOCAL_DISABLE_CRON` sólo apaga ese planificador en desarrollo; no usarlo como garantía de aislamiento en una recuperación. Paddle carece de credenciales y no hay integraciones WATI conectadas. No se emitieron comprobantes fiscales.

| Servicio | Imagen inmutable |
|---|---|
| API y ambos workers | `registry.fly.io/grafoprint-production-api@sha256:c6aeb212b5a1178d3d9c94a53b5f9365763b34ddb9d1c9a6ec9643101e2be766` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:11a56bc44e26a48bfbb19b80d64e1940e67d0b3e54ccbd446149864233692f62` |
| PDF | `registry.fly.io/grafoprint-production-pdf@sha256:221c24711a1466fc940a8a2ad8395f3b27d6ec130d060c93f22673f56255adc5` |
| Copiador | `registry.fly.io/grafoprint-production-respaldo@sha256:a82188f997a197d58be5b384175a7bb32a1e419428c05e58ed5a1bbcff01ac5f` |

### Datos, accesos y recuperación

- Neon: 300 migraciones completas sobre base nueva, sin seeds ni resets; roles separados de migración, aplicación y respaldo. Lector sin escritura ni creación de objetos. TLS y nombre de servidor verificados; Prisma usa `sslaccept=strict`.
- Redis: conexión TLS con certificado válido, `noeviction` y ensayo real de Queue/Worker/QueueEvents correcto. Sólo se eliminó la cola sintética del ensayo.
- R2: privado, CORS limitado a la aplicación; subida firmada, rechazo de sobrescritura, descarga exacta, rechazo anónimo y multipart comprobados. El lector de respaldo puede listar/leer y recibe 403 al intentar escribir. Tras recuperar y comparar su huella, se retiró únicamente el archivo sintético del ensayo; su versión cifrada permanece retenida en B2.
- B2: depósito de producción privado en la cuenta independiente, retención compliance de 30 días y claves limitadas al depósito/prefijo de producción. Clave amplia temporal revocada y rechazo 401 comprobado. Cuatro notas completas de recuperación confirmadas por el titular, separadas de staging.
- Primera copia automática completada a las 05:28 UTC: base nueva, un archivo sintético y fuentes de la revisión desplegada. Fuentes cifradas de unos 46 MB bajo retención; firma y versiones exactas verificadas. Healthchecks recibió la señal real y mostró UP.
- Recuperación a las 05:32 UTC: firma auténtica, descifrado y huellas correctos; restauración SQL en una base nueva y aislada, 300 migraciones, cero empresas, un administrador y su evento de alta. El archivo de 136 bytes coincide con el original. Se recuperó también el código. Cero envíos externos.
- Copia horaria siguiente, sin reinicio: completó a las 06:00:46 UTC. Se verificó el recibo firmado, se descargó/descifró y restauró a otra base SQL aislada. Contiene 300 migraciones, cero empresas y el estado posterior al alta de seguridad: secreto MFA descifrable y par certificado/clave ARCA válido y coincidente con su huella. Cero correos y cero emisiones en el ensayo.
- **Alcance de los ensayos:** acreditan base, archivo sintético, código y recuperación criptográfica de MFA/ARCA. Todavía no acreditan el ingreso interactivo a la aplicación restaurada, un recorrido empresarial recuperado ni el traslado completo de dominios a infraestructura de reemplazo. No se declara un RTO total.
- Administrador: contraseña personal definida por el titular, MFA activo y custodia de códigos confirmada en el flujo. Se retiró del archivo de preparación la clave provisoria ya reemplazada.
- Preflight de empresa nueva: 112 materiales de biblioteca, 11 categorías comerciales y 48 subcategorías disponibles por migraciones. Founder activo/manual, sin vencimiento de prueba. Sin seeds ni copia de datos locales.
- AFIP SDK: certificado y clave cargados desde Plataforma con MFA y confirmación del titular; estado vigente. A las 05:50 UTC se leyó el sobre cifrado de la base mediante el rol lector, se descifró con el servicio de la aplicación y se confirmó WSFE/PV 2 con el adaptador compilado, sin emitir. No se publicaron claves ni se importó configuración local. Resend tiene acceso de envío limitado al dominio; el correo real se verificará con la invitación autorizada.
- Acceso inicial: faltaba `WEB_ORIGIN` en el manifiesto web; el control rechazó el login con 503. Se agregó el origen definitivo a la configuración versionada y se aplicó temporalmente el dominio propio de Fly mientras se emite TLS. Ingreso y MFA comprobados en Chrome; escritura sin token desde el origen correcto devuelve 400 y desde origen ajeno 403. Las 19 pruebas de origen/canal de producción pasan. Misma imagen web, sin compilación adicional.

### Dominios y pendientes para habilitar el uso

Donweb contiene A/AAAA para `app.grafoprint.com.ar` y `api.grafoprint.com.ar`, y los CNAME ACME/TXT de propiedad indicados por Fly. Tras la espera inicial de propagación, Fly emitió ambos certificados administrados a las 06:06 UTC: estado Ready/active, RSA y ECDSA, vencimiento 30/12/2026. A las 06:13 UTC se comprobó HTTPS real con validación estricta: web `/login` y `/api/health`, y API `/api`, todos 200. La web comercial y los DNS de correo conservan sus destinos.

Se aplicó `WEB_ORIGIN=https://app.grafoprint.com.ar` en la máquina web existente, reutilizando su imagen y tamaño. Salud correcta tras el reinicio de esa máquina. La prueba de creación de sesión sin token devuelve 400 desde el origen definitivo, y 403 desde el anterior `.fly.dev` o un origen ajeno. No se crearon sesiones con esas pruebas. Falta comprobar el ingreso interactivo del administrador en el dominio definitivo.

El panel de AFIP SDK, proyecto Grafoprint Pro, registra dos consultas Production/WSFE `FECompUltimoAutorizado` (01:48 y 02:50 hora argentina). La sección CUITs mostró cero para el período seleccionado; ese listado no sustituye el resultado de las consultas ni requiere cargar allí el certificado propio, que la integración envía por API. Sin emisiones.

Pendientes: ingreso del administrador en el dominio definitivo; alta de empresa vacía con Founder privado/manual; invitación y acceso; configuración fiscal por empresa; recorrido funcional con datos sintéticos en entorno aislado y sin emisión fiscal. Paddle live continúa separado. No fusionar PR ni declarar seguridad absoluta a partir de estas verificaciones.

## Preparación — 01/10/2026

- Producción todavía no desplegada ni habilitada. Sin empresas, invitaciones, comprobantes fiscales ni importaciones locales.
- Nuevos recursos creados: cinco apps vacías Fly en red de producción y app de respaldo en su propia red; Redis exclusivo, TLS y noeviction; Neon PostgreSQL 16 exclusivo. Activación de AFIP SDK Pro confirmada.
- Base de seguridad `7b277e3bf`: GitHub confirmó `http`, `containers`, `npm` y CodeQL aprobados. Esto valida código/contenedores, no la configuración final de producción.
- ARCA de Plataforma en `91a73bead`: 143 pruebas distintas en once suites, tipos API/web y lint dirigidos aprobados en el ensayo local aislado. Sin consultas fiscales reales.
- Canal de producción: las seis pruebas iniciales reprodujeron la falta de protección específica antes del cambio. Después pasan 10 pruebas API y 41 web (incluyen staging, proxy y servidor). Producción no reutiliza la clave de staging y falla cerrada sin su credencial/IP válidas.
- Respaldos: 33 pruebas con cifrado/descifrado `age` real, incluyendo ida y vuelta con prefijo `produccion` y rechazo de entorno equivocado. Configuración exige activación explícita e identidad de origen. **No sustituye el ensayo cloud de la copia real de producción.**

Pendiente: credenciales limitadas, migraciones cloud, almacenamiento/CORS, despliegue remoto, DNS/HTTPS, correo, custodia y ensayo real de respaldo, ARCA/PV, administrador/MFA, plan privado y recorrido funcional. Registrar evidencia y versiones al completar cada paso.
