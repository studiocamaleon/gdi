# Cierre de planes mensuales y anuales en sandbox

Fecha: 22/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Decisión comercial y alcance

El usuario confirmó **diez mensualidades por año, con dos meses bonificados**, y dejó la activación de cobros reales para **el lanzamiento de Grafo**. Los siguientes importes son USD por período, antes de impuestos:

| Plan | Usuarios incluidos | Almacenamiento | Mensual | Anual | Adicional mensual | Adicional anual |
| --- | --- | --- | --- | --- | --- | --- |
| Grafo Esencial | 3 | 250 GB | 190 | 1.900 | 15 | 150 |
| Grafo Pro | 20 | 500 GB | 290 | 2.900 | 15 | 150 |
| Grafo Avanzado | 40 | 1.500 GB | 690 | 6.900 | 15 | 150 |

El descuento equivale a 16,67% frente a doce pagos mensuales. El anual se cobra en un pago por los doce meses; no es una cuota mensual reducida.

## Configuración aplicada

- Guardado desde la sesión autenticada de Plataforma: los tres borradores pasaron a revisión 4.
- Publicación auditada de versiones 3, con los importes autorizados.
- Creación y verificación de doce precios nuevos de Paddle **sandbox**: plan y adicional, mensual y anual, para cada versión. Se conservaron los precios vinculados a versiones anteriores.
- Activación desde el formulario de Oferta comercial, con validación remota de importes, moneda, ciclos, cantidades e impuestos. Los tres planes siguen disponibles en el registro, con 14 días de prueba local sin tarjeta; Pro conserva la recomendación.
- El catálogo público devuelve versión 3 y los cuatro precios de cada plan. La pantalla de Suscripción muestra el total anual y el ahorro frente a doce mensualidades.
- No se modificaron contratos de empresas operativas ni credenciales, productos o precios de producción.

| Plan | Versión 3 | Oferta sandbox vigente |
| --- | --- | --- |
| Esencial | `bed824c3-c959-486f-9729-0d222199f4b6` | `10cd18ab-efd2-4acd-b596-68a67bd856bd` |
| Pro | `ba4f0348-cce9-4d91-9733-ba35458a8f75` | `bae992a8-5f4d-4ce5-bc82-262a3b79ada0` |
| Avanzado | `ab7c0917-8d87-49af-9f61-ae1dac927558` | `90785384-56e9-4b89-8bd1-e84e9080d68a` |

## Recorrido anual real de sandbox

Se reutilizó exclusivamente la empresa ficticia **PRUEBA · Planes Paddle 2026-09-22**, que había quedado de baja tras el ensayo mensual. Inicio de sesión normal en Chrome, preservando la sesión de Plataforma en el otro origen local.

1. Selección de Esencial anual y dos usuarios adicionales. Grafo mostró **USD 2.200/año** y **cinco usuarios**; pidió revisar las funciones retiradas respecto del contrato anterior.
2. Checkout embebido con indicador **test mode**, precio total coincidente y tarjeta ficticia oficial de Paddle. La transacción terminó en `completed`, USD 2.200, sin impuestos en esta prueba.
3. Los webhooks auténticos `subscription.activated` y `subscription.created` se procesaron y aplicaron sin errores. `transaction.completed` quedó registrado como ignorado según la política de provisión basada en la suscripción.
4. La contratación pasó a `aplicada`. La base y la interfaz confirmaron oferta/versión 3 de Esencial, ciclo anual, dos adicionales, cupo de cinco usuarios y renovación el **22/09/2027**. La consulta directa a Paddle confirmó un ítem de USD 1.900 y dos de USD 150, todos con ciclo `year`, frecuencia 1.
5. Se canceló inmediatamente **sólo esa suscripción de ensayo**. Los webhooks `subscription.updated` y `subscription.canceled` aplicaron la baja; la interfaz volvió a sólo lectura y mostró «Sin renovación». Se conservaron factura e historial.
6. El túnel ngrok temporal autorizado para las pruebas se cerró después de recibir la baja.

Referencias de evidencia:

- Empresa: `99846682-3876-4420-94e3-6eeb1df2b3b0`.
- Contratación: `532715dc-d6ce-4024-8fea-bd6cd1fbfe21`.
- Transacción: `txn_01m34gtdem708wdbkrc16e04a8`.
- Suscripción de sandbox, ya cancelada: `sub_01m34gvcw0gxrdmjj3pnfn33ch`.
- Factura ficticia: `116004-10015`.

No hubo pagos reales. La prueba utiliza [tarjetas oficiales de sandbox](https://developer.paddle.com/sdks/sandbox/) y precios recurrentes con [ciclo anual](https://developer.paddle.com/api-reference/prices/create-price/).

## Verificación y límites

Pasaron **55 pruebas en dos suites**: `planes-ofertas.spec.ts` y `contratacion.spec.ts`, incluida contratación anual, adicionales, versiones inmutables, validación de precios y rechazo de combinaciones incompatibles. Se ejecutaron contra `gdi_saas_test`; el checkout externo usa la empresa ficticia de desarrollo.

Este incremento cambia configuración comercial persistida y documentación; no necesitó cambios en el motor de contratación. La evidencia previa de compilación, controles de las 65 funciones, regresión completa, recorrido mensual y homologación fiscal permanece en la [auditoría consolidada](planes-auditoria-consolidada-2026-09-22.md).

**Cierre actual:** planes y contratación mensual/anual comprobados en desarrollo y sandbox. La prueba externa anual corresponde a Esencial con adicionales; no se afirma haber cobrado los tres planes anuales por separado ni ensayado una renovación al cabo de un año.

**Al lanzamiento:** configurar y verificar credenciales, precios, dominio/checkout, webhook y correo del entorno de producción. Es un paso diferido por decisión expresa del usuario, fuera del cierre actual. No se hizo commit, merge ni push en este incremento.
