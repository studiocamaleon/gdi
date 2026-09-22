# Correos transaccionales de Grafo

## Relevamiento

El barrido inicial encontró sólo la verificación del registro público. Se agregó
el envío de la invitación del administrador al crear una empresa desde Plataforma.
Ambos usan Resend y `apps/api/src/registro/correo-transaccional.service.ts`.

| Flujo | Situación actual |
| --- | --- |
| Confirmar el correo y crear la empresa | Correo nativo rediseñado e integrado al registro. |
| Alta de empresa desde Plataforma, incluidos Co-founder | Invitación automática al administrador, estado y reenvío desde la ficha. |
| Alta de usuarios del equipo de una empresa y restablecimiento de clave | Gestión desde la empresa, sin correo automático. |
| Invitación al equipo de Plataforma | Genera un enlace para compartir; no envía correo. |
| Bienvenida tras completar el registro | Pantalla `/bienvenida`; no hay un segundo correo. |
| Avisos de MFA y fin de Trial local | No se encontró un envío de correo nativo. |
| Recibos y confirmaciones de suscripción de Paddle | Plantillas del proveedor; no usan el HTML de Grafo. |

Paddle documenta sus correos de suscripción y transacciones en
[Correos de Paddle Billing](https://www.paddle.com/help/manage/your-customers/which-emails-will-customers-receive-on-paddle-billing).
Su marca se configura por separado: nombre comercial y datos de contacto; para
el logo, su ayuda indica contactar a soporte. No documenta sustituir todo el
HTML de Billing por una plantilla propia. Retain tiene otras opciones y no debe
confundirse con los recibos de Billing. Esta revisión no modifica Paddle ni
contacta a soporte. Referencia:
[Estilos de facturas y correos](https://www.paddle.com/help/start/set-up-paddle/editing-the-styling-of-invoicesemails).

## Diseño e integración

- Base reutilizable en `registro/plantillas/correo-base.ts`: papel cálido,
  grafito, naranja, marca de tres nodos y wordmark de la web.
- HTML con tablas y estilos inline; ajustes para móvil y ancho de Outlook.
  Tipografía de sistema, sin depender de fuentes descargadas ni JavaScript.
- Isotipo PNG de 1,9 KB adjunto inline mediante Content-ID. Su geometría es
  la de `apps/marketing/src/components/brand.tsx`. Nest copia el recurso a la
  compilación, y se carga una sola vez por proceso.
- Alternativa de texto plano, preheader y enlace alternativo. La verificación
  de registro vence en dos horas; la invitación de empresa, en siete días. Nombres, empresa, plan y URL escapados; enlaces HTTP/HTTPS.
- El nombre del plan y el plazo de prueba vienen de la oferta elegida al
  iniciar el registro; los planes anteriores usan sus propios datos. Se eliminó
  la promesa fija de 14 días y se evita inventar un plazo cuando no existe.
- La plantilla no modifica el proceso de alta ni los derechos del plan.

## Pruebas enviadas

Se enviaron dos muestras a la dirección indicada por el usuario, utilizando el
mismo servicio y plantilla del registro:

1. Grafo Pro, 14 días: confirmación de registro estándar.
2. Grafo Co-founder Pro, 30 días: muestra del plazo variable en la plantilla
   de verificación; el correo de invitación se probó por separado.

Ambas tienen asunto `[PRUEBA] Confirmá tu correo · Grafo`, datos de ejemplo y un
aviso visible. Sus botones llevan a la web pública; no contienen tokens ni
crean cuentas, empresas o suscripciones. La evidencia local de los envíos y del
estado del proveedor está en `/tmp/grafo-correos/resultado.json`.

También se enviaron dos invitaciones de muestra (Co-founder Pro USD 290 y
Co-founder Avanzado USD 690, implementación sin cargo), con asunto
`[PRUEBA] Tu invitación a … · Grafo`. Resend confirmó `delivered` para ambas.
Son ejemplos sin tokens funcionales ni altas de empresas. Evidencia local:
`/tmp/grafo-invitaciones/resultado.json`.

## Invitación desde Plataforma

- **Empresas → Nueva empresa → Crear y enviar invitación**. La oferta elegida
  determina el nombre, precio, implementación y plazo; no se toma el espejo
  editable del plan cuando hay una oferta publicada.
- La empresa se confirma en base de datos antes del envío. Un rechazo de Resend
  conserva el alta y se muestra como correo sin confirmar. No se vuelve a crear
  la empresa para reintentar.
- La ficha conserva el estado y ofrece reenvío al administrador de Plataforma.
  `enviado` significa aceptado por Resend, no entrega al buzón; no hay webhook de
  entrega implementado en este incremento.
- Reenvío con exclusión por empresa y espera de 60 segundos (120 si está
  enviando): genera otro token, invalida el anterior, conserva el cupo y no
  extiende la prueba. Enlaces aceptados o revocados no se reenvían.
- La prueba comienza al crear la empresa. El correo muestra su fecha real de
  finalización. Si ya venció, se debe revisar la suscripción antes de reenviar.
- Token de un solo uso, guardado como SHA-256, sin token en auditoría. Reenvío
  protegido por los guards ADMIN/MFA de Plataforma. Aceptación conserva MFA.
- Una sesión previa de empresa o Plataforma ya no intercepta la URL de
  invitación. Usuarios existentes no tienen que crear otra contraseña.
- Migración `20260922221500_invitaciones_correo` aplicada a desarrollo y a la
  base dedicada de pruebas; incorpora estado, fechas e identificador del envío.

## Reproducir

Desde `apps/api`, generar HTML sin enviar:

```sh
npx ts-node --project tsconfig.json scripts/probar-correos.ts
```

Para un envío expresamente autorizado:

```sh
npx ts-node --project tsconfig.json scripts/probar-correos.ts \
  --enviar --para=destinatario@example.com --lote=identificador-del-envio
```

Para generar o enviar las invitaciones de ejemplo, añadir `--tipo=invitacion`
a esos comandos.

La clave se toma del entorno local. Cada muestra lleva una clave de idempotencia
basada en el lote: reutilizarlo sólo para reintentar el mismo envío con el mismo
contenido. La vista previa sustituye el CID por un PNG embebido; el correo real
adjunta el PNG inline.

## Validación

- Pruebas de plantillas, transporte, registro con oferta guardada, invitación,
  aceptación de un solo uso, usuarios existentes, MFA, aislamiento y reenvío
  concurrente. Escenarios de publicación usan rollback en base de pruebas.
- 39 pruebas de integración de invitaciones, ofertas y escrituras de Plataforma;
  10 de interfaz/ruteo de invitaciones y ficha de empresa.
- Se actualizó la prueba antigua de cambios de plan para usar fixtures propias: los
  planes comerciales Taller/Producción/Enterprise ya están archivados.
- Build de API y carga del recurso desde `dist` correctos.
- Lint focalizado y `git diff --check` correctos.
- Vista de escritorio y móvil de 375 px: logo cargado y sin desbordamiento
  horizontal. El render final de Gmail queda disponible en las muestras enviadas;
  no se simuló una verificación en todos los clientes de correo.

La verificación visual cubre las plantillas en escritorio/móvil y la página de
invitación inválida. El modal autenticado se verificó con pruebas de componentes;
la sesión local de Plataforma requiere iniciar sesión de nuevo.

Quedan separados los avisos aún no implementados del inventario y la aplicación
de la marca en la cuenta de Paddle.
