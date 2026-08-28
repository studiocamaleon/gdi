# Registro público de tenants

## Flujo

1. La web comercial enlaza a `/registro?plan=taller` o
   `/registro?plan=estudio`.
2. El API guarda una solicitud previa al tenant, con la contraseña hasheada y
   un token de correo que vence en 2 horas.
3. Resend envía el enlace. En desarrollo, si no hay clave, el enlace aparece
   únicamente en el log local.
4. Al confirmar, una sola transacción crea empresa, roles predefinidos, datos
   regionales, suscripción Trial, usuario administrador y membership.
5. El navegador recibe una sesión y muestra `/bienvenida`.

Un correo que ya pertenece a un usuario nunca reemplaza su contraseña. La
persona inicia sesión y la empresa nueva se agrega a su identidad existente.

## Planes

- Taller: USD 190/mes, 14 días de prueba.
- Producción (`estudio` internamente): USD 290/mes, recomendado, 14 días.
- Enterprise (`diamante` internamente): precio a medida; no admite alta ni
  checkout automáticos. Incluye las funciones de Producción, usuarios
  ilimitados, soporte prioritario y 4 horas mensuales de especialista.

Los códigos internos permanecen estables para no romper suscripciones y
webhooks históricos.

## Variables

Ver `apps/api/.env.example`. En producción son obligatorias
`REGISTRO_PUBLICO_HABILITADO=true`, `REGISTRO_PUBLICO_URL`, `RESEND_API_KEY` y
un `RESEND_FROM` cuyo dominio esté verificado. `TERMINOS_VERSION` congela qué
texto aceptó cada alta.

El Trial no pide tarjeta. Al contratar desde Suscripción, Paddle reemplaza el
proveedor manual y borra `trialHasta`; así el cron de vencimientos nunca puede
suspender una suscripción paga.

Los IDs del catálogo anterior se migran a `PlanPrecioLegacy`: siguen
reconociendo webhooks históricos, pero no aparecen en un checkout. Antes de
vender los planes nuevos hay que crear en Paddle los precios mensuales USD 190
y USD 290 y vincularlos desde Plataforma → Planes y precios.
