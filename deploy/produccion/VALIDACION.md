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


## 2026-10-06, 12:11 UTC — Avisos de órdenes finalizadas, reintentos y botones (PR #24)

Revisión ejecutada **`8053bcf0ee05c6d8575e967547fc2888b448e690`**, dependiente del PR #23. Publicación solicitada por el titular: staging, validación y promoción de las mismas imágenes a producción. Sin fusionar la cadena de PR ni modificar la web comercial de Vercel. Los commits documentales posteriores no cambian esta revisión de ejecución.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:9b7a956cb647b28440d449f9e61ac24f4413a0ca65ddebb1cba2e798850115a7` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:61b249babbb53792f2f9d9597497bd47c5854fc7fcc45a5805786e5c535603c1` |

**306 migraciones; ninguna nueva.** Se conservan seis máquinas, sus tamaños, el PDF `2fee01704` (`sha256:a86ea4b8aae6a9e4c45b5594840e216ce66847d232a8aab649694470ed4f547d`) y la imagen del copiador. Salud web/API 200, API directa privada 403 y BFF sin sesión 401. Revisión de ejecución y Sentry comprobados. Constructor temporal retirado al terminar; Docker y los otros proyectos locales intactos.

### Alcance y comprobaciones

- Finalizar el último paso genera la variante con/sin saldo que corresponda: QR si está habilitado; de lo contrario texto, si está habilitado. Las cuatro variantes comparten deduplicación. QR deja de figurar como pendiente de implementación y continúa siendo optativo.
- Historial de avisos: reintento de fallos Wati confirmados, previa confirmación del destinatario, misma fila y contador de intentos conservado. Registro de autor, control de versión, permisos y aislamiento. Los estados inciertos requieren su resolución manual habitual.
- Editar orden, Entregar, Imprimir y Seguimiento comparten componente Grafo y altura de 32 px; se conservan sus menús y acciones.
- **170 pruebas locales** previamente aprobadas. CI del SHA publicado: [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37387179827/job/112023670720) y [HTTP/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37387180140/job/112023432421), ambos correctos. Builds remotos con tipos habilitados; la interrupción de transporte durante la primera subida se resolvió publicando la misma imagen compilada por SSH, sin modificar el código.
- **35 comprobaciones HTTP/SSR en staging**: finalizar el último paso, las cuatro variantes, saldo parcial correcto, ambas opciones apagadas, reapertura sin duplicación, reintento válido, segundo clic rechazado, versión inválida, usuario sin permiso, otra empresa, anónimo y estado incierto. El ensayo usa cobros/órdenes ficticios y una integración sin credenciales externas; no envió mensajes.
- Chrome: menús de impresión/seguimiento y QR de una OT existente; historial de avisos y confirmación del reintento sobre una fila ficticia, cancelada sin enviar. Datos y usuarios del ensayo retirados por identificadores, sin limpiar los datos persistentes de staging.
- Producción: comprobación de lectura sobre una OT existente y de la configuración del canal. No se crearon operaciones comerciales ficticias, no se cambiaron las opciones de avisos y no se reenviaron mensajes históricos. La entrega real por Wati no fue ensayada en este despliegue y conserva las condiciones del proveedor, plantilla, consentimiento y horario.

### Respaldo y reversión

Copia previa **`566fb271-31aa-4ee9-9065-bc268373cb68`**, completada **2026-10-06T11:00:56.985Z**. Copia posterior **`b1e5c7a9-9dd9-4ffc-98c7-369adb8c5302`**, completada **2026-10-06T12:10:36.982Z**, con 306 migraciones y 20 archivos. Firma, huella y descifrado del manifiesto, revisión exacta e inventario de imágenes/fuentes comprobados. Fuentes cifradas protegidas por 31 días. **No se repitió una restauración SQL completa**. Evidencia privada fuera de Git.

Para revertir únicamente el código, conservar la base y volver a `5837255089303538b7ec9cbe7f20d03c3b4ca5a7`: API/workers `sha256:5a3b4b141345b67be3d97dd7cc6eca3d19a392ef8a344c933ae775dbd326e92e` y web `sha256:e6baa8cb022b4d7483b52718411383a9fd6b54f721aeaf6f321a96dbb92fa137`. Esto reintroduce la selección incorrecta de QR y quita el reintento. No borrar avisos ni operaciones y no revertir migraciones.
## 06/10/2026, 17:34 UTC — Niveles, planchas y descuentos en OT (PR #25)

Revisión ejecutada **`b89000446af1153ea720481c424a5eaad175a8f9`**, dependiente del PR #24. Publicación autorizada por el titular después de comprobar staging. Se promovieron las mismas imágenes por digest, sin recompilar para producción, fusionar PR ni modificar Vercel. Los commits documentales posteriores no cambian esta revisión ejecutada.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:006f62ffbbdc6456c37f72859c133f14d02146fcd7d55f4849e5c9e41ed9483f` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:a384f9677a0c2362db3179287f707fdd16ea11f9f75649e7398127dee96e8977` |

**306 migraciones, ninguna nueva.** Se mantienen seis máquinas y sus tamaños, Gotenberg `2fee01704` y la imagen del copiador. Salud web/API 200, API directa privada 403 y BFF anónimo 401. Revisión y configuración de Sentry verificadas en los cuatro servicios actualizados; rol de aplicación sin DDL comprobado. Constructor temporal propio retirado. Docker y los demás proyectos locales permanecieron intactos.

### Alcance y comprobaciones

- Perfiles por máquina y nivel en pasos de ruta, opcionales y nodos propios, conservando las elecciones anteriores y las reglas por operación del procesamiento vectorial. Configuración de niveles manuales conservada. No se actualizan productos masivamente.
- La plancha utiliza los márgenes físicos del pliego también cuando el usuario no puede ver costos. En staging, «Papel adhesivo / sticker troquelado» derivó 270,4 × 428,2 mm y cotizó correctamente una plancha por pliego.
- Descuentos manuales y cupones desde la ficha de una OT existente, incluso finalizada. Sin cambiar sus pasos, costos, materiales o presupuesto original. Controles de facturación preparada/emitida, total cobrado, límites del operador, permisos, versión y usos del cupón; registro de autor e importes.
- **320 pruebas dirigidas** aprobadas: 107 API de niveles/plancha, 72 web, 127 API de descuentos/órdenes/cupones, 10 con PostgreSQL aislado y 4 de interfaz de descuentos. [CI de permisos/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37485067263) y [CI de contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37485066986) correctos para el SHA publicado; builds Fly con tipos habilitados.
- **26 comprobaciones HTTP/SSR y de resultados en staging**, incluyendo privacidad de costos, guardado/cotización por perfil, plancha útil, aplicar/quitar/reaplicar cupones, invariantes de producción, permisos, aislamiento y rechazos financieros. Prueba visual sobre una OT ficticia: 10% ($1.210 → $1.089), quitar ($1.210), cupón del 15% ($1.028,50) y recarga con importe conservado. Datos propios del ensayo retirados.
- Chrome en producción: listado y ficha de una OT existente, botones de descuento y cupón, apertura del diálogo y cancelación sin guardar, importe conservado. No se crearon órdenes ni se aplicaron descuentos, cupones, cobros o facturas ficticios en producción, ni se enviaron mensajes de ensayo.

### Respaldo y reversión

Copia previa **`2eb687ea-7df9-4263-a2a5-4c789123d451`**, completada **2026-10-06T17:01:02.684Z**. Copia posterior **`ba1675ee-f0e4-472e-986e-922c2376390d`**, completada **2026-10-06T17:33:31.233Z**, con 306 migraciones y 27 archivos. Firma, huella, descifrado del manifiesto, revisión exacta e inventario de imágenes/fuentes comprobados. Fuentes cifradas protegidas durante 31 días. **No se repitió una restauración SQL completa**. Evidencia y accesos fuera de Git.

Para volver al código anterior, mantener la base y usar `8053bcf0ee05c6d8575e967547fc2888b448e690`: backend `sha256:9b7a956cb647b28440d449f9e61ac24f4413a0ca65ddebb1cba2e798850115a7`, web `sha256:61b249babbb53792f2f9d9597497bd47c5854fc7fcc45a5805786e5c535603c1`. Esto elimina el ajuste de descuentos de la ficha y reintroduce la falla de plancha. Las revisiones de precio ya guardadas se conservan; antes de recotizar productos con niveles nuevos, revisar su compatibilidad. No borrar operaciones ni revertir migraciones.


## 06/10/2026, 22:09 UTC — OT, permisos del taller y caño estructural (PR #26)

Revisión ejecutada **`a9c2d563dae051d704b18bf71974a7c75b7517e8`**, dependiente del PR #25. Publicación autorizada tras el recorrido en staging. Se promovieron las mismas imágenes por digest, sin recompilar para producción ni fusionar los PR. Los commits documentales posteriores no cambian la revisión ejecutada. Vercel permanece sin cambios.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:c137b072cffaab608d02b9235effee55a9057478e0f3bb5a34b5b5c6fed25bd2` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:53cd120b3a43979fcd5bd11e4bae38d794412c1afefc80da16e3e5400f364608` |

**307 migraciones**: se agregó únicamente `20261006175000_unidad_barra`, mediante el migrador separado, sin seeds ni resets. Rol de aplicación sin DDL verificado. Se conservan seis máquinas y sus tamaños; Gotenberg y el copiador mantienen sus imágenes. Salud web/API 200, API privada directa 403 y BFF anónimo 401. Revisión exacta y Sentry configurado en los cuatro servicios actualizados. Constructor temporal propio retirado; Docker y los otros proyectos locales intactos.

### Cambios y validación

- OT: copiar el teléfono junto al cliente; ZIP de todos los adjuntos de la orden o del trabajo abierto en Operación diaria; descuento y cupón exigen «Editar orden». Conserva controles de facturación, cobros y concurrencia.
- Operarios sin permiso comercial: sin «Ver OT», URL directa bloqueada y API comercial rechazada. El sheet usa una consulta operativa con contrato cerrado, sin precios, costos, snapshots o datos de cobros. Archivos y materiales siguen disponibles según sus permisos.
- Caño estructural: largo de barra, ancho/alto exterior y espesor de pared separados. Compra/stock en Barra y consumo en metros, con conversión correcta del despiece a costos, reservas y consumo. Orientación única de perfiles rectangulares en pasos obligatorios y opcionales; presentación de su etiqueta corregida durante el ensayo.
- Cantidades de 0,5 / 0,25 metros en el cotizador; velocidades y unidades coherentes en niveles con perfil de máquina. No se modifican masivamente productos ni la configuración de materiales existentes.
- **87 comprobaciones HTTP/SSR y de resultados del lote en staging**, con datos ficticios: bastidores simples/dobles, dimensiones y cantidades, barra de largo decimal, perfiles 20 × 30, geometría, compatibilidad de costos antiguos, rechazos de piezas inviables, emisión, reserva/consumo, permisos, ZIP y descuentos. Bastidor ficticio 2,40 × 1,20 × 0,18 m: 17,12 m de piezas, tres barras de 6 m y precio de venta de $40.800; agregado desde el navegador comprobado. Pruebas locales y detalles en [el registro de staging](../staging/VALIDACION.md).
- CI del SHA ejecutado: [permisos/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37536433530) y [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37536433698), ambos correctos; builds remotos con tipos habilitados.
- Chrome en producción: ficha de Caño estructural, cuatro variantes y nuevos campos visibles, sin cambios pendientes de guardar. Sus unidades existentes continúan en metros lineales; no se eligió Barra ni se alteraron precios. OT existente: copia de teléfono disponible, descuento/cupón deshabilitados fuera de edición, descarga conjunta deshabilitada al no tener adjuntos. No se guardaron órdenes, descuentos, movimientos ni configuraciones ficticias en producción, ni se emitieron comprobantes o mensajes externos.
- Recuentos operativos antes/después iguales: 1 empresa, 771 clientes, 19 OT, 48 pasos, 8 cobros, 9 métodos de pago, 7 movimientos y 6 empleados. Los datos/objetos ficticios de staging fueron retirados por sus identificadores.

### Respaldo y reversión

Copia previa **`9dcc0310-5c39-46fa-970e-0fd3c9893997`**, completada **2026-10-06T22:01:10.707Z**. Copia posterior **`888c15b3-dbee-4eb0-ad84-005ba1c0782a`**, completada **2026-10-06T22:08:10.743Z**, con 307 migraciones y 39 archivos. Firma, huella y descifrado del manifiesto, revisión e inventario de imágenes/fuentes comprobados. Fuentes cifradas protegidas durante 31 días. **No se repitió una restauración SQL completa**. Evidencia privada fuera de Git.

La revisión anterior `b89000446` usa API/workers `sha256:006f62ffbbdc6456c37f72859c133f14d02146fcd7d55f4849e5c9e41ed9483f` y web `sha256:a384f9677a0c2362db3179287f707fdd16ea11f9f75649e7398127dee96e8977`. Conservar la base y comprobar que no existan registros utilizando BARRA antes de volver atrás: la versión anterior no reconoce esa unidad y reintroduce el acceso comercial indebido del operario. Priorizar una corrección hacia adelante; no borrar operaciones ni revertir migraciones.


## 07/10/2026, 00:41 UTC — Cliente de OT y precio de vinilo por metro (PR #26)

Revisión ejecutada **`53087e81c82d093876132a26f25af0b7533c038c`** (noche del 06/10 en Argentina). Correcciones agrupadas a pedido del titular: local, staging y promoción a producción de las mismas imágenes por digest. No se fusionaron PR ni se modificó Vercel. Los commits documentales posteriores no cambian esta revisión de ejecución.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:c2c7d1367060a051cdad6a24fafa33f7d7271aac8d19445bd82fd920499959e1` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:655b0becaa9507786368ac4aa088fc4d278773ac67821753e99fc56d556cdb93` |

**307 migraciones, ninguna nueva.** Se conservan seis máquinas, sus tamaños, Gotenberg y la imagen del copiador. Salud web/API 200, API privada directa 403 y BFF anónimo 401. Revisión exacta y Sentry configurado comprobados en los cuatro servicios actualizados. Constructor temporal propio retirado al terminar; no se compiló en Docker local ni se alteraron otros proyectos.

### Correcciones y comprobaciones

- El selector inicial contiene 30 clientes. Ahora incorpora el cliente persistido de la OT aunque quede fuera de esa página, combina la búsqueda sin duplicados y conserva su nombre/teléfono en lectura y edición. Copiar no exige editar; si falta el número se muestra «Sin teléfono».
- Vinilo por metro directo: no gira la franja ni aplica demasía implícita derivada de separación entre piezas. Respeta demasía explícita y márgenes físicos; rechaza un corte en rollo sin layout válido antes de confundir área con metros. Mantiene preparación fija y mínimos comerciales explícitos.
- **172 pruebas API en ocho suites y 10 web en dos suites**, lint y diff correctos. Compilaciones completas API/web remotas con tipos habilitados. [CI de HTTP/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37549718127) y [CI de contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37549718140), aprobados para la revisión ejecutada.
- **25 comprobaciones HTTP/SSR y de resultados finales en staging**: cliente fuera de página, teléfono completo, guardar otro dato sin perder cliente/importe, lector sin escritura, operario rechazado y aislamiento entre empresas. Cotizaciones reales de 0,25 / 0,5 / 1 / 1,5 / 2 m con consumo 0,27 / 0,52 / 1,02 / 1,52 / 2,02 m y precios crecientes. Once controles API previos se solapan con esta pasada; no se suman como pruebas únicas.
- Chrome en producción: la OT reportada conserva el cliente en lectura y edición; muestra «Sin teléfono» porque ese registro carece de número. Se canceló sin guardar. El cotizador real mostró importes distintos y crecientes para 0,5 y 1 m; cerrado sin agregar productos ni guardar una orden. No se modificaron clientes ni se generaron cobros, facturas o comunicaciones de ensayo.

### Respaldo y reversión

Copia previa **`0f1effb3-5100-4898-b551-f6405f67926d`**, completada **2026-10-07T00:01:06.529Z**. Copia posterior **`4c446cee-5612-45cb-9943-ecbf600fceb9`**, completada **2026-10-07T00:40:42.415Z**, con 307 migraciones y 40 archivos. Firma, huella, descifrado del manifiesto, revisión exacta e inventario de fuentes/imágenes comprobados. Fuente cifrada protegida durante 31 días. **No se repitió una restauración SQL completa**. Evidencias y accesos privados fuera de Git.

Para volver a `a9c2d563dae051d704b18bf71974a7c75b7517e8`, conservar la base: API/workers `sha256:c137b072cffaab608d02b9235effee55a9057478e0f3bb5a34b5b5c6fed25bd2`, web `sha256:53cd120b3a43979fcd5bd11e4bae38d794412c1afefc80da16e3e5400f364608`. Reintroduce ambos defectos; no borrar datos ni revertir migraciones. Priorizar una corrección hacia adelante.


## 07/10/2026, 20:50 UTC — Facturar, flujos recuperables y archivos generales (PR #27)

Publicación autorizada después de comprobar staging. **Backend `dd71567e38b81e573c0b9cba9a85020484d34624` y web `0e2e013d7e99aa0bc0390cc96ee5e9fe539f1ddd`**, promovidos desde las imágenes de staging por digest. El ajuste final es exclusivamente web: conserva los centavos del saldo fiscal. Los commits documentales posteriores no cambian las revisiones ejecutadas. No se fusionó la cadena de PR ni se modificó Vercel; #27 depende de #26.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:f3c54b59a098da9d6c9175b47bd2904f183ea95cecbb1bfbf44c80c445721b0c` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:fdeb342f2f47dacd3a7adc886932fc5f3f0411dc52c0af421ded49f40a33bee9` |

**307 migraciones, ninguna nueva.** Seis máquinas con los tamaños originales. Gotenberg y el copiador conservan sus imágenes. Web/API 200, API privada directa 403 y BFF anónimo 401. Revisión exacta y Sentry configurado en API, ambos workers y web.

### Funcionalidad y pruebas

- Facturar aparece en la cabecera de una OT en lectura, bajo el permiso fiscal independiente de editar órdenes. Comprueba saldo actualizado y rechaza otra emisión si existe un comprobante en proceso o por verificar. Un usuario fiscal restringido sólo consulta comprobantes de la orden indicada, sin acceso al listado general.
- El modal conserva los centavos al abrir y al usar 100%/50%. Se reprodujo el redondeo anterior en staging con $2.420,66 y se verificó el importe exacto, $1.210,33 al 50% y botón habilitado tras corregirlo. Tres casos locales fallaron antes de la corrección y pasaron después.
- Los flujos se desactivan y recuperan sin borrar recetas ni versiones históricas. El flujo inactivo deja de ofrecerse al cotizar; se elige otra alternativa activa como preferida cuando corresponde.
- Operación diaria presenta archivos generales de OT en todos sus ítems, separados de los archivos propios del trabajo. Contador y ZIP incluyen ambos grupos sin incorporar archivos de otro ítem. El operario continúa sin acceso comercial a la OT.
- En staging: **35 comprobaciones HTTP/SSR y de resultados**, ocho fiscales repetidas después del ajuste decimal y recorrido Chrome con roles ficticios. Ensayados aislamiento entre empresas, 403 por permisos, revisiones intactas al desactivar/reactivar, ZIP con bytes correctos y separación de archivos en dos ítems. Datos y objetos de ambas rondas ficticias retirados; sin cobros, facturas ni mensajes externos.
- Local: último lote de **161 pruebas API** más integración de publicación y aislamiento de productos; **41 pruebas web** finales, lint y compilaciones remotas con tipos habilitados. [CI HTTP/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37682561420) y [CI de contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37682561432), aprobados para la revisión web final.
- Chrome en producción: apertura de Facturar sin entrar en edición, saldo con centavos y botón habilitado. Modal cerrado sin emitir. Menú «Desactivar flujo» comprobado en el producto existente, sin modificar sus rutas. No se crearon ensayos comerciales en producción.

### Incidencia durante el reemplazo web

Entre aproximadamente **20:41:26 y 20:47:24 UTC**, la máquina web de Fly quedó en `replacing`, reintentando descargar/preparar la imagen. El chequeo HTTP dio timeout y Fly registró ausencia de instancias saludables. El CLI no completó su espera; se interrumpió esa espera y se creó una instancia temporal del mismo tamaño para recuperar servicio. La máquina original terminó arrancando con el digest final y recuperó salud; se retiró la instancia temporal. Se verificaron nuevamente revisión, HTTP, controles privados y recorrido fiscal. El estado final conserva una sola máquina web y los seis servicios originales. No se restauró ni modificó manualmente la base por este incidente. Los registros operativos están fuera de Git.

Constructor remoto propio retirado después de promover las imágenes. No se aumentaron tamaños permanentes ni se alteraron otros proyectos locales.

### Respaldo y reversión

Copia previa **`90714ae8-3787-4467-939a-b6267d3b1619`**, completada **2026-10-07T20:01:14.566Z**. Copia posterior al primer lote **`3d6a7d0a-c598-4c3c-9c4f-7f7c25a6f0c6`**, completada **2026-10-07T20:29:06.195Z**. Copia final **`90c1ebb5-732c-41f4-bff2-3823a7d62cce`**, completada **2026-10-07T20:49:48.053Z**, con 307 migraciones y 61 archivos. Firma, huella, descifrado del manifiesto, fuentes e imágenes finales verificados. Código cifrado y protegido durante 31 días. **No se repitió una restauración SQL completa**.

Para volver al conjunto previo `53087e81c82d093876132a26f25af0b7533c038c`, mantener la base: backend `sha256:c2c7d1367060a051cdad6a24fafa33f7d7271aac8d19445bd82fd920499959e1`, web `sha256:655b0becaa9507786368ac4aa088fc4d278773ac67821753e99fc56d556cdb93`. Reintroduce los defectos de este lote y elimina el acceso a recuperar flujos. No borrar operaciones ni revertir migraciones; priorizar una corrección hacia adelante. La primera web de este lote (`d2ca245a…`) conserva el error de centavos y no debe usarse como solución definitiva.


## 08/10/2026, 00:29 UTC — Lote de octubre promovido desde staging (PR #37)

**API, ambos workers y web ejecutan `360037038ac17da69fa71b32c2fe3d864578c678`.** Publicación autorizada tras el ensayo completo del conjunto en staging. El PR #37 reúne #28–#36 y depende temporalmente de #27. No se fusionó `main` ni se modificó Vercel. El commit `f89743bcd` sólo completa la lista de permisos esperada por una prueba; los commits documentales posteriores tampoco modifican las imágenes.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:f6270c0d57aba902942ea5571e0996c8e5eeb64b8c1af08e0dc67b409a8929ee` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:d37cbae51058e88281e9a5a8bef3195f7da1623787929278d2613f1a90e8b7af` |

SHA-256 de ambos manifiestos idénticos a staging. **309 migraciones**, incluidas las tablas de lectores de notificaciones y solicitudes de alta de clientes. Migración aditiva y rol de aplicación sin DDL verificados, sin seeds ni resets. Conteos comerciales anteriores y posteriores conservados; no se crearon datos de ensayo en producción. Seis máquinas y tamaños originales, imágenes de Gotenberg y copiador intactas. Salud web/API 200, API privada directa 403 y BFF anónimo 401. Revisión exacta y Sentry configurado en los cuatro servicios actualizados.

### Cambios y comprobaciones

- Pasos asignados automáticamente: pueden ejecutarlos integrantes habilitados de la estación y queda registrado quién lo hizo. Las asignaciones manuales conservan exclusividad. Operación diaria muestra fecha de entrega del ítem o, en su defecto, de la OT.
- Precio fijo: incluye los obligatorios y suma opcionales según costo y margen configurable en Producto → Precio. Sin margen explícito usa 0%; no se cambiaron las configuraciones comerciales existentes. Tiempo opcional y costo del centro afectan el importe final.
- Notificaciones: «Marcar leído», autor/fecha y actualización en vivo. Los lectores son visibles al equipo autorizado; el estado de no leído se conserva por usuario. No se atribuyen autores a lecturas históricas sin registro.
- CRM → Clientes → Solicitudes de alta: formulario móvil con datos fiscales, revisión, aprobación/rechazo, detección de duplicados y permiso `crm.aprobar_altas`. Cada empresa habilita su enlace; en producción se comprobó inicialmente desactivado. Este registro de clientes es independiente del registro público de empresas SaaS, que sigue cerrado.
- Permisos de Facturación/Comprobantes permiten crear el comprobante sin exigir un permiso general de Administración. Nota de crédito conserva su control adicional.
- Las finalizadas están en «Para retirar» y no cuentan como atrasadas por falta de entrega. Conserva los indicadores históricos de finalización.
- Interfaz de operadores alineada, liquidación con scroll interior y pie fijo, y foco único en campos de tiempo.
- **333 pruebas locales**: 157 API del lote, 39 de permisos transversales y 137 web. Compilaciones remotas completas con tipos, guard CSS y diff aprobados. [CI HTTP/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37701409659) y [CI contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37701409736) aprobados en `f89743bcd`, con el mismo código ejecutable desplegado.
- **Staging: 33 comprobaciones HTTP/SSE/SSR** y recorrido Chrome de escritorio/móvil. Precio base $10.000 y opcionales de 30/60/120 minutos: $14.000/$18.000/$26.000; control de asignaciones, lectores, permisos, aislamiento, duplicados, alta/aprobación, fecha y estilos. Se retiraron las dos empresas y siete usuarios ficticios. [Detalle](../staging/VALIDACION.md).
- **Producción, sólo lectura:** sesión administrativa real, nueva pestaña «Para retirar» con trabajos finalizados y desaparición del falso atraso; acceso a Solicitudes de alta; apertura de Facturar desde una OT con acción de emitir habilitada, cancelada sin emitir. No se modificaron órdenes, precios, clientes ni cuentas para comprobarlo.

### Operación, respaldo y reversión

El constructor remoto se apagó automáticamente tras terminar las compilaciones y Fly no pudo reiniciarlo por falta de CPU en su host. Se promovieron las imágenes existentes directamente entre repositorios del registro mediante `docker buildx imagetools create --prefer-index=false`, comprobando el hash del manifiesto destino. No se recompiló ni se aumentaron recursos. El constructor propio fue eliminado. Durante el reemplazo de la API, una pestaña con la web anterior registró React 441; tras recargar la nueva web el recorrido quedó operativo. No hubo recuperación de datos ni reemplazo manual de máquinas de aplicación.

Copia previa **`95924f84-ff72-4f94-aa90-69e980c67381`**, completada **2026-10-08T00:01:15.073Z**. Copia posterior **`4f36cc0a-9038-43e7-9e55-863cc59ac1cb`**, completada **2026-10-08T00:27:56.495Z**, con 309 migraciones y 62 archivos. Firma, huella, descifrado del manifiesto, revisión exacta e inventario de imágenes/fuentes verificados. Fuentes cifradas y protegidas durante 31 días. **No se repitió una restauración SQL completa.** Evidencias y accesos fuera de Git.

Reversión de código al conjunto anterior: backend `dd71567e3`, imagen `sha256:f3c54b59a098da9d6c9175b47bd2904f183ea95cecbb1bfbf44c80c445721b0c`; web `0e2e013d7`, imagen `sha256:fdeb342f2f47dacd3a7adc886932fc5f3f0411dc52c0af421ded49f40a33bee9`. Conservar las tablas y datos nuevos, que son compatibles con el código anterior; volver atrás retira las mejoras. No revertir migraciones ni borrar registros; priorizar una corrección hacia adelante.

## Cargos comerciales por zona — 08/10/2026

- Publicación autorizada desde el [PR #38](https://github.com/studiocamaleon/gdi/pull/38), dependiente de #37 y sin fusionar. API y ambos workers `d0645233b640dee694da09ff7ced50634055e0fb`, imagen `registry.fly.io/grafoprint-production-api@sha256:aaf0f547ead6509b541488a5f90519f5d6a81339eeb6880833bb340f0362cbcb`, con digest idéntico al probado en staging. Web conserva `360037038` y digest `sha256:d37cbae51058e88281e9a5a8bef3195f7da1623787929278d2613f1a90e8b7af`. PDF y copiador conservan sus imágenes.
- Corrige la falta de zonas y tarifas del catálogo comercial que impedía emitir cargos como Viático. El permiso comercial permite consultar sus opciones e importes de cobro, sin abrir la configuración interna de costos/márgenes. La API valida el catálogo del tenant y recalcula el cargo. Sin migraciones, cambios de tamaño ni modificaciones de datos comerciales/fiscales.
- 260 pruebas locales, compilaciones remotas con tipos y controles HTTP aprobados para la revisión ejecutable: [contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37714233747) y [permisos](https://github.com/studiocamaleon/gdi/actions/runs/37714233676). Staging aprobó 13 comprobaciones del recorrido, con dos presupuestos y una OT ficticios, roles comerciales limitados y separación de empresas; ver [su registro](../staging/VALIDACION.md).
- Producción: seis máquinas sanas con tamaños originales, HTTPS API/web 200, API protegida 403 y BFF sin sesión 401. Revisión exacta y Sentry activo verificados en los cuatro servicios. Consulta de sólo lectura usando el código compilado publicado: nueve cargos activos y tres zonas conservan códigos/tarifas; no se crearon presupuestos, órdenes ni facturas reales para probar.
- Fuente exacta cifrada y protegida 31 días en B2; inventario del copiador actualizado. Constructor remoto temporal eliminado después de publicar la imagen. La promoción usó copia entre registros sin recompilar ni reiniciar Docker local.
- Copia posterior `eb82f908-f5ee-4f5d-8371-bae8bcb30a3e`, completada a las 01:57:48 UTC: firma y descifrado del manifiesto verificados, 309 migraciones, 63 archivos y ambas revisiones fuente, incluida la nueva imagen backend. No se repitió restauración SQL.


## 08/10/2026, 12:46 UTC — Borradores y cargos promovidos desde staging (PR #39)

**API, ambos workers y web ejecutan `139ce05aba5e549973225e80e0b0c3ecc8433562`.** Publicación autorizada después de comprobar las tres correcciones en staging. El [PR #39](https://github.com/studiocamaleon/gdi/pull/39) depende de #38 y permanece abierto, sin fusionar la cadena ni modificar Vercel. Los commits documentales posteriores no cambian el código ejecutado.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:ba08b41d5412f01c8aae5276038f8e4aecaac9dcd49c883ce6b739a73e8478d9` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:4a79710ab2591b081c8927663fdb51848f6ee131228b6c6169d89234899ff01a` |

SHA-256 de ambos manifiestos idénticos a staging; promoción entre registros sin recompilar. **309 migraciones, ninguna nueva.** Seis máquinas con tamaños originales; PDF y copiador conservan sus imágenes. No se ejecutaron seeds ni resets.

### Resultado y validación

- Borradores nuevos de OT: número comercial al emitir, no al guardar. Los históricos ya numerados conservan su número.
- Presupuestos: «Guardar borrador» conserva el trabajo sin crear una OT ni enviarlo; se puede enviar después desde su detalle, respetando las reglas de aprobación.
- Cargos: agregar y quitar desde «Editar orden», con guardado conjunto de cargos, totales e historial. El servidor calcula tarifas por zona; conserva snapshots de los cargos existentes. Rechaza órdenes canceladas, facturadas o con comprobantes en preparación, versiones desactualizadas y totales inferiores a lo cobrado.
- **323 pruebas locales** (267 API y 56 web), [CI de permisos con 1.135 pruebas/73 suites](https://github.com/studiocamaleon/gdi/actions/runs/37718223090) y [CI completo de tipos/contenedores](https://github.com/studiocamaleon/gdi/actions/runs/37718223002) aprobados para el SHA ejecutado.
- **Staging: 41 comprobaciones HTTP/SSR y de resultados**, más guardado visual en Chrome y comprobación de persistencia sin avisos. Numeración al emitir, cargo por zona, presupuesto borrador, estados permitidos, límites fiscales/cobros, permisos y separación de empresas. Dos empresas y cuatro usuarios ficticios retirados por identificador; sin objetos R2. [Registro detallado](../staging/VALIDACION.md).
- **Producción, sólo lectura:** seis servicios sanos, HTTP web/API 200, API privada directa 403 y BFF sin sesión 401. Revisión exacta y Sentry configurado en los cuatro servicios actualizados. Consulta con el código publicado dentro de transacción de sólo lectura: nueve cargos y una zona conservan la información comercial requerida, sin exponer campos internos de costos. No se crearon órdenes, presupuestos, cobros ni comprobantes reales como ensayo.

### Incidencia conocida fuera del lote

En staging se reprodujo un problema previo de productos con diseño obligatorio: se exige completar el brief, pero el formulario sólo se monta para opcionales. Ese componente no cambia en este PR. Se informó al titular y quedó registrado como pendiente separado, con datos y evidencia ficticios; no se presenta esta publicación como solución de ese problema. El recorrido de borradores se completó con un producto de trabajo manual.

### Respaldo y reversión

Copia previa **`1584a0b6-cee6-4077-ac2f-7755c1fce76f`**, completada **2026-10-08T12:01:11.529Z**. Posterior **`b52d2a92-b43f-4c0e-bdde-b251c888b5b0`**, completada **2026-10-08T12:43:33.444Z**, con 309 migraciones y 64 archivos. Firma, huella, descifrado del manifiesto, revisión exacta e inventario de imágenes/fuentes verificados. Fuente cifrada y protegida durante 31 días. **No se repitió una restauración SQL completa.** Evidencias y accesos fuera de Git. El primer sondeo aún encontró la copia anterior; se comprobó la nueva al terminar.

El constructor temporal propio `fly-builder-ancient-breeze-3294` fue eliminado. No se compilaron contenedores en la Mac ni se alteraron otros proyectos. No hubo cambios de recursos permanentes.

Reversión de código disponible: API/workers `d0645233b`, digest `sha256:aaf0f547ead6509b541488a5f90519f5d6a81339eeb6880833bb340f0362cbcb`; web `360037038`, digest `sha256:d37cbae51058e88281e9a5a8bef3195f7da1623787929278d2613f1a90e8b7af`. **Los borradores nuevos usan referencias internas `BORRADOR-…`; el código anterior no les asigna número al emitir.** Priorizar corrección hacia adelante; una reversión exige conservar la base y bloquear su emisión hasta resolver la compatibilidad. No renumerar históricos, borrar registros ni restaurar sobre la única base activa.


## 08/10/2026, 17:48 UTC — Lote comercial, producción y entrega de QR (PR #47)

API y ambos workers ejecutan **`37917a28cad39349d09738818ac94179165b7433`**; web **`ead4447d594d525655f90aaf3a758e520f113cd6`**. La diferencia es únicamente el dato de vendedor de un fixture frontend. El [PR #47](https://github.com/studiocamaleon/gdi/pull/47) reúne #40–#46 y la corrección de Wati, con dependencia temporal de #39; permanece sin fusionar. No se modificó `main` ni Vercel.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:fc7449a7f2a7bada65822ef904dcd4c447dc77df5ceec3f165ea0de6b4e445a8` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:4025c88c130d97f5bff6ff2548ad55c06c900bf6762330cf22fb38d9b7dfb557` |

**311 migraciones.** Se aplicaron `20261008150000_presupuestos_versiones` y `20261008190000_wati_entrega_confirmada`, sin seeds ni resets. Rol de ejecución sin DDL y acceso al esquema nuevo comprobados. Seis servicios conservan tamaño; PDF y copiador conservan imagen. Salud API/web 200, acceso directo protegido 403, BFF anónimo 401, revisión exacta y Sentry configurado comprobados.

### Cambios y pruebas

- Descarte de borradores de OT y presupuesto; versiones de presupuestos aún no aprobados, con número e historial conservados. La versión anterior deja de aceptar acciones; presupuestos aprobados no admiten nuevas versiones.
- Filtros opcionales de facturación para cobro completo sin facturar y fecha de emisión. Factura de una OT detallada por ítems y cargos; opción de resumen por orden para agrupadas y detalle completo seleccionable. Las pruebas fiscales usaron datos ficticios; no se emitió ningún comprobante real de ensayo.
- Emisión de presupuesto con guardado y redirección sin `beforeunload`; búsqueda de clientes sin acentos, foco inmediato y resultados de productos priorizados por uso comercial válido. Solicitudes de autorregistro generan aviso interno a quienes pueden revisarlas.
- Pasos del ítem ordenados por precedencia del flujo. Desde cualquier ítem de una OT finalizada/entregada, el operario puede recuperar la etiqueta; se conserva la prohibición de leer la ficha comercial y sus importes.
- QR Wati con imagen variable `qr_url`, plantillas `_v2` y API v2. Aceptación del proveedor separada de envío/entrega/lectura/fallo; consulta periódica sin emitir ni reintentar mensajes. Dos ensayos autorizados al titular, con y sin saldo ficticio: proveedor confirmó entrega; titular confirmó QR visible. [Detalle](../../docs/wati-qr-entrega.md).
- Local: 325 suites / 2.412 casos web aprobados, más cuatro casos nuevos de estados de entrega (suite final 13/13); etiqueta final 10/10. API: 316 casos del lote correctos entre ejecuciones y fixture aislado de planes 36/36. [CI HTTP/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37814053855) y [CI contenedores/tipos](https://github.com/studiocamaleon/gdi/actions/runs/37814054157) aprobados en la revisión final.
- Staging: 41 comprobaciones HTTPS/BFF/resultados base más 29 del lote. Incluyen permisos, aislamiento, conflictos, importes, versiones, descarte, filtros, acentos, frecuencia, aviso interno y etiqueta PDF con operario sin OT.
- Chrome en staging: foco real y búsqueda «Jose» → «José»; producto agregado con rol comercial limitado; presupuesto emitido y redirigido sin cartel, persistencia comprobada y ningún envío externo. Operario: Pre-prensa → Impresión → Corte, etiqueta abierta, PDF descargado y reabierto desde el ítem, sin enlace a la OT ni precios. No se ensayó impresión física: staging carece de certificado QZ del servidor; la descarga funciona. La espera automática de descarga perdió la conexión del navegador, pero su historial confirmó el archivo y se comprobó la cabecera PDF del archivo guardado.
- Se retiraron dos empresas, seis usuarios y tres PDF sintéticos por identificadores y claves exactos. Staging vuelve a una empresa, dos clientes, siete OT, 31 pasos y 24 archivos.

### Verificación de producción

Se promovieron los mismos manifiestos probados en staging, sin recompilar. Conservados 775 clientes, 38 OT, 92 pasos, 16 cobros, nueve métodos de pago, 15 movimientos y seis empleados en el control posterior. No se crearon documentos comerciales de prueba. Nueve avisos históricos se conciliaron con fallos confirmados por Wati, comparando teléfono, parámetros completos, campaña y hora; actualización condicionada a no haber cambiado la fila y evento de auditoría por OT. Quedaron fallidos, disponibles para reintento manual, **sin reenviarlos**.

### Recuperación y límites

Antes de publicar se restauraron copias en bases locales temporales aisladas, con tareas externas apagadas: staging con 309 migraciones, 24 archivos de huella idéntica, una clave MFA y una integración descifradas; producción con 309 migraciones, 72 archivos, dos claves MFA y una integración descifradas. Las dos migraciones nuevas se ensayaron también sobre esos clones; se eliminaron al terminar. No se arrancó la aplicación restaurada ni se probó un cambio completo a infraestructura cloud de reemplazo.

Copia previa **`8a7df31f-8cd9-4a20-98a1-4a583a5383ca`**, completada **2026-10-08T17:01:17.202Z**. Posterior **`b1566239-e12f-42dc-8e98-bfb4ffe09e5a`**, completada **2026-10-08T17:47:41.699Z**, con 311 migraciones y 73 archivos. Firma y huella, descifrado del manifiesto, imágenes exactas y ambas revisiones fuente verificadas. El respaldo posterior no se restauró de nuevo. Fuentes cifradas y protegidas bajo custodia privada. El primer sondeo posterior aún encontró la copia anterior; se verificó la nueva al completarse.

El constructor remoto propio `fly-builder-lively-sun-8459` fue eliminado. Sin builds de producción en la Mac ni cambios en Docker u otros proyectos. La autenticación temporal del registro expiró durante la promoción: se renovó sin ampliar permisos y se verificaron los digests idénticos.

**Reversión:** la migración de versiones admite varias filas con el mismo número de presupuesto. El backend previo `139ce05ab` asume una sola: no restaurar su imagen sin revisar compatibilidad y bloquear las operaciones afectadas. Conservar historial y migraciones; priorizar corrección hacia adelante. Nunca restaurar encima de la única base activa. El problema previo del brief de diseño obligatorio sigue registrado por separado; este lote no lo corrige.

## 2026-10-08, 20:07 UTC — API con CPU performance

Cambio de recursos autorizado expresamente por Lucas después del diagnóstico de lentitud de producción. La máquina API `d8946dec3e9278`, en `gru`, pasó de **1 CPU shared / 2048 MB** a **1 CPU performance / 2048 MB** mediante actualización de la máquina existente. El manifiesto de producción conserva este tamaño para futuros despliegues.

### Evidencia y alcance

- Antes del cambio: chequeos de salud con timeout; muestra de 81 solicitudes completadas, excluyendo streams, con mediana de 12.558 ms y máximo de 30.717 ms. Métricas históricas de Fly alrededor de las 20:00 UTC: saldo de ráfaga prácticamente agotado y throttling aproximado del 93 % del intervalo. Memoria disponible; la muestra PostgreSQL no mostró bloqueos ni agotamiento de conexiones. Esto no descarta otros problemas puntuales de transacciones o Redis.
- Imagen conservada exactamente: `registry.fly.io/grafoprint-production-api@sha256:fc7449a7f2a7bada65822ef904dcd4c447dc77df5ceec3f165ea0de6b4e445a8`. Comparación de configuración antes/después: sólo cambió `guest.cpu_kind`; número de CPU y memoria idénticos. Sin compilación, despliegue de código, migraciones, cambios de secretos ni modificación de datos comerciales.
- Actualización terminada correctamente; máquina iniciada y chequeo Fly en `passing`. La métrica histórica `fly_instance_cpu_baseline` confirmó el cambio de **0,0625 a 1 CPU** tras actualizarse el recolector. Dos consultas HTTPS de salud de API: **200**, base `up`, **372 y 356 ms** desde la Mac. Web **200**, **346 ms**.
- Muestra posterior de CPU de 10 segundos: **1 tick de steal de 1.003 ticks totales** (aproximadamente 0,1 %); presión CPU `avg10` de 3,14 %. Es una muestra inmediata de baja carga; no sustituye validar el comportamiento durante un pico real.
- No se cambiaron web, workers, generador PDF, base, Redis ni copiador. Los cambios de lotes de facturación siguen locales. No se emitieron facturas ni se enviaron mensajes como ensayo.

La primera invocación del CLI con imagen explícita duplicó el digest y fue rechazada antes de modificar la máquina. Se repitió la actualización sin argumento de imagen, conservando la configuración existente; el digest exacto se verificó después.

El cambio aumenta el costo de CPU de la API conforme al tipo performance autorizado. Reversión de recursos disponible volviendo a `shared` con una CPU y 2048 MB, aunque reintroduciría el riesgo de agotamiento observado; no requiere revertir código ni datos. Evidencia operativa privada fuera de Git.


## 2026-10-08, 21:18 UTC — Facturación durable, cargos y consulta fiscal (PR #48)

Publicado con autorización de Lucas después de validar staging. API, ambos workers y web ejecutan **`f44aab7803487ed8f285d89b1ab508b0f37c6646`**. Se promovieron exactamente las imágenes probadas, comprobando su digest; no se recompiló para producción. El [PR #48](https://github.com/studiocamaleon/gdi/pull/48) depende de #47; no se fusionó ningún PR ni se modificó `main` o Vercel.

| Servicio | Imagen vigente |
| --- | --- |
| API / worker / worker-pdf | `registry.fly.io/grafoprint-production-api@sha256:7eb79bc7fc280a39eb7730b80f17f7b98ca36b2f97d17ee7c76f45fd3a9641ef` |
| Web | `registry.fly.io/grafoprint-production-web@sha256:aba8644ee0fc64c0607f1cf46165b795f3f8f43fadb8d46e158201d1a16a777e` |

### Cambios y comprobación

- Facturación de lotes durable en PostgreSQL y worker general existente, con respuesta 202, idempotencia, recuperación de reservas vencidas, PDF y seguimiento del envío. La interfaz muestra progreso y errores por factura y avisa sólo al iniciador al finalizar; los envíos no confirmados quedan como observaciones. No se agregó un worker ni una dependencia de Redis para esta cola.
- Cargos detallados en presupuesto público, PDF y correo; descarte de borradores fuera del listado normal, con historial conservado. Consulta fiscal con espera visible, actualización inmediata del comprobante y respuesta o error persistentes. Bandeja personal accesible sin Panel, conservando sus controles de permisos y aislamiento.
- **312 migraciones.** Aplicada `20261008210000_facturacion_lotes_durables`, aditiva; sin seeds ni resets. Rol de ejecución con acceso a las tablas nuevas, sin DDL. Orden de actualización: worker, worker PDF, API y web. PDF y copiador conservaron imagen.
- Seis máquinas iniciadas, recursos idénticos a la captura previa; la API conserva **una CPU performance / 2048 MB**. Salud de API/web 200, acceso directo protegido 403 y BFF anónimo 401. Revisión exacta y Sentry habilitado comprobados por servicio. Consulta Sentry de esta revisión/entorno sin incidencias. API y workers sin errores en la muestra; los cinco errores web de stream eran anteriores al despliegue, entre las 15:02 y las 19:14 UTC.
- [CI permisos/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37841379429), [CI contenedores/tipos/migraciones/HTTP](https://github.com/studiocamaleon/gdi/actions/runs/37841379184) y [CI dependencias](https://github.com/studiocamaleon/gdi/actions/runs/37841379230) aprobados. Validación funcional y límites documentados en [staging](../staging/VALIDACION.md): datos ficticios, proveedor manual, PDF real, correo HTML, lotes, bandeja personal, consulta repetida y recorrido Chrome. Se retiraron los fixtures y siete archivos de ensayo.
- En producción se verificó por lectura una autorización fiscal pendiente, comparando la respuesta de ARCA con la solicitud original congelada. La consulta coincidió y devolvió CAE. No se volvió a emitir, no se persistió esa recuperación ni se enviaron facturas reales como prueba de publicación; usar la acción del comprobante también inicia el aviso al cliente y requiere la autorización operativa correspondiente. No se crearon fixtures en producción ni se ejecutó un lote fiscal real de ensayo. El comportamiento bajo un pico comercial real sigue sin medirse.

### Recuperación y reversión

La copia horaria previa de las 20:01 UTC había fallado. Un reintento en el copiador existente, con su bloqueo normal y fuentes de sólo lectura, completó la copia `9c64aef4-324f-47c4-9f33-d6319c2e6050` a las **2026-10-08T20:25:41.691Z**, con 311 migraciones y 99 archivos. Firma y manifiesto comprobados antes de migrar. No se determinó la causa del fallo previo y no se presenta el reintento como prueba de su corrección definitiva.

Se actualizó el inventario de recuperación con las imágenes y la fuente exacta cifrada, protegida durante 31 días. La copia automática posterior `26f6d647-45e4-45a9-9a67-941b3e9683f0` completó a las **2026-10-08T21:17:39.025Z**, con 312 migraciones y 103 archivos. Firma válida, manifiesto descifrado, revisión y digests exactos comprobados. El primer sondeo encontró aún la copia anterior; se comprobó la nueva al terminar. **No se repitió una restauración SQL completa**; la restauración aislada anterior sigue documentada arriba. Las evidencias y accesos permanecen fuera de Git.

Constructor remoto propio retirado al terminar las compilaciones. Sin compilaciones de producción en la Mac, cambios de Docker ni interrupciones de otros proyectos.

Reversión de código disponible con las imágenes de PR #47 registradas arriba, conservando la CPU performance de la API. Mantener tablas e historial de lotes: el código anterior no procesa la cola nueva ni muestra su avance y vuelve al flujo síncrono. Detener nuevas solicitudes y resolver los lotes activos antes de una reversión operativa; priorizar corrección hacia adelante. No eliminar registros ni restaurar encima de la única base activa.


## 2026-10-08, 21:39 UTC — Recuperación fiscal con cobros previos

Durante la recuperación operativa autorizada se encontró un segundo bloqueo: ARCA confirmaba la autorización, pero una comparación del saldo como float8 rechazaba un cobro del mismo importe NUMERIC y revertía toda la persistencia. Se reprodujo mediante una transacción revertida y un filtro de lectura: el importe como `number` no encontraba la fila, el decimal exacto sí. No se creó otra emisión ni se alteró el envío fiscal original.

Se corrigió el filtro y descuento mediante `Prisma.Decimal`, conservando el control condicional de saldo y concurrencia. Las dos reproducciones fallaron antes y pasaron después: **37 pruebas locales** y el [CI completo](https://github.com/studiocamaleon/gdi/actions/runs/37846635084), además de permisos/aislamiento y dependencias, aprobados. En staging se recuperaron dos comprobantes manuales ficticios con cobros previos, uno por OT y otro general; PDF, saldo cero, una emisión e imputación, repetición sin duplicados y cero avisos externos. Fixtures retirados. Ver [validación de staging](../staging/VALIDACION.md).

Se promovió la misma imagen validada, sin recompilar para producción:

| Servicio | Revisión / imagen |
| --- | --- |
| API / worker / worker-pdf | `7ff929fd7ab73d61d78d8725a3f2693ffdae4462` / `registry.fly.io/grafoprint-production-api@sha256:047249efdfcecff8926509d70f236c87eaedc4aa7d8d25aad3c6738bd57cbe97` |
| Web, conservada | `f44aab7803487ed8f285d89b1ab508b0f37c6646` / `registry.fly.io/grafoprint-production-web@sha256:aba8644ee0fc64c0607f1cf46165b795f3f8f43fadb8d46e158201d1a16a777e` |

Seis máquinas saludables y mismos recursos, incluida una CPU performance / 2048 MB para API. Salud API/web 200, acceso privado directo 403 y BFF anónimo 401. Revisiones exactas y Sentry habilitado comprobados por servicio; cero incidencias de la nueva revisión en la consulta posterior. Sin migraciones, cambios de esquema, PR fusionados ni cambios de `main` o Vercel. Constructor remoto propio retirado después de la compilación; Docker y otros proyectos conservados.

### Operación real autorizada

Lucas autorizó expresamente recuperar la factura existente y enviar su aviso al cliente destinatario. A las **21:38 UTC**, la acción «Consultar resultado» recuperó el CAE coincidente con la solicitud congelada y dejó visible «Comprobante registrado correctamente», estado «Con CAE» y acceso al PDF. Se comprobó el mismo número, **una emisión, un PDF y una imputación**, con el saldo cancelado por el cobro ya existente. No se volvió a emitir ni a cobrar. El aviso de WhatsApp fue aceptado por Wati en **un intento**, con clave única por comprobante. A las **21:40 UTC**, el seguimiento normal confirmó estado **enviada / leido**: el destinatario ya leyó el mensaje. Se comprobó el único intento y la ausencia de duplicados. Identificadores, datos fiscales y evidencia operativa permanecen fuera de Git.

Reversión disponible a la imagen API `7eb79bc7fc280a39eb7730b80f17f7b98ca36b2f97d17ee7c76f45fd3a9641ef`, conservando datos, esquema, historial y recursos; esa reversión reintroduce el fallo decimal. Priorizar corrección hacia adelante y no restaurar encima de la única base activa.


Fuente exacta cifrada y protegida por 31 días; inventario de recuperación actualizado. Copia posterior `7b9f371d-cc58-4636-b657-f18b1c2160a5`, completada **2026-10-08T21:40:39.093Z**, con 312 migraciones y 104 archivos. Firma válida, manifiesto descifrado y fuente/digest backend nuevos comprobados. El primer sondeo encontró todavía la copia anterior; la nueva se comprobó al terminar. **No se repitió una restauración SQL completa.** Evidencia operativa privada fuera de Git.


## 2026-10-08, 21:48 UTC — Credencial fiscal del worker tras el primer lote real

El primer lote real de tres clientes terminó con observaciones. Sentry registró **tres ocurrencias** de [GRAFOPRINT-API-E](https://grafoprint.sentry.io/issues/7782051184/), entre 21:43:51 y 21:43:56 UTC, en `EmisionFiscalService.proveedor`, ejecutado por el worker. La causa fue `AFIPSDK_ACCESS_TOKEN` ausente en ese proceso; API sí lo tenía y ambos usaban ambiente `prod`. La clave de cifrado del worker estaba presente. Fue una omisión de configuración del despliegue, no un rechazo de ARCA ni un bloqueo de la API. El proveedor manual usado en staging no podía detectar la falta del secreto de producción.

Se comprobó que los tres comprobantes asociados permanecían **borrador, sin número, CAE ni filas de ComprobanteEmision**. El fallo ocurrió antes de admitir/enviar una solicitud fiscal. El lote quedó cerrado con observaciones y su notificación personal registrada. No se reabrió, reintentó ni reemitió el lote durante este diagnóstico.

Se incorporó únicamente el token fiscal de la misma API al worker existente, verificando previamente que su fuente operativa privada coincidiera con la API activa. Se conservó el resto de sus secretos y se actualizó `worker.env` privado. Reinicio normal del worker por actualización de secreto; no se recompiló ni cambió código de aplicación, esquema, tamaño, API, web, PDF o worker PDF. Runtime backend conserva `7ff929fd7`, web `f44aab780`.

Comprobación posterior:

- El nuevo control `deploy/verificar-worker-fiscal.mjs produccion` falló antes indicando el token ausente y pasó después en modo automático, con ambiente, token y cifrado coherentes con API. No imprime secretos ni huellas.
- Desde **el worker**, `FECompConsultar` de un comprobante ya autorizado devolvió autorización coincidente con su solicitud congelada. Esto comprobó credencial SDK, descifrado del certificado de plataforma y acceso efectivo a ARCA desde el proceso que emite. Consulta de sólo lectura, sin persistir otro resultado ni enviar avisos.
- Seis servicios saludables y tamaños conservados; API/web 200, acceso privado 403, BFF anónimo 401.
- Cinco pruebas locales del control aprobadas e incorporadas al CI. Staging quedó explícitamente manual, `arcaValidada: false`, sin trasladar credenciales.

Los tres borradores conservan sus accesos desde el lote para revisión y emisión autorizada. No crear otro comprobante sólo para superar el error ni considerar la consulta de lectura una prueba de emisión fiscal real en lote. Los identificadores y secretos operativos permanecen fuera de Git. Se exige este control y la consulta desde worker antes de habilitar o restaurar facturación automática en adelante.

## 2026-10-08 — Autoregistro, teléfonos e historial de lotes (PR #49)

Publicado con autorización del usuario tras validar staging. Revisión de código `00511a1e1ed932fc23112b7e75ad4583809337ce` en API, worker, worker PDF y web. Se copiaron las imágenes de staging al registro de producción y se comprobaron manifiestos de igual digest, sin recompilar: backend `sha256:0830c8a90f925fd36bcc6b7d615538f38b449c7443db213a0a2c6da022cc681a`, web `sha256:7e351d75af3987132d995aa099a51d9a16339ce5ca867c329c3a370af760145f`.

Antes de actualizar no había lotes activos. Orden: worker, worker PDF, API y web. Sin migraciones, cambios de recursos ni fusiones de PR. Se conserva la API performance de una CPU/2 GB y el resto de tamaños anteriores. Los seis servicios están saludables; HTTPS API/web 200, acceso privado directo 403 y BFF anónimo 401. Revisión exacta y Sentry habilitado comprobados en los cuatro procesos actualizados.

- Chrome en producción: Facturación sin lotes terminados, acceso al historial con los dos lotes anteriores y resultados fiscales/envíos separados. Autoregistro público existente con Argentina (+54) por defecto, ayuda de pegado y control nuevo. Sin crear clientes, renovar enlaces, emitir facturas ni enviar avisos reales durante esta comprobación.
- Preflight fiscal automático aprobado: configuración del worker coincidente con API. Un primer sondeo durante el reinicio de API no pudo leerla; pasó al finalizar. Consulta de sólo lectura desde worker a ARCA devolvió el comprobante existente número 3 autorizado, con CAE y datos coincidentes. No constituye un ensayo nuevo de emisión fiscal real.
- Base conservada: una empresa, 776 clientes, 27 cobros, nueve métodos, 22 movimientos, 45 OT, 115 pasos y seis empleados. 312 migraciones; rol de aplicación sin DDL. Sin seeds ni resets.
- Sentry sin incidencias de la revisión al verificar. Logs de API y workers sin errores; los errores de cierre de stream encontrados en el historial web son anteriores al despliegue. Evidencias operativas privadas fuera de Git.

Pruebas locales, CI y recorrido ficticio de staging registrados en `deploy/staging/VALIDACION.md`. Staging usa proveedor manual sin ARCA: la integración fiscal efectiva se comprobó aparte desde el worker de producción. El alcance fiscal argentino del autoregistro se conserva. Sólo el historial pagina de 20; OT para facturar y comprobantes siguen con límites de 500/200 sin paginación real.

Fuente exacta cifrada bajo custodia por 31 días. Copia previa `7f3dbb22-3a9c-47c4-9987-e79f817ac658`, completada 22:56:44.847Z, con 312 migraciones y 111 archivos, firma y manifiesto verificados. Una copia horaria anterior falló antes de esta publicación; reiniciar sólo el copiador permitió obtener esta copia previa correcta, sin causa confirmada del fallo inicial. Configuración posterior del copiador actualizada con los digests y fuentes nuevos.

Copia posterior `36e2a6de-b9fc-4b48-85c2-481e7457a220`, completada **2026-10-08T23:17:07.748Z**: firma válida, manifiesto descifrado, revisión `00511a1e1`, imágenes exactas y fuente bajo custodia comprobadas; 312 migraciones y 111 archivos. El primer sondeo encontró aún una copia anterior; se verificó la nueva cuando terminó. No se repitió restauración SQL.

Reversión de código: API y ambos workers a `sha256:047249efdfcecff8926509d70f236c87eaedc4aa7d8d25aad3c6738bd57cbe97`, web a `sha256:aba8644ee0fc64c0607f1cf46165b795f3f8f43fadb8d46e158201d1a16a777e`. Mantener registros y esquema; no restaurar encima de la base activa. No se repitió restauración SQL en esta publicación.


## 2026-10-09, 00:59 UTC — Paginación de Facturación y Comprobantes (PR #50)

Backend `cdeab2cf9a4611d1882adca64a0b6f897169a140` y web `a2999b3337d670e8572b033476f6c600aa97addb` (aclaración final del mensaje de selección), [PR #50](https://github.com/studiocamaleon/gdi/pull/50), dependiente de #49, sin fusionar. API y ambos workers: `sha256:b44b68c55b72254ace7bdcd21556f9e020cb91771da7ce7b2c0d18eb0d7fbada`; web: `sha256:42af339be2249afa3208db43fa6dd5261dcc9ff89ca87e347dcdd2c231b4f079`. Facturación y Comprobantes consultan páginas reales de 25, con búsqueda y filtros en SQL antes del límite. Indicadores globales sobre el filtro completo. Selección de hasta 100 OT entre páginas, reiniciada al buscar o aplicar filtros; navegación con estado de carga. Contratos de arrays anteriores conservados para otros consumidores.

Local: **35 casos API y 15 de interfaz**, tipos, lint dirigido, formato y guard de CSS aprobados. CI exacto: [permisos/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37864988013) y [contenedores/tipos/migraciones/HTTP](https://github.com/studiocamaleon/gdi/actions/runs/37864987949) aprobados. Sin nuevas dependencias ni migraciones: 312 aplicadas. Recursos de los servicios conservados; PDF y copiador conservan sus imágenes.

Publicación autorizada por Lucas después de validar staging. Las mismas imágenes se copiaron al registro de producción con manifiestos idénticos, sin recompilar. Se comprobó ausencia de lotes activos antes de actualizar worker, worker PDF, API y web. Seis máquinas saludables, tamaños conservados, HTTPS 200/200, API directa 403 y BFF sin sesión 401. Revisión exacta y Sentry habilitado comprobados; navegación de Facturación y Comprobantes verificada en Chrome sobre datos existentes, sin emitir facturas ni enviar avisos de prueba. Los controles de página se ocultan cuando hay como máximo 25 resultados.

Preflight fiscal automático aprobado con token, ambiente y cifrado coherentes; consulta de sólo lectura desde el worker de un comprobante autorizado devolvió autorización coincidente. No acredita una nueva emisión real. Base conservada y rol de aplicación sin DDL. Sentry no registró incidencias de las revisiones publicadas en el sondeo posterior. Los registros de web contenían cierres de stream anteriores a esta publicación; API y workers no mostraron errores en las líneas revisadas. El primer respaldo posterior falló; se ejecutó un reintento conservando el diagnóstico privado y se verificó la copia nueva. No se confirmó la causa del primer fallo.

Fuente exacta cifrada y retenida por 31 días; inventario del copiador actualizado. Copia previa `b0c2d8d7-b8d3-40e9-8824-6adee5dc5cb6` (2026-10-09T00:01:36.310Z); posterior `673be19e-9c69-4067-8997-9ad066d644c9` (2026-10-09T00:58:17.553Z), con firma, descifrado del manifiesto, fuentes, digests, 312 migraciones y 111 archivos comprobados. **No se repitió restauración SQL.** Los primeros sondeos todavía encontraron la copia anterior; se comprobó la nueva al completar. Evidencia privada fuera de Git.

Reversión de código: API/ambos workers a `sha256:0830c8a90f925fd36bcc6b7d615538f38b449c7443db213a0a2c6da022cc681a`, web a `sha256:7e351d75af3987132d995aa099a51d9a16339ce5ca867c329c3a370af760145f`. Sin reversión de esquema; restablecería los límites anteriores. Antes de revertir, comprobar lotes en curso y actualizar también el inventario de recuperación.


## 2026-10-09, 01:31 UTC — IVA congelado y redondeo comercial (PR #51)

- Versión backend `afd1148ea09338c31a3f0d01b7b1e162f0b67313`, imagen `sha256:b8c76956f068ee35e73fc06302c80c71a5381d397ed218999b8a330ba339ddad` en API, worker principal y worker PDF. Web conserva `a2999b3337d670e8572b033476f6c600aa97addb`. PR #51 depende temporalmente de #50; no se fusionó la cadena ni se modificó la web comercial.
- Se elimina la comparación con tolerancia fija para una alícuota válida congelada en la cotización: el pricing comercial redondea por unidad y acumula diferencias en tiradas grandes o precios enteros. La base fiscal se obtiene del bruto pactado y conserva el total. Tasas inválidas o varios impuestos externos se rechazan; sólo las órdenes históricas sin alícuota usan inferencia por importes.
- Regresión reproducida antes de corregir; 52 pruebas locales aprobadas y compilación Nest correcta. En la imagen desplegada, API y worker pasaron 33 comprobaciones cada uno con datos ficticios: A/B, detalle, resumen, parciales, redondeos y rechazo de tasas inválidas. No se emitieron comprobantes ni se enviaron avisos como parte del ensayo.
- CI de la versión: contenedores y permisos/separación de empresas aprobados. Seis máquinas iniciadas, tamaños conservados y HTTPS/salud/accesos comprobados. Sin nuevas migraciones: 312 aplicadas.
- Respaldo posterior `f7713361-a00b-4201-bb4b-74a6566b2b70`, terminado `2026-10-09T01:30:07.998Z`: firma y descifrado del manifiesto comprobados, 312 migraciones, 112 archivos y fuentes/imágenes exactas incluidas. Fuente nueva cifrada y custodiada por 31 días. No se repitió la restauración SQL aislada en esta publicación.
- Los errores de lotes existentes conservan su historial; este despliegue no reintenta las emisiones fallidas ni vuelve a enviar las facturas autorizadas. Los avisos programados mantienen su ventana horaria.


## 2026-10-09, 18:39 UTC — Colas de trabajo compactas y tabla ampliada (PR #52)

Revisión web `50e069b082c9a24ff2efe647ae2eb7310bb2a4b9`, imagen `sha256:d6d06dc4d88a34640a65bfd01684e939d603981353e86bc2f0002b28998a131e`. [PR #52](https://github.com/studiocamaleon/gdi/pull/52), dependiente de #51, sin fusionar. La rama incorporó la base ya desplegada para conservar las correcciones anteriores de facturación, IVA, autoregistro, teléfonos e historial/paginación. El cambio funcional frente a esa base se limita a los dos archivos de Colas de trabajo.

La vista reduce encabezados en pantallas pequeñas, reemplaza la lista lateral de máquinas por un selector cuando falta ancho y oculta las acciones de selección cuando no se necesitan. «Ampliar tabla» abre la cola en un modal que ocupa el viewport y mantiene filtros, búsqueda, página y selección. Cierre con botón o Escape; foco de vuelta en «Ampliar tabla». Se conserva la tabla con desplazamiento horizontal y vertical.

- Local: 35 pruebas existentes de colas, selección, helpers y simulación aprobadas; ESLint dirigido, guard de CSS y `git diff --check` correctos. Interfaz comprobada a 1134×647, 1440×900, 390×844 y 320×568; formulario de tiempos anidado y Escape ensayados con datos ficticios, sin confirmar operaciones.
- CI del código publicado: [contenedores/tipos/migraciones/HTTP](https://github.com/studiocamaleon/gdi/actions/runs/37970610262), [permisos/aislamiento](https://github.com/studiocamaleon/gdi/actions/runs/37970610302), [dependencias](https://github.com/studiocamaleon/gdi/actions/runs/37970610350) y [CodeQL](https://github.com/studiocamaleon/gdi/actions/runs/37970605012) aprobados.
- Sólo se actualizó la web. API y ambos workers conservan `afd1148ea09338c31a3f0d01b7b1e162f0b67313`, digest `sha256:b8c76956f068ee35e73fc06302c80c71a5381d397ed218999b8a330ba339ddad`; PDF y copiador conservan sus imágenes. Una máquina por servicio, mismos tamaños, HTTPS web/API 200, API privada 403 y BFF anónimo 401. Revisión exacta y Sentry habilitado comprobados en la web.
- Sin nuevas migraciones ni cambios de datos, dependencias o configuración fiscal. No se emitieron comprobantes ni se enviaron avisos de prueba. Evidencias de navegador y operación guardadas fuera de Git.

Publicación expresamente autorizada después de validar staging. Se copió al registro de producción la misma imagen y se verificó su manifiesto por SHA-256, sin recompilar. Se renovó el acceso temporal al registro antes de la copia. Fly reemplazó la máquina web durante el despliegue; quedó una sola máquina saludable con el tamaño anterior. API y workers no se reiniciaron para esta publicación.

Chrome en producción: modal comprobado a **390×844**, con datos existentes, búsqueda y tabla visibles; cierre con Escape y foco de vuelta al botón correctos. Consola sin advertencias ni errores. Las comprobaciones de filtros/selección se completaron antes en staging; no se ejecutaron acciones de producción sobre trabajos reales.

Fuente exacta cifrada y custodiada por 31 días e inventario del copiador actualizado. Copia previa `4f355d07-8b17-43ec-b212-eaaf049c9eee` (2026-10-09T18:01:42.446Z). Copia posterior `855ba8c9-8c7a-48f4-8a8c-98f215a128aa` (2026-10-09T18:39:37.248Z): firma válida, manifiesto descifrado, revisión, fuentes y digests exactos comprobados; 312 migraciones y 125 archivos. El primer sondeo todavía encontró la copia anterior. **No se repitió restauración SQL.** Constructor temporal eliminado; inventario final de apps igual al inicial.

Reversión sólo de web: `registry.fly.io/grafoprint-production-web@sha256:42af339be2249afa3208db43fa6dd5261dcc9ff89ca87e347dcdd2c231b4f079` (`a2999b333`), sin modificar esquema ni registros. Actualizar también el inventario del copiador si se revierte.

## 2026-10-10, 00:33 UTC — Análisis, seguimiento y reprogramación (PR #56)

Código `15014c4645fcbbc3a0d4191cbfe1f68715783c29`, [PR #56](https://github.com/studiocamaleon/gdi/pull/56), dependiente de #54 y su cadena de planificación. Incorpora también la corrección de seguimiento de #55. El usuario autorizó publicar Análisis/seguimiento después de staging y confirmó expresamente incluir la reprogramación unificada. No se fusionaron PR ni se modificó `main` o la web comercial.

- API y ambos workers: `registry.fly.io/grafoprint-production-api@sha256:c769f370c500ba40706b110a543c51691886f9b5b6cdaa143ab95fd519e6cc5f`.
- Web: `registry.fly.io/grafoprint-production-web@sha256:e6aaaebc6c7194bc81d24303bac0da7185633a2325e41f9df087bca80a6272d0`.
- Se copiaron las imágenes probadas en staging y se verificó la igualdad de sus manifiestos por SHA-256, sin recompilar para producción. Orden: worker, worker PDF, API y web. No había lotes fiscales activos en la comprobación previa. PDF y copiador conservan sus imágenes.
- Seis máquinas iniciadas con tamaños originales, incluida API con 1 CPU performance / 2 GB. HTTPS web/API 200, API privada 403 y BFF anónimo 401. Revisión exacta y Sentry habilitado comprobados en los cuatro servicios actualizados. Sin nuevas migraciones: 312 aplicadas.

### Validación

Pruebas locales sobre el conjunto: 41 casos web y una integración de IVA en PostgreSQL aprobados, además de las suites de cada cambio. Compilaciones completas de API/web con tipos en Fly. [CI contenedores/tipos/migraciones/HTTP](https://github.com/studiocamaleon/gdi/actions/runs/38005967111) y [CI permisos/aislamiento/fiscal](https://github.com/studiocamaleon/gdi/actions/runs/38005967115) aprobados. Los recorridos de las siete vistas de Análisis, seguimiento y los tres modos de reprogramación se completaron en [staging](../staging/VALIDACION.md).

Comparación antes/después de los reportes reales mediante transacciones explícitamente de sólo lectura: 45 órdenes del período fijo, incluida una con cargos. Los cálculos existentes de ventas netas, costos y márgenes de rentabilidad/comercial/producto/embudo se mantuvieron iguales; la referencia con IVA coincidió con una suma independiente de los productos. Los cargos siguen excluidos de ventas/márgenes. No se modificaron registros para hacer la comprobación.

Chrome autenticado en producción: Resumen ejecutivo muestra «No incluye cargos extra» y el bruto de referencia bajo las ventas y sus tablas. El seguimiento del pedido de talonarios muestra «Abrochado» en el paso manual. Planificación abre el formulario unificado desde una colocación: Fecha con el cliente, Automático, Elegir inicio y Conservar visibles. Se canceló sin modificar fechas. Consolas de las tres pantallas sin errores ni advertencias. Persistencia y concurrencia de reprogramación están probadas localmente; **no se guardaron reprogramaciones reales como prueba de despliegue**.

Control fiscal posterior: `deploy/verificar-worker-fiscal.mjs produccion` aprobó modo automático y configuración coherente entre API y worker. Desde el worker actualizado se consultó en ARCA un comprobante existente; autorización/CAE e importes coinciden con el registro previo. La consulta fue de sólo lectura: no se emitieron facturas ni se reenviaron avisos.

Sentry: sin incidentes de esta revisión al verificar después del recorrido. Los errores encontrados en las últimas líneas de logs corresponden a momentos anteriores al despliegue (conexiones Redis/base y solicitudes web abortadas); no se presentan como errores nuevos ni como corregidos por esta publicación. Evidencias operativas y capturas privadas fuera de Git.

### Recuperación y reversión

Fuente exacta cifrada y custodiada por 31 días; inventario del copiador actualizado con fuentes e imágenes activas. Copia previa `d33f6bd6-2e12-4818-a774-0a0274e6dc88`, completada `2026-10-10T00:01:51.596Z`; posterior `9db3031f-52d3-4ece-aecb-80ec8b4b51f7`, completada `2026-10-10T00:33:48.797Z`: firma válida, manifiesto descifrado, revisión, fuentes y digests exactos comprobados; 312 migraciones y 136 archivos. El primer sondeo encontró todavía la copia anterior. **No se repitió restauración SQL.** Constructor temporal propio retirado e inventario de apps igual al inicial; sin cambios en Docker local ni otros proyectos.

Reversión de código a API/ambos workers `registry.fly.io/grafoprint-production-api@sha256:b8c76956f068ee35e73fc06302c80c71a5381d397ed218999b8a330ba339ddad` (`afd1148ea`) y web `registry.fly.io/grafoprint-production-web@sha256:d6d06dc4d88a34640a65bfd01684e939d603981353e86bc2f0002b28998a131e` (`50e069b08`). No requiere revertir esquema. Conservar fechas e historial confirmados y revisar el tratamiento del inicio mínimo antes de volver al motor anterior; no restaurar la base para deshacer código. Actualizar también el inventario del copiador si se revierte.
