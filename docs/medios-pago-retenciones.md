# Medios de pago, retenciones y acreditaciones

## Configuración por empresa

En Configuración → Métodos de pago, editar comisión, IVA de la comisión, cuenta y plazo. El plazo puede ser en días hábiles bancarios o corridos. Activar «Sufre retención» permite agregar reglas con régimen, jurisdicción, quién retiene, alícuota, base y vigencia. Sin reglas, no se inventa una tasa: sigue disponible la carga manual al cobrar.

Las bases automáticas son el bruto cobrado y el bruto menos comisión e IVA de la comisión. Si el régimen utiliza otra base, cargar la base y el importe manualmente. Usar el padrón o la liquidación real del agente para configurar la tasa; el porcentaje usado en las pruebas no es una recomendación fiscal. Las retenciones distintas no se calculan en cadena entre sí. Se rechazan duplicados del mismo agente/régimen/jurisdicción con vigencias superpuestas.

La simulación sobre $100.000 y el formulario de cobro comparten el cálculo con la API. Los importes se redondean a centavos. Cambiar el importe o la fecha recalcula las sugerencias mientras no se hayan editado manualmente; «Recalcular con configuración del método» permite volver a ellas.

## Cobrado, costo y disponible

- El bruto salda la deuda del cliente. Comisión, IVA de la comisión y retenciones explican la diferencia con el dinero disponible.
- La estimación de IIBB del motor de precios se conserva. Una retención sufrida se registra como pago a cuenta, sin agregarla de nuevo al costo del producto ni descontarla otra vez del margen.
- Ejemplo ficticio: bruto $100.000, comisión $1.000, IVA $210 y retención confirmada $3.458 dejan $95.332 disponibles. Una regla del 3,5 % sobre $98.790 estima $3.457,65; la confirmación permite reemplazar la estimación por el importe del comprobante.
- Esto no liquida automáticamente la declaración jurada del impuesto. [COMARB explica la deducción mensual de SIRTAC](https://www.ca.gob.ar/preguntas-frecuentes/sistemas/sirtac).

## Confirmar el dinero recibido

Los cobros electrónicos quedan pendientes hasta confirmar su liquidación en Tesorería → Acreditaciones, con fecha real, referencia e importes reales. Llegar a la fecha prevista **no genera un ingreso automático**. Efectivo y transferencias inmediatas sin retención bancaria/del procesador conservan la acreditación al registrar el cobro. Los cheques siguen en la cartera de valores: sólo admiten reglas de retención del cliente en el método; los descuentos bancarios corresponden a la gestión del valor.

Se conserva la configuración y la estimación originales de cada cobro nuevo. Confirmar guarda los importes reales y un único movimiento de fondos, incluso si dos operadores confirman simultáneamente. Las retenciones de banco/procesador pasan de estimadas a confirmadas. Las del cliente se registran en el período del cobro; las bancarias/del procesador, en el de acreditación. Los cobros históricos no se recalculan por editar el método.

## Calendario y mantenimiento

Para Argentina se incluyen fines de semana y el [calendario bancario BCRA 2026, Comunicación C 101352](https://www.bcra.gob.ar/consulta-feriados-bancarios/). Se pueden cargar fechas adicionales sin acreditación por proveedor. Los feriados futuros deben actualizarse al publicarse: si se cruza a un año sin calendario, o a otro país, el formulario advierte que sólo se excluyen fines de semana y fechas adicionales. El plazo es una previsión: no modela horas de corte ni sustituye la confirmación del proveedor.

## Actualización y comprobaciones

Migración aditiva `20261001100000_medios_pago_retenciones`; no borra ni recalcula historial. Debe aplicarse una vez antes de actualizar API, workers y web. No ejecutar seeds. Mantener la misma versión de API y ambos workers para evitar reactivar el antiguo planificador de acreditaciones. Revertir a una imagen anterior reactivaría ese comportamiento; revisar los cobros pendientes antes de una reversión.

Pruebas: cálculo con centavos, pagos parciales, feriados, fechas inválidas, vigencias, conservación del margen, creación/confirmación con PostgreSQL, confirmación concurrente, aislamiento entre empresas y permisos de Tesorería. Las pruebas usan empresas ficticias en una base independiente y servicios externos reemplazados.
