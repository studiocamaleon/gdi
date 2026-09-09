# F6 — Validación con el catálogo real del exhibidor

**Estado:** adaptador y comparación técnica implementados; planificación operativa de OT pendiente. Rama `codex/f6-entregas-planificacion`. Complementa el [diseño funcional](visual-ilusion-fase-6-entregas-planificacion-diseno.md).

## Alcance verificado

Se conectó el selector con cotizaciones actuales de **Exhibidor · prueba de archivos y patrones**, obtenidas del motor y su cola normal para 50/100/150/200 unidades. Se leyó la carga real de la instalación local después de terminar esos cálculos: 11 ítems, 7 estaciones, captura del 09/09/2026 a las 15:17 de Argentina. Es el catálogo local de prueba; no certifica velocidades, disponibilidad ni compromisos de la planta de Visual Ilusión.

El recorrido conserva la receta publicada V6 del padre y la revisión de su componente. Para 200 productos hay 1.800 piezas: 200 cuerpos, 200 soportes, 200 faldones, 800 estantes, 200 costillas y 200 headers. El flujo activo es **pre-prensa → impresión → corte láser → ensamble**. Los opcionales apagados no se ejecutan, pero se conservan las dependencias que los atraviesan.

Cada cantidad obtiene una cotización completa. El orquestador solicita 200, 50, 100 y 150 una vez cada una para los seis candidatos; conserva opciones, tenant y configuración, acota el presupuesto y admite cancelación entre solicitudes. Reutiliza las soluciones de nesting de F4 a través del cotizador, sin cachear tarifas viejas ni persistir una propuesta comercial.

El adaptador comprueba revisión, producto, flujo, geometría, cantidades por tipo, tarifas, materiales y recursos compatibles entre fuentes. Si cambian durante el cálculo, rechaza la comparación. Si falta una cantidad, el candidato correspondiente queda sin estimación; nunca divide el tiempo de 200 para inventar el de 50.

## Geometría y costos

Las capturas tienen **32/64/96/128 placas** y cinco layouts para 50/100/150/200 unidades. Cada tanda referencia copias enteras del plan calculado para su cantidad. No se cortan placas a la mitad ni se asume que cualquier cuarta parte del plan de 200 contiene las piezas necesarias para 50 productos completos.

El corte conserva las mismas posiciones y particiones que la impresión, incluso si resulta ser la operación terminal. El sustrato se consume en impresión y no vuelve a sumarse en corte. Los balances verifican cada tipo de pieza por contenido de layout × copias, además del total de placas. Capas y contornos permanecen en el snapshot de origen; los escenarios transportan referencias, huellas y cantidades.

En el caso ensayado todas las alternativas consumen 128 placas. **No es una regla general:** otras cantidades o diseños pueden cambiar el rendimiento del nesting y el consumo. Los costos se suman por operación con sus materiales y deben reconciliar con el total de la cotización. Se preserva `totalMin` del motor, incluidos sus redondeos, tiempos fijos y extras; no se reconstruye sumando subtotales que podrían redondearse distinto.

## Resultados de la captura local

Política explícita de este escenario: revisar el vector una vez por pedido. El adaptador sólo admite esa política para una raíz sin geometría y con mediciones constantes; **no interpreta cualquier tiempo fijo como reutilizable**. Las fechas de esta tabla incluyen el margen de un día hábil configurado en el tenant.

| Organización de 200 exhibidores | Fechas sugeridas para 4 × 50 | Costo configurado | Diferencia |
| --- | --- | ---: | ---: |
| Fabricación conjunta | 02/10 · 02/10 · 02/10 · 02/10 | 958.726,14 | 0 |
| Tandas completas de 100 | 21/09 · 21/09 · 01/10 · 01/10 | 973.939,48 | +15.213,34 |
| Tandas completas de 50 | 17/09 · 21/09 · 25/09 · 01/10 | 1.005.787,90 | +47.061,75 |
| Impresión/corte de 100 y ensamble de 50 | 21/09 · 21/09 · 01/10 · 01/10 | 993.052,73 | +34.326,59 |
| Impresión/corte conjuntos y ensamble de 50 | 02/10 · 02/10 · 02/10 · 02/10 | 987.396,02 | +28.669,88 |
| Primera tanda de 50, luego 150 | 17/09 · 01/10 · 01/10 · 01/10 | 993.207,34 | +34.481,20 |

La política de adelantar entregas seleccionó provisionalmente tandas de 50: **+4,91 % de costo productivo configurado**, mismo consumo de placas. No modifica el precio de venta. Ninguno de esos candidatos desplazó las operaciones ya presentes en la simulación base.

**Todos los resultados son condicionados.** La validación encontró:

- Ensamble estructural está configurado con **30 minutos fijos** para 50, 100, 150 y 200 unidades. Puede ser una decisión válida, pero requiere confirmación; no se inventó otro rendimiento ni se cambió el producto.
- No hay una estación activa que reciba `ensamble_estructural`. El ETA usa su mecanismo de respaldo y el adaptador identifica ese faltante por nombre.
- La cola existente contiene operaciones con datos sin confirmar. Tampoco se confirmó stock/materiales ni se calibraron tiempos físicos de maquinaria.

Estas fechas permiten estudiar las alternativas, **no comprometer una entrega**. La simulación no reserva capacidad. El escenario con calendario controlado y cola vacía se conserva por separado para aislar la lógica de lotes del estado incompleto de esta instalación.

## Correcciones encontradas durante la validación

1. **Habilitación BOM omitida:** la creación de la OT buscaba sólo el ID del predecesor declarado. En este exhibidor apuntaba a trabajo manual apagado y perdía la espera de pre-prensa. Ahora resuelve sus ancestros activos más próximos, incluidas ramas paralelas. La integración real verifica la dependencia pre-prensa → impresión y ejecuta la orden completa para 50/100/150. Aplica a nuevas OTs; no reescribe en silencio órdenes existentes.
2. **Cotización terminada sin resultado en la consulta:** el worker podía completar entre `getJob` y `getState`, dejando una instancia vieja sin `returnvalue`. Se reprodujo al capturar 100 unidades; Redis ya tenía el resultado correcto. Ahora se relee el trabajo terminal antes de responder y no se informa una finalización vacía. Hay pruebas deterministas de éxito/fallo y la captura real completa pasó después de la corrección.

## Evidencia y reproducción

Código: `apps/api/src/eta/planificacion/adaptador-cotizacion.ts`, `cotizaciones-por-cantidad.ts` y el piloto existente. `EtaService.contextoSimulacion` comparte la misma lectura que usa el ETA actual, sin una segunda regla de carga ni escrituras.

Capturas de 50/100/150 reutilizadas desde F4; captura de 200 comprimida (~170 KiB) en `apps/api/test/fixtures/f6-planificacion/`. Pruebas de aislamiento/configuración, balances por tipo, registro impresión/corte, conservación de costos, fuente faltante, diagnóstico de estación, cancelación/presupuesto, opcionales BOM y carreras de la cola. Regresión de ETA, componentes anidados, incorporación opcional, entrega y persistencia real de geometría grande.

Quedaron aprobadas **115 pruebas distintas de aceptación y regresión**: corrida acumulada de 114 en 14 suites, seguida de 29 pruebas del adaptador/cola con la nueva prueba de diagnóstico incluida. Build API, lint de F6 y `git diff --check` aprobados. El `tsc --noEmit` general incluye pruebas antiguas con errores de tipos ajenos a este cambio; el build de producción y las suites específicas son los controles ejecutables utilizados. No se modificaron UI/CSS ni esquemas Prisma.

En la captura final las cuatro cotizaciones tardaron aproximadamente 1,1–2,2 segundos cada una, usando nesting ya disponible. Adaptación y evaluación local rondan 0,9 segundos. Los escenarios completos serializados ocupan ~191 KB sin copiar CAD. Estas medidas son de este caso; no prueban capacidad concurrente de cientos de tenants ni tiempos de una búsqueda geométrica nueva.

Desde `apps/api`, replay sin DB ni cola:

```sh
TS_NODE_PROJECT=tsconfig.json node -r ts-node/register test/benchmarks/planificacion-f6-real.ts
```

Captura nueva con servicios reales (sólo cálculos y lecturas), indicando explícitamente IDs y salida:

```sh
TS_NODE_PROJECT=tsconfig.json node --env-file=.env -r ts-node/register test/benchmarks/capturar-planificacion-f6.ts TENANT_ID PRODUCTO_ID RUTA_ALTERNATIVA_ID CARPETA_SALIDA
```

Este último runner está acotado al caso 200 → 4 × 50 y declara preparación única del vector. La política general deberá viajar en el contrato del planificador, no inferirse desde una pantalla.

Evidencia local: `output/f6-caso-real-2026-09-09/`, con capturas del servidor, comparación con cola real, replay controlado y logs de tests/build/lint. No se generaron propuestas ni órdenes comerciales; las OTs de aceptación se crean y eliminan en tenants efímeros de la base de pruebas.

## Límites y siguiente bloque

El adaptador cubre este recorrido de componentes con geometría en placas. Rechaza explícitamente consolidaciones económicas entre varios componentes, operaciones internas/tercerizadas no modeladas, rollos, panelizado, unidades fraccionarias, cargos sin operación y cambios de recurso entre cantidades. Todavía no recombina copias de un plan grande para abastecer entregas arbitrarias; usa planes completos por cantidad. Esos rechazos evitan fechas con balances o costos incompletos y deben integrarse como estados recuperables antes de habilitar otras familias.

El próximo bloque es cerrar **contratos de plan, compromiso, lote y reserva/revalidación concurrente**, y preparar la UI de distribución de entregas. En paralelo se debe validar el tiempo y la estación del ensamble del caso de aceptación. La planificación se podrá confirmar sólo con datos suficientes y capacidad vigente; simulaciones condicionadas seguirán siendo comparativas. La ejecución cuantitativa, entregas parciales, QR, división/fusión y cierre integral de F6 permanecen pendientes. F5 no fue iniciada.
