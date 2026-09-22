# Colas productivas y cambios de plan · 22/09/2026

## Problema corregido

La consulta HTTP de colas tenía el control P07, pero el controlador separado de acciones y los servicios internos no lo exigían. Una petición directa podía iniciar o completar trabajos desde la cola aunque la función no estuviera contratada.

## Comportamiento

- Consulta de máquinas y filas: comprueba `colas_produccion` en el servicio, incluida la lectura interna con una transacción. Conserva consultas si el contrato mantiene la función y la empresa está en sólo lectura.
- Acción individual y finalización múltiple: comprueban el plan al entrar, además de los permisos personales. El núcleo de ejecución vuelve a comprobarlo después de tomar el lock de empresa, antes de bloquear las OT o escribir. El cambio de contrato y la acción no pueden confirmarse usando versiones incompatibles.
- Simulación de aprovechamiento: comprueba la capacidad al solicitar, antes de calcular y antes de devolver el resultado. Las solicitudes duplicadas comparten el cálculo, pero no eluden la validación final. No retiene una transacción durante el cálculo geométrico.
- Retirar P07 deshabilita la vista y sus acciones. Los pasos y sus tiempos se conservan; se pueden terminar desde el tablero según los permisos y condiciones de la OT. La cola es una proyección de esos pasos: no tiene un compromiso ni una tanda persistida independiente que deba migrarse.
- La selección múltiple sigue siendo un registro atómico de varias operaciones. No se incorporan órdenes de impresión ni tandas nuevas en este cambio.

## Evidencia

Base exclusiva `gdi_saas_test`:

- Seis pruebas nuevas con publicación y asignación reales: Esencial/Pro/Avanzado, retirada con una OT abierta y continuidad por el tablero, cambio entre la admisión y la transacción, y permisos/capacidad en las dos rutas HTTP de acciones.
- Prueba de cálculo real con retirada de capacidad simulada mientras corre: ambas solicitudes duplicadas rechazan el resultado, y la plaza queda disponible para la siguiente simulación autorizada.
- Regresión de consultas, simulación, límites concurrentes del cálculo, acciones de cola y ejecución atómica.

Resultado: **60 pruebas API aprobadas en seis suites**, contando la regresión inicial de 59 y el caso nuevo de retirada durante el cálculo. Tipos de producción API, lint de los servicios/controlador y pruebas modificadas, y `git diff --check` sin errores.

La intercalación de asignación y acción usa savepoints sobre una misma conexión. No constituye una prueba nueva de carrera entre conexiones PostgreSQL independientes. Los tests existentes de ejecución atómica sí ejercitan acciones simultáneas, pero no un cambio de plan simultáneo. La simulación no guarda resultados históricos y una retirada durante el cómputo descarta su salida; no interrumpe el worker ya iniciado.

No requiere migración. No cambia precios, contratos de desarrollo ni ofertas Paddle. Asignación automática de personal (P04), las otras combinaciones pendientes y la preparación de producción siguen fuera de este incremento.
