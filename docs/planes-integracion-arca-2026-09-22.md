# Planes: integración ARCA y configuración fiscal

Fecha: 22/09/2026. Incremento de F08; **no certifica todavía la emisión fiscal completa**.

## Resultado

- Verificar y activar consultan `fiscal_argentina` del contrato vigente. El flag histórico se interpreta únicamente a través del evaluador de compatibilidad; una versión publicada tiene prioridad.
- La admisión y la persistencia adquieren el lock de empresa. La llamada de verificación ocurre entre ambas transacciones, sin retener una conexión bloqueada mientras responde ARCA.
- Antes de guardar se revalidan contrato, acceso, país y contratación pendiente. Un checkout que retiraría la función impide iniciar o completar una nueva activación; una ampliación sin pago no la concede.
- Se compara la configuración fiscal probada y la versión/estado de la integración. Cambiar CUIT, punto de venta o desconectar durante la consulta invalida el resultado obsoleto. La ruta genérica de desconexión de integraciones aplica la misma coordinación para AFIP.
- Los puntos de venta inactivos no se usan para verificar. La integración está disponible para empresas de Argentina.
- `facturacionHabilitada` recibe la empresa explícitamente y comprueba contrato, estado operativo, país y conexión. El estado conectado guardado por sí solo no concede la función.

## Continuidad y pantallas

- Al retirar F08 se conserva la consulta del emisor, puntos de venta y último chequeo. Con acceso operativo se permite desconectar; con suscripción de baja la vista permanece de lectura.
- La API distingue inclusión en el plan, posibilidad de operar y posibilidad de desconectar. La vista también respeta el permiso personal de Administración y evita disparar verificación y activación simultáneas.
- Los datos básicos del emisor siguen editables para los recibos. Crear/editar puntos de venta y seleccionar por primera vez el proveedor automático requiere la función fiscal. Los cambios se guardan bajo el mismo lock de empresa.
- Cambiar el CUIT o el proveedor desconecta la delegación anterior conservando el chequeo histórico. No modifica comprobantes existentes.
- Los controles de proveedor y alta de puntos de venta muestran la limitación del plan. Un rechazo por cambio de contrato actualiza el estado visible de la integración.

## Verificación

Se ejecutaron en `gdi_saas_test`, con transporte ARCA simulado y sin emitir comprobantes externos:

- 20 casos de integración: tres planes publicados, función retirada frente a flag anterior habilitado, pago pendiente en ambos sentidos, retiro/baja durante la consulta, cambios de CUIT/punto, desconexión específica y genérica, país, continuidad de lectura y datos básicos.
- 14 pruebas unitarias de precondiciones y decisiones de integración.
- 25 pruebas del conjunto de concurrencia de cambios de plan, incluyendo una nueva con conexiones PostgreSQL independientes: la aplicación del resultado fiscal espera el lock de la asignación, comprobado mediante `pg_blocking_pids`, y rechaza activar al releer el contrato confirmado sin F08.
- Dos regresiones: facturación de componentes y recorrido Esencial de cotización, cobro y entrega sin ARCA.
- Ocho pruebas de interfaz: cinco de ARCA y tres de historial de avisos.

Los escenarios de intercalado en el archivo `afip-planes.integration.spec.ts` usan savepoints sobre una transacción exterior y no se presentan como pruebas de concurrencia entre conexiones. Esa evidencia corresponde al caso PostgreSQL independiente anterior.

TypeScript de API, web y pruebas focales, lint focal y control de CSS. La inspección visual en Chrome sigue pendiente por el bloqueo de automatización; las pruebas de interfaz verifican comportamiento, no el acabado visual.

## Continuación de F08

Estos puntos se abordaron después en [emisión fiscal y recuperación](planes-emision-fiscal-2026-09-22.md), con alcance, pruebas y límites propios. Eran los siguientes pendientes al cerrar este incremento de integración:

1. Control individual transaccional de borradores, emisión directa, facturación por OT/lote y notas. Actualmente no todos estos caminos usan el nuevo control individual.
2. Persistir la admisión y los datos de un envío fiscal antes de llamar al proveedor, impedir emisiones duplicadas y tratar respuestas inciertas sin reintentar ciegamente. El circuito actual del comprobante requiere revisión específica.
3. Recuperar el resultado fiscal de envíos anteriores incluso después de retirar F08, conservando el país, emisor y referencia originales.
4. Incorporar esas operaciones al diagnóstico de cambios de plan y validar continuidad de notas, carga de CAE, comprobantes/PDF y permisos personales.

No se modificaron impuestos, cálculos fiscales, numeración ni el transporte ARCA en este incremento. Las ofertas publicadas y las suscripciones de clientes tampoco se modificaron.
