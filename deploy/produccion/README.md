# Producción de Grafoprint

Estado al 01/10/2026: infraestructura desplegada y primera recuperación de base, archivo y código comprobada; administrador con clave personal y MFA, certificado ARCA cifrado y consulta WSFE de producción verificada. HTTPS, origen web definitivo y acceso de la primera empresa comprobados; invitación entregada y aceptada, Founder manual activo. Posteriormente se trasladó la configuración operativa local autorizada, sin historial comercial/fiscal ni stock; el informe detallado es privado. La configuración fiscal de esa empresa está guardada y la integración de producción quedó activa con autorización del titular, sin emitir comprobantes. **Todavía falta completar el recorrido funcional de negocio y comprobar el primer comprobante comercial legítimo cuando corresponda.** Consultar el registro vigente en [VALIDACION.md](VALIDACION.md). La web comercial permanece en Vercel. La aplicación y sus servicios usan Fly; cada entorno tiene bases, depósitos y credenciales propias.

**Estado vigente: 2026-10-06, 12:11 UTC.** API, ambos workers y web `8053bcf0e` (PR #24): avisos de OT finalizada según saldo y QR, reintento de fallos y botones uniformes. CI, 35 comprobaciones HTTP/SSR de staging y revisión visual aprobados. Sentry activo; 306 migraciones, ninguna nueva y mismos tamaños. Copia posterior con firma, manifiesto y versión comprobados, sin repetir restauración SQL. Ver [VALIDACION.md](./VALIDACION.md).

## Alcance del primer lanzamiento

El alta inicial fue de una empresa nueva, sin historial local. La migración operativa posterior fue autorizada y comprobada por separado; no incorporó órdenes, presupuestos, movimientos de caja ni stock. Alta mediante Plataforma, plan privado/manual e invitación individual. Inbox y registro público deshabilitados. Paddle live se configura por separado; no activar ventas hasta validar su cuenta, catálogo, precios y webhooks. La facturación fiscal usa [ARCA de Plataforma](../../docs/fiscal-arca-plataforma.md), con certificado real cargado por administración con MFA.

## Recursos y separación

| Parte | Producción | Tamaño inicial |
|---|---|---|
| Aplicación | `app.grafoprint.com.ar`, Fly web en São Paulo | 1 CPU compartida / 1 GB |
| API | `api.grafoprint.com.ar`, Fly API en São Paulo | 1 CPU compartida / 2 GB |
| Cálculos y trabajos | Fly worker, São Paulo | 2 CPU compartidas / 4 GB |
| Trabajos PDF | Fly worker-pdf, São Paulo | 1 CPU compartida / 1 GB |
| Generador PDF | Fly pdf, sólo red privada | 1 CPU compartida / 1 GB |
| Base | Neon PostgreSQL 16, São Paulo, `grafoprint_production` | 0,25 CU fijos, sin suspensión; historial 7 días |
| Colas y límites | Redis Cloud independiente | 512 MB datos + réplica, AOF cada segundo, TLS, noeviction |
| Archivos | R2 `grafoprint-production-files`, privado US | Según consumo |
| Copiador | Fly respaldo, Virginia, red propia | 1 CPU compartida / 512 MB; volumen 10 GB |
| Copias | B2 en cuenta independiente, depósito exclusivo | Cada hora, cifradas y protegidas contra borrado 30 días |

Las cinco apps Fly usan la red `grafoprint-production`. El copiador usa `grafoprint-production-respaldo`. Son redes separadas dentro de la organización de Fly; **no equivalen a cuentas administrativas independientes**. B2 sí está en el proveedor independiente elegido. Una máquina por servicio no constituye alta disponibilidad completa.

## Orden de activación

1. Comprobar presupuesto, cuentas y MFA. Crear los recursos nuevos; revisar nombre y entorno antes de cada operación. No usar los archivos privados de staging como plantilla con valores.
2. Preparar secretos fuera de Git, con directorio `0700` y archivos `0600`. Separar rol migrador, rol de aplicación y lector de respaldo. Usar los scripts de `apps/api/scripts/deploy` con `DEPLOY_DATABASE_NAME=grafoprint_production`. Migrar una vez y verificar permisos. **Nunca ejecutar seeds ni resets.**
3. Configurar R2 privado y [CORS](./r2-cors.json); probar TLS de Redis con validación de certificado, persistencia y cola sintética. La aplicación no recibe la clave del migrador ni del respaldo.
4. Compilar y probar los contenedores en remoto desde una revisión identificada. Reutilizar la misma imagen backend por digest para API y ambos workers. Aplicar los manifiestos de esta carpeta; `--ha=false`, sin IP pública en workers/PDF. Revisar que el constructor remoto esté en la red correcta. Registrar y retirar únicamente su recurso temporal al finalizar.
5. Configurar DNS y certificados administrados de ambos dominios. Conservar DNS de Vercel y correo. Verificar HTTPS antes de entrar datos. Next usa `API_URL=http://grafoprint-production-api.internal:3001/api`.
6. Configurar Resend de producción con permiso de envío limitado al dominio. Preparar ARCA prod; verificar CUIT/PV y autorización mediante consultas, sin emitir comprobantes ficticios reales.
7. Preparar copias horarias: clave de descifrado nueva, kit completo bajo custodia, lector Neon/R2, escritor B2 limitado y monitor externo propio. En el JSON privado, usar `RESPALDO_ENTORNO=produccion`, `habilitarProduccion=true` y `origenProduccionEsperado` con `pgHost`, `pgDatabase=grafoprint_production`, `r2Bucket=grafoprint-production-files`. Conservar los controles de custodia y sólo lectura. Registrar revisión e imágenes exactas y custodiar también sus fuentes.
8. Ejecutar una copia y restaurarla en un entorno aislado. Comprobar base, archivos, claves, código, MFA y rechazo de envíos externos. Una copia creada no demuestra recuperación. El monitor de producción debe avisar ante fallo o ausencia de copia.
9. Crear el administrador de Plataforma; el titular elige su contraseña y activa MFA. Crear empresa y plan mediante el flujo normal; comprobar invitación, acceso, aislamiento y recorrido de cotización → orden → inventario → caja/documentos.
10. Revisar los efectos de las tareas programadas antes de dar de alta la empresa. `GRAFO_LOCAL_DISABLE_CRON` sólo desactiva el planificador general con `NODE_ENV=development`: no es un interruptor global de producción. Las tareas de mantenimiento, gastos recurrentes y correos pendientes permanecen habilitadas en producción. Desde la actualización de medios de pago, las acreditaciones electrónicas requieren confirmación de la liquidación real; el paso del tiempo ya no crea automáticamente un movimiento de fondos. Inbox usa sus banderas explícitas; Paddle requiere credenciales y WATI una integración conectada. Enviar la invitación autorizada cuando el acceso y los respaldos funcionen; habilitar uso real tras completar el recorrido.

## Acceso web → API

API y Next llevan `GRAFO_DEPLOY_ENV=production` y una credencial nueva `WEB_API_TOKEN` de al menos 32 caracteres. No usar `STAGING_PRIVATE`. El canal interno conserva la IP validada por Fly para las cuotas; descarta cabeceras aportadas por el cliente. Las páginas del servidor y el proxy del navegador usan el mismo control y no siguen redirecciones con esa credencial. Los permisos de sesión y empresa siguen siendo obligatorios.

Next requiere además `WEB_ORIGIN=https://app.grafoprint.com.ar` para aceptar escrituras y crear sesiones desde ese origen exacto. Sin la variable responde 503; un origen distinto recibe 403. Durante la emisión inicial de TLS se habilitó temporalmente sólo el dominio propio de Fly, con HTTPS válido, para el alta del administrador. Al terminar, aplicar el origen definitivo del manifiesto y comprobar ambos rechazos. No agregar comodines ni aceptar cualquier Host.

Sólo `GET/HEAD /api` es público en la API durante este primer lanzamiento. Webhooks Meta y Paddle están cerrados; abrirlos requiere una implementación opt-in con firmas verificadas y sus pruebas. No agregar `TRUST_PROXY` para saltarse el canal. La web pública debe recibir tráfico directamente de Fly, como se validó; si cambia el proxy del dominio, revisar la IP antes.

## Registro y vuelta atrás

Registrar revisión Git, digest por servicio, migraciones, recursos, pruebas y fecha en `VALIDACION.md`. Un PR abierto no fusiona ni despliega. Esta preparación depende del PR de seguridad hasta que se integre; las verificaciones también se ejecutan en PR dirigidos a ramas `codex/**`, sin secretos cloud.

Conservar la versión anterior y comprobar compatibilidad del esquema antes de revertir código. Una reversión de imagen no revierte datos ni migraciones. Si hay daño de datos, congelar escrituras, restaurar en recursos nuevos y comprobarlos antes de cambiar dominios; no restaurar encima de la única base disponible.

Referencias operativas: [redes privadas de Fly](https://docs.fly.io/networking/custom-private-networks/), [procedimiento de respaldos](../recuperacion/README.md) y [flujo de PR](../../docs/flujo-pull-requests.md).
