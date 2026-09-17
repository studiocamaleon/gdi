# Operación de máquina configurable — 11/09/2026

## Comportamiento

En **Costos → Maquinaria → máquina → Ajustes → Operación de máquina**, cada tenant puede elegir:

- **Con operario:** la máquina y la dotación del paso permanecen ocupadas durante la operación. Una segunda persona del mismo equipo puede atender otro trabajo si hay capacidad.
- **Autónoma:** se libera al equipo en las fases de operación automática. Preparación, tiempos fijos, cargas, recargas, cambios de herramienta y cierre conservan sus reservas atendidas.
- Una máquina sin elección explícita conserva el estado **Sin configurar**. El ETA reserva personas de forma conservadora y señala que la estimación es orientativa.

La configuración vive en `Maquina.parametrosTecnicosJson.operacionMaquina`, validada como `con_operario` o `autonoma`, con la misma autorización, control de versión e historial de la ficha de máquina. No se incorporan minutos de atención a los perfiles ni se modifica el costo por hora existente.

## Cotizaciones y OT pendientes

La cotización deriva las fases de sus tiempos y conserva la secuencia base. Esta permite cambiar entre operación atendida y autónoma sin perder cargas y recargas, incluso en demandas consolidadas. La suma de minutos y la dotación de los extras se conservan.

El ETA del backend y el motor del navegador aplican la configuración vigente al trabajo pendiente. El detalle del tablero recibe el mismo comportamiento; las cotizaciones previas a la OT también toman la configuración de las máquinas de las estaciones. Los pasos terminados y las trazabilidades de precio no se reescriben. El paso del tiempo registrado se descuenta antes de proyectar las fases restantes.

La huella F6 incorpora el comportamiento de las máquinas a través de las estaciones, y cambia su versión de contrato. Una propuesta calculada antes del cambio debe recalcularse; guardar la máquina no cambia automáticamente compromisos de entrega ni acepta una nueva reprogramación.

Para históricos sin desglose verificable se recupera una sola vez la dotación desde la cotización exacta del paso: mismo tenant, ruta, máquina y duración. Una guillotina configurada con operario puede verificar su ocupación completa con esa dotación, aunque no conozca cada recarga interna. Elegir autónoma no inventa una secuencia que el histórico no conservó.

La recuperación mantiene consultas por lotes de 80 y actualiza únicamente los metadatos de demanda con compare-and-set. Las recuperaciones antiguas sin verificar se revisan una vez; las ya tratadas se omiten. Una tanda consolidada no se reconstruye con el tiempo de un participante.

## Gantt

Se reemplaza RUN en la interfaz por **Operación de máquina**. El tooltip y el detalle diferencian operación autónoma y operación con operario cuando se conserva el desglose. La operación atendida comparte el color de ocupación del operario; la autónoma conserva su color propio. El ancho sigue representando la duración real.

El detalle muestra el funcionamiento de la máquina y un acceso a su configuración. Los motivos de una proyección orientativa distinguen falta de configuración de un desglose histórico incompleto.

## Validación y configuración del tenant de prueba

Se guardó desde la ficha la Polar 92 ED como **Con operario** y la UV Híbrida y Ecosolvente como **Autónomas**, de acuerdo con los casos confirmados por el usuario. Las otras 13 máquinas activas mantienen su elección pendiente; no se deduce autonomía por tipo de equipo.

Se contrastaron las 40 operaciones activas con el 11/09/2026 a las 11:02:16 como referencia. No se encontraron solapes de una misma máquina, exceso de capacidad humana, dependencias violadas ni diferencias en las duraciones respecto de la auditoría anterior.

En OT-2026-0047, la guillotina conserva 12 minutos, con una persona ocupada durante todo el trabajo y atención verificada. La producción completa sigue siendo orientativa mientras la Ricoh C8003 no tenga definido su funcionamiento.

Las pruebas cubren operación atendida/autónoma, dotación de una y dos personas, recargas, cambio de comportamiento sobre una demanda guardada, serialización, consolidación, falta de configuración, lectura histórica acotada al tenant y preservación de minutos y costos. La comprobación en navegador incluye el guardado real de las tres máquinas y el detalle actualizado del Gantt.
