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

- Print (`taller` internamente): USD 190/mes, 14 días de prueba.
- Sign (`estudio` internamente): USD 290/mes, recomendado, 14 días.
- Industrial (`diamante` internamente): precio a medida; no admite alta ni
  checkout automáticos. Incluye las funciones de Sign, usuarios
  ilimitados, soporte prioritario y 4 horas mensuales de especialista.

Los códigos internos permanecen estables para no romper suscripciones y
webhooks históricos.

## Diseño comercial del registro · 15/09/2026

`/registro` comparte la tipografía Geist, el grafito, el papel cálido y el naranja
de la nueva web comercial. El panel visual usa la misma planta; el formulario y
su estado de correo enviado usan `registro-premium.module.css`. Los estilos de
las pantallas de verificación y bienvenida permanecen aislados en su módulo
existente.

El catálogo, precios mensuales, moneda, límites y días de prueba se leen desde
`GET /registro/planes`. `registro-presentacion.ts` traduce únicamente los nombres
comerciales y acepta tanto `?plan=print|sign` como los enlaces históricos
`?plan=taller|estudio`. El POST conserva los códigos originales, los campos de
empresa y usuario, país y zona horaria, aceptación de términos, `aceptaMarketing:
false`, origen y atribución UTM. La contraseña nunca se modifica para un usuario
existente; esa regla sigue en el servicio de registro.

Se retiró el selector anual del alta: aplicaba un 20% fijo en la presentación,
pero no enviaba el ciclo al API. El registro muestra el precio mensual real; el
ciclo contratado sigue definiéndose desde Suscripción según el catálogo de
cobro. No se modificaron precios ni permisos de la base de datos.

Los recursos visuales están en `public/registro/media`, dentro del acceso público
ya existente, sin ampliar las rutas del proxy. El video se pausa fuera de pantalla
y respeta movimiento reducido. Si el API no responde, se muestra un estado con
reintento y contacto, sin ofrecer un catálogo ficticio ni enviar altas incompletas.

Validación: pruebas de compatibilidad de códigos, elegibilidad de planes,
límites del DTO y render con importes variables; TypeScript, lint focalizado y
CSS Guard. La revisión de interfaz no envía solicitudes de registro ni correos.

## Acceso con la misma identidad visual · 15/09/2026

`/login` reutiliza los colores, controles y cabecera del registro, junto con
`RegistroAmbient`. Su composición está aislada en `login-premium.module.css`:
dos paneles en escritorio y un encabezado visual compacto en móvil.

La autenticación mantiene `login`, la persistencia de sesión y `router.refresh`.
Después de ingresar se vuelve a `/`, o a `/registro/verificar?token=…` cuando
hay una continuación de registro. Se retiró la espera decorativa de casi tres
segundos. El botón evita envíos simultáneos y anuncia el estado de carga.

Se conserva el aviso `?motivo=sesion`. Los campos requieren correo y contraseña,
con autocompletado de acceso y visibilidad de contraseña; no aplican los nuevos
requisitos de longitud del alta a las cuentas existentes. La ayuda desplegable
explica el restablecimiento mediante quien administra la empresa, sin ofrecer
un flujo de recuperación por correo que el API no implementa.

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
