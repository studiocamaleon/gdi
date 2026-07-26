# Datos de empresa

**Estado:** Fase A (modelo + API + pantalla) implementada — 2026-07-26.
Fases B y C pendientes.

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
- **B — pendiente.** Los consumidores: pie del PDF de presupuesto y de recibo
  (web · teléfono · domicilio), seguimiento público (teléfono para llamar,
  domicilio y horario para retirar), línea secundaria en el comprobante fiscal.
- **C — pendiente.** Cablear la reseña: llenar `url_resena` con el link, más el
  disparador "N días después de entregada". Es plantilla de MARKETING, así que
  necesita opt-in y que la imprenta la active a mano.

## Advertencia

Los PDF son **fotos** que se guardan al emitir (`presupuestos.service.ts`,
`pdfDe`). Cambiar el teléfono no reescribe los presupuestos ya enviados — está
bien que sea así, un documento que el cliente aprobó no debería mutar, pero
conviene saberlo cuando se cargue por primera vez.
