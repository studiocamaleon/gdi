# Datos de empresa

**Estado:** COMPLETO — fases A (modelo + API + pantalla), B (consumidores) y C
(pedido de reseña), 2026-07-26.

## El problema

El nombre que salía impreso en el PDF de un presupuesto —"Grafica
Corporearte"— es `Tenant.nombre`, y **no había ninguna pantalla para
editarlo**: se escribe cuando se crea la imprenta, desde el control plane. Ni
el dueño podía cambiarlo.

Y convivía con un segundo nombre sin saberlo: `ConfiguracionFiscal.razonSocial`,
el que ven los comprobantes fiscales. Al punto de que la tarjeta del logo en
Datos fiscales dibujaba las iniciales de la *razón social* mientras el PDF del
presupuesto dibujaba las del *nombre comercial*.

Además, no había dónde guardar nada de lo que un cliente necesita: teléfono,
web, dónde queda el local, horario. La plantilla de WhatsApp `grafo_resena_v2`
—aprobada por Meta— tiene un parámetro `url_resena` y no la manda nadie,
exactamente por eso.

## La decisión: dos pantallas, no una

Se evaluó renombrar "Datos fiscales" a "Datos de empresa" y meter todo junto.
Se descartó por dos razones:

1. **Razón social ≠ nombre comercial.** El comprobante *tiene* que decir
   GRUPO IDEA S.R.L.; el presupuesto *quiere* decir Gráfica Corporearte. En
   una pantalla sola se mezclan y alguien termina facturando con el nombre de
   fantasía.
2. **Son dos permisos distintos, y ya existían.** Datos fiscales pide
   `administracion.configurar` (la llave del Administrativo); Empresa pide
   `configuracion.gestionar` (la del dueño). Con una sola pantalla, o el
   administrativo puede renombrar el negocio, o el dueño no puede tocar su
   propia web.

| Configuración › **Empresa** (`configuracion.gestionar`) | Configuración › **Datos fiscales** (`administracion.configurar`) |
| --- | --- |
| Nombre comercial, logo | Razón social, CUIT |
| Teléfono / WhatsApp, email | Condición fiscal, Ingresos Brutos |
| Sitio web | Domicilio fiscal, inicio de actividades |
| Domicilio comercial, localidad, provincia, horario | Leyenda de factura A |
| Link de reseñas | Puntos de venta |

El logo se mudó a Empresa: es marca, no dato fiscal.

## Modelo

`DatosEmpresa`, 1-1 con Tenant — el mismo patrón que `ConfiguracionFiscal`,
`ConfiguracionPresupuestos` y `ConfiguracionProduccion`.

**El nombre comercial NO está en `DatosEmpresa`**: sigue siendo `Tenant.nombre`,
que ya leen la sesión, el sidebar, el selector de empresa y el control plane.
Un segundo campo sólo abriría la puerta a que discrepen. Se guarda junto con el
resto en una transacción, porque para el usuario es un solo botón.

Dos decisiones chicas del servicio:

- **Los links salen con esquema.** Casi nadie escribe `https://` —se copia
  "grafo.ar" de una tarjeta— y un `href` sin esquema el navegador lo resuelve
  como ruta relativa: el cliente que tocaba la web de la imprenta en el
  seguimiento terminaba en `app.grafo.ar/grafo.ar`.
- **Vacío es null.** `""` y `"   "` no llegan a la base; si no, un campo
  borrado se imprimiría como una línea en blanco en el PDF.

El teléfono va partido en `telefonoCodigo` / `telefonoNumero` / `paisCodigo`,
como el resto del sistema (ver `src/integraciones/telefono.ts`): lo que se
muestra es lo que se cargó, y para WhatsApp se normaliza a E.164 al vuelo.
`whatsappCodigo`/`whatsappNumero` sólo si el WhatsApp del negocio es **otro**
número.

## Fases

- **A — hecha.** Modelo + migración, `GET`/`PUT /tenants/empresa`, pantalla
  Configuración › Empresa, logo mudado desde Datos fiscales.
- **B — hecha.** Los consumidores. Todos leen `paraDocumentos()`, que resuelve
  una sola vez cómo se arma la dirección y cómo se escribe el teléfono:
  - **PDF de presupuesto y de recibo**: el contacto va en la CABECERA, debajo
    del nombre, y reemplaza a los subtítulos "Presupuesto comercial" y
    "Comprobante de pago" — que repetían lo que la columna derecha ya dice en
    mayúsculas. Sin datos cargados vuelve el subtítulo. La línea se MIDE contra
    el ancho libre: jsPDF no corta ni avisa, así que un dominio largo se
    escribía encima del número. Cuando no entra se cae primero el mail.
  - **Seguimiento público**: tarjeta con el domicilio (con link a Google Maps)
    y el horario. Los botones de llamar y WhatsApp sólo aparecen si el vendedor
    no los ofreció ya, para no poner dos pares de teléfonos en la misma
    pantalla.
  - **Comprobante fiscal**: "Domicilio comercial" pasa a usar el comercial y
    deja el fiscal de respaldo —la RG 1415 pide el comercial, y hasta ahora lo
    único que había era el fiscal, que puede ser el estudio contable—. Se
    suman las filas Teléfono y Web.
- **C — hecha.** El pedido de reseña, unos días después de la entrega.
  `grafo_resena_v2` estaba aprobada por Meta y muerta por no tener dónde sacar
  el link; ahora sale de Configuración › Empresa.

  Es el único aviso que **no lo dispara un hecho** sino el paso del tiempo:
  nadie aprieta un botón llamado "ya pasaron tres días". Se resuelve barriendo
  —mismo patrón que la acreditación de cobros con plazo— con un cron diario a
  las 10, dentro de la ventana de cortesía por default para que salga en el
  momento en vez de quedar reprogramado.

  El ancla es `OrdenTrabajo.fechaEntregada`, nueva, que se sella en la PRIMERA
  entrega y no se resetea: corregir el estado de una orden ya entregada no le
  vuelve a pedir la opinión al cliente. Las órdenes anteriores al campo quedan
  sin fecha **a propósito** —no hay backfill— para que encender la función no
  dispare un WhatsApp por cada orden del historial.

  Cuatro frenos, todos a propósito:

  1. **Sin link de reseñas no se manda**: el mensaje entero existe para llevar
     a esa página.
  2. **Ventana de 10 días** hacia atrás además del plazo: volver de una pausa
     larga no vacía el historial de golpe, y a nadie le sirve que le pregunten
     por un trabajo de hace dos meses.
  3. **Es MARKETING**, así que `NotificacionesService` exige que el cliente
     haya aceptado recibir WhatsApp explícitamente.
  4. **Viene apagado** y el plazo lo elige la imprenta (Wati › Notificaciones,
     0–30 días, default 3).

### Dos formas del teléfono, a propósito

`telefonoLink` ("+543415551840") y `whatsapp` ("5493415551840") NO son el mismo
string. `aE164` —la función de WhatsApp— fuerza la forma móvil argentina
metiéndole un `9`, y lo hace con un argumento explícito: para un MENSAJE
conviene arriesgar, porque si el número era un fijo el mensaje no iba a llegar
igual. Para una LLAMADA el riesgo es al revés: meterle el 9 a un fijo hace que
la llamada no entre. Así que el `tel:` respeta lo que la imprenta cargó y sólo
lo pone en forma internacional.

## Advertencia

Los PDF son **fotos** que se guardan al emitir (`presupuestos.service.ts`,
`pdfDe`). Cambiar el teléfono no reescribe los presupuestos ya enviados — está
bien que sea así, un documento que el cliente aprobó no debería mutar, pero
conviene saberlo cuando se cargue por primera vez.
