# F6 — Propuestas de entregas guardadas

Estado: implementado el recorrido de solicitud, cálculo asíncrono, revisión y
preferencia. **No es adopción productiva ni cierre de F6.** F5 continúa pendiente.

## Uso

En **Crear orden**, agregar el producto, abrir Especificaciones → **Distribuir
entregas**. También está disponible en OT guardadas en borrador o pendiente, sin
producción iniciada. El cálculo usa los inputs de una cotización guardada y no
acepta mediciones enviadas por el navegador. En una orden nueva se prepara ese
snapshot sin crear una OT: la distribución y la elección se vinculan en la misma
transacción del primer guardado. La distribución es del producto completo, con
sus componentes. Ver [el incremento de creación](visual-ilusion-fase-6-entregas-antes-de-guardar-2026-09-09.md).

Ejemplo: 200 exhibidores, cuatro entregas de 50. Se puede dejar la fecha vacía
para sugerirla o indicar fechas solicitadas. Se calculan una sola vez las
cantidades 200, 50, 100 y 150 con el motor real; las seis alternativas reutilizan
esas mediciones exactas, costos, layouts y dependencias. No se prorratea el
nesting de 200. Las primeras entregas tienen prioridad y se muestra el costo
adicional respecto de producir todo junto, además de la alternativa económica.
Esto compara candidatos; no demuestra una planificación global óptima.

La ventana muestra cantidades, fechas con margen, condiciones, placas y tandas
por operación. **Guardar alternativa** registra una preferencia. No cambia el
precio de venta, fecha comprometida, estados, rutas o pasos de la OT. La ventana
lo aclara expresamente. Se puede cerrar mientras calcula, volver a abrirla y
consultar la última revisión o recalcular. Se enumeran las últimas diez revisiones;
el resultado anterior permanece en DB, pero no hay un visor detallado histórico.

## Persistencia, concurrencia y recursos

- `PlanEntregaItem`: único por ítem, versión optimista, última revisión y elección.
- `PlanEntregaRevision`: solicitud confiable congelada, clave idempotente por
  empresa, estado, token de ejecución y resultado. Revisiones anteriores no se
  sobrescriben al recalcular.
- `PlanEntregaSolicitud`: cantidad, secuencia y fecha civil opcional por entrega.
- Transacción con cerrojos en orden empresa → plan. Dos ventanas no pueden crear
  la misma revisión con datos diferentes; reintentos idénticos comparten resultado.
- Una solicitud más reciente invalida el token anterior. Los resultados tardíos
  no reemplazan la revisión actual. El origen se comprueba antes y después de
  cotizar; si cambió la OT, el cálculo falla con un mensaje recuperable.
- Al simular una OT pendiente se sustituye su rama completa en la cola. Los otros
  ítems siguen presentes, evitando contar dos veces el trabajo propio.
- La elección comprueba origen, carga, capacidad, calendario, margen y antigüedad
  máxima de cinco minutos. Una propuesta vieja debe recalcularse. Esta comprobación
  **no es una reserva atómica de capacidad** ni garantiza tarifas futuras.
- API con permisos comerciales/de producción para lectura; gestión comercial
  para solicitar/elegir; costos podados sin `finanzas.ver_margenes`.
- Outbox en PostgreSQL: el API revisa solicitudes cada diez segundos y encola sólo
  empresa/revisión en `grafo-delivery-plans-v1`. No guarda CAD en Redis.
- Worker independiente, una planificación concurrente por proceso y semáforo de
  cotizaciones compartido por empresa. Máximo dos revisiones pendientes por empresa,
  doce cantidades distintas por solicitud y cincuenta entregas.
- Presupuesto de 45 minutos, comprobado entre cálculos. No interrumpe a la fuerza
  un nesting que ya está ejecutándose. Si pierde el turno, evita publicar el resultado.
  Un cálculo sin progreso durante cincuenta minutos pasa a fallido y se puede pedir
  de nuevo; también cubre interrupciones largas o pérdida de Redis.
- El resultado persiste mediciones y metadatos de layouts, no todas las cotizaciones
  con su CAD. Los inputs congelados usan el codec compacto de snapshots. El endpoint
  de consulta no lee esos inputs pesados y devuelve una vista resumida.

## Validación realizada

Migración aplicada primero en `gdi_saas_test`, luego en desarrollo. Se usan
empresas y categorías temporales aisladas, eliminadas por el propio test. Las
cotizaciones son capturas del exhibidor; la disponibilidad de estaciones en estos
tests es controlada, no una medición de Visual Ilusión.

- 62 pruebas backend: prototipo/adaptador, orquestación, persistencia, fechas,
  aislamiento, reintentos concurrentes, elección vencida, cambio de OT, sustitución
  de revisión y fallos de cotización.
- Una de esas pruebas recorre **outbox → Redis real → worker → Prisma** con cola
  temporal, y comprueba seis alternativas guardadas sin modificar precios/OT.
- La vista pública del caso 200 / 4 × 50 ocupa menos de 100 KB en el test y no
  contiene geometría ni los inputs congelados. No es un benchmark de carga SaaS.
- 22 pruebas frontend: distribución exacta y fechas, además de regresión temporal
  y proyección del grafo compuesto de la ficha.
- TypeScript de la aplicación, build del API y guard de CSS. Sin nuevas clases
  globales. Inspección en Chrome de una OT pendiente: apertura, carga del endpoint,
  estilo Grafoprint y bloqueo al distribuir más unidades que las vendidas.
- API y workers reiniciados; salud de API/base y nueva cola verificados.

Reproducción:

```sh
npm --prefix apps/api test -- --runInBand src/planificacion-entregas src/eta/planificacion src/eta/eta.controller.spec.ts
npm test -- src/lib/planificacion-entregas.test.ts src/lib/eta-fechas.test.ts src/lib/eta-cotizacion.test.ts
npm --prefix apps/api run build
npx tsc --noEmit
npm run css:guard
```

El test de recorrido requiere PostgreSQL de pruebas y Redis local en 6379; crea
su propia cola temporal. No se probaron centenas de usuarios concurrentes.

## Pendiente para el próximo bloque

1. Calibrar y asignar estación al ensamble del exhibidor: conserva los 30 minutos
   fijos del catálogo y por eso sus fechas reales siguen condicionadas.
2. Declarar en receta qué preparaciones se hacen una vez por pedido y cuáles se
   repiten. Esta integración conserva costo por tanda para todas; no presupone
   preprensa compartida como el fixture exploratorio anterior.
3. Adoptar la alternativa: revalidar costos/receta/carga y reservar recursos con
   exclusión concurrente; materializar lotes y sus rutas, sustituyendo la carga
   del ítem sin duplicarla. Replanificar lo pendiente conservando lo ejecutado.
4. Registrar buenos/rechazados/scrap y entregas parciales, ajustar gates, progreso,
   reportes, QR y tracking. Sigue pendiente la visualización detallada de revisiones
   anteriores. La distribución anterior al primer guardado ya está implementada.

Los límites previos del adaptador se mantienen: cantidades enteras, cotizaciones
publicadas consistentes, geometría en placas, sin consolidación entre pedidos,
tercerización ni conversiones o panelizados que el contrato no pueda demostrar.
Un caso fuera de ese alcance informa el motivo y no inventa una planificación.
