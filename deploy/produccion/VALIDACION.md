# Validación de producción

## Primer ingreso e impresión rígida con corte — 01/10/2026, 16:20 UTC

- Publicación conjunta autorizada después del ensayo local y de staging. API y ambos workers ejecutan `b378ae41ead10c5a6ad08b0432aabecb660a5859`, imagen `registry.fly.io/grafoprint-production-api@sha256:f4171c0f2035177c75d8794a52a0cbfc526687f1b9897726a9e57088ab8e0319`. Se promovió el mismo digest probado en staging, sin recompilar. Web conserva `c42d6d506`; PDF y copiador conservan sus imágenes. Mismas máquinas, tamaños y controles de salud correctos.
- Corrige el bloqueo de `/tenants/current` posterior a un login válido con clave provisoria: permite mostrar el cambio obligatorio de contraseña. No se modificaron claves ni permisos de usuarios existentes. El alta de Usuarios continúa entregando clave provisoria, sin correo automático.
- El acomodo de impresión rígida incorpora el área útil de los cortes posteriores sobre el mismo material. En la imagen activa se comprobaron nueve piezas, dos placas y posiciones idénticas para impresión y láser, sin escribir datos de negocio. También se confirmó que la excepción de clave provisoria sólo está en el método de contexto de sesión.
- Pasaron 207 pruebas locales y los controles remotos de [HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36889386716) y [contenedores con tipos](https://github.com/studiocamaleon/gdi/actions/runs/36889386717). El recorrido HTTPS de primer ingreso, cambio de clave y permisos se completó con un operador ficticio en [staging](../staging/VALIDACION.md); no se usaron contraseñas de personas reales para el ensayo de producción.
- Tras el despliegue, HTTPS de web/API devuelve 200 y PostgreSQL está disponible. Contexto vía web sin sesión: 401; API directa protegida: 403. Sin nuevas migraciones, seeds, resets ni cambios de DNS, integraciones fiscales o datos comerciales.
- Respaldo previo de las 16:00 UTC firmado y descifrado antes de desplegar. Fuentes nuevas cifradas bajo retención e inventario actualizado. Copia posterior `bf89d357-27b8-4358-bc72-18a3c3cea07f`, completada a las 16:19:47 UTC: firma y descifrado aprobados, 301 migraciones, un archivo e imágenes/fuentes correctas. No se repitió la restauración SQL. Constructor remoto y túnel retirados; Docker local no se reinició.
- [PR #13](https://github.com/studiocamaleon/gdi/pull/13), dependiente de #12, sin fusionar. Reversión de código disponible al digest backend anterior `338ce43559d5d91558f32f52587d93cd8200206aa71b9175071b41157e3b2b0e`; conserva el esquema pero recupera los dos fallos corregidos. No requiere revertir datos.

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

## 01/10/2026 — Permisos por vista, cajas asignadas y recorrido publicado

Revisión **`2fee017048b1ba529f579dc5820878f9cf1ce066`**, PR #14 sobre #13, sin fusionar los PR. Lucas autorizó comprobar local, publicar en staging y promover a producción sólo después del ensayo. API, ambos workers, web y generador PDF usan este lote.

| Servicio | Imagen inmutable |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:47db777a89768d5f989dd8443532e52ea73f8d0ab1bf1937bf7036e5a5e48674` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:eb5699889ae1629f57e9a37eeaeaa11e2af118c3b808b2154d38583f435d2271` |
| PDF | `registry.fly.io/grafoprint-production-pdf@sha256:a86ea4b8aae6a9e4c45b5594840e216ce66847d232a8aab649694470ed4f547d` |

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

Copia previa válida de **2026-10-01T20:00:47.364Z**. Fuentes exactas cifradas y custodiadas en B2 con 31 días de protección. Copia posterior **`2aaddfa4-399d-4e62-b106-deb909091504`**, completada **2026-10-01T20:19:44.973Z**, con 302 migraciones, 1 archivos y las imágenes de la tabla: firma y descifrado del manifiesto comprobados. No se repitió una restauración SQL completa en esta publicación.

El recorrido usa una cotización y producto sintéticos de importe conocido; no reemplaza la validación industrial del catálogo a migrar. Centro de Copiado informa los requisitos faltantes: todavía debe incorporarse y verificar maquinaria/papel. Las restricciones de cuentas son opt-in por usuario. **No revertir a la API anterior después de asignar restricciones:** la versión vieja ignoraría las columnas nuevas; evaluar primero una corrección hacia adelante. El resto del plan de carga, recuperación cloud completa y facturación legítima mantiene los límites documentados anteriormente.


## 01/10/2026, 21:35 UTC — Cotizador y scroll de selectores (PR #15)

La API ejecuta **`fd7c20b88028d0445273ed310ab2edb5957854a0`** y la web **`5e6cffbab2bad64f6f8c4c5a2318c78d3186931b`**. PR #15 dependiente del #14; ninguno se fusionó durante esta corrección. Se comprobó local, luego staging y se promovieron las mismas imágenes por digest a producción.

| Servicio | Imagen vigente |
| --- | --- |
| API | `registry.fly.io/grafoprint-production-api@sha256:f4e5e6df330da2c742415933afb064efe4be06bcc963aa77d0df7fb6979e8895` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:4d211c03e12cdca75ec1c468d6155b0390a9002d425ce401cb99bb2edb030da1` |

Los workers y PDF mantienen `2fee01704` y las imágenes de la entrada anterior. Permanecen **302 migraciones**, una máquina por servicio y los mismos tamaños. No hubo migraciones de esquema, seeds, cambios de permisos ni de secretos de acceso.

- Crear propuesta caía en el render del selector porque la proyección comercial omitía `atributosSchemaJson`. La API conserva ese esquema pasando por el filtro de datos económicos privados. La regresión reproduce el render real del selector; no se oculta el error con un catálogo vacío.
- El CSS optimizado aplanaba los selectores de HeroUI y el aislamiento de estilos anclaba incorrectamente toda la cadena a `:scope`. Los descendientes del portal perdían `max-height`, `min-height` y `overflow-y`. Se conserva la raíz y sus combinadores mediante el parser de selectores, incluyendo pseudo-elementos, sin ampliar estilos a las pantallas anteriores.
- El buscador de asignaciones no tenía la función de filtrado conectada. Ahora filtra por nombre/grupo con comparación de mayúsculas y acentos. Se mantienen las opciones bloqueadas y los avisos de traslado.
- Nueve pruebas focalizadas aprobadas (cinco API, dos de contrato API/interfaz y dos de aislamiento CSS), con fallos reproducidos antes de corregirlos. Tipos de web y compilaciones remotas completas sin omitir la validación. CI del código: [HTTP](https://github.com/studiocamaleon/gdi/actions/runs/36927855712), [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/36927855707) y [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/36927855697), aprobados.
- Navegador local con componente real dentro de FormSheet, 35 opciones y CSS optimizado: lista de 320 px, desplazamiento hasta el final, selección de la última opción, teclado, búsqueda y ausencia de resultados comprobados. En staging se alcanzó el final del listado de pasos; en producción también el de máquinas. El cotizador abre el catálogo y la configuración del producto en ambos entornos. Formularios cerrados sin guardar asignaciones ni emitir órdenes.
- Controles de salud de Fly aprobados. Builder temporal retirado; no se reinició Docker ni se modificaron los servidores locales existentes.

### Recuperación de esta publicación

Fuentes de ambas revisiones cifradas y custodiadas con 31 días de protección. El inventario de recuperación conserva tanto la imagen de API nueva como la anterior que siguen usando los workers, además de la web, PDF y copiador. Copia posterior **`6a16a720-ef7e-43fe-8f59-62b0075f24f6`**, completada **2026-10-01T21:33:21.446Z**, con 2 archivos: firma, huella, descifrado del manifiesto y presencia de las fuentes/imágenes activas comprobados. Esta verificación de código no repitió la restauración SQL. Evidencia detallada privada fuera de Git.

### Migración operativa autorizada

Antes de estas correcciones se aplicó la migración operativa acordada: centros, máquinas, materiales/precios sin stock, catálogo con exclusiones, rutas/nodos/recetas, estaciones/equipo/horarios y gastos estructurales. Se preservaron clientes, accesos, cuentas, configuración fiscal e impuestos/comisiones de destino; no se importó historial comercial, fiscal ni de caja. Ensayo aislado previo, comparación completa del lote, diez cotizaciones comparadas con origen y comprobación posterior de producción.

La copia posterior a esa migración, `92be0b21-51f1-4a80-bb5e-532e643c69f3`, se restauró en una base aislada, con dos archivos descifrados y sus huellas verificadas. No se iniciaron servicios ni envíos desde la restauración. Las tres bases temporales de ensayo se retiraron después de comprobar que no tenían conexiones activas; se conservaron dumps y evidencia privada. Las configuraciones y precios que ya estaban incompletos en origen se detallan en el informe privado de migración; no se inventaron valores. Esto no equivale a probar todas las combinaciones del catálogo ni sustituye las validaciones pendientes de recuperación cloud y facturación legítima.
