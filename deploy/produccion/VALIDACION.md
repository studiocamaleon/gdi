# Validación de producción

## Despliegue inicial — 01/10/2026, 05:34 UTC

**Infraestructura desplegada; uso empresarial todavía pendiente de habilitación.** No se importaron datos locales, no se creó la primera empresa ni se enviaron invitaciones. El administrador de Plataforma ya cambió su clave y activó MFA; el certificado fiscal se cargó mediante esa sesión.

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

Donweb contiene A/AAAA para `app.grafoprint.com.ar` y `api.grafoprint.com.ar`, y los CNAME ACME/TXT de propiedad indicados por Fly. Los DNS autoritativos, Google, Cloudflare y consultas desde la API en Fly devuelven las direcciones esperadas. Fly todavía informa ausencia de registros en su verificador: no se declara HTTPS operativo para esos dos nombres hasta comprobar certificados y conexión real. Los nombres `.fly.dev` responden con HTTPS válido. La web comercial y los DNS de correo conservan sus destinos.

Pendientes: HTTPS y origen web definitivos; alta de empresa vacía con Founder privado/manual; invitación y acceso; configuración fiscal por empresa; recorrido funcional con datos sintéticos en entorno aislado y sin emisión fiscal. Paddle live continúa separado. No fusionar PR ni declarar seguridad absoluta a partir de estas verificaciones.

## Preparación — 01/10/2026

- Producción todavía no desplegada ni habilitada. Sin empresas, invitaciones, comprobantes fiscales ni importaciones locales.
- Nuevos recursos creados: cinco apps vacías Fly en red de producción y app de respaldo en su propia red; Redis exclusivo, TLS y noeviction; Neon PostgreSQL 16 exclusivo. Activación de AFIP SDK Pro confirmada.
- Base de seguridad `7b277e3bf`: GitHub confirmó `http`, `containers`, `npm` y CodeQL aprobados. Esto valida código/contenedores, no la configuración final de producción.
- ARCA de Plataforma en `91a73bead`: 143 pruebas distintas en once suites, tipos API/web y lint dirigidos aprobados en el ensayo local aislado. Sin consultas fiscales reales.
- Canal de producción: las seis pruebas iniciales reprodujeron la falta de protección específica antes del cambio. Después pasan 10 pruebas API y 41 web (incluyen staging, proxy y servidor). Producción no reutiliza la clave de staging y falla cerrada sin su credencial/IP válidas.
- Respaldos: 33 pruebas con cifrado/descifrado `age` real, incluyendo ida y vuelta con prefijo `produccion` y rechazo de entorno equivocado. Configuración exige activación explícita e identidad de origen. **No sustituye el ensayo cloud de la copia real de producción.**

Pendiente: credenciales limitadas, migraciones cloud, almacenamiento/CORS, despliegue remoto, DNS/HTTPS, correo, custodia y ensayo real de respaldo, ARCA/PV, administrador/MFA, plan privado y recorrido funcional. Registrar evidencia y versiones al completar cada paso.
