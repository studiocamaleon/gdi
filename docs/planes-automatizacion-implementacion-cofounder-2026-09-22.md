# Ofertas automáticas, implementación y Co-founder

Estado: implementado y verificado el 22/09/2026 en desarrollo y Paddle sandbox. Producción queda para el lanzamiento, según la decisión del usuario.

## Condiciones aprobadas

| Plan | Usuarios incluidos | USD/mes | USD/año | Implementación USD | Prueba | Alta |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Grafo Esencial | 3 | 190 | 1.900 | 199 | 14 días | Pública |
| Grafo Pro | 20 | 290 | 2.900 | 499 | 14 días | Pública |
| Grafo Avanzado | 40 | 690 | 6.900 | 1.200 | 14 días | Pública |
| Co-founder Pro | 20 | 290 | 2.900 | 0 | 30 días | Invitación |
| Co-founder Avanzado | 40 | 690 | 6.900 | 0 | 30 días | Invitación |

- Usuario adicional: USD 15/mes o USD 150/año.
- El anual equivale a diez mensualidades. Implementación se suma una sola vez, también al contratar anualmente.
- Prueba local sin tarjeta. La suscripción paga comienza al completar el checkout, incluso si quedan días de prueba.
- Co-founder parte de las funciones, cupos y precios guardados de Pro/Avanzado. Es un borrador independiente: futuros cambios se publican explícitamente.
- Trial y Founder siguen siendo planes internos.
- Taller, Producción y Enterprise están archivados para nuevas altas. Se preservan los contratos y referencias históricas; Grafica Idea conserva el contrato anterior de Producción.

## Cómo operar desde Plataforma

1. **Planes → Usuarios y oferta**: elegir la familia de planes; editar precios, implementación, disponibilidad y días de prueba. Guardar borradores.
2. **Versiones → Revisar publicación → Publicar y preparar oferta**: revisar la versión guardada y publicar.
3. En **Oferta comercial**, indicar el motivo, revisar y elegir **Sincronizar y activar oferta**. Grafo crea los productos y precios de Paddle y los valida; no se ingresan identificadores.
4. Una oferta ya publicada conserva sus condiciones. Para cambiarlas, editar el borrador y publicar una nueva versión.
5. Para Co-founder, **Empresas → Crear empresa**, seleccionar el plan Co-founder y el correo del administrador. Elegir **Crear y enviar invitación**: Plataforma envía el correo con las condiciones de la oferta. Su estado y el reenvío están en la ficha de empresa. La prueba empieza al crear la empresa y el correo informa la fecha exacta; reenviar no extiende ese plazo. La oferta no aparece en el registro público ni puede contratarla una empresa ajena adivinando su identificador.

Publicar sólo una versión sigue disponible para revisar capacidades antes de poner una oferta en venta. No se migran silenciosamente los contratos existentes.

## Consistencia técnica

- `ContenidoPlan.comercial` contiene acceso, días de prueba e implementación. Forma parte del snapshot inmutable de la versión.
- `PlanesPaddleService` usa la misma autorización de staff ADMIN, sesión vigente y MFA de Plataforma. La activación vuelve a verificar autorización y revisión optimista.
- `PlanPaddleRecurso` conserva el progreso por versión, entorno y clave. Toma exclusiva por estado, búsqueda de recursos por metadata y reconciliación de respuestas inciertas evitan repetir un POST a ciegas.
- Productos/precios se crean por versión y entorno. Importe, moneda, ciclo, prueba, impuestos y cantidades se contrastan con Paddle antes de activar.
- Implementación es un precio `implementacion/unico`, con cantidad uno y sin ciclo recurrente. Se agrega a la transacción inicial, nunca a un cambio de suscripción.
- `Suscripcion.implementacionResueltaEl/implementacionImporte` conservan el cumplimiento o la exención tras el primer contrato. La migración exime los contratos con referencia externa anteriores a esta política, sin cargos retroactivos.
- Para un cargo positivo se exige una transacción completada del mismo tenant/intento/suscripción, con el precio, importe y cantidad exactos. Un webhook prematuro no concede el nuevo contrato hasta confirmar ese pago.
- `transaction.completed` consulta el estado de la suscripción y reconcilia. Un fallo de consulta conserva el evento pendiente para el reintento; los eventos duplicados no se aplican dos veces.
- Las ofertas privadas se muestran únicamente al tenant que tiene asignado ese plan. El alta pública las excluye y el servidor rechaza una contratación ajena.
- Registro, web pública, selección de plan, revisión y checkout muestran el cargo inicial. El abono recurrente se presenta separado del primer pago.

## Verificación

- 100 pruebas de backend: publicación, ofertas, sincronización, recuperación de POST incierto, autorización, aislamiento, trial/invitación, implementación mensual/anual, pago incompleto/manipulado, reactivación y webhook firmado/reintentos.
- 28 pruebas de interfaz y 8 de web pública.
- Build de API, TypeScript de web y marketing correctos. Lint sin errores; el test HTTP conserva advertencias de tipado `any` de Supertest.
- Cinco ofertas reales creadas/activadas automáticamente en **sandbox**: versión 4 de los tres planes normales y versión 1 de los dos Co-founder.
- Recorrido real desde la pantalla de suscripción de una empresa ficticia: Esencial USD 190 + implementación USD 199 = **USD 389**. Tarjeta oficial de prueba; sin dinero real.
- Transacción: `txn_01m3572hmhz46t4cwjps7wx95k`, completada en USD por 38900 centavos.
- Suscripción: `sub_01m35753b1d71fejs8qp3s1d7s`, un único ítem recurrente de USD 190 mensuales. Webhook inicial prematuro quedó sin aplicar; eventos posteriores de creación/pago completado confirmaron el contrato.
- Suscripción ficticia cancelada al cerrar la prueba. Revisión de reactivación comprobada: **USD 190 inicial, implementación USD 0**.
- Túnel temporal cerrado al terminar. No se enviaron correos reales ni se activó producción.

## Al lanzamiento

Configurar la cuenta/clave de producción y el destino de webhook firmado (eventos `subscription.*` y `transaction.completed`), dominio de checkout y correo. Sincronizar las versiones en ese entorno desde Plataforma: los identificadores de sandbox no se reutilizan en producción. Los cobros reales no se habilitaron en este incremento.
