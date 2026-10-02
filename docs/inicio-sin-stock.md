# Modo de inicio sin stock

Permite empezar a trabajar mientras la empresa carga su inventario. Está apagado por defecto y sólo lo puede cambiar quien tenga **Gestionar stock**.

## Cómo usarlo

1. Abrir **Inventario → Stock → Modo de inicio**.
2. Leer el alcance y pulsar **Activar modo de inicio**.
3. Cotizar, emitir y avanzar las nuevas órdenes. La disponibilidad física queda a cargo del equipo.
4. Cargar el inventario real. Cuando esté listo, volver al mismo botón y elegir **Volver al control normal**.

El aviso se muestra en Stock y en el formulario comercial. Los usuarios sin permiso de gestión pueden ver el aviso, pero no cambiar el modo. El cambio queda registrado con su autor.

## Qué cambia

| Aspecto | Durante el modo de inicio |
| --- | --- |
| Materiales y precios | Se mantienen materiales reales, cantidades calculadas y costos. |
| Selección automática por stock | Considera variantes técnicamente válidas sin exigir existencias. Conserva en el cálculo la política original del producto. |
| Fecha sugerida | Considera taller y calendario; no espera el abastecimiento de materiales. |
| Existencias físicas | No se inventan, incrementan ni descuentan automáticamente. |
| Reservas y compras de materiales | Las nuevas OTs no generan demanda ni admiten reservar o consumir inventario desde la orden. |
| Producción | Se omite sólo la condición MATERIAL. Calidad, dependencias, permisos y requisitos técnicos siguen vigentes. |
| Órdenes anteriores | Conservan sus controles y reservas. |
| Órdenes emitidas en este modo | Conservan su identificación al apagarlo; no hay consumo retroactivo. |

La decisión se toma **al emitir**, no al guardar un borrador. Un presupuesto calculado en modo de inicio y emitido después de apagarlo vuelve a validar su política de stock. Los productos configurados con «Sólo stock disponible» pueden requerir recotización. No se modifica la configuración publicada del catálogo.

El modo no sustituye la carga del inventario real, la configuración de máquinas, precios, proveedores de servicios tercerizados ni los controles de calidad. Tampoco habilita compras externas o comunicaciones automáticas.

## Implementación y publicación

- Rama `codex/inicio-sin-stock`, dependiente de **PR #15** (`codex/cotizador-catalogo-publico`, base `a7777365d`). No agrega esta función al PR anterior. Ajustar la base cuando se integre esa dependencia.
- Migración aditiva `20261001223000_inicio_inventario`: dos indicadores, por empresa y por OT, ambos inicialmente falsos. No modifica existencias, saldos, órdenes anteriores ni reservas.
- El servidor decide el modo a partir de la sesión y la configuración de la empresa. Los clientes no pueden enviarlo dentro de una cotización para eludir el control.
- Activar o desactivar requiere `inventario.stock.gestionar`; la versión evita sobrescribir cambios simultáneos. Se registra auditoría.
- El estado operativo `OMITIDO_INICIO` se limita a gates MATERIAL. No se interpreta como recepción física ni como aprobación de calidad.
- Al publicar el conjunto: migración, API y workers con el mismo código del motor, y aplicación web. Seguir primero el procedimiento de staging. La función permanece apagada hasta su activación explícita.
- Si se necesita revertir, conservar las columnas y las marcas históricas. No volver a una versión que ignore este modo después de haber emitido OTs con él; desactivarlo primero sólo cambia las órdenes nuevas.

## Comprobación local del 01/10/2026

- 124 pruebas del API y 41 de la interfaz y sus reglas pasaron.
- Base aislada `gdi_saas_test`, con datos de prueba. Sin seeds, resets ni cambios en bases de usuarios.
- Cotización sin stock: conserva cantidades, selección técnica y costos; no informa existencias falsas.
- Emisión directa y desde borrador, control de versión, separación de empresas, permisos y auditoría.
- No crea reservas, necesidades de compras ni movimientos. Las órdenes anteriores conservan sus reservas; desactivar el modo no afecta retroactivamente a las emitidas con él.
- Producción real en la base de prueba: permite completar al satisfacer calidad, manteniendo omitida la condición material. También conserva el modo al reemplazar lotes pendientes y regenerar pasos.
- Interfaz: activación y desactivación comprobadas en Chrome usando los componentes reales con datos ficticios. El vendedor ve el aviso sin poder cambiarlo. Se probó escribir C y P en el selector real de clientes; sólo funcionan como atajos fuera de los controles.
- Tipos completos del API y tipos de los 13 archivos de la web modificados: correctos. La revisión global de tipos de toda la web agotó el límite local de 2 GB; se resolvió con las compilaciones completas remotas aprobadas antes de publicar.
- La aplicación local habitual conserva su rama y sus procesos; esta comprobación usa una vista aislada. Al cerrar esta comprobación local todavía no se había desplegado; la publicación posterior se registra abajo.

## Publicación del 02/10/2026

La revisión `debada9153` quedó publicada en staging y producción, con API, ambos workers y web coordinados y 303 migraciones. CI completo aprobado y 28 comprobaciones HTTP en staging con empresas ficticias; emisión directa y desde borrador, avance con calidad, permisos, aislamiento y conservación del inventario. Se comprobó el botón y el buscador de clientes en Chrome en ambos entornos.

Grafica Corporearte conserva el modo **desactivado**. Para comenzar a usarlo, su administrador debe activarlo desde Stock. Se verificaron copias posteriores con la fuente e imágenes exactas. El PR #16 sigue separado de sus dependencias: desplegar no equivale a fusionarlo. Detalle operativo y límites en `deploy/staging/VALIDACION.md` y `deploy/produccion/VALIDACION.md`.
