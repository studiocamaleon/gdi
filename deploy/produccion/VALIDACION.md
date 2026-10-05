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


## 02/10/2026, 18:15 UTC — Inicio sin stock y atajos comerciales (PR #16)

Revisión **`debada9153ce43ad2e4a00e8c043b5982d8e2fdf`**, dependiente de PR #15. Publicación autorizada por Lucas: primero staging, recorrido aprobado y promoción de las mismas imágenes inmutables a producción. Sin fusionar PR anteriores ni modificar la web comercial.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:8acc4b8db24ee0a3ea9b7c01329ebe4dfc354a3241bbef430046c9a4cdfeca8f` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:8fd868a4a16a68afa9bda97027e0bd0b7f3bcee0692522d60ecf391da2030b03` |

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

Copia posterior **`a97fca23-7ff6-4fcb-8df5-12a8185c99b5`**, completada **2026-10-02T18:13:51.725Z**: 303 migraciones, 2 archivos, fuente exacta cifrada con protección de 31 días e imágenes vigentes. Firma, huella y descifrado del manifiesto comprobados. No se repitió una restauración SQL completa en esta publicación. Evidencia detallada y accesos fuera de Git.

El modo queda **apagado por defecto**. Lo activa quien tenga Gestionar stock desde Inventario → Stock → Modo de inicio. Las nuevas órdenes no controlan ni consumen stock; conservan cantidades, costos y demás requisitos. Las anteriores mantienen su control y apagar el modo no provoca consumo retroactivo. Ver [guía](../../docs/inicio-sin-stock.md). **No revertir a código que ignore las marcas después de emitir OTs en este modo**; evaluar una corrección hacia adelante conservando columnas e historial.


## 02/10/2026, 22:00 UTC — Recorridos con permisos por vista (PR #17)

Código de ejecución **`088f92576ceb7bcbb4fbc73c53198c5f92ded19f`**. Rama dependiente del PR #16, sin fusionar la cadena. Primero se comprobó local y staging; después se promovieron a producción las mismas imágenes por digest. Los commits posteriores que registran esta evidencia no cambian el código desplegado.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:95f8b868c6b99b8bcb76d83308bd1b242d9c8f69647b1e7c9790a6d347748899` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:4067b9f5df484360ed938cd98e10177763501ba17110703dfcd141a5c74ca8e8` |

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

Copia posterior **`7321d039-de37-425b-b582-e68382776fdc`**, completada **2026-10-02T21:59:27.083Z**: 305 migraciones, 2 archivos y fuentes exactas cifradas con protección de 31 días. Firma, huella, descifrado del manifiesto y presencia de las imágenes vigentes comprobados. No se repitió una restauración SQL completa. Evidencia detallada y secretos fuera de Git.

Antes de migrar se verificó la copia de `2026-10-02T21:00:51.150Z`. Las migraciones y publicación conservaron datos y configuración de la empresa existente.

Esta cobertura no asegura todas las combinaciones posibles de permisos, planes o rutas industriales. Ver [alcance detallado](../../docs/permisos-recorridos-validacion.md). Para revertir la interfaz, conservar las migraciones y archivos creados; la API debe seguir reconociendo `DISENO_COTIZACION`. No eliminar valores del enum ni diseños para revertir código.

## 02/10/2026 (Argentina) — Tomos PDF y avisos de la OT (PR #18)

Código de ejecución **`e11e431b368353fb12fd52fb6768c2ffbfa661b2`**, dependiente del PR #17. Publicación solicitada por Lucas, primero en staging y después en producción con las mismas imágenes por digest. Sin fusionar la cadena de PR ni cambiar la web comercial.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:bc61b4374bc023f0660554ba52936468e05e93b3db32fbfc940977da7036d6a6` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:5e4c38bf4eb45b2cb4b845e66bf05a48ac02c99384970a612b11c8ec3e6eb971` |

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

Salud web/API 200, API directa protegida 403 y BFF sin sesión 401; seis máquinas iniciadas y tamaños conservados. Builder temporal retirado. Copia posterior **`37db0712-10bd-4ee6-999a-f5b552431c65`**, completada **2026-10-03T00:00:20.774Z**, con 305 migraciones y 2 archivos: firma, huellas, descifrado de manifiesto, código exacto e imágenes desplegadas comprobados. El copiador terminó el ciclo automático y notificó éxito. No se repitió una restauración SQL completa en esta publicación.

Producción conservó recuentos de empresas, clientes, cobros, medios y movimientos, rol de aplicación sin DDL y configuración de inicio existente. Chrome abrió la nueva orden y Centro de copiado con una sesión de permisos limitados; Asistente oculto por defecto. No se guardaron datos comerciales, facturas, cobros ni envíos de prueba. Se acotó el inventario de fuentes activas para mantenerlo dentro del máximo de diez artefactos; las versiones históricas continúan protegidas en B2 y referenciadas por sus manifiestos anteriores.


## 03/10/2026 — Sentry y monitor de Plataforma (PR #20)

Revisión de ejecución **`b030b6ab7a471bf41e55ff6f460a928c4b808b63`**, dependiente del PR #19. Publicación autorizada, comprobada primero en staging y promovida a producción conservando los digests. No se fusionaron PR ni se modificó la web comercial.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:804ae5218e78591c8629317eca1609998232e61c0a998d613ca7fabd0ea4839d` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:0d7ea346a5ee7da29931281f1e0f8f094b31d7f7145c63f246a2c265e8e02d42` |

Gotenberg conserva su imagen `sha256:a86ea4b8aae6a9e4c45b5594840e216ce66847d232a8aab649694470ed4f547d`. **305 migraciones, ninguna nueva**. Seis máquinas iniciadas, mismos tamaños y controles de salud; web/API 200, API privada directa 403 y BFF sin sesión 401. Constructor temporal retirado, sin reiniciar Docker ni otros proyectos locales.

### Recorrido comprobado

- 36 pruebas enfocadas (28 backend, 8 interfaz), tipos y lint de los cambios. [CI de contenedores y tipos](https://github.com/studiocamaleon/gdi/actions/runs/37096268431), [HTTP y aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37096268425) y [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/37096268400) aprobados para la revisión exacta.
- Recepción de eventos ficticios desde API y navegador al pulsar **Probar monitoreo** en el panel. Eventos de transporte desde los contenedores de worker, worker PDF y Next servidor aceptados por Sentry, con servicio, entorno y versión correctos. No se hizo caer un proceso ni se provocó un fallo de una cola real para este ensayo.
- **Plataforma → Errores del sistema** muestra los grupos de ensayo, filtra entorno/estado/período y los incorpora automáticamente sin recargar. El acceso de lectura de Sentry es únicamente `event:read`; la API proyecta campos permitidos y no expone la credencial. Los ensayos se excluyen por defecto. Si falta el conteo del período, se muestra «—».
- Sesión personal de Plataforma y MFA obligatorios. Usuario de empresa rechazado en el monitor. En staging se verificó además el recorrido HTTP con un administrador ficticio y MFA; al finalizar se revocaron sus sesiones y permisos, conservando la auditoría. No se crearon accesos de ensayo en producción.
- Filtrado de datos sensibles e IP en Sentry; sin formularios, conversaciones, archivos, cookies, logs, Replay ni transacciones. Las pruebas locales cubren aislamiento y minimización; la vista recibida y el ensayo del emisor servidor corroboraron los datos técnicos permitidos.
- Dirección operativa de avisos verificada por el titular y configurada para los dos proyectos. Las reglas de alta prioridad notifican a un miembro explícito, sin depender de asignados sugeridos ni actividad reciente. Se solicitó una notificación de prueba por proyecto; Sentry confirmó «Notification fired!» para API. La recepción en la casilla tras cambiar el destinatario queda pendiente de confirmación del titular; no confundir envío con entrega.

### Copia y reversión

Copia posterior **`c6e8193e-bf2f-4d77-a1a9-2f5379139314`**, completada **2026-10-03T05:12:07.677Z**, con 305 migraciones y 2 archivos. Firma, huellas, descifrado del manifiesto, fuentes exactas cifradas con protección de 31 días e imágenes vigentes comprobados. No se repitió una restauración SQL completa. Evidencias y secretos fuera de Git.

Para desactivar la captura, establecer `SENTRY_ENABLED=false` y reiniciar los servicios afectados. Para revertir el lote completo, conservar la base y usar API/workers `e11e431b3` (digest `sha256:bc61b4374bc023f0660554ba52936468e05e93b3db32fbfc940977da7036d6a6`) y web `061a75873` (digest `sha256:adf8dfd9f5b386b6cea2bd785c4cad2fa4fd465303ab3edbd7a948d49d2d3b9f`). No eliminar datos ni revertir migraciones.

Mapas de código fuente desactivados en esta primera etapa. No equivale a monitoreo completo de disponibilidad, rendimiento, errores absorbidos por integraciones ni a una prueba de caída de producción. Ver [alcance y operación](../../docs/monitoreo-sentry.md).

## 05/10/2026, 21:06 UTC — Cobros delegados y permisos transversales (PR #22)

Revisión de ejecución **`0d0b70509c706c6c33875ef5e8a35890ad03107f`**, dependiente del PR #20. Publicación solicitada por el titular, primero en staging y después en producción con las mismas imágenes por digest. No se fusionaron PR ni se modificó Vercel. Los commits documentales posteriores no cambian la revisión ejecutada.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:b0a3b812577cb52b709b3ce5f286ce6232f6d9d6eaf90b3d7c0b7422f983fd85` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:dd3c8eee47dca7f638d1822d5efb4279143aeee2b70174babccf6b81008a0c69` |

Gotenberg conserva `sha256:a86ea4b8aae6a9e4c45b5594840e216ce66847d232a8aab649694470ed4f547d`. **305 migraciones, ninguna nueva**; una máquina por servicio, seis iniciadas y mismos tamaños. Salud web/API 200, API privada directa 403 y BFF sin sesión 401. Constructor temporal de esta publicación retirado; Docker y otros proyectos locales intactos.

### Corrección y comprobaciones

- Cobrar desde una OT ya no exige entrar a Administración. Conserva los permisos de consulta del trabajo y del cliente, limita las cuentas a las asignadas y evita consultar deuda general sin autorización. El saldo usa el importe aplicado a la OT, aunque el recibo se reparta.
- Aprobación de presupuestos, gestión de empleados/comisiones, ejecución desde Estaciones/Colas y acciones de anulación se alinearon con los permisos extra y las vistas correspondientes. La matriz contrasta las 11 opciones actuales de «Aparte de los módulos» con autorización y rechazo en API.
- Regresión local: 234 pruebas de API y 116 de interfaz; ensayo HTTP con base desechable: 19. Ejecuciones enfocadas posteriores: 43 API y 42 interfaz, con solapamiento respecto de las anteriores. Tras corregir una declaración de tipo faltante, 39 pruebas de interfaz/navegación correctas.
- Compilaciones completas de backend y web en Fly, **con comprobación de tipos habilitada**. Los trabajos de GitHub de [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37371713733) y [HTTP/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37371713729) no consiguieron un ejecutor alojado y se cancelaron. **No se declaran aprobados**. La publicación se comprobó mediante builds remotos y ensayos directos; no se fusionó el PR.

- Promoción realizada tras las 20 comprobaciones HTTP/SSR en staging con un perfil cobrador sin acceso general a Administración. El ensayo generó y retiró un cobro ficticio y su PDF, sin operaciones de prueba en producción.
- Alcance del usuario afectado verificado en una transacción de sólo lectura: permiso de cobro activo y exactamente las dos cuentas elegidas por el titular, sin destinos de transferencia. La asignación se guardó desde la configuración autorizada, sin ampliar otros permisos.
- Recuentos de empresas, clientes, cobros, métodos de pago y movimientos conservados entre controles. Rol de aplicación sin DDL y configuración de inicio existente conservados. No se emitieron facturas, cobros ni comunicaciones reales de prueba.

### Respaldo

Copia previa `455005f0-7a7b-4aca-8d80-56a6a16c901c`, completada a las **20:01:03.183 UTC**. Copia posterior **`cad76e49-9e12-458e-87e3-7bde11650253`**, completada **2026-10-05T21:05:13.897Z**, con 305 migraciones y 11 archivos. Firma, huellas y descifrado del manifiesto, revisión exacta e inventario de imágenes comprobados. Fuentes cifradas protegidas durante 31 días; referencias históricas conservadas. **No se repitió una restauración SQL completa**. Evidencia y accesos fuera de Git.

### Reversión

Para revertir sólo este lote, conservar la base y usar la revisión anterior `b030b6ab7a471bf41e55ff6f460a928c4b808b63`: API/workers `sha256:804ae5218e78591c8629317eca1609998232e61c0a998d613ca7fabd0ea4839d` y web `sha256:0d7ea346a5ee7da29931281f1e0f8f094b31d7f7145c63f246a2c265e8e02d42`. Esto vuelve a introducir el bloqueo del cobro delegado. No revertir migraciones ni borrar operaciones comerciales.

## 05/10/2026, 22:40 UTC — Operadores habituales/de apoyo y acciones de la OT (PR #23)

Revisión de ejecución **`5837255089303538b7ec9cbe7f20d03c3b4ca5a7`**, dependiente del PR #22. Despliegue solicitado por el titular: staging, comprobación y promoción de las mismas imágenes a producción. Sin fusionar la cadena de PR ni modificar Vercel. Los commits documentales posteriores no cambian la revisión ejecutada.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:5a3b4b141345b67be3d97dd7cc6eca3d19a392ef8a344c933ae775dbd326e92e` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:e6baa8cb022b4d7483b52718411383a9fd6b54f721aeaf6f321a96dbb92fa137` |

Gotenberg conserva `2fee01704` y `sha256:a86ea4b8aae6a9e4c45b5594840e216ce66847d232a8aab649694470ed4f547d`. Se mantienen las seis máquinas y sus tamaños. Salud web/API 200, API directa privada 403 y BFF sin sesión 401; versión ejecutada y configuración de Sentry comprobadas. Constructor remoto temporal retirado; Docker y los otros proyectos locales intactos.

### Migración y alcance

- **306 migraciones**: aplicada una sola vez `20261005220000_personal_habitual_apoyo`, mediante el migrador separado, sin seeds ni resets. Agrega el modo de personal por estación (habitual por defecto) y la elección de personal en el ítem de OT. Permisos de lectura del rol de ejecución comprobados, sin DDL.
- Las personas existentes siguen como habituales. Agregar un apoyo a otra estación no cambia su horario ni concede permisos de usuario. No se modificó el personal de las empresas operativas durante las pruebas.
- Elección previa por paso raíz: revisar disponibilidad, guardar/reabrir y emitir. Validación de nuevo al emitir y rollback si dejó de ser posible. La reasignación posterior no es reemplazada por la elección antigua del borrador.
- Menús únicos **Imprimir** y **Seguimiento**, conservando condiciones y permisos de documentos, etiqueta, historial, enlace y QR. Componentes/lotes y pasos iniciados mantienen los límites documentados en [la guía](../../docs/asignacion-operadores-ot.md).

### Comprobaciones

- **122 pruebas locales** (85 de motor/ETA/interfaz y 37 de integración con PostgreSQL), tipos completos de API/web y revisión visual local aprobadas previamente.
- CI del SHA desplegado: [HTTP/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37380181309/job/111999845353) y [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37380180950/job/111999844284), ambos correctos. Compilaciones completas remotas adicionales con tipos habilitados.
- **24 comprobaciones HTTP/SSR en staging** con empresa y usuarios ficticios: alta de estación habitual/apoyo, revisión, guardar/reabrir/emitir, rechazo sin supervisión y de cotización ajena, operador inválido, rollback por habilitación retirada, transferencia conservada al leer el tablero, reparto automático sin apoyo y ausencia de doble ocupación del habitual.
- Chrome en staging: desplegables Imprimir y Seguimiento, apertura del QR, configuración de Centro de copiado y opciones Habitual/De apoyo. Se cerró la configuración sin guardar; no se ejecutaron impresiones físicas.
- Datos y accesos ficticios retirados por sus identificadores; recuentos operativos de staging conservados. Producción recibió únicamente la migración y las imágenes; no se crearon órdenes, cobros, facturas ni comunicaciones de prueba allí. Se comprobó además en Chrome la pantalla de estaciones y el selector Habitual/De apoyo de Corporearte, cerrando sin guardar.

### Respaldo y reversión

Copia previa `613d7a1d-3f9d-4f3b-9a54-6292c105f7f0`, completada **2026-10-05T22:00:55.290Z**. Copia posterior **`888682dd-1cc5-4f1a-ada8-86016468d773`**, completada **2026-10-05T22:38:46.052Z**, con 306 migraciones y 20 archivos. Firma, huella y descifrado del manifiesto, revisión exacta y referencias de imágenes/fuentes comprobados. Fuentes cifradas y protegidas por 31 días. No se repitió una restauración SQL completa. Evidencias y accesos fuera de Git.

Para revertir este lote, mantener las columnas nuevas y volver a API/workers `sha256:b0a3b812577cb52b709b3ce5f286ce6232f6d9d6eaf90b3d7c0b7422f983fd85` y web `sha256:dd3c8eee47dca7f638d1822d5efb4279143aeee2b70174babccf6b81008a0c69` (`0d0b70509`). No borrar datos ni revertir migraciones. La versión anterior no distingue apoyos y podría incluirlos en el reparto automático: revisar las habilitaciones creadas después del despliegue antes de volver atrás.
