# Piloto asistido en Chile

Esta guía corresponde a la versión que incorpora **Tester · 30 días gratis e implementación sin cargo** en Plataforma. Verificar la versión publicada antes de usarla con una empresa real.

## Antes de invitar

1. Verificar salud, invitaciones y un comprobante de respaldo reciente del entorno. Ensayar en staging la migración aditiva `20261103200000_piloto_desde_invitacion`, el alta y la aceptación. Las suscripciones existentes conservan la configuración normal.
2. Acordar con el taller la ciudad, el plan, los módulos necesarios, los usuarios y el abono posterior en USD. La moneda de precios del taller y la moneda del abono son independientes. Los importes comerciales de prueba de otros entornos no constituyen una oferta.
3. En Plataforma → Empresas → Nueva empresa, elegir Chile, revisar **CLP** y elegir la zona IANA del taller. Para Santiago usar `America/Santiago`. El selector también contempla Aysén, Magallanes y Rapa Nui. Seleccionar el plan operativo y las condiciones de tester.
4. La invitación vence en siete días y puede reenviarse. Los 30 días empiezan cuando se acepta por primera vez la invitación del administrador. Un intento rechazado, un reenvío o un segundo uso del enlace no consume ni reinicia el plazo. La bonificación de implementación queda registrada para esta empresa, incluso si luego elige una oferta con cargo inicial.
5. Confirmar el primer ingreso, la moneda, la zona, los permisos y los impuestos comerciales del taller antes de cargar precios. Configurar una cuenta de fondos en CLP. Probar una cotización representativa con costos propios, convertirla a OT, entregar, registrar un cobro y comparar total, saldo y recibo. Si usa insumos en USD, verificar su fuente de cambio y el importe convertido.

El recibo de cobro y el presupuesto son documentos operativos. La emisión electrónica integrada es la de Argentina. Para un taller chileno, el DTE se emite en su sistema externo. En la versión revisada, el registro público de clientes y el escaneo de DNI en mostrador son circuitos argentinos. La ficha manual permite cargar clientes sin DNI/CUIT. Acordar por separado si el piloto necesita identificación por RUT.

## Paso al abono

El fin de la prueba manual deja a la empresa en modo de lectura. El administrador conserva la gestión de Suscripción. Para continuar debe revisar el importe, el ciclo y los impuestos, y confirmar el checkout de una oferta vigente que su empresa pueda contratar. El catálogo comercial de Grafo está definido en USD. Una oferta privada sólo está disponible para la empresa que tiene asignado ese plan. El primer checkout puede usar una oferta pública elegible o la oferta publicada del propio plan. Si el taller empieza con un plan manual diferente, comprobar esa transición antes de ofrecerle una tarifa privada.

Antes de abrir cobros:

1. Completar la verificación de la cuenta live de Paddle, solicitar aprobación del dominio exacto del checkout y configurar el enlace de pago predeterminado en una página que cargue Paddle.js. Confirmar que la ficha de producto, el precio y las políticas de cancelación, reembolso y privacidad sean accesibles. Comprobar el enlace recibido desde una sesión nueva.
2. En la API del entorno, configurar `PADDLE_ENV`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` y `PADDLE_WEBHOOK_ENABLED=true`. En la web, configurar `PADDLE_ENV` y el **token público** `PADDLE_CLIENT_TOKEN` del mismo entorno. Sandbox y producción tienen cuentas, precios, destinos y secretos propios. La imagen web se configura en ejecución para poder promover el mismo digest. Mantener el webhook cerrado hasta tener las credenciales correctas.
3. Configurar el destino de notificaciones de Paddle en el host API del entorno, ruta exacta `POST /api/webhooks/paddle`. Suscribir los eventos del ciclo `subscription.*` que actualizan el contrato (alta, activación, actualización, pausa, reanudación, mora, cancelación) y `transaction.completed`. Verificar firma y comprobar un reintento sin duplicar acceso ni facturación.
4. Publicar desde Plataforma una versión con su precio recurrente aprobado y sincronizar la oferta con Paddle del entorno. Revisar el primer cobro de una empresa tester: un abono, cero implementación, cero usuarios adicionales si no fueron solicitados. La prueba gratuita local no se suma a otra prueba de Paddle. Antes de terminar los 30 días, confirmar que el administrador pueda abrir el checkout y que la notificación actualice el acceso de la misma empresa.
5. Validar primero con datos ficticios y tarjeta de prueba en sandbox. En live comprobar dominio, precios, enlace de pago, evento firmado, renovación y acceso con la cuenta del titular. Usar una operación real sólo con autorización concreta. La prueba local/sandbox no acredita que el comercio live esté aprobado.

Referencias: [activación de Paddle](https://developer.paddle.com/build/go-live-checklist/), [revisión del dominio](https://www.paddle.com/help/start/account-verification/what-is-domain-verification), [monedas y unidades mínimas](https://developer.paddle.com/concepts/sell/supported-currencies/).
