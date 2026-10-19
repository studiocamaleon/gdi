# Cobros bancarios y cambios de productos en OT

Preparado en `codex/cobros-edicion-ot`, desde `origin/main` (`5b1ee5c0e`).
Este bloque es independiente de la vista TV del PR #106 y se acumula para el
próximo lote. Incluye la migración `20261019160000_recibos_numero_por_empresa`;
no requiere cambios de credenciales.

## Registro de cobros

El permiso para cobrar permite registrar transferencias, tarjetas, QR y débito
automático en bancos o billeteras activos de la misma empresa. El selector de
cobro expone sólo identificador, nombre, tipo y moneda. No concede acceso a
saldos, egresos, arqueos, transferencias de Tesorería, anulaciones ni acreditación.
Las cajas de efectivo siguen sujetas a las cuentas asignadas al usuario.

La API y el formulario comparten la compatibilidad: efectivo → caja;
transferencia/tarjetas/QR/débito automático → banco o billetera. Un destino
predeterminado incompatible no se utiliza. Si falta una cuenta compatible,
el formulario bloquea el registro; la API también rechaza el intento.
La numeración del recibo es única dentro de cada empresa: dos empresas pueden
emitir `REC-2026-0001` sin colisión. La migración conserva todos los recibos y
sus números. Un conflicto distinto de la clave de idempotencia no se trata
como un reintento exitoso.

Los recibos bancarios se pueden consultar desde su OT sin alterar los permisos
para operar la cuenta. No se reclasifican cobros históricos.

## Edición de una OT en producción

Desde **Editar orden**, se pueden agregar productos y modificar o quitar
productos que todavía no comenzaron. La edición utiliza nuevas cotizaciones
sin reescribir el presupuesto original y recalcula totales y reservas.
Los productos nuevos reciben sus pasos pendientes.

El editor conserva íntegros los renglones sin cambios, incluyendo sus pasos,
componentes, archivos y tiempos. Si un componente pendiente cambia de receta,
sus adjuntos se conservan en el producto principal antes de retirar la estructura
anterior. El backend bloquea cambios de una línea o sus descendientes cuando:

- Ya hay ejecución, tiempos registrados, terminación o entrega.
- Tiene una compra en curso o pertenece a una tanda compartida.
- La OT tiene una factura emitida, preparada o en proceso, directa o agrupada.

La comprobación se hace dentro de la transacción después de bloquear la OT,
igual que la ejecución y facturación. Las versiones desactualizadas se rechazan.
El total no puede quedar por debajo de lo cobrado y conserva los puntos canjeados.
Las OT finalizadas, entregadas o canceladas no admiten cambios de productos.

Ejemplo: una OT tiene impresión iniciada y un vinilo pendiente. Se puede
reemplazar ese vinilo pendiente por PVC o agregar otro PVC, conservando la
impresión iniciada. Si el propio vinilo ya empezó, queda protegido.

## Comprobación local

Pruebas con empresas ficticias y PostgreSQL `gdi_saas_test`: vendedor con caja
restringida, registro bancario e idempotencia, rechazo de efectivo incompatible,
cuentas de otra empresa, conservación de permisos de Tesorería, altas y cambios
en producción, pasos y componentes conservados, rechazo por ejecución,
compra/tanda/facturación y por reducción debajo de lo cobrado. Pruebas de React
cubren el selector bancario y agregar productos conservando los iniciados.

La prueba de numeración reprodujo el fallo con dos empresas ficticias antes
de la migración; luego confirmó ambos recibos, reintentos sin duplicación y
rechazo de números repetidos dentro de una misma empresa.

No se ejecutaron seeds, resets, integraciones externas ni despliegues.
